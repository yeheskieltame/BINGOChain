// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Base, MockERC20 } from "./Base.sol";
import { FeeTooHigh, ZeroAddress } from "../src/types/BingoTypes.sol";
import { NothingToWithdraw, CannotRescueGameToken } from "../src/types/GameTypes.sol";

contract BingoAdminTest is Base {
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        _deployBingo(100);
    }

    // ── setProtocolFee ───────────────────────────────────────────

    function test_OwnerSetsFee() public {
        vm.prank(owner);
        bingo.setProtocolFee(250);
        assertEq(bingo.protocolFeeBps(), 250);
    }

    function test_RevertWhen_FeeAboveMax() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(FeeTooHigh.selector, uint16(501)));
        bingo.setProtocolFee(501);
    }

    function test_RevertWhen_NonOwnerSetsFee() public {
        vm.prank(stranger);
        vm.expectRevert();
        bingo.setProtocolFee(250);
    }

    // ── setTreasury ──────────────────────────────────────────────

    function test_OwnerSetsTreasury() public {
        address nt = makeAddr("newTreasury");
        vm.prank(owner);
        bingo.setTreasury(nt);
        assertEq(bingo.treasury(), nt);
    }

    function test_RevertWhen_TreasuryZero() public {
        vm.prank(owner);
        vm.expectRevert(ZeroAddress.selector);
        bingo.setTreasury(address(0));
    }

    // ── allowToken ───────────────────────────────────────────────

    function test_OwnerAllowsToken() public {
        MockERC20 t2 = new MockERC20();
        vm.prank(owner);
        bingo.allowToken(t2, 5 ether);
        assertTrue(bingo.isTokenAllowed(t2));
        assertEq(bingo.minStake(t2), 5 ether);
    }

    function test_RevertWhen_NonOwnerAllowsToken() public {
        MockERC20 t2 = new MockERC20();
        vm.prank(stranger);
        vm.expectRevert();
        bingo.allowToken(t2, 1 ether);
    }

    // ── pause ────────────────────────────────────────────────────

    function test_PauseBlocksGameButNotWithdraw() public {
        vm.prank(owner);
        bingo.pause();

        vm.expectRevert();
        bingo.createArena(token, 2, STAKE);

        // withdraw is not pause-gated: reverts on empty balance, not on pause
        vm.prank(stranger);
        vm.expectRevert(NothingToWithdraw.selector);
        bingo.withdraw(token);

        vm.prank(owner);
        bingo.unpause();
        vm.prank(stranger);
        bingo.createArena(token, 2, STAKE);
    }

    function test_RevertWhen_NonOwnerPauses() public {
        vm.prank(stranger);
        vm.expectRevert();
        bingo.pause();
    }

    // ── rescueERC20 ──────────────────────────────────────────────

    function test_OwnerRescuesStrayToken() public {
        MockERC20 stray = new MockERC20(); // not whitelisted
        stray.mint(address(bingo), 1000e18);
        vm.prank(owner);
        bingo.rescueERC20(stray, owner, 1000e18);
        assertEq(stray.balanceOf(owner), 1000e18);
    }

    function test_RevertWhen_RescueGameToken() public {
        token.mint(address(bingo), 1000e18); // `token` is whitelisted (escrow)
        vm.prank(owner);
        vm.expectRevert(CannotRescueGameToken.selector);
        bingo.rescueERC20(token, owner, 1000e18);
    }

    function test_RevertWhen_NonOwnerRescues() public {
        MockERC20 stray = new MockERC20();
        stray.mint(address(bingo), 1000e18);
        vm.prank(stranger);
        vm.expectRevert();
        bingo.rescueERC20(stray, stranger, 1000e18);
    }
}
