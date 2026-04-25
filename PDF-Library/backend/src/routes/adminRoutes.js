import express from "express";
import requireAdmin from "../middleware/requireAdmin.js";
import requireCsrf from "../middleware/requireCsrf.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import { readPositiveIntEnv } from "../config/runtimeLimits.js";
import {
  listBooks,
  listAdminUsers,
  listAdminActivity,
  createBook,
  createBooksBulk,
  grantAdmin,
  updateBook,
  updateBooksVisibilityBulk,
  deleteBook,
  deleteBooksBulk,
  revokeAdmin,
} from "../controllers/adminController.js";
import {
  getAdminPaymentBooks,
  getAdminPaymentOrders,
  getAdminPaymentSettings,
  saveAdminPaymentSettings,
  saveBookPremiumRule,
  saveBooksPremiumBulk,
} from "../controllers/adminPaymentController.js";

const router = express.Router();
const rateWindowMs = readPositiveIntEnv("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000, {
  min: 60 * 1000,
});
const adminLimiter = createRateLimiter({
  windowMs: rateWindowMs,
  max: readPositiveIntEnv("ADMIN_RATE_LIMIT", 2000),
  message: "Too many admin requests. Please slow down.",
  keyPrefix: "admin",
});

// All admin routes require a valid admin session
router.use(requireAdmin);
router.use(adminLimiter);
router.use(requireCsrf);

router.get("/users", listAdminUsers);
router.post("/users/grant-admin", grantAdmin);
router.post("/users/revoke-admin", revokeAdmin);
router.get("/activity", listAdminActivity);
router.get("/payments/settings", getAdminPaymentSettings);
router.put("/payments/settings", saveAdminPaymentSettings);
router.get("/payments/books", getAdminPaymentBooks);
router.post("/payments/books/bulk", saveBooksPremiumBulk);
router.put("/payments/books/:id", saveBookPremiumRule);
router.get("/payments/orders", getAdminPaymentOrders);
router.get("/books", listBooks);
router.post("/books", createBook);
router.post("/books/bulk", createBooksBulk);
router.post("/books/visibility", updateBooksVisibilityBulk);
router.post("/books/delete-many", deleteBooksBulk);
router.put("/books/:id", updateBook);
router.delete("/books/:id", deleteBook);

export default router;
