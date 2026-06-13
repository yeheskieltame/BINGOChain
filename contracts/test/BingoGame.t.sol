// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { BingoChain } from "../src/BingoChain.sol";
import { BingoChainProxy } from "../src/BingoChainProxy.sol";
import { GameState } from "../src/types/BingoTypes.sol";
import { Arena } from "../src/types/GameTypes.sol";
import {
    ArenaNotFound,
    WrongState,
    InvalidPlayerCount,
    StakeTooLow,
    IncorrectStake,
    AlreadyJoined,
    ArenaFull
} from "../src/types/GameTypes.sol";

contract BingoGameTest is Test {
    BingoChain internal bingo;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint96 internal constant STAKE = 1 ether;

    function setUp() public {
        BingoChain impl = new BingoChain();
        bytes memory initData = abi.encodeCall(BingoChain.initialize, (owner, treasury, 100));
        bingo = BingoChain(address(new BingoChainProxy(address(impl), initData)));
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(carol, 10 ether);
    }

    function _commit(address who) internal pure returns (bytes32) {
        return keccak256(abi.encode("board", who));
    }

    // ── createArena ──────────────────────────────────────────────

    function test_CreateArena() public {
        vm.prank(alice);
        uint256 id = bingo.createArena(2, STAKE);
        assertEq(id, 1);
        Arena memory a = bingo.getArena(id);
        assertEq(a.creator, alice);
        assertEq(a.stake, STAKE);
        assertEq(a.maxPlayers, 2);
        assertEq(uint8(a.state), uint8(GameState.Created));
        assertEq(a.joinedCount, 0);
    }

    function test_RevertWhen_PlayerCountTooLow() public {
        vm.expectRevert(abi.encodeWithSelector(InvalidPlayerCount.selector, uint8(1)));
        bingo.createArena(1, STAKE);
    }

    function test_RevertWhen_PlayerCountTooHigh() public {
        vm.expectRevert(abi.encodeWithSelector(InvalidPlayerCount.selector, uint8(7)));
        bingo.createArena(7, STAKE);
    }

    function test_RevertWhen_StakeBelowMin() public {
        vm.expectRevert(abi.encodeWithSelector(StakeTooLow.selector, uint256(0.5 ether), uint256(1 ether)));
        bingo.createArena(2, 0.5 ether);
    }

    // ── commitBoard ──────────────────────────────────────────────

    function test_CommitBoard_JoinsAndStores() public {
        vm.prank(alice);
        uint256 id = bingo.createArena(2, STAKE);

        vm.prank(alice);
        bingo.commitBoard{ value: STAKE }(id, _commit(alice));

        assertEq(bingo.getPlayers(id).length, 1);
        assertEq(bingo.getPlayers(id)[0], alice);
        assertEq(bingo.boardCommitOf(id, alice), _commit(alice));
        assertEq(bingo.getArena(id).joinedCount, 1);
        assertEq(uint8(bingo.getArena(id).state), uint8(GameState.Created));
        assertEq(address(bingo).balance, STAKE);
    }

    function test_RevertWhen_ArenaNotFound() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ArenaNotFound.selector, uint256(99)));
        bingo.commitBoard{ value: STAKE }(99, _commit(alice));
    }

    function test_RevertWhen_IncorrectStake() public {
        vm.prank(alice);
        uint256 id = bingo.createArena(2, STAKE);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IncorrectStake.selector, uint256(0.9 ether), uint256(STAKE)));
        bingo.commitBoard{ value: 0.9 ether }(id, _commit(alice));
    }

    function test_RevertWhen_AlreadyJoined() public {
        vm.prank(alice);
        uint256 id = bingo.createArena(2, STAKE);
        vm.prank(alice);
        bingo.commitBoard{ value: STAKE }(id, _commit(alice));
        vm.prank(alice);
        vm.expectRevert(AlreadyJoined.selector);
        bingo.commitBoard{ value: STAKE }(id, _commit(alice));
    }

    function test_SealsWhenFull() public {
        vm.prank(alice);
        uint256 id = bingo.createArena(2, STAKE);

        vm.prank(alice);
        bingo.commitBoard{ value: STAKE }(id, _commit(alice));
        vm.prank(bob);
        bingo.commitBoard{ value: STAKE }(id, _commit(bob));

        Arena memory a = bingo.getArena(id);
        assertEq(a.joinedCount, 2);
        assertEq(uint8(a.state), uint8(GameState.Committed));
        assertEq(address(bingo).balance, 2 * uint256(STAKE));
    }

    function test_RevertWhen_ArenaFull() public {
        vm.prank(alice);
        uint256 id = bingo.createArena(2, STAKE);
        vm.prank(alice);
        bingo.commitBoard{ value: STAKE }(id, _commit(alice));
        vm.prank(bob);
        bingo.commitBoard{ value: STAKE }(id, _commit(bob));

        // arena is now Committed; a third commit hits the state guard first.
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(WrongState.selector, id, GameState.Created, GameState.Committed));
        bingo.commitBoard{ value: STAKE }(id, _commit(carol));
    }
}
