process.env.NODE_ENV = "production";

try {
  await import("../src/config/validateEnv.js");
  console.log("[Preflight] Production environment settings look ready.");
} catch (error) {
  console.error("[Preflight] Production environment is not ready.");
  console.error(error?.message || error);
  process.exitCode = 1;
}
