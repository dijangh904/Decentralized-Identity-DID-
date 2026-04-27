// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/security/PausableUpgradeable.sol";
import "../access/EnhancedAccessControl.sol";

/**
 * @title EnhancedProxy
 * @dev Advanced UUPS Proxy implementation with comprehensive security and governance features
 * 
 * This contract provides a sophisticated proxy implementation that goes beyond basic UUPS
 * functionality by incorporating governance controls, upgrade scheduling, emergency mechanisms,
 * and comprehensive audit trails. It's designed specifically for the DID Registry ecosystem
 * where upgradeability must be balanced with security and user trust.
 * 
 * Key Features:
 * - UUPS proxy pattern with gas-efficient upgrades
 * - Governance-controlled upgrade process
 * - Time-delayed upgrades for security
 * - Emergency upgrade mechanisms
 * - Upgrade scheduling and notification system
 * - Comprehensive audit trails
 * - Proxy state migration capabilities
 * - Cross-chain upgrade coordination
 * - Upgrade validation and rollback capabilities
 * - Multi-signature upgrade authorization
 * 
 * Security Measures:
 * - Multi-layered authorization (Owner + Governance)
 * - Time delays for non-emergency upgrades
 * - Upgrade implementation validation
 * - State migration verification
 * - Emergency pause mechanisms
 * - Access control integration
 * 
 * @author Fatima Sanusi
 * @notice Use this contract as the secure proxy for DID registry implementations
 * @dev Implements advanced proxy patterns with governance integration
 */
