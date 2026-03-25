import React, { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  IconButton,
} from "@mui/material";
import { CameraAlt, Stop, Cameraswitch, Close } from "@mui/icons-material";
import { parsePayload } from "../utils/qrPayload";

const SCANNER_ID = "qr-scanner-viewfinder";

/**
 * QRScanner component
 *
 * Props:
 *   onScan(payload)   — called when a valid QR payload is decoded
 *   onError(error)    — called on camera / parse errors
 *   onClose()         — called when the user dismisses the scanner
 *   allowedTypes      — optional string[] to filter payload types
 */
const QRScanner = ({ onScan, onError, onClose, allowedTypes }) => {
  const scannerRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [noCamera, setNoCamera] = useState(false);
  const [streamInterrupted, setStreamInterrupted] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [manualInput, setManualInput] = useState("");

  // Initialise scanner and enumerate cameras on mount
  useEffect(() => {
    let cancelled = false;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (cancelled) return;
        if (!devices || devices.length === 0) {
          setNoCamera(true);
          return;
        }
        setCameras(devices);
        // Auto-start scanning
        startScanner(devices, 0);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err?.message || String(err);
        if (
          msg.toLowerCase().includes("permission") ||
          msg.toLowerCase().includes("denied") ||
          msg.toLowerCase().includes("notallowed")
        ) {
          setPermissionDenied(true);
        } else if (
          msg.toLowerCase().includes("no camera") ||
          msg.toLowerCase().includes("notfound") ||
          msg.toLowerCase().includes("devicenotfound")
        ) {
          setNoCamera(true);
        } else {
          setError("Unable to access camera: " + msg);
        }
        if (onError) onError(new Error(msg));
      });

    return () => {
      cancelled = true;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startScanner = useCallback(
    (deviceList, cameraIdx) => {
      const devices = deviceList || cameras;
      if (!devices || devices.length === 0) return;

      const cameraId = devices[cameraIdx ?? currentCameraIndex]?.id;
      if (!cameraId) return;

      // Destroy previous instance if any
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            scannerRef.current.clear();
            scannerRef.current = null;
            createAndStart(cameraId);
          });
      } else {
        createAndStart(cameraId);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cameras, currentCameraIndex, allowedTypes, onScan, onError],
  );

  const createAndStart = (cameraId) => {
    const html5QrCode = new Html5Qrcode(SCANNER_ID, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    scannerRef.current = html5QrCode;

    html5QrCode
      .start(
        { deviceId: { exact: cameraId } },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => handleDecode(decodedText),
        () => {}, // ignore per-frame errors
      )
      .then(() => {
        setScanning(true);
        setStreamInterrupted(false);
        setError(null);
      })
      .catch((err) => {
        const msg = err?.message || String(err);
        if (
          msg.toLowerCase().includes("permission") ||
          msg.toLowerCase().includes("denied")
        ) {
          setPermissionDenied(true);
        } else {
          setStreamInterrupted(true);
          setError("Camera stream interrupted: " + msg);
        }
        setScanning(false);
        if (onError) onError(new Error(msg));
      });
  };

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .catch(() => {})
        .finally(() => {
          if (scannerRef.current) {
            scannerRef.current.clear();
            scannerRef.current = null;
          }
          setScanning(false);
        });
    }
  }, []);

  const handleDecode = (decodedText) => {
    const result = parsePayload(decodedText);
    if (!result.ok) {
      setError("unrecognised QR code format");
      setStatusMessage("Scan failed: unrecognised QR code format");
      if (onError) onError(new Error(result.error));
      return;
    }

    const { payload } = result;

    // Filter by allowedTypes if provided
    if (
      allowedTypes &&
      allowedTypes.length > 0 &&
      !allowedTypes.includes(payload.type)
    ) {
      setError(`QR code type "${payload.type}" is not allowed here`);
      setStatusMessage(`Scan failed: type "${payload.type}" not allowed`);
      return;
    }

    setError(null);
    setStatusMessage(`Scanned: ${payload.type}`);
    if (onScan) onScan(payload);
  };

  const handleSwitchCamera = () => {
    if (cameras.length < 2) return;
    const nextIdx = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIdx);
    startScanner(cameras, nextIdx);
  };

  const handleRetry = () => {
    setStreamInterrupted(false);
    setError(null);
    startScanner(cameras, currentCameraIndex);
  };

  const handleManualSubmit = () => {
    if (!manualInput.trim()) return;
    handleDecode(manualInput.trim());
  };

  const handleManualKeyDown = (e) => {
    if (e.key === "Enter") handleManualSubmit();
  };

  const handleStartKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ")
      startScanner(cameras, currentCameraIndex);
  };

  const handleStopKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") stopScanner();
  };

  const handleSwitchKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") handleSwitchCamera();
  };

  const showFallback = permissionDenied || noCamera;

  return (
    <Box sx={{ position: "relative", p: 2 }}>
      {/* Close button */}
      {onClose && (
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", top: 8, right: 8 }}
          aria-label="Close scanner"
        >
          <Close />
        </IconButton>
      )}

      <Typography variant="h6" gutterBottom>
        QR Code Scanner
      </Typography>

      {/* Error / status alerts */}
      {permissionDenied && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Camera access is required to scan QR codes. Please allow camera
          permission in your browser settings and try again.
        </Alert>
      )}

      {noCamera && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No camera device found on this device.
        </Alert>
      )}

      {streamInterrupted && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Retry
            </Button>
          }
        >
          Camera stream was interrupted.
        </Alert>
      )}

      {error && !permissionDenied && !noCamera && !streamInterrupted && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Camera viewfinder */}
      {!showFallback && (
        <Box
          id={SCANNER_ID}
          aria-label="QR code scanner viewfinder"
          sx={{
            width: "100%",
            minHeight: 300,
            bgcolor: "background.default",
            borderRadius: 1,
            overflow: "hidden",
            mb: 2,
          }}
        />
      )}

      {/* Camera controls */}
      {!showFallback && (
        <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
          <Button
            variant="contained"
            startIcon={<CameraAlt />}
            onClick={() => startScanner(cameras, currentCameraIndex)}
            onKeyDown={handleStartKeyDown}
            disabled={scanning}
            aria-label="Start scanning"
          >
            Start
          </Button>
          <Button
            variant="outlined"
            startIcon={<Stop />}
            onClick={stopScanner}
            onKeyDown={handleStopKeyDown}
            disabled={!scanning}
            aria-label="Stop scanning"
          >
            Stop
          </Button>
          {cameras.length > 1 && (
            <Button
              variant="outlined"
              startIcon={<Cameraswitch />}
              onClick={handleSwitchCamera}
              onKeyDown={handleSwitchKeyDown}
              aria-label="Switch camera"
            >
              Switch Camera
            </Button>
          )}
        </Box>
      )}

      {/* Manual text-input fallback */}
      {showFallback && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Enter or paste a QR payload string manually:
          </Typography>
          <TextField
            fullWidth
            label="QR Payload"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={handleManualKeyDown}
            placeholder='{"type":"did","did":"did:stellar:G..."}'
            multiline
            rows={3}
            sx={{ mb: 1 }}
          />
          <Button variant="contained" onClick={handleManualSubmit}>
            Submit
          </Button>
        </Box>
      )}

      {/* ARIA live region */}
      <div
        role="status"
        aria-live="polite"
        style={{ position: "absolute", left: -9999 }}
      >
        {statusMessage}
      </div>
    </Box>
  );
};

export default QRScanner;
