const express = require('express');
const router = express.Router();
const {
  getAllLibraryItems,
  getLibraryItemById,
  createLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  downloadLibraryItem
} = require('../controllers/libraryController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getAllLibraryItems);
router.get('/:id', authenticate, getLibraryItemById);
router.get('/:id/download', authenticate, downloadLibraryItem);
router.post('/', authenticate, authorize('admin', 'instructor'), createLibraryItem);
router.put('/:id', authenticate, authorize('admin', 'instructor'), updateLibraryItem);
router.delete('/:id', authenticate, authorize('admin'), deleteLibraryItem);

module.exports = router;
