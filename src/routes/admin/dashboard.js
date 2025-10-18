const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/admin/dashboardController');
const { authenticate, authorize } = require('../../middleware/auth');

// Protect all routes
router.use(authenticate);
router.use(authorize('admin', 'instructor'));

// GET /api/admin/dashboard/stats
router.get('/stats', dashboardController.getStats);

// GET /api/admin/dashboard/activities
router.get('/activities', dashboardController.getRecentActivities);

// GET /api/admin/dashboard/active-users
router.get('/active-users', dashboardController.getActiveUsers);

// GET /api/admin/dashboard/top-students
router.get('/top-students', dashboardController.getTopStudents);

// GET /api/admin/dashboard/popular-courses
router.get('/popular-courses', dashboardController.getPopularCourses);

module.exports = router;
