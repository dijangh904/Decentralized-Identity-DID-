import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Modal,
  Stack,
  Typography,
} from "@mui/material";
import {
  AccountBalanceWallet,
  QrCodeScanner,
  Smartphone,
} from "@mui/icons-material";
import { useWallet } from "../contexts/WalletContext";
import WalletQRScanner from "../components/WalletQRScanner";

const ConnectWallet = () => {
  const location = useLocation();
  const { connectWallet, connectWalletWithQR, wallet, isConnected, loading } =
    useWallet();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const scannedPublicKey = useMemo(
    () => location.state?.fieldValue || "",
    [location.state],
  );

  const handleStandardConnect = async () => {
    setError("");
    setStatus("");

    try {
      const connectedWallet = await connectWallet();
      setStatus(
        `Connected ${connectedWallet.publicKey.slice(0, 6)}...${connectedWallet.publicKey.slice(-4)} using the default wallet flow.`,
      );
    } catch (connectError) {
      setError(connectError.message || "Failed to connect wallet");
    }
  };

  const handleQrConnect = async () => {
    if (!scannedPublicKey) {
      return;
    }

    setError("");
    setStatus("");

    try {
      const connectedWallet = await connectWalletWithQR(scannedPublicKey);
      setStatus(
        `Connected ${connectedWallet.publicKey.slice(0, 6)}...${connectedWallet.publicKey.slice(-4)} from a scanned connection payload.`,
      );
    } catch (connectError) {
      setError(connectError.message || "Failed to connect scanned wallet");
    }
  };

  return (
    <Box component="main" aria-label="Connect wallet page">
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Connect Wallet
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Use the standard wallet flow on desktop, or open the QR scanner on
        mobile to connect from a wallet connection code.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <AccountBalanceWallet color="primary" />
                  <Typography variant="h6">Standard wallet connection</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  This uses the existing Freighter or generated test wallet flow.
                </Typography>
                <Button
                  variant="contained"
                  onClick={handleStandardConnect}
                  disabled={loading}
                >
                  {loading ? "Connecting..." : "Connect wallet"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Smartphone color="primary" />
                  <Typography variant="h6">Mobile QR connection</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Scan a `connection` QR code to import a wallet public key with
                  the phone camera.
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<QrCodeScanner />}
                  onClick={() => setScannerOpen(true)}
                >
                  Open QR scanner
                </Button>
                {scannedPublicKey && (
                  <Alert
                    severity="info"
                    action={
                      <Button color="inherit" size="small" onClick={handleQrConnect}>
                        Connect
                      </Button>
                    }
                  >
                    Scanned connection payload ready: {scannedPublicKey}
                  </Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {(status || error || isConnected) && (
          <Grid item xs={12}>
            <Stack spacing={2}>
              {status && <Alert severity="success">{status}</Alert>}
              {error && <Alert severity="error">{error}</Alert>}
              {isConnected && wallet?.publicKey && (
                <Alert severity="success">
                  Active wallet: {wallet.publicKey}
                </Alert>
              )}
            </Stack>
          </Grid>
        )}
      </Grid>

      <Modal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        aria-label="Wallet QR scanner modal"
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: { xs: "95vw", sm: 540 },
            maxHeight: "90vh",
            overflowY: "auto",
            bgcolor: "background.paper",
            borderRadius: 3,
            boxShadow: 24,
            p: 2,
          }}
        >
          <WalletQRScanner
            onClose={() => setScannerOpen(false)}
            onConnected={() => setScannerOpen(false)}
          />
        </Box>
      </Modal>
    </Box>
  );
};

export default ConnectWallet;
