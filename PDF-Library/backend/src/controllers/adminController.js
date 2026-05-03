import db from "../config/db.js";
import { OWNER_ADMIN_EMAIL, isOwnerEmail, normalizeEmail } from "../config/adminAccess.js";
import { invalidatePDFCache } from "../models/pdfModel.js";
import {
  getDefaultBookStorageProvider,
  normalizeStorageProvider,
  sanitizeAssetReference,
} from "../services/bookStorage.js";

const MAX_BULK_BOOKS_PER_REQUEST = 1000;
const MAX_BULK_DELETE_PER_REQUEST = 1000;
const MAX_BULK_VISIBILITY_UPDATE_PER_REQUEST = 1000;
const MAX_ACTIVITY_LOGS_PER_PAGE = 100;

function sanitizeText(value, maxLen = 255) {
  return String(value || "").trim().slice(0, maxLen) || null;
}

function getStorageProviderInput(input) {
  if (!input || typeof input !== "object") return undefined;
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(input, key);
  if (hasOwn("storage_provider")) return input.storage_provider;
  if (hasOwn("storageProvider")) return input.storageProvider;
  if (hasOwn("provider")) return input.provider;
  return undefined;
}

function hasStorageProviderInput(input) {
  return getStorageProviderInput(input) !== undefined;
}

function parseStorageProvider(input, defaultValue = getDefaultBookStorageProvider()) {
  const value = getStorageProviderInput(input);
  if (value === undefined || value === null || String(value).trim() === "") {
    return normalizeStorageProvider(defaultValue);
  }

  return normalizeStorageProvider(value);
}

function getBookWriteErrorMessage(error, fallbackMessage) {
  if (error?.code === "ER_BAD_FIELD_ERROR" || error?.code === "ER_NO_DEFAULT_FOR_FIELD") {
    return "Database table needs repair. Run: npm run repair:books-schema";
  }

  if (error?.code === "ER_DUP_ENTRY") {
    return "A database record with the same unique value already exists.";
  }

  return fallbackMessage;
}

function parsePositiveInt(value, defaultValue, maxValue) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(parsed, maxValue);
}

function parseBookIds(value) {
  return Array.isArray(value)
    ? [
        ...new Set(
          value
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0),
        ),
      ]
    : [];
}

function getPrivacyInput(input) {
  if (!input || typeof input !== "object") return undefined;
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(input, key);
  if (hasOwn("is_private")) return input.is_private;
  if (hasOwn("isPrivate")) return input.isPrivate;
  if (hasOwn("private")) return input.private;
  if (hasOwn("visibility")) return input.visibility;
  if (hasOwn("status")) return input.status;
  return undefined;
}

function hasPrivacyInput(input) {
  return getPrivacyInput(input) !== undefined;
}

function parsePrivacyFlag(input, defaultValue = 1) {
  const value = getPrivacyInput(input);
  if (value === undefined || value === null || String(value).trim() === "") {
    return defaultValue ? 1 : 0;
  }

  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value === 0 ? 0 : 1;

  const normalized = String(value).trim().toLowerCase();
  if (["0", "false", "public", "published", "publish", "visible", "live"].includes(normalized)) {
    return 0;
  }
  if (["1", "true", "private", "draft", "hidden", "unpublished"].includes(normalized)) {
    return 1;
  }

  return defaultValue ? 1 : 0;
}

function buildBookRecord(input, rowNumber = 1) {
  const storageProvider = parseStorageProvider(input);
  const safeTitle = sanitizeText(input?.title, 255);
  const safePdfId = sanitizeAssetReference(
    input?.pdf_drive_id || input?.pdfDriveId || input?.pdf,
    storageProvider,
  );
  const safeEpubId = sanitizeAssetReference(
    input?.epub_drive_id || input?.epubDriveId || input?.epub,
    storageProvider,
  );
  const posterDriveId = sanitizeAssetReference(
    input?.poster_drive_id || input?.posterDriveId || input?.cover_drive_id || input?.coverDriveId,
    storageProvider,
  );

  const errors = [];
  if (!safeTitle) {
    errors.push(`Row ${rowNumber}: Book title is required.`);
  }
  if (!safePdfId && !safeEpubId) {
    errors.push(`Row ${rowNumber}: Add at least one readable file: PDF Drive ID or EPUB Drive ID.`);
  }

  return {
    errors,
    book: {
      title: safeTitle,
      author: sanitizeText(input?.author, 255),
      description: sanitizeText(input?.description, 5000),
      category: sanitizeText(input?.category, 100),
      storage_provider: storageProvider,
      poster_drive_id: posterDriveId,
      cover_drive_id: sanitizeAssetReference(
        input?.cover_drive_id || input?.coverDriveId,
        storageProvider,
      ),
      video_drive_id: sanitizeAssetReference(
        input?.video_drive_id || input?.videoDriveId,
        storageProvider,
      ),
      pdf_drive_id: safePdfId,
      epub_drive_id: safeEpubId,
      is_private: parsePrivacyFlag(input, 1),
    },
  };
}

