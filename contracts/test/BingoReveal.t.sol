// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Base } from "./Base.sol";
import { CommitLib } from "../src/libraries/CommitLib.sol";
import { GameState } from "../src/types/BingoTypes.sol";
import { Arena } from "../src/types/GameTypes.sol";
import {
    WrongState,
    NotAPlayer,
    CommitMismatch,
    AlreadyRevealed,
    RevealWindowClosed,
    InvalidBoard
} from "../src/types/GameTypes.sol";

contract BingoRevealTest is Base {
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant SALT_A = keccak256("alice-salt");
    bytes32 internal constant SALT_B = keccak256("bob-salt");

    function setUp() public {
        _deployBingo(100);
        _prep(alice);
        _prep(bob);
    }

    function _ordered() internal pure returns (uint8[25] memory b) {
        for (uint256 i = 0; i < 25; i++) {
            b[i] = uint8(i + 1);
        }
    }

    function _reversed() internal pure returns (uint8[25] memory b) {
        for (uint256 i = 0; i < 25; i++) {
            b[i] = uint8(25 - i);
        }
    }

    function _sealed() internal returns (uint256 id) {
        id = _create(alice, 2);
        _commit(alice, id, CommitLib.commitment(_ordered(), SALT_A));
        _commit(bob, id, CommitLib.commitment(_reversed(), SALT_B));
    }

    function _revealing() internal returns (uint256 id) {
        id = _sealed();
        vm.prank(alice);
        bingo.callNumber(id, 7);
        vm.prank(alice);
        bingo.claimBingo(id);
    }

    function test_ClaimBingoOpensReveal() public {
        uint256 id = _sealed();
        vm.prank(alice);
        bingo.callNumber(id, 7);
        vm.prank(alice);
        bingo.claimBingo(id);
        Arena memory a = bingo.getArena(id);
        assertEq(uint8(a.state), uint8(GameState.Revealing));
        assertGt(a.revealDeadline, 0);
    }

    function test_RevertWhen_ClaimNotPlaying() public {
        uint256 id = _sealed();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(WrongState.selector, id, GameState.Playing, GameState.Committed));
        bingo.claimBingo(id);
    }

    function test_RevertWhen_ClaimNotAPlayer() public {
        uint256 id = _sealed();
        vm.prank(alice);
        bingo.callNumber(id, 7);
        vm.prank(stranger);
        vm.expectRevert(NotAPlayer.selector);
        bingo.claimBingo(id);
    }

    function test_RevealStoresBoard() public {
        uint256 id = _revealing();
        vm.prank(alice);
        bingo.revealBoard(id, _ordered(), SALT_A);
        assertTrue(bingo.hasRevealed(id, alice));
        assertEq(bingo.revealedBoardOf(id, alice)[0], 1);
        assertEq(bingo.revealedBoardOf(id, alice)[24], 25);
    }

    function test_RevertWhen_RevealWrongSalt() public {
        uint256 id = _revealing();
        vm.prank(alice);
        vm.expectRevert(CommitMismatch.selector);
        bingo.revealBoard(id, _ordered(), keccak256("wrong"));
    }

    function test_RevertWhen_RevealTamperedBoard() public {
        uint256 id = _revealing();
        vm.prank(alice);
        vm.expectRevert(CommitMismatch.selector);
        bingo.revealBoard(id, _reversed(), SALT_A);
    }

    function test_RevertWhen_RevealTwice() public {
        uint256 id = _revealing();
        vm.prank(alice);
        bingo.revealBoard(id, _ordered(), SALT_A);
        vm.prank(alice);
        vm.expectRevert(AlreadyRevealed.selector);
        bingo.revealBoard(id, _ordered(), SALT_A);
    }

    function test_RevertWhen_RevealAfterDeadline() public {
        uint256 id = _revealing();
        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        vm.expectRevert(RevealWindowClosed.selector);
        bingo.revealBoard(id, _ordered(), SALT_A);
    }

    function test_RevertWhen_RevealNotRevealing() public {
        uint256 id = _sealed();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(WrongState.selector, id, GameState.Revealing, GameState.Committed));
        bingo.revealBoard(id, _ordered(), SALT_A);
    }

    function test_RevertWhen_RevealInvalidBoard() public {
        uint8[25] memory bad = _ordered();
        bad[0] = 2;
        uint256 id = _create(alice, 2);
        _commit(alice, id, CommitLib.commitment(bad, SALT_A));
        _commit(bob, id, CommitLib.commitment(_reversed(), SALT_B));
        vm.prank(alice);
        bingo.callNumber(id, 7);
        vm.prank(alice);
        bingo.claimBingo(id);
        vm.prank(alice);
        vm.expectRevert(InvalidBoard.selector);
        bingo.revealBoard(id, bad, SALT_A);
    }
}
