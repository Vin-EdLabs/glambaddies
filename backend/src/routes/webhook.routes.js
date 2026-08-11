const express = require('express');
const controller = require('../controllers/webhook.controller');

const router = express.Router();

// Paystack dashboard: https://www.glambaddies.com/api/webhook/paystack
router.post('/paystack', controller.paystackWebhook);

module.exports = router;
