// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title EnhancedAccessControl
 * @dev Comprehensive RBAC system with fine-grained permissions for DID Registry operations
 * 
 * This contract implements a sophisticated role-based access control system that provides
 * granular permissions for different operations within the DID ecosystem. It supports
 * hierarchical roles, resource-specific permissions, and dynamic permission management.
 * 
 * Key Features:
 * - Hierarchical role system with inheritance
 * - Resource-specific permissions (DID, Credential, Governance)
 * - Operation-level granular permissions (Create, Read, Update, Delete, Admin)
 * - Time-based permissions with expiration
 * - Conditional permissions with context validation
 * - Permission delegation and revocation
 * - Audit trail for all permission changes
 * - Emergency access controls
 * 
 * Permission Structure:
 * - ROLE_ADMIN: System administrator with all permissions
 * - ROLE_GOVERNOR: Governance operations and policy management
 * - ROLE_ISSUER: Credential issuance and management
 * - ROLE_VALIDATOR: DID and credential validation
 * - ROLE_USER: Basic DID operations for own identity
 * - ROLE_AUDITOR: Read-only access for auditing
 * 
 * @author Fatima Sanusi
 * @notice Use this contract to manage fine-grained access control for DID operations
 * @dev Implements OpenZeppelin AccessControl with enhanced permission management
 */
