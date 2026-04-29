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
