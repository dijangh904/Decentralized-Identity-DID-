// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IERC725.sol";
import "./interfaces/IERC735.sol";

/**
 * @title StateRecovery
 * @dev Contract state recovery system with governance controls
 * Provides mechanisms to recover from various types of state corruption
 */
contract StateRecovery is AccessControl, ReentrancyGuard {
    
    // Governance roles
    bytes32 public constant RECOVERY_ROLE = keccak256("RECOVERY_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    
    // Recovery operation types
    enum RecoveryType {
        DID_DOCUMENT,
        VERIFIABLE_CREDENTIAL,
        OWNERSHIP_MAPPING,
        ROLE_ASSIGNMENT,
        CROSS_CHAIN_STATE
    }
    
    // Recovery operation status
    enum RecoveryStatus {
        PENDING,
        APPROVED,
        REJECTED,
        EXECUTED,
        FAILED
    }
    
    struct RecoveryProposal {
        bytes32 id;
        RecoveryType recoveryType;
        address proposer;
        string description;
        bytes data;
        uint256 proposedAt;
        uint256 votingDeadline;
        RecoveryStatus status;
        uint256 approvalCount;
        uint256 rejectionCount;
        mapping(address => bool) hasVoted;
        address[] voters;
    }
    
    struct StateSnapshot {
        bytes32 id;
        uint256 timestamp;
        bytes32 merkleRoot;
        string description;
        address creator;
        bool isValid;
    }
    
    // Storage
    mapping(bytes32 => RecoveryProposal) public recoveryProposals;
    mapping(RecoveryType => uint256) public requiredApprovals;
    mapping(bytes32 => StateSnapshot) public stateSnapshots;
    
    // Configuration
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant EMERGENCY_VOTING_PERIOD = 24 hours;
    uint256 public constant MIN_PROPOSAL_DELAY = 1 hours;
    
    // Target contracts for recovery
    address public ethereumDIDRegistry;
    address public stellarDIDRegistry;
    
    // Events
    event RecoveryProposed(
        bytes32 indexed proposalId,
        RecoveryType indexed recoveryType,
        address indexed proposer,
        string description
    );
    
    event RecoveryVoted(
        bytes32 indexed proposalId,
        address indexed voter,
        bool approve,
        string reason
    );
    
    event RecoveryExecuted(
        bytes32 indexed proposalId,
        RecoveryType indexed recoveryType,
        bool success,
        string result
    );
    
    event StateSnapshotCreated(
        bytes32 indexed snapshotId,
        address indexed creator,
        bytes32 merkleRoot
    );
    
    event EmergencyRecoveryTriggered(
        address indexed triggerer,
        string reason,
        uint256 timestamp
    );
    
    modifier onlyRecoveryRole() {
        require(hasRole(RECOVERY_ROLE, msg.sender), "StateRecovery: caller missing RECOVERY_ROLE");
        _;
    }
    
    modifier onlyGovernanceRole() {
        require(hasRole(GOVERNANCE_ROLE, msg.sender), "StateRecovery: caller missing GOVERNANCE_ROLE");
        _;
    }
    
    modifier onlyEmergencyRole() {
        require(hasRole(EMERGENCY_ROLE, msg.sender), "StateRecovery: caller missing EMERGENCY_ROLE");
        _;
    }
    
    modifier validProposal(bytes32 proposalId) {
        require(recoveryProposals[proposalId].proposedAt > 0, "StateRecovery: proposal does not exist");
        _;
    }
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        _grantRole(RECOVERY_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        
        // Set default approval requirements
        requiredApprovals[RecoveryType.DID_DOCUMENT] = 3;
        requiredApprovals[RecoveryType.VERIFIABLE_CREDENTIAL] = 3;
        requiredApprovals[RecoveryType.OWNERSHIP_MAPPING] = 5;
        requiredApprovals[RecoveryType.ROLE_ASSIGNMENT] = 7;
        requiredApprovals[RecoveryType.CROSS_CHAIN_STATE] = 5;
    }
    
    /**
     * @dev Set target contract addresses
     */
    function setTargetContracts(
        address _ethereumDIDRegistry,
        address _stellarDIDRegistry
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_ethereumDIDRegistry != address(0), "Ethereum DID registry cannot be zero address");
        require(_stellarDIDRegistry != address(0), "Stellar DID registry cannot be zero address");
        require(_ethereumDIDRegistry != _stellarDIDRegistry, "Registry addresses cannot be the same");
        require(_ethereumDIDRegistry.code.length > 0, "Ethereum registry must be a contract");
        require(_stellarDIDRegistry.code.length > 0, "Stellar registry must be a contract");
        
        ethereumDIDRegistry = _ethereumDIDRegistry;
        stellarDIDRegistry = _stellarDIDRegistry;
    }
    
    /**
     * @dev Create a state snapshot for recovery reference
     */
    function createStateSnapshot(
        bytes32 merkleRoot,
        string memory description
    ) external onlyRecoveryRole returns (bytes32) {
        require(merkleRoot != bytes32(0), "Merkle root cannot be zero");
        require(bytes(description).length > 0, "Description cannot be empty");
        require(bytes(description).length <= 1024, "Description too long");
        
        bytes32 snapshotId = keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            merkleRoot
        ));
        
        require(stateSnapshots[snapshotId].timestamp == 0, "Snapshot already exists");
        
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
     * @dev Propose a recovery operation
     */
    function proposeRecovery(
        RecoveryType recoveryType,
        string memory description,
        bytes memory data
    ) external onlyRecoveryRole returns (bytes32) {
        require(uint256(recoveryType) <= 4, "Invalid recovery type");
        require(bytes(description).length > 0, "StateRecovery: description cannot be empty");
        require(bytes(description).length <= 1024, "Description too long");
        require(data.length > 0, "StateRecovery: recovery data cannot be empty");
        require(data.length <= 10240, "Recovery data too large");
        
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
     * @dev Vote on a recovery proposal
     */
    function voteOnRecovery(
        bytes32 proposalId,
        bool approve,
        string memory reason
    ) external onlyRecoveryRole validProposal(proposalId) {
        require(bytes(reason).length <= 512, "Reason too long");
        
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
        require(uint256(recoveryType) <= 4, "Invalid recovery type");
        require(data.length > 0, "Recovery data cannot be empty");
        require(data.length <= 10240, "Recovery data too large");
        require(bytes(reason).length > 0, "StateRecovery: reason cannot be empty");
        require(bytes(reason).length <= 512, "Reason too long");
        
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
        require(uint256(recoveryType) <= 4, "Invalid recovery type");
        require(required > 0, "StateRecovery: required approvals must be greater than 0");
        require(required <= 20, "Required approvals too high");
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
