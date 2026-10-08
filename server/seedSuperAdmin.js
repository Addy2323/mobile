import pg from 'pg';
import dotenv from 'dotenv';
import { hashPassword } from './adminAuth.js';

dotenv.config();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:myamba2323@localhost:5432/lumosprit_bd?schema=public';
const pool = new pg.Pool({ connectionString: dbUrl });

async function seedSuperAdmin() {
  const client = await pool.connect();
  try {
    console.log('🚀 Seeding Initial Super Admin Account...');
    await client.query('BEGIN');

    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@lumo.co.tz';
    const adminName = process.env.INITIAL_ADMIN_NAME || 'Super Administrator';
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || 'LumoSuperAdmin2026!';
    const passwordHash = hashPassword(initialPassword);

    // 1. Insert or update Super Admin user
    const userRes = await client.query(
      `INSERT INTO admin_users (email, full_name, password_hash, status)
       VALUES ($1, $2, $3, 'ACTIVE')
       ON CONFLICT (email) DO UPDATE
       SET full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash, status = 'ACTIVE'
       RETURNING id, email, full_name`,
      [adminEmail, adminName, passwordHash]
    );

    const adminUser = userRes.rows[0];

    // 2. Fetch SUPER_ADMIN role ID
    const roleRes = await client.query("SELECT id FROM roles WHERE name = 'SUPER_ADMIN'");
    if (roleRes.rows.length === 0) {
      throw new Error('SUPER_ADMIN role not found. Ensure migrations have run.');
    }
    const roleId = roleRes.rows[0].id;

    // 3. Assign SUPER_ADMIN role
    await client.query(
      `INSERT INTO admin_user_roles (admin_user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [adminUser.id, roleId]
    );

    await client.query('COMMIT');
    console.log('✅ Super Admin Account Seeded Successfully!');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Role:  SUPER_ADMIN`);
    console.log(`   ID:    ${adminUser.id}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed seeding Super Admin account:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedSuperAdmin();
