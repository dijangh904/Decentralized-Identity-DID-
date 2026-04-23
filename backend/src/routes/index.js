const express = require('express');
const router = express.Router();

// Stellar configuration (server-side only)
const stellarConfig = {
  network: process.env.STELLAR_NETWORK || 'TESTNET',
  horizonUrl: process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  passphrase: process.env.STELLAR_PASSPHRASE || 'Test SDF Network ; September 2015',
  friendbotUrl: process.env.STELLAR_FRIENDBOT_URL || 'https://friendbot.stellar.org',
};

// Secure account creation
router.post('/contracts/create-account', async (req, res) => {
  try {
    const StellarSdk = require('stellar-sdk');
    const pair = StellarSdk.Keypair.random();
    
    const accountData = {
      publicKey: pair.publicKey(),
      secretKey: pair.secret(), // This will be sent to frontend but should be handled securely
      network: stellarConfig.network,
    };
    
    res.json({
      success: true,
      data: accountData,
    });
  } catch (error) {
    console.error('Account creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account',
    });
  }
});

// Secure account funding
router.post('/contracts/fund-account', async (req, res) => {
  try {
    const { publicKey } = req.body;
    
    if (!publicKey) {
      return res.status(400).json({
        success: false,
        error: 'Public key is required',
      });
    }
    
    // Use Friendbot for testnet funding
    if (stellarConfig.network === 'TESTNET') {
      const response = await fetch(`${stellarConfig.friendbotUrl}?addr=${publicKey}`);
      
      if (response.ok) {
        const result = await response.json();
        res.json({
          success: true,
          data: result,
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to fund account',
        });
      }
    } else {
      res.status(400).json({
        success: false,
        error: 'Account funding only available on testnet',
      });
    }
  } catch (error) {
    console.error('Account funding error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fund account',
    });
  }
});

// Secure account balance
router.get('/contracts/account/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    const StellarSdk = require('stellar-sdk');
    const server = new StellarSdk.Server(stellarConfig.horizonUrl);
    
    const account = await server.loadAccount(publicKey);
    
    res.json({
      success: true,
      data: {
        balances: account.balances,
        sequence: account.sequence,
      },
    });
  } catch (error) {
    console.error('Account balance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get account balance',
    });
  }
});

// Secure transaction signing
router.post('/contracts/sign-transaction', async (req, res) => {
  try {
    const { transactionXDR, secretKey } = req.body;
    
    if (!transactionXDR || !secretKey) {
      return res.status(400).json({
        success: false,
        error: 'Transaction XDR and secret key are required',
      });
    }
    
    const StellarSdk = require('stellar-sdk');
    const keypair = StellarSdk.Keypair.fromSecret(secretKey);
    const transaction = StellarSdk.TransactionBuilder.fromXDR(transactionXDR, stellarConfig.passphrase);
    
    transaction.sign(keypair);
    
    res.json({
      success: true,
      data: {
        signedXDR: transaction.toXDR(),
      },
    });
  } catch (error) {
    console.error('Transaction signing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sign transaction',
    });
  }
});

module.exports = router;
