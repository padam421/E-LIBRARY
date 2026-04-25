-- Safe repair for existing books_data tables created with the older schema.
-- Run only if admin book upload fails because the live table is missing columns.

ALTER TABLE books_data
  MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

ALTER TABLE books_data
  ADD COLUMN cover_drive_id VARCHAR(255) NULL AFTER poster_drive_id,
  ADD COLUMN epub_drive_id VARCHAR(255) NULL AFTER pdf_drive_id,
  ADD COLUMN storage_provider ENUM('drive','gcs','url') NOT NULL DEFAULT 'drive' AFTER pdf_drive_id,
  ADD COLUMN gcs_bucket VARCHAR(255) NULL AFTER storage_provider,
  ADD COLUMN gcs_object_key VARCHAR(1024) NULL AFTER gcs_bucket,
  ADD COLUMN source_url TEXT NULL AFTER gcs_object_key,
  ADD COLUMN is_private TINYINT(1) NOT NULL DEFAULT 1 AFTER source_url,
  ADD COLUMN created_by_email VARCHAR(255) NULL AFTER is_private,
  ADD COLUMN updated_by_email VARCHAR(255) NULL AFTER created_by_email,
  ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER updated_by_email,
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

ALTER TABLE books_data
  ADD INDEX idx_books_category (category),
  ADD INDEX idx_books_title (title),
  ADD INDEX idx_books_created_by (created_by_email),
  ADD INDEX idx_books_epub_drive_id (epub_drive_id);

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_email VARCHAR(255) NOT NULL,
  actor_name VARCHAR(255) NULL,
  actor_role VARCHAR(50) NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NULL,
  target_id BIGINT UNSIGNED NULL,
  target_title VARCHAR(255) NULL,
  details_json LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_activity_created_at (created_at),
  INDEX idx_activity_actor_email (actor_email),
  INDEX idx_activity_action (action),
  INDEX idx_activity_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
