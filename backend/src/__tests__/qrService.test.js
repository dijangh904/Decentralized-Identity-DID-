const fc = require("fast-check");
const {
  validateSchema,
  encodeDeepLink,
  decodeDeepLink,
  generateToken,
  validateToken,
} = require("../services/qrService");

// ─── Arbitraries ────────────────────────────────────────────────────────────

const arbitraryDIDPayload = () =>
  fc.record({
    type: fc.constant("did"),
    did: fc
      .string({ minLength: 1, maxLength: 64 })
      .filter((s) => s.trim().length > 0),
  });

const arbitraryCredentialPayload = () =>
  fc.record({
    type: fc.constant("credential"),
    credentialId: fc
      .string({ minLength: 1, maxLength: 64 })
      .filter((s) => s.trim().length > 0),
  });

const arbitraryConnectionPayload = () =>
  fc.record({
    type: fc.constant("connection"),
    publicKey: fc
      .string({ minLength: 1, maxLength: 128 })
      .filter((s) => s.trim().length > 0),
  });

const arbitraryQRPayload = () =>
  fc.oneof(
    arbitraryDIDPayload(),
    arbitraryCredentialPayload(),
    arbitraryConnectionPayload(),
  );

const arbitraryInvalidPayload = () =>
  fc.oneof(
    // missing type
    fc.record({ did: fc.string({ minLength: 1 }) }),
    // wrong type
    fc.record({
      type: fc
        .string({ minLength: 1 })
        .filter((s) => !["did", "credential", "connection"].includes(s)),
    }),
    // did type missing did field
    fc.record({ type: fc.constant("did") }),
    // credential type missing credentialId
    fc.record({ type: fc.constant("credential") }),
    // connection type missing publicKey
    fc.record({ type: fc.constant("connection") }),
  );

// ─── Unit Tests ──────────────────────────────────────────────────────────────

describe("validateSchema", () => {
  test("accepts valid DID payload", () => {
    expect(validateSchema({ type: "did", did: "did:stellar:abc" })).toEqual({
      valid: true,
      errors: [],
    });
  });

  test("accepts valid credential payload", () => {
    expect(
      validateSchema({ type: "credential", credentialId: "cred-123" }),
    ).toEqual({ valid: true, errors: [] });
  });

  test("accepts valid connection payload", () => {
    expect(
      validateSchema({ type: "connection", publicKey: "GABC..." }),
    ).toEqual({ valid: true, errors: [] });
  });

  test("rejects missing type", () => {
    const result = validateSchema({ did: "did:stellar:abc" });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("rejects unknown type", () => {
    const result = validateSchema({ type: "unknown" });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("type");
  });

  test("rejects null/undefined", () => {
    expect(validateSchema(null).valid).toBe(false);
    expect(validateSchema(undefined).valid).toBe(false);
  });
});

describe("encodeDeepLink / decodeDeepLink", () => {
  test("round-trips a DID payload", () => {
    const payload = { type: "did", did: "did:stellar:abc" };
    expect(decodeDeepLink(encodeDeepLink(payload))).toEqual(payload);
  });

  test("URI starts with did-marketplace://qr?payload=", () => {
    const uri = encodeDeepLink({ type: "did", did: "x" });
    expect(uri.startsWith("did-marketplace://qr?payload=")).toBe(true);
  });

  test("decodeDeepLink throws on missing payload param", () => {
    expect(() => decodeDeepLink("did-marketplace://qr")).toThrow();
  });
});

describe("generateToken / validateToken", () => {
  test("generates and validates a token round-trip", () => {
    const payload = { type: "did", did: "did:stellar:abc" };
    const { token } = generateToken(payload);
    const decoded = validateToken(token);
    expect(decoded.type).toBe("did");
    expect(decoded.did).toBe("did:stellar:abc");
  });

  test("generateToken throws on invalid payload", () => {
    expect(() => generateToken({ type: "unknown" })).toThrow();
  });

  test("validateToken throws on tampered token", () => {
    const { token } = generateToken({ type: "did", did: "x" });
    expect(() => validateToken(token + "tampered")).toThrow();
  });
});

// ─── Property-Based Tests ────────────────────────────────────────────────────

describe("Property 1: QR Payload Round-Trip", () => {
  test("decodeDeepLink(encodeDeepLink(payload)) deep-equals original", () => {
    fc.assert(
      fc.property(arbitraryQRPayload(), (payload) => {
        const roundTripped = decodeDeepLink(encodeDeepLink(payload));
        expect(roundTripped).toEqual(payload);
      }),
    );
  });
});

describe("Property 2: Invalid Payload Produces Structured Errors", () => {
  test("validateSchema returns valid:false with non-empty errors array", () => {
    fc.assert(
      fc.property(arbitraryInvalidPayload(), (payload) => {
        const result = validateSchema(payload);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        result.errors.forEach((e) => {
          expect(e).toHaveProperty("field");
          expect(e).toHaveProperty("reason");
        });
      }),
    );
  });
});

describe("Property 5: Deep Link URI Format", () => {
  test("URI starts with scheme and decoded param equals original payload", () => {
    fc.assert(
      fc.property(arbitraryQRPayload(), (payload) => {
        const uri = encodeDeepLink(payload);
        expect(uri.startsWith("did-marketplace://qr?payload=")).toBe(true);
        const decoded = decodeDeepLink(uri);
        expect(decoded).toEqual(payload);
      }),
    );
  });
});
