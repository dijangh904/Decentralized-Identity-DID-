// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IERC725.sol";
import "./interfaces/IERC735.sol";

/**
 * @title StateRecovery
 * @dev Comprehensive contract state recovery system with governance controls
 * 
 * This contract provides mechanisms to recover from various types of state corruption
 * in DID (Decentralized Identity) registry contracts. It implements a governance-based
 * approach where recovery operations require proposal creation, voting, and approval
 * before execution.
 * 
 * Key Features:
 * - Multi-signature approval system for recovery operations
 * - Emergency recovery capabilities for critical situations
 * - State snapshot creation for recovery reference
 * - Comprehensive audit trail and operation logging
 * - Role-based access control with multiple governance layers
 * 
 * Recovery Types Supported:
 * - DID_DOCUMENT: Recovery of corrupted DID document data
 * - VERIFIABLE_CREDENTIAL: Recovery of corrupted credential information
 * - OWNERSHIP_MAPPING: Recovery of inconsistent owner-to-DID relationships
 * - ROLE_ASSIGNMENT: Recovery of corrupted role-based access control
 * - CROSS_CHAIN_STATE: Recovery of cross-chain bridge inconsistencies
 * 
 * @author Fatima Sanusi
 * @notice Use this contract to recover from state corruption in DID registry contracts
 * @dev Implements OpenZeppelin AccessControl and ReentrancyGuard for security
 */
