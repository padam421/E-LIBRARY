import db from "../config/db.js";
import { readPositiveIntEnv } from "../config/runtimeLimits.js";
import { normalizeStorageProvider } from "../services/bookStorage.js";

const cacheTtlMs = readPositiveIntEnv("PUBLIC_BOOKS_CACHE_TTL_MS", 30000, {
  min: 0,
  max: 10 * 60 * 1000,
});
let cachedRows = null;
let cacheExpiresAt = 0;

const DEFAULT_PAYMENT_SNAPSHOT = {
  payments_enabled: 0,
  site_premium_enabled: 0,
  preview_page_limit: 10,
  payment_currency: "INR",
  monthly_price_paise: 0,
  annual_price_paise: 0,
  book_is_premium: 0,
  book_price_paise: 0,
  book_access_duration_days: null,
};

function isMissingPaymentSchemaError(error) {
  return ["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes(error?.code);
}

function isProduction() {
  return String(process.env.NODE_ENV || "").trim() === "production";
}

function exposePrivateRowsForPublicList() {
  const configured = String(process.env.PUBLIC_INCLUDE_PRIVATE_BOOKS || "")
    .trim()
    .toLowerCase();
  if (["1", "true", "yes", "on"].includes(configured)) return true;
  if (["0", "false", "no", "off"].includes(configured)) return false;
  return !isProduction();
}

function publicAssetUrl(kind, bookId, extra = "") {
  const suffix = extra ? `?${extra}` : "";
  return `/api/pdfs/${kind}/${encodeURIComponent(bookId)}${suffix}`;
}

function publicVideoUrl(kind, bookId) {
  return `/api/video/book/${encodeURIComponent(bookId)}/${kind}`;
}

function toBoolFlag(value) {
  return Number(value || 0) === 1;
}

function clampPreviewLimit(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return 10;
  return Math.min(50, parsed);
}

function normalizePaymentSnapshot(row) {
  const snapshot = {
    ...DEFAULT_PAYMENT_SNAPSHOT,
    ...(row || {}),
  };

  return {
    paymentsEnabled: toBoolFlag(snapshot.payments_enabled),
    sitePremiumEnabled: toBoolFlag(snapshot.site_premium_enabled),
    previewPageLimit: clampPreviewLimit(snapshot.preview_page_limit),
    currency: String(snapshot.payment_currency || "INR").trim().toUpperCase() || "INR",
    monthlyPricePaise: Number(snapshot.monthly_price_paise || 0),
    annualPricePaise: Number(snapshot.annual_price_paise || 0),
    bookPremiumEnabled: toBoolFlag(snapshot.book_is_premium),
    bookPricePaise: Number(snapshot.book_price_paise || 0),
    bookAccessDurationDays:
      snapshot.book_access_duration_days === null || snapshot.book_access_duration_days === undefined
        ? null
        : Number(snapshot.book_access_duration_days || 0),
  };
}

function buildPublicPaymentSummary(row) {
  const payment = normalizePaymentSnapshot(row);
  const paymentRequired = payment.paymentsEnabled && (
    payment.sitePremiumEnabled || payment.bookPremiumEnabled
  );

  let premiumScope = "free";
  if (payment.sitePremiumEnabled && payment.bookPremiumEnabled) {
    premiumScope = "site_and_book";
  } else if (payment.sitePremiumEnabled) {
    premiumScope = "site_subscription";
  } else if (payment.bookPremiumEnabled) {
    premiumScope = "book_purchase";
  }

  return {
    payments_enabled: payment.paymentsEnabled,
    site_premium_enabled: payment.sitePremiumEnabled,
    book_premium_enabled: payment.bookPremiumEnabled,
    payment_required: paymentRequired,
    premium_scope: premiumScope,
    preview_page_limit: payment.previewPageLimit,
    payment_currency: payment.currency,
    site_monthly_price_paise: payment.monthlyPricePaise,
    site_annual_price_paise: payment.annualPricePaise,
    book_price_paise: payment.bookPricePaise,
    book_access_duration_days: payment.bookAccessDurationDays,
  };
}

function toPublicBook(row) {
  const id = row?.id;
  const storageProvider = normalizeStorageProvider(row?.storage_provider);
  const hasPdf = Boolean(String(row?.pdf_drive_id || "").trim());
  const hasEpub = Boolean(String(row?.epub_drive_id || "").trim());
  const hasCover = Boolean(String(row?.poster_drive_id || row?.cover_drive_id || "").trim());
  const hasVideo = Boolean(String(row?.video_drive_id || "").trim())
    && String(row.video_drive_id).trim().toLowerCase() !== "no video available";

  return {
    id,
    title: row?.title || "",
    author: row?.author || "",
    description: row?.description || "",
    category: row?.category || "",
    has_pdf: hasPdf,
    has_epub: hasEpub,
    has_video: hasVideo,
    storage_provider: storageProvider,
    pdf_drive_id: hasPdf ? `book:${id}:pdf` : null,
    epub_drive_id: hasEpub ? `book:${id}:epub` : null,
    cover_url: hasCover ? (storageProvider === "drive" ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(row?.poster_drive_id || row?.cover_drive_id)}&sz=w400` : publicAssetUrl("cover", id, "size=w400")) : "",
    poster_url: hasCover ? (storageProvider === "drive" ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(row?.poster_drive_id || row?.cover_drive_id)}&sz=w1200` : publicAssetUrl("cover", id, "size=w1200")) : "",
    video_url: hasVideo ? publicVideoUrl("embed", id) : "",
    video_proxy_url: hasVideo ? publicVideoUrl("stream", id) : "",
    ...buildPublicPaymentSummary(row),
  };
}

