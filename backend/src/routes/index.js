const express = require('express');
const router = express.Router();
const templateService = require('../services/templateService');
const webhookService = require('../services/webhookService');
const Webhook = require('../models/Webhook'); // For basic CRUD without a service wrapper for all operations

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

// --- Credential Templates ---

router.get('/templates', async (req, res) => {
  try {
    const templates = await templateService.getTemplates(req.query);
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/templates', async (req, res) => {
  try {
    const template = await templateService.createTemplate(req.body);
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/templates/:id', async (req, res) => {
  try {
    const template = await templateService.getTemplateById(req.params.id);
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// --- Webhooks ---

router.get('/webhooks', async (req, res) => {
  try {
    const webhooks = await Webhook.find({ active: true });
    res.json({ success: true, data: webhooks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/webhooks', async (req, res) => {
  try {
    const webhook = new Webhook(req.body);
    await webhook.save();
    res.json({ success: true, data: webhook });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/webhooks/:id', async (req, res) => {
  try {
    await Webhook.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ success: true, message: 'Webhook deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
