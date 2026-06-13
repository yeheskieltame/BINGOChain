// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { BingoChain } from "../src/BingoChain.sol";
import { BingoChainProxy } from "../src/BingoChainProxy.sol";
import { GameState } from "../src/types/BingoTypes.sol";
import { ArenaNotFound, WrongState, CancelNotAllowed } from "../src/types/GameTypes.sol";

contract BingoCancelTest is Test {
    BingoChain internal bingo;
    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint96 internal constant STAKE = 1 ether;

    function setUp() public {
        BingoChain impl = new BingoChain();
        bytes memory initData = abi.encodeCall(BingoChain.initialize, (owner, treasury, 100));
        bingo = BingoChain(address(new BingoChainProxy(address(impl), initData)));
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function _createdWithOne() internal returns (uint256 id) {
        vm.prank(alice);
        id = bingo.createArena(3, STAKE); // 3 seats, will stay unfilled
        vm.prank(alice);
        bingo.commitBoard{ value: STAKE }(id, keccak256("a"));
    }

    function test_CreatorCancelsAndRefunds() public {
        uint256 id = _createdWithOne();
        vm.prank(alice);
        bingo.cancelArena(id);

        assertEq(uint8(bingo.getArena(id).state), uint8(GameState.Cancelled));
        assertEq(bingo.earningsOf(alice), STAKE, "alice refunded");
        assertEq(address(bingo).balance, STAKE, "held until withdrawn");

        uint256 before = alice.balance;
        vm.prank(alice);
        bingo.withdraw();
        assertEq(alice.balance, before + STAKE);
        assertEq(address(bingo).balance, 0, "fully drained");
    }

    function test_RefundsAllJoinedPlayers() public {
        vm.prank(alice);
        uint256 id = bingo.createArena(3, STAKE);
        vm.prank(alice);
        bingo.commitBoard{ value: STAKE }(id, keccak256("a"));
        vm.prank(bob);
        bingo.commitBoard{ value: STAKE }(id, keccak256("b"));

        vm.prank(alice);
        bingo.cancelArena(id);
        assertEq(bingo.earningsOf(alice), STAKE);
        assertEq(bingo.earningsOf(bob), STAKE);
        assertEq(bingo.earningsOf(treasury), 0, "no fee on cancel");
    }

    function test_RevertWhen_NonCreatorCancelsBeforeWindow() public {
        uint256 id = _createdWithOne();
        vm.prank(bob);
        vm.expectRevert(CancelNotAllowed.selector);
        bingo.cancelArena(id);
    }

    function test_AnyoneCancelsAfterWindow() public {
        uint256 id = _createdWithOne();
        vm.warp(block.timestamp + 2 days); // past JOIN_WINDOW
        vm.prank(bob); // not the creator
        bingo.cancelArena(id);
        assertEq(uint8(bingo.getArena(id).state), uint8(GameState.Cancelled));
        assertEq(bingo.earningsOf(alice), STAKE);
    }

    function test_RevertWhen_CancelNonexistent() public {
        vm.expectRevert(abi.encodeWithSelector(ArenaNotFound.selector, uint256(42)));
        bingo.cancelArena(42);
    }

    function test_RevertWhen_CancelAfterSealed() public {
        // fill a 2-seat arena so it seals to Committed, then cancel must fail
        vm.prank(alice);
        uint256 id = bingo.createArena(2, STAKE);
        vm.prank(alice);
        bingo.commitBoard{ value: STAKE }(id, keccak256("a"));
        vm.prank(bob);
        bingo.commitBoard{ value: STAKE }(id, keccak256("b"));

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(WrongState.selector, id, GameState.Created, GameState.Committed));
        bingo.cancelArena(id);
    }
}
