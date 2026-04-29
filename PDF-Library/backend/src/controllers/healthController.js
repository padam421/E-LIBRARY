import db from "../config/db.js";
import { getAllPDFs } from "../models/pdfModel.js";

const START_TIME = Date.now();

function setHealthHeaders(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
}

// Lightweight health check. The default path does not query the DB, so it is
// suitable for uptime checks that should not create database load.
export const getHealth = async (req, res) => {
  setHealthHeaders(res);
  const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);

  if (!req.query.check) {
    return res.status(200).json({
      status: "ok",
      uptime: uptimeSeconds,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
    });
  }

  let dbStatus = "ok";
  let dbLatencyMs = null;
  try {
    const dbStart = Date.now();
    await db.query("SELECT 1");
    dbLatencyMs = Date.now() - dbStart;
  } catch {
    dbStatus = "error";
  }

  const status = dbStatus === "ok" ? "ok" : "degraded";

  return res.status(status === "ok" ? 200 : 503).json({
    status,
    uptime: uptimeSeconds,
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
    },
    version: process.env.npm_package_version || "1.0.0",
  });
};

// Warm-up endpoint for external cron monitors. Unlike /api/health, this touches
// MySQL and the public books query so the backend, DB connection, and in-memory
// public cache are all exercised.
export const warmHealth = async (req, res) => {
  setHealthHeaders(res);
  const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);
  const startedAt = Date.now();

  try {
    const dbStart = Date.now();
    await db.query("SELECT 1");
    const dbLatencyMs = Date.now() - dbStart;

    let bookCount = null;
    let cacheLatencyMs = null;
    const warmCache = String(req.query.cache || "1").trim() !== "0";

    if (warmCache) {
      const cacheStart = Date.now();
      const books = await getAllPDFs();
      cacheLatencyMs = Date.now() - cacheStart;
      bookCount = Array.isArray(books) ? books.length : 0;
    }

    return res.status(200).json({
      status: "ok",
      uptime: uptimeSeconds,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: "ok",
          latencyMs: dbLatencyMs,
        },
        publicBooksCache: {
          warmed: warmCache,
          latencyMs: cacheLatencyMs,
          count: bookCount,
        },
      },
      totalLatencyMs: Date.now() - startedAt,
      version: process.env.npm_package_version || "1.0.0",
    });
  } catch (error) {
    return res.status(503).json({
      status: "degraded",
      uptime: uptimeSeconds,
      timestamp: new Date().toISOString(),
      error: error?.message || "Warm-up failed.",
      totalLatencyMs: Date.now() - startedAt,
      version: process.env.npm_package_version || "1.0.0",
    });
  }
};
