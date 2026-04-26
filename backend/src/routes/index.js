const express = require('express');
const router = express.Router();

const v1Routes = require('./v1');

// API Versioning Strategy
router.use('/v1', v1Routes);

// Fallback for missing versions or root
router.get('/', (req, res) => {
  res.json({
    message: 'Decentralized Identity DID API',
    versions: ['v1'],
    current_version: 'v1'
  });
});

module.exports = router;
