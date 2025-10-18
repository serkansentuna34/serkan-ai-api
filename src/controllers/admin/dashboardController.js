const pool = require('../../config/database');

// Admin dashboard stats
exports.getStats = async (req, res) => {
  try {
    // Get total counts
    const [usersResult, coursesResult, classesResult, assignmentsResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as total, role FROM users GROUP BY role'),
      pool.query('SELECT COUNT(*) as total FROM courses'),
      pool.query('SELECT COUNT(*) as total FROM classes'),
      pool.query('SELECT COUNT(*) as total FROM assignments')
    ]);

    // Get last week counts for trend
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [
      newUsersLastWeek,
      newCoursesLastWeek,
      newClassesLastWeek,
      newAssignmentsLastWeek
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM users WHERE created_at >= $1', [oneWeekAgo]),
      pool.query('SELECT COUNT(*) as total FROM courses WHERE created_at >= $1', [oneWeekAgo]),
      pool.query('SELECT COUNT(*) as total FROM classes WHERE created_at >= $1', [oneWeekAgo]),
      pool.query('SELECT COUNT(*) as total FROM assignments WHERE created_at >= $1', [oneWeekAgo])
    ]);

    // Parse user counts by role
    const usersByRole = usersResult.rows.reduce((acc, row) => {
      acc[row.role] = parseInt(row.total);
      return acc;
    }, {});

    const stats = {
      totalStudents: usersByRole.student || 0,
      totalInstructors: usersByRole.instructor || 0,
      totalAdmins: usersByRole.admin || 0,
      totalUsers: Object.values(usersByRole).reduce((sum, count) => sum + count, 0),
      totalCourses: parseInt(coursesResult.rows[0].total),
      totalClasses: parseInt(classesResult.rows[0].total),
      totalAssignments: parseInt(assignmentsResult.rows[0].total),

      // Trends (new this week)
      newStudentsThisWeek: parseInt(newUsersLastWeek.rows[0].total),
      newCoursesThisWeek: parseInt(newCoursesLastWeek.rows[0].total),
      newClassesThisWeek: parseInt(newClassesLastWeek.rows[0].total),
      newAssignmentsThisWeek: parseInt(newAssignmentsLastWeek.rows[0].total)
    };

    res.json({ stats });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: 'İstatistikler yüklenirken hata oluştu' });
  }
};

// Recent activities
exports.getRecentActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Get recent enrollments
    const enrollmentsQuery = `
      SELECT
        e.id,
        'enrollment' as type,
        u.name as user_name,
        c.title as entity_name,
        e.enrolled_at as created_at,
        'Derse kaydoldu' as action
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      JOIN courses c ON e.course_id = c.id
      ORDER BY e.enrolled_at DESC
      LIMIT $1
    `;

    // Get recent course completions
    const completionsQuery = `
      SELECT
        e.id,
        'completion' as type,
        u.name as user_name,
        c.title as entity_name,
        e.completed_at as created_at,
        'Dersi tamamladı' as action
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      JOIN courses c ON e.course_id = c.id
      WHERE e.completed_at IS NOT NULL
      ORDER BY e.completed_at DESC
      LIMIT $1
    `;

    // Get recent user registrations
    const usersQuery = `
      SELECT
        id,
        'registration' as type,
        name as user_name,
        role as entity_name,
        created_at,
        'Sisteme katıldı' as action
      FROM users
      ORDER BY created_at DESC
      LIMIT $1
    `;

    const [enrollments, completions, users] = await Promise.all([
      pool.query(enrollmentsQuery, [limit]),
      pool.query(completionsQuery, [limit]),
      pool.query(usersQuery, [limit])
    ]);

    // Combine and sort by date
    const allActivities = [
      ...enrollments.rows,
      ...completions.rows,
      ...users.rows
    ]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);

    res.json({ activities: allActivities });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({ error: 'Aktiviteler yüklenirken hata oluştu' });
  }
};

// Active users (logged in last 7 days)
exports.getActiveUsers = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await pool.query(
      'SELECT COUNT(*) as total FROM users WHERE last_login >= $1',
      [sevenDaysAgo]
    );

    res.json({ activeUsers: parseInt(result.rows[0].total) });
  } catch (error) {
    console.error('Get active users error:', error);
    res.status(500).json({ error: 'Aktif kullanıcılar yüklenirken hata oluştu' });
  }
};

// Top performing students
exports.getTopStudents = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const query = `
      SELECT
        u.id,
        u.name,
        u.email,
        COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END) as completed_courses,
        COALESCE(AVG(e.progress_percentage), 0) as avg_progress
      FROM users u
      LEFT JOIN enrollments e ON u.id = e.user_id
      WHERE u.role = 'student'
      GROUP BY u.id, u.name, u.email
      HAVING COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END) > 0
      ORDER BY completed_courses DESC, avg_progress DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);

    res.json({ students: result.rows });
  } catch (error) {
    console.error('Get top students error:', error);
    res.status(500).json({ error: 'Başarılı öğrenciler yüklenirken hata oluştu' });
  }
};

// Popular courses
exports.getPopularCourses = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const query = `
      SELECT
        c.id,
        c.title,
        c.thumbnail_url,
        COUNT(e.id) as enrollment_count,
        COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END) as completion_count,
        CASE
          WHEN COUNT(e.id) > 0 THEN (COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END)::float / COUNT(e.id)::float * 100)
          ELSE 0
        END as completion_rate
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      WHERE c.is_published = true
      GROUP BY c.id, c.title, c.thumbnail_url
      HAVING COUNT(e.id) > 0
      ORDER BY enrollment_count DESC
      LIMIT $1
    `;

    const result = await pool.query(query, [limit]);

    res.json({ courses: result.rows });
  } catch (error) {
    console.error('Get popular courses error:', error);
    res.status(500).json({ error: 'Popüler dersler yüklenirken hata oluştu' });
  }
};
