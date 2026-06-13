// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BingoTypes
/// @notice Shared enums and errors for the BINGOChain contract family.
/// @dev Game structs (Arena, Player) are introduced in the storage/state epic.
///      Kept in one place so libraries, the implementation, and tests share a
///      single source of truth.

/// @notice Lifecycle state of a single BINGO arena.
///         Created → Committed → Playing → Revealing → Settled
enum GameState {
    Created, // arena open, parameters set, accepting players
    Committed, // all players joined, stakes locked, board hashes submitted
    Playing, // turn-based number calling, each call recorded onchain
    Revealing, // BINGO claimed or 25 calls reached; players reveal boards
    Settled // winner verified, payout and protocol fee distributed
}

// ── Errors ───────────────────────────────────────────────────────────
// Custom errors are cheaper than require strings and give callers a typed
// failure surface. Game-specific errors are added alongside their logic.

/// @dev A required address argument was the zero address.
error ZeroAddress();

/// @dev Protocol fee exceeds the hard ceiling enforced by the setter.
error FeeTooHigh(uint16 bps);

/// @dev A `nonReentrant` function was re-entered.
error Reentrancy();
