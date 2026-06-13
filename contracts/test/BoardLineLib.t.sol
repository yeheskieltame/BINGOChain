// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { LineLib } from "../src/libraries/LineLib.sol";
import { BoardLib } from "../src/libraries/BoardLib.sol";

contract BoardLineLibTest is Test {
    uint32 internal constant FULL_25 = 0x1FFFFFF; // all 25 low bits set

    // ── helpers ──────────────────────────────────────────────────

    /// @dev Identity board: cell p holds number p+1. With it, marks(board, mask)
    ///      == mask, so line math can be asserted directly against called masks.
    function _identityBoard() internal pure returns (uint8[25] memory b) {
        for (uint256 i = 0; i < 25; i++) {
            b[i] = uint8(i + 1);
        }
    }

    // ── LineLib ──────────────────────────────────────────────────

    function test_NoLinesWhenEmpty() public pure {
        assertEq(LineLib.countCompletedLines(0), 0);
    }

    function test_TwelveLinesWhenFull() public pure {
        assertEq(LineLib.countCompletedLines(FULL_25), 12);
    }

    function test_SingleRowIsOneLine() public pure {
        assertEq(LineLib.countCompletedLines(0x1F), 1); // row 0
    }

    function test_MainDiagonalIsOneLine() public pure {
        assertEq(LineLib.countCompletedLines(0x1041041), 1);
    }

    function test_AntiDiagonalIsOneLine() public pure {
        assertEq(LineLib.countCompletedLines(0x111110), 1);
    }

    function test_RowPlusColumnIntersectIsTwoLines() public pure {
        // row 0 (0x1F) + col 0 (0x108421) share cell 0 but are two lines.
        assertEq(LineLib.countCompletedLines(0x1F | 0x108421), 2);
    }

    function test_LineMasksAreDistinctAndFiveCells() public pure {
        uint32[12] memory m = LineLib.lineMasks();
        for (uint256 i = 0; i < 12; i++) {
            // each line covers exactly 5 cells
            uint256 bits;
            uint32 x = m[i];
            while (x != 0) {
                bits += x & 1;
                x >>= 1;
            }
            assertEq(bits, 5, "line must have 5 cells");
            // no mask bit exceeds position 24
            assertEq(m[i] & ~FULL_25, 0, "mask out of board range");
        }
    }

    // ── BoardLib.isValid ─────────────────────────────────────────

    function test_IdentityBoardIsValid() public pure {
        assertTrue(BoardLib.isValid(_identityBoard()));
    }

    function test_RejectsZeroValue() public pure {
        uint8[25] memory b = _identityBoard();
        b[7] = 0;
        assertFalse(BoardLib.isValid(b));
    }

    function test_RejectsOutOfRangeValue() public pure {
        uint8[25] memory b = _identityBoard();
        b[7] = 26;
        assertFalse(BoardLib.isValid(b));
    }

    function test_RejectsDuplicate() public pure {
        uint8[25] memory b = _identityBoard();
        b[7] = b[8]; // duplicate
        assertFalse(BoardLib.isValid(b));
    }

    // ── BoardLib.marks ───────────────────────────────────────────

    function test_MarksEqualCalledMaskForIdentityBoard() public pure {
        uint8[25] memory b = _identityBoard();
        assertEq(BoardLib.marks(b, 0x1F), uint32(0x1F));
        assertEq(BoardLib.marks(b, FULL_25), FULL_25);
        assertEq(BoardLib.marks(b, 0), uint32(0));
    }

    // ── Fuzz ─────────────────────────────────────────────────────

    /// @dev On the identity board, marks == calledMask (over 25 bits), so the
    ///      line count from marks must equal the line count from the raw mask.
    function testFuzz_IdentityBoardMarksMatchMask(uint32 calledMask) public pure {
        uint8[25] memory b = _identityBoard();
        uint32 masked = calledMask & FULL_25;
        uint32 marked = BoardLib.marks(b, masked);
        assertEq(marked, masked);
        assertEq(LineLib.countCompletedLines(marked), LineLib.countCompletedLines(masked));
    }

    /// @dev A full board is always 12 lines regardless of permutation.
    function testFuzz_AnyValidBoardFullCallIsTwelveLines(uint256 seed) public pure {
        uint8[25] memory b = _shuffledBoard(seed);
        assertTrue(BoardLib.isValid(b));
        assertEq(LineLib.countCompletedLines(BoardLib.marks(b, FULL_25)), 12);
    }

    /// @dev Fisher–Yates shuffle of 1..25 driven by `seed` — yields a valid board.
    function _shuffledBoard(uint256 seed) internal pure returns (uint8[25] memory b) {
        b = _identityBoard();
        for (uint256 i = 24; i > 0; i--) {
            uint256 j = uint256(keccak256(abi.encode(seed, i))) % (i + 1);
            (b[i], b[j]) = (b[j], b[i]);
        }
    }
}
