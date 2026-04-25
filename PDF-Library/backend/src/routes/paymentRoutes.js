import express from "express";

import {
  createBookOrder,
  createSiteOrder,
  getBookAccess,
  getPaymentConfig,
  verifyPayment,
} from "../controllers/paymentController.js";
import { readPositiveIntEnv } from "../config/runtimeLimits.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();
const rateWindowMs = readPositiveIntEnv("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000, {
  min: 60 * 1000,
});

const paymentReadLimiter = createRateLimiter({
  windowMs: rateWindowMs,
  max: readPositiveIntEnv("PAYMENT_READ_RATE_LIMIT", 600),
  message: "Too many payment checks. Please slow down.",
  keyPrefix: "payment-read",
});

const paymentWriteLimiter = createRateLimiter({
  windowMs: rateWindowMs,
  max: readPositiveIntEnv("PAYMENT_WRITE_RATE_LIMIT", 60),
  message: "Too many payment attempts. Please wait and try again.",
  keyPrefix: "payment-write",
});

router.get("/config", paymentReadLimiter, getPaymentConfig);
router.get("/access", paymentReadLimiter, getBookAccess);
router.post("/orders/site", paymentWriteLimiter, createSiteOrder);
router.post("/orders/book", paymentWriteLimiter, createBookOrder);
router.post("/verify", paymentWriteLimiter, verifyPayment);

export default router;
