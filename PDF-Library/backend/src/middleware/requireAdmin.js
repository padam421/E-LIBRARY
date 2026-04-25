import {
  readSessionTokenFromRequest,
  verifySessionToken,
} from "../utils/sessionToken.js";
import db from "../config/db.js";
import { isOwnerEmail } from "../config/adminAccess.js";

/**
 * Middleware: require an active session AND admin role in DB.
 * Attach `req.sessionUser` on success.
 */
export default async function requireAdmin(req, res, next) {
  const token = readSessionTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: "Sign in required." });
  }

  let sessionUser;
  try {
    sessionUser = verifySessionToken(token);
  } catch {
    return res.status(401).json({ error: "Session expired or invalid." });
  }

  try {
    const [rows] = await db.query(
      "SELECT id, role FROM users WHERE email = ? LIMIT 1",
      [sessionUser.email],
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: "User not found." });
    }

    const isOwner = isOwnerEmail(sessionUser.email);

    if (!isOwner && rows[0].role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }

    if (isOwner && rows[0].role !== "admin") {
      await db.query("UPDATE users SET role = 'admin' WHERE id = ?", [rows[0].id]);
    }

    req.sessionUser = {
      ...sessionUser,
      id: rows[0].id,
      role: isOwner ? "owner" : "admin",
      isOwner,
    };
    return next();
  } catch {
    return res.status(500).json({ error: "Could not verify admin status." });
  }
}
