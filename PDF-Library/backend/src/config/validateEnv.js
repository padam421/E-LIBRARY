import "./loadEnv.js";

const isProduction = String(process.env.NODE_ENV || "").trim() === "production";

function hasValue(name) {
  return String(process.env[name] || "").trim().length > 0;
}

function fail(message) {
  throw new Error(`[Env] ${message}`);
}

function warn(message) {
  console.warn(`[Env] ${message}`);
}

function validateRequired(names) {
  const missing = names.filter((name) => !hasValue(name));
  if (missing.length > 0) {
    fail(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function isPlaceholderValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized === "change_me" ||
    normalized === "changeme" ||
    normalized === "password" ||
    normalized === "your_password" ||
    normalized === "your_database_password" ||
    normalized.startsWith("your_") ||
    normalized.startsWith("replace_with") ||
    normalized.includes("placeholder")
  );
}

function validateNoPlaceholders(names) {
  const placeholders = names.filter((name) => isPlaceholderValue(process.env[name]));
  if (placeholders.length > 0) {
    fail(`Replace placeholder values before production: ${placeholders.join(", ")}`);
  }
}

function validateHttpsOrigins() {
  const corsOrigins = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.some((origin) => origin === "*")) {
    fail("CORS_ORIGIN cannot be '*' in production.");
  }

  const insecureOrigins = corsOrigins.filter((origin) => !origin.startsWith("https://"));
  if (insecureOrigins.length > 0) {
    fail("CORS_ORIGIN must use https:// in production.");
  }
}

function validateSessionSecret() {
  const secret = String(process.env.SESSION_TOKEN_SECRET || "").trim();
  if (secret.length < 32) {
    fail("SESSION_TOKEN_SECRET must be at least 32 characters in production.");
  }
}

function validateProduction() {
  const requiredProductionVariables = [
    "CORS_ORIGIN",
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
    "GOOGLE_CLIENT_ID",
    "OWNER_ADMIN_EMAIL",
    "DRIVE_CLIENT_ID",
    "DRIVE_CLIENT_SECRET",
    "DRIVE_REDIRECT_URI",
    "DRIVE_REFRESH_TOKEN",
    "SESSION_TOKEN_SECRET",
  ];

  validateRequired(requiredProductionVariables);
  validateNoPlaceholders(requiredProductionVariables);
  validateSessionSecret();

  if (!hasValue("FIREBASE_SERVICE_ACCOUNT_JSON") && !hasValue("FIREBASE_SERVICE_ACCOUNT_BASE64")) {
    fail(
      "Production Firebase credentials must come from FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_BASE64.",
    );
  }

  validateHttpsOrigins();

  if (String(process.env.SESSION_COOKIE_SECURE || "").trim().toLowerCase() !== "true") {
    fail("SESSION_COOKIE_SECURE must be true in production.");
  }

  if (!hasValue("GEMINI_API_KEY") && !hasValue("GEMINI_API_KEYS")) {
    warn("No Gemini API key is configured. The public AI assistant will not work.");
  }
}

function validateDevelopment() {
  const missing = ["DB_HOST", "DB_USER", "DB_NAME"].filter((name) => !hasValue(name));
  if (missing.length > 0) {
    warn(`Missing local development settings: ${missing.join(", ")}`);
  }
}

export function validateEnv() {
  if (isProduction) {
    validateProduction();
    return;
  }

  validateDevelopment();
}

validateEnv();
