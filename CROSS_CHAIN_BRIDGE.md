# Cross-Chain Bridge — Ethereum/EVM Compatibility

This document describes the cross-chain bridge feature added as part of **Issue #152**: _Implement Cross-Chain Compatibility_.

## Overview

The platform previously supported only the **Stellar network** for DID operations.  
This update adds a bridge layer that allows DIDs and Verifiable Credentials anchored on Stellar to be mirrored on **Ethereum and any EVM-compatible chain** (Polygon, BSC, Sepolia testnet, etc.).

## Architecture

```
Stellar Network                  EVM Network (Ethereum, Polygon, etc.)
──────────────────────           ────────────────────────────────────────
DIDContract.js (Stellar)  ───►  EthereumDIDRegistry.sol (EVM contract)
                                         ▲
                          CrossChainService.js (backend bridge service)
                                         │
                            /api/v1/bridge/* (REST API endpoints)
```

## New Files

| File | Description |
|------|-------------|
| `contracts/ethereum/EthereumDIDRegistry.sol` | Solidity contract deployed on EVM chains |
| `backend/src/services/crossChainService.js` | Bridge service using `ethers.js` |
| `backend/src/routes/bridge.js` | REST API endpoints for bridging |
| `backend/src/__tests__/bridge.test.js` | Route-level tests |
| `backend/src/__tests__/crossChainService.test.js` | Service unit tests |

## Environment Variables

Add the following to your `.env` (see `.env.example`):

```env
EVM_RPC_URL=https://rpc2.sepolia.org
EVM_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
EVM_DID_REGISTRY_ADDRESS=0xYOUR_CONTRACT_ADDRESS_HERE
EVM_CHAIN_ID=11155111
```

## API Endpoints

### Bridge a DID to Ethereum
```
POST /api/v1/bridge/did
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "did": "did:stellar:GABC123...",
  "ownerAddress": "0xYourEthereumAddress"
}
```

**Response:**
```json
{
  "success": true,
  "message": "DID bridged successfully",
  "transactionHash": "0x..."
}
```

---

### Bridge a Credential to Ethereum
```
POST /api/v1/bridge/credential
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "credentialId": "cred-001",
  "dataHash": "0xSHA256HashOfCredential"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Credential bridged successfully",
  "transactionHash": "0x..."
}
```

---

### Check Cross-Chain Status of a DID
```
GET /api/v1/bridge/status/:did
Authorization: Bearer <JWT>
```

**Response:**
```json
{
  "success": true,
  "status": {
    "did": "did:stellar:GABC123...",
    "stellar": true,
    "ethereum": true,
    "synced": true
  }
}
```

## Deploying the Ethereum Contract

1. Install Hardhat or Foundry in a local toolchain.
2. Deploy `contracts/ethereum/EthereumDIDRegistry.sol` to your target EVM network.
3. Grant `ADMIN_ROLE` to the bridge wallet (`EVM_PRIVATE_KEY`).
4. Set `EVM_DID_REGISTRY_ADDRESS` in your `.env` to the deployed contract address.

## Supported Chains

| Network | Chain ID | RPC |
|---------|----------|-----|
| Ethereum Mainnet | 1 | `https://mainnet.infura.io/v3/<KEY>` |
| Sepolia Testnet | 11155111 | `https://rpc2.sepolia.org` |
| Polygon Mainnet | 137 | `https://polygon-rpc.com` |
| Polygon Mumbai | 80001 | `https://rpc-mumbai.maticvigil.com` |
