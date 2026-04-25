import express from "express";
import {
  getVideoUrl,
  getVideoUrlByBookId,
  redirectVideoEmbedByBookId,
  streamVideo,
  streamVideoByBookId,
} from "../controllers/videoController.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import { readPositiveIntEnv } from "../config/runtimeLimits.js";

const router = express.Router();
const rateWindowMs = readPositiveIntEnv("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000, {
  min: 60 * 1000,
});
const videoLimiter = createRateLimiter({
  windowMs: rateWindowMs,
  max: readPositiveIntEnv("VIDEO_RATE_LIMIT", 300),
  message: "Too many video requests. Please wait and try again.",
  keyPrefix: "video",
});

router.get("/book/:bookId/url", videoLimiter, getVideoUrlByBookId);
router.get("/book/:bookId/embed", videoLimiter, redirectVideoEmbedByBookId);
router.get("/book/:bookId/stream", videoLimiter, streamVideoByBookId);

/**
 * GET /api/video/url/:driveId
 * Returns the best available video URL (proxy if token valid, iframe fallback)
 */
router.get("/url/:driveId", videoLimiter, getVideoUrl);

/**
 * GET /api/video/:driveId
 * Streams video from Google Drive. Falls back to redirect if token expired.
 */
router.get("/:driveId", videoLimiter, streamVideo);

export default router;
