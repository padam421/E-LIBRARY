import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const projectDir = path.resolve(backendDir, "..");

const allowedTrackedFiles = new Set([
  ".env.example",
  "backend/.env.example",
]);

const forbiddenTrackedPatterns = [
  /^\.env($|\.)/i,
  /^backend\/\.env($|\.)/i,
  /(^|\/)firebase-key\.json$/i,
  /(^|\/)service-account.*\.json$/i,
  /(^|\/)serviceAccount.*\.json$/i,
];

const localSecretFiles = [
  "backend/.env",
  "backend/src/config/firebase-key.json",
];

function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}

function readTrackedFiles() {
  try {
    return execFileSync("git", ["ls-files"], {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(toPosixPath);
  } catch {
    console.warn("[SecretCheck] Git is unavailable, so tracked-file checks were skipped.");
    return [];
  }
}

const trackedFiles = readTrackedFiles();
const forbiddenTrackedFiles = trackedFiles.filter((file) => (
  !allowedTrackedFiles.has(file) &&
  forbiddenTrackedPatterns.some((pattern) => pattern.test(file))
));

if (forbiddenTrackedFiles.length > 0) {
  console.error("[SecretCheck] These secret-looking files are tracked by Git:");
  forbiddenTrackedFiles.forEach((file) => console.error(`- ${file}`));
  console.error("[SecretCheck] Remove them from Git before hosting.");
  process.exit(1);
}

const localPresent = localSecretFiles.filter((file) => fs.existsSync(path.join(projectDir, file)));
if (localPresent.length > 0) {
  console.warn("[SecretCheck] Local-only secret files found. This is OK for local development only:");
  localPresent.forEach((file) => console.warn(`- ${file}`));
  console.warn("[SecretCheck] They are ignored by Git and must not be uploaded manually.");
}

console.log("[SecretCheck] No tracked secret files found.");
