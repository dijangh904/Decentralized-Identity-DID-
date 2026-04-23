const request = require('supertest');

// Mock ethers to avoid real network calls
jest.mock('ethers', () => {
  const mockWait = jest.fn().mockResolvedValue({ hash: '0xmocktxhash' });
  const mockBridgeDID = jest.fn().mockResolvedValue({ hash: '0xmocktxhash', wait: mockWait });
  const mockBridgeCredential = jest.fn().mockResolvedValue({ hash: '0xmocktxhash', wait: mockWait });
  const mockGetDIDDocument = jest.fn().mockResolvedValue({
    did: 'did:stellar:GABC123',
    owner: '0xOwner',
    publicKey: 'mockPublicKey',
    active: true,
    serviceEndpoint: 'https://example.com'
  });

  return {
    ethers: {
      JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
      Wallet: jest.fn().mockImplementation(() => ({
        provider: {}
      })),
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

// Mock ContractService (Stellar side)
jest.mock('../services/contractService', () => {
  return jest.fn().mockImplementation(() => ({
    getDID: jest.fn().mockResolvedValue({
      did: 'did:stellar:GABC123',
      publicKey: 'mockPublicKey',
      serviceEndpoint: 'https://example.com',
      active: true
    }),
    getCredential: jest.fn().mockResolvedValue({
      id: 'cred-001',
      issuer: 'did:stellar:ISSUER',
      subject: 'did:stellar:SUBJECT',
      type: 'IdentityCredential',
      claims: '{"name":"Alice"}',
      issued: new Date().toISOString(),
      revoked: false
    })
  }));
});

const app = require('../server');

// ─── Bridge Routes Tests ─────────────────────────────────────────────────────

describe('POST /api/v1/bridge/did', () => {
  it('returns 400 when did or ownerAddress is missing', async () => {
    const res = await request(app)
      .post('/api/v1/bridge/did')
      .send({ did: 'did:stellar:GABC123' }); // missing ownerAddress

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 401 when no auth token provided', async () => {
    const res = await request(app)
      .post('/api/v1/bridge/did')
      .send({ did: 'did:stellar:GABC123', ownerAddress: '0xOwner' });

    // Without a valid JWT, authMiddleware should block
    expect([401, 403]).toContain(res.status);
  });
});

describe('POST /api/v1/bridge/credential', () => {
  it('returns 400 when credentialId or dataHash is missing', async () => {
    const res = await request(app)
      .post('/api/v1/bridge/credential')
      .send({ credentialId: 'cred-001' }); // missing dataHash

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 401 when no auth token provided', async () => {
    const res = await request(app)
      .post('/api/v1/bridge/credential')
      .send({ credentialId: 'cred-001', dataHash: '0xmockhash' });

    expect([401, 403]).toContain(res.status);
  });
});

describe('GET /api/v1/bridge/status/:did', () => {
  it('returns 401 when no auth token provided', async () => {
    const res = await request(app)
      .get('/api/v1/bridge/status/did:stellar:GABC123');

    expect([401, 403]).toContain(res.status);
  });
});
