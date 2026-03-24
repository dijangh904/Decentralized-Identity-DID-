import React, { useState, useEffect } from 'react';
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  AccountBalance,
  ContentCopy,
  Search,
  Refresh,
  Info,
  Timeline,
  AccountBalanceWallet,
  MonetizationOn
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
  publicKey: yup.string()
    .required('Public key is required')
    .matches(/^G[A-Z0-9]{55}$/, 'Invalid Stellar public key format'),
});

const Account = () => {
  const [loading, setLoading] = useState(false);
  const [accountInfo, setAccountInfo] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);
  const { wallet, isConnected } = useWallet();

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      publicKey: wallet?.publicKey || '',
    },
  });

  useEffect(() => {
    if (wallet?.publicKey) {
      reset({ publicKey: wallet.publicKey });
      fetchAccountInfo(wallet.publicKey);
    }
  }, [wallet, reset]);

  const fetchAccountInfo = async (publicKey) => {
    setLoading(true);
    setError('');

    try {
      const response = await stellarAPI.contracts.getAccount(publicKey);
      setAccountInfo(response.data);
      
      // Fetch recent transactions
      const txResponse = await stellarAPI.did.getTransactions(publicKey, { limit: 10 });
      setTransactions(txResponse.data.transactions || []);
      
      toast.success('Account information loaded!');
    } catch (err) {
      const errorInfo = handleApiError(err);
      setError(errorInfo);
      toast.error(errorInfo.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchAccount = async (data) => {
    fetchAccountInfo(data.publicKey);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const formatBalance = (balance) => {
    return parseFloat(balance.balance).toFixed(7) + ' ' + balance.asset_type;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Account Information
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        View Stellar account details, balances, and transaction history
      </Typography>

      <Grid container spacing={3}>
        {/* Account Search */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Search Account
              </Typography>
              
              <form onSubmit={handleSubmit(handleSearchAccount)}>
                <Controller
                  name="publicKey"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Stellar Public Key"
                      placeholder="GABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ"
                      fullWidth
                      margin="normal"
                      error={!!errors.publicKey}
                      helperText={errors.publicKey?.message || 'Format: G...'}
                      InputProps={{
                        startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                        endAdornment: wallet?.publicKey === field.value && (
                          <Chip label="Your Wallet" size="small" color="primary" />
                        )
                      }}
                    />
                  )}
                />

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <AccountBalance />}
                  sx={{ mt: 2 }}
                >
                  Get Account Info
                </Button>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={loading ? <CircularProgress size={20} /> : <Refresh />}
                    onClick={() => accountInfo && fetchAccountInfo(accountInfo.accountId)}
                    disabled={!accountInfo || loading}
                  >
                    {loading ? 'Refreshing...' : 'Refresh Data'}
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<AccountBalanceWallet />}
                    href="/create-did"
                  >
                    Create DID
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Loading State */}
        {loading && !accountInfo && (
          <Grid item xs={12}>
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={5}>
              <CircularProgress size={60} sx={{ mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Fetching Account Data...
              </Typography>
            </Box>
          </Grid>
        )}

        {/* Account Information */}
        {accountInfo && (
          <>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <AccountBalance sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Account Details</Typography>
                  </Box>
                  
                  <Paper sx={{ p: 2, bgcolor: 'background.default', mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Account ID
                    </Typography>
                    <Box display="flex" alignItems="center">
                      <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }}>
                        {accountInfo.accountId}
                      </Typography>
                      <Tooltip title="Copy Account ID">
                        <IconButton size="small" onClick={() => copyToClipboard(accountInfo.accountId)}>
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Paper>

                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Sequence Number
                    </Typography>
                    <Typography variant="body1">
                      {accountInfo.sequence}
                    </Typography>
                  </Paper>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <MonetizationOn sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Balances</Typography>
                  </Box>
                  
                  {accountInfo.balances && accountInfo.balances.length > 0 ? (
                    <List>
                      {accountInfo.balances.map((balance, index) => (
                        <ListItem key={index} divider>
                          <ListItemIcon>
                            <MonetizationOn color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary={formatBalance(balance)}
                            secondary={balance.asset_code ? `Asset: ${balance.asset_code}` : 'Native XLM'}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No balances found
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Signers */}
            {accountInfo.signers && accountInfo.signers.length > 0 && (
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      <AccountBalanceWallet sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6">Signers</Typography>
                    </Box>
                    
                    <List>
                      {accountInfo.signers.map((signer, index) => (
                        <ListItem key={index} divider>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center">
                                <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }}>
                                  {signer.key}
                                </Typography>
                                <Tooltip title="Copy Signer Key">
                                  <IconButton size="small" onClick={() => copyToClipboard(signer.key)}>
                                    <ContentCopy fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            }
                            secondary={`Weight: ${signer.weight}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Thresholds */}
            {accountInfo.thresholds && (
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      <Security sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6">Thresholds</Typography>
                    </Box>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={4}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                          <Typography variant="h6" color="primary.main">
                            {accountInfo.thresholds.low_threshold}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Low
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={4}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                          <Typography variant="h6" color="warning.main">
                            {accountInfo.thresholds.med_threshold}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Medium
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={4}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                          <Typography variant="h6" color="error.main">
                            {accountInfo.thresholds.high_threshold}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            High
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Recent Transactions */}
            {transactions.length > 0 && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      <Timeline sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6">Recent Transactions</Typography>
                    </Box>
                    
                    <List>
                      {transactions.map((tx, index) => (
                        <ListItem key={index} divider>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center">
                                <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }}>
                                  {tx.hash?.substring(0, 16)}...
                                </Typography>
                                <Tooltip title="Copy Transaction Hash">
                                  <IconButton size="small" onClick={() => copyToClipboard(tx.hash)}>
                                    <ContentCopy fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            }
                            secondary={
                              <>
                                <Typography variant="body2" color="text.secondary">
                                  Type: {tx.type || 'Unknown'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatDate(tx.created_at)}
                                </Typography>
                              </>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Raw Data */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Info sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Raw Account Data</Typography>
                  </Box>
                  
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="body2" component="pre" sx={{ 
                      fontFamily: 'monospace', 
                      fontSize: '0.8rem',
                      overflowX: 'auto',
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }}>
                      {JSON.stringify(accountInfo, null, 2)}
                    </Typography>
                  </Paper>
                </CardContent>
              </Card>
            </Grid>
          </>
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

export default Account;
