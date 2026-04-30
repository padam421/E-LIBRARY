import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "./loadEnv.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const keyPath = path.join(__dirname, "firebase-key.json");
const isProduction = String(process.env.NODE_ENV || "").trim() === "production";

function readServiceAccountFromEnv() {
  const inlineJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (inlineJson) {
    return JSON.parse(inlineJson);
  }

  const base64Json = String(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "",
  ).trim();
  if (base64Json) {
    const decoded = Buffer.from(base64Json, "base64").toString("utf8");
    return JSON.parse(decoded);
  }

  return null;
}

function readServiceAccount() {
  const envCredentials = readServiceAccountFromEnv();
  if (envCredentials) {
    return envCredentials;
  }

  if (isProduction) {
    console.warn(
      "[Firebase] Production credentials are not configured. Firestore sync is disabled; MySQL auth remains available.",
    );
    return null;
  }

  if (fs.existsSync(keyPath)) {
    console.warn(
      "[Firebase] Using local firebase-key.json fallback. Move this secret into environment variables before deployment.",
    );
    return JSON.parse(fs.readFileSync(keyPath, "utf8"));
  }

  throw new Error(
    "[Firebase] Missing credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_BASE64.",
  );
}

const serviceAccount = readServiceAccount();

if (serviceAccount && admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
  });
}

const firestore = serviceAccount ? admin.firestore() : null;
if (firestore) {
  console.log("[Firebase] Firestore initialized.");
}

export default firestore;
