// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { GameState } from "./BingoTypes.sol";

/// @notice A single PvP bingo arena. Packed across storage slots; per-player and
///         call-sequence data live in separate mappings (see CoreStorage).
struct Arena {
    address creator;
    uint96 stake; // entry stake per player, in `token` base units
    GameState state;
    uint8 maxPlayers;
    uint8 joinedCount;
    uint8 callCount;
    uint8 turnIndex;
    uint32 calledMask; // bit (n-1) set => number n called
    uint64 revealDeadline;
    uint96 gasReserve; // reserved for the gasless relayer phase
    uint64 createdAt;
    address token; // ERC20 settlement token (CELO is its own ERC20 on Celo)
}

error ArenaNotFound(uint256 arenaId);
error WrongState(uint256 arenaId, GameState expected, GameState actual);
error InvalidPlayerCount(uint8 maxPlayers);
error TokenNotAllowed(address token);
error StakeTooLow(uint256 sent, uint256 required);
error AlreadyJoined();
error ArenaFull();
error NotAPlayer();
error NotYourTurn();
error NumberOutOfRange(uint8 number);
error NumberAlreadyCalled(uint8 number);
error CommitMismatch();
error AlreadyRevealed();
error RevealWindowClosed();
error RevealWindowOpen();
error InvalidBoard();
error NothingToWithdraw();
error CancelNotAllowed();
error CannotRescueGameToken();
