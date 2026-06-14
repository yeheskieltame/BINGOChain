// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Arena lifecycle: Created → Committed → Playing → Revealing → Settled,
///         or Created → Cancelled if a lobby never fills.
enum GameState {
    Created,
    Committed,
    Playing,
    Revealing,
    Settled,
    Cancelled
}

error ZeroAddress();
error FeeTooHigh(uint16 bps);
error Reentrancy();
