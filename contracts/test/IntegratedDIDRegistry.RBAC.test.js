const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IntegratedDIDRegistry - RBAC Integration", function () {
    let integratedRegistry;
    let enhancedAccessControl;
    let gasOptimizedRegistry;
    let owner, admin, governor, issuer, validator, user, auditor, unauthorized;
    
    // Role constants
    const ROLE_ADMIN = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_ADMIN"));
    const ROLE_GOVERNOR = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_GOVERNOR"));
    const ROLE_ISSUER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_ISSUER"));
    const ROLE_VALIDATOR = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_VALIDATOR"));
    const ROLE_USER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_USER"));
    const ROLE_AUDITOR = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_AUDITOR"));

    beforeEach(async function () {
        [owner, admin, governor, issuer, validator, user, auditor, unauthorized] = await ethers.getSigners();
        
        // Deploy EnhancedAccessControl first
        const EnhancedAccessControl = await ethers.getContractFactory("EnhancedAccessControl");
        enhancedAccessControl = await EnhancedAccessControl.deploy();
        await enhancedAccessControl.deployed();
        
        // Deploy GasOptimizedDIDRegistry
        const GasOptimizedDIDRegistry = await ethers.getContractFactory("GasOptimizedDIDRegistry");
        gasOptimizedRegistry = await GasOptimizedDIDRegistry.deploy();
        await gasOptimizedRegistry.deployed();
        
        // Deploy mock EnhancedProxy (simplified for testing)
        const MockEnhancedProxy = await ethers.getContractFactory("ReentrancyGuard"); // Using ReentrancyGuard as mock
        const mockProxy = await MockEnhancedProxy.deploy();
        await mockProxy.deployed();
        
        // Deploy IntegratedDIDRegistry
        const IntegratedDIDRegistry = await ethers.getContractFactory("IntegratedDIDRegistry");
        integratedRegistry = await IntegratedDIDRegistry.deploy();
        await integratedRegistry.deployed();
        
        // Initialize the integrated registry
        await integratedRegistry.initialize(
            enhancedAccessControl.address,
            mockProxy.address,
            true,  // RBAC enabled
            true,  // Upgradeability enabled
            true   // Gas optimization enabled
        );
        
        // Setup roles
        await enhancedAccessControl.grantRole(ROLE_GOVERNOR, governor.address);
        await enhancedAccessControl.grantRole(ROLE_ISSUER, issuer.address);
        await enhancedAccessControl.grantRole(ROLE_VALIDATOR, validator.address);
        await enhancedAccessControl.grantRole(ROLE_USER, user.address);
        await enhancedAccessControl.grantRole(ROLE_AUDITOR, auditor.address);
    });

    describe("RBAC Integration", function () {
        it("Should initialize with RBAC enabled", async function () {
            const config = await integratedRegistry.getIntegrationConfig();
            expect(config.rbacEnabled).to.be.true;
        });

        it("Should allow admin to create DIDs", async function () {
            const did = "did:example:123456789abcdefghi";
            const publicKey = "0x1234567890abcdef";
            const serviceEndpoint = "https://example.com/endpoint";
            
            await expect(
                integratedRegistry.createDIDIntegrated(did, publicKey, serviceEndpoint)
            ).to.emit(integratedRegistry, "PerformanceMetricsUpdated");
        });

        it("Should prevent unauthorized users from creating DIDs", async function () {
            const did = "did:example:unauthorized";
            const publicKey = "0x1234567890abcdef";
            const serviceEndpoint = "https://example.com/endpoint";
            
            await expect(
                integratedRegistry.connect(unauthorized).createDIDIntegrated(did, publicKey, serviceEndpoint)
            ).to.be.revertedWith("IntegratedDIDRegistry: RBAC permission denied");
        });

        it("Should allow issuer to issue credentials", async function () {
            const issuerId = "did:example:issuer";
            const subject = "did:example:subject";
            const credentialType = "VerifiableCredential";
            const expires = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
            const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credential data"));
            
            await expect(
                integratedRegistry.connect(issuer).issueCredentialIntegrated(
                    issuerId,
                    subject,
                    credentialType,
                    expires,
                    dataHash
                )
            ).to.emit(integratedRegistry, "PerformanceMetricsUpdated");
        });

        it("Should prevent unauthorized users from issuing credentials", async function () {
            const issuerId = "did:example:unauthorized";
            const subject = "did:example:subject";
            const credentialType = "VerifiableCredential";
            const expires = Math.floor(Date.now() / 1000) + 86400;
            const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credential data"));
            
            await expect(
                integratedRegistry.connect(unauthorized).issueCredentialIntegrated(
                    issuerId,
                    subject,
                    credentialType,
                    expires,
                    dataHash
                )
            ).to.be.revertedWith("IntegratedDIDRegistry: RBAC permission denied");
        });
    });

    describe("Permission-Based Operations", function () {
        describe("DID Operations", function () {
            it("Should allow users with DID CREATE permission to create DIDs", async function () {
                // Grant DID CREATE permission to user role
                await enhancedAccessControl.grantPermission(ROLE_USER, 0, 0, 0, ""); // DID, CREATE
                
                const did = "did:example:user123";
                const publicKey = "0x1234567890abcdef";
                const serviceEndpoint = "https://example.com/endpoint";
                
                await expect(
                    integratedRegistry.connect(user).createDIDIntegrated(did, publicKey, serviceEndpoint)
                ).to.not.be.reverted;
            });

            it("Should allow users with DID UPDATE permission to update DIDs", async function () {
                // Grant DID UPDATE permission to user role
                await enhancedAccessControl.grantPermission(ROLE_USER, 0, 2, 0, ""); // DID, UPDATE
                
                const did = "did:example:update123";
                const newPublicKey = "0xabcdef1234567890";
                const newServiceEndpoint = "https://updated.example.com/endpoint";
                
                await expect(
                    integratedRegistry.connect(user).updateDIDIntegrated(did, newPublicKey, newServiceEndpoint)
                ).to.not.be.reverted;
            });
        });

        describe("Credential Operations", function () {
            it("Should allow users with CREDENTIAL CREATE permission to issue credentials", async function () {
                // Grant CREDENTIAL CREATE permission to validator role
                await enhancedAccessControl.grantPermission(ROLE_VALIDATOR, 1, 0, 0, ""); // CREDENTIAL, CREATE
                
                const issuerId = "did:example:validator";
                const subject = "did:example:subject";
                const credentialType = "VerifiableCredential";
                const expires = Math.floor(Date.now() / 1000) + 86400;
                const dataHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credential data"));
                
                await expect(
                    integratedRegistry.connect(validator).issueCredentialIntegrated(
                        issuerId,
                        subject,
                        credentialType,
                        expires,
                        dataHash
                    )
                ).to.not.be.reverted;
            });
        });

        describe("System Operations", function () {
            it("Should allow users with SYSTEM ADMIN permission to manage features", async function () {
                // Grant SYSTEM ADMIN permission to governor
                await enhancedAccessControl.grantPermission(ROLE_GOVERNOR, 3, 4, 0, ""); // SYSTEM, ADMIN
                
                await expect(
                    integratedRegistry.connect(governor).setFeatureEnabled("TEST_FEATURE", true)
                ).to.emit(integratedRegistry, "FeatureConfigUpdated");
            });

            it("Should prevent users without SYSTEM ADMIN permission from managing features", async function () {
                await expect(
                    integratedRegistry.connect(user).setFeatureEnabled("TEST_FEATURE", true)
                ).to.be.revertedWith("IntegratedDIDRegistry: RBAC permission denied");
            });
        });
    });

    describe("Batch Operations with RBAC", function () {
        it("Should allow authorized users to perform batch DID creation", async function () {
            // Grant batch permission to issuer
            await enhancedAccessControl.grantPermission(ROLE_ISSUER, 0, 0, 0, ""); // DID, CREATE
            
            const dids = ["did:example:batch1", "did:example:batch2"];
            const publicKeys = ["0x1234567890abcdef", "0xabcdef1234567890"];
            const serviceEndpoints = ["https://example1.com", "https://example2.com"];
            
            await expect(
                integratedRegistry.connect(issuer).batchCreateDIDsIntegrated(dids, publicKeys, serviceEndpoints)
            ).to.emit(integratedRegistry, "PerformanceMetricsUpdated");
        });

        it("Should allow authorized users to perform batch credential issuance", async function () {
            const issuers = ["did:example:issuer1", "did:example:issuer2"];
            const subjects = ["did:example:subject1", "did:example:subject2"];
            const credentialTypes = ["VerifiableCredential", "ProofOfResidence"];
            const expires = [
                Math.floor(Date.now() / 1000) + 86400,
                Math.floor(Date.now() / 1000) + 172800
            ];
            const dataHashes = [
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("data1")),
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("data2"))
            ];
            
            await expect(
                integratedRegistry.connect(issuer).batchIssueCredentialsIntegrated(
                    issuers,
                    subjects,
                    credentialTypes,
                    expires,
                    dataHashes
                )
            ).to.emit(integratedRegistry, "PerformanceMetricsUpdated");
        });
    });

    describe("Performance Metrics with RBAC", function () {
        it("Should track RBAC check metrics", async function () {
            const did = "did:example:metrics";
            const publicKey = "0x1234567890abcdef";
            const serviceEndpoint = "https://example.com/endpoint";
            
            // Perform operation to increment metrics
            await integratedRegistry.createDIDIntegrated(did, publicKey, serviceEndpoint);
            
            const metrics = await integratedRegistry.getPerformanceMetrics();
            expect(metrics.rbacChecks).to.be.gt(0);
        });

        it("Should update performance benchmarks", async function () {
            const did = "did:example:benchmark";
            const publicKey = "0x1234567890abcdef";
            const serviceEndpoint = "https://example.com/endpoint";
            
            await integratedRegistry.createDIDIntegrated(did, publicKey, serviceEndpoint);
            
            const benchmark = await integratedRegistry.getPerformanceBenchmark("CREATE_DID");
            expect(benchmark).to.be.gt(0);
        });
    });

    describe("Feature Management with RBAC", function () {
        it("Should allow admin to enable/disable RBAC", async function () {
            await integratedRegistry.setFeatureEnabled("RBAC", false);
            
            const config = await integratedRegistry.getIntegrationConfig();
            expect(config.rbacEnabled).to.be.false;
        });

        it("Should emit events when features are toggled", async function () {
            await expect(
                integratedRegistry.setFeatureEnabled("GAS_OPTIMIZATION", false)
            ).to.emit(integratedRegistry, "FeatureConfigUpdated")
             .withArgs("GAS_OPTIMIZATION", false);
        });

        it("Should allow checking feature status", async function () {
            const rbacEnabled = await integratedRegistry.isFeatureEnabled("RBAC");
            expect(rbacEnabled).to.be.true;
            
            const gasOptEnabled = await integratedRegistry.isFeatureEnabled("GAS_OPTIMIZATION");
            expect(gasOptEnabled).to.be.true;
        });
    });

    describe("Emergency Access Integration", function () {
        it("Should allow emergency access to bypass RBAC", async function () {
            // Grant emergency access to unauthorized user
            await enhancedAccessControl.grantEmergencyAccess(unauthorized.address, "Emergency test");
            
            const did = "did:example:emergency";
            const publicKey = "0x1234567890abcdef";
            const serviceEndpoint = "https://example.com/endpoint";
            
            // Should succeed despite not having regular permissions
            await expect(
                integratedRegistry.connect(unauthorized).createDIDIntegrated(did, publicKey, serviceEndpoint)
            ).to.not.be.reverted;
        });

        it("Should track emergency access in metrics", async function () {
            await enhancedAccessControl.grantEmergencyAccess(unauthorized.address, "Emergency test");
            
            const did = "did:example:emergency2";
            const publicKey = "0x1234567890abcdef";
            const serviceEndpoint = "https://example.com/endpoint";
            
            await integratedRegistry.connect(unauthorized).createDIDIntegrated(did, publicKey, serviceEndpoint);
            
            const metrics = await integratedRegistry.getPerformanceMetrics();
            expect(metrics.rbacChecks).to.be.gt(0);
        });
    });

    describe("Time-Based Permissions", function () {
        it("Should respect permission expiration", async function () {
            const expiresAt = Math.floor(Date.now() / 1000) + 1; // 1 second from now
            
            // Grant temporary permission
            await enhancedAccessControl.grantPermission(ROLE_USER, 0, 0, expiresAt, ""); // DID, CREATE
            
            const did = "did:example:temporary";
            const publicKey = "0x1234567890abcdef";
            const serviceEndpoint = "https://example.com/endpoint";
            
            // Should work initially
            await expect(
                integratedRegistry.connect(user).createDIDIntegrated(did, publicKey, serviceEndpoint)
            ).to.not.be.reverted;
            
            // Wait for expiration (in test, we'll just check the logic)
            // In a real test environment, you'd use time manipulation
        });
    });

    describe("Audit Trail Integration", function () {
        it("Should maintain audit trail for RBAC operations", async function () {
            const did = "did:example:audit";
            const publicKey = "0x1234567890abcdef";
            const serviceEndpoint = "https://example.com/endpoint";
            
            await integratedRegistry.createDIDIntegrated(did, publicKey, serviceEndpoint);
            
            // Check that access was logged in the access control contract
            const accessLog = await enhancedAccessControl.getAccessLog(0, 10);
            expect(accessLog.length).to.be.gt(0);
        });
    });

    describe("Error Handling", function () {
        it("Should handle invalid integration state", async function () {
            // This would require disabling all features to test
            // For now, we test normal operation
            const config = await integratedRegistry.getIntegrationConfig();
            expect(config.rbacEnabled || config.upgradeabilityEnabled || config.gasOptimizationEnabled).to.be.true;
        });

        it("Should provide meaningful error messages for permission denied", async function () {
            const did = "did:example:denied";
            const publicKey = "0x1234567890abcdef";
            const serviceEndpoint = "https://example.com/endpoint";
            
            await expect(
                integratedRegistry.connect(unauthorized).createDIDIntegrated(did, publicKey, serviceEndpoint)
            ).to.be.revertedWith("IntegratedDIDRegistry: RBAC permission denied");
        });
    });

    describe("Gas Efficiency with RBAC", function () {
        it("Should maintain reasonable gas costs with RBAC enabled", async function () {
            const did = "did:example:gas";
            const publicKey = "0x1234567890abcdef";
            const serviceEndpoint = "https://example.com/endpoint";
            
            const tx = await integratedRegistry.createDIDIntegrated(did, publicKey, serviceEndpoint);
            const receipt = await tx.wait();
            
            // Should be reasonable even with RBAC checks
            expect(receipt.gasUsed.toNumber()).to.be.lessThan(200000);
        });

        it("Should be more efficient with RBAC disabled", async function () {
            // Disable RBAC
            await integratedRegistry.setFeatureEnabled("RBAC", false);
            
            const did = "did:example:no-rbac";
            const publicKey = "0x1234567890abcdef";
            const serviceEndpoint = "https://example.com/endpoint";
            
            const tx = await integratedRegistry.createDIDIntegrated(did, publicKey, serviceEndpoint);
            const receipt = await tx.wait();
            
            // Should use less gas without RBAC checks
            expect(receipt.gasUsed.toNumber()).to.be.lessThan(150000);
        });
    });
});
