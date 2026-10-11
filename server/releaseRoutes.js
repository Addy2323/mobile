import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createReleaseRouter(pool) {
  const router = express.Router();

  // 1. Get all active releases
  router.get('/', async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT id, platform, version_name, version_code, file_url, file_type,
               file_size, sha256_checksum, release_notes, min_os_version,
               is_active, is_recommended, download_count, created_at, updated_at
        FROM app_releases
        WHERE is_active = true
        ORDER BY created_at DESC
      `);
      res.json({ releases: rows });
    } catch (err) {
      console.error('[Releases] Fetch error:', err);
      res.status(500).json({ error: 'Failed to retrieve release metadata' });
    }
  });

  // 2. Get latest release per platform
  router.get('/latest', async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT DISTINCT ON (platform)
               id, platform, version_name, version_code, file_url, file_type,
               file_size, sha256_checksum, release_notes, min_os_version,
               is_active, is_recommended, download_count, created_at, updated_at
        FROM app_releases
        WHERE is_active = true
        ORDER BY platform, is_recommended DESC, version_code DESC, created_at DESC
      `);

      const latestMap = {};
      for (const row of rows) {
        latestMap[row.platform] = row;
      }

      res.json({ latest: latestMap });
    } catch (err) {
      console.error('[Releases] Fetch latest error:', err);
      res.status(500).json({ error: 'Failed to retrieve latest releases' });
    }
  });

  // 3. Download artifact with tracking and exact MIME headers
  router.get('/download/:platform', async (req, res) => {
    try {
      const platform = req.params.platform.toLowerCase();
      const { rows } = await pool.query(`
        SELECT * FROM app_releases
        WHERE platform = $1 AND is_active = true
        ORDER BY is_recommended DESC, version_code DESC
        LIMIT 1
      `, [platform]);

      if (rows.length === 0) {
        return res.status(404).json({
          error: `No published release found for platform: ${platform}`
        });
      }

      const release = rows[0];

      // If PWA or web, redirect to installation start URL
      if (release.file_type === 'pwa' || !release.file_url || release.file_url.startsWith('/?')) {
        return res.redirect(release.file_url || '/?source=pwa');
      }

      // If an actual file is stored locally in public/download/
      const localFilePath = path.join(__dirname, '..', 'public', release.file_url.replace(/^\//, ''));
      if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
        // Increment download counter
        await pool.query('UPDATE app_releases SET download_count = download_count + 1 WHERE id = $1', [release.id]);

        const fileName = path.basename(localFilePath);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        if (platform === 'android' || fileName.endsWith('.apk')) {
          res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        } else {
          res.setHeader('Content-Type', 'application/octet-stream');
        }
        return res.sendFile(localFilePath);
      }

      // If external or web link, redirect
      if (release.file_url.startsWith('http://') || release.file_url.startsWith('https://')) {
        await pool.query('UPDATE app_releases SET download_count = download_count + 1 WHERE id = $1', [release.id]);
        return res.redirect(release.file_url);
      }

      return res.status(404).json({
        error: 'The requested artifact file is not currently available for direct download. Please install via PWA.',
        method: 'pwa'
      });
    } catch (err) {
      console.error('[Releases] Download error:', err);
      res.status(500).json({ error: 'Download request failed' });
    }
  });

  // 4. Admin publish / register release (Protected)
  router.post('/', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const secret = process.env.ADMIN_SECRET || process.env.SUPER_ADMIN_PASSWORD || 'Lumo@Admin2026!';
      if (!authHeader.includes(secret)) {
        return res.status(401).json({ error: 'Unauthorized: Admin privileges required' });
      }

      const {
        platform,
        version_name,
        version_code,
        file_url,
        file_type,
        file_size,
        sha256_checksum,
        release_notes,
        min_os_version,
        is_recommended = true
      } = req.body;

      if (!platform || !version_name || !version_code) {
        return res.status(400).json({ error: 'platform, version_name, and version_code are required' });
      }

      if (is_recommended) {
        // Demote other releases for this platform
        await pool.query('UPDATE app_releases SET is_recommended = false WHERE platform = $1', [platform]);
      }

      const { rows } = await pool.query(`
        INSERT INTO app_releases (
          platform, version_name, version_code, file_url, file_type,
          file_size, sha256_checksum, release_notes, min_os_version, is_recommended
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        platform,
        version_name,
        parseInt(version_code, 10),
        file_url,
        file_type || 'apk',
        file_size ? parseInt(file_size, 10) : null,
        sha256_checksum || null,
        release_notes || '',
        min_os_version || '',
        Boolean(is_recommended)
      ]);

      res.status(201).json({ success: true, release: rows[0] });
    } catch (err) {
      console.error('[Releases] Create error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
