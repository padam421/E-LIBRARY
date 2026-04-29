import crypto from "crypto";
import { Readable } from "stream";

import db from "../config/db.js";
import drive from "../config/drive.js";
import { readPositiveIntEnv } from "../config/runtimeLimits.js";
import {
  readSessionTokenFromRequest,
  verifySessionToken,
} from "../utils/sessionToken.js";

const DEFAULT_CURRENCY = "INR";
const SUPPORT_SCOPE = "support_contribution";
const SUPPORT_MIN_AMOUNT_PAISE = readPositiveIntEnv("SUPPORT_MIN_AMOUNT_PAISE", 9900, {
  min: 100,
});
const SUPPORT_MAX_AMOUNT_PAISE = readPositiveIntEnv("SUPPORT_MAX_AMOUNT_PAISE", 10000000, {
  min: SUPPORT_MIN_AMOUNT_PAISE,
});
const SUPPORT_MEDIA_MAX_BYTES = readPositiveIntEnv("SUPPORT_MEDIA_MAX_BYTES", 12 * 1024 * 1024, {
  min: 1024,
});
const SUPPORT_QUICK_AMOUNTS = [9900, 24900, 49900];
const SUPPORT_MEDIA_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "video/webm",
  "video/mp4",
  "video/quicktime",
]);
const DEFAULT_SETTINGS = {
  schemaReady: false,
  paymentsEnabled: false,
  sitePremiumEnabled: false,
  currency: DEFAULT_CURRENCY,
  previewPageLimit: 10,
  monthlyPricePaise: 19900,
  monthlyDurationDays: 30,
  annualPricePaise: 29900,
  annualDurationDays: 365,
  updatedByEmail: null,
  updatedAt: null,
};

function isMissingPaymentSchemaError(error) {
  return ["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes(error?.code);
}

function isMissingSupportSchemaError(error) {
  return [
    "ER_NO_SUCH_TABLE",
    "ER_BAD_FIELD_ERROR",
    "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD",
    "WARN_DATA_TRUNCATED",
  ].includes(error?.code);
}

function toBool(value) {
  return Number(value || 0) === 1;
}

function clampInteger(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampAmountPaise(value, fallback = SUPPORT_MIN_AMOUNT_PAISE) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(SUPPORT_MAX_AMOUNT_PAISE, Math.max(SUPPORT_MIN_AMOUNT_PAISE, parsed));
}

function normalizeCurrency(value) {
  const currency = String(value || DEFAULT_CURRENCY).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : DEFAULT_CURRENCY;
}

function settingsFromRow(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    schemaReady: true,
    paymentsEnabled: toBool(row.payments_enabled),
    sitePremiumEnabled: toBool(row.site_premium_enabled),
    currency: normalizeCurrency(row.currency),
    previewPageLimit: clampInteger(row.preview_page_limit, 10, { min: 1, max: 50 }),
    monthlyPricePaise: clampInteger(row.monthly_price_paise, 19900, { min: 0 }),
    monthlyDurationDays: clampInteger(row.monthly_duration_days, 30, { min: 1, max: 3660 }),
    annualPricePaise: clampInteger(row.annual_price_paise, 29900, { min: 0 }),
    annualDurationDays: clampInteger(row.annual_duration_days, 365, { min: 1, max: 3660 }),
    updatedByEmail: row.updated_by_email || null,
    updatedAt: row.updated_at || null,
  };
}

function ruleFromRow(row) {
  return {
    bookId: Number(row?.book_id || row?.id || 0),
    isPremium: toBool(row?.is_premium),
    pricePaise: clampInteger(row?.price_paise, 0, { min: 0 }),
    accessDurationDays:
      row?.access_duration_days === null || row?.access_duration_days === undefined
        ? null
        : clampInteger(row.access_duration_days, null, { min: 1, max: 3660 }),
    allowPlatformDownload: row?.allow_platform_download === undefined
      ? true
      : toBool(row.allow_platform_download),
    updatedByEmail: row?.updated_by_email || null,
    updatedAt: row?.updated_at || null,
  };
}

function buildOffer(settings, rule) {
  const offers = [];

  if (settings.sitePremiumEnabled) {
    if (settings.monthlyPricePaise > 0) {
      offers.push({
        scope: "site_subscription",
        planKey: "monthly",
        label: "Monthly Premium",
        amountPaise: settings.monthlyPricePaise,
        currency: settings.currency,
        durationDays: settings.monthlyDurationDays,
      });
    }

    if (settings.annualPricePaise > 0) {
      offers.push({
        scope: "site_subscription",
        planKey: "annual",
        label: "Annual Premium",
        amountPaise: settings.annualPricePaise,
        currency: settings.currency,
        durationDays: settings.annualDurationDays,
      });
    }
  }

  if (rule?.isPremium && rule.pricePaise > 0) {
    offers.push({
      scope: "book_purchase",
      planKey: "book",
      label: "Buy This Book",
      amountPaise: rule.pricePaise,
      currency: settings.currency,
      durationDays: rule.accessDurationDays,
      lifetime: rule.accessDurationDays === null,
    });
  }

  return offers;
}

