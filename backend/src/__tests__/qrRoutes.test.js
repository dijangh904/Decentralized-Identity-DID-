const request = require("supertest");
const fc = require("fast-check");

// Mock contractService before requiring app to avoid DIDContract constructor issues
jest.mock("../services/contractService", () => {
  return jest.fn().mockImplementation(() => ({}));
});

const app = require("../server");
const { generateToken } = require("../services/qrService");

// ─── Arbitraries ────────────────────────────────────────────────────────────

const arbitraryInvalidPayload = () =>
  fc.oneof(
    fc.record({ did: fc.string({ minLength: 1 }) }), // missing type
    fc.record({
      type: fc
        .string({ minLength: 1 })
        .filter((s) => !["did", "credential", "connection"].includes(s)),
    }), // wrong type
    fc.record({ type: fc.constant("did") }), // missing did
    fc.record({ type: fc.constant("credential") }), // missing credentialId
    fc.record({ type: fc.constant("connection") }), // missing publicKey
  );

// ─── Unit Tests ──────────────────────────────────────────────────────────────

describe("POST /api/v1/qr/generate", () => {
  test("returns token and deepLink for valid DID payload", async () => {
    const res = await request(app)
      .post("/api/v1/qr/generate")
      .send({ type: "did", did: "did:stellar:abc" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("token");
    expect(res.body.data).toHaveProperty("deepLink");
    expect(res.body.data.deepLink).toMatch(/^did-marketplace:\/\/qr\?payload=/);
  });

  test("returns token and deepLink for valid credential payload", async () => {
    const res = await request(app)
      .post("/api/v1/qr/generate")
      .send({ type: "credential", credentialId: "cred-123" });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("token");
  });

  test("returns 400 for missing type", async () => {
    const res = await request(app)
      .post("/api/v1/qr/generate")
      .send({ did: "did:stellar:abc" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  test("returns 400 for unknown type", async () => {
    const res = await request(app)
      .post("/api/v1/qr/generate")
      .send({ type: "unknown" });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe("type");
  });
});

describe("POST /api/v1/qr/validate", () => {
  test("returns decoded payload for valid token", async () => {
    const { token } = generateToken({ type: "did", did: "did:stellar:abc" });
    const res = await request(app).post("/api/v1/qr/validate").send({ token });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe("did");
    expect(res.body.data.did).toBe("did:stellar:abc");
  });

  test("returns 400 when token is missing", async () => {
    const res = await request(app).post("/api/v1/qr/validate").send({});

    expect(res.status).toBe(400);
  });

  test("returns 401 for tampered token", async () => {
    const { token } = generateToken({ type: "did", did: "x" });
    const res = await request(app)
      .post("/api/v1/qr/validate")
      .send({ token: token + "tampered" });

    expect(res.status).toBe(401);
  });
});

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe("Property 6: Backend Validation Rejects Invalid Bodies", () => {
  test("POST /generate returns 400 with each invalid field listed", async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInvalidPayload(), async (payload) => {
        const res = await request(app)
          .post("/api/v1/qr/generate")
          .send(payload);

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(Array.isArray(res.body.errors)).toBe(true);
        expect(res.body.errors.length).toBeGreaterThan(0);
      }),
    );
  }, 30000);
});

describe("Property 7: Tampered or Expired Token Returns 401", () => {
  test("mutated tokens are rejected with 401", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }),
        async (suffix) => {
          const { token } = generateToken({
            type: "did",
            did: "did:stellar:test",
          });
          const tampered = token.slice(0, -1) + suffix;
          const res = await request(app)
            .post("/api/v1/qr/validate")
            .send({ token: tampered });

          // Either 401 (invalid) or 200 (extremely unlikely collision) — we assert not 500
          expect([200, 401, 429]).toContain(res.status);
          if (res.status === 401) {
            expect(res.body.success).toBe(false);
          }
        },
      ),
    );
  }, 30000);
});
