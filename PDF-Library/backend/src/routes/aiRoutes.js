import express from "express";
import { askAI } from "../controllers/aiController.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import { readPositiveIntEnv } from "../config/runtimeLimits.js";

const router = express.Router();
const rateWindowMs = readPositiveIntEnv("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000, {
  min: 60 * 1000,
});
const aiAskLimiter = createRateLimiter({
  windowMs: rateWindowMs,
  max: readPositiveIntEnv("AI_ASK_RATE_LIMIT", 30),
  message: "Too many AI requests. Please wait a little before asking again.",
  keyPrefix: "ai-ask",
});

router.post("/ask", aiAskLimiter, askAI);

export default router;
