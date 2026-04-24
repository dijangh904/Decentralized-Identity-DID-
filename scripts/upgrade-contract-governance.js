const { ethers } = require("hardhat");
const { expect } = require("chai");

/**
 * Script to upgrade a contract through the governance system
 * Usage: npx hardhat run scripts/upgrade-contract-governance.js --network <network>
 */
async function main() {
    console.log("Starting contract upgrade through governance...");
    
    // Get signers
    const [proposer, voter1, voter2, voter3] = await ethers.getSigners();
    
    // Contract addresses (should be loaded from deployment file)
    const GOVERNANCE_TOKEN_ADDRESS = process.env.GOVERNANCE_TOKEN_ADDRESS;
    const TIMELOCK_ADDRESS = process.env.TIMELOCK_ADDRESS;
    const GOVERNOR_ADDRESS = process.env.GOVERNOR_ADDRESS;
    const GOVERNANCE_PROXY_ADDRESS = process.env.GOVERNANCE_PROXY_ADDRESS;
    const PROXY_ADMIN_ADDRESS = process.env.PROXY_ADMIN_ADDRESS;
    const TARGET_PROXY_ADDRESS = process.env.TARGET_PROXY_ADDRESS;
    
    if (!GOVERNANCE_TOKEN_ADDRESS || !TIMELOCK_ADDRESS || !GOVERNOR_ADDRESS) {
        throw new Error("Missing required environment variables");
    }
    
    // Get contract instances
    const governanceToken = await ethers.getContractAt("DIDGovernanceToken", GOVERNANCE_TOKEN_ADDRESS);
    const timelock = await ethers.getContractAt("DIDTimelock", TIMELOCK_ADDRESS);
    const governor = await ethers.getContractAt("DIDGovernor", GOVERNOR_ADDRESS);
    const governanceProxy = await ethers.getContractAt("GovernanceProxy", GOVERNANCE_PROXY_ADDRESS);
    
    console.log("Contracts loaded:");
    console.log("Governance Token:", governanceToken.address);
    console.log("Timelock:", timelock.address);
    console.log("Governor:", governor.address);
    console.log("Governance Proxy:", governanceProxy.address);
    
    // Step 1: Deploy new implementation
    console.log("\n1. Deploying new implementation...");
    const NewImplementation = await ethers.getContractFactory("EthereumDIDRegistry");
    const newImplementation = await NewImplementation.deploy();
    await newImplementation.deployed();
    console.log("New implementation deployed to:", newImplementation.address);
    
    // Step 2: Create upgrade proposal
    console.log("\n2. Creating upgrade proposal...");
    const proposalDescription = `Upgrade DID Registry to new implementation at ${newImplementation.address}`;
    
    const proposalId = await governor.callStatic.proposeContractUpgrade(
        TARGET_PROXY_ADDRESS,
        newImplementation.address,
        proposalDescription
    );
    
    const tx = await governor.proposeContractUpgrade(
        TARGET_PROXY_ADDRESS,
        newImplementation.address,
        proposalDescription
    );
    const receipt = await tx.wait();
    
    console.log("Proposal created with ID:", proposalId.toString());
    console.log("Transaction hash:", receipt.transactionHash);
    
    // Step 3: Wait for voting delay
    console.log("\n3. Waiting for voting delay...");
    const votingDelay = await governor.votingDelay();
    console.log("Voting delay:", votingDelay.toString(), "seconds");
    
    // Fast forward (in test environment)
    if (network.name === "hardhat") {
        await ethers.provider.send("evm_increaseTime", [votingDelay.toNumber() + 1]);
        await ethers.provider.send("evm_mine");
        console.log("Fast-forwarded past voting delay");
    } else {
        console.log("Please wait for the voting delay to pass...");
        return;
    }
    
    // Step 4: Cast votes
    console.log("\n4. Casting votes...");
    const voters = [voter1, voter2, voter3];
    
    for (const voter of voters) {
        const tx = await governor.connect(voter).castVote(proposalId, 1); // 1 = For
        const receipt = await tx.wait();
        console.log(`Vote cast by ${voter.address}, tx: ${receipt.transactionHash}`);
    }
    
    // Step 5: Wait for voting period
    console.log("\n5. Waiting for voting period...");
    const votingPeriod = await governor.votingPeriod();
    console.log("Voting period:", votingPeriod.toString(), "seconds");
    
    if (network.name === "hardhat") {
        await ethers.provider.send("evm_increaseTime", [votingPeriod.toNumber() + 1]);
        await ethers.provider.send("evm_mine");
        console.log("Fast-forwarded past voting period");
    } else {
        console.log("Please wait for the voting period to pass...");
        return;
    }
    
    // Step 6: Check proposal state
    console.log("\n6. Checking proposal state...");
    const state = await governor.state(proposalId);
    console.log("Proposal state:", state); // 4 = Succeeded
    
    if (state != 4) {
        throw new Error("Proposal did not succeed. State: " + state);
    }
    
    // Step 7: Queue proposal
    console.log("\n7. Queuing proposal for execution...");
    const targets = [timelock.address];
    const values = [0];
    const signatures = [""];
    const calldatas = [
        ethers.utils.defaultAbiCoder.encode(
            ["address", "address"],
            [TARGET_PROXY_ADDRESS, newImplementation.address]
        )
    ];
    const descriptionHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(proposalDescription));
    
    const queueTx = await governor.queue(targets, values, signatures, calldatas, descriptionHash);
    const queueReceipt = await queueTx.wait();
    console.log("Proposal queued, tx:", queueReceipt.transactionHash);
    
    // Step 8: Wait for timelock delay
    console.log("\n8. Waiting for timelock delay...");
    const timelockDelay = await timelock.getMinDelay();
    console.log("Timelock delay:", timelockDelay.toString(), "seconds");
    
    if (network.name === "hardhat") {
        await ethers.provider.send("evm_increaseTime", [timelockDelay.toNumber() + 1]);
        await ethers.provider.send("evm_mine");
        console.log("Fast-forwarded past timelock delay");
    } else {
        console.log("Please wait for the timelock delay to pass...");
        return;
    }
    
    // Step 9: Execute proposal
    console.log("\n9. Executing proposal...");
    const executeTx = await governor.execute(targets, values, signatures, calldatas, descriptionHash);
    const executeReceipt = await executeTx.wait();
    console.log("Proposal executed, tx:", executeReceipt.transactionHash);
    
    // Step 10: Verify upgrade
    console.log("\n10. Verifying upgrade...");
    const currentImplementation = await governanceProxy.getProxyImplementation(TARGET_PROXY_ADDRESS);
    console.log("Current implementation:", currentImplementation);
    console.log("New implementation:", newImplementation.address);
    
    expect(currentImplementation).to.equal(newImplementation.address);
    console.log("✅ Upgrade successful!");
    
    return {
        proposalId: proposalId.toString(),
        newImplementation: newImplementation.address,
        executionTx: executeReceipt.transactionHash
    };
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then((result) => {
        console.log("\n=== Upgrade Complete ===");
        console.log("Result:", result);
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
