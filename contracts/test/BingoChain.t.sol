// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { BingoChain } from "../src/BingoChain.sol";
import { BingoChainProxy } from "../src/BingoChainProxy.sol";
import { ZeroAddress, FeeTooHigh } from "../src/types/BingoTypes.sol";

/// @dev Minimal V2 used only to prove the UUPS upgrade path is wired and gated.
contract BingoChainV2Mock is BingoChain {
    function version() external pure override returns (string memory) {
        return "2.0.0";
    }
}

/// @notice Scaffold smoke tests: proxy init, double-init protection, fee/owner
///         validation, and owner-gated UUPS upgrades. Game-logic tests arrive
///         with their respective epics.
contract BingoChainTest is Test {
    BingoChain internal bingo;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal stranger = makeAddr("stranger");
    uint16 internal constant FEE_BPS = 100; // 1%

    function setUp() public {
        BingoChain impl = new BingoChain();
        bytes memory initData = abi.encodeCall(BingoChain.initialize, (owner, treasury, FEE_BPS));
        BingoChainProxy proxy = new BingoChainProxy(address(impl), initData);
        bingo = BingoChain(address(proxy));
    }

    function test_InitializesState() public view {
        assertEq(bingo.owner(), owner, "owner");
        assertEq(bingo.treasury(), treasury, "treasury");
        assertEq(bingo.protocolFeeBps(), FEE_BPS, "fee");
        assertEq(bingo.version(), "1.2.0", "version");
    }

    function test_ImplementationIsLocked() public {
        BingoChain impl = new BingoChain();
        vm.expectRevert();
        impl.initialize(owner, treasury, FEE_BPS);
    }

    function test_CannotInitializeTwice() public {
        vm.expectRevert();
        bingo.initialize(owner, treasury, FEE_BPS);
    }

    function test_RevertWhen_ZeroOwner() public {
        BingoChain impl = new BingoChain();
        bytes memory initData = abi.encodeCall(BingoChain.initialize, (address(0), treasury, FEE_BPS));
        vm.expectRevert(ZeroAddress.selector);
        new BingoChainProxy(address(impl), initData);
    }

    function test_RevertWhen_FeeTooHigh() public {
        BingoChain impl = new BingoChain();
        uint16 badFee = bingo.MAX_FEE_BPS() + 1;
        bytes memory initData = abi.encodeCall(BingoChain.initialize, (owner, treasury, badFee));
        vm.expectRevert(abi.encodeWithSelector(FeeTooHigh.selector, badFee));
        new BingoChainProxy(address(impl), initData);
    }

    function test_OwnerCanUpgrade() public {
        BingoChainV2Mock v2 = new BingoChainV2Mock();
        vm.prank(owner);
        bingo.upgradeToAndCall(address(v2), "");
        assertEq(bingo.version(), "2.0.0", "upgraded version");
    }

    function test_RevertWhen_StrangerUpgrades() public {
        BingoChainV2Mock v2 = new BingoChainV2Mock();
        vm.prank(stranger);
        vm.expectRevert();
        bingo.upgradeToAndCall(address(v2), "");
    }
}