export function invalidatePDFCache() {
  cachedRows = null;
  cacheExpiresAt = 0;
}

// Function to get all books from the database
export const getAllPDFs = async () => {
  if (cacheTtlMs > 0 && cachedRows && cacheExpiresAt > Date.now()) {
    return cachedRows;
  }

  try {
    // NOTE: If your MySQL table is named something else (like 'pdfs' or 'documents'),
    // change 'books' in the line below to match your actual table name!
    const whereSql = exposePrivateRowsForPublicList()
      ? ""
      : "WHERE COALESCE(b.is_private, 0) = 0";
    const [rows] = await db.query(
      `SELECT b.id, b.title, b.author, b.description, b.category,
              b.poster_drive_id, b.cover_drive_id, b.video_drive_id,
              b.pdf_drive_id, b.epub_drive_id, b.is_private, b.storage_provider,
              COALESCE(ps.payments_enabled, 0) AS payments_enabled,
              COALESCE(ps.site_premium_enabled, 0) AS site_premium_enabled,
              COALESCE(ps.preview_page_limit, 10) AS preview_page_limit,
              COALESCE(ps.currency, 'INR') AS payment_currency,
              COALESCE(ps.monthly_price_paise, 0) AS monthly_price_paise,
              COALESCE(ps.annual_price_paise, 0) AS annual_price_paise,
              COALESCE(r.is_premium, 0) AS book_is_premium,
              COALESCE(r.price_paise, 0) AS book_price_paise,
              r.access_duration_days AS book_access_duration_days
         FROM books_data b
         LEFT JOIN book_premium_rules r
           ON r.book_id = b.id
         LEFT JOIN payment_settings ps
           ON ps.id = 1
         ${whereSql}
        ORDER BY b.id DESC`,
    );
    const publicRows = rows.map(toPublicBook);
    if (cacheTtlMs > 0) {
      cachedRows = publicRows;
      cacheExpiresAt = Date.now() + cacheTtlMs;
    }
    return publicRows;
  } catch (error) {
    if (isMissingPaymentSchemaError(error)) {
      const whereSql = exposePrivateRowsForPublicList()
        ? ""
        : "WHERE COALESCE(is_private, 0) = 0";
      const [rows] = await db.query(
        `SELECT id, title, author, description, category,
                poster_drive_id, cover_drive_id, video_drive_id,
                pdf_drive_id, epub_drive_id, is_private,
                'drive' AS storage_provider
           FROM books_data
           ${whereSql}
          ORDER BY id DESC`,
      );
      const publicRows = rows.map(toPublicBook);
      if (cacheTtlMs > 0) {
        cachedRows = publicRows;
        cacheExpiresAt = Date.now() + cacheTtlMs;
      }
      return publicRows;
    }
    console.error("Database query error:", error);
    throw error;
  }
};

export async function getBookAssetById(bookId, assetType, options = {}) {
  const id = Number(bookId);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("Invalid book ID.");
    error.statusCode = 400;
    throw error;
  }

  const columnByType = {
    pdf: "pdf_drive_id",
    epub: "epub_drive_id",
    cover: "COALESCE(NULLIF(poster_drive_id, ''), cover_drive_id)",
    video: "video_drive_id",
  };
  const column = columnByType[assetType];
  if (!column) {
    const error = new Error("Invalid asset type.");
    error.statusCode = 400;
    throw error;
  }

  let rows;
  try {
    [rows] = await db.query(
      `SELECT id, title, is_private, storage_provider, ${column} AS drive_id
         FROM books_data
        WHERE id = ?
        LIMIT 1`,
      [id],
    );
  } catch (error) {
    if (error?.code !== "ER_BAD_FIELD_ERROR") {
      throw error;
    }

    [rows] = await db.query(
      `SELECT id, title, is_private, 'drive' AS storage_provider, ${column} AS drive_id
         FROM books_data
        WHERE id = ?
        LIMIT 1`,
      [id],
    );
  }
  const row = rows[0];
  if (!row) {
    const error = new Error("Book not found.");
    error.statusCode = 404;
    throw error;
  }

  if (options.publicOnly && Number(row.is_private || 0) === 1 && !exposePrivateRowsForPublicList()) {
    const error = new Error("Book is private.");
    error.statusCode = 404;
    throw error;
  }

  const assetRef = String(row.drive_id || "").trim();
  if (!assetRef || assetRef.toLowerCase() === "no video available") {
    const error = new Error("Requested asset is not available.");
    error.statusCode = 404;
    throw error;
  }

  return {
    bookId: row.id,
    title: row.title || "Book",
    assetRef,
    driveId: assetRef,
    storageProvider: normalizeStorageProvider(row.storage_provider),
    isPrivate: Number(row.is_private || 0) === 1,
  };
}
