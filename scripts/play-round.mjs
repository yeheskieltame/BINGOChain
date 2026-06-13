#!/usr/bin/env node
// Play a full BINGOChain round on Celo Sepolia against the live proxy, end to end:
// createArena -> commitBoard x2 -> callNumber... -> claimBingo -> revealBoard x2
// -> settle -> winner withdraw. Funds two ephemeral player wallets from the
// operator and sweeps leftovers back at the end. Prints every tx hash.
//
// Usage (from repo root):
//   OPERATOR_KEY=0x... node scripts/play-round.mjs [scenario]
//   scenario: "winner" (default) | "tie" | "fallback"
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
// viem is vendored in the sibling Claudelance worker toolchain.
const require = createRequire('/Users/kiel/Documents/Hacathon/celo-pos/Claudelance/packages/sdk/package.json');
const {
  createPublicClient, createWalletClient, http, parseEther, formatEther,
  keccak256, encodeAbiParameters, decodeEventLog,
} = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const RPC = process.env.CELO_SEPOLIA_RPC || 'https://forno.celo-sepolia.celo-testnet.org/';
const PROXY = process.env.PROXY || '0xa21424B1F8c08e3d437942110081ef9F1b7589A6';
const SCENARIO = process.argv[2] || 'winner';
const chain = {
  id: 11142220, name: 'Celo Sepolia', nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
};

const abi = JSON.parse(readFileSync(join(ROOT, 'contracts/out/BingoChain.sol/BingoChain.json'), 'utf8')).abi;
const pub = createPublicClient({ chain, transport: http(RPC) });

const operatorKey = process.env.OPERATOR_KEY;
if (!operatorKey) throw new Error('set OPERATOR_KEY');
const operator = privateKeyToAccount(operatorKey);
const opWallet = createWalletClient({ account: operator, chain, transport: http(RPC) });

// ── board builders ───────────────────────────────────────────────
const ordered = () => Array.from({ length: 25 }, (_, i) => i + 1);
function loserFor1to21() {
  const blocked = new Set([0, 6, 18, 24]);
  let small = 1, big = 22;
  const b = [];
  for (let p = 0; p < 25; p++) b.push(blocked.has(p) ? big++ : small++);
  return b;
}
const commitment = (board, salt) =>
  keccak256(encodeAbiParameters([{ type: 'uint8[25]' }, { type: 'bytes32' }], [board, salt]));

// ── helpers ──────────────────────────────────────────────────────
let gasPrice;
async function refreshGas() { gasPrice = ((await pub.getGasPrice()) * 15n) / 10n; }

async function send(account, fn, args, value = 0n) {
  const wallet = createWalletClient({ account, chain, transport: http(RPC) });
  const hash = await wallet.writeContract({ address: PROXY, abi, functionName: fn, args, value, gasPrice });
  return pub.waitForTransactionReceipt({ hash });
}
function arenaIdFromReceipt(receipt) {
  for (const lg of receipt.logs) {
    try {
      const d = decodeEventLog({ abi, data: lg.data, topics: lg.topics });
      if (d.eventName === 'ArenaCreated') return d.args.arenaId;
    } catch { /* not our event */ }
  }
  throw new Error('ArenaCreated event not found in receipt');
}
async function fund(to, amount) {
  const hash = await opWallet.sendTransaction({ to, value: amount, gas: 21000n, gasPrice });
  await pub.waitForTransactionReceipt({ hash });
  return hash;
}
async function sweep(account) {
  const bal = await pub.getBalance({ address: account.address });
  const buffer = parseEther('0.03'); // generous margin over the 21k-gas fee
  if (bal <= buffer) return;
  const wallet = createWalletClient({ account, chain, transport: http(RPC) });
  try {
    const hash = await wallet.sendTransaction({ to: operator.address, value: bal - buffer, gas: 21000n, gasPrice });
    await pub.waitForTransactionReceipt({ hash });
  } catch (e) {
    log(`  sweep ${account.address.slice(0, 8)} skipped: ${e.shortMessage ?? 'err'}`);
  }
}
const log = (m) => console.log(m);

