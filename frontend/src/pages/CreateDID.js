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
  serviceEndpoint: yup.string().url('Must be a valid URL').optional(),
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
    },
  });

  const handleCreateDID = async (data) => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Connect wallet if not connected
      if (!isConnected) {
        await connectWallet();
      }

      const response = await stellarAPI.post('/contracts/register-did', {
        did: `did:stellar:${wallet.publicKey}`,
        publicKey: wallet.publicKey,
        serviceEndpoint: data.serviceEndpoint || undefined,
        signerSecret: wallet.secretKey // In production, this should be handled securely
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
    try {
      const response = await stellarAPI.post('/contracts/create-account');
      toast.success('New account created! Check console for details.');
      console.log('New Account:', response.data);
    } catch (err) {
      toast.error('Failed to create account');
    } finally {
      setLoading(false);
    }
  };



  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Create Decentralized Identity
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Create a new DID on the Stellar blockchain to manage your digital identity
      </Typography>

      <Grid container spacing={3}>
        {/* Wallet Connection */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AccountBalance sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Wallet Connection</Typography>
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
                    startIcon={walletLoading && <CircularProgress size={20} color="inherit" />}
                  >
                    {walletLoading ? 'Connecting...' : 'Connect Wallet'}
                  </Button>
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2" color="success.main" sx={{ mb: 1 }}>
                    <CheckCircle sx={{ verticalAlign: 'middle', mr: 1, fontSize: 16 }} />
                    Wallet Connected
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="body2" color="text.secondary">
                      Public Key
                    </Typography>
                    <Box display="flex" alignItems="center">
                      <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }}>
                        {wallet.publicKey}
                      </Typography>
                      <Tooltip title="Copy">
                        <IconButton size="small" onClick={() => copyToClipboard(wallet.publicKey)}>
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
              <Typography variant="h6" gutterBottom>
                DID Configuration
              </Typography>
              
              <form onSubmit={handleSubmit(handleCreateDID)}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
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
                >
                  {loading ? <CircularProgress size={24} /> : 'Create DID'}
                </Button>
              </form>

              <Divider sx={{ my: 2 }} />

              <Button
                variant="outlined"
                onClick={handleCreateAccount}
                startIcon={loading ? <CircularProgress size={20} /> : <Refresh />}
                disabled={loading || walletLoading}
                fullWidth
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
                <Typography variant="h6" gutterBottom color="success.main">
                  <CheckCircle sx={{ verticalAlign: 'middle', mr: 1 }} />
                  DID Created Successfully!
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        DID
                      </Typography>
                      <Box display="flex" alignItems="center">
                        <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }}>
                          {result.data.did || `did:stellar:${wallet.publicKey}`}
                        </Typography>
                        <IconButton size="small" onClick={() => copyToClipboard(result.data.did || `did:stellar:${wallet.publicKey}`)}>
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Box>
                    </Paper>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Transaction Hash
                      </Typography>
                      <Box display="flex" alignItems="center">
                        <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }}>
                          {result.data.transactionHash}
                        </Typography>
                        <IconButton size="small" onClick={() => copyToClipboard(result.data.transactionHash)}>
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>

                {result.data.account && (
                  <Box sx={{ mt: 2 }}>
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
