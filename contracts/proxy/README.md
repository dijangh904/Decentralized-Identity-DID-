# DID Registry Proxy Implementation

This directory contains the upgradeable proxy implementation for the Stellar DID Registry system using the UUPS (Universal Upgradeable Proxy Standard) pattern.

## Architecture Overview

### UUPS Proxy Pattern
The implementation uses the UUPS proxy pattern, which provides several advantages:
- **Gas Efficiency**: Lower gas costs compared to transparent proxies
- **Flexibility**: Upgrade logic is contained within the implementation contract
- **Security**: Reduced attack surface with fewer contracts

### Contract Structure

#### 1. DIDProxy.sol
- **Purpose**: UUPS proxy contract that delegates calls to the implementation
- **Features**: 
  - Initializable pattern for safe initialization
  - Owner-controlled upgrade authorization
  - Fallback delegation to implementation

#### 2. UpgradeableStellarDIDRegistry.sol
- **Purpose**: Upgradeable implementation of the DID registry
- **Features**:
  - All original DID registry functionality
  - UUPS upgrade capability
  - Enhanced security with reentrancy protection
  - Ownership transfer for DIDs
  - Version tracking for upgrades

#### 3. ProxyAdmin.sol
- **Purpose**: Administrative contract for managing proxy upgrades (alternative approach)
- **Features**:
  - Transparent proxy support
  - Upgrade and call functionality
  - Implementation verification

## Deployment

### Prerequisites
```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts
```

### Environment Setup
Create a `.env` file with your network configuration:
```env
PRIVATE_KEY=your_private_key
SEPOLIA_URL=https://sepolia.infura.io/v3/your_project_id
MAINNET_URL=https://mainnet.infura.io/v3/your_project_id
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Deploy Commands

#### Initial Deployment
```bash
npx hardhat run scripts/deploy-upgradeable-contracts.js --network sepolia
```

#### Upgrade Implementation
```bash
npx hardhat run scripts/deploy-upgradeable-contracts.js upgrade --network sepolia
```

## Usage

### Frontend Integration
```javascript
// Connect to the proxy contract (not the implementation)
const registryAddress = "PROXY_ADDRESS"; // Use proxy address from deployment
const registry = await ethers.getContractAt("UpgradeableStellarDIDRegistry", registryAddress);

// Use the contract normally
await registry.createDID("did:stellar:user123", publicKey, serviceEndpoint);
```

### Testing
```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/UpgradeableDIDRegistry.test.js

# Run tests with gas reporting
REPORT_GAS=true npx hardhat test
```

## Security Considerations

### Upgrade Safety
1. **Storage Layout**: Maintain storage variable order during upgrades
2. **Initialization**: Use initializer pattern instead of constructor
3. **Access Control**: Only contract owners can authorize upgrades
4. **Testing**: Thoroughly test upgrades on testnets first

### Best Practices
1. **Version Tracking**: Always bump version numbers in upgrades
2. **State Preservation**: Ensure critical state is preserved during upgrades
3. **Rollback Plan**: Keep previous implementation addresses for rollback capability
4. **Monitoring**: Set up monitoring for upgrade events

## Upgrade Process

### Step 1: Prepare New Implementation
```solidity
// In your new implementation contract
function getVersion() external pure override returns (string memory) {
    return "2.0.0"; // Bump version
}
```

### Step 2: Deploy New Implementation
```bash
npx hardhat compile
npx hardhat run scripts/deploy-upgradeable-contracts.js upgrade --network sepolia
```

### Step 3: Verify Upgrade
```javascript
// Verify the upgrade was successful
const currentImpl = await proxy.getImplementation();
console.log("Current implementation:", currentImpl);
```

## Contract Addresses

After deployment, the addresses will be saved to:
```
./deployments/{network-name}-upgradeable-did-registry.json
```

This file contains:
- Proxy address (use this in your frontend)
- Implementation address
- ProxyAdmin address
- Deployment metadata

## Monitoring

### Events to Monitor
- `ImplementationUpgraded`: When the implementation is upgraded
- `DIDCreated`: New DID creation
- `DIDUpdated`: DID modifications
- `DIDDeactivated`: DID deactivation

### Health Checks
```javascript
// Regular health checks
const version = await registry.getVersion();
const contractType = await registry.getContractType();
const owner = await registry.owner();
```

## Troubleshooting

### Common Issues

1. **"Initializable: contract is already initialized"**
   - Solution: Check if the contract was already initialized
   - Ensure you're not calling initialize multiple times

2. **"Ownable: caller is not the owner"**
   - Solution: Verify you're using the correct owner account
   - Check the owner address: `await registry.owner()`

3. **Storage layout conflicts during upgrade**
   - Solution: Maintain the same storage variable order
   - Only append new variables at the end

4. **Proxy pointing to wrong implementation**
   - Solution: Verify implementation address
   - Use `getImplementation()` to check current implementation

### Debug Commands
```bash
# Check current implementation
npx hardhat console --network sepolia
> const proxy = await ethers.getContractAt("DIDProxy", "PROXY_ADDRESS");
> await proxy.getImplementation();

# Check contract version
> const registry = await ethers.getContractAt("UpgradeableStellarDIDRegistry", "PROXY_ADDRESS");
> await registry.getVersion();
```

## Additional Resources

- [OpenZeppelin Upgradeable Contracts](https://docs.openzeppelin.com/contracts/4.x/upgradeable)
- [UUPS vs Transparent Proxies](https://docs.openzeppelin.com/contracts/4.x/api/proxy#UUPS)
- [Hardhat Upgrades Plugin](https://docs.openzeppelin.com/upgrades-plugins/1.x/api-hardhat-upgrades)
