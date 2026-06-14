// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { BingoStorage, CoreStorage } from "./storage/BingoStorage.sol";
import { GameState, ZeroAddress, FeeTooHigh, Reentrancy } from "./types/BingoTypes.sol";
import {
    Arena,
    ArenaNotFound,
    WrongState,
    InvalidPlayerCount,
    StakeTooLow,
    IncorrectStake,
    AlreadyJoined,
    ArenaFull,
    NotAPlayer,
    NotYourTurn,
    NumberOutOfRange,
    NumberAlreadyCalled,
    CommitMismatch,
    AlreadyRevealed,
    RevealWindowClosed,
    RevealWindowOpen,
    InvalidBoard,
    NothingToWithdraw,
    TransferFailed,
    CancelNotAllowed
} from "./types/GameTypes.sol";
import { CommitLib } from "./libraries/CommitLib.sol";
import { BoardLib } from "./libraries/BoardLib.sol";
import { LineLib } from "./libraries/LineLib.sol";

/// @title BingoChain
/// @notice Strategic onchain bingo on Celo: players commit a sealed 5x5 board, call
///         numbers in turn, then reveal so the winner is verified by replaying the
///         recorded calls. UUPS upgradeable with EIP-7201 namespaced storage.
contract BingoChain is BingoStorage, Initializable, UUPSUpgradeable, Ownable2StepUpgradeable, PausableUpgradeable {
    using SafeERC20 for IERC20;

    uint16 public constant MAX_FEE_BPS = 500;
    uint8 public constant MIN_PLAYERS = 2;
    uint8 public constant MAX_PLAYERS = 6;
    uint256 public constant MIN_STAKE = 1 ether;
    uint8 public constant MAX_NUMBER = 25;
    uint64 public constant REVEAL_WINDOW = 1 days;
    uint64 public constant JOIN_WINDOW = 1 days;

    event BingoChainInitialized(address indexed owner, address indexed treasury, uint16 protocolFeeBps);
    event ArenaCreated(uint256 indexed arenaId, address indexed creator, uint96 stake, uint8 maxPlayers);
    event PlayerJoined(uint256 indexed arenaId, address indexed player, uint8 joinedCount);
    event GameReady(uint256 indexed arenaId);
    event ArenaCancelled(uint256 indexed arenaId, uint8 refunded);
    event NumberCalled(uint256 indexed arenaId, address indexed caller, uint8 number, uint8 callIndex);
    event RevealPhaseStarted(uint256 indexed arenaId, uint64 revealDeadline);
    event BingoClaimed(uint256 indexed arenaId, address indexed claimer, uint8 atCallIndex);
    event BoardRevealed(uint256 indexed arenaId, address indexed player);
    event ArenaSettled(uint256 indexed arenaId, uint256 prizePool, uint256 fee, uint8 winnerCount);
    event WinnerPaid(uint256 indexed arenaId, address indexed winner, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event ProtocolFeeUpdated(uint16 oldBps, uint16 newBps);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event ERC20Rescued(address indexed token, address indexed to, uint256 amount);

    /// @dev Reentrancy guard flag lives in namespaced storage (OZ v5 dropped the upgradeable guard).
    modifier nonReentrant() {
        CoreStorage storage s = _s();
        if (s._locked) revert Reentrancy();
        s._locked = true;
        _;
        s._locked = false;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the proxy. `owner_` is a Safe multisig on mainnet.
    function initialize(address owner_, address treasury_, uint16 protocolFeeBps_) external initializer {
        if (owner_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (protocolFeeBps_ > MAX_FEE_BPS) revert FeeTooHigh(protocolFeeBps_);

        __Ownable_init(owner_);
        __Pausable_init();

        CoreStorage storage s = _s();
        s.treasury = treasury_;
        s.protocolFeeBps = protocolFeeBps_;

        emit BingoChainInitialized(owner_, treasury_, protocolFeeBps_);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }

    /// @notice Open a new arena. The creator joins separately via {commitBoard}.
    /// @param maxPlayers Seats (MIN_PLAYERS..MAX_PLAYERS).
    /// @param stake Entry stake per player in wei (>= MIN_STAKE).
    function createArena(uint8 maxPlayers, uint96 stake) external whenNotPaused returns (uint256 arenaId) {
        if (maxPlayers < MIN_PLAYERS || maxPlayers > MAX_PLAYERS) revert InvalidPlayerCount(maxPlayers);
        if (stake < MIN_STAKE) revert StakeTooLow(stake, MIN_STAKE);

        CoreStorage storage s = _s();
        arenaId = ++s.arenaCount;
        Arena storage a = s.arenas[arenaId];
        a.creator = msg.sender;
        a.stake = stake;
        a.maxPlayers = maxPlayers;
        a.state = GameState.Created;
        a.createdAt = uint64(block.timestamp);

        emit ArenaCreated(arenaId, msg.sender, stake, maxPlayers);
    }

    /// @notice Join an arena with the exact stake and a sealed board commitment.
    ///         Seals the arena once full.
    /// @param boardCommitment keccak256(abi.encode(board, salt)) — see CommitLib.
    function commitBoard(uint256 arenaId, bytes32 boardCommitment) external payable whenNotPaused nonReentrant {
        CoreStorage storage s = _s();
        Arena storage a = s.arenas[arenaId];

        if (a.creator == address(0)) revert ArenaNotFound(arenaId);
        if (a.state != GameState.Created) revert WrongState(arenaId, GameState.Created, a.state);
        if (s.hasJoined[arenaId][msg.sender]) revert AlreadyJoined();
        if (a.joinedCount >= a.maxPlayers) revert ArenaFull();
        if (msg.value != a.stake) revert IncorrectStake(msg.value, a.stake);

        s.hasJoined[arenaId][msg.sender] = true;
        s.boardCommit[arenaId][msg.sender] = boardCommitment;
        s.arenaPlayers[arenaId].push(msg.sender);
        unchecked {
            a.joinedCount += 1;
        }

        emit PlayerJoined(arenaId, msg.sender, a.joinedCount);

        if (a.joinedCount == a.maxPlayers) {
            a.state = GameState.Committed;
            emit GameReady(arenaId);
        }
    }

    /// @notice Cancel an unfilled (Created) lobby and refund every joined player.
    ///         The creator may cancel anytime; anyone may cancel after JOIN_WINDOW.
    function cancelArena(uint256 arenaId) external nonReentrant {
        CoreStorage storage s = _s();
        Arena storage a = s.arenas[arenaId];
        if (a.creator == address(0)) revert ArenaNotFound(arenaId);
        if (a.state != GameState.Created) revert WrongState(arenaId, GameState.Created, a.state);
        if (msg.sender != a.creator && block.timestamp <= uint256(a.createdAt) + JOIN_WINDOW) {
            revert CancelNotAllowed();
        }

        a.state = GameState.Cancelled;

        address[] memory players = s.arenaPlayers[arenaId];
        uint256 stake = a.stake;
        for (uint256 i = 0; i < players.length; i++) {
            s.earnings[players[i]] += stake;
        }

        emit ArenaCancelled(arenaId, uint8(players.length));
    }

    /// @notice Call a number on your turn; each of 1..25 may be called once.
    ///         The first call opens play; the 25th opens the reveal phase.
    function callNumber(uint256 arenaId, uint8 number) external whenNotPaused nonReentrant {
        CoreStorage storage s = _s();
        Arena storage a = s.arenas[arenaId];
        if (a.creator == address(0)) revert ArenaNotFound(arenaId);

        if (a.state == GameState.Committed) {
            a.state = GameState.Playing;
        }
        if (a.state != GameState.Playing) revert WrongState(arenaId, GameState.Playing, a.state);

        if (number < 1 || number > MAX_NUMBER) revert NumberOutOfRange(number);
        uint32 bit = uint32(1) << (number - 1);
        if ((a.calledMask & bit) != 0) revert NumberAlreadyCalled(number);

        address[] storage players = s.arenaPlayers[arenaId];
        if (msg.sender != players[a.turnIndex]) revert NotYourTurn();

        a.calledMask |= bit;
        s.callSequence[arenaId].push(number);
        uint8 callIndex = a.callCount;
        unchecked {
            a.callCount += 1;
            a.turnIndex = uint8((uint256(a.turnIndex) + 1) % players.length);
        }

        emit NumberCalled(arenaId, msg.sender, number, callIndex);

        if (a.callCount == MAX_NUMBER) {
            a.state = GameState.Revealing;
            a.revealDeadline = uint64(block.timestamp) + REVEAL_WINDOW;
            emit RevealPhaseStarted(arenaId, a.revealDeadline);
        }
    }

    /// @notice Claim BINGO to freeze the call sequence and open the reveal phase.
    ///         The winner is decided by replay in {settle}, so a false claim cannot win.
    function claimBingo(uint256 arenaId) external whenNotPaused nonReentrant {
        CoreStorage storage s = _s();
        Arena storage a = s.arenas[arenaId];
        if (a.creator == address(0)) revert ArenaNotFound(arenaId);
        if (a.state != GameState.Playing) revert WrongState(arenaId, GameState.Playing, a.state);
        if (!s.hasJoined[arenaId][msg.sender]) revert NotAPlayer();

        a.state = GameState.Revealing;
        a.revealDeadline = uint64(block.timestamp) + REVEAL_WINDOW;

        emit BingoClaimed(arenaId, msg.sender, a.callCount);
        emit RevealPhaseStarted(arenaId, a.revealDeadline);
    }

    /// @notice Reveal your board; it must hash to your commitment and be a valid
    ///         permutation of 1..25, within the reveal window.
    function revealBoard(uint256 arenaId, uint8[25] calldata board, bytes32 salt) external whenNotPaused nonReentrant {
        CoreStorage storage s = _s();
        Arena storage a = s.arenas[arenaId];
        if (a.creator == address(0)) revert ArenaNotFound(arenaId);
        if (a.state != GameState.Revealing) revert WrongState(arenaId, GameState.Revealing, a.state);
        if (block.timestamp > a.revealDeadline) revert RevealWindowClosed();
        if (!s.hasJoined[arenaId][msg.sender]) revert NotAPlayer();
        if (s.hasRevealed[arenaId][msg.sender]) revert AlreadyRevealed();
        if (!CommitLib.verify(s.boardCommit[arenaId][msg.sender], board, salt)) revert CommitMismatch();
        if (!BoardLib.isValid(board)) revert InvalidBoard();

        s.revealedBoard[arenaId][msg.sender] = board;
        s.hasRevealed[arenaId][msg.sender] = true;

        emit BoardRevealed(arenaId, msg.sender);
    }

    /// @notice Settle an arena and split the prize. Callable once the reveal window
    ///         closes, or earlier if every player has revealed. Non-revealers forfeit.
    function settle(uint256 arenaId) external whenNotPaused nonReentrant {
        CoreStorage storage s = _s();
        Arena storage a = s.arenas[arenaId];
        if (a.creator == address(0)) revert ArenaNotFound(arenaId);
        if (a.state != GameState.Revealing) revert WrongState(arenaId, GameState.Revealing, a.state);

        address[] memory players = s.arenaPlayers[arenaId];
        uint256 n = players.length;

        (bool[] memory isWinner, uint256 winnerCount, uint256 revealedCount) = _resolveWinners(arenaId);

        if (block.timestamp <= a.revealDeadline && revealedCount != n) revert RevealWindowOpen();

        a.state = GameState.Settled;

        uint256 totalStake = uint256(a.stake) * n;
        uint256 fee = (totalStake * s.protocolFeeBps) / 10_000;
        uint256 prizePool = totalStake - fee;

        if (winnerCount == 0) {
            s.earnings[s.treasury] += totalStake;
            emit ArenaSettled(arenaId, 0, totalStake, 0);
            return;
        }

        uint256 share = prizePool / winnerCount;
        uint256 remainder = prizePool - share * winnerCount;
        for (uint256 i = 0; i < n; i++) {
            if (isWinner[i]) {
                s.earnings[players[i]] += share;
                emit WinnerPaid(arenaId, players[i], share);
            }
        }
        s.earnings[s.treasury] += fee + remainder;

        emit ArenaSettled(arenaId, prizePool, fee, uint8(winnerCount));
    }

    /// @notice Withdraw accumulated winnings (pull pattern).
    function withdraw() external nonReentrant {
        CoreStorage storage s = _s();
        uint256 amount = s.earnings[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        s.earnings[msg.sender] = 0;

        (bool ok,) = payable(msg.sender).call{ value: amount }("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Update the protocol fee, bounded by MAX_FEE_BPS.
    function setProtocolFee(uint16 newBps) external onlyOwner {
        if (newBps > MAX_FEE_BPS) revert FeeTooHigh(newBps);
        CoreStorage storage s = _s();
        emit ProtocolFeeUpdated(s.protocolFeeBps, newBps);
        s.protocolFeeBps = newBps;
    }

    /// @notice Rotate the treasury (fee recipient).
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        CoreStorage storage s = _s();
        emit TreasuryUpdated(s.treasury, newTreasury);
        s.treasury = newTreasury;
    }

    /// @notice Pause game actions. Withdrawals stay open.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume game actions.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Rescue stray ERC20 tokens. Native CELO escrow is never owner-movable.
    function rescueERC20(IERC20 token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        emit ERC20Rescued(address(token), to, amount);
        token.safeTransfer(to, amount);
    }

    function version() external pure virtual returns (string memory) {
        return "1.1.0";
    }

    function treasury() external view returns (address) {
        return _s().treasury;
    }

    function protocolFeeBps() external view returns (uint16) {
        return _s().protocolFeeBps;
    }

    function getArena(uint256 arenaId) external view returns (Arena memory) {
        return _s().arenas[arenaId];
    }

    function getPlayers(uint256 arenaId) external view returns (address[] memory) {
        return _s().arenaPlayers[arenaId];
    }

    function boardCommitOf(uint256 arenaId, address player) external view returns (bytes32) {
        return _s().boardCommit[arenaId][player];
    }

    function getCallSequence(uint256 arenaId) external view returns (uint8[] memory) {
        return _s().callSequence[arenaId];
    }

    function hasRevealed(uint256 arenaId, address player) external view returns (bool) {
        return _s().hasRevealed[arenaId][player];
    }

    function revealedBoardOf(uint256 arenaId, address player) external view returns (uint8[25] memory) {
        return _s().revealedBoard[arenaId][player];
    }

    function earningsOf(address account) external view returns (uint256) {
        return _s().earnings[account];
    }

    /// @dev Winner resolution: reaches 5 lines at the earliest call index; if none
    ///      do, the most completed lines at the final state. Non-revealers excluded.
    function _resolveWinners(uint256 arenaId)
        internal
        view
        returns (bool[] memory isWinner, uint256 winnerCount, uint256 revealedCount)
    {
        CoreStorage storage s = _s();
        Arena storage a = s.arenas[arenaId];
        address[] memory players = s.arenaPlayers[arenaId];
        uint8[] memory calls = s.callSequence[arenaId];
        uint256 n = players.length;

        uint16[] memory idxs = new uint16[](n);
        bool[] memory achieved = new bool[](n);
        uint8[] memory lines = new uint8[](n);
        uint16 bestIdx = type(uint16).max;

        for (uint256 i = 0; i < n; i++) {
            if (!s.hasRevealed[arenaId][players[i]]) continue;
            revealedCount++;
            uint8[25] memory board = s.revealedBoard[arenaId][players[i]];
            (uint16 idx, bool ok) = _bingoIndex(board, calls);
            idxs[i] = idx;
            achieved[i] = ok;
            lines[i] = LineLib.countCompletedLines(BoardLib.marks(board, a.calledMask));
            if (ok && idx < bestIdx) bestIdx = idx;
        }

        bool bingoHappened = bestIdx != type(uint16).max;
        uint8 bestLines;
        if (!bingoHappened) {
            for (uint256 i = 0; i < n; i++) {
                if (s.hasRevealed[arenaId][players[i]] && lines[i] > bestLines) bestLines = lines[i];
            }
        }

        isWinner = new bool[](n);
        for (uint256 i = 0; i < n; i++) {
            if (!s.hasRevealed[arenaId][players[i]]) continue;
            bool win = bingoHappened ? (achieved[i] && idxs[i] == bestIdx) : (lines[i] == bestLines);
            if (win) {
                isWinner[i] = true;
                winnerCount++;
            }
        }
    }

    /// @dev Earliest 1-based call index at which `board` reaches >= 5 lines over
    ///      `calls`; `achieved` is false if it never does. `board` is pre-validated.
    function _bingoIndex(uint8[25] memory board, uint8[] memory calls)
        internal
        pure
        returns (uint16 index, bool achieved)
    {
        uint8[26] memory pos;
        for (uint8 p = 0; p < 25; p++) {
            pos[board[p]] = p + 1;
        }
        uint32 marked;
        uint256 len = calls.length;
        for (uint256 k = 0; k < len; k++) {
            uint8 cell = pos[calls[k]];
            if (cell == 0) continue;
            marked |= uint32(1) << (cell - 1);
            if (LineLib.countCompletedLines(marked) >= 5) {
                return (uint16(k + 1), true);
            }
        }
        return (0, false);
    }
}
