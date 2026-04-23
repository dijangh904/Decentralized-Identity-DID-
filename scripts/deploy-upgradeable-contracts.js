const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("Deploying Upgradeable DID Registry Contracts...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");

  try {
    // Deploy the UpgradeableStellarDIDRegistry implementation
    console.log("1. Deploying UpgradeableStellarDIDRegistry implementation...");
    const UpgradeableStellarDIDRegistry = await ethers.getContractFactory("UpgradeableStellarDIDRegistry");
    const implementation = await UpgradeableStellarDIDRegistry.deploy();
    await implementation.deployed();
    console.log("   Implementation deployed to:", implementation.address);

    // Deploy the proxy admin
    console.log("\n2. Deploying ProxyAdmin...");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = await ProxyAdmin.deploy();
    await proxyAdmin.deployed();
    console.log("   ProxyAdmin deployed to:", proxyAdmin.address);

    // Deploy the UUPS proxy
    console.log("\n3. Deploying UUPS Proxy...");
    const DIDProxy = await ethers.getContractFactory("DIDProxy");
    const proxy = await upgrades.deployProxy(
      DIDProxy,
      [deployer.address], // constructor arguments for initialize
      { 
        initializer: "initialize",
        kind: "uups"
      }
    );
    await proxy.deployed();
    console.log("   Proxy deployed to:", proxy.address);

    // Initialize the proxy with the implementation
    console.log("\n4. Initializing proxy with implementation...");
    const upgradeTx = await proxy.upgradeTo(implementation.address);
    await upgradeTx.wait();
    console.log("   Proxy upgraded to implementation");

    // Verify the setup
    console.log("\n5. Verifying deployment...");
    const currentImplementation = await proxy.getImplementation();
    console.log("   Current implementation:", currentImplementation);
    console.log("   Expected implementation:", implementation.address);
    
    if (currentImplementation.toLowerCase() === implementation.address.toLowerCase()) {
      console.log("   ✅ Proxy correctly points to implementation");
    } else {
      console.log("   ❌ Proxy implementation mismatch!");
      throw new Error("Proxy implementation verification failed");
    }

    // Test basic functionality
    console.log("\n6. Testing basic functionality...");
    const registry = UpgradeableStellarDIDRegistry.attach(proxy.address);
    
    const version = await registry.getVersion();
    console.log("   Contract version:", version);
    
    const contractType = await registry.getContractType();
    console.log("   Contract type:", contractType);

    // Save deployment addresses
    const deploymentInfo = {
      network: network.name,
      deployer: deployer.address,
      deploymentTime: new Date().toISOString(),
      contracts: {
        proxy: proxy.address,
        implementation: implementation.address,
        proxyAdmin: proxyAdmin.address
      },
      verified: true
    };

    // Write deployment info to file
    const fs = require("fs");
    const deploymentPath = `./deployments/${network.name}-upgradeable-did-registry.json`;
    
    // Ensure deployments directory exists
    if (!fs.existsSync("./deployments")) {
      fs.mkdirSync("./deployments");
    }
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n7. Deployment info saved to: ${deploymentPath}`);

    console.log("\n🎉 Upgradeable DID Registry deployment completed successfully!");
    console.log("\n📋 Summary:");
    console.log("   Proxy Address:", proxy.address);
    console.log("   Implementation Address:", implementation.address);
    console.log("   ProxyAdmin Address:", proxyAdmin.address);
    console.log("\n📝 Next Steps:");
    console.log("   1. Update your frontend to use the proxy address");
    console.log("   2. Test the upgrade functionality");
    console.log("   3. Set up monitoring for contract upgrades");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Deploy upgrade to new implementation
async function upgrade() {
  console.log("Upgrading DID Registry implementation...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);

  try {
    // Get current proxy address
    const fs = require("fs");
    const deploymentPath = `./deployments/${network.name}-upgradeable-did-registry.json`;
    
    if (!fs.existsSync(deploymentPath)) {
      throw new Error("No existing deployment found. Deploy first using the main script.");
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const proxyAddress = deploymentInfo.contracts.proxy;
    
    console.log("Current proxy address:", proxyAddress);

    // Deploy new implementation
    console.log("\n1. Deploying new implementation...");
    const UpgradeableStellarDIDRegistry = await ethers.getContractFactory("UpgradeableStellarDIDRegistry");
    const newImplementation = await UpgradeableStellarDIDRegistry.deploy();
    await newImplementation.deployed();
    console.log("   New implementation deployed to:", newImplementation.address);

    // Upgrade the proxy
    console.log("\n2. Upgrading proxy...");
    const proxy = await ethers.getContractAt("DIDProxy", proxyAddress);
    const upgradeTx = await proxy.upgradeTo(newImplementation.address);
    await upgradeTx.wait();
    console.log("   Proxy upgraded successfully");

    // Verify upgrade
    console.log("\n3. Verifying upgrade...");
    const currentImplementation = await proxy.getImplementation();
    console.log("   Current implementation:", currentImplementation);
    console.log("   New implementation:", newImplementation.address);
    
    if (currentImplementation.toLowerCase() === newImplementation.address.toLowerCase()) {
      console.log("   ✅ Upgrade verified successfully");
    } else {
      console.log("   ❌ Upgrade verification failed!");
      throw new Error("Upgrade verification failed");
    }

    // Update deployment info
    deploymentInfo.contracts.implementation = newImplementation.address;
    deploymentInfo.lastUpgrade = new Date().toISOString();
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("\n🎉 Upgrade completed successfully!");
    console.log("   New implementation address:", newImplementation.address);

  } catch (error) {
    console.error("❌ Upgrade failed:", error);
    process.exit(1);
  }
}

// Handle command line arguments
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === "upgrade") {
    upgrade();
  } else {
    main();
  }
}

module.exports = {
  main,
  upgrade
};