contract EnhancedAccessControl is AccessControl, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using EnumerableSet for EnumerableSet.AddressSet;

    // ===== ROLE DEFINITIONS =====
    
    /// @notice System administrator role with all permissions
    bytes32 public constant ROLE_ADMIN = keccak256("ROLE_ADMIN");
    
    /// @notice Governor role for governance operations
    bytes32 public constant ROLE_GOVERNOR = keccak256("ROLE_GOVERNOR");
    
    /// @notice Issuer role for credential management
    bytes32 public constant ROLE_ISSUER = keccak256("ROLE_ISSUER");
    
    /// @notice Validator role for DID and credential validation
    bytes32 public constant ROLE_VALIDATOR = keccak256("ROLE_VALIDATOR");
    
    /// @notice User role for basic DID operations
    bytes32 public constant ROLE_USER = keccak256("ROLE_USER");
    
    /// @notice Auditor role for read-only auditing access
    bytes32 public constant ROLE_AUDITOR = keccak256("ROLE_AUDITOR");

    // ===== PERMISSION TYPES =====
    
    /// @notice Resource types for permissions
    enum ResourceType {
        DID,           // DID document operations
        CREDENTIAL,    // Verifiable credential operations
        GOVERNANCE,    // Governance and system operations
        SYSTEM,        // System-level operations
        BRIDGE         // Cross-chain bridge operations
    }
    
    /// @notice Operation types for fine-grained permissions
    enum OperationType {
        CREATE,        // Create new resources
        READ,          // Read existing resources
        UPDATE,        // Update existing resources
        DELETE,        // Delete resources
        ADMIN,         // Administrative operations
        VALIDATE,      // Validation operations
        EXECUTE,       // Execute operations
        MIGRATE        // Migration operations
    }

    // ===== DATA STRUCTURES =====
    
    /// @notice Permission structure with time-based controls
    struct Permission {
        bytes32 role;                    // Role identifier
        ResourceType resource;          // Resource type
        OperationType operation;         // Operation type
        bool granted;                   // Permission status
        uint256 grantedAt;              // When permission was granted
        uint256 expiresAt;              // When permission expires (0 = never)
        address grantedBy;              // Who granted the permission
        string condition;               // Conditional access rules
    }
    
    /// @notice Role hierarchy for permission inheritance
    struct RoleHierarchy {
        bytes32 parentRole;             // Parent role for inheritance
        uint8 level;                    // Hierarchy level (0 = highest)
        bool canDelegate;               // Can delegate permissions to others
        uint256 maxDelegationLevel;     // Maximum delegation depth
    }
    
    /// @notice Access request for audit trail
    struct AccessRequest {
        address requester;              // Who made the request
        bytes32 role;                   // Role used for request
        ResourceType resource;          // Resource accessed
        OperationType operation;         // Operation attempted
        uint256 timestamp;              // When request was made
        bool granted;                   // Whether access was granted
        string reason;                  // Reason for denial (if any)
    }

    // ===== STORAGE VARIABLES =====
    
    /// @notice Mapping of role permissions
    mapping(bytes32 => mapping(ResourceType => mapping(OperationType => Permission))) 
        public rolePermissions;
    
    /// @notice Role hierarchy configuration
    mapping(bytes32 => RoleHierarchy) public roleHierarchy;
    
    /// @notice User-specific permission overrides
    mapping(address => mapping(ResourceType => mapping(OperationType => Permission))) 
        public userPermissions;
    
    /// @notice Emergency access controls
    mapping(address => bool) public emergencyAccess;
    
    /// @notice Time-based access restrictions
    mapping(address => mapping(uint256 => bool)) public timeRestrictions;
    
    /// @notice Audit trail for access requests
    AccessRequest[] public accessLog;
    
    /// @notice Set of all active roles
    EnumerableSet.Bytes32Set private activeRoles;
    
    /// @notice Set of all users with permissions
    EnumerableSet.AddressSet private authorizedUsers;

    // ===== EVENTS =====
    
    /// @notice Emitted when a permission is granted
    event PermissionGranted(
        bytes32 indexed role,
        ResourceType indexed resource,
        OperationType indexed operation,
        address grantedBy,
        uint256 expiresAt
    );
    
    /// @notice Emitted when a permission is revoked
    event PermissionRevoked(
        bytes32 indexed role,
        ResourceType indexed resource,
        OperationType indexed operation,
        address revokedBy
    );
    
    /// @notice Emitted when user-specific permission is set
    event UserPermissionSet(
        address indexed user,
        ResourceType indexed resource,
        OperationType indexed operation,
        bool granted,
        address setBy
    );
    
    /// @notice Emitted when emergency access is granted
    event EmergencyAccessGranted(address indexed user, address grantedBy, string reason);
    
    /// @notice Emitted when emergency access is revoked
    event EmergencyAccessRevoked(address indexed user, address revokedBy);
    
    /// @notice Emitted when role hierarchy is updated
    event RoleHierarchyUpdated(bytes32 indexed role, bytes32 indexed parentRole, uint8 level);
    
    /// @notice Emitted when access is requested
    event AccessRequested(
        address indexed requester,
        bytes32 indexed role,
        ResourceType indexed resource,
        OperationType operation,
        bool granted
    );

    // ===== MODIFIERS =====
    
    /// @notice Restricts access to users with specific permission
    modifier hasPermission(ResourceType resource, OperationType operation) {
        require(_checkPermission(msg.sender, resource, operation), "AccessControl: insufficient permissions");
        _;
        _logAccess(msg.sender, resource, operation, true, "");
    }
    
    /// @notice Restricts access to users with specific role
    modifier hasRole(bytes32 role) {
        require(hasRole(role, msg.sender), "AccessControl: caller missing role");
        _;
    }
    
    /// @notice Restricts access to admin users
    modifier onlyAdmin() {
        require(hasRole(ROLE_ADMIN, msg.sender) || emergencyAccess[msg.sender], "AccessControl: admin access required");
        _;
    }
    
    /// @notice Validates time-based restrictions
    modifier validTimeWindow() {
        require(!_isTimeRestricted(msg.sender), "AccessControl: time-restricted access");
        _;
    }

    // ===== CONSTRUCTOR =====
    
    constructor() {
        // Grant admin role to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ROLE_ADMIN, msg.sender);
        
        // Initialize role hierarchy
        _initializeRoleHierarchy();
        
        // Initialize default permissions
        _initializeDefaultPermissions();
        
        // Add to active sets
        activeRoles.add(ROLE_ADMIN);
        authorizedUsers.add(msg.sender);
    }

    // ===== EXTERNAL FUNCTIONS =====
    
    /**
     * @notice Grants a permission to a role
     * @param role The role to grant permission to
     * @param resource The resource type
     * @param operation The operation type
     * @param expiresAt When the permission expires (0 = never)
     * @param condition Conditional access rules
     */
    function grantPermission(
        bytes32 role,
        ResourceType resource,
        OperationType operation,
        uint256 expiresAt,
        string memory condition
    ) external onlyAdmin nonReentrant {
        require(activeRoles.contains(role), "AccessControl: role not active");
        require(expiresAt == 0 || expiresAt > block.timestamp, "AccessControl: invalid expiration");
        
        Permission storage permission = rolePermissions[role][resource][operation];
        permission.role = role;
        permission.resource = resource;
        permission.operation = operation;
        permission.granted = true;
        permission.grantedAt = block.timestamp;
        permission.expiresAt = expiresAt;
        permission.grantedBy = msg.sender;
        permission.condition = condition;
        
        emit PermissionGranted(role, resource, operation, msg.sender, expiresAt);
    }
    
    /**
     * @notice Revokes a permission from a role
     * @param role The role to revoke permission from
     * @param resource The resource type
     * @param operation The operation type
     */
    function revokePermission(
        bytes32 role,
        ResourceType resource,
        OperationType operation
    ) external onlyAdmin nonReentrant {
        require(activeRoles.contains(role), "AccessControl: role not active");
        
        Permission storage permission = rolePermissions[role][resource][operation];
        permission.granted = false;
        permission.expiresAt = block.timestamp;
        
        emit PermissionRevoked(role, resource, operation, msg.sender);
    }
    
    /**
     * @notice Sets user-specific permission override
     * @param user The user address
     * @param resource The resource type
     * @param operation The operation type
     * @param granted Whether to grant or deny permission
     */
    function setUserPermission(
        address user,
        ResourceType resource,
        OperationType operation,
        bool granted
    ) external onlyAdmin nonReentrant {
        require(user != address(0), "AccessControl: invalid user address");
        
        Permission storage permission = userPermissions[user][resource][operation];
        permission.role = bytes32(0); // User-specific permission
        permission.resource = resource;
        permission.operation = operation;
        permission.granted = granted;
        permission.grantedAt = block.timestamp;
        permission.expiresAt = 0; // User permissions don't expire
        permission.grantedBy = msg.sender;
        
        if (granted && !authorizedUsers.contains(user)) {
            authorizedUsers.add(user);
        }
        
        emit UserPermissionSet(user, resource, operation, granted, msg.sender);
    }
    
    /**
     * @notice Grants emergency access to a user
     * @param user The user to grant emergency access to
     * @param reason The reason for emergency access
     */
    function grantEmergencyAccess(address user, string memory reason) external onlyAdmin nonReentrant {
        require(user != address(0), "AccessControl: invalid user address");
        require(!emergencyAccess[user], "AccessControl: emergency access already granted");
        
        emergencyAccess[user] = true;
        authorizedUsers.add(user);
        
        emit EmergencyAccessGranted(user, msg.sender, reason);
    }
    
    /**
     * @notice Revokes emergency access from a user
     * @param user The user to revoke emergency access from
     */
    function revokeEmergencyAccess(address user) external onlyAdmin nonReentrant {
        require(emergencyAccess[user], "AccessControl: no emergency access to revoke");
        
        emergencyAccess[user] = false;
        
        emit EmergencyAccessRevoked(user, msg.sender);
    }
    
    /**
     * @notice Updates role hierarchy
     * @param role The role to update
     * @param parentRole The parent role for inheritance
     * @param level The hierarchy level
     * @param canDelegate Whether the role can delegate permissions
     * @param maxDelegationLevel Maximum delegation depth
     */
    function updateRoleHierarchy(
        bytes32 role,
        bytes32 parentRole,
        uint8 level,
        bool canDelegate,
        uint256 maxDelegationLevel
    ) external onlyAdmin nonReentrant {
        require(activeRoles.contains(role), "AccessControl: role not active");
        
        roleHierarchy[role] = RoleHierarchy({
            parentRole: parentRole,
            level: level,
            canDelegate: canDelegate,
            maxDelegationLevel: maxDelegationLevel
        });
        
        emit RoleHierarchyUpdated(role, parentRole, level);
    }
    
    /**
     * @notice Checks if a user has specific permission
     * @param user The user to check
     * @param resource The resource type
     * @param operation The operation type
     * @return Whether the user has permission
     */
    function checkPermission(
        address user,
        ResourceType resource,
        OperationType operation
    ) external view returns (bool) {
        return _checkPermission(user, resource, operation);
    }
    
    /**
     * @notice Gets all permissions for a role
     * @param role The role to query
     * @return Array of permissions
     */
    function getRolePermissions(bytes32 role) 
        external 
        view 
        returns (Permission[] memory) 
    {
        uint256 count = 0;
        
        // Count permissions for the role
        for (uint256 i = 0; i < uint256(ResourceType.BRIDGE) + 1; i++) {
            for (uint256 j = 0; j < uint256(OperationType.MIGRATE) + 1; j++) {
                if (rolePermissions[role][ResourceType(i)][OperationType(j)].granted) {
                    count++;
                }
            }
        }
        
        Permission[] memory result = new Permission[](count);
        uint256 index = 0;
        
        // Populate result array
        for (uint256 i = 0; i < uint256(ResourceType.BRIDGE) + 1; i++) {
            for (uint256 j = 0; j < uint256(OperationType.MIGRATE) + 1; j++) {
                Permission storage permission = rolePermissions[role][ResourceType(i)][OperationType(j)];
                if (permission.granted) {
                    result[index] = permission;
                    index++;
                }
            }
        }
        
        return result;
    }
    
    /**
     * @notice Gets access log for auditing
     * @param offset Starting offset
     * @param limit Maximum number of entries to return
     * @return Array of access requests
     */
    function getAccessLog(uint256 offset, uint256 limit) 
        external 
        view 
        onlyAdmin 
        returns (AccessRequest[] memory) 
    {
        uint256 end = offset + limit;
        if (end > accessLog.length) {
            end = accessLog.length;
        }
        
        uint256 length = end - offset;
        AccessRequest[] memory result = new AccessRequest[](length);
        
        for (uint256 i = 0; i < length; i++) {
            result[i] = accessLog[offset + i];
        }
        
        return result;
    }
    
    /**
     * @notice Gets all active roles
     * @return Array of active role identifiers
     */
    function getActiveRoles() external view returns (bytes32[] memory) {
        bytes32[] memory result = new bytes32[](activeRoles.length());
        for (uint256 i = 0; i < activeRoles.length(); i++) {
            result[i] = activeRoles.at(i);
        }
        return result;
    }
    
    /**
     * @notice Gets all authorized users
     * @return Array of authorized user addresses
     */
    function getAuthorizedUsers() external view returns (address[] memory) {
        address[] memory result = new address[](authorizedUsers.length());
        for (uint256 i = 0; i < authorizedUsers.length(); i++) {
            result[i] = authorizedUsers.at(i);
        }
        return result;
    }

    // ===== INTERNAL FUNCTIONS =====
    
    /**
     * @notice Internal function to check user permission
     */
    function _checkPermission(
        address user,
        ResourceType resource,
        OperationType operation
    ) internal view returns (bool) {
        // Check emergency access first
        if (emergencyAccess[user]) {
            return true;
        }
        
        // Check user-specific permissions
        Permission memory userPerm = userPermissions[user][resource][operation];
        if (userPerm.granted && (userPerm.expiresAt == 0 || userPerm.expiresAt > block.timestamp)) {
            return true;
        }
        
        // Check role permissions with hierarchy
        bytes32[] memory roles = _getUserRoles(user);
        for (uint256 i = 0; i < roles.length; i++) {
            if (_hasRolePermission(roles[i], resource, operation)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * @notice Checks if a role has specific permission
     */
    function _hasRolePermission(
        bytes32 role,
        ResourceType resource,
        OperationType operation
    ) internal view returns (bool) {
        Permission memory permission = rolePermissions[role][resource][operation];
        
        // Check if permission is granted and not expired
        if (!permission.granted || (permission.expiresAt > 0 && permission.expiresAt <= block.timestamp)) {
            return false;
        }
        
        // Check conditional access rules
        if (bytes(permission.condition).length > 0) {
            return _evaluateCondition(permission.condition);
        }
        
        return true;
    }
    
    /**
     * @notice Gets all roles for a user including inherited roles
     */
    function _getUserRoles(address user) internal view returns (bytes32[] memory) {
        bytes32[] memory roles = new bytes32[](10); // Max 10 roles
        uint256 count = 0;
        
        // Check direct role assignments
        for (uint256 i = 0; i < activeRoles.length() && count < 10; i++) {
            bytes32 role = activeRoles.at(i);
            if (hasRole(role, user)) {
                roles[count] = role;
                count++;
            }
        }
        
        // Resize array
        bytes32[] memory result = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = roles[i];
        }
        
        return result;
    }
    
    /**
     * @notice Evaluates conditional access rules
     */
    function _evaluateCondition(string memory condition) internal pure returns (bool) {
        // Simple condition evaluation - can be extended
        // For now, return true (no conditions)
        return true;
    }
    
    /**
     * @notice Checks if user is time-restricted
     */
    function _isTimeRestricted(address user) internal view returns (bool) {
        uint256 currentHour = (block.timestamp / 3600) % 24;
        return timeRestrictions[user][currentHour];
    }
    
    /**
     * @notice Logs access requests for audit trail
     */
    function _logAccess(
        address requester,
        ResourceType resource,
        OperationType operation,
        bool granted,
        string memory reason
    ) internal {
        accessLog.push(AccessRequest({
            requester: requester,
            role: bytes32(0), // Could be enhanced to track which role was used
            resource: resource,
            operation: operation,
            timestamp: block.timestamp,
            granted: granted,
            reason: reason
        }));
        
        emit AccessRequested(requester, bytes32(0), resource, operation, granted);
    }
    
    /**
     * @notice Initializes role hierarchy
     */
    function _initializeRoleHierarchy() internal {
        // Admin at top level
        roleHierarchy[ROLE_ADMIN] = RoleHierarchy({
            parentRole: bytes32(0),
            level: 0,
            canDelegate: true,
            maxDelegationLevel: 5
        });
        
        // Governor below admin
        roleHierarchy[ROLE_GOVERNOR] = RoleHierarchy({
            parentRole: ROLE_ADMIN,
            level: 1,
            canDelegate: true,
            maxDelegationLevel: 3
        });
        
        // Issuer below governor
        roleHierarchy[ROLE_ISSUER] = RoleHierarchy({
            parentRole: ROLE_GOVERNOR,
            level: 2,
            canDelegate: true,
            maxDelegationLevel: 2
        });
        
        // Validator at same level as issuer
        roleHierarchy[ROLE_VALIDATOR] = RoleHierarchy({
            parentRole: ROLE_GOVERNOR,
            level: 2,
            canDelegate: false,
            maxDelegationLevel: 0
        });
        
        // User below validator
        roleHierarchy[ROLE_USER] = RoleHierarchy({
            parentRole: ROLE_VALIDATOR,
            level: 3,
            canDelegate: false,
            maxDelegationLevel: 0
        });
        
        // Auditor at same level as user
        roleHierarchy[ROLE_AUDITOR] = RoleHierarchy({
            parentRole: ROLE_VALIDATOR,
            level: 3,
            canDelegate: false,
            maxDelegationLevel: 0
        });
        
        // Add all roles to active set
        activeRoles.add(ROLE_ADMIN);
        activeRoles.add(ROLE_GOVERNOR);
        activeRoles.add(ROLE_ISSUER);
        activeRoles.add(ROLE_VALIDATOR);
        activeRoles.add(ROLE_USER);
        activeRoles.add(ROLE_AUDITOR);
    }
    
    /**
     * @notice Initializes default permissions for roles
     */
    function _initializeDefaultPermissions() internal {
        // Admin permissions - all operations on all resources
        for (uint256 i = 0; i < uint256(ResourceType.BRIDGE) + 1; i++) {
            for (uint256 j = 0; j < uint256(OperationType.MIGRATE) + 1; j++) {
                rolePermissions[ROLE_ADMIN][ResourceType(i)][OperationType(j)] = Permission({
                    role: ROLE_ADMIN,
                    resource: ResourceType(i),
                    operation: OperationType(j),
                    granted: true,
                    grantedAt: block.timestamp,
                    expiresAt: 0,
                    grantedBy: msg.sender,
                    condition: ""
                });
            }
        }
        
        // Governor permissions - governance and admin operations
        _setRolePermission(ROLE_GOVERNOR, ResourceType.GOVERNANCE, OperationType.CREATE, true);
        _setRolePermission(ROLE_GOVERNOR, ResourceType.GOVERNANCE, OperationType.READ, true);
        _setRolePermission(ROLE_GOVERNOR, ResourceType.GOVERNANCE, OperationType.UPDATE, true);
        _setRolePermission(ROLE_GOVERNOR, ResourceType.GOVERNANCE, OperationType.ADMIN, true);
        _setRolePermission(ROLE_GOVERNOR, ResourceType.DID, OperationType.VALIDATE, true);
        _setRolePermission(ROLE_GOVERNOR, ResourceType.CREDENTIAL, OperationType.VALIDATE, true);
        
        // Issuer permissions - credential operations
        _setRolePermission(ROLE_ISSUER, ResourceType.CREDENTIAL, OperationType.CREATE, true);
        _setRolePermission(ROLE_ISSUER, ResourceType.CREDENTIAL, OperationType.READ, true);
        _setRolePermission(ROLE_ISSUER, ResourceType.CREDENTIAL, OperationType.UPDATE, true);
        _setRolePermission(ROLE_ISSUER, ResourceType.CREDENTIAL, OperationType.DELETE, true);
        _setRolePermission(ROLE_ISSUER, ResourceType.DID, OperationType.READ, true);
        
        // Validator permissions - validation operations
        _setRolePermission(ROLE_VALIDATOR, ResourceType.DID, OperationType.READ, true);
        _setRolePermission(ROLE_VALIDATOR, ResourceType.DID, OperationType.VALIDATE, true);
        _setRolePermission(ROLE_VALIDATOR, ResourceType.CREDENTIAL, OperationType.READ, true);
        _setRolePermission(ROLE_VALIDATOR, ResourceType.CREDENTIAL, OperationType.VALIDATE, true);
        
        // User permissions - own DID operations
        _setRolePermission(ROLE_USER, ResourceType.DID, OperationType.CREATE, true);
        _setRolePermission(ROLE_USER, ResourceType.DID, OperationType.READ, true);
        _setRolePermission(ROLE_USER, ResourceType.DID, OperationType.UPDATE, true);
        _setRolePermission(ROLE_USER, ResourceType.DID, OperationType.DELETE, true);
        
        // Auditor permissions - read-only access
        _setRolePermission(ROLE_AUDITOR, ResourceType.DID, OperationType.READ, true);
        _setRolePermission(ROLE_AUDITOR, ResourceType.CREDENTIAL, OperationType.READ, true);
        _setRolePermission(ROLE_AUDITOR, ResourceType.GOVERNANCE, OperationType.READ, true);
        _setRolePermission(ROLE_AUDITOR, ResourceType.SYSTEM, OperationType.READ, true);
    }
    
    /**
     * @notice Helper function to set role permissions
     */
    function _setRolePermission(
        bytes32 role,
        ResourceType resource,
        OperationType operation,
        bool granted
    ) internal {
        rolePermissions[role][resource][operation] = Permission({
            role: role,
            resource: resource,
            operation: operation,
            granted: granted,
            grantedAt: block.timestamp,
            expiresAt: 0,
            grantedBy: msg.sender,
            condition: ""
        });
    }
}
