// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { BingoChain } from "../src/BingoChain.sol";
import { BingoChainProxy } from "../src/BingoChainProxy.sol";
import { CommitLib } from "../src/libraries/CommitLib.sol";
import { GameState } from "../src/types/BingoTypes.sol";
import { Arena } from "../src/types/GameTypes.sol";

/// @notice Drives random sequences of the full game lifecycle across several
///         actors and arenas. All deposits flow from this handler; ghost vars
///         track net flow so the invariants can prove no CELO is created or lost.
contract BingoHandler is Test {
    BingoChain public bingo;
    address public treasury;

    address[4] public actors;
    bytes32[4] public salts;
    uint256[] public arenas;

    uint96 internal constant STAKE = 1 ether;

    uint256 public totalIn; // CELO deposited via commitBoard
    uint256 public totalOut; // CELO paid out via withdraw

    mapping(uint256 => mapping(address => bool)) public joined;
    mapping(uint256 => mapping(address => bool)) public revealed;

    constructor(BingoChain _bingo, address _treasury) {
        bingo = _bingo;
        treasury = _treasury;
        for (uint256 i = 0; i < 4; i++) {
            actors[i] = makeAddr(string(abi.encodePacked("inv-actor", vm.toString(i))));
            salts[i] = keccak256(abi.encode("inv-salt", i));
            vm.deal(actors[i], 1_000_000 ether); // players fund their own stakes
        }
    }

    function _board() internal pure returns (uint8[25] memory b) {
        for (uint256 i = 0; i < 25; i++) {
            b[i] = uint8(i + 1);
        }
    }

    function actorList() external view returns (address[4] memory) {
        return actors;
    }

    // ── actions driven by the fuzzer ─────────────────────────────

    function createArena(uint256 seed) public {
        if (arenas.length >= 4) return; // keep the set small so games actually fill & settle
        uint8 maxP = uint8(bound(seed, 2, 4));
        address creator = actors[seed % 4];
        vm.prank(creator);
        arenas.push(bingo.createArena(maxP, STAKE));
    }

    function commitBoard(uint256 arenaSeed, uint256 actorSeed) public {
        if (arenas.length == 0) return;
        uint256 id = arenas[arenaSeed % arenas.length];
        Arena memory a = bingo.getArena(id);
        if (a.state != GameState.Created || a.joinedCount >= a.maxPlayers) return;
        address actor = actors[actorSeed % 4];
        if (joined[id][actor]) return;

        joined[id][actor] = true;
        totalIn += STAKE;
        vm.prank(actor);
        bingo.commitBoard{ value: STAKE }(id, CommitLib.commitment(_board(), salts[actorSeed % 4]));
    }

    function callNumber(uint256 arenaSeed, uint256 numSeed) public {
        if (arenas.length == 0) return;
        uint256 id = arenas[arenaSeed % arenas.length];
        Arena memory a = bingo.getArena(id);
        if (a.state != GameState.Committed && a.state != GameState.Playing) return;
        address[] memory ps = bingo.getPlayers(id);
        if (ps.length == 0) return;
        address turnPlayer = ps[a.turnIndex];

        // pick a number 1..25 not yet called
        uint8 start = uint8(bound(numSeed, 1, 25));
        uint8 number;
        for (uint8 d = 0; d < 25; d++) {
            uint8 cand = uint8(((start - 1 + d) % 25) + 1);
            if ((a.calledMask & (uint32(1) << (cand - 1))) == 0) {
                number = cand;
                break;
            }
        }
        if (number == 0) return;

        vm.prank(turnPlayer);
        bingo.callNumber(id, number);
    }

    function claimBingo(uint256 arenaSeed, uint256 actorSeed) public {
        if (arenas.length == 0) return;
        uint256 id = arenas[arenaSeed % arenas.length];
        Arena memory a = bingo.getArena(id);
        if (a.state != GameState.Playing) return;
        address actor = actors[actorSeed % 4];
        if (!joined[id][actor]) return;
        vm.prank(actor);
        bingo.claimBingo(id);
    }

    function revealBoard(uint256 arenaSeed, uint256 actorSeed) public {
        if (arenas.length == 0) return;
        uint256 id = arenas[arenaSeed % arenas.length];
        Arena memory a = bingo.getArena(id);
        if (a.state != GameState.Revealing || block.timestamp > a.revealDeadline) return;
        uint256 ai = actorSeed % 4;
        address actor = actors[ai];
        if (!joined[id][actor] || revealed[id][actor]) return;
        revealed[id][actor] = true;
        vm.prank(actor);
        bingo.revealBoard(id, _board(), salts[ai]);
    }

    function settle(uint256 arenaSeed, bool closeWindow) public {
        if (arenas.length == 0) return;
        uint256 id = arenas[arenaSeed % arenas.length];
        Arena memory a = bingo.getArena(id);
        if (a.state != GameState.Revealing) return;
        if (closeWindow && block.timestamp <= a.revealDeadline) {
            vm.warp(uint256(a.revealDeadline) + 1);
        }
        try bingo.settle(id) { } catch { }
    }

    function withdraw(uint256 actorSeed) public {
        address actor = actors[actorSeed % 4];
        uint256 owed = bingo.earningsOf(actor);
        if (owed == 0) return;
        totalOut += owed;
        vm.prank(actor);
        bingo.withdraw();
    }

    function withdrawTreasury() public {
        uint256 owed = bingo.earningsOf(treasury);
        if (owed == 0) return;
        totalOut += owed;
        vm.prank(treasury);
        bingo.withdraw();
    }
}

/// @notice Money-conservation invariants over random full-lifecycle play.
contract BingoInvariantTest is Test {
    BingoChain internal bingo;
    BingoHandler internal handler;
    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");

    function setUp() public {
        BingoChain impl = new BingoChain();
        bytes memory initData = abi.encodeCall(BingoChain.initialize, (owner, treasury, 100));
        bingo = BingoChain(address(new BingoChainProxy(address(impl), initData)));
        handler = new BingoHandler(bingo, treasury);
        targetContract(address(handler));
    }

    /// @dev The contract's CELO balance is exactly what flowed in minus what
    ///      flowed out — no CELO is ever minted or burned by the game logic.
    function invariant_balanceEqualsNetFlow() public view {
        assertEq(address(bingo).balance, handler.totalIn() - handler.totalOut());
    }

    /// @dev Credited-but-unwithdrawn earnings can never exceed the held balance,
    ///      so withdrawals can always be honored (settle never over-credits).
    function invariant_sumEarningsWithinBalance() public view {
        address[4] memory actors = handler.actorList();
        uint256 sum = bingo.earningsOf(treasury);
        for (uint256 i = 0; i < 4; i++) {
            sum += bingo.earningsOf(actors[i]);
        }
        assertLe(sum, address(bingo).balance);
    }
}
