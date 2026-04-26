const express = require("express");
const router = express.Router();
const qrService = require("../services/qrService");

/**
 * POST /api/v1/qr/generate
 * Accepts a QRPayload body, validates it, and returns a signed token + deep link.
 */
router.post("/generate", (req, res) => {
  try {
    const { token, deepLink } = qrService.generateToken(req.body);
    return res.status(200).json({ success: true, data: { token, deepLink } });
  } catch (err) {
    if (err.validationErrors) {
      return res
        .status(400)
        .json({ success: false, errors: err.validationErrors });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/qr/validate
 * Accepts a { token } body, verifies the JWT, and returns the decoded QRPayload.
 */
router.post("/validate", (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ success: false, error: "token is required" });
  }
  try {
    const payload = qrService.validateToken(token);
    return res.status(200).json({ success: true, data: payload });
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, error: "Token expired or tampered" });
  }
});

module.exports = router;
