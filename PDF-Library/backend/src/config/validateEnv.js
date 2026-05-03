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

function validateBookStorageProvider() {
  const allowedProviders = new Set(["drive", "r2", "gcs", "url", ""]);
  const provider = String(process.env.DEFAULT_BOOK_STORAGE_PROVIDER || "")
    .trim()
    .toLowerCase();

  if (!allowedProviders.has(provider)) {
    fail("DEFAULT_BOOK_STORAGE_PROVIDER must be one of: drive, r2, gcs, url.");
  }

  const hasAnyR2Setting = [
    "R2_ACCOUNT_ID",
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
  ].some(hasValue);

  if (provider !== "r2" && !hasAnyR2Setting) {
    return;
  }

  validateRequired(["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]);
  validateNoPlaceholders(["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]);

  if (!hasValue("R2_ENDPOINT") && !hasValue("R2_ACCOUNT_ID")) {
    fail("Set either R2_ENDPOINT or R2_ACCOUNT_ID when using R2 storage.");
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
  validateBookStorageProvider();

  if (!hasValue("FIREBASE_SERVICE_ACCOUNT_JSON") && !hasValue("FIREBASE_SERVICE_ACCOUNT_BASE64")) {
    warn(
      "Firebase credentials are not configured. Google sign-in will still use MySQL, but Firestore sync will be skipped.",
    );
  }

  validateHttpsOrigins();

  if (String(process.env.SESSION_COOKIE_SECURE || "").trim().toLowerCase() !== "true") {
    fail("SESSION_COOKIE_SECURE must be true in production.");
  }

  if (!hasValue("GEMINI_API_KEY") && !hasValue("GEMINI_API_KEYS")) {
    warn("No Gemini API key is configured. The public AI assistant will not work.");
  }

  if (!hasValue("SUPPORT_MEDIA_DRIVE_FOLDER_ID")) {
    warn("SUPPORT_MEDIA_DRIVE_FOLDER_ID is not configured. Paid support will work, but audio/video support messages cannot upload.");
  }
}

function validateDevelopment() {
  const missing = ["DB_HOST", "DB_USER", "DB_NAME"].filter((name) => !hasValue(name));
  if (missing.length > 0) {
    warn(`Missing local development settings: ${missing.join(", ")}`);
  }

  try {
    validateBookStorageProvider();
  } catch (error) {
    warn(String(error?.message || error).replace(/^\[Env\]\s*/, ""));
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
