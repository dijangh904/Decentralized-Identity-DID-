// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";

/**
 * @title DIDGovernor
 * @dev Governor contract for DID protocol governance
 * Handles proposal creation, voting, and execution
 */
contract DIDGovernor is 
    Governor, 
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    
    uint256 public constant VOTING_DELAY = 1 days;
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant PROPOSAL_THRESHOLD = 1000000 * 10**18; // 1 million tokens
    uint256 public constant QUORUM_PERCENTAGE = 4; // 4% of total supply
    
    enum ProposalType {
        UPGRADE_CONTRACT,
        CHANGE_PARAMETERS,
        EMERGENCY_ACTION,
        PROTOCOL_CHANGE
    }
    
    struct ProposalDetail {
        ProposalType proposalType;
        string description;
        address targetContract;
        bytes32 implementationHash;
        uint256 value;
        bytes data;
    }
    
    mapping(uint256 => ProposalDetail) public proposalDetails;
    
    event ProposalCreatedWithDetails(
        uint256 indexed proposalId,
        address indexed proposer,
        ProposalType proposalType,
        string description,
        address targetContract
    );
    
    event ContractUpgradeProposed(
        uint256 indexed proposalId,
        address indexed proxy,
        address indexed newImplementation
    );
    
    constructor(
        ERC20Votes _token,
        TimelockController _timelock
    )
        Governor("DID Governor")
        GovernorSettings(VOTING_DELAY, VOTING_PERIOD, PROPOSAL_THRESHOLD)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(QUORUM_PERCENTAGE)
        GovernorTimelockControl(_timelock)
    {}
    
    /**
     * @dev Create a proposal for contract upgrade
     */
    function proposeContractUpgrade(
        address proxy,
        address newImplementation,
        string memory description
    ) public returns (uint256) {
        bytes memory data = abi.encodeWithSignature(
            "upgrade(address,address)",
            proxy,
            newImplementation
        );
        
        address[] memory targets = new address[](1);
        targets[0] = address(timelock());
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        string[] memory signatures = new string[](1);
        signatures[0] = "";
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = data;
        
        uint256 proposalId = propose(
            targets,
            values,
            signatures,
            calldatas,
            description
        );
        
        proposalDetails[proposalId] = ProposalDetail({
            proposalType: ProposalType.UPGRADE_CONTRACT,
            description: description,
            targetContract: proxy,
            implementationHash: bytes32(uint256(uint160(newImplementation))),
            value: 0,
            data: data
        });
        
        emit ProposalCreatedWithDetails(
            proposalId,
            msg.sender,
            ProposalType.UPGRADE_CONTRACT,
            description,
            proxy
        );
        
        emit ContractUpgradeProposed(proposalId, proxy, newImplementation);
        
        return proposalId;
    }
    
    /**
     * @dev Create a proposal for parameter changes
     */
    function proposeParameterChange(
        address target,
        bytes memory data,
        string memory description
    ) public returns (uint256) {
        address[] memory targets = new address[](1);
        targets[0] = address(timelock());
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        string[] memory signatures = new string[](1);
        signatures[0] = "";
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = data;
        
        uint256 proposalId = propose(
            targets,
            values,
            signatures,
            calldatas,
            description
        );
        
        proposalDetails[proposalId] = ProposalDetail({
            proposalType: ProposalType.CHANGE_PARAMETERS,
            description: description,
            targetContract: target,
            implementationHash: bytes32(0),
            value: 0,
            data: data
        });
        
        emit ProposalCreatedWithDetails(
            proposalId,
            msg.sender,
            ProposalType.CHANGE_PARAMETERS,
            description,
            target
        );
        
        return proposalId;
    }
    
    /**
     * @dev Create an emergency action proposal (shorter voting period)
     */
    function proposeEmergencyAction(
        address target,
        bytes memory data,
        string memory description
    ) public returns (uint256) {
        require(
            hasRole(EMERGENCY_ROLE, msg.sender) || 
            token.getPriorVotes(msg.sender, block.timestamp - 1) > PROPOSAL_THRESHOLD * 10,
            "Insufficient emergency rights"
        );
        
        address[] memory targets = new address[](1);
        targets[0] = address(timelock());
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        string[] memory signatures = new string[](1);
        signatures[0] = "";
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = data;
        
        uint256 proposalId = propose(
            targets,
            values,
            signatures,
            calldatas,
            description
        );
        
        proposalDetails[proposalId] = ProposalDetail({
            proposalType: ProposalType.EMERGENCY_ACTION,
            description: description,
            targetContract: target,
            implementationHash: bytes32(0),
            value: 0,
            data: data
        });
        
        emit ProposalCreatedWithDetails(
            proposalId,
            msg.sender,
            ProposalType.EMERGENCY_ACTION,
            description,
            target
        );
        
        return proposalId;
    }
    
    /**
     * @dev Get proposal details
     */
    function getProposalDetails(uint256 proposalId) 
        external 
        view 
        returns (ProposalDetail memory) 
    {
        return proposalDetails[proposalId];
    }
    
    /**
     * @dev Check if a proposal is valid for execution
     */
    function _validateProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) internal pure override {
        require(targets.length == values.length, "Invalid proposal length");
        require(targets.length == calldatas.length, "Invalid proposal length");
        require(targets.length > 0, "Empty proposal");
        require(bytes(description).length > 0, "Empty description");
    }
    
    // The following functions are overrides required by Solidity.
    
    function votingDelay()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(IGovernor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function proposalThreshold()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }
    
    function state(uint256 proposalId)
        public
        view
        override(IGovernor, Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }
    
    function propose(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    )
        public
        override(IGovernor, Governor)
        returns (uint256)
    {
        return super.propose(targets, values, signatures, calldatas, description);
    }
    
    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        public
        payable
        override(IGovernor, Governor, GovernorTimelockControl)
    {
        super.execute(targets, values, calldatas, descriptionHash);
    }
    
    function cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        public
        override(IGovernor, Governor, GovernorTimelockControl)
    {
        super.cancel(targets, values, calldatas, descriptionHash);
    }
    
    function castVote(uint256 proposalId, uint8 support)
        public
        override(IGovernor, Governor)
        returns (uint256)
    {
        return super.castVote(proposalId, support);
    }
    
    function castVoteWithReason(
        uint256 proposalId,
        uint8 support,
        string calldata reason
    )
        public
        override(IGovernor, Governor)
        returns (uint256)
    {
        return super.castVoteWithReason(proposalId, support, reason);
    }
    
    function castVoteBySig(
        uint256 proposalId,
        uint8 support,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        public
        override(IGovernor, Governor)
        returns (uint256)
    {
        return super.castVoteBySig(proposalId, support, v, r, s);
    }
}
