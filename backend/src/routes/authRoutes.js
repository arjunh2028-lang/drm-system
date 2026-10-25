const express = require('express');
const { register, login, me, listUsers } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { authRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/register', authRateLimit, register);
router.post('/login', authRateLimit, login);
router.get('/me', requireAuth, me);
router.get('/users', requireAuth, listUsers);

module.exports = router;
