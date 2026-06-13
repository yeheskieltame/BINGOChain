// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// OZ v5: import the full upgradeable suite from the upgradeable package so a
// single Initializable type is inherited (the main package also ships these,
// which would otherwise clash with the upgradeable mixins below).
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
    TransferFailed
} from "./types/GameTypes.sol";
import { CommitLib } from "./libraries/CommitLib.sol";
import { BoardLib } from "./libraries/BoardLib.sol";
import { LineLib } from "./libraries/LineLib.sol";

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
    using SafeERC20 for IERC20;

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

    // ── Game constants ───────────────────────────────────────────

    /// @notice Minimum players per arena.
    uint8 public constant MIN_PLAYERS = 2;
    /// @notice Maximum players per arena.
    uint8 public constant MAX_PLAYERS = 6;
    /// @notice Minimum entry stake per player (1 CELO).
    uint256 public constant MIN_STAKE = 1 ether;
    /// @notice Highest callable number (board is 1..25).
    uint8 public constant MAX_NUMBER = 25;
    /// @notice Time players have to reveal once the reveal phase opens.
    uint64 public constant REVEAL_WINDOW = 1 days;

    // ── Game events ──────────────────────────────────────────────

    /// @notice A new arena was opened.
    event ArenaCreated(uint256 indexed arenaId, address indexed creator, uint96 stake, uint8 maxPlayers);
    /// @notice A player joined an arena (committed a sealed board + deposited stake).
    event PlayerJoined(uint256 indexed arenaId, address indexed player, uint8 joinedCount);
    /// @notice All seats filled — the arena is sealed and ready to play.
    event GameReady(uint256 indexed arenaId);
    /// @notice A number was called and recorded onchain.
    event NumberCalled(uint256 indexed arenaId, address indexed caller, uint8 number, uint8 callIndex);
    /// @notice The reveal phase opened (BINGO claimed or all 25 numbers called).
    event RevealPhaseStarted(uint256 indexed arenaId, uint64 revealDeadline);
    /// @notice A player claimed BINGO, freezing the call sequence for verification.
    event BingoClaimed(uint256 indexed arenaId, address indexed claimer, uint8 atCallIndex);
    /// @notice A player revealed their board (hash verified, permutation valid).
    event BoardRevealed(uint256 indexed arenaId, address indexed player);
    /// @notice An arena was settled: prize split among winners, fee to treasury.
    event ArenaSettled(uint256 indexed arenaId, uint256 prizePool, uint256 fee, uint8 winnerCount);
    /// @notice A winner was credited their share (claim via {withdraw}).
    event WinnerPaid(uint256 indexed arenaId, address indexed winner, uint256 amount);
    /// @notice Funds withdrawn from the pull-payment balance.
    event Withdrawn(address indexed account, uint256 amount);

    // ── Game: arena lifecycle ────────────────────────────────────

    /// @notice Open a new arena. The creator sets the entry stake and seat count
    ///         but joins like everyone else via {commitBoard}.
    /// @param maxPlayers Seats (MIN_PLAYERS..MAX_PLAYERS).
    /// @param stake      Entry stake per player in wei (≥ MIN_STAKE).
    /// @return arenaId   The new arena's id.
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

        emit ArenaCreated(arenaId, msg.sender, stake, maxPlayers);
    }

    /// @notice Join an arena by depositing the exact stake and committing a sealed
    ///         board hash. Seals the arena (state → Committed) once full.
    /// @param arenaId         Target arena.
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

    /// @notice Call a number on your turn. Each number (1..25) may be called once;
    ///         the call is recorded onchain and marks that cell on every board.
    /// @dev The first call on a sealed (Committed) arena opens play. When all 25
    ///      numbers have been called with no BINGO claim, the reveal phase opens.
    function callNumber(uint256 arenaId, uint8 number) external whenNotPaused nonReentrant {
        CoreStorage storage s = _s();
        Arena storage a = s.arenas[arenaId];
        if (a.creator == address(0)) revert ArenaNotFound(arenaId);

        // First call transitions a sealed arena into active play.
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
        uint8 callIndex = a.callCount; // 0-based index of this call
        unchecked {
            a.callCount += 1;
            // Advance the turn round-robin over the player list.
            a.turnIndex = uint8((uint256(a.turnIndex) + 1) % players.length);
        }

        emit NumberCalled(arenaId, msg.sender, number, callIndex);

        // All 25 numbers exhausted with no BINGO claim → open reveal.
        if (a.callCount == MAX_NUMBER) {
            a.state = GameState.Revealing;
            a.revealDeadline = uint64(block.timestamp) + REVEAL_WINDOW;
            emit RevealPhaseStarted(arenaId, a.revealDeadline);
        }
    }

    /// @notice Claim BINGO. Freezes the call sequence and opens the reveal phase;
    ///         the true winner is determined by replay in {settle}, so a premature
    ///         or false claim simply fails to win.
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

    /// @notice Reveal your sealed board so the winner can be verified. The board
    ///         must hash to your commitment and be a valid permutation of 1..25.
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

    /// @notice Settle an arena: determine the winner(s) by replaying the recorded
    ///         call sequence against revealed boards, then split the prize.
    /// @dev Callable once the reveal window has closed, or earlier if every player
    ///      has revealed. Winner = the player(s) who reach 5 lines at the earliest
    ///      call index; if no one does, the player(s) with the most completed lines
    ///      at the final state. Players who did not reveal forfeit (their stake
    ///      stays in the pot for the winner). Payouts use the pull pattern.
    function settle(uint256 arenaId) external whenNotPaused nonReentrant {
        CoreStorage storage s = _s();
        Arena storage a = s.arenas[arenaId];
        if (a.creator == address(0)) revert ArenaNotFound(arenaId);
        if (a.state != GameState.Revealing) revert WrongState(arenaId, GameState.Revealing, a.state);

        address[] memory players = s.arenaPlayers[arenaId];
        uint8[] memory calls = s.callSequence[arenaId];
        uint256 n = players.length;

        // Per-player replay results.
        uint16[] memory idxs = new uint16[](n);
        bool[] memory achieved = new bool[](n);
        uint8[] memory lines = new uint8[](n);
        uint256 revealedCount;
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

        // Finality: window closed, or everyone already revealed.
        if (block.timestamp <= a.revealDeadline && revealedCount != n) revert RevealWindowOpen();

        bool bingoHappened = bestIdx != type(uint16).max;
        uint8 bestLines;
        if (!bingoHappened) {
            for (uint256 i = 0; i < n; i++) {
                if (s.hasRevealed[arenaId][players[i]] && lines[i] > bestLines) bestLines = lines[i];
            }
        }

        uint256 winnerCount;
        for (uint256 i = 0; i < n; i++) {
            if (!s.hasRevealed[arenaId][players[i]]) continue;
            if (bingoHappened ? (achieved[i] && idxs[i] == bestIdx) : (lines[i] == bestLines)) winnerCount++;
        }

        a.state = GameState.Settled;

        uint256 totalStake = uint256(a.stake) * n;
        uint256 fee = (totalStake * s.protocolFeeBps) / 10_000;
        uint256 prizePool = totalStake - fee;

        // No one revealed → pot goes to the treasury (nothing stranded).
        if (winnerCount == 0) {
            s.earnings[s.treasury] += totalStake;
            emit ArenaSettled(arenaId, 0, totalStake, 0);
            return;
        }

        uint256 share = prizePool / winnerCount;
        uint256 remainder = prizePool - share * winnerCount;
        for (uint256 i = 0; i < n; i++) {
            if (!s.hasRevealed[arenaId][players[i]]) continue;
            bool isWinner = bingoHappened ? (achieved[i] && idxs[i] == bestIdx) : (lines[i] == bestLines);
            if (isWinner) {
                s.earnings[players[i]] += share;
                emit WinnerPaid(arenaId, players[i], share);
            }
        }
        // Fee plus any rounding dust accrues to the treasury so the pot reconciles exactly.
        s.earnings[s.treasury] += fee + remainder;

        emit ArenaSettled(arenaId, prizePool, fee, uint8(winnerCount));
    }

    /// @notice Withdraw your accumulated winnings (pull pattern).
    function withdraw() external nonReentrant {
        CoreStorage storage s = _s();
        uint256 amount = s.earnings[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        s.earnings[msg.sender] = 0;

        (bool ok,) = payable(msg.sender).call{ value: amount }("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(msg.sender, amount);
    }

    /// @dev Earliest 1-based call index at which `board` reaches ≥5 completed
    ///      lines over the ordered `calls`. `achieved` is false if it never does.
    ///      `board` is assumed valid (checked at reveal), so every number 1..25
    ///      maps to exactly one cell.
    function _bingoIndex(uint8[25] memory board, uint8[] memory calls)
        internal
        pure
        returns (uint16 index, bool achieved)
    {
        uint8[26] memory pos; // pos[number] = cell position + 1 (0 = absent)
        for (uint8 p = 0; p < 25; p++) {
            pos[board[p]] = p + 1;
        }
        uint32 marked;
        uint256 len = calls.length;
        for (uint256 k = 0; k < len; k++) {
            uint8 cell = pos[calls[k]];
            if (cell == 0) continue; // number not on this board (shouldn't happen for valid boards)
            marked |= uint32(1) << (cell - 1);
            if (LineLib.countCompletedLines(marked) >= 5) {
                return (uint16(k + 1), true);
            }
        }
        return (0, false);
    }

    // ── Admin (onlyOwner; owner is a Safe multisig on mainnet) ───

    /// @notice Emitted when the protocol fee changes.
    event ProtocolFeeUpdated(uint16 oldBps, uint16 newBps);
    /// @notice Emitted when the treasury changes.
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    /// @notice Emitted when stray ERC20 tokens are rescued.
    event ERC20Rescued(address indexed token, address indexed to, uint256 amount);

    /// @notice Update the protocol fee (bounded by MAX_FEE_BPS). Applies to
    ///         arenas settled after the change; in-flight stakes are unaffected.
    function setProtocolFee(uint16 newBps) external onlyOwner {
        if (newBps > MAX_FEE_BPS) revert FeeTooHigh(newBps);
        CoreStorage storage s = _s();
        emit ProtocolFeeUpdated(s.protocolFeeBps, newBps);
        s.protocolFeeBps = newBps;
    }

    /// @notice Rotate the treasury (protocol fee recipient).
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        CoreStorage storage s = _s();
        emit TreasuryUpdated(s.treasury, newTreasury);
        s.treasury = newTreasury;
    }

    /// @notice Pause entry to game actions (createArena/commitBoard/callNumber/
    ///         claimBingo/revealBoard/settle). Withdrawals stay open so players
    ///         can always exit.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume game actions.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Rescue ERC20 tokens accidentally sent to the contract. Cannot touch
    ///         native CELO — that is player escrow and is never owner-movable.
    function rescueERC20(IERC20 token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        token.safeTransfer(to, amount);
        emit ERC20Rescued(address(token), to, amount);
    }

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

    /// @notice Full arena record.
    function getArena(uint256 arenaId) external view returns (Arena memory) {
        return _s().arenas[arenaId];
    }

    /// @notice Ordered list of players who have committed to an arena.
    function getPlayers(uint256 arenaId) external view returns (address[] memory) {
        return _s().arenaPlayers[arenaId];
    }

    /// @notice A player's committed board hash for an arena (0 if not joined).
    function boardCommitOf(uint256 arenaId, address player) external view returns (bytes32) {
        return _s().boardCommit[arenaId][player];
    }

    /// @notice The numbers called so far, in call order.
    function getCallSequence(uint256 arenaId) external view returns (uint8[] memory) {
        return _s().callSequence[arenaId];
    }

    /// @notice Whether a player has revealed their board for an arena.
    function hasRevealed(uint256 arenaId, address player) external view returns (bool) {
        return _s().hasRevealed[arenaId][player];
    }

    /// @notice A player's revealed board (all zeros until revealed).
    function revealedBoardOf(uint256 arenaId, address player) external view returns (uint8[25] memory) {
        return _s().revealedBoard[arenaId][player];
    }

    /// @notice Withdrawable balance for an account (winnings / treasury fees).
    function earningsOf(address account) external view returns (uint256) {
        return _s().earnings[account];
    }
}
