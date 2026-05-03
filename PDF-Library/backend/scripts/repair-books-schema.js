import db from "../src/config/db.js";

async function getColumns() {
  const [columns] = await db.query("SHOW FULL COLUMNS FROM books_data");
  return new Map(columns.map((column) => [String(column.Field), column]));
}

async function getIndexes() {
  const [indexes] = await db.query("SHOW INDEX FROM books_data");
  return new Set(indexes.map((index) => String(index.Key_name)));
}

async function runAlter(statement, message) {
  console.log(`[Schema] ${message}`);
  await db.query(statement);
}

async function ensureColumn(columns, name, definition, message) {
  if (columns.has(name)) {
    return;
  }

  await runAlter(`ALTER TABLE books_data ADD COLUMN ${definition}`, message);
  columns.set(name, { Field: name });
}

async function ensureActivityLogTable() {
  await runAlter(
    `CREATE TABLE IF NOT EXISTS admin_activity_logs (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    "Ensuring admin_activity_logs table exists.",
  );
}

async function main() {
  const columns = await getColumns();

  if (!columns.has("id")) {
    throw new Error("books_data.id column is missing.");
  }

  const idColumn = columns.get("id");
  if (!String(idColumn.Extra || "").toLowerCase().includes("auto_increment")) {
    await runAlter(
      "ALTER TABLE books_data MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT",
      "Making books_data.id auto-increment so new books get an automatic ID.",
    );
  }

  await ensureColumn(
    columns,
    "cover_drive_id",
    "cover_drive_id VARCHAR(255) NULL AFTER poster_drive_id",
    "Adding cover_drive_id column.",
  );
  await ensureColumn(
    columns,
    "storage_provider",
    "storage_provider ENUM('drive','r2','gcs','url') NOT NULL DEFAULT 'drive' AFTER pdf_drive_id",
    "Adding storage_provider column.",
  );
  const storageProviderColumn = columns.get("storage_provider");
  if (
    storageProviderColumn
    && !String(storageProviderColumn.Type || "").toLowerCase().includes("'r2'")
  ) {
    await runAlter(
      "ALTER TABLE books_data MODIFY COLUMN storage_provider ENUM('drive','r2','gcs','url') NOT NULL DEFAULT 'drive'",
      "Updating storage_provider column to include R2.",
    );
  }
  await ensureColumn(
    columns,
    "epub_drive_id",
    "epub_drive_id VARCHAR(255) NULL AFTER pdf_drive_id",
    "Adding epub_drive_id column.",
  );
  await ensureColumn(
    columns,
    "gcs_bucket",
    "gcs_bucket VARCHAR(255) NULL AFTER storage_provider",
    "Adding gcs_bucket column.",
  );
  await ensureColumn(
    columns,
    "gcs_object_key",
    "gcs_object_key VARCHAR(1024) NULL AFTER gcs_bucket",
    "Adding gcs_object_key column.",
  );
  await ensureColumn(
    columns,
    "source_url",
    "source_url TEXT NULL AFTER gcs_object_key",
    "Adding source_url column.",
  );
  await ensureColumn(
    columns,
    "is_private",
    "is_private TINYINT(1) NOT NULL DEFAULT 1 AFTER source_url",
    "Adding is_private column.",
  );
  await ensureColumn(
    columns,
    "created_by_email",
    "created_by_email VARCHAR(255) NULL AFTER is_private",
    "Adding created_by_email audit column.",
  );
  await ensureColumn(
    columns,
    "updated_by_email",
    "updated_by_email VARCHAR(255) NULL AFTER created_by_email",
    "Adding updated_by_email audit column.",
  );
  await ensureColumn(
    columns,
    "created_at",
    "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER is_private",
    "Adding created_at column.",
  );
  await ensureColumn(
    columns,
    "updated_at",
    "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
    "Adding updated_at column.",
  );

  const indexes = await getIndexes();
  if (!indexes.has("idx_books_category")) {
    await runAlter(
      "ALTER TABLE books_data ADD INDEX idx_books_category (category)",
      "Adding category index.",
    );
  }

  if (!indexes.has("idx_books_title")) {
    await runAlter(
      "ALTER TABLE books_data ADD INDEX idx_books_title (title)",
      "Adding title index.",
    );
  }

  if (!indexes.has("idx_books_created_by")) {
    await runAlter(
      "ALTER TABLE books_data ADD INDEX idx_books_created_by (created_by_email)",
      "Adding created-by audit index.",
    );
  }

  if (!indexes.has("idx_books_epub_drive_id")) {
    await runAlter(
      "ALTER TABLE books_data ADD INDEX idx_books_epub_drive_id (epub_drive_id)",
      "Adding EPUB Drive ID index.",
    );
  }

  await ensureActivityLogTable();

  console.log("[Schema] books_data table and admin activity log are ready.");
}

try {
  await main();
} catch (error) {
  console.error("[Schema] Repair failed:", error?.message || error);
  process.exitCode = 1;
} finally {
  await db.end();
}
