import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  useTheme,
  useMediaQuery,
  Divider
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountTree,
  AccountBalance,
  VerifiedUser,
  School,
  Info,
  GitHub,
  LightMode,
  DarkMode
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';

const Navbar = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { wallet, isConnected, connectWallet, disconnectWallet, loading } = useWallet();
  const [anchorEl, setAnchorEl] = useState(null);

  const menuItems = [
    { label: 'Dashboard', path: '/', icon: <Info /> },
    { label: 'Create DID', path: '/create-did', icon: <AccountBalance /> },
    { label: 'Resolve DID', path: '/resolve-did', icon: <VerifiedUser /> },
    { label: 'Credentials', path: '/credentials', icon: <School /> },
    { label: 'Account', path: '/account', icon: <AccountBalance /> },
    { label: 'Contracts', path: '/contracts', icon: <AccountTree /> },
  ];

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNavigation = (path) => {
    navigate(path);
    handleMenuClose();
  };

  return (
    <AppBar position="static" elevation={2}>
      <Toolbar>
        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          <AccountTree sx={{ mr: 1, fontSize: 28 }} />
          <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
            Stellar DID Platform
          </Typography>
        </Box>

        {/* Desktop Navigation */}
        {!isMobile && (
          <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
            {menuItems.map((item) => (
              <Button
                key={item.path}
                color="inherit"
                onClick={() => handleNavigation(item.path)}
                sx={{
                  backgroundColor: location.pathname === item.path ? 'rgba(255,255,255,0.1)' : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.2)',
                  },
                }}
                startIcon={item.icon}
              >
                {item.label}
              </Button>
            ))}
          </Box>
        )}

        {/* Wallet Status & Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!isMobile && (
            <>
              {isConnected ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={`Connected: ${wallet?.publicKey?.substring(0, 8)}...`}
                    color="success"
                    size="small"
                    variant="outlined"
                    sx={{ borderColor: 'white', color: 'white' }}
                  />
                  <Button color="inherit" onClick={disconnectWallet} size="small" disabled={loading}>
                    Disconnect
                  </Button>
                </Box>
              ) : (
                <Button color="inherit" onClick={connectWallet} variant="outlined" disabled={loading}>
                  {loading ? 'Connecting...' : 'Connect Wallet'}
                </Button>
              )}
              
              <IconButton
                color="inherit"
                href="https://github.com/yourusername/stellar-did-platform"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GitHub />
              </IconButton>
            </>
          )}

          {/* Mobile Menu */}
          {isMobile && (
            <>
              <IconButton
                color="inherit"
                onClick={handleMenuOpen}
              >
                <MenuIcon />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                {menuItems.map((item) => (
                  <MenuItem
                    key={item.path}
                    onClick={() => handleNavigation(item.path)}
                    selected={location.pathname === item.path}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {item.icon}
                      <Typography sx={{ ml: 1 }}>{item.label}</Typography>
                    </Box>
                  </MenuItem>
                ))}
                
                <Divider />
                
                {isConnected ? (
                  <MenuItem onClick={disconnectWallet}>
                    <Typography color="success.main">
                      Connected: {wallet?.publicKey?.substring(0, 8)}...
                    </Typography>
                  </MenuItem>
                ) : (
                  <MenuItem onClick={connectWallet} disabled={loading}>
                    <Typography>{loading ? 'Connecting...' : 'Connect Wallet'}</Typography>
                  </MenuItem>
                )}
                
                <MenuItem
                  component="a"
                  href="https://github.com/yourusername/stellar-did-platform"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <GitHub sx={{ mr: 1 }} />
                    GitHub
                  </Box>
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
