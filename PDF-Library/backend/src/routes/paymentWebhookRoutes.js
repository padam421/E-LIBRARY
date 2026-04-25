import express from "express";

import { handleRazorpayWebhook } from "../controllers/paymentController.js";

const router = express.Router();

router.post("/razorpay", handleRazorpayWebhook);

export default router;
