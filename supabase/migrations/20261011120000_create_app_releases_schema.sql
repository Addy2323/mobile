-- 20261011120000_create_app_releases_schema.sql
-- Schema for LUMO Split App Releases and Download Center Management

CREATE TABLE IF NOT EXISTS app_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(50) NOT NULL, -- 'android', 'pwa', 'ios', 'windows', 'macos', 'desktop'
    version_name VARCHAR(50) NOT NULL, -- '1.0.0'
    version_code INTEGER NOT NULL, -- 10000
    file_url VARCHAR(500),
    file_type VARCHAR(50) NOT NULL, -- 'apk', 'pwa', 'web'
    file_size BIGINT,
    sha256_checksum VARCHAR(64),
    release_notes TEXT,
    min_os_version VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_recommended BOOLEAN DEFAULT true,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_releases_platform ON app_releases(platform);
CREATE INDEX IF NOT EXISTS idx_app_releases_active ON app_releases(is_active);

-- Seed initial official release entries for LUMO Split
INSERT INTO app_releases (platform, version_name, version_code, file_url, file_type, min_os_version, release_notes, is_active, is_recommended)
VALUES 
  ('pwa', '1.0.0', 100, '/?source=pwa', 'pwa', 'All modern browsers (Chrome, Safari, Edge, Firefox)', 'Official LUMO Split Progressive Web App. Install directly to your device home screen with full offline shell, instant launch, and zero app store delays.', true, true),
  ('android', '1.0.0', 100, '/?source=pwa', 'pwa', 'Android 8.0+ (Chrome / Samsung Internet)', 'LUMO Split Android Official WebAPK PWA. Native integration with Android application launcher, full-screen standalone mode, and biometric lock integration.', true, true),
  ('ios', '1.0.0', 100, '/?source=pwa', 'pwa', 'iOS 14.0+ (Safari)', 'LUMO Split for iPhone & iPad. Seamless standalone installation via Safari Add to Home Screen.', true, true),
  ('desktop', '1.0.0', 100, '/?source=pwa', 'pwa', 'Windows 10+, macOS 11+, Linux', 'LUMO Split Desktop Web App. Pin to taskbar or dock with dedicated desktop window experience.', true, true)
ON CONFLICT DO NOTHING;