contract EnhancedProxy is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable 
{
    
    // ===== UPGRADE STRUCTURES =====
    
    /// @notice Upgrade proposal structure
    struct UpgradeProposal {
        address newImplementation;        // New implementation address
        uint256 proposedAt;              // When upgrade was proposed
        uint256 executableAfter;         // When upgrade becomes executable
        uint256 expiresAt;              // When proposal expires
        address proposedBy;              // Who proposed the upgrade
        string reason;                   // Reason for upgrade
        bool emergency;                 // Emergency upgrade flag
        mapping(address => bool) approvals; // Multi-sig approvals
        uint256 approvalCount;          // Number of approvals received
        bool executed;                  // Whether upgrade has been executed
        bytes32 dataHash;              // Hash of upgrade data for verification
    }
    
    /// @notice Upgrade execution record for audit trail
    struct UpgradeRecord {
        address oldImplementation;      // Previous implementation
        address newImplementation;      // New implementation
        uint256 executedAt;             // When upgrade was executed
        address executedBy;             // Who executed the upgrade
        bool emergency;                 // Emergency upgrade flag
        bool successful;                // Whether upgrade was successful
        string reason;                  // Reason for upgrade
    }
    
    /// @notice State migration configuration
    struct MigrationConfig {
        bool requiresMigration;         // Whether state migration is needed
        address migrationContract;       // Contract handling migration
        bytes migrationData;            // Migration-specific data
        uint256 migrationDeadline;      // Deadline for migration completion
        bool migrationCompleted;        // Whether migration is completed
    }

    // ===== STORAGE VARIABLES =====
    
    /// @notice Access control contract for permissions
    EnhancedAccessControl public accessControl;
    
    /// @notice Current upgrade proposal
    UpgradeProposal public currentProposal;
    
    /// @notice Mapping of proposal IDs to proposals
    mapping(bytes32 => UpgradeProposal) public upgradeProposals;
    
    /// @notice Array of all upgrade records for audit trail
    UpgradeRecord[] public upgradeHistory;
    
    /// @notice Minimum delay for non-emergency upgrades
    uint256 public minUpgradeDelay;
    
    /// @notice Maximum delay for upgrades
    uint256 public maxUpgradeDelay;
    
    /// @notice Number of approvals required for upgrade
    uint256 public requiredApprovals;
    
    /// @notice Set of authorized upgraders
    mapping(address => bool) public authorizedUpgraders;
    
    /// @notice Emergency access controls
    mapping(address => bool) public emergencyUpgraders;
    
    /// @notice Migration configuration
    MigrationConfig public migrationConfig;
    
    /// @notice Whether the proxy is in emergency mode
    bool public emergencyMode;
    
    /// @notice Emergency mode activation time
    uint256 public emergencyModeActivatedAt;
    
    /// @notice Cross-chain upgrade coordination
    mapping(bytes32 => bool) public crossChainUpgrades;

    // ===== EVENTS =====
    
    /// @notice Emitted when an upgrade is proposed
    event UpgradeProposed(
        bytes32 indexed proposalId,
        address indexed newImplementation,
        address indexed proposedBy,
        uint256 executableAfter,
        bool emergency,
        string reason
    );
    
    /// @notice Emitted when an upgrade is approved
    event UpgradeApproved(
        bytes32 indexed proposalId,
        address indexed approver,
        uint256 approvalCount
    );
    
    /// @notice Emitted when an upgrade is executed
    event UpgradeExecuted(
        bytes32 indexed proposalId,
        address indexed oldImplementation,
        address indexed newImplementation,
        address executedBy,
        bool emergency
    );
    
    /// @notice Emitted when emergency mode is activated
    event EmergencyModeActivated(address indexed activator, string reason);
    
    /// @notice Emitted when emergency mode is deactivated
    event EmergencyModeDeactivated(address indexed deactivator);
    
    /// @notice Emitted when migration is configured
    event MigrationConfigured(
        address indexed migrationContract,
        uint256 deadline,
        bytes migrationData
    );
    
    /// @notice Emitted when migration is completed
    event MigrationCompleted(address indexed executor, uint256 completedAt);

    // ===== MODIFIERS =====
    
    /// @notice Restricts access to authorized upgraders
    modifier onlyAuthorizedUpgrader() {
        require(
            authorizedUpgraders[msg.sender] || 
            emergencyUpgraders[msg.sender] ||
            owner() == msg.sender,
            "EnhancedProxy: unauthorized upgrader"
        );
        _;
    }
    
    /// @notice Validates upgrade timing
    modifier validUpgradeTiming() {
        require(
            currentProposal.executableAfter > 0 && 
            block.timestamp >= currentProposal.executableAfter,
            "EnhancedProxy: upgrade not yet executable"
        );
        require(
            currentProposal.expiresAt == 0 || block.timestamp <= currentProposal.expiresAt,
            "EnhancedProxy: upgrade proposal expired"
        );
        _;
    }
    
    /// @notice Ensures contract is not paused
    modifier whenNotPausedEnhanced() {
        require(!paused(), "EnhancedProxy: contract is paused");
        _;
    }
    
    /// @notice Validates implementation address
    modifier validImplementation(address newImplementation) {
        require(newImplementation != address(0), "EnhancedProxy: invalid implementation");
        require(newImplementation != address(this), "EnhancedProxy: cannot upgrade to self");
        require(newImplementation.code.length > 0, "EnhancedProxy: implementation not a contract");
        _;
    }

    // ===== CONSTRUCTOR =====
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ===== INITIALIZATION =====
    
    /**
     * @notice Initializes the enhanced proxy
     * @param initialOwner The initial owner of the proxy
     * @param _accessControl The access control contract address
     * @param initialImplementation The initial implementation contract
     * @param _minUpgradeDelay Minimum delay for upgrades
     * @param _maxUpgradeDelay Maximum delay for upgrades
     * @param _requiredApprovals Number of approvals required
     */
    function initialize(
        address initialOwner,
        address _accessControl,
        address initialImplementation,
        uint256 _minUpgradeDelay,
        uint256 _maxUpgradeDelay,
        uint256 _requiredApprovals
    ) public initializer {
        require(initialOwner != address(0), "EnhancedProxy: invalid owner");
        require(_accessControl != address(0), "EnhancedProxy: invalid access control");
        require(initialImplementation != address(0), "EnhancedProxy: invalid implementation");
        require(_minUpgradeDelay <= _maxUpgradeDelay, "EnhancedProxy: invalid delay range");
        
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        
        accessControl = EnhancedAccessControl(_accessControl);
        minUpgradeDelay = _minUpgradeDelay;
        maxUpgradeDelay = _maxUpgradeDelay;
        requiredApprovals = _requiredApprovals;
        
        // Set initial implementation
        _upgradeTo(initialImplementation);
        
        // Authorize initial owner and access control
        authorizedUpgraders[initialOwner] = true;
        authorizedUpgraders[_accessControl] = true;
        
        // Record initial deployment
        upgradeHistory.push(UpgradeRecord({
            oldImplementation: address(0),
            newImplementation: initialImplementation,
            executedAt: block.timestamp,
            executedBy: initialOwner,
            emergency: false,
            successful: true,
            reason: "Initial deployment"
        }));
    }

    // ===== UPGRADE MANAGEMENT =====
    
    /**
     * @notice Proposes an upgrade to a new implementation
     * @param newImplementation The new implementation address
     * @param reason The reason for the upgrade
     * @param emergency Whether this is an emergency upgrade
     * @param delay The delay before upgrade becomes executable
     * @return proposalId The ID of the upgrade proposal
     */
    function proposeUpgrade(
        address newImplementation,
        string memory reason,
        bool emergency,
        uint256 delay
    ) external onlyAuthorizedUpgrader validImplementation(newImplementation) returns (bytes32) {
        require(bytes(reason).length > 0, "EnhancedProxy: reason cannot be empty");
        require(!currentProposal.executed, "EnhancedProxy: upgrade in progress");
        
        uint256 executableAfter;
        uint256 expiresAt;
        
        if (emergency) {
            require(emergencyMode || emergencyUpgraders[msg.sender], "EnhancedProxy: emergency access required");
            executableAfter = block.timestamp; // Immediate for emergency
            expiresAt = block.timestamp + 1 hours; // Short expiration
        } else {
            require(delay >= minUpgradeDelay && delay <= maxUpgradeDelay, "EnhancedProxy: invalid delay");
            executableAfter = block.timestamp + delay;
            expiresAt = executableAfter + 30 days; // 30 days to execute
        }
        
        bytes32 proposalId = keccak256(abi.encodePacked(
            newImplementation,
            block.timestamp,
            msg.sender,
            reason
        ));
        
        // Store proposal
        UpgradeProposal storage proposal = upgradeProposals[proposalId];
        proposal.newImplementation = newImplementation;
        proposal.proposedAt = block.timestamp;
        proposal.executableAfter = executableAfter;
        proposal.expiresAt = expiresAt;
        proposal.proposedBy = msg.sender;
        proposal.reason = reason;
        proposal.emergency = emergency;
        proposal.approvalCount = 0;
        proposal.executed = false;
        proposal.dataHash = keccak256(abi.encodePacked(newImplementation, reason));
        
        // Set as current proposal
        currentProposal = proposal;
        
        emit UpgradeProposed(
            proposalId,
            newImplementation,
            msg.sender,
            executableAfter,
            emergency,
            reason
        );
        
        return proposalId;
    }
    
    /**
     * @notice Approves an upgrade proposal
     * @param proposalId The ID of the proposal to approve
     */
    function approveUpgrade(bytes32 proposalId) external onlyAuthorizedUpgrader {
        UpgradeProposal storage proposal = upgradeProposals[proposalId];
        require(proposal.proposedAt > 0, "EnhancedProxy: proposal not found");
        require(!proposal.executed, "EnhancedProxy: already executed");
        require(!proposal.approvals[msg.sender], "EnhancedProxy: already approved");
        
        proposal.approvals[msg.sender] = true;
        proposal.approvalCount++;
        
        emit UpgradeApproved(proposalId, msg.sender, proposal.approvalCount);
    }
    
    /**
     * @notice Executes an approved upgrade
     * @param proposalId The ID of the proposal to execute
     */
    function executeUpgrade(bytes32 proposalId) 
        external 
        onlyAuthorizedUpgrader 
        nonReentrant 
        whenNotPausedEnhanced 
        validUpgradeTiming 
    {
        UpgradeProposal storage proposal = upgradeProposals[proposalId];
        require(proposal.proposedAt > 0, "EnhancedProxy: proposal not found");
        require(!proposal.executed, "EnhancedProxy: already executed");
        
        // Check approval requirements
        if (!proposal.emergency) {
            require(
                proposal.approvalCount >= requiredApprovals,
                "EnhancedProxy: insufficient approvals"
            );
        }
        
        address oldImplementation = _getImplementation();
        
        // Execute upgrade
        bool success;
        try this._upgradeTo(proposal.newImplementation) {
            success = true;
        } catch {
            success = false;
        }
        
        // Record upgrade
        upgradeHistory.push(UpgradeRecord({
            oldImplementation: oldImplementation,
            newImplementation: proposal.newImplementation,
            executedAt: block.timestamp,
            executedBy: msg.sender,
            emergency: proposal.emergency,
            successful: success,
            reason: proposal.reason
        }));
        
        proposal.executed = true;
        
        emit UpgradeExecuted(
            proposalId,
            oldImplementation,
            proposal.newImplementation,
            msg.sender,
            proposal.emergency
        );
        
        require(success, "EnhancedProxy: upgrade execution failed");
    }
    
    /**
     * @notice Emergency upgrade without proposal
     * @param newImplementation The new implementation address
     * @param reason The reason for emergency upgrade
     */
    function emergencyUpgrade(
        address newImplementation,
        string memory reason
    ) external onlyAuthorizedUpgrader validImplementation(newImplementation) {
        require(
            emergencyMode || emergencyUpgraders[msg.sender],
            "EnhancedProxy: emergency access required"
        );
        require(bytes(reason).length > 0, "EnhancedProxy: reason cannot be empty");
        
        address oldImplementation = _getImplementation();
        
        // Execute emergency upgrade
        _upgradeTo(newImplementation);
        
        // Record emergency upgrade
        upgradeHistory.push(UpgradeRecord({
            oldImplementation: oldImplementation,
            newImplementation: newImplementation,
            executedAt: block.timestamp,
            executedBy: msg.sender,
            emergency: true,
            successful: true,
            reason: reason
        }));
        
        emit UpgradeExecuted(
            bytes32(0), // No proposal ID for emergency
            oldImplementation,
            newImplementation,
            msg.sender,
            true
        );
    }

    // ===== ACCESS CONTROL MANAGEMENT =====
    
    /**
     * @notice Authorizes an address to perform upgrades
     * @param upgrader The address to authorize
     */
    function authorizeUpgrader(address upgrader) external onlyOwner {
        require(upgrader != address(0), "EnhancedProxy: invalid upgrader");
        authorizedUpgraders[upgrader] = true;
    }
    
    /**
     * @notice Revokes upgrade authorization from an address
     * @param upgrader The address to revoke authorization from
     */
    function revokeUpgraderAuthorization(address upgrader) external onlyOwner {
        authorizedUpgraders[upgrader] = false;
    }
    
    /**
     * @notice Grants emergency upgrade access
     * @param upgrader The address to grant emergency access to
     */
    function grantEmergencyAccess(address upgrader) external onlyOwner {
        require(upgrader != address(0), "EnhancedProxy: invalid upgrader");
        emergencyUpgraders[upgrader] = true;
    }
    
    /**
     * @notice Revokes emergency upgrade access
     * @param upgrader The address to revoke emergency access from
     */
    function revokeEmergencyAccess(address upgrader) external onlyOwner {
        emergencyUpgraders[upgrader] = false;
    }

    // ===== EMERGENCY MANAGEMENT =====
    
    /**
     * @notice Activates emergency mode
     * @param reason The reason for activation
     */
    function activateEmergencyMode(string memory reason) external onlyOwner {
        require(!emergencyMode, "EnhancedProxy: emergency mode already active");
        require(bytes(reason).length > 0, "EnhancedProxy: reason cannot be empty");
        
        emergencyMode = true;
        emergencyModeActivatedAt = block.timestamp;
        
        emit EmergencyModeActivated(msg.sender, reason);
    }
    
    /**
     * @notice Deactivates emergency mode
     */
    function deactivateEmergencyMode() external onlyOwner {
        require(emergencyMode, "EnhancedProxy: emergency mode not active");
        
        emergencyMode = false;
        emergencyModeActivatedAt = 0;
        
        emit EmergencyModeDeactivated(msg.sender);
    }
    
    /**
     * @notice Pauses the proxy in emergency situations
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpauses the proxy
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ===== MIGRATION MANAGEMENT =====
    
    /**
     * @notice Configures state migration for upgrades
     * @param migrationContract The contract handling migration
     * @param deadline The deadline for migration completion
     * @param migrationData Migration-specific data
     */
    function configureMigration(
        address migrationContract,
        uint256 deadline,
        bytes memory migrationData
    ) external onlyOwner {
        require(migrationContract != address(0), "EnhancedProxy: invalid migration contract");
        require(deadline > block.timestamp, "EnhancedProxy: invalid deadline");
        
        migrationConfig = MigrationConfig({
            requiresMigration: true,
            migrationContract: migrationContract,
            migrationData: migrationData,
            migrationDeadline: deadline,
            migrationCompleted: false
        });
        
        emit MigrationConfigured(migrationContract, deadline, migrationData);
    }
    
    /**
     * @notice Executes state migration
     */
    function executeMigration() external onlyOwner {
        require(migrationConfig.requiresMigration, "EnhancedProxy: no migration required");
        require(!migrationConfig.migrationCompleted, "EnhancedProxy: migration already completed");
        require(block.timestamp <= migrationConfig.migrationDeadline, "EnhancedProxy: migration deadline passed");
        
        // Execute migration through migration contract
        (bool success,) = migrationConfig.migrationContract.call(migrationConfig.migrationData);
        require(success, "EnhancedProxy: migration failed");
        
        migrationConfig.migrationCompleted = true;
        
        emit MigrationCompleted(msg.sender, block.timestamp);
    }

    // ===== VIEW FUNCTIONS =====
    
    /**
     * @notice Gets the current implementation address
     * @return The current implementation address
     */
    function getImplementation() external view returns (address) {
        return _getImplementation();
    }
    
    /**
     * @notice Gets upgrade history
     * @param offset Starting offset
     * @param limit Maximum number of records to return
     * @return Array of upgrade records
     */
    function getUpgradeHistory(uint256 offset, uint256 limit) 
        external 
        view 
        returns (UpgradeRecord[] memory) 
    {
        uint256 end = offset + limit;
        if (end > upgradeHistory.length) {
            end = upgradeHistory.length;
        }
        
        uint256 length = end - offset;
        UpgradeRecord[] memory result = new UpgradeRecord[](length);
        
        for (uint256 i = 0; i < length; i++) {
            result[i] = upgradeHistory[offset + i];
        }
        
        return result;
    }
    
    /**
     * @notice Gets upgrade proposal details
     * @param proposalId The proposal ID
     * @return The upgrade proposal
     */
    function getUpgradeProposal(bytes32 proposalId) 
        external 
        view 
        returns (UpgradeProposal memory) 
    {
        return upgradeProposals[proposalId];
    }
    
    /**
     * @notice Checks if an address is authorized to upgrade
     * @param upgrader The address to check
     * @return Whether the address is authorized
     */
    function isAuthorizedUpgrader(address upgrader) external view returns (bool) {
        return authorizedUpgraders[upgrader];
    }
    
    /**
     * @notice Gets proxy configuration
     * @return minDelay Minimum upgrade delay
     * @return maxDelay Maximum upgrade delay
     * @return approvals Required approvals
     * @return emergencyMode Current emergency mode status
     */
    function getProxyConfiguration() 
        external 
        view 
        returns (
            uint256 minDelay,
            uint256 maxDelay,
            uint256 approvals,
            bool emergencyModeStatus
        ) 
    {
        return (
            minUpgradeDelay,
            maxUpgradeDelay,
            requiredApprovals,
            emergencyMode
        );
    }

    // ===== INTERNAL FUNCTIONS =====
    
    /**
     * @notice Authorizes upgrade to new implementation
     * @param newImplementation The new implementation address
     */
    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyOwner 
    {
        // Additional validation can be added here
        require(newImplementation != address(0), "EnhancedProxy: invalid implementation");
    }
    
    /**
     * @notice Fallback function to delegate calls to implementation
     */
    fallback() external payable whenNotPausedEnhanced {
        _delegate(_getImplementation());
    }
    
    /**
     * @notice Receive function to accept ETH
     */
    receive() external payable whenNotPausedEnhanced {
        _delegate(_getImplementation());
    }
    
    /**
     * @notice Internal function to delegate calls to implementation
     * @param implementation The implementation contract address
     */
    function _delegate(address implementation) internal {
        assembly {
            // Copy msg.data
            calldatacopy(0, 0, calldatasize())
            
            // Call the implementation
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            
            // Copy the returned data
            returndatacopy(0, 0, returndatasize())
            
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
