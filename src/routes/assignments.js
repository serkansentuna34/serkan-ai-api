const express = require('express');
const router = express.Router();
const {
  getAllAssignments,
  getAllAssignmentsAdmin,
  getAssignmentById,
  submitAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getAvailableClasses,
  getAssignedClasses,
  assignToClass,
  removeFromClass,
  getAssignmentSubmissions,
  gradeSubmission
} = require('../controllers/assignmentsController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getAllAssignments);
router.get('/admin/all', authenticate, authorize('admin', 'instructor'), getAllAssignmentsAdmin);
router.get('/classes/available', authenticate, authorize('admin', 'instructor'), getAvailableClasses);
router.get('/:id', authenticate, getAssignmentById);
router.get('/:id/classes', authenticate, authorize('admin', 'instructor'), getAssignedClasses);
router.get('/:id/submissions', authenticate, authorize('admin', 'instructor'), getAssignmentSubmissions);
router.post('/:id/submit', authenticate, submitAssignment);
router.post('/', authenticate, authorize('admin', 'instructor'), createAssignment);
router.post('/:id/assign', authenticate, authorize('admin', 'instructor'), assignToClass);
router.put('/:id', authenticate, authorize('admin', 'instructor'), updateAssignment);
router.put('/:id/submissions/:submissionId/grade', authenticate, authorize('admin', 'instructor'), gradeSubmission);
router.delete('/:id', authenticate, authorize('admin', 'instructor'), deleteAssignment);
router.delete('/:id/classes/:classId', authenticate, authorize('admin', 'instructor'), removeFromClass);

module.exports = router;
