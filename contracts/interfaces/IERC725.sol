// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IERC725
 * @dev Interface for ERC725 standard (Identity) with comprehensive functionality
 * 
 * This interface defines the standard for decentralized identity management on
 * blockchain networks. It provides mechanisms for identity owners to store
 * arbitrary data and execute operations on behalf of their identity.
 * 
 * Key Features:
 * - Generic data storage with key-value pairs
 * - Execution capabilities for contract interactions
 * - Event emission for transparency and audit trails
 * - Standardized interface for identity contracts
 * 
 * Use Cases:
 * - DID document management
 * - Identity data storage
 * - Contract execution on behalf of identity
 * - Cross-chain identity operations
 * 
 * @author Fatima Sanusi
 * @notice Implement this interface to create ERC725-compliant identity contracts
 * @dev Follows the ERC725 standard for blockchain-based identity management
 */
interface IERC725 {
    /// @notice Emitted when identity data is changed
    /// @param key The key of the changed data
    /// @param value The new value associated with the key
    event DataChanged(bytes32 indexed key, bytes value);
    
    /// @notice Emitted when an operation is executed on behalf of the identity
    /// @param operation Type of operation executed
    /// @param target Target contract address
    /// @param value Amount of ETH sent (if any)
    /// @param data Call data for the operation
    event Executed(uint256 indexed operation, address indexed target, uint256 value, bytes data);

    /**
     * @notice Sets data for a specific key in the identity storage
     * @dev Allows identity owners to store arbitrary data associated with their identity
     * @param key The key under which to store the data
     * @param value The data to store
     * @throws AccessControl if caller is not the identity owner
     */
    function setData(bytes32 key, bytes memory value) external;

    /**
     * @notice Retrieves data for a specific key from the identity storage
     * @dev Returns the data stored under the specified key
     * @param key The key of the data to retrieve
     * @return value The data stored under the key
     */
    function getData(bytes32 key) external view returns (bytes memory);

    /**
     * @notice Executes an operation on other contracts or sends value on behalf of the identity
     * @dev Enables identity owners to interact with other contracts through their identity
     * @param operationType Type of operation to execute
     * @param target Target contract address
     * @param value Amount of ETH to send with the operation
     * @param data Call data for the operation
     * @return result Return data from the executed operation
     * @throws AccessControl if caller is not the identity owner
     * @throws ExecutionFailed if the operation execution fails
     */
    function execute(uint256 operationType, address target, uint256 value, bytes memory data) external returns (bytes memory);
}
