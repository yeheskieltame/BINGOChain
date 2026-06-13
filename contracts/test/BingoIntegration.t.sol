// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { BingoChain } from "../src/BingoChain.sol";
import { BingoChainProxy } from "../src/BingoChainProxy.sol";
import { CommitLib } from "../src/libraries/CommitLib.sol";
import { GameState } from "../src/types/BingoTypes.sol";
import { Arena } from "../src/types/GameTypes.sol";

/// @notice Full end-to-end game scenarios — "playing many rounds of all the
///         possibilities": single winner on merit, N-player turn rotation +
///         payout, false claims, no-reveal forfeits, timeouts, all-25 auto-reveal,
///         and multi-arena isolation. Every scenario asserts the pot reconciles.
contract BingoIntegrationTest is Test {
    BingoChain internal bingo;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");

    uint96 internal constant STAKE = 1 ether;
    uint16 internal constant FEE_BPS = 100; // 1%

    function setUp() public {
        BingoChain impl = new BingoChain();
        bytes memory initData = abi.encodeCall(BingoChain.initialize, (owner, treasury, FEE_BPS));
        bingo = BingoChain(address(new BingoChainProxy(address(impl), initData)));
    }

    // ── board helpers ────────────────────────────────────────────

    function _ordered() internal pure returns (uint8[25] memory b) {
        for (uint256 i = 0; i < 25; i++) {
            b[i] = uint8(i + 1);
        }
    }

    /// @dev Board that NEVER reaches 5 lines when numbers 1..21 are called:
    ///      the four uncalled numbers (22..25) sit on cells 0,6,18,24, blocking
    ///      every line except row2, col2 and the anti-diagonal (3 lines max).
    function _loserFor1to21() internal pure returns (uint8[25] memory b) {
        bool[25] memory blocked;
        blocked[0] = true;
        blocked[6] = true;
        blocked[18] = true;
        blocked[24] = true;
        uint8 small = 1; // 1..21 on open cells
        uint8 big = 22; // 22..25 on blocked cells
        for (uint8 p = 0; p < 25; p++) {
            if (blocked[p]) {
                b[p] = big++;
            } else {
                b[p] = small++;
            }
        }
    }

    function _salt(address who) internal pure returns (bytes32) {
        return keccak256(abi.encode("salt", who));
    }

    // ── N-player helpers ─────────────────────────────────────────

    function _players(uint8 n) internal returns (address[] memory ps) {
        ps = new address[](n);
        for (uint8 i = 0; i < n; i++) {
            ps[i] = makeAddr(string(abi.encodePacked("player", vm.toString(i))));
            vm.deal(ps[i], 10 ether);
        }
    }

    function _createAndCommit(address[] memory ps, uint8[25][] memory boards) internal returns (uint256 id) {
        vm.prank(ps[0]);
        id = bingo.createArena(uint8(ps.length), STAKE);
        for (uint256 i = 0; i < ps.length; i++) {
            vm.prank(ps[i]);
            bingo.commitBoard{ value: STAKE }(id, CommitLib.commitment(boards[i], _salt(ps[i])));
        }
    }

    function _callRangeTwoPlayers(uint256 id, address a, address b, uint8 upto) internal {
        for (uint8 nn = 1; nn <= upto; nn++) {
            address who = (nn % 2 == 1) ? a : b;
            vm.prank(who);
            bingo.callNumber(id, nn);
        }
    }

    function _assertPotConserved(address[] memory ps, uint256 totalStake) internal view {
        uint256 sum = bingo.earningsOf(treasury);
        for (uint256 i = 0; i < ps.length; i++) {
            sum += bingo.earningsOf(ps[i]);
        }
        assertEq(sum, totalStake, "pot not conserved");
        assertEq(address(bingo).balance, totalStake, "balance != held pot");
    }

    // ── 1. single winner on merit (both reveal, one truly wins) ──

    function test_TwoPlayer_SingleWinnerOnMerit() public {
        address[] memory ps = _players(2);
        uint8[25][] memory boards = new uint8[25][](2);
        boards[0] = _ordered(); // player0 bingos at call 21
        boards[1] = _loserFor1to21(); // player1 caps at 3 lines
        uint256 id = _createAndCommit(ps, boards);

        _callRangeTwoPlayers(id, ps[0], ps[1], 21);
        vm.prank(ps[0]);
        bingo.claimBingo(id);
        vm.prank(ps[0]);
        bingo.revealBoard(id, boards[0], _salt(ps[0]));
        vm.prank(ps[1]);
        bingo.revealBoard(id, boards[1], _salt(ps[1]));

        bingo.settle(id);

        uint256 total = 2 * uint256(STAKE);
        uint256 fee = (total * FEE_BPS) / 10_000;
        assertEq(bingo.earningsOf(ps[0]), total - fee, "winner payout");
        assertEq(bingo.earningsOf(ps[1]), 0, "loser gets nothing");
        _assertPotConserved(ps, total);
    }

    // ── 2. six players: turn rotation + forfeit payout ───────────

    function test_SixPlayer_TurnRotation_And_ForfeitPayout() public {
        address[] memory ps = _players(6);
        uint8[25][] memory boards = new uint8[25][](6);
        for (uint256 i = 0; i < 6; i++) {
            boards[i] = _ordered();
        }
        uint256 id = _createAndCommit(ps, boards);
        assertEq(uint8(bingo.getArena(id).state), uint8(GameState.Committed));

        // Each of the 6 players calls in turn; turnIndex must cycle 0..5..0.
        for (uint8 i = 0; i < 6; i++) {
            assertEq(bingo.getArena(id).turnIndex, i, "turn order");
            vm.prank(ps[i]);
            bingo.callNumber(id, i + 1);
        }
        assertEq(bingo.getArena(id).turnIndex, 0, "turn wrapped");

        // Only player0 reveals; the other five forfeit.
        vm.prank(ps[0]);
        bingo.claimBingo(id);
        vm.prank(ps[0]);
        bingo.revealBoard(id, boards[0], _salt(ps[0]));
        vm.warp(block.timestamp + 2 days);
        bingo.settle(id);

        uint256 total = 6 * uint256(STAKE);
        uint256 fee = (total * FEE_BPS) / 10_000;
        assertEq(bingo.earningsOf(ps[0]), total - fee, "sole revealer wins whole pot");
        _assertPotConserved(ps, total);
    }

    // ── 3. a false claim does not win — replay decides ───────────

    function test_FalseClaim_DoesNotWin() public {
        address[] memory ps = _players(2);
        uint8[25][] memory boards = new uint8[25][](2);
        boards[0] = _loserFor1to21(); // claimer, never reaches 5 lines
        boards[1] = _ordered(); // real winner at call 21
        uint256 id = _createAndCommit(ps, boards);

        _callRangeTwoPlayers(id, ps[0], ps[1], 21);
        vm.prank(ps[0]);
        bingo.claimBingo(id); // player0 falsely claims
        vm.prank(ps[0]);
        bingo.revealBoard(id, boards[0], _salt(ps[0]));
        vm.prank(ps[1]);
        bingo.revealBoard(id, boards[1], _salt(ps[1]));

        bingo.settle(id);

        uint256 total = 2 * uint256(STAKE);
        uint256 fee = (total * FEE_BPS) / 10_000;
        assertEq(bingo.earningsOf(ps[1]), total - fee, "true winner (player1) paid");
        assertEq(bingo.earningsOf(ps[0]), 0, "false claimer gets nothing");
        _assertPotConserved(ps, total);
    }

    // ── 4. nobody reveals → pot to treasury (not stranded) ───────

    function test_NoReveals_PotToTreasury() public {
        address[] memory ps = _players(2);
        uint8[25][] memory boards = new uint8[25][](2);
        boards[0] = _ordered();
        boards[1] = _ordered();
        uint256 id = _createAndCommit(ps, boards);

        _callRangeTwoPlayers(id, ps[0], ps[1], 4);
        vm.prank(ps[0]);
        bingo.claimBingo(id);
        vm.warp(block.timestamp + 2 days); // window closes, no reveals

        bingo.settle(id);

        uint256 total = 2 * uint256(STAKE);
        assertEq(bingo.earningsOf(treasury), total, "treasury sweeps abandoned pot");
        _assertPotConserved(ps, total);
    }

    // ── 5. all 25 called, no explicit claim → auto reveal phase ──

    function test_AllNumbersCalled_AutoReveal_ThenSettle() public {
        address[] memory ps = _players(2);
        uint8[25][] memory boards = new uint8[25][](2);
        boards[0] = _ordered();
        boards[1] = _loserFor1to21();
        uint256 id = _createAndCommit(ps, boards);

        for (uint8 nn = 1; nn <= 25; nn++) {
            address who = (nn % 2 == 1) ? ps[0] : ps[1];
            vm.prank(who);
            bingo.callNumber(id, nn);
        }
        assertEq(uint8(bingo.getArena(id).state), uint8(GameState.Revealing), "auto reveal at 25");

        vm.prank(ps[0]);
        bingo.revealBoard(id, boards[0], _salt(ps[0]));
        vm.prank(ps[1]);
        bingo.revealBoard(id, boards[1], _salt(ps[1]));
        bingo.settle(id);

        // With all 25 called, the ordered board has 12 lines and wins outright.
        uint256 total = 2 * uint256(STAKE);
        uint256 fee = (total * FEE_BPS) / 10_000;
        assertEq(bingo.earningsOf(ps[0]), total - fee, "ordered board wins");
        _assertPotConserved(ps, total);
    }

    // ── 6. timeout with a partial reveal: revealer beats forfeiter ─

    function test_Timeout_PartialReveal_RevealerWins() public {
        address[] memory ps = _players(3);
        uint8[25][] memory boards = new uint8[25][](3);
        boards[0] = _ordered();
        boards[1] = _ordered();
        boards[2] = _ordered();
        uint256 id = _createAndCommit(ps, boards);

        // three-way turn rotation, a handful of calls
        for (uint8 nn = 1; nn <= 6; nn++) {
            address who = ps[(nn - 1) % 3];
            vm.prank(who);
            bingo.callNumber(id, nn);
        }
        vm.prank(ps[0]);
        bingo.claimBingo(id);

        // only players 0 and 1 reveal; player2 forfeits
        vm.prank(ps[0]);
        bingo.revealBoard(id, boards[0], _salt(ps[0]));
        vm.prank(ps[1]);
        bingo.revealBoard(id, boards[1], _salt(ps[1]));
        vm.warp(block.timestamp + 2 days);

        bingo.settle(id);

        // players 0 and 1 have identical boards → tie → split the 3-stake pot;
        // player2 (forfeit) gets nothing.
        uint256 total = 3 * uint256(STAKE);
        uint256 fee = (total * FEE_BPS) / 10_000;
        uint256 share = (total - fee) / 2;
        assertEq(bingo.earningsOf(ps[0]), share, "revealer 0 share");
        assertEq(bingo.earningsOf(ps[1]), share, "revealer 1 share");
        assertEq(bingo.earningsOf(ps[2]), 0, "forfeiter nothing");
        _assertPotConserved(ps, total);
    }

    // ── 7. two arenas run concurrently without interfering ───────

    function test_MultiArena_Isolation() public {
        address[] memory a = _players(2);
        uint8[25][] memory ba = new uint8[25][](2);
        ba[0] = _ordered();
        ba[1] = _ordered();
        uint256 id1 = _createAndCommit(a, ba);

        // distinct players for arena 2
        address c1 = makeAddr("c1");
        address c2 = makeAddr("c2");
        vm.deal(c1, 10 ether);
        vm.deal(c2, 10 ether);
        vm.prank(c1);
        uint256 id2 = bingo.createArena(2, STAKE);
        vm.prank(c1);
        bingo.commitBoard{ value: STAKE }(id2, CommitLib.commitment(_ordered(), _salt(c1)));

        // play arena 1 to a call; arena 2 must be untouched
        vm.prank(a[0]);
        bingo.callNumber(id1, 9);
        assertEq(bingo.getArena(id1).callCount, 1);
        assertEq(bingo.getArena(id2).callCount, 0, "arena2 unaffected");
        assertEq(uint8(bingo.getArena(id2).state), uint8(GameState.Created));
        assertEq(bingo.getArena(id2).joinedCount, 1);
        assertEq(address(bingo).balance, 3 * uint256(STAKE)); // 2 + 1 staked
    }
}
