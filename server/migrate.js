import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:myamba2323@localhost:5432/lumosprit_bd?schema=public';

async function runMigration() {
  console.log('🚀 Starting PostgreSQL migration for LUMO Split...');

  // 1. Connect to default 'postgres' database to check/create 'lumosprit_bd'
  const rootUrl = dbUrl.replace(/\/lumosprit_bd(\?.*)?$/, '/postgres');
  const rootClient = new pg.Client({ connectionString: rootUrl });

  try {
    await rootClient.connect();
    const res = await rootClient.query("SELECT 1 FROM pg_database WHERE datname = 'lumosprit_bd'");
    if (res.rowCount === 0) {
      console.log('Creating database lumosprit_bd...');
      await rootClient.query('CREATE DATABASE lumosprit_bd');
      console.log('Database lumosprit_bd created successfully.');
    } else {
      console.log('Database lumosprit_bd already exists.');
    }
  } catch (err) {
    console.error('Error checking/creating database:', err.message);
  } finally {
    await rootClient.end();
  }

  // 2. Connect to lumosprit_bd database
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  console.log('Connected to lumosprit_bd database.');

  try {
    // Ensure pgcrypto extension for gen_random_uuid and gen_random_bytes
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    // Create Supabase-compatible roles if missing for RLS statements
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
      END $$;
    `);

    // Load migrations
    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      console.log(`Executing migration file: ${file}...`);
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sql);
      console.log(`Successfully executed ${file}`);
    }

    // 3. Seed initial default merchants if empty
    const merchantsRes = await client.query('SELECT COUNT(*) FROM merchants');
    if (parseInt(merchantsRes.rows[0].count, 10) === 0) {
      console.log('Seeding initial verified merchants...');
      const seedMerchants = [
        {
          display_name: 'Serena Hotel Dar es Salaam',
          legal_name: 'Serena Hotels Tanzania Ltd',
          category: 'hotel',
          phone: '+255 22 211 2416',
          verification_status: 'VERIFIED',
          destination_id: 'MERCH-SERENA-001',
          payment_rail: 'mobile_money',
          support_contact: 'support@serena.co.tz',
          city: 'Dar es Salaam',
          rating: 4.8
        },
        {
          display_name: 'Cape Town Fish Market',
          legal_name: 'CTFM Tanzania Ltd',
          category: 'restaurant',
          phone: '+255 754 123 456',
          verification_status: 'VERIFIED',
          destination_id: 'MERCH-CTFM-002',
          payment_rail: 'mobile_money',
          support_contact: 'info@ctfm.co.tz',
          city: 'Dar es Salaam',
          rating: 4.6
        },
        {
          display_name: 'Samaki Samaki',
          legal_name: 'Samaki Samaki Lounge Ltd',
          category: 'restaurant',
          phone: '+255 713 987 654',
          verification_status: 'VERIFIED',
          destination_id: 'MERCH-SAMAKI-003',
          payment_rail: 'mobile_money',
          support_contact: 'care@samakisamaki.co.tz',
          city: 'Dar es Salaam',
          rating: 4.7
        },
        {
          display_name: 'Shoppers Supermarket',
          legal_name: 'Shoppers Plaza Ltd',
          category: 'supermarket',
          phone: '+255 22 270 0000',
          verification_status: 'VERIFIED',
          destination_id: 'MERCH-SHOP-004',
          payment_rail: 'mobile_money',
          support_contact: 'help@shoppers.co.tz',
          city: 'Dar es Salaam',
          rating: 4.5
        }
      ];

      for (const m of seedMerchants) {
        await client.query(
          `INSERT INTO merchants (display_name, legal_name, category, phone, verification_status, destination_id, payment_rail, support_contact, city, rating)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (destination_id) DO NOTHING;`,
          [m.display_name, m.legal_name, m.category, m.phone, m.verification_status, m.destination_id, m.payment_rail, m.support_contact, m.city, m.rating]
        );
      }
      console.log('Seeded initial verified merchants successfully.');
    }

    console.log('✅ Migration & seeding completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
