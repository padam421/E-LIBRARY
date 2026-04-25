-- Adds owner/admin audit tracking to an existing database.
-- Prefer running `cd backend && npm run repair:books-schema` because it checks
-- existing columns before changing anything.

ALTER TABLE books_data
  ADD COLUMN epub_drive_id VARCHAR(255) NULL AFTER pdf_drive_id,
  ADD COLUMN created_by_email VARCHAR(255) NULL AFTER is_private,
  ADD COLUMN updated_by_email VARCHAR(255) NULL AFTER created_by_email;

ALTER TABLE books_data
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
