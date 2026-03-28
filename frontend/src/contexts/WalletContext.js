import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { handleApiError } from '../utils/errorHandler';
import secureStorage from '../utils/secureStorage';

const WalletContext = createContext(null);

export const WalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if wallet is connected on mount
  useEffect(() => {
    const savedWallet = secureStorage.getWalletData();
    if (savedWallet) {
      try {
        // Restore private key from memory if available
        const privateKey = secureStorage.getPrivateKey();
        const walletData = {
          ...savedWallet,
          // Note: secretKey is retrieved from memory, not storage
          ...(privateKey && { secretKey: privateKey }),
        };
        setWallet(walletData);
        setIsConnected(true);
      } catch (error) {
        console.error('Failed to restore wallet:', error);
        secureStorage.clearSensitiveData();
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
        // Store wallet data securely (without private keys)
        secureStorage.setWalletData(walletData);
        toast.success('Wallet connected with Freighter!');
        return walletData;
      }
    } catch (error) {
      console.log('Freighter connection failed, trying manual input...');
    }

    // Fallback to manual wallet creation
    try {
      const response = await fetch('/api/v1/contracts/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (result.success) {
        const { secretKey, ...publicWalletData } = result.data;
        
        const walletData = {
          publicKey: result.data.publicKey,
          type: 'generated',
          connectedAt: new Date().toISOString(),
        };
        
        // Store private key in memory only (not persisted to storage)
        secureStorage.setPrivateKey(secretKey);
        // Store public wallet data in secure session storage
        secureStorage.setWalletData(walletData);
        
        setWallet({
          ...walletData,
          secretKey, // Keep in memory for this session only
        });
        setIsConnected(true);
        toast.success('New wallet created and connected!');
        
        // Auto-fund testnet account
        try {
          await fetch('/api/v1/contracts/fund-account', {
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
    // Clear all sensitive data from secure storage on disconnect
    secureStorage.removeSessionData('walletData');
    secureStorage.removePrivateKey();
    toast.info('Wallet disconnected');
  }, []);

  // Get wallet balance
  const getBalance = useCallback(async () => {
    if (!wallet?.publicKey) return null;
    
    try {
      const response = await fetch(`/api/v1/contracts/account/${wallet.publicKey}`);
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
      } else {
        // Retrieve private key from memory (not from storage)
        const secretKey = secureStorage.getPrivateKey() || wallet.secretKey;
        
        if (!secretKey) {
          throw new Error('Private key not available. Please reconnect your wallet.');
        }
        
        const response = await fetch('/api/v1/contracts/sign-transaction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transactionXDR,
            secretKey,
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
