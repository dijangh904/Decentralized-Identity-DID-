// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../contracts/optimized/EnhancedDIDRegistry.sol";
import "../contracts/governance/EnhancedDIDGovernanceToken.sol";
import "../contracts/governance/EnhancedDIDGovernor.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title EnhancedSecurityTest
 * @dev Comprehensive test suite demonstrating all security improvements
 * Tests for issues #141-144:
 * #141 - Contract Event Logging
 * #142 - Pausable Contract Pattern  
 * #143 - Contract Reentrancy Protection
 * #144 - Improved Contract Error Handling
 */
contract EnhancedSecurityTest is Test {
    
    // ===== CONTRACT INSTANCES =====
    EnhancedDIDRegistry public didRegistry;
    EnhancedDIDGovernanceToken public governanceToken;
    EnhancedDIDGovernor public governor;
    TimelockController public timelock;
    
    // ===== TEST ADDRESSES =====
    address public owner = address(0x1);
    address public admin = address(0x2);
    address public user1 = address(0x3);
    address public user2 = address(0x4);
    address public attacker = address(0x5);
    address public pauser1 = address(0x6);
    address public pauser2 = address(0x7);
    address public pauser3 = address(0x8);
    
    // ===== TEST CONSTANTS =====
    string public constant DID = "did:stellar:1234567890";
    string public constant PUBLIC_KEY = "public_key_123";
    string public constant SERVICE_ENDPOINT = "https://api.example.com";
    bytes32 public constant CREDENTIAL_ID = bytes32(uint256(1));
    string public constant ISSUER = "did:stellar:issuer";
    string public constant SUBJECT = "did:stellar:subject";
    string public constant CREDENTIAL_TYPE = "VerifiableCredential";
    
    // ===== EVENTS FOR VERIFICATION =====
    event DIDBridged(
        string indexed did,
        address indexed owner,
        string publicKey,
        string serviceEndpoint,
        uint256 timestamp,
        address indexed bridgeOperator
    );
    
    event ContractPaused(
        address indexed pauser,
        uint256 timestamp,
        string reason
    );
    
    event ContractUnpaused(
        address indexed unpauser,
        uint256 timestamp,
        string reason
    );
    
    event TokensMinted(
        address indexed to,
        address indexed minter,
        uint256 amount,
        uint256 totalSupply,
        uint256 timestamp
    );
    
    event ExecutionFailed(
        string indexed did,
        address indexed owner,
        address indexed target,
        uint256 value,
        bytes data,
        string reason,
        uint256 timestamp
    );
    
    function setUp() public {
        // Deploy contracts
        vm.startPrank(owner);
        
        governanceToken = new EnhancedDIDGovernanceToken();
        didRegistry = new EnhancedDIDRegistry();
        
        // Setup timelock
        address[] memory proposers = new address[](1);
        proposers[0] = address(governor);
        address[] memory executors = new address[](1);
        executors[0] = address(governor);
        
        timelock = new TimelockController(
            1 days, // delay
            proposers,
            executors,
            owner
        );
        
        // Deploy governor
        governor = new EnhancedDIDGovernor(
            governanceToken,
            timelock
        );
        
        // Setup roles
        didRegistry.grantRole(didRegistry.ADMIN_ROLE(), admin);
        didRegistry.addPauser(pauser1);
        didRegistry.addPauser(pauser2);
        didRegistry.addPauser(pauser3);
        
        governanceToken.addMinter(admin);
        governanceToken.addPauser(pauser1);
        governanceToken.addPauser(pauser2);
        
        governor.grantEmergencyRole(admin);
        governor.addPauser(pauser1);
        governor.addPauser(pauser2);
        governor.addPauser(pauser3);
        
        // Transfer some tokens to users for voting
        governanceToken.transfer(user1, 1000000 * 10**18);
        governanceToken.transfer(user2, 1000000 * 10**18);
        
        vm.stopPrank();
    }
    
    // ===== TEST #144: IMPROVED ERROR HANDLING =====
    
    /**
     * @dev Test custom error types provide detailed debugging information
     */
    function test_CustomErrorHandling() public {
        vm.startPrank(admin);
        
        // Test DIDAlreadyExists error with detailed info
        didRegistry.bridgeDID(DID, user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedDIDRegistry.DIDAlreadyExists.selector,
                DID,
                user1
            )
        );
        didRegistry.bridgeDID(DID, user2, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Test UnauthorizedDIDOperation error
        vm.stopPrank();
        vm.startPrank(user2);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedDIDRegistry.UnauthorizedDIDOperation.selector,
                user2,
                DID,
                user1
            )
        );
        didRegistry.updateDID(DID, "new_key", SERVICE_ENDPOINT);
        
        // Test InvalidAddress error
        vm.startPrank(admin);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedDIDRegistry.ZeroAddress.selector,
                "address"
            )
        );
        didRegistry.bridgeDID(DID, address(0), PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Test StringTooLong error
        string memory longString = new string(300);
        for (uint i = 0; i < 300; i++) {
            longString = string(abi.encodePacked(longString, "a"));
        }
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedDIDRegistry.StringTooLong.selector,
                "did",
                300,
                256
            )
        );
        didRegistry.bridgeDID(longString, user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test governance token error handling
     */
    function test_GovernanceTokenErrorHandling() public {
        vm.startPrank(admin);
        
        // Test ExceedsMintLimit error
        uint256 largeAmount = 2000000 * 10**18; // 2 million tokens
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedDIDGovernanceToken.ExceedsMintLimit.selector,
                largeAmount,
                1000000 * 10**18
            )
        );
        governanceToken.mint(user1, largeAmount);
        
        // Test InsufficientBalance error
        vm.stopPrank();
        vm.startPrank(user1);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedDIDGovernanceToken.InsufficientBalance.selector,
                user1,
                2000000 * 10**18,
                1000000 * 10**18
            )
        );
        governanceToken.transfer(user2, 2000000 * 10**18);
        
        vm.stopPrank();
    }
    
    // ===== TEST #143: REENTRANCY PROTECTION =====
    
    /**
     * @dev Test reentrancy protection on execute function
     */
    function test_ReentrancyProtection() public {
        // Deploy malicious contract that attempts reentrancy
        vm.startPrank(admin);
        
        // First create a DID for user1
        didRegistry.bridgeDID(DID, user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Deploy malicious contract
        MaliciousContract malicious = new MaliciousContract(address(didRegistry));
        
        // Give malicious contract some ETH to attempt reentrancy
        vm.deal(address(malicious), 1 ether);
        
        // Attempt reentrancy attack - should fail
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedDIDRegistry.ReentrantCall.selector
            )
        );
        malicious.attemptReentrancy{value: 0.1 ether}();
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test reentrancy protection on token operations
     */
    function test_TokenReentrancyProtection() public {
        vm.startPrank(admin);
        
        // Deploy malicious token contract
        MaliciousTokenContract maliciousToken = new MaliciousTokenContract(address(governanceToken));
        
        // Attempt reentrancy during mint
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedDIDGovernanceToken.ReentrantCall.selector
            )
        );
        maliciousToken.attemptReentrancyMint();
        
        vm.stopPrank();
    }
    
    // ===== TEST #142: PAUSABLE CONTRACT PATTERN =====
    
    /**
     * @dev Test multi-sig pause functionality
     */
    function test_MultiSigPause() public {
        // Initiate pause
        vm.startPrank(pauser1);
        didRegistry.initiatePause("Security concern detected");
        
        // Verify pause is not yet active (needs more signatures)
        assertTrue(!didRegistry.paused());
        
        // Add second signature
        vm.stopPrank();
        vm.startPrank(pauser2);
        didRegistry.signPause();
        
        // Add third signature - should activate pause
        vm.stopPrank();
        vm.startPrank(pauser3);
        
        // Fast forward past delay
        vm.warp(block.timestamp + 25 hours);
        
        vm.expectEmit(true, true, true, true);
        emit ContractPaused(pauser3, block.timestamp, "Multi-sig pause activated");
        
        didRegistry.signPause();
        
        // Verify contract is paused
        assertTrue(didRegistry.paused());
        
        // Test operations are blocked when paused
        vm.stopPrank();
        vm.startPrank(admin);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedDIDRegistry.ContractPaused.selector
            )
        );
        didRegistry.bridgeDID("did:stellar:new", user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test emergency pause by admin
     */
    function test_EmergencyPause() public {
        vm.startPrank(admin);
        
        vm.expectEmit(true, true, true, true);
        emit ContractPaused(admin, block.timestamp, "Critical vulnerability detected");
        
        didRegistry.emergencyPause("Critical vulnerability detected");
        
        assertTrue(didRegistry.paused());
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test unpause functionality
     */
    function test_Unpause() public {
        // First pause the contract
        vm.startPrank(admin);
        didRegistry.emergencyPause("Test pause");
        assertTrue(didRegistry.paused());
        
        // Then unpause
        vm.expectEmit(true, true, true, true);
        emit ContractUnpaused(admin, block.timestamp, "Issue resolved");
        
        didRegistry.unpause("Issue resolved");
        
        // Verify operations work again
        didRegistry.bridgeDID("did:stellar:new", user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test governance pause functionality
     */
    function test_GovernancePause() public {
        // Test governor pause
        vm.startPrank(pauser1);
        governor.initiatePause("Governance security concern");
        
        // Add signatures and wait for delay
        vm.stopPrank();
        vm.startPrank(pauser2);
        governor.signPause();
        
        vm.stopPrank();
        vm.startPrank(pauser3);
        vm.warp(block.timestamp + 25 hours);
        
        governor.signPause();
        
        assertTrue(governor.paused());
        
        // Test governance operations are blocked
        vm.stopPrank();
        vm.startPrank(user1);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedDIDGovernor.ContractPaused.selector
            )
        );
        governor.castVote(1, 1); // Should fail when paused
        
        vm.stopPrank();
    }
    
    // ===== TEST #141: COMPREHENSIVE EVENT LOGGING =====
    
    /**
     * @dev Test comprehensive DID events with indexed parameters
     */
    function test_DIDEventLogging() public {
        vm.startPrank(admin);
        
        // Test DIDBridged event with all parameters
        vm.expectEmit(true, true, false, true, false, true);
        emit DIDBridged(
            DID,
            user1,
            PUBLIC_KEY,
            SERVICE_ENDPOINT,
            block.timestamp,
            admin
        );
        
        didRegistry.bridgeDID(DID, user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Test DIDUpdated event
        vm.expectEmit(true, true, true, true, false, true);
        emit EnhancedDIDRegistry.DIDUpdated(
            DID,
            user1,
            block.timestamp,
            block.timestamp + 1,
            "publicKey",
            user1
        );
        
        vm.stopPrank();
        vm.startPrank(user1);
        
        didRegistry.updateDID(DID, "updated_public_key", SERVICE_ENDPOINT);
        
        // Test DIDOwnershipTransferred event
        vm.expectEmit(true, true, true, true);
        emit EnhancedDIDRegistry.DIDOwnershipTransferred(
            DID,
            user1,
            user2,
            block.timestamp
        );
        
        didRegistry.transferDIDOwnership(DID, user2);
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test credential events
     */
    function test_CredentialEventLogging() public {
        vm.startPrank(admin);
        
        // Test CredentialBridged event
        vm.expectEmit(true, true, true, false, false, false, true);
        emit EnhancedDIDRegistry.CredentialBridged(
            CREDENTIAL_ID,
            ISSUER,
            SUBJECT,
            CREDENTIAL_TYPE,
            block.timestamp + 30 days,
            bytes32(0x123),
            block.timestamp
        );
        
        didRegistry.bridgeCredential(
            CREDENTIAL_ID,
            ISSUER,
            SUBJECT,
            CREDENTIAL_TYPE,
            block.timestamp + 30 days,
            bytes32(0x123)
        );
        
        // Test CredentialRevoked event
        vm.expectEmit(true, true, true, true);
        emit EnhancedDIDRegistry.CredentialRevoked(
            CREDENTIAL_ID,
            ISSUER,
            block.timestamp,
            admin
        );
        
        didRegistry.revokeCredential(CREDENTIAL_ID);
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test token events
     */
    function test_TokenEventLogging() public {
        vm.startPrank(admin);
        
        uint256 mintAmount = 100000 * 10**18;
        
        // Test TokensMinted event
        vm.expectEmit(true, true, true, true, true);
        emit TokensMinted(
            user1,
            admin,
            mintAmount,
            governanceToken.totalSupply() + mintAmount,
            block.timestamp
        );
        
        governanceToken.mint(user1, mintAmount);
        
        // Test TransferEnhanced event
        vm.expectEmit(true, true, true, true, false, true);
        emit EnhancedDIDGovernanceToken.TransferEnhanced(
            user1,
            user2,
            user1,
            50000 * 10**18,
            "",
            block.timestamp
        );
        
        vm.stopPrank();
        vm.startPrank(user1);
        
        governanceToken.transfer(user2, 50000 * 10**18);
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test execution events
     */
    function test_ExecutionEventLogging() public {
        vm.startPrank(admin);
        
        // Create DID first
        didRegistry.bridgeDID(DID, user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Test ExecutionFailed event
        vm.stopPrank();
        vm.startPrank(user1);
        
        vm.expectEmit(true, true, true, true, true, true, true);
        emit ExecutionFailed(
            DID,
            user1,
            address(0xdead),
            0,
            abi.encodeWithSignature("nonExistentFunction()"),
            "Transaction reverted silently",
            block.timestamp
        );
        
        // This should fail and emit ExecutionFailed
        didRegistry.execute(
            1,
            address(0xdead), // Non-existent contract
            0,
            abi.encodeWithSignature("nonExistentFunction()")
        );
        
        vm.stopPrank();
    }
    
    // ===== INTEGRATION TESTS =====
    
    /**
     * @dev Test complete security workflow
     */
    function test_CompleteSecurityWorkflow() public {
        // 1. Normal operations work
        vm.startPrank(admin);
        didRegistry.bridgeDID(DID, user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // 2. Events are properly emitted
        vm.expectEmit(true, true, true, true);
        emit EnhancedDIDRegistry.DIDOwnershipTransferred(
            DID,
            user1,
            user2,
            block.timestamp
        );
        
        vm.stopPrank();
        vm.startPrank(user1);
        didRegistry.transferDIDOwnership(DID, user2);
        
        // 3. Multi-sig pause works
        vm.startPrank(pauser1);
        didRegistry.initiatePause("Security audit");
        
        vm.stopPrank();
        vm.startPrank(pauser2);
        didRegistry.signPause();
        
        vm.stopPrank();
        vm.startPrank(pauser3);
        vm.warp(block.timestamp + 25 hours);
        didRegistry.signPause();
        
        // 4. Operations are blocked when paused
        assertTrue(didRegistry.paused());
        
        vm.stopPrank();
        vm.startPrank(admin);
        vm.expectRevert(EnhancedDIDRegistry.ContractPaused.selector);
        didRegistry.bridgeDID("did:stellar:new", user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // 5. Unpause restores functionality
        didRegistry.unpause("Audit complete");
        assertFalse(didRegistry.paused());
        
        // 6. Operations work again
        didRegistry.bridgeDID("did:stellar:new", user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        vm.stopPrank();
    }
    
    /**
     * @dev Test error handling provides debugging info
     */
    function test_DebuggingInformation() public {
        vm.startPrank(admin);
        
        // Create initial DID
        didRegistry.bridgeDID(DID, user1, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Try to create duplicate - error includes DID and current owner
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedDIDRegistry.DIDAlreadyExists.selector,
                DID,
                user1
            )
        );
        didRegistry.bridgeDID(DID, user2, PUBLIC_KEY, SERVICE_ENDPOINT);
        
        // Try unauthorized operation - error includes caller, DID, and owner
        vm.stopPrank();
        vm.startPrank(user2);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                EnhancedDIDRegistry.UnauthorizedDIDOperation.selector,
                user2,
                DID,
                user1
            )
        );
        didRegistry.updateDID(DID, "new_key", SERVICE_ENDPOINT);
        
        vm.stopPrank();
    }
}

/**
 * @title MaliciousContract
 * @dev Contract to test reentrancy protection
 */
contract MaliciousContract {
    EnhancedDIDRegistry public target;
    uint256 public attackCount;
    
    constructor(address _target) {
        target = EnhancedDIDRegistry(_target);
    }
    
    function attemptReentrancy() external payable {
        attackCount++;
        // Attempt to call back into the contract
        target.execute(
            1,
            address(this),
            0,
            abi.encodeWithSignature("callback()")
        );
    }
    
    function callback() external {
        if (attackCount < 3) {
            // Try reentrancy again
            target.execute(
                1,
                address(this),
                0,
                abi.encodeWithSignature("callback()")
            );
        }
    }
    
    receive() external payable {}
}

/**
 * @title MaliciousTokenContract
 * @dev Contract to test token reentrancy protection
 */
contract MaliciousTokenContract {
    EnhancedDIDGovernanceToken public target;
    uint256 public attackCount;
    
    constructor(address _target) {
        target = EnhancedDIDGovernanceToken(_target);
    }
    
    function attemptReentrancyMint() external {
        attackCount++;
        target.mint(address(this), 100 * 10**18);
    }
    
    receive() external payable {
        if (attackCount < 3) {
            target.mint(address(this), 100 * 10**18);
        }
    }
}
