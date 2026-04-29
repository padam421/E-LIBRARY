import express from "express";

import { readPositiveIntEnv } from "../config/runtimeLimits.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import {
  getPublicSupportConfig,
  getRecentSupporters,
  uploadSupportMessageMedia,
} from "../controllers/supportController.js";

const router = express.Router();
const rateWindowMs = readPositiveIntEnv("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000, {
  min: 60 * 1000,
});

const supportReadLimiter = createRateLimiter({
  windowMs: rateWindowMs,
  max: readPositiveIntEnv("SUPPORT_READ_RATE_LIMIT", 300),
  message: "Too many support requests. Please slow down.",
  keyPrefix: "support-read",
});

const supportMediaLimiter = createRateLimiter({
  windowMs: rateWindowMs,
  max: readPositiveIntEnv("SUPPORT_MEDIA_RATE_LIMIT", 20),
  message: "Too many support media uploads. Please wait and try again.",
  keyPrefix: "support-media",
});

router.get("/config", supportReadLimiter, getPublicSupportConfig);
router.get("/recent", supportReadLimiter, getRecentSupporters);
router.post("/media/:uploadToken", supportMediaLimiter, uploadSupportMessageMedia);

export default router;
