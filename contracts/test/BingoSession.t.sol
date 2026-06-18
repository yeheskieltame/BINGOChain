// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Base } from "./Base.sol";
import { NotYourTurn, SessionKeyInUse } from "../src/types/GameTypes.sol";
import { CommitLib } from "../src/libraries/CommitLib.sol";

/// Session keys: a player authorizes an agent key that acts for them in gameplay
/// (callNumber / claimBingo / revealBoard) so a client can auto-sign turns with no
/// wallet popup. The agent can never join, withdraw, or act for another player.
contract BingoSessionTest is Base {
    address internal playerA = makeAddr("playerA");
    address internal playerB = makeAddr("playerB");
    address internal sessionA = makeAddr("sessionA");
    address internal sessionB = makeAddr("sessionB");

    bytes32 internal saltA = keccak256("A");
    bytes32 internal saltB = keccak256("B");

    function setUp() public {
        _deployBingo(200);
        _prep(playerA);
        _prep(playerB);
    }

    function _board() internal pure returns (uint8[25] memory b) {
        for (uint8 i = 0; i < 25; i++) {
            b[i] = i + 1;
        }
    }

    /// 2-player arena with both joined (Committed). Boards committed for reveal.
    function _joined() internal returns (uint256 id) {
        id = _create(playerA, 2);
        _commit(playerA, id, CommitLib.commitment(_board(), saltA));
        _commit(playerB, id, CommitLib.commitment(_board(), saltB));
    }

    function test_SetAndGetSessionKey() public {
        vm.prank(playerA);
        bingo.setSessionKey(sessionA);
        assertEq(bingo.sessionKeyOf(playerA), sessionA, "session set");
    }

    function test_SessionKeyCallsForPlayer() public {
        uint256 id = _joined();
        vm.prank(playerA);
        bingo.setSessionKey(sessionA);

        // turnIndex 0 == playerA; the session key calls for A (no A signature).
        vm.prank(sessionA);
        bingo.callNumber(id, 7);

        assertEq(bingo.getCallSequence(id).length, 1, "call recorded");
        assertEq(bingo.getArena(id).turnIndex, 1, "turn advanced to B");
    }

    function test_RevertWhen_SessionKeyPlaysOutOfTurn() public {
        uint256 id = _joined();
        vm.prank(playerB);
        bingo.setSessionKey(sessionB);

        // turn 0 is A, but sessionB acts for B — not B's turn.
        vm.prank(sessionB);
        vm.expectRevert(NotYourTurn.selector);
        bingo.callNumber(id, 7);
    }

    function test_RevertWhen_SessionKeyInUse() public {
        vm.prank(playerA);
        bingo.setSessionKey(sessionA);
        vm.prank(playerB);
        vm.expectRevert(SessionKeyInUse.selector);
        bingo.setSessionKey(sessionA);
    }

    function test_SessionKeyRevealsForPlayer() public {
        uint256 id = _joined();
        vm.prank(playerA);
        bingo.setSessionKey(sessionA);

        vm.prank(sessionA);
        bingo.callNumber(id, 1); // Committed -> Playing, turn -> B
        vm.prank(playerB);
        bingo.claimBingo(id); // -> Revealing (winner decided at settle)

        vm.prank(sessionA);
        bingo.revealBoard(id, _board(), saltA);

        assertTrue(bingo.hasRevealed(id, playerA), "revealed for player");
        assertFalse(bingo.hasRevealed(id, sessionA), "not for the session key");
    }

    function test_DirectPlayStillWorks() public {
        uint256 id = _joined();
        vm.prank(playerA); // no session key — plays directly
        bingo.callNumber(id, 9);
        assertEq(bingo.getCallSequence(id).length, 1, "direct call works");
    }

    function test_RevokeSessionKey() public {
        uint256 id = _joined();
        vm.prank(playerA);
        bingo.setSessionKey(sessionA);
        vm.prank(playerA);
        bingo.setSessionKey(address(0));
        assertEq(bingo.sessionKeyOf(playerA), address(0), "revoked");

        // sessionA is no longer an agent, so it isn't A and can't take A's turn.
        vm.prank(sessionA);
        vm.expectRevert(NotYourTurn.selector);
        bingo.callNumber(id, 7);
    }
}
