import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import { CheckCircle, QrCodeScanner } from "@mui/icons-material";
import { useWallet } from "../contexts/WalletContext";
import QRScanner from "./QRScanner";

const WalletQRScanner = ({ onConnected, onClose }) => {
  const { connectWalletWithQR, wallet } = useWallet();
  const [pendingPayload, setPendingPayload] = useState(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const connectedLabel = useMemo(() => {
    if (!wallet?.publicKey) {
      return null;
    }

    return `${wallet.publicKey.slice(0, 6)}...${wallet.publicKey.slice(-4)}`;
  }, [wallet]);

  const handleScan = async (payload) => {
    setError("");
    setSuccessMessage("");
    setPendingPayload(payload);
  };

  const handleConnect = async () => {
    try {
      const connectedWallet = await connectWalletWithQR(pendingPayload?.publicKey);
      setSuccessMessage(
        `Connected ${connectedWallet.publicKey.slice(0, 6)}...${connectedWallet.publicKey.slice(-4)} from scanned QR code.`,
      );
      if (onConnected) {
        onConnected(connectedWallet);
      }
    } catch (scanError) {
      setError(scanError.message || "Failed to connect wallet from QR code");
    }
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" gutterBottom>
          Scan Wallet Connection QR
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Point your phone at a wallet connection QR code to import the public
          key into this session.
        </Typography>
      </Box>

      <QRScanner
        allowedTypes={["connection"]}
        onError={(scanError) =>
          setError(scanError.message || "Unable to read QR code")
        }
        onScan={handleScan}
        onClose={onClose}
      />

      {pendingPayload?.publicKey && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1">Scanned wallet</Typography>
              <Chip
                icon={<QrCodeScanner />}
                label={pendingPayload.publicKey}
                sx={{ maxWidth: "100%" }}
              />
              <Button variant="contained" onClick={handleConnect}>
                Connect scanned wallet
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Alert severity="success" icon={<CheckCircle fontSize="inherit" />}>
          {successMessage}
        </Alert>
      )}

      {connectedLabel && !successMessage && (
        <Alert severity="info">
          Current connected wallet: {connectedLabel}
        </Alert>
      )}

      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
};

export default WalletQRScanner;
