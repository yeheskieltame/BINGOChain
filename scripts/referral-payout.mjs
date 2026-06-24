// Pay referral rewards to inviters in $LANCE (operator-funded, off-chain payout).
// Reads the backend's payable referral list, sends $LANCE from the deployer wallet
// to each referrer, then marks each entry paid via the backend API.
//
// Usage:
//   REFERRAL_ADMIN_KEY=<secret> node scripts/referral-payout.mjs
//   REFERRAL_ADMIN_KEY=<secret> API=https://... node scripts/referral-payout.mjs
//
// Required env:
//   REFERRAL_ADMIN_KEY  — backend admin secret key (auth for /api/referrals endpoints)
// Optional env:
//   API                 — BINGOChain API base URL (default: https://bingochain-api-production.up.railway.app)

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const CLAUDELANCE = join(__dir, "..", "..", "Claudelance");
const require = createRequire(join(CLAUDELANCE, "packages/sdk/package.json"));

const {
  createPublicClient, createWalletClient, http,
  parseEther, formatEther, parseGwei, getAddress,
} = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { celo } = require("viem/chains");

// ── config ───────────────────────────────────────────────────────────────────
const ADMIN_KEY = process.env.REFERRAL_ADMIN_KEY;
if (!ADMIN_KEY) {
  console.error("ERROR: REFERRAL_ADMIN_KEY env var is required.");
  console.error("Usage: REFERRAL_ADMIN_KEY=<secret> node scripts/referral-payout.mjs");
  process.exit(1);
}

const API = (process.env.API || "https://bingochain-api-production.up.railway.app").replace(/\/$/, "");
const RPC = "https://forno.celo.org";
const LANCE = getAddress("0xb70c9Cd73428Afe51eEEA832C49E8840D3f85cA2");
const FEE = { maxFeePerGas: parseGwei("260"), maxPriorityFeePerGas: parseGwei("2") };

const ERC20 = [
  {
    type: "function", name: "transfer", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "v", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
];

const deployerKey = readFileSync(join(CLAUDELANCE, "contracts/.env"), "utf8")
  .match(/^MAINNET_DEPLOYER_PRIVATE_KEY=(.+)$/m)[1].trim();
const deployer = privateKeyToAccount(deployerKey.startsWith("0x") ? deployerKey : `0x${deployerKey}`);

const pub = createPublicClient({ chain: celo, transport: http(RPC) });
const wallet = createWalletClient({ account: deployer, chain: celo, transport: http(RPC) });

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Fetch payable referrals from the backend (admin key in header, not the URL)
  const payableUrl = `${API}/api/referrals/payable`;
  log(`fetching payable referrals from ${payableUrl}`);
  let items;
  try {
    const res = await fetch(payableUrl, { headers: { "x-admin-key": ADMIN_KEY } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    items = await res.json();
  } catch (e) {
    console.error(`ERROR: failed to fetch payable list: ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(items) || items.length === 0) {
    log("nothing payable — exiting");
    process.exit(0);
  }
  log(`found ${items.length} payable referral(s)`);

  // Pre-flight: check deployer $LANCE balance
  const totalWei = items.reduce((s, it) => s + parseEther(String(it.amount)), 0n);
  const lbal = await pub.readContract({ address: LANCE, abi: ERC20, functionName: "balanceOf", args: [deployer.address] });
  log(`deployer LANCE balance: ${formatEther(lbal)} | required: ${formatEther(totalWei)}`);
  if (lbal < totalWei) {
    console.error(`ERROR: insufficient $LANCE — have ${formatEther(lbal)}, need ${formatEther(totalWei)}`);
    process.exit(1);
  }

  // 2. Process each item sequentially with nonce management
  let nonce = await pub.getTransactionCount({ address: deployer.address, blockTag: "pending" });
  let paid = 0;
  const failures = [];

  for (const item of items) {
    const { referrer, referree, amount } = item;
    const amountWei = parseEther(String(amount));
    let hash;

    // Broadcast ONCE — never re-broadcast on receipt-wait failure
    try {
      hash = await wallet.writeContract({
        address: LANCE,
        abi: ERC20,
        functionName: "transfer",
        args: [getAddress(referrer), amountWei],
        gas: 120000n,
        nonce: nonce++,
        ...FEE,
      });
    } catch (e) {
      const msg = e.shortMessage || e.message || String(e);
      log(`FAIL broadcast  referrer=${referrer} referree=${referree} amount=${amount}: ${msg}`);
      failures.push({ referrer, referree, amount, error: msg });
      continue;
    }

    // Poll for receipt — do NOT re-broadcast on wait hiccup
    let receipt;
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60000 });
        break;
      } catch (e) {
        const msg = e.shortMessage || e.message || String(e);
        if (attempt === 6) {
          log(`FAIL receipt    referrer=${referrer} referree=${referree} tx=${hash}: ${msg}`);
          failures.push({ referrer, referree, amount, hash, error: `receipt-wait: ${msg}` });
          receipt = null;
          break;
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
    if (!receipt) continue;

    if (receipt.status !== "success") {
      log(`FAIL reverted   referrer=${referrer} referree=${referree} tx=${hash}`);
      failures.push({ referrer, referree, amount, hash, error: "tx reverted" });
      continue;
    }

    // 3. Mark paid on the backend (only after confirmed on-chain success). A failure
    //    here is CRITICAL: the $LANCE already moved on-chain but the ledger still
    //    shows the row payable, so a re-run would pay the SAME referrer AGAIN. Retry,
    //    then HARD-STOP the run for manual reconciliation rather than continuing.
    let marked = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const markRes = await fetch(`${API}/api/referrals/mark-paid`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
          body: JSON.stringify({ referree, tx: hash }),
        });
        if (!markRes.ok) {
          const text = await markRes.text().catch(() => "");
          throw new Error(`HTTP ${markRes.status}: ${text}`);
        }
        marked = true;
        break;
      } catch (e) {
        if (attempt === 3) {
          log(`FATAL mark-paid referrer=${referrer} referree=${referree} tx=${hash} — ${e.message}`);
          failures.push({
            referrer, referree, amount, hash,
            error: `MARK-PAID FAILED (ALREADY PAID ON-CHAIN ${hash}) — reconcile before re-running: ${e.message}`,
          });
        } else {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }
    // Stop the whole run if a confirmed payment could not be recorded: continuing
    // would risk more unrecorded payments compounding the reconciliation.
    if (!marked) break;

    log(`paid ${amount} $LANCE to ${referrer} for ${referree} tx=${hash}`);
    paid++;
  }

  // 4. Summary
  console.log("\n═══════════ REFERRAL PAYOUT SUMMARY ═══════════");
  console.log(`total payable : ${items.length}`);
  console.log(`paid OK       : ${paid}`);
  console.log(`failures      : ${failures.length}`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  FAIL ${f.referrer} (for ${f.referree}) amount=${f.amount} — ${f.error}`));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
