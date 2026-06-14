// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Base } from "./Base.sol";
import { GameState } from "../src/types/BingoTypes.sol";
import { ArenaNotFound, WrongState, CancelNotAllowed } from "../src/types/GameTypes.sol";

contract BingoCancelTest is Base {
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        _deployBingo(100);
        _prep(alice);
        _prep(bob);
    }

    function _createdWithOne() internal returns (uint256 id) {
        id = _create(alice, 3); // 3 seats, stays unfilled
        _commit(alice, id, keccak256("a"));
    }

    function test_CreatorCancelsAndRefunds() public {
        uint256 id = _createdWithOne();
        vm.prank(alice);
        bingo.cancelArena(id);

        assertEq(uint8(bingo.getArena(id).state), uint8(GameState.Cancelled));
        assertEq(bingo.earningsOf(alice, token), STAKE);
        assertEq(token.balanceOf(address(bingo)), STAKE);

        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        bingo.withdraw(token);
        assertEq(token.balanceOf(alice), before + STAKE);
        assertEq(token.balanceOf(address(bingo)), 0);
    }

    function test_RefundsAllJoinedPlayers() public {
        uint256 id = _create(alice, 3);
        _commit(alice, id, keccak256("a"));
        _commit(bob, id, keccak256("b"));
        vm.prank(alice);
        bingo.cancelArena(id);
        assertEq(bingo.earningsOf(alice, token), STAKE);
        assertEq(bingo.earningsOf(bob, token), STAKE);
        assertEq(bingo.earningsOf(treasury, token), 0);
    }

    function test_RevertWhen_NonCreatorCancelsBeforeWindow() public {
        uint256 id = _createdWithOne();
        vm.prank(bob);
        vm.expectRevert(CancelNotAllowed.selector);
        bingo.cancelArena(id);
    }

    function test_AnyoneCancelsAfterWindow() public {
        uint256 id = _createdWithOne();
        vm.warp(block.timestamp + 2 days);
        vm.prank(bob);
        bingo.cancelArena(id);
        assertEq(uint8(bingo.getArena(id).state), uint8(GameState.Cancelled));
        assertEq(bingo.earningsOf(alice, token), STAKE);
    }

    function test_RevertWhen_CancelNonexistent() public {
        vm.expectRevert(abi.encodeWithSelector(ArenaNotFound.selector, uint256(42)));
        bingo.cancelArena(42);
    }

    function test_RevertWhen_CancelAfterSealed() public {
        uint256 id = _create(alice, 2);
        _commit(alice, id, keccak256("a"));
        _commit(bob, id, keccak256("b"));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(WrongState.selector, id, GameState.Created, GameState.Committed));
        bingo.cancelArena(id);
    }
}
