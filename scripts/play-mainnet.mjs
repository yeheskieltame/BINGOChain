// BINGOChain mainnet play harness — runs MANY arenas concurrently with fresh
// rotating wallets, full lifecycle on the live contract, capturing the on-chain
// event timeline so we can design the "many arenas at once" lobby UI.
//
// Real mainnet: stake = minStake(CELO) = 1 CELO/player, each wallet pays its own
// gas (no gasless relayer yet). All players are operator wallets (operator
// dogfooding — NOT third-party adoption): stakes recycle between operator
// wallets, the 1% fee lands in the operator treasury, so net cost ≈ gas.
//
// Usage:
//   node scripts/play-mainnet.mjs check      # preflight: balance vs required, self-test
//   node scripts/play-mainnet.mjs run        # fund + play all arenas concurrently
//   node scripts/play-mainnet.mjs sweep FILE # recover funds from a wallets-*.json
//
// Env overrides: ARENAS (default 16), PLAYERS (default 2), FUND (default 1.35),
//   STAGGER_MS (default 250).

import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const CLAUDELANCE = join(ROOT, "..", "Claudelance");
const require = createRequire(join(CLAUDELANCE, "packages/sdk/package.json"));

const {
  createPublicClient, createWalletClient, http,
  parseEther, formatEther, parseGwei,
  keccak256, encodeAbiParameters, decodeEventLog, getAddress,
} = require("viem");
const { privateKeyToAccount, generatePrivateKey } = require("viem/accounts");
const { celo } = require("viem/chains");

// ── config ───────────────────────────────────────────────────────────────
const RPC = process.env.CELO_RPC || "https://forno.celo.org";
const PROXY = getAddress("0x8bE7c07CCF9FF515d82D4c36aB4EB937941432f1");
const CELO = getAddress("0x471EcE3750Da237f93B8E339c536989b8978a438");
const ARENAS = Number(process.env.ARENAS || 18);
const PLAYERS = Number(process.env.PLAYERS || 2);
const VARY = process.env.VARY !== "0"; // vary seats 2-4 across arenas for a realistic mixed lobby
const FUND = process.env.FUND || "1.5"; // native CELO per player (1 stake + gas, incl. creator's settle)
const STAGGER_MS = Number(process.env.STAGGER_MS || 400);
const STAKE_TOKEN = getAddress(process.env.STAKE_TOKEN || CELO); // stake/settle token (CELO or $LANCE)
const STAKE = parseEther(process.env.STAKE_AMOUNT || "1"); // stake per player, in STAKE_TOKEN units (18 dec)
const GAS_FLOOR = parseEther(process.env.GAS_FLOOR || "1.6"); // native CELO floor per used wallet (gas; also covers stake when STAKE_TOKEN=CELO)

// seats for arena i: cycles 2,3,4 when VARY (mixed lobby), else fixed PLAYERS
const seatsFor = (i) => (VARY ? 2 + (i % 3) : PLAYERS);
const TOTAL_PLAYERS = Array.from({ length: ARENAS }, (_, i) => seatsFor(i)).reduce((a, b) => a + b, 0);

const ABI = JSON.parse(readFileSync(join(ROOT, "contracts/out/BingoChain.sol/BingoChain.json"))).abi;
const ERC20_ABI = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
];

const deployerKey = readFileSync(join(CLAUDELANCE, "contracts/.env"), "utf8")
  .match(/^MAINNET_DEPLOYER_PRIVATE_KEY=(.+)$/m)[1].trim();
const deployer = privateKeyToAccount(deployerKey.startsWith("0x") ? deployerKey : `0x${deployerKey}`);

// Generous fees: Celo base fee floors at 200 gwei; cap high so nothing stalls.
const FEE = { maxFeePerGas: parseGwei("260"), maxPriorityFeePerGas: parseGwei("2") };
const GAS = {
  fund: 30000n, approve: 80000n, createArena: 260000n, commitBoard: 220000n,
  callNumber: 160000n, claimBingo: 120000n, revealBoard: 260000n, settle: 900000n,
  withdraw: 110000n, sweep: 30000n,
};

const pub = createPublicClient({ chain: celo, transport: http(RPC) });
const wallet = (account) => createWalletClient({ account, chain: celo, transport: http(RPC) });

// ── 5x5 line geometry (mirrors LineLib) ────────────────────────────────────
const LINES = [
  [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24], // rows
  [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24], // cols
  [0,6,12,18,24],[4,8,12,16,20], // diagonals
];
const WIN_LINES = 5;

function shuffledBoard() {
  const b = Array.from({ length: 25 }, (_, i) => i + 1);
  for (let i = 24; i > 0; i--) { const j = randomBytes(1)[0] % (i + 1); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
function commitmentOf(board, salt) {
  return keccak256(encodeAbiParameters([{ type: "uint8[25]" }, { type: "bytes32" }], [board, salt]));
}
// positions on `board` whose number is in `calledSet`
function markedPositions(board, calledSet) {
  const m = new Set();
  for (let p = 0; p < 25; p++) if (calledSet.has(board[p])) m.add(p);
  return m;
}
function completedLines(marked) {
  let c = 0;
  for (const line of LINES) if (line.every((p) => marked.has(p))) c++;
  return c;
}
// greedy: choose the uncalled number that maximizes the caller's own line count
function pickNumber(board, calledSet) {
  let best = -1, bestScore = -1;
  for (let n = 1; n <= 25; n++) {
    if (calledSet.has(n)) continue;
    const trial = new Set(calledSet); trial.add(n);
    const score = completedLines(markedPositions(board, trial));
    if (score > bestScore) { bestScore = score; best = n; }
  }
  return best;
}

// ── tx helper ───────────────────────────────────────────────────────────────
// CRITICAL: separate broadcast from receipt-wait. A state-changing tx must never
// be re-sent just because waiting for its receipt hiccuped (that double-calls the
// contract). So: broadcast ONCE (retry only when no hash was produced), then poll
// the SAME hash for the receipt. A genuine revert throws immediately.
async function send(account, { address, abi, functionName, args, gas, value }, label) {
  let hash;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      hash = value !== undefined && !abi
        ? await wallet(account).sendTransaction({ to: address, value, gas, ...FEE })
        : await wallet(account).writeContract({ address, abi, functionName, args, gas, ...FEE });
      break;
    } catch (e) {
      if (attempt === 3) throw new Error(`${label} broadcast: ${e.shortMessage || e.message || e}`);
      await sleep(3000);
    }
  }
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const rcpt = await pub.waitForTransactionReceipt({ hash, timeout: 60000 });
      if (rcpt.status !== "success") throw new Error(`${label} REVERTED ${hash}`);
      return rcpt;
    } catch (e) {
      const msg = e.shortMessage || e.message || String(e);
      if (msg.includes("REVERTED")) throw e; // real revert — never loop
      if (attempt === 6) throw new Error(`${label} wait: ${msg} (${hash})`);
      await sleep(4000);
    }
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

