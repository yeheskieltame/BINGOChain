// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { BingoChain } from "../src/BingoChain.sol";
import { BingoChainProxy } from "../src/BingoChainProxy.sol";

/// @notice Deploys the BingoChain implementation + ERC-1967 proxy and initializes
///         it atomically. Env: OWNER_ADDRESS, TREASURY_ADDRESS, PROTOCOL_FEE_BPS.
///         On mainnet the owner (a Safe multisig) must differ from the deployer.
contract Deploy is Script {
    function run() external returns (address proxy, address implementation) {
        address owner = vm.envAddress("OWNER_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        uint16 feeBps = uint16(vm.envUint("PROTOCOL_FEE_BPS"));

        if (block.chainid == 42220) {
            require(owner != msg.sender, "Deploy: owner must not be the deployer on mainnet");
        }

        vm.startBroadcast();
        BingoChain impl = new BingoChain();
        bytes memory initData = abi.encodeCall(BingoChain.initialize, (owner, treasury, feeBps));
        BingoChainProxy p = new BingoChainProxy(address(impl), initData);
        vm.stopBroadcast();

        proxy = address(p);
        implementation = address(impl);

        console2.log("Chain id:        ", block.chainid);
        console2.log("Implementation:  ", implementation);
        console2.log("Proxy (BingoChain):", proxy);
        console2.log("Owner:           ", owner);
        console2.log("Treasury:        ", treasury);
        console2.log("Fee bps:         ", feeBps);
    }
}
