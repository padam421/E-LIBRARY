import db from "../config/db.js";

const START_TIME = Date.now();

// Lightweight health check — does NOT do a DB query on every cron-job ping.
// A full DB check is only done when the ?check=db query param is present.
// This prevents the cron-job from flooding the DB with queries every minute.
export const getHealth = async (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);

  // Fast path: no DB query (used by cron-job.org pings)
  if (!req.query.check) {
    return res.status(200).json({
      status: "ok",
      uptime: uptimeSeconds,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
    });
  }

  // Full check path: used for monitoring dashboards / manual checks
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
