const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StateRecovery Contract Tests", function () {
    let stateRecovery;
    let ethereumDIDRegistry;
    let owner, admin, recovery1, recovery2, recovery3, emergency, user1, user2, attacker;
    
    beforeEach(async function () {
        [owner, admin, recovery1, recovery2, recovery3, emergency, user1, user2, attacker] = await ethers.getSigners();
        
        // Deploy EthereumDIDRegistry
        const DIDRegistryFactory = await ethers.getContractFactory("EthereumDIDRegistry");
        ethereumDIDRegistry = await DIDRegistryFactory.deploy();
        await ethereumDIDRegistry.deployed();
        
        // Deploy StateRecovery
        const StateRecoveryFactory = await ethers.getContractFactory("StateRecovery");
        stateRecovery = await StateRecoveryFactory.deploy();
        await stateRecovery.deployed();
        
        // Setup roles
        await stateRecovery.grantRole(await stateRecovery.RECOVERY_ROLE(), recovery1.address);
        await stateRecovery.grantRole(await stateRecovery.RECOVERY_ROLE(), recovery2.address);
        await stateRecovery.grantRole(await stateRecovery.RECOVERY_ROLE(), recovery3.address);
        await stateRecovery.grantRole(await stateRecovery.EMERGENCY_ROLE(), emergency.address);
        await stateRecovery.grantRole(await stateRecovery.GOVERNANCE_ROLE(), admin.address);
        
        // Set target contracts
        await stateRecovery.setTargetContracts(ethereumDIDRegistry.address, ethers.constants.AddressZero);
        
        // Setup DID Registry
        await ethereumDIDRegistry.grantRole(await ethereumDIDRegistry.RECOVERY_ROLE(), stateRecovery.address);
        await ethereumDIDRegistry.setStateRecoveryContract(stateRecovery.address);
    });

    describe("Contract Initialization", function () {
        it("Should deploy with correct roles", async function () {
            expect(await stateRecovery.hasRole(await stateRecovery.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
            expect(await stateRecovery.hasRole(await stateRecovery.RECOVERY_ROLE(), recovery1.address)).to.be.true;
            expect(await stateRecovery.hasRole(await stateRecovery.EMERGENCY_ROLE(), emergency.address)).to.be.true;
            expect(await stateRecovery.hasRole(await stateRecovery.GOVERNANCE_ROLE(), admin.address)).to.be.true;
        });

        it("Should have correct default approval requirements", async function () {
            expect(await stateRecovery.requiredApprovals(0)).to.equal(3); // DID_DOCUMENT
            expect(await stateRecovery.requiredApprovals(1)).to.equal(3); // VERIFIABLE_CREDENTIAL
            expect(await stateRecovery.requiredApprovals(2)).to.equal(5); // OWNERSHIP_MAPPING
            expect(await stateRecovery.requiredApprovals(3)).to.equal(7); // ROLE_ASSIGNMENT
            expect(await stateRecovery.requiredApprovals(4)).to.equal(5); // CROSS_CHAIN_STATE
        });
    });

    describe("State Snapshot Creation", function () {
        it("Should allow recovery role to create state snapshot", async function () {
            const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
            const description = "Test snapshot";
            
            const tx = await stateRecovery.connect(recovery1).createStateSnapshot(merkleRoot, description);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "StateSnapshotCreated");
            
            expect(event.args.snapshotId).to.not.be.null;
            expect(event.args.creator).to.equal(recovery1.address);
            expect(event.args.merkleRoot).to.equal(merkleRoot);
        });

        it("Should prevent non-recovery role from creating snapshot", async function () {
            const merkleRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
            const description = "Test snapshot";
            
            await expect(
                stateRecovery.connect(attacker).createStateSnapshot(merkleRoot, description)
            ).to.be.revertedWith("StateRecovery: caller missing RECOVERY_ROLE");
        });
    });

    describe("Recovery Proposal System", function () {
        const did = "did:ethereum:0x1234567890123456789012345678901234567890";
        const newOwner = user1.address;
        const newPublicKey = "0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890";
        const newServiceEndpoint = "https://recovery.example.com";

        it("Should allow recovery role to propose recovery", async function () {
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [did, newOwner, newPublicKey, newServiceEndpoint]
            );
            
            const tx = await stateRecovery.connect(recovery1).proposeRecovery(
                0, // DID_DOCUMENT
                "Recover corrupted DID document",
                data
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "RecoveryProposed");
            
            expect(event.args.recoveryType).to.equal(0);
            expect(event.args.proposer).to.equal(recovery1.address);
            expect(event.args.description).to.equal("Recover corrupted DID document");
        });

        it("Should prevent non-recovery role from proposing recovery", async function () {
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [did, newOwner, newPublicKey, newServiceEndpoint]
            );
            
            await expect(
                stateRecovery.connect(attacker).proposeRecovery(0, "Test", data)
            ).to.be.revertedWith("StateRecovery: caller missing RECOVERY_ROLE");
        });

        it("Should prevent empty description or data", async function () {
            await expect(
                stateRecovery.connect(recovery1).proposeRecovery(0, "", "0x")
            ).to.be.revertedWith("StateRecovery: description cannot be empty");
            
            await expect(
                stateRecovery.connect(recovery1).proposeRecovery(0, "Test", "0x")
            ).to.be.revertedWith("StateRecovery: recovery data cannot be empty");
        });
    });

    describe("Recovery Voting System", function () {
        let proposalId;
        const did = "did:ethereum:0x1234567890123456789012345678901234567890";
        const newOwner = user1.address;
        const newPublicKey = "0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890";
        const newServiceEndpoint = "https://recovery.example.com";

        beforeEach(async function () {
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [did, newOwner, newPublicKey, newServiceEndpoint]
            );
            
            const tx = await stateRecovery.connect(recovery1).proposeRecovery(
                0, // DID_DOCUMENT
                "Recover corrupted DID document",
                data
            );
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "RecoveryProposed");
            proposalId = event.args.proposalId;
        });

        it("Should allow recovery role to vote on proposal", async function () {
            const tx = await stateRecovery.connect(recovery2).voteOnRecovery(
                proposalId,
                true,
                "Approve for recovery"
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "RecoveryVoted");
            
            expect(event.args.voter).to.equal(recovery2.address);
            expect(event.args.approve).to.be.true;
            expect(event.args.reason).to.equal("Approve for recovery");
        });

        it("Should prevent double voting", async function () {
            await stateRecovery.connect(recovery1).voteOnRecovery(proposalId, true, "First vote");
            
            await expect(
                stateRecovery.connect(recovery1).voteOnRecovery(proposalId, false, "Second vote")
            ).to.be.revertedWith("StateRecovery: already voted");
        });

        it("Should prevent voting after deadline", async function () {
            // Fast forward time beyond voting period
            await ethers.provider.send("evm_increaseTime", [8 * 24 * 60 * 60]); // 8 days
            await ethers.provider.send("evm_mine");
            
            await expect(
                stateRecovery.connect(recovery2).voteOnRecovery(proposalId, true, "Late vote")
            ).to.be.revertedWith("StateRecovery: voting period ended");
        });

        it("Should approve proposal when enough votes are received", async function () {
            // Get enough votes for approval (required: 3 for DID_DOCUMENT)
            await stateRecovery.connect(recovery1).voteOnRecovery(proposalId, true, "Approve 1");
            await stateRecovery.connect(recovery2).voteOnRecovery(proposalId, true, "Approve 2");
            await stateRecovery.connect(recovery3).voteOnRecovery(proposalId, true, "Approve 3");
            
            const proposal = await stateRecovery.getProposal(proposalId);
            expect(proposal.status).to.equal(3); // APPROVED
        });

        it("Should reject proposal when enough rejection votes are received", async function () {
            // Get enough votes for rejection (required: 3 for DID_DOCUMENT)
            await stateRecovery.connect(recovery1).voteOnRecovery(proposalId, false, "Reject 1");
            await stateRecovery.connect(recovery2).voteOnRecovery(proposalId, false, "Reject 2");
            await stateRecovery.connect(recovery3).voteOnRecovery(proposalId, false, "Reject 3");
            
            const proposal = await stateRecovery.getProposal(proposalId);
            expect(proposal.status).to.equal(2); // REJECTED
        });
    });

    describe("Recovery Execution", function () {
        let proposalId;
        const did = "did:ethereum:0x1234567890123456789012345678901234567890";
        const newOwner = user1.address;
        const newPublicKey = "0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890";
        const newServiceEndpoint = "https://recovery.example.com";

        beforeEach(async function () {
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [did, newOwner, newPublicKey, newServiceEndpoint]
            );
            
            const tx = await stateRecovery.connect(recovery1).proposeRecovery(
                0, // DID_DOCUMENT
                "Recover corrupted DID document",
                data
            );
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "RecoveryProposed");
            proposalId = event.args.proposalId;
            
            // Get approval votes
            await stateRecovery.connect(recovery1).voteOnRecovery(proposalId, true, "Approve 1");
            await stateRecovery.connect(recovery2).voteOnRecovery(proposalId, true, "Approve 2");
            await stateRecovery.connect(recovery3).voteOnRecovery(proposalId, true, "Approve 3");
            
            // Enable recovery mode on DID registry
            await ethereumDIDRegistry.enableRecoveryMode();
        });

        it("Should execute approved recovery proposal", async function () {
            // Wait for minimum proposal delay
            await ethers.provider.send("evm_increaseTime", [2 * 60 * 60]); // 2 hours
            await ethers.provider.send("evm_mine");
            
            const tx = await stateRecovery.connect(recovery1).executeRecovery(proposalId);
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "RecoveryExecuted");
            
            expect(event.args.success).to.be.true;
            expect(event.args.result).to.equal("Recovery executed successfully");
            
            // Check proposal status
            const proposal = await stateRecovery.getProposal(proposalId);
            expect(proposal.status).to.equal(4); // EXECUTED
        });

        it("Should prevent execution of non-approved proposal", async function () {
            // Create a new proposal but don't vote on it
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                ["did:ethereum:0x9999999999999999999999999999999999999999", user2.address, newPublicKey, newServiceEndpoint]
            );
            
            const tx = await stateRecovery.connect(recovery1).proposeRecovery(0, "Test", data);
            const receipt = await tx.wait();
            const newProposalId = receipt.events.find(e => e.event === "RecoveryProposed").args.proposalId;
            
            await expect(
                stateRecovery.connect(recovery1).executeRecovery(newProposalId)
            ).to.be.revertedWith("StateRecovery: proposal not approved");
        });

        it("Should prevent execution too early after proposal", async function () {
            await expect(
                stateRecovery.connect(recovery1).executeRecovery(proposalId)
            ).to.be.revertedWith("StateRecovery: too early to execute");
        });
    });

    describe("Emergency Recovery", function () {
        it("Should allow emergency role to trigger immediate recovery", async function () {
            const did = "did:ethereum:0x1234567890123456789012345678901234567890";
            const newOwner = user1.address;
            const newPublicKey = "0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890";
            const newServiceEndpoint = "https://recovery.example.com";
            
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [did, newOwner, newPublicKey, newServiceEndpoint]
            );
            
            // Enable recovery mode
            await ethereumDIDRegistry.enableRecoveryMode();
            
            const tx = await stateRecovery.connect(emergency).emergencyRecovery(
                0, // DID_DOCUMENT
                data,
                "Critical corruption detected"
            );
            
            const receipt = await tx.wait();
            const emergencyEvent = receipt.events.find(e => e.event === "EmergencyRecoveryTriggered");
            const recoveryEvent = receipt.events.find(e => e.event === "RecoveryExecuted");
            
            expect(emergencyEvent.args.triggerer).to.equal(emergency.address);
            expect(emergencyEvent.args.reason).to.equal("Critical corruption detected");
            expect(recoveryEvent.args.success).to.be.true;
        });

        it("Should prevent non-emergency role from triggering emergency recovery", async function () {
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                ["did:ethereum:0x9999999999999999999999999999999999999999", user1.address, "0xABCDEF", "https://test.com"]
            );
            
            await expect(
                stateRecovery.connect(attacker).emergencyRecovery(0, data, "Fake emergency")
            ).to.be.revertedWith("StateRecovery: caller missing EMERGENCY_ROLE");
        });
    });

    describe("Governance Controls", function () {
        it("Should allow governance role to set required approvals", async function () {
            await stateRecovery.connect(admin).setRequiredApprovals(0, 5);
            expect(await stateRecovery.requiredApprovals(0)).to.equal(5);
        });

        it("Should prevent non-governance role from setting required approvals", async function () {
            await expect(
                stateRecovery.connect(attacker).setRequiredApprovals(0, 5)
            ).to.be.revertedWith("StateRecovery: caller missing GOVERNANCE_ROLE");
        });

        it("Should prevent setting zero required approvals", async function () {
            await expect(
                stateRecovery.connect(admin).setRequiredApprovals(0, 0)
            ).to.be.revertedWith("StateRecovery: required approvals must be greater than 0");
        });
    });

    describe("Integration with EthereumDIDRegistry", function () {
        const did = "did:ethereum:0x1234567890123456789012345678901234567890";
        const newOwner = user1.address;
        const newPublicKey = "0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890";
        const newServiceEndpoint = "https://recovery.example.com";

        it("Should successfully recover DID document through governance process", async function () {
            // Enable recovery mode
            await ethereumDIDRegistry.enableRecoveryMode();
            
            // Create and approve recovery proposal
            const data = ethers.utils.defaultAbiCoder.encode(
                ["string", "address", "string", "string"],
                [did, newOwner, newPublicKey, newServiceEndpoint]
            );
            
            const tx = await stateRecovery.connect(recovery1).proposeRecovery(0, "Recover DID", data);
            const receipt = await tx.wait();
            const proposalId = receipt.events.find(e => e.event === "RecoveryProposed").args.proposalId;
            
            // Get approval votes
            await stateRecovery.connect(recovery1).voteOnRecovery(proposalId, true, "Approve");
            await stateRecovery.connect(recovery2).voteOnRecovery(proposalId, true, "Approve");
            await stateRecovery.connect(recovery3).voteOnRecovery(proposalId, true, "Approve");
            
            // Wait for minimum delay
            await ethers.provider.send("evm_increaseTime", [2 * 60 * 60]);
            await ethers.provider.send("evm_mine");
            
            // Execute recovery
            await stateRecovery.connect(recovery1).executeRecovery(proposalId);
            
            // Verify DID document was recovered
            const didDoc = await ethereumDIDRegistry.getDIDDocument(did);
            expect(didDoc.did).to.equal(did);
            expect(didDoc.owner).to.equal(newOwner);
            expect(didDoc.publicKey).to.equal(newPublicKey);
            expect(didDoc.serviceEndpoint).to.equal(newServiceEndpoint);
            expect(didDoc.active).to.be.true;
        });

        it("Should recover verifiable credential", async function () {
            await ethereumDIDRegistry.enableRecoveryMode();
            
            const credentialId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test-credential"));
            const data = ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "string", "string", "string", "uint256", "bytes32"],
                [credentialId, "https://issuer.example.com", "did:example:subject", "VerificationCredential", 1234567890, ethers.utils.keccak256("data")]
            );
            
            const tx = await stateRecovery.connect(recovery1).proposeRecovery(1, "Recover credential", data);
            const receipt = await tx.wait();
            const proposalId = receipt.events.find(e => e.event === "RecoveryProposed").args.proposalId;
            
            // Get approval votes
            await stateRecovery.connect(recovery1).voteOnRecovery(proposalId, true, "Approve");
            await stateRecovery.connect(recovery2).voteOnRecovery(proposalId, true, "Approve");
            await stateRecovery.connect(recovery3).voteOnRecovery(proposalId, true, "Approve");
            
            // Wait for minimum delay
            await ethers.provider.send("evm_increaseTime", [2 * 60 * 60]);
            await ethers.provider.send("evm_mine");
            
            // Execute recovery
            await stateRecovery.connect(recovery1).executeRecovery(proposalId);
            
            // Verify credential was recovered
            const credential = await ethereumDIDRegistry.getCredential(credentialId);
            expect(credential.id).to.equal(credentialId);
            expect(credential.issuer).to.equal("https://issuer.example.com");
            expect(credential.subject).to.equal("did:example:subject");
            expect(credential.credentialType).to.equal("VerificationCredential");
        });
    });

    describe("Access Controls", function () {
        it("Should prevent direct calls to recovery functions", async function () {
            const did = "did:ethereum:0x1234567890123456789012345678901234567890";
            
            await ethereumDIDRegistry.enableRecoveryMode();
            
            await expect(
                ethereumDIDRegistry.connect(recovery1).recoverDIDDocument(did, user1.address, "0xABCDEF", "https://test.com")
            ).to.be.revertedWith("Only recovery contract can call this function");
        });

        it("Should prevent recovery operations when not in recovery mode", async function () {
            await expect(
                stateRecovery.connect(recovery1)._executeRecoveryInternal(0, "0x")
            ).to.be.revertedWith("StateRecovery: internal function only");
        });
    });
});
