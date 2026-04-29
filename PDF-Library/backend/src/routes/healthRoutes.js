import express from "express";
import { getHealth, warmHealth } from "../controllers/healthController.js";

const router = express.Router();

router.get("/", getHealth);
router.get("/warm", warmHealth);

export default router;
