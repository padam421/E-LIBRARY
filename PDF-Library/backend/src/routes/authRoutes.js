import express from "express";
import {
  getSessionUser,
  loginUser,
  logoutUser,
} from "../controllers/authController.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import { readPositiveIntEnv } from "../config/runtimeLimits.js";

const router = express.Router();
const rateWindowMs = readPositiveIntEnv("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000, {
  min: 60 * 1000,
});
const authReadLimiter = createRateLimiter({
  windowMs: rateWindowMs,
  max: readPositiveIntEnv("AUTH_READ_RATE_LIMIT", 600),
  message: "Too many authentication requests. Please wait a little and try again.",
  keyPrefix: "auth-read",
});
const authLoginLimiter = createRateLimiter({
  windowMs: rateWindowMs,
  max: readPositiveIntEnv("AUTH_LOGIN_RATE_LIMIT", 30),
  message: "Too many sign-in attempts. Please wait before trying again.",
  keyPrefix: "auth-login",
});

router.get("/session", authReadLimiter, getSessionUser);
router.post("/login", authLoginLimiter, loginUser);
router.post("/logout", authReadLimiter, logoutUser);

export default router;
