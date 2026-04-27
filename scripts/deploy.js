const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deployment script for IntegratedDIDRegistry
 * 
 * This script deploys the complete DID registry solution addressing:
 * - Issue #140: Enhanced RBAC with fine-grained permissions
 * - Issue #139: Upgradeable contract pattern with proxy
 * - Issue #138: Gas optimization for 30%+ reduction
 * 
 * @author Fatima Sanusi
 */

async function main() {
    console.log("🚀 Starting IntegratedDIDRegistry deployment...");
    
    const [deployer] = await ethers.getSigners();
    console.log("📦 Deploying with account:", deployer.address);
    console.log("💰 Account balance:", ethers.utils.formatEther(await deployer.getBalance()));

    // Deployment configuration
    const config = {
        rbacEnabled: true,
        upgradeabilityEnabled: true,
        gasOptimizationEnabled: true,
        minUpgradeDelay: 24 * 60 * 60, // 24 hours
        maxUpgradeDelay: 7 * 24 * 60 * 60, // 7 days
        requiredApprovals: 2,
        network: network.name
    };

    console.log("⚙️ Deployment config:", config);

    try {
        // 1. Deploy Enhanced Access Control
        console.log("🔐 Deploying EnhancedAccessControl...");
        const AccessControl = await ethers.getContractFactory("EnhancedAccessControl");
        const accessControl = await AccessControl.deploy();
        await accessControl.deployed();
        console.log("✅ EnhancedAccessControl deployed to:", accessControl.address);

        // 2. Deploy Enhanced Proxy
        console.log("🔄 Deploying EnhancedProxy...");
        const Proxy = await ethers.getContractFactory("EnhancedProxy");
        const proxy = await Proxy.deploy();
        await proxy.deployed();
        console.log("✅ EnhancedProxy deployed to:", proxy.address);

        // 3. Deploy Gas Optimized Registry
        console.log("⛽ Deploying GasOptimizedDIDRegistry...");
        const GasOptimizedRegistry = await ethers.getContractFactory("GasOptimizedDIDRegistry");
        const gasOptimizedRegistry = await GasOptimizedRegistry.deploy(accessControl.address);
        await gasOptimizedRegistry.deployed();
        console.log("✅ GasOptimizedDIDRegistry deployed to:", gasOptimizedRegistry.address);

        // 4. Deploy Integrated Registry
        console.log("🔗 Deploying IntegratedDIDRegistry...");
        const IntegratedRegistry = await ethers.getContractFactory("IntegratedDIDRegistry");
        const integratedRegistry = await IntegratedRegistry.deploy();
        await integratedRegistry.deployed();
        console.log("✅ IntegratedDIDRegistry deployed to:", integratedRegistry.address);

        // 5. Initialize Integrated Registry
        console.log("🎯 Initializing IntegratedDIDRegistry...");
        const initTx = await integratedRegistry.initialize(
            accessControl.address,
            proxy.address,
            config.rbacEnabled,
            config.upgradeabilityEnabled,
            config.gasOptimizationEnabled
        );
        await initTx.wait();
        console.log("✅ IntegratedDIDRegistry initialized");

        // 6. Setup initial roles and permissions
        console.log("👥 Setting up initial roles...");
        await setupRoles(accessControl, deployer);

        // 7. Configure proxy settings
        console.log("⚙️ Configuring proxy settings...");
        await configureProxy(proxy, deployer, config);

        // 8. Verify deployment
        console.log("🔍 Verifying deployment...");
        await verifyDeployment(accessControl, proxy, gasOptimizedRegistry, integratedRegistry);

        // 9. Save deployment information
        const deploymentInfo = {
            network: config.network,
            deployer: deployer.address,
            timestamp: new Date().toISOString(),
            contracts: {
                accessControl: accessControl.address,
                proxy: proxy.address,
                gasOptimizedRegistry: gasOptimizedRegistry.address,
                integratedRegistry: integratedRegistry.address
            },
            config: config,
            gasUsed: {
                accessControl: (await accessControl.deployTransaction.wait()).gasUsed.toString(),
                proxy: (await proxy.deployTransaction.wait()).gasUsed.toString(),
                gasOptimizedRegistry: (await gasOptimizedRegistry.deployTransaction.wait()).gasUsed.toString(),
                integratedRegistry: (await integratedRegistry.deployTransaction.wait()).gasUsed.toString()
            }
        };

        // Save deployment info to file
        const deploymentPath = path.join(__dirname, `../deployments/${config.network}.json`);
        fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
        console.log("💾 Deployment info saved to:", deploymentPath);

        // 10. Generate ABI files
        await generateABIs(accessControl, proxy, gasOptimizedRegistry, integratedRegistry);

        console.log("🎉 Deployment completed successfully!");
        console.log("📊 Summary:");
        console.log("   - Enhanced Access Control:", accessControl.address);
        console.log("   - Enhanced Proxy:", proxy.address);
        console.log("   - Gas Optimized Registry:", gasOptimizedRegistry.address);
        console.log("   - Integrated Registry:", integratedRegistry.address);
        console.log("   - Total Gas Used:", calculateTotalGas(deploymentInfo.gasUsed));

    } catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }
}

