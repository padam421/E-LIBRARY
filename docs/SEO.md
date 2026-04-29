# SEO And Google Search Plan

This project includes the technical foundation for Google discovery, but no project can guarantee rank number one for every query. The practical goal is to make E-Library indexable, fast, useful, and trustworthy so it can rank for book titles, author names, categories, and eventually broader library searches.

## Files That Matter

| File or folder | Purpose |
| --- | --- |
| `PDF-Library/frontend/index.html` | Homepage metadata and structured data |
| `PDF-Library/frontend/books/` | Static book, category, and language pages |
| `PDF-Library/frontend/sitemap.xml` | Sitemap submitted to Google Search Console |
| `PDF-Library/frontend/robots.txt` | Crawl permission and sitemap location |
| `PDF-Library/frontend/_headers` | Noindex headers for private utility pages |
| `PDF-Library/frontend/assets/css/seo.css` | Styles for SEO pages |
| `PDF-Library/frontend/functions/` | Dynamic SEO implementation kept for future Cloudflare Function use |

## Search Console Workflow

1. Open Google Search Console.
2. Select the URL-prefix property:

```text
https://e-library-c9t.pages.dev/
```

3. Open `Sitemaps`.
4. Submit:

```text
sitemap.xml
```

5. Open `URL Inspection`.
6. Test the homepage.
7. Click `Request indexing`.
8. Test 3 to 5 important book pages.
9. Test one category page.
10. Test one language page.

## What To Do For Every New Book

Each public book should have:

- exact title
- author
- original description
- category
- language
- publication year if known
- cover image
- PDF/EPUB availability
- legal rights status
- clean SEO URL with id and slug

Good URL pattern:

```text
/books/{id}/{title-author-slug}/
```

Example:

```text
/books/1/captain-blood-rafael-sabatini/
```

## Description Quality

Write descriptions yourself. Do not copy long descriptions from other websites.

Recommended length:

```text
150 to 300 words
```

A good description should answer:

- What is the book about?
- Who wrote it?
- Why is it useful?
- Which readers should open it?
- What category/language does it belong to?

## What Helps Ranking

- Real indexable HTML pages.
- Clean internal links.
- Fast mobile experience.
- Useful original text.
- Accurate title and author metadata.
- Public category and language pages.
- A sitemap that Google can fetch.
- Links from real profiles and communities.

Free places to add the website:

- GitHub profile bio.
- GitHub repository README.
- LinkedIn Featured section.
- LinkedIn project post.
- College or student project groups.
- Email signature.
- Relevant open-source or reading communities where sharing is allowed.

## What Hurts Ranking

Avoid:

- fake backlinks
- copied descriptions
- keyword stuffing
- hidden text
- paid link schemes
- uploading copyrighted books without permission
- auto-generated low-quality pages
- many duplicate URLs for the same book

## Indexing Targets

Phase 1:

- exact book title searches
- exact author plus title searches
- `E-Library` branded searches

Phase 2:

- category searches, such as "free business books online"
- language searches, such as "English books PDF library"

Phase 3:

- broad searches such as "digital library"

Broad keywords are highly competitive and take time, links, content quality, and user trust.

## Maintenance Checklist

After adding books:

1. Generate or add static book pages.
2. Update `sitemap.xml`.
3. Deploy Cloudflare Pages.
4. Open the sitemap URL in the browser and confirm XML appears.
5. Submit or resubmit sitemap in Search Console.
6. Request indexing for important pages.
7. Monitor Search Console Performance after a few days.