// ── run ──────────────────────────────────────────────────────────
await refreshGas();
log(`BINGOChain live round on Celo Sepolia — scenario=${SCENARIO}`);
log(`proxy=${PROXY} gasPrice=${formatEther(gasPrice)} CELO`);

const STAKE = parseEther('1');
if (!process.env.P1_KEY || !process.env.P2_KEY) throw new Error('set P1_KEY and P2_KEY (persistent test wallets)');
const p1 = privateKeyToAccount(process.env.P1_KEY);
const p2 = privateKeyToAccount(process.env.P2_KEY);
log(`player1=${p1.address}`);
log(`player2=${p2.address}`);

// scenario boards + how many numbers to call
let board1, board2, callUpto, claimer;
if (SCENARIO === 'tie') { board1 = ordered(); board2 = ordered(); callUpto = 21; claimer = p1; }
else if (SCENARIO === 'fallback') { board1 = ordered(); board2 = loserFor1to21(); callUpto = 5; claimer = p1; }
else { board1 = ordered(); board2 = loserFor1to21(); callUpto = 21; claimer = p1; } // winner

const salt1 = keccak256(encodeAbiParameters([{ type: 'string' }], ['salt-p1']));
const salt2 = keccak256(encodeAbiParameters([{ type: 'string' }], ['salt-p2']));

log('\n[fund] topping up players (3 CELO each)…');
await fund(p1.address, parseEther('3'));
await fund(p2.address, parseEther('3'));

log('[createArena] player1 opens a 2-seat arena, stake 1 CELO');
const createRcpt = await send(p1, 'createArena', [2, STAKE]);
// Derive the new arena id from the ArenaCreated event (no public counter getter).
const id = arenaIdFromReceipt(createRcpt);
log(`  arenaId=${id}`);

log('[commitBoard] both players join + commit sealed boards');
await send(p1, 'commitBoard', [id, commitment(board1, salt1)], STAKE);
await send(p2, 'commitBoard', [id, commitment(board2, salt2)], STAKE);

log(`[callNumber] alternating calls 1..${callUpto}`);
for (let n = 1; n <= callUpto; n++) {
  const who = n % 2 === 1 ? p1 : p2;
  await send(who, 'callNumber', [id, n]);
  process.stdout.write(`  called ${n}\r`);
}
log('');

log('[claimBingo] freezing the call sequence');
await send(claimer, 'claimBingo', [id]);

log('[revealBoard] both reveal');
await send(p1, 'revealBoard', [id, board1, salt1]);
await send(p2, 'revealBoard', [id, board2, salt2]);

log('[settle] replay + payout');
const settleRcpt = await send(p1, 'settle', [id]);
log(`  settle tx=${settleRcpt.transactionHash}`);

// forno load-balances replicas; a read right after the settle write can hit a
// lagging replica. Give it a moment so the displayed result is accurate.
await new Promise((r) => setTimeout(r, 8000));
const earn = (a) => pub.readContract({ address: PROXY, abi, functionName: 'earningsOf', args: [a] });
const treasury = await pub.readContract({ address: PROXY, abi, functionName: 'treasury' });
log(`\n[result] earnings p1=${formatEther(await earn(p1.address))} p2=${formatEther(await earn(p2.address))} treasury=${formatEther(await earn(treasury))} CELO`);

// Always attempt withdraw (withdraw() pulls the full balance); ignore the
// stale-read gate and just catch NothingToWithdraw.
log('[withdraw] winners pull their funds');
for (const p of [p1, p2]) {
  try {
    const r = await send(p, 'withdraw', []);
    log(`  ${p.address.slice(0, 8)} withdraw tx=${r.transactionHash}`);
  } catch { /* nothing to withdraw */ }
}

log('[cleanup] sweeping leftovers back to operator');
await sweep(p1);
await sweep(p2);
log('done.');
