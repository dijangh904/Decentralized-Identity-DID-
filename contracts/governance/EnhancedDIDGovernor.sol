// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "../ReentrancyGuard.sol";

/**
 * @title EnhancedDIDGovernor
 * @dev Enhanced governor contract with comprehensive security improvements
 * - Custom error types for detailed debugging
 * - Reentrancy protection on sensitive operations
 * - Pausable functionality with multi-sig governance
 * - Comprehensive event logging for audit trails
 */
contract EnhancedDIDGovernor is 
    Governor, 
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl,
    ReentrancyGuard
{
    // ===== CUSTOM ERRORS FOR DETAILED DEBUGGING =====
    error AccessControlUnauthorized(address caller, string role);
    error InvalidAddress(address provided, string context);
    error InvalidProposal(uint256 proposalId, string reason);
    error ProposalAlreadyExists(uint256 proposalId);
    error ProposalNotActive(uint256 proposalId);
    error VotingPeriodEnded(uint256 proposalId);
    error InsufficientVotingPower(address voter, uint256 required, uint256 available);
    error QuorumNotReached(uint256 votesFor, uint256 quorum);
    error ExecutionFailed(uint256 proposalId, string reason);
    error ContractPaused();
    error ReentrantCall();
    error InvalidArrayLength(uint256 expected, uint256 actual);
    error EmptyString(string field);
    error StringTooLong(string field, uint256 length, uint256 maxLength);
    error InvalidSignature(address signer, bytes32 hash);
    error ZeroAddress(string context);
    
    // ===== PAUSABLE FUNCTIONALITY =====
    bool private _paused = false;
    uint256 private constant PAUSE_SIGNATURE_THRESHOLD = 3;
    mapping(address => bool) private _pauseSigners;
    mapping(address => bool) private _hasSignedPause;
    uint256 private _pauseSignatureCount;
    uint256 private _pauseInitiationTime;
    uint256 private constant PAUSE_DELAY = 24 hours;
    
    // Governor constants
    uint256 public constant VOTING_DELAY = 1 days;
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant PROPOSAL_THRESHOLD = 1000000 * 10**18; // 1 million tokens
    uint256 public constant QUORUM_PERCENTAGE = 4; // 4% of total supply
    uint256 public constant EMERGENCY_VOTING_PERIOD = 1 hours; // Shorter for emergencies
    
    // Role-based access control
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    enum ProposalType {
        UPGRADE_CONTRACT,
        CHANGE_PARAMETERS,
        EMERGENCY_ACTION,
        PROTOCOL_CHANGE,
        PAUSE_CONTRACT,
        UNPAUSE_CONTRACT
    }
    
    struct ProposalDetail {
        ProposalType proposalType;
        string description;
        address targetContract;
        bytes32 implementationHash;
        uint256 value;
        bytes data;
        uint256 created;
        uint256 votingStart;
        uint256 votingEnd;
        bool executed;
        bool cancelled;
    }
    
    mapping(uint256 => ProposalDetail) public proposalDetails;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    
    // ===== COMPREHENSIVE EVENTS WITH INDEXED PARAMETERS =====
    
    // Proposal Events
    event ProposalCreatedWithDetails(
        uint256 indexed proposalId,
        address indexed proposer,
        ProposalType proposalType,
        string description,
        address indexed targetContract,
        uint256 votingStart,
        uint256 votingEnd,
        uint256 timestamp
    );
    
    event ContractUpgradeProposed(
        uint256 indexed proposalId,
        address indexed proxy,
        address indexed newImplementation,
        bytes32 implementationHash,
        uint256 timestamp
    );
    
    event ParameterChangeProposed(
        uint256 indexed proposalId,
        address indexed target,
        bytes32 indexed parameterHash,
        bytes data,
        uint256 timestamp
    );
    
    event EmergencyActionProposed(
        uint256 indexed proposalId,
        address indexed target,
        bytes32 indexed actionHash,
        bytes data,
        uint256 timestamp
    );
    
    // Voting Events
    event VoteCastEnhanced(
        uint256 indexed proposalId,
        address indexed voter,
        uint8 support,
        uint256 weight,
        string reason,
        uint256 timestamp
    );
    
    event QuorumReached(
        uint256 indexed proposalId,
        uint256 votes,
        uint256 quorum,
        uint256 timestamp
    );
    
    event ProposalExecutedEnhanced(
        uint256 indexed proposalId,
        address indexed executor,
        uint256 executionTime,
        bytes[] results,
        uint256 timestamp
    );
    
    event ProposalCancelledEnhanced(
        uint256 indexed proposalId,
        address indexed canceller,
        string reason,
        uint256 timestamp
    );
    
    // Pause Events
    event PauseInitiated(
        address indexed initiator,
        uint256 signatureCount,
        uint256 requiredSignatures,
        uint256 initiationTime
    );
    
    event PauseSignatureAdded(
        address indexed signer,
        uint256 signatureCount,
        uint256 timestamp
    );
    
    event GovernancePaused(
        address indexed pauser,
        uint256 timestamp,
        string reason
    );
    
    event GovernanceUnpaused(
        address indexed unpauser,
        uint256 timestamp,
        string reason
    );
    
    // Role Events
    event EmergencyRoleGranted(
        address indexed account,
        address indexed granter,
        uint256 timestamp
    );
    
    event EmergencyRoleRevoked(
        address indexed account,
        address indexed revoker,
        uint256 timestamp
    );
    
    // Modifiers
    modifier whenNotPaused() {
        if (_paused) revert ContractPaused();
        _;
    }
    
    modifier onlyEmergencyRole() {
        if (!hasRole(EMERGENCY_ROLE, msg.sender)) {
            revert AccessControlUnauthorized(msg.sender, "EMERGENCY_ROLE");
        }
        _;
    }
    
    modifier onlyPauser() {
        if (!_pauseSigners[msg.sender]) {
            revert AccessControlUnauthorized(msg.sender, "PAUSER_ROLE");
        }
        _;
    }
    
    modifier validAddress(address addr) {
        if (addr == address(0)) revert ZeroAddress("address");
        _;
    }
    
    modifier nonEmptyString(string memory str) {
        if (bytes(str).length == 0) revert EmptyString("string");
        _;
    }
    
    constructor(
        ERC20Votes _token,
        TimelockController _timelock
    )
        Governor("Enhanced DID Governor")
        GovernorSettings(VOTING_DELAY, VOTING_PERIOD, PROPOSAL_THRESHOLD)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(QUORUM_PERCENTAGE)
        GovernorTimelockControl(_timelock)
    {
        _pauseSigners[msg.sender] = true;
        _grantRole(EMERGENCY_ROLE, msg.sender);
    }
    
    // ===== PAUSE FUNCTIONALITY WITH MULTI-SIG =====
    
    /**
     * @dev Initiate pause process - requires multiple signatures
     */
    function initiatePause(string calldata reason) external onlyPauser {
        if (_paused) revert ContractPaused();
        
        _pauseSignatureCount = 0;
        _pauseInitiationTime = block.timestamp;
        
        // Clear previous signatures
        address[] memory signers = _getPauseSigners();
        for (uint i = 0; i < signers.length; i++) {
            _hasSignedPause[signers[i]] = false;
        }
        
        emit PauseInitiated(msg.sender, 0, PAUSE_SIGNATURE_THRESHOLD, block.timestamp);
    }
    
    /**
     * @dev Add signature for pause
     */
    function signPause() external onlyPauser {
        if (_paused) revert ContractPaused();
        if (_hasSignedPause[msg.sender]) return;
        
        _hasSignedPause[msg.sender] = true;
        _pauseSignatureCount++;
        
        emit PauseSignatureAdded(msg.sender, _pauseSignatureCount, block.timestamp);
        
        // Check if we have enough signatures and delay has passed
        if (_pauseSignatureCount >= PAUSE_SIGNATURE_THRESHOLD && 
            block.timestamp >= _pauseInitiationTime + PAUSE_DELAY) {
            _pause();
        }
    }
    
    /**
     * @dev Emergency pause by emergency role
     */
    function emergencyPause(string calldata reason) external onlyEmergencyRole {
        if (_paused) revert ContractPaused();
        _pause();
        emit GovernancePaused(msg.sender, block.timestamp, reason);
    }
    
    /**
     * @dev Unpause contract (admin only)
     */
    function unpause(string calldata reason) external onlyEmergencyRole {
        if (!_paused) return;
        _paused = false;
        emit GovernanceUnpaused(msg.sender, block.timestamp, reason);
    }
    
    function _pause() internal {
        _paused = true;
        emit GovernancePaused(msg.sender, block.timestamp, "Multi-sig pause activated");
    }
    
    function paused() external view returns (bool) {
        return _paused;
    }
    
    // ===== ROLE MANAGEMENT =====
    
    function grantEmergencyRole(address account) external onlyEmergencyRole validAddress(account) {
        if (hasRole(EMERGENCY_ROLE, account)) return;
        
        _grantRole(EMERGENCY_ROLE, account);
        emit EmergencyRoleGranted(account, msg.sender, block.timestamp);
    }
    
    function revokeEmergencyRole(address account) external onlyEmergencyRole validAddress(account) {
        if (!hasRole(EMERGENCY_ROLE, account)) return;
        
        _revokeRole(EMERGENCY_ROLE, account);
        emit EmergencyRoleRevoked(account, msg.sender, block.timestamp);
    }
    
    function addPauser(address pauser) external onlyEmergencyRole validAddress(pauser) {
        if (_pauseSigners[pauser]) return;
        
        _pauseSigners[pauser] = true;
        emit EmergencyRoleGranted(pauser, msg.sender, block.timestamp);
    }
    
    function removePauser(address pauser) external onlyEmergencyRole validAddress(pauser) {
        if (!_pauseSigners[pauser]) return;
        
        _pauseSigners[pauser] = false;
        emit EmergencyRoleRevoked(pauser, msg.sender, block.timestamp);
    }
    
    // ===== ENHANCED PROPOSAL FUNCTIONS =====
    
    /**
     * @dev Create a proposal for contract upgrade with enhanced logging
     */
    function proposeContractUpgrade(
        address proxy,
        address newImplementation,
        string memory description
    ) public nonReentrant whenNotPaused validAddress(proxy) validAddress(newImplementation) 
      nonEmptyString(description) returns (uint256) {
        
        if (proxy == newImplementation) {
            revert InvalidProposal(0, "Proxy and implementation cannot be the same");
        }
        
        if (proxy.code.length == 0) {
            revert InvalidProposal(0, "Proxy must be a contract");
        }
        
        if (newImplementation.code.length == 0) {
            revert InvalidProposal(0, "New implementation must be a contract");
        }
        
        if (bytes(description).length > 1024) {
            revert StringTooLong("description", bytes(description).length, 1024);
        }
        
        bytes memory data = abi.encodeWithSignature(
            "upgrade(address,address)",
            proxy,
            newImplementation
        );
        
        address[] memory targets = new address[](1);
        targets[0] = address(timelock());
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        string[] memory signatures = new string[](1);
        signatures[0] = "";
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = data;
        
        uint256 proposalId = propose(
            targets,
            values,
            signatures,
            calldatas,
            description
        );
        
        uint256 votingStart = block.timestamp + votingDelay();
        uint256 votingEnd = votingStart + votingPeriod();
        
        proposalDetails[proposalId] = ProposalDetail({
            proposalType: ProposalType.UPGRADE_CONTRACT,
            description: description,
            targetContract: proxy,
            implementationHash: bytes32(uint256(uint160(newImplementation))),
            value: 0,
            data: data,
            created: block.timestamp,
            votingStart: votingStart,
            votingEnd: votingEnd,
            executed: false,
            cancelled: false
        });
        
        emit ProposalCreatedWithDetails(
            proposalId,
            msg.sender,
            ProposalType.UPGRADE_CONTRACT,
            description,
            proxy,
            votingStart,
            votingEnd,
            block.timestamp
        );
        
        emit ContractUpgradeProposed(
            proposalId,
            proxy,
            newImplementation,
            bytes32(uint256(uint160(newImplementation))),
            block.timestamp
        );
        
        return proposalId;
    }
    
    /**
     * @dev Create a proposal for parameter changes with enhanced logging
     */
    function proposeParameterChange(
        address target,
        bytes memory data,
        string memory description
    ) public nonReentrant whenNotPaused validAddress(target) 
      nonEmptyString(description) returns (uint256) {
        
        if (target.code.length == 0) {
            revert InvalidProposal(0, "Target must be a contract");
        }
        
        if (data.length == 0) {
            revert InvalidProposal(0, "Data cannot be empty");
        }
        
        if (data.length > 10240) {
            revert StringTooLong("data", data.length, 10240);
        }
        
        if (bytes(description).length > 1024) {
            revert StringTooLong("description", bytes(description).length, 1024);
        }
        
        address[] memory targets = new address[](1);
        targets[0] = address(timelock());
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        string[] memory signatures = new string[](1);
        signatures[0] = "";
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = data;
        
        uint256 proposalId = propose(
            targets,
            values,
            signatures,
            calldatas,
            description
        );
        
        uint256 votingStart = block.timestamp + votingDelay();
        uint256 votingEnd = votingStart + votingPeriod();
        
        proposalDetails[proposalId] = ProposalDetail({
            proposalType: ProposalType.CHANGE_PARAMETERS,
            description: description,
            targetContract: target,
            implementationHash: keccak256(data),
            value: 0,
            data: data,
            created: block.timestamp,
            votingStart: votingStart,
            votingEnd: votingEnd,
            executed: false,
            cancelled: false
        });
        
        emit ProposalCreatedWithDetails(
            proposalId,
            msg.sender,
            ProposalType.CHANGE_PARAMETERS,
            description,
            target,
            votingStart,
            votingEnd,
            block.timestamp
        );
        
        emit ParameterChangeProposed(
            proposalId,
            target,
            keccak256(data),
            data,
            block.timestamp
        );
        
        return proposalId;
    }
    
    /**
     * @dev Create an emergency action proposal with enhanced logging
     */
    function proposeEmergencyAction(
        address target,
        bytes memory data,
        string memory description
    ) public nonReentrant whenNotPaused validAddress(target) 
      nonEmptyString(description) returns (uint256) {
        
        if (target.code.length == 0) {
            revert InvalidProposal(0, "Target must be a contract");
        }
        
        if (data.length == 0) {
            revert InvalidProposal(0, "Data cannot be empty");
        }
        
        if (data.length > 10240) {
            revert StringTooLong("data", data.length, 10240);
        }
        
        if (bytes(description).length > 1024) {
            revert StringTooLong("description", bytes(description).length, 1024);
        }
        
        if (!hasRole(EMERGENCY_ROLE, msg.sender) && 
            token.getPriorVotes(msg.sender, block.timestamp - 1) <= PROPOSAL_THRESHOLD * 10) {
            revert AccessControlUnauthorized(msg.sender, "EMERGENCY_ROLE");
        }
        
        address[] memory targets = new address[](1);
        targets[0] = address(timelock());
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        string[] memory signatures = new string[](1);
        signatures[0] = "";
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = data;
        
        uint256 proposalId = propose(
            targets,
            values,
            signatures,
            calldatas,
            description
        );
        
        uint256 votingStart = block.timestamp; // No delay for emergency
        uint256 votingEnd = votingStart + EMERGENCY_VOTING_PERIOD;
        
        proposalDetails[proposalId] = ProposalDetail({
            proposalType: ProposalType.EMERGENCY_ACTION,
            description: description,
            targetContract: target,
            implementationHash: keccak256(data),
            value: 0,
            data: data,
            created: block.timestamp,
            votingStart: votingStart,
            votingEnd: votingEnd,
            executed: false,
            cancelled: false
        });
        
        emit ProposalCreatedWithDetails(
            proposalId,
            msg.sender,
            ProposalType.EMERGENCY_ACTION,
            description,
            target,
            votingStart,
            votingEnd,
            block.timestamp
        );
        
        emit EmergencyActionProposed(
            proposalId,
            target,
            keccak256(data),
            data,
            block.timestamp
        );
        
        return proposalId;
    }
    
    // ===== ENHANCED VOTING =====
    
    function castVote(uint256 proposalId, uint8 support) 
        public override nonReentrant whenNotPaused returns (uint256) {
        
        return _castVote(proposalId, support, "");
    }
    
    function castVoteWithReason(
        uint256 proposalId,
        uint8 support,
        string calldata reason
    ) public override nonReentrant whenNotPaused returns (uint256) {
        
        return _castVote(proposalId, support, reason);
    }
    
    function _castVote(uint256 proposalId, uint8 support, string memory reason) 
        internal returns (uint256) {
        
        if (hasVoted[proposalId][msg.sender]) {
            revert InvalidProposal(proposalId, "Already voted");
        }
        
        uint256 weight = token.getPriorVotes(msg.sender, proposalSnapshot(proposalId));
        
        if (weight == 0) {
            revert InsufficientVotingPower(msg.sender, 1, 0);
        }
        
        hasVoted[proposalId][msg.sender] = true;
        
        uint256 votes = super.castVoteWithReason(proposalId, support, reason);
        
        emit VoteCastEnhanced(
            proposalId,
            msg.sender,
            support,
            weight,
            reason,
            block.timestamp
        );
        
        // Check if quorum is reached
        uint256 currentQuorum = quorum(proposalSnapshot(proposalId));
        uint256 totalVotes = proposalVotes(proposalId).forVotes + 
                           proposalVotes(proposalId).againstVotes + 
                           proposalVotes(proposalId).abstainVotes;
        
        if (totalVotes >= currentQuorum) {
            emit QuorumReached(proposalId, totalVotes, currentQuorum, block.timestamp);
        }
        
        return votes;
    }
    
    // ===== ENHANCED EXECUTION =====
    
    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public payable override nonReentrant whenNotPaused {
        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        
        ProposalDetail storage detail = proposalDetails[proposalId];
        
        if (detail.executed) {
            revert InvalidProposal(proposalId, "Already executed");
        }
        
        if (state(proposalId) != ProposalState.Succeeded) {
            revert InvalidProposal(proposalId, "Proposal not succeeded");
        }
        
        detail.executed = true;
        
        super.execute(targets, values, calldatas, descriptionHash);
        
        emit ProposalExecutedEnhanced(
            proposalId,
            msg.sender,
            block.timestamp,
            calldatas,
            block.timestamp
        );
    }
    
    function cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public override nonReentrant {
        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        
        ProposalDetail storage detail = proposalDetails[proposalId];
        
        if (detail.cancelled) {
            revert InvalidProposal(proposalId, "Already cancelled");
        }
        
        detail.cancelled = true;
        
        super.cancel(targets, values, calldatas, descriptionHash);
        
        emit ProposalCancelledEnhanced(
            proposalId,
            msg.sender,
            "Cancelled by proposer",
            block.timestamp
        );
    }
    
    // ===== VIEW FUNCTIONS =====
    
    function getProposalDetails(uint256 proposalId) 
        external view returns (ProposalDetail memory) {
        
        return proposalDetails[proposalId];
    }
    
    function getPauseStatus() external view returns (
        bool paused,
        uint256 signatureCount,
        uint256 requiredSignatures,
        uint256 initiationTime,
        uint256 delayRemaining
    ) {
        return (
            _paused,
            _pauseSignatureCount,
            PAUSE_SIGNATURE_THRESHOLD,
            _pauseInitiationTime,
            _pauseInitiationTime > 0 ? 
                (_pauseInitiationTime + PAUSE_DELAY > block.timestamp ? 
                    _pauseInitiationTime + PAUSE_DELAY - block.timestamp : 0) : 0
        );
    }
    
    function hasVotedOn(uint256 proposalId, address voter) external view returns (bool) {
        return hasVoted[proposalId][voter];
    }
    
    // ===== INTERNAL HELPERS =====
    
    function _getPauseSigners() internal view returns (address[] memory signers) {
        // Simplified version - in production, maintain a dynamic list
        signers = new address[](5);
        uint256 count = 0;
        
        if (_pauseSigners[msg.sender]) {
            signers[count] = msg.sender;
            count++;
        }
        
        // Add other known signers (simplified)
        if (_pauseSigners[owner()]) {
            signers[count] = owner();
            count++;
        }
        
        assembly {
            mstore(signers, count)
        }
    }
    
    // ===== OVERRIDES =====
    
    function votingDelay()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(IGovernor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function proposalThreshold()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }
    
    function state(uint256 proposalId)
        public
        view
        override(IGovernor, Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }
    
    function propose(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    )
        public
        override(IGovernor, Governor)
        returns (uint256)
    {
        return super.propose(targets, values, signatures, calldatas, description);
    }
    
    function castVoteBySig(
        uint256 proposalId,
        uint8 support,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        public
        override(IGovernor, Governor)
        returns (uint256)
    {
        return super.castVoteBySig(proposalId, support, v, r, s);
    }
}
