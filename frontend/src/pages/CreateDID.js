import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  AccountBalance,
  ContentCopy,
  Refresh,
  CheckCircle,
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { toast } from "react-toastify";
import { stellarAPI } from "../services/api";
import { useWallet } from "../contexts/WalletContext";
import { handleApiError } from "../utils/errorHandler";
import ErrorDisplay from "../components/ErrorDisplay";

// --- UPDATED VALIDATION SCHEMA (ISSUE #51) ---
const schema = yup.object().shape({
  didIdentifier: yup
    .string()
    .required("DID Identifier is required")
    .min(3, "Minimum 3 characters")
    .max(32, "Maximum 32 characters")
    .matches(
      /^[a-z0-9-]+$/,
      "Only lowercase letters, numbers, and hyphens allowed",
    ),
  serviceEndpoint: yup
    .string()
    .url("Must be a valid URL (e.g., https://example.com)")
    .nullable()
    .notRequired()
    .transform((value) => (value === "" ? null : value)),
  signerSecret: yup
    .string()
    .required("Secret key is required for signing")
    .matches(
      /^S[A-Z2-7]{55}$/,
      "Invalid Stellar secret key format. Form: S...",
    ),
});

const CreateDID = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const {
    wallet,
    connectWallet,
    isConnected,
    loading: walletLoading,
  } = useWallet();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm({
    resolver: yupResolver(schema),
    mode: "onChange", // Provides real-time feedback as the user types
    defaultValues: {
      didIdentifier: "",
      serviceEndpoint: "",
      signerSecret: wallet?.secretKey || "",
    },
  });

  // Watch identifier for the live preview
  const currentIdentifier = watch("didIdentifier");

  // Update secret key when wallet changes
  React.useEffect(() => {
    if (wallet?.secretKey) {
      reset((formValues) => ({
        ...formValues,
        signerSecret: wallet.secretKey,
      }));
    }
  }, [wallet, reset]);

  const handleCreateDID = async (data) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (!isConnected) {
        await connectWallet();
      }

      if (!wallet?.publicKey) {
        throw new Error("Wallet not connected or public key missing");
      }

      // Construct the full DID string using the validated identifier
      const fullDID = `did:stellar:${wallet.publicKey}:${data.didIdentifier}`;

      const response = await stellarAPI.contracts.registerDID({
        did: fullDID,
        publicKey: wallet.publicKey,
        serviceEndpoint: data.serviceEndpoint || undefined,
        signerSecret: data.signerSecret,
      });

      setResult(response.data);
      toast.success("DID created successfully!");
      reset();
    } catch (err) {
      const errorInfo = handleApiError(err);
      setError(errorInfo);
      toast.error(errorInfo.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleCreateAccount = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await stellarAPI.contracts.createAccount();
      toast.success("New account created! Check console for details.");
      console.log("New Account:", response.data);
    } catch (err) {
      const errorInfo = handleApiError(err);
      setError(errorInfo);
      toast.error(errorInfo.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="main" aria-label="Create DID page">
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Create Decentralized Identity
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Create a new DID on the Stellar blockchain to manage your digital
        identity
      </Typography>

      <Grid container spacing={3} role="region" aria-label="Create DID form">
        {/* Wallet Connection */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AccountBalance
                  sx={{ mr: 1, color: "primary.main" }}
                  aria-hidden="true"
                />
                <Typography variant="h6" component="h2">
                  Wallet Connection
                </Typography>
              </Box>

              {!isConnected ? (
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    Connect your wallet to create a DID
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={connectWallet}
                    disabled={loading || walletLoading}
                    fullWidth
                    aria-label={
                      walletLoading
                        ? "Connecting wallet"
                        : "Connect wallet to create DID"
                    }
                    startIcon={
                      walletLoading && (
                        <CircularProgress
                          size={20}
                          color="inherit"
                          aria-hidden="true"
                        />
                      )
                    }
                  >
                    {walletLoading ? "Connecting..." : "Connect Wallet"}
                  </Button>
                </Box>
              ) : (
                <Box>
                  <Typography
                    variant="body2"
                    color="success.main"
                    sx={{ mb: 1 }}
                  >
                    <CheckCircle
                      sx={{ verticalAlign: "middle", mr: 1, fontSize: 16 }}
                      aria-hidden="true"
                    />
                    Wallet Connected
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: "background.default" }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      id="public-key-label"
                    >
                      Public Key
                    </Typography>
                    <Box display="flex" alignItems="center">
                      <Typography
                        variant="body1"
                        sx={{
                          fontFamily: "monospace",
                          mr: 1,
                          wordBreak: "break-all",
                        }}
                        aria-labelledby="public-key-label"
                      >
                        {wallet.publicKey}
                      </Typography>
                      <Tooltip title="Copy">
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(wallet.publicKey)}
                          aria-label="Copy public key to clipboard"
                        >
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Paper>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* DID Creation Form */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom component="h2">
                DID Configuration
              </Typography>

              <form
                onSubmit={handleSubmit(handleCreateDID)}
                aria-label="Create DID form"
              >
                <Controller
                  name="didIdentifier"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Unique Identifier"
                      placeholder="e.g., my-identity-01"
                      fullWidth
                      margin="normal"
                      error={!!errors.didIdentifier}
                      helperText={
                        errors.didIdentifier?.message ||
                        "Alphanumeric and hyphens only"
                      }
                    />
                  )}
                />

                <Box
                  sx={{
                    mb: 2,
                    p: 1.5,
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    border: "1px dashed",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                  >
                    DID PREVIEW:
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: "monospace",
                      fontWeight: "bold",
                      wordBreak: "break-all",
                    }}
                  >
                    did:stellar:{wallet?.publicKey || "G..."}
                    {currentIdentifier ? `:${currentIdentifier}` : ""}
                  </Typography>
                </Box>

                <Controller
                  name="serviceEndpoint"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Service Endpoint (Optional)"
                      placeholder="https://your-service.com/endpoint"
                      fullWidth
                      margin="normal"
                      error={!!errors.serviceEndpoint}
                      helperText={errors.serviceEndpoint?.message}
                    />
                  )}
                />

                <Controller
                  name="signerSecret"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Signer Secret Key"
                      type="password"
                      placeholder="SABCDEFGHIJKLMNOPQRSTUVWXYZ234567..."
                      fullWidth
                      margin="normal"
                      error={!!errors.signerSecret}
                      helperText={
                        errors.signerSecret?.message ||
                        "Stellar secret key (starts with S)"
                      }
                    />
                  )}
                />

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={
                    loading || walletLoading || !isConnected || !isValid
                  }
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  {loading ? (
                    <CircularProgress size={24} aria-hidden="true" />
                  ) : (
                    "Create DID"
                  )}
                </Button>
              </form>

              <Divider sx={{ my: 2 }} />

              <Button
                variant="outlined"
                onClick={handleCreateAccount}
                startIcon={
                  loading ? (
                    <CircularProgress size={20} aria-hidden="true" />
                  ) : (
                    <Refresh />
                  )
                }
                disabled={loading || walletLoading}
                fullWidth
              >
                {loading ? "Processing..." : "Create New Account"}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Results */}
        {result && (
          <Grid item xs={12}>
            <Card sx={{ border: "1px solid", borderColor: "success.main" }}>
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  color="success.main"
                  component="h2"
                >
                  <CheckCircle
                    sx={{ verticalAlign: "middle", mr: 1 }}
                    aria-hidden="true"
                  />
                  DID Created Successfully!
                </Typography>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, bgcolor: "background.default" }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        DID
                      </Typography>
                      <Box display="flex" alignItems="center">
                        <Typography
                          variant="body1"
                          sx={{
                            fontFamily: "monospace",
                            mr: 1,
                            wordBreak: "break-all",
                          }}
                        >
                          {result.data.did}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => copyToClipboard(result.data.did)}
                        >
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Box>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, bgcolor: "background.default" }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Transaction Hash
                      </Typography>
                      <Box display="flex" alignItems="center">
                        <Typography
                          variant="body1"
                          sx={{
                            fontFamily: "monospace",
                            mr: 1,
                            wordBreak: "break-all",
                          }}
                        >
                          {result.data.transactionHash}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() =>
                            copyToClipboard(result.data.transactionHash)
                          }
                        >
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Error Display */}
        {error && (
          <Grid item xs={12}>
            <ErrorDisplay error={error} onClose={() => setError(null)} />
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default CreateDID;
