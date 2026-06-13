// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CommitLib
/// @notice Commit–reveal hashing for sealed BINGO boards.
/// @dev A player commits `commitment(board, salt)` before play; at reveal they
///      disclose `(board, salt)` and the contract checks it against the stored
///      commitment. `abi.encode` (not `encodePacked`) is used so the fixed-size
///      board array and the salt cannot be ambiguously concatenated.
library CommitLib {
    /// @notice Commitment hash for a board sealed with `salt`.
    function commitment(uint8[25] memory board, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encode(board, salt));
    }

    /// @notice True iff `(board, salt)` hashes to `commit`.
    function verify(bytes32 commit, uint8[25] memory board, bytes32 salt) internal pure returns (bool) {
        return commitment(board, salt) == commit;
    }
}