// ── one full arena lifecycle ────────────────────────────────────────────────
function stateFile(tag, idx) { return join(__dir, "out", `state-${tag}-arena${idx}.json`); }

async function runArena(idx, players, tag = "adhoc") {
  const t0 = Date.now();
  const tl = []; // event timeline
  const ev = (type, extra) => tl.push({ type, t: Date.now() - t0, ...extra });
  const persist = (extra) => { try { writeFileSync(stateFile(tag, idx), JSON.stringify({ idx, ...extra, players: players.map((p) => ({ address: p.account.address, pk: p.pk, board: p.board, salt: p.salt })) }, null, 2)); } catch {} };

  // boards + salts were generated in makePlayers (persisted for recoverability)

  // create
  const creator = players[0];
  const rc = await send(creator.account, { address: PROXY, abi: ABI, functionName: "createArena", args: [STAKE_TOKEN, players.length, STAKE], gas: GAS.createArena }, `A${idx} create`);
  let arenaId;
  for (const lg of rc.logs) {
    try { const d = decodeEventLog({ abi: ABI, data: lg.data, topics: lg.topics }); if (d.eventName === "ArenaCreated") arenaId = d.args.arenaId; } catch {}
  }
  ev("ArenaCreated", { arenaId: arenaId?.toString(), tx: rc.transactionHash });
  persist({ arenaId: arenaId?.toString(), settled: false }); // crash-safe: boards+salts now on disk
  log(`A${idx} created arena #${arenaId} (${players.length}p)`);

  // approve + commit SEQUENTIALLY so on-chain arenaPlayers order == players[]
  // order (commitBoard pushes msg.sender in call order). This makes turnIndex i
  // deterministically map to players[i] — no lag-prone getPlayers read needed.
  for (const p of players) {
    await send(p.account, { address: STAKE_TOKEN, abi: ERC20_ABI, functionName: "approve", args: [PROXY, STAKE], gas: GAS.approve }, `A${idx} approve`);
    const c = await send(p.account, { address: PROXY, abi: ABI, functionName: "commitBoard", args: [arenaId, commitmentOf(p.board, p.salt)], gas: GAS.commitBoard }, `A${idx} commit`);
    ev("PlayerJoined", { player: p.account.address, tx: c.transactionHash });
  }
  log(`A${idx} #${arenaId} all ${players.length} committed`);

  const seats = players; // commit order == on-chain turn order

  // play
  const called = new Set();
  const callSeq = [];
  let turn = 0, claimer = null;
  while (called.size < 25) {
    const cur = seats[turn % seats.length];
    const n = pickNumber(cur.board, called);
    const r = await send(cur.account, { address: PROXY, abi: ABI, functionName: "callNumber", args: [arenaId, n], gas: GAS.callNumber }, `A${idx} call`);
    called.add(n); callSeq.push({ n, by: cur.account.address, i: callSeq.length, tx: r.transactionHash });
    ev("NumberCalled", { number: n, by: cur.account.address, callIndex: callSeq.length - 1 });
    // anyone with >=5 lines may claim (not turn-gated)
    const winner = seats.find((s) => completedLines(markedPositions(s.board, called)) >= WIN_LINES);
    if (winner) {
      const cb = await send(winner.account, { address: PROXY, abi: ABI, functionName: "claimBingo", args: [arenaId], gas: GAS.claimBingo }, `A${idx} claim`);
      claimer = winner.account.address;
      ev("BingoClaimed", { claimer, atCallIndex: callSeq.length, tx: cb.transactionHash });
      break;
    }
    turn++;
  }
  log(`A${idx} #${arenaId} play done (${callSeq.length} calls${claimer ? ", BINGO claimed" : ", 25-call fallback"})`);

  // reveal (parallel)
  await Promise.all(seats.map(async (p) => {
    const r = await send(p.account, { address: PROXY, abi: ABI, functionName: "revealBoard", args: [arenaId, p.board, p.salt], gas: GAS.revealBoard }, `A${idx} reveal`);
    ev("BoardRevealed", { player: p.account.address, tx: r.transactionHash });
  }));

  // settle (any player)
  const sr = await send(seats[0].account, { address: PROXY, abi: ABI, functionName: "settle", args: [arenaId], gas: GAS.settle }, `A${idx} settle`);
  let settle = {}; const winners = [];
  for (const lg of sr.logs) {
    try {
      const d = decodeEventLog({ abi: ABI, data: lg.data, topics: lg.topics });
      if (d.eventName === "ArenaSettled") settle = { prizePool: d.args.prizePool.toString(), fee: d.args.fee.toString(), winnerCount: Number(d.args.winnerCount) };
      if (d.eventName === "WinnerPaid") winners.push({ winner: d.args.winner, amount: d.args.amount.toString() });
    } catch {}
  }
  ev("ArenaSettled", { ...settle, winners, tx: sr.transactionHash });
  persist({ arenaId: arenaId?.toString(), settled: true });
  log(`A${idx} #${arenaId} SETTLED — pool ${formatEther(BigInt(settle.prizePool || 0))} CELO, ${settle.winnerCount} winner(s)`);

  // withdraw winners
  for (const w of winners) {
    const wp = seats.find((s) => s.account.address.toLowerCase() === w.winner.toLowerCase());
    if (wp) await send(wp.account, { address: PROXY, abi: ABI, functionName: "withdraw", args: [STAKE_TOKEN], gas: GAS.withdraw }, `A${idx} withdraw`);
  }

  return {
    arenaIndex: idx, arenaId: arenaId?.toString(), players: players.map((p) => p.account.address),
    callCount: callSeq.length, claimer, callSequence: callSeq.map((c) => ({ n: c.n, by: c.by, i: c.i })),
    settle, winners, durationMs: Date.now() - t0, timeline: tl,
  };
}

