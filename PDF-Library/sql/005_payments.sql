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