function flattenBooksForInsert(books, actorEmail) {
  return books.flatMap((book) => [
    book.title,
    book.author,
    book.description,
    book.category,
    book.storage_provider,
    book.poster_drive_id,
    book.cover_drive_id,
    book.video_drive_id,
    book.pdf_drive_id,
    book.epub_drive_id,
    book.is_private,
    actorEmail,
    actorEmail,
  ]);
}

async function insertBooks(books, actorEmail, executor = db) {
  const placeholders = books.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
  const [result] = await executor.query(
    `INSERT INTO books_data
       (title, author, description, category,
        storage_provider, poster_drive_id, cover_drive_id, video_drive_id, pdf_drive_id,
        epub_drive_id, is_private, created_by_email, updated_by_email)
     VALUES ${placeholders}`,
    flattenBooksForInsert(books, actorEmail),
  );

  return result;
}

function getActor(req) {
  return {
    email: normalizeEmail(req.sessionUser?.email),
    name: sanitizeText(req.sessionUser?.name || req.sessionUser?.given_name, 255),
    role: req.sessionUser?.role || "admin",
  };
}

async function logAdminActivity(req, action, targetType, targetId, targetTitle, details = {}) {
  const actor = getActor(req);
  if (!actor.email) return;

  try {
    await db.query(
      `INSERT INTO admin_activity_logs
         (actor_email, actor_name, actor_role, action, target_type, target_id, target_title, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actor.email,
        actor.name,
        actor.role,
        action,
        targetType,
        targetId != null && Number.isInteger(Number(targetId)) ? Number(targetId) : null,
        sanitizeText(targetTitle, 255),
        JSON.stringify(details || {}),
      ],
    );
  } catch (error) {
    console.error("[Admin] activity log failed:", error?.message || error);
  }
}

function parseDetailsJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function requireOwner(req, res) {
  if (!req.sessionUser?.isOwner) {
    res.status(403).json({ error: "Owner access required." });
    return false;
  }

  return true;
}

function mapAdminUser(user) {
  const owner = isOwnerEmail(user.email);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profile_picture: user.profile_picture,
    role: owner ? "owner" : user.role,
    isOwner: owner,
    last_login: user.last_login,
    created_at: user.created_at,
  };
}

export const listAdminUsers = async (req, res) => {
  if (!requireOwner(req, res)) return;

  try {
    const [rows] = await db.query(
      `SELECT id, email, name, profile_picture, role, last_login, created_at
         FROM users
        WHERE role = 'admin' OR LOWER(email) = ?
        ORDER BY CASE WHEN LOWER(email) = ? THEN 0 ELSE 1 END, email ASC`,
      [OWNER_ADMIN_EMAIL, OWNER_ADMIN_EMAIL],
    );

    return res.status(200).json({
      ownerEmail: OWNER_ADMIN_EMAIL,
      users: rows.map(mapAdminUser),
    });
  } catch (error) {
    console.error("[Admin] listAdminUsers error:", error);
    return res.status(500).json({ error: "Failed to load admin users." });
  }
};

export const listAdminActivity = async (req, res) => {
  if (!requireOwner(req, res)) return;

  const page = parsePositiveInt(req.query?.page, 1, 1000000);
  const limit = parsePositiveInt(req.query?.limit, 50, MAX_ACTIVITY_LOGS_PER_PAGE);
  const offset = (page - 1) * limit;

  try {
    const [countRows] = await db.query("SELECT COUNT(*) AS total FROM admin_activity_logs");
    const [rows] = await db.query(
      `SELECT id, actor_email, actor_name, actor_role, action, target_type,
              target_id, target_title, details_json, created_at
         FROM admin_activity_logs
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    const total = Number(countRows[0]?.total || 0);
    return res.status(200).json({
      logs: rows.map((row) => ({
        ...row,
        details: parseDetailsJson(row.details_json),
      })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error("[Admin] listAdminActivity error:", error);
    return res.status(500).json({ error: "Failed to load admin activity." });
  }
};

export const grantAdmin = async (req, res) => {
  if (!requireOwner(req, res)) return;

  const email = normalizeEmail(req.body?.email);
  const name = sanitizeText(req.body?.name, 255);
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  try {
    const [existing] = await db.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email],
    );

    if (existing.length > 0) {
      await db.query(
        "UPDATE users SET role = 'admin', name = COALESCE(?, name) WHERE email = ?",
        [name, email],
      );
    } else {
      await db.query(
        "INSERT INTO users (email, name, role) VALUES (?, ?, 'admin')",
        [email, name],
      );
    }

    await logAdminActivity(req, "admin.granted", "user", null, email, {
      granted_email: email,
      granted_name: name,
    });

    return res.status(200).json({
      message: isOwnerEmail(email)
        ? "Owner account confirmed."
        : "Admin permission granted.",
      email,
    });
  } catch (error) {
    console.error("[Admin] grantAdmin error:", error);
    return res.status(500).json({ error: "Failed to grant admin permission." });
  }
};

export const revokeAdmin = async (req, res) => {
  if (!requireOwner(req, res)) return;

  const email = normalizeEmail(req.body?.email);
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  if (isOwnerEmail(email)) {
    return res.status(400).json({ error: "The owner account cannot be removed." });
  }

  try {
    const [result] = await db.query(
      "UPDATE users SET role = 'user' WHERE email = ?",
      [email],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    await logAdminActivity(req, "admin.revoked", "user", null, email, {
      revoked_email: email,
    });

    return res.status(200).json({
      message: "Admin permission removed.",
      email,
    });
  } catch (error) {
    console.error("[Admin] revokeAdmin error:", error);
    return res.status(500).json({ error: "Failed to remove admin permission." });
  }
};

export const listBooks = async (req, res) => {
  const page = parsePositiveInt(req.query?.page, 1, 1000000);
  const limit = parsePositiveInt(req.query?.limit, 50, 200);
  const offset = (page - 1) * limit;
  const search = String(req.query?.search || "").trim();
  const whereClauses = [];
  const whereParams = [];

  if (search) {
    whereClauses.push("(title LIKE ? OR author LIKE ? OR category LIKE ?)");
    const like = `%${search}%`;
    whereParams.push(like, like, like);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  try {
    const [statsRows] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE
           WHEN video_drive_id IS NOT NULL
            AND TRIM(video_drive_id) <> ''
            AND LOWER(video_drive_id) <> 'no video available'
           THEN 1 ELSE 0 END) AS with_video,
         SUM(CASE
           WHEN (poster_drive_id IS NOT NULL AND TRIM(poster_drive_id) <> '')
             OR (cover_drive_id IS NOT NULL AND TRIM(cover_drive_id) <> '')
           THEN 1 ELSE 0 END) AS with_cover,
         SUM(CASE WHEN COALESCE(is_private, 1) = 0 THEN 1 ELSE 0 END) AS public_count,
         SUM(CASE WHEN COALESCE(is_private, 1) = 1 THEN 1 ELSE 0 END) AS private_count
       FROM books_data
       ${whereSql}`,
      whereParams,
    );

    const [rows] = await db.query(
      `SELECT *
         FROM books_data
         ${whereSql}
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset],
    );

    const total = Number(statsRows[0]?.total || 0);
    return res.status(200).json({
      books: rows,
      items: rows,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      stats: {
        total,
        withVideo: Number(statsRows[0]?.with_video || 0),
        withCover: Number(statsRows[0]?.with_cover || 0),
        public: Number(statsRows[0]?.public_count || 0),
        private: Number(statsRows[0]?.private_count || 0),
      },
    });
  } catch (error) {
    console.error("[Admin] listBooks error:", error);
    return res.status(500).json({ error: "Failed to fetch books." });
  }
};

export const createBook = async (req, res) => {
  const { book, errors } = buildBookRecord(req.body, 1);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0], errors });
  }

  try {
    const actorEmail = getActor(req).email;
    const result = await insertBooks([book], actorEmail);
    await logAdminActivity(req, "book.created", "book", result.insertId, book.title, {
      title: book.title,
      author: book.author,
      category: book.category,
      storage_provider: book.storage_provider,
      pdf_drive_id: book.pdf_drive_id,
      epub_drive_id: book.epub_drive_id,
      is_private: book.is_private,
    });
    invalidatePDFCache();
    return res.status(201).json({ id: result.insertId, message: "Book created successfully." });
  } catch (error) {
    console.error("[Admin] createBook error:", error);
    return res.status(500).json({
      error: getBookWriteErrorMessage(error, "Failed to create book."),
    });
  }
};

