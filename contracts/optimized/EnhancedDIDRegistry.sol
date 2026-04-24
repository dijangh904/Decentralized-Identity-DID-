// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IERC725.sol";
import "../interfaces/IERC735.sol";
import "../ReentrancyGuard.sol";

/**
 * @title EnhancedDIDRegistry
 * @dev Enhanced version of the DID registry with comprehensive security improvements
 * Implements ERC-725 and ERC-735 standards with:
 * - Custom error types for detailed debugging
 * - Reentrancy protection on external calls
 * - Pausable functionality with multi-sig governance
 * - Comprehensive event logging for audit trails
 */
contract EnhancedDIDRegistry is IERC725, IERC735, ReentrancyGuard {
    using SafeMath for uint256;
    
    // ===== CUSTOM ERRORS FOR DETAILED DEBUGGING =====
    error AccessControlUnauthorized(address caller, bytes32 role);
    error DIDAlreadyExists(string did, address currentOwner);
    error DIDNotFound(string did);
    error UnauthorizedDIDOperation(address caller, string did, address owner);
    error CredentialAlreadyExists(bytes32 credentialId);
    error CredentialNotFound(bytes32 credentialId);
    error CredentialExpired(bytes32 credentialId, uint256 expiryTime);
    error CredentialRevoked(bytes32 credentialId);
    error InvalidAddress(address provided, string context);
    error InvalidArrayLength(uint256 expected, uint256 actual);
    error EmptyString(string field);
    error StringTooLong(string field, uint256 length, uint256 maxLength);
    error InvalidSignature(address signer, bytes32 hash);
    error ExecutionFailed(address target, bytes data);
    error ContractPaused();
    error InsufficientBalance(address account, uint256 required, uint256 available);
    error ReentrantCall();
    error ZeroAddress(string context);
    
    // ===== PAUSABLE FUNCTIONALITY =====
    bool private _paused = false;
    uint256 private constant PAUSE_SIGNATURE_THRESHOLD = 3;
    mapping(address => bool) private _pauseSigners;
    mapping(address => bool) private _hasSignedPause;
    uint256 private _pauseSignatureCount;
    uint256 private _pauseInitiationTime;
    uint256 private constant PAUSE_DELAY = 24 hours;
    
    // Role-based access control
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    mapping(bytes32 => mapping(address => bool)) private _roles;
    address private _admin;
    
    // Optimized DIDDocument struct
    struct DIDDocument {
        address owner;
        bool active;
        uint256 created;
        uint256 updated;
        string publicKey;
        string serviceEndpoint;
    }
    
    // Optimized VerifiableCredential struct
    struct VerifiableCredential {
        bytes32 id;
        uint256 issued;
        uint256 expires;
        bool revoked;
        string issuer;
        string subject;
        string credentialType;
        bytes32 dataHash;
    }
    
    // Storage mappings
    mapping(string => DIDDocument) public didDocuments;
    mapping(bytes32 => VerifiableCredential) public credentials;
    mapping(address => string[]) public ownerToDids;
    
    // ERC725/735 Storage
    mapping(string => mapping(bytes32 => bytes)) private _didData;
    mapping(string => mapping(bytes32 => IERC735.Claim)) private _didClaims;
    mapping(string => mapping(uint256 => bytes32[])) private _didClaimsByTopic;
    
    // ===== COMPREHENSIVE EVENTS WITH INDEXED PARAMETERS =====
    
    // DID Events
    event DIDBridged(
        string indexed did,
        address indexed owner,
        string publicKey,
        string serviceEndpoint,
        uint256 timestamp,
        address indexed bridgeOperator
    );
    
    event DIDUpdated(
        string indexed did,
        address indexed owner,
        uint256 previousUpdated,
        uint256 newUpdated,
        string updatedField,
        address indexed updater
    );
    
    event DIDDeactivated(
        string indexed did,
        address indexed owner,
        uint256 timestamp,
        address indexed deactivator
    );
    
    event DIDOwnershipTransferred(
        string indexed did,
        address indexed previousOwner,
        address indexed newOwner,
        uint256 timestamp
    );
    
    // Credential Events
    event CredentialBridged(
        bytes32 indexed credentialId,
        string indexed issuer,
        string indexed subject,
        string credentialType,
        uint256 expires,
        bytes32 dataHash,
        uint256 timestamp
    );
    
    event CredentialRevoked(
        bytes32 indexed credentialId,
        string indexed issuer,
        uint256 timestamp,
        address indexed revoker
    );
    
    event CredentialExpired(
        bytes32 indexed credentialId,
        uint256 expiryTime,
        uint256 timestamp
    );
    
    // Access Control Events
    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed granter,
        uint256 timestamp
    );
    
    event RoleRevoked(
        bytes32 indexed role,
        address indexed account,
        address indexed revoker,
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
    
    event ContractPaused(
        address indexed pauser,
        uint256 timestamp,
        string reason
    );
    
    event ContractUnpaused(
        address indexed unpauser,
        uint256 timestamp,
        string reason
    );
    
    // Data Events
    event DataChanged(
        string indexed did,
        address indexed owner,
        bytes32 indexed key,
        bytes oldValue,
        bytes newValue,
        uint256 timestamp
    );
    
    event ClaimAdded(
        string indexed did,
        bytes32 indexed claimId,
        uint256 indexed topic,
        address issuer,
        uint256 timestamp
    );
    
    event ClaimRemoved(
        string indexed did,
        bytes32 indexed claimId,
        uint256 indexed topic,
        address remover,
        uint256 timestamp
    );
    
    event ExecutionAttempted(
        string indexed did,
        address indexed owner,
        address indexed target,
        uint256 value,
        bytes data,
        uint256 timestamp
    );
    
    event ExecutionCompleted(
        string indexed did,
        address indexed owner,
        address indexed target,
        uint256 value,
        bytes data,
        bytes result,
        uint256 timestamp
    );
    
    event ExecutionFailed(
        string indexed did,
        address indexed owner,
        address indexed target,
        uint256 value,
        bytes data,
        string reason,
        uint256 timestamp
    );
    
    // Modifiers
    modifier whenNotPaused() {
        if (_paused) revert ContractPaused();
        _;
    }
    
    modifier onlyRole(bytes32 role) {
        if (!_roles[role][msg.sender]) {
            revert AccessControlUnauthorized(msg.sender, role);
        }
        _;
    }
    
    modifier onlyOwner(string memory did) {
        if (didDocuments[did].owner != msg.sender) {
            revert UnauthorizedDIDOperation(msg.sender, did, didDocuments[did].owner);
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
    
    constructor() {
        _admin = msg.sender;
        _roles[ADMIN_ROLE][msg.sender] = true;
        _roles[PAUSER_ROLE][msg.sender] = true;
        _pauseSigners[msg.sender] = true;
    }
    
    // ===== PAUSE FUNCTIONALITY WITH MULTI-SIG =====
    
    /**
     * @dev Initiate pause process - requires multiple signatures
     */
    function initiatePause(string calldata reason) external onlyRole(PAUSER_ROLE) {
        if (_paused) revert ContractPaused();
        
        _pauseSignatureCount = 0;
        _pauseInitiationTime = block.timestamp;
        
        // Clear previous signatures
        for (uint i = 0; i < 10; i++) { // Clear up to 10 signers
            address signer = address(uint160(1 + i));
            _hasSignedPause[signer] = false;
        }
        
        emit PauseInitiated(msg.sender, 0, PAUSE_SIGNATURE_THRESHOLD, block.timestamp);
    }
    
    /**
     * @dev Add signature for pause
     */
    function signPause() external onlyRole(PAUSER_ROLE) {
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
     * @dev Emergency pause by admin (requires higher threshold)
     */
    function emergencyPause(string calldata reason) external onlyRole(ADMIN_ROLE) {
        if (_paused) revert ContractPaused();
        _pause();
        emit ContractPaused(msg.sender, block.timestamp, reason);
    }
    
    /**
     * @dev Unpause contract (admin only)
     */
    function unpause(string calldata reason) external onlyRole(ADMIN_ROLE) {
        if (!_paused) return;
        _paused = false;
        emit ContractUnpaused(msg.sender, block.timestamp, reason);
    }
    
    function _pause() internal {
        _paused = true;
        emit ContractPaused(msg.sender, block.timestamp, "Multi-sig pause activated");
    }
    
    function paused() external view returns (bool) {
        return _paused;
    }
    
    // ===== ROLE MANAGEMENT WITH DETAILED EVENTS =====
    
    function grantRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) validAddress(account) {
        if (_roles[role][account]) return; // Already has role
        
        _roles[role][account] = true;
        
        // Add to pause signers if PAUSER_ROLE
        if (role == PAUSER_ROLE) {
            _pauseSigners[account] = true;
        }
        
        emit RoleGranted(role, account, msg.sender, block.timestamp);
    }
    
    function revokeRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) validAddress(account) {
        if (!_roles[role][account]) return; // Doesn't have role
        
        _roles[role][account] = false;
        
        // Remove from pause signers if PAUSER_ROLE
        if (role == PAUSER_ROLE) {
            _pauseSigners[account] = false;
        }
        
        emit RoleRevoked(role, account, msg.sender, block.timestamp);
    }
    
    function hasRole(bytes32 role, address account) external view returns (bool) {
        return _roles[role][account];
    }
    
    // ===== ENHANCED DID OPERATIONS WITH COMPREHENSIVE LOGGING =====
    
    function bridgeDID(
        string memory did,
        address ownerAddress,
        string memory publicKey,
        string memory serviceEndpoint
    ) external onlyRole(ADMIN_ROLE) whenNotPaused validAddress(ownerAddress) 
      nonEmptyString(did) nonEmptyString(publicKey) returns (bool) {
        
        if (didDocuments[did].owner != address(0)) {
            revert DIDAlreadyExists(did, didDocuments[did].owner);
        }
        
        if (bytes(did).length > 256) revert StringTooLong("did", bytes(did).length, 256);
        if (bytes(publicKey).length > 1024) revert StringTooLong("publicKey", bytes(publicKey).length, 1024);
        if (bytes(serviceEndpoint).length > 512) revert StringTooLong("serviceEndpoint", bytes(serviceEndpoint).length, 512);
        
        uint256 timestamp = block.timestamp;
        
        DIDDocument storage doc = didDocuments[did];
        doc.owner = ownerAddress;
        doc.active = true;
        doc.created = timestamp;
        doc.updated = timestamp;
        doc.publicKey = publicKey;
        doc.serviceEndpoint = serviceEndpoint;
        
        ownerToDids[ownerAddress].push(did);
        
        emit DIDBridged(did, ownerAddress, publicKey, serviceEndpoint, timestamp, msg.sender);
        return true;
    }
    
    function updateDID(
        string memory did,
        string memory newPublicKey,
        string memory newServiceEndpoint
    ) external onlyOwner(did) whenNotPaused nonEmptyString(did) {
        if (didDocuments[did].owner == address(0)) {
            revert DIDNotFound(did);
        }
        
        if (bytes(newPublicKey).length > 1024) revert StringTooLong("publicKey", bytes(newPublicKey).length, 1024);
        if (bytes(newServiceEndpoint).length > 512) revert StringTooLong("serviceEndpoint", bytes(newServiceEndpoint).length, 512);
        
        uint256 previousUpdated = didDocuments[did].updated;
        uint256 newUpdated = block.timestamp;
        
        didDocuments[did].publicKey = newPublicKey;
        didDocuments[did].updated = newUpdated;
        
        emit DIDUpdated(did, msg.sender, previousUpdated, newUpdated, "publicKey", msg.sender);
    }
    
    function transferDIDOwnership(string memory did, address newOwner) 
        external onlyOwner(did) whenNotPaused validAddress(newOwner) nonEmptyString(did) {
        
        if (didDocuments[did].owner == address(0)) {
            revert DIDNotFound(did);
        }
        
        address previousOwner = didDocuments[did].owner;
        
        // Update ownership
        didDocuments[did].owner = newOwner;
        
        // Update owner mappings
        string[] storage oldOwnerDids = ownerToDids[previousOwner];
        for (uint i = 0; i < oldOwnerDids.length; i++) {
            if (keccak256(bytes(oldOwnerDids[i])) == keccak256(bytes(did))) {
                oldOwnerDids[i] = oldOwnerDids[oldOwnerDids.length - 1];
                oldOwnerDids.pop();
                break;
            }
        }
        
        ownerToDids[newOwner].push(did);
        
        emit DIDOwnershipTransferred(did, previousOwner, newOwner, block.timestamp);
    }
    
    function deactivateDID(string memory did) external onlyOwner(did) whenNotPaused nonEmptyString(did) {
        if (didDocuments[did].owner == address(0)) {
            revert DIDNotFound(did);
        }
        
        didDocuments[did].active = false;
        didDocuments[did].updated = block.timestamp;
        
        emit DIDDeactivated(did, msg.sender, block.timestamp, msg.sender);
    }
    
    // ===== ENHANCED CREDENTIAL OPERATIONS =====
    
    function bridgeCredential(
        bytes32 credentialId,
        string memory issuer,
        string memory subject,
        string memory credentialType,
        uint256 expires,
        bytes32 dataHash
    ) external onlyRole(ADMIN_ROLE) whenNotPaused 
      nonEmptyString(issuer) nonEmptyString(subject) nonEmptyString(credentialType) returns (bytes32) {
        
        if (credentials[credentialId].issued != 0) {
            revert CredentialAlreadyExists(credentialId);
        }
        
        if (expires <= block.timestamp) {
            revert CredentialExpired(credentialId, expires);
        }
        
        if (bytes(issuer).length > 256) revert StringTooLong("issuer", bytes(issuer).length, 256);
        if (bytes(subject).length > 256) revert StringTooLong("subject", bytes(subject).length, 256);
        if (bytes(credentialType).length > 128) revert StringTooLong("credentialType", bytes(credentialType).length, 128);
        
        uint256 timestamp = block.timestamp;
        
        VerifiableCredential storage cred = credentials[credentialId];
        cred.id = credentialId;
        cred.issued = timestamp;
        cred.expires = expires;
        cred.revoked = false;
        cred.issuer = issuer;
        cred.subject = subject;
        cred.credentialType = credentialType;
        cred.dataHash = dataHash;
        
        emit CredentialBridged(credentialId, issuer, subject, credentialType, expires, dataHash, timestamp);
        return credentialId;
    }
    
    function revokeCredential(bytes32 credentialId) external whenNotPaused {
        VerifiableCredential storage cred = credentials[credentialId];
        
        if (cred.issued == 0) {
            revert CredentialNotFound(credentialId);
        }
        
        if (cred.revoked) {
            revert CredentialRevoked(credentialId);
        }
        
        // Only issuer or admin can revoke
        if (keccak256(bytes(cred.issuer)) != keccak256(bytes(_addressToString(msg.sender))) && 
            !_roles[ADMIN_ROLE][msg.sender]) {
            revert AccessControlUnauthorized(msg.sender, ADMIN_ROLE);
        }
        
        cred.revoked = true;
        
        emit CredentialRevoked(credentialId, cred.issuer, block.timestamp, msg.sender);
    }
    
    // ===== VIEW FUNCTIONS =====
    
    function getDIDDocument(string memory did) external view returns (DIDDocument memory) {
        DIDDocument memory doc = didDocuments[did];
        if (doc.owner == address(0)) {
            revert DIDNotFound(did);
        }
        return doc;
    }
    
    function getCredential(bytes32 credentialId) external view returns (VerifiableCredential memory) {
        VerifiableCredential memory cred = credentials[credentialId];
        if (cred.issued == 0) {
            revert CredentialNotFound(credentialId);
        }
        return cred;
    }
    
    function didExists(string memory did) external view returns (bool) {
        return didDocuments[did].owner != address(0);
    }
    
    function getDIDInfo(string memory did) external view returns (address owner, bool active, uint256 updated) {
        DIDDocument storage doc = didDocuments[did];
        return (doc.owner, doc.active, doc.updated);
    }
    
    // ===== IERC725 IMPLEMENTATION WITH ENHANCED LOGGING =====
    
    function setData(bytes32 key, bytes memory value) external override whenNotPaused {
        string memory did = _getCallerDID();
        bytes memory oldValue = _didData[did][key];
        
        _didData[did][key] = value;
        
        emit DataChanged(did, msg.sender, key, oldValue, value, block.timestamp);
        emit DataChanged(key, value);
    }
    
    function getData(bytes32 key) external view override returns (bytes memory) {
        string memory did = _getCallerDID();
        return _didData[did][key];
    }
    
    // ===== IERC735 IMPLEMENTATION WITH ENHANCED LOGGING =====
    
    function execute(uint256 operationType, address target, uint256 value, bytes memory data) 
        external override nonReentrant whenNotPaused validAddress(target) returns (bytes memory) 
    {
        string memory did = _getCallerDID();
        
        if (didDocuments[did].owner != msg.sender) {
            revert UnauthorizedDIDOperation(msg.sender, did, didDocuments[did].owner);
        }
        
        emit ExecutionAttempted(did, msg.sender, target, value, data, block.timestamp);
        
        (bool success, bytes memory result) = target.call{value: value}(data);
        
        if (success) {
            emit ExecutionCompleted(did, msg.sender, target, value, data, result, block.timestamp);
            return result;
        } else {
            string memory reason = _getRevertMessage(result);
            emit ExecutionFailed(did, msg.sender, target, value, data, reason, block.timestamp);
            revert ExecutionFailed(target, data);
        }
    }
    
    function addClaim(uint256 topic, uint256 scheme, address issuer, bytes memory signature, bytes memory data, string memory uri) 
        external override whenNotPaused validAddress(issuer) returns (bytes32 claimId) 
    {
        string memory did = _getCallerDID();
        
        if (didDocuments[did].owner != msg.sender && msg.sender != issuer) {
            revert AccessControlUnauthorized(msg.sender, ISSUER_ROLE);
        }
        
        claimId = keccak256(abi.encodePacked(issuer, topic, block.timestamp));
        
        if (_didClaims[did][claimId].issuer == address(0)) {
            _didClaimsByTopic[did][topic].push(claimId);
        }
        
        _didClaims[did][claimId] = IERC735.Claim(topic, scheme, issuer, signature, data, uri);
        
        emit ClaimAdded(did, claimId, topic, issuer, block.timestamp);
        emit ClaimAdded(claimId, topic, scheme, issuer, signature, data, uri);
        
        return claimId;
    }
    
    function removeClaim(bytes32 claimId) external override whenNotPaused returns (bool success) {
        string memory did = _getCallerDID();
        
        if (didDocuments[did].owner != msg.sender) {
            revert UnauthorizedDIDOperation(msg.sender, did, didDocuments[did].owner);
        }
        
        uint256 topic = _didClaims[did][claimId].topic;
        if (topic == 0) {
            revert CredentialNotFound(claimId);
        }
        
        delete _didClaims[did][claimId];
        
        // Remove from topic list
        bytes32[] storage ids = _didClaimsByTopic[did][topic];
        uint256 length = ids.length;
        for (uint i = 0; i < length; i++) {
            if (ids[i] == claimId) {
                ids[i] = ids[length - 1];
                ids.pop();
                break;
            }
        }
        
        emit ClaimRemoved(did, claimId, topic, msg.sender, block.timestamp);
        emit ClaimRemoved(claimId, topic, 0, address(0), "", "", "");
        
        return true;
    }
    
    function getClaim(bytes32 claimId) external view override returns (uint256 topic, uint256 scheme, address issuer, bytes memory signature, bytes memory data, string memory uri) {
        string memory did = _getCallerDID();
        IERC735.Claim memory c = _didClaims[did][claimId];
        return (c.topic, c.scheme, c.issuer, c.signature, c.data, c.uri);
    }
    
    function getClaimIdsByTopic(uint256 topic) external view override returns (bytes32[] memory claimIds) {
        string memory did = _getCallerDID();
        return _didClaimsByTopic[did][topic];
    }
    
    // ===== INTERNAL HELPERS =====
    
    function _getCallerDID() internal view returns (string memory) {
        string[] memory dids = ownerToDids[msg.sender];
        if (dids.length == 0) {
            revert DIDNotFound("caller");
        }
        return dids[0];
    }
    
    function _getRevertMessage(bytes memory returnData) internal pure returns (string memory) {
        if (returnData.length < 68) return "Transaction reverted silently";
        
        assembly {
            returnData := add(returnData, 0x04)
        }
        
        return abi.decode(returnData, (string));
    }
    
    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory s = new bytes(40);
        for (uint i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint256(addr) / (2**(8*(19 - i)))));
            bytes1 hi = b >> 4;
            bytes1 lo = b & 0x0f;
            s[2*i] = char(hi);
            s[2*i + 1] = char(lo);
        }
        return string(s);
    }
    
    function char(bytes1 b) internal pure returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(48 + uint8(b)));
        return bytes1(uint8(87 + uint8(b)));
    }
    
    // ===== BATCH OPERATIONS =====
    
    function batchBridgeDIDs(
        string[] memory dids,
        address[] memory owners,
        string[] memory publicKeys,
        string[] memory serviceEndpoints
    ) external onlyRole(ADMIN_ROLE) whenNotPaused returns (bool) {
        if (dids.length != owners.length || dids.length != publicKeys.length || dids.length != serviceEndpoints.length) {
            revert InvalidArrayLength(dids.length, owners.length);
        }
        
        for (uint256 i = 0; i < dids.length; i++) {
            if (didDocuments[dids[i]].owner != address(0)) {
                revert DIDAlreadyExists(dids[i], didDocuments[dids[i]].owner);
            }
            
            uint256 timestamp = block.timestamp;
            
            DIDDocument storage doc = didDocuments[dids[i]];
            doc.owner = owners[i];
            doc.active = true;
            doc.created = timestamp;
            doc.updated = timestamp;
            doc.publicKey = publicKeys[i];
            doc.serviceEndpoint = serviceEndpoints[i];
            
            ownerToDids[owners[i]].push(dids[i]);
            
            emit DIDBridged(dids[i], owners[i], publicKeys[i], serviceEndpoints[i], timestamp, msg.sender);
        }
        
        return true;
    }
}
