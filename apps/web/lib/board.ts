import { keccak256, encodeAbiParameters, type Hex } from "viem";

export const BOARD_SIZE = 25;

/// The 12 winning lines as cell-index sets (rows, cols, diagonals), mirroring LineLib.
export const LINES: number[][] = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

/// A random valid board: a shuffled permutation of 1..25.
export function randomBoard(): number[] {
  const b = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/// True iff `board` is a permutation of 1..25.
export function isValidBoard(board: number[]): boolean {
  if (board.length !== BOARD_SIZE) return false;
  const seen = new Set<number>();
  for (const n of board) {
    if (n < 1 || n > 25 || seen.has(n)) return false;
    seen.add(n);
  }
  return true;
}

/// A fresh 32-byte salt for sealing a board.
export function randomSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ("0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")) as Hex;
}

// viem types a `uint8[25]` parameter as a fixed 25-tuple.
type Cells = readonly [
  number, number, number, number, number,
  number, number, number, number, number,
  number, number, number, number, number,
  number, number, number, number, number,
  number, number, number, number, number,
];

/// Commitment hash for a sealed board — must match the contract (CommitLib).
export function commitment(board: number[], salt: Hex): Hex {
  return keccak256(encodeAbiParameters([{ type: "uint8[25]" }, { type: "bytes32" }], [board as unknown as Cells, salt]));
}

/// Number of completed lines given the set of called numbers (for live UI progress).
export function completedLines(board: number[], called: Set<number>): number {
  const marked = board.map((n) => called.has(n));
  return LINES.filter((line) => line.every((cell) => marked[cell])).length;
}
