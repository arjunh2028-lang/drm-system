const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { listHistory } = require('../controllers/historyController');

const router = express.Router();

router.get('/', requireAuth, listHistory);

module.exports = router;
