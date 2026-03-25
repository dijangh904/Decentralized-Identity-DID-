import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  Chip,
  Grid,
  Modal,
} from "@mui/material";
import {
  Search,
  ContentCopy,
  AccountBalance,
  VerifiedUser,
  Schedule,
  Info,
  QrCodeScanner,
  Close,
} from "@mui/icons-material";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { toast } from "react-toastify";
import { stellarAPI } from "../services/api";
import { handleApiError } from "../utils/errorHandler";
import ErrorDisplay from "../components/ErrorDisplay";
import QRScanner from "../components/QRScanner";

const schema = yup.object().shape({
  did: yup
    .string()
    .required("DID is required")
    .matches(
      /^did:stellar:G[A-Z0-9]{55}$/,
      "Invalid DID format. Expected: did:stellar:G...",
    ),
});

const ResolveDID = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      did: "",
    },
  });

  const handleResolveDID = async (data) => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await stellarAPI.contracts.getDID(data.did);

      setResult(response.data);
      toast.success("DID resolved successfully!");
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

  const handleScanResult = (payload) => {
    setScannerOpen(false);
    if (payload?.did) {
      reset({ did: payload.did });
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Resolve DID
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Enter a DID to resolve and view its associated identity document
      </Typography>

      <Grid container spacing={3}>
        {/* DID Resolution Form */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <form onSubmit={handleSubmit(handleResolveDID)}>
                <Controller
                  name="did"
                  control={control}
                  render={({ field }) => (
                    <Box
                      sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}
                    >
                      <TextField
                        {...field}
                        label="Decentralized Identifier (DID)"
                        placeholder="did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ"
                        fullWidth
                        margin="normal"
                        error={!!errors.did}
                        helperText={
                          errors.did?.message || "Format: did:stellar:G..."
                        }
                        InputProps={{
                          startAdornment: (
                            <Search sx={{ mr: 1, color: "text.secondary" }} />
                          ),
                        }}
                      />
                      <Tooltip title="Scan QR Code">
                        <IconButton
                          onClick={() => setScannerOpen(true)}
                          sx={{ mt: 2 }}
                          aria-label="Scan QR code for DID"
                        >
                          <QrCodeScanner />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                />

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  startIcon={
                    loading ? <CircularProgress size={20} /> : <Search />
                  }
                  sx={{ mt: 2 }}
                >
                  Resolve DID
                </Button>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Examples */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Examples
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Try these example DIDs (if available on testnet):
              </Typography>

              {[
                "did:stellar:GD5DQ6ZJ6G5ZQJQKQZQZQZQZQZQZQZQZQZQZQZQ",
                "did:stellar:GA2GB6ZJ6G5ZQJQKQZQZQZQZQZQZQZQZQZQZQZQ",
              ].map((did, index) => (
                <Paper
                  key={index}
                  sx={{
                    p: 2,
                    mb: 1,
                    bgcolor: "background.default",
                    cursor: "pointer",
                  }}
                  onClick={() => reset({ did })}
                >
                  <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                    {did}
                  </Typography>
                </Paper>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Results */}
        {result && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={3}>
                  <VerifiedUser sx={{ mr: 1, color: "success.main" }} />
                  <Typography variant="h6" color="success.main">
                    DID Document Resolved
                  </Typography>
                </Box>

                {/* Basic Information */}
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, bgcolor: "background.default" }}>
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        gutterBottom
                      >
                        DID
                      </Typography>
                      <Box display="flex" alignItems="center">
                        <Typography
                          variant="body1"
                          sx={{ fontFamily: "monospace", mr: 1 }}
                        >
                          {result.did}
                        </Typography>
                        <Tooltip title="Copy DID">
                          <IconButton
                            size="small"
                            onClick={() => copyToClipboard(result.did)}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, bgcolor: "background.default" }}>
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        gutterBottom
                      >
                        Owner
                      </Typography>
                      <Box display="flex" alignItems="center">
                        <Typography
                          variant="body1"
                          sx={{ fontFamily: "monospace", mr: 1 }}
                        >
                          {result.owner}
                        </Typography>
                        <Tooltip title="Copy Owner">
                          <IconButton
                            size="small"
                            onClick={() => copyToClipboard(result.owner)}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, bgcolor: "background.default" }}>
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        gutterBottom
                      >
                        Status
                      </Typography>
                      <Chip
                        label={result.active ? "Active" : "Inactive"}
                        color={result.active ? "success" : "error"}
                        size="small"
                      />
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, bgcolor: "background.default" }}>
                      <Typography
                        variant="subtitle2"
                        color="text.secondary"
                        gutterBottom
                      >
                        Created
                      </Typography>
                      <Box display="flex" alignItems="center">
                        <Schedule
                          sx={{ mr: 1, fontSize: 16, color: "text.secondary" }}
                        />
                        <Typography variant="body1">
                          {formatDate(result.created)}
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>

                  {result.serviceEndpoint && (
                    <Grid item xs={12}>
                      <Paper sx={{ p: 2, bgcolor: "background.default" }}>
                        <Typography
                          variant="subtitle2"
                          color="text.secondary"
                          gutterBottom
                        >
                          Service Endpoint
                        </Typography>
                        <Box display="flex" alignItems="center">
                          <Typography variant="body1" sx={{ mr: 1 }}>
                            {result.serviceEndpoint}
                          </Typography>
                          <Tooltip title="Copy Service Endpoint">
                            <IconButton
                              size="small"
                              onClick={() =>
                                copyToClipboard(result.serviceEndpoint)
                              }
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Paper>
                    </Grid>
                  )}

                  {result.updated && result.updated !== result.created && (
                    <Grid item xs={12}>
                      <Paper sx={{ p: 2, bgcolor: "background.default" }}>
                        <Typography
                          variant="subtitle2"
                          color="text.secondary"
                          gutterBottom
                        >
                          Last Updated
                        </Typography>
                        <Box display="flex" alignItems="center">
                          <Schedule
                            sx={{
                              mr: 1,
                              fontSize: 16,
                              color: "text.secondary",
                            }}
                          />
                          <Typography variant="body1">
                            {formatDate(result.updated)}
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  )}
                </Grid>

                <Divider sx={{ my: 3 }} />

                {/* Raw JSON */}
                <Box>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    gutterBottom
                  >
                    <Info sx={{ verticalAlign: "middle", mr: 1 }} />
                    Raw DID Document
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: "background.default" }}>
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "0.8rem",
                        overflowX: "auto",
                        maxHeight: "300px",
                        overflowY: "auto",
                      }}
                    >
                      {JSON.stringify(result, null, 2)}
                    </Typography>
                  </Paper>
                </Box>
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

      {/* QR Scanner Modal */}
      <Modal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        aria-label="QR code scanner modal"
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: { xs: "95vw", sm: 480 },
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 2,
          }}
        >
          <QRScanner
            allowedTypes={["did"]}
            onScan={handleScanResult}
            onClose={() => setScannerOpen(false)}
          />
        </Box>
      </Modal>
    </Box>
  );
};

export default ResolveDID;
