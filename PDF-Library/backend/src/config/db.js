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

const pool = mysql.createPool(poolConfig);

console.log("[DB] MySQL connection pool configured.");

// ─── Permanent fix: Heartbeat every 4 minutes ──────────────────────────────
// Aiven free tier drops idle TCP connections after ~5 minutes.
// This keeps the pool warm and clears stale connections automatically.
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
setInterval(runHeartbeat, HEARTBEAT_INTERVAL_MS);

export default pool;
