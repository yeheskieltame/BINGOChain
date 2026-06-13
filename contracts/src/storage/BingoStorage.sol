// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Arena } from "../types/GameTypes.sol";

/// @dev All mutable state lives here, isolated under an EIP-7201 namespace so
///      future upgrades can append fields without risking storage collisions.
///      NEVER change the order or type of existing fields — only append.
struct CoreStorage {
    // ── Admin / protocol ─────────────────────────────────────────
    address treasury; // protocol fee recipient
    uint16 protocolFeeBps; // fee in basis points (e.g. 100 = 1%)
    bool _locked; // reentrancy guard flag (OZ v5 dropped ReentrancyGuardUpgradeable)
    // ── Arena registry ───────────────────────────────────────────
    uint256 arenaCount; // monotonic arena id counter
    // ── Game state (Epic C) ──────────────────────────────────────
    mapping(uint256 => Arena) arenas; // arenaId → arena
    mapping(uint256 => address[]) arenaPlayers; // arenaId → ordered player list
    mapping(uint256 => mapping(address => bytes32)) boardCommit; // arenaId → player → hash(board+salt)
    mapping(uint256 => mapping(address => bool)) hasJoined; // arenaId → player → joined
    mapping(uint256 => mapping(address => bool)) hasRevealed; // arenaId → player → revealed
    mapping(uint256 => mapping(address => uint8[25])) revealedBoard; // arenaId → player → board
    mapping(uint256 => uint8[]) callSequence; // arenaId → numbers in call order
    mapping(address => uint256) earnings; // pull-payment balances (CELO wei)
}

/// @title BingoStorage
/// @notice Abstract base exposing the EIP-7201 storage accessor shared by every
///         contract in the BINGOChain family.
abstract contract BingoStorage {
    // keccak256(abi.encode(uint256(keccak256("bingochain.core.v1")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant _STORAGE_SLOT = 0x9111aff86bbe9ab00b82a0477cd3e0e0ee64e50ff09a8f6fc157118c72ac2800;

    function _s() internal pure returns (CoreStorage storage s) {
        bytes32 slot = _STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            s.slot := slot
        }
    }
}
