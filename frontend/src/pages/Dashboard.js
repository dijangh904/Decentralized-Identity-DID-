import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  LinearProgress,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  AccountBalance,
  VerifiedUser,
  School,
  Work,
  CreditCard,
  TrendingUp,
  Security,
  Speed,
  CloudQueue
} from '@mui/icons-material';
import { stellarAPI } from '../services/api';
import { useWallet } from '../contexts/WalletContext';
import { handleApiError } from '../utils/errorHandler';
import ErrorDisplay from '../components/ErrorDisplay';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { wallet, isConnected } = useWallet();

  useEffect(() => {
    let interval = null;
    let isMounted = true;
    const abortController = new AbortController();

    const initDashboard = async () => {
      await fetchDashboardData(abortController, isMounted);
      // Set up interval for periodic updates
      interval = setInterval(() => {
        fetchDashboardData(abortController, isMounted);
      }, 30000);
    };

    initDashboard();

    return () => {
      isMounted = false;
      abortController.abort();
      if (interval) clearInterval(interval);
    };
  }, [isConnected]);

  const fetchDashboardData = async (abortController, isMounted = true) => {
    if (!isMounted) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch contract info and stats
      const contractInfo = await stellarAPI.contracts.getInfo();
      
      if (!isMounted) return; // Check if component is still mounted
      
      setStats({
        totalDIDs: Math.floor(Math.random() * 1000) + 100,
        totalCredentials: Math.floor(Math.random() * 5000) + 500,
        activeUsers: Math.floor(Math.random() * 200) + 50,
        network: contractInfo.data.network || 'TESTNET',
        contractAddress: contractInfo.data.address,
        contractVersion: contractInfo.data.version,
        uptime: '99.9%',
        avgResponseTime: '245ms'
      });
    } catch (err) {
      if (!isMounted) return;
      setError(handleApiError(err));
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box component="main" aria-label="Dashboard">
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <LinearProgress aria-label="Loading dashboard data" />
      </Box>
    );
  }

  return (
    <Box component="main" aria-label="Stellar DID Platform Dashboard">
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Stellar DID Platform Dashboard
      </Typography>
      <Box display="flex" justifyContent="flex-end" mb={2}>
  <Button variant="outlined" onClick={fetchDashboardData} startIcon={<TrendingUp />}>
    Refresh
  </Button>
</Box>
      {error && (
        <ErrorDisplay error={error} onClose={() => setError(null)} />
      )}

      {stats && (
        <Grid container spacing={3} role="region" aria-label="Dashboard statistics">
          {/* Network Status */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <CloudQueue sx={{ mr: 1, color: 'primary.main' }} aria-hidden="true" />
                  <Typography variant="h6" component="h2">Network Status</Typography>
                </Box>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography variant="body2" color="text.secondary" id="network-label">
                    Network
                  </Typography>
                  <Chip 
                    label={stats.network} 
                    color="success" 
                    size="small" 
                    sx={{ mb: 2 }}
                    aria-labelledby="network-label"
                  />
                  <Typography variant="body2" color="text.secondary" id="contract-address-label">
                    Contract Address
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }} aria-labelledby="contract-address-label">
                    {stats.contractAddress}
                  </Typography>
                </Paper>
              </CardContent>
            </Card>
          </Grid>

          {/* Platform Statistics */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <TrendingUp sx={{ mr: 1, color: 'primary.main' }} aria-hidden="true" />
                  <Typography variant="h6" component="h2">Platform Statistics</Typography>
                </Box>
                <Grid container spacing={2} role="list" aria-label="Platform statistics list">
                  <Grid item xs={6} role="listitem">
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                      <Typography variant="h4" color="primary.main" aria-label={`${stats.totalDIDs} total DIDs`}>
                        {stats.totalDIDs}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total DIDs
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} role="listitem">
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                      <Typography variant="h4" color="secondary.main" aria-label={`${stats.totalCredentials} credentials`}>
                        {stats.totalCredentials}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Credentials
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} role="listitem">
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                      <Typography variant="h4" color="success.main" aria-label={`${stats.activeUsers} active users`}>
                        {stats.activeUsers}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Active Users
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} role="listitem">
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                      <Typography variant="h4" color="warning.main" aria-label={`${stats.uptime} uptime`}>
                        {stats.uptime}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Uptime
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Use Cases */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <VerifiedUser sx={{ mr: 1, color: 'primary.main' }} aria-hidden="true" />
                  <Typography variant="h6" component="h2">Use Cases</Typography>
                </Box>
                <List aria-label="DID use cases">
                  <ListItem>
                    <ListItemIcon>
                      <School color="primary" aria-hidden="true" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Academic Credentials" 
                      secondary="University degrees and certificates" 
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemIcon>
                      <Work color="primary" aria-hidden="true" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Professional Licensing" 
                      secondary="Medical, legal, technical licenses" 
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemIcon>
                      <CreditCard color="primary" aria-hidden="true" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Age Verification" 
                      secondary="Privacy-preserving age checks" 
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemIcon>
                      <Security color="primary" aria-hidden="true" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Identity Verification" 
                      secondary="KYC and identity proofing" 
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Performance Metrics */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <Speed sx={{ mr: 1, color: 'primary.main' }} aria-hidden="true" />
                  <Typography variant="h6" component="h2">Performance Metrics</Typography>
                </Box>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom id="response-time-label">
                    Average Response Time
                  </Typography>
                  <Typography variant="h5" color="success.main" gutterBottom aria-labelledby="response-time-label">
                    {stats.avgResponseTime}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom id="version-label">
                    Contract Version
                  </Typography>
                  <Chip 
                    label={`v${stats.contractVersion}`} 
                    color="info" 
                    size="small" 
                    aria-labelledby="version-label"
                  />
                </Paper>
              </CardContent>
            </Card>
          </Grid>

          {/* Quick Actions */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom component="h2">
                  Quick Actions
                </Typography>
                <Grid container spacing={2} role="navigation" aria-label="Quick actions">
                  <Grid item xs={12} sm={6} md={3}>
                    <Button 
                      variant="contained" 
                      fullWidth 
                      href="/create-did"
                      startIcon={<AccountBalance aria-hidden="true" />}
                      aria-label="Navigate to Create DID page"
                    >
                      Create DID
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button 
                      variant="outlined" 
                      fullWidth 
                      href="/resolve-did"
                      startIcon={<VerifiedUser aria-hidden="true" />}
                      aria-label="Navigate to Resolve DID page"
                    >
                      Resolve DID
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button 
                      variant="outlined" 
                      fullWidth 
                      href="/credentials"
                      startIcon={<School aria-hidden="true" />}
                      aria-label="Navigate to Manage Credentials page"
                    >
                      Manage Credentials
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button 
                      variant="outlined" 
                      fullWidth 
                      href="/account"
                      startIcon={<AccountBalance aria-hidden="true" />}
                      aria-label="Navigate to Account Info page"
                    >
                      Account Info
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default Dashboard;
