// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IERC725
 * @dev Interface for ERC725 standard (Identity)
 */
interface IERC725 {
    event DataChanged(bytes32 indexed key, bytes value);
    event Executed(uint256 indexed operation, address indexed target, uint256 value, bytes data);

    /**
     * @dev Sets data for a specific key
     */
    function setData(bytes32 key, bytes memory value) external;

    /**
     * @dev Gets data for a specific key
     */
    function getData(bytes32 key) external view returns (bytes memory);

    /**
     * @dev Executes an operation on other contracts or sends value
     */
    function execute(uint256 operationType, address target, uint256 value, bytes memory data) external returns (bytes memory);
}
