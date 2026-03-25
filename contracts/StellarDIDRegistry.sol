// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title StellarDIDRegistry
 * @dev Smart contract interface for DID operations that can be called from Stellar
 * Note: This is a conceptual representation for cross-chain communication
 * In practice, Stellar smart contracts are implemented differently
 */
contract StellarDIDRegistry {
    using SafeMath for uint256;
    
    // Role-based access control
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    
    // Role management
    mapping(bytes32 => mapping(address => bool)) private _roles;
    mapping(address => bytes32[]) private _userRoles;
    address private _admin;
    
    // Role tracking
    uint256 private _adminCount;
    uint256 private _issuerCount;
    uint256 private _verifierCount;
    uint256 private _registrarCount;
    
    // Contract state
    bool private _paused;
    uint256 private _pausedAt;
    address private _pausedBy;
    
    struct DIDDocument {
        string did;
        address owner;
        string publicKey;
        uint256 created;
        uint256 updated;
        bool active;
        string serviceEndpoint;
    }
    
    struct VerifiableCredential {
        bytes32 id;
        string issuer;
        string subject;
        string credentialType;
        uint256 issued;
        uint256 expires;
        bytes32 dataHash;
        bool revoked;
    }
    
    mapping(string => DIDDocument) public didDocuments;
    mapping(bytes32 => VerifiableCredential) public credentials;
    mapping(address => string[]) public ownerToDids;
    
    event DIDCreated(string indexed did, address indexed owner, string publicKey);
    event DIDUpdated(string indexed did, uint256 updated);
    event DIDDeactivated(string indexed did);
    event CredentialIssued(bytes32 indexed id, string issuer, string subject);
    event CredentialRevoked(bytes32 indexed id);
    
    // RBAC Events
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    event ContractPaused(address indexed pausedBy, uint256 timestamp);
    event ContractUnpaused(address indexed unpausedBy, uint256 timestamp);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    
    // Modifiers for access control
    modifier onlyRole(bytes32 role) {
        require(hasRole(role, msg.sender), "AccessControl: caller missing role");
        _;
    }
    
    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "AccessControl: caller is not admin");
        _;
    }
    
    modifier onlyIssuer() {
        require(hasRole(ISSUER_ROLE, msg.sender), "AccessControl: caller is not issuer");
        _;
    }
    
    modifier onlyVerifier() {
        require(hasRole(VERIFIER_ROLE, msg.sender), "AccessControl: caller is not verifier");
        _;
    }
    
    modifier onlyRegistrar() {
        require(hasRole(REGISTRAR_ROLE, msg.sender), "AccessControl: caller is not registrar");
        _;
    }
    
    modifier whenNotPaused() {
        require(!_paused, "Pausable: contract is paused");
        _;
    }
    
    modifier whenPaused() {
        require(_paused, "Pausable: contract is not paused");
        _;
    }
    
    modifier onlyOwner(string memory did) {
        require(didDocuments[did].owner == msg.sender, "Only DID owner can perform this action");
        _;
    }
    
    modifier validDID(string memory did) {
        require(bytes(didDocuments[did].did).length > 0, "DID does not exist");
        _;
    }
    
    /**
     * @dev Constructor - sets the deployer as the initial admin
     */
    constructor() {
        _admin = msg.sender;
        _grantRole(ADMIN_ROLE, msg.sender);
        _paused = false;
    }
    
    /**
     * @dev Role-based access control functions
     */
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }
    
    function getUserRoles(address account) public view returns (bytes32[] memory) {
        return _userRoles[account];
    }
    
    function getRoleCount(bytes32 role) public view returns (uint256) {
        if (role == ADMIN_ROLE) return _adminCount;
        if (role == ISSUER_ROLE) return _issuerCount;
        if (role == VERIFIER_ROLE) return _verifierCount;
        if (role == REGISTRAR_ROLE) return _registrarCount;
        return 0;
    }
    
    function grantRole(bytes32 role, address account) external onlyAdmin {
        require(account != address(0), "AccessControl: zero address");
        require(!hasRole(role, account), "AccessControl: account already has role");
        
        _grantRole(role, account);
        emit RoleGranted(role, account, msg.sender);
    }
    
    function revokeRole(bytes32 role, address account) external onlyAdmin {
        require(hasRole(role, account), "AccessControl: account does not have role");
        
        // Prevent revoking the last admin
        if (role == ADMIN_ROLE && _adminCount <= 1) {
            revert("AccessControl: cannot revoke last admin");
        }
        
        _revokeRole(role, account);
        emit RoleRevoked(role, account, msg.sender);
    }
    
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "AccessControl: zero address");
        require(newAdmin != _admin, "AccessControl: same admin");
        
        address oldAdmin = _admin;
        _admin = newAdmin;
        
        // Grant admin role to new admin
        if (!hasRole(ADMIN_ROLE, newAdmin)) {
            _grantRole(ADMIN_ROLE, newAdmin);
        }
        
        emit AdminTransferred(oldAdmin, newAdmin);
    }
    
    /**
     * @dev Emergency controls
     */
    function pause() external onlyAdmin whenNotPaused {
        _paused = true;
        _pausedAt = block.timestamp;
        _pausedBy = msg.sender;
        emit ContractPaused(msg.sender, block.timestamp);
    }
    
    function unpause() external onlyAdmin whenPaused {
        _paused = false;
        emit ContractUnpaused(msg.sender, block.timestamp);
    }
    
    function isPaused() external view returns (bool) {
        return _paused;
    }
    
    function getPauseInfo() external view returns (bool paused, uint256 pausedAt, address pausedBy) {
        return (_paused, _pausedAt, _pausedBy);
    }
    
    /**
     * @dev Internal role management functions
     */
    function _grantRole(bytes32 role, address account) internal {
        _roles[role][account] = true;
        _userRoles[account].push(role);
        
        // Update role counts
        if (role == ADMIN_ROLE) _adminCount = _adminCount.add(1);
        else if (role == ISSUER_ROLE) _issuerCount = _issuerCount.add(1);
        else if (role == VERIFIER_ROLE) _verifierCount = _verifierCount.add(1);
        else if (role == REGISTRAR_ROLE) _registrarCount = _registrarCount.add(1);
    }
    
    function _revokeRole(bytes32 role, address account) internal {
        _roles[role][account] = false;
        
        // Remove from user roles array
        uint256 length = _userRoles[account].length;
        for (uint256 i = 0; i < length; i++) {
            if (_userRoles[account][i] == role) {
                _userRoles[account][i] = _userRoles[account][length.sub(1)];
                _userRoles[account].pop();
                break;
            }
        }
        
        // Update role counts
        if (role == ADMIN_ROLE) _adminCount = _adminCount.sub(1);
        else if (role == ISSUER_ROLE) _issuerCount = _issuerCount.sub(1);
        else if (role == VERIFIER_ROLE) _verifierCount = _verifierCount.sub(1);
        else if (role == REGISTRAR_ROLE) _registrarCount = _registrarCount.sub(1);
    }
    
    /**
     * @dev Create a new DID document
     * Only users with REGISTRAR_ROLE or any user (if allowed) can create DIDs
     */
    function createDID(
        string memory did,
        string memory publicKey,
        string memory serviceEndpoint
    ) external whenNotPaused returns (bool) {
        require(bytes(didDocuments[did].did).length == 0, "DID already exists");
        
        didDocuments[did] = DIDDocument({
            did: did,
            owner: msg.sender,
            publicKey: publicKey,
            created: block.timestamp,
            updated: block.timestamp,
            active: true,
            serviceEndpoint: serviceEndpoint
        });
        
        ownerToDids[msg.sender].push(did);
        
        emit DIDCreated(did, msg.sender, publicKey);
        return true;
    }
    
    /**
     * @dev Create a new DID document (Admin only - for special cases)
     */
    function createDIDForUser(
        address user,
        string memory did,
        string memory publicKey,
        string memory serviceEndpoint
    ) external onlyAdmin whenNotPaused returns (bool) {
        require(user != address(0), "Invalid user address");
        require(bytes(didDocuments[did].did).length == 0, "DID already exists");
        
        didDocuments[did] = DIDDocument({
            did: did,
            owner: user,
            publicKey: publicKey,
            created: block.timestamp,
            updated: block.timestamp,
            active: true,
            serviceEndpoint: serviceEndpoint
        });
        
        ownerToDids[user].push(did);
        
        emit DIDCreated(did, user, publicKey);
        return true;
    }
    
    /**
     * @dev Update DID document
     */
    function updateDID(
        string memory did,
        string memory newPublicKey,
        string memory newServiceEndpoint
    ) external onlyOwner(did) whenNotPaused validDID(did) returns (bool) {
        require(didDocuments[did].active, "DID is not active");
        
        if (bytes(newPublicKey).length > 0) {
            didDocuments[did].publicKey = newPublicKey;
        }
        
        if (bytes(newServiceEndpoint).length > 0) {
            didDocuments[did].serviceEndpoint = newServiceEndpoint;
        }
        
        didDocuments[did].updated = block.timestamp;
        
        emit DIDUpdated(did, block.timestamp);
        return true;
    }
    
    /**
     * @dev Update DID document (Admin only - emergency override)
     */
    function adminUpdateDID(
        string memory did,
        string memory newPublicKey,
        string memory newServiceEndpoint,
        bool active
    ) external onlyAdmin whenNotPaused validDID(did) returns (bool) {
        if (bytes(newPublicKey).length > 0) {
            didDocuments[did].publicKey = newPublicKey;
        }
        
        if (bytes(newServiceEndpoint).length > 0) {
            didDocuments[did].serviceEndpoint = newServiceEndpoint;
        }
        
        didDocuments[did].active = active;
        didDocuments[did].updated = block.timestamp;
        
        emit DIDUpdated(did, block.timestamp);
        return true;
    }
    
    /**
     * @dev Deactivate DID
     */
    function deactivateDID(string memory did) external onlyOwner(did) whenNotPaused validDID(did) returns (bool) {
        didDocuments[did].active = false;
        emit DIDDeactivated(did);
        return true;
    }
    
    /**
     * @dev Deactivate DID (Admin only - emergency deactivation)
     */
    function adminDeactivateDID(string memory did) external onlyAdmin whenNotPaused validDID(did) returns (bool) {
        didDocuments[did].active = false;
        emit DIDDeactivated(did);
        return true;
    }
    
    /**
     * @dev Get DID document
     */
    function getDIDDocument(string memory did) external view returns (DIDDocument memory) {
        return didDocuments[did];
    }
    
    /**
     * @dev Issue verifiable credential
     * Only users with ISSUER_ROLE can issue credentials
     */
    function issueCredential(
        string memory issuer,
        string memory subject,
        string memory credentialType,
        uint256 expires,
        bytes32 dataHash
    ) external onlyIssuer whenNotPaused returns (bytes32) {
        require(bytes(issuer).length > 0, "Invalid issuer");
        require(bytes(subject).length > 0, "Invalid subject");
        require(bytes(credentialType).length > 0, "Invalid credential type");
        require(expires == 0 || expires > block.timestamp, "Invalid expiration time");
        
        bytes32 credentialId = keccak256(abi.encodePacked(
            issuer,
            subject,
            block.timestamp,
            dataHash
        ));
        
        // Check if credential already exists
        require(credentials[credentialId].issued == 0, "Credential already exists");
        
        credentials[credentialId] = VerifiableCredential({
            id: credentialId,
            issuer: issuer,
            subject: subject,
            credentialType: credentialType,
            issued: block.timestamp,
            expires: expires,
            dataHash: dataHash,
            revoked: false
        });
        
        emit CredentialIssued(credentialId, issuer, subject);
        return credentialId;
    }
    
    /**
     * @dev Issue verifiable credential (Admin only - special cases)
     */
    function adminIssueCredential(
        string memory issuer,
        string memory subject,
        string memory credentialType,
        uint256 expires,
        bytes32 dataHash
    ) external onlyAdmin whenNotPaused returns (bytes32) {
        require(bytes(issuer).length > 0, "Invalid issuer");
        require(bytes(subject).length > 0, "Invalid subject");
        require(bytes(credentialType).length > 0, "Invalid credential type");
        require(expires == 0 || expires > block.timestamp, "Invalid expiration time");
        
        bytes32 credentialId = keccak256(abi.encodePacked(
            issuer,
            subject,
            block.timestamp,
            dataHash,
            "admin" // Salt to differentiate from regular credentials
        ));
        
        credentials[credentialId] = VerifiableCredential({
            id: credentialId,
            issuer: issuer,
            subject: subject,
            credentialType: credentialType,
            issued: block.timestamp,
            expires: expires,
            dataHash: dataHash,
            revoked: false
        });
        
        emit CredentialIssued(credentialId, issuer, subject);
        return credentialId;
    }
    
    /**
     * @dev Revoke credential
     * Only the issuer or admin can revoke credentials
     */
    function revokeCredential(bytes32 credentialId) external whenNotPaused returns (bool) {
        require(credentials[credentialId].issued > 0, "Credential does not exist");
        require(!credentials[credentialId].revoked, "Credential already revoked");
        
        // Check if caller is the issuer or admin
        bool isIssuer = keccak256(bytes(credentials[credentialId].issuer)) == keccak256(bytes(addressToString(msg.sender)));
        bool isAdmin = hasRole(ADMIN_ROLE, msg.sender);
        
        require(isIssuer || isAdmin, "Only issuer or admin can revoke");
        
        credentials[credentialId].revoked = true;
        emit CredentialRevoked(credentialId);
        return true;
    }
    
    /**
     * @dev Batch revoke credentials (Admin only)
     */
    function batchRevokeCredentials(bytes32[] memory credentialIds) external onlyAdmin whenNotPaused returns (uint256) {
        uint256 revokedCount = 0;
        
        for (uint256 i = 0; i < credentialIds.length; i++) {
            if (credentials[credentialIds[i]].issued > 0 && !credentials[credentialIds[i]].revoked) {
                credentials[credentialIds[i]].revoked = true;
                emit CredentialRevoked(credentialIds[i]);
                revokedCount = revokedCount.add(1);
            }
        }
        
        return revokedCount;
    }
    
    /**
     * @dev Get credential
     */
    function getCredential(bytes32 credentialId) external view returns (VerifiableCredential memory) {
        return credentials[credentialId];
    }
    
    /**
     * @dev Check if credential is valid
     */
    function isCredentialValid(bytes32 credentialId) external view returns (bool) {
        VerifiableCredential memory cred = credentials[credentialId];
        return !cred.revoked && (cred.expires == 0 || cred.expires > block.timestamp);
    }
    
    /**
     * @dev Get all DIDs for an owner
     */
    function getOwnerDIDs(address owner) external view returns (string[] memory) {
        return ownerToDids[owner];
    }
    
    /**
     * @dev Get contract statistics (Admin only)
     */
    function getContractStats() external onlyAdmin view returns (
        uint256 totalDIDs,
        uint256 activeDIDs,
        uint256 totalCredentials,
        uint256 activeCredentials
    ) {
        // Note: In a real implementation, you'd maintain counters for efficiency
        // This is a simplified version for demonstration
        totalDIDs = 0;
        activeDIDs = 0;
        totalCredentials = 0;
        activeCredentials = 0;
        
        // These would be more efficiently tracked with counters
        return (totalDIDs, activeDIDs, totalCredentials, activeCredentials);
    }
    
    /**
     * @dev Emergency function to transfer DID ownership (Admin only)
     */
    function transferDIDOwnership(
        string memory did,
        address newOwner
    ) external onlyAdmin whenNotPaused validDID(did) returns (bool) {
        require(newOwner != address(0), "Invalid new owner");
        require(newOwner != didDocuments[did].owner, "Same owner");
        
        address oldOwner = didDocuments[did].owner;
        
        // Remove DID from old owner's list
        _removeDIDFromOwner(oldOwner, did);
        
        // Add DID to new owner's list
        ownerToDids[newOwner].push(did);
        
        // Update DID document
        didDocuments[did].owner = newOwner;
        didDocuments[did].updated = block.timestamp;
        
        emit DIDUpdated(did, block.timestamp);
        return true;
    }
    
    /**
     * @dev Internal function to remove DID from owner's list
     */
    function _removeDIDFromOwner(address owner, string memory did) internal {
        string[] storage ownerDIDs = ownerToDids[owner];
        uint256 length = ownerDIDs.length;
        
        for (uint256 i = 0; i < length; i++) {
            if (keccak256(bytes(ownerDIDs[i])) == keccak256(bytes(did))) {
                ownerDIDs[i] = ownerDIDs[length.sub(1)];
                ownerDIDs.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Get contract version and admin info
     */
    function getContractInfo() external view returns (
        string memory version,
        address currentAdmin,
        bool paused,
        uint256 adminCount,
        uint256 issuerCount,
        uint256 verifierCount,
        uint256 registrarCount
    ) {
        return (
            "2.0.0",
            _admin,
            _paused,
            _adminCount,
            _issuerCount,
            _verifierCount,
            _registrarCount
        );
    }
    
    // Helper function to convert address to string
    function addressToString(address addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        
        str[0] = '0';
        str[1] = 'x';
        
        for (uint i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(uint8(value[i + 12] >> 4))];
            str[3 + i * 2] = alphabet[uint8(uint8(value[i + 12] & 0x0f))];
        }
        
        return string(str);
    }
}
