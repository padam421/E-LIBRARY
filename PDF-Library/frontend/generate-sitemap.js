/**
 * Generates a static sitemap.xml from the SEO book cache.
 * Run:  node generate-sitemap.js
 * This creates/overwrites sitemap.xml in the same directory.
 */
const fs = require("fs");
const path = require("path");
const { SEO_BOOK_CACHE } = require("./functions/_lib/seo-book-cache.js");

const SITE_ORIGIN = "https://e-library-c9t.pages.dev";

function slugify(value, fallback = "books") {
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

function getBookSlug(book) {
  return slugify([book.title, book.author].filter(Boolean).join(" "), "book");
}

function getBookUrl(book) {
  return `${SITE_ORIGIN}/books/${encodeURIComponent(book.id)}/${getBookSlug(book)}/`;
}

function getCategorySlug(cat) {
  return slugify(cat || "uncategorized", "uncategorized");
}

function getLanguageSlug(lang) {
  return slugify(lang || "english", "english");
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isPublicReadableBook(book) {
  return Boolean(
    book &&
      String(book.id ?? "").trim() &&
      String(book.title || "").trim() &&
      (book.has_pdf || book.pdf_drive_id || book.has_epub || book.epub_drive_id)
  );
}

// --- Build URL list ---
const books = SEO_BOOK_CACHE.filter(isPublicReadableBook);
const today = new Date().toISOString().slice(0, 10);

// Unique categories
const catSeen = new Set();
const categories = [];
books.forEach((b) => {
  const slug = getCategorySlug(b.category);
  if (!catSeen.has(slug)) {
    catSeen.add(slug);
    categories.push(`${SITE_ORIGIN}/books/category/${slug}/`);
  }
});

// Unique languages
const langSeen = new Set();
const languages = [];
books.forEach((b) => {
  const slug = getLanguageSlug(b.language || "English");
  if (!langSeen.has(slug)) {
    langSeen.add(slug);
    languages.push(`${SITE_ORIGIN}/books/language/${slug}/`);
  }
});

const urls = [
  `${SITE_ORIGIN}/`,
  `${SITE_ORIGIN}/books/`,
  `${SITE_ORIGIN}/about.html`,
  `${SITE_ORIGIN}/how-to-use.html`,
  `${SITE_ORIGIN}/best-free-books.html`,
  `${SITE_ORIGIN}/privacy.html`,
  `${SITE_ORIGIN}/terms.html`,
  ...categories,
  ...languages,
  ...books.map(getBookUrl),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${today}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>
`;

const outPath = path.join(__dirname, "sitemap.xml");
fs.writeFileSync(outPath, xml, "utf-8");
console.log(`✅ sitemap.xml generated with ${urls.length} URLs → ${outPath}`);
