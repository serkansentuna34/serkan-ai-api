const express = require('express');
const router = express.Router();
const {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse
} = require('../controllers/coursesController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, getAllCourses);
router.get('/:id', authenticate, getCourseById);
router.post('/', authenticate, authorize('admin', 'instructor'), createCourse);
router.put('/:id', authenticate, authorize('admin', 'instructor'), updateCourse);
router.delete('/:id', authenticate, authorize('admin'), deleteCourse);

module.exports = router;
