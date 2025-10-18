const express = require('express');
const router = express.Router();
const {
  getAllClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  getClassMembers,
  addClassMember,
  removeClassMember,
  getClassCourses,
  assignCourseToClass,
  removeCourseFromClass,
  getClassAssignments,
  assignAssignmentToClass,
  getClassStats
} = require('../../controllers/admin/classesController');
const { authenticate, authorize } = require('../../middleware/auth');

// All routes require admin authentication
router.use(authenticate);
router.use(authorize('admin', 'instructor'));

// Classes CRUD
router.get('/', getAllClasses);
router.get('/:id', getClassById);
router.post('/', createClass);
router.put('/:id', updateClass);
router.delete('/:id', authorize('admin'), deleteClass);

// Class members management
router.get('/:id/members', getClassMembers);
router.post('/:id/members', addClassMember);
router.delete('/:id/members/:userId', removeClassMember);

// Class courses management
router.get('/:id/courses', getClassCourses);
router.post('/:id/courses', assignCourseToClass);
router.delete('/:id/courses/:courseId', removeCourseFromClass);

// Class assignments management
router.get('/:id/assignments', getClassAssignments);
router.post('/:id/assignments', assignAssignmentToClass);

// Class statistics
router.get('/:id/stats', getClassStats);

module.exports = router;
