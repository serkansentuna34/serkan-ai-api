const pool = require('../config/database');

// Get today's schedule/program for a student
exports.getTodaySchedule = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get student's active class
    const classQuery = `
      SELECT c.id, c.name, c.start_date, c.end_date
      FROM classes c
      JOIN class_members cm ON c.id = cm.class_id
      WHERE cm.user_id = $1 AND c.is_active = true
      ORDER BY c.start_date DESC
      LIMIT 1
    `;
    const classResult = await pool.query(classQuery, [userId]);

    if (classResult.rows.length === 0) {
      return res.json({
        hasActiveClass: false,
        schedule: [],
        classInfo: null,
        currentDay: null
      });
    }

    const classInfo = classResult.rows[0];
    const today = new Date();
    const startDate = new Date(classInfo.start_date);

    // Calculate which day of training we're on
    const dayNumber = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Get today's schedule
    const scheduleQuery = `
      SELECT
        id,
        title,
        description,
        start_time,
        end_time,
        module_type,
        order_index
      FROM daily_schedules
      WHERE class_id = $1
        AND (day_number = $2 OR schedule_date = CURRENT_DATE)
        AND is_active = true
      ORDER BY order_index ASC, start_time ASC
    `;
    const scheduleResult = await pool.query(scheduleQuery, [classInfo.id, dayNumber]);

    // Check attendance status for each schedule item
    const scheduleWithAttendance = await Promise.all(
      scheduleResult.rows.map(async (item) => {
        const attendanceQuery = `
          SELECT status, check_in_time
          FROM attendance_logs
          WHERE user_id = $1 AND schedule_id = $2
        `;
        const attendanceResult = await pool.query(attendanceQuery, [userId, item.id]);

        return {
          ...item,
          attended: attendanceResult.rows.length > 0,
          attendanceStatus: attendanceResult.rows[0]?.status || null,
          checkInTime: attendanceResult.rows[0]?.check_in_time || null
        };
      })
    );

    res.json({
      hasActiveClass: true,
      classInfo: {
        id: classInfo.id,
        name: classInfo.name,
        startDate: classInfo.start_date,
        endDate: classInfo.end_date
      },
      currentDay: dayNumber,
      totalDays: Math.ceil((new Date(classInfo.end_date) - startDate) / (1000 * 60 * 60 * 24)) + 1,
      schedule: scheduleWithAttendance
    });
  } catch (error) {
    console.error('Get today schedule error:', error);
    res.status(500).json({ error: 'Program yüklenirken hata oluştu' });
  }
};

// Get training day tracking (progress for current day)
exports.getDayTracking = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get active class
    const classQuery = `
      SELECT c.id, c.start_date, c.end_date
      FROM classes c
      JOIN class_members cm ON c.id = cm.class_id
      WHERE cm.user_id = $1 AND c.is_active = true
      ORDER BY c.start_date DESC
      LIMIT 1
    `;
    const classResult = await pool.query(classQuery, [userId]);

    if (classResult.rows.length === 0) {
      return res.json({ hasActiveClass: false });
    }

    const classInfo = classResult.rows[0];
    const today = new Date();
    const startDate = new Date(classInfo.start_date);
    const dayNumber = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Get total modules for today
    const totalModulesQuery = `
      SELECT COUNT(*) as total
      FROM daily_schedules
      WHERE class_id = $1 AND day_number = $2 AND is_active = true
    `;
    const totalModulesResult = await pool.query(totalModulesQuery, [classInfo.id, dayNumber]);
    const totalModules = parseInt(totalModulesResult.rows[0].total);

    // Get completed modules (attended)
    const completedModulesQuery = `
      SELECT COUNT(*) as completed
      FROM attendance_logs al
      JOIN daily_schedules ds ON al.schedule_id = ds.id
      WHERE al.user_id = $1
        AND ds.class_id = $2
        AND ds.day_number = $3
        AND al.status = 'present'
    `;
    const completedModulesResult = await pool.query(completedModulesQuery, [userId, classInfo.id, dayNumber]);
    const completedModules = parseInt(completedModulesResult.rows[0].completed);

    // Calculate completion percentage
    const completionPercentage = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

    // Get total time spent today
    const timeSpentQuery = `
      SELECT COALESCE(SUM(up.time_spent_minutes), 0) as total_minutes
      FROM user_progress up
      WHERE up.user_id = $1
        AND DATE(up.last_accessed) = CURRENT_DATE
    `;
    const timeSpentResult = await pool.query(timeSpentQuery, [userId]);
    const timeSpentMinutes = parseInt(timeSpentResult.rows[0].total_minutes);

    res.json({
      hasActiveClass: true,
      currentDay: dayNumber,
      totalModules,
      completedModules,
      remainingModules: totalModules - completedModules,
      completionPercentage,
      timeSpentMinutes,
      timeSpentFormatted: `${Math.floor(timeSpentMinutes / 60)}s ${timeSpentMinutes % 60}dk`
    });
  } catch (error) {
    console.error('Get day tracking error:', error);
    res.status(500).json({ error: 'Gün takibi yüklenirken hata oluştu' });
  }
};

