const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  listOwnedContent,
  listAccessibleContent,
  uploadContent,
  getContentDetails,
  viewContent,
  downloadContent,
  verifyIntegrity,
  listCatalogContent,
  purchaseRight,
  listAllContentModerator,
  verifyAllIntegrity,
} = require('../controllers/contentController');
const rightsRoutes = require('./rightsRoutes');
const { getAssetStatus, registerAssetOnChain } = require('../controllers/blockchainController');

const router = express.Router();

router.use(requireAuth);

router.get('/', listOwnedContent);
router.get('/accessible', listAccessibleContent);
router.get('/catalog', listCatalogContent);
router.get('/moderator/all', requireRole('MODERATOR'), listAllContentModerator);
router.get('/moderator/verify-all', requireRole('MODERATOR'), verifyAllIntegrity);
router.get('/:id/blockchain', getAssetStatus);
router.post('/:id/blockchain/register', registerAssetOnChain);

router.post('/', upload.single('file'), uploadContent);
router.post('/:id/purchase', purchaseRight);

router.get('/:id', getContentDetails);
router.get('/:id/view', viewContent);
router.get('/:id/download', downloadContent);
router.get('/:id/verify', verifyIntegrity);

// Rights sub-routes: /api/content/:id/rights , /api/content/:id/rights/:rightId
router.use('/:id/rights', rightsRoutes);

module.exports = router;
