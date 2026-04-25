export const OWNER_ADMIN_EMAIL = String(
  process.env.OWNER_ADMIN_EMAIL || "padamkishore90@gmail.com",
)
  .trim()
  .toLowerCase();

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isOwnerEmail(email) {
  return normalizeEmail(email) === OWNER_ADMIN_EMAIL;
}
