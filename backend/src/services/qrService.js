const jwt = require("jsonwebtoken");

const VALID_TYPES = ["did", "credential", "connection"];

/**
 * Validates a QR payload against the expected schema.
 * @param {object} payload
 * @returns {{ valid: boolean, errors: Array<{ field: string, reason: string }> }}
 */
function validateSchema(payload) {
  const errors = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    errors.push({ field: "type", reason: "required" });
    return { valid: false, errors };
  }

  if (!payload.type) {
    errors.push({ field: "type", reason: "required" });
    return { valid: false, errors };
  }

  if (!VALID_TYPES.includes(payload.type)) {
    errors.push({
      field: "type",
      reason: `must be one of: ${VALID_TYPES.join(", ")}`,
    });
    return { valid: false, errors };
  }

  if (payload.type === "did") {
    if (!payload.did) {
      errors.push({ field: "did", reason: "required" });
    }
  } else if (payload.type === "credential") {
    if (!payload.credentialId) {
      errors.push({ field: "credentialId", reason: "required" });
    }
  } else if (payload.type === "connection") {
    if (!payload.publicKey) {
      errors.push({ field: "publicKey", reason: "required" });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Encodes a QR payload as a deep link URI.
 * @param {object} payload
 * @returns {string}
 */
function encodeDeepLink(payload) {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json).toString("base64url");
  return `did-marketplace://qr?payload=${encoded}`;
}

/**
 * Decodes a deep link URI and returns the QR payload.
 * @param {string} uri
 * @returns {object}
 */
function decodeDeepLink(uri) {
  const url = new URL(uri);
  const encoded = url.searchParams.get("payload");
  if (!encoded) {
    throw new Error("Missing payload parameter in deep link URI");
  }
  const json = Buffer.from(encoded, "base64url").toString("utf8");
  return JSON.parse(json);
}

/**
 * Validates the payload schema, signs a JWT, and returns the token + deep link.
 * @param {object} payload
 * @returns {{ token: string, deepLink: string }}
 */
function generateToken(payload) {
  const { valid, errors } = validateSchema(payload);
  if (!valid) {
    const err = new Error("Invalid QR payload");
    err.validationErrors = errors;
    throw err;
  }

  const secret = process.env.JWT_SECRET || "default_secret";
  const token = jwt.sign(payload, secret, { expiresIn: "1h" });
  const deepLink = encodeDeepLink(payload);

  return { token, deepLink };
}

/**
 * Verifies a JWT and returns the decoded QR payload.
 * @param {string} token
 * @returns {object}
 */
function validateToken(token) {
  const secret = process.env.JWT_SECRET || "default_secret";
  const decoded = jwt.verify(token, secret);
  // Remove JWT-specific fields
  const { iat, exp, ...payload } = decoded;
  return payload;
}

module.exports = {
  validateSchema,
  encodeDeepLink,
  decodeDeepLink,
  generateToken,
  validateToken,
};
