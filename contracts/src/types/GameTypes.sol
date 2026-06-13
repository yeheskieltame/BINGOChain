// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { GameState } from "./BingoTypes.sol";

/// @title GameTypes
/// @notice Game data structures and errors for BINGOChain arenas.
/// @dev `Arena` is packed into two storage slots: slot 1 holds {creator, stake},
///      slot 2 holds the small game counters/flags. Per-player and sequence data
///      live in separate mappings keyed by arenaId (see CoreStorage).

/// @notice One PvP bingo arena.
struct Arena {
    // ── slot 1 ───────────────────────────────────────────────────
    address creator; // who opened the arena
    uint96 stake; // entry stake per player, in wei (CELO)
    // ── slot 2 ───────────────────────────────────────────────────
    GameState state; // lifecycle state
    uint8 maxPlayers; // 2..6, set at creation
    uint8 joinedCount; // players who have committed a board
    uint8 callCount; // numbers called so far (0..25)
    uint8 turnIndex; // index into the player list whose turn it is
    uint32 calledMask; // bitmask of called numbers (bit n-1 ⇒ number n called)
    uint64 revealDeadline; // unix time the reveal window closes (0 until Revealing)
    uint96 gasReserve; // CELO carved from the pot to sponsor play (refunded surplus to winner)
    // ── slot 3 (append) ──────────────────────────────────────────
    uint64 createdAt; // unix time the arena was opened (for the join window)
}

// ── Game errors ──────────────────────────────────────────────────

/// @dev Arena id does not exist.
error ArenaNotFound(uint256 arenaId);
/// @dev Action not allowed in the arena's current state.
error WrongState(uint256 arenaId, GameState expected, GameState actual);
/// @dev Player count must be within [MIN_PLAYERS, MAX_PLAYERS].
error InvalidPlayerCount(uint8 maxPlayers);
/// @dev Provided stake is below the minimum entry stake.
error StakeTooLow(uint256 sent, uint256 required);
/// @dev Deposited value does not exactly equal the arena's entry stake.
error IncorrectStake(uint256 sent, uint256 required);
/// @dev Caller already joined this arena.
error AlreadyJoined();
/// @dev Arena already has its full set of players.
error ArenaFull();
/// @dev Caller is not a player in this arena.
error NotAPlayer();
/// @dev It is not the caller's turn to call a number.
error NotYourTurn();
/// @dev Called number is outside 1..25.
error NumberOutOfRange(uint8 number);
/// @dev Number has already been called this game.
error NumberAlreadyCalled(uint8 number);
/// @dev Revealed board+salt does not match the committed hash.
error CommitMismatch();
/// @dev Caller already revealed their board.
error AlreadyRevealed();
/// @dev The reveal window has closed.
error RevealWindowClosed();
/// @dev The reveal window is still open and not all players have revealed.
error RevealWindowOpen();
/// @dev A native CELO transfer failed.
error TransferFailed();
/// @dev Revealed board is not a valid permutation of 1..25.
error InvalidBoard();
/// @dev No funds available to withdraw.
error NothingToWithdraw();
/// @dev Arena cannot be cancelled: caller is not the creator and the join window
///      has not yet elapsed.
error CancelNotAllowed();
