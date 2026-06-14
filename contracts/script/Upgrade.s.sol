// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { BingoChain } from "../src/BingoChain.sol";

/// @notice Deploys a fresh implementation and points an existing proxy at it via
///         UUPS upgradeToAndCall. Env: PROXY. The broadcasting key must be the
///         proxy owner (on mainnet the owner is a Safe, so submit via the Safe).
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
