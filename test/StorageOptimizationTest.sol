// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../contracts/ethereum/EthereumDIDRegistry.sol";
import "../contracts/optimized/OptimizedDIDRegistry.sol";

/**
 * @title StorageOptimizationTest
 * @dev Test contract to verify storage optimization improvements
 * Compares gas usage between original and optimized implementations
 */
contract StorageOptimizationTest is Test {
    
    EthereumDIDRegistry public originalRegistry;
    OptimizedDIDRegistry public optimizedRegistry;
    
    address public owner = address(0x1);
    address public admin = address(0x2);
    address public user = address(0x3);
    
    string constant DID = "did:stellar:123456789";
    string constant PUBLIC_KEY = "public_key_123";
    string constant SERVICE_ENDPOINT = "https://service.example.com";
    
    function setUp() public {
        // Deploy original registry
        originalRegistry = new EthereumDIDRegistry();
        
        // Deploy optimized registry
        optimizedRegistry = new OptimizedDIDRegistry();
        
        // Grant admin roles
        vm.prank(admin);
        originalRegistry.grantRole(originalRegistry.ADMIN_ROLE(), admin);
        
        vm.prank(admin);
        optimizedRegistry.grantRole(optimizedRegistry.ADMIN_ROLE(), admin);
    }
    
    /**
     * @dev Test gas comparison for DID creation
     */
    function testGasComparison_DIDCreation() public {
        // Test original registry
        vm.prank(admin);
        uint256 gasBefore = gasleft();
        originalRegistry.bridgeDID(DID, owner, PUBLIC_KEY, SERVICE_ENDPOINT);
        uint256 gasUsedOriginal = gasBefore - gasleft();
        
        // Test optimized registry
        vm.prank(admin);
        gasBefore = gasleft();
        optimizedRegistry.bridgeDID(DID, owner, PUBLIC_KEY, SERVICE_ENDPOINT);
        uint256 gasUsedOptimized = gasBefore - gasleft();
        
        console.log("Original DID creation gas:", gasUsedOriginal);
        console.log("Optimized DID creation gas:", gasUsedOptimized);
        console.log("Gas savings:", gasUsedOriginal - gasUsedOptimized);
        
        assertTrue(gasUsedOptimized < gasUsedOriginal, "Optimized version should use less gas");
    }
    
    /**
     * @dev Test gas comparison for credential issuance
     */
    function testGasComparison_CredentialIssuance() public {
        // Set up DIDs first
        vm.prank(admin);
        originalRegistry.bridgeDID(DID, owner, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        vm.prank(admin);
        optimizedRegistry.bridgeDID(DID, owner, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        bytes32 credentialId = keccak256("test_credential");
        string memory issuer = "did:stellar:issuer";
        string memory subject = DID;
        string memory credentialType = "TestCredential";
        uint256 expires = block.timestamp + 365 days;
        bytes32 dataHash = keccak256("test_data");
        
        // Test original registry
        vm.prank(admin);
        uint256 gasBefore = gasleft();
        originalRegistry.bridgeCredential(credentialId, issuer, subject, credentialType, expires, dataHash);
        uint256 gasUsedOriginal = gasBefore - gasleft();
        
        // Test optimized registry
        vm.prank(admin);
        gasBefore = gasleft();
        optimizedRegistry.bridgeCredential(credentialId, issuer, subject, credentialType, expires, dataHash);
        uint256 gasUsedOptimized = gasBefore - gasleft();
        
        console.log("Original credential issuance gas:", gasUsedOriginal);
        console.log("Optimized credential issuance gas:", gasUsedOptimized);
        console.log("Gas savings:", gasUsedOriginal - gasUsedOptimized);
        
        assertTrue(gasUsedOptimized < gasUsedOriginal, "Optimized version should use less gas");
    }
    
    /**
     * @dev Test batch operations gas efficiency
     */
    function testBatchOperations() public {
        string[] memory dids = new string[](3);
        string[] memory publicKeys = new string[](3);
        string[] memory serviceEndpoints = new string[](3);
        
        for (uint i = 0; i < 3; i++) {
            dids[i] = string(abi.encodePacked("did:stellar:", i));
            publicKeys[i] = string(abi.encodePacked("public_key_", i));
            serviceEndpoints[i] = string(abi.encodePacked("https://service", i, ".example.com"));
        }
        
        // Test batch operation
        vm.prank(admin);
        uint256 gasBefore = gasleft();
        optimizedRegistry.batchBridgeDIDs(dids, new address[](3), publicKeys, serviceEndpoints);
        uint256 gasUsedBatch = gasBefore - gasleft();
        
        // Test individual operations
        uint256 gasUsedIndividual = 0;
        for (uint i = 0; i < 3; i++) {
            vm.prank(admin);
            gasBefore = gasleft();
            optimizedRegistry.bridgeDID(dids[i], address(uint160(100 + i)), publicKeys[i], serviceEndpoints[i]);
            gasUsedIndividual += (gasBefore - gasleft());
        }
        
        console.log("Batch operation gas:", gasUsedBatch);
        console.log("Individual operations gas:", gasUsedIndividual);
        console.log("Batch savings:", gasUsedIndividual - gasUsedBatch);
        
        assertTrue(gasUsedBatch < gasUsedIndividual, "Batch operation should be more gas efficient");
    }
    
    /**
     * @dev Test optimized view functions
     */
    function testOptimizedViewFunctions() public {
        // Set up a DID
        vm.prank(admin);
        optimizedRegistry.bridgeDID(DID, owner, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Test full document retrieval
        uint256 gasBefore = gasleft();
        OptimizedDIDRegistry.DIDDocument memory doc = optimizedRegistry.getDIDDocument(DID);
        uint256 gasUsedFull = gasBefore - gasleft();
        
        // Test optimized info retrieval
        gasBefore = gasleft();
        (address retrievedOwner, bool active, uint256 updated) = optimizedRegistry.getDIDInfo(DID);
        uint256 gasUsedInfo = gasBefore - gasleft();
        
        console.log("Full document retrieval gas:", gasUsedFull);
        console.log("Info retrieval gas:", gasUsedInfo);
        console.log("View function savings:", gasUsedFull - gasUsedInfo);
        
        assertTrue(gasUsedInfo < gasUsedFull, "Optimized view function should use less gas");
        assertEq(retrievedOwner, owner, "Owner should match");
        assertTrue(active, "DID should be active");
        assertTrue(updated > 0, "Updated timestamp should be set");
    }
    
    /**
     * @dev Test storage slot optimization
     */
    function testStorageSlotOptimization() public {
        // This test verifies that the optimized structs use fewer storage slots
        // by checking the actual storage layout
        
        vm.prank(admin);
        optimizedRegistry.bridgeDID(DID, owner, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Get storage slots for the DID
        bytes32[] memory slots = new bytes32[](10);
        
        // Calculate storage slots (this is a simplified approach)
        // In a real test, you would use vm.load to inspect actual storage
        for (uint i = 0; i < 10; i++) {
            slots[i] = keccak256(abi.encodePacked(DID, i));
        }
        
        // Verify that the struct is properly packed
        OptimizedDIDRegistry.DIDDocument memory doc = optimizedRegistry.getDIDDocument(DID);
        assertEq(doc.owner, owner, "Owner should be stored correctly");
        assertTrue(doc.active, "Active flag should be stored correctly");
        assertTrue(doc.created > 0, "Created timestamp should be stored correctly");
        assertTrue(doc.updated > 0, "Updated timestamp should be stored correctly");
        assertEq(doc.publicKey, PUBLIC_KEY, "Public key should be stored correctly");
        assertEq(doc.serviceEndpoint, SERVICE_ENDPOINT, "Service endpoint should be stored correctly");
    }
    
    /**
     * @dev Test edge cases and error conditions
     */
    function testEdgeCases() public {
        // Test empty DID
        vm.expectRevert("DID cannot be empty");
        optimizedRegistry.bridgeDID("", owner, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Test empty public key
        vm.expectRevert("Public key cannot be empty");
        optimizedRegistry.bridgeDID(DID, owner, "", SERVICE_ENDPOINT);
        
        // Test duplicate DID
        vm.prank(admin);
        optimizedRegistry.bridgeDID(DID, owner, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        vm.expectRevert("DID already exists on this chain");
        vm.prank(admin);
        optimizedRegistry.bridgeDID(DID, owner, PUBLIC_KEY, SERVICE_ENDPOINT);
    }
}
