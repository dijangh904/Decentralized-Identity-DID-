// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../access/EnhancedAccessControl.sol";

/**
 * @title UpgradeableProxyFactory
 * @dev Factory contract for creating and managing upgradeable DID registry proxies
 * 
 * This contract provides a centralized way to create upgradeable proxies with
 * standardized initialization and governance controls. It ensures all proxies
 * follow the same security patterns and upgrade procedures.
 * 
 * Key Features:
 * - Standardized proxy creation
 * - Access control integration
 * - Proxy registry for tracking
 * - Batch proxy creation
 * - Emergency controls
 * - Upgrade coordination
 * 
 * @author Fatima Sanusi
 * @notice Use this contract to create upgradeable DID registry proxies
 */
contract UpgradeableProxyFactory is Ownable {
    
    // ===== STORAGE VARIABLES =====
    
    /// @notice Access control contract for permissions
    EnhancedAccessControl public immutable accessControl;
    
    /// @notice Registry of all created proxies
    mapping(address => bool) public isRegisteredProxy;
    
    /// @notice Array of all proxy addresses
    address[] public proxyRegistry;
    
    /// @notice Mapping of proxy to implementation
    mapping(address => address) public proxyToImplementation;
    
    /// @notice Mapping of proxy to creator
    mapping(address => address) public proxyToCreator;
    
    /// @notice Emergency pause status
    bool public emergencyPaused;
    
    /// @notice Minimum implementation delay
    uint256 public minImplementationDelay;
    
    // ===== EVENTS =====
    
    /// @notice Emitted when a new proxy is created
    event ProxyCreated(
        address indexed proxy,
        address indexed implementation,
        address indexed creator,
        uint256 timestamp
    );
    
    /// @notice Emitted when a proxy is upgraded
    event ProxyUpgraded(
        address indexed proxy,
        address indexed oldImplementation,
        address indexed newImplementation,
        address upgradedBy
    );
    
    /// @notice Emitted when factory is emergency paused
    event EmergencyPaused(address indexed pausedBy, string reason);
    
    /// @notice Emitted when factory is unpaused
    event EmergencyUnpaused(address indexed unpausedBy);
    
    // ===== MODIFIERS =====
    
    /// @notice Restricts access when factory is paused
    modifier whenNotPaused() {
        require(!emergencyPaused, "UpgradeableProxyFactory: emergency paused");
        _;
    }
    
    /// @notice Restricts access to authorized creators
    modifier onlyAuthorizedCreator() {
        require(
            accessControl.checkPermission(msg.sender, ResourceType.SYSTEM, OperationType.CREATE),
            "UpgradeableProxyFactory: unauthorized creator"
        );
        _;
    }
    
    /// @notice Validates implementation address
    modifier validImplementation(address implementation) {
        require(implementation != address(0), "UpgradeableProxyFactory: invalid implementation");
        require(implementation.code.length > 0, "UpgradeableProxyFactory: implementation not contract");
        _;
    }
    
    // ===== CONSTRUCTOR =====
    
    constructor(address _accessControl, uint256 _minImplementationDelay) {
        require(_accessControl != address(0), "UpgradeableProxyFactory: invalid access control");
        accessControl = EnhancedAccessControl(_accessControl);
        minImplementationDelay = _minImplementationDelay;
    }
    
    // ===== PROXY CREATION =====
    
    /**
     * @notice Creates a new upgradeable proxy
     * @param implementation The implementation contract address
     * @param data Initialization data
     * @return proxy The created proxy address
     */
    function createProxy(
        address implementation,
        bytes memory data
    ) external 
        onlyAuthorizedCreator 
        whenNotPaused 
        validImplementation(implementation) 
        returns (address proxy) 
    {
        // Create ERC1967 proxy
        proxy = address(new ERC1967Proxy(implementation, data));
        
        // Register proxy
        isRegisteredProxy[proxy] = true;
        proxyRegistry.push(proxy);
        proxyToImplementation[proxy] = implementation;
        proxyToCreator[proxy] = msg.sender;
        
        emit ProxyCreated(proxy, implementation, msg.sender, block.timestamp);
        
        return proxy;
    }
    
    /**
     * @notice Creates multiple proxies in batch
     * @param implementations Array of implementation addresses
     * @param dataArray Array of initialization data
     * @return proxies Array of created proxy addresses
     */
    function batchCreateProxies(
        address[] memory implementations,
        bytes[] memory dataArray
    ) external 
        onlyAuthorizedCreator 
        whenNotPaused 
        returns (address[] memory proxies) 
    {
        require(
            implementations.length == dataArray.length,
            "UpgradeableProxyFactory: array length mismatch"
        );
        
        proxies = new address[](implementations.length);
        
        for (uint256 i = 0; i < implementations.length; i++) {
            require(implementations[i] != address(0), "UpgradeableProxyFactory: invalid implementation");
            require(implementations[i].code.length > 0, "UpgradeableProxyFactory: implementation not contract");
            
            // Create proxy
            address proxy = address(new ERC1967Proxy(implementations[i], dataArray[i]));
            
            // Register proxy
            isRegisteredProxy[proxy] = true;
            proxyRegistry.push(proxy);
            proxyToImplementation[proxy] = implementations[i];
            proxyToCreator[proxy] = msg.sender;
            
            proxies[i] = proxy;
            
            emit ProxyCreated(proxy, implementations[i], msg.sender, block.timestamp);
        }
        
        return proxies;
    }
    
    /**
     * @notice Creates a proxy with delayed implementation
     * @param implementation The implementation contract address
     * @param data Initialization data
     * @param delay Delay before implementation becomes active
     * @return proxy The created proxy address
     */
    function createProxyWithDelay(
        address implementation,
        bytes memory data,
        uint256 delay
    ) external 
        onlyAuthorizedCreator 
        whenNotPaused 
        validImplementation(implementation) 
        returns (address proxy) 
    {
        require(delay >= minImplementationDelay, "UpgradeableProxyFactory: delay too short");
        
        // Create proxy with temporary implementation
        address tempImplementation = address(new TemporaryImplementation());
        proxy = address(new ERC1967Proxy(tempImplementation, data));
        
        // Register proxy
        isRegisteredProxy[proxy] = true;
        proxyRegistry.push(proxy);
        proxyToImplementation[proxy] = tempImplementation; // Temporary
        proxyToCreator[proxy] = msg.sender;
        
        // Schedule implementation upgrade
        TemporaryImplementation(tempImplementation).scheduleUpgrade(implementation, block.timestamp + delay);
        
        emit ProxyCreated(proxy, tempImplementation, msg.sender, block.timestamp);
        
        return proxy;
    }
    
    // ===== PROXY MANAGEMENT =====
    
    /**
     * @notice Upgrades a proxy to a new implementation
     * @param proxy The proxy address
     * @param newImplementation The new implementation address
     */
    function upgradeProxy(
        address proxy,
        address newImplementation
    ) external 
        onlyOwner 
        whenNotPaused 
        validImplementation(newImplementation) 
    {
        require(isRegisteredProxy[proxy], "UpgradeableProxyFactory: proxy not registered");
        
        address oldImplementation = proxyToImplementation[proxy];
        
        // Upgrade proxy
        ERC1967Proxy(payable(proxy)).upgradeToAndCall(
            newImplementation,
            ""
        );
        
        // Update registry
        proxyToImplementation[proxy] = newImplementation;
        
        emit ProxyUpgraded(proxy, oldImplementation, newImplementation, msg.sender);
    }
    
    /**
     * @notice Gets proxy information
     * @param proxy The proxy address
     * @return implementation The current implementation
     * @return creator The proxy creator
     * @return isRegistered Whether the proxy is registered
     */
    function getProxyInfo(address proxy) 
        external 
        view 
        returns (
            address implementation,
            address creator,
            bool isRegistered
        ) 
    {
        return (
            proxyToImplementation[proxy],
            proxyToCreator[proxy],
            isRegisteredProxy[proxy]
        );
    }
    
    /**
     * @notice Gets all registered proxies
     * @param offset Starting offset
     * @param limit Maximum number of proxies to return
     * @return proxies Array of proxy addresses
     */
    function getRegisteredProxies(uint256 offset, uint256 limit) 
        external 
        view 
        returns (address[] memory proxies) 
    {
        uint256 end = offset + limit;
        if (end > proxyRegistry.length) {
            end = proxyRegistry.length;
        }
        
        uint256 length = end - offset;
        proxies = new address[](length);
        
        for (uint256 i = 0; i < length; i++) {
            proxies[i] = proxyRegistry[offset + i];
        }
        
        return proxies;
    }
    
    /**
     * @notice Gets total number of registered proxies
     * @return count Total proxy count
     */
    function getProxyCount() external view returns (uint256) {
        return proxyRegistry.length;
    }
    
    // ===== EMERGENCY CONTROLS =====
    
    /**
     * @notice Emergency pause the factory
     * @param reason The reason for pausing
     */
    function emergencyPause(string memory reason) external onlyOwner {
        require(!emergencyPaused, "UpgradeableProxyFactory: already paused");
        
        emergencyPaused = true;
        emit EmergencyPaused(msg.sender, reason);
    }
    
    /**
     * @notice Unpause the factory
     */
    function unpause() external onlyOwner {
        require(emergencyPaused, "UpgradeableProxyFactory: not paused");
        
        emergencyPaused = false;
        emit EmergencyUnpaused(msg.sender);
    }
    
    /**
     * @notice Updates minimum implementation delay
     * @param newDelay New minimum delay
     */
    function updateMinImplementationDelay(uint256 newDelay) external onlyOwner {
        require(newDelay > 0, "UpgradeableProxyFactory: invalid delay");
        minImplementationDelay = newDelay;
    }
}

