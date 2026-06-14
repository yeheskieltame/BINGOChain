// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Base } from "./Base.sol";
import { CommitLib } from "../src/libraries/CommitLib.sol";
import { GameState } from "../src/types/BingoTypes.sol";

/// @notice Full end-to-end game scenarios across the space of outcomes. Every
///         scenario asserts the pot reconciles (winners + treasury == totalStake).
contract BingoIntegrationTest is Base {
    function setUp() public {
        _deployBingo(100);
    }

    function _ordered() internal pure returns (uint8[25] memory b) {
        for (uint256 i = 0; i < 25; i++) {
            b[i] = uint8(i + 1);
        }
    }

    /// @dev Board that never reaches 5 lines when 1..21 are called (caps at 3).
    function _loser() internal pure returns (uint8[25] memory b) {
        bool[25] memory blocked;
        blocked[0] = true;
        blocked[6] = true;
        blocked[18] = true;
        blocked[24] = true;
        uint8 small = 1;
        uint8 big = 22;
        for (uint8 p = 0; p < 25; p++) {
            b[p] = blocked[p] ? big++ : small++;
        }
    }

    function _salt(address who) internal pure returns (bytes32) {
        return keccak256(abi.encode("salt", who));
    }

    function _players(uint8 n) internal returns (address[] memory ps) {
        ps = new address[](n);
        for (uint8 i = 0; i < n; i++) {
            ps[i] = makeAddr(string(abi.encodePacked("player", vm.toString(i))));
            _prep(ps[i]);
        }
    }

    function _createAndCommit(address[] memory ps, uint8[25][] memory boards) internal returns (uint256 id) {
        id = _create(ps[0], uint8(ps.length));
        for (uint256 i = 0; i < ps.length; i++) {
            _commit(ps[i], id, CommitLib.commitment(boards[i], _salt(ps[i])));
        }
    }

    function _callTwo(uint256 id, address a, address b, uint8 upto) internal {
        for (uint8 nn = 1; nn <= upto; nn++) {
            vm.prank((nn % 2 == 1) ? a : b);
            bingo.callNumber(id, nn);
        }
    }

    function _assertPotConserved(address[] memory ps, uint256 totalStake) internal view {
        uint256 sum = bingo.earningsOf(treasury, token);
        for (uint256 i = 0; i < ps.length; i++) {
            sum += bingo.earningsOf(ps[i], token);
        }
        assertEq(sum, totalStake, "pot not conserved");
        assertEq(token.balanceOf(address(bingo)), totalStake, "balance != pot");
    }

    function test_TwoPlayer_SingleWinnerOnMerit() public {
        address[] memory ps = _players(2);
        uint8[25][] memory boards = new uint8[25][](2);
        boards[0] = _ordered();
        boards[1] = _loser();
        uint256 id = _createAndCommit(ps, boards);

        _callTwo(id, ps[0], ps[1], 21);
        vm.prank(ps[0]);
        bingo.claimBingo(id);
        vm.prank(ps[0]);
        bingo.revealBoard(id, boards[0], _salt(ps[0]));
        vm.prank(ps[1]);
        bingo.revealBoard(id, boards[1], _salt(ps[1]));
        bingo.settle(id);

        uint256 total = 2 * uint256(STAKE);
        uint256 fee = (total * 100) / 10_000;
        assertEq(bingo.earningsOf(ps[0], token), total - fee);
        assertEq(bingo.earningsOf(ps[1], token), 0);
        _assertPotConserved(ps, total);
    }

    function test_SixPlayer_TurnRotation_And_ForfeitPayout() public {
        address[] memory ps = _players(6);
        uint8[25][] memory boards = new uint8[25][](6);
        for (uint256 i = 0; i < 6; i++) {
            boards[i] = _ordered();
        }
        uint256 id = _createAndCommit(ps, boards);
        assertEq(uint8(bingo.getArena(id).state), uint8(GameState.Committed));

        for (uint8 i = 0; i < 6; i++) {
            assertEq(bingo.getArena(id).turnIndex, i);
            vm.prank(ps[i]);
            bingo.callNumber(id, i + 1);
        }
        assertEq(bingo.getArena(id).turnIndex, 0);

        vm.prank(ps[0]);
        bingo.claimBingo(id);
        vm.prank(ps[0]);
        bingo.revealBoard(id, boards[0], _salt(ps[0]));
        vm.warp(block.timestamp + 2 days);
        bingo.settle(id);

        uint256 total = 6 * uint256(STAKE);
        uint256 fee = (total * 100) / 10_000;
        assertEq(bingo.earningsOf(ps[0], token), total - fee);
        _assertPotConserved(ps, total);
    }

    function test_FalseClaim_DoesNotWin() public {
        address[] memory ps = _players(2);
        uint8[25][] memory boards = new uint8[25][](2);
        boards[0] = _loser();
        boards[1] = _ordered();
        uint256 id = _createAndCommit(ps, boards);

        _callTwo(id, ps[0], ps[1], 21);
        vm.prank(ps[0]);
        bingo.claimBingo(id);
        vm.prank(ps[0]);
        bingo.revealBoard(id, boards[0], _salt(ps[0]));
        vm.prank(ps[1]);
        bingo.revealBoard(id, boards[1], _salt(ps[1]));
        bingo.settle(id);

        uint256 total = 2 * uint256(STAKE);
        uint256 fee = (total * 100) / 10_000;
        assertEq(bingo.earningsOf(ps[1], token), total - fee);
        assertEq(bingo.earningsOf(ps[0], token), 0);
        _assertPotConserved(ps, total);
    }

    function test_NoReveals_PotToTreasury() public {
        address[] memory ps = _players(2);
        uint8[25][] memory boards = new uint8[25][](2);
        boards[0] = _ordered();
        boards[1] = _ordered();
        uint256 id = _createAndCommit(ps, boards);

        _callTwo(id, ps[0], ps[1], 4);
        vm.prank(ps[0]);
        bingo.claimBingo(id);
        vm.warp(block.timestamp + 2 days);
        bingo.settle(id);

        uint256 total = 2 * uint256(STAKE);
        assertEq(bingo.earningsOf(treasury, token), total);
        _assertPotConserved(ps, total);
    }

    function test_AllNumbersCalled_AutoReveal_ThenSettle() public {
        address[] memory ps = _players(2);
        uint8[25][] memory boards = new uint8[25][](2);
        boards[0] = _ordered();
        boards[1] = _loser();
        uint256 id = _createAndCommit(ps, boards);

        for (uint8 nn = 1; nn <= 25; nn++) {
            vm.prank((nn % 2 == 1) ? ps[0] : ps[1]);
            bingo.callNumber(id, nn);
        }
        assertEq(uint8(bingo.getArena(id).state), uint8(GameState.Revealing));

        vm.prank(ps[0]);
        bingo.revealBoard(id, boards[0], _salt(ps[0]));
        vm.prank(ps[1]);
        bingo.revealBoard(id, boards[1], _salt(ps[1]));
        bingo.settle(id);

        uint256 total = 2 * uint256(STAKE);
        uint256 fee = (total * 100) / 10_000;
        assertEq(bingo.earningsOf(ps[0], token), total - fee);
        _assertPotConserved(ps, total);
    }

    function test_Timeout_PartialReveal_RevealerWins() public {
        address[] memory ps = _players(3);
        uint8[25][] memory boards = new uint8[25][](3);
        boards[0] = _ordered();
        boards[1] = _ordered();
        boards[2] = _ordered();
        uint256 id = _createAndCommit(ps, boards);

        for (uint8 nn = 1; nn <= 6; nn++) {
            vm.prank(ps[(nn - 1) % 3]);
            bingo.callNumber(id, nn);
        }
        vm.prank(ps[0]);
        bingo.claimBingo(id);
        vm.prank(ps[0]);
        bingo.revealBoard(id, boards[0], _salt(ps[0]));
        vm.prank(ps[1]);
        bingo.revealBoard(id, boards[1], _salt(ps[1]));
        vm.warp(block.timestamp + 2 days);
        bingo.settle(id);

        uint256 total = 3 * uint256(STAKE);
        uint256 fee = (total * 100) / 10_000;
        uint256 share = (total - fee) / 2;
        assertEq(bingo.earningsOf(ps[0], token), share);
        assertEq(bingo.earningsOf(ps[1], token), share);
        assertEq(bingo.earningsOf(ps[2], token), 0);
        _assertPotConserved(ps, total);
    }

    function test_MultiArena_Isolation() public {
        address[] memory a = _players(2);
        uint8[25][] memory ba = new uint8[25][](2);
        ba[0] = _ordered();
        ba[1] = _ordered();
        uint256 id1 = _createAndCommit(a, ba);

        address c1 = makeAddr("c1");
        _prep(c1);
        uint256 id2 = _create(c1, 2);
        _commit(c1, id2, CommitLib.commitment(_ordered(), _salt(c1)));

        vm.prank(a[0]);
        bingo.callNumber(id1, 9);
        assertEq(bingo.getArena(id1).callCount, 1);
        assertEq(bingo.getArena(id2).callCount, 0);
        assertEq(uint8(bingo.getArena(id2).state), uint8(GameState.Created));
        assertEq(bingo.getArena(id2).joinedCount, 1);
        assertEq(token.balanceOf(address(bingo)), 3 * uint256(STAKE));
    }
}
