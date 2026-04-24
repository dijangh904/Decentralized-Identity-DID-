const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DID Governance System", function () {
    let governanceToken;
    let timelock;
    let governor;
    let governanceProxy;
    let proxyAdmin;
    let didRegistry;
    let didProxy;
    
    let deployer, proposer, executor, voter1, voter2, voter3;
    
    const VOTING_DELAY = 1 * 24 * 60 * 60; // 1 day
    const VOTING_PERIOD = 7 * 24 * 60 * 60; // 7 days
    const MIN_DELAY = 2 * 24 * 60 * 60; // 2 days
    
    beforeEach(async function () {
        [deployer, proposer, executor, voter1, voter2, voter3] = await ethers.getSigners();
        
        // Deploy Governance Token
        const DIDGovernanceToken = await ethers.getContractFactory("DIDGovernanceToken");
        governanceToken = await DIDGovernanceToken.deploy();
        await governanceToken.deployed();
        
        // Deploy Timelock
        const DIDTimelock = await ethers.getContractFactory("DIDTimelock");
        timelock = await DIDTimelock.deploy(
            MIN_DELAY,
            [proposer.address],
            [executor.address],
            deployer.address
        );
        await timelock.deployed();
        
        // Deploy Governor
        const DIDGovernor = await ethers.getContractFactory("DIDGovernor");
        governor = await DIDGovernor.deploy(governanceToken.address, timelock.address);
        await governor.deployed();
        
        // Deploy Governance Proxy
        const GovernanceProxy = await ethers.getContractFactory("GovernanceProxy");
        governanceProxy = await GovernanceProxy.deploy(
            governor.address,
            timelock.address,
            deployer.address
        );
        await governanceProxy.deployed();
        
        // Deploy Proxy Admin
        const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
        proxyAdmin = await ProxyAdmin.deploy();
        await proxyAdmin.deployed();
        
        // Deploy DID Registry Implementation
        const DIDRegistry = await ethers.getContractFactory("EthereumDIDRegistry");
        didRegistry = await DIDRegistry.deploy();
        await didRegistry.deployed();
        
        // Deploy DID Proxy
        const DIDProxy = await ethers.getContractFactory("DIDProxy");
        didProxy = await DIDProxy.deploy();
        await didProxy.deployed();
        
        // Initialize DID Proxy
        await didProxy.initialize(didRegistry.address);
        
        // Setup governance permissions
        const proposerRole = await timelock.PROPOSER_ROLE();
        const executorRole = await timelock.EXECUTOR_ROLE();
        const adminRole = await timelock.TIMELOCK_ADMIN_ROLE();
        
        await timelock.grantRole(proposerRole, governor.address);
        await timelock.grantRole(executorRole, governor.address);
        await timelock.grantRole(adminRole, deployer.address);
        
        // Set governance proxy in proxy admin
        await proxyAdmin.setGovernanceProxy(governanceProxy.address);
        
        // Enable governance control for DID proxy
        await proxyAdmin.setGovernanceControl(didProxy.address, true);
        
        // Transfer DID proxy ownership to proxy admin
        await didProxy.transferOwnership(proxyAdmin.address);
        
        // Distribute tokens and delegate voting power
        const tokenAmount = ethers.utils.parseEther("1000000");
        for (const voter of [voter1, voter2, voter3]) {
            await governanceToken.mint(voter.address, tokenAmount);
            await governanceToken.connect(voter).delegate(voter.address);
        }
    });
    
    describe("Governance Token", function () {
        it("Should have correct initial supply", async function () {
            const totalSupply = await governanceToken.totalSupply();
            expect(totalSupply).to.equal(ethers.utils.parseEther("100000000"));
        });
        
        it("Should allow minting by authorized minters", async function () {
            const amount = ethers.utils.parseEther("1000");
            await governanceToken.mint(voter1.address, amount);
            expect(await governanceToken.balanceOf(voter1.address)).to.equal(
                ethers.utils.parseEther("1001000")
            );
        });
        
        it("Should not allow unauthorized minting", async function () {
            const amount = ethers.utils.parseEther("1000");
            await expect(
                governanceToken.connect(voter1).mint(voter2.address, amount)
            ).to.be.revertedWith("Not authorized to mint");
        });
    });
    
    describe("Governor", function () {
        it("Should have correct voting parameters", async function () {
            expect(await governor.votingDelay()).to.equal(VOTING_DELAY);
            expect(await governor.votingPeriod()).to.equal(VOTING_PERIOD);
            expect(await governor.proposalThreshold()).to.equal(
                ethers.utils.parseEther("1000000")
            );
        });
        
        it("Should allow proposal creation with sufficient voting power", async function () {
            const targets = [timelock.address];
            const values = [0];
            const signatures = [""];
            const calldatas = [
                ethers.utils.defaultAbiCoder.encode(
                    ["address", "address"],
                    [didProxy.address, didRegistry.address]
                )
            ];
            const description = "Upgrade DID Registry";
            
            const proposalId = await governor.callStatic.propose(
                targets, values, signatures, calldatas, description
            );
            
            await governor.propose(targets, values, signatures, calldatas, description);
            
            expect(await governor.state(proposalId)).to.equal(0); // Pending
        });
        
        it("Should not allow proposal creation with insufficient voting power", async function () {
            const targets = [timelock.address];
            const values = [0];
            const signatures = [""];
            const calldatas = ["0x"];
            const description = "Test proposal";
            
            await expect(
                governor.connect(voter1).propose(targets, values, signatures, calldatas, description)
            ).to.be.revertedWith("Governor: proposer votes below proposal threshold");
        });
    });
    
    describe("Contract Upgrade Process", function () {
        it("Should successfully execute a contract upgrade through governance", async function () {
            // Deploy new implementation
            const DIDRegistryV2 = await ethers.getContractFactory("EthereumDIDRegistry");
            const newImplementation = await DIDRegistryV2.deploy();
            await newImplementation.deployed();
            
            // Create proposal
            const proposalId = await governor.callStatic.proposeContractUpgrade(
                didProxy.address,
                newImplementation.address,
                "Upgrade DID Registry to V2"
            );
            
            await governor.proposeContractUpgrade(
                didProxy.address,
                newImplementation.address,
                "Upgrade DID Registry to V2"
            );
            
            // Fast forward past voting delay
            await time.increase(VOTING_DELAY + 1);
            
            // Cast votes
            await governor.connect(voter1).castVote(proposalId, 1); // For
            await governor.connect(voter2).castVote(proposalId, 1); // For
            await governor.connect(voter3).castVote(proposalId, 1); // For
            
            // Fast forward past voting period
            await time.increase(VOTING_PERIOD + 1);
            
            // Queue proposal
            await governor.queue(
                [timelock.address],
                [0],
                [""],
                [ethers.utils.defaultAbiCoder.encode(
                    ["address", "address"],
                    [didProxy.address, newImplementation.address]
                )],
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Upgrade DID Registry to V2"))
            );
            
            // Fast forward past timelock delay
            await time.increase(MIN_DELAY + 1);
            
            // Execute proposal
            await governor.execute(
                [timelock.address],
                [0],
                [""],
                [ethers.utils.defaultAbiCoder.encode(
                    ["address", "address"],
                    [didProxy.address, newImplementation.address]
                )],
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Upgrade DID Registry to V2"))
            );
            
            // Verify upgrade
            const currentImplementation = await governanceProxy.getProxyImplementation(didProxy.address);
            expect(currentImplementation).to.equal(newImplementation.address);
        });
        
        it("Should prevent direct upgrades when governance control is enabled", async function () {
            const DIDRegistryV2 = await ethers.getContractFactory("EthereumDIDRegistry");
            const newImplementation = await DIDRegistryV2.deploy();
            await newImplementation.deployed();
            
            await expect(
                proxyAdmin.upgrade(didProxy, newImplementation.address)
            ).to.be.revertedWith("Upgrade must go through governance or owner");
        });
    });
    
    describe("Emergency Actions", function () {
        it("Should allow emergency actions by authorized parties", async function () {
            // Grant emergency role to deployer
            const EMERGENCY_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EMERGENCY_ROLE"));
            await governor.grantRole(EMERGENCY_ROLE, deployer.address);
            
            const targets = [timelock.address];
            const values = [0];
            const signatures = [""];
            const calldatas = ["0x"];
            const description = "Emergency pause";
            
            const proposalId = await governor.callStatic.proposeEmergencyAction(
                timelock.address,
                "0x",
                description
            );
            
            await governor.proposeEmergencyAction(
                timelock.address,
                "0x",
                description
            );
            
            expect(await governor.state(proposalId)).to.equal(0); // Pending
        });
    });
    
    describe("Timelock", function () {
        it("Should enforce minimum delay", async function () {
            await expect(
                timelock.updateDelay(1) // Less than minimum
            ).to.be.revertedWith("Invalid delay");
        });
        
        it("Should allow delay updates within valid range", async function () {
            const newDelay = 3 * 24 * 60 * 60; // 3 days
            await timelock.updateDelay(newDelay);
            expect(await timelock.getMinDelay()).to.equal(newDelay);
        });
    });
});
