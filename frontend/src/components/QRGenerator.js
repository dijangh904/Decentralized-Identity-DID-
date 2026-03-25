import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import { Download } from "@mui/icons-material";
import { stellarAPI } from "../services/api";
import { handleApiError } from "../utils/errorHandler";

const MIN_SIZE = 256;

/**
 * Truncate a string to maxLen characters, appending '…' if truncated.
 */
function truncate(str, maxLen = 20) {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
}

/**
 * Return the primary identifier for a payload (for the label).
 */
function getPayloadId(payload) {
  if (!payload) return "";
  switch (payload.type) {
    case "did":
      return payload.did;
    case "credential":
      return payload.credentialId;
    case "connection":
      return payload.publicKey;
    default:
      return "";
  }
}

/**
 * QRGenerator component
 *
 * Props:
 *   payload  — QRPayload object to encode
 *   size     — canvas size in px (default 256, minimum 256)
 */
const QRGenerator = ({ payload, size = MIN_SIZE }) => {
  const canvasRef = useRef(null);
  const [deepLink, setDeepLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const effectiveSize = Math.max(size, MIN_SIZE);

  useEffect(() => {
    if (!payload) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDeepLink(null);

    stellarAPI.qr
      .generate(payload)
      .then((response) => {
        if (cancelled) return;
        const { deepLink: dl } = response.data?.data || response.data || {};
        if (!dl) throw new Error("No deepLink in response");
        setDeepLink(dl);
        return QRCode.toCanvas(canvasRef.current, dl, {
          width: effectiveSize,
          margin: 2,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        const info = handleApiError(err);
        setError(info.message || "Failed to generate QR code");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [payload, effectiveSize]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${payload?.type || "code"}.png`;
    a.click();
  };

  const label = payload
    ? `${payload.type}: ${truncate(getPayloadId(payload))}`
    : "";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      {loading && <CircularProgress />}

      {error && (
        <Alert severity="error" sx={{ width: "100%" }}>
          {error}
        </Alert>
      )}

      <canvas
        ref={canvasRef}
        width={effectiveSize}
        height={effectiveSize}
        style={{
          display: loading || error ? "none" : "block",
          borderRadius: 4,
        }}
        aria-label={`QR code for ${label}`}
      />

      {!loading && !error && deepLink && (
        <>
          {/* Human-readable label */}
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>

          {/* Raw deep link URI */}
          <Typography
            variant="caption"
            sx={{
              fontFamily: "monospace",
              wordBreak: "break-all",
              textAlign: "center",
              maxWidth: effectiveSize,
            }}
          >
            {deepLink}
          </Typography>

          {/* Download button */}
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleDownload}
            size="small"
          >
            Download PNG
          </Button>
        </>
      )}
    </Box>
  );
};

export default QRGenerator;
