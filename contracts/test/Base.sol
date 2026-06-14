// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { BingoChain } from "../src/BingoChain.sol";
import { BingoChainProxy } from "../src/BingoChainProxy.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock", "MCK") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Shared deploy + token helpers for the multi-token game tests.
abstract contract Base is Test {
    BingoChain internal bingo;
    MockERC20 internal token;
    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    uint96 internal constant STAKE = 1 ether;

    function _deployBingo(uint16 feeBps) internal {
        BingoChain impl = new BingoChain();
        bytes memory init = abi.encodeCall(BingoChain.initialize, (owner, treasury, feeBps));
        bingo = BingoChain(address(new BingoChainProxy(address(impl), init)));
        token = new MockERC20();
        vm.prank(owner);
        bingo.allowToken(token, STAKE);
    }

    /// @dev Give a player tokens and approve the contract so they can join.
    function _prep(address player) internal {
        token.mint(player, 100 ether);
        vm.prank(player);
        token.approve(address(bingo), type(uint256).max);
    }

    function _create(address creator, uint8 maxPlayers) internal returns (uint256 id) {
        vm.prank(creator);
        id = bingo.createArena(token, maxPlayers, STAKE);
    }

    function _commit(address player, uint256 id, bytes32 c) internal {
        vm.prank(player);
        bingo.commitBoard(id, c);
    }
}
