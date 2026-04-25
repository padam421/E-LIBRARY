import crypto from "crypto";
import "../config/loadEnv.js";

const DEFAULT_TTL_SECONDS = Number(process.env.SESSION_TOKEN_TTL_SECONDS || 60 * 60 * 12);
export const SESSION_COOKIE_NAME = "pdf_library_session";
let hasWarnedAboutFallbackSecret = false;

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function getSessionSecret() {
  const configuredSecret = String(process.env.SESSION_TOKEN_SECRET || "").trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  const isProduction = String(process.env.NODE_ENV || "").trim() === "production";
  if (isProduction) {
    throw new Error(
      "[Session] Missing SESSION_TOKEN_SECRET in production. Add it before deploying.",
    );
  }

  const fallbackSecret = String(
    process.env.DRIVE_CLIENT_SECRET || process.env.DB_PASSWORD || "",
  ).trim();

  if (!fallbackSecret) {
    throw new Error(
      "[Session] Missing signing secret. Set SESSION_TOKEN_SECRET or another backend secret.",
    );
  }

  if (!hasWarnedAboutFallbackSecret) {
    hasWarnedAboutFallbackSecret = true;
    console.warn(
      "[Session] Using a development fallback secret. Set SESSION_TOKEN_SECRET before deployment.",
    );
  }

  return fallbackSecret;
}

function readBooleanEnv(name, defaultValue) {
  const rawValue = String(process.env[name] || "").trim().toLowerCase();
  if (!rawValue) {
    return defaultValue;
  }

  if (["1", "true", "yes", "on"].includes(rawValue)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(rawValue)) {
    return false;
  }

  return defaultValue;
}

function getCookieSameSite() {
  const rawValue = String(process.env.SESSION_COOKIE_SAME_SITE || "").trim().toLowerCase();
  if (rawValue === "strict") {
    return "strict";
  }

  if (rawValue === "none") {
    return "none";
  }

  return "lax";
}

function signValue(value) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createSessionToken(payload) {
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    email: String(payload?.email || "").trim().toLowerCase(),
    name: String(payload?.name || "").trim(),
    picture: String(payload?.picture || "").trim(),
    given_name: String(payload?.given_name || "").trim(),
    sub: String(payload?.sub || "").trim(),
    iat: now,
    exp: now + DEFAULT_TTL_SECONDS,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token) {
  const rawToken = String(token || "").trim();
  if (!rawToken.includes(".")) {
    const error = new Error("Session token is missing or malformed.");
    error.statusCode = 401;
    throw error;
  }

  const [encodedPayload, providedSignature] = rawToken.split(".");
  const expectedSignature = signValue(encodedPayload);
  const providedBuffer = Buffer.from(String(providedSignature || ""));
  const expectedBuffer = Buffer.from(String(expectedSignature || ""));

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    const error = new Error("Session token signature is invalid.");
    error.statusCode = 401;
    throw error;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    const error = new Error("Session token payload is invalid.");
    error.statusCode = 401;
    throw error;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload?.exp || Number(payload.exp) <= now) {
    const error = new Error("Session token has expired.");
    error.statusCode = 401;
    throw error;
  }

  if (!payload?.email) {
    const error = new Error("Session token is missing an email.");
    error.statusCode = 401;
    throw error;
  }

  return payload;
}

export function createCsrfToken(sessionToken) {
  const rawToken = String(sessionToken || "").trim();
  if (!rawToken) return "";
  return signValue(`csrf:${rawToken}`);
}

export function verifyCsrfToken(sessionToken, csrfToken) {
  const expectedToken = createCsrfToken(sessionToken);
  const providedToken = String(csrfToken || "").trim();
  const providedBuffer = Buffer.from(providedToken);
  const expectedBuffer = Buffer.from(expectedToken);

  return (
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

function getCookieSecurityOptions() {
  const isProduction = String(process.env.NODE_ENV || "").trim() === "production";
  const sameSite = getCookieSameSite();
  const secure = sameSite === "none"
    ? true
    : readBooleanEnv("SESSION_COOKIE_SECURE", isProduction);

  return {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
  };
}

export function attachSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...getCookieSecurityOptions(),
    maxAge: DEFAULT_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, getCookieSecurityOptions());
}

function parseCookieHeader(rawCookieHeader) {
  return String(rawCookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) return cookies;

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (!key) return cookies;

      try {
        cookies[key] = decodeURIComponent(value);
      } catch {
        cookies[key] = value;
      }
      return cookies;
    }, {});
}

export function readSessionTokenFromRequest(req) {
  const cookies = parseCookieHeader(req?.headers?.cookie);
  return String(cookies?.[SESSION_COOKIE_NAME] || "").trim();
}
