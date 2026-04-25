import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CheckCircle,
  ContentCopy,
  ErrorOutline,
  HourglassEmpty,
  Search,
  VerifiedUser,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import { stellarAPI } from "../services/api";
import { handleApiError } from "../utils/errorHandler";
import ErrorDisplay from "../components/ErrorDisplay";

// Verification status constants
const STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  VALID: "valid",
  INVALID: "invalid",
  REVOKED: "revoked",
  ERROR: "error",
};

const STATUS_CONFIG = {
  [STATUS.VALID]: {
    color: "success",
    icon: <CheckCircle />,
    label: "Credential Valid",
    message: "This credential is authentic and has not been revoked.",
  },
  [STATUS.INVALID]: {
    color: "error",
    icon: <ErrorOutline />,
    label: "Credential Invalid",
    message: "This credential could not be verified. It may be tampered with.",
  },
  [STATUS.REVOKED]: {
    color: "warning",
    icon: <ErrorOutline />,
    label: "Credential Revoked",
    message: "This credential has been revoked by the issuer.",
  },
  [STATUS.LOADING]: {
    color: "info",
    icon: <HourglassEmpty />,
    label: "Verifying…",
    message: "Checking credential on the Stellar blockchain…",
  },
};

const STEPS = ["Enter Credential", "Verify On-Chain", "View Result"];

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard!");
};

const CredentialDetail = ({ label, value, mono = false, copyable = false }) => (
  <Box sx={{ mb: 2 }}>
    <Typography variant="caption" color="text.secondary" display="block">
      {label}
    </Typography>
    <Box display="flex" alignItems="center" gap={1}>
      <Typography
        variant="body2"
        sx={{
          fontFamily: mono ? "monospace" : "inherit",
          wordBreak: "break-all",
          flex: 1,
        }}
      >
        {value ?? "—"}
      </Typography>
      {copyable && value && (
        <Tooltip title="Copy">
          <Button
            size="small"
            onClick={() => copyToClipboard(value)}
            aria-label={`Copy ${label}`}
            sx={{ minWidth: 0, p: 0.5 }}
          >
            <ContentCopy fontSize="small" />
          </Button>
        </Tooltip>
      )}
    </Box>
  </Box>
);