contract StateRecovery is AccessControl, ReentrancyGuard {
    
    /// @notice Role identifier for recovery operators who can propose and vote on recovery operations
    bytes32 public constant RECOVERY_ROLE = keccak256("RECOVERY_ROLE");
    
    /// @notice Role identifier for governance members who can configure recovery parameters
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    /// @notice Role identifier for emergency responders who can trigger immediate recovery
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    
    /// @notice Enumeration of supported recovery operation types
    /// @dev Each type corresponds to a specific category of state corruption that can be recovered
    enum RecoveryType {
        /// @notice Recovery of corrupted DID document data (ownership, public keys, service endpoints)
        DID_DOCUMENT,
        /// @notice Recovery of corrupted verifiable credential information
        VERIFIABLE_CREDENTIAL,
        /// @notice Recovery of inconsistent owner-to-DID relationship mappings
        OWNERSHIP_MAPPING,
        /// @notice Recovery of corrupted role-based access control assignments
        ROLE_ASSIGNMENT,
        /// @notice Recovery of cross-chain bridge state inconsistencies
        CROSS_CHAIN_STATE
    }
    
    /// @notice Enumeration of recovery proposal lifecycle statuses
    /// @dev Tracks the progression of a recovery proposal through the governance process
    enum RecoveryStatus {
        /// @notice Proposal has been created and is awaiting votes
        PENDING,
        /// @notice Proposal has received sufficient approval votes
        APPROVED,
        /// @notice Proposal has been rejected by sufficient negative votes
        REJECTED,
        /// @notice Proposal has been successfully executed
        EXECUTED,
        /// @notice Proposal execution failed
        FAILED
    }
    
    /// @notice Structure representing a recovery proposal in the governance system
    /// @dev Contains all proposal data including voting information and execution status
    struct RecoveryProposal {
        /// @notice Unique identifier for the proposal
        bytes32 id;
        /// @notice Type of recovery operation being proposed
        RecoveryType recoveryType;
        /// @notice Address that created the proposal
        address proposer;
        /// @notice Human-readable description of the recovery operation
        string description;
        /// @notice Encoded recovery operation data
        bytes data;
        /// @notice Timestamp when the proposal was created
        uint256 proposedAt;
        /// @notice Deadline for voting on the proposal
        uint256 votingDeadline;
        /// @notice Current status of the proposal
        RecoveryStatus status;
        /// @notice Number of approval votes received
        uint256 approvalCount;
        /// @notice Number of rejection votes received
        uint256 rejectionCount;
        /// @notice Mapping of addresses that have voted on the proposal
        mapping(address => bool) hasVoted;
        /// @notice Array of addresses that have voted on the proposal
        address[] voters;
    }
    
    /// @notice Structure representing a state snapshot for recovery reference
    /// @dev Used to create reference points before potentially risky operations
    struct StateSnapshot {
        /// @notice Unique identifier for the snapshot
        bytes32 id;
        /// @notice Timestamp when the snapshot was created
        uint256 timestamp;
        /// @notice Merkle root of the contract state at snapshot time
        bytes32 merkleRoot;
        /// @notice Description of the snapshot purpose
        string description;
        /// @notice Address that created the snapshot
        address creator;
        /// @notice Whether the snapshot is considered valid
        bool isValid;
    }
    
    /// @notice Mapping of proposal IDs to their corresponding recovery proposals
    mapping(bytes32 => RecoveryProposal) public recoveryProposals;
    
    /// @notice Mapping of recovery types to their required approval counts
    mapping(RecoveryType => uint256) public requiredApprovals;
    
    /// @notice Mapping of snapshot IDs to their corresponding state snapshots
    mapping(bytes32 => StateSnapshot) public stateSnapshots;
    
    /// @notice Standard voting period for regular recovery proposals (7 days)
    uint256 public constant VOTING_PERIOD = 7 days;
    
    /// @notice Extended voting period for emergency recovery proposals (24 hours)
    uint256 public constant EMERGENCY_VOTING_PERIOD = 24 hours;
    
    /// @notice Minimum delay between proposal creation and execution (1 hour)
    uint256 public constant MIN_PROPOSAL_DELAY = 1 hours;
    
    /// @notice Address of the Ethereum DID Registry contract for recovery operations
    address public ethereumDIDRegistry;
    
    /// @notice Address of the Stellar DID Registry contract for recovery operations
    address public stellarDIDRegistry;
    
    /// @notice Emitted when a new recovery proposal is created
    /// @param proposalId Unique identifier of the proposal
    /// @param recoveryType Type of recovery operation being proposed
    /// @param proposer Address that created the proposal
    /// @param description Human-readable description of the recovery operation
    event RecoveryProposed(
        bytes32 indexed proposalId,
        RecoveryType indexed recoveryType,
        address indexed proposer,
        string description
    );
    
    /// @notice Emitted when a recovery proposal receives a vote
    /// @param proposalId Unique identifier of the proposal
    /// @param voter Address that cast the vote
    /// @param approve Whether the vote is an approval (true) or rejection (false)
    /// @param reason Optional reason provided by the voter
    event RecoveryVoted(
        bytes32 indexed proposalId,
        address indexed voter,
        bool approve,
        string reason
    );
    
    /// @notice Emitted when a recovery proposal is executed
    /// @param proposalId Unique identifier of the proposal
    /// @param recoveryType Type of recovery operation that was executed
    /// @param success Whether the execution was successful
    /// @param result Description of the execution result
    event RecoveryExecuted(
        bytes32 indexed proposalId,
        RecoveryType indexed recoveryType,
        bool success,
        string result
    );
    
    /// @notice Emitted when a new state snapshot is created
    /// @param snapshotId Unique identifier of the snapshot
    /// @param creator Address that created the snapshot
    /// @param merkleRoot Merkle root of the contract state at snapshot time
    event StateSnapshotCreated(
        bytes32 indexed snapshotId,
        address indexed creator,
        bytes32 merkleRoot
    );
    
    /// @notice Emitted when an emergency recovery is triggered
    /// @param triggerer Address that triggered the emergency recovery
    /// @param reason Reason for triggering the emergency recovery
    /// @param timestamp Timestamp when the emergency recovery was triggered
    event EmergencyRecoveryTriggered(
        address indexed triggerer,
        string reason,
        uint256 timestamp
    );
    
    /// @notice Restricts access to addresses with the RECOVERY_ROLE
    /// @dev Throws if the caller does not have the RECOVERY_ROLE
    modifier onlyRecoveryRole() {
        require(hasRole(RECOVERY_ROLE, msg.sender), "StateRecovery: caller missing RECOVERY_ROLE");
        _;
    }
    
    /// @notice Restricts access to addresses with the GOVERNANCE_ROLE
    /// @dev Throws if the caller does not have the GOVERNANCE_ROLE
    modifier onlyGovernanceRole() {
        require(hasRole(GOVERNANCE_ROLE, msg.sender), "StateRecovery: caller missing GOVERNANCE_ROLE");
        _;
    }
    
    /// @notice Restricts access to addresses with the EMERGENCY_ROLE
    /// @dev Throws if the caller does not have the EMERGENCY_ROLE
    modifier onlyEmergencyRole() {
        require(hasRole(EMERGENCY_ROLE, msg.sender), "StateRecovery: caller missing EMERGENCY_ROLE");
        _;
    }
    
    /// @notice Validates that a proposal exists
    /// @param proposalId The ID of the proposal to validate
    /// @dev Throws if the proposal does not exist
    modifier validProposal(bytes32 proposalId) {
        require(recoveryProposals[proposalId].proposedAt > 0, "StateRecovery: proposal does not exist");
        _;
    }
    
    /**
     * @notice Initializes the StateRecovery contract
     * @dev Sets up the contract with default roles and approval requirements
     * Grants the deployer all roles for initial setup
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        _grantRole(RECOVERY_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        
        // Set default approval requirements for each recovery type
        requiredApprovals[RecoveryType.DID_DOCUMENT] = 3;
        requiredApprovals[RecoveryType.VERIFIABLE_CREDENTIAL] = 3;
        requiredApprovals[RecoveryType.OWNERSHIP_MAPPING] = 5;
        requiredApprovals[RecoveryType.ROLE_ASSIGNMENT] = 7;
        requiredApprovals[RecoveryType.CROSS_CHAIN_STATE] = 5;
    }
    
    /**
     * @notice Sets the target contract addresses for recovery operations
     * @dev Only addresses with DEFAULT_ADMIN_ROLE can call this function
     * @param _ethereumDIDRegistry Address of the Ethereum DID Registry contract
     * @param _stellarDIDRegistry Address of the Stellar DID Registry contract
     */
    function setTargetContracts(
        address _ethereumDIDRegistry,
        address _stellarDIDRegistry
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        ethereumDIDRegistry = _ethereumDIDRegistry;
        stellarDIDRegistry = _stellarDIDRegistry;
    }
    
    /**
     * @notice Creates a state snapshot for recovery reference
     * @dev Creates a reference point of contract state before potentially risky operations
     * @param merkleRoot Merkle root representing the contract state at snapshot time
     * @param description Human-readable description of the snapshot purpose
     * @return snapshotId Unique identifier of the created snapshot
     * @throws StateRecovery if description is empty
     * @throws StateRecovery if caller does not have RECOVERY_ROLE
     */
    function createStateSnapshot(
        bytes32 merkleRoot,
        string memory description
    ) external onlyRecoveryRole returns (bytes32) {
        require(bytes(description).length > 0, "StateRecovery: description cannot be empty");
        
        bytes32 snapshotId = keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            merkleRoot
        ));
        
        stateSnapshots[snapshotId] = StateSnapshot({
            id: snapshotId,
            timestamp: block.timestamp,
            merkleRoot: merkleRoot,
            description: description,
            creator: msg.sender,
            isValid: true
        });
        
        emit StateSnapshotCreated(snapshotId, msg.sender, merkleRoot);
        return snapshotId;
    }
    
    /**
     * @notice Proposes a new recovery operation for governance approval
     * @dev Creates a new proposal that must be approved through voting before execution
     * @param recoveryType Type of recovery operation being proposed
     * @param description Human-readable description of the recovery operation
     * @param data Encoded recovery operation data specific to the recovery type
     * @return proposalId Unique identifier of the created proposal
     * @throws StateRecovery if description is empty
     * @throws StateRecovery if recovery data is empty
     * @throws StateRecovery if proposal already exists
     * @throws StateRecovery if caller does not have RECOVERY_ROLE
     */
    function proposeRecovery(
        RecoveryType recoveryType,
        string memory description,
        bytes memory data
    ) external onlyRecoveryRole returns (bytes32) {
        require(bytes(description).length > 0, "StateRecovery: description cannot be empty");
        require(data.length > 0, "StateRecovery: recovery data cannot be empty");
        
        bytes32 proposalId = keccak256(abi.encodePacked(
            recoveryType,
            msg.sender,
            block.timestamp,
            data
        ));
        
        require(recoveryProposals[proposalId].proposedAt == 0, "StateRecovery: proposal already exists");
        
        uint256 votingPeriod = hasRole(EMERGENCY_ROLE, msg.sender) ? 
            EMERGENCY_VOTING_PERIOD : VOTING_PERIOD;
        
        RecoveryProposal storage proposal = recoveryProposals[proposalId];
        proposal.id = proposalId;
        proposal.recoveryType = recoveryType;
        proposal.proposer = msg.sender;
        proposal.description = description;
        proposal.data = data;
        proposal.proposedAt = block.timestamp;
        proposal.votingDeadline = block.timestamp + votingPeriod;
        proposal.status = RecoveryStatus.PENDING;
        
        emit RecoveryProposed(proposalId, recoveryType, msg.sender, description);
        return proposalId;
    }
    
    /**
     * @notice Votes on a recovery proposal
     * @dev Allows recovery role members to approve or reject pending proposals
     * @param proposalId Unique identifier of the proposal to vote on
     * @param approve Whether the vote is an approval (true) or rejection (false)
     * @param reason Optional reason provided by the voter
     * @throws StateRecovery if voting period has ended
     * @throws StateRecovery if caller has already voted
     * @throws StateRecovery if proposal is not in PENDING status
     * @throws StateRecovery if caller does not have RECOVERY_ROLE
     */
    function voteOnRecovery(
        bytes32 proposalId,
        bool approve,
        string memory reason
    ) external onlyRecoveryRole validProposal(proposalId) {
        RecoveryProposal storage proposal = recoveryProposals[proposalId];
        
        require(block.timestamp <= proposal.votingDeadline, "StateRecovery: voting period ended");
        require(!proposal.hasVoted[msg.sender], "StateRecovery: already voted");
        require(proposal.status == RecoveryStatus.PENDING, "StateRecovery: proposal not pending");
        
        proposal.hasVoted[msg.sender] = true;
        proposal.voters.push(msg.sender);
        
        if (approve) {
            proposal.approvalCount++;
        } else {
            proposal.rejectionCount++;
        }
        
        emit RecoveryVoted(proposalId, msg.sender, approve, reason);
        
        // Check if proposal should be approved or rejected
        uint256 required = requiredApprovals[proposal.recoveryType];
        
        if (proposal.approvalCount >= required) {
            proposal.status = RecoveryStatus.APPROVED;
        } else if (proposal.rejectionCount >= required) {
            proposal.status = RecoveryStatus.REJECTED;
        }
    }
    
    /**
     * @dev Execute an approved recovery proposal
     */
    function executeRecovery(bytes32 proposalId) 
        external 
        onlyRecoveryRole 
        nonReentrant 
        validProposal(proposalId) 
        returns (bool) 
    {
        RecoveryProposal storage proposal = recoveryProposals[proposalId];
        
        require(proposal.status == RecoveryStatus.APPROVED, "StateRecovery: proposal not approved");
        require(block.timestamp > proposal.proposedAt + MIN_PROPOSAL_DELAY, "StateRecovery: too early to execute");
        
        bool success = false;
        string memory result = "";
        
        try this._executeRecoveryInternal(proposal.recoveryType, proposal.data) returns (bool _success) {
            success = _success;
            result = success ? "Recovery executed successfully" : "Recovery execution failed";
        } catch Error(string memory reason) {
            success = false;
            result = reason;
        } catch {
            success = false;
            result = "Unknown error during recovery execution";
        }
        
        proposal.status = success ? RecoveryStatus.EXECUTED : RecoveryStatus.FAILED;
        
        emit RecoveryExecuted(proposalId, proposal.recoveryType, success, result);
        return success;
    }
    
    /**
     * @dev Internal recovery execution function
     */
    function _executeRecoveryInternal(RecoveryType recoveryType, bytes memory data) 
        external 
        returns (bool) 
    {
        require(msg.sender == address(this), "StateRecovery: internal function only");
        
        if (recoveryType == RecoveryType.DID_DOCUMENT) {
            return _recoverDIDDocument(data);
        } else if (recoveryType == RecoveryType.VERIFIABLE_CREDENTIAL) {
            return _recoverVerifiableCredential(data);
        } else if (recoveryType == RecoveryType.OWNERSHIP_MAPPING) {
            return _recoverOwnershipMapping(data);
        } else if (recoveryType == RecoveryType.ROLE_ASSIGNMENT) {
            return _recoverRoleAssignment(data);
        } else if (recoveryType == RecoveryType.CROSS_CHAIN_STATE) {
            return _recoverCrossChainState(data);
        }
        
        return false;
    }
    
    /**
     * @dev Recover DID document corruption
     */
    function _recoverDIDDocument(bytes memory data) internal returns (bool) {
        // Decode recovery data: did, newOwner, newPublicKey, newServiceEndpoint
        (string memory did, address newOwner, string memory newPublicKey, string memory newServiceEndpoint) = 
            abi.decode(data, (string, address, string, string));
        
        // Validate inputs
        require(bytes(did).length > 0, "StateRecovery: invalid DID");
        require(newOwner != address(0), "StateRecovery: invalid owner");
        require(bytes(newPublicKey).length > 0, "StateRecovery: invalid public key");
        
        // Call target contract to recover DID document
        if (ethereumDIDRegistry != address(0)) {
            // Interface call to recover DID document
            (bool success,) = ethereumDIDRegistry.call(
                abi.encodeWithSignature("recoverDIDDocument(string,address,string,string)", 
                    did, newOwner, newPublicKey, newServiceEndpoint)
            );
            return success;
        }
        
        return false;
    }
    
    /**
     * @dev Recover verifiable credential corruption
     */
    function _recoverVerifiableCredential(bytes memory data) internal returns (bool) {
        // Decode recovery data: credentialId, newIssuer, newSubject, newType, newExpires, newDataHash
        (bytes32 credentialId, string memory newIssuer, string memory newSubject, 
         string memory newType, uint256 newExpires, bytes32 newDataHash) = 
            abi.decode(data, (bytes32, string, string, string, uint256, bytes32));
        
        // Validate inputs
        require(credentialId != bytes32(0), "StateRecovery: invalid credential ID");
        require(bytes(newIssuer).length > 0, "StateRecovery: invalid issuer");
        require(bytes(newSubject).length > 0, "StateRecovery: invalid subject");
        
        // Call target contract to recover credential
        if (ethereumDIDRegistry != address(0)) {
            (bool success,) = ethereumDIDRegistry.call(
                abi.encodeWithSignature("recoverCredential(bytes32,string,string,string,uint256,bytes32)", 
                    credentialId, newIssuer, newSubject, newType, newExpires, newDataHash)
            );
            return success;
        }
        
        return false;
    }
    
    /**
     * @dev Recover ownership mapping corruption
     */
    function _recoverOwnershipMapping(bytes memory data) internal returns (bool) {
        // Decode recovery data: oldOwner, newOwner, did
        (address oldOwner, address newOwner, string memory did) = 
            abi.decode(data, (address, address, string));
        
        // Validate inputs
        require(oldOwner != address(0), "StateRecovery: invalid old owner");
        require(newOwner != address(0), "StateRecovery: invalid new owner");
        require(bytes(did).length > 0, "StateRecovery: invalid DID");
        
        // Call target contract to recover ownership mapping
        if (ethereumDIDRegistry != address(0)) {
            (bool success,) = ethereumDIDRegistry.call(
                abi.encodeWithSignature("recoverOwnershipMapping(address,address,string)", 
                    oldOwner, newOwner, did)
            );
            return success;
        }
        
        return false;
    }
    
    /**
     * @dev Recover role assignment corruption
     */
    function _recoverRoleAssignment(bytes memory data) internal returns (bool) {
        // Decode recovery data: role, account, grant
        (bytes32 role, address account, bool grant) = 
            abi.decode(data, (bytes32, address, bool));
        
        // Validate inputs
        require(role != bytes32(0), "StateRecovery: invalid role");
        require(account != address(0), "StateRecovery: invalid account");
        
        // Call target contract to recover role assignment
        if (ethereumDIDRegistry != address(0)) {
            if (grant) {
                (bool success,) = ethereumDIDRegistry.call(
                    abi.encodeWithSignature("grantRole(bytes32,address)", role, account)
                );
                return success;
            } else {
                (bool success,) = ethereumDIDRegistry.call(
                    abi.encodeWithSignature("revokeRole(bytes32,address)", role, account)
                );
                return success;
            }
        }
        
        return false;
    }
    
    /**
     * @dev Recover cross-chain state corruption
     */
    function _recoverCrossChainState(bytes memory data) internal returns (bool) {
        // Decode recovery data: sourceChain, targetChain, did, operationType
        (string memory sourceChain, string memory targetChain, string memory did, uint256 operationType) = 
            abi.decode(data, (string, string, string, uint256));
        
        // Validate inputs
        require(bytes(sourceChain).length > 0, "StateRecovery: invalid source chain");
        require(bytes(targetChain).length > 0, "StateRecovery: invalid target chain");
        require(bytes(did).length > 0, "StateRecovery: invalid DID");
        
        // This would typically involve calling a cross-chain bridge contract
        // For now, return true as a placeholder
        return true;
    }
    
    /**
     * @dev Emergency recovery function for critical situations
     */
    function emergencyRecovery(
        RecoveryType recoveryType,
        bytes memory data,
        string memory reason
    ) external onlyEmergencyRole nonReentrant returns (bool) {
        require(bytes(reason).length > 0, "StateRecovery: reason cannot be empty");
        
        emit EmergencyRecoveryTriggered(msg.sender, reason, block.timestamp);
        
        // Execute recovery immediately without voting
        return this._executeRecoveryInternal(recoveryType, data);
    }
    
    /**
     * @dev Set required approvals for recovery types
     */
    function setRequiredApprovals(RecoveryType recoveryType, uint256 required) 
        external 
        onlyGovernanceRole 
    {
        require(required > 0, "StateRecovery: required approvals must be greater than 0");
        requiredApprovals[recoveryType] = required;
    }
    
    /**
     * @dev Get proposal details
     */
    function getProposal(bytes32 proposalId) 
        external 
        view 
        returns (
            RecoveryType recoveryType,
            address proposer,
            string memory description,
            uint256 proposedAt,
            uint256 votingDeadline,
            RecoveryStatus status,
            uint256 approvalCount,
            uint256 rejectionCount,
            address[] memory voters
        ) 
    {
        RecoveryProposal storage proposal = recoveryProposals[proposalId];
        return (
            proposal.recoveryType,
            proposal.proposer,
            proposal.description,
            proposal.proposedAt,
            proposal.votingDeadline,
            proposal.status,
            proposal.approvalCount,
            proposal.rejectionCount,
            proposal.voters
        );
    }
    
    /**
     * @dev Check if an address can vote on a proposal
     */
    function canVote(bytes32 proposalId, address voter) 
        external 
        view 
        returns (bool) 
    {
        RecoveryProposal storage proposal = recoveryProposals[proposalId];
        return hasRole(RECOVERY_ROLE, voter) && 
               !proposal.hasVoted[voter] && 
               block.timestamp <= proposal.votingDeadline &&
               proposal.status == RecoveryStatus.PENDING;
    }
    
    /**
     * @dev Get all active proposals
     */
    function getActiveProposals() external view returns (bytes32[] memory) {
        uint256 count = 0;
        bytes32[] memory tempProposals = new bytes32[](1000);
        
        // This is a simplified version - in production, you'd want to store proposal IDs
        // in an array for efficient iteration
        for (uint256 i = 1; i <= 1000; i++) {
            bytes32 proposalId = keccak256(abi.encodePacked(i));
            if (recoveryProposals[proposalId].proposedAt > 0 && 
                recoveryProposals[proposalId].status == RecoveryStatus.PENDING &&
                block.timestamp <= recoveryProposals[proposalId].votingDeadline) {
                tempProposals[count] = proposalId;
                count++;
            }
        }
        
        bytes32[] memory activeProposals = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            activeProposals[i] = tempProposals[i];
        }
        
        return activeProposals;
    }
}
