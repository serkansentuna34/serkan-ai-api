const db = require('../../config/database');

// Get all classes
const getAllClasses = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.name as instructor_name,
              (SELECT COUNT(*) FROM class_members WHERE class_id = c.id) as student_count,
              (SELECT COUNT(*) FROM class_courses WHERE class_id = c.id) as course_count
       FROM classes c
       LEFT JOIN users u ON c.instructor_id = u.id
       ORDER BY c.created_at DESC`
    );

    res.json({ classes: result.rows });
  } catch (error) {
    console.error('Get all classes error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
};

// Get class by ID
const getClassById = async (req, res) => {
  try {
    const { id } = req.params;

    const classResult = await db.query(
      `SELECT c.*, u.name as instructor_name
       FROM classes c
       LEFT JOIN users u ON c.instructor_id = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    res.json({ class: classResult.rows[0] });
  } catch (error) {
    console.error('Get class by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch class' });
  }
};

// Create new class
const createClass = async (req, res) => {
  try {
    const { name, description, instructor_id, start_date, end_date, is_active } = req.body;

    const result = await db.query(
      `INSERT INTO classes (name, description, instructor_id, start_date, end_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description, instructor_id || req.user.id, start_date, end_date, is_active !== undefined ? is_active : true]
    );

    res.status(201).json({ class: result.rows[0] });
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: 'Failed to create class' });
  }
};

// Update class
const updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, instructor_id, start_date, end_date, is_active } = req.body;

    const result = await db.query(
      `UPDATE classes
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           instructor_id = COALESCE($3, instructor_id),
           start_date = COALESCE($4, start_date),
           end_date = COALESCE($5, end_date),
           is_active = COALESCE($6, is_active)
       WHERE id = $7
       RETURNING *`,
      [name, description, instructor_id, start_date, end_date, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    res.json({ class: result.rows[0] });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ error: 'Failed to update class' });
  }
};

// Delete class
const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM classes WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ error: 'Failed to delete class' });
  }
};

// Get class members
const getClassMembers = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.avatar_url, cm.enrolled_at
       FROM class_members cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.class_id = $1
       ORDER BY cm.enrolled_at DESC`,
      [id]
    );

    res.json({ members: result.rows });
  } catch (error) {
    console.error('Get class members error:', error);
    res.status(500).json({ error: 'Failed to fetch class members' });
  }
};

// Add member to class
const addClassMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    // Check if already enrolled
    const existing = await db.query(
      'SELECT id FROM class_members WHERE class_id = $1 AND user_id = $2',
      [id, user_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User already enrolled in this class' });
    }

    const result = await db.query(
      `INSERT INTO class_members (class_id, user_id)
       VALUES ($1, $2)
       RETURNING *`,
      [id, user_id]
    );

    // Auto-enroll user to all class courses
    await db.query(
      `INSERT INTO enrollments (user_id, course_id)
       SELECT $1, course_id FROM class_courses WHERE class_id = $2
       ON CONFLICT (user_id, course_id) DO NOTHING`,
      [user_id, id]
    );

    res.status(201).json({ member: result.rows[0] });
  } catch (error) {
    console.error('Add class member error:', error);
    res.status(500).json({ error: 'Failed to add class member' });
  }
};

// Remove member from class
const removeClassMember = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const result = await db.query(
      'DELETE FROM class_members WHERE class_id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found in this class' });
    }

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove class member error:', error);
    res.status(500).json({ error: 'Failed to remove class member' });
  }
};

// Get class courses
const getClassCourses = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT c.*, cc.order_index, cc.start_date, cc.end_date, cc.assigned_at
       FROM class_courses cc
       JOIN courses c ON cc.course_id = c.id
       WHERE cc.class_id = $1
       ORDER BY cc.order_index, cc.assigned_at`,
      [id]
    );

    res.json({ courses: result.rows });
  } catch (error) {
    console.error('Get class courses error:', error);
    res.status(500).json({ error: 'Failed to fetch class courses' });
  }
};

// Assign course to class
const assignCourseToClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { course_id, order_index, start_date, end_date } = req.body;

    // Check if already assigned
    const existing = await db.query(
      'SELECT id FROM class_courses WHERE class_id = $1 AND course_id = $2',
      [id, course_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Course already assigned to this class' });
    }

    const result = await db.query(
      `INSERT INTO class_courses (class_id, course_id, order_index, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, course_id, order_index || 0, start_date, end_date]
    );

    // Auto-enroll all class members to this course
    await db.query(
      `INSERT INTO enrollments (user_id, course_id)
       SELECT user_id, $1 FROM class_members WHERE class_id = $2
       ON CONFLICT (user_id, course_id) DO NOTHING`,
      [course_id, id]
    );

    res.status(201).json({ course: result.rows[0] });
  } catch (error) {
    console.error('Assign course to class error:', error);
    res.status(500).json({ error: 'Failed to assign course to class' });
  }
};

// Remove course from class
const removeCourseFromClass = async (req, res) => {
  try {
    const { id, courseId } = req.params;

    const result = await db.query(
      'DELETE FROM class_courses WHERE class_id = $1 AND course_id = $2 RETURNING id',
      [id, courseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found in this class' });
    }

    res.json({ message: 'Course removed from class successfully' });
  } catch (error) {
    console.error('Remove course from class error:', error);
    res.status(500).json({ error: 'Failed to remove course from class' });
  }
};

// Get class assignments
const getClassAssignments = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT a.*, ca.assigned_at, c.title as course_title
       FROM class_assignments ca
       JOIN assignments a ON ca.assignment_id = a.id
       LEFT JOIN courses c ON a.course_id = c.id
       WHERE ca.class_id = $1
       ORDER BY a.deadline`,
      [id]
    );

    res.json({ assignments: result.rows });
  } catch (error) {
    console.error('Get class assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch class assignments' });
  }
};

// Assign assignment to class
const assignAssignmentToClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignment_id } = req.body;

    // Check if already assigned
    const existing = await db.query(
      'SELECT id FROM class_assignments WHERE class_id = $1 AND assignment_id = $2',
      [id, assignment_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Assignment already assigned to this class' });
    }

    const result = await db.query(
      `INSERT INTO class_assignments (class_id, assignment_id)
       VALUES ($1, $2)
       RETURNING *`,
      [id, assignment_id]
    );

    res.status(201).json({ assignment: result.rows[0] });
  } catch (error) {
    console.error('Assign assignment to class error:', error);
    res.status(500).json({ error: 'Failed to assign assignment to class' });
  }
};

// Get class stats
const getClassStats = async (req, res) => {
  try {
    const { id } = req.params;

    const stats = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM class_members WHERE class_id = $1) as total_students,
        (SELECT COUNT(*) FROM class_courses WHERE class_id = $1) as total_courses,
        (SELECT COUNT(*) FROM class_assignments WHERE class_id = $1) as total_assignments,
        (SELECT COUNT(*) FROM assignment_submissions s
         JOIN class_assignments ca ON s.assignment_id = ca.assignment_id
         WHERE ca.class_id = $1 AND s.status = 'pending') as pending_submissions`,
      [id]
    );

    res.json({ stats: stats.rows[0] });
  } catch (error) {
    console.error('Get class stats error:', error);
    res.status(500).json({ error: 'Failed to fetch class stats' });
  }
};

module.exports = {
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
};