// ── fund + sweep ────────────────────────────────────────────────────────────
async function fundAll(allPlayers) {
  log(`funding ${allPlayers.length} wallets ${FUND} CELO each (nonce-managed)…`);
  let nonce = await pub.getTransactionCount({ address: deployer.address });
  const value = parseEther(FUND);
  const hashes = [];
  for (const p of allPlayers) {
    const h = await wallet(deployer).sendTransaction({ to: p.account.address, value, gas: GAS.fund, nonce: nonce++, ...FEE });
    hashes.push(h);
  }
  for (const h of hashes) await pub.waitForTransactionReceipt({ hash: h, timeout: 180000 });
  log(`funded ${allPlayers.length} wallets ✓`);
}

async function sweepAll(allPlayers) {
  log(`sweeping ${allPlayers.length} wallets back to deployer…`);
  let recovered = 0n;
  await Promise.all(allPlayers.map(async (p) => {
    try {
      const bal = await pub.getBalance({ address: p.account.address });
      const reserve = GAS.sweep * FEE.maxFeePerGas;
      if (bal <= reserve * 3n) return;
      const value = bal - reserve * 2n;
      const h = await wallet(p.account).sendTransaction({ to: deployer.address, value, gas: GAS.sweep, ...FEE });
      await pub.waitForTransactionReceipt({ hash: h, timeout: 120000 });
      recovered += value;
    } catch (e) { log(`sweep ${p.account.address} failed: ${e.shortMessage || e.message}`); }
  }));
  log(`swept ~${formatEther(recovered)} CELO back to deployer ✓`);
}

// ── resume: finish any non-settled arenas from their state files ──────────────
async function resume(tag) {
  const dir = join(__dir, "out");
  const files = readdirSync(dir).filter((f) => f.startsWith(`state-${tag}-arena`) && f.endsWith(".json"));
  if (!files.length) { log(`resume: no state files for tag ${tag}`); return; }
  log(`resume: ${files.length} state files for tag ${tag}`);
  let recovered = 0;
  for (const f of files) {
    const st = JSON.parse(readFileSync(join(dir, f), "utf8"));
    if (st.settled || !st.arenaId) continue;
    const arenaId = BigInt(st.arenaId);
    const players = st.players.map((p) => ({ pk: p.pk, account: privateKeyToAccount(p.pk), board: p.board, salt: p.salt }));
    try {
      const a = await pub.readContract({ address: PROXY, abi: ABI, functionName: "getArena", args: [arenaId] });
      if (a.state === 4 || a.state === 5) { log(`#${arenaId} already ${a.state === 4 ? "settled" : "cancelled"}`); st.settled = true; writeFileSync(join(dir, f), JSON.stringify(st, null, 2)); continue; }
      // top up players for gas
      let nonce = await pub.getTransactionCount({ address: deployer.address });
      const fh = [];
      for (const p of players) { const b = await pub.getBalance({ address: p.account.address }); if (b < parseEther("0.4")) fh.push(await wallet(deployer).sendTransaction({ to: p.account.address, value: parseEther("0.4") - b, gas: GAS.fund, nonce: nonce++, ...FEE })); }
      for (const h of fh) await pub.waitForTransactionReceipt({ hash: h, timeout: 120000 });

      let state = a.state;
      if (state === 0) { // Created — cancel & refund
        await send(players[0].account, { address: PROXY, abi: ABI, functionName: "cancelArena", args: [arenaId], gas: GAS.settle }, `#${arenaId} cancel`);
        for (const p of players) { try { await send(p.account, { address: PROXY, abi: ABI, functionName: "withdraw", args: [STAKE_TOKEN], gas: GAS.withdraw }, `#${arenaId} wd`); } catch {} }
        log(`#${arenaId} cancelled + refunded`); st.settled = true; writeFileSync(join(dir, f), JSON.stringify(st, null, 2)); recovered++; continue;
      }
      if (state === 1) { // Committed — play it out
        const called = new Set(); let turn = 0; let done = false;
        while (called.size < 25 && !done) {
          const cur = players[turn % players.length];
          const n = pickNumber(cur.board, called);
          await send(cur.account, { address: PROXY, abi: ABI, functionName: "callNumber", args: [arenaId, n], gas: GAS.callNumber }, `#${arenaId} call`);
          called.add(n);
          const w = players.find((s) => completedLines(markedPositions(s.board, called)) >= WIN_LINES);
          if (w) { await send(w.account, { address: PROXY, abi: ABI, functionName: "claimBingo", args: [arenaId], gas: GAS.claimBingo }, `#${arenaId} claim`); done = true; }
          turn++;
        }
        state = 3;
      }
      if (state === 2) { await send(players[0].account, { address: PROXY, abi: ABI, functionName: "claimBingo", args: [arenaId], gas: GAS.claimBingo }, `#${arenaId} claim`); state = 3; }
      if (state === 3) { // Revealing — reveal unrevealed, settle, withdraw
        for (const p of players) {
          const revealed = await pub.readContract({ address: PROXY, abi: ABI, functionName: "hasRevealed", args: [arenaId, p.account.address] });
          if (!revealed) { try { await send(p.account, { address: PROXY, abi: ABI, functionName: "revealBoard", args: [arenaId, p.board, p.salt], gas: GAS.revealBoard }, `#${arenaId} reveal`); } catch (e) { log(`#${arenaId} reveal failed: ${e.message}`); } }
        }
        await send(players[0].account, { address: PROXY, abi: ABI, functionName: "settle", args: [arenaId], gas: GAS.settle }, `#${arenaId} settle`);
        for (const p of players) { try { const earn = await pub.readContract({ address: PROXY, abi: ABI, functionName: "earningsOf", args: [p.account.address, STAKE_TOKEN] }); if (earn > 0n) await send(p.account, { address: PROXY, abi: ABI, functionName: "withdraw", args: [STAKE_TOKEN], gas: GAS.withdraw }, `#${arenaId} wd`); } catch {} }
        st.settled = true; writeFileSync(join(dir, f), JSON.stringify(st, null, 2));
        log(`#${arenaId} resumed → SETTLED`); recovered++;
      }
    } catch (e) { log(`#${arenaId} resume failed: ${e.shortMessage || e.message}`); }
  }
  log(`resume done: ${recovered} arenas recovered`);
}

