// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuardUpgradeable.sol";

/**
 * @title OptimizedUpgradeableDIDRegistry
 * @dev Gas-optimized upgradeable version of the DID registry with packed structs
 * Uses UUPS pattern and optimized storage layout for maximum gas efficiency
 */
contract OptimizedUpgradeableDIDRegistry is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable 
{
    
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
    
    // Storage variables - order must be maintained for upgrades
    mapping(string => DIDDocument) public didDocuments;
    mapping(bytes32 => VerifiableCredential) public credentials;
    mapping(address => string[]) public ownerToDids;
    
    // Events - optimized with indexed parameters
    event DIDCreated(string indexed did, address indexed owner, string publicKey);
    event DIDUpdated(string indexed did, uint256 updated);
    event DIDDeactivated(string indexed did);
    event CredentialIssued(bytes32 indexed id, string issuer, string subject);
    event CredentialRevoked(bytes32 indexed id);
    event ImplementationUpgraded(address indexed newImplementation);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the upgradeable contract
     * @param initialOwner The address that will own the contract
     */
    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
    }
    
    /**
     * @dev Authorizes an upgrade to a new implementation
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyOwner 
    {
        emit ImplementationUpgraded(newImplementation);
    }
    
    /**
     * @dev Create a new DID document - gas optimized
     */
    function createDID(
        string memory did,
        string memory publicKey,
        string memory serviceEndpoint
    ) external nonReentrant returns (bool) {
        require(didDocuments[did].owner == address(0), "DID already exists");
        require(bytes(did).length > 0, "DID cannot be empty");
        require(bytes(publicKey).length > 0, "Public key cannot be empty");
        
        // Create struct with optimal field ordering
        DIDDocument storage doc = didDocuments[did];
        doc.owner = msg.sender;
        doc.active = true;
        doc.created = block.timestamp;
        doc.updated = block.timestamp;
        doc.publicKey = publicKey;
        doc.serviceEndpoint = serviceEndpoint;
        
        ownerToDids[msg.sender].push(did);
        
        emit DIDCreated(did, msg.sender, publicKey);
        return true;
    }
    
    /**
     * @dev Update DID document - gas optimized
     */
    function updateDID(
        string memory did,
        string memory newPublicKey,
        string memory newServiceEndpoint
    ) external nonReentrant onlyOwner(did) returns (bool) {
        DIDDocument storage doc = didDocuments[did];
        require(doc.active, "DID is not active");
        
        if (bytes(newPublicKey).length > 0) {
            doc.publicKey = newPublicKey;
        }
        
        if (bytes(newServiceEndpoint).length > 0) {
            doc.serviceEndpoint = newServiceEndpoint;
        }
        
        doc.updated = block.timestamp;
        
        emit DIDUpdated(did, block.timestamp);
        return true;
    }
    
    /**
     * @dev Deactivate DID - gas optimized
     */
    function deactivateDID(string memory did) external nonReentrant onlyOwner(did) returns (bool) {
        didDocuments[did].active = false;
        emit DIDDeactivated(did);
        return true;
    }
    
    /**
     * @dev Transfer DID ownership - gas optimized
     */
    function transferDID(string memory did, address newOwner) external nonReentrant onlyOwner(did) returns (bool) {
        require(newOwner != address(0), "New owner cannot be zero address");
        require(newOwner != didDocuments[did].owner, "New owner must be different");
        
        DIDDocument storage doc = didDocuments[did];
        address oldOwner = doc.owner;
        
        // Remove from old owner's list - optimized removal
        string[] storage oldOwnerDids = ownerToDids[oldOwner];
        uint256 length = oldOwnerDids.length;
        for (uint i = 0; i < length; i++) {
            if (keccak256(bytes(oldOwnerDids[i])) == keccak256(bytes(did))) {
                oldOwnerDids[i] = oldOwnerDids[length - 1];
                oldOwnerDids.pop();
                break;
            }
        }
        
        // Update owner
        doc.owner = newOwner;
        doc.updated = block.timestamp;
        
        // Add to new owner's list
        ownerToDids[newOwner].push(did);
        
        emit DIDUpdated(did, block.timestamp);
        return true;
    }
    
    /**
     * @dev Get DID document
     */
    function getDIDDocument(string memory did) external view returns (DIDDocument memory) {
        return didDocuments[did];
    }
    
    /**
     * @dev Issue verifiable credential - gas optimized
     */
    function issueCredential(
        string memory issuer,
        string memory subject,
        string memory credentialType,
        uint256 expires,
        bytes32 dataHash
    ) external nonReentrant returns (bytes32) {
        require(bytes(issuer).length > 0, "Issuer cannot be empty");
        require(bytes(subject).length > 0, "Subject cannot be empty");
        require(bytes(credentialType).length > 0, "Credential type cannot be empty");
        
        bytes32 credentialId = keccak256(abi.encodePacked(
            issuer,
            subject,
            block.timestamp,
            dataHash
        ));
        
        require(credentials[credentialId].id == bytes32(0), "Credential already exists");
        
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
        
        emit CredentialIssued(credentialId, issuer, subject);
        return credentialId;
    }
    
    /**
     * @dev Revoke credential - gas optimized
     */
    function revokeCredential(bytes32 credentialId) external nonReentrant returns (bool) {
        VerifiableCredential storage cred = credentials[credentialId];
        require(cred.id != bytes32(0), "Credential does not exist");
        require(cred.issuer == addressToString(msg.sender), "Only issuer can revoke");
        require(!cred.revoked, "Credential already revoked");
        
        cred.revoked = true;
        emit CredentialRevoked(credentialId);
        return true;
    }
    
    /**
     * @dev Get credential
     */
    function getCredential(bytes32 credentialId) external view returns (VerifiableCredential memory) {
        return credentials[credentialId];
    }
    
    /**
     * @dev Check if credential is valid - gas optimized
     */
    function isCredentialValid(bytes32 credentialId) external view returns (bool) {
        VerifiableCredential storage cred = credentials[credentialId];
        return cred.id != bytes32(0) && !cred.revoked && (cred.expires == 0 || cred.expires > block.timestamp);
    }
    
    /**
     * @dev Get all DIDs for an owner
     */
    function getOwnerDIDs(address owner) external view returns (string[] memory) {
        return ownerToDids[owner];
    }
    
    /**
     * @dev Get contract version for upgrade tracking
     */
    function getVersion() external pure returns (string memory) {
        return "2.0.0-optimized";
    }
    
    /**
     * @dev Get contract type
     */
    function getContractType() external pure returns (string memory) {
        return "OptimizedUpgradeableDIDRegistry";
    }
    
    // --- Gas Optimization Functions ---
    
    /**
     * @dev Batch operation for multiple DID creations - reduces gas costs
     */
    function batchCreateDIDs(
        string[] memory dids,
        string[] memory publicKeys,
        string[] memory serviceEndpoints
    ) external nonReentrant returns (bool) {
        require(dids.length == publicKeys.length && dids.length == serviceEndpoints.length, "Array length mismatch");
        
        for (uint256 i = 0; i < dids.length; i++) {
            require(didDocuments[dids[i]].owner == address(0), "DID already exists");
            require(bytes(dids[i]).length > 0, "DID cannot be empty");
            require(bytes(publicKeys[i]).length > 0, "Public key cannot be empty");
            
            DIDDocument storage doc = didDocuments[dids[i]];
            doc.owner = msg.sender;
            doc.active = true;
            doc.created = block.timestamp;
            doc.updated = block.timestamp;
            doc.publicKey = publicKeys[i];
            doc.serviceEndpoint = serviceEndpoints[i];
            
            ownerToDids[msg.sender].push(dids[i]);
            
            emit DIDCreated(dids[i], msg.sender, publicKeys[i]);
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
    
    /**
     * @dev Batch credential issuance - reduces gas costs
     */
    function batchIssueCredentials(
        string[] memory issuers,
        string[] memory subjects,
        string[] memory credentialTypes,
        uint256[] memory expires,
        bytes32[] memory dataHashes
    ) external nonReentrant returns (bytes32[] memory) {
        require(
            issuers.length == subjects.length && 
            issuers.length == credentialTypes.length && 
            issuers.length == expires.length && 
            issuers.length == dataHashes.length,
            "Array length mismatch"
        );
        
        bytes32[] memory credentialIds = new bytes32[](issuers.length);
        
        for (uint256 i = 0; i < issuers.length; i++) {
            require(bytes(issuers[i]).length > 0, "Issuer cannot be empty");
            require(bytes(subjects[i]).length > 0, "Subject cannot be empty");
            require(bytes(credentialTypes[i]).length > 0, "Credential type cannot be empty");
            
            bytes32 credentialId = keccak256(abi.encodePacked(
                issuers[i],
                subjects[i],
                block.timestamp,
                dataHashes[i]
            ));
            
            require(credentials[credentialId].id == bytes32(0), "Credential already exists");
            
            VerifiableCredential storage cred = credentials[credentialId];
            cred.id = credentialId;
            cred.issued = block.timestamp;
            cred.expires = expires[i];
            cred.revoked = false;
            cred.issuer = issuers[i];
            cred.subject = subjects[i];
            cred.credentialType = credentialTypes[i];
            cred.dataHash = dataHashes[i];
            
            credentialIds[i] = credentialId;
            emit CredentialIssued(credentialId, issuers[i], subjects[i]);
        }
        
        return credentialIds;
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
    
    /**
     * @dev Modifier to check DID ownership
     */
    modifier onlyOwner(string memory did) {
        require(didDocuments[did].owner == msg.sender, "Only DID owner can perform this action");
        _;
    }
}
