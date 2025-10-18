const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRecentCourses,
  getUpcomingAssignments,
  getRecentActivities
} = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.get('/stats', authenticate, getDashboardStats);
router.get('/recent-courses', authenticate, getRecentCourses);
router.get('/upcoming-assignments', authenticate, getUpcomingAssignments);
router.get('/recent-activities', authenticate, getRecentActivities);

module.exports = router;
