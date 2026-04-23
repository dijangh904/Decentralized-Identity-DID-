// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IERC735
 * @dev Interface for ERC735 Claim Management standard
 */
interface IERC735 {
    event ClaimRequested(uint256 indexed claimTopic, uint256 scheme, address indexed issuer, bytes signature, bytes data, string uri);
    event ClaimAdded(bytes32 indexed claimId, uint256 indexed claimTopic, uint256 scheme, address indexed issuer, bytes signature, bytes data, string uri);
    event ClaimRemoved(bytes32 indexed claimId, uint256 indexed claimTopic, uint256 scheme, address indexed issuer, bytes signature, bytes data, string uri);
    event ClaimChanged(bytes32 indexed claimId, uint256 indexed claimTopic, uint256 scheme, address indexed issuer, bytes signature, bytes data, string uri);

    struct Claim {
        uint256 topic;
        uint256 scheme;
        address issuer; // Address of issuer
        bytes signature; // Signature which confirms that issuer issued the claim
        bytes data; // The data of the claim
        string uri; // Location of claim
    }

    /**
     * @dev Get a claim by its ID
     */
    function getClaim(bytes32 _claimId) external view returns (uint256 topic, uint256 scheme, address issuer, bytes memory signature, bytes memory data, string memory uri);
    
    /**
     * @dev Get all claim IDs for a specific topic
     */
    function getClaimIdsByTopic(uint256 _topic) external view returns (bytes32[] memory claimIds);
    
    /**
     * @dev Add a new claim to the identity
     */
    function addClaim(uint256 _topic, uint256 _scheme, address _issuer, bytes memory _signature, bytes memory _data, string memory _uri) external returns (bytes32 claimId);
    
    /**
     * @dev Remove a claim from the identity
     */
    function removeClaim(bytes32 _claimId) external returns (bool success);
}
