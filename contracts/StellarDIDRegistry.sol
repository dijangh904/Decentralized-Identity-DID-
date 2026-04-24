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
    
    // Rate limiting for contract operations
    struct RateLimit {
        uint256 lastOperation;
        uint256 operationCount;
        uint256 windowStart;
    }
    
    mapping(address => RateLimit) private userRateLimits;
    
    // Rate limiting parameters (can be adjusted by contract owner)
    uint256 public constant RATE_LIMIT_WINDOW = 5 minutes;
    uint256 public constant MAX_OPERATIONS_PER_WINDOW = 10;
    uint256 public constant COOLDOWN_PERIOD = 30 seconds;
    
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
    
    modifier onlyOwner(string memory did) {
        require(didDocuments[did].owner == msg.sender, "Only DID owner can perform this action");
        _;
    }
    
    modifier rateLimited() {
        _enforceRateLimit();
        _;
    }
    
    function _enforceRateLimit() internal {
        RateLimit storage limit = userRateLimits[msg.sender];
        uint256 currentTime = block.timestamp;
        
        // Reset window if expired
        if (currentTime >= limit.windowStart + RATE_LIMIT_WINDOW) {
            limit.windowStart = currentTime;
            limit.operationCount = 0;
        }
        
        // Enforce cooldown period between operations
        require(
            currentTime >= limit.lastOperation + COOLDOWN_PERIOD,
            "Operation cooldown period not met"
        );
        
        // Enforce maximum operations per window
        require(
            limit.operationCount < MAX_OPERATIONS_PER_WINDOW,
            "Rate limit exceeded for this window"
        );
        
        // Update rate limit tracking
        limit.lastOperation = currentTime;
        limit.operationCount++;
    }
    
    function getUserRateLimit(address user) external view returns (
        uint256 lastOperation,
        uint256 operationCount,
        uint256 windowStart,
        uint256 remainingOperations,
        uint256 cooldownRemaining
    ) {
        RateLimit storage limit = userRateLimits[user];
        uint256 currentTime = block.timestamp;
        
        // Calculate remaining operations
        uint256 remaining = 0;
        if (currentTime < limit.windowStart + RATE_LIMIT_WINDOW) {
            remaining = MAX_OPERATIONS_PER_WINDOW > limit.operationCount ? 
                MAX_OPERATIONS_PER_WINDOW - limit.operationCount : 0;
        } else {
            remaining = MAX_OPERATIONS_PER_WINDOW;
        }
        
        // Calculate cooldown remaining
        uint256 cooldown = 0;
        if (currentTime < limit.lastOperation + COOLDOWN_PERIOD) {
            cooldown = (limit.lastOperation + COOLDOWN_PERIOD) - currentTime;
        }
        
        return (
            limit.lastOperation,
            limit.operationCount,
            limit.windowStart,
            remaining,
            cooldown
        );
    }
    
    /**
     * @dev Create a new DID document
     */
    function createDID(
        string memory did,
        string memory publicKey,
        string memory serviceEndpoint
    ) external rateLimited returns (bool) {
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
    ) external onlyOwner(did) rateLimited returns (bool) {
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
    function deactivateDID(string memory did) external onlyOwner(did) returns (bool) {
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
    ) external rateLimited returns (bytes32) {
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
    function revokeCredential(bytes32 credentialId) external returns (bool) {
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
}
