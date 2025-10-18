const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserRole,
  updateUserStatus,
  updateUserPassword,
  deleteUser,
  importUsersFromExcel,
  downloadExcelTemplate,
  getUserStatistics
} = require('../../controllers/admin/usersController');
const { authenticate, authorize } = require('../../middleware/auth');

// Configure multer for Excel file upload
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Sadece Excel dosyaları yüklenebilir (.xlsx, .xls)'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('admin'));

router.get('/statistics', getUserStatistics);
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.put('/:id/role', updateUserRole);
router.put('/:id/status', updateUserStatus);
router.put('/:id/password', updateUserPassword);
router.delete('/:id', deleteUser);

// Excel import/export routes
router.post('/import', upload.single('file'), importUsersFromExcel);
router.get('/template/download', downloadExcelTemplate);

module.exports = router;
