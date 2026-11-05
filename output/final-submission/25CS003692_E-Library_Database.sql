-- E-Library: complete fresh-database schema for academic submission
-- Student: Padam Kishore | Enrollment: 25CS003692
-- Programme: B.Tech CSE (AI-ML), Semester III
-- University: Sir Padampat Singhania University
-- Source revision: ea609ce9af79fe364c963cac0eea82490078eacb
-- Select an EMPTY MySQL 8 database before importing this file.
-- This is a schema delivery, not a backup of user records or credentials.
-- The legacy 003 repair script is not required on a fresh database.


-- Source: PDF-Library/sql/001_schema.sql
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


-- Source: PDF-Library/sql/005_payments.sql
-- Payment and premium-access tables.
-- Run this on the same MySQL database that stores books_data and users.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS payment_settings (
  id TINYINT UNSIGNED NOT NULL,
  payments_enabled TINYINT(1) NOT NULL DEFAULT 0,
  site_premium_enabled TINYINT(1) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  preview_page_limit INT UNSIGNED NOT NULL DEFAULT 10,
  monthly_price_paise INT UNSIGNED NOT NULL DEFAULT 19900,
  monthly_duration_days INT UNSIGNED NOT NULL DEFAULT 30,
  annual_price_paise INT UNSIGNED NOT NULL DEFAULT 29900,
  annual_duration_days INT UNSIGNED NOT NULL DEFAULT 365,
  updated_by_email VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO payment_settings (id)
VALUES (1)
ON DUPLICATE KEY UPDATE id = id;

CREATE TABLE IF NOT EXISTS book_premium_rules (
  book_id BIGINT UNSIGNED NOT NULL,
  is_premium TINYINT(1) NOT NULL DEFAULT 0,
  price_paise INT UNSIGNED NOT NULL DEFAULT 0,
  access_duration_days INT UNSIGNED NULL,
  allow_platform_download TINYINT(1) NOT NULL DEFAULT 1,
  updated_by_email VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (book_id),
  INDEX idx_book_premium_enabled (is_premium),
  CONSTRAINT fk_book_premium_rules_book
    FOREIGN KEY (book_id) REFERENCES books_data(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  user_email VARCHAR(255) NOT NULL,
  scope ENUM('site_subscription','book_purchase') NOT NULL,
  plan_key VARCHAR(40) NULL,
  book_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  amount_paise INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  gateway ENUM('razorpay') NOT NULL DEFAULT 'razorpay',
  gateway_order_id VARCHAR(100) NOT NULL,
  gateway_payment_id VARCHAR(100) NULL,
  gateway_signature VARCHAR(255) NULL,
  status ENUM('created','paid','failed','cancelled') NOT NULL DEFAULT 'created',
  receipt VARCHAR(80) NOT NULL,
  metadata_json LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_payment_orders_gateway_order (gateway_order_id),
  INDEX idx_payment_orders_user (user_email),
  INDEX idx_payment_orders_status (status),
  INDEX idx_payment_orders_scope_book (scope, book_id),
  CONSTRAINT fk_payment_orders_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_entitlements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  user_email VARCHAR(255) NOT NULL,
  scope ENUM('site_subscription','book_purchase') NOT NULL,
  book_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  source_order_id BIGINT UNSIGNED NULL,
  starts_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  status ENUM('active','expired','revoked') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_entitlement (user_email, scope, book_id),
  INDEX idx_user_entitlements_lookup (user_email, scope, book_id, status, expires_at),
  INDEX idx_user_entitlements_expires (expires_at),
  CONSTRAINT fk_user_entitlements_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_user_entitlements_order
    FOREIGN KEY (source_order_id) REFERENCES payment_orders(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Source: PDF-Library/sql/006_support_contributions.sql
-- Support contributions and optional supporter media.
-- Run after 005_payments.sql on the same MySQL database.

SET NAMES utf8mb4;

ALTER TABLE payment_orders
  MODIFY user_email VARCHAR(255) NULL;

ALTER TABLE payment_orders
  MODIFY scope ENUM('site_subscription','book_purchase','support_contribution') NOT NULL;

CREATE TABLE IF NOT EXISTS support_contributions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  supporter_name VARCHAR(120) NOT NULL DEFAULT 'Anonymous reader',
  supporter_handle VARCHAR(120) NULL,
  supporter_email VARCHAR(255) NULL,
  message TEXT NULL,
  amount_paise INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  local_amount DECIMAL(12,2) NULL,
  local_currency CHAR(3) NULL,
  upload_token_hash CHAR(64) NOT NULL,
  media_drive_id VARCHAR(128) NULL,
  media_mime_type VARCHAR(80) NULL,
  media_file_name VARCHAR(255) NULL,
  media_size_bytes BIGINT UNSIGNED NULL,
  media_uploaded_at TIMESTAMP NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM('created','paid','media_uploaded','failed','cancelled') NOT NULL DEFAULT 'created',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_support_contributions_order (order_id),
  UNIQUE KEY uniq_support_upload_token_hash (upload_token_hash),
  INDEX idx_support_contributions_public (is_public, status, paid_at),
  INDEX idx_support_contributions_user (supporter_email),
  CONSTRAINT fk_support_contributions_order
    FOREIGN KEY (order_id) REFERENCES payment_orders(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_support_contributions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