export const createBooksBulk = async (req, res) => {
  const incomingBooks = Array.isArray(req.body?.books) ? req.body.books : [];

  if (incomingBooks.length === 0) {
    return res.status(400).json({ error: "No books were provided for import." });
  }

  if (incomingBooks.length > MAX_BULK_BOOKS_PER_REQUEST) {
    return res.status(400).json({
      error: `Too many books in one request. Send ${MAX_BULK_BOOKS_PER_REQUEST} or fewer books per batch.`,
    });
  }

  const prepared = incomingBooks.map((book, index) => buildBookRecord(book, index + 1));
  const errors = prepared.flatMap((entry) => entry.errors).slice(0, 25);

  if (errors.length > 0) {
    return res.status(400).json({
      error: errors[0],
      errors,
    });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const actorEmail = getActor(req).email;
    const books = prepared.map((entry) => entry.book);
    const result = await insertBooks(books, actorEmail, connection);
    await connection.commit();

    await logAdminActivity(req, "books.bulk_imported", "book", result.insertId, "Bulk import", {
      inserted: result.affectedRows,
      first_insert_id: result.insertId,
      titles_preview: books.slice(0, 10).map((book) => book.title),
    });
    invalidatePDFCache();

    return res.status(201).json({
      message: "Books imported successfully.",
      inserted: result.affectedRows,
      firstInsertId: result.insertId,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }
    console.error("[Admin] createBooksBulk error:", error);
    return res.status(500).json({
      error: getBookWriteErrorMessage(error, "Failed to import books."),
    });
  } finally {
    if (connection) connection.release();
  }
};

export const updateBook = async (req, res) => {
  const bookId = Number(req.params?.id);
  if (!Number.isInteger(bookId) || bookId <= 0) {
    return res.status(400).json({ error: "Invalid book ID." });
  }

  const { book, errors } = buildBookRecord(req.body, 1);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0], errors });
  }

  try {
    const [existingRows] = await db.query(
      "SELECT id, title, author, category, storage_provider, pdf_drive_id, epub_drive_id, is_private FROM books_data WHERE id = ? LIMIT 1",
      [bookId],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: "Book not found." });
    }

    if (!hasPrivacyInput(req.body)) {
      book.is_private = Number(existingRows[0].is_private || 0) === 1 ? 1 : 0;
    }
    if (!hasStorageProviderInput(req.body)) {
      book.storage_provider = normalizeStorageProvider(existingRows[0].storage_provider);
    }

    const [result] = await db.query(
      `UPDATE books_data
          SET title = ?, author = ?, description = ?, category = ?,
              storage_provider = ?, poster_drive_id = ?, cover_drive_id = ?, video_drive_id = ?, pdf_drive_id = ?,
              epub_drive_id = ?, is_private = ?,
              updated_by_email = ?
        WHERE id = ?`,
      [
        book.title,
        book.author,
        book.description,
        book.category,
        book.storage_provider,
        book.poster_drive_id,
        book.cover_drive_id,
        book.video_drive_id,
        book.pdf_drive_id,
        book.epub_drive_id,
        book.is_private,
        getActor(req).email,
        bookId,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Book not found." });
    }

    await logAdminActivity(req, "book.updated", "book", bookId, book.title, {
      previous_title: existingRows[0].title,
      new_title: book.title,
      previous_category: existingRows[0].category,
      new_category: book.category,
      previous_storage_provider: normalizeStorageProvider(existingRows[0].storage_provider),
      new_storage_provider: book.storage_provider,
      previous_pdf_drive_id: existingRows[0].pdf_drive_id,
      new_pdf_drive_id: book.pdf_drive_id,
      previous_epub_drive_id: existingRows[0].epub_drive_id,
      new_epub_drive_id: book.epub_drive_id,
      previous_is_private: Number(existingRows[0].is_private || 0) === 1 ? 1 : 0,
      new_is_private: book.is_private,
    });
    invalidatePDFCache();

    return res.status(200).json({ message: "Book updated successfully." });
  } catch (error) {
    console.error("[Admin] updateBook error:", error);
    return res.status(500).json({
      error: getBookWriteErrorMessage(error, "Failed to update book."),
    });
  }
};

