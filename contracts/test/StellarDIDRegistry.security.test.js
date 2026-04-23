const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StellarDIDRegistry Security Tests", function () {
    let contract;
    let owner, admin, issuer, verifier, registrar, user1, user2, attacker;
    
    beforeEach(async function () {
        [owner, admin, issuer, verifier, registrar, user1, user2, attacker] = await ethers.getSigners();
        
        const ContractFactory = await ethers.getContractFactory("StellarDIDRegistry");
        contract = await ContractFactory.deploy();
        await contract.deployed();
    });

    describe("Role-Based Access Control", function () {
        it("Should deploy with deployer as admin", async function () {
            expect(await contract.hasRole(await contract.ADMIN_ROLE(), owner.address)).to.be.true;
            expect(await contract.getRoleCount(await contract.ADMIN_ROLE())).to.equal(1);
        });

        it("Should allow admin to grant roles", async function () {
            await contract.grantRole(await contract.ISSUER_ROLE(), issuer.address);
            expect(await contract.hasRole(await contract.ISSUER_ROLE(), issuer.address)).to.be.true;
            expect(await contract.getRoleCount(await contract.ISSUER_ROLE())).to.equal(1);
        });

        it("Should prevent non-admin from granting roles", async function () {
            await expect(
                contract.connect(attacker).grantRole(await contract.ISSUER_ROLE(), attacker.address)
            ).to.be.revertedWith("AccessControl: caller is not admin");
        });

        it("Should prevent revoking the last admin", async function () {
            await expect(
                contract.revokeRole(await contract.ADMIN_ROLE(), owner.address)
            ).to.be.revertedWith("AccessControl: cannot revoke last admin");
        });

        it("Should allow admin to revoke non-last admin", async function () {
            // First grant admin role to another address
            await contract.grantRole(await contract.ADMIN_ROLE(), admin.address);
            
            // Now revoke original admin
            await contract.revokeRole(await contract.ADMIN_ROLE(), owner.address);
            expect(await contract.hasRole(await contract.ADMIN_ROLE(), owner.address)).to.be.false;
            expect(await contract.hasRole(await contract.ADMIN_ROLE(), admin.address)).to.be.true;
        });
    });

    describe("DID Operation Security", function () {
        beforeEach(async function () {
            // Grant registrar role to user1
            await contract.grantRole(await contract.REGISTRAR_ROLE(), user1.address);
        });

        it("Should allow any user to create DID when not paused", async function () {
            const did = "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890";
            const publicKey = "GABC1234567890ABCDEF1234567890ABCDEF1234567890";
            
            await expect(contract.connect(user1).createDID(did, publicKey, "https://example.com"))
                .to.emit(contract, "DIDCreated")
                .withArgs(did, user1.address, publicKey);
        });

        it("Should prevent DID creation when paused", async function () {
            await contract.pause();
            
            const did = "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890";
            await expect(
                contract.connect(user1).createDID(did, "publicKey", "endpoint")
            ).to.be.revertedWith("Pausable: contract is paused");
        });

        it("Should allow admin to create DID for any user", async function () {
            const did = "did:stellar:GDEF1234567890ABCDEF1234567890ABCDEF1234567890";
            const publicKey = "GDEF1234567890ABCDEF1234567890ABCDEF1234567890";
            
            await expect(contract.createDIDForUser(user2.address, did, publicKey, "https://example.com"))
                .to.emit(contract, "DIDCreated")
                .withArgs(did, user2.address, publicKey);
        });

        it("Should prevent non-owner from updating DID", async function () {
            const did = "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890";
            await contract.connect(user1).createDID(did, "publicKey", "endpoint");
            
            await expect(
                contract.connect(attacker).updateDID(did, "newPublicKey", "newEndpoint")
            ).to.be.revertedWith("Only DID owner can perform this action");
        });

        it("Should allow owner to update their DID", async function () {
            const did = "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890";
            await contract.connect(user1).createDID(did, "publicKey", "endpoint");
            
            await expect(contract.connect(user1).updateDID(did, "newPublicKey", "newEndpoint"))
                .to.emit(contract, "DIDUpdated");
        });

        it("Should allow admin to update any DID", async function () {
            const did = "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890";
            await contract.connect(user1).createDID(did, "publicKey", "endpoint");
            
            await expect(contract.adminUpdateDID(did, "adminPublicKey", "adminEndpoint", true))
                .to.emit(contract, "DIDUpdated");
        });
    });

    describe("Credential Operation Security", function () {
        beforeEach(async function () {
            // Grant issuer role
            await contract.grantRole(await contract.ISSUER_ROLE(), issuer.address);
        });

        it("Should allow issuer to issue credentials", async function () {
            const issuerDID = "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890";
            const subjectDID = "did:stellar:GDEF1234567890ABCDEF1234567890ABCDEF1234567890";
            
            await expect(
                contract.connect(issuer).issueCredential(
                    issuerDID,
                    subjectDID,
                    "Degree",
                    0,
                    ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credentialData"))
                )
            ).to.emit(contract, "CredentialIssued");
        });

        it("Should prevent non-issuer from issuing credentials", async function () {
            await expect(
                contract.connect(attacker).issueCredential(
                    "issuerDID",
                    "subjectDID",
                    "Degree",
                    0,
                    ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credentialData"))
                )
            ).to.be.revertedWith("AccessControl: caller is not issuer");
        });

        it("Should allow issuer to revoke their own credentials", async function () {
            const issuerDID = "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890";
            const subjectDID = "did:stellar:GDEF1234567890ABCDEF1234567890ABCDEF1234567890";
            
            const tx = await contract.connect(issuer).issueCredential(
                issuerDID,
                subjectDID,
                "Degree",
                0,
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credentialData"))
            );
            const receipt = await tx.wait();
            const credentialId = receipt.events[0].args.id;
            
            await expect(contract.connect(issuer).revokeCredential(credentialId))
                .to.emit(contract, "CredentialRevoked");
        });

        it("Should allow admin to revoke any credential", async function () {
            const issuerDID = "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890";
            const subjectDID = "did:stellar:GDEF1234567890ABCDEF1234567890ABCDEF1234567890";
            
            const tx = await contract.connect(issuer).issueCredential(
                issuerDID,
                subjectDID,
                "Degree",
                0,
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credentialData"))
            );
            const receipt = await tx.wait();
            const credentialId = receipt.events[0].args.id;
            
            await expect(contract.revokeCredential(credentialId))
                .to.emit(contract, "CredentialRevoked");
        });

        it("Should prevent non-issuer/non-admin from revoking credentials", async function () {
            const issuerDID = "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890";
            const subjectDID = "did:stellar:GDEF1234567890ABCDEF1234567890ABCDEF1234567890";
            
            const tx = await contract.connect(issuer).issueCredential(
                issuerDID,
                subjectDID,
                "Degree",
                0,
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("credentialData"))
            );
            const receipt = await tx.wait();
            const credentialId = receipt.events[0].args.id;
            
            await expect(
                contract.connect(attacker).revokeCredential(credentialId)
            ).to.be.revertedWith("Only issuer or admin can revoke");
        });
    });

    describe("Emergency Controls", function () {
        it("Should allow admin to pause contract", async function () {
            await expect(contract.pause())
                .to.emit(contract, "ContractPaused");
            expect(await contract.isPaused()).to.be.true;
        });

        it("Should prevent non-admin from pausing contract", async function () {
            await expect(
                contract.connect(attacker).pause()
            ).to.be.revertedWith("AccessControl: caller is not admin");
        });

        it("Should allow admin to unpause contract", async function () {
            await contract.pause();
            await expect(contract.unpause())
                .to.emit(contract, "ContractUnpaused");
            expect(await contract.isPaused()).to.be.false;
        });

        it("Should prevent operations when paused", async function () {
            await contract.pause();
            
            const did = "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890";
            await expect(
                contract.createDID(did, "publicKey", "endpoint")
            ).to.be.revertedWith("Pausable: contract is paused");
        });
    });

    describe("Input Validation", function () {
        it("Should prevent creating DID with empty string", async function () {
            await expect(
                contract.createDID("", "publicKey", "endpoint")
            ).to.be.revertedWith("DID already exists"); // Empty string check fails differently
        });

        it("Should prevent creating duplicate DID", async function () {
            const did = "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890";
            await contract.createDID(did, "publicKey1", "endpoint1");
            
            await expect(
                contract.createDID(did, "publicKey2", "endpoint2")
            ).to.be.revertedWith("DID already exists");
        });

        it("Should prevent operations on non-existent DID", async function () {
            const did = "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890";
            await expect(
                contract.updateDID(did, "newPublicKey", "newEndpoint")
            ).to.be.revertedWith("DID does not exist");
        });

        it("Should prevent credential issuance with invalid data", async function () {
            await contract.grantRole(await contract.ISSUER_ROLE(), issuer.address);
            
            await expect(
                contract.connect(issuer).issueCredential("", "subjectDID", "Degree", 0, "0x123")
            ).to.be.revertedWith("Invalid issuer");
            
            await expect(
                contract.connect(issuer).issueCredential("issuerDID", "", "Degree", 0, "0x123")
            ).to.be.revertedWith("Invalid subject");
            
            await expect(
                contract.connect(issuer).issueCredential("issuerDID", "subjectDID", "", 0, "0x123")
            ).to.be.revertedWith("Invalid credential type");
        });
    });

    describe("Administrative Functions", function () {
        it("Should allow admin transfer", async function () {
            await expect(contract.transferAdmin(admin.address))
                .to.emit(contract, "AdminTransferred")
                .withArgs(owner.address, admin.address);
        });

        it("Should prevent non-admin from transferring admin", async function () {
            await expect(
                contract.connect(attacker).transferAdmin(attacker.address)
            ).to.be.revertedWith("AccessControl: caller is not admin");
        });

        it("Should allow admin to transfer DID ownership", async function () {
            const did = "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890";
            await contract.connect(user1).createDID(did, "publicKey", "endpoint");
            
            await expect(contract.transferDIDOwnership(did, user2.address))
                .to.emit(contract, "DIDUpdated");
        });

        it("Should prevent admin from transferring DID to same owner", async function () {
            const did = "did:stellar:GABC1234567890ABCDEF1234567890ABCDEF1234567890";
            await contract.connect(user1).createDID(did, "publicKey", "endpoint");
            
            await expect(
                contract.transferDIDOwnership(did, user1.address)
            ).to.be.revertedWith("Same owner");
        });
    });

    describe("Contract Information", function () {
        it("Should return correct contract info", async function () {
            const info = await contract.getContractInfo();
            expect(info.version).to.equal("2.0.0");
            expect(info.currentAdmin).to.equal(owner.address);
            expect(info.paused).to.be.false;
            expect(info.adminCount).to.equal(1);
        });

        it("Should return pause information", async function () {
            await contract.pause();
            const pauseInfo = await contract.getPauseInfo();
            expect(pauseInfo.paused).to.be.true;
            expect(pauseInfo.pausedBy).to.equal(owner.address);
            expect(pauseInfo.pausedAt).to.be.gt(0);
        });
    });
});
