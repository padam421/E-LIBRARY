import {
  SITE_NAME,
  SITE_ORIGIN,
  escapeHtml,
  fetchPublicBooks,
  getBookImageUrl,
  getBookPath,
  getBookSlug,
  getBookUrl,
  getCategorySlug,
  getFormats,
  getLanguage,
  getLanguageCode,
  getLanguageSlug,
  jsonScript,
  slugify,
  truncate,
  uniqueBySlug,
} from "../_lib/seo.js";

function htmlResponse(html, init = {}) {
  return new Response(html, {
    status: init.status || 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": init.cacheControl || "public, max-age=120, stale-while-revalidate=600",
      ...init.headers,
    },
  });
}

function normalizeCatchAllPath(value) {
  const raw = Array.isArray(value) ? value.join("/") : String(value || "");
  return raw.split("/").map((part) => part.trim()).filter(Boolean);
}

function pageShell({ title, description, canonical, body, jsonLd, robots = "index, follow" }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonical = escapeHtml(canonical);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <meta name="robots" content="${escapeHtml(robots)}" />
    <meta name="google-site-verification" content="XIa9uO4IJpkrJ3xV-a2K00BZ2kR4bV8vncQBjniJOGM" />
    <link rel="canonical" href="${safeCanonical}" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${safeCanonical}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <link rel="stylesheet" href="/assets/css/seo.css?v=1" />
    ${jsonLd ? `<script type="application/ld+json">${jsonScript(jsonLd)}</script>` : ""}
  </head>
  <body class="seo-page">
    <header class="seo-header">
      <a href="/" class="seo-brand">E-Library</a>
      <nav aria-label="Primary">
        <a href="/books/">Books</a>
        <a href="/privacy.html">Privacy</a>
        <a href="/terms.html">Terms</a>
      </nav>
    </header>
    ${body}
  </body>
</html>`;
}

function renderBookCards(books) {
  return books
    .map((book) => {
      const image = getBookImageUrl(book);
      return `<a class="seo-book-card" href="${escapeHtml(getBookPath(book))}">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(book.title)} cover" loading="lazy" referrerpolicy="no-referrer" />
        <span>${escapeHtml(book.title || "Untitled")}</span>
        <small>${escapeHtml(book.author || "Unknown author")}</small>
      </a>`;
    })
    .join("");
}

function renderBookPage(book, allBooks, env) {
  const canonical = getBookUrl(book);
  const description = truncate(
    book.description ||
      `${book.title} by ${book.author || "Unknown author"} is available to read online in E-Library.`,
    180,
  );
  const image = getBookImageUrl(book, env);
  const formats = getFormats(book);
  const language = getLanguage(book);
  const detailUrl = `/book-detail.html?id=${encodeURIComponent(book.id)}&title=${encodeURIComponent(book.title || "Book")}`;
  const related = allBooks
    .filter((candidate) => String(candidate.id) !== String(book.id))
    .filter((candidate) => getCategorySlug(candidate) === getCategorySlug(book))
    .slice(0, 8);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Book",
      name: book.title,
      author: book.author ? { "@type": "Person", name: book.author } : undefined,
      description,
      url: canonical,
      image,
      inLanguage: getLanguageCode(language),
      bookFormat: formats.includes("EPUB") ? "https://schema.org/EBook" : "https://schema.org/Book",
      encodingFormat: formats.map((format) => (format === "PDF" ? "application/pdf" : "application/epub+zip")),
      isAccessibleForFree: !book.payment_required,
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_ORIGIN,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "E-Library", item: SITE_ORIGIN },
        { "@type": "ListItem", position: 2, name: book.category || "Books", item: `${SITE_ORIGIN}/books/category/${getCategorySlug(book)}/` },
        { "@type": "ListItem", position: 3, name: book.title, item: canonical },
      ],
    },
  ];

  const body = `<main class="seo-book-layout">
    <section class="seo-book-hero">
      <div class="seo-cover-wrap">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(book.title)} cover" referrerpolicy="no-referrer" />
      </div>
      <div class="seo-book-copy">
        <p class="seo-kicker">${escapeHtml(book.category || "Digital book")}</p>
        <h1>${escapeHtml(book.title)}</h1>
        <p class="seo-author">by ${escapeHtml(book.author || "Unknown author")}</p>
        <p class="seo-description">${escapeHtml(description)}</p>
        <dl class="seo-meta-grid">
          <div><dt>Format</dt><dd>${escapeHtml(formats.join(", "))}</dd></div>
          <div><dt>Language</dt><dd>${escapeHtml(language)}</dd></div>
          <div><dt>Access</dt><dd>${book.payment_required ? "Preview available" : "Free to read"}</dd></div>
        </dl>
        <div class="seo-actions">
          <a class="seo-primary-btn" href="${escapeHtml(detailUrl)}">${book.payment_required ? "Preview or enroll" : "Open book"}</a>
          <a class="seo-secondary-btn" href="/">Explore library</a>
        </div>
      </div>
    </section>
    ${related.length ? `<section class="seo-related"><h2>More ${escapeHtml(book.category || "books")}</h2><div class="seo-card-grid">${renderBookCards(related)}</div></section>` : ""}
  </main>`;

  return pageShell({
    title: `${book.title} by ${book.author || "Unknown Author"} | E-Library`,
    description,
    canonical,
    body,
    jsonLd,
  });
}

function renderCollectionPage({ title, description, canonical, books, jsonName }) {
  const itemList = books.slice(0, 100).map((book, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: getBookUrl(book),
    name: book.title,
  }));
  const body = `<main class="seo-collection">
    <section class="seo-collection-hero">
      <p class="seo-kicker">E-Library collection</p>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
    </section>
    <section class="seo-card-grid" aria-label="${escapeHtml(title)}">${renderBookCards(books)}</section>
  </main>`;
  return pageShell({
    title: `${title} | E-Library`,
    description,
    canonical,
    body,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: jsonName || title,
      description,
      url: canonical,
      mainEntity: {
        "@type": "ItemList",
        itemListElement: itemList,
      },
    },
  });
}

function renderNotFound() {
  return pageShell({
    title: "Book not found | E-Library",
    description: "The requested E-Library page could not be found.",
    canonical: `${SITE_ORIGIN}/books/`,
    robots: "noindex, follow",
    body: `<main class="seo-collection"><section class="seo-collection-hero"><h1>Book not found</h1><p>This book may be private, unavailable, or moved.</p><a class="seo-primary-btn" href="/">Return to E-Library</a></section></main>`,
  });
}

export async function onRequestGet(context) {
  let books = [];
  try {
    books = await fetchPublicBooks(context.env);
  } catch (error) {
    return htmlResponse(
      pageShell({
        title: "E-Library is warming up",
        description: "The E-Library book index is temporarily unavailable. Please try again shortly.",
        canonical: `${SITE_ORIGIN}/books/`,
        robots: "noindex, follow",
        body: `<main class="seo-collection"><section class="seo-collection-hero"><h1>E-Library is warming up</h1><p>The book index is temporarily unavailable. Please refresh in a moment.</p></section></main>`,
      }),
      { status: 503, cacheControl: "no-store" },
    );
  }

  const parts = normalizeCatchAllPath(context.params.path);
  if (parts.length === 0) {
    return htmlResponse(
      renderCollectionPage({
        title: "Explore free digital books",
        description: "Browse readable PDF and EPUB books available in E-Library.",
        canonical: `${SITE_ORIGIN}/books/`,
        books,
        jsonName: "E-Library books",
      }),
    );
  }

  if (parts[0] === "category" && parts[1]) {
    const categorySlug = slugify(parts[1], "uncategorized");
    const filtered = books.filter((book) => getCategorySlug(book) === categorySlug);
    if (!filtered.length) return htmlResponse(renderNotFound(), { status: 404, cacheControl: "public, max-age=60" });
    const label = uniqueBySlug(filtered, (book) => book.category)[0]?.label || "Books";
    return htmlResponse(
      renderCollectionPage({
        title: `${label} books`,
        description: `Read ${label} books online in E-Library, with PDF and EPUB formats where available.`,
        canonical: `${SITE_ORIGIN}/books/category/${categorySlug}/`,
        books: filtered,
      }),
    );
  }

  if (parts[0] === "language" && parts[1]) {
    const languageSlug = slugify(parts[1], "english");
    const filtered = books.filter((book) => getLanguageSlug(book) === languageSlug);
    if (!filtered.length) return htmlResponse(renderNotFound(), { status: 404, cacheControl: "public, max-age=60" });
    const label = getLanguage(filtered[0]);
    return htmlResponse(
      renderCollectionPage({
        title: `${label} books`,
        description: `Read ${label} books online in E-Library.`,
        canonical: `${SITE_ORIGIN}/books/language/${languageSlug}/`,
        books: filtered,
      }),
    );
  }

  const bookId = String(parts[0] || "").trim();
  const book = books.find((candidate) => String(candidate.id) === bookId);
  if (!book) return htmlResponse(renderNotFound(), { status: 404, cacheControl: "public, max-age=60" });

  const canonicalPath = getBookPath(book);
  const requestedPath = new URL(context.request.url).pathname;
  if (requestedPath !== canonicalPath) {
    return Response.redirect(`${SITE_ORIGIN}${canonicalPath}`, 301);
  }

  return htmlResponse(renderBookPage(book, books, context.env));
}
