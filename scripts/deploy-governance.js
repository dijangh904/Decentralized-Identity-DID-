const { ethers } = require("hardhat");
const { expect } = require("chai");

async function main() {
    console.log("Deploying DID Governance System...");
    
    const [deployer, proposer, executor, voter1, voter2, voter3] = await ethers.getSigners();
    
    console.log("Deployer address:", deployer.address);
    console.log("Proposer address:", proposer.address);
    console.log("Executor address:", executor.address);
    
    // 1. Deploy Governance Token
    console.log("\n1. Deploying DID Governance Token...");
    const DIDGovernanceToken = await ethers.getContractFactory("DIDGovernanceToken");
    const governanceToken = await DIDGovernanceToken.deploy();
    await governanceToken.deployed();
    console.log("DIDGovernanceToken deployed to:", governanceToken.address);
    
    // 2. Deploy Timelock
    console.log("\n2. Deploying Timelock...");
    const minDelay = 2 * 24 * 60 * 60; // 2 days
    const proposers = [proposer.address];
    const executors = [executor.address];
    const admin = deployer.address;
    
    const DIDTimelock = await ethers.getContractFactory("DIDTimelock");
    const timelock = await DIDTimelock.deploy(minDelay, proposers, executors, admin);
    await timelock.deployed();
    console.log("DIDTimelock deployed to:", timelock.address);
    
    // 3. Deploy Governor
    console.log("\n3. Deploying Governor...");
    const DIDGovernor = await ethers.getContractFactory("DIDGovernor");
    const governor = await DIDGovernor.deploy(governanceToken.address, timelock.address);
    await governor.deployed();
    console.log("DIDGovernor deployed to:", governor.address);
    
    // 4. Deploy Governance Proxy
    console.log("\n4. Deploying Governance Proxy...");
    const GovernanceProxy = await ethers.getContractFactory("GovernanceProxy");
    const governanceProxy = await GovernanceProxy.deploy(
        governor.address,
        timelock.address,
        deployer.address // initial proxy admin
    );
    await governanceProxy.deployed();
    console.log("GovernanceProxy deployed to:", governanceProxy.address);
    
    // 5. Deploy Proxy Admin
    console.log("\n5. Deploying Proxy Admin...");
    const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = await ProxyAdmin.deploy();
    await proxyAdmin.deployed();
    console.log("ProxyAdmin deployed to:", proxyAdmin.address);
    
    // 6. Setup governance permissions
    console.log("\n6. Setting up governance permissions...");
    
    // Set up timelock roles
    const proposerRole = await timelock.PROPOSER_ROLE();
    const executorRole = await timelock.EXECUTOR_ROLE();
    const adminRole = await timelock.TIMELOCK_ADMIN_ROLE();
    
    await timelock.grantRole(proposerRole, governor.address);
    await timelock.grantRole(executorRole, governor.address);
    await timelock.grantRole(adminRole, deployer.address);
    
    // Revoke deployer's admin role after setup
    await timelock.revokeRole(adminRole, deployer.address);
    
    // Set governance proxy in proxy admin
    await proxyAdmin.setGovernanceProxy(governanceProxy.address);
    
    // 7. Distribute tokens to voters
    console.log("\n7. Distributing governance tokens...");
    const tokenAmount = ethers.utils.parseEther("1000000"); // 1M tokens each
    
    for (const voter of [voter1, voter2, voter3]) {
        await governanceToken.mint(voter.address, tokenAmount);
        console.log(`Minted ${ethers.utils.formatEther(tokenAmount)} tokens to ${voter.address}`);
    }
    
    // 8. Delegate voting power
    console.log("\n8. Delegating voting power...");
    for (const voter of [voter1, voter2, voter3]) {
        await governanceToken.connect(voter).delegate(voter.address);
    }
    
    // 9. Save deployment addresses
    const deploymentInfo = {
        network: hre.network.name,
        deployer: deployer.address,
        contracts: {
            governanceToken: governanceToken.address,
            timelock: timelock.address,
            governor: governor.address,
            governanceProxy: governanceProxy.address,
            proxyAdmin: proxyAdmin.address
        },
        roles: {
            proposer: proposer.address,
            executor: executor.address,
            voters: [voter1.address, voter2.address, voter3.address]
        },
        timestamp: new Date().toISOString()
    };
    
    console.log("\n=== Deployment Complete ===");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    return deploymentInfo;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
