const express = require('express');
const { listRights, grantRight, revokeRight } = require('../controllers/rightsController');

// mergeParams so this router can read :id from the parent (content) route
const router = express.Router({ mergeParams: true });

router.get('/', listRights);
router.post('/', grantRight);
router.delete('/:rightId', revokeRight);

module.exports = router;
