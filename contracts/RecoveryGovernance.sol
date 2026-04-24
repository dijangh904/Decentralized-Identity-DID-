// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./StateRecovery.sol";

/**
 * @title RecoveryGovernance
 * @dev Governance contract for managing state recovery operations
 * Provides additional controls and oversight for recovery processes
 */
contract RecoveryGovernance is AccessControl, ReentrancyGuard {
    
    // Governance roles
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    
    // Governance parameters
    struct GovernanceConfig {
        uint256 minProposalDelay;
        uint256 maxVotingPeriod;
        uint256 emergencyDelay;
        uint256 quorumPercentage;
        bool emergencyMode;
        address pausedContract;
    }
    
    // Recovery operation tracking
    struct RecoveryOperation {
        bytes32 proposalId;
        uint256 timestamp;
        address executor;
        bool emergency;
        string reason;
        bool successful;
    }
    
    // Storage
    GovernanceConfig public config;
    StateRecovery public stateRecovery;
    mapping(address => bool) public authorizedContracts;
    mapping(bytes32 => RecoveryOperation) public recoveryOperations;
    RecoveryOperation[] public operationHistory;
    
    // Events
    event GovernanceConfigUpdated(
        uint256 minProposalDelay,
        uint256 maxVotingPeriod,
        uint256 emergencyDelay,
        uint256 quorumPercentage
    );
    
    event ContractPaused(address indexed contractAddress, string reason);
    event ContractUnpaused(address indexed contractAddress);
    
    event RecoveryOperationLogged(
        bytes32 indexed proposalId,
        address indexed executor,
        bool emergency,
        bool successful
    );
    
    event EmergencyModeActivated(address indexed activator, string reason);
    event EmergencyModeDeactivated(address indexed deactivator);
    
    modifier onlyGovernor() {
        require(hasRole(GOVERNOR_ROLE, msg.sender), "RecoveryGovernance: caller missing GOVERNOR_ROLE");
        _;
    }
    
    modifier onlyGuardian() {
        require(hasRole(GUARDIAN_ROLE, msg.sender), "RecoveryGovernance: caller missing GUARDIAN_ROLE");
        _;
    }
    
    modifier onlyAuditor() {
        require(hasRole(AUDITOR_ROLE, msg.sender), "RecoveryGovernance: caller missing AUDITOR_ROLE");
        _;
    }
    
    modifier whenNotPaused(address contractAddress) {
        require(!authorizedContracts[contractAddress] || config.pausedContract != contractAddress, 
                "RecoveryGovernance: contract is paused");
        _;
    }
    
    constructor(address _stateRecovery) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNOR_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);
        _grantRole(AUDITOR_ROLE, msg.sender);
        
        stateRecovery = StateRecovery(_stateRecovery);
        
        // Initialize default configuration
        config = GovernanceConfig({
            minProposalDelay: 1 hours,
            maxVotingPeriod: 7 days,
            emergencyDelay: 24 hours,
            quorumPercentage: 50,
            emergencyMode: false,
            pausedContract: address(0)
        });
    }
    
    /**
     * @dev Update governance configuration
     */
    function updateGovernanceConfig(
        uint256 _minProposalDelay,
        uint256 _maxVotingPeriod,
        uint256 _emergencyDelay,
        uint256 _quorumPercentage
    ) external onlyGovernor {
        require(_minProposalDelay >= 60, "Minimum proposal delay too short");
        require(_minProposalDelay <= 7 days, "Minimum proposal delay too long");
        require(_maxVotingPeriod >= 1 hours, "Voting period too short");
        require(_maxVotingPeriod <= 30 days, "Voting period too long");
        require(_maxVotingPeriod > _minProposalDelay, "Invalid voting period");
        require(_emergencyDelay >= 1 hours, "Emergency delay too short");
        require(_emergencyDelay <= 7 days, "Emergency delay too long");
        require(_quorumPercentage >= 1, "Quorum percentage too low");
        require(_quorumPercentage <= 100, "Invalid quorum percentage");
        
        config.minProposalDelay = _minProposalDelay;
        config.maxVotingPeriod = _maxVotingPeriod;
        config.emergencyDelay = _emergencyDelay;
        config.quorumPercentage = _quorumPercentage;
        
        emit GovernanceConfigUpdated(_minProposalDelay, _maxVotingPeriod, _emergencyDelay, _quorumPercentage);
    }
    
    /**
     * @dev Authorize a contract for governance oversight
     */
    function authorizeContract(address contractAddress) external onlyGovernor {
        require(contractAddress != address(0), "Contract cannot be zero address");
        require(contractAddress.code.length > 0, "Must be a contract address");
        require(!authorizedContracts[contractAddress], "Contract already authorized");
        authorizedContracts[contractAddress] = true;
    }
    
    /**
     * @dev Deauthorize a contract
     */
    function deauthorizeContract(address contractAddress) external onlyGovernor {
        require(contractAddress != address(0), "Contract cannot be zero address");
        require(authorizedContracts[contractAddress], "Contract not authorized");
        authorizedContracts[contractAddress] = false;
        if (config.pausedContract == contractAddress) {
            config.pausedContract = address(0);
            emit ContractUnpaused(contractAddress);
        }
    }
    
    /**
     * @dev Pause a contract (guardian action)
     */
    function pauseContract(address contractAddress, string memory reason) external onlyGuardian {
        require(contractAddress != address(0), "Contract cannot be zero address");
        require(contractAddress.code.length > 0, "Must be a contract address");
        require(authorizedContracts[contractAddress], "Contract not authorized");
        require(contractAddress != address(stateRecovery), "Cannot pause recovery contract");
        require(config.pausedContract != contractAddress, "Contract already paused");
        require(bytes(reason).length > 0, "Reason cannot be empty");
        require(bytes(reason).length <= 512, "Reason too long");
        
        config.pausedContract = contractAddress;
        emit ContractPaused(contractAddress, reason);
    }
    
    /**
     * @dev Unpause a contract
     */
    function unpauseContract(address contractAddress) external onlyGuardian {
        require(contractAddress != address(0), "Contract cannot be zero address");
        require(config.pausedContract == contractAddress, "Contract not paused");
        
        config.pausedContract = address(0);
        emit ContractUnpaused(contractAddress);
    }
    
    /**
     * @dev Activate emergency mode (governor action)
     */
    function activateEmergencyMode(string memory reason) external onlyGovernor {
        require(!config.emergencyMode, "Emergency mode already active");
        require(bytes(reason).length > 0, "Reason cannot be empty");
        require(bytes(reason).length <= 512, "Reason too long");
        config.emergencyMode = true;
        emit EmergencyModeActivated(msg.sender, reason);
    }
    
    /**
     * @dev Deactivate emergency mode
     */
    function deactivateEmergencyMode() external onlyGovernor {
        require(config.emergencyMode, "Emergency mode not active");
        config.emergencyMode = false;
        emit EmergencyModeDeactivated(msg.sender);
    }
    
    /**
     * @dev Override recovery operation with additional checks
     */
    function governedRecovery(
        uint256 recoveryType,
        bytes memory data,
        string memory reason,
        bool emergency
    ) external onlyGovernor nonReentrant whenNotPaused(address(stateRecovery)) returns (bool) {
        require(bytes(reason).length > 0, "Reason cannot be empty");
        
        if (emergency && !config.emergencyMode) {
            revert("Emergency mode not activated");
        }
        
        // Log the operation before execution
        bytes32 proposalId = keccak256(abi.encodePacked(
            recoveryType,
            msg.sender,
            block.timestamp,
            data
        ));
        
        // Execute recovery through state recovery contract
        bool success;
        if (emergency) {
            success = stateRecovery.emergencyRecovery(
                StateRecovery.RecoveryType(recoveryType),
                data,
                reason
            );
        } else {
            // Create proposal for non-emergency recovery
            proposalId = stateRecovery.proposeRecovery(
                StateRecovery.RecoveryType(recoveryType),
                reason,
                data
            );
            
            // Auto-vote for the proposal
            stateRecovery.voteOnRecovery(proposalId, true, "Governor auto-approval");
            
            // Wait for minimum delay and execute
            // Note: In production, this would require a separate transaction
            success = true; // Placeholder
        }
        
        // Log the operation
        recoveryOperations[proposalId] = RecoveryOperation({
            proposalId: proposalId,
            timestamp: block.timestamp,
            executor: msg.sender,
            emergency: emergency,
            reason: reason,
            successful: success
        });
        
        operationHistory.push(recoveryOperations[proposalId]);
        
        emit RecoveryOperationLogged(proposalId, msg.sender, emergency, success);
        return success;
    }
    
    /**
     * @dev Audit recovery operations (auditor function)
     */
    function auditRecoveryOperation(bytes32 proposalId) 
        external 
        onlyAuditor 
        view 
        returns (
            uint256 timestamp,
            address executor,
            bool emergency,
            string memory reason,
            bool successful
        ) 
    {
        RecoveryOperation memory operation = recoveryOperations[proposalId];
        require(operation.timestamp > 0, "Operation not found");
        
        return (
            operation.timestamp,
            operation.executor,
            operation.emergency,
            operation.reason,
            operation.successful
        );
    }
    
    /**
     * @dev Get operation history
     */
    function getOperationHistory(uint256 offset, uint256 limit) 
        external 
        view 
        returns (RecoveryOperation[] memory) 
    {
        uint256 end = offset + limit;
        if (end > operationHistory.length) {
            end = operationHistory.length;
        }
        
        uint256 length = end - offset;
        RecoveryOperation[] memory result = new RecoveryOperation[](length);
        
        for (uint256 i = 0; i < length; i++) {
            result[i] = operationHistory[offset + i];
        }
        
        return result;
    }
    
    /**
     * @dev Validate recovery operation compliance
     */
    function validateRecoveryCompliance(
        uint256 recoveryType,
        bytes memory data,
        bool emergency
    ) external view returns (bool compliant, string memory issue) {
        // Check if operation type is allowed
        if (recoveryType > 4) {
            return (false, "Invalid recovery type");
        }
        
        // Check emergency mode requirements
        if (emergency && !config.emergencyMode) {
            return (false, "Emergency mode not activated");
        }
        
        // Check data format (basic validation)
        if (data.length == 0) {
            return (false, "Empty recovery data");
        }
        
        // Additional compliance checks based on recovery type
        if (recoveryType == 0) { // DID_DOCUMENT
            try this._validateDIDRecoveryData(data) returns (bool valid) {
                if (!valid) {
                    return (false, "Invalid DID recovery data");
                }
            } catch {
                return (false, "Error validating DID data");
            }
        }
        
        return (true, "Compliant");
    }
    
    /**
     * @dev Internal function to validate DID recovery data
     */
    function _validateDIDRecoveryData(bytes memory data) external pure returns (bool) {
        // Decode and validate DID recovery data
        try abi.decode(data, (string, address, string, string)) returns (
            string memory did,
            address newOwner,
            string memory newPublicKey,
            string memory newServiceEndpoint
        ) {
            return bytes(did).length > 0 && 
                   newOwner != address(0) && 
                   bytes(newPublicKey).length > 0;
        } catch {
            return false;
        }
    }
    
    /**
     * @dev Get governance status
     */
    function getGovernanceStatus() external view returns (
        bool emergencyMode,
        address pausedContract,
        uint256 totalOperations,
        uint256 authorizedContractCount
    ) {
        uint256 count = 0;
        // In production, you'd maintain a list of authorized contracts
        // For now, return a placeholder
        authorizedContractCount = 1; // stateRecovery contract
        
        return (
            config.emergencyMode,
            config.pausedContract,
            operationHistory.length,
            authorizedContractCount
        );
    }
    
    /**
     * @dev Get recovery statistics
     */
    function getRecoveryStatistics() external view returns (
        uint256 totalOperations,
        uint256 successfulOperations,
        uint256 emergencyOperations,
        uint256 failedOperations
    ) {
        uint256 successful = 0;
        uint256 emergency = 0;
        uint256 failed = 0;
        
        for (uint256 i = 0; i < operationHistory.length; i++) {
            if (operationHistory[i].successful) {
                successful++;
            } else {
                failed++;
            }
            
            if (operationHistory[i].emergency) {
                emergency++;
            }
        }
        
        return (
            operationHistory.length,
            successful,
            emergency,
            failed
        );
    }
}
