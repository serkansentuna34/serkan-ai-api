const db = require('../config/database');

const getAllCourses = async (req, res) => {
  try {
    const userId = req.user?.id;

    let query = `
      SELECT c.*, u.name as instructor_name
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE c.is_published = true
      ORDER BY c.order_index, c.created_at DESC
    `;

    const result = await db.query(query);

    // Get enrollment data for the user if logged in
    if (userId) {
      const enrollmentQuery = `
        SELECT course_id, progress_percentage, completed_at
        FROM enrollments
        WHERE user_id = $1
      `;
      const enrollmentResult = await db.query(enrollmentQuery, [userId]);

      // Create a map of course_id -> enrollment data
      const enrollmentMap = new Map();
      enrollmentResult.rows.forEach(enrollment => {
        enrollmentMap.set(enrollment.course_id, enrollment);
      });

      // Merge enrollment data with courses
      const coursesWithEnrollment = result.rows.map(course => {
        const enrollment = enrollmentMap.get(course.id);
        return {
          ...course,
          progress_percentage: enrollment?.progress_percentage || 0,
          completed_at: enrollment?.completed_at || null,
          is_completed: !!enrollment?.completed_at
        };
      });

      res.json({ courses: coursesWithEnrollment });
    } else {
      res.json({ courses: result.rows });
    }
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
};

const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const courseResult = await db.query(
      `SELECT c.*, u.name as instructor_name
       FROM courses c
       LEFT JOIN users u ON c.instructor_id = u.id
       WHERE c.id = $1 AND c.is_published = true`,
      [id]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const modulesResult = await db.query(
      `SELECT * FROM course_modules
       WHERE course_id = $1
       ORDER BY order_index`,
      [id]
    );

    const lessonsResult = await db.query(
      `SELECT l.* FROM lessons l
       JOIN course_modules m ON l.module_id = m.id
       WHERE m.course_id = $1 AND l.is_published = true
       ORDER BY l.order_index`,
      [id]
    );

    // Get enrollment status if user is logged in
    let enrollment = null;
    if (userId) {
      const enrollmentResult = await db.query(
        `SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2`,
        [userId, id]
      );
      enrollment = enrollmentResult.rows[0] || null;
    }

    res.json({
      course: courseResult.rows[0],
      modules: modulesResult.rows,
      lessons: lessonsResult.rows,
      enrollment
    });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
};

const createCourse = async (req, res) => {
  try {
    const {
      title, description, content, thumbnail, is_published, attachments
    } = req.body;

    const result = await db.query(
      `INSERT INTO courses (
        title, description, content, thumbnail_url, is_published, attachments, instructor_id
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        title, description, content, thumbnail, is_published || false, JSON.stringify(attachments || []), req.user.id
      ]
    );

    res.status(201).json({ course: result.rows[0] });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
};

const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, content, thumbnail, is_published, attachments
    } = req.body;

    const result = await db.query(
      `UPDATE courses
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           content = COALESCE($3, content),
           thumbnail_url = COALESCE($4, thumbnail_url),
           is_published = COALESCE($5, is_published),
           attachments = COALESCE($6, attachments),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [
        title, description, content, thumbnail, is_published, attachments ? JSON.stringify(attachments) : null, id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({ course: result.rows[0] });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM courses WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
};

const completeCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if enrollment exists
    const enrollmentCheck = await db.query(
      `SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2`,
      [userId, id]
    );

    if (enrollmentCheck.rows.length === 0) {
      // Create enrollment if it doesn't exist
      await db.query(
        `INSERT INTO enrollments (user_id, course_id, progress_percentage, completed_at)
         VALUES ($1, $2, 100, CURRENT_TIMESTAMP)`,
        [userId, id]
      );
    } else {
      // Update existing enrollment
      await db.query(
        `UPDATE enrollments
         SET progress_percentage = 100,
             completed_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND course_id = $2`,
        [userId, id]
      );
    }

    res.json({ message: 'Course marked as completed', completed: true });
  } catch (error) {
    console.error('Complete course error:', error);
    res.status(500).json({ error: 'Failed to mark course as completed' });
  }
};

// Get course statistics for the user
const getCourseStatistics = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get total enrolled courses
    const totalEnrolledQuery = `
      SELECT COUNT(*) as count FROM enrollments WHERE user_id = $1
    `;
    const totalEnrolled = await db.query(totalEnrolledQuery, [userId]);

    // Get in-progress courses (not completed)
    const inProgressQuery = `
      SELECT COUNT(*) as count FROM enrollments
      WHERE user_id = $1 AND completed_at IS NULL
    `;
    const inProgress = await db.query(inProgressQuery, [userId]);

    // Get completed courses
    const completedQuery = `
      SELECT COUNT(*) as count FROM enrollments
      WHERE user_id = $1 AND completed_at IS NOT NULL
    `;
    const completed = await db.query(completedQuery, [userId]);

    // Get average progress
    const avgProgressQuery = `
      SELECT COALESCE(AVG(progress_percentage), 0) as avg
      FROM enrollments
      WHERE user_id = $1
    `;
    const avgProgress = await db.query(avgProgressQuery, [userId]);

    res.json({
      statistics: {
        totalEnrolled: parseInt(totalEnrolled.rows[0].count),
        inProgress: parseInt(inProgress.rows[0].count),
        completed: parseInt(completed.rows[0].count),
        averageProgress: Math.round(parseFloat(avgProgress.rows[0].avg))
      }
    });
  } catch (error) {
    console.error('Get course statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch course statistics' });
  }
};

// Get admin course statistics (all courses overview)
const getAdminCourseStatistics = async (req, res) => {
  try {
    // Total courses
    const totalCoursesQuery = `SELECT COUNT(*) as count FROM courses`;
    const totalCourses = await db.query(totalCoursesQuery);

    // Published courses
    const publishedQuery = `SELECT COUNT(*) as count FROM courses WHERE is_published = true`;
    const published = await db.query(publishedQuery);

    // Draft courses
    const draftQuery = `SELECT COUNT(*) as count FROM courses WHERE is_published = false`;
    const draft = await db.query(draftQuery);

    // Total enrollments across all courses
    const totalEnrollmentsQuery = `SELECT COUNT(*) as count FROM enrollments`;
    const totalEnrollments = await db.query(totalEnrollmentsQuery);

    // Total students (unique users enrolled)
    const totalStudentsQuery = `SELECT COUNT(DISTINCT user_id) as count FROM enrollments`;
    const totalStudents = await db.query(totalStudentsQuery);

    // Average completion rate
    const avgCompletionQuery = `
      SELECT
        COUNT(*) as total_enrollments,
        COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_enrollments
      FROM enrollments
    `;
    const completionResult = await db.query(avgCompletionQuery);
    const { total_enrollments, completed_enrollments } = completionResult.rows[0];
    const completionRate = total_enrollments > 0
      ? Math.round((completed_enrollments / total_enrollments) * 100)
      : 0;

    res.json({
      statistics: {
        totalCourses: parseInt(totalCourses.rows[0].count),
        published: parseInt(published.rows[0].count),
        draft: parseInt(draft.rows[0].count),
        totalEnrollments: parseInt(totalEnrollments.rows[0].count),
        totalStudents: parseInt(totalStudents.rows[0].count),
        completionRate
      }
    });
  } catch (error) {
    console.error('Get admin course statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch admin course statistics' });
  }
};

module.exports = {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  completeCourse,
  getCourseStatistics,
  getAdminCourseStatistics
};
