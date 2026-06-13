// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { BingoChain } from "../src/BingoChain.sol";
import { BingoChainProxy } from "../src/BingoChainProxy.sol";
import { CommitLib } from "../src/libraries/CommitLib.sol";
import { GameState } from "../src/types/BingoTypes.sol";
import { Arena } from "../src/types/GameTypes.sol";
import { WrongState, RevealWindowOpen, NothingToWithdraw } from "../src/types/GameTypes.sol";

contract BingoSettleTest is Test {
    BingoChain internal bingo;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint96 internal constant STAKE = 1 ether;
    uint16 internal constant FEE_BPS = 100; // 1%
    bytes32 internal constant SALT_A = keccak256("alice-salt");
    bytes32 internal constant SALT_B = keccak256("bob-salt");

    function setUp() public {
        BingoChain impl = new BingoChain();
        bytes memory initData = abi.encodeCall(BingoChain.initialize, (owner, treasury, FEE_BPS));
        bingo = BingoChain(address(new BingoChainProxy(address(impl), initData)));
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function _ordered() internal pure returns (uint8[25] memory b) {
        for (uint256 i = 0; i < 25; i++) {
            b[i] = uint8(i + 1);
        }
    }

    /// @dev Identity board with cells 4 and 5 swapped — calling 1..5 no longer
    ///      completes row 0, so this board scores fewer lines than the ordered one.
    function _orderedSwapped() internal pure returns (uint8[25] memory b) {
        b = _ordered();
        (b[4], b[5]) = (b[5], b[4]);
    }

    function _sealed(uint8[25] memory aBoard, uint8[25] memory bBoard) internal returns (uint256 id) {
        vm.prank(alice);
        id = bingo.createArena(2, STAKE);
        vm.prank(alice);
        bingo.commitBoard{ value: STAKE }(id, CommitLib.commitment(aBoard, SALT_A));
        vm.prank(bob);
        bingo.commitBoard{ value: STAKE }(id, CommitLib.commitment(bBoard, SALT_B));
    }

    function _callRange(uint256 id, uint8 upto) internal {
        for (uint8 nn = 1; nn <= upto; nn++) {
            address who = (nn % 2 == 1) ? alice : bob; // alice has turnIndex 0
            vm.prank(who);
            bingo.callNumber(id, nn);
        }
    }

    // ── single revealer wins (opponent forfeits) ─────────────────

    function test_SingleRevealerWins() public {
        uint256 id = _sealed(_ordered(), _ordered());
        _callRange(id, 5);
        vm.prank(alice);
        bingo.claimBingo(id);

        vm.prank(alice);
        bingo.revealBoard(id, _ordered(), SALT_A); // bob never reveals
        vm.warp(block.timestamp + 2 days); // window closes

        bingo.settle(id);

        uint256 totalStake = 2 * uint256(STAKE);
        uint256 fee = (totalStake * FEE_BPS) / 10_000;
        assertEq(uint8(bingo.getArena(id).state), uint8(GameState.Settled));
        assertEq(bingo.earningsOf(alice), totalStake - fee);
        assertEq(bingo.earningsOf(bob), 0);
        assertEq(bingo.earningsOf(treasury), fee);
        assertEq(address(bingo).balance, totalStake); // held until withdrawn
    }

    // ── tie splits ───────────────────────────────────────────────

    function test_TieSplitsEqually() public {
        uint256 id = _sealed(_ordered(), _ordered());
        _callRange(id, 21); // identity board reaches 5 lines at call 21 for both
        vm.prank(alice);
        bingo.claimBingo(id);
        vm.prank(alice);
        bingo.revealBoard(id, _ordered(), SALT_A);
        vm.prank(bob);
        bingo.revealBoard(id, _ordered(), SALT_B);

        bingo.settle(id); // all revealed → settle allowed before deadline

        uint256 totalStake = 2 * uint256(STAKE);
        uint256 fee = (totalStake * FEE_BPS) / 10_000;
        uint256 share = (totalStake - fee) / 2;
        assertEq(bingo.earningsOf(alice), share);
        assertEq(bingo.earningsOf(bob), share);
        assertEq(bingo.earningsOf(treasury), fee);
    }

    // ── no-BINGO fallback: most lines wins ───────────────────────

    function test_NoBingoFallbackMostLinesWins() public {
        uint256 id = _sealed(_ordered(), _orderedSwapped());
        _callRange(id, 5); // alice completes row 0 (1 line), bob completes none
        vm.prank(alice);
        bingo.claimBingo(id);
        vm.prank(alice);
        bingo.revealBoard(id, _ordered(), SALT_A);
        vm.prank(bob);
        bingo.revealBoard(id, _orderedSwapped(), SALT_B);

        bingo.settle(id);

        uint256 totalStake = 2 * uint256(STAKE);
        uint256 fee = (totalStake * FEE_BPS) / 10_000;
        assertEq(bingo.earningsOf(alice), totalStake - fee);
        assertEq(bingo.earningsOf(bob), 0);
    }

    // ── pot conservation ─────────────────────────────────────────

    function test_SettleConservesPot() public {
        uint256 id = _sealed(_ordered(), _orderedSwapped());
        _callRange(id, 5);
        vm.prank(alice);
        bingo.claimBingo(id);
        vm.prank(alice);
        bingo.revealBoard(id, _ordered(), SALT_A);
        vm.prank(bob);
        bingo.revealBoard(id, _orderedSwapped(), SALT_B);
        bingo.settle(id);

        uint256 totalStake = 2 * uint256(STAKE);
        assertEq(bingo.earningsOf(alice) + bingo.earningsOf(bob) + bingo.earningsOf(treasury), totalStake);
    }

    // ── guards ───────────────────────────────────────────────────

    function test_RevertWhen_SettleNotRevealing() public {
        uint256 id = _sealed(_ordered(), _ordered());
        _callRange(id, 1); // Playing
        vm.expectRevert(abi.encodeWithSelector(WrongState.selector, id, GameState.Revealing, GameState.Playing));
        bingo.settle(id);
    }

    function test_RevertWhen_SettleWindowOpen() public {
        uint256 id = _sealed(_ordered(), _ordered());
        _callRange(id, 5);
        vm.prank(alice);
        bingo.claimBingo(id);
        vm.prank(alice);
        bingo.revealBoard(id, _ordered(), SALT_A); // only one revealed, window still open
        vm.expectRevert(RevealWindowOpen.selector);
        bingo.settle(id);
    }

    // ── withdraw ─────────────────────────────────────────────────

    function test_WithdrawPaysWinner() public {
        uint256 id = _sealed(_ordered(), _ordered());
        _callRange(id, 5);
        vm.prank(alice);
        bingo.claimBingo(id);
        vm.prank(alice);
        bingo.revealBoard(id, _ordered(), SALT_A);
        vm.warp(block.timestamp + 2 days);
        bingo.settle(id);

        uint256 before = alice.balance;
        uint256 owed = bingo.earningsOf(alice);
        vm.prank(alice);
        bingo.withdraw();
        assertEq(alice.balance, before + owed);
        assertEq(bingo.earningsOf(alice), 0);
    }

    function test_RevertWhen_NothingToWithdraw() public {
        vm.prank(alice);
        vm.expectRevert(NothingToWithdraw.selector);
        bingo.withdraw();
    }
}
