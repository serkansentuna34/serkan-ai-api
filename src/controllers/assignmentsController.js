const db = require('../config/database');

const getAllAssignments = async (req, res) => {
  try {
    // Get assignments assigned to classes the user is enrolled in
    const result = await db.query(
      `SELECT DISTINCT a.*, c.title as course_title,
              s.status, s.score, s.feedback, s.submitted_at
       FROM assignments a
       LEFT JOIN courses c ON a.course_id = c.id
       LEFT JOIN class_assignments ca ON a.id = ca.assignment_id
       LEFT JOIN class_members cm ON ca.class_id = cm.class_id
       LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.user_id = $1
       WHERE a.is_published = true
         AND cm.user_id = $1
       ORDER BY a.deadline ASC`,
      [req.user.id]
    );

    // Disable caching to ensure fresh data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.json({ assignments: result.rows });
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
};

const getAssignmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'instructor';

    let result;

    if (isAdmin) {
      // Admin can see any assignment
      result = await db.query(
        `SELECT a.*, c.title as course_title
         FROM assignments a
         LEFT JOIN courses c ON a.course_id = c.id
         WHERE a.id = $1`,
        [id]
      );
    } else {
      // Students can only see assignments assigned to their classes
      result = await db.query(
        `SELECT DISTINCT a.*, c.title as course_title,
                s.status, s.score, s.feedback, s.submitted_at, s.content as submission_content
         FROM assignments a
         LEFT JOIN courses c ON a.course_id = c.id
         LEFT JOIN class_assignments ca ON a.id = ca.assignment_id
         LEFT JOIN class_members cm ON ca.class_id = cm.class_id
         LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.user_id = $1
         WHERE a.id = $2
           AND a.is_published = true
           AND cm.user_id = $1`,
        [req.user.id, id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ assignment: result.rows[0] });
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({ error: 'Failed to fetch assignment' });
  }
};

const submitAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, file_urls } = req.body;

    const result = await db.query(
      `INSERT INTO assignment_submissions (assignment_id, user_id, content, file_urls, status, submitted_at)
       VALUES ($1, $2, $3, $4, 'submitted', CURRENT_TIMESTAMP)
       ON CONFLICT (assignment_id, user_id)
       DO UPDATE SET content = $3, file_urls = $4, status = 'submitted', submitted_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [id, req.user.id, content, file_urls || []]
    );

    res.json({ submission: result.rows[0] });
  } catch (error) {
    console.error('Submit assignment error:', error);
    res.status(500).json({ error: 'Failed to submit assignment' });
  }
};

const createAssignment = async (req, res) => {
  try {
    const { course_id, title, description, instructions, deadline, max_points, attachments } = req.body;

    const result = await db.query(
      `INSERT INTO assignments (course_id, title, description, instructions, deadline, max_points, attachments)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [course_id, title, description, instructions, deadline, max_points, JSON.stringify(attachments || [])]
    );

    res.status(201).json({ assignment: result.rows[0] });
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
};

const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { course_id, title, description, instructions, deadline, max_points, attachments } = req.body;

    const result = await db.query(
      `UPDATE assignments
       SET course_id = $1, title = $2, description = $3, instructions = $4,
           deadline = $5, max_points = $6, attachments = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [course_id, title, description, instructions, deadline, max_points, JSON.stringify(attachments || []), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ assignment: result.rows[0] });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
};

const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM assignments WHERE id = $1', [id]);

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
};

// Get all assignments for admin (without class filtering)
const getAllAssignmentsAdmin = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, c.title as course_title,
              (SELECT COUNT(*) FROM class_assignments WHERE assignment_id = a.id) as assigned_classes_count
       FROM assignments a
       LEFT JOIN courses c ON a.course_id = c.id
       ORDER BY a.created_at DESC`
    );

    // Disable caching to ensure fresh data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.json({ assignments: result.rows });
  } catch (error) {
    console.error('Get all assignments (admin) error:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
};

// Get all classes (for assignment modal)
const getAvailableClasses = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, description, is_active
       FROM classes
       WHERE is_active = true
       ORDER BY name`
    );

    res.json({ classes: result.rows });
  } catch (error) {
    console.error('Get available classes error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
};

// Get assigned classes for an assignment
const getAssignedClasses = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT c.id, c.name, c.description, ca.assigned_at
       FROM class_assignments ca
       JOIN classes c ON ca.class_id = c.id
       WHERE ca.assignment_id = $1
       ORDER BY c.name`,
      [id]
    );

    res.json({ classes: result.rows });
  } catch (error) {
    console.error('Get assigned classes error:', error);
    res.status(500).json({ error: 'Failed to fetch assigned classes' });
  }
};

// Assign assignment to class
const assignToClass = async (req, res) => {
  try {
    const { id } = req.params;
    const { class_id } = req.body;

    // Check if already assigned
    const existing = await db.query(
      `SELECT id FROM class_assignments WHERE class_id = $1 AND assignment_id = $2`,
      [class_id, id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Bu ödev zaten bu sınıfa atanmış' });
    }

    const result = await db.query(
      `INSERT INTO class_assignments (class_id, assignment_id)
       VALUES ($1, $2)
       RETURNING *`,
      [class_id, id]
    );

    res.status(201).json({
      message: 'Ödev başarıyla sınıfa atandı',
      assignment: result.rows[0]
    });
  } catch (error) {
    console.error('Assign to class error:', error);
    res.status(500).json({ error: 'Failed to assign assignment to class' });
  }
};

// Remove assignment from class
const removeFromClass = async (req, res) => {
  try {
    const { id, classId } = req.params;

    const result = await db.query(
      `DELETE FROM class_assignments
       WHERE assignment_id = $1 AND class_id = $2
       RETURNING *`,
      [id, classId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Atama bulunamadı' });
    }

    res.json({ message: 'Ödev sınıftan kaldırıldı' });
  } catch (error) {
    console.error('Remove from class error:', error);
    res.status(500).json({ error: 'Failed to remove assignment from class' });
  }
};

// Get all submissions for an assignment (admin only)
const getAssignmentSubmissions = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT s.*, u.name as student_name, u.email as student_email
       FROM assignment_submissions s
       JOIN users u ON s.user_id = u.id
       WHERE s.assignment_id = $1
       ORDER BY s.submitted_at DESC`,
      [id]
    );

    res.json({ submissions: result.rows });
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
};

// Grade a submission (admin only)
const gradeSubmission = async (req, res) => {
  try {
    const { id, submissionId } = req.params;
    const { score, feedback } = req.body;

    const result = await db.query(
      `UPDATE assignment_submissions
       SET score = $1, feedback = $2, status = 'graded', graded_at = CURRENT_TIMESTAMP, graded_by = $3
       WHERE id = $4 AND assignment_id = $5
       RETURNING *`,
      [score, feedback, req.user.id, submissionId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.json({ submission: result.rows[0] });
  } catch (error) {
    console.error('Grade submission error:', error);
    res.status(500).json({ error: 'Failed to grade submission' });
  }
};

module.exports = {
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
};
