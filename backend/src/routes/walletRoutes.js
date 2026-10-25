const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { walletStatus, createChallenge, verifyChallenge } = require('../controllers/walletController');
const { walletRateLimit } = require('../middleware/rateLimit');

const router = express.Router();
router.get('/', requireAuth, walletStatus);
router.post('/challenge', walletRateLimit, requireAuth, createChallenge);
router.post('/verify', walletRateLimit, requireAuth, verifyChallenge);
module.exports = router;
