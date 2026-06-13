// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BoardLib
/// @notice Validation and marking for a 5×5 BINGO board.
/// @dev A board is a length-25 array where `board[p]` is the number (1..25) at
///      cell position `p`. A valid board is a permutation of 1..25 (every number
///      exactly once). Called numbers are tracked in a `calledMask` where bit
///      `n-1` is set when number `n` has been called.
library BoardLib {
    /// @notice Number of cells on the board.
    uint8 internal constant SIZE = 25;

    /// @notice True iff `board` is a permutation of the numbers 1..25.
    /// @dev O(25) single pass using a 25-bit "seen" set; rejects out-of-range
    ///      values and duplicates.
    function isValid(uint8[25] memory board) internal pure returns (bool) {
        uint32 seen;
        for (uint256 i = 0; i < SIZE; i++) {
            uint8 n = board[i];
            if (n < 1 || n > SIZE) return false;
            uint32 bit = uint32(1) << (n - 1);
            if ((seen & bit) != 0) return false; // duplicate
            seen |= bit;
        }
        return true;
    }

    /// @notice Marked-cell bitmask for `board` given the called numbers.
    /// @param board      length-25 array of numbers (1..25) by position.
    /// @param calledMask bit `n-1` set ⇒ number `n` has been called.
    /// @return marked bit `p` set ⇒ cell `p`'s number is in `calledMask`.
    function marks(uint8[25] memory board, uint32 calledMask) internal pure returns (uint32 marked) {
        for (uint256 i = 0; i < SIZE; i++) {
            uint8 n = board[i];
            if (n >= 1 && n <= SIZE && (calledMask & (uint32(1) << (n - 1))) != 0) {
                marked |= uint32(1) << uint32(i);
            }
        }
    }
}
