// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../access/EnhancedAccessControl.sol";

/**
 * @title StateMigration
 * @dev Contract for managing state migration during contract upgrades
 * 
 * This contract provides a secure way to migrate contract state when upgrading
 * between different implementations. It ensures data integrity and provides
 * comprehensive audit trails for all migration operations.
 * 
 * Key Features:
 * - Secure state migration between implementations
 * - Data integrity verification
 * - Rollback capabilities
 * - Migration scheduling and approval
 * - Comprehensive audit trails
 * - Batch migration support
 * - Emergency migration controls
 * 
 * @author Fatima Sanusi
 * @notice Use this contract to manage state migration during upgrades
 */
contract StateMigration is ReentrancyGuard {
    
    using EnhancedAccessControl for EnhancedAccessControl;
    
    // ===== MIGRATION STRUCTURES =====
    
    /// @notice Migration plan structure
    struct MigrationPlan {
        bytes32 planId;                    // Unique plan identifier
        address fromImplementation;        // Source implementation
        address toImplementation;          // Target implementation
        uint256 scheduledAt;              // When migration is scheduled
        uint256 deadline;                 // Migration deadline
        address proposedBy;              // Who proposed the migration
        string reason;                    // Reason for migration
        bool emergency;                   // Emergency migration flag
        mapping(address => bool) approvals; // Multi-sig approvals
        uint256 approvalCount;          // Number of approvals received
        bool executed;                  // Whether migration has been executed
        bool verified;                  // Whether migration was verified
        bytes32 dataHash;              // Hash of migration data
    }
    
    /// @notice Migration execution record
    struct MigrationRecord {
        bytes32 planId;                   // Migration plan ID
        address fromImplementation;       // Source implementation
        address toImplementation;         // Target implementation
        uint256 executedAt;              // When migration was executed
        address executedBy;              // Who executed the migration
        bool successful;                  // Whether migration was successful
        uint256 dataMigrated;            // Amount of data migrated
        uint256 verificationHash;        // Hash of verification data
        string reason;                    // Migration reason
    }
    
    /// @notice Data migration entry
    struct DataEntry {
        bytes32 key;                     // Data key
        bytes oldValue;                  // Old value
        bytes newValue;                  // New value
        bool migrated;                   // Whether migrated
        uint256 migratedAt;              // When migrated
    }
    
    // ===== STORAGE VARIABLES =====
    
    /// @notice Access control contract
    EnhancedAccessControl public immutable accessControl;
    
    /// @notice Mapping of migration plans
    mapping(bytes32 => MigrationPlan) public migrationPlans;
    
    /// @notice Array of all migration records
    MigrationRecord[] public migrationHistory;
    
    /// @notice Mapping of data entries for migration
    mapping(bytes32 => DataEntry) public dataEntries;
    
    /// @notice Array of all data entry keys
    bytes32[] public dataEntryKeys;
    
    /// @notice Minimum approvals required for migration
    uint256 public requiredApprovals;
    
    /// @notice Emergency migration enabled
    bool public emergencyMigrationEnabled;
    
    /// @notice Migration deadline buffer
    uint256 public deadlineBuffer;
    
    // ===== EVENTS =====
    
    /// @notice Emitted when a migration plan is created
    event MigrationPlanCreated(
        bytes32 indexed planId,
        address indexed fromImplementation,
        address indexed toImplementation,
        address proposedBy,
        uint256 scheduledAt,
        bool emergency
    );
    
    /// @notice Emitted when a migration plan is approved
    event MigrationPlanApproved(
        bytes32 indexed planId,
        address indexed approver,
        uint256 approvalCount
    );
    
    /// @notice Emitted when migration is executed
    event MigrationExecuted(
        bytes32 indexed planId,
        address indexed fromImplementation,
        address indexed toImplementation,
        address executedBy,
        bool successful,
        uint256 dataMigrated
    );
    
    /// @notice Emitted when migration is verified
    event MigrationVerified(
        bytes32 indexed planId,
        address indexed verifier,
        uint256 verificationHash
    );
    
    /// @notice Emitted when migration is rolled back
    event MigrationRolledBack(
        bytes32 indexed planId,
        address indexed rolledBackBy,
        string reason
    );
    
    /// @notice Emitted when emergency migration is enabled/disabled
    event EmergencyMigrationToggled(bool enabled, address indexed toggledBy);
    
    // ===== MODIFIERS =====
    
    /// @notice Restricts access to authorized migrators
    modifier onlyAuthorizedMigrator() {
        require(
            accessControl.checkPermission(msg.sender, ResourceType.SYSTEM, OperationType.MIGRATE),
            "StateMigration: unauthorized migrator"
        );
        _;
    }
    
    /// @notice Validates migration plan exists
    modifier validMigrationPlan(bytes32 planId) {
        require(migrationPlans[planId].proposedBy != address(0), "StateMigration: plan not found");
        _;
    }
    
    /// @notice Validates migration timing
    modifier validMigrationTime(bytes32 planId) {
        MigrationPlan storage plan = migrationPlans[planId];
        require(block.timestamp >= plan.scheduledAt, "StateMigration: migration not yet scheduled");
        require(block.timestamp <= plan.deadline, "StateMigration: migration deadline passed");
        _;
    }
    
    /// @notice Validates implementation addresses
    modifier validImplementations(address fromImpl, address toImpl) {
        require(fromImpl != address(0), "StateMigration: invalid from implementation");
        require(toImpl != address(0), "StateMigration: invalid to implementation");
        require(fromImpl != toImpl, "StateMigration: same implementation");
        require(fromImpl.code.length > 0, "StateMigration: from impl not contract");
        require(toImpl.code.length > 0, "StateMigration: to impl not contract");
        _;
    }
    
    // ===== CONSTRUCTOR =====
    
    constructor(address _accessControl, uint256 _requiredApprovals, uint256 _deadlineBuffer) {
        require(_accessControl != address(0), "StateMigration: invalid access control");
        accessControl = EnhancedAccessControl(_accessControl);
        requiredApprovals = _requiredApprovals;
        deadlineBuffer = _deadlineBuffer;
    }
    
    // ===== MIGRATION PLAN MANAGEMENT =====
    
    /**
     * @notice Creates a new migration plan
     * @param fromImplementation Source implementation address
     * @param toImplementation Target implementation address
     * @param scheduledAt When migration should be scheduled
     * @param reason Reason for migration
     * @param emergency Whether this is an emergency migration
     * @return planId The migration plan ID
     */
    function createMigrationPlan(
        address fromImplementation,
        address toImplementation,
        uint256 scheduledAt,
        string memory reason,
        bool emergency
    ) external 
        onlyAuthorizedMigrator 
        validImplementations(fromImplementation, toImplementation) 
        returns (bytes32) 
    {
        require(bytes(reason).length > 0, "StateMigration: reason cannot be empty");
        require(scheduledAt > block.timestamp, "StateMigration: invalid schedule time");
        
        uint256 deadline = scheduledAt + deadlineBuffer;
        
        bytes32 planId = keccak256(abi.encodePacked(
            fromImplementation,
            toImplementation,
            scheduledAt,
            msg.sender,
            block.timestamp
        ));
        
        MigrationPlan storage plan = migrationPlans[planId];
        plan.planId = planId;
        plan.fromImplementation = fromImplementation;
        plan.toImplementation = toImplementation;
        plan.scheduledAt = scheduledAt;
        plan.deadline = deadline;
        plan.proposedBy = msg.sender;
        plan.reason = reason;
        plan.emergency = emergency;
        plan.approvalCount = 0;
        plan.executed = false;
        plan.verified = false;
        plan.dataHash = bytes32(0);
        
        emit MigrationPlanCreated(
            planId,
            fromImplementation,
            toImplementation,
            msg.sender,
            scheduledAt,
            emergency
        );
        
        return planId;
    }
    
    /**
     * @notice Approves a migration plan
     * @param planId The migration plan ID
     */
    function approveMigrationPlan(bytes32 planId) 
        external 
        onlyAuthorizedMigrator 
        validMigrationPlan(planId) 
    {
        MigrationPlan storage plan = migrationPlans[planId];
        require(!plan.executed, "StateMigration: plan already executed");
        require(!plan.approvals[msg.sender], "StateMigration: already approved");
        
        plan.approvals[msg.sender] = true;
        plan.approvalCount++;
        
        emit MigrationPlanApproved(planId, msg.sender, plan.approvalCount);
    }
    
    // ===== DATA MIGRATION =====
    
    /**
     * @notice Adds data entry for migration
     * @param planId The migration plan ID
     * @param key The data key
     * @param oldValue The old value
     * @param newValue The new value
     */
    function addDataEntry(
        bytes32 planId,
        bytes32 key,
        bytes memory oldValue,
        bytes memory newValue
    ) external 
        onlyAuthorizedMigrator 
        validMigrationPlan(planId) 
    {
        require(!migrationPlans[planId].executed, "StateMigration: plan already executed");
        
        DataEntry storage entry = dataEntries[keccak256(abi.encodePacked(planId, key))];
        entry.key = key;
        entry.oldValue = oldValue;
        entry.newValue = newValue;
        entry.migrated = false;
        entry.migratedAt = 0;
        
        // Add to keys array if not already present
        bytes32 entryKey = keccak256(abi.encodePacked(planId, key));
        bool found = false;
        for (uint256 i = 0; i < dataEntryKeys.length; i++) {
            if (dataEntryKeys[i] == entryKey) {
                found = true;
                break;
            }
        }
        if (!found) {
            dataEntryKeys.push(entryKey);
        }
    }
    
    /**
     * @notice Executes migration plan
     * @param planId The migration plan ID
     * @return successful Whether migration was successful
     */
    function executeMigration(bytes32 planId) 
        external 
        onlyAuthorizedMigrator 
        validMigrationPlan(planId) 
        validMigrationTime(planId) 
        nonReentrant 
        returns (bool) 
    {
        MigrationPlan storage plan = migrationPlans[planId];
        require(!plan.executed, "StateMigration: plan already executed");
        
        // Check approval requirements
        if (!plan.emergency && !emergencyMigrationEnabled) {
            require(
                plan.approvalCount >= requiredApprovals,
                "StateMigration: insufficient approvals"
            );
        }
        
        // Execute data migration
        uint256 dataMigrated = _executeDataMigration(planId);
        
        // Record migration
        MigrationRecord memory record = MigrationRecord({
            planId: planId,
            fromImplementation: plan.fromImplementation,
            toImplementation: plan.toImplementation,
            executedAt: block.timestamp,
            executedBy: msg.sender,
            successful: dataMigrated > 0,
            dataMigrated: dataMigrated,
            verificationHash: keccak256(abi.encodePacked(planId, dataMigrated, block.timestamp)),
            reason: plan.reason
        });
        
        migrationHistory.push(record);
        plan.executed = true;
        
        emit MigrationExecuted(
            planId,
            plan.fromImplementation,
            plan.toImplementation,
            msg.sender,
            record.successful,
            dataMigrated
        );
        
        return record.successful;
    }
    
    /**
     * @notice Verifies migration integrity
     * @param planId The migration plan ID
     * @return verified Whether migration was verified successfully
     */
    function verifyMigration(bytes32 planId) 
        external 
        onlyAuthorizedMigrator 
        validMigrationPlan(planId) 
        returns (bool) 
    {
        MigrationPlan storage plan = migrationPlans[planId];
        require(plan.executed, "StateMigration: plan not executed");
        require(!plan.verified, "StateMigration: already verified");
        
        // Verify data integrity
        bool verified = _verifyDataIntegrity(planId);
        
        if (verified) {
            plan.verified = true;
            
            // Find the migration record and update it
            for (uint256 i = 0; i < migrationHistory.length; i++) {
                if (migrationHistory[i].planId == planId) {
                    migrationHistory[i].verificationHash = keccak256(
                        abi.encodePacked(planId, verified, block.timestamp)
                    );
                    break;
                }
            }
            
            emit MigrationVerified(planId, msg.sender, uint256(keccak256(abi.encodePacked(planId, verified))));
        }
        
        return verified;
    }
    
    /**
     * @notice Rolls back a migration
     * @param planId The migration plan ID
     * @param reason Reason for rollback
     * @return successful Whether rollback was successful
     */
    function rollbackMigration(bytes32 planId, string memory reason) 
        external 
        onlyAuthorizedMigrator 
        validMigrationPlan(planId) 
        nonReentrant 
        returns (bool) 
    {
        MigrationPlan storage plan = migrationPlans[planId];
        require(plan.executed, "StateMigration: plan not executed");
        require(bytes(reason).length > 0, "StateMigration: reason cannot be empty");
        
        // Execute rollback
        bool successful = _executeRollback(planId);
        
        if (successful) {
            emit MigrationRolledBack(planId, msg.sender, reason);
        }
        
        return successful;
    }
    
    // ===== VIEW FUNCTIONS =====
    
    /**
     * @notice Gets migration plan details
     * @param planId The migration plan ID
     * @return plan The migration plan
     */
    function getMigrationPlan(bytes32 planId) 
        external 
        view 
        returns (MigrationPlan memory) 
    {
        return migrationPlans[planId];
    }
    
    /**
     * @notice Gets migration history
     * @param offset Starting offset
     * @param limit Maximum number of records to return
     * @return records Array of migration records
     */
    function getMigrationHistory(uint256 offset, uint256 limit) 
        external 
        view 
        returns (MigrationRecord[] memory) 
    {
        uint256 end = offset + limit;
        if (end > migrationHistory.length) {
            end = migrationHistory.length;
        }
        
        uint256 length = end - offset;
        MigrationRecord[] memory result = new MigrationRecord[](length);
        
        for (uint256 i = 0; i < length; i++) {
            result[i] = migrationHistory[offset + i];
        }
        
        return result;
    }
    
    /**
     * @notice Gets data entry for migration
     * @param planId The migration plan ID
     * @param key The data key
     * @return entry The data entry
     */
    function getDataEntry(bytes32 planId, bytes32 key) 
        external 
        view 
        returns (DataEntry memory) 
    {
        return dataEntries[keccak256(abi.encodePacked(planId, key))];
    }
    
    /**
     * @notice Gets migration statistics
     * @return totalPlans Total number of migration plans
     * @return executedPlans Number of executed plans
     * @return verifiedPlans Number of verified plans
     * @return successfulMigrations Number of successful migrations
     */
    function getMigrationStatistics() 
        external 
        view 
        returns (
            uint256 totalPlans,
            uint256 executedPlans,
            uint256 verifiedPlans,
            uint256 successfulMigrations
        ) 
    {
        uint256 executed = 0;
        uint256 verified = 0;
        uint256 successful = 0;
        
        for (uint256 i = 0; i < migrationHistory.length; i++) {
            executed++;
            if (migrationHistory[i].verificationHash != bytes32(0)) {
                verified++;
            }
            if (migrationHistory[i].successful) {
                successful++;
            }
        }
        
        return (
            dataEntryKeys.length, // Approximate total plans
            executed,
            verified,
            successful
        );
    }
    
    // ===== EMERGENCY CONTROLS =====
    
    /**
     * @notice Toggles emergency migration mode
     * @param enabled Whether to enable emergency migration
     */
    function toggleEmergencyMigration(bool enabled) external onlyAuthorizedMigrator {
        emergencyMigrationEnabled = enabled;
        emit EmergencyMigrationToggled(enabled, msg.sender);
    }
    
    /**
     * @notice Updates required approvals
     * @param newRequiredApprovals New required approval count
     */
    function updateRequiredApprovals(uint256 newRequiredApprovals) external onlyAuthorizedMigrator {
        requiredApprovals = newRequiredApprovals;
    }
    
    /**
     * @notice Updates deadline buffer
     * @param newDeadlineBuffer New deadline buffer
     */
    function updateDeadlineBuffer(uint256 newDeadlineBuffer) external onlyAuthorizedMigrator {
        deadlineBuffer = newDeadlineBuffer;
    }
    
    // ===== INTERNAL FUNCTIONS =====
    
    /**
     * @notice Executes data migration for a plan
     */
    function _executeDataMigration(bytes32 planId) internal returns (uint256) {
        uint256 migratedCount = 0;
        
        // Iterate through all data entries for this plan
        for (uint256 i = 0; i < dataEntryKeys.length; i++) {
            bytes32 entryKey = dataEntryKeys[i];
            DataEntry storage entry = dataEntries[entryKey];
            
            // Check if this entry belongs to the current plan
            bytes32 expectedKey = keccak256(abi.encodePacked(planId, entry.key));
            if (entryKey != expectedKey || entry.migrated) {
                continue;
            }
            
            // Perform migration (in a real implementation, this would involve
            // calling the target contract with the new data)
            entry.migrated = true;
            entry.migratedAt = block.timestamp;
            
            migratedCount++;
        }
        
        return migratedCount;
    }
    
    /**
     * @notice Verifies data integrity after migration
     */
    function _verifyDataIntegrity(bytes32 planId) internal view returns (bool) {
        uint256 verifiedCount = 0;
        uint256 totalEntries = 0;
        
        // Check all data entries for this plan
        for (uint256 i = 0; i < dataEntryKeys.length; i++) {
            bytes32 entryKey = dataEntryKeys[i];
            DataEntry storage entry = dataEntries[entryKey];
            
            // Check if this entry belongs to the current plan
            bytes32 expectedKey = keccak256(abi.encodePacked(planId, entry.key));
            if (entryKey != expectedKey) {
                continue;
            }
            
            totalEntries++;
            if (entry.migrated) {
                verifiedCount++;
            }
        }
        
        // All entries should be migrated for successful verification
        return totalEntries > 0 && verifiedCount == totalEntries;
    }
    
    /**
     * @notice Executes rollback for a migration plan
     */
    function _executeRollback(bytes32 planId) internal returns (bool) {
        MigrationPlan storage plan = migrationPlans[planId];
        
        // Reverse the migration by swapping implementations
        // In a real implementation, this would involve more complex logic
        address temp = plan.fromImplementation;
        plan.fromImplementation = plan.toImplementation;
        plan.toImplementation = temp;
        
        // Mark as not executed for re-execution
        plan.executed = false;
        plan.verified = false;
        
        return true;
    }
}