// ── play-open: fill the seeded Open arenas with players and play to settle ────
// Reads seed-open state files, joins fresh pool wallets to fill each arena's
// remaining seats (commit order continues after the seed player → seats stay in
// turn order), then plays it out turn-by-turn → claimBingo → reveal all → settle
// → withdraw. Turns a seeded lobby into completed games with real winners.
async function playOpen(tag) {
  const dir = join(__dir, "out");
  const files = readdirSync(dir).filter((f) => f.startsWith(`state-${tag}-arena`) && f.endsWith(".json")).sort();
  if (!files.length) { log(`play-open: no state files for tag ${tag}`); return; }
  const pool = shuffle(loadPool());
  const used = new Set();
  files.forEach((f) => JSON.parse(readFileSync(join(dir, f), "utf8")).players?.forEach((p) => used.add(p.address.toLowerCase())));
  const fillers = pool.filter((p) => !used.has(p.account.address.toLowerCase()));
  let fi = 0, done = 0;

  for (const f of files) {
    const st = JSON.parse(readFileSync(join(dir, f), "utf8"));
    if (st.settled || !st.arenaId) continue;
    const arenaId = BigInt(st.arenaId);
    try {
      const a = await pub.readContract({ address: PROXY, abi: ABI, functionName: "getArena", args: [arenaId] });
      if (Number(a.state) >= 4) { st.settled = true; writeFileSync(join(dir, f), JSON.stringify(st, null, 2)); log(`#${arenaId} already ${Number(a.state) === 4 ? "settled" : "cancelled"}`); continue; }

      const existing = st.players.map((p) => ({ pk: p.pk, account: privateKeyToAccount(p.pk), board: p.board, salt: p.salt }));
      const toAdd = Number(a.maxPlayers) - Number(a.joinedCount);
      const newPlayers = [];
      for (let k = 0; k < toAdd; k++) { const p = fillers[fi++]; newPlayers.push({ pk: p.pk, account: p.account, board: shuffledBoard(), salt: `0x${randomBytes(32).toString("hex")}` }); }
      const seats = [...existing, ...newPlayers]; // matches on-chain commit/turn order

      // fund gas for everyone (play + settle headroom)
      let nonce = await pub.getTransactionCount({ address: deployer.address });
      const fh = [];
      for (const p of seats) { const b = await pub.getBalance({ address: p.account.address }); if (b < parseEther("0.8")) fh.push(await wallet(deployer).sendTransaction({ to: p.account.address, value: parseEther("0.8") - b, gas: GAS.fund, nonce: nonce++, ...FEE })); }
      for (const h of fh) await pub.waitForTransactionReceipt({ hash: h, timeout: 180000 });

      // fillers approve + commit (occupy the remaining seats)
      for (const p of newPlayers) {
        await send(p.account, { address: STAKE_TOKEN, abi: ERC20_ABI, functionName: "approve", args: [PROXY, a.stake], gas: GAS.approve }, `#${arenaId} approve`);
        await send(p.account, { address: PROXY, abi: ABI, functionName: "commitBoard", args: [arenaId, commitmentOf(p.board, p.salt)], gas: GAS.commitBoard }, `#${arenaId} commit`);
      }
      log(`#${arenaId} filled ${seats.length}/${Number(a.maxPlayers)} — playing`);

      // play: turn-based greedy until a BINGO line, then claim
      const called = new Set(); let turn = 0, claimer = null;
      while (called.size < 25) {
        const cur = seats[turn % seats.length];
        const n = pickNumber(cur.board, called);
        await send(cur.account, { address: PROXY, abi: ABI, functionName: "callNumber", args: [arenaId, n], gas: GAS.callNumber }, `#${arenaId} call`);
        called.add(n);
        const w = seats.find((s) => completedLines(markedPositions(s.board, called)) >= WIN_LINES);
        if (w) { await send(w.account, { address: PROXY, abi: ABI, functionName: "claimBingo", args: [arenaId], gas: GAS.claimBingo }, `#${arenaId} claim`); claimer = w.account.address; break; }
        turn++;
      }

      // reveal all, settle, withdraw
      for (const p of seats) { try { await send(p.account, { address: PROXY, abi: ABI, functionName: "revealBoard", args: [arenaId, p.board, p.salt], gas: GAS.revealBoard }, `#${arenaId} reveal`); } catch (e) { log(`#${arenaId} reveal: ${e.shortMessage || e.message}`); } }
      const sr = await send(seats[0].account, { address: PROXY, abi: ABI, functionName: "settle", args: [arenaId], gas: GAS.settle }, `#${arenaId} settle`);
      let wc = "?"; for (const lg of sr.logs) { try { const d = decodeEventLog({ abi: ABI, data: lg.data, topics: lg.topics }); if (d.eventName === "ArenaSettled") wc = Number(d.args.winnerCount); } catch {} }
      for (const p of seats) { try { const earn = await pub.readContract({ address: PROXY, abi: ABI, functionName: "earningsOf", args: [p.account.address, STAKE_TOKEN] }); if (earn > 0n) await send(p.account, { address: PROXY, abi: ABI, functionName: "withdraw", args: [STAKE_TOKEN], gas: GAS.withdraw }, `#${arenaId} wd`); } catch {} }
      st.settled = true; writeFileSync(join(dir, f), JSON.stringify(st, null, 2));
      log(`#${arenaId} SETTLED (${wc} winner)${claimer ? "" : " [25-call fallback]"}`); done++;
    } catch (e) { log(`#${arenaId} play-open failed: ${e.shortMessage || e.message}`); }
  }
  log(`play-open done: ${done} arenas settled`);
}