// Get course materials for student's class
exports.getCourseMaterials = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get active class
    const classQuery = `
      SELECT c.id
      FROM classes c
      JOIN class_members cm ON c.id = cm.class_id
      WHERE cm.user_id = $1 AND c.is_active = true
      ORDER BY c.start_date DESC
      LIMIT 1
    `;
    const classResult = await pool.query(classQuery, [userId]);

    if (classResult.rows.length === 0) {
      return res.json({ materials: [] });
    }

    const classId = classResult.rows[0].id;

    // Get all materials for this class
    const materialsQuery = `
      SELECT
        cm.id,
        cm.title,
        cm.description,
        cm.file_url,
        cm.file_type,
        cm.file_size,
        cm.qr_code_url,
        cm.created_at,
        u.name as uploaded_by_name
      FROM course_materials cm
      LEFT JOIN users u ON cm.uploaded_by = u.id
      WHERE cm.class_id = $1 AND cm.is_public = true
      ORDER BY cm.order_index ASC, cm.created_at DESC
    `;
    const materialsResult = await pool.query(materialsQuery, [classId]);

    res.json({ materials: materialsResult.rows });
  } catch (error) {
    console.error('Get course materials error:', error);
    res.status(500).json({ error: 'Materyaller yüklenirken hata oluştu' });
  }
};

