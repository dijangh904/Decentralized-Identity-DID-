import { useCallback } from "react";
import { resolveRoute } from "../utils/qrPayload";

const ALLOWED_TYPES = ["did", "credential", "connection"];
const SCHEME = "did-marketplace://";

/**
 * Parse a base64url-encoded string (URL-safe base64 without padding).
 */
function base64urlDecode(str) {
  // Convert base64url to standard base64
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  const padded = base64 + "==".slice(0, (4 - (base64.length % 4)) % 4);
  return atob(padded);
}

/**
 * useDeepLink hook
 *
 * Accepts a did-marketplace:// URI string and returns { route, fieldValue }
 * on success, or { error } on failure.
 *
 * @param {string} uri - The deep link URI to parse
 * @returns {{ route?: string, fieldValue?: string, error?: string }}
 */
function useDeepLink() {
  const parseDeepLink = useCallback((uri) => {
    if (!uri || typeof uri !== "string") {
      return { error: "Invalid deep link" };
    }

    if (!uri.startsWith(SCHEME)) {
      return { error: "Invalid deep link: unrecognised scheme" };
    }

    // Extract the query string portion after the path
    // Format: did-marketplace://qr?payload=<base64url>
    const queryStart = uri.indexOf("?");
    if (queryStart === -1) {
      return { error: "Invalid deep link: missing payload parameter" };
    }

    const queryString = uri.slice(queryStart + 1);
    const params = new URLSearchParams(queryString);
    const encodedPayload = params.get("payload");

    if (!encodedPayload) {
      return { error: "Invalid deep link: missing payload parameter" };
    }

    let decoded;
    try {
      decoded = base64urlDecode(encodedPayload);
    } catch {
      return { error: "Invalid deep link: payload could not be decoded" };
    }

    let payload;
    try {
      payload = JSON.parse(decoded);
    } catch {
      return { error: "Invalid deep link: payload is not valid JSON" };
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      !ALLOWED_TYPES.includes(payload.type)
    ) {
      return { error: "Invalid deep link: unrecognised payload type" };
    }

    const { route, fieldValue } = resolveRoute(payload);
    return { route, fieldValue, payload };
  }, []);

  return { parseDeepLink };
}

export default useDeepLink;
