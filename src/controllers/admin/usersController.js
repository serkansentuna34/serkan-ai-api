const db = require('../../config/database');
const bcrypt = require('bcryptjs');
const xlsx = require('xlsx');

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const { role, search } = req.query;

    let query = 'SELECT id, email, name, role, avatar_url, is_active, last_login, created_at FROM users';
    const params = [];
    const conditions = [];

    if (role) {
      conditions.push(`role = $${params.length + 1}`);
      params.push(role);
    }

    if (search) {
      conditions.push(`(name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT id, email, name, role, avatar_url, is_active, last_login, created_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// Create new user
const createUser = async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    // Check if email already exists
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [email, passwordHash, name, role || 'student']
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name, avatar_url } = req.body;

    const result = await db.query(
      `UPDATE users
       SET email = COALESCE($1, email),
           name = COALESCE($2, name),
           avatar_url = COALESCE($3, avatar_url)
       WHERE id = $4
       RETURNING id, email, name, role, avatar_url, is_active`,
      [email, name, avatar_url, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// Update user role
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'instructor', 'student'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const result = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role',
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
};

// Update user status
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const result = await db.query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, email, name, is_active',
      [is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
};

// Update user password
const updateUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, email, name',
      [passwordHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Şifre başarıyla güncellendi',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update user password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// Import users from Excel
const importUsersFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Excel dosyası yüklenmedi' });
    }

    // Parse Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'Excel dosyası boş' });
    }

    const results = {
      success: [],
      errors: []
    };

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // Excel'de başlık 1. satır, veriler 2'den başlar

      try {
        // Validate required fields
        if (!row.email || !row.password || !row.name) {
          results.errors.push({
            row: rowNumber,
            email: row.email || 'N/A',
            error: 'Email, şifre ve isim zorunludur'
          });
          continue;
        }

        // Email formatını kontrol et
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(row.email)) {
          results.errors.push({
            row: rowNumber,
            email: row.email,
            error: 'Geçersiz email formatı'
          });
          continue;
        }

        // Check if email already exists
        const existing = await db.query(
          'SELECT id FROM users WHERE email = $1',
          [row.email]
        );

        if (existing.rows.length > 0) {
          results.errors.push({
            row: rowNumber,
            email: row.email,
            error: 'Bu email zaten kayıtlı'
          });
          continue;
        }

        // Validate role
        const role = row.role ? row.role.toLowerCase() : 'student';
        if (!['admin', 'instructor', 'student'].includes(role)) {
          results.errors.push({
            row: rowNumber,
            email: row.email,
            error: 'Geçersiz rol (admin, instructor veya student olmalı)'
          });
          continue;
        }

        // Convert password to string (Excel might read numbers)
        const password = String(row.password);

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const result = await db.query(
          `INSERT INTO users (email, password_hash, name, role, is_active)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, email, name, role`,
          [row.email, passwordHash, row.name, role, true]
        );

        results.success.push({
          row: rowNumber,
          user: result.rows[0]
        });
      } catch (error) {
        console.error(`Error processing row ${rowNumber}:`, error);
        results.errors.push({
          row: rowNumber,
          email: row.email || 'N/A',
          error: error.message || 'Bilinmeyen hata'
        });
      }
    }

    res.json({
      message: `İşlem tamamlandı. ${results.success.length} kullanıcı eklendi, ${results.errors.length} hata.`,
      summary: {
        total: data.length,
        success: results.success.length,
        errors: results.errors.length
      },
      results
    });
  } catch (error) {
    console.error('Import users error:', error);
    res.status(500).json({ error: 'Kullanıcılar içe aktarılırken hata oluştu' });
  }
};

// Download Excel template
const downloadExcelTemplate = async (req, res) => {
  try {
    // Create sample data
    const templateData = [
      {
        email: 'ornek@example.com',
        password: 'sifre123',
        name: 'Örnek Kullanıcı',
        role: 'student'
      },
      {
        email: 'ogretmen@example.com',
        password: 'sifre456',
        name: 'Örnek Öğretmen',
        role: 'instructor'
      }
    ];

    // Create workbook
    const ws = xlsx.utils.json_to_sheet(templateData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Kullanıcılar');

    // Set column widths
    ws['!cols'] = [
      { wch: 30 }, // email
      { wch: 15 }, // password
      { wch: 25 }, // name
      { wch: 15 }  // role
    ];

    // Generate buffer
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Send file
    res.setHeader('Content-Disposition', 'attachment; filename=kullanici-sablonu.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Download template error:', error);
    res.status(500).json({ error: 'Şablon indirilemedi' });
  }
};

// Get user statistics (for admin users page)
const getUserStatistics = async (req, res) => {
  try {
    // Total users
    const totalUsersQuery = `SELECT COUNT(*) as count FROM users`;
    const totalUsers = await db.query(totalUsersQuery);

    // Active users
    const activeUsersQuery = `SELECT COUNT(*) as count FROM users WHERE is_active = true`;
    const activeUsers = await db.query(activeUsersQuery);

    // Users by role
    const studentCountQuery = `SELECT COUNT(*) as count FROM users WHERE role = 'student'`;
    const instructorCountQuery = `SELECT COUNT(*) as count FROM users WHERE role = 'instructor'`;
    const adminCountQuery = `SELECT COUNT(*) as count FROM users WHERE role = 'admin'`;

    const studentCount = await db.query(studentCountQuery);
    const instructorCount = await db.query(instructorCountQuery);
    const adminCount = await db.query(adminCountQuery);

    // Users with pending assignments (students with submitted but not graded assignments)
    const pendingAssignmentsQuery = `
      SELECT COUNT(DISTINCT user_id) as count
      FROM assignment_submissions
      WHERE status = 'submitted'
    `;
    const pendingAssignments = await db.query(pendingAssignmentsQuery);

    // Recently active users (logged in within last 7 days)
    const recentlyActiveQuery = `
      SELECT COUNT(*) as count
      FROM users
      WHERE last_login >= NOW() - INTERVAL '7 days'
    `;
    const recentlyActive = await db.query(recentlyActiveQuery);

    // New users this month
    const newUsersQuery = `
      SELECT COUNT(*) as count
      FROM users
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `;
    const newUsers = await db.query(newUsersQuery);

    res.json({
      statistics: {
        totalUsers: parseInt(totalUsers.rows[0].count),
        activeUsers: parseInt(activeUsers.rows[0].count),
        studentCount: parseInt(studentCount.rows[0].count),
        instructorCount: parseInt(instructorCount.rows[0].count),
        adminCount: parseInt(adminCount.rows[0].count),
        pendingAssignments: parseInt(pendingAssignments.rows[0].count),
        recentlyActive: parseInt(recentlyActive.rows[0].count),
        newUsersThisMonth: parseInt(newUsers.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Get user statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserRole,
  updateUserStatus,
  updateUserPassword,
  deleteUser,
  importUsersFromExcel,
  downloadExcelTemplate,
  getUserStatistics
};
