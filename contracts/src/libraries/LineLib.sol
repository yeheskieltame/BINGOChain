// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LineLib
/// @notice Winning-line geometry for a 5×5 BINGO board.
/// @dev A board cell is addressed by position `p = row * 5 + col` (0..24). A
///      "marked-cell" bitmask sets bit `p` when that cell's number has been
///      called. A line is complete when all five of its cells are marked. There
///      are 12 lines: 5 rows, 5 columns, and the 2 diagonals.
library LineLib {
    /// @notice Total number of winning lines on the board.
    uint8 internal constant LINE_COUNT = 12;

    /// @dev The 12 winning lines as bitmasks over the 25 cell positions.
    function lineMasks() internal pure returns (uint32[12] memory m) {
        m[0] = 0x000001F; // row 0  → positions 0-4
        m[1] = 0x00003E0; // row 1  → positions 5-9
        m[2] = 0x0007C00; // row 2  → positions 10-14
        m[3] = 0x00F8000; // row 3  → positions 15-19
        m[4] = 0x1F00000; // row 4  → positions 20-24
        m[5] = 0x0108421; // col 0  → positions 0,5,10,15,20
        m[6] = 0x0210842; // col 1  → positions 1,6,11,16,21
        m[7] = 0x0421084; // col 2  → positions 2,7,12,17,22
        m[8] = 0x0842108; // col 3  → positions 3,8,13,18,23
        m[9] = 0x1084210; // col 4  → positions 4,9,14,19,24
        m[10] = 0x1041041; // main diagonal → positions 0,6,12,18,24
        m[11] = 0x0111110; // anti diagonal → positions 4,8,12,16,20
    }

    /// @notice Count how many of the 12 lines are fully marked.
    /// @param markedMask bit `p` set ⇒ board cell `p` is marked.
    /// @return count number of completed lines (0..12).
    function countCompletedLines(uint32 markedMask) internal pure returns (uint8 count) {
        uint32[12] memory masks = lineMasks();
        for (uint256 i = 0; i < LINE_COUNT; i++) {
            uint32 lm = masks[i];
            if ((markedMask & lm) == lm) {
                unchecked {
                    count++;
                }
            }
        }
    }
}
