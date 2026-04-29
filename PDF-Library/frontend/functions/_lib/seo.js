import { SEO_BOOK_CACHE } from "./seo-book-cache.js";

export const SITE_ORIGIN = "https://e-library-c9t.pages.dev";
export const SITE_NAME = "E-Library";
export const DEFAULT_API_ORIGIN = "https://e-library-dtx4.onrender.com";

export function getApiOrigin(env = {}) {
  return String(env.SEO_API_ORIGIN || env.API_ORIGIN || DEFAULT_API_ORIGIN)
    .trim()
    .replace(/\/+$/, "");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeXml(value) {
  return escapeHtml(value);
}

export function slugify(value, fallback = "books") {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
  return slug || fallback;
}

export function truncate(value, maxLength = 160) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

export function getBookSlug(book) {
  return slugify([book?.title, book?.author].filter(Boolean).join(" "), "book");
}

export function getBookPath(book) {
  const id = String(book?.id ?? "").trim();
  return id ? `/books/${encodeURIComponent(id)}/${getBookSlug(book)}/` : "/books/";
}

export function getBookUrl(book) {
  return `${SITE_ORIGIN}${getBookPath(book)}`;
}

export function getCategorySlug(bookOrCategory) {
  const value = typeof bookOrCategory === "string" ? bookOrCategory : bookOrCategory?.category;
  return slugify(value || "uncategorized", "uncategorized");
}

export function getLanguage(book) {
  return String(book?.language || book?.language_name || "English").trim() || "English";
}

export function getLanguageSlug(bookOrLanguage) {
  const value = typeof bookOrLanguage === "string" ? bookOrLanguage : getLanguage(bookOrLanguage);
  return slugify(value || "english", "english");
}

export function getLanguageCode(language) {
  const key = String(language || "").trim().toLowerCase();
  const map = {
    english: "en",
    hindi: "hi",
    bengali: "bn",
    gujarati: "gu",
    kannada: "kn",
    telugu: "te",
    tamil: "ta",
    arabic: "ar",
    hebrew: "he",
  };
  return map[key] || key.slice(0, 2) || "en";
}

export function getFormats(book) {
  const formats = [];
  if (book?.has_pdf || book?.pdf_drive_id) formats.push("PDF");
  if (book?.has_epub || book?.epub_drive_id) formats.push("EPUB");
  return formats;
}

export function isPublicReadableBook(book) {
  return Boolean(
    book &&
      String(book.id ?? "").trim() &&
      String(book.title || "").trim() &&
      getFormats(book).length > 0,
  );
}

export function absoluteAssetUrl(value, env = {}) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${getApiOrigin(env)}${raw}`;
  return raw;
}

export function getBookImageUrl(book, env = {}) {
  return (
    absoluteAssetUrl(book?.poster_url, env) ||
    absoluteAssetUrl(book?.cover_url, env) ||
    `${SITE_ORIGIN}/favicon.png`
  );
}

export async function fetchPublicBooks(env = {}) {
  try {
    const response = await fetch(`${getApiOrigin(env)}/api/pdfs`, {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (!response.ok) {
      throw new Error(`Book API returned ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data.filter(isPublicReadableBook) : [];
  } catch (error) {
    const fallback = Array.isArray(SEO_BOOK_CACHE)
      ? SEO_BOOK_CACHE.filter(isPublicReadableBook)
      : [];
    if (fallback.length > 0) return fallback;
    throw error;
  }
}

export function uniqueBySlug(items, getValue) {
  const seen = new Map();
  items.forEach((item) => {
    const value = String(getValue(item) || "").trim();
    const slug = slugify(value, "");
    if (slug && !seen.has(slug)) seen.set(slug, value);
  });
  return [...seen.entries()].map(([slug, label]) => ({ slug, label }));
}

export function jsonScript(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
