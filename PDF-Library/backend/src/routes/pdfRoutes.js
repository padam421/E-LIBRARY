import express from "express";
import {
  getPdfs,
  previewEpubByBookId,
  previewPdfByBookId,
  previewPdfFromDrive,
  redirectCoverByBookId,
  streamEpubByBookId,
  streamEpubFromDrive,
  streamPdfByBookId,
  streamPdfFromDrive,
} from "../controllers/pdfController.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import { readPositiveIntEnv } from "../config/runtimeLimits.js";

const router = express.Router();
const rateWindowMs = readPositiveIntEnv("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000, {
  min: 60 * 1000,
});
const pdfListLimiter = createRateLimiter({
  windowMs: rateWindowMs,
  max: readPositiveIntEnv("PDF_LIST_RATE_LIMIT", 1200),
  message: "Too many library requests. Please slow down and try again shortly.",
  keyPrefix: "pdf-list",
});
const pdfReadLimiter = createRateLimiter({
  windowMs: rateWindowMs,
  max: readPositiveIntEnv("PDF_READ_RATE_LIMIT", 300),
  message: "Too many PDF opens in a short time. Please wait a moment and try again.",
  keyPrefix: "pdf-read",
});

router.get("/", pdfListLimiter, getPdfs);
router.get("/cover/:bookId", pdfListLimiter, redirectCoverByBookId);
router.get("/book/:bookId/preview", pdfReadLimiter, previewPdfByBookId);
router.get("/book/:bookId/epub/preview", pdfReadLimiter, previewEpubByBookId);
router.get("/book/:bookId/stream", pdfReadLimiter, streamPdfByBookId);
router.get("/book/:bookId/epub/stream", pdfReadLimiter, streamEpubByBookId);
router.get("/preview/:driveId", pdfReadLimiter, previewPdfFromDrive);
router.get("/stream/:driveId", pdfReadLimiter, streamPdfFromDrive);
router.get("/epub/stream/:driveId", pdfReadLimiter, streamEpubFromDrive);

export default router;