/**
 * @title TemporaryImplementation
 * @dev Temporary implementation for delayed proxy activation
 */
contract TemporaryImplementation {
    address public pendingImplementation;
    uint256 public activationTime;
    
    event UpgradeScheduled(address indexed newImplementation, uint256 activationTime);
    event UpgradeExecuted(address indexed newImplementation);
    
    function scheduleUpgrade(address _implementation, uint256 _activationTime) external {
        require(pendingImplementation == address(0), "Upgrade already scheduled");
        pendingImplementation = _implementation;
        activationTime = _activationTime;
        
        emit UpgradeScheduled(_implementation, _activationTime);
    }
    
    function executeUpgrade() external {
        require(block.timestamp >= activationTime, "Too early");
        require(pendingImplementation != address(0), "No upgrade scheduled");
        
        emit UpgradeExecuted(pendingImplementation);
        
        // This will be replaced by the actual upgrade
        selfdestruct(payable(msg.sender));
    }
    
    // Fallback to handle calls before upgrade
    fallback() external payable {
        require(block.timestamp >= activationTime, "Not yet activated");
        require(pendingImplementation != address(0), "No upgrade scheduled");
        
        // Delegate to pending implementation
        (bool success, ) = pendingImplementation.delegatecall(msg.data);
        require(success, "Delegate call failed");
    }
    
    receive() external payable {
        require(block.timestamp >= activationTime, "Not yet activated");
        require(pendingImplementation != address(0), "No upgrade scheduled");
        
        // Delegate to pending implementation
        (bool success, ) = pendingImplementation.delegatecall("");
        require(success, "Delegate call failed");
    }
}
