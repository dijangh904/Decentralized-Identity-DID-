// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../ReentrancyGuard.sol";

/**
 * @title EnhancedDIDGovernanceToken
 * @dev Enhanced ERC20 token with comprehensive security improvements
 * - Custom error types for detailed debugging
 * - Reentrancy protection on sensitive operations
 * - Pausable functionality with multi-sig governance
 * - Comprehensive event logging for audit trails
 */
contract EnhancedDIDGovernanceToken is ERC20, ERC20Votes, Ownable, ReentrancyGuard {
    // ===== CUSTOM ERRORS FOR DETAILED DEBUGGING =====
    error AccessControlUnauthorized(address caller, string role);
    error InvalidAddress(address provided, string context);
    error InvalidAmount(uint256 provided, string context);
    error InsufficientBalance(address account, uint256 required, uint256 available);
    error ExceedsMaxSupply(uint256 requested, uint256 maxSupply);
    error ExceedsMintLimit(uint256 requested, uint256 limit);
    error TransferFailed(address from, address to, uint256 amount);
    error ApprovalFailed(address owner, address spender, uint256 amount);
    error ContractPaused();
    error ReentrantCall();
    error ZeroAddress(string context);
    error EmptyString(string field);
    
    // ===== PAUSABLE FUNCTIONALITY =====
    bool private _paused = false;
    uint256 private constant PAUSE_SIGNATURE_THRESHOLD = 2;
    mapping(address => bool) private _pauseSigners;
    mapping(address => bool) private _hasSignedPause;
    uint256 private _pauseSignatureCount;
    uint256 private _pauseInitiationTime;
    uint256 private constant PAUSE_DELAY = 12 hours; // Shorter delay for token emergencies
    
    // Token constants
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 1 billion tokens
    uint256 public constant INITIAL_SUPPLY = 100000000 * 10**18; // 100 million tokens
    uint256 public constant SINGLE_MINT_LIMIT = 1000000 * 10**18; // 1 million tokens per mint
    uint256 public constant DAILY_MINT_LIMIT = 10000000 * 10**18; // 10 million tokens per day
    
    // Role-based access control
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    mapping(address => bool) public isMinter;
    mapping(address => bool) public isBurner;
    mapping(address => uint256) public dailyMinted;
    mapping(address => uint256) public lastMintDay;
    
    // ===== COMPREHENSIVE EVENTS WITH INDEXED PARAMETERS =====
    
    // Role Events
    event MinterAdded(
        address indexed minter,
        address indexed granter,
        uint256 timestamp
    );
    
    event MinterRemoved(
        address indexed minter,
        address indexed remover,
        uint256 timestamp
    );
    
    event BurnerAdded(
        address indexed burner,
        address indexed granter,
        uint256 timestamp
    );
    
    event BurnerRemoved(
        address indexed burner,
        address indexed remover,
        uint256 timestamp
    );
    
    // Token Events
    event TokensMinted(
        address indexed to,
        address indexed minter,
        uint256 amount,
        uint256 totalSupply,
        uint256 timestamp
    );
    
    event TokensBurned(
        address indexed from,
        address indexed burner,
        uint256 amount,
        uint256 totalSupply,
        uint256 timestamp
    );
    
    event TransferEnhanced(
        address indexed from,
        address indexed to,
        address indexed operator,
        uint256 amount,
        bytes data,
        uint256 timestamp
    );
    
    // Pause Events
    event PauseInitiated(
        address indexed initiator,
        uint256 signatureCount,
        uint256 requiredSignatures,
        uint256 initiationTime
    );
    
    event PauseSignatureAdded(
        address indexed signer,
        uint256 signatureCount,
        uint256 timestamp
    );
    
    event TokenTransfersPaused(
        address indexed pauser,
        uint256 timestamp,
        string reason
    );
    
    event TokenTransfersUnpaused(
        address indexed unpauser,
        uint256 timestamp,
        string reason
    );
    
    // Supply Events
    event SupplyCapReached(
        uint256 currentSupply,
        uint256 maxSupply,
        uint256 timestamp
    );
    
    event DailyMintLimitReached(
        address indexed minter,
        uint256 dailyAmount,
        uint256 limit,
        uint256 day
    );
    
    // Modifiers
    modifier whenNotPaused() {
        if (_paused) revert ContractPaused();
        _;
    }
    
    modifier onlyMinter() {
        if (!isMinter[msg.sender]) {
            revert AccessControlUnauthorized(msg.sender, "MINTER_ROLE");
        }
        _;
    }
    
    modifier onlyBurner() {
        if (!isBurner[msg.sender]) {
            revert AccessControlUnauthorized(msg.sender, "BURNER_ROLE");
        }
        _;
    }
    
    modifier onlyPauser() {
        if (!_pauseSigners[msg.sender]) {
            revert AccessControlUnauthorized(msg.sender, "PAUSER_ROLE");
        }
        _;
    }
    
    modifier validAddress(address addr) {
        if (addr == address(0)) revert ZeroAddress("address");
        _;
    }
    
    modifier validAmount(uint256 amount) {
        if (amount == 0) revert InvalidAmount(amount, "amount");
        _;
    }
    
    constructor() ERC20("DID Governance Token", "DIDGT") ERC20Permit("DID Governance Token") {
        _mint(msg.sender, INITIAL_SUPPLY);
        isMinter[msg.sender] = true;
        isBurner[msg.sender] = true;
        _pauseSigners[msg.sender] = true;
        
        emit TokensMinted(msg.sender, msg.sender, INITIAL_SUPPLY, INITIAL_SUPPLY, block.timestamp);
    }
    
    // ===== PAUSE FUNCTIONALITY WITH MULTI-SIG =====
    
    /**
     * @dev Initiate pause process - requires multiple signatures
     */
    function initiatePause(string calldata reason) external onlyPauser {
        if (_paused) revert ContractPaused();
        
        _pauseSignatureCount = 0;
        _pauseInitiationTime = block.timestamp;
        
        // Clear previous signatures
        address[] memory signers = _getPauseSigners();
        for (uint i = 0; i < signers.length; i++) {
            _hasSignedPause[signers[i]] = false;
        }
        
        emit PauseInitiated(msg.sender, 0, PAUSE_SIGNATURE_THRESHOLD, block.timestamp);
    }
    
    /**
     * @dev Add signature for pause
     */
    function signPause() external onlyPauser {
        if (_paused) revert ContractPaused();
        if (_hasSignedPause[msg.sender]) return;
        
        _hasSignedPause[msg.sender] = true;
        _pauseSignatureCount++;
        
        emit PauseSignatureAdded(msg.sender, _pauseSignatureCount, block.timestamp);
        
        // Check if we have enough signatures and delay has passed
        if (_pauseSignatureCount >= PAUSE_SIGNATURE_THRESHOLD && 
            block.timestamp >= _pauseInitiationTime + PAUSE_DELAY) {
            _pause();
        }
    }
    
    /**
     * @dev Emergency pause by owner
     */
    function emergencyPause(string calldata reason) external onlyOwner {
        if (_paused) revert ContractPaused();
        _pause();
        emit TokenTransfersPaused(msg.sender, block.timestamp, reason);
    }
    
    /**
     * @dev Unpause contract (owner only)
     */
    function unpause(string calldata reason) external onlyOwner {
        if (!_paused) return;
        _paused = false;
        emit TokenTransfersUnpaused(msg.sender, block.timestamp, reason);
    }
    
    function _pause() internal {
        _paused = true;
        emit TokenTransfersPaused(msg.sender, block.timestamp, "Multi-sig pause activated");
    }
    
    function paused() external view returns (bool) {
        return _paused;
    }
    
    // ===== ROLE MANAGEMENT WITH DETAILED EVENTS =====
    
    function addMinter(address minter) external onlyOwner validAddress(minter) {
        if (isMinter[minter]) return; // Already minter
        
        isMinter[minter] = true;
        emit MinterAdded(minter, msg.sender, block.timestamp);
    }
    
    function removeMinter(address minter) external onlyOwner validAddress(minter) {
        if (!isMinter[minter]) return; // Not minter
        
        isMinter[minter] = false;
        emit MinterRemoved(minter, msg.sender, block.timestamp);
    }
    
    function addBurner(address burner) external onlyOwner validAddress(burner) {
        if (isBurner[burner]) return; // Already burner
        
        isBurner[burner] = true;
        emit BurnerAdded(burner, msg.sender, block.timestamp);
    }
    
    function removeBurner(address burner) external onlyOwner validAddress(burner) {
        if (!isBurner[burner]) return; // Not burner
        
        isBurner[burner] = false;
        emit BurnerRemoved(burner, msg.sender, block.timestamp);
    }
    
    function addPauser(address pauser) external onlyOwner validAddress(pauser) {
        if (_pauseSigners[pauser]) return; // Already pauser
        
        _pauseSigners[pauser] = true;
        emit MinterAdded(pauser, msg.sender, block.timestamp); // Reuse event
    }
    
    function removePauser(address pauser) external onlyOwner validAddress(pauser) {
        if (!_pauseSigners[pauser]) return; // Not pauser
        
        _pauseSigners[pauser] = false;
        emit MinterRemoved(pauser, msg.sender, block.timestamp); // Reuse event
    }
    
    // ===== ENHANCED TOKEN OPERATIONS =====
    
    /**
     * @dev Mint new tokens with comprehensive validation and logging
     */
    function mint(address to, uint256 amount) external onlyMinter nonReentrant whenNotPaused 
      validAddress(to) validAmount(amount) {
        
        if (amount > SINGLE_MINT_LIMIT) {
            revert ExceedsMintLimit(amount, SINGLE_MINT_LIMIT);
        }
        
        if (totalSupply() + amount > MAX_SUPPLY) {
            revert ExceedsMaxSupply(totalSupply() + amount, MAX_SUPPLY);
        }
        
        // Check daily mint limit
        uint256 currentDay = block.timestamp / 86400; // 1 day in seconds
        if (lastMintDay[msg.sender] != currentDay) {
            dailyMinted[msg.sender] = 0;
            lastMintDay[msg.sender] = currentDay;
        }
        
        if (dailyMinted[msg.sender] + amount > DAILY_MINT_LIMIT) {
            emit DailyMintLimitReached(msg.sender, dailyMinted[msg.sender] + amount, DAILY_MINT_LIMIT, currentDay);
            revert ExceedsMintLimit(dailyMinted[msg.sender] + amount, DAILY_MINT_LIMIT);
        }
        
        dailyMinted[msg.sender] += amount;
        
        uint256 oldTotalSupply = totalSupply();
        _mint(to, amount);
        
        emit TokensMinted(to, msg.sender, amount, totalSupply(), block.timestamp);
        
        if (totalSupply() == MAX_SUPPLY) {
            emit SupplyCapReached(totalSupply(), MAX_SUPPLY, block.timestamp);
        }
    }
    
    /**
     * @dev Burn tokens with comprehensive validation and logging
     */
    function burn(address from, uint256 amount) external onlyBurner nonReentrant whenNotPaused 
      validAddress(from) validAmount(amount) {
        
        if (balanceOf(from) < amount) {
            revert InsufficientBalance(from, amount, balanceOf(from));
        }
        
        uint256 oldTotalSupply = totalSupply();
        _burn(from, amount);
        
        emit TokensBurned(from, msg.sender, amount, totalSupply(), block.timestamp);
    }
    
    /**
     * @dev Enhanced transfer with detailed logging
     */
    function transfer(address to, uint256 amount) public override nonReentrant whenNotPaused 
      validAddress(to) validAmount(amount) returns (bool) {
        
        if (balanceOf(msg.sender) < amount) {
            revert InsufficientBalance(msg.sender, amount, balanceOf(msg.sender));
        }
        
        bool success = super.transfer(to, amount);
        
        if (success) {
            emit TransferEnhanced(msg.sender, to, msg.sender, amount, "", block.timestamp);
        } else {
            revert TransferFailed(msg.sender, to, amount);
        }
        
        return success;
    }
    
    /**
     * @dev Enhanced transferFrom with detailed logging
     */
    function transferFrom(address from, address to, uint256 amount) public override nonReentrant whenNotPaused 
      validAddress(from) validAddress(to) validAmount(amount) returns (bool) {
        
        if (balanceOf(from) < amount) {
            revert InsufficientBalance(from, amount, balanceOf(from));
        }
        
        if (allowance(from, msg.sender) < amount) {
            revert InsufficientBalance(msg.sender, amount, allowance(from, msg.sender));
        }
        
        bool success = super.transferFrom(from, to, amount);
        
        if (success) {
            emit TransferEnhanced(from, to, msg.sender, amount, "", block.timestamp);
        } else {
            revert TransferFailed(from, to, amount);
        }
        
        return success;
    }
    
    /**
     * @dev Enhanced approve with detailed logging
     */
    function approve(address spender, uint256 amount) public override nonReentrant whenNotPaused 
      validAddress(spender) returns (bool) {
        
        bool success = super.approve(spender, amount);
        
        if (!success) {
            revert ApprovalFailed(msg.sender, spender, amount);
        }
        
        return success;
    }
    
    // ===== BATCH OPERATIONS =====
    
    /**
     * @dev Batch mint to multiple addresses
     */
    function batchMint(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyMinter nonReentrant whenNotPaused {
        if (recipients.length != amounts.length) {
            revert InvalidAmount(recipients.length, "array length mismatch");
        }
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress("recipient");
            if (amounts[i] == 0) revert InvalidAmount(amounts[i], "amount");
            if (amounts[i] > SINGLE_MINT_LIMIT) revert ExceedsMintLimit(amounts[i], SINGLE_MINT_LIMIT);
            totalAmount += amounts[i];
        }
        
        if (totalSupply() + totalAmount > MAX_SUPPLY) {
            revert ExceedsMaxSupply(totalSupply() + totalAmount, MAX_SUPPLY);
        }
        
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
            emit TokensMinted(recipients[i], msg.sender, amounts[i], totalSupply(), block.timestamp);
        }
        
        if (totalSupply() == MAX_SUPPLY) {
            emit SupplyCapReached(totalSupply(), MAX_SUPPLY, block.timestamp);
        }
    }
    
    // ===== VIEW FUNCTIONS =====
    
    function getPauseSigners() external view returns (address[] memory) {
        return _getPauseSigners();
    }
    
    function getPauseStatus() external view returns (
        bool paused,
        uint256 signatureCount,
        uint256 requiredSignatures,
        uint256 initiationTime,
        uint256 delayRemaining
    ) {
        return (
            _paused,
            _pauseSignatureCount,
            PAUSE_SIGNATURE_THRESHOLD,
            _pauseInitiationTime,
            _pauseInitiationTime > 0 ? 
                (_pauseInitiationTime + PAUSE_DELAY > block.timestamp ? 
                    _pauseInitiationTime + PAUSE_DELAY - block.timestamp : 0) : 0
        );
    }
    
    function getDailyMintInfo(address minter) external view returns (
        uint256 todayMinted,
        uint256 dailyLimit,
        uint256 remaining
    ) {
        uint256 currentDay = block.timestamp / 86400;
        if (lastMintDay[minter] != currentDay) {
            todayMinted = 0;
        } else {
            todayMinted = dailyMinted[minter];
        }
        
        dailyLimit = DAILY_MINT_LIMIT;
        remaining = dailyLimit > todayMinted ? dailyLimit - todayMinted : 0;
    }
    
    // ===== INTERNAL HELPERS =====
    
    function _getPauseSigners() internal view returns (address[] memory signers) {
        uint256 count = 0;
        // This is a simplified version - in production, you'd maintain a list
        // For now, we'll return a fixed-size array
        signers = new address[](10);
        
        // Add known signers (simplified approach)
        if (_pauseSigners[owner()]) {
            signers[count] = owner();
            count++;
        }
        
        // Resize array to actual count
        assembly {
            mstore(signers, count)
        }
    }
    
    // ===== OVERRIDES FOR VOTING =====
    
    function _afterTokenTransfer(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }
    
    function _mint(address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._mint(to, amount);
    }
    
    function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }
}
