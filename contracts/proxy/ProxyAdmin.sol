// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "../governance/GovernanceProxy.sol";

/**
 * @title ProxyAdmin
 * @dev Admin contract for managing proxy upgrades
 * This contract is the owner of the proxy and can upgrade it
 * Integrated with governance system for DAO-controlled upgrades
 */
contract ProxyAdmin is Ownable {
    
    GovernanceProxy public governanceProxy;
    mapping(address => bool) public governanceControlled;
    
    event ProxyUpgraded(
        address indexed proxy,
        address indexed oldImplementation,
        address indexed newImplementation
    );
    
    event GovernanceControlSet(address indexed proxy, bool controlled);
    
    /**
     * @dev Set the governance proxy contract
     */
    function setGovernanceProxy(address _governanceProxy) external onlyOwner {
        governanceProxy = GovernanceProxy(_governanceProxy);
    }
    
    /**
     * @dev Enable or disable governance control for a proxy
     */
    function setGovernanceControl(address proxy, bool controlled) external onlyOwner {
        governanceControlled[proxy] = controlled;
        emit GovernanceControlSet(proxy, controlled);
    }
    
    /**
     * @dev Upgrade a proxy to a new implementation
     * @param proxy The proxy address to upgrade
     * @param newImplementation The new implementation address
     */
    function upgrade(
        TransparentUpgradeableProxy proxy,
        address newImplementation
    ) external {
        if (governanceControlled[address(proxy)]) {
            require(
                msg.sender == address(governanceProxy) || msg.sender == owner(),
                "Upgrade must go through governance or owner"
            );
        } else {
            require(msg.sender == owner(), "Only owner can upgrade");
        }
        
        address oldImplementation = proxy.implementation();
        proxy.upgradeTo(newImplementation);
        emit ProxyUpgraded(address(proxy), oldImplementation, newImplementation);
    }
    
    /**
     * @dev Upgrade a proxy to a new implementation and call a function
     * @param proxy The proxy address to upgrade
     * @param newImplementation The new implementation address
     * @param data The call data for the initialization function
     */
    function upgradeAndCall(
        TransparentUpgradeableProxy proxy,
        address newImplementation,
        bytes memory data
    ) external payable {
        if (governanceControlled[address(proxy)]) {
            require(
                msg.sender == address(governanceProxy) || msg.sender == owner(),
                "Upgrade must go through governance or owner"
            );
        } else {
            require(msg.sender == owner(), "Only owner can upgrade");
        }
        
        address oldImplementation = proxy.implementation();
        proxy.upgradeToAndCall{value: msg.value}(newImplementation, data);
        emit ProxyUpgraded(address(proxy), oldImplementation, newImplementation);
    }
    
    /**
     * @dev Get the implementation address of a proxy
     * @param proxy The proxy address
     * @return The implementation address
     */
    function getProxyImplementation(
        TransparentUpgradeableProxy proxy
    ) external view returns (address) {
        return proxy.implementation();
    }
    
    /**
     * @dev Get the admin address of a proxy
     * @param proxy The proxy address
     * @return The admin address
     */
    function getProxyAdmin(
        TransparentUpgradeableProxy proxy
    ) external view returns (address) {
        return proxy.admin();
    }
}