export const deleteBook = async (req, res) => {
  const bookId = Number(req.params?.id);
  if (!Number.isInteger(bookId) || bookId <= 0) {
    return res.status(400).json({ error: "Invalid book ID." });
  }

  try {
    const [existingRows] = await db.query(
      "SELECT id, title, author, category, pdf_drive_id, epub_drive_id FROM books_data WHERE id = ? LIMIT 1",
      [bookId],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: "Book not found." });
    }

    const [result] = await db.query(
      "DELETE FROM books_data WHERE id = ?",
      [bookId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Book not found." });
    }

    await logAdminActivity(req, "book.deleted", "book", bookId, existingRows[0].title, {
      title: existingRows[0].title,
      author: existingRows[0].author,
      category: existingRows[0].category,
      pdf_drive_id: existingRows[0].pdf_drive_id,
      epub_drive_id: existingRows[0].epub_drive_id,
    });
    invalidatePDFCache();

    return res.status(200).json({ message: "Book deleted successfully." });
  } catch (error) {
    console.error("[Admin] deleteBook error:", error);
    return res.status(500).json({ error: "Failed to delete book." });
  }
};

export const updateBooksVisibilityBulk = async (req, res) => {
  const uniqueIds = parseBookIds(req.body?.ids);
  if (uniqueIds.length === 0) {
    return res.status(400).json({ error: "No valid book IDs were selected." });
  }

  if (uniqueIds.length > MAX_BULK_VISIBILITY_UPDATE_PER_REQUEST) {
    return res.status(400).json({
      error: `Update ${MAX_BULK_VISIBILITY_UPDATE_PER_REQUEST} or fewer books at one time.`,
    });
  }

  if (!hasPrivacyInput(req.body)) {
    return res.status(400).json({ error: "Choose either Private or Public before applying." });
  }

  const isPrivate = parsePrivacyFlag(req.body, 1);
  const visibilityLabel = isPrivate ? "Private" : "Public";

  try {
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const [booksToUpdate] = await db.query(
      `SELECT id, title, is_private FROM books_data WHERE id IN (${placeholders})`,
      uniqueIds,
    );

    if (booksToUpdate.length === 0) {
      return res.status(404).json({ error: "No selected books were found." });
    }

    const [result] = await db.query(
      `UPDATE books_data
          SET is_private = ?, updated_by_email = ?
        WHERE id IN (${placeholders})`,
      [isPrivate, getActor(req).email, ...uniqueIds],
    );

    await logAdminActivity(req, "books.visibility_updated", "book", null, `Bulk ${visibilityLabel}`, {
      requested_ids: uniqueIds,
      matched: booksToUpdate.length,
      changed: result.affectedRows,
      is_private: isPrivate,
      visibility: visibilityLabel,
      titles_preview: booksToUpdate.slice(0, 20).map((book) => ({
        id: book.id,
        title: book.title,
        previous_is_private: Number(book.is_private || 0) === 1 ? 1 : 0,
      })),
    });
    invalidatePDFCache();

    return res.status(200).json({
      message: `Selected books set to ${visibilityLabel}.`,
      visibility: visibilityLabel,
      is_private: isPrivate,
      matched: booksToUpdate.length,
      changed: result.affectedRows,
    });
  } catch (error) {
    console.error("[Admin] updateBooksVisibilityBulk error:", error);
    return res.status(500).json({ error: "Failed to update selected books." });
  }
};

