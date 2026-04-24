// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./StateRecovery.sol";

/**
 * @title RecoveryGovernance
 * @dev Advanced governance contract for managing state recovery operations with additional oversight
 * 
 * This contract provides an additional layer of governance control over state recovery operations,
 * implementing a multi-tiered role system with governors, guardians, and auditors. It offers
 * contract pausing capabilities, emergency mode activation, and comprehensive audit trails.
 * 
 * Key Features:
 * - Multi-tiered governance system (Governors, Guardians, Auditors)
 * - Contract pausing and unpausing capabilities
 * - Emergency mode activation for critical situations
 * - Comprehensive operation logging and audit trails
 * - Recovery operation compliance validation
 * - Governance parameter configuration with time-based controls
 * 
 * Governance Roles:
 * - GOVERNOR_ROLE: Can configure governance parameters and execute recovery operations
 * - GUARDIAN_ROLE: Can pause/unpause contracts and manage emergency situations
 * - AUDITOR_ROLE: Can audit recovery operations and access operation history
 * 
 * @author Fatima Sanusi
 * @notice Use this contract to govern and oversee state recovery operations
 * @dev Implements OpenZeppelin AccessControl and ReentrancyGuard for security
 */
contract RecoveryGovernance is AccessControl, ReentrancyGuard {
    
    /// @notice Role for governors who can configure governance parameters and execute recovery operations
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    
    /// @notice Role for guardians who can pause/unpause contracts and manage emergency situations
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    
    /// @notice Role for auditors who can audit recovery operations and access operation history
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    
    /// @notice Structure containing governance configuration parameters
    /// @dev Defines time-based controls and operational parameters for recovery governance
    struct GovernanceConfig {
        /// @notice Minimum delay between proposal creation and execution
        uint256 minProposalDelay;
        /// @notice Maximum voting period for recovery proposals
        uint256 maxVotingPeriod;
        /// @notice Delay period for emergency recovery operations
        uint256 emergencyDelay;
        /// @notice Percentage of votes required for quorum (0-100)
        uint256 quorumPercentage;
        /// @notice Whether emergency mode is currently active
        bool emergencyMode;
        /// @notice Address of the currently paused contract (if any)
        address pausedContract;
    }
    
    /// @notice Structure tracking individual recovery operations
    /// @dev Provides comprehensive audit trail for all recovery operations
    struct RecoveryOperation {
        /// @notice Unique identifier of the recovery proposal
        bytes32 proposalId;
        /// @notice Timestamp when the operation was executed
        uint256 timestamp;
        /// @notice Address that executed the recovery operation
        address executor;
        /// @notice Whether this was an emergency recovery operation
        bool emergency;
        /// @notice Reason provided for the recovery operation
        string reason;
        /// @notice Whether the recovery operation was successful
        bool successful;
    }
    
    /// @notice Current governance configuration
    GovernanceConfig public config;
    
    /// @notice Reference to the StateRecovery contract
    StateRecovery public stateRecovery;
    
    /// @notice Mapping of authorized contract addresses
    mapping(address => bool) public authorizedContracts;
    
    /// @notice Mapping of proposal IDs to their recovery operations
    mapping(bytes32 => RecoveryOperation) public recoveryOperations;
    
    /// @notice Array containing all recovery operations for historical tracking
    RecoveryOperation[] public operationHistory;
    
    /// @notice Emitted when governance configuration parameters are updated
    /// @param minProposalDelay New minimum proposal delay
    /// @param maxVotingPeriod New maximum voting period
    /// @param emergencyDelay New emergency delay period
    /// @param quorumPercentage New quorum percentage requirement
    event GovernanceConfigUpdated(
        uint256 minProposalDelay,
        uint256 maxVotingPeriod,
        uint256 emergencyDelay,
        uint256 quorumPercentage
    );
    
    /// @notice Emitted when a contract is paused
    /// @param contractAddress Address of the paused contract
    /// @param reason Reason for pausing the contract
    event ContractPaused(address indexed contractAddress, string reason);
    
    /// @notice Emitted when a contract is unpaused
    /// @param contractAddress Address of the unpaused contract
    event ContractUnpaused(address indexed contractAddress);
    
    /// @notice Emitted when a recovery operation is logged
    /// @param proposalId Unique identifier of the recovery proposal
    /// @param executor Address that executed the recovery operation
    /// @param emergency Whether this was an emergency recovery
    /// @param successful Whether the recovery operation was successful
    event RecoveryOperationLogged(
        bytes32 indexed proposalId,
        address indexed executor,
        bool emergency,
        bool successful
    );
    
    /// @notice Emitted when emergency mode is activated
    /// @param activator Address that activated emergency mode
    /// @param reason Reason for activating emergency mode
    event EmergencyModeActivated(address indexed activator, string reason);
    
    /// @notice Emitted when emergency mode is deactivated
    /// @param deactivator Address that deactivated emergency mode
    event EmergencyModeDeactivated(address indexed deactivator);
    
    /// @notice Restricts access to addresses with the GOVERNOR_ROLE
    /// @dev Throws if the caller does not have the GOVERNOR_ROLE
    modifier onlyGovernor() {
        require(hasRole(GOVERNOR_ROLE, msg.sender), "RecoveryGovernance: caller missing GOVERNOR_ROLE");
        _;
    }
    
    /// @notice Restricts access to addresses with the GUARDIAN_ROLE
    /// @dev Throws if the caller does not have the GUARDIAN_ROLE
    modifier onlyGuardian() {
        require(hasRole(GUARDIAN_ROLE, msg.sender), "RecoveryGovernance: caller missing GUARDIAN_ROLE");
        _;
    }
    
    /// @notice Restricts access to addresses with the AUDITOR_ROLE
    /// @dev Throws if the caller does not have the AUDITOR_ROLE
    modifier onlyAuditor() {
        require(hasRole(AUDITOR_ROLE, msg.sender), "RecoveryGovernance: caller missing AUDITOR_ROLE");
        _;
    }
    
    /// @notice Validates that a contract is not paused
    /// @param contractAddress Address of the contract to check
    /// @dev Throws if the contract is paused
    modifier whenNotPaused(address contractAddress) {
        require(!authorizedContracts[contractAddress] || config.pausedContract != contractAddress, 
                "RecoveryGovernance: contract is paused");
        _;
    }
    
    /**
     * @notice Initializes the RecoveryGovernance contract
     * @dev Sets up the contract with default roles and governance configuration
     * @param _stateRecovery Address of the StateRecovery contract to govern
     */
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
        require(_minProposalDelay > 0, "Invalid minimum proposal delay");
        require(_maxVotingPeriod > _minProposalDelay, "Invalid voting period");
        require(_quorumPercentage > 0 && _quorumPercentage <= 100, "Invalid quorum percentage");
        
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
        authorizedContracts[contractAddress] = true;
    }
    
    /**
     * @dev Deauthorize a contract
     */
    function deauthorizeContract(address contractAddress) external onlyGovernor {
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
        require(authorizedContracts[contractAddress], "Contract not authorized");
        require(contractAddress != address(stateRecovery), "Cannot pause recovery contract");
        
        config.pausedContract = contractAddress;
        emit ContractPaused(contractAddress, reason);
    }
    
    /**
     * @dev Unpause a contract
     */
    function unpauseContract(address contractAddress) external onlyGuardian {
        require(config.pausedContract == contractAddress, "Contract not paused");
        
        config.pausedContract = address(0);
        emit ContractUnpaused(contractAddress);
    }
    
    /**
     * @dev Activate emergency mode (governor action)
     */
    function activateEmergencyMode(string memory reason) external onlyGovernor {
        config.emergencyMode = true;
        emit EmergencyModeActivated(msg.sender, reason);
    }
    
    /**
     * @dev Deactivate emergency mode
     */
    function deactivateEmergencyMode() external onlyGovernor {
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
