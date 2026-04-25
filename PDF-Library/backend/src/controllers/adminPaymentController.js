import db from "../config/db.js";
import {
  getPaymentSettings,
  getPublicPaymentConfig,
  listPaymentBooks,
  listPaymentOrders,
  updateBookPremiumRule,
  updateBooksPremiumBulk,
  updatePaymentSettings,
} from "../services/paymentService.js";

function requireOwner(req, res) {
  if (!req.sessionUser?.isOwner) {
    res.status(403).json({ error: "Only the owner can manage payments." });
    return false;
  }
  return true;
}

function sendError(res, error, fallbackMessage = "Payment admin request failed.") {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  return res.status(statusCode).json({
    error: error?.message || fallbackMessage,
  });
}

function rupeesToPaise(value) {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

function normalizeSettingsBody(body = {}) {
  return {
    paymentsEnabled: Boolean(body.paymentsEnabled),
    sitePremiumEnabled: Boolean(body.sitePremiumEnabled),
    currency: body.currency || "INR",
    previewPageLimit: body.previewPageLimit,
    monthlyPricePaise: body.monthlyPricePaise ?? rupeesToPaise(body.monthlyPriceRupees),
    monthlyDurationDays: body.monthlyDurationDays,
    annualPricePaise: body.annualPricePaise ?? rupeesToPaise(body.annualPriceRupees),
    annualDurationDays: body.annualDurationDays,
  };
}

function normalizeRuleBody(body = {}) {
  return {
    isPremium: Boolean(body.isPremium),
    pricePaise: body.pricePaise ?? rupeesToPaise(body.priceRupees),
    accessDurationDays: body.accessDurationDays,
    allowPlatformDownload: body.allowPlatformDownload !== false,
  };
}

function getActor(req) {
  return {
    email: String(req.sessionUser?.email || "").trim().toLowerCase(),
    name: String(req.sessionUser?.name || req.sessionUser?.given_name || "").trim().slice(0, 255) || null,
    role: req.sessionUser?.isOwner ? "owner" : (req.sessionUser?.role || "admin"),
  };
}

async function logPaymentActivity(req, action, targetTitle, details = {}) {
  const actor = getActor(req);
  if (!actor.email) return;

  try {
    await db.query(
      `INSERT INTO admin_activity_logs
         (actor_email, actor_name, actor_role, action, target_type, target_id, target_title, details_json)
       VALUES (?, ?, ?, ?, 'payment', NULL, ?, ?)`,
      [
        actor.email,
        actor.name,
        actor.role,
        action,
        String(targetTitle || "").trim().slice(0, 255) || null,
        JSON.stringify(details || {}),
      ],
    );
  } catch (error) {
    console.error("[Payments] activity log failed:", error?.message || error);
  }
}

export async function getAdminPaymentSettings(req, res) {
  try {
    const settings = await getPaymentSettings();
    return res.status(200).json({
      settings,
      provider: getPublicPaymentConfig(),
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function saveAdminPaymentSettings(req, res) {
  if (!requireOwner(req, res)) return;

  try {
    const settings = await updatePaymentSettings(
      normalizeSettingsBody(req.body),
      req.sessionUser?.email,
    );
    await logPaymentActivity(req, "payments.settings_updated", "Payment settings", {
      payments_enabled: settings.paymentsEnabled,
      site_premium_enabled: settings.sitePremiumEnabled,
      preview_page_limit: settings.previewPageLimit,
      currency: settings.currency,
      monthly_price_paise: settings.monthlyPricePaise,
      annual_price_paise: settings.annualPricePaise,
    });
    return res.status(200).json({
      message: "Payment settings saved.",
      settings,
      provider: getPublicPaymentConfig(),
    });
  } catch (error) {
    return sendError(res, error, "Could not save payment settings.");
  }
}

export async function getAdminPaymentBooks(req, res) {
  try {
    const result = await listPaymentBooks({
      page: req.query?.page,
      limit: req.query?.limit,
      search: req.query?.search,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error, "Could not load payment books.");
  }
}

export async function saveBookPremiumRule(req, res) {
  if (!requireOwner(req, res)) return;

  try {
    const rule = await updateBookPremiumRule(
      req.params?.id,
      normalizeRuleBody(req.body),
      req.sessionUser?.email,
    );
    await logPaymentActivity(req, "payments.book_rule_updated", `Book #${Number(rule.bookId || req.params?.id || 0)}`, {
      book_id: Number(rule.bookId || req.params?.id || 0),
      is_premium: rule.isPremium,
      price_paise: rule.pricePaise,
      access_duration_days: rule.accessDurationDays,
      allow_platform_download: rule.allowPlatformDownload,
    });
    return res.status(200).json({
      message: "Book premium rule saved.",
      rule,
    });
  } catch (error) {
    return sendError(res, error, "Could not save book premium rule.");
  }
}

export async function saveBooksPremiumBulk(req, res) {
  if (!requireOwner(req, res)) return;

  try {
    const result = await updateBooksPremiumBulk(
      req.body?.ids,
      normalizeRuleBody(req.body),
      req.sessionUser?.email,
    );
    await logPaymentActivity(req, "payments.books_bulk_updated", "Bulk premium update", {
      ids: result.ids,
      updated: result.updated,
      is_premium: Boolean(req.body?.isPremium),
      price_paise: normalizeRuleBody(req.body).pricePaise ?? null,
      access_duration_days: normalizeRuleBody(req.body).accessDurationDays ?? null,
    });
    return res.status(200).json({
      message: "Selected books updated.",
      ...result,
    });
  } catch (error) {
    return sendError(res, error, "Could not update selected books.");
  }
}

export async function getAdminPaymentOrders(req, res) {
  if (!requireOwner(req, res)) return;

  try {
    const result = await listPaymentOrders({
      page: req.query?.page,
      limit: req.query?.limit,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error, "Could not load payment orders.");
  }
}
