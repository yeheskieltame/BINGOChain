// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { BingoChain } from "../src/BingoChain.sol";
import { BingoChainProxy } from "../src/BingoChainProxy.sol";
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

contract BingoRevealTest is Test {
    BingoChain internal bingo;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal stranger = makeAddr("stranger");

    uint96 internal constant STAKE = 1 ether;
    bytes32 internal constant SALT_A = keccak256("alice-salt");
    bytes32 internal constant SALT_B = keccak256("bob-salt");

    function setUp() public {
        BingoChain impl = new BingoChain();
        bytes memory initData = abi.encodeCall(BingoChain.initialize, (owner, treasury, 100));
        bingo = BingoChain(address(new BingoChainProxy(address(impl), initData)));
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
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

    /// @dev Sealed 2-player arena where alice/bob commit real, revealable boards.
    function _sealed() internal returns (uint256 id) {
        vm.prank(alice);
        id = bingo.createArena(2, STAKE);
        vm.prank(alice);
        bingo.commitBoard{ value: STAKE }(id, CommitLib.commitment(_ordered(), SALT_A));
        vm.prank(bob);
        bingo.commitBoard{ value: STAKE }(id, CommitLib.commitment(_reversed(), SALT_B));
    }

    /// @dev Move a sealed arena into Revealing via one call + a claim.
    function _revealing() internal returns (uint256 id) {
        id = _sealed();
        vm.prank(alice);
        bingo.callNumber(id, 7); // Committed → Playing
        vm.prank(alice);
        bingo.claimBingo(id); // Playing → Revealing
    }

    // ── claimBingo ───────────────────────────────────────────────

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
        uint256 id = _sealed(); // Committed, no calls yet
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

    // ── revealBoard ──────────────────────────────────────────────

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
        bingo.revealBoard(id, _reversed(), SALT_A); // not alice's board
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
        // Commit to an invalid board (duplicate), then reveal it: passes the hash
        // check but fails board validity.
        uint8[25] memory bad = _ordered();
        bad[0] = 2; // now two 2s, missing 1 → invalid permutation
        vm.prank(alice);
        uint256 id = bingo.createArena(2, STAKE);
        vm.prank(alice);
        bingo.commitBoard{ value: STAKE }(id, CommitLib.commitment(bad, SALT_A));
        vm.prank(bob);
        bingo.commitBoard{ value: STAKE }(id, CommitLib.commitment(_reversed(), SALT_B));
        vm.prank(alice);
        bingo.callNumber(id, 7);
        vm.prank(alice);
        bingo.claimBingo(id);

        vm.prank(alice);
        vm.expectRevert(InvalidBoard.selector);
        bingo.revealBoard(id, bad, SALT_A);
    }
}
