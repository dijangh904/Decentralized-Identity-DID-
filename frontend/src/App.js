import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Credentials from './pages/Credentials';
import PerformanceTest from './pages/PerformanceTest';
import CreateDID from './pages/CreateDID';
import ResolveDID from './pages/ResolveDID';
import ConnectWallet from './pages/ConnectWallet';
import Account from './pages/Account';
import Scanner from './pages/Scanner';
import Contracts from './pages/Contracts';
import ErrorDisplay from './components/ErrorDisplay';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <div className="App">
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/credentials" element={<Credentials />} />
              <Route path="/performance-test" element={<PerformanceTest />} />
              <Route path="/create-did" element={<CreateDID />} />
              <Route path="/resolve-did" element={<ResolveDID />} />
              <Route path="/connect-wallet" element={<ConnectWallet />} />
              <Route path="/account" element={<Account />} />
              <Route path="/scanner" element={<Scanner />} />
              <Route path="/contracts" element={<Contracts />} />
            </Routes>
          </main>
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
          />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;