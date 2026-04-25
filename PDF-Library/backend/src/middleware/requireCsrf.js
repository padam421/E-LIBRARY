import {
  readSessionTokenFromRequest,
  verifyCsrfToken,
} from "../utils/sessionToken.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export default function requireCsrf(req, res, next) {
  if (SAFE_METHODS.has(String(req.method || "").toUpperCase())) {
    return next();
  }

  const sessionToken = readSessionTokenFromRequest(req);
  const csrfToken = String(req.headers["x-csrf-token"] || "").trim();

  if (!sessionToken || !csrfToken || !verifyCsrfToken(sessionToken, csrfToken)) {
    return res.status(403).json({
      error: "Security check failed. Refresh the page and try again.",
    });
  }

  return next();
}
