import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..", "..");
const localEnvPath = path.join(backendRoot, ".env");
const cloudEnvPath = path.join(backendRoot, ".env.cloud");
const fallbackKeysFromCloud = [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
];

let hasLoadedEnv = false;

function readParsedEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return dotenv.parse(fs.readFileSync(filePath, "utf8"));
}

export default function loadEnv() {
  if (hasLoadedEnv) {
    return;
  }

  dotenv.config({
    path: localEnvPath,
    quiet: true,
  });

  const parsedCloudEnv = readParsedEnv(cloudEnvPath);
  for (const key of fallbackKeysFromCloud) {
    const currentValue = String(process.env[key] || "").trim();
    const cloudValue = String(parsedCloudEnv[key] || "").trim();

    if (!currentValue && cloudValue) {
      process.env[key] = cloudValue;
    }
  }

  hasLoadedEnv = true;
}

loadEnv();
