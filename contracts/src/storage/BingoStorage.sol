// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Arena } from "../types/GameTypes.sol";

/// @notice All mutable state, isolated under an EIP-7201 namespace. Append only —
///         never reorder or retype existing fields (it breaks upgrade layout).
struct CoreStorage {
    address treasury;
    uint16 protocolFeeBps;
    bool _locked; // reentrancy guard
    uint256 arenaCount;
    mapping(uint256 => Arena) arenas;
    mapping(uint256 => address[]) arenaPlayers;
    mapping(uint256 => mapping(address => bytes32)) boardCommit;
    mapping(uint256 => mapping(address => bool)) hasJoined;
    mapping(uint256 => mapping(address => bool)) hasRevealed;
    mapping(uint256 => mapping(address => uint8[25])) revealedBoard;
    mapping(uint256 => uint8[]) callSequence;
    mapping(address => uint256) earnings; // pull-payment balances (wei)
}

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