/**
 * Setup initial roles and permissions
 */
async function setupRoles(accessControl, deployer) {
    // Grant admin role to deployer
    await accessControl.grantRole(await accessControl.ROLE_ADMIN(), deployer.address);
    console.log("   ✅ Admin role granted to deployer");

    // Setup role hierarchy
    await accessControl.updateRoleHierarchy(
        await accessControl.ROLE_ADMIN(),
        ethers.constants.HashZero, // No parent
        0, // Top level
        true, // Can delegate
        5 // Max delegation level
    );

    await accessControl.updateRoleHierarchy(
        await accessControl.ROLE_GOVERNOR(),
        await accessControl.ROLE_ADMIN(),
        1,
        true,
        3
    );

    await accessControl.updateRoleHierarchy(
        await accessControl.ROLE_ISSUER(),
        await accessControl.ROLE_GOVERNOR(),
        2,
        true,
        2
    );

    console.log("   ✅ Role hierarchy configured");
}

/**
 * Configure proxy settings
 */
async function configureProxy(proxy, deployer, config) {
    // Authorize deployer for upgrades
    await proxy.authorizeUpgrader(deployer.address);
    console.log("   ✅ Deployer authorized for upgrades");

    // Set upgrade delays
    await proxy.setMinUpgradeDelay(config.minUpgradeDelay);
    await proxy.setMaxUpgradeDelay(config.maxUpgradeDelay);
    await proxy.setRequiredApprovals(config.requiredApprovals);
    console.log("   ✅ Proxy upgrade configuration set");
}

/**
 * Verify deployment by checking basic functionality
 */
async function verifyDeployment(accessControl, proxy, gasOptimizedRegistry, integratedRegistry) {
    // Check access control
    const hasAdminRole = await accessControl.hasRole(await accessControl.ROLE_ADMIN(), await accessControl.owner());
    if (!hasAdminRole) throw new Error("Access control verification failed");

    // Check proxy configuration
    const proxyConfig = await proxy.getProxyConfiguration();
    if (proxyConfig.minDelay.toString() !== "86400") throw new Error("Proxy configuration verification failed");

    // Check integrated registry
    const integrationConfig = await integratedRegistry.getIntegrationConfig();
    if (!integrationConfig.rbacEnabled || !integrationConfig.upgradeabilityEnabled || !integrationConfig.gasOptimizationEnabled) {
        throw new Error("Integrated registry configuration verification failed");
    }

    console.log("   ✅ All contracts verified successfully");
}

/**
 * Generate ABI files for frontend integration
 */
async function generateABIs(accessControl, proxy, gasOptimizedRegistry, integratedRegistry) {
    const artifactsDir = path.join(__dirname, "../artifacts");

    // Save ABIs
    fs.writeFileSync(
        path.join(artifactsDir, "EnhancedAccessControl.json"),
        JSON.stringify(accessControl.interface.format(ethers.utils.FormatTypes.json), null, 2)
    );

    fs.writeFileSync(
        path.join(artifactsDir, "EnhancedProxy.json"),
        JSON.stringify(proxy.interface.format(ethers.utils.FormatTypes.json), null, 2)
    );

    fs.writeFileSync(
        path.join(artifactsDir, "GasOptimizedDIDRegistry.json"),
        JSON.stringify(gasOptimizedRegistry.interface.format(ethers.utils.FormatTypes.json), null, 2)
    );

    fs.writeFileSync(
        path.join(artifactsDir, "IntegratedDIDRegistry.json"),
        JSON.stringify(integratedRegistry.interface.format(ethers.utils.FormatTypes.json), null, 2)
    );

    console.log("   ✅ ABI files generated");
}

/**
 * Calculate total gas used
 */
function calculateTotalGas(gasUsed) {
    const total = Object.values(gasUsed).reduce((sum, gas) => sum + parseInt(gas), 0);
    return ethers.utils.formatUnits(total, "wei");
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