// ── modes ────────────────────────────────────────────────────────────────────
function makePlayers() {
  const arenas = [];
  for (let a = 0; a < ARENAS; a++) {
    const players = [];
    for (let i = 0; i < seatsFor(a); i++) {
      const pk = generatePrivateKey();
      players.push({ pk, account: privateKeyToAccount(pk), board: shuffledBoard(), salt: `0x${randomBytes(32).toString("hex")}` });
    }
    arenas.push(players);
  }
  return arenas;
}

async function preflight() {
  const bal = await pub.getBalance({ address: deployer.address });
  const minS = await pub.readContract({ address: PROXY, abi: ABI, functionName: "minStake", args: [STAKE_TOKEN] });
  const paused = await pub.readContract({ address: PROXY, abi: ABI, functionName: "paused" });
  const totalPlayers = TOTAL_PLAYERS;
  const required = parseEther(FUND) * BigInt(totalPlayers) + parseEther("3"); // float + deployer gas headroom
  console.log("── preflight ──");
  console.log("deployer       :", deployer.address);
  console.log("deployer balance:", formatEther(bal), "CELO");
  console.log("minStake(CELO) :", formatEther(minS), "CELO");
  console.log("paused         :", paused);
  console.log(`plan           : ${ARENAS} arenas, seats ${VARY ? "varied 2-4" : PLAYERS} = ${totalPlayers} fresh wallets`);
  console.log("required (≈)   :", formatEther(required), "CELO   (=", FUND, "× ", totalPlayers, "+ 3 gas)");
  // self-test the off-chain bingo logic
  const b = shuffledBoard();
  const all = new Set(Array.from({ length: 25 }, (_, i) => i + 1));
  const okPerm = new Set(b).size === 25 && Math.min(...b) === 1 && Math.max(...b) === 25;
  const fullLines = completedLines(markedPositions(b, all));
  console.log("self-test      : permutation", okPerm, "| all-called lines =", fullLines, "(expect 12)");
  const enough = bal >= required;
  console.log(enough ? "STATUS         : ✅ enough — `run` will proceed" : `STATUS         : ❌ SHORT by ${formatEther(required - bal)} CELO — top up deployer then \`run\``);
  return enough;
}

async function run() {
  if (!(await preflight())) { console.log("\nAborting: insufficient balance. Top up and re-run."); process.exit(1); }
  const arenas = makePlayers();
  const allPlayers = arenas.flat();

  // persist wallets BEFORE funding so funds are always recoverable
  mkdirSync(join(__dir, "out"), { recursive: true });
  const tag = process.env.RUN_TAG || `run-${(await pub.getBlockNumber()).toString()}`;
  const walletsFile = join(__dir, "out", `wallets-${tag}.json`);
  writeFileSync(walletsFile, JSON.stringify(allPlayers.map((p) => ({ pk: p.pk, address: p.account.address, board: p.board, salt: p.salt })), null, 2));
  log(`wallets saved → ${walletsFile}`);

  await fundAll(allPlayers);

  log(`launching ${ARENAS} arenas concurrently (stagger ${STAGGER_MS}ms)…`);
  const tStart = Date.now();
  const results = await Promise.allSettled(arenas.map(async (players, i) => {
    await sleep(i * STAGGER_MS);
    return runArena(i, players, tag);
  }));

  const ok = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  const failed = results.filter((r) => r.status === "rejected").map((r) => r.reason?.message || String(r.reason));
  const resultsFile = join(__dir, "out", `results-${tag}.json`);
  writeFileSync(resultsFile, JSON.stringify({
    config: { arenas: ARENAS, players: PLAYERS, fund: FUND, contract: PROXY, network: "celo-mainnet" },
    wallClockMs: Date.now() - tStart, completed: ok.length, failed, games: ok,
  }, null, 2));

  // recover capital
  await sweepAll(allPlayers);

  const totalCalls = ok.reduce((s, g) => s + g.callCount, 0);
  const totalVol = ok.reduce((s, g) => s + Number(g.players.length), 0); // players = stakes of 1 CELO
  const finalBal = await pub.getBalance({ address: deployer.address });
  console.log("\n══════════ SUMMARY ══════════");
  console.log(`games settled   : ${ok.length}/${ARENAS}` + (failed.length ? ` (${failed.length} failed)` : ""));
  console.log(`total players   : ${ok.reduce((s, g) => s + g.players.length, 0)} fresh wallets`);
  console.log(`total calls     : ${totalCalls} on-chain callNumber txs`);
  console.log(`staked volume   : ${totalVol} CELO across all arenas`);
  console.log(`wall clock      : ${((Date.now() - tStart) / 1000).toFixed(0)}s (all arenas concurrent)`);
  console.log(`deployer final  : ${formatEther(finalBal)} CELO`);
  console.log(`results         : ${resultsFile}`);
  if (failed.length) console.log("failures:", failed);
}

async function sweepFromFile(file) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  const allPlayers = data.map((d) => ({ pk: d.pk, account: privateKeyToAccount(d.pk) }));
  await sweepAll(allPlayers);
}

