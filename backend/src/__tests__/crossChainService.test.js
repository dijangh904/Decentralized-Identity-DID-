// Unit tests for CrossChainService methods

// Mock ethers
jest.mock('ethers', () => {
  const mockReceipt = { hash: '0xmocktxhash' };
  const mockWait = jest.fn().mockResolvedValue(mockReceipt);
  const mockBridgeDID = jest.fn().mockResolvedValue({ hash: '0xmocktxhash', wait: mockWait });
  const mockBridgeCredential = jest.fn().mockResolvedValue({ hash: '0xmocktxhash', wait: mockWait });
  const mockGetDIDDocument = jest.fn().mockImplementation((did) => {
    if (did === 'did:stellar:EXISTS') {
      return Promise.resolve({ did: 'did:stellar:EXISTS', owner: '0xOwner' });
    }
    return Promise.resolve({ did: '' }); // not found
  });

  return {
    ethers: {
      JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
      Wallet: jest.fn().mockImplementation(() => ({ provider: {} })),
      Contract: jest.fn().mockImplementation(() => ({
        bridgeDID: mockBridgeDID,
        bridgeCredential: mockBridgeCredential,
        getDIDDocument: mockGetDIDDocument
      })),
      id: jest.fn().mockReturnValue('0xmockhash'),
      isHexString: jest.fn().mockReturnValue(false),
    }
  };
});

// Mock ContractService
const mockGetDID = jest.fn();
const mockGetCredential = jest.fn();
jest.mock('../services/contractService', () => {
  return jest.fn().mockImplementation(() => ({
    getDID: mockGetDID,
    getCredential: mockGetCredential
  }));
});

const CrossChainService = require('../services/crossChainService');

describe('CrossChainService', () => {
  let service;

  beforeEach(() => {
    service = new CrossChainService();
    jest.clearAllMocks();
  });

  // ─── bridgeDIDToEthereum ─────────────────────────────────────────────────

  describe('bridgeDIDToEthereum', () => {
    it('throws if DID not found on Stellar', async () => {
      mockGetDID.mockResolvedValue(null);

      await expect(
        service.bridgeDIDToEthereum('did:stellar:NOTFOUND', '0xOwner')
      ).rejects.toThrow(/not found on Stellar/);
    });

    it('successfully bridges a DID and returns receipt', async () => {
      mockGetDID.mockResolvedValue({
        did: 'did:stellar:GABC123',
        publicKey: 'mockPublicKey',
        serviceEndpoint: 'https://example.com'
      });

      const receipt = await service.bridgeDIDToEthereum('did:stellar:GABC123', '0xOwner');
      expect(receipt).toEqual({ hash: '0xmocktxhash' });
    });
  });

  // ─── bridgeCredentialToEthereum ──────────────────────────────────────────

  describe('bridgeCredentialToEthereum', () => {
    it('throws if credential not found on Stellar', async () => {
      mockGetCredential.mockResolvedValue(null);

      await expect(
        service.bridgeCredentialToEthereum('cred-404', '0xdatahash')
      ).rejects.toThrow(/not found on Stellar/);
    });

    it('successfully bridges a credential and returns receipt', async () => {
      mockGetCredential.mockResolvedValue({
        id: 'cred-001',
        issuer: 'did:stellar:ISSUER',
        subject: 'did:stellar:SUBJECT',
        type: 'IdentityCredential',
        claims: '{"name":"Alice"}',
        revoked: false
      });

      const receipt = await service.bridgeCredentialToEthereum('cred-001', '0xdatahash');
      expect(receipt).toEqual({ hash: '0xmocktxhash' });
    });
  });

  // ─── verifyCrossChainState ───────────────────────────────────────────────

  describe('verifyCrossChainState', () => {
    it('returns synced: false when DID exists on Stellar but not Ethereum', async () => {
      mockGetDID.mockResolvedValue({ did: 'did:stellar:GABC123' });

      const status = await service.verifyCrossChainState('did:stellar:NOTBRIDGED');
      expect(status.stellar).toBe(true);
      expect(status.synced).toBe(false);
    });

    it('returns stellar: false when DID not on Stellar', async () => {
      mockGetDID.mockResolvedValue(null);

      const status = await service.verifyCrossChainState('did:stellar:MISSING');
      expect(status.stellar).toBe(false);
      expect(status.synced).toBe(false);
    });
  });
});
