// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuardUpgradeable.sol";

/**
 * @title UpgradeableStellarDIDRegistry
 * @dev Upgradeable version of the StellarDIDRegistry using UUPS pattern
 * This contract implements the DID registry functionality with upgradeability
 */
contract UpgradeableStellarDIDRegistry is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable 
{
    
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
    
    // Storage variables - order must be maintained for upgrades
    mapping(string => DIDDocument) public didDocuments;
    mapping(bytes32 => VerifiableCredential) public credentials;
    mapping(address => string[]) public ownerToDids;
    
    // Events
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
     * @dev Create a new DID document
     */
    function createDID(
        string memory did,
        string memory publicKey,
        string memory serviceEndpoint
    ) external nonReentrant returns (bool) {
        require(didDocuments[did].owner == address(0), "DID already exists");
        require(bytes(did).length > 0, "DID cannot be empty");
        require(bytes(publicKey).length > 0, "Public key cannot be empty");
        
        didDocuments[did] = DIDDocument({
            owner: msg.sender,
            created: block.timestamp,
            updated: block.timestamp,
            active: true,
            publicKey: publicKey,
            serviceEndpoint: serviceEndpoint
        });
        
        ownerToDids[msg.sender].push(did);
        
        emit DIDCreated(did, msg.sender, publicKey);
        return true;
    }
    
    /**
     * @dev Update DID document
     */
    function updateDID(
        string memory did,
        string memory newPublicKey,
        string memory newServiceEndpoint
    ) external nonReentrant onlyOwner(did) returns (bool) {
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
     * @dev Deactivate DID
     */
    function deactivateDID(string memory did) external nonReentrant onlyOwner(did) returns (bool) {
        didDocuments[did].active = false;
        emit DIDDeactivated(did);
        return true;
    }
    
    /**
     * @dev Transfer DID ownership
     */
    function transferDID(string memory did, address newOwner) external nonReentrant onlyOwner(did) returns (bool) {
        require(newOwner != address(0), "New owner cannot be zero address");
        require(newOwner != didDocuments[did].owner, "New owner must be different");
        
        // Remove from old owner's list
        string[] storage oldOwnerDids = ownerToDids[didDocuments[did].owner];
        for (uint i = 0; i < oldOwnerDids.length; i++) {
            if (keccak256(bytes(oldOwnerDids[i])) == keccak256(bytes(did))) {
                oldOwnerDids[i] = oldOwnerDids[oldOwnerDids.length - 1];
                oldOwnerDids.pop();
                break;
            }
        }
        
        // Update owner
        didDocuments[did].owner = newOwner;
        didDocuments[did].updated = block.timestamp;
        
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
     * @dev Issue verifiable credential
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
     */
    function revokeCredential(bytes32 credentialId) external nonReentrant returns (bool) {
        require(credentials[credentialId].id != bytes32(0), "Credential does not exist");
        require(credentials[credentialId].issuer == addressToString(msg.sender), "Only issuer can revoke");
        require(!credentials[credentialId].revoked, "Credential already revoked");
        
        credentials[credentialId].revoked = true;
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
     * @dev Check if credential is valid
     */
    function isCredentialValid(bytes32 credentialId) external view returns (bool) {
        VerifiableCredential memory cred = credentials[credentialId];
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
        return "1.0.0";
    }
    
    /**
     * @dev Get contract type
     */
    function getContractType() external pure returns (string memory) {
        return "UpgradeableStellarDIDRegistry";
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
