// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// OZ v5: import the full upgradeable suite from the upgradeable package so a
// single Initializable type is inherited (the main package also ships these,
// which would otherwise clash with the upgradeable mixins below).
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import { BingoStorage, CoreStorage } from "./storage/BingoStorage.sol";
import { ZeroAddress, FeeTooHigh, Reentrancy } from "./types/BingoTypes.sol";

/// @title BingoChain
/// @notice Strategic onchain bingo on Celo. Players commit a sealed 5×5 board,
///         call numbers in turn (recorded onchain), then reveal so the winner is
///         verified by replaying the call sequence — cheating is provable.
///
/// @dev UUPS upgradeable (EIP-1822) with EIP-7201 namespaced storage. Upgrade
///      authority is gated to the owner (a Safe multisig on mainnet). The
///      reentrancy guard lives in CoreStorage._locked because OZ v5 dropped
///      ReentrancyGuardUpgradeable. Game logic (commit-reveal, turn engine,
///      payouts) is layered on in subsequent epics.
contract BingoChain is BingoStorage, Initializable, UUPSUpgradeable, Ownable2StepUpgradeable, PausableUpgradeable {
    /// @notice Hard ceiling on the protocol fee (5%). Defends the admin setter
    ///         from ever configuring an abusive fee.
    uint16 public constant MAX_FEE_BPS = 500;

    /// @notice Emitted once when the proxy is initialized.
    event BingoChainInitialized(address indexed owner, address indexed treasury, uint16 protocolFeeBps);

    // ── Modifiers ────────────────────────────────────────────────

    /// @dev Reentrancy guard stored in the EIP-7201 namespace (no slot pollution).
    modifier nonReentrant() {
        CoreStorage storage s = _s();
        if (s._locked) revert Reentrancy();
        s._locked = true;
        _;
        s._locked = false;
    }

    // ── Constructor (implementation only) ────────────────────────

    /// @dev Locks the implementation so it can never be initialized directly;
    ///      only the proxy delegatecall path can.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ── Initializer (proxy) ──────────────────────────────────────

    /// @param owner_           Initial owner (Safe multisig on mainnet).
    /// @param treasury_        Protocol fee recipient.
    /// @param protocolFeeBps_  Protocol fee in basis points (≤ MAX_FEE_BPS).
    function initialize(address owner_, address treasury_, uint16 protocolFeeBps_) external initializer {
        if (owner_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (protocolFeeBps_ > MAX_FEE_BPS) revert FeeTooHigh(protocolFeeBps_);

        // OZ v5: Ownable2StepUpgradeable inherits __Ownable_init(address initialOwner).
        __Ownable_init(owner_);
        __Pausable_init();
        // No __UUPSUpgradeable_init — UUPSUpgradeable is stateless in OZ v5.
        // No reentrancy init — the flag lives in CoreStorage.

        CoreStorage storage s = _s();
        s.treasury = treasury_;
        s.protocolFeeBps = protocolFeeBps_;

        emit BingoChainInitialized(owner_, treasury_, protocolFeeBps_);
    }

    // ── Upgrade authority ────────────────────────────────────────

    /// @dev Restricts upgrades to the owner (Safe multisig on mainnet).
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }

    // ── Views ────────────────────────────────────────────────────

    /// @notice Semantic version of this implementation.
    function version() external pure virtual returns (string memory) {
        return "1.0.0";
    }

    /// @notice Current protocol fee recipient.
    function treasury() external view returns (address) {
        return _s().treasury;
    }

    /// @notice Current protocol fee in basis points.
    function protocolFeeBps() external view returns (uint16) {
        return _s().protocolFeeBps;
    }
}
