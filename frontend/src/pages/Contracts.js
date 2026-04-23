import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
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
  ListItemIcon,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Code,
  ContentCopy,
  Info,
  Launch,
  Refresh,
  Add,
  AccountTree,
  Security,
  Timeline,
  CheckCircle,
  Error
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { stellarAPI } from '../services/api';
import { handleApiError } from '../utils/errorHandler';
import ErrorDisplay from '../components/ErrorDisplay';

const Contracts = () => {
  const [loading, setLoading] = useState(false);
  const [contractInfo, setContractInfo] = useState(null);
  const [deployDialog, setDeployDialog] = useState(false);
  const [deployerSecret, setDeployerSecret] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    fetchContractInfo(abortController, isMounted);

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  const fetchContractInfo = async (abortController, isMounted = true) => {
    if (!isMounted) return;

    setLoading(true);
    setError(null);

    try {
      const response = await stellarAPI.contracts.getInfo();
      
      if (!isMounted) return; // Check if component is still mounted
      
      setContractInfo(response.data);
    } catch (err) {
      if (!isMounted) return;
      const errorInfo = handleApiError(err);
      setError(errorInfo);
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  const handleDeployContract = async () => {
    if (!deployerSecret) {
      toast.error('Enter your Stellar secret key (starts with S) to deploy the contract. You can find it in your wallet settings.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await stellarAPI.contracts.deploy({
        deployerSecret
      });
      
      setContractInfo(response.data);
      setDeployDialog(false);
      setDeployerSecret('');
      toast.success('Contract deployed successfully!');
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Box component="main" aria-label="Smart contracts page">
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Smart Contracts
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Manage Stellar DID Registry smart contracts
      </Typography>

      <Grid container spacing={3} role="region" aria-label="Contract management">
        {/* Contract Status */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Box display="flex" alignItems="center">
                  <AccountTree sx={{ mr: 1, color: 'primary.main' }} aria-hidden="true" />
                  <Typography variant="h6" component="h2">Contract Status</Typography>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<Refresh aria-hidden="true" />}
                  onClick={fetchContractInfo}
                  disabled={loading}
                  aria-label={loading ? 'Refreshing contract information' : 'Refresh contract information'}
                >
                  Refresh
                </Button>
              </Box>

              {loading ? (
                <Box display="flex" justifyContent="center" p={3} role="status" aria-live="polite">
                  <CircularProgress aria-label="Loading contract data" />
                </Box>
              ) : contractInfo ? (
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom id="contract-address-label">
                        Contract Address
                      </Typography>
                      <Box display="flex" alignItems="center">
                        <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }} aria-labelledby="contract-address-label">
                          {contractInfo.address}
                        </Typography>
                        <Tooltip title="Copy Contract Address">
                          <IconButton 
                            size="small" 
                            onClick={() => copyToClipboard(contractInfo.address)}
                            aria-label="Copy contract address to clipboard"
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View on Stellar Expert">
                          <IconButton 
                            size="small" 
                            href={`https://stellar.expert/explorer/testnet/account/${contractInfo.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="View contract on Stellar Expert (opens in new tab)"
                          >
                            <Launch fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom id="contract-type-label">
                        Contract Type
                      </Typography>
                      <Chip 
                        label={contractInfo.type} 
                        color="primary" 
                        size="small" 
                        aria-labelledby="contract-type-label"
                      />
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom id="version-label">
                        Version
                      </Typography>
                      <Chip 
                        label={`v${contractInfo.version}`} 
                        color="info" 
                        size="small" 
                        aria-labelledby="version-label"
                      />
                    </Paper>
                  </Grid>

                  <Grid item xs={12}>
                    <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom id="data-entries-label">
                        Data Entries
                      </Typography>
                      <Typography variant="h4" color="primary.main" aria-labelledby="data-entries-label">
                        {contractInfo.dataEntries}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total data entries stored
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              ) : (
                <Alert severity="warning" role="alert">
                  No contract information available. Deploy a new contract to get started.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Contract Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom component="h2">
                Contract Actions
              </Typography>
              
              <Grid container spacing={2} role="navigation" aria-label="Contract actions">
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<Add aria-hidden="true" />}
                    onClick={() => setDeployDialog(true)}
                    disabled={loading}
                    aria-label="Open dialog to deploy new contract"
                  >
                    Deploy New Contract
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<Security aria-hidden="true" />}
                    href="/create-did"
                    aria-label="Navigate to Register DID page"
                  >
                    Register DID
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<Code aria-hidden="true" />}
                    href="https://github.com/yourusername/stellar-did-platform/blob/main/contracts/stellar/DIDContract.js"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="View contract source code on GitHub (opens in new tab)"
                  >
                    View Source Code
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Contract Features */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Security sx={{ mr: 1, color: 'primary.main' }} aria-hidden="true" />
                <Typography variant="h6" component="h2">Contract Features</Typography>
              </Box>
              
              <List aria-label="Contract features">
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" aria-hidden="true" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="DID Registry" 
                    secondary="Register and manage decentralized identities" 
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" aria-hidden="true" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Credential Management" 
                    secondary="Issue and verify verifiable credentials" 
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" aria-hidden="true" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Access Control" 
                    secondary="Permission-based operations" 
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" aria-hidden="true" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Event Logging" 
                    secondary="Transparent audit trail" 
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Technical Details */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Info sx={{ mr: 1, color: 'primary.main' }} aria-hidden="true" />
                <Typography variant="h6" component="h2">Technical Details</Typography>
              </Box>
              
              <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="body2" component="pre" sx={{ 
                  fontFamily: 'monospace', 
                  fontSize: '0.8rem',
                  overflowX: 'auto',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }} aria-label="Contract technical details JSON">
                  {contractInfo ? JSON.stringify(contractInfo, null, 2) : 'No contract data available'}
                </Typography>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Operations */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Timeline sx={{ mr: 1, color: 'primary.main' }} aria-hidden="true" />
                <Typography variant="h6" component="h2">Recent Contract Operations</Typography>
              </Box>
              
              <Alert severity="info" role="status">
                Contract operation history will be displayed here. This feature requires additional indexing.
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Deploy Contract Dialog */}
      <Dialog 
        open={deployDialog} 
        onClose={() => setDeployDialog(false)} 
        maxWidth="sm" 
        fullWidth
        aria-labelledby="deploy-contract-dialog-title"
        aria-describedby="deploy-contract-dialog-description"
      >
        <DialogTitle id="deploy-contract-dialog-title">Deploy New Contract</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }} id="deploy-contract-dialog-description">
            Deploy a new DID Registry contract to the Stellar network. This will create a new contract account.
          </Typography>
          
          <TextField
            label="Deployer Secret Key"
            type="password"
            value={deployerSecret}
            onChange={(e) => setDeployerSecret(e.target.value)}
            fullWidth
            margin="normal"
            placeholder="Your Stellar secret key"
            helperText="Make sure this account has enough XLM for deployment"
            aria-describedby="deployer-secret-helper"
            id="deployer-secret-input"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeployDialog(false)} aria-label="Cancel contract deployment">
            Cancel
          </Button>
          <Button 
            onClick={handleDeployContract}
            variant="contained"
            disabled={loading || !deployerSecret}
            aria-label={loading ? 'Deploying contract' : 'Deploy contract'}
          >
            {loading ? <CircularProgress size={20} aria-hidden="true" /> : 'Deploy Contract'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Display */}
      {error && (
        <Grid item xs={12}>
          <ErrorDisplay 
            error={error} 
            onClose={() => setError(null)} 
          />
        </Grid>
      )}
    </Box>
  );
};

export default Contracts;