export const deleteBooksBulk = async (req, res) => {
  const uniqueIds = parseBookIds(req.body?.ids);
  if (uniqueIds.length === 0) {
    return res.status(400).json({ error: "No valid book IDs were selected." });
  }

  if (uniqueIds.length > MAX_BULK_DELETE_PER_REQUEST) {
    return res.status(400).json({
      error: `Delete ${MAX_BULK_DELETE_PER_REQUEST} or fewer books at one time.`,
    });
  }

  try {
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const [booksToDelete] = await db.query(
      `SELECT id, title FROM books_data WHERE id IN (${placeholders})`,
      uniqueIds,
    );

    const [result] = await db.query(
      `DELETE FROM books_data WHERE id IN (${placeholders})`,
      uniqueIds,
    );

    await logAdminActivity(req, "books.bulk_deleted", "book", null, "Bulk delete", {
      requested_ids: uniqueIds,
      deleted: result.affectedRows,
      deleted_preview: booksToDelete.slice(0, 20).map((book) => ({
        id: book.id,
        title: book.title,
      })),
    });
    invalidatePDFCache();

    return res.status(200).json({
      message: "Selected books deleted successfully.",
      deleted: result.affectedRows,
    });
  } catch (error) {
    console.error("[Admin] deleteBooksBulk error:", error);
    return res.status(500).json({ error: "Failed to delete selected books." });
  }
};