// ── persistent worker-wallet pool (for ramping toward 500 concurrent) ────────
const POOL_FILE = join(__dir, "out", "pool.json");
function loadPool() {
  const data = JSON.parse(readFileSync(POOL_FILE, "utf8"));
  return data.map((d) => ({ pk: d.pk, account: privateKeyToAccount(d.pk) }));
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = randomBytes(2).readUInt16BE(0) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

async function poolInit(n) {
  mkdirSync(join(__dir, "out"), { recursive: true });
  const wallets = Array.from({ length: n }, () => { const pk = generatePrivateKey(); return { pk, address: privateKeyToAccount(pk).address }; });
  writeFileSync(POOL_FILE, JSON.stringify(wallets, null, 2));
  log(`pool created: ${n} worker wallets → ${POOL_FILE}`);
}

// Top up the first `count` pool wallets to `floor` CELO (nonce-managed from deployer).
async function poolFund(floor, count) {
  const pool = loadPool();
  const targets = pool.slice(0, count ?? pool.length);
  const floorWei = parseEther(String(floor));
  let nonce = await pub.getTransactionCount({ address: deployer.address });
  const hashes = [];
  let funded = 0;
  for (const p of targets) {
    const bal = await pub.getBalance({ address: p.account.address });
    if (bal >= floorWei) continue;
    const top = floorWei - bal;
    hashes.push(await wallet(deployer).sendTransaction({ to: p.account.address, value: top, gas: GAS.fund, nonce: nonce++, ...FEE }));
    funded++;
  }
  for (const h of hashes) await pub.waitForTransactionReceipt({ hash: h, timeout: 180000 });
  log(`pool-fund: topped ${funded}/${targets.length} wallets to ${floor} CELO`);
}

async function poolStatus() {
  const pool = loadPool();
  const bals = await Promise.all(pool.map((p) => pub.getBalance({ address: p.account.address })));
  const total = bals.reduce((a, b) => a + b, 0n);
  const ready = bals.filter((b) => b >= parseEther("1.2")).length;
  log(`pool: ${pool.length} wallets | game-ready(≥1.2): ${ready} | total held: ${formatEther(total)} CELO`);
}

// Skim balances above `keep` CELO from pool wallets back to the deployer.
async function poolSkim(keep) {
  const pool = loadPool();
  const keepWei = parseEther(String(keep));
  let recovered = 0n;
  await Promise.all(pool.map(async (p) => {
    try {
      const bal = await pub.getBalance({ address: p.account.address });
      const reserve = GAS.sweep * FEE.maxFeePerGas;
      if (bal <= keepWei + reserve * 2n) return;
      const value = bal - keepWei - reserve * 2n;
      const h = await wallet(p.account).sendTransaction({ to: deployer.address, value, gas: GAS.sweep, ...FEE });
      await pub.waitForTransactionReceipt({ hash: h, timeout: 120000 });
      recovered += value;
    } catch (e) { log(`skim ${p.account.address} failed: ${e.shortMessage || e.message}`); }
  }));
  log(`pool-skim: recovered ${formatEther(recovered)} CELO to deployer`);
}

// Run one wave of `numArenas` concurrent games drawn from the pool. Fresh board+
// salt per game; winners withdraw; pool wallets persist (no per-game fund/sweep).
// Random partition of `total` into arena sizes of 2..6 (never leaves a stray 1).
function randomSeats(total) {
  const sizes = [];
  let rem = total;
  while (rem >= 2) {
    if (rem <= 6) { sizes.push(rem); break; }
    let s = 2 + (randomBytes(1)[0] % 5); // 2..6
    if (rem - s === 1) s = s < 6 ? s + 1 : 5; // avoid leaving exactly 1
    sizes.push(s);
    rem -= s;
  }
  return sizes;
}

async function wave(numArenas) {
  const tag = process.env.RUN_TAG || `wave${numArenas}`;
  mkdirSync(join(__dir, "out"), { recursive: true });
  const pool = shuffle(loadPool());

  // arena sizes: random 2-6 partition of TARGET_PLAYERS (uses that many wallets),
  // else seatsFor() over numArenas.
  const sizes = process.env.TARGET_PLAYERS
    ? randomSeats(Math.min(Number(process.env.TARGET_PLAYERS), pool.length))
    : Array.from({ length: numArenas }, (_, i) => seatsFor(i));
  const count = sizes.length;
  const need = sizes.reduce((a, b) => a + b, 0);
  if (need > pool.length) throw new Error(`wave needs ${need} wallets but pool has ${pool.length}`);

  // top up the wallets we'll use to GAS_FLOOR (gas; also covers stake when STAKE_TOKEN=CELO)
  const using = pool.slice(0, need);
  const floorWei = GAS_FLOOR;
  let nonce = await pub.getTransactionCount({ address: deployer.address });
  const fh = [];
  for (const p of using) {
    const bal = await pub.getBalance({ address: p.account.address });
    if (bal < floorWei) fh.push(await wallet(deployer).sendTransaction({ to: p.account.address, value: floorWei - bal, gas: GAS.fund, nonce: nonce++, ...FEE }));
  }
  for (const h of fh) await pub.waitForTransactionReceipt({ hash: h, timeout: 180000 });
  log(`wave: ${count} arenas (sizes ${sizes.join(",")}), ${need} players ready (topped ${fh.length})`);

  // slice into arenas with fresh boards
  let cur = 0;
  const arenas = [];
  for (let i = 0; i < count; i++) {
    const seats = sizes[i];
    const group = using.slice(cur, cur + seats).map((p) => ({ ...p, board: shuffledBoard(), salt: `0x${randomBytes(32).toString("hex")}` }));
    cur += seats;
    arenas.push(group);
  }

  const tStart = Date.now();
  const results = await Promise.allSettled(arenas.map(async (players, i) => { await sleep(i * STAGGER_MS); return runArena(i, players, tag); }));
  const ok = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  const failed = results.filter((r) => r.status === "rejected").map((r) => r.reason?.message || String(r.reason));
  writeFileSync(join(__dir, "out", `results-${tag}.json`), JSON.stringify({ config: { count, need, sizes, mode: "pool" }, wallClockMs: Date.now() - tStart, completed: ok.length, failed, games: ok }, null, 2));
  log(`wave done: ${ok.length}/${count} settled, ${ok.reduce((s, g) => s + g.callCount, 0)} calls, ${((Date.now() - tStart) / 1000).toFixed(0)}s wall-clock` + (failed.length ? ` | ${failed.length} failed` : ""));
  if (failed.length) failed.forEach((f) => log("  fail:", f));
  return { ok, failed };
}

// ── settle-pending: scan all arenas, settle any Revealing ones that are ready ──
// (all players revealed, or reveal window passed). Simulate-first so a not-yet-
// ready arena (window still open) is reported as pending without wasting gas.
// Keeps the marketplace clean — nothing left hanging in Revealing.
async function settlePending() {
  const ZERO = "0x0000000000000000000000000000000000000000";
  log("scanning arenas for settle-able (Revealing) games…");
  let id = 1n, scanned = 0, settled = 0, pending = 0, empties = 0;
  while (empties < 3 && id < 5000n) {
    let a;
    try { a = await pub.readContract({ address: PROXY, abi: ABI, functionName: "getArena", args: [id] }); }
    catch { await sleep(400); continue; } // transient RPC — retry same id
    if (!a || a.creator.toLowerCase() === ZERO) { empties++; id++; continue; }
    empties = 0; scanned++;
    if (Number(a.state) === 3) {
      try {
        await pub.simulateContract({ address: PROXY, abi: ABI, functionName: "settle", args: [id], account: deployer });
      } catch { pending++; log(`#${id} Revealing — not ready (reveal window still open)`); id++; continue; }
      try {
        const r = await send(deployer, { address: PROXY, abi: ABI, functionName: "settle", args: [id], gas: GAS.settle }, `#${id} settle`);
        log(`#${id} SETTLED tx=${r.transactionHash}`); settled++;
      } catch (e) { pending++; log(`#${id} settle failed: ${e.shortMessage || e.message}`); }
    }
    id++;
  }
  log(`settle-pending done: scanned ${scanned} arenas, settled ${settled}, still-pending ${pending}`);
}

// ── competition: volume-leaderboard tournament ────────────────────────────────
// P participants each play a random 1..GMAX games. Played in ROUNDS (each
// participant ≤1 arena per round → no same-wallet nonce collision; "round" = the
// "10 rounds" notion). Ranked by VOLUME (games × stake), NOT wins. Top TOP_N win
// $LANCE. Emits competition-<tag>.json (leaderboard) for the BingoChain comp page.
async function competition() {
  const P = Number(process.env.PARTICIPANTS || 25);
  const GMIN = Number(process.env.GAMES_MIN || 1);
  const GMAX = Number(process.env.GAMES_MAX || 8);
  const TOPN = Number(process.env.TOP_N || 10);
  const PRIZE = parseEther(process.env.PRIZE_EACH || "20"); // $LANCE per winner
  const tag = process.env.RUN_TAG || "comp";
  const rb = (n) => randomBytes(1)[0] % n;

  const pool = shuffle(loadPool());
  if (P > pool.length) throw new Error(`need ${P} participants, pool has ${pool.length}`);
  const parts = pool.slice(0, P).map((p) => ({ ...p, target: GMIN + rb(GMAX - GMIN + 1), remaining: 0, played: 0 }));
  parts.forEach((p) => { p.remaining = p.target; });
  log(`competition: ${P} participants, targets ${parts.map((p) => p.target).join(",")}`);

  // top up gas for up to GMAX games each (recoverable via pool-skim after)
  const gasFloor = parseEther(String(Math.max(0.5, GMAX * 0.15 + 0.2)));
  let nonce = await pub.getTransactionCount({ address: deployer.address });
  const fh = [];
  for (const p of parts) { const b = await pub.getBalance({ address: p.account.address }); if (b < gasFloor) fh.push(await wallet(deployer).sendTransaction({ to: p.account.address, value: gasFloor - b, gas: GAS.fund, nonce: nonce++, ...FEE })); }
  for (const h of fh) await pub.waitForTransactionReceipt({ hash: h, timeout: 180000 });
  log(`gas topped ${fh.length}/${P} to ${formatEther(gasFloor)} CELO`);

  const settleTxs = [];
  for (let round = 0; round < GMAX; round++) {
    const avail = shuffle(parts.filter((p) => p.remaining > 0));
    if (avail.length < 2) break;
    const groups = [];
    for (let i = 0; i < avail.length && avail.length - i >= 2; ) {
      let size = Math.min(avail.length - i, 2 + rb(4)); // 2..5
      if (avail.length - (i + size) === 1) size++; // never strand 1
      groups.push(avail.slice(i, i + size)); i += size;
    }
    groups.forEach((g) => g.forEach((p) => p.remaining--));
    log(`round ${round + 1}: ${groups.length} arenas, ${groups.flat().length} players`);
    const res = await Promise.allSettled(groups.map((g, idx) =>
      runArena(`r${round}a${idx}`, g.map((p) => ({ ...p, board: shuffledBoard(), salt: `0x${randomBytes(32).toString("hex")}` })), tag)));
    res.forEach((r, idx) => {
      if (r.status === "fulfilled" && r.value?.settle?.winnerCount !== undefined) {
        groups[idx].forEach((p) => { const part = parts.find((x) => x.account.address === p.account.address); part.played++; });
        if (r.value.timeline) { const ev = r.value.timeline.find((e) => e.type === "ArenaSettled"); if (ev?.tx) settleTxs.push(ev.tx); }
      }
    });
  }

  // rank by volume (= played × stake)
  parts.forEach((p) => { p.volume = STAKE * BigInt(p.played); });
  parts.sort((a, b) => (b.volume > a.volume ? 1 : b.volume < a.volume ? -1 : 0));
  const winners = parts.slice(0, TOPN).filter((p) => p.played > 0);
  log(`leaderboard (top ${TOPN} by volume): ${winners.map((p) => `${p.account.address.slice(0, 8)}=${formatEther(p.volume)}`).join(", ")}`);

  // pay winners in $LANCE
  const erc20 = [{ type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "t", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] }];
  nonce = await pub.getTransactionCount({ address: deployer.address });
  for (const w of winners) {
    const h = await wallet(deployer).writeContract({ address: STAKE_TOKEN, abi: erc20, functionName: "transfer", args: [w.account.address, PRIZE], gas: 80000n, nonce: nonce++, ...FEE });
    w.prizeTx = h;
  }
  for (const w of winners) { await pub.waitForTransactionReceipt({ hash: w.prizeTx, timeout: 120000 }); }
  log(`paid ${winners.length} winners ${formatEther(PRIZE)} $LANCE each`);

  mkdirSync(join(__dir, "out"), { recursive: true });
  const out = {
    competition: tag, stake: formatEther(STAKE), prizePerWinner: formatEther(PRIZE), topN: TOPN,
    participants: parts.map((p, i) => ({ rank: i + 1, address: p.account.address, games: p.played, volume: formatEther(p.volume), won: winners.includes(p), prizeTx: p.prizeTx || null })),
    totalGames: parts.reduce((s, p) => s + p.played, 0), totalVolume: formatEther(parts.reduce((s, p) => s + p.volume, 0n)), settleTxs,
  };
  writeFileSync(join(__dir, "out", `competition-${tag}.json`), JSON.stringify(out, null, 2));
  log(`competition done: ${out.totalGames} games, ${out.totalVolume} $LANCE volume, ${winners.length} winners paid → out/competition-${tag}.json`);
}

