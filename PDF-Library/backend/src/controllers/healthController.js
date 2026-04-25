import db from "../config/db.js";

const START_TIME = Date.now();

export const getHealth = async (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);
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
