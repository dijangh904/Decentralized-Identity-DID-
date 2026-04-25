const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

/**
 * Test Suite for Upgradeable Contract Pattern
 * 
 * This test suite verifies the complete upgradeable contract pattern implementation
 * including proxy functionality, state migration, access control, and data integrity.
 */

describe("Upgradeable Contract Pattern", function () {
  let deployer, governor, issuer, user, auditor;
  let accessControl, stateMigration, enhancedProxy, proxyFactory;
  let didImplementation, integratedRegistry, factoryProxy;
  let deploymentInfo;

  beforeEach(async function () {
    // Get signers
    [deployer, governor, issuer, user, auditor] = await ethers.getSigners();

    // Deploy Enhanced Access Control
    const EnhancedAccessControl = await ethers.getContractFactory("EnhancedAccessControl");
    accessControl = await EnhancedAccessControl.deploy();
    await accessControl.deployed();

    // Deploy State Migration
    const StateMigration = await ethers.getContractFactory("StateMigration");
    stateMigration = await StateMigration.deploy(
      accessControl.address,
      2, // requiredApprovals
      86400 // deadlineBuffer
    );
    await stateMigration.deployed();

    // Deploy Enhanced Proxy
    const EnhancedProxy = await ethers.getContractFactory("EnhancedProxy");
    enhancedProxy = await upgrades.deployProxy(
      EnhancedProxy,
      [
        deployer.address,
        accessControl.address,
        ethers.constants.AddressZero,
        3600, // minUpgradeDelay
        86400, // maxUpgradeDelay
        2 // requiredApprovals
      ],
      { initializer: "initialize", kind: "uups" }
    );
    await enhancedProxy.deployed();

    // Deploy Proxy Factory
    const UpgradeableProxyFactory = await ethers.getContractFactory("UpgradeableProxyFactory");
    proxyFactory = await UpgradeableProxyFactory.deploy(
      accessControl.address,
      3600 // minImplementationDelay
    );
    await proxyFactory.deployed();

    // Deploy DID Implementation
    const GasOptimizedDIDRegistry = await ethers.getContractFactory("GasOptimizedDIDRegistry");
    didImplementation = await GasOptimizedDIDRegistry.deploy(accessControl.address);
    await didImplementation.deployed();

    // Deploy Integrated Registry
    const IntegratedDIDRegistry = await ethers.getContractFactory("IntegratedDIDRegistry");
    integratedRegistry = await upgrades.deployProxy(
      IntegratedDIDRegistry,
      [
        accessControl.address,
        enhancedProxy.address,
        true, // rbacEnabled
        true, // upgradeabilityEnabled
        true  // gasOptimizationEnabled
      ],
      { initializer: "initialize", kind: "uups" }
    );
    await integratedRegistry.deployed();

    // Setup roles and permissions
    await accessControl.grantRole(await accessControl.ROLE_ADMIN(), deployer.address);
    await accessControl.grantRole(await accessControl.ROLE_GOVERNOR(), governor.address);
    await accessControl.grantRole(await accessControl.ROLE_ISSUER(), issuer.address);
    await accessControl.grantRole(await accessControl.ROLE_USER(), user.address);
    await accessControl.grantRole(await accessControl.ROLE_AUDITOR(), auditor.address);

    // Store deployment info
    deploymentInfo = {
      accessControl: accessControl.address,
      stateMigration: stateMigration.address,
      enhancedProxy: enhancedProxy.address,
      proxyFactory: proxyFactory.address,
      didImplementation: didImplementation.address,
      integratedRegistry: integratedRegistry.address
    };
  });

  describe("Access Control Integration", function () {
    it("Should properly set up roles and permissions", async function () {
      expect(await accessControl.hasRole(await accessControl.ROLE_ADMIN(), deployer.address)).to.be.true;
      expect(await accessControl.hasRole(await accessControl.ROLE_GOVERNOR(), governor.address)).to.be.true;
      expect(await accessControl.hasRole(await accessControl.ROLE_ISSUER(), issuer.address)).to.be.true;
      expect(await accessControl.hasRole(await accessControl.ROLE_USER(), user.address)).to.be.true;
      expect(await accessControl.hasRole(await accessControl.ROLE_AUDITOR(), auditor.address)).to.be.true;
    });

    it("Should check permissions correctly", async function () {
      // Check admin permissions
      expect(
        await accessControl.checkPermission(
          deployer.address,
          0, // ResourceType.DID
          0  // OperationType.CREATE
        )
      ).to.be.true;

      // Check user permissions for own DID operations
      expect(
        await accessControl.checkPermission(
          user.address,
          0, // ResourceType.DID
          0  // OperationType.CREATE
        )
      ).to.be.true;

      // Check auditor permissions (read-only)
      expect(
        await accessControl.checkPermission(
          auditor.address,
          0, // ResourceType.DID
          1  // OperationType.READ
        )
      ).to.be.true;
    });
  });

  describe("Enhanced Proxy Functionality", function () {
    it("Should initialize proxy correctly", async function () {
      const config = await enhancedProxy.getProxyConfiguration();
      expect(config.minDelay).to.equal(3600);
      expect(config.maxDelay).to.equal(86400);
      expect(config.approvals).to.equal(2);
      expect(config.emergencyModeStatus).to.be.false;
    });

    it("Should propose upgrade correctly", async function () {
      // Deploy new implementation for testing
      const GasOptimizedDIDRegistry = await ethers.getContractFactory("GasOptimizedDIDRegistry");
      const newImplementation = await GasOptimizedDIDRegistry.deploy(accessControl.address);
      await newImplementation.deployed();

      // Propose upgrade
      const tx = await enhancedProxy.connect(governor).proposeUpgrade(
        newImplementation.address,
        "Test upgrade",
        false, // not emergency
        3600 // delay
      );
      const receipt = await tx.wait();
      
      // Get proposal ID from event
      const event = receipt.events.find(e => e.event === "UpgradeProposed");
      expect(event).to.not.be.undefined;
      expect(event.args.newImplementation).to.equal(newImplementation.address);
      expect(event.args.proposedBy).to.equal(governor.address);
    });

    it("Should approve upgrade correctly", async function () {
      // Deploy new implementation
      const GasOptimizedDIDRegistry = await ethers.getContractFactory("GasOptimizedDIDRegistry");
      const newImplementation = await GasOptimizedDIDRegistry.deploy(accessControl.address);
      await newImplementation.deployed();

      // Propose upgrade
      const proposeTx = await enhancedProxy.connect(governor).proposeUpgrade(
        newImplementation.address,
        "Test upgrade",
        false,
        3600
      );
      const proposeReceipt = await proposeTx.wait();
      const proposalId = proposeReceipt.events.find(e => e.event === "UpgradeProposed").args.proposalId;

      // Approve upgrade
      const approveTx = await enhancedProxy.connect(deployer).approveUpgrade(proposalId);
      const approveReceipt = await approveTx.wait();
      
      const approveEvent = approveReceipt.events.find(e => e.event === "UpgradeApproved");
      expect(approveEvent).to.not.be.undefined;
      expect(approveEvent.args.approver).to.equal(deployer.address);
      expect(approveEvent.args.approvalCount).to.equal(1);
    });

    it("Should handle emergency upgrades", async function () {
      // Activate emergency mode
      await enhancedProxy.connect(deployer).activateEmergencyMode("Test emergency");

      // Deploy new implementation
      const GasOptimizedDIDRegistry = await ethers.getContractFactory("GasOptimizedDIDRegistry");
      const newImplementation = await GasOptimizedDIDRegistry.deploy(accessControl.address);
      await newImplementation.deployed();

      // Emergency upgrade (should work without delay and approvals)
      const tx = await enhancedProxy.connect(deployer).emergencyUpgrade(
        newImplementation.address,
        "Emergency upgrade test"
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "UpgradeExecuted");
      expect(event).to.not.be.undefined;
      expect(event.args.emergency).to.be.true;
    });
  });

  describe("Proxy Factory", function () {
    it("Should create proxy correctly", async function () {
      const initData = didImplementation.interface.encodeFunctionData("initialize", [accessControl.address]);
      
      const tx = await proxyFactory.connect(governor).createProxy(
        didImplementation.address,
        initData
      );
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === "ProxyCreated");
      expect(event).to.not.be.undefined;
      expect(event.args.implementation).to.equal(didImplementation.address);
      expect(event.args.creator).to.equal(governor.address);
      
      // Verify proxy is registered
      expect(await proxyFactory.isRegisteredProxy(event.args.proxy)).to.be.true;
    });

    it("Should batch create proxies", async function () {
      const implementations = [didImplementation.address, didImplementation.address];
      const initDataArray = [
        didImplementation.interface.encodeFunctionData("initialize", [accessControl.address]),
        didImplementation.interface.encodeFunctionData("initialize", [accessControl.address])
      ];
      
      const tx = await proxyFactory.connect(governor).batchCreateProxies(
        implementations,
        initDataArray
      );
      const receipt = await tx.wait();
      
      // Should have 2 ProxyCreated events
      const events = receipt.events.filter(e => e.event === "ProxyCreated");
      expect(events.length).to.equal(2);
      
      // Verify both proxies are registered
      for (const event of events) {
        expect(await proxyFactory.isRegisteredProxy(event.args.proxy)).to.be.true;
      }
    });

    it("Should upgrade proxy correctly", async function () {
      // Create a proxy first
      const initData = didImplementation.interface.encodeFunctionData("initialize", [accessControl.address]);
      const createTx = await proxyFactory.connect(governor).createProxy(didImplementation.address, initData);
      const createReceipt = await createTx.wait();
      const proxyAddress = createReceipt.events.find(e => e.event === "ProxyCreated").args.proxy;
      
      // Deploy new implementation
      const GasOptimizedDIDRegistry = await ethers.getContractFactory("GasOptimizedDIDRegistry");
      const newImplementation = await GasOptimizedDIDRegistry.deploy(accessControl.address);
      await newImplementation.deployed();
      
      // Upgrade proxy
      const upgradeTx = await proxyFactory.upgradeProxy(proxyAddress, newImplementation.address);
      const upgradeReceipt = await upgradeTx.wait();
      
      const event = upgradeReceipt.events.find(e => e.event === "ProxyUpgraded");
      expect(event).to.not.be.undefined;
      expect(event.args.oldImplementation).to.equal(didImplementation.address);
      expect(event.args.newImplementation).to.equal(newImplementation.address);
    });
  });

  describe("State Migration", function () {
    it("Should create migration plan correctly", async function () {
      const tx = await stateMigration.connect(governor).createMigrationPlan(
        didImplementation.address,
        didImplementation.address, // same for testing
        Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        "Test migration",
        false // not emergency
      );
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === "MigrationPlanCreated");
      expect(event).to.not.be.undefined;
      expect(event.args.fromImplementation).to.equal(didImplementation.address);
      expect(event.args.proposedBy).to.equal(governor.address);
      expect(event.args.emergency).to.be.false;
    });

    it("Should approve migration plan", async function () {
      // Create migration plan
      const createTx = await stateMigration.connect(governor).createMigrationPlan(
        didImplementation.address,
        didImplementation.address,
        Math.floor(Date.now() / 1000) + 3600,
        "Test migration",
        false
      );
      const createReceipt = await createTx.wait();
      const planId = createReceipt.events.find(e => e.event === "MigrationPlanCreated").args.planId;
      
      // Approve migration plan
      const tx = await stateMigration.connect(deployer).approveMigrationPlan(planId);
      const receipt = await tx.wait();
      
      const event = receipt.events.find(e => e.event === "MigrationPlanApproved");
      expect(event).to.not.be.undefined;
      expect(event.args.approver).to.equal(deployer.address);
    });

    it("Should add data entries for migration", async function () {
      // Create migration plan
      const createTx = await stateMigration.connect(governor).createMigrationPlan(
        didImplementation.address,
        didImplementation.address,
        Math.floor(Date.now() / 1000) + 3600,
        "Test migration",
        false
      );
      const createReceipt = await createTx.wait();
      const planId = createReceipt.events.find(e => e.event === "MigrationPlanCreated").args.planId;
      
      // Add data entry
      const tx = await stateMigration.connect(governor).addDataEntry(
        planId,
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test_key")),
        ethers.utils.toUtf8Bytes("old_value"),
        ethers.utils.toUtf8Bytes("new_value")
      );
      const receipt = await tx.wait();
      
      // Verify data entry was added
      const entry = await stateMigration.getDataEntry(
        planId,
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test_key"))
      );
      expect(entry.key).to.equal(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test_key")));
      expect(entry.migrated).to.be.false;
    });
  });

  describe("Integrated Registry", function () {
    it("Should initialize with correct configuration", async function () {
      const [rbacEnabled, upgradeabilityEnabled, gasOptimizationEnabled] = await integratedRegistry.getIntegrationConfig();
      
      expect(rbacEnabled).to.be.true;
      expect(upgradeabilityEnabled).to.be.true;
      expect(gasOptimizationEnabled).to.be.true;
    });

    it("Should create DID with integrated features", async function () {
      const tx = await integratedRegistry.connect(user).createDIDIntegrated(
        "did:example:123",
        "public_key_123",
        "https://example.com/service"
      );
      
      expect(tx).to.not.be.undefined;
      
      // Verify DID was created
      const exists = await integratedRegistry.didExistsOptimized("did:example:123");
      expect(exists).to.be.true;
    });

    it("Should batch create DIDs", async function () {
      const dids = ["did:example:1", "did:example:2"];
      const publicKeys = ["key1", "key2"];
      const serviceEndpoints = ["https://example1.com", "https://example2.com"];
      
      const tx = await integratedRegistry.connect(user).batchCreateDIDsIntegrated(
        dids,
        publicKeys,
        serviceEndpoints
      );
      
      expect(tx).to.not.be.undefined;
      
      // Verify DIDs were created
      for (const did of dids) {
        const exists = await integratedRegistry.didExistsOptimized(did);
        expect(exists).to.be.true;
      }
    });

    it("Should issue credentials with integrated features", async function () {
      const tx = await integratedRegistry.connect(issuer).issueCredentialIntegrated(
        "did:example:issuer",
        "did:example:subject",
        "VerifiableCredential",
        Math.floor(Date.now() / 1000) + 86400, // expires in 24 hours
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credential_data"))
      );
      
      expect(tx).to.not.be.undefined;
    });
  });

  describe("Data Integrity During Upgrade", function () {
    it("Should preserve data during upgrade", async function () {
      // Create some data in the original implementation
      await integratedRegistry.connect(user).createDIDIntegrated(
        "did:example:test123",
        "test_public_key",
        "https://test.example.com/service"
      );
      
      // Verify data exists
      const existsBefore = await integratedRegistry.didExistsOptimized("did:example:test123");
      expect(existsBefore).to.be.true;
      
      // Get DID document before upgrade
      const docBefore = await integratedRegistry.getDIDDocumentOptimized("did:example:test123");
      expect(docBefore.owner).to.equal(user.address);
      
      // Deploy new implementation
      const GasOptimizedDIDRegistry = await ethers.getContractFactory("GasOptimizedDIDRegistry");
      const newImplementation = await GasOptimizedDIDRegistry.deploy(accessControl.address);
      await newImplementation.deployed();
      
      // Upgrade the proxy
      await enhancedProxy.connect(deployer).emergencyUpgrade(
        newImplementation.address,
        "Data integrity test upgrade"
      );
      
      // Verify data still exists after upgrade
      const existsAfter = await integratedRegistry.didExistsOptimized("did:example:test123");
      expect(existsAfter).to.be.true;
      
      // Get DID document after upgrade
      const docAfter = await integratedRegistry.getDIDDocumentOptimized("did:example:test123");
      expect(docAfter.owner).to.equal(user.address);
      expect(docAfter.publicKey).to.equal(docBefore.publicKey);
      expect(docAfter.serviceEndpoint).to.equal(docBefore.serviceEndpoint);
    });

    it("Should preserve performance metrics across upgrades", async function () {
      // Perform some operations to generate metrics
      await integratedRegistry.connect(user).createDIDIntegrated(
        "did:example:metrics1",
        "metrics_key1",
        "https://metrics1.example.com"
      );
      
      await integratedRegistry.connect(user).createDIDIntegrated(
        "did:example:metrics2",
        "metrics_key2",
        "https://metrics2.example.com"
      );
      
      // Get metrics before upgrade
      const [rbacChecks, upgradeOps, optimizedOps, totalGasSaved, avgGas] = 
        await integratedRegistry.getPerformanceMetrics();
      
      expect(optimizedOps).to.be.greaterThan(0);
      
      // Deploy new implementation
      const GasOptimizedDIDRegistry = await ethers.getContractFactory("GasOptimizedDIDRegistry");
      const newImplementation = await GasOptimizedDIDRegistry.deploy(accessControl.address);
      await newImplementation.deployed();
      
      // Upgrade the proxy
      await enhancedProxy.connect(deployer).emergencyUpgrade(
        newImplementation.address,
        "Metrics preservation test"
      );
      
      // Verify metrics are preserved
      const [rbacChecksAfter, upgradeOpsAfter, optimizedOpsAfter, totalGasSavedAfter, avgGasAfter] = 
        await integratedRegistry.getPerformanceMetrics();
      
      expect(optimizedOpsAfter).to.equal(optimizedOps);
      expect(totalGasSavedAfter).to.equal(totalGasSaved);
    });
  });

  describe("Emergency Controls", function () {
    it("Should handle emergency pause correctly", async function () {
      // Pause the factory
      await proxyFactory.connect(deployer).emergencyPause("Test emergency pause");
      
      expect(await proxyFactory.emergencyPaused()).to.be.true;
      
      // Try to create proxy (should fail)
      const initData = didImplementation.interface.encodeFunctionData("initialize", [accessControl.address]);
      
      await expect(
        proxyFactory.connect(governor).createProxy(didImplementation.address, initData)
      ).to.be.revertedWith("UpgradeableProxyFactory: emergency paused");
      
      // Unpause
      await proxyFactory.connect(deployer).unpause();
      expect(await proxyFactory.emergencyPaused()).to.be.false;
    });

    it("Should handle emergency migration mode", async function () {
      // Enable emergency migration
      await stateMigration.connect(governor).toggleEmergencyMigration(true);
      expect(await stateMigration.emergencyMigrationEnabled()).to.be.true;
      
      // Create migration plan with emergency flag
      const tx = await stateMigration.connect(governor).createMigrationPlan(
        didImplementation.address,
        didImplementation.address,
        Math.floor(Date.now() / 1000) + 100, // short delay for testing
        "Emergency migration test",
        true // emergency
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "MigrationPlanCreated");
      expect(event.args.emergency).to.be.true;
      
      // Disable emergency migration
      await stateMigration.connect(governor).toggleEmergencyMigration(false);
      expect(await stateMigration.emergencyMigrationEnabled()).to.be.false;
    });
  });

  describe("Gas Optimization Verification", function () {
    it("Should track gas usage correctly", async function () {
      // Perform operations
      await integratedRegistry.connect(user).createDIDIntegrated(
        "did:example:gas1",
        "gas_key1",
        "https://gas1.example.com"
      );
      
      // Get gas metrics
      const [totalSaved, operationCount, averageSavings] = 
        await integratedRegistry.getGasOptimizationMetrics();
      
      expect(operationCount).to.be.greaterThan(0);
      expect(totalSaved).to.be.greaterThan(0);
    });

    it("Should show gas optimization benefits in batch operations", async function () {
      const dids = ["did:example:batch1", "did:example:batch2", "did:example:batch3"];
      const publicKeys = ["batch_key1", "batch_key2", "batch_key3"];
      const serviceEndpoints = ["https://batch1.example.com", "https://batch2.example.com", "https://batch3.example.com"];
      
      // Perform batch operation
      const tx = await integratedRegistry.connect(user).batchCreateDIDsIntegrated(
        dids,
        publicKeys,
        serviceEndpoints
      );
      const receipt = await tx.wait();
      
      // Verify batch operation was successful
      expect(receipt.status).to.equal(1);
      
      // Verify all DIDs were created
      for (const did of dids) {
        const exists = await integratedRegistry.didExistsOptimized(did);
        expect(exists).to.be.true;
      }
    });
  });
});
