import admin from "firebase-admin";

import db from "../config/db.js";
import firestore from "../config/firebase.js";
import { isOwnerEmail } from "../config/adminAccess.js";
import { verifyGoogleAccessToken } from "../utils/googleToken.js";
import {
  attachSessionCookie,
  clearSessionCookie,
  createCsrfToken,
  createSessionToken,
  readSessionTokenFromRequest,
  verifySessionToken,
} from "../utils/sessionToken.js";

function buildAuthResponse(user, userId, message, csrfToken = null, sessionToken = null) {
  return {
    message,
    userId,
    user,
    csrfToken,
    sessionToken,
  };
}

function attachRole(user, dbRole = "user") {
  const owner = isOwnerEmail(user?.email);
  return {
    ...user,
    role: owner ? "owner" : dbRole || "user",
    isOwner: owner,
  };
}

export const loginUser = async (req, res) => {
  const accessToken = String(req.body?.accessToken || "").trim();
  if (!accessToken) {
    return res.status(400).json({ error: "Google access token is required." });
  }

  try {
    const googleUser = await verifyGoogleAccessToken(accessToken);

    const [existingUsers] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [googleUser.email],
    );

    let mysqlUserId;
    const owner = isOwnerEmail(googleUser.email);
    let dbRole = owner ? "admin" : "user";

    if (existingUsers.length > 0) {
      await db.query(
        `UPDATE users
         SET name = ?, profile_picture = ?, role = CASE WHEN ? THEN 'admin' ELSE role END, last_login = CURRENT_TIMESTAMP
         WHERE email = ?`,
        [googleUser.name, googleUser.picture, owner, googleUser.email],
      );
      mysqlUserId = existingUsers[0].id;
      dbRole = owner ? "admin" : existingUsers[0].role;
      console.log(`[Auth] Existing user verified: ${googleUser.email}`);
    } else {
      const [result] = await db.query(
        "INSERT INTO users (email, name, profile_picture, role) VALUES (?, ?, ?, ?)",
        [googleUser.email, googleUser.name, googleUser.picture, dbRole],
      );
      mysqlUserId = result.insertId;
      console.log(`[Auth] New user created from verified Google login: ${googleUser.email}`);
    }

    if (firestore) {
      await firestore.collection("users").doc(googleUser.email).set(
        {
          mysql_id: mysqlUserId,
          email: googleUser.email,
          name: googleUser.name,
          profile_picture: googleUser.picture,
          given_name: googleUser.given_name,
          google_sub: googleUser.sub,
          last_login: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    const sessionToken = createSessionToken(googleUser);
    attachSessionCookie(res, sessionToken);
    const csrfToken = createCsrfToken(sessionToken);

    return res.status(200).json(
      buildAuthResponse(
        attachRole(googleUser, dbRole),
        mysqlUserId,
        "Google login verified and user synced.",
        csrfToken,
        sessionToken,
      ),
    );
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode)
      ? error.statusCode
      : 401;

    console.error("[Auth] Login verification failed:", error);
    return res.status(statusCode).json({
      error: "Google login verification failed.",
    });
  }
};

export const getSessionUser = async (req, res) => {
  const sessionToken = readSessionTokenFromRequest(req);
  if (!sessionToken) {
    return res.status(401).json({ error: "No active session." });
  }

  try {
    const sessionUser = verifySessionToken(sessionToken);
    const refreshedSessionToken = createSessionToken(sessionUser);
    attachSessionCookie(res, refreshedSessionToken);

    const [existingUsers] = await db.query(
      "SELECT id, role FROM users WHERE email = ? LIMIT 1",
      [sessionUser.email],
    );
    const dbUser = existingUsers[0];

    return res.status(200).json(
      buildAuthResponse(
        attachRole(sessionUser, dbUser?.role),
        dbUser?.id ?? null,
        "Active session restored.",
        createCsrfToken(refreshedSessionToken),
        refreshedSessionToken,
      ),
    );
  } catch (error) {
    clearSessionCookie(res);
    return res.status(401).json({ error: "Session expired or invalid." });
  }
};

export const logoutUser = async (req, res) => {
  clearSessionCookie(res);
  return res.status(200).json({ message: "Signed out successfully." });
};
