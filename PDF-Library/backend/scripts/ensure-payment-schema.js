import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import db from "../src/config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqlPaths = [
  path.resolve(__dirname, "../../sql/005_payments.sql"),
  path.resolve(__dirname, "../../sql/006_support_contributions.sql"),
];

function splitSqlStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter((statement) => !statement.startsWith("--"));
}

async function main() {
  const statements = sqlPaths.flatMap((sqlPath) => {
    const sql = fs.readFileSync(sqlPath, "utf8");
    return splitSqlStatements(sql);
  });

  for (const statement of statements) {
    await db.query(statement);
  }

  console.log("[Schema] Payment and support tables are ready.");
}

try {
  await main();
} catch (error) {
  console.error("[Schema] Payment setup failed:", error?.message || error);
  process.exitCode = 1;
} finally {
  await db.end();
}
