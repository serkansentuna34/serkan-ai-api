require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function initAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@serkansentuna.com.tr';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = process.env.ADMIN_NAME || 'Admin';

    // Check if admin exists
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );

    if (existing.rows.length > 0) {
      console.log('✅ Admin user already exists');
      process.exit(0);
    }

    // Create admin
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await db.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)`,
      [adminEmail, passwordHash, adminName, 'admin']
    );

    console.log('✅ Admin user created successfully');
    console.log(`📧 Email: ${adminEmail}`);
    console.log(`🔑 Password: ${adminPassword}`);
    console.log('⚠️  Please change the password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create admin:', error);
    process.exit(1);
  }
}

initAdmin();
