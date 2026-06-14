// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { MockERC20 } from "./Base.sol";
import { BingoChain } from "../src/BingoChain.sol";
import { BingoChainProxy } from "../src/BingoChainProxy.sol";
import { CommitLib } from "../src/libraries/CommitLib.sol";
import { GameState } from "../src/types/BingoTypes.sol";

/// @notice Drives random full-lifecycle play across actors/arenas. Ghost vars track
///         token net flow so the invariants can prove no tokens are created or lost.
contract BingoHandler is Test {
    BingoChain public bingo;
    MockERC20 public token;
    address public treasury;

    address[4] public actors;
    bytes32[4] public salts;
    uint256[] public arenas;
    uint96 internal constant STAKE = 1 ether;

    uint256 public totalIn;
    uint256 public totalOut;

    mapping(uint256 => mapping(address => bool)) public joined;
    mapping(uint256 => mapping(address => bool)) public revealed;

    constructor(BingoChain _bingo, MockERC20 _token, address _treasury) {
        bingo = _bingo;
        token = _token;
        treasury = _treasury;
        for (uint256 i = 0; i < 4; i++) {
            actors[i] = makeAddr(string(abi.encodePacked("inv-actor", vm.toString(i))));
            salts[i] = keccak256(abi.encode("inv-salt", i));
            token.mint(actors[i], 1_000_000 ether);
            vm.prank(actors[i]);
            token.approve(address(bingo), type(uint256).max);
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

    function createArena(uint256 seed) public {
        if (arenas.length >= 4) return;
        uint8 maxP = uint8(bound(seed, 2, 4));
        vm.prank(actors[seed % 4]);
        arenas.push(bingo.createArena(token, maxP, STAKE));
    }

    function commitBoard(uint256 arenaSeed, uint256 actorSeed) public {
        if (arenas.length == 0) return;
        uint256 id = arenas[arenaSeed % arenas.length];
        if (uint8(bingo.getArena(id).state) != uint8(GameState.Created)) return;
        if (bingo.getArena(id).joinedCount >= bingo.getArena(id).maxPlayers) return;
        address actor = actors[actorSeed % 4];
        if (joined[id][actor]) return;

        joined[id][actor] = true;
        totalIn += STAKE;
        vm.prank(actor);
        bingo.commitBoard(id, CommitLib.commitment(_board(), salts[actorSeed % 4]));
    }

    function callNumber(uint256 arenaSeed, uint256 numSeed) public {
        if (arenas.length == 0) return;
        uint256 id = arenas[arenaSeed % arenas.length];
        uint8 st = uint8(bingo.getArena(id).state);
        if (st != uint8(GameState.Committed) && st != uint8(GameState.Playing)) return;
        address[] memory ps = bingo.getPlayers(id);
        if (ps.length == 0) return;
        address turnPlayer = ps[bingo.getArena(id).turnIndex];
        uint32 mask = bingo.getArena(id).calledMask;

        uint8 start = uint8(bound(numSeed, 1, 25));
        uint8 number;
        for (uint8 d = 0; d < 25; d++) {
            uint8 cand = uint8(((start - 1 + d) % 25) + 1);
            if ((mask & (uint32(1) << (cand - 1))) == 0) {
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
        if (uint8(bingo.getArena(id).state) != uint8(GameState.Playing)) return;
        address actor = actors[actorSeed % 4];
        if (!joined[id][actor]) return;
        vm.prank(actor);
        bingo.claimBingo(id);
    }

    function revealBoard(uint256 arenaSeed, uint256 actorSeed) public {
        if (arenas.length == 0) return;
        uint256 id = arenas[arenaSeed % arenas.length];
        if (uint8(bingo.getArena(id).state) != uint8(GameState.Revealing)) return;
        if (block.timestamp > bingo.getArena(id).revealDeadline) return;
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
        if (uint8(bingo.getArena(id).state) != uint8(GameState.Revealing)) return;
        if (closeWindow && block.timestamp <= bingo.getArena(id).revealDeadline) {
            vm.warp(uint256(bingo.getArena(id).revealDeadline) + 1);
        }
        try bingo.settle(id) { } catch { }
    }

    function withdraw(uint256 actorSeed) public {
        address actor = actors[actorSeed % 4];
        uint256 owed = bingo.earningsOf(actor, token);
        if (owed == 0) return;
        totalOut += owed;
        vm.prank(actor);
        bingo.withdraw(token);
    }

    function withdrawTreasury() public {
        uint256 owed = bingo.earningsOf(treasury, token);
        if (owed == 0) return;
        totalOut += owed;
        vm.prank(treasury);
        bingo.withdraw(token);
    }
}

contract BingoInvariantTest is Test {
    BingoChain internal bingo;
    MockERC20 internal token;
    BingoHandler internal handler;
    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");

    function setUp() public {
        BingoChain impl = new BingoChain();
        bingo = BingoChain(
            address(new BingoChainProxy(address(impl), abi.encodeCall(BingoChain.initialize, (owner, treasury, 100))))
        );
        token = new MockERC20();
        vm.prank(owner);
        bingo.allowToken(token, 1 ether);
        handler = new BingoHandler(bingo, token, treasury);
        targetContract(address(handler));
    }

    /// @dev Contract token balance == net flow — no tokens minted or burned by the game.
    function invariant_balanceEqualsNetFlow() public view {
        assertEq(token.balanceOf(address(bingo)), handler.totalIn() - handler.totalOut());
    }

    /// @dev Credited earnings never exceed the held balance (settle never over-credits).
    function invariant_sumEarningsWithinBalance() public view {
        address[4] memory actors = handler.actorList();
        uint256 sum = bingo.earningsOf(treasury, token);
        for (uint256 i = 0; i < 4; i++) {
            sum += bingo.earningsOf(actors[i], token);
        }
        assertLe(sum, token.balanceOf(address(bingo)));
    }
}
