# E-Library academic submission

## Student

- Name: Padam Kishore
- Enrollment number: 25CS003692
- Programme: B.Tech CSE (AI-ML)
- Semester: III
- University: Sir Padampat Singhania University
- Course: Web Development
- Submission date: 5 November 2026

## Google Form answers (copy and paste)

### Proposed Project Title

E-Library: A Smart Digital Library and Online Reading Platform

### Problem Statement

Students and readers often rely on scattered PDF/EPUB files, shared links and separate applications to locate and read learning materials. This makes it difficult to search resources, resume reading and maintain a consistent digital collection. Library administrators also need a reliable way to organize book metadata, control visibility and manage access. E-Library addresses these problems through a centralized, responsive web application that combines searchable book discovery, browser-based reading, secure sign-in and an administrator dashboard backed by a MySQL database.

### Objectives of the Project

1. Develop a responsive digital library accessible from desktop and mobile browsers.
2. Enable readers to search and browse books by title, author, category and format.
3. Provide integrated PDF and EPUB reading with navigation and saved reading progress.
4. Implement Google sign-in, authenticated sessions and role-based administrator access.
5. Support database-backed creation, viewing, updating and deletion of book records and bulk imports.
6. Demonstrate HTML5, CSS3, JavaScript, AJAX/JSON APIs, Node.js/Express, MySQL, React, Bootstrap and a supplementary PHP report tool.
7. Verify major workflows and maintain the source code and setup instructions on GitHub.

### Key Features and Functionalities

Searchable book catalogue; title, author, category and PDF/EPUB filters; paginated React catalogue with collection statistics and printable pages; book details and cover images; in-browser PDF and EPUB readers; signed-out previews and authenticated reading; saved reading progress; Google sign-in and session handling; role-protected administrator dashboard; book CRUD, bulk import and public/private visibility; administrator activity logs; supplementary PHP CSV catalogue export; existing AI-assisted reading tools; configurable premium access and Razorpay support/payment modules; responsive layouts, theme controls and SEO-friendly public book pages.

### Proposed Technologies (checkbox selection)

Select: **HTML, CSS, JavaScript, PHP, MySQL, Bootstrap, Node.js / Express.js, React**.

If you select **Other**, write: **AJAX/Fetch, JSON REST APIs, Git/GitHub, Google Identity Services, PDF.js, EPUB.js, Cloudflare Pages and Google Drive API**.

PHP is a supplementary command-line CSV report tool. The primary web backend is Node.js/Express. React and Bootstrap are used on the new catalogue page; the existing frontend continues to use HTML, CSS and JavaScript. The guideline permits PHP OR Node.js, and the form choices do not independently make every framework compulsory. All the requested named options now have a concrete role in this repository.

### Expected Outcome of the Project

A functional and responsive digital library that allows users to discover books, view book details and read PDF/EPUB resources in the browser, with secure authentication and administrator-controlled content management. The project will demonstrate client-server communication, MySQL CRUD operations, access control, responsive UI development, a React/Bootstrap catalogue and PHP-based CSV reporting. Source code, SQL schema, setup instructions, a proposal PDF and a GitHub repository will support demonstration and evaluation.

### Any Additional Information

This project extends my existing E-Library application through a small catalogue/report module while preserving the established library interface and reading workflow. The main stack is HTML5, CSS3, JavaScript, Node.js/Express and MySQL. React and Bootstrap power an additional searchable catalogue, and PHP provides a supplementary public-catalogue CSV exporter. Existing optional modules include AI-assisted reading, premium access and support payments. Repository: https://github.com/padam421/E-LIBRARY . Live library: https://e-library-c9t.pages.dev/ . Optional external integrations require the appropriate deployment credentials.

### Upload (Proposal in PDF)

Use `output/pdf/25CS003692_MiniProjectProposal.pdf` (maximum allowed: 10 MB).

The separate final report is `output/pdf/25CS003692_E-Library_ProjectReport.pdf`.
It includes architecture, an ER/database diagram, implementation screenshots,
validation results, conclusion and future enhancements.

### Student Declaration

Read the complete declaration in the real form, verify the information, and select its checkbox yourself when submitting. These notes do not submit the form or make the declaration on your behalf.

## Technology and course-concept evidence

