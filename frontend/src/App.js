import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Contexts
import { WalletProvider } from './contexts/WalletContext';

// Components
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import CreateDID from './pages/CreateDID';
import ResolveDID from './pages/ResolveDID';
import Credentials from './pages/Credentials';
import Account from './pages/Account';
import Contracts from './pages/Contracts';

// Theme configuration
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#667eea',
      light: '#8b9dc3',
      dark: '#4a5f8a',
    },
    secondary: {
      main: '#764ba2',
      light: '#9a6fb8',
      dark: '#5a3580',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
    },
    h2: {
      fontWeight: 600,
      fontSize: '2rem',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <WalletProvider>
        <Router>
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/create-did" element={<CreateDID />} />
                <Route path="/resolve-did" element={<ResolveDID />} />
                <Route path="/credentials" element={<Credentials />} />
                <Route path="/account" element={<Account />} />
                <Route path="/contracts" element={<Contracts />} />
              </Routes>
            </Box>
          </Box>
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
          />
        </Router>
      </WalletProvider>
    </ThemeProvider>
  );
}

export default App;
