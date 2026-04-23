// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title StellarDIDRegistry
 * @dev Smart contract interface for DID operations that can be called from Stellar
 * Note: This is a conceptual representation for cross-chain communication
 * In practice, Stellar smart contracts are implemented differently
 */
contract StellarDIDRegistry {
    
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
    
    // Emergency state variables
    address public emergencyAdmin;
    bool public paused;
    bool public emergencyMode;
    uint256 public emergencyPauseTimestamp;
    
    event DIDCreated(string indexed did, address indexed owner, string publicKey);
    event DIDUpdated(string indexed did, uint256 updated);
    event DIDDeactivated(string indexed did);
    event CredentialIssued(bytes32 indexed id, string issuer, string subject);
    event CredentialRevoked(bytes32 indexed id);
    
    // Emergency events
    event EmergencyPaused(address indexed admin, uint256 timestamp);
    event EmergencyDrained(address indexed admin, uint256 amount);
    event EmergencyRecovered(address indexed admin, uint256 timestamp);
    event EmergencyAdminChanged(address indexed oldAdmin, address indexed newAdmin);
    
    modifier onlyOwner(string memory did) {
        require(didDocuments[did].owner == msg.sender, "Only DID owner can perform this action");
        _;
    }
    
    modifier onlyEmergencyAdmin() {
        require(msg.sender == emergencyAdmin, "Only emergency admin can perform this action");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused due to emergency");
        _;
    }
    
    modifier whenEmergencyMode() {
        require(emergencyMode, "Contract is not in emergency mode");
        _;
    }
    
    /**
     * @dev Create a new DID document
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
     * @dev Update DID document
     */
    function updateDID(
        string memory did,
        string memory newPublicKey,
        string memory newServiceEndpoint
    ) external onlyOwner(did) whenNotPaused returns (bool) {
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
    function deactivateDID(string memory did) external onlyOwner(did) whenNotPaused returns (bool) {
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
     */
    function issueCredential(
        string memory issuer,
        string memory subject,
        string memory credentialType,
        uint256 expires,
        bytes32 dataHash
    ) external whenNotPaused returns (bytes32) {
        bytes32 credentialId = keccak256(abi.encodePacked(
            issuer,
            subject,
            block.timestamp,
            dataHash
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
     */
    function revokeCredential(bytes32 credentialId) external whenNotPaused returns (bool) {
        require(credentials[credentialId].issuer == addressToString(msg.sender), "Only issuer can revoke");
        
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
        return !cred.revoked && (cred.expires == 0 || cred.expires > block.timestamp);
    }
    
    /**
     * @dev Get all DIDs for an owner
     */
    function getOwnerDIDs(address owner) external view returns (string[] memory) {
        return ownerToDids[owner];
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
    
    // Emergency Functions
    
    /**
     * @dev Constructor to set emergency admin
     */
    constructor() {
        emergencyAdmin = msg.sender;
        paused = false;
        emergencyMode = false;
        emergencyPauseTimestamp = 0;
    }
    
    /**
     * @dev Emergency pause function - halts all contract operations
     * Can only be called by emergency admin
     */
    function emergencyPause() external onlyEmergencyAdmin {
        paused = true;
        emergencyMode = true;
        emergencyPauseTimestamp = block.timestamp;
        emit EmergencyPaused(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Emergency drain function - extracts all funds from contract
     * Can only be called by emergency admin when contract is in emergency mode
     */
    function emergencyDrain() external onlyEmergencyAdmin whenEmergencyMode {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to drain");
        
        (bool success, ) = payable(emergencyAdmin).call{value: balance}("");
        require(success, "Transfer failed");
        
        emit EmergencyDrained(msg.sender, balance);
    }
    
    /**
     * @dev Emergency recovery function - restores normal operations
     * Can only be called by emergency admin
     */
    function emergencyRecover() external onlyEmergencyAdmin {
        paused = false;
        emergencyMode = false;
        emergencyPauseTimestamp = 0;
        emit EmergencyRecovered(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Change emergency admin
     * Can only be called by current emergency admin
     */
    function changeEmergencyAdmin(address newAdmin) external onlyEmergencyAdmin {
        require(newAdmin != address(0), "New admin cannot be zero address");
        require(newAdmin != emergencyAdmin, "New admin must be different");
        
        address oldAdmin = emergencyAdmin;
        emergencyAdmin = newAdmin;
        
        emit EmergencyAdminChanged(oldAdmin, newAdmin);
    }
    
    /**
     * @dev Check if contract is in emergency state
     */
    function isEmergencyState() external view returns (bool isPaused, bool isEmergencyMode, uint256 pauseTimestamp) {
        return (paused, emergencyMode, emergencyPauseTimestamp);
    }
    
    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {}
    
    /**
     * @dev Fallback function to accept ETH
     */
    fallback() external payable {}
}
