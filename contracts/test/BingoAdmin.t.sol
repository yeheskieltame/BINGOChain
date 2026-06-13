// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { BingoChain } from "../src/BingoChain.sol";
import { BingoChainProxy } from "../src/BingoChainProxy.sol";
import { FeeTooHigh, ZeroAddress } from "../src/types/BingoTypes.sol";
import { NothingToWithdraw } from "../src/types/GameTypes.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock", "MCK") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract BingoAdminTest is Test {
    BingoChain internal bingo;
    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        BingoChain impl = new BingoChain();
        bytes memory initData = abi.encodeCall(BingoChain.initialize, (owner, treasury, 100));
        bingo = BingoChain(address(new BingoChainProxy(address(impl), initData)));
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

    function test_RevertWhen_NonOwnerSetsTreasury() public {
        vm.prank(stranger);
        vm.expectRevert();
        bingo.setTreasury(stranger);
    }

    // ── pause / unpause ──────────────────────────────────────────

    function test_PauseBlocksGameButNotWithdraw() public {
        vm.prank(owner);
        bingo.pause();

        // game entry is blocked
        vm.expectRevert();
        bingo.createArena(2, 1 ether);

        // withdraw is NOT pause-gated: it reverts on empty balance, not on pause
        vm.prank(stranger);
        vm.expectRevert(NothingToWithdraw.selector);
        bingo.withdraw();

        vm.prank(owner);
        bingo.unpause();
        // works again after unpause
        vm.prank(stranger);
        vm.deal(stranger, 1 ether);
        bingo.createArena(2, 1 ether);
    }

    function test_RevertWhen_NonOwnerPauses() public {
        vm.prank(stranger);
        vm.expectRevert();
        bingo.pause();
    }

    // ── rescueERC20 ──────────────────────────────────────────────

    function test_OwnerRescuesStrayERC20() public {
        MockERC20 tkn = new MockERC20();
        tkn.mint(address(bingo), 1000e18);

        vm.prank(owner);
        bingo.rescueERC20(tkn, owner, 1000e18);
        assertEq(tkn.balanceOf(owner), 1000e18);
        assertEq(tkn.balanceOf(address(bingo)), 0);
    }

    function test_RevertWhen_NonOwnerRescues() public {
        MockERC20 tkn = new MockERC20();
        tkn.mint(address(bingo), 1000e18);
        vm.prank(stranger);
        vm.expectRevert();
        bingo.rescueERC20(tkn, stranger, 1000e18);
    }
}
