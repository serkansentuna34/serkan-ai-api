const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  uploadFile,
  uploadMultipleFiles,
  getUploadedFiles,
  deleteUploadedFile
} = require('../controllers/uploadController');

// Upload single file
router.post('/single', authenticate, upload.single('file'), uploadFile);

// Upload multiple files
router.post('/multiple', authenticate, upload.array('files', 10), uploadMultipleFiles);

// Get all uploaded files
router.get('/', authenticate, getUploadedFiles);

// Delete uploaded file
router.delete('/:id', authenticate, deleteUploadedFile);

module.exports = router;