// Get certificate status for student
exports.getCertificateStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get active class
    const classQuery = `
      SELECT c.id, c.name
      FROM classes c
      JOIN class_members cm ON c.id = cm.class_id
      WHERE cm.user_id = $1 AND c.is_active = true
      ORDER BY c.start_date DESC
      LIMIT 1
    `;
    const classResult = await pool.query(classQuery, [userId]);

    if (classResult.rows.length === 0) {
      return res.json({ hasActiveClass: false });
    }

    const classInfo = classResult.rows[0];

    // Get or create certificate record
    let certificateQuery = `
      SELECT * FROM certificates
      WHERE user_id = $1 AND class_id = $2
    `;
    let certificateResult = await pool.query(certificateQuery, [userId, classInfo.id]);

    if (certificateResult.rows.length === 0) {
      // Create new certificate record
      const createCertQuery = `
        INSERT INTO certificates (user_id, class_id, certificate_code, status, completion_percentage)
        VALUES ($1, $2, $3, 'pending', 0)
        RETURNING *
      `;
      const certCode = `CERT-${Date.now()}-${userId.slice(0, 8)}`;
      certificateResult = await pool.query(createCertQuery, [userId, classInfo.id, certCode]);
    }

    const certificate = certificateResult.rows[0];

    // Calculate requirements
    // 1. Check attendance (at least 80% attendance)
    const attendanceQuery = `
      SELECT
        COUNT(DISTINCT ds.id) as total_sessions,
        COUNT(DISTINCT al.schedule_id) as attended_sessions
      FROM daily_schedules ds
      LEFT JOIN attendance_logs al ON ds.id = al.schedule_id AND al.user_id = $1
      WHERE ds.class_id = $2 AND ds.is_active = true
    `;
    const attendanceResult = await pool.query(attendanceQuery, [userId, classInfo.id]);
    const { total_sessions, attended_sessions } = attendanceResult.rows[0];
    const attendancePercentage = total_sessions > 0 ? (attended_sessions / total_sessions) * 100 : 0;
    const attendanceRequirementMet = attendancePercentage >= 80;

    // 2. Check assignments (at least 80% submitted)
    const assignmentsQuery = `
      SELECT
        COUNT(DISTINCT ca.assignment_id) as total_assignments,
        COUNT(DISTINCT asu.assignment_id) as submitted_assignments
      FROM class_assignments ca
      LEFT JOIN assignment_submissions asu ON ca.assignment_id = asu.assignment_id AND asu.user_id = $1
      WHERE ca.class_id = $2
    `;
    const assignmentsResult = await pool.query(assignmentsQuery, [userId, classInfo.id]);
    const { total_assignments, submitted_assignments } = assignmentsResult.rows[0];
    const assignmentsPercentage = total_assignments > 0 ? (submitted_assignments / total_assignments) * 100 : 100;
    const assignmentsRequirementMet = assignmentsPercentage >= 80;

    // 3. Overall completion
    const overallCompletion = Math.round((attendancePercentage + assignmentsPercentage) / 2);
    const allRequirementsMet = attendanceRequirementMet && assignmentsRequirementMet;

    // Update certificate status
    const newStatus = allRequirementsMet ? 'requirements_met' : 'pending';
    const updateCertQuery = `
      UPDATE certificates
      SET
        status = $1,
        completion_percentage = $2,
        requirements_met = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    const updatedCertResult = await pool.query(updateCertQuery, [
      newStatus,
      overallCompletion,
      JSON.stringify({
        attendance: attendanceRequirementMet,
        assignments: assignmentsRequirementMet
      }),
      certificate.id
    ]);

    res.json({
      hasActiveClass: true,
      className: classInfo.name,
      certificate: updatedCertResult.rows[0],
      requirements: {
        attendance: {
          met: attendanceRequirementMet,
          percentage: Math.round(attendancePercentage),
          attended: parseInt(attended_sessions),
          total: parseInt(total_sessions)
        },
        assignments: {
          met: assignmentsRequirementMet,
          percentage: Math.round(assignmentsPercentage),
          submitted: parseInt(submitted_assignments),
          total: parseInt(total_assignments)
        }
      },
      overallCompletion,
      canDownload: allRequirementsMet
    });
  } catch (error) {
    console.error('Get certificate status error:', error);
    res.status(500).json({ error: 'Sertifika durumu yüklenirken hata oluştu' });
  }
};

// Check-in/attendance logging
exports.checkIn = async (req, res) => {
  try {
    const userId = req.user.id;
    const { scheduleId } = req.body;

    if (!scheduleId) {
      return res.status(400).json({ error: 'Schedule ID gerekli' });
    }

    // Get schedule info
    const scheduleQuery = `
      SELECT class_id, start_time, end_time
      FROM daily_schedules
      WHERE id = $1
    `;
    const scheduleResult = await pool.query(scheduleQuery, [scheduleId]);

    if (scheduleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Program bulunamadı' });
    }

    const schedule = scheduleResult.rows[0];

    // Check if already checked in
    const existingCheckQuery = `
      SELECT id FROM attendance_logs
      WHERE user_id = $1 AND schedule_id = $2
    `;
    const existingResult = await pool.query(existingCheckQuery, [userId, scheduleId]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Zaten yoklama verildi' });
    }

    // Determine status (late or present)
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8);
    const isLate = schedule.start_time && currentTime > schedule.start_time;
    const status = isLate ? 'late' : 'present';

    // Create attendance log
    const checkInQuery = `
      INSERT INTO attendance_logs (user_id, class_id, schedule_id, status, check_in_time)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const result = await pool.query(checkInQuery, [userId, schedule.class_id, scheduleId, status]);

    res.json({
      success: true,
      attendance: result.rows[0],
      message: status === 'late' ? 'Geç geldiniz!' : 'Yoklama başarılı!'
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Yoklama sırasında hata oluştu' });
  }
};

// Quick notes CRUD
exports.getQuickNotes = async (req, res) => {
  try {
    const userId = req.user.id;

    const notesQuery = `
      SELECT * FROM quick_notes
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await pool.query(notesQuery, [userId]);

    res.json({ notes: result.rows });
  } catch (error) {
    console.error('Get quick notes error:', error);
    res.status(500).json({ error: 'Notlar yüklenirken hata oluştu' });
  }
};

exports.createQuickNote = async (req, res) => {
  try {
    const userId = req.user.id;
    const { content, color, classId, scheduleId } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Not içeriği gerekli' });
    }

    const createQuery = `
      INSERT INTO quick_notes (user_id, class_id, schedule_id, content, color)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await pool.query(createQuery, [userId, classId || null, scheduleId || null, content, color || 'yellow']);

    res.json({ note: result.rows[0] });
  } catch (error) {
    console.error('Create quick note error:', error);
    res.status(500).json({ error: 'Not oluşturulurken hata oluştu' });
  }
};

exports.deleteQuickNote = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleteQuery = `
      DELETE FROM quick_notes
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    const result = await pool.query(deleteQuery, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not bulunamadı' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete quick note error:', error);
    res.status(500).json({ error: 'Not silinirken hata oluştu' });
  }
};
