import express from "express";
import { streamVideo, getVideoUrl } from "../controllers/videoController.js";

const router = express.Router();

/**
 * GET /api/video/url/:driveId
 * Returns the best available video URL (proxy if token valid, iframe fallback)
 */
router.get("/url/:driveId", getVideoUrl);

/**
 * GET /api/video/:driveId
 * Streams video from Google Drive. Falls back to redirect if token expired.
 */
router.get("/:driveId", streamVideo);

export default router;
