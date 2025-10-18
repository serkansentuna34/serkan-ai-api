const db = require('../config/database');

const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Active courses count
    const activeCourses = await db.query(
      `SELECT COUNT(*) as count FROM enrollments WHERE user_id = $1 AND completed_at IS NULL`,
      [userId]
    );

    // Pending assignments count (only from classes user is enrolled in)
    const pendingAssignments = await db.query(
      `SELECT COUNT(DISTINCT a.id) as count
       FROM assignments a
       LEFT JOIN class_assignments ca ON a.id = ca.assignment_id
       LEFT JOIN class_members cm ON ca.class_id = cm.class_id
       WHERE a.is_published = true
       AND a.deadline > CURRENT_TIMESTAMP
       AND cm.user_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM assignment_submissions s
         WHERE s.assignment_id = a.id AND s.user_id = $1
       )`,
      [userId]
    );

    // Completed lessons count
    const completedLessons = await db.query(
      `SELECT COUNT(*) as count FROM user_progress WHERE user_id = $1 AND completed = true`,
      [userId]
    );

    // Overall progress
    const totalProgress = await db.query(
      `SELECT COALESCE(AVG(progress_percentage), 0) as avg FROM enrollments WHERE user_id = $1`,
      [userId]
    );

    res.json({
      stats: {
        activeCourses: parseInt(activeCourses.rows[0].count),
        pendingAssignments: parseInt(pendingAssignments.rows[0].count),
        completedLessons: parseInt(completedLessons.rows[0].count),
        totalProgress: Math.round(parseFloat(totalProgress.rows[0].avg))
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

const getRecentCourses = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, e.progress_percentage,
              (SELECT COUNT(*) FROM lessons l
               JOIN course_modules m ON l.module_id = m.id
               WHERE m.course_id = c.id AND l.is_published = true) as total_lessons,
              (SELECT COUNT(*) FROM user_progress up
               JOIN lessons l ON up.lesson_id = l.id
               JOIN course_modules m ON l.module_id = m.id
               WHERE m.course_id = c.id AND up.user_id = $1 AND up.completed = true) as completed_lessons
       FROM courses c
       JOIN enrollments e ON c.id = e.course_id
       WHERE e.user_id = $1 AND e.completed_at IS NULL
       ORDER BY e.enrolled_at DESC
       LIMIT 3`,
      [req.user.id]
    );

    res.json({ courses: result.rows });
  } catch (error) {
    console.error('Get recent courses error:', error);
    res.status(500).json({ error: 'Failed to fetch recent courses' });
  }
};

const getUpcomingAssignments = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT a.*, c.title as course_title
       FROM assignments a
       JOIN courses c ON a.course_id = c.id
       LEFT JOIN class_assignments ca ON a.id = ca.assignment_id
       LEFT JOIN class_members cm ON ca.class_id = cm.class_id
       WHERE a.is_published = true
       AND a.deadline > CURRENT_TIMESTAMP
       AND cm.user_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM assignment_submissions s
         WHERE s.assignment_id = a.id AND s.user_id = $1
       )
       ORDER BY a.deadline ASC
       LIMIT 3`,
      [req.user.id]
    );

    res.json({ assignments: result.rows });
  } catch (error) {
    console.error('Get upcoming assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming assignments' });
  }
};

const getRecentActivities = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM activity_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.user.id]
    );

    res.json({ activities: result.rows });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({ error: 'Failed to fetch recent activities' });
  }
};

module.exports = {
  getDashboardStats,
  getRecentCourses,
  getUpcomingAssignments,
  getRecentActivities
};
