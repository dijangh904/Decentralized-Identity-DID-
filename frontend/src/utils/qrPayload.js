/**
 * QR Payload utilities for parsing and routing QR code payloads.
 */

const ALLOWED_TYPES = ["did", "credential", "connection"];

/**
 * Parse a raw QR code string into a validated QRPayload.
 * @param {string} rawString - The decoded QR code string
 * @returns {{ ok: true, payload: object } | { ok: false, error: string }}
 */
export function parsePayload(rawString) {
  let parsed;
  try {
    parsed = JSON.parse(rawString);
  } catch {
    return { ok: false, error: "unrecognised QR code format" };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "unrecognised QR code format" };
  }

  if (!ALLOWED_TYPES.includes(parsed.type)) {
    return { ok: false, error: "unrecognised QR code format" };
  }

  return { ok: true, payload: parsed };
}

/**
 * Resolve the navigation route and field value for a given QRPayload.
 * @param {object} payload - A validated QRPayload
 * @returns {{ route: string, fieldValue: string }}
 */
export function resolveRoute(payload) {
  switch (payload.type) {
    case "did":
      return { route: "/resolve-did", fieldValue: payload.did };
    case "credential":
      return { route: "/credentials", fieldValue: payload.credentialId };
    case "connection":
      return { route: "/connect", fieldValue: payload.publicKey };
    default:
      return { route: "/", fieldValue: "" };
  }
}
