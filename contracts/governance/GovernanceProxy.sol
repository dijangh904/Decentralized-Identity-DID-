// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./DIDGovernor.sol";
import "./Timelock.sol";

/**
 * @title GovernanceProxy
 * @dev Proxy contract that integrates governance with existing DID contracts
 * Acts as a bridge between the governance system and the DID registry
 */
contract GovernanceProxy is Ownable {
    
    DIDGovernor public governor;
    DIDTimelock public timelock;
    address public proxyAdmin;
    
    mapping(address => bool) public authorizedContracts;
    mapping(bytes32 => bool) public executedProposals;
    
    event ContractUpgraded(
        address indexed proxy,
        address indexed oldImplementation,
        address indexed newImplementation,
        uint256 indexed proposalId
    );
    
    event ParameterChanged(
        address indexed target,
        bytes32 indexed parameter,
        bytes newValue,
        uint256 indexed proposalId
    );
    
    event EmergencyActionExecuted(
        address indexed target,
        bytes data,
        uint256 indexed proposalId
    );
    
    modifier onlyGovernor() {
        require(msg.sender == address(governor), "Only governor can call");
        _;
    }
    
    modifier onlyAuthorized() {
        require(
            authorizedContracts[msg.sender] || msg.sender == owner(),
            "Not authorized"
        );
        _;
    }
    
    constructor(
        address _governor,
        address _timelock,
        address _proxyAdmin
    ) {
        governor = DIDGovernor(_governor);
        timelock = DIDTimelock(_timelock);
        proxyAdmin = _proxyAdmin;
        authorizedContracts[_governor] = true;
        authorizedContracts[_timelock] = true;
    }
    
    /**
     * @dev Execute a contract upgrade through governance
     */
    function executeUpgrade(
        address proxy,
        address newImplementation,
        uint256 proposalId
    ) external onlyGovernor {
        require(!executedProposals[bytes32(proposalId)], "Proposal already executed");
        
        TransparentUpgradeableProxy upgradeableProxy = TransparentUpgradeableProxy(proxy);
        address oldImplementation = upgradeableProxy.implementation();
        
        // Call the proxy admin to perform the upgrade
        (bool success, ) = proxyAdmin.call(
            abi.encodeWithSignature(
                "upgrade(address,address)",
                proxy,
                newImplementation
            )
        );
        require(success, "Upgrade failed");
        
        executedProposals[bytes32(proposalId)] = true;
        
        emit ContractUpgraded(proxy, oldImplementation, newImplementation, proposalId);
    }
    
    /**
     * @dev Execute a parameter change through governance
     */
    function executeParameterChange(
        address target,
        bytes memory data,
        uint256 proposalId
    ) external onlyGovernor {
        require(!executedProposals[bytes32(proposalId)], "Proposal already executed");
        
        (bool success, ) = target.call(data);
        require(success, "Parameter change failed");
        
        executedProposals[bytes32(proposalId)] = true;
        
        // Extract parameter hash from data (simplified approach)
        bytes32 paramHash = keccak256(data);
        emit ParameterChanged(target, paramHash, data, proposalId);
    }
    
    /**
     * @dev Execute emergency action through governance
     */
    function executeEmergencyAction(
        address target,
        bytes memory data,
        uint256 proposalId
    ) external onlyGovernor {
        require(!executedProposals[bytes32(proposalId)], "Proposal already executed");
        
        (bool success, ) = target.call(data);
        require(success, "Emergency action failed");
        
        executedProposals[bytes32(proposalId)] = true;
        
        emit EmergencyActionExecuted(target, data, proposalId);
    }
    
    /**
     * @dev Add an authorized contract
     */
    function addAuthorizedContract(address contract_) external onlyOwner {
        authorizedContracts[contract_] = true;
    }
    
    /**
     * @dev Remove an authorized contract
     */
    function removeAuthorizedContract(address contract_) external onlyOwner {
        authorizedContracts[contract_] = false;
    }
    
    /**
     * @dev Update the proxy admin address
     */
    function updateProxyAdmin(address newProxyAdmin) external onlyOwner {
        proxyAdmin = newProxyAdmin;
    }
    
    /**
     * @dev Check if a proposal has been executed
     */
    function isProposalExecuted(uint256 proposalId) external view returns (bool) {
        return executedProposals[bytes32(proposalId)];
    }
    
    /**
     * @dev Get the current implementation of a proxy
     */
    function getProxyImplementation(address proxy) external view returns (address) {
        return TransparentUpgradeableProxy(proxy).implementation();
    }
    
    /**
     * @dev Get the admin of a proxy
     */
    function getProxyAdmin(address proxy) external view returns (address) {
        return TransparentUpgradeableProxy(proxy).admin();
    }
}
