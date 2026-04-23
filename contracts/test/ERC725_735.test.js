const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StellarDIDRegistry ERC-725/735 Interface Tests", function () {
    let contract;
    let owner, user1, issuer;
    const did = "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890";
    const publicKey = "GABC1234567890ABCDEF1234567890ABCDEF1234567890";

    beforeEach(async function () {
        [owner, user1, issuer] = await ethers.getSigners();
        const ContractFactory = await ethers.getContractFactory("StellarDIDRegistry");
        contract = await ContractFactory.deploy();
        await contract.deployed();
        
        // Create a DID for user1 to test interfaces
        await contract.connect(user1).createDID(did, publicKey, "https://example.com");
    });

    describe("ERC-725 (Identity Data Storage)", function () {
        it("Should allow setting and getting generic data", async function () {
            const key = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("testKey"));
            const value = ethers.utils.toUtf8Bytes("testValue");
            
            await expect(contract.connect(user1).setData(key, value))
                .to.emit(contract, "DataChanged")
                .withArgs(key, ethers.utils.hexlify(value));
            
            const result = await contract.connect(user1).getData(key);
            expect(result).to.equal(ethers.utils.hexlify(value));
        });

        it("Should prevent non-owner from setting data", async function () {
            const key = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("testKey"));
            const value = ethers.utils.toUtf8Bytes("testValue");
            
            // Should revert because owner (deployer) has no DID
            await expect(contract.setData(key, value))
                .to.be.revertedWith("No DID found for caller address");
        });
    });

    describe("ERC-735 (Claim Management)", function () {
        const topic = 1; // e.g., Biometric
        const scheme = 1; // e.g., ECDSA
        const data = ethers.utils.toUtf8Bytes("claimData");
        const signature = ethers.utils.toUtf8Bytes("signature");
        const uri = "https://claims.example.com/1";

        it("Should allow adding a claim", async function () {
            await expect(contract.connect(user1).addClaim(topic, scheme, issuer.address, signature, data, uri))
                .to.emit(contract, "ClaimAdded");
            
            const claimIds = await contract.connect(user1).getClaimIdsByTopic(topic);
            expect(claimIds.length).to.equal(1);
            
            const claim = await contract.connect(user1).getClaim(claimIds[0]);
            expect(claim.topic).to.equal(topic);
            expect(claim.issuer).to.equal(issuer.address);
        });

        it("Should allow removing a claim", async function () {
            const tx = await contract.connect(user1).addClaim(topic, scheme, issuer.address, signature, data, uri);
            const receipt = await tx.wait();
            const claimId = receipt.events.find(e => e.event === "ClaimAdded").args.claimId;
            
            await expect(contract.connect(user1).removeClaim(claimId))
                .to.emit(contract, "ClaimRemoved");
            
            const claimIds = await contract.connect(user1).getClaimIdsByTopic(topic);
            expect(claimIds.length).to.equal(0);
        });
    });

    describe("ERC-725 (Execution)", function () {
        it("Should allow owner to execute calls", async function () {
            // Test execution by trying to call a simple function (e.g., getting contract version)
            // In a real scenario, this would be a call to another contract
            const target = contract.address;
            const value = 0;
            const data = contract.interface.encodeFunctionData("getContractInfo");
            
            await expect(contract.connect(user1).execute(0, target, value, data))
                .to.emit(contract, "Executed");
        });
    });
});
