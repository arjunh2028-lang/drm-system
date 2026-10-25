const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { walletStatus, createChallenge, verifyChallenge } = require('../controllers/walletController');

const router = express.Router();
router.use(requireAuth);
router.get('/', walletStatus);
router.post('/challenge', createChallenge);
router.post('/verify', verifyChallenge);
module.exports = router;
