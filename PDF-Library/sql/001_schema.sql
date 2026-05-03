-- ═══════════════════════════════════════════════════════════════
-- E-Library Database Schema (v2 — matches live database)
-- Run this only on a FRESH database. For existing DB use 002_seed.sql.
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- ── USERS TABLE ──────────────────────────────────────────────────
-- Stores Google-authenticated users. No password_hash — login is
-- handled entirely via Google OAuth access token verification.
CREATE TABLE IF NOT EXISTS users (
  id               BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  email            VARCHAR(255)     NOT NULL UNIQUE,
  name             VARCHAR(255)     NULL,
  profile_picture  TEXT             NULL,
  role             ENUM('user','admin') NOT NULL DEFAULT 'user',
  last_login       TIMESTAMP        NULL,
  created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── BOOKS TABLE ───────────────────────────────────────────────────
-- NOTE: The live database uses the table name `books_data`.
--       This CREATE statement also uses `books_data` to stay in sync.
--       The schema file previously used `pdfs` — that was incorrect.
CREATE TABLE IF NOT EXISTS books_data (
  id               BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  title            VARCHAR(255)     NOT NULL,
  author           VARCHAR(255)     NULL,
  description      TEXT             NULL,
  category         VARCHAR(100)     NULL,
  poster_drive_id  VARCHAR(255)     NULL,
  cover_drive_id   VARCHAR(255)     NULL,
  video_drive_id   VARCHAR(255)     NULL,
  pdf_drive_id     VARCHAR(255)     NULL,
  epub_drive_id    VARCHAR(255)     NULL,
  storage_provider ENUM('drive','r2','gcs','url') NOT NULL DEFAULT 'drive',
  gcs_bucket       VARCHAR(255)     NULL,
  gcs_object_key   VARCHAR(1024)    NULL,
  source_url       TEXT             NULL,
  is_private       TINYINT(1)       NOT NULL DEFAULT 1,
  created_by_email VARCHAR(255)     NULL,
  updated_by_email VARCHAR(255)     NULL,
  created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_books_category (category),
  INDEX idx_books_title (title),
  INDEX idx_books_created_by (created_by_email),
  INDEX idx_books_epub_drive_id (epub_drive_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Admin audit log. This records who performed sensitive admin actions.
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_email    VARCHAR(255)    NOT NULL,
  actor_name     VARCHAR(255)    NULL,
  actor_role     VARCHAR(50)     NULL,
  action         VARCHAR(100)    NOT NULL,
  target_type    VARCHAR(50)     NULL,
  target_id      BIGINT UNSIGNED NULL,
  target_title   VARCHAR(255)    NULL,
  details_json   LONGTEXT        NULL,
  created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_activity_created_at (created_at),
  INDEX idx_activity_actor_email (actor_email),
  INDEX idx_activity_action (action),
  INDEX idx_activity_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
