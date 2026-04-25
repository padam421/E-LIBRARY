export function readPositiveIntEnv(name, fallback, options = {}) {
  const min = Number.isFinite(options.min) ? options.min : 1;
  const max = Number.isFinite(options.max) ? options.max : Number.MAX_SAFE_INTEGER;
  const parsed = Number.parseInt(String(process.env[name] || ""), 10);

  if (!Number.isInteger(parsed) || parsed < min) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export function readStringEnv(name, fallback) {
  const value = String(process.env[name] || "").trim();
  return value || fallback;
}
