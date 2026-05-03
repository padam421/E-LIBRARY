import {
  SITE_ORIGIN,
  escapeXml,
  fetchPublicBooks,
  getBookUrl,
  getCategorySlug,
  getLanguageSlug,
  uniqueBySlug,
} from "./_lib/seo.js";

function xmlResponse(xml, status = 200) {
  return new Response(xml, {
    status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
    },
  });
}

function urlEntry(url, lastmod) {
  return `  <url>\n    <loc>${escapeXml(url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
}

export async function onRequestGet(context) {
  const today = new Date().toISOString().slice(0, 10);

  let books = [];
  try {
    books = await fetchPublicBooks(context.env);
  } catch {
    books = [];
  }

  const categories = uniqueBySlug(books, (book) => book.category).map(
    ({ slug }) => `${SITE_ORIGIN}/books/category/${slug}/`,
  );
  const languages = uniqueBySlug(books, (book) => book.language || "English").map(
    ({ slug }) => `${SITE_ORIGIN}/books/language/${slug}/`,
  );

  // Static pages always included — guarantees a valid sitemap even if API fails
  const staticUrls = [
    `${SITE_ORIGIN}/`,
    `${SITE_ORIGIN}/books/`,
    `${SITE_ORIGIN}/about.html`,
    `${SITE_ORIGIN}/how-to-use.html`,
    `${SITE_ORIGIN}/best-free-books.html`,
    `${SITE_ORIGIN}/privacy.html`,
    `${SITE_ORIGIN}/terms.html`,
  ];

  const dynamicUrls = [
    ...categories,
    ...languages,
    ...books.map(getBookUrl),
  ];

  const urls = [...staticUrls, ...dynamicUrls].slice(0, 50000);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => urlEntry(url, today)).join("\n")}
</urlset>`;

  return xmlResponse(xml);
}
