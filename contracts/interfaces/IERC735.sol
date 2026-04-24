// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IERC735
 * @dev Interface for ERC735 Claim Management standard with comprehensive functionality
 * 
 * This interface defines the standard for claim management in decentralized identity
 * systems. It enables identity owners to add, remove, and manage claims issued by
 * various parties, providing a standardized way to handle verifiable credentials
 * and attestations.
 * 
 * Key Features:
 * - Claim addition and removal capabilities
 * - Topic-based claim organization
 * - Cryptographic signature verification
 * - URI-based claim metadata storage
 * - Event emission for transparency
 * - Standardized claim structure
 * 
 * Use Cases:
 * - Verifiable credential management
 * - Identity attestations
 * - Reputation systems
 * - KYC/AML verification claims
 * - Educational credentials
 * - Professional certifications
 * 
 * @author Fatima Sanusi
 * @notice Implement this interface to create ERC735-compliant claim management systems
 * @dev Follows the ERC735 standard for blockchain-based claim management
 */
interface IERC735 {
    /// @notice Emitted when a claim is requested
    /// @param claimTopic Topic of the requested claim
    /// @param scheme Verification scheme used
    /// @param issuer Address of the claim issuer
    /// @param signature Cryptographic signature
    /// @param data Claim data
    /// @param uri URI for additional claim information
    event ClaimRequested(uint256 indexed claimTopic, uint256 scheme, address indexed issuer, bytes signature, bytes data, string uri);
    
    /// @notice Emitted when a claim is added to an identity
    /// @param claimId Unique identifier of the claim
    /// @param claimTopic Topic of the claim
    /// @param scheme Verification scheme used
    /// @param issuer Address of the claim issuer
    /// @param signature Cryptographic signature
    /// @param data Claim data
    /// @param uri URI for additional claim information
    event ClaimAdded(bytes32 indexed claimId, uint256 indexed claimTopic, uint256 scheme, address indexed issuer, bytes signature, bytes data, string uri);
    
    /// @notice Emitted when a claim is removed from an identity
    /// @param claimId Unique identifier of the removed claim
    /// @param claimTopic Topic of the removed claim
    /// @param scheme Verification scheme used
    /// @param issuer Address of the claim issuer
    /// @param signature Cryptographic signature
    /// @param data Claim data
    /// @param uri URI for additional claim information
    event ClaimRemoved(bytes32 indexed claimId, uint256 indexed claimTopic, uint256 scheme, address indexed issuer, bytes signature, bytes data, string uri);
    
    /// @notice Emitted when a claim is changed/updated
    /// @param claimId Unique identifier of the changed claim
    /// @param claimTopic Topic of the changed claim
    /// @param scheme Verification scheme used
    /// @param issuer Address of the claim issuer
    /// @param signature Cryptographic signature
    /// @param data Claim data
    /// @param uri URI for additional claim information
    event ClaimChanged(bytes32 indexed claimId, uint256 indexed claimTopic, uint256 scheme, address indexed issuer, bytes signature, bytes data, string uri);

    /// @notice Structure representing a claim with all its components
    /// @dev Contains all necessary information for a verifiable claim
    struct Claim {
        /// @notice Topic category of the claim
        uint256 topic;
        /// @notice Verification scheme used for the claim
        uint256 scheme;
        /// @notice Address of the claim issuer
        address issuer;
        /// @notice Cryptographic signature confirming issuer authenticity
        bytes signature;
        /// @notice The actual data/content of the claim
        bytes data;
        /// @notice URI pointing to additional claim metadata
        string uri;
    }

    /**
     * @notice Retrieves a claim by its unique identifier
     * @dev Returns all components of the specified claim
     * @param _claimId Unique identifier of the claim to retrieve
     * @return topic Topic category of the claim
     * @return scheme Verification scheme used
     * @return issuer Address of the claim issuer
     * @return signature Cryptographic signature
     * @return data Claim data
     * @return uri URI for additional information
     */
    function getClaim(bytes32 _claimId) external view returns (uint256 topic, uint256 scheme, address issuer, bytes memory signature, bytes memory data, string memory uri);
    
    /**
     * @notice Retrieves all claim IDs for a specific topic
     * @dev Returns an array of claim IDs associated with the given topic
     * @param _topic Topic category to search for
     * @return claimIds Array of claim IDs for the specified topic
     */
    function getClaimIdsByTopic(uint256 _topic) external view returns (bytes32[] memory claimIds);
    
    /**
     * @notice Adds a new claim to the identity
     * @dev Creates a new claim with the provided parameters and returns its ID
     * @param _topic Topic category for the claim
     * @param _scheme Verification scheme to be used
     * @param _issuer Address of the claim issuer
     * @param _signature Cryptographic signature for verification
     * @param _data Claim data/content
     * @param _uri URI for additional claim information
     * @return claimId Unique identifier of the newly created claim
     * @throws AccessControl if caller is not authorized to add claims
     * @throws InvalidClaim if claim parameters are invalid
     */
    function addClaim(uint256 _topic, uint256 _scheme, address _issuer, bytes memory _signature, bytes memory _data, string memory _uri) external returns (bytes32 claimId);
    
    /**
     * @notice Removes a claim from the identity
     * @dev Deletes the specified claim and returns success status
     * @param _claimId Unique identifier of the claim to remove
     * @return success Whether the removal was successful
     * @throws AccessControl if caller is not authorized to remove claims
     * @throws ClaimNotFound if the specified claim does not exist
     */
    function removeClaim(bytes32 _claimId) external returns (bool success);
}
