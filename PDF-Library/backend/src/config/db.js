import mysql from "mysql2/promise";
import fs from "fs";
import "./loadEnv.js";
import { readPositiveIntEnv } from "./runtimeLimits.js";

const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_NAME"];
const missingEnvVars = requiredEnvVars.filter(
  (key) => !String(process.env[key] || "").trim(),
);

if (missingEnvVars.length > 0) {
  throw new Error(
    `[DB] Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
}

const useSsl =
  String(process.env.DB_SSL || "false").trim().toLowerCase() === "true";

const poolConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: readPositiveIntEnv("DB_CONNECTION_LIMIT", 10, {
    min: 1,
    max: 200,
  }),
  queueLimit: readPositiveIntEnv("DB_QUEUE_LIMIT", 5000, {
    min: 1,
    max: 100000,
  }),
  // Prevent zombie/idle connections from Aiven dropping them silently
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  connectTimeout: 10000,
  // Automatically destroy stale connections from pool
  idleTimeout: 60000,
};

if (useSsl) {
  const caPath = String(process.env.DB_SSL_CA_PATH || "").trim();
  const caBase64 = String(process.env.DB_SSL_CA_BASE64 || "").trim();
  poolConfig.ssl = {
    minVersion: "TLSv1.2",
    rejectUnauthorized:
      String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "true")
        .trim()
        .toLowerCase() !== "false",
  };

  if (caPath) {
    poolConfig.ssl.ca = fs.readFileSync(caPath, "utf8");
  } else if (caBase64) {
    poolConfig.ssl.ca = Buffer.from(caBase64, "base64").toString("utf8");
  }
}

const rawPool = mysql.createPool(poolConfig);
const DB_QUERY_RETRY_COUNT = readPositiveIntEnv("DB_QUERY_RETRY_COUNT", 2, {
  min: 1,
  max: 5,
});
const TRANSIENT_DB_ERROR_CODES = new Set([
  "PROTOCOL_CONNECTION_LOST",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
]);

function isReadOnlyStatement(args) {
  const firstArg = args[0];
  const sql = typeof firstArg === "string" ? firstArg : firstArg?.sql;
  const firstWord = String(sql || "").trim().split(/\s+/, 1)[0]?.toUpperCase();
  return ["SELECT", "SHOW", "DESCRIBE", "EXPLAIN", "WITH"].includes(firstWord);
}

function isTransientDbError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    TRANSIENT_DB_ERROR_CODES.has(error?.code) ||
    message.includes("connection lost") ||
    message.includes("server closed the connection") ||
    message.includes("socket hang up")
  );
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPoolCommand(method, args) {
  const canRetry = isReadOnlyStatement(args);
  for (let attempt = 0; attempt <= DB_QUERY_RETRY_COUNT; attempt += 1) {
    try {
      return await rawPool[method](...args);
    } catch (error) {
      if (!canRetry || attempt >= DB_QUERY_RETRY_COUNT || !isTransientDbError(error)) {
        throw error;
      }
      console.warn(
        `[DB] ${error.code || "TRANSIENT"} during ${method}; retrying read query (${attempt + 1}/${DB_QUERY_RETRY_COUNT}).`,
      );
      await wait(80 * (attempt + 1));
    }
  }
  throw new Error("[DB] Query retry failed unexpectedly.");
}

const pool = {
  query: (...args) => runPoolCommand("query", args),
  execute: (...args) => runPoolCommand("execute", args),
  getConnection: (...args) => rawPool.getConnection(...args),
  end: (...args) => rawPool.end(...args),
};

console.log("[DB] MySQL connection pool configured.");

// ─── Permanent fix: Heartbeat every 4 minutes ──────────────────────────────
// Aiven free tier can close idle TCP connections after a few minutes.
// Keep the pool warm, and retry read queries if a stale connection slips through.
const HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes

async function runHeartbeat() {
  try {
    await pool.query("SELECT 1");
    console.log("[DB] Heartbeat: connection alive.");
  } catch (err) {
    console.warn("[DB] Heartbeat failed, pool will self-recover:", err.message);
  }
}

// Start heartbeat — this runs inside the server process forever
const heartbeatStartTimer = setTimeout(runHeartbeat, 5000);
const heartbeatIntervalTimer = setInterval(runHeartbeat, HEARTBEAT_INTERVAL_MS);
heartbeatStartTimer.unref?.();
heartbeatIntervalTimer.unref?.();

export default pool;
