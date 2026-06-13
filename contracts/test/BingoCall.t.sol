// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { BingoChain } from "../src/BingoChain.sol";
import { BingoChainProxy } from "../src/BingoChainProxy.sol";
import { GameState } from "../src/types/BingoTypes.sol";
import { Arena } from "../src/types/GameTypes.sol";
import { WrongState, NotYourTurn, NumberOutOfRange, NumberAlreadyCalled } from "../src/types/GameTypes.sol";

contract BingoCallTest is Test {
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

    /// @dev 2-player arena, both committed → state Committed. Player order: [alice, bob].
    function _sealedArena() internal returns (uint256 id) {
        vm.prank(alice);
        id = bingo.createArena(2, STAKE);
        vm.prank(alice);
        bingo.commitBoard{ value: STAKE }(id, keccak256("a"));
        vm.prank(bob);
        bingo.commitBoard{ value: STAKE }(id, keccak256("b"));
    }

    function test_FirstCallStartsPlaying() public {
        uint256 id = _sealedArena();
        vm.prank(alice);
        bingo.callNumber(id, 7);

        Arena memory a = bingo.getArena(id);
        assertEq(uint8(a.state), uint8(GameState.Playing));
        assertEq(a.callCount, 1);
        assertEq(a.turnIndex, 1); // advanced to bob
        assertEq(a.calledMask, uint32(1) << 6); // number 7 → bit 6
        uint8[] memory seq = bingo.getCallSequence(id);
        assertEq(seq.length, 1);
        assertEq(seq[0], 7);
    }

    function test_TurnRotation() public {
        uint256 id = _sealedArena();
        vm.prank(alice);
        bingo.callNumber(id, 1);
        vm.prank(bob);
        bingo.callNumber(id, 2);
        assertEq(bingo.getArena(id).turnIndex, 0); // back to alice
        assertEq(bingo.getArena(id).callCount, 2);
    }

    function test_RevertWhen_NotYourTurn() public {
        uint256 id = _sealedArena();
        vm.prank(bob); // turnIndex 0 is alice
        vm.expectRevert(NotYourTurn.selector);
        bingo.callNumber(id, 5);
    }

    function test_RevertWhen_NumberOutOfRange() public {
        uint256 id = _sealedArena();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(NumberOutOfRange.selector, uint8(26)));
        bingo.callNumber(id, 26);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(NumberOutOfRange.selector, uint8(0)));
        bingo.callNumber(id, 0);
    }

    function test_RevertWhen_AlreadyCalled() public {
        uint256 id = _sealedArena();
        vm.prank(alice);
        bingo.callNumber(id, 7);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(NumberAlreadyCalled.selector, uint8(7)));
        bingo.callNumber(id, 7);
    }

    function test_RevertWhen_NotPlaying() public {
        // Arena with one seat open is still Created → callNumber must revert.
        vm.prank(alice);
        uint256 id = bingo.createArena(2, STAKE);
        vm.prank(alice);
        bingo.commitBoard{ value: STAKE }(id, keccak256("a"));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(WrongState.selector, id, GameState.Playing, GameState.Created));
        bingo.callNumber(id, 1);
    }

    function test_AllNumbersCalledOpensReveal() public {
        uint256 id = _sealedArena();
        for (uint8 n = 1; n <= 25; n++) {
            address who = (n % 2 == 1) ? alice : bob; // alice starts (turnIndex 0)
            vm.prank(who);
            bingo.callNumber(id, n);
        }
        Arena memory a = bingo.getArena(id);
        assertEq(a.callCount, 25);
        assertEq(uint8(a.state), uint8(GameState.Revealing));
        assertGt(a.revealDeadline, 0);
        assertEq(a.calledMask, 0x1FFFFFF); // all 25 bits
    }
}
