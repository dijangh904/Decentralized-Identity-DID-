import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { handleApiError } from '../utils/errorHandler';

const WalletContext = createContext(null);

export const WalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if wallet is connected on mount
  useEffect(() => {
    const savedWallet = localStorage.getItem('stellarWallet');
    if (savedWallet) {
      try {
        const walletData = JSON.parse(savedWallet);
        setWallet(walletData);
        setIsConnected(true);
      } catch (error) {
        console.error('Failed to parse saved wallet:', error);
        localStorage.removeItem('stellarWallet');
      }
    }
  }, []);

  // Connect wallet using Freighter or manual input
  const connectWallet = useCallback(async () => {
    setLoading(true);
    
    try {
      // Try to connect with Freighter first
      if (window.freighter && window.freighter.isConnected()) {
        const publicKey = await window.freighter.getPublicKey();
        const walletData = {
          publicKey,
          type: 'freighter',
          connectedAt: new Date().toISOString(),
        };
        
        setWallet(walletData);
        setIsConnected(true);
        localStorage.setItem('stellarWallet', JSON.stringify(walletData));
        toast.success('Wallet connected with Freighter!');
        return walletData;
      }
    } catch (error) {
      console.log('Freighter connection failed, trying manual input...');
    }

    // Fallback to manual wallet creation
    try {
      const response = await fetch('http://localhost:3001/api/v1/contracts/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (result.success) {
        const walletData = {
          publicKey: result.data.publicKey,
          secretKey: result.data.secretKey,
          type: 'generated',
          connectedAt: new Date().toISOString(),
        };
        
        setWallet(walletData);
        setIsConnected(true);
        localStorage.setItem('stellarWallet', JSON.stringify(walletData));
        toast.success('New wallet created and connected!');
        
        // Auto-fund testnet account
        try {
          await fetch('http://localhost:3001/api/v1/contracts/fund-account', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              publicKey: result.data.publicKey,
            }),
          });
          toast.success('Testnet account funded!');
        } catch (fundError) {
          console.warn('Failed to fund account:', fundError);
        }
        
        return walletData;
      }
      throw new Error('Failed to create account');
    } catch (error) {
      const errorInfo = handleApiError(error);
      toast.error(errorInfo.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setWallet(null);
    setIsConnected(false);
    localStorage.removeItem('stellarWallet');
    toast.info('Wallet disconnected');
  }, []);

  // Get wallet balance
  const getBalance = useCallback(async () => {
    if (!wallet?.publicKey) return null;
    
    try {
      const response = await fetch(`http://localhost:3001/api/v1/contracts/account/${wallet.publicKey}`);
      const result = await response.json();
      
      if (result.success) {
        return result.data.balances;
      }
    } catch (error) {
      console.error('Failed to get balance:', error);
    }
    
    return null;
  }, [wallet]);

  // Sign transaction
  const signTransaction = useCallback(async (transactionXDR) => {
    if (!wallet) throw new Error('Wallet not connected');
    
    try {
      if (wallet.type === 'freighter') {
        const signedXDR = await window.freighter.signTransaction(transactionXDR);
        return signedXDR;
      } else if (wallet.secretKey) {
        const response = await fetch('http://localhost:3001/api/v1/contracts/sign-transaction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transactionXDR,
            secretKey: wallet.secretKey,
          }),
        });
        
        const result = await response.json();
        if (result.success) {
          return result.data.signedXDR;
        }
      }
      
      throw new Error('Failed to sign transaction');
    } catch (error) {
      console.error('Transaction signing failed:', error);
      throw error;
    }
  }, [wallet]);

  const value = {
    wallet,
    isConnected,
    loading,
    connectWallet,
    disconnectWallet,
    getBalance,
    signTransaction,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
