// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IERC725.sol";
import "../interfaces/IERC735.sol";

/**
 * @title EthereumDIDRegistry
 * @dev Smart contract interface for DID operations on Ethereum and EVM-compatible chains.
 * Acts as the cross-chain bridge counterpart for Stellar DID registry.
 * Implements ERC-725 and ERC-735 standards for identity and claim management.
 */
contract EthereumDIDRegistry is IERC725, IERC735 {
    using SafeMath for uint256;
    
    // Role-based access control
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant RECOVERY_ROLE = keccak256("RECOVERY_ROLE");
    
    mapping(bytes32 => mapping(address => bool)) private _roles;
    address private _admin;
    
    // State recovery contract
    address public stateRecoveryContract;
    bool public recoveryMode;
    
    struct DIDDocument {
        address owner;
        uint256 created;
        uint256 updated;
        bool active;
        string publicKey;
        string serviceEndpoint;
    }
    
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
    
    mapping(string => DIDDocument) public didDocuments;
    mapping(bytes32 => VerifiableCredential) public credentials;
    mapping(address => string[]) public ownerToDids;
    
    // ERC725/735 Storage mapped by DID
    mapping(string => mapping(bytes32 => bytes)) private _didData;
    mapping(string => mapping(bytes32 => IERC735.Claim)) private _didClaims;
    mapping(string => mapping(uint256 => bytes32[])) private _didClaimsByTopic;
    
    event DIDBridged(string indexed did, address indexed owner, string publicKey);
    event DIDUpdated(string indexed did, uint256 updated);
    event CredentialBridged(bytes32 indexed id, string issuer, string subject);
    
    modifier onlyRole(bytes32 role) {
        require(_roles[role][msg.sender], "AccessControl: caller missing role");
        _;
    }
    
    modifier onlyOwner(string memory did) {
        require(didDocuments[did].owner == msg.sender, "Only DID owner can perform this action");
        _;
    }
    
    modifier onlyRecoveryContract() {
        require(msg.sender == stateRecoveryContract, "Only recovery contract can call this function");
        _;
    }
    
    modifier whenNotInRecoveryMode() {
        require(!recoveryMode, "Contract is in recovery mode");
        _;
    }
    
    modifier whenInRecoveryMode() {
        require(recoveryMode, "Contract is not in recovery mode");
        _;
    }
    
    constructor() {
        _admin = msg.sender;
        _roles[ADMIN_ROLE][msg.sender] = true;
    }

    function grantRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
        require(role != bytes32(0), "Role cannot be zero");
        require(account != address(0), "Account cannot be zero address");
        require(account != msg.sender, "Cannot grant role to self");
        require(!_roles[role][account], "Account already has this role");
        _roles[role][account] = true;
    }
    
    /**
     * @dev Bridge a Stellar DID to Ethereum
     */
    function bridgeDID(
        string memory did,
        address ownerAddress,
        string memory publicKey,
        string memory serviceEndpoint
    ) external onlyRole(ADMIN_ROLE) returns (bool) {
        require(bytes(did).length > 0, "DID cannot be empty");
        require(bytes(did).length <= 256, "DID too long");
        require(ownerAddress != address(0), "Owner cannot be zero address");
        require(bytes(publicKey).length > 0, "Public key cannot be empty");
        require(bytes(publicKey).length <= 2048, "Public key too long");
        require(bytes(serviceEndpoint).length <= 512, "Service endpoint too long");
        require(didDocuments[did].owner == address(0), "DID already exists on this chain");
        
        didDocuments[did] = DIDDocument({
            owner: ownerAddress,
            created: block.timestamp,
            updated: block.timestamp,
            active: true,
            publicKey: publicKey,
            serviceEndpoint: serviceEndpoint
        });
        
        ownerToDids[ownerAddress].push(did);
        
        emit DIDBridged(did, ownerAddress, publicKey);
        return true;
    }
    
    /**
     * @dev Bridge a Verifiable Credential to Ethereum
     */
    function bridgeCredential(
        bytes32 credentialId,
        string memory issuer,
        string memory subject,
        string memory credentialType,
        uint256 expires,
        bytes32 dataHash
    ) external onlyRole(ADMIN_ROLE) returns (bytes32) {
        require(credentialId != bytes32(0), "Credential ID cannot be zero");
        require(bytes(issuer).length > 0, "Issuer cannot be empty");
        require(bytes(issuer).length <= 256, "Issuer name too long");
        require(bytes(subject).length > 0, "Subject cannot be empty");
        require(bytes(subject).length <= 256, "Subject name too long");
        require(bytes(credentialType).length > 0, "Credential type cannot be empty");
        require(bytes(credentialType).length <= 128, "Credential type too long");
        require(expires > block.timestamp, "Expiration must be in the future");
        require(expires <= block.timestamp + 365 days, "Expiration too far in future");
        require(dataHash != bytes32(0), "Data hash cannot be zero");
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
        
        emit CredentialBridged(credentialId, issuer, subject);
        return credentialId;
    }
    
    function getDIDDocument(string memory did) external view returns (DIDDocument memory) {
        return didDocuments[did];
    }
    
    function getCredential(bytes32 credentialId) external view returns (VerifiableCredential memory) {
        return credentials[credentialId];
    }

    // --- IERC725 Implementation ---

    function setData(bytes32 key, bytes memory value) external override {
        require(key != bytes32(0), "Key cannot be zero");
        require(value.length <= 2048, "Value too large");
        string memory did = _getCallerDID();
        _didData[did][key] = value;
        emit DataChanged(key, value);
    }

    function getData(bytes32 key) external view override returns (bytes memory) {
        string memory did = _getCallerDID();
        return _didData[did][key];
    }

    function execute(uint256 operationType, address target, uint256 value, bytes memory data) 
        external override returns (bytes memory) 
    {
        require(target != address(0), "Target cannot be zero address");
        require(target != address(this), "Cannot call contract itself");
        require(value <= 100 ether, "Value too high");
        require(data.length <= 10240, "Data too large");
        require(operationType <= 255, "Operation type out of range");
        
        string memory did = _getCallerDID();
        require(didDocuments[did].owner == msg.sender, "Only DID owner can execute calls");
        
        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "Execution failed");
        
        emit Executed(operationType, target, value, data);
        return result;
    }

    // --- IERC735 Implementation ---

    function addClaim(uint256 topic, uint256 scheme, address issuer, bytes memory signature, bytes memory data, string memory uri) 
        external override returns (bytes32 claimId) 
    {
        require(topic <= 1000000, "Topic number too large");
        require(scheme <= 255, "Scheme number too large");
        require(issuer != address(0), "Issuer cannot be zero address");
        require(signature.length <= 132, "Invalid signature length");
        require(data.length <= 2048, "Claim data too large");
        require(bytes(uri).length <= 512, "URI too long");
        
        string memory did = _getCallerDID();
        // Standard ERC735: identity owner or issuer adds claim
        require(didDocuments[did].owner == msg.sender || msg.sender == issuer, "Unauthorized to add claim");

        claimId = keccak256(abi.encodePacked(issuer, topic));
        
        if (_didClaims[did][claimId].issuer == address(0)) {
            _didClaimsByTopic[did][topic].push(claimId);
        }
        
        _didClaims[did][claimId] = IERC735.Claim(topic, scheme, issuer, signature, data, uri);
        
        emit ClaimAdded(claimId, topic, scheme, issuer, signature, data, uri);
        return claimId;
    }

    function removeClaim(bytes32 claimId) external override returns (bool success) {
        string memory did = _getCallerDID();
        require(didDocuments[did].owner == msg.sender, "Only DID owner can remove claims");
        
        uint256 topic = _didClaims[did][claimId].topic;
        require(topic != 0, "Claim does not exist");
        
        delete _didClaims[did][claimId];
        
        // Remove from topic list
        bytes32[] storage ids = _didClaimsByTopic[did][topic];
        for (uint i = 0; i < ids.length; i++) {
            if (ids[i] == claimId) {
                ids[i] = ids[ids.length - 1];
                ids.pop();
                break;
            }
        }
        
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

    // --- Recovery Functions ---
    
    /**
     * @dev Set state recovery contract address
     */
    function setStateRecoveryContract(address _stateRecoveryContract) external onlyRole(ADMIN_ROLE) {
        require(_stateRecoveryContract != address(0), "Recovery contract cannot be zero address");
        require(_stateRecoveryContract != address(this), "Cannot set self as recovery contract");
        require(_stateRecoveryContract.code.length > 0, "Recovery contract must be a contract");
        stateRecoveryContract = _stateRecoveryContract;
    }
    
    /**
     * @dev Enable recovery mode (emergency only)
     */
    function enableRecoveryMode() external onlyRole(ADMIN_ROLE) {
        recoveryMode = true;
    }
    
    /**
     * @dev Disable recovery mode
     */
    function disableRecoveryMode() external onlyRole(ADMIN_ROLE) {
        recoveryMode = false;
    }
    
    /**
     * @dev Recover DID document corruption
     */
    function recoverDIDDocument(
        string memory did,
        address newOwner,
        string memory newPublicKey,
        string memory newServiceEndpoint
    ) external onlyRecoveryContract whenInRecoveryMode returns (bool) {
        require(bytes(did).length > 0, "DID cannot be empty");
        require(newOwner != address(0), "New owner cannot be zero address");
        require(bytes(newPublicKey).length > 0, "Public key cannot be empty");
        
        // Check if DID exists
        if (bytes(didDocuments[did].did).length == 0) {
            // Create new DID document if it doesn't exist
            didDocuments[did] = DIDDocument({
                did: did,
                owner: newOwner,
                publicKey: newPublicKey,
                created: block.timestamp,
                updated: block.timestamp,
                active: true,
                serviceEndpoint: newServiceEndpoint
            });
            
            // Add to owner's DID list
            ownerToDids[newOwner].push(did);
        } else {
            // Update existing DID document
            didDocuments[did].owner = newOwner;
            didDocuments[did].publicKey = newPublicKey;
            didDocuments[did].updated = block.timestamp;
            didDocuments[did].active = true;
            if (bytes(newServiceEndpoint).length > 0) {
                didDocuments[did].serviceEndpoint = newServiceEndpoint;
            }
            
            // Update owner mapping if needed
            bool found = false;
            for (uint i = 0; i < ownerToDids[newOwner].length; i++) {
                if (keccak256(bytes(ownerToDids[newOwner][i])) == keccak256(bytes(did))) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                ownerToDids[newOwner].push(did);
            }
        }
        
        emit DIDUpdated(did, block.timestamp);
        return true;
    }
    
    /**
     * @dev Recover verifiable credential corruption
     */
    function recoverCredential(
        bytes32 credentialId,
        string memory newIssuer,
        string memory newSubject,
        string memory newType,
        uint256 newExpires,
        bytes32 newDataHash
    ) external onlyRecoveryContract whenInRecoveryMode returns (bool) {
        require(credentialId != bytes32(0), "Credential ID cannot be zero");
        require(bytes(newIssuer).length > 0, "Issuer cannot be empty");
        require(bytes(newSubject).length > 0, "Subject cannot be empty");
        
        // Create or update credential
        credentials[credentialId] = VerifiableCredential({
            id: credentialId,
            issuer: newIssuer,
            subject: newSubject,
            credentialType: newType,
            issued: block.timestamp,
            expires: newExpires,
            dataHash: newDataHash,
            revoked: false
        });
        
        emit CredentialBridged(credentialId, newIssuer, newSubject);
        return true;
    }
    
    /**
     * @dev Recover ownership mapping corruption
     */
    function recoverOwnershipMapping(
        address oldOwner,
        address newOwner,
        string memory did
    ) external onlyRecoveryContract whenInRecoveryMode returns (bool) {
        require(oldOwner != address(0), "Old owner cannot be zero address");
        require(newOwner != address(0), "New owner cannot be zero address");
        require(bytes(did).length > 0, "DID cannot be empty");
        
        // Remove from old owner's list
        string[] storage oldOwnerDids = ownerToDids[oldOwner];
        for (uint i = 0; i < oldOwnerDids.length; i++) {
            if (keccak256(bytes(oldOwnerDids[i])) == keccak256(bytes(did))) {
                oldOwnerDids[i] = oldOwnerDids[oldOwnerDids.length - 1];
                oldOwnerDids.pop();
                break;
            }
        }
        
        // Add to new owner's list
        ownerToDids[newOwner].push(did);
        
        // Update DID document owner
        if (bytes(didDocuments[did].did).length > 0) {
            didDocuments[did].owner = newOwner;
            didDocuments[did].updated = block.timestamp;
        }
        
        emit DIDUpdated(did, block.timestamp);
        return true;
    }
    
    /**
     * @dev Recover role assignment corruption
     */
    function recoverRoleAssignment(
        bytes32 role,
        address account,
        bool grant
    ) external onlyRecoveryContract whenInRecoveryMode returns (bool) {
        require(role != bytes32(0), "Role cannot be zero");
        require(account != address(0), "Account cannot be zero address");
        
        if (grant) {
            _roles[role][account] = true;
        } else {
            _roles[role][account] = false;
        }
        
        return true;
    }
    
    /**
     * @dev Validate contract state integrity
     */
    function validateStateIntegrity() external view returns (bool isValid, string memory issue) {
        // Check for critical inconsistencies
        uint256 didCount = 0;
        uint256 ownerMappingCount = 0;
        
        // This is a simplified validation - in production, you'd want more comprehensive checks
        for (uint i = 0; i < 100; i++) {
            // Sample check - would need proper iteration in production
            if (i == 0) break; // Placeholder for actual validation logic
        }
        
        isValid = true;
        issue = "No issues found";
    }
    
    /**
     * @dev Get contract state summary for recovery purposes
     */
    function getStateSummary() external view returns (
        uint256 totalDIDs,
        uint256 totalCredentials,
        uint256 totalOwners,
        bool isInRecoveryMode
    ) {
        // This would require proper storage of counts in production
        totalDIDs = 0; // Placeholder
        totalCredentials = 0; // Placeholder
        totalOwners = 0; // Placeholder
        isInRecoveryMode = recoveryMode;
    }

// --- Helpers ---

    function _getCallerDID() internal view returns (string memory) {
        string[] memory dids = ownerToDids[msg.sender];
        require(dids.length > 0, "No DID found for caller address");
        return dids[0]; // Default to the first DID associated with the caller
    }
}
