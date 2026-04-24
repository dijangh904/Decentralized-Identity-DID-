// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/OwnableUpgradeable.sol";

/**
 * @title DIDProxy
 * @dev UUPS Proxy implementation for the DID Registry system
 * This contract serves as the proxy that delegates calls to the implementation
 */
contract DIDProxy is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Disable initialization to prevent reinitialization attacks
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the proxy contract
     * @param initialOwner The address that will own the proxy
     */
    function initialize(address initialOwner) public initializer {
        require(initialOwner != address(0), "Initial owner cannot be zero address");
        require(initialOwner.code.length == 0, "Initial owner cannot be a contract");
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
    }
    
    /**
     * @dev Authorizes an upgrade to a new implementation
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyOwner 
    {
        require(newImplementation != address(0), "New implementation cannot be zero address");
        require(newImplementation != address(this), "Cannot upgrade to self");
        require(newImplementation.code.length > 0, "New implementation must be a contract");
        // Only the owner can authorize upgrades
    }
    
    /**
     * @dev Get the current implementation address
     * @return The address of the current implementation
     */
    function getImplementation() external view returns (address) {
        return _getImplementation();
    }
    
    /**
     * @dev Fallback function to delegate calls to implementation
     */
    fallback() external payable {
        _delegate(_getImplementation());
    }
    
    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {
        _delegate(_getImplementation());
    }
    
    /**
     * @dev Internal function to delegate calls to implementation
     * @param implementation The implementation contract address
     */
    function _delegate(address implementation) internal {
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())
            
            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            
            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())
            
            switch result
            // delegatecall returns 0 on error.
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
