// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { CommitLib } from "../src/libraries/CommitLib.sol";

contract CommitLibTest is Test {
    function _board() internal pure returns (uint8[25] memory b) {
        for (uint256 i = 0; i < 25; i++) {
            b[i] = uint8(i + 1);
        }
    }

    function test_VerifyMatches() public pure {
        uint8[25] memory b = _board();
        bytes32 salt = keccak256("salt");
        bytes32 c = CommitLib.commitment(b, salt);
        assertTrue(CommitLib.verify(c, b, salt));
    }

    function test_VerifyFailsOnWrongSalt() public pure {
        uint8[25] memory b = _board();
        bytes32 c = CommitLib.commitment(b, keccak256("salt"));
        assertFalse(CommitLib.verify(c, b, keccak256("other")));
    }

    function test_VerifyFailsOnTamperedBoard() public pure {
        uint8[25] memory b = _board();
        bytes32 salt = keccak256("salt");
        bytes32 c = CommitLib.commitment(b, salt);
        b[0] = 25;
        b[24] = 1; // swap → still valid permutation, different board
        assertFalse(CommitLib.verify(c, b, salt));
    }

    function test_CommitmentIsDeterministic() public pure {
        uint8[25] memory b = _board();
        bytes32 salt = keccak256("salt");
        assertEq(CommitLib.commitment(b, salt), CommitLib.commitment(b, salt));
    }

    function testFuzz_DifferentSaltDifferentCommit(bytes32 s1, bytes32 s2) public pure {
        vm.assume(s1 != s2);
        uint8[25] memory b = _board();
        assertTrue(CommitLib.commitment(b, s1) != CommitLib.commitment(b, s2));
    }
}
