import express from "express";
import { getPdfs } from "../controllers/pdfController.js";

const router = express.Router();

// When someone visits /api/pdfs, run the getPdfs controller!
router.get("/", getPdfs);

export default router;
