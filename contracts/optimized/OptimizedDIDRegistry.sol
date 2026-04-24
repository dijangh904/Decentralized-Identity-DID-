// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IERC725.sol";
import "../interfaces/IERC735.sol";

/**
 * @title OptimizedDIDRegistry
 * @dev Gas-optimized version of the DID registry with packed structs and efficient storage layout
 * Implements ERC-725 and ERC-735 standards for identity and claim management
 */
contract OptimizedDIDRegistry is IERC725, IERC735 {
    using SafeMath for uint256;
    
    // Role-based access control - packed into single storage slot
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    
    mapping(bytes32 => mapping(address => bool)) private _roles;
    address private _admin;
    
    // Optimized DIDDocument struct - packed for gas efficiency
    // Storage layout: [address(20) + bool(1) + padding(11)] = 32 bytes (1 slot)
    // [uint256] = 32 bytes (1 slot) 
    // [uint256] = 32 bytes (1 slot)
    // Strings stored separately
    struct DIDDocument {
        address owner;        // 20 bytes
        bool active;          // 1 byte
        uint256 created;      // 32 bytes
        uint256 updated;      // 32 bytes
        string publicKey;     // dynamic
        string serviceEndpoint; // dynamic
    }
    
    // Optimized VerifiableCredential struct
    // Storage layout: [bytes32(32) + uint256(32) + uint256(32) + bool(1) + padding(7)] = 105 bytes (4 slots)
    // Strings stored separately
    struct VerifiableCredential {
        bytes32 id;           // 32 bytes
        uint256 issued;       // 32 bytes
        uint256 expires;      // 32 bytes
        bool revoked;         // 1 byte
        string issuer;        // dynamic
        string subject;       // dynamic
        string credentialType; // dynamic
        bytes32 dataHash;     // 32 bytes
    }
    
    // Storage mappings - optimized order
    mapping(string => DIDDocument) public didDocuments;
    mapping(bytes32 => VerifiableCredential) public credentials;
    mapping(address => string[]) public ownerToDids;
    
    // ERC725/735 Storage mapped by DID
    mapping(string => mapping(bytes32 => bytes)) private _didData;
    mapping(string => mapping(bytes32 => IERC735.Claim)) private _didClaims;
    mapping(string => mapping(uint256 => bytes32[])) private _didClaimsByTopic;
    
    // Events - optimized with indexed parameters
    event DIDBridged(string indexed did, address indexed owner, string publicKey);
    event DIDUpdated(string indexed did, uint256 updated);
    event CredentialBridged(bytes32 indexed id, string issuer, string subject);
    
    // Modifiers
    modifier onlyRole(bytes32 role) {
        require(_roles[role][msg.sender], "AccessControl: caller missing role");
        _;
    }
    
    modifier onlyOwner(string memory did) {
        require(didDocuments[did].owner == msg.sender, "Only DID owner can perform this action");
        _;
    }
    
    constructor() {
        _admin = msg.sender;
        _roles[ADMIN_ROLE][msg.sender] = true;
    }

    function grantRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
        _roles[role][account] = true;
    }
    
    /**
     * @dev Bridge a Stellar DID to Ethereum - gas optimized
     */
    function bridgeDID(
        string memory did,
        address ownerAddress,
        string memory publicKey,
        string memory serviceEndpoint
    ) external onlyRole(ADMIN_ROLE) returns (bool) {
        require(didDocuments[did].owner == address(0), "DID already exists on this chain");
        
        // Create struct with optimal field ordering
        DIDDocument storage doc = didDocuments[did];
        doc.owner = ownerAddress;
        doc.active = true;
        doc.created = block.timestamp;
        doc.updated = block.timestamp;
        doc.publicKey = publicKey;
        doc.serviceEndpoint = serviceEndpoint;
        
        ownerToDids[ownerAddress].push(did);
        
        emit DIDBridged(did, ownerAddress, publicKey);
        return true;
    }
    
    /**
     * @dev Bridge a Verifiable Credential to Ethereum - gas optimized
     */
    function bridgeCredential(
        bytes32 credentialId,
        string memory issuer,
        string memory subject,
        string memory credentialType,
        uint256 expires,
        bytes32 dataHash
    ) external onlyRole(ADMIN_ROLE) returns (bytes32) {
        require(credentials[credentialId].issued == 0, "Credential already exists");
        
        // Create struct with optimal field ordering
        VerifiableCredential storage cred = credentials[credentialId];
        cred.id = credentialId;
        cred.issued = block.timestamp;
        cred.expires = expires;
        cred.revoked = false;
        cred.issuer = issuer;
        cred.subject = subject;
        cred.credentialType = credentialType;
        cred.dataHash = dataHash;
        
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
        string memory did = _getCallerDID();
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
        
        // Remove from topic list - optimized removal
        bytes32[] storage ids = _didClaimsByTopic[did][topic];
        uint256 length = ids.length;
        for (uint i = 0; i < length; i++) {
            if (ids[i] == claimId) {
                ids[i] = ids[length - 1];
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

    // --- Internal Helpers ---

    function _getCallerDID() internal view returns (string memory) {
        string[] memory dids = ownerToDids[msg.sender];
        require(dids.length > 0, "No DID found for caller address");
        return dids[0];
    }
    
    // --- Gas Optimization Functions ---
    
    /**
     * @dev Batch operation for multiple DID creations - reduces gas costs
     */
    function batchBridgeDIDs(
        string[] memory dids,
        address[] memory owners,
        string[] memory publicKeys,
        string[] memory serviceEndpoints
    ) external onlyRole(ADMIN_ROLE) returns (bool) {
        require(dids.length == owners.length && dids.length == publicKeys.length && dids.length == serviceEndpoints.length, "Array length mismatch");
        
        for (uint256 i = 0; i < dids.length; i++) {
            require(didDocuments[dids[i]].owner == address(0), "DID already exists");
            
            DIDDocument storage doc = didDocuments[dids[i]];
            doc.owner = owners[i];
            doc.active = true;
            doc.created = block.timestamp;
            doc.updated = block.timestamp;
            doc.publicKey = publicKeys[i];
            doc.serviceEndpoint = serviceEndpoints[i];
            
            ownerToDids[owners[i]].push(dids[i]);
            
            emit DIDBridged(dids[i], owners[i], publicKeys[i]);
        }
        
        return true;
    }
    
    /**
     * @dev Check if DID exists without loading full struct - gas efficient
     */
    function didExists(string memory did) external view returns (bool) {
        return didDocuments[did].owner != address(0);
    }
    
    /**
     * @dev Get only essential DID info - saves gas when full document not needed
     */
    function getDIDInfo(string memory did) external view returns (address owner, bool active, uint256 updated) {
        DIDDocument storage doc = didDocuments[did];
        return (doc.owner, doc.active, doc.updated);
    }
}
