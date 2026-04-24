# DID Governance System Setup Guide

## Overview
This document describes the DAO-style governance system implemented for contract upgrades in the DID protocol. The system provides decentralized decision-making for contract modifications through token-based voting and time-delayed execution.

## Architecture

### Core Components

1. **DIDGovernanceToken (ERC20Votes)**
   - Governance token with voting capabilities
   - 1 billion max supply, 100 million initial supply
   - Token holders can delegate voting power
   - Used for proposal creation and voting

2. **DIDTimelock**
   - Time-delay execution controller
   - 2-30 day configurable delay
   - Prevents immediate execution of governance decisions
   - Emergency cancellation capabilities

3. **DIDGovernor**
   - Main governance contract
   - Handles proposal creation, voting, and execution
   - 1-day voting delay, 7-day voting period
   - 1 million token proposal threshold
   - 4% quorum requirement

4. **GovernanceProxy**
   - Bridges governance with existing contracts
   - Executes approved upgrades and parameter changes
   - Tracks proposal execution status

5. **ProxyAdmin (Enhanced)**
   - Manages proxy upgrades
   - Integrated with governance system
   - Can enable/disable governance control per proxy

## Governance Process

### Contract Upgrade Flow

1. **Proposal Creation**
   - Token holder with ≥1M tokens creates upgrade proposal
   - Specifies target proxy and new implementation
   - Proposal enters "Pending" state

2. **Voting Period**
   - 1-day delay before voting starts
   - 7-day voting window
   - Token holders vote For/Against/Abstain
   - Requires 4% quorum and majority support

3. **Timelock Queue**
   - Successful proposals queued for execution
   - 2-day minimum delay (configurable)
   - Allows community review before execution

4. **Execution**
   - Anyone can execute queued proposals
   - GovernanceProxy performs the upgrade
   - Events emitted for transparency

### Emergency Actions

- Emergency proposals with shorter voting periods
- Requires special role or 10x normal voting power
- For critical security updates or protocol pauses

## Deployment Instructions

### 1. Environment Setup

```bash
# Install dependencies
npm install

# Set environment variables
export GOVERNANCE_TOKEN_ADDRESS="0x..."
export TIMELOCK_ADDRESS="0x..."
export GOVERNOR_ADDRESS="0x..."
export GOVERNANCE_PROXY_ADDRESS="0x..."
export PROXY_ADMIN_ADDRESS="0x..."
export TARGET_PROXY_ADDRESS="0x..."
```

### 2. Deploy Governance System

```bash
# Deploy all governance contracts
npx hardhat run scripts/deploy-governance.js --network mainnet

# Run tests to verify deployment
npx hardhat test test/DIDGovernance.test.js --network mainnet
```

### 3. Enable Governance Control

```javascript
// Enable governance control for existing proxy
await proxyAdmin.setGovernanceControl(proxyAddress, true);

// Transfer proxy ownership to governance system
await proxy.transferOwnership(proxyAdmin.address);
```

### 4. Token Distribution

```javascript
// Distribute tokens to community members
await governanceToken.mint(userAddress, tokenAmount);

// Users delegate voting power
await governanceToken.connect(user).delegate(user.address);
```

## Usage Examples

### Creating an Upgrade Proposal

```javascript
// Create proposal to upgrade DID Registry
const proposalId = await governor.proposeContractUpgrade(
    didProxyAddress,
    newImplementationAddress,
    "Upgrade DID Registry to V2 with security improvements"
);
```

### Voting on Proposals

```javascript
// Vote in favor of proposal
await governor.connect(voter).castVote(proposalId, 1); // 1 = For

// Vote against proposal
await governor.connect(voter).castVote(proposalId, 0); // 0 = Against

// Vote to abstain
await governor.connect(voter).castVote(proposalId, 2); // 2 = Abstain
```

### Executing Approved Proposals

```javascript
// Queue proposal for execution (after voting succeeds)
await governor.queue(targets, values, signatures, calldatas, descriptionHash);

// Execute proposal (after timelock delay)
await governor.execute(targets, values, signatures, calldatas, descriptionHash);
```

## Security Considerations

### Timelock Protection
- 2-day minimum delay prevents rushed upgrades
- Community can review and object during delay period
- Emergency cancellation available for critical issues

### Voting Thresholds
- High proposal threshold (1M tokens) prevents spam
- Quorum requirement ensures broad participation
- Token delegation allows flexible voting power allocation

### Access Control
- Multi-layered permission system
- Role-based access for emergency actions
- Proxy-level governance control enable/disable

### Upgrade Safety
- Proposals specify exact implementation addresses
- GovernanceProxy validates proposal execution
- Comprehensive event logging for transparency

## Monitoring and Auditing

### Event Tracking
- Monitor `ProposalCreated` events for new proposals
- Track `VoteCast` events for voting activity
- Watch `ContractUpgraded` events for executed upgrades

### State Monitoring
```javascript
// Check proposal state
const state = await governor.state(proposalId);
// 0: Pending, 1: Active, 2: Canceled, 3: Defeated, 4: Succeeded, 5: Queued, 6: Expired, 7: Executed

// Check voting power
const votes = await governor.proposalVotes(proposalId);

// Check timelock status
const isReady = await timelock.isOperationReady(operationId);
```

### Off-Chain Governance
- Use Snapshot for signaling and discussion
- GitHub for proposal documentation
- Discord/Telegram for community coordination

## Troubleshooting

### Common Issues

1. **Insufficient Voting Power**
   - Ensure tokens are minted and delegated
   - Check proposal threshold requirements

2. **Timelock Delays**
   - Verify minimum delay configuration
   - Check if proposal is properly queued

3. **Proxy Permissions**
   - Confirm governance control is enabled
   - Verify proxy admin relationships

### Debug Commands

```javascript
// Check current implementation
const impl = await governanceProxy.getProxyImplementation(proxyAddress);

// Check proposal details
const details = await governor.getProposalDetails(proposalId);

// Check token balances and voting power
const balance = await governanceToken.balanceOf(address);
const votes = await governanceToken.getVotes(address);
```

## Future Enhancements

### Planned Features
- Multi-signature requirements for critical upgrades
- On-chain proposal discussion and comments
- Automated vulnerability scanning for new implementations
- Cross-chain governance coordination

### Integration Opportunities
- DeFi protocol governance integration
- Identity verification for voting rights
- Reputation-based voting weight systems
- Automated execution based on external triggers

## Support

For questions or issues:
- Review test cases in `test/DIDGovernance.test.js`
- Check deployment scripts in `scripts/deploy-governance.js`
- Consult OpenZeppelin Governor documentation
- Join community discussions in project forums
