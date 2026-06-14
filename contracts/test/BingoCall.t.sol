// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Base } from "./Base.sol";
import { GameState } from "../src/types/BingoTypes.sol";
import { Arena } from "../src/types/GameTypes.sol";
import { WrongState, NotYourTurn, NumberOutOfRange, NumberAlreadyCalled } from "../src/types/GameTypes.sol";

contract BingoCallTest is Base {
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        _deployBingo(100);
        _prep(alice);
        _prep(bob);
    }

    /// @dev 2-player arena, both committed → Committed. Player order: [alice, bob].
    function _sealed() internal returns (uint256 id) {
        id = _create(alice, 2);
        _commit(alice, id, keccak256("a"));
        _commit(bob, id, keccak256("b"));
    }

    function test_FirstCallStartsPlaying() public {
        uint256 id = _sealed();
        vm.prank(alice);
        bingo.callNumber(id, 7);

        Arena memory a = bingo.getArena(id);
        assertEq(uint8(a.state), uint8(GameState.Playing));
        assertEq(a.callCount, 1);
        assertEq(a.turnIndex, 1);
        assertEq(a.calledMask, uint32(1) << 6);
        assertEq(bingo.getCallSequence(id)[0], 7);
    }

    function test_TurnRotation() public {
        uint256 id = _sealed();
        vm.prank(alice);
        bingo.callNumber(id, 1);
        vm.prank(bob);
        bingo.callNumber(id, 2);
        assertEq(bingo.getArena(id).turnIndex, 0);
        assertEq(bingo.getArena(id).callCount, 2);
    }

    function test_RevertWhen_NotYourTurn() public {
        uint256 id = _sealed();
        vm.prank(bob);
        vm.expectRevert(NotYourTurn.selector);
        bingo.callNumber(id, 5);
    }

    function test_RevertWhen_NumberOutOfRange() public {
        uint256 id = _sealed();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(NumberOutOfRange.selector, uint8(26)));
        bingo.callNumber(id, 26);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(NumberOutOfRange.selector, uint8(0)));
        bingo.callNumber(id, 0);
    }

    function test_RevertWhen_AlreadyCalled() public {
        uint256 id = _sealed();
        vm.prank(alice);
        bingo.callNumber(id, 7);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(NumberAlreadyCalled.selector, uint8(7)));
        bingo.callNumber(id, 7);
    }

    function test_RevertWhen_NotPlaying() public {
        uint256 id = _create(alice, 2);
        _commit(alice, id, keccak256("a"));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(WrongState.selector, id, GameState.Playing, GameState.Created));
        bingo.callNumber(id, 1);
    }

    function test_AllNumbersCalledOpensReveal() public {
        uint256 id = _sealed();
        for (uint8 n = 1; n <= 25; n++) {
            vm.prank((n % 2 == 1) ? alice : bob);
            bingo.callNumber(id, n);
        }
        Arena memory a = bingo.getArena(id);
        assertEq(a.callCount, 25);
        assertEq(uint8(a.state), uint8(GameState.Revealing));
        assertGt(a.revealDeadline, 0);
        assertEq(a.calledMask, 0x1FFFFFF);
    }
}
