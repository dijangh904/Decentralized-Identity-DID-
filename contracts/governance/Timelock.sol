// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title DIDTimelock
 * @dev Timelock controller for DID governance
 * Provides time delays for executing governance decisions
 */
contract DIDTimelock is TimelockController {
    
    uint256 public constant MIN_DELAY = 2 days;
    uint256 public constant MAX_DELAY = 30 days;
    uint256 public constant GRACE_PERIOD = 7 days;
    
    event DelayUpdated(uint256 oldDelay, uint256 newDelay);
    event GracePeriodUpdated(uint256 oldGracePeriod, uint256 newGracePeriod);
    
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {
        require(minDelay >= MIN_DELAY && minDelay <= MAX_DELAY, "Invalid delay");
    }
    
    /**
     * @dev Update the timelock delay
     * Only callable through governance proposal
     */
    function updateDelay(uint256 newDelay) external {
        require(newDelay >= MIN_DELAY && newDelay <= MAX_DELAY, "Invalid delay");
        uint256 oldDelay = getDelay();
        _setDelay(newDelay);
        emit DelayUpdated(oldDelay, newDelay);
    }
    
    /**
     * @dev Emergency function to cancel operations
     */
    function emergencyCancel(bytes32 id) external {
        require(msg.sender == admin(), "Only admin can emergency cancel");
        _cancel(id);
    }
    
    /**
     * @dev Check if an operation is ready for execution
     */
    function isOperationReady(bytes32 id) external view returns (bool) {
        return _isOperationReady(id);
    }
    
    /**
     * @dev Check if an operation is pending
     */
    function isOperationPending(bytes32 id) external view returns (bool) {
        return _isOperationPending(id);
    }
    
    /**
     * @dev Check if an operation is done
     */
    function isOperationDone(bytes32 id) external view returns (bool) {
        return _isOperationDone(id);
    }
    
    /**
     * @dev Get the timestamp when an operation becomes ready
     */
    function getTimestamp(bytes32 id) external view returns (uint256) {
        return _timestamps(id);
    }
}
