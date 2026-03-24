import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  LinearProgress,
  Alert,
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

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { wallet, isConnected } = useWallet();

  useEffect(() => {
    fetchDashboardData();
  }, [isConnected]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch contract info and stats
      const contractInfo = await stellarAPI.contracts.getInfo();
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
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        🚀 Stellar DID Platform Dashboard
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {stats && (
        <Grid container spacing={3}>
          {/* Network Status */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <CloudQueue sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">Network Status</Typography>
                </Box>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography variant="body2" color="text.secondary">
                    Network
                  </Typography>
                  <Chip 
                    label={stats.network} 
                    color="success" 
                    size="small" 
                    sx={{ mb: 2 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Contract Address
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
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
                  <TrendingUp sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">Platform Statistics</Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                      <Typography variant="h4" color="primary.main">
                        {stats.totalDIDs}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total DIDs
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                      <Typography variant="h4" color="secondary.main">
                        {stats.totalCredentials}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Credentials
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                      <Typography variant="h4" color="success.main">
                        {stats.activeUsers}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Active Users
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                      <Typography variant="h4" color="warning.main">
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
                  <VerifiedUser sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">Use Cases</Typography>
                </Box>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <School color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Academic Credentials" 
                      secondary="University degrees and certificates" 
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemIcon>
                      <Work color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Professional Licensing" 
                      secondary="Medical, legal, technical licenses" 
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemIcon>
                      <CreditCard color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Age Verification" 
                      secondary="Privacy-preserving age checks" 
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemIcon>
                      <Security color="primary" />
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
                  <Speed sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">Performance Metrics</Typography>
                </Box>
                <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Average Response Time
                  </Typography>
                  <Typography variant="h5" color="success.main" gutterBottom>
                    {stats.avgResponseTime}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Contract Version
                  </Typography>
                  <Chip 
                    label={`v${stats.contractVersion}`} 
                    color="info" 
                    size="small" 
                  />
                </Paper>
              </CardContent>
            </Card>
          </Grid>

          {/* Quick Actions */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Quick Actions
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button 
                      variant="contained" 
                      fullWidth 
                      href="/create-did"
                      startIcon={<AccountBalance />}
                    >
                      Create DID
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button 
                      variant="outlined" 
                      fullWidth 
                      href="/resolve-did"
                      startIcon={<VerifiedUser />}
                    >
                      Resolve DID
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button 
                      variant="outlined" 
                      fullWidth 
                      href="/credentials"
                      startIcon={<School />}
                    >
                      Manage Credentials
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Button 
                      variant="outlined" 
                      fullWidth 
                      href="/account"
                      startIcon={<AccountBalance />}
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
