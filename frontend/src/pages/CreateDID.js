import React, { useState } from 'react';
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
  Tooltip
} from '@mui/material';
import {
  AccountBalance,
  ContentCopy,
  Refresh,
  CheckCircle,
  Error
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import { stellarAPI } from '../services/api';
import { useWallet } from '../contexts/WalletContext';
import { handleApiError } from '../utils/errorHandler';
import ErrorDisplay from '../components/ErrorDisplay';

const schema = yup.object().shape({
  serviceEndpoint: yup.string()
    .url('Must be a valid URL (e.g., https://example.com)')
    .nullable()
    .notRequired()
    .transform((value) => (value === '' ? null : value)),
  signerSecret: yup.string()
    .required('Secret key is required for signing')
    .matches(/^S[A-Z2-7]{55}$/, 'Invalid Stellar secret key format. Form: S...'),
});

const CreateDID = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const { wallet, connectWallet, isConnected, loading: walletLoading } = useWallet();

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      serviceEndpoint: '',
      signerSecret: wallet?.secretKey || '',
    },
  });

  // Update secret key when wallet changes
  React.useEffect(() => {
    if (wallet?.secretKey) {
      reset({ ...control._defaultValues, signerSecret: wallet.secretKey });
    }
  }, [wallet, reset, control._defaultValues]);

  const handleCreateDID = async (data) => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Connect wallet if not connected
      if (!isConnected) {
        await connectWallet();
      }

      if (!wallet?.publicKey) {
        throw new Error('Wallet not connected or public key missing');
      }

      const response = await stellarAPI.contracts.registerDID({
        did: `did:stellar:${wallet.publicKey}`,
        publicKey: wallet.publicKey,
        serviceEndpoint: data.serviceEndpoint || undefined,
        signerSecret: data.signerSecret
      });

      setResult(response.data);
      toast.success('DID created successfully!');
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
    toast.success('Copied to clipboard!');
  };

  const handleCreateAccount = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await stellarAPI.contracts.createAccount();
      toast.success('New account created! Check console for details.');
      console.log('New Account:', response.data);
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
        Create a new DID on the Stellar blockchain to manage your digital identity
      </Typography>

      <Grid container spacing={3} role="region" aria-label="Create DID form">
        {/* Wallet Connection */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AccountBalance sx={{ mr: 1, color: 'primary.main' }} aria-hidden="true" />
                <Typography variant="h6" component="h2">Wallet Connection</Typography>
              </Box>
              
              {!isConnected ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Connect your wallet to create a DID
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={connectWallet}
                    disabled={loading || walletLoading}
                    fullWidth
                    aria-label={walletLoading ? 'Connecting wallet' : 'Connect wallet to create DID'}
                    startIcon={walletLoading && <CircularProgress size={20} color="inherit" aria-hidden="true" />}
                  >
                    {walletLoading ? 'Connecting...' : 'Connect Wallet'}
                  </Button>
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2" color="success.main" sx={{ mb: 1 }}>
                    <CheckCircle sx={{ verticalAlign: 'middle', mr: 1, fontSize: 16 }} aria-hidden="true" />
                    Wallet Connected
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="body2" color="text.secondary" id="public-key-label">
                      Public Key
                    </Typography>
                    <Box display="flex" alignItems="center">
                      <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }} aria-labelledby="public-key-label">
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
              
              <form onSubmit={handleSubmit(handleCreateDID)} aria-label="Create DID form">
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom id="did-preview-label">
                    Your DID will be: <strong>did:stellar:{wallet?.publicKey || 'G...'}</strong>
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
                      aria-describedby={errors.serviceEndpoint ? 'service-endpoint-error' : undefined}
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
                      helperText={errors.signerSecret?.message || 'Stellar secret key (starts with S)'}
                    />
                  )}
                />

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading || walletLoading || !isConnected}
                  fullWidth
                  sx={{ mt: 2 }}
                  aria-label={loading ? 'Creating DID' : 'Create decentralized identity'}
                >
                  {loading ? <CircularProgress size={24} aria-hidden="true" /> : 'Create DID'}
                </Button>
              </form>

              <Divider sx={{ my: 2 }} />

              <Button
                variant="outlined"
                onClick={handleCreateAccount}
                startIcon={loading ? <CircularProgress size={20} aria-hidden="true" /> : <Refresh />}
                disabled={loading || walletLoading}
                fullWidth
                aria-label={loading ? 'Creating new account' : 'Create new Stellar account'}
              >
                {loading ? 'Processing...' : 'Create New Account'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Results */}
        {result && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="success.main" component="h2">
                  <CheckCircle sx={{ verticalAlign: 'middle', mr: 1 }} aria-hidden="true" />
                  DID Created Successfully!
                </Typography>
                
                <Grid container spacing={2} role="region" aria-label="DID creation results">
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" color="text.secondary" id="result-did-label">
                        DID
                      </Typography>
                      <Box display="flex" alignItems="center">
                        <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }} aria-labelledby="result-did-label">
                          {result.data.did || `did:stellar:${wallet.publicKey}`}
                        </Typography>
                        <IconButton 
                          size="small" 
                          onClick={() => copyToClipboard(result.data.did || `did:stellar:${wallet.publicKey}`)}
                          aria-label="Copy DID to clipboard"
                        >
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Box>
                    </Paper>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" color="text.secondary" id="result-tx-label">
                        Transaction Hash
                      </Typography>
                      <Box display="flex" alignItems="center">
                        <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }} aria-labelledby="result-tx-label">
                          {result.data.transactionHash}
                        </Typography>
                        <IconButton 
                          size="small" 
                          onClick={() => copyToClipboard(result.data.transactionHash)}
                          aria-label="Copy transaction hash to clipboard"
                        >
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>

                {result.data.account && (
                  <Box sx={{ mt: 2 }} role="region" aria-label="Account details">
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Account Details
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="body2" component="pre">
                        {JSON.stringify(result.data.account, null, 2)}
                      </Typography>
                    </Paper>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Error Display */}
        {error && (
          <Grid item xs={12}>
            <ErrorDisplay 
              error={error} 
              onClose={() => setError(null)} 
            />
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default CreateDID;
