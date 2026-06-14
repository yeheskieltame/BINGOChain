// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Base } from "./Base.sol";
import { CommitLib } from "../src/libraries/CommitLib.sol";
import { GameState } from "../src/types/BingoTypes.sol";
import { WrongState, RevealWindowOpen, NothingToWithdraw } from "../src/types/GameTypes.sol";

contract BingoSettleTest is Base {
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint16 internal constant FEE_BPS = 100;
    bytes32 internal constant SALT_A = keccak256("alice-salt");
    bytes32 internal constant SALT_B = keccak256("bob-salt");

    function setUp() public {
        _deployBingo(FEE_BPS);
        _prep(alice);
        _prep(bob);
    }

    function _ordered() internal pure returns (uint8[25] memory b) {
        for (uint256 i = 0; i < 25; i++) {
            b[i] = uint8(i + 1);
        }
    }

    function _orderedSwapped() internal pure returns (uint8[25] memory b) {
        b = _ordered();
        (b[4], b[5]) = (b[5], b[4]);
    }

    function _sealed(uint8[25] memory aBoard, uint8[25] memory bBoard) internal returns (uint256 id) {
        id = _create(alice, 2);
        _commit(alice, id, CommitLib.commitment(aBoard, SALT_A));
        _commit(bob, id, CommitLib.commitment(bBoard, SALT_B));
    }

    function _callRange(uint256 id, uint8 upto) internal {
        for (uint8 nn = 1; nn <= upto; nn++) {
            vm.prank((nn % 2 == 1) ? alice : bob);
            bingo.callNumber(id, nn);
        }
    }

    function _earn(address a) internal view returns (uint256) {
        return bingo.earningsOf(a, token);
    }

    function test_SingleRevealerWins() public {
        uint256 id = _sealed(_ordered(), _ordered());
        _callRange(id, 5);
        vm.prank(alice);
        bingo.claimBingo(id);
        vm.prank(alice);
        bingo.revealBoard(id, _ordered(), SALT_A);
        vm.warp(block.timestamp + 2 days);
        bingo.settle(id);

        uint256 total = 2 * uint256(STAKE);
        uint256 fee = (total * FEE_BPS) / 10_000;
        assertEq(uint8(bingo.getArena(id).state), uint8(GameState.Settled));
        assertEq(_earn(alice), total - fee);
        assertEq(_earn(bob), 0);
        assertEq(bingo.earningsOf(treasury, token), fee);
        assertEq(token.balanceOf(address(bingo)), total);
    }

    function test_TieSplitsEqually() public {
        uint256 id = _sealed(_ordered(), _ordered());
        _callRange(id, 21);
        vm.prank(alice);
        bingo.claimBingo(id);
        vm.prank(alice);
        bingo.revealBoard(id, _ordered(), SALT_A);
        vm.prank(bob);
        bingo.revealBoard(id, _ordered(), SALT_B);
        bingo.settle(id);

        uint256 total = 2 * uint256(STAKE);
        uint256 fee = (total * FEE_BPS) / 10_000;
        uint256 share = (total - fee) / 2;
        assertEq(_earn(alice), share);
        assertEq(_earn(bob), share);
        assertEq(bingo.earningsOf(treasury, token), fee);
    }

    function test_NoBingoFallbackMostLinesWins() public {
        uint256 id = _sealed(_ordered(), _orderedSwapped());
        _callRange(id, 5);
        vm.prank(alice);
        bingo.claimBingo(id);
        vm.prank(alice);
        bingo.revealBoard(id, _ordered(), SALT_A);
        vm.prank(bob);
        bingo.revealBoard(id, _orderedSwapped(), SALT_B);
        bingo.settle(id);

        uint256 total = 2 * uint256(STAKE);
        uint256 fee = (total * FEE_BPS) / 10_000;
        assertEq(_earn(alice), total - fee);
        assertEq(_earn(bob), 0);
    }

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

        uint256 total = 2 * uint256(STAKE);
        assertEq(_earn(alice) + _earn(bob) + bingo.earningsOf(treasury, token), total);
    }

    function test_RevertWhen_SettleNotRevealing() public {
        uint256 id = _sealed(_ordered(), _ordered());
        _callRange(id, 1);
        vm.expectRevert(abi.encodeWithSelector(WrongState.selector, id, GameState.Revealing, GameState.Playing));
        bingo.settle(id);
    }

    function test_RevertWhen_SettleWindowOpen() public {
        uint256 id = _sealed(_ordered(), _ordered());
        _callRange(id, 5);
        vm.prank(alice);
        bingo.claimBingo(id);
        vm.prank(alice);
        bingo.revealBoard(id, _ordered(), SALT_A);
        vm.expectRevert(RevealWindowOpen.selector);
        bingo.settle(id);
    }

    function test_WithdrawPaysWinner() public {
        uint256 id = _sealed(_ordered(), _ordered());
        _callRange(id, 5);
        vm.prank(alice);
        bingo.claimBingo(id);
        vm.prank(alice);
        bingo.revealBoard(id, _ordered(), SALT_A);
        vm.warp(block.timestamp + 2 days);
        bingo.settle(id);

        uint256 before = token.balanceOf(alice);
        uint256 owed = _earn(alice);
        vm.prank(alice);
        bingo.withdraw(token);
        assertEq(token.balanceOf(alice), before + owed);
        assertEq(_earn(alice), 0);
    }

    function test_RevertWhen_NothingToWithdraw() public {
        vm.prank(alice);
        vm.expectRevert(NothingToWithdraw.selector);
        bingo.withdraw(token);
    }
}