// ── seed-open: create joinable OPEN arenas and leave them (lobby liveness) ────
// Creates `count` arenas with 3–4 seats but only SEED_FILL (default 1) players
// committed, so each stays in the Open/created state for real players to join —
// the lobby is never empty for a demo. Stake is in STAKE_TOKEN ($LANCE); pool
// wallets already hold $LANCE, so only gas is topped up. The committed stake
// stays locked until the arena fills + settles or is cancelled; state is
// persisted per arena (boards + salts + pks) so it's recoverable either way.
async function seedOpen(count) {
  const fill = Math.max(1, Number(process.env.SEED_FILL || 1));
  const tag = process.env.RUN_TAG || "seed";
  mkdirSync(join(__dir, "out"), { recursive: true });
  const pool = shuffle(loadPool());
  const need = count * fill;
  if (need > pool.length) throw new Error(`seed-open needs ${need} wallets, pool has ${pool.length}`);

  // top up gas only — pool wallets already hold $LANCE for the stake
  const using = pool.slice(0, need);
  let nonce = await pub.getTransactionCount({ address: deployer.address });
  const fh = [];
  for (const p of using) {
    const b = await pub.getBalance({ address: p.account.address });
    if (b < GAS_FLOOR) fh.push(await wallet(deployer).sendTransaction({ to: p.account.address, value: GAS_FLOOR - b, gas: GAS.fund, nonce: nonce++, ...FEE }));
  }
  for (const h of fh) await pub.waitForTransactionReceipt({ hash: h, timeout: 180000 });
  const sym = STAKE_TOKEN === CELO ? "CELO" : "$LANCE";
  log(`seed-open: opening ${count} arenas (fill ${fill}, stake ${formatEther(STAKE)} ${sym}), topped ${fh.length} wallets gas`);

  const opened = [];
  for (let i = 0; i < count; i++) {
    const seats = 3 + (randomBytes(1)[0] % 2); // 3 or 4 → a varied "1/3", "1/4" lobby
    const f = Math.min(fill, seats - 1); // always leave ≥1 seat open
    const players = using.slice(i * fill, i * fill + f).map((p) => ({ ...p, board: shuffledBoard(), salt: `0x${randomBytes(32).toString("hex")}` }));
    try {
      const creator = players[0];
      const rc = await send(creator.account, { address: PROXY, abi: ABI, functionName: "createArena", args: [STAKE_TOKEN, seats, STAKE], gas: GAS.createArena }, `seed${i} create`);
      let arenaId;
      for (const lg of rc.logs) { try { const d = decodeEventLog({ abi: ABI, data: lg.data, topics: lg.topics }); if (d.eventName === "ArenaCreated") arenaId = d.args.arenaId; } catch {} }
      for (const p of players) {
        await send(p.account, { address: STAKE_TOKEN, abi: ERC20_ABI, functionName: "approve", args: [PROXY, STAKE], gas: GAS.approve }, `seed${i} approve`);
        await send(p.account, { address: PROXY, abi: ABI, functionName: "commitBoard", args: [arenaId, commitmentOf(p.board, p.salt)], gas: GAS.commitBoard }, `seed${i} commit`);
      }
      writeFileSync(stateFile(tag, i), JSON.stringify({ idx: i, arenaId: arenaId?.toString(), seats, filled: f, open: true, players: players.map((p) => ({ address: p.account.address, pk: p.pk, board: p.board, salt: p.salt })) }, null, 2));
      opened.push(arenaId?.toString());
      log(`seed${i}: opened arena #${arenaId} (${f}/${seats} seats)`);
    } catch (e) { log(`seed${i} failed: ${e.shortMessage || e.message}`); }
  }
  log(`seed-open done: ${opened.filter(Boolean).length}/${count} open arenas → #${opened.filter(Boolean).join(" #")}`);
}