const VerifyCredential = () => {
  const [credentialId, setCredentialId] = useState("");
  const [status, setStatus] = useState(STATUS.IDLE);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const activeStep =
    status === STATUS.IDLE
      ? 0
      : status === STATUS.LOADING
      ? 1
      : 2;

  const handleVerify = async () => {
    const trimmed = credentialId.trim();
    if (!trimmed) {
      toast.error("Please enter a credential ID to verify.");
      return;
    }

    setStatus(STATUS.LOADING);
    setResult(null);
    setError(null);

    try {
      const response = await stellarAPI.contracts.verifyCredential({
        credentialId: trimmed,
      });
      const data = response.data;

      if (data?.revoked) {
        setStatus(STATUS.REVOKED);
      } else if (data?.valid) {
        setStatus(STATUS.VALID);
      } else {
        setStatus(STATUS.INVALID);
      }
      setResult(data);
    } catch (err) {
      const errorInfo = handleApiError(err);
      setError(errorInfo);
      setStatus(STATUS.ERROR);
    }
  };

  const handleReset = () => {
    setCredentialId("");
    setStatus(STATUS.IDLE);
    setResult(null);
    setError(null);
  };

  const statusCfg = STATUS_CONFIG[status];

  return (
    <Box
      component="main"
      aria-label="Verify Credential page"
      sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <VerifiedUser color="primary" aria-hidden="true" />
        <Typography
          variant="h4"
          fontWeight="bold"
          sx={{ fontSize: { xs: "1.5rem", sm: "2rem", md: "2.125rem" } }}
        >
          Verify Credential
        </Typography>
      </Stack>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Enter a credential ID to check its authenticity and revocation status on
        the Stellar blockchain.
      </Typography>

      {/* Step progress */}
      <Stepper
        activeStep={activeStep}
        alternativeLabel
        sx={{ mb: 4, display: { xs: "none", sm: "flex" } }}
      >
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Grid container spacing={3}>
        {/* Input card */}
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom component="h2">
                Credential ID
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Paste the credential ID you received from the issuer.
              </Typography>

              <TextField
                label="Credential ID"
                placeholder="e.g., cred-abc123xyz"
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleVerify();
                }}
                fullWidth
                margin="normal"
                disabled={status === STATUS.LOADING}
                aria-label="Credential ID input"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              {status === STATUS.LOADING && (
                <LinearProgress
                  sx={{ mt: 1 }}
                  aria-label="Verifying credential on blockchain"
                />
              )}

              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleVerify}
                  disabled={!credentialId.trim() || status === STATUS.LOADING}
                  startIcon={
                    status === STATUS.LOADING ? (
                      <CircularProgress size={16} color="inherit" aria-hidden="true" />
                    ) : (
                      <VerifiedUser />
                    )
                  }
                  fullWidth
                  aria-label={
                    status === STATUS.LOADING
                      ? "Verifying credential, please wait"
                      : "Verify credential"
                  }
                >
                  {status === STATUS.LOADING ? "Verifying…" : "Verify"}
                </Button>
                {status !== STATUS.IDLE && (
                  <Button
                    variant="outlined"
                    onClick={handleReset}
                    disabled={status === STATUS.LOADING}
                    aria-label="Reset verification form"
                  >
                    Reset
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Result card */}
        <Grid item xs={12} md={7}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom component="h2">
                Verification Result
              </Typography>

              {status === STATUS.IDLE && (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    py: 6,
                    color: "text.disabled",
                  }}
                >
                  <VerifiedUser sx={{ fontSize: 56, mb: 1 }} aria-hidden="true" />
                  <Typography variant="body2">
                    Enter a credential ID and press Verify to see results.
                  </Typography>
                </Box>
              )}

              {statusCfg && status !== STATUS.IDLE && status !== STATUS.ERROR && (
                <>
                  <Alert
                    severity={statusCfg.color}
                    icon={statusCfg.icon}
                    sx={{ mb: 3 }}
                    role="status"
                    aria-live="polite"
                  >
                    <Typography fontWeight="bold">{statusCfg.label}</Typography>
                    <Typography variant="body2">{statusCfg.message}</Typography>
                  </Alert>

                  {/* Status badge */}
                  <Box sx={{ mb: 2 }}>
                    <Chip
                      icon={statusCfg.icon}
                      label={statusCfg.label}
                      color={statusCfg.color}
                      variant="outlined"
                      size="medium"
                      aria-label={`Credential status: ${statusCfg.label}`}
                    />
                  </Box>
                </>
              )}

              {status === STATUS.ERROR && error && (
                <ErrorDisplay error={error} onClose={() => setError(null)} />
              )}

              {/* Credential details (shown when result available) */}
              {result && status !== STATUS.LOADING && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    Credential Details
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{ p: 2, bgcolor: "background.default" }}
                  >
                    <CredentialDetail
                      label="Credential ID"
                      value={result.credentialId ?? credentialId}
                      mono
                      copyable
                    />
                    <CredentialDetail
                      label="Issuer DID"
                      value={result.issuer}
                      mono
                      copyable
                    />
                    <CredentialDetail
                      label="Subject DID"
                      value={result.subject}
                      mono
                      copyable
                    />
                    <CredentialDetail
                      label="Credential Type"
                      value={result.credentialType}
                    />
                    <CredentialDetail
                      label="Issued At"
                      value={
                        result.issuedAt
                          ? new Date(result.issuedAt).toLocaleString()
                          : undefined
                      }
                    />
                    {result.expiresAt && (
                      <CredentialDetail
                        label="Expires At"
                        value={new Date(result.expiresAt).toLocaleString()}
                      />
                    )}
                    {result.revokedAt && (
                      <CredentialDetail
                        label="Revoked At"
                        value={new Date(result.revokedAt).toLocaleString()}
                      />
                    )}
                  </Paper>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default VerifyCredential;
