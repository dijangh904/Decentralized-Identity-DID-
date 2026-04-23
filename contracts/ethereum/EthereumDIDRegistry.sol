// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title EthereumDIDRegistry
 * @dev Smart contract interface for DID operations on Ethereum and EVM-compatible chains.
 * Acts as the cross-chain bridge counterpart for Stellar DID registry.
 */
contract EthereumDIDRegistry {
    using SafeMath for uint256;
    
    // Role-based access control
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    
    mapping(bytes32 => mapping(address => bool)) private _roles;
    address private _admin;
    
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
    
    constructor() {
        _admin = msg.sender;
        _roles[ADMIN_ROLE][msg.sender] = true;
    }

    function grantRole(bytes32 role, address account) external onlyRole(ADMIN_ROLE) {
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
        require(bytes(didDocuments[did].did).length == 0, "DID already exists on this chain");
        
        didDocuments[did] = DIDDocument({
            did: did,
            owner: ownerAddress,
            publicKey: publicKey,
            created: block.timestamp,
            updated: block.timestamp,
            active: true,
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
}