const mode = process.argv[2] || "check";
const arg = process.argv[3];
const arg2 = process.argv[4];
if (mode === "check") preflight().then(() => process.exit(0));
else if (mode === "run") run().catch((e) => { console.error(e); process.exit(1); });
else if (mode === "sweep") sweepFromFile(arg).then(() => process.exit(0));
else if (mode === "pool-init") poolInit(Number(arg || 90)).then(() => process.exit(0));
else if (mode === "pool-fund") poolFund(arg || "1.6", arg2 ? Number(arg2) : undefined).then(() => process.exit(0));
else if (mode === "pool-status") poolStatus().then(() => process.exit(0));
else if (mode === "pool-skim") poolSkim(arg || "0").then(() => process.exit(0));
else if (mode === "wave") wave(Number(arg || 5)).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
else if (mode === "resume") resume(arg).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
else if (mode === "settle-pending") settlePending().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
else if (mode === "competition") competition().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
else if (mode === "seed-open") seedOpen(Number(arg || 6)).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
else if (mode === "play-open") playOpen(arg || "seed").then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
else { console.error("usage: play-mainnet.mjs check|run|sweep <file>|pool-init <n>|pool-fund <floor> [count]|pool-status|pool-skim <keep>|wave <numArenas>|resume <tag>|settle-pending"); process.exit(1); }