| Requirement | Actual role / evidence |
| --- | --- |
| HTML5 | Semantic pages, forms, tables, reader and admin interfaces in `PDF-Library/frontend/` |
| CSS3 | Existing Flexbox/Grid, media queries and theme styles; new `assets/css/catalogue.css` |
| JavaScript | DOM/events, validation, reader controls and `assets/js/catalogue.js` |
| AJAX / JSON / API | Fetch requests to Express endpoints including `GET /api/pdfs` |
| Node.js / Express | Primary API, routes, middleware and controllers in `PDF-Library/backend/src/` |
| PHP | `PDF-Library/php/export-catalogue.php`: public JSON to spreadsheet-safe CSV |
| MySQL | Connection pooling, book CRUD and schema in `PDF-Library/sql/` |
| Authentication | Google verification, signed sessions, cookies, CSRF and role middleware |
| Bootstrap | Local Bootstrap 5.3.8 grid, forms, cards, buttons and responsive table on `catalogue.html` |
| React | React 18.3.1 state, effects and rendering on `catalogue.html` |
| Git / GitHub | Existing repository, scoped changes and CI checks |
| Testing | Backend/frontend syntax, PHP unit/HTTP tests and catalogue browser checks |
| Deployment / optimization | Existing Cloudflare Pages frontend, Express hosting, SEO metadata, caching and pagination |

## Run the additions

Run the existing backend/frontend as described in [SETUP.md](SETUP.md), then open
`http://127.0.0.1:5500/catalogue.html`. The homepage footer includes a Book Catalogue link.

The catalogue uses the existing `PDF_LIBRARY_CONFIG.API_ORIGIN` and the existing
public `GET /api/pdfs` endpoint. It adds no database migration and changes no login,
reader or payment routes. Only the catalogue loads the vendored React/Bootstrap files.

With PHP 8.1+ installed, generate a CSV from the public API:

```powershell
php PDF-Library/php/export-catalogue.php --api https://e-library-dtx4.onrender.com --output public-catalogue.csv
```

For offline evaluation, first save a public JSON array from `GET /api/pdfs`, then run:

```powershell
php PDF-Library/php/export-catalogue.php --input public-catalogue.json --output public-catalogue.csv
```

Output filenames must be new: existing files are never overwritten. The tool
exports only ID, title, author, category and format flags. It accepts no login
credentials and does not grant access to book files. Explicitly private rows in
local JSON input are skipped. When using a development API, set
`PUBLIC_INCLUDE_PRIVATE_BOOKS=false`: the existing development API can otherwise
include private rows without marking them in its public response.

The PHP tool runs locally or on a PHP-capable host. Cloudflare Pages serves the
static frontend; uploading this code does not deploy a PHP runtime to Pages.

## Verification

```powershell
cd PDF-Library/backend
npm run check
npm run check:secret-files
cd ../..
php -l PDF-Library/php/export-catalogue.php
php PDF-Library/php/tests/export-catalogue-test.php
node tests/catalogue-export-http.cjs
# Requires Playwright and a Chromium browser; set BROWSER_CHANNEL=msedge if appropriate.
node tests/catalogue.spec.cjs
```

PHP behaviour tests cover quoting, Unicode, spreadsheet formula escaping,
private-row exclusion, invalid data, safe output creation and CLI validation.
HTTP tests cover a successful API export, upstream errors, redirects and invalid JSON structure.
Browser checks use deterministic fixtures, including a malicious-looking title,
to exercise filters, pagination, links, escaped text, printing, mobile overflow,
API failure/retry, malformed response and empty states.

Read-only checks on 5 November 2026 found 128 books in the configured local
database and 130 in the deployed public API. These are separate snapshots, not
a guaranteed fixed collection size. Existing payment, OAuth and AI workflows
were inspected in code; no real purchase or full external sign-in was performed
as part of this update.

## Submission checklist from the supplied screenshots

- Project details/proposal deadline shown: 26 October 2026.
- Final submission deadline shown: 5 November 2026.
- Proposal PDF heading order: title; student details; problem statement;
  objectives; proposed solution; key features; technologies; expected outcomes;
  application of web development concepts; references.
- Final submission also asks for complete source, SQL schema where applicable,
  project report PDF, GitHub link, live URL where feasible, and demonstration/viva.
- The proposal is separate from the final report. The attached guidelines ask
  for architecture, ER/database design, implementation screenshots, testing,
  conclusion and future enhancements in the final report.
- No Google Form URL was supplied, so this task prepares answers and the PDF;
  it does not submit the Google Form.
