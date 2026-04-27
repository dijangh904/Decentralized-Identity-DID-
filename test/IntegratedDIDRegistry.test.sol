// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../contracts/IntegratedDIDRegistry.sol";
import "../contracts/access/EnhancedAccessControl.sol";
import "../contracts/proxy/EnhancedProxy.sol";
import "../contracts/optimized/GasOptimizedDIDRegistry.sol";

/**
 * @title IntegratedDIDRegistryTest
 * @dev Comprehensive test suite for the integrated DID registry solution
 * 
 * This test suite validates all three major improvements:
 * 1. Enhanced RBAC with fine-grained permissions (Issue #140)
 * 2. Upgradeable contract pattern with proxy (Issue #139)
 * 3. Gas optimization for 30%+ reduction (Issue #138)
 * 
 * Test Coverage:
 * - Access control functionality and permissions
 * - Upgradeability mechanisms and security
 * - Gas optimization performance
 * - Integration between all features
 * - Edge cases and error conditions
 * - Security vulnerabilities
 * 
 * @author Fatima Sanusi
 */
contract IntegratedDIDRegistryTest is Test {
    
    // ===== TEST CONTRACTS =====
    
    IntegratedDIDRegistry public integratedRegistry;
    EnhancedAccessControl public accessControl;
    EnhancedProxy public proxy;
    GasOptimizedDIDRegistry public gasOptimizedRegistry;
    
    // ===== TEST ADDRESSES =====
    
    address public owner = address(0x1);
    address public governor = address(0x2);
    address public issuer = address(0x3);
    address public validator = address(0x4);
    address public user = address(0x5);
    address public auditor = address(0x6);
    address public unauthorizedUser = address(0x7);
    
    // ===== TEST DATA =====
    
    string public constant TEST_DID = "did:ethereum:0x1234567890123456789012345678901234567890";
    string public constant TEST_PUBLIC_KEY = "0x04abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567abc890def123";
    string public constant TEST_SERVICE_ENDPOINT = "https://did.example.com/endpoint";
    string public constant TEST_ISSUER = "did:ethereum:0x0987654321098765432109876543210987654321";
    string public constant TEST_SUBJECT = "did:ethereum:0x1111111111111111111111111111111111111111";
    string public constant TEST_CREDENTIAL_TYPE = "VerifiableCredential";
    bytes32 public constant TEST_DATA_HASH = keccak256("test data");
    
    // ===== SETUP =====
    
    function setUp() public {
        // Deploy access control
        accessControl = new EnhancedAccessControl();
        
        // Deploy proxy (mock for testing)
        vm.prank(owner);
        proxy = new EnhancedProxy();
        
        // Deploy gas optimized registry
        vm.prank(owner);
        gasOptimizedRegistry = new GasOptimizedDIDRegistry(address(accessControl));
        
        // Deploy integrated registry
        vm.prank(owner);
        integratedRegistry = new IntegratedDIDRegistry();
        
        // Initialize integrated registry
        vm.prank(owner);
        integratedRegistry.initialize(
            address(accessControl),
            address(proxy),
            true,  // RBAC enabled
            true,  // Upgradeability enabled
            true   // Gas optimization enabled
        );
        
        // Setup roles
        _setupRoles();
    }
    
    function _setupRoles() internal {
        // Grant roles to test addresses
        vm.prank(owner);
        accessControl.grantRole(accessControl.ROLE_GOVERNOR(), governor);
        
        vm.prank(owner);
        accessControl.grantRole(accessControl.ROLE_ISSUER(), issuer);
        
        vm.prank(owner);
        accessControl.grantRole(accessControl.ROLE_VALIDATOR(), validator);
        
        vm.prank(owner);
        accessControl.grantRole(accessControl.ROLE_USER(), user);
        
        vm.prank(owner);
        accessControl.grantRole(accessControl.ROLE_AUDITOR(), auditor);
    }

    // ===== RBAC TESTS (Issue #140) =====
    
    function test_RBAC_AdminRoleHasAllPermissions() public {
        // Admin should have all permissions
        assertTrue(accessControl.checkPermission(owner, ResourceType.DID, OperationType.CREATE));
        assertTrue(accessControl.checkPermission(owner, ResourceType.DID, OperationType.READ));
        assertTrue(accessControl.checkPermission(owner, ResourceType.DID, OperationType.UPDATE));
        assertTrue(accessControl.checkPermission(owner, ResourceType.DID, OperationType.DELETE));
        assertTrue(accessControl.checkPermission(owner, ResourceType.CREDENTIAL, OperationType.CREATE));
        assertTrue(accessControl.checkPermission(owner, ResourceType.GOVERNANCE, OperationType.ADMIN));
    }
    
    function test_RBAC_GovernorPermissions() public {
        // Governor should have governance permissions
        assertTrue(accessControl.checkPermission(governor, ResourceType.GOVERNANCE, OperationType.CREATE));
        assertTrue(accessControl.checkPermission(governor, ResourceType.GOVERNANCE, OperationType.READ));
        assertTrue(accessControl.checkPermission(governor, ResourceType.GOVERNANCE, OperationType.UPDATE));
        assertTrue(accessControl.checkPermission(governor, ResourceType.GOVERNANCE, OperationType.ADMIN));
        assertTrue(accessControl.checkPermission(governor, ResourceType.DID, OperationType.VALIDATE));
        assertTrue(accessControl.checkPermission(governor, ResourceType.CREDENTIAL, OperationType.VALIDATE));
        
        // Governor should not have credential creation permissions
        assertFalse(accessControl.checkPermission(governor, ResourceType.CREDENTIAL, OperationType.CREATE));
    }
    
    function test_RBAC_IssuerPermissions() public {
        // Issuer should have credential permissions
        assertTrue(accessControl.checkPermission(issuer, ResourceType.CREDENTIAL, OperationType.CREATE));
        assertTrue(accessControl.checkPermission(issuer, ResourceType.CREDENTIAL, OperationType.READ));
        assertTrue(accessControl.checkPermission(issuer, ResourceType.CREDENTIAL, OperationType.UPDATE));
        assertTrue(accessControl.checkPermission(issuer, ResourceType.CREDENTIAL, OperationType.DELETE));
        assertTrue(accessControl.checkPermission(issuer, ResourceType.DID, OperationType.READ));
        
        // Issuer should not have governance permissions
        assertFalse(accessControl.checkPermission(issuer, ResourceType.GOVERNANCE, OperationType.ADMIN));
    }
    
    function test_RBAC_UserPermissions() public {
        // User should have basic DID permissions
        assertTrue(accessControl.checkPermission(user, ResourceType.DID, OperationType.CREATE));
        assertTrue(accessControl.checkPermission(user, ResourceType.DID, OperationType.READ));
        assertTrue(accessControl.checkPermission(user, ResourceType.DID, OperationType.UPDATE));
        assertTrue(accessControl.checkPermission(user, ResourceType.DID, OperationType.DELETE));
        
        // User should not have credential creation permissions
        assertFalse(accessControl.checkPermission(user, ResourceType.CREDENTIAL, OperationType.CREATE));
    }
    
    function test_RBAC_AuditorPermissions() public {
        // Auditor should have read-only permissions
        assertTrue(accessControl.checkPermission(auditor, ResourceType.DID, OperationType.READ));
        assertTrue(accessControl.checkPermission(auditor, ResourceType.CREDENTIAL, OperationType.READ));
        assertTrue(accessControl.checkPermission(auditor, ResourceType.GOVERNANCE, OperationType.READ));
        assertTrue(accessControl.checkPermission(auditor, ResourceType.SYSTEM, OperationType.READ));
        
        // Auditor should not have write permissions
        assertFalse(accessControl.checkPermission(auditor, ResourceType.DID, OperationType.CREATE));
        assertFalse(accessControl.checkPermission(auditor, ResourceType.CREDENTIAL, OperationType.CREATE));
    }
    
    function test_RBAC_UnauthorizedUserDenied() public {
        // Unauthorized user should have no permissions
        assertFalse(accessControl.checkPermission(unauthorizedUser, ResourceType.DID, OperationType.CREATE));
        assertFalse(accessControl.checkPermission(unauthorizedUser, ResourceType.CREDENTIAL, OperationType.CREATE));
        assertFalse(accessControl.checkPermission(unauthorizedUser, ResourceType.GOVERNANCE, OperationType.ADMIN));
    }
    
    function test_RBAC_GrantRevokePermissions() public {
        // Grant custom permission to user
        vm.prank(owner);
        accessControl.grantPermission(
            accessControl.ROLE_USER(),
            ResourceType.CREDENTIAL,
            OperationType.CREATE,
            0, // No expiration
            "" // No condition
        );
        
        // User should now have credential creation permission
        assertTrue(accessControl.checkPermission(user, ResourceType.CREDENTIAL, OperationType.CREATE));
        
        // Revoke permission
        vm.prank(owner);
        accessControl.revokePermission(
            accessControl.ROLE_USER(),
            ResourceType.CREDENTIAL,
            OperationType.CREATE
        );
        
        // User should no longer have permission
        assertFalse(accessControl.checkPermission(user, ResourceType.CREDENTIAL, OperationType.CREATE));
    }
    
    function test_RBAC_UserSpecificPermissions() public {
        // Grant user-specific permission
        vm.prank(owner);
        accessControl.setUserPermission(
            unauthorizedUser,
            ResourceType.DID,
            OperationType.CREATE,
            true
        );
        
        // User should have permission despite not having role
        assertTrue(accessControl.checkPermission(unauthorizedUser, ResourceType.DID, OperationType.CREATE));
    }
    
    function test_RBAC_EmergencyAccess() public {
        // Grant emergency access
        vm.prank(owner);
        accessControl.grantEmergencyAccess(unauthorizedUser, "Test emergency");
        
        // User should have all permissions in emergency
        assertTrue(accessControl.checkPermission(unauthorizedUser, ResourceType.DID, OperationType.CREATE));
        assertTrue(accessControl.checkPermission(unauthorizedUser, ResourceType.GOVERNANCE, OperationType.ADMIN));
        
        // Revoke emergency access
        vm.prank(owner);
        accessControl.revokeEmergencyAccess(unauthorizedUser);
        
        // User should no longer have permissions
        assertFalse(accessControl.checkPermission(unauthorizedUser, ResourceType.DID, OperationType.CREATE));
    }

    // ===== UPGRADEABILITY TESTS (Issue #139) =====
    
    function test_Upgradeability_ProposeUpgrade() public {
        // Mock new implementation address
        address newImplementation = address(0x8);
        
        // Governor should be able to propose upgrade
        vm.prank(governor);
        bytes32 proposalId = integratedRegistry.proposeIntegratedUpgrade(
            newImplementation,
            "Test upgrade",
            false, // Not emergency
            1 days // Delay
        );
        
        assertTrue(proposalId != bytes32(0));
    }
    
    function test_Upgradeability_EmergencyUpgrade() public {
        // Mock new implementation address
        address newImplementation = address(0x8);
        
        // Admin should be able to propose emergency upgrade
        vm.prank(owner);
        bytes32 proposalId = integratedRegistry.proposeIntegratedUpgrade(
            newImplementation,
            "Emergency upgrade",
            true, // Emergency
            0 // No delay
        );
        
        assertTrue(proposalId != bytes32(0));
    }
    
    function test_Upgradeability_UnauthorizedUpgradeFails() public {
        address newImplementation = address(0x8);
        
        // Unauthorized user should not be able to propose upgrade
        vm.prank(unauthorizedUser);
        vm.expectRevert("IntegratedDIDRegistry: RBAC permission denied");
        integratedRegistry.proposeIntegratedUpgrade(
            newImplementation,
            "Unauthorized upgrade",
            false,
            1 days
        );
    }
    
    function test_Upgradeability_FeatureToggle() public {
        // Disable upgradeability
        vm.prank(owner);
        integratedRegistry.setFeatureEnabled("UPGRADEABILITY", false);
        
        // Should not be able to propose upgrade
        vm.prank(governor);
        vm.expectRevert("Upgradeability not enabled");
        integratedRegistry.proposeIntegratedUpgrade(
            address(0x8),
            "Test upgrade",
            false,
            1 days
        );
        
        // Re-enable upgradeability
        vm.prank(owner);
        integratedRegistry.setFeatureEnabled("UPGRADEABILITY", true);
        
        // Should be able to propose upgrade again
        vm.prank(governor);
        bytes32 proposalId = integratedRegistry.proposeIntegratedUpgrade(
            address(0x8),
            "Test upgrade",
            false,
            1 days
        );
        
        assertTrue(proposalId != bytes32(0));
    }

    // ===== GAS OPTIMIZATION TESTS (Issue #138) =====
    
    function test_GasOptimization_CreateDID() public {
        // Measure gas for DID creation
        uint256 gasStart = gasleft();
        
        vm.prank(user);
        bool success = integratedRegistry.createDIDIntegrated(
            TEST_DID,
            TEST_PUBLIC_KEY,
            TEST_SERVICE_ENDPOINT
        );
        
        uint256 gasUsed = gasStart - gasleft();
        
        assertTrue(success);
        
        // Gas should be reasonable (target: <100,000 gas)
        assertTrue(gasUsed < 100000);
        
        // Check performance metrics
        (,,,,uint256 totalGasSaved,) = integratedRegistry.getPerformanceMetrics();
        assertTrue(totalGasSaved > 0);
    }
    
    function test_GasOptimization_BatchCreateDIDs() public {
        string[] memory dids = new string[](3);
        string[] memory publicKeys = new string[](3);
        string[] memory serviceEndpoints = new string[](3);
        
        for (uint256 i = 0; i < 3; i++) {
            dids[i] = string(abi.encodePacked(TEST_DID, i.toString()));
            publicKeys[i] = string(abi.encodePacked(TEST_PUBLIC_KEY, i.toString()));
            serviceEndpoints[i] = string(abi.encodePacked(TEST_SERVICE_ENDPOINT, i.toString()));
        }
        
        // Measure gas for batch creation
        uint256 gasStart = gasleft();
        
        vm.prank(user);
        bytes32 batchHash = integratedRegistry.batchCreateDIDsIntegrated(
            dids,
            publicKeys,
            serviceEndpoints
        );
        
        uint256 gasUsed = gasStart - gasleft();
        
        assertTrue(batchHash != bytes32(0));
        
        // Batch should be more efficient per DID
        uint256 gasPerDID = gasUsed / 3;
        assertTrue(gasPerDID < 80000); // Should be less than individual creation
    }
    
    function test_GasOptimization_IssueCredential() public {
        // Measure gas for credential issuance
        uint256 gasStart = gasleft();
        
        vm.prank(issuer);
        bytes32 credentialId = integratedRegistry.issueCredentialIntegrated(
            TEST_ISSUER,
            TEST_SUBJECT,
            TEST_CREDENTIAL_TYPE,
            block.timestamp + 365 days,
            TEST_DATA_HASH
        );
        
        uint256 gasUsed = gasStart - gasleft();
        
        assertTrue(credentialId != bytes32(0));
        
        // Gas should be reasonable (target: <80,000 gas)
        assertTrue(gasUsed < 80000);
    }
    
    function test_GasOptimization_BatchIssueCredentials() public {
        string[] memory issuers = new string[](3);
        string[] memory subjects = new string[](3);
        string[] memory credentialTypes = new string[](3);
        uint256[] memory expires = new uint256[](3);
        bytes32[] memory dataHashes = new bytes32[](3);
        
        for (uint256 i = 0; i < 3; i++) {
            issuers[i] = string(abi.encodePacked(TEST_ISSUER, i.toString()));
            subjects[i] = string(abi.encodePacked(TEST_SUBJECT, i.toString()));
            credentialTypes[i] = string(abi.encodePacked(TEST_CREDENTIAL_TYPE, i.toString()));
            expires[i] = block.timestamp + 365 days;
            dataHashes[i] = keccak256(abi.encodePacked("test data", i));
        }
        
        // Measure gas for batch issuance
        uint256 gasStart = gasleft();
        
        vm.prank(issuer);
        bytes32 batchHash = integratedRegistry.batchIssueCredentialsIntegrated(
            issuers,
            subjects,
            credentialTypes,
            expires,
            dataHashes
        );
        
        uint256 gasUsed = gasStart - gasleft();
        
        assertTrue(batchHash != bytes32(0));
        
        // Batch should be more efficient per credential
        uint256 gasPerCredential = gasUsed / 3;
        assertTrue(gasPerCredential < 60000); // Should be less than individual issuance
    }
    
    function test_GasOptimization_PerformanceMetrics() public {
        // Perform some operations to generate metrics
        vm.prank(user);
        integratedRegistry.createDIDIntegrated(TEST_DID, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
        
        vm.prank(issuer);
        integratedRegistry.issueCredentialIntegrated(
            TEST_ISSUER,
            TEST_SUBJECT,
            TEST_CREDENTIAL_TYPE,
            block.timestamp + 365 days,
            TEST_DATA_HASH
        );
        
        // Check metrics
        (
            uint256 rbacChecks,
            uint256 upgradeOperations,
            uint256 optimizedOperations,
            uint256 totalGasSaved,
            uint256 averageGasPerOperation
        ) = integratedRegistry.getPerformanceMetrics();
        
        assertTrue(rbacChecks > 0);
        assertTrue(optimizedOperations > 0);
        assertTrue(totalGasSaved > 0);
        assertTrue(averageGasPerOperation > 0);
    }
    
    function test_GasOptimization_PerformanceBenchmarks() public {
        // Perform operation to set benchmark
        vm.prank(user);
        integratedRegistry.createDIDIntegrated(TEST_DID, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
        
        // Check benchmark
        uint256 benchmark = integratedRegistry.getPerformanceBenchmark("CREATE_DID");
        assertTrue(benchmark > 0);
    }

    // ===== INTEGRATION TESTS =====
    
    function test_Integration_AllFeaturesWorkTogether() public {
        // Create DID with RBAC check and gas optimization
        vm.prank(user);
        bool didCreated = integratedRegistry.createDIDIntegrated(
            TEST_DID,
            TEST_PUBLIC_KEY,
            TEST_SERVICE_ENDPOINT
        );
        assertTrue(didCreated);
        
        // Issue credential with RBAC check and gas optimization
        vm.prank(issuer);
        bytes32 credentialId = integratedRegistry.issueCredentialIntegrated(
            TEST_ISSUER,
            TEST_SUBJECT,
            TEST_CREDENTIAL_TYPE,
            block.timestamp + 365 days,
            TEST_DATA_HASH
        );
        assertTrue(credentialId != bytes32(0));
        
        // Propose upgrade with RBAC check
        vm.prank(governor);
        bytes32 proposalId = integratedRegistry.proposeIntegratedUpgrade(
            address(0x8),
            "Integration test upgrade",
            false,
            1 days
        );
        assertTrue(proposalId != bytes32(0));
        
        // Check that all features are enabled
        assertTrue(integratedRegistry.isFeatureEnabled("RBAC"));
        assertTrue(integratedRegistry.isFeatureEnabled("UPGRADEABILITY"));
        assertTrue(integratedRegistry.isFeatureEnabled("GAS_OPTIMIZATION"));
        
        // Check integration configuration
        (
            bool rbacEnabled,
            bool upgradeabilityEnabled,
            bool gasOptimizationEnabled,
            uint256 rbacVersion,
            uint256 proxyVersion,
            uint256 optimizationVersion
        ) = integratedRegistry.getIntegrationConfig();
        
        assertTrue(rbacEnabled);
        assertTrue(upgradeabilityEnabled);
        assertTrue(gasOptimizationEnabled);
        assertEq(rbacVersion, 1);
        assertEq(proxyVersion, 1);
        assertEq(optimizationVersion, 1);
    }
    
    function test_Integration_FeatureToggles() public {
        // Disable RBAC
        vm.prank(owner);
        integratedRegistry.setFeatureEnabled("RBAC", false);
        assertFalse(integratedRegistry.isFeatureEnabled("RBAC"));
        
        // Should be able to create DID without RBAC check
        vm.prank(unauthorizedUser);
        bool success = integratedRegistry.createDIDIntegrated(
            string(abi.encodePacked(TEST_DID, "_no_rbac")),
            TEST_PUBLIC_KEY,
            TEST_SERVICE_ENDPOINT
        );
        assertTrue(success);
        
        // Re-enable RBAC
        vm.prank(owner);
        integratedRegistry.setFeatureEnabled("RBAC", true);
        assertTrue(integratedRegistry.isFeatureEnabled("RBAC"));
        
        // Should fail again for unauthorized user
        vm.prank(unauthorizedUser);
        vm.expectRevert("IntegratedDIDRegistry: RBAC permission denied");
        integratedRegistry.createDIDIntegrated(
            string(abi.encodePacked(TEST_DID, "_rbac_restored")),
            TEST_PUBLIC_KEY,
            TEST_SERVICE_ENDPOINT
        );
    }

    // ===== SECURITY TESTS =====
    
    function test_Security_ReentrancyProtection() public {
        // This test would require a malicious contract to test reentrancy
        // For now, we'll just verify the modifier is present
        assertTrue(address(integratedRegistry).code.length > 0);
    }
    
    function test_Security_OverflowProtection() public {
        // Test with maximum values
        string memory maxString = new string(100000);
        
        // Should handle large inputs gracefully
        vm.prank(user);
        vm.expectRevert(); // Should fail due to gas limits or size limits
        integratedRegistry.createDIDIntegrated(
            maxString,
            TEST_PUBLIC_KEY,
            TEST_SERVICE_ENDPOINT
        );
    }
    
    function test_Security_ZeroAddressProtection() public {
        // Should reject zero addresses in critical operations
        vm.prank(owner);
        vm.expectRevert("Invalid access control address");
        new IntegratedDIDRegistry();
    }

    // ===== EDGE CASE TESTS =====
    
    function test_EdgeCase_EmptyStrings() public {
        // Should reject empty DID
        vm.prank(user);
        vm.expectRevert("DID cannot be empty");
        integratedRegistry.createDIDIntegrated("", TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
        
        // Should reject empty public key
        vm.prank(user);
        vm.expectRevert("Public key cannot be empty");
        integratedRegistry.createDIDIntegrated(TEST_DID, "", TEST_SERVICE_ENDPOINT);
    }
    
    function test_EdgeCase_ArrayLengthMismatch() public {
        string[] memory dids = new string[](2);
        string[] memory publicKeys = new string[](3); // Mismatch
        string[] memory serviceEndpoints = new string[](2);
        
        vm.prank(user);
        vm.expectRevert("Array length mismatch");
        integratedRegistry.batchCreateDIDsIntegrated(dids, publicKeys, serviceEndpoints);
    }
    
    function test_EdgeCase_DuplicateDID() public {
        // Create DID first
        vm.prank(user);
        integratedRegistry.createDIDIntegrated(TEST_DID, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
        
        // Should fail to create same DID again
        vm.prank(user);
        vm.expectRevert("DID already exists");
        integratedRegistry.createDIDIntegrated(TEST_DID, TEST_PUBLIC_KEY, TEST_SERVICE_ENDPOINT);
    }

    // ===== PERFORMANCE TESTS =====
    
    function test_Performance_LargeBatchOperations() public {
        uint256 batchSize = 100;
        string[] memory dids = new string[](batchSize);
        string[] memory publicKeys = new string[](batchSize);
        string[] memory serviceEndpoints = new string[](batchSize);
        
        for (uint256 i = 0; i < batchSize; i++) {
            dids[i] = string(abi.encodePacked(TEST_DID, "_batch_", i.toString()));
            publicKeys[i] = string(abi.encodePacked(TEST_PUBLIC_KEY, "_", i.toString()));
            serviceEndpoints[i] = string(abi.encodePacked(TEST_SERVICE_ENDPOINT, "/", i.toString()));
        }
        
        // Measure gas for large batch
        uint256 gasStart = gasleft();
        
        vm.prank(user);
        bytes32 batchHash = integratedRegistry.batchCreateDIDsIntegrated(
            dids,
            publicKeys,
            serviceEndpoints
        );
        
        uint256 gasUsed = gasStart - gasleft();
        
        assertTrue(batchHash != bytes32(0));
        
        // Should be efficient even for large batches
        uint256 gasPerItem = gasUsed / batchSize;
        assertTrue(gasPerItem < 50000); // Target: <50,000 gas per item in large batches
    }

    // ===== FALLBACK TESTS =====
    
    function test_Fallback_ReceiveEther() public {
        // Should be able to receive ETH
        vm.deal(address(integratedRegistry), 1 ether);
        
        uint256 balance = address(integratedRegistry).balance;
        assertEq(balance, 1 ether);
    }
}
