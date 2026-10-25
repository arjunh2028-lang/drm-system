const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { myRights } = require('../controllers/rightsController');

const router = express.Router();

// GET /api/rights/mine -> all ACTIVE rights the logged-in user holds
// on content owned by other people.
router.get('/mine', requireAuth, myRights);

module.exports = router;
