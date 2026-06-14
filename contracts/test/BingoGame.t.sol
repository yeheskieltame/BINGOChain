// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Base, MockERC20 } from "./Base.sol";
import { BingoChain } from "../src/BingoChain.sol";
import { GameState } from "../src/types/BingoTypes.sol";
import { Arena } from "../src/types/GameTypes.sol";
import {
    ArenaNotFound,
    WrongState,
    InvalidPlayerCount,
    TokenNotAllowed,
    StakeTooLow,
    AlreadyJoined
} from "../src/types/GameTypes.sol";

contract BingoGameTest is Base {
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    function setUp() public {
        _deployBingo(100);
        _prep(alice);
        _prep(bob);
        _prep(carol);
    }

    function _c(address who) internal pure returns (bytes32) {
        return keccak256(abi.encode("board", who));
    }

    // ── createArena ──────────────────────────────────────────────

    function test_CreateArena() public {
        uint256 id = _create(alice, 2);
        assertEq(id, 1);
        Arena memory a = bingo.getArena(id);
        assertEq(a.creator, alice);
        assertEq(a.token, address(token));
        assertEq(a.stake, STAKE);
        assertEq(a.maxPlayers, 2);
        assertEq(uint8(a.state), uint8(GameState.Created));
    }

    function test_RevertWhen_PlayerCountTooLow() public {
        vm.expectRevert(abi.encodeWithSelector(InvalidPlayerCount.selector, uint8(1)));
        bingo.createArena(token, 1, STAKE);
    }

    function test_RevertWhen_PlayerCountTooHigh() public {
        vm.expectRevert(abi.encodeWithSelector(InvalidPlayerCount.selector, uint8(7)));
        bingo.createArena(token, 7, STAKE);
    }

    function test_RevertWhen_StakeBelowMin() public {
        vm.expectRevert(abi.encodeWithSelector(StakeTooLow.selector, uint256(0.5 ether), uint256(STAKE)));
        bingo.createArena(token, 2, 0.5 ether);
    }

    function test_RevertWhen_TokenNotAllowed() public {
        MockERC20 other = new MockERC20();
        vm.expectRevert(abi.encodeWithSelector(TokenNotAllowed.selector, address(other)));
        bingo.createArena(other, 2, STAKE);
    }

    // ── commitBoard ──────────────────────────────────────────────

    function test_CommitBoard_JoinsPullsStakeStores() public {
        uint256 id = _create(alice, 2);
        _commit(alice, id, _c(alice));

        assertEq(bingo.getPlayers(id).length, 1);
        assertEq(bingo.getPlayers(id)[0], alice);
        assertEq(bingo.boardCommitOf(id, alice), _c(alice));
        assertEq(bingo.getArena(id).joinedCount, 1);
        assertEq(token.balanceOf(address(bingo)), STAKE);
    }

    function test_RevertWhen_ArenaNotFound() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ArenaNotFound.selector, uint256(99)));
        bingo.commitBoard(99, _c(alice));
    }

    function test_RevertWhen_AlreadyJoined() public {
        uint256 id = _create(alice, 2);
        _commit(alice, id, _c(alice));
        vm.prank(alice);
        vm.expectRevert(AlreadyJoined.selector);
        bingo.commitBoard(id, _c(alice));
    }

    function test_SealsWhenFull() public {
        uint256 id = _create(alice, 2);
        _commit(alice, id, _c(alice));
        _commit(bob, id, _c(bob));

        Arena memory a = bingo.getArena(id);
        assertEq(a.joinedCount, 2);
        assertEq(uint8(a.state), uint8(GameState.Committed));
        assertEq(token.balanceOf(address(bingo)), 2 * uint256(STAKE));
    }

    function test_RevertWhen_CommitAfterSealed() public {
        uint256 id = _create(alice, 2);
        _commit(alice, id, _c(alice));
        _commit(bob, id, _c(bob));
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(WrongState.selector, id, GameState.Created, GameState.Committed));
        bingo.commitBoard(id, _c(carol));
    }
}