function parseJson(value, fallback = {}) {
  try {
    const parsed = JSON.parse(value || "null");
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function sanitizeText(value, maxLength = 255) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeSupportMessage(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .slice(0, 1200);
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function makeSupportUploadToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashSupportUploadToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + Number(days || 0));
  return next;
}

function dateToMysql(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function makeReceipt(scope) {
  const prefix = scope === "site_subscription"
    ? "site"
    : scope === SUPPORT_SCOPE
      ? "support"
      : "book";
  return `lib_${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(5).toString("hex")}`.slice(0, 40);
}

function getRazorpayCredentials() {
  return {
    keyId: String(process.env.RAZORPAY_KEY_ID || "").trim(),
    keySecret: String(process.env.RAZORPAY_KEY_SECRET || "").trim(),
  };
}

function timingSafeEqualStrings(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function getPublicPaymentConfig() {
  const { keyId } = getRazorpayCredentials();
  return {
    provider: "razorpay",
    keyId,
    configured: Boolean(keyId),
  };
}

export function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  const { keySecret } = getRazorpayCredentials();
  if (!keySecret) return false;

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return timingSafeEqualStrings(expected, signature);
}

export function verifyWebhookSignature(rawBody, signature) {
  const webhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  if (!webhookSecret) return false;

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  return timingSafeEqualStrings(expected, signature);
}

export async function getPaymentSettings() {
  try {
    const [rows] = await db.query(
      `SELECT payments_enabled, site_premium_enabled, currency, preview_page_limit,
              monthly_price_paise, monthly_duration_days,
              annual_price_paise, annual_duration_days,
              updated_by_email, updated_at
         FROM payment_settings
        WHERE id = 1
        LIMIT 1`,
    );
    return settingsFromRow(rows[0]);
  } catch (error) {
    if (isMissingPaymentSchemaError(error)) {
      return { ...DEFAULT_SETTINGS };
    }
    throw error;
  }
}

export async function updatePaymentSettings(input, actorEmail) {
  const settings = {
    paymentsEnabled: input?.paymentsEnabled === true || String(input?.payments_enabled || "").trim() === "1",
    sitePremiumEnabled: input?.sitePremiumEnabled === true || String(input?.site_premium_enabled || "").trim() === "1",
    currency: normalizeCurrency(input?.currency),
    previewPageLimit: clampInteger(input?.previewPageLimit ?? input?.preview_page_limit, 10, { min: 1, max: 50 }),
    monthlyPricePaise: clampInteger(input?.monthlyPricePaise ?? input?.monthly_price_paise, 0, { min: 0 }),
    monthlyDurationDays: clampInteger(input?.monthlyDurationDays ?? input?.monthly_duration_days, 30, { min: 1, max: 3660 }),
    annualPricePaise: clampInteger(input?.annualPricePaise ?? input?.annual_price_paise, 0, { min: 0 }),
    annualDurationDays: clampInteger(input?.annualDurationDays ?? input?.annual_duration_days, 365, { min: 1, max: 3660 }),
  };

  await db.query(
    `INSERT INTO payment_settings
       (id, payments_enabled, site_premium_enabled, currency, preview_page_limit,
        monthly_price_paise, monthly_duration_days, annual_price_paise,
        annual_duration_days, updated_by_email)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       payments_enabled = VALUES(payments_enabled),
       site_premium_enabled = VALUES(site_premium_enabled),
       currency = VALUES(currency),
       preview_page_limit = VALUES(preview_page_limit),
       monthly_price_paise = VALUES(monthly_price_paise),
       monthly_duration_days = VALUES(monthly_duration_days),
       annual_price_paise = VALUES(annual_price_paise),
       annual_duration_days = VALUES(annual_duration_days),
       updated_by_email = VALUES(updated_by_email)`,
    [
      settings.paymentsEnabled ? 1 : 0,
      settings.sitePremiumEnabled ? 1 : 0,
      settings.currency,
      settings.previewPageLimit,
      settings.monthlyPricePaise,
      settings.monthlyDurationDays,
      settings.annualPricePaise,
      settings.annualDurationDays,
      actorEmail || null,
    ],
  );

  return getPaymentSettings();
}

export async function getBookPremiumRule(bookId) {
  const id = Number(bookId);
  if (!Number.isInteger(id) || id <= 0) {
    return ruleFromRow({ book_id: 0 });
  }

  try {
    const [rows] = await db.query(
      `SELECT book_id, is_premium, price_paise, access_duration_days,
              allow_platform_download, updated_by_email, updated_at
         FROM book_premium_rules
        WHERE book_id = ?
        LIMIT 1`,
      [id],
    );
    return ruleFromRow(rows[0] || { book_id: id });
  } catch (error) {
    if (isMissingPaymentSchemaError(error)) {
      return ruleFromRow({ book_id: id });
    }
    throw error;
  }
}

async function findActiveEntitlement(userEmail, scope, bookId, connection = db) {
  if (!userEmail) return null;
  const [rows] = await connection.query(
    `SELECT id, scope, book_id, starts_at, expires_at, status, source_order_id
       FROM user_entitlements
      WHERE user_email = ?
        AND scope = ?
        AND book_id = ?
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      LIMIT 1`,
    [userEmail, scope, Number(bookId || 0)],
  );
  return rows[0] || null;
}

export async function getAuthenticatedPaymentUser(req) {
  const token = readSessionTokenFromRequest(req);
  if (!token) {
    const error = new Error("Sign in required.");
    error.statusCode = 401;
    throw error;
  }

  let sessionUser;
  try {
    sessionUser = verifySessionToken(token);
  } catch {
    const error = new Error("Session expired or invalid.");
    error.statusCode = 401;
    throw error;
  }

  const [rows] = await db.query(
    "SELECT id, role FROM users WHERE email = ? LIMIT 1",
    [sessionUser.email],
  );

  return {
    ...sessionUser,
    id: rows[0]?.id || null,
    role: rows[0]?.role || "user",
  };
}

export async function getOptionalPaymentUser(req) {
  const token = readSessionTokenFromRequest(req);
  if (!token) return null;

  try {
    const sessionUser = verifySessionToken(token);
    const [rows] = await db.query(
      "SELECT id, role FROM users WHERE email = ? LIMIT 1",
      [sessionUser.email],
    );

    return {
      ...sessionUser,
      id: rows[0]?.id || null,
      role: rows[0]?.role || "user",
    };
  } catch {
    return null;
  }
}

export async function getReaderAccess(user, bookId) {
  const settings = await getPaymentSettings();
  const rule = await getBookPremiumRule(bookId);
  const cleanEmail = String(user?.email || "").trim().toLowerCase();

  let siteEntitlement = null;
  let bookEntitlement = null;
  if (cleanEmail && settings.schemaReady) {
    siteEntitlement = await findActiveEntitlement(cleanEmail, "site_subscription", 0);
    bookEntitlement = await findActiveEntitlement(cleanEmail, "book_purchase", bookId);
  }

  const requiresPayment = Boolean(settings.sitePremiumEnabled || rule.isPremium);
  const fullAccess = !requiresPayment || Boolean(siteEntitlement || bookEntitlement);

  return {
    schemaReady: settings.schemaReady,
    paymentsEnabled: settings.paymentsEnabled,
    providerConfigured: getPublicPaymentConfig().configured,
    fullAccess,
    requiresPayment,
    reason: fullAccess
      ? "access_granted"
      : settings.sitePremiumEnabled
        ? "site_premium_required"
        : "book_purchase_required",
    bookId: Number(bookId || 0),
    previewPageLimit: settings.previewPageLimit,
    sitePremiumEnabled: settings.sitePremiumEnabled,
    bookPremiumEnabled: rule.isPremium,
    allowPlatformDownload: rule.allowPlatformDownload,
    activeEntitlement: siteEntitlement
      ? {
          scope: "site_subscription",
          expiresAt: siteEntitlement.expires_at,
        }
      : bookEntitlement
        ? {
            scope: "book_purchase",
            expiresAt: bookEntitlement.expires_at,
          }
        : null,
    offers: buildOffer(settings, rule),
  };
}

export async function listPaymentBooks({ page = 1, limit = 50, search = "" } = {}) {
  const safePage = clampInteger(page, 1, { min: 1, max: 1000000 });
  const safeLimit = clampInteger(limit, 50, { min: 1, max: 200 });
  const offset = (safePage - 1) * safeLimit;
  const params = [];
  const whereParts = [];

  if (String(search || "").trim()) {
    const like = `%${String(search).trim()}%`;
    whereParts.push("(b.title LIKE ? OR b.author LIKE ? OR b.category LIKE ?)");
    params.push(like, like, like);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total
       FROM books_data b
       ${whereSql}`,
    params,
  );

  const [rows] = await db.query(
    `SELECT b.id, b.title, b.author, b.category, b.poster_drive_id, b.cover_drive_id,
            b.pdf_drive_id, b.epub_drive_id, b.is_private,
            COALESCE(r.is_premium, 0) AS is_premium,
            COALESCE(r.price_paise, 0) AS price_paise,
            r.access_duration_days,
            COALESCE(r.allow_platform_download, 1) AS allow_platform_download,
            r.updated_at AS premium_updated_at
       FROM books_data b
       LEFT JOIN book_premium_rules r ON r.book_id = b.id
       ${whereSql}
      ORDER BY b.id DESC
      LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset],
  );

  const total = Number(countRows[0]?.total || 0);
  return {
    books: rows.map((row) => ({
      ...row,
      is_premium: Number(row.is_premium || 0) === 1 ? 1 : 0,
      price_paise: Number(row.price_paise || 0),
      allow_platform_download: Number(row.allow_platform_download || 0) === 1 ? 1 : 0,
    })),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function updateBookPremiumRule(bookId, input, actorEmail) {
  const id = clampInteger(bookId, 0, { min: 1 });
  const isPremium = input?.isPremium === true || String(input?.is_premium || "").trim() === "1";
  const pricePaise = clampInteger(input?.pricePaise ?? input?.price_paise, 0, { min: 0 });
  const durationInput = input?.accessDurationDays ?? input?.access_duration_days;
  const durationDays =
    durationInput === "" || durationInput === null || durationInput === undefined
      ? null
      : clampInteger(durationInput, null, { min: 1, max: 3660 });
  const allowPlatformDownload =
    input?.allowPlatformDownload === false || String(input?.allow_platform_download || "").trim() === "0"
      ? 0
      : 1;

  if (isPremium && pricePaise <= 0) {
    const error = new Error("Premium books must have a price greater than 0.");
    error.statusCode = 400;
    throw error;
  }

  await db.query(
    `INSERT INTO book_premium_rules
       (book_id, is_premium, price_paise, access_duration_days, allow_platform_download, updated_by_email)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       is_premium = VALUES(is_premium),
       price_paise = VALUES(price_paise),
       access_duration_days = VALUES(access_duration_days),
       allow_platform_download = VALUES(allow_platform_download),
       updated_by_email = VALUES(updated_by_email)`,
    [id, isPremium ? 1 : 0, pricePaise, durationDays, allowPlatformDownload, actorEmail || null],
  );

  return getBookPremiumRule(id);
}

export async function updateBooksPremiumBulk(ids, input, actorEmail) {
  const cleanIds = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ).slice(0, 500);

  if (cleanIds.length === 0) {
    const error = new Error("No valid book IDs were selected.");
    error.statusCode = 400;
    throw error;
  }

  const isPremium = input?.isPremium === true || String(input?.is_premium || "").trim() === "1";
  const pricePaise = clampInteger(input?.pricePaise ?? input?.price_paise, 0, { min: 0 });
  const durationInput = input?.accessDurationDays ?? input?.access_duration_days;
  const durationDays =
    durationInput === "" || durationInput === null || durationInput === undefined
      ? null
      : clampInteger(durationInput, null, { min: 1, max: 3660 });
  const allowPlatformDownload =
    input?.allowPlatformDownload === false || String(input?.allow_platform_download || "").trim() === "0"
      ? 0
      : 1;

  if (isPremium && pricePaise <= 0) {
    const error = new Error("Bulk premium updates need a price greater than 0.");
    error.statusCode = 400;
    throw error;
  }

  const values = cleanIds.map((id) => [
    id,
    isPremium ? 1 : 0,
    pricePaise,
    durationDays,
    allowPlatformDownload,
    actorEmail || null,
  ]);

  await db.query(
    `INSERT INTO book_premium_rules
       (book_id, is_premium, price_paise, access_duration_days, allow_platform_download, updated_by_email)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       is_premium = VALUES(is_premium),
       price_paise = VALUES(price_paise),
       access_duration_days = VALUES(access_duration_days),
       allow_platform_download = VALUES(allow_platform_download),
       updated_by_email = VALUES(updated_by_email)`,
    [values],
  );

  return { updated: cleanIds.length, ids: cleanIds };
}

async function createRazorpayOrder({ amountPaise, currency, receipt, notes }) {
  const { keyId, keySecret } = getRazorpayCredentials();
  if (!keyId || !keySecret) {
    const error = new Error("Razorpay keys are not configured on the backend.");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency,
      receipt,
      payment_capture: 1,
      notes,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.description || "Razorpay order creation failed.");
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

export async function createSiteSubscriptionOrder(user, planKey) {
  const settings = await getPaymentSettings();
  if (!settings.schemaReady) {
    const error = new Error("Payment database tables are not installed yet.");
    error.statusCode = 503;
    throw error;
  }
  if (!settings.paymentsEnabled) {
    const error = new Error("Payments are disabled in the admin panel.");
    error.statusCode = 403;
    throw error;
  }
  if (!settings.sitePremiumEnabled) {
    const error = new Error("Whole-site premium is not enabled.");
    error.statusCode = 400;
    throw error;
  }

  const cleanPlanKey = String(planKey || "monthly").trim().toLowerCase() === "annual"
    ? "annual"
    : "monthly";
  const amountPaise = cleanPlanKey === "annual"
    ? settings.annualPricePaise
    : settings.monthlyPricePaise;
  const durationDays = cleanPlanKey === "annual"
    ? settings.annualDurationDays
    : settings.monthlyDurationDays;

  if (amountPaise <= 0) {
    const error = new Error("Selected subscription plan has no valid price.");
    error.statusCode = 400;
    throw error;
  }

  return createStoredOrder({
    user,
    scope: "site_subscription",
    planKey: cleanPlanKey,
    bookId: 0,
    amountPaise,
    currency: settings.currency,
    metadata: { durationDays },
  });
}

export async function createBookPurchaseOrder(user, bookId) {
  const settings = await getPaymentSettings();
  const rule = await getBookPremiumRule(bookId);
  if (!settings.schemaReady) {
    const error = new Error("Payment database tables are not installed yet.");
    error.statusCode = 503;
    throw error;
  }
  if (!settings.paymentsEnabled) {
    const error = new Error("Payments are disabled in the admin panel.");
    error.statusCode = 403;
    throw error;
  }
  if (!rule.isPremium) {
    const error = new Error("This book is currently free.");
    error.statusCode = 400;
    throw error;
  }
  if (rule.pricePaise <= 0) {
    const error = new Error("This premium book has no valid price.");
    error.statusCode = 400;
    throw error;
  }

  return createStoredOrder({
    user,
    scope: "book_purchase",
    planKey: "book",
    bookId,
    amountPaise: rule.pricePaise,
    currency: settings.currency,
    metadata: {
      durationDays: rule.accessDurationDays,
      lifetime: rule.accessDurationDays === null,
    },
  });
}

export async function getSupportConfig() {
  const settings = await getPaymentSettings();
  return {
    ownerName: "Padam Kishore",
    githubUrl: "https://github.com/padam421",
    linkedinUrl: "https://www.linkedin.com/in/padam-kishore-031b8b377/",
    provider: "razorpay",
    keyId: getPublicPaymentConfig().keyId,
    configured: getPublicPaymentConfig().configured,
    paymentsEnabled: settings.paymentsEnabled,
    schemaReady: settings.schemaReady,
    supportEnabled: Boolean(
      settings.schemaReady &&
      settings.paymentsEnabled &&
      getPublicPaymentConfig().configured,
    ),
    currency: DEFAULT_CURRENCY,
    minAmountPaise: SUPPORT_MIN_AMOUNT_PAISE,
    maxAmountPaise: SUPPORT_MAX_AMOUNT_PAISE,
    quickAmountsPaise: SUPPORT_QUICK_AMOUNTS,
    mediaEnabled: Boolean(String(process.env.SUPPORT_MEDIA_DRIVE_FOLDER_ID || "").trim()),
    mediaMaxBytes: SUPPORT_MEDIA_MAX_BYTES,
  };
}

export async function createSupportContributionOrder(user, input = {}) {
  const settings = await getPaymentSettings();
  if (!settings.schemaReady) {
    const error = new Error("Payment database tables are not installed yet.");
    error.statusCode = 503;
    throw error;
  }
  if (!settings.paymentsEnabled) {
    const error = new Error("Support payments are disabled in the admin panel.");
    error.statusCode = 403;
    throw error;
  }

  const rupees = Number(String(input.amountRupees ?? "").trim());
  const amountPaise = clampAmountPaise(
    input.amountPaise ?? (Number.isFinite(rupees) ? Math.round(rupees * 100) : undefined),
  );
  const supporterName =
    sanitizeText(input.name, 120) ||
    sanitizeText(user?.name, 120) ||
    "Anonymous reader";
  const supporterHandle = sanitizeText(input.handle, 120);
  const supporterEmail = normalizeEmail(input.email) || normalizeEmail(user?.email);
  const message = sanitizeSupportMessage(input.message);
  const localCurrency = normalizeCurrency(input.localCurrency || DEFAULT_CURRENCY);
  const localAmount = Number.isFinite(Number(input.localAmount))
    ? Math.max(0, Number(input.localAmount))
    : null;
  const isPublic = input.isPublic === false ? 0 : 1;
  const receipt = makeReceipt(SUPPORT_SCOPE);
  const uploadToken = makeSupportUploadToken();
  const uploadTokenHash = hashSupportUploadToken(uploadToken);

  let razorpayOrder;
  try {
    razorpayOrder = await createRazorpayOrder({
      amountPaise,
      currency: DEFAULT_CURRENCY,
      receipt,
      notes: {
        scope: SUPPORT_SCOPE,
        supporter_name: supporterName.slice(0, 120),
        supporter_handle: supporterHandle.slice(0, 120),
        supporter_email: supporterEmail.slice(0, 120),
      },
    });
  } catch (error) {
    throw error;
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [orderResult] = await connection.query(
      `INSERT INTO payment_orders
         (user_id, user_email, scope, plan_key, book_id, amount_paise, currency,
          gateway_order_id, status, receipt, metadata_json)
       VALUES (?, ?, ?, 'support', 0, ?, ?, ?, 'created', ?, ?)`,
      [
        user?.id || null,
        supporterEmail || null,
        SUPPORT_SCOPE,
        amountPaise,
        DEFAULT_CURRENCY,
        razorpayOrder.id,
        receipt,
        JSON.stringify({
          supporterName,
          supporterHandle,
          localCurrency,
          localAmount,
        }),
      ],
    );

    const [supportResult] = await connection.query(
      `INSERT INTO support_contributions
         (order_id, user_id, supporter_name, supporter_handle, supporter_email,
          message, amount_paise, currency, local_amount, local_currency,
          upload_token_hash, is_public, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created')`,
      [
        orderResult.insertId,
        user?.id || null,
        supporterName,
        supporterHandle || null,
        supporterEmail || null,
        message || null,
        amountPaise,
        DEFAULT_CURRENCY,
        localAmount,
        localCurrency,
        uploadTokenHash,
        isPublic,
      ],
    );

    await connection.commit();
    return {
      id: orderResult.insertId,
      supportContributionId: supportResult.insertId,
      provider: "razorpay",
      keyId: getPublicPaymentConfig().keyId,
      gatewayOrderId: razorpayOrder.id,
      amountPaise,
      currency: DEFAULT_CURRENCY,
      receipt,
      scope: SUPPORT_SCOPE,
      planKey: "support",
      bookId: 0,
      supportUploadToken: uploadToken,
      prefill: {
        name: supporterName,
        email: supporterEmail,
      },
    };
  } catch (error) {
    await connection.rollback().catch(() => {});
    if (isMissingSupportSchemaError(error)) {
      const schemaError = new Error("Support payment tables are not installed yet.");
      schemaError.statusCode = 503;
      throw schemaError;
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function createStoredOrder({
  user,
  scope,
  planKey,
  bookId,
  amountPaise,
  currency,
  metadata,
}) {
  const receipt = makeReceipt(scope);
  const cleanEmail = String(user?.email || "").trim().toLowerCase();
  const razorpayOrder = await createRazorpayOrder({
    amountPaise,
    currency,
    receipt,
    notes: {
      user_email: cleanEmail,
      scope,
      plan_key: planKey,
      book_id: String(bookId || 0),
    },
  });

  const [result] = await db.query(
    `INSERT INTO payment_orders
       (user_id, user_email, scope, plan_key, book_id, amount_paise, currency,
        gateway_order_id, status, receipt, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'created', ?, ?)`,
    [
      user?.id || null,
      cleanEmail,
      scope,
      planKey,
      Number(bookId || 0),
      amountPaise,
      currency,
      razorpayOrder.id,
      receipt,
      JSON.stringify(metadata || {}),
    ],
  );

  return {
    id: result.insertId,
    provider: "razorpay",
    keyId: getPublicPaymentConfig().keyId,
    gatewayOrderId: razorpayOrder.id,
    amountPaise,
    currency,
    receipt,
    scope,
    planKey,
    bookId: Number(bookId || 0),
    prefill: {
      name: user?.name || "",
      email: cleanEmail,
    },
  };
}

async function grantEntitlementForOrder(connection, order) {
  const metadata = parseJson(order.metadata_json, {});
  const cleanEmail = String(order.user_email || "").trim().toLowerCase();
  const cleanBookId = Number(order.scope === "book_purchase" ? order.book_id || 0 : 0);
  const now = new Date();
  let expiresAt = null;

  if (order.scope === "site_subscription") {
    const durationDays = clampInteger(metadata.durationDays, 30, { min: 1, max: 3660 });
    const existing = await findActiveEntitlement(cleanEmail, "site_subscription", 0, connection);
    const base = existing?.expires_at && new Date(existing.expires_at) > now
      ? new Date(existing.expires_at)
      : now;
    expiresAt = addDays(base, durationDays);
  } else if (order.scope === "book_purchase" && metadata.lifetime !== true) {
    const durationDays = clampInteger(metadata.durationDays, 0, { min: 0, max: 3660 });
    expiresAt = durationDays > 0 ? addDays(now, durationDays) : null;
  }

  await connection.query(
    `INSERT INTO user_entitlements
       (user_id, user_email, scope, book_id, source_order_id, starts_at, expires_at, status)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'active')
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       source_order_id = VALUES(source_order_id),
       expires_at = VALUES(expires_at),
       status = 'active'`,
    [
      order.user_id || null,
      cleanEmail,
      order.scope,
      cleanBookId,
      order.id,
      dateToMysql(expiresAt),
    ],
  );

  return findActiveEntitlement(cleanEmail, order.scope, cleanBookId, connection);
}

async function markSupportContributionPaid(connection, order) {
  await connection.query(
    `UPDATE support_contributions
        SET status = CASE WHEN status = 'media_uploaded' THEN status ELSE 'paid' END,
            paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP)
      WHERE order_id = ?`,
    [order.id],
  );

  const [rows] = await connection.query(
    `SELECT id, supporter_name, supporter_handle, message, amount_paise,
            currency, status, paid_at, media_drive_id
       FROM support_contributions
      WHERE order_id = ?
      LIMIT 1`,
    [order.id],
  );

  return {
    type: SUPPORT_SCOPE,
    contribution: rows[0] || null,
  };
}

async function markOrderPaid(connection, order, paymentId, signature = "") {
  if (order.status !== "paid") {
    await connection.query(
      `UPDATE payment_orders
          SET status = 'paid',
              gateway_payment_id = COALESCE(NULLIF(?, ''), gateway_payment_id),
              gateway_signature = COALESCE(NULLIF(?, ''), gateway_signature),
              paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP)
        WHERE id = ?`,
      [paymentId || "", signature || "", order.id],
    );
  }

  if (order.scope === SUPPORT_SCOPE) {
    return markSupportContributionPaid(connection, {
      ...order,
      status: "paid",
      gateway_payment_id: paymentId || order.gateway_payment_id,
    });
  }

  return grantEntitlementForOrder(connection, {
    ...order,
    status: "paid",
    gateway_payment_id: paymentId || order.gateway_payment_id,
  });
}

export async function verifyPaymentAndGrantAccess({ gatewayOrderId, gatewayPaymentId, signature }) {
  if (!verifyCheckoutSignature({
    orderId: gatewayOrderId,
    paymentId: gatewayPaymentId,
    signature,
  })) {
    const error = new Error("Payment verification failed.");
    error.statusCode = 400;
    throw error;
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT * FROM payment_orders WHERE gateway_order_id = ? LIMIT 1 FOR UPDATE",
      [gatewayOrderId],
    );
    const order = rows[0];
    if (!order) {
      const error = new Error("Payment order was not found.");
      error.statusCode = 404;
      throw error;
    }

    const paidResult = await markOrderPaid(connection, order, gatewayPaymentId, signature);
    await connection.commit();
    if (order.scope === SUPPORT_SCOPE) {
      return { orderId: order.id, scope: order.scope, support: paidResult?.contribution || null };
    }
    return { orderId: order.id, scope: order.scope, entitlement: paidResult };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

export async function markWebhookPaymentCaptured({ gatewayOrderId, gatewayPaymentId }) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT * FROM payment_orders WHERE gateway_order_id = ? LIMIT 1 FOR UPDATE",
      [gatewayOrderId],
    );
    const order = rows[0];
    if (order) {
      await markOrderPaid(connection, order, gatewayPaymentId, "");
    }
    await connection.commit();
    return Boolean(order);
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

export async function listPaymentOrders({ page = 1, limit = 50 } = {}) {
  const safePage = clampInteger(page, 1, { min: 1, max: 1000000 });
  const safeLimit = clampInteger(limit, 50, { min: 1, max: 200 });
  const offset = (safePage - 1) * safeLimit;

  const [countRows] = await db.query("SELECT COUNT(*) AS total FROM payment_orders");
  const [rows] = await db.query(
    `SELECT po.id, po.user_email, po.scope, po.plan_key, po.book_id,
            po.amount_paise, po.currency, po.gateway_order_id,
            po.gateway_payment_id, po.status, po.receipt, po.created_at, po.paid_at,
            sc.supporter_name, sc.supporter_handle, sc.message AS support_message,
            sc.media_drive_id, sc.media_mime_type, sc.media_file_name,
            sc.status AS support_status
       FROM payment_orders po
       LEFT JOIN support_contributions sc
         ON sc.order_id = po.id
      ORDER BY po.id DESC
      LIMIT ? OFFSET ?`,
    [safeLimit, offset],
  );

  const total = Number(countRows[0]?.total || 0);
  return {
    orders: rows,
    page: safePage,
    limit: safeLimit,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function listRecentSupportContributions({ limit = 8 } = {}) {
  const safeLimit = clampInteger(limit, 8, { min: 1, max: 20 });
  try {
    const [rows] = await db.query(
      `SELECT supporter_name, supporter_handle, message, amount_paise,
              currency, paid_at, media_drive_id
         FROM support_contributions
        WHERE status IN ('paid', 'media_uploaded')
          AND is_public = 1
        ORDER BY COALESCE(paid_at, created_at) DESC, id DESC
        LIMIT ?`,
      [safeLimit],
    );

    return rows.map((row) => ({
      name: row.supporter_name || "Anonymous reader",
      handle: row.supporter_handle || "",
      message: row.message || "",
      amountPaise: Number(row.amount_paise || 0),
      currency: row.currency || DEFAULT_CURRENCY,
      paidAt: row.paid_at || null,
      hasMedia: Boolean(row.media_drive_id),
    }));
  } catch (error) {
    if (isMissingSupportSchemaError(error)) {
      return [];
    }
    throw error;
  }
}

export async function uploadSupportMedia(uploadToken, input = {}) {
  const tokenHash = hashSupportUploadToken(uploadToken);
  if (!uploadToken || tokenHash.length !== 64) {
    const error = new Error("Invalid support upload token.");
    error.statusCode = 400;
    throw error;
  }

  const folderId = String(process.env.SUPPORT_MEDIA_DRIVE_FOLDER_ID || "").trim();
  if (!folderId) {
    const error = new Error("Support media uploads are not configured yet.");
    error.statusCode = 503;
    throw error;
  }

  const [rows] = await db.query(
    `SELECT sc.*, po.status AS order_status, po.gateway_payment_id
       FROM support_contributions sc
       INNER JOIN payment_orders po
         ON po.id = sc.order_id
      WHERE sc.upload_token_hash = ?
      LIMIT 1`,
    [tokenHash],
  );
  const contribution = rows[0];
  if (!contribution) {
    const error = new Error("Support upload session was not found.");
    error.statusCode = 404;
    throw error;
  }
  if (contribution.order_status !== "paid") {
    const error = new Error("Media can be uploaded only after payment succeeds.");
    error.statusCode = 403;
    throw error;
  }

  const mimeType = sanitizeText(input.mimeType, 80).toLowerCase();
  if (!SUPPORT_MEDIA_TYPES.has(mimeType)) {
    const error = new Error("Unsupported media type.");
    error.statusCode = 400;
    throw error;
  }

  const dataInput = String(input.dataBase64 || input.mediaDataUrl || "").trim();
  const dataBase64 = dataInput.includes(",") ? dataInput.split(",").pop() : dataInput;
  if (!dataBase64) {
    const error = new Error("Missing media data.");
    error.statusCode = 400;
    throw error;
  }

  const buffer = Buffer.from(dataBase64, "base64");
  if (!buffer.length || buffer.length > SUPPORT_MEDIA_MAX_BYTES) {
    const error = new Error(`Media must be smaller than ${Math.round(SUPPORT_MEDIA_MAX_BYTES / 1024 / 1024)} MB.`);
    error.statusCode = 413;
    throw error;
  }

  const extension = mimeType.includes("mp4")
    ? "mp4"
    : mimeType.includes("mpeg")
      ? "mp3"
      : mimeType.includes("quicktime")
        ? "mov"
        : "webm";
  const kind = mimeType.startsWith("video/") ? "video" : "audio";
  const fileName = `support-${contribution.id}-${kind}-${Date.now()}.${extension}`;

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      description: `Support message for E-Library contribution #${contribution.id}`,
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id, webViewLink",
  });

  await db.query(
    `UPDATE support_contributions
        SET media_drive_id = ?,
            media_mime_type = ?,
            media_file_name = ?,
            media_size_bytes = ?,
            media_uploaded_at = CURRENT_TIMESTAMP,
            status = 'media_uploaded'
      WHERE id = ?`,
    [
      response.data.id,
      mimeType,
      fileName,
      buffer.length,
      contribution.id,
    ],
  );

  return {
    id: contribution.id,
    mediaDriveId: response.data.id,
    mediaUrl: response.data.webViewLink || "",
    fileName,
  };
}
