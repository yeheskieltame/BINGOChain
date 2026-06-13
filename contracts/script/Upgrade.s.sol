// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { BingoChain } from "../src/BingoChain.sol";

/// @notice Deploys a fresh BingoChain implementation and points an existing proxy
///         at it via UUPS `upgradeToAndCall`. Storage is EIP-7201 namespaced and
///         append-only, so no migration data is needed.
///
/// Required env vars:
///   PROXY  the deployed BingoChainProxy address
///
/// The broadcasting key must be the proxy owner (a Safe multisig on mainnet, so
/// there the call is submitted through the Safe rather than this script).
contract Upgrade is Script {
    function run() external returns (address newImplementation) {
        address proxy = vm.envAddress("PROXY");

        vm.startBroadcast();
        BingoChain impl = new BingoChain();
        BingoChain(proxy).upgradeToAndCall(address(impl), "");
        vm.stopBroadcast();

        newImplementation = address(impl);
        console2.log("Proxy:            ", proxy);
        console2.log("New implementation:", newImplementation);
        console2.log("Version:          ", BingoChain(proxy).version());
    }
}
