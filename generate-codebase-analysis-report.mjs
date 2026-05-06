import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve('C:/Users/Padam Kishore/Pictures/E-LIBRARY');
const projectRoot = path.join(repoRoot, 'PDF-Library');
const outputHtml = path.join(repoRoot, 'E-LIBRARY_Codebase_Deep_Analysis_Report.html');

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    }).trim();
  } catch (error) {
    return (error.stdout || '').toString().trim() || (error.stderr || '').toString().trim();
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'n/a';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function lineCountFor(filePath) {
  try {
    const text = readText(filePath);
    if (!text) return 0;
    return text.split(/\r?\n/).length;
  } catch {
    return null;
  }
}

function walkCount(targetPath) {
  if (!exists(targetPath)) return 0;
  let count = 0;
  const stack = [targetPath];
  while (stack.length) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
    } else {
      count += 1;
    }
  }
  return count;
}

function listTopLevelEntries(targetPath) {
  if (!exists(targetPath)) return [];
  return fs
    .readdirSync(targetPath, { withFileTypes: true })
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'folder' : 'file',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function p(text) {
  return `<p>${text}</p>`;
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

function table(headers, rows, className = '') {
  return `
    <table class="${className}">
      <thead>
        <tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`,
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function section(id, title, body) {
  return `<section id="${id}" class="report-section"><h2>${title}</h2>${body}</section>`;
}

function subsection(id, title, body) {
  return `<section id="${id}" class="report-subsection"><h3>${title}</h3>${body}</section>`;
}

function code(value) {
  return `<code>${escapeHtml(value)}</code>`;
}

const trackedFiles = run('git', ['ls-files'])
  .split(/\r?\n/)
  .filter(Boolean);

const remoteMainCommit = run('git', ['rev-parse', 'origin/main']);
const localMainCommit = run('git', ['rev-parse', 'HEAD']);
const gitRemote = run('git', ['remote', 'get-url', 'origin']);
const branchStatusBeforeDocs = 'Before this report was generated, git status showed: ## main...origin/main';
const mainHeadCommitShort = run('git', ['rev-parse', '--short', 'origin/main']);
const recentMainCommits = run('git', ['log', '--oneline', '-n', '10', 'origin/main']).split(/\r?\n/).filter(Boolean);
const updateBranchDiffStat = run('git', ['diff', '--shortstat', 'origin/main..origin/update-website']);
const today = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Calcutta',
}).format(new Date());

const importantFiles = new Set([
  'README.md',
  'SECURITY.md',
  'docs/ARCHITECTURE.md',
  'docs/DEPLOYMENT.md',
  'docs/SEO.md',
  'docs/SETUP.md',
  'PDF-Library/DEPLOYMENT.md',
  'PDF-Library/docs/r2-migration.md',
  'PDF-Library/backend/package.json',
  'PDF-Library/backend/src/server.js',
  'PDF-Library/backend/src/app.js',
  'PDF-Library/backend/src/config/db.js',
  'PDF-Library/backend/src/config/loadEnv.js',
  'PDF-Library/backend/src/config/validateEnv.js',
  'PDF-Library/backend/src/controllers/adminController.js',
  'PDF-Library/backend/src/controllers/adminPaymentController.js',
  'PDF-Library/backend/src/controllers/aiController.js',
  'PDF-Library/backend/src/controllers/authController.js',
  'PDF-Library/backend/src/controllers/paymentController.js',
  'PDF-Library/backend/src/controllers/pdfController.js',
  'PDF-Library/backend/src/controllers/supportController.js',
  'PDF-Library/backend/src/controllers/videoController.js',
  'PDF-Library/backend/src/models/pdfModel.js',
  'PDF-Library/backend/src/routes/adminRoutes.js',
  'PDF-Library/backend/src/routes/authRoutes.js',
  'PDF-Library/backend/src/routes/paymentRoutes.js',
  'PDF-Library/backend/src/routes/paymentWebhookRoutes.js',
  'PDF-Library/backend/src/routes/pdfRoutes.js',
  'PDF-Library/backend/src/services/bookStorage.js',
  'PDF-Library/backend/src/services/paymentService.js',
  'PDF-Library/backend/src/utils/sessionToken.js',
  'PDF-Library/frontend/index.html',
  'PDF-Library/frontend/book-detail.html',
  'PDF-Library/frontend/view-pdf.html',
  'PDF-Library/frontend/view-epub.html',
  'PDF-Library/frontend/admin-upload.html',
  'PDF-Library/frontend/support.html',
  'PDF-Library/frontend/assets/js/auth.js',
  'PDF-Library/frontend/assets/js/book-detail.js',
  'PDF-Library/frontend/assets/js/payments.js',
  'PDF-Library/frontend/assets/js/pdf-engine.js',
  'PDF-Library/frontend/assets/js/reader-controls.js',
  'PDF-Library/frontend/assets/js/epub-engine.js',
  'PDF-Library/frontend/assets/js/support.js',
  'PDF-Library/frontend/assets/js/ai-sidebar.js',
  'PDF-Library/frontend/assets/js/theme-toggle.js',
  'PDF-Library/frontend/functions/books/[[path]].js',
  'PDF-Library/frontend/functions/sitemap.xml.js',
  'PDF-Library/frontend/functions/_lib/seo.js',
  'PDF-Library/frontend/generate-sitemap.js',
  'PDF-Library/sql/001_schema.sql',
  'PDF-Library/sql/005_payments.sql',
  'PDF-Library/sql/006_support_contributions.sql',
]);

const representativeStaticPages = [
  'PDF-Library/frontend/books/index.html',
  'PDF-Library/frontend/books/category/fiction/index.html',
  'PDF-Library/frontend/books/language/english/index.html',
  'PDF-Library/frontend/books/1/captain-blood-rafael-sabatini/index.html',
];

function categoryForTrackedFile(file) {
  if (file.startsWith('.github/')) return 'Repository governance and CI';
  if (file === '.gitattributes' || file === '.gitignore' || file === 'README.md' || file === 'SECURITY.md') return 'Repository governance and CI';
  if (file.startsWith('docs/')) return 'Top-level documentation';
  if (file.startsWith('PDF-Library/backend/src/')) return 'Backend source';
  if (file.startsWith('PDF-Library/backend/scripts/')) return 'Backend scripts';
  if (file.startsWith('PDF-Library/backend/') && !file.startsWith('PDF-Library/backend/src/') && !file.startsWith('PDF-Library/backend/scripts/')) return 'Backend runtime and deployment';
  if (file.startsWith('PDF-Library/frontend/assets/js/')) return 'Frontend scripts';
  if (file.startsWith('PDF-Library/frontend/assets/css/')) return 'Frontend styles';
  if (file.startsWith('PDF-Library/frontend/assets/images/') || file === 'PDF-Library/frontend/favicon.png') return 'Frontend binary assets';
  if (file.startsWith('PDF-Library/frontend/functions/')) return 'Cloudflare SEO functions';
  if (file.startsWith('PDF-Library/frontend/books/')) return 'Generated static SEO pages';
  if (file.startsWith('PDF-Library/frontend/')) return 'Frontend pages and static config';
  if (file.startsWith('PDF-Library/sql/')) return 'Database schema and migrations';
  if (file.startsWith('PDF-Library/docs/')) return 'Project-local documentation';
  if (file.startsWith('PDF-Library/')) return 'Project root and deployment';
  return 'Other tracked files';
}

function fileTypeForTrackedFile(file) {
  if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.ico')) return 'Binary asset';
  if (file.endsWith('.xml') || file.endsWith('.txt') || file.endsWith('.html') || file.endsWith('.css') || file.endsWith('.js') || file.endsWith('.md') || file.endsWith('.sql') || file.endsWith('.yml') || file.endsWith('.yaml') || file.endsWith('.ps1')) return 'First-party text file';
  if (file.endsWith('.json')) return 'Manifest or generated lock file';
  return 'Project file';
}

function depthForTrackedFile(file) {
  if (importantFiles.has(file)) return 'Deep';
  if (file === 'PDF-Library/backend/package-lock.json') return 'Artifact';
  if (file.startsWith('PDF-Library/frontend/books/')) return 'Pattern';
  if (file.startsWith('.github/ISSUE_TEMPLATE/')) return 'Light';
  if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.ico')) return 'Light';
  return 'Grouped';
}

function purposeForTrackedFile(file) {
  const map = {
    '.gitattributes': 'Git line-ending and text/binary handling rules.',
    '.gitignore': 'Ignores secrets, dependencies, generated output, and local machine clutter.',
    'README.md': 'High-level public project explanation, live links, architecture summary, and setup hints.',
    'SECURITY.md': 'Security posture, secret handling rules, and production safety notes.',
    'docs/ARCHITECTURE.md': 'Human-written architecture explanation of the live system.',
    'docs/DEPLOYMENT.md': 'Cross-environment deployment guidance.',
    'docs/SEO.md': 'Search visibility strategy, sitemap, and metadata guidance.',
    'docs/SETUP.md': 'Local setup and onboarding notes.',
    'PDF-Library/.env.example': 'Example top-level environment variables used mainly for local project guidance.',
    'PDF-Library/.gcloudignore': 'Files excluded from Google Cloud style deployment uploads.',
    'PDF-Library/.gitignore': 'Project-local ignore rules for secrets, backups, dumps, and runtime artifacts.',
    'PDF-Library/DEPLOYMENT.md': 'Detailed operational runbook for this application specifically.',
    'PDF-Library/bootstrap.ps1': 'Older Windows bootstrap helper for local setup.',
    'PDF-Library/bootstrap_v2.ps1': 'Later variant of the Windows bootstrap helper.',
    'PDF-Library/docs/r2-migration.md': 'Storage migration notes from Google Drive-first behavior toward R2 support.',
    'PDF-Library/backend/.dockerignore': 'Excludes unnecessary files from Docker build context.',
    'PDF-Library/backend/.env.example': 'Detailed backend environment template and configuration reference.',
    'PDF-Library/backend/Dockerfile': 'Production container recipe for the backend API.',
    'PDF-Library/backend/package.json': 'Backend dependency list and operational scripts.',
    'PDF-Library/backend/package-lock.json': 'npm lock file that pins exact backend package versions.',
    'PDF-Library/backend/src/server.js': 'Backend process entrypoint that starts Express and handles top-level errors.',
    'PDF-Library/backend/src/app.js': 'Express app assembly: middleware, security, parsers, and route mounting.',
    'PDF-Library/backend/src/config/adminAccess.js': 'Owner-email based admin access helpers.',
    'PDF-Library/backend/src/config/db.js': 'MySQL pool creation, retry logic, and keepalive behavior.',
    'PDF-Library/backend/src/config/drive.js': 'Google Drive API client setup.',
    'PDF-Library/backend/src/config/firebase.js': 'Firebase Admin / Firestore bootstrap with optional startup behavior.',
    'PDF-Library/backend/src/config/loadEnv.js': 'Environment file loading with selective cloud fallback behavior.',
    'PDF-Library/backend/src/config/runtimeLimits.js': 'Numeric configuration readers for limits and defaults.',
    'PDF-Library/backend/src/config/validateEnv.js': 'Production-grade environment validation and warning logic.',
    'PDF-Library/backend/src/controllers/adminController.js': 'Admin CRUD and bulk operations for books plus cache invalidation.',
    'PDF-Library/backend/src/controllers/adminPaymentController.js': 'Owner-only payment settings and payment admin reporting logic.',
    'PDF-Library/backend/src/controllers/aiController.js': 'Gemini-backed reading assistant route logic and file extraction.',
    'PDF-Library/backend/src/controllers/authController.js': 'Google-login verification, session creation, and session restore.',
    'PDF-Library/backend/src/controllers/healthController.js': 'Health and warmup endpoints.',
    'PDF-Library/backend/src/controllers/paymentController.js': 'HTTP adapters around the payment service and webhook entrypoint.',
    'PDF-Library/backend/src/controllers/pdfController.js': 'Preview/full PDF and EPUB streaming plus access enforcement.',
    'PDF-Library/backend/src/controllers/supportController.js': 'Public support-page data and supporter media upload handling.',
    'PDF-Library/backend/src/controllers/videoController.js': 'Book trailer/video URL resolution and proxy streaming.',
    'PDF-Library/backend/src/middleware/errorHandler.js': 'Central API error formatter and logging fallback.',
    'PDF-Library/backend/src/middleware/rateLimiter.js': 'Simple in-memory IP-based rate limiting.',
    'PDF-Library/backend/src/middleware/requireAdmin.js': 'Admin session verification and request user attachment.',
    'PDF-Library/backend/src/middleware/requireCsrf.js': 'CSRF check for mutating admin requests.',
    'PDF-Library/backend/src/models/pdfModel.js': 'Raw MySQL queries for public book listing and asset lookup.',
    'PDF-Library/backend/src/routes/adminRoutes.js': 'Admin route map and middleware composition.',
    'PDF-Library/backend/src/routes/aiRoutes.js': 'AI route registration.',
    'PDF-Library/backend/src/routes/authRoutes.js': 'Session/login/logout route registration.',
    'PDF-Library/backend/src/routes/healthRoutes.js': 'Health route registration.',
    'PDF-Library/backend/src/routes/paymentRoutes.js': 'Checkout, access, and verification route registration.',
    'PDF-Library/backend/src/routes/paymentWebhookRoutes.js': 'Raw-body webhook route registration for Razorpay.',
    'PDF-Library/backend/src/routes/pdfRoutes.js': 'PDF and EPUB route registration.',
    'PDF-Library/backend/src/routes/supportRoutes.js': 'Support public-route registration.',
    'PDF-Library/backend/src/routes/videoRoutes.js': 'Video route registration.',
    'PDF-Library/backend/src/services/bookStorage.js': 'Storage abstraction for Drive, R2, GCS, and URL-based book assets.',
    'PDF-Library/backend/src/services/paymentService.js': 'Core payment, entitlement, support, schema-repair, and order-management logic.',
    'PDF-Library/backend/src/utils/googleToken.js': 'Google access-token verification helper.',
    'PDF-Library/backend/src/utils/sessionToken.js': 'Signed session token and CSRF token creation/verification.',
    'PDF-Library/frontend/index.html': 'Public library homepage shell.',
    'PDF-Library/frontend/book-detail.html': 'Dynamic detail page shell for one selected book.',
    'PDF-Library/frontend/view-pdf.html': 'PDF reading page shell with sign-in and premium gates.',
    'PDF-Library/frontend/view-epub.html': 'EPUB reading page shell with sign-in and premium gates.',
    'PDF-Library/frontend/admin-upload.html': 'Single-file admin portal UI.',
    'PDF-Library/frontend/support.html': 'Creator support and donation page.',
    'PDF-Library/frontend/about.html': 'About page for people and search engines.',
    'PDF-Library/frontend/how-to-use.html': 'Simple help page for readers.',
    'PDF-Library/frontend/best-free-books.html': 'SEO-supporting static landing page.',
    'PDF-Library/frontend/privacy.html': 'Privacy policy page.',
    'PDF-Library/frontend/terms.html': 'Terms and conditions page.',
    'PDF-Library/frontend/robots.txt': 'Crawler instructions.',
    'PDF-Library/frontend/sitemap.xml': 'Committed static sitemap snapshot.',
    'PDF-Library/frontend/ads.txt': 'Google AdSense publisher verification file.',
    'PDF-Library/frontend/_headers': 'Cloudflare Pages header rules, especially X-Robots-Tag and cache hints.',
    'PDF-Library/frontend/_redirects': 'Cloudflare redirect rules, including SEO-book URL remapping.',
    'PDF-Library/frontend/generate-sitemap.js': 'Utility that generates the committed static sitemap file.',
    'PDF-Library/frontend/assets/js/config.js': 'Public frontend configuration for API origin and Google client ID.',
    'PDF-Library/frontend/assets/js/auth.js': 'Main homepage app logic: fetch books, auth, search, history, and settings.',
    'PDF-Library/frontend/assets/js/book-detail.js': 'Book detail rendering and recommendations logic.',
    'PDF-Library/frontend/assets/js/payments.js': 'Frontend checkout helper around backend payment routes and Razorpay.',
    'PDF-Library/frontend/assets/js/pdf-engine.js': 'PDF reader engine and preview/full loading logic.',
    'PDF-Library/frontend/assets/js/reader-controls.js': 'Advanced PDF reading controls, notes, bookmarks, and highlights.',
    'PDF-Library/frontend/assets/js/epub-engine.js': 'Secure EPUB reader engine, rendering, search, and annotations.',
    'PDF-Library/frontend/assets/js/support.js': 'Support-page behavior, recording, and payment wiring.',
    'PDF-Library/frontend/assets/js/ai-sidebar.js': 'Context-aware AI sidebar injected across pages.',
    'PDF-Library/frontend/assets/js/theme-toggle.js': 'Per-user theme preference and toggle injection.',
    'PDF-Library/frontend/assets/js/ai-html.txt': 'Saved AI sidebar markup fragment used by the injected assistant UI.',
    'PDF-Library/frontend/assets/css/styles.css': 'Main homepage and shared layout stylesheet.',
    'PDF-Library/frontend/assets/css/book-detail.css': 'Book detail page styling.',
    'PDF-Library/frontend/assets/css/pdf-reader.css': 'PDF reader layout and controls styling.',
    'PDF-Library/frontend/assets/css/epub-reader.css': 'EPUB reader layout and controls styling.',
    'PDF-Library/frontend/assets/css/ai-sidebar.css': 'AI sidebar styling.',
    'PDF-Library/frontend/assets/css/theme-toggle.css': 'Homepage and shared theme switch styling.',
    'PDF-Library/frontend/assets/css/theme-toggle-detail.css': 'Theme switch detail-page styling.',
    'PDF-Library/frontend/assets/css/theme-toggle-reader.css': 'Theme switch reader-page styling.',
    'PDF-Library/frontend/assets/css/seo.css': 'Static SEO page styling.',
    'PDF-Library/frontend/assets/images/logo.png': 'Branding image for the website.',
    'PDF-Library/frontend/assets/images/padam-kishore-avatar.jpg': 'Small creator/support avatar asset.',
    'PDF-Library/frontend/assets/images/padam-kishore-profile.jpg': 'Larger creator profile asset for the support page.',
    'PDF-Library/frontend/functions/_lib/seo.js': 'Shared helpers for Cloudflare SEO pages and sitemap generation.',
    'PDF-Library/frontend/functions/_lib/seo-book-cache.js': 'Generated fallback book dataset for SEO rendering when API is unavailable.',
    'PDF-Library/frontend/functions/books/[[path]].js': 'Dynamic Cloudflare Function that renders SEO-ready book/category/language pages.',
    'PDF-Library/frontend/functions/sitemap.xml.js': 'Dynamic Cloudflare Function that produces sitemap XML.',
    'PDF-Library/sql/001_schema.sql': 'Fresh-database schema for users, books, and admin activity logs.',
    'PDF-Library/sql/003_repair_books_schema.sql': 'Repair migration for older book tables.',
    'PDF-Library/sql/004_admin_audit_log.sql': 'Audit-log focused migration for earlier databases.',
    'PDF-Library/sql/005_payments.sql': 'Payment tables for settings, orders, book rules, and entitlements.',
    'PDF-Library/sql/006_support_contributions.sql': 'Support-contribution extension on top of the payment schema.',
  };

  if (map[file]) return map[file];

  if (file.startsWith('.github/ISSUE_TEMPLATE/')) return 'GitHub issue template used for structured repository feedback.';
  if (file === '.github/pull_request_template.md') return 'GitHub pull request checklist and structure.';
  if (file === '.github/workflows/ci.yml') return 'Continuous integration workflow that checks syntax and secret safety.';
  if (file.startsWith('PDF-Library/backend/scripts/')) return 'Operational or migration helper script for local setup, env handling, or schema maintenance.';
  if (file.startsWith('PDF-Library/frontend/books/category/')) return 'Generated static SEO page for one public category.';
  if (file.startsWith('PDF-Library/frontend/books/language/')) return 'Generated static SEO page for one public language.';
  if (/^PDF-Library\/frontend\/books\/\d+\//.test(file)) return 'Generated static SEO page for one public book.';
  if (file === 'PDF-Library/frontend/books/index.html') return 'Generated static SEO landing page for the public catalog.';
  if (file.endsWith('.html') && file.startsWith('PDF-Library/frontend/')) return 'Frontend page shell that is completed by static markup plus JavaScript.';
  if (file.endsWith('.css') && file.startsWith('PDF-Library/frontend/assets/css/')) return 'First-party stylesheet for a page or shared UI surface.';
  if (file.endsWith('.js') && file.startsWith('PDF-Library/frontend/assets/js/')) return 'First-party browser JavaScript module.';
  if (file.endsWith('.js') && file.startsWith('PDF-Library/backend/src/')) return 'First-party backend JavaScript module.';
  if (file.endsWith('.sql') && file.startsWith('PDF-Library/sql/')) return 'MySQL schema or migration file.';
  return 'Tracked project file.';
}

function whyDepthForTrackedFile(file) {
  if (importantFiles.has(file)) return 'This file directly controls live application behavior and is explained in depth later in the report.';
  if (file === 'PDF-Library/backend/package-lock.json') return 'This is a dependency pinning artifact. It matters operationally, but it does not contain handwritten business logic.';
  if (file.startsWith('PDF-Library/frontend/books/')) return 'These files are generated or template-shaped SEO pages. I inspected representative examples and the generator logic instead of repeating the same deep explanation for each copy.';
  if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.ico')) return 'This is a binary asset. Its purpose is documented, but there is no source code to reverse engineer line by line.';
  if (file.startsWith('.github/ISSUE_TEMPLATE/')) return 'This supports repository workflow, not runtime behavior.';
  return 'This file is covered as part of its directory group and linked feature.';
}

const trackedRows = trackedFiles.map((file) => {
  const fullPath = path.join(repoRoot, file);
  const stat = exists(fullPath) ? fs.statSync(fullPath) : null;
  return {
    file,
    category: categoryForTrackedFile(file),
    type: fileTypeForTrackedFile(file),
    depth: depthForTrackedFile(file),
    purpose: purposeForTrackedFile(file),
    whyDepth: whyDepthForTrackedFile(file),
    size: stat ? formatBytes(stat.size) : 'n/a',
    lines: stat && stat.isFile() ? lineCountFor(fullPath) : null,
  };
});

const categoryOrder = [
  'Repository governance and CI',
  'Top-level documentation',
  'Project root and deployment',
  'Project-local documentation',
  'Backend runtime and deployment',
  'Backend scripts',
  'Backend source',
  'Frontend pages and static config',
  'Frontend scripts',
  'Frontend styles',
  'Frontend binary assets',
  'Cloudflare SEO functions',
  'Generated static SEO pages',
  'Database schema and migrations',
  'Other tracked files',
];

const groupedTrackedRows = categoryOrder
  .map((category) => ({
    category,
    rows: trackedRows.filter((row) => row.category === category),
  }))
  .filter((group) => group.rows.length);

const categorySummaryRows = groupedTrackedRows.map((group) => [
  escapeHtml(group.category),
  String(group.rows.length),
  String(group.rows.filter((row) => row.depth === 'Deep').length),
  String(group.rows.filter((row) => row.depth === 'Pattern').length),
  String(group.rows.filter((row) => row.depth === 'Artifact').length),
]);

const localArtifacts = [
  {
    path: '.git/',
    kind: 'Git metadata',
    details: 'Repository internals such as objects, refs, index, and local metadata.',
    count: walkCount(path.join(repoRoot, '.git')),
    note: 'Important for version control, but not part of the website runtime logic.',
  },
  {
    path: '.vscode/',
    kind: 'Editor settings',
    details: 'Local IDE/workspace preferences.',
    count: walkCount(path.join(repoRoot, '.vscode')),
    note: 'Useful for the local machine only, not part of production behavior.',
  },
  {
    path: 'Website_Code_Analysis_Report.html',
    kind: 'Older generated documentation artifact',
    details: 'A pre-existing analysis HTML file found at the repository root.',
    count: exists(path.join(repoRoot, 'Website_Code_Analysis_Report.html')) ? 1 : 0,
    note: 'Mentioned because it exists locally, but it is not part of the application code path.',
  },
  {
    path: 'PDF-Library/backend/node_modules/',
    kind: 'Third-party dependency tree',
    details: 'Installed npm packages used by the backend.',
    count: walkCount(path.join(projectRoot, 'backend', 'node_modules')),
    note: 'I inventoried this as a dependency artifact only. It is too large and third-party to justify line-by-line reverse engineering here.',
  },
  {
    path: 'PDF-Library/db-backups/',
    kind: 'Runtime data snapshots',
    details: 'SQL database export files used as backups and evidence of live data shape.',
    count: walkCount(path.join(projectRoot, 'db-backups')),
    note: 'These are historical data dumps, not the canonical source code. I used them to confirm live schema usage, not as primary implementation files.',
  },
  {
    path: 'PDF-Library/backend/logs/',
    kind: 'Runtime logs',
    details: 'Local backend log output directory.',
    count: walkCount(path.join(projectRoot, 'backend', 'logs')),
    note: 'Operational artifact only.',
  },
  {
    path: 'PDF-Library-Backup-20260403_080307/',
    kind: 'Historical full project backup',
    details: 'A snapshot copy with backend, deploy, frontend, sql, and its own dependency tree.',
    count: walkCount(path.join(repoRoot, 'PDF-Library-Backup-20260403_080307')),
    note: 'Important to mention because it can confuse maintainers, but it is not the live tracked source tree.',
  },
  {
    path: 'PDF-Library-Backup-PreThemeToggle/',
    kind: 'Earlier website snapshot',
    details: 'A smaller older backup from before theme toggle changes.',
    count: walkCount(path.join(repoRoot, 'PDF-Library-Backup-PreThemeToggle')),
    note: 'Historical artifact only; useful for archaeology, not for describing current live behavior.',
  },
];

const topLevelEntries = listTopLevelEntries(repoRoot).map((entry) => [
  escapeHtml(entry.name),
  escapeHtml(entry.type),
]);

const majorLineCounts = Object.fromEntries(
  [
    'PDF-Library/backend/src/app.js',
    'PDF-Library/backend/src/controllers/adminController.js',
    'PDF-Library/backend/src/controllers/aiController.js',
    'PDF-Library/backend/src/controllers/pdfController.js',
    'PDF-Library/backend/src/models/pdfModel.js',
    'PDF-Library/backend/src/services/paymentService.js',
    'PDF-Library/frontend/admin-upload.html',
    'PDF-Library/frontend/index.html',
    'PDF-Library/frontend/view-pdf.html',
    'PDF-Library/frontend/view-epub.html',
    'PDF-Library/frontend/assets/js/auth.js',
    'PDF-Library/frontend/assets/js/book-detail.js',
    'PDF-Library/frontend/assets/js/ai-sidebar.js',
    'PDF-Library/frontend/assets/js/pdf-engine.js',
    'PDF-Library/frontend/assets/js/reader-controls.js',
    'PDF-Library/frontend/assets/js/epub-engine.js',
    'PDF-Library/frontend/assets/js/support.js',
    'PDF-Library/frontend/assets/css/styles.css',
  ].map((file) => [file, lineCountFor(path.join(repoRoot, file))]),
);

const inventoryTablesHtml = groupedTrackedRows
  .map((group) => {
    const rows = group.rows
      .sort((a, b) => a.file.localeCompare(b.file))
      .map((row) => [
        `<span class="path">${escapeHtml(row.file)}</span>`,
        escapeHtml(row.type),
        escapeHtml(row.depth),
        escapeHtml(row.purpose),
        escapeHtml(row.whyDepth),
      ]);
    return subsection(
      `inventory-${slugify(group.category)}`,
      group.category,
      table(['Path', 'Type', 'Depth', 'Purpose', 'Why this level of analysis'], rows, 'inventory-table'),
    );
  })
  .join('');

const architectureBoxes = `
  <div class="flow-grid">
    <div class="flow-card"><strong>Browser / Googlebot</strong><span>Users and search crawlers start here.</span></div>
    <div class="flow-arrow">→</div>
    <div class="flow-card"><strong>Cloudflare Pages frontend</strong><span>Static HTML, CSS, JavaScript, SEO pages, and page rules.</span></div>
    <div class="flow-arrow">→</div>
    <div class="flow-card"><strong>Render backend API</strong><span>Express routes, auth, payments, previews, AI, and admin APIs.</span></div>
    <div class="flow-arrow">→</div>
    <div class="flow-card"><strong>MySQL database</strong><span>Books, users, payments, entitlements, and audit records.</span></div>
  </div>
  <div class="flow-grid secondary">
    <div class="flow-card"><strong>Google Drive</strong><span>PDF, EPUB, cover, video, and supporter media asset storage.</span></div>
    <div class="flow-card"><strong>Firebase / Firestore</strong><span>Optional user sync layer.</span></div>
    <div class="flow-card"><strong>Gemini API</strong><span>AI reading assistant backend dependency.</span></div>
    <div class="flow-card"><strong>Razorpay</strong><span>Orders, checkout signatures, and webhook confirmation.</span></div>
  </div>
`;

function renderBlockTable(rows) {
  return table(
    ['Block or section', 'What it does in plain English', 'Why it lives there'],
    rows.map((row) => row.map((cell) => escapeHtml(cell))),
    'block-table',
  );
}

const importantFileBreakdowns = {
  'Frontend: index.html': renderBlockTable([
    ['Head metadata and scripts', 'Sets SEO tags, AdSense, Search Console verification, JSON-LD, and loads the main frontend modules.', 'The homepage is the public front door, so discoverability and bootstrap assets need to be declared here.'],
    ['Header and navigation shell', 'Creates the visible top bar, sidebar trigger, sign-in area, and premium/profile controls.', 'This file owns the page skeleton that auth.js later fills with live data.'],
    ['Mega menu and category/training sections', 'Creates containers for curated rows and the richer browsing menu.', 'The homepage is both a landing page and a browsing surface, so the structural placeholders live in markup.'],
    ['Continue reading, history, settings, and search modal containers', 'Defines the spaces that JavaScript turns into stateful UI surfaces.', 'Keeping these shells in HTML lets JavaScript focus on data and behavior instead of building the whole page from scratch.'],
    ['Footer and support/legal links', 'Connects readers to support, informational pages, and policies.', 'This is the public brand layer and trust layer of the site.'],
  ]),
  'Frontend: auth.js': renderBlockTable([
    ['Config and key definitions', 'Defines API origin resolution and all localStorage keys.', 'This file is the true browser-side state hub, so it centralizes naming and storage conventions.'],
    ['Session restore and Google sign-in flow', 'Restores existing login state and exchanges Google tokens with the backend.', 'The homepage needs to feel persistent across reloads, and this is where browser identity state is managed.'],
    ['Library fetch and normalization', 'Calls the public books API, cleans results, and caches them for rendering.', 'Every major homepage feature depends on the shared public library dataset.'],
    ['Homepage row rendering', 'Builds card rows such as trending, fiction, and continue reading.', 'This is the main presentation logic for the library discovery experience.'],
    ['Search, history, my list, and settings panels', 'Manages user-facing utility surfaces and per-user saved preferences.', 'These features are highly personalized, so they are grouped in the same browser state module.'],
    ['Global helper exports', 'Exposes a few functions on window for other scripts to reuse.', 'This project uses browser globals instead of a bundler/module framework, so shared functions are published this way.'],
  ]),
  'Frontend: view-pdf.html + pdf-engine.js + reader-controls.js': renderBlockTable([
    ['Reader shell and access gate', 'The HTML page sets up the reader layout, sign-in gate, and premium notice areas.', 'The page needs a stable frame before JavaScript can load the document.'],
    ['Document source resolution', 'The engine decides whether to use book-ID routes or legacy raw Drive routes and whether preview or full access is allowed.', 'Access control depends on both the current book and the current session.'],
    ['Page rendering pipeline', 'PDF pages are rendered to canvas, text layers, and highlight layers with lazy loading.', 'This file owns the heavy document-viewing behavior, so performance-critical rendering lives here.'],
    ['Reader state events', 'The engine publishes current page, total pages, preview/full status, and search data.', 'Reader controls need a shared state source without a frontend framework.'],
    ['Advanced reading tools', 'Reader-controls adds bookmarks, notes, highlights, themes, search, and layout preferences.', 'These are higher-level user tools that should sit above the low-level rendering engine.'],
    ['Progress persistence', 'Progress is stored locally and fed back into continue-reading UI on the homepage.', 'The product wants a personal reading journey across pages, not isolated reader screens.'],
  ]),
  'Frontend: view-epub.html + epub-engine.js': renderBlockTable([
    ['Reader shell', 'Creates the EPUB interface panels, search areas, and sign-in/premium gates.', 'The shell matches the EPUB-specific interaction model, which is different from PDF.'],
    ['EPUB unzip and parsing', 'The engine opens the EPUB archive, reads the OPF manifest/spine, and prepares chapter navigation.', 'EPUB is a packaged book format, so parsing logic must exist before rendering can happen.'],
    ['Sanitization layer', 'Removes unsafe tags, dangerous URLs, and layout patterns that could break the reader.', 'This is a security boundary because EPUB content can include HTML and CSS from outside sources.'],
    ['Shadow DOM chapter rendering', 'Displays reflowable content with controlled styling and theme application.', 'EPUB reading needs flexible text layout rather than fixed page images.'],
    ['Annotations and search', 'Tracks bookmarks, notes, highlights, and text search across chapter content.', 'These are core reading-product features that make EPUB use practical.'],
  ]),
  'Frontend: admin-upload.html': renderBlockTable([
    ['Inline CSS and dashboard layout', 'Defines the entire admin portal appearance inside one file.', 'This page is a self-contained tool rather than a reusable public-facing app.'],
    ['Google sign-in and session bootstrap', 'Handles admin authentication, CSRF token storage, and role-based gating.', 'The admin tool needs secure identity before any data loading happens.'],
    ['Book CRUD forms', 'Lets admins add, edit, delete, and bulk import books.', 'Book management is the central operational responsibility of the portal.'],
    ['Payment admin panels', 'Lets the owner change payment settings, book premium rules, and see orders.', 'Premium access and monetization decisions are controlled here.'],
    ['Admin permissions and activity logs', 'Shows who has admin access and what admin actions have been recorded.', 'This supports governance and accountability.'],
    ['Health panel', 'Checks backend health and basic connectivity from the admin interface.', 'Operational confidence matters when the site runs on multiple hosted services.'],
  ]),
  'Frontend: support.html + support.js + payments.js': renderBlockTable([
    ['Public support page shell', 'Shows creator identity, amount selection, recent supporters, and media options.', 'Support is a separate business/user journey from book reading.'],
    ['Payment bootstrap', 'payments.js talks to backend payment routes and loads Razorpay only when needed.', 'Secrets must stay on the backend, so the frontend acts only as a safe checkout initiator.'],
    ['Support contribution flow', 'support.js validates amount and profile input, starts checkout, and optionally uploads media after payment.', 'Support has extra behavior that normal book premium checkout does not need.'],
    ['Currency estimate and recording tools', 'The page shows friendly local currency estimates and allows short audio/video messages.', 'This makes the support flow feel more personal and global.'],
  ]),
  'Backend: app.js + server.js': renderBlockTable([
    ['Environment load and validation', 'Loads .env values and checks that production config is safe enough to run.', 'The backend should fail early if secrets or URLs are misconfigured.'],
    ['Express and proxy setup', 'Creates the app, trusts proxy headers, and prepares request parsing.', 'Hosted deployments behind proxies need correct client-IP and protocol behavior.'],
    ['CORS and security headers', 'Allows only intended frontend origins and sets basic browser hardening headers.', 'The API must be reachable from the frontend but not open in a careless way.'],
    ['Raw webhook route before JSON parser', 'Mounts the Razorpay webhook endpoint before body parsing changes the request body.', 'Webhook signature checks need the original raw body bytes.'],
    ['Route mounting and global error handler', 'Connects all feature routes to the app and catches failures consistently.', 'This file is the central composition root of the API.'],
  ]),
  'Backend: authController.js + sessionToken.js + requireAdmin.js': renderBlockTable([
    ['Google token verification', 'Checks Google-issued access tokens against Google endpoints before trusting the identity.', 'The site uses Google as the identity provider, so backend trust starts here.'],
    ['User upsert', 'Creates or updates a MySQL user record during login.', 'The app needs its own local user row for roles, entitlements, and audit history.'],
    ['Custom signed session token', 'Creates an HMAC-signed token instead of using a JWT library.', 'This keeps the session format simple and fully controlled by project code.'],
    ['Cookie and bearer fallback', 'Supports httpOnly cookie sessions and stored bearer tokens for browser fetches.', 'The project mixes page loads, API calls, and reader fetches, so it needs flexible transport.'],
    ['Admin role enforcement', 'Checks the session, loads the user record, and confirms admin privileges before protected routes run.', 'Admin actions must be blocked before controller logic starts.'],
    ['CSRF token pairing', 'Requires a request header derived from the signed session token for write operations.', 'This reduces the chance of a forged browser request mutating admin data.'],
  ]),
  'Backend: pdfController.js + pdfModel.js + bookStorage.js': renderBlockTable([
    ['Public book listing and caching', 'The model fetches the visible catalog and caches it briefly.', 'The homepage and SEO layers repeatedly ask for the same library data.'],
    ['Asset lookup by book ID', 'The model resolves the correct PDF, EPUB, cover, or video source for a book.', 'The frontend mostly works by book ID, so the backend needs an abstraction over storage details.'],
    ['Preview generation', 'Creates limited-page PDF previews and shortened EPUB previews.', 'The site offers reading before purchase or sign-in, but not full unrestricted access.'],
    ['Premium enforcement', 'Full file streams check payment and entitlement state before sending the asset.', 'Protected reading is one of the core product boundaries.'],
    ['Storage abstraction', 'bookStorage.js normalizes Drive, R2, GCS, and URL-based asset references.', 'This isolates storage-migration complexity away from controllers.'],
    ['Cover and video delivery', 'The backend redirects or proxies media so the frontend stays simple.', 'This gives the UI one stable API shape even if storage changes underneath.'],
  ]),
  'Backend: paymentService.js + paymentController.js': renderBlockTable([
    ['Schema self-repair helpers', 'Checks whether payment/support tables exist and creates or patches them if needed.', 'The project evolved over time and needs to survive older databases.'],
    ['Public payment config', 'Returns only safe frontend-facing settings such as the public Razorpay key and enabled flags.', 'Secrets must never cross into browser code.'],
    ['Order creation', 'Builds Razorpay orders for site premium, book purchases, and support contributions.', 'All money-related calculations and receipts belong on the trusted backend.'],
    ['Signature and webhook verification', 'Validates payment responses from the browser and server-to-server webhooks with HMAC.', 'This is the proof step that a payment is genuine.'],
    ['Entitlement granting', 'Creates or extends access rows after a valid payment.', 'Payments only matter if they translate into actual reading rights.'],
    ['Support contribution records', 'Stores supporter name, message, optional media token, and public display status.', 'Support has its own data model and display requirements separate from reading entitlements.'],
  ]),
  'Backend: aiController.js': renderBlockTable([
    ['System instruction and website context', 'Builds a reading-assistant prompt using current page, book, and library context.', 'The assistant is meant to help inside this website, not act like a generic chatbot.'],
    ['Attachment extraction', 'Reads text from files, parses PDFs, and runs OCR on images when needed.', 'Readers may ask questions about uploaded material, so the AI route prepares machine-readable text.'],
    ['Model fallback and cooldown logic', 'Cycles through Gemini models and keys if one is unavailable or rate-limited.', 'Free or unstable AI APIs need resilience to keep the feature usable.'],
    ['Safe error surface', 'Returns a soft public failure message instead of exposing internal backend or provider details.', 'The UI should not leak technical errors to normal readers.'],
  ]),
  'Cloudflare SEO layer: seo.js + [[path]].js + sitemap.xml.js': renderBlockTable([
    ['Shared SEO helpers', 'Normalizes titles, descriptions, categories, cover URLs, and book fetching.', 'SEO pages and sitemaps need consistent metadata rules.'],
    ['Dynamic SEO page renderer', 'Produces indexable HTML for books, categories, and language pages.', 'Search engines prefer direct HTML, not a JavaScript-heavy library page.'],
    ['Static fallback cache', 'Uses a generated book cache if the API is unavailable.', 'This protects SEO rendering from backend outages.'],
    ['Sitemap generation', 'Outputs XML entries for public pages and book/category/language URLs.', 'Search engines need a reliable index of crawlable pages.'],
  ]),
};

const pageMapTable = table(
  ['Frontend surface', 'Purpose', 'Main files'],
  [
    ['Homepage', 'Public browsing, discovery, search, history, profile, and general library landing experience.', `${code('PDF-Library/frontend/index.html')} + ${code('PDF-Library/frontend/assets/js/auth.js')}`],
    ['Book detail page', 'Shows one book, metadata, formats, recommendations, and entry into readers.', `${code('book-detail.html')} + ${code('book-detail.js')}`],
    ['PDF reader', 'Preview/full PDF reading and advanced PDF controls.', `${code('view-pdf.html')} + ${code('pdf-engine.js')} + ${code('reader-controls.js')}`],
    ['EPUB reader', 'Preview/full EPUB reading with reflowable text and annotation tools.', `${code('view-epub.html')} + ${code('epub-engine.js')}`],
    ['Support page', 'Donation/support checkout plus optional audio/video message upload.', `${code('support.html')} + ${code('support.js')} + ${code('payments.js')}`],
    ['Admin portal', 'Book management, payment settings, audit, and admin control panel.', `${code('admin-upload.html')}`],
    ['Static informational pages', 'Explain the project, reading instructions, legal terms, and privacy.', `${code('about.html')}, ${code('how-to-use.html')}, ${code('privacy.html')}, ${code('terms.html')}`],
  ],
  'compact-table',
);

const routeMapTable = table(
  ['API area', 'Mounted base path', 'Files', 'What the area controls'],
  [
    ['Health', code('/api/health'), `${code('healthRoutes.js')} + ${code('healthController.js')}`, 'Simple liveness, DB checks, and warmup behavior.'],
    ['Auth', code('/api/auth'), `${code('authRoutes.js')} + ${code('authController.js')}`, 'Google login, session restore, and logout.'],
    ['Books / readers', code('/api/pdfs'), `${code('pdfRoutes.js')} + ${code('pdfController.js')} + ${code('pdfModel.js')}`, 'Public catalog, previews, and protected full-file reading.'],
    ['Videos', code('/api/video'), `${code('videoRoutes.js')} + ${code('videoController.js')}`, 'Trailer and preview-video fetching/streaming.'],
    ['Admin', code('/api/admin'), `${code('adminRoutes.js')} + ${code('adminController.js')} + ${code('adminPaymentController.js')}`, 'Book CRUD, bulk import, admin users, audit logs, and owner-only payment admin actions.'],
    ['Payments', code('/api/payments'), `${code('paymentRoutes.js')} + ${code('paymentController.js')} + ${code('paymentService.js')}`, 'Access checks, order creation, payment verification, and public payment config.'],
    ['Webhook', code('/api/payments/webhook'), `${code('paymentWebhookRoutes.js')} + ${code('paymentController.js')}`, 'Raw Razorpay webhook confirmation.'],
    ['Support', code('/api/support'), `${code('supportRoutes.js')} + ${code('supportController.js')} + ${code('paymentService.js')}`, 'Support-page config, public supporter feed, and support-media upload.'],
    ['AI', code('/api/ai'), `${code('aiRoutes.js')} + ${code('aiController.js')}`, 'Context-aware reader assistant.'],
  ],
  'compact-table',
);

const dbTableSummary = table(
  ['Table', 'Why it exists', 'Important fields', 'Main code touchpoints'],
  [
    ['users', 'Stores local identity rows for Google-authenticated people.', 'email, name, profile_picture, role, last_login', `${code('authController.js')}, ${code('requireAdmin.js')}, ${code('paymentService.js')}`],
    ['books_data', 'Stores all book metadata and asset references.', 'title, author, category, poster/cover/video/pdf/epub IDs, storage_provider, is_private', `${code('adminController.js')}, ${code('pdfModel.js')}, ${code('pdfController.js')}`],
    ['admin_activity_logs', 'Records sensitive admin actions for traceability.', 'actor_email, action, target_type, details_json, created_at', `${code('adminController.js')}, ${code('adminPaymentController.js')}`],
    ['payment_settings', 'Stores global payment switches and price defaults.', 'payments_enabled, site_premium_enabled, monthly_price_paise, annual_price_paise, preview_page_limit', `${code('paymentService.js')}, ${code('adminPaymentController.js')}`],
    ['book_premium_rules', 'Overrides premium behavior for specific books.', 'book_id, is_premium, price_paise, access_duration_days', `${code('paymentService.js')}, ${code('adminPaymentController.js')}`],
    ['payment_orders', 'Stores every created payment attempt and its final status.', 'scope, plan_key, book_id, amount_paise, gateway_order_id, status, paid_at', `${code('paymentService.js')}, ${code('paymentController.js')}`],
    ['user_entitlements', 'Stores granted access rights after successful payments.', 'user_email, scope, book_id, starts_at, expires_at, status', `${code('paymentService.js')}, ${code('pdfController.js')}`],
    ['support_contributions', 'Stores support messages, supporter identity, media token hash, and public display state.', 'order_id, supporter_name, message, amount_paise, upload_token_hash, media_drive_id, status', `${code('paymentService.js')}, ${code('supportController.js')}`],
  ],
  'compact-table',
);

const featureTable = table(
  ['Feature', 'What the user sees', 'How it works under the hood', 'Main files'],
  [
    ['Public library browsing', 'Rows of books, search, and categories on the homepage.', 'Frontend fetches public book data from the API, groups it into curated rows, and renders cards with cover URLs provided by the backend.', `${code('index.html')}, ${code('auth.js')}, ${code('pdfModel.js')}`],
    ['Book detail experience', 'Poster, metadata, video preview, format selector, and recommendations.', 'The detail script loads the book from the shared catalog data and builds a richer single-book presentation.', `${code('book-detail.html')}, ${code('book-detail.js')}`],
    ['PDF reading', 'In-browser PDF preview/full reader with tools.', 'Backend creates preview/full stream URLs; the browser renders pages with PDF.js and stores progress locally.', `${code('view-pdf.html')}, ${code('pdf-engine.js')}, ${code('reader-controls.js')}, ${code('pdfController.js')}`],
    ['EPUB reading', 'In-browser EPUB preview/full reader with reflowable text.', 'Backend sends EPUB files; frontend unzips, sanitizes, parses, and renders chapters.', `${code('view-epub.html')}, ${code('epub-engine.js')}, ${code('pdfController.js')}`],
    ['Google sign-in', 'Readers can sign in with Google and stay recognized.', 'Frontend obtains a Google token and backend verifies it before issuing a signed session.', `${code('auth.js')}, ${code('authController.js')}, ${code('googleToken.js')}, ${code('sessionToken.js')}`],
    ['Admin book management', 'Owner/admin can add, edit, import, hide, and delete books.', 'Admin portal calls protected routes; controller writes MySQL rows and logs activity.', `${code('admin-upload.html')}, ${code('adminRoutes.js')}, ${code('adminController.js')}`],
    ['Premium access', 'Some books or the whole site can require payment.', 'Payment settings and per-book rules decide whether preview-only or full access is allowed.', `${code('payments.js')}, ${code('paymentService.js')}, ${code('pdfController.js')}`],
    ['Support contributions', 'Support page with checkout and optional media message.', 'Backend creates a support order, verifies payment, saves contribution data, and accepts media only after payment.', `${code('support.html')}, ${code('support.js')}, ${code('paymentService.js')}`],
    ['AI reading assistant', 'Sidebar answers questions about the current page, book, or uploaded file.', 'Frontend sends prompt, context, and optional files; backend builds a Gemini request with fallback logic.', `${code('ai-sidebar.js')}, ${code('aiController.js')}`],
    ['SEO book pages', 'Search engines see clean book/category/language URLs.', 'Cloudflare Function and committed static pages produce indexable HTML and sitemap entries.', `${code('frontend/functions/books/[[path]].js')}, ${code('frontend/books/...')}, ${code('sitemap.xml')}`],
  ],
  'compact-table',
);

const maintenanceTable = table(
  ['If I want to change...', 'Where to start', 'Why that is the right place'],
  [
    ['Homepage content or row layout', `${code('PDF-Library/frontend/index.html')} and ${code('PDF-Library/frontend/assets/js/auth.js')}`, 'The HTML defines the homepage shell and auth.js decides what data appears in which rows.'],
    ['Navbar, sidebar, footer, or public-site structure', `${code('index.html')} plus shared homepage CSS in ${code('assets/css/styles.css')}`, 'These files contain the main visible layout containers and styling.'],
    ['Book detail page behavior', `${code('book-detail.html')} and ${code('book-detail.js')}`, 'That pair owns the detail-page skeleton, metadata rendering, and read-button flow.'],
    ['PDF reader tools', `${code('view-pdf.html')}, ${code('pdf-engine.js')}, ${code('reader-controls.js')}`, 'The page shell, rendering engine, and advanced controls are split across these files.'],
    ['EPUB reader tools', `${code('view-epub.html')} and ${code('epub-engine.js')}`, 'All EPUB-specific rendering and reader features live there.'],
    ['Support page wording or support flow', `${code('support.html')}, ${code('support.js')}, ${code('backend/src/controllers/supportController.js')}, ${code('backend/src/services/paymentService.js')}`, 'Frontend copy lives in the page; checkout and persistence live on the backend.'],
    ['Admin portal behavior', `${code('admin-upload.html')} plus ${code('backend/src/routes/adminRoutes.js')}, ${code('backend/src/controllers/adminController.js')}, ${code('backend/src/controllers/adminPaymentController.js')}`, 'The admin UI is a single-file frontend backed by protected Express controllers.'],
    ['Payment prices or rules', `${code('backend/src/services/paymentService.js')} and owner settings routes in ${code('adminPaymentController.js')}`, 'This service calculates orders and access decisions; the admin controller exposes the settings UI.'],
    ['Database structure', `${code('PDF-Library/sql/001_schema.sql')}, ${code('005_payments.sql')}, ${code('006_support_contributions.sql')}, and any matching raw queries in ${code('pdfModel.js')} / ${code('paymentService.js')}`, 'Schema changes must stay synchronized with the code that reads and writes those columns.'],
    ['Authentication logic', `${code('backend/src/controllers/authController.js')}, ${code('backend/src/utils/googleToken.js')}, ${code('backend/src/utils/sessionToken.js')}, ${code('backend/src/middleware/requireAdmin.js')}`, 'These files together define trust, session format, and role enforcement.'],
    ['Form validation or admin request security', `${code('admin-upload.html')}, ${code('backend/src/middleware/requireCsrf.js')}, and the relevant controller`, 'The admin page shapes requests, while the backend validates permissions and CSRF.'],
    ['SEO meta tags and public search appearance', `${code('frontend/index.html')}, ${code('frontend/about.html')}, ${code('frontend/how-to-use.html')}, ${code('frontend/functions/_lib/seo.js')}, ${code('frontend/functions/books/[[path]].js')}, ${code('frontend/robots.txt')}, ${code('frontend/sitemap.xml')}`, 'Metadata is split between static pages and the dynamic SEO renderer.'],
    ['Google integrations', `${code('frontend/assets/js/config.js')}, ${code('backend/src/config/drive.js')}, ${code('backend/src/config/firebase.js')}, ${code('backend/src/utils/googleToken.js')}, ${code('backend/src/controllers/aiController.js')}`, 'Each Google service has its own integration point: identity, Drive, Firebase, and Gemini.'],
    ['API endpoints or business rules', `${code('backend/src/routes/*.js')}, ${code('backend/src/controllers/*.js')}, ${code('backend/src/services/paymentService.js')}, ${code('backend/src/models/pdfModel.js')}`, 'Routes decide URL shape, controllers decide flow, and services/models decide the real business and data logic.'],
    ['Styling and visual design', `${code('frontend/assets/css/*.css')}`, 'Styles are separated by page and feature, so edit the stylesheet that matches the surface you want to change.'],
  ],
  'compact-table',
);

const risksList = [
  'The admin portal is powerful but monolithic. <code>admin-upload.html</code> contains a very large amount of inline UI, styling, and business-aware JavaScript in one file. That makes changes possible, but not cheap to reason about.',
  'The site mixes several generations of SEO strategy: committed static SEO pages, Cloudflare Functions that can also render SEO pages, and a large <code>_redirects</code> file that pushes many SEO URLs into the dynamic detail page. This works, but it raises maintenance complexity.',
  'The SQL files show schema drift over time. For example, the fresh schema supports <code>storage_provider = r2</code>, while an older repair migration still reflects an earlier enum shape. Payment scope support is also extended later by a separate migration.',
  'The payment service includes schema self-repair logic. That is helpful operationally, but it also means database structure can be influenced at runtime, which can hide migration problems until production traffic hits them.',
  'Frontend configuration is hardcoded in <code>assets/js/config.js</code>. Changing backend origins or Google client IDs means changing deployed frontend code, not just environment variables.',
  'Some branding strings differ inside payment flows. The checkout helper uses both <code>Grand Old Books</code> and <code>E-Library</code>, which suggests naming drift.',
  'The support configuration includes hardcoded public owner identity details inside backend code. That is convenient, but it means personal profile changes require a backend code edit.',
  'The project depends on several external services whose dashboard settings are not fully visible in source code: Cloudflare Pages, Render, MySQL hosting, Razorpay, Google Drive, Firebase, Search Console, and AdSense.',
  'The backend still carries legacy raw Drive route support, guarded by environment flags. That is useful for compatibility, but it is one more path that needs to remain secured.',
  'The live repository includes two historical backup folders in the local workspace. They are valuable for archaeology, but they can easily confuse future maintenance if someone edits the wrong copy.',
  'The <code>origin/update-website</code> branch looks like a large rewrite in progress. The diff shows many files removed, many new placeholder files added, and a very different architecture. Treat that branch as experimental until it is fully reviewed and proven complete.',
  'Some generated/static files show signs of encoding noise or generator imperfections. That does not necessarily break runtime behavior, but it is a signal that content generation and file hygiene should be watched closely.',
];

const limitationsList = [
  `I could inspect the code that talks to Google Drive, Firebase, Razorpay, Gemini, Cloudflare Pages, Render, and MySQL, but I could not inspect the private dashboards or deployed secrets for those services because those are not stored in the repository.`,
  'I could not verify the contents of remote Google Drive files themselves from source code alone. I analyzed the IDs, routes, and storage logic, not the full document contents stored in Drive.',
  'I could not inspect live Render, Cloudflare Pages, Razorpay, Search Console, AdSense, Firebase, or Aiven account settings beyond what is implied by committed code and documentation.',
  'The <code>origin/update-website</code> branch was analyzed as work-in-progress evidence through Git history and file-diff shape, not as a second fully running production system, because many files there are placeholders or part of an incomplete rewrite.',
];

const groupedFileMapRows = groupedTrackedRows
  .map((group) => subsection(
    `file-map-${slugify(group.category)}`,
    `${group.category} explained`,
    p(`This directory group contains ${group.rows.length} tracked file(s). The table below explains why each path exists and what future changes should usually start there.`) +
      table(
        ['Path', 'What it does', 'If you change it, what will move with it'],
        group.rows
          .sort((a, b) => a.file.localeCompare(b.file))
          .map((row) => [
            `<span class="path">${escapeHtml(row.file)}</span>`,
            escapeHtml(row.purpose),
            escapeHtml(
              row.depth === 'Pattern'
                ? 'Treat this as part of a generated family. Change the generator or the template logic first.'
                : row.depth === 'Artifact'
                ? 'This file controls version pinning or packaging rather than product behavior.'
                : 'This file participates directly in the linked feature, so related routes, scripts, styles, or queries will usually need to stay in sync.'
            ),
          ]),
        'inventory-table',
      ),
  ))
  .join('');

const staticPageExamples = representativeStaticPages
  .map((file) => `<li><code>${escapeHtml(file)}</code></li>`)
  .join('');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>E-LIBRARY Codebase Deep Analysis Report</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        --ink: #1f2937;
        --muted: #5b6472;
        --line: #d7dde6;
        --panel: #f7f9fc;
        --panel-strong: #eef3fb;
        --accent: #0f4c81;
        --accent-soft: #dbeafe;
        --warning: #7c2d12;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--ink);
        font: 14px/1.55 "Segoe UI", Arial, sans-serif;
        background: white;
      }
      .page {
        max-width: 1080px;
        margin: 0 auto;
        padding: 28px 28px 80px;
      }
      .cover {
        padding: 32px;
        border: 1px solid var(--line);
        background: linear-gradient(135deg, #eef4ff 0%, #f9fbff 45%, #ffffff 100%);
        border-radius: 18px;
        margin-bottom: 26px;
      }
      .cover h1 {
        margin: 0 0 10px;
        font-size: 34px;
        line-height: 1.15;
        color: #10365d;
      }
      .cover p {
        margin: 8px 0;
        font-size: 15px;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 20px;
      }
      .meta-card {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: rgba(255,255,255,0.85);
        padding: 14px 16px;
      }
      .meta-card strong {
        display: block;
        color: #0d3b66;
        margin-bottom: 5px;
      }
      h2 {
        font-size: 25px;
        margin: 40px 0 14px;
        padding-bottom: 8px;
        border-bottom: 2px solid var(--accent-soft);
        color: #10365d;
      }
      h3 {
        font-size: 19px;
        margin: 26px 0 10px;
        color: #144a75;
      }
      h4 {
        font-size: 16px;
        margin: 20px 0 8px;
        color: #23466b;
      }
      p, li {
        color: var(--ink);
      }
      p.note {
        color: var(--muted);
      }
      code {
        font-family: Consolas, "Courier New", monospace;
        background: #f2f5fa;
        border: 1px solid #e2e8f0;
        border-radius: 5px;
        padding: 0 4px;
        word-break: break-word;
      }
      .toc {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--panel);
        padding: 18px 20px;
        margin: 24px 0 34px;
      }
      .toc ol {
        margin: 0;
        padding-left: 20px;
        columns: 2;
        column-gap: 28px;
      }
      .toc li {
        margin: 6px 0;
      }
      .callout {
        border-left: 5px solid var(--accent);
        background: var(--panel);
        padding: 14px 16px;
        margin: 14px 0;
      }
      .warning {
        border-left-color: #b45309;
        background: #fff7ed;
      }
      .report-section {
        page-break-inside: avoid;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 14px 0 18px;
        table-layout: fixed;
      }
      th, td {
        border: 1px solid var(--line);
        padding: 9px 10px;
        vertical-align: top;
        text-align: left;
      }
      th {
        background: var(--panel-strong);
        color: #10365d;
      }
      .inventory-table th:nth-child(1) { width: 23%; }
      .inventory-table th:nth-child(2) { width: 12%; }
      .inventory-table th:nth-child(3) { width: 9%; }
      .inventory-table th:nth-child(4) { width: 26%; }
      .inventory-table th:nth-child(5) { width: 30%; }
      .compact-table th:nth-child(1) { width: 18%; }
      .compact-table th:nth-child(2) { width: 30%; }
      .compact-table th:nth-child(3) { width: 28%; }
      .compact-table th:nth-child(4) { width: 24%; }
      .block-table th:nth-child(1) { width: 18%; }
      .block-table th:nth-child(2) { width: 38%; }
      .block-table th:nth-child(3) { width: 44%; }
      .path {
        font-family: Consolas, "Courier New", monospace;
        font-size: 12px;
      }
      .flow-grid {
        display: grid;
        grid-template-columns: 1fr 36px 1fr 36px 1fr 36px 1fr;
        gap: 10px;
        align-items: center;
        margin: 18px 0;
      }
      .flow-grid.secondary {
        grid-template-columns: repeat(4, 1fr);
      }
      .flow-card {
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 14px 16px;
        background: var(--panel);
        min-height: 108px;
      }
      .flow-card strong {
        display: block;
        margin-bottom: 6px;
        color: #10365d;
      }
      .flow-card span {
        display: block;
        color: var(--muted);
      }
      .flow-arrow {
        text-align: center;
        font-size: 25px;
        color: var(--accent);
        font-weight: bold;
      }
      .two-col {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
      }
      .mini-stat {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--panel);
        padding: 14px 16px;
      }
      .mini-stat strong {
        display: block;
        margin-bottom: 6px;
        color: #10365d;
      }
      .footer-note {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid var(--line);
        color: var(--muted);
      }
      @media print {
        .cover, .toc, .mini-stat, .callout, .flow-card {
          break-inside: avoid;
        }
        h2 {
          page-break-before: always;
        }
        h2:first-of-type {
          page-break-before: auto;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <section class="cover">
        <h1>E-LIBRARY Codebase Deep Analysis Report</h1>
        <p>This document explains the local codebase at <code>C:\\Users\\Padam Kishore\\Pictures\\E-LIBRARY</code> and the linked GitHub repository <code>${escapeHtml(gitRemote || 'https://github.com/padam421/E-LIBRARY.git')}</code> in very simple English.</p>
        <p>The goal is not to restate syntax. The goal is to explain what each important part does, why it exists, how the parts connect, and where you should edit the project when you want to change behavior later.</p>
        <div class="meta-grid">
          <div class="meta-card">
            <strong>Analysis timestamp</strong>
            <span>${escapeHtml(today)}</span>
          </div>
          <div class="meta-card">
            <strong>Live branch analyzed</strong>
            <span><code>main</code> tracking <code>origin/main</code> at commit <code>${escapeHtml(mainHeadCommitShort)}</code></span>
          </div>
          <div class="meta-card">
            <strong>Local source folder</strong>
            <span><code>C:\\Users\\Padam Kishore\\Pictures\\E-LIBRARY</code></span>
          </div>
          <div class="meta-card">
            <strong>GitHub repository</strong>
            <span><code>https://github.com/padam421/E-LIBRARY</code></span>
          </div>
        </div>
      </section>

      <section class="toc">
        <h3>Table of contents</h3>
        <ol>
          <li>Executive summary</li>
          <li>Full project inventory</li>
          <li>High-level architecture overview</li>
          <li>Frontend deep analysis</li>
          <li>Backend deep analysis</li>
          <li>Database deep analysis</li>
          <li>Admin portal deep analysis</li>
          <li>Payment system deep analysis</li>
          <li>Google / SEO / integration deep analysis</li>
          <li>File-by-file explanation</li>
          <li>Feature-by-feature explanation</li>
          <li>End-to-end flow explanations</li>
          <li>If I want to change X, where do I go?</li>
          <li>Risks, technical debt, unfinished areas, and hidden dependencies</li>
          <li>Final conclusion</li>
        </ol>
      </section>

      ${section(
        'executive-summary',
        '1. Executive Summary',
        p('This project is a real full-stack digital library, not just a static website. The frontend is a multi-page static application hosted in a way that fits Cloudflare Pages. The backend is a Node.js and Express API that runs separately, talks to MySQL, verifies Google sign-in tokens, protects admin routes, creates payment orders, checks payment signatures, builds previews for PDFs and EPUBs, and streams file assets from storage.') +
          p('The public site is built with plain HTML, CSS, and vanilla JavaScript rather than React or another frontend framework. That decision means the site is easier to deploy as static files, but it also means large files such as <code>auth.js</code>, <code>admin-upload.html</code>, and the reader engines carry a lot of responsibility. Browser state is stored mainly in scoped <code>localStorage</code> keys, while trusted identity and payment decisions always move back to the backend.') +
          p('The backend is the real trust boundary. It is where Google identity is verified, where MySQL writes happen, where admin permissions are enforced, where payment records live, where book access is decided, and where support contributions become official. In other words: the frontend creates a polished user experience, but the backend is the part that makes the experience safe and authoritative.') +
          p('The database is MySQL and is accessed with raw SQL queries through <code>mysql2</code>. There is no ORM. That means the schema files and the query files matter a lot. The most important data tables are <code>users</code>, <code>books_data</code>, <code>admin_activity_logs</code>, <code>payment_settings</code>, <code>book_premium_rules</code>, <code>payment_orders</code>, <code>user_entitlements</code>, and <code>support_contributions</code>.') +
          p('The SEO layer is more advanced than a normal small website. This project has committed static SEO pages, Cloudflare Function-based SEO rendering, canonical URLs, sitemap generation, <code>robots.txt</code>, JSON-LD structured data, Google Search Console verification, and Google AdSense verification. Search visibility is clearly a first-class goal of the architecture.') +
          p('The GitHub repository also shows active evolution. The live <code>main</code> branch is the branch this report treats as the running system. A second branch named <code>update-website</code> looks like a large rewrite in progress. That branch should be treated as experimental work until it is validated end to end.') +
          `<div class="callout"><strong>Most important takeaway:</strong> the codebase is organized around one clear product idea: make public discovery easy, keep protected reading and admin actions secure, and let monetization sit on the backend so the browser never holds secrets.</div>`,
      )}

      ${section(
        'inventory',
        '2. Full Project Inventory',
        p('I treated the local folder and the linked GitHub repository as one connected scope. The Git remote of the local repository points to the same GitHub project, so the tracked file tree below is the live source inventory. I also inventoried major local-only artifacts that live beside the tracked source, such as backups, logs, database dumps, and dependency folders.') +
          p(branchStatusBeforeDocs) +
          `<div class="two-col">
            <div class="mini-stat"><strong>Tracked repository files</strong><span>${trackedRows.length} tracked files were found in Git.</span></div>
            <div class="mini-stat"><strong>Main branch head</strong><span><code>${escapeHtml(localMainCommit)}</code> locally and <code>${escapeHtml(remoteMainCommit)}</code> on <code>origin/main</code>.</span></div>
          </div>` +
          `<h3>2.1 Top-level local folder inventory</h3>` +
          table(['Entry', 'Type'], topLevelEntries, 'compact-table') +
          `<h3>2.2 Tracked file summary by category</h3>` +
          table(['Category', 'Tracked files', 'Deep-dive files', 'Pattern-generated files', 'Artifact-only files'], categorySummaryRows, 'compact-table') +
          `<h3>2.3 Complete tracked file inventory</h3>` +
          p('Every tracked file below is first-party project material or project-owned documentation. Generated pages and binary assets are still listed. The difference is in the <em>Depth</em> and <em>Why this level of analysis</em> columns.') +
          inventoryTablesHtml +
          `<h3>2.4 Local-only artifacts and why they were not deep source-analyzed</h3>` +
          table(
            ['Local path', 'What it is', 'Approximate file count', 'Why it matters', 'Why it was not treated as live first-party source'],
            localArtifacts.map((item) => [
              `<span class="path">${escapeHtml(item.path)}</span>`,
              escapeHtml(item.kind),
              String(item.count),
              escapeHtml(item.details),
              escapeHtml(item.note),
            ]),
            'inventory-table',
          ) +
          `<div class="callout warning"><strong>Important boundary:</strong> the backup folders and <code>node_modules</code> exist locally, but they are not the live source of truth for current behavior. I still listed them because they matter for local understanding and future maintenance confusion.</div>`,
      )}

      ${section(
        'architecture',
        '3. High-Level Architecture Overview',
        p('At the highest level, this system is split into five responsibilities: the browser UI, the static hosting layer, the backend API, the database, and external service integrations. The browser handles interaction. Cloudflare-style static hosting serves the frontend. The backend API performs trusted operations. The database stores authoritative data. External services provide identity, file storage, AI, and payment processing.') +
          architectureBoxes +
          p('The frontend and backend are intentionally separated. The frontend can be cached and delivered quickly as static files. The backend can be updated separately and can protect secrets. This separation is the reason you see a small public config file in the frontend and much heavier business logic in the backend. The browser never creates payment orders directly, never verifies payments directly, never decides whether a premium book should unlock, and never directly writes admin database changes without the backend standing in the middle.') +
          p('The browser enters the system in different ways depending on the visitor. A normal reader usually lands on <code>index.html</code>. A search engine may land on a static SEO book page under <code>/books/...</code>. An admin may land on <code>admin-upload.html</code>. A supporter may land on <code>support.html</code>. All of these entry points eventually connect to the same backend API when live data, identity, or secure behavior is required.') +
          p('The public frontend origin is configured in code and documentation as <code>https://e-library-c9t.pages.dev</code>. The backend API origin is configured in <code>PDF-Library/frontend/assets/js/config.js</code> as <code>https://e-library-dtx4.onrender.com</code>. That means the site is designed as a cross-origin setup: the public page files and the API do not live on the same host. This is why <code>app.js</code> contains explicit CORS behavior.') +
          p('Storage is abstracted. A book may live in Google Drive, R2, GCS, or even a direct URL according to the code. Right now, much of the actual logic and history points to Google Drive as the main active store, but the presence of <code>bookStorage.js</code>, <code>r2-migration.md</code>, and schema support for <code>r2</code> shows that storage flexibility is a deliberate design concern.') +
          p('Git history also tells an architecture story. Recent commits on <code>main</code> focus on SEO, AdSense, support payment reliability, and cover delivery fixes. The separate <code>update-website</code> branch shows a much larger rewrite attempt. The live architecture should therefore be understood as stable but actively evolving.') +
          `<h3>3.1 Recent live-branch activity</h3>` +
          list(recentMainCommits.map((commit) => escapeHtml(commit))) +
          `<h3>3.2 Evidence of work in progress on the GitHub side branch</h3>` +
          p(`Compared with <code>origin/main</code>, the branch <code>origin/update-website</code> shows this short summary: ${escapeHtml(updateBranchDiffStat || 'No shortstat output available.')}`) +
          p('The diff shape suggests a major rewrite rather than a small feature branch. Many existing SEO, payment, admin, and reader files are removed or replaced, and many newly added files are placeholders. That is why this report treats that branch as “in progress” rather than a second live system.'),
      )}

      ${section(
        'frontend',
        '4. Frontend Deep Analysis',
        p('The frontend is a static multi-page application built without a heavy JavaScript framework. That matters because the code uses browser globals, direct DOM updates, large page-specific scripts, and many explicit HTML containers. Instead of components compiled by a build tool, the project relies on a carefully arranged set of pages plus JavaScript files that know how to fill those pages with live behavior.') +
          p('This approach has two big advantages here. First, deployment is simple: static files go to Pages hosting, and the backend is separate. Second, SEO-friendly pages can be served directly as HTML. The tradeoff is that some browser files become very large because they carry both state logic and rendering logic. The best example is <code>auth.js</code>, which acts like a home-page app controller, state store, and rendering engine all at once.') +
          `<h3>4.1 Frontend surface map</h3>` +
          pageMapTable +
          `<h3>4.2 How frontend state is managed</h3>` +
          list([
            'Identity state is restored in the browser and then refreshed by asking the backend for the current session. The browser may keep a session token in scoped localStorage, but the backend remains the source of truth.',
            'Reader progress, history, bookmarks, notes, highlights, settings, and “my list” data are stored mostly in localStorage. The keys are intentionally scoped by active email so that multiple accounts on the same browser do not fully overwrite one another.',
            'Cross-file coordination happens through browser globals such as <code>window.PdfLibraryPayments</code>, custom DOM events such as <code>pdf-lib:active-user-changed</code>, and shared helper functions attached to <code>window</code>.',
            'The UI is split by page, not by reusable compiled components. That means the correct place to change behavior is usually “the page file plus its matching JS and CSS files,” not “a shared component folder.”',
          ]) +
          `<h3>4.3 Homepage and discovery flow</h3>` +
          p('The homepage is the public heart of the system. <code>index.html</code> provides the layout shell, but <code>auth.js</code> turns it into a working library. The browser loads the public books API, normalizes results, groups books into rows, calculates “trending” and “continue reading” areas from local state, manages login and account switching, and controls the search modal, settings panel, recent history panel, and profile UI.') +
          p(`This is a large responsibility set, which is why <code>auth.js</code> is about ${majorLineCounts['PDF-Library/frontend/assets/js/auth.js']} lines long. The file is not just “authentication.” It is closer to the operating system of the homepage.`) +
          importantFileBreakdowns['Frontend: index.html'] +
          importantFileBreakdowns['Frontend: auth.js'] +
          `<h3>4.4 Book detail page</h3>` +
          p('The detail page is intentionally separate from the homepage because a single book needs richer presentation: poster, description, author, category, available formats, video preview, recommendations, and a clear “read now” action. The page is also a bridge between discoverability and actual reading. People may arrive here from search, from the homepage, or from shared links.') +
          p(`The file pair <code>book-detail.html</code> and <code>book-detail.js</code> does two jobs. First, it turns one catalog item into a more cinematic page. Second, it creates the correct path into either the PDF reader or EPUB reader. <code>book-detail.js</code> also updates metadata dynamically so the browser still gets a useful title/canonical/preview state even though the true search-engine-friendly page is the SEO layer, not this dynamic page.`) +
          renderBlockTable([
            ['Detail page shell', 'Defines the poster area, metadata cards, recommendation rows, and footer.', 'The page needs stable visual structure before the book-specific data is injected.'],
            ['Book lookup and normalization', 'Finds the correct book from API data or URL parameters.', 'The dynamic page needs a reliable way to attach itself to the shared catalog.'],
            ['Format and premium logic', 'Decides whether PDF or EPUB is available and what read button text should say.', 'The page is the human-readable handoff into the access-controlled readers.'],
            ['Poster, cover, and video rendering', 'Builds the visual hero for the book and falls back safely if one asset is missing.', 'Media presentation is the emotional center of the detail page.'],
            ['Recommendations and trending rows', 'Shows related or interesting follow-up books.', 'This keeps users moving deeper into the catalog.'],
          ]) +
          `<h3>4.5 PDF reader</h3>` +
          p('The PDF reader is built as a dedicated reading product rather than a tiny embedded viewer. It supports preview mode, full mode, search, bookmarks, notes, highlights, theme changes, and progress tracking. The backend protects the file access, while the frontend makes the reading experience feel rich and personal.') +
          p(`The logic is intentionally split. <code>view-pdf.html</code> defines the page shell and sign-in gate, <code>pdf-engine.js</code> handles actual PDF rendering and text extraction, and <code>reader-controls.js</code> layers advanced user tools on top. This separation is smart because it keeps low-level document rendering separate from higher-level user productivity features.`) +
          importantFileBreakdowns['Frontend: view-pdf.html + pdf-engine.js + reader-controls.js'] +
          `<h3>4.6 EPUB reader</h3>` +
          p('The EPUB reader has a different job from the PDF reader. PDF pages are fixed-layout page images with text layers. EPUB files are more like packaged web documents. Because of that, the EPUB reader must unzip content, parse a manifest, sanitize HTML and CSS, manage chapters, and render text in a reflowable way.') +
          p(`The EPUB engine is around ${majorLineCounts['PDF-Library/frontend/assets/js/epub-engine.js']} lines long because it is effectively a mini reading application by itself. The sanitization work is especially important. The project is loading external book content into a browser reader, so it strips dangerous tags, URLs, and layout behaviors before rendering.`) +
          importantFileBreakdowns['Frontend: view-epub.html + epub-engine.js'] +
          `<h3>4.7 Support page and support UX</h3>` +
          p('The support page is not an afterthought. It has its own page, its own data feed for recent supporters, its own checkout path, and its own optional media-upload flow. This is a separate business journey: instead of paying for reading rights, a person is choosing to support the creator or project directly.') +
          importantFileBreakdowns['Frontend: support.html + support.js + payments.js'] +
          `<h3>4.8 Admin portal as a frontend surface</h3>` +
          p('Although the admin portal is discussed in detail later, it is worth understanding here as a frontend pattern. <code>admin-upload.html</code> is not a tiny upload form. It is a self-contained internal dashboard with authentication, tabular data, CRUD forms, bulk import logic, owner-only payment controls, admin-permission management, and health checks.') +
          p(`At about ${majorLineCounts['PDF-Library/frontend/admin-upload.html']} lines, it behaves like a small single-page app compressed into one HTML file. That is why it can feel both powerful and fragile: it centralizes almost every admin-visible operation in one place.`) +
          importantFileBreakdowns['Frontend: admin-upload.html'] +
          `<h3>4.9 AI sidebar and theme system</h3>` +
          p('Two cross-page frontend features deserve special mention because they cut across multiple surfaces. The first is the AI sidebar. The second is the theme system. The AI sidebar is injected, not hardcoded separately into every page, which keeps feature behavior more consistent. The theme system is user-scoped, which means visual preferences follow the active account in the same browser.') +
          renderBlockTable([
            ['AI sidebar injection', 'Loads its own HTML/CSS behavior if the current page does not already contain the sidebar markup.', 'This allows one assistant implementation to work across homepage, detail page, and readers.'],
            ['Context gathering', 'Collects current page URL, current book, current page text, visible books, search context, and recent conversation turns.', 'The AI feature is useful only if it understands what the reader is looking at.'],
            ['Safe markdown rendering', 'Uses DOMPurify and marked to render AI answers more safely.', 'AI output should not become an accidental XSS route.'],
            ['Theme toggle scoping', 'Stores preferences per active user and injects the right stylesheet or class state into each page type.', 'Different people using the same browser should not fully overwrite each other’s theme settings.'],
          ]) +
          `<h3>4.10 Frontend styling approach</h3>` +
          p(`Styling is split by surface, not by atomic design tokens. The homepage uses <code>styles.css</code> (${majorLineCounts['PDF-Library/frontend/assets/css/styles.css']} lines). The PDF reader, EPUB reader, AI sidebar, detail page, and theme toggles each have their own style files. This is a very practical pattern for a non-framework site: when you want to change how a page looks, you usually edit that page’s CSS file directly.`) +
          list([
            '<code>styles.css</code> is the shared public-site visual backbone.',
            '<code>book-detail.css</code> styles the cinematic detail page.',
            '<code>pdf-reader.css</code> and <code>epub-reader.css</code> style their very different reading environments.',
            '<code>ai-sidebar.css</code> is effectively the design system for the AI assistant UI.',
            '<code>theme-toggle*.css</code> files adapt theme-switcher behavior to homepage, detail page, and reader contexts.',
            '<code>seo.css</code> gives the committed SEO/static pages a lightweight, crawler-friendly visual layer.',
          ]) +
          `<div class="callout"><strong>Frontend design lesson:</strong> in this project, “where do I edit the frontend?” usually means “find the page shell, the matching page script, and the matching page stylesheet.” There is no hidden framework layer doing that mapping for you.</div>`,
      )}

      ${section(
        'backend',
        '5. Backend Deep Analysis',
        p('The backend is a Node.js and Express application with raw SQL access through <code>mysql2</code>. It is not a big microservice cluster. It is one focused API process that owns trust, data writes, admin enforcement, preview generation, and integration with external services. Because of that, the codebase puts a lot of weight on route/controller/service boundaries and environment validation.') +
          p('The backend startup path is simple and deliberate: <code>server.js</code> loads the environment, validates configuration, imports the Express app from <code>app.js</code>, and starts listening on the configured port. Top-level crash handlers and port-in-use messaging are included so that local and hosted failures are easier to recognize.') +
          importantFileBreakdowns['Backend: app.js + server.js'] +
          `<h3>5.1 Configuration and environment handling</h3>` +
          p('Configuration is not scattered randomly. The important configuration logic lives in <code>backend/src/config</code>. <code>loadEnv.js</code> loads backend env values and has a small fallback rule for cloud payment secrets. <code>validateEnv.js</code> checks production assumptions, such as whether required variables exist, whether secret placeholders were left behind, whether CORS uses HTTPS in production, whether session secrets are strong enough, and whether optional integrations are missing.') +
          p('This matters because the application depends on many services: MySQL, Google Drive, Google identity, optional Firebase, Gemini AI, Razorpay, and possibly R2. Weak startup validation would make deployment errors harder to diagnose and could leave the site running in a half-safe state.') +
          renderBlockTable([
            ['loadEnv.js', 'Loads local environment files and allows specific fallback behavior for payment secrets.', 'Centralizing env loading prevents subtle “works locally but not in production” mismatches.'],
            ['validateEnv.js', 'Rejects obviously unsafe or incomplete production config.', 'This file protects the runtime before the app serves traffic.'],
            ['db.js', 'Creates the MySQL pool, enables optional SSL, adds retry logic for safe read queries, and sends periodic keepalive pings.', 'Database reliability on hosted/free environments needs practical resilience code.'],
            ['drive.js', 'Builds the Google OAuth client and Drive API instance.', 'Book assets and support media depend on Drive access.'],
            ['firebase.js', 'Bootstraps Firebase Admin safely, including optional startup in production if credentials are missing.', 'The project wants to keep running even if optional Firebase sync is absent.'],
          ]) +
          `<h3>5.2 Middleware and route assembly</h3>` +
          p('The backend middleware stack is small but important. <code>app.js</code> sets trust proxy, configures CORS, adds security headers, disables the Express fingerprint header, places the Razorpay webhook route before JSON parsing, sets body-size limits, mounts feature routes, exposes a small health/ping surface, and finally uses the shared error handler.') +
          p('Two design choices are especially good here. First, the webhook route uses raw-body handling before JSON parsing because HMAC verification needs the untouched bytes. Second, admin write routes require both authenticated admin identity and a CSRF token. That combination fits the cross-origin browser architecture.') +
          routeMapTable +
          `<h3>5.3 Authentication and authorization</h3>` +
          p('This application uses Google sign-in on the frontend, but backend trust begins only after the backend verifies the Google access token. <code>authController.js</code> uses <code>googleToken.js</code> to confirm the identity, upserts a user in MySQL, optionally syncs to Firestore, creates a signed session token, sets a secure cookie, and returns a CSRF token. Later, <code>requireAdmin.js</code> restores the session, reloads the user from MySQL, and blocks non-admins from protected routes.') +
          importantFileBreakdowns['Backend: authController.js + sessionToken.js + requireAdmin.js'] +
          `<h3>5.4 Book data, previews, and protected reading</h3>` +
          p('The backend does not just act like a CRUD API. It also acts like a media gateway. <code>pdfModel.js</code> fetches the public catalog and resolves book asset references. <code>pdfController.js</code> then turns that data into preview streams, full-file streams, cover delivery, and access-denied responses that the reader UIs understand. This file is where business policy meets content delivery.') +
          p('The preview logic is a good example. For PDFs, the controller uses <code>pdf-lib</code> to build a shortened preview document capped by <code>PREVIEW_PAGE_LIMIT</code>. For EPUBs, it uses <code>JSZip</code> to create a trimmed preview archive. That means preview mode is not just “hide the button.” It is actual asset transformation on the backend.') +
          importantFileBreakdowns['Backend: pdfController.js + pdfModel.js + bookStorage.js'] +
          `<h3>5.5 Payments, entitlements, and support persistence</h3>` +
          p('The payment backend is the most business-critical part of the system. <code>paymentController.js</code> is thin on purpose. It mostly adapts HTTP requests and hands work to <code>paymentService.js</code>. That service decides the meaning of payment settings, book premium rules, support contribution rules, access duration, entitlement creation, and verification of both browser-returned checkout signatures and Razorpay webhooks.') +
          p(`This file is one of the largest and most important files in the entire repository at about ${majorLineCounts['PDF-Library/backend/src/services/paymentService.js']} lines. That size makes sense because it is where money, access, and support behavior come together.`) +
          importantFileBreakdowns['Backend: paymentService.js + paymentController.js'] +
          `<h3>5.6 AI assistant route</h3>` +
          p('The AI feature is backed by Gemini, but the backend does significant preparation work before anything is sent to Gemini. It builds a special system instruction tied to the site, gathers website context, extracts text from attached PDFs, performs OCR on attached images when needed, manages model fallback and cooldown rules, and normalizes errors to a user-friendly message.') +
          importantFileBreakdowns['Backend: aiController.js'] +
          `<h3>5.7 Error handling, rate limiting, and operational behavior</h3>` +
          list([
            '<code>rateLimiter.js</code> provides in-memory IP-based throttling. This is simple and works, but it is not a distributed rate limiter, so it should be understood in that light.',
            '<code>errorHandler.js</code> gives the API a consistent failure shape and has special handling for blocked CORS cases.',
            '<code>db.js</code> retries only read-like queries. That is an intentional safety choice because retrying writes blindly can duplicate side effects.',
            'The backend includes explicit health and warmup routes because hosted free-tier environments can sleep or drop connections.',
          ]) +
          `<div class="callout"><strong>Backend design lesson:</strong> the project keeps the backend small in number of layers, but each layer has a clear job. Routes name the URL, controllers manage the request flow, services hold heavy business logic, models hold raw book queries, and config files hold environment/service setup.</div>`,
      )}

      ${section(
        'database',
        '6. Database Deep Analysis',
        p('The database technology is MySQL. The application does not use an ORM, which means the schema files and the raw query files are especially important. If you change a column name or relationship in MySQL, you usually must also change the code that manually selects, inserts, updates, or joins that column.') +
          p('The schema is spread across one fresh-database file and several migration-style repair files. That tells a history story. The project started smaller, then gained admin logs, payment settings, per-book premium rules, user entitlements, and support contributions. Because of that evolution, understanding both the main schema and the later migrations is necessary.') +
          dbTableSummary +
          `<h3>6.1 Table-by-table explanation</h3>` +
          p('<strong>users</strong> exists because Google sign-in alone is not enough. The app needs its own local identity rows so that it can store roles, last login times, profile pictures, entitlements, and audit relationships. If you need to change role rules, admin behavior, or login persistence, this table is part of that change.') +
          p('<strong>books_data</strong> is the core content table. It stores human metadata such as title, author, description, and category, plus machine asset references such as Drive IDs, EPUB IDs, video IDs, and storage-provider information. If you want to change what a book record can contain, this is the main table to study.') +
          p('<strong>admin_activity_logs</strong> exists to answer “who changed what?” It is used when admins add, update, delete, grant access, or change payment-related settings. If you ever need stronger audit or moderation ability, this table and the related logging calls are where to start.') +
          p('<strong>payment_settings</strong> stores the system-wide switches and price defaults for premium access. This is the database representation of “are payments on?”, “is site premium on?”, “how many preview pages are allowed?”, and “what are the monthly and annual prices?”') +
          p('<strong>book_premium_rules</strong> stores per-book overrides. This is how the system can say “this specific book is premium” even if the rest of the site behaves differently. It links directly to <code>books_data(id)</code>.') +
          p('<strong>payment_orders</strong> stores every money flow attempt. It captures scope, amount, receipt, gateway IDs, payment status, and optional links to users and books. This table is the backbone of payment auditability.') +
          p('<strong>user_entitlements</strong> stores what access a user has actually earned. The important idea is that an order and an entitlement are not the same thing. An order is the payment record. An entitlement is the resulting right to access site premium or a specific book.') +
          p('<strong>support_contributions</strong> stores support-page-specific records such as supporter name, optional message, optional local-currency amount, media upload token hash, public visibility, and media upload status. This separation is good design because support is related to payments, but not identical to reading access.') +
          `<h3>6.2 Relationship map in plain English</h3>` +
          list([
            '<code>book_premium_rules.book_id</code> points to <code>books_data.id</code>. If a book is deleted, its premium rule is deleted too.',
            '<code>payment_orders.user_id</code> can point to <code>users.id</code>. The email is also stored so order history still makes sense even if the user link becomes null.',
            '<code>user_entitlements.user_id</code> can point to <code>users.id</code>, and <code>source_order_id</code> can point back to <code>payment_orders.id</code>.',
            '<code>support_contributions.order_id</code> points to <code>payment_orders.id</code>, which keeps each contribution tied to exactly one payment order.',
            '<code>admin_activity_logs</code> stores actor identity mostly by email/name/role text rather than a hard foreign key, which makes logs resilient even if user rows change later.',
          ]) +
          `<h3>6.3 Query patterns</h3>` +
          list([
            'Public catalog reads happen mainly through <code>pdfModel.js</code>, which joins book metadata with payment settings and per-book premium rules to produce a public-safe response.',
            'Book CRUD writes happen in <code>adminController.js</code>. That file converts form input into the normalized shape expected by <code>books_data</code>.',
            'Login writes happen in <code>authController.js</code>, which upserts into <code>users</code> and updates <code>last_login</code>.',
            'Payment and entitlement writes happen in <code>paymentService.js</code>. This is the single most important file for understanding how money turns into access.',
            'Admin audit writes happen in both <code>adminController.js</code> and <code>adminPaymentController.js</code> through explicit logging helpers.',
          ]) +
          `<h3>6.4 Schema drift and migration caution</h3>` +
          p('The SQL files show that the schema evolved in stages. That is normal, but it creates maintenance risk. For example, the fresh schema includes <code>storage_provider</code> values for <code>drive</code>, <code>r2</code>, <code>gcs</code>, and <code>url</code>, while an older repair migration reflects an earlier shape. The payment schema also had to be extended later for support contributions. In practice, this means you should never change SQL files in isolation. You should always review matching code paths and any runtime schema-repair helpers.') +
          `<div class="callout"><strong>Database design lesson:</strong> because there is no ORM, the real schema lives in two places at once: the SQL files and the handwritten SQL inside the JavaScript files. Both must stay aligned.</div>`,
      )}

      ${section(
        'admin-portal',
        '7. Admin Portal Deep Analysis',
        p('The admin portal exists to let the site owner and admins operate the library without editing database rows by hand. It is not only an upload form. It is the operational control room of the project.') +
          p('The portal lives in one large frontend file, <code>PDF-Library/frontend/admin-upload.html</code>, and talks to protected backend routes under <code>/api/admin</code>. This single-file design means you can find almost all admin-visible behavior in one place, but it also means that the file is dense and deserves careful edits.') +
          p('The portal is protected in multiple layers. The user must first sign in with Google. The backend must verify that Google token and create a session. The backend must then confirm that the local user row has admin privileges. Finally, mutating requests require a CSRF token. This layered model is appropriate because admin actions can change book visibility, premium rules, and other site-wide behavior.') +
          `<h3>7.1 What the admin portal can do</h3>` +
          list([
            'Add a single book with metadata and asset identifiers.',
            'Edit an existing book.',
            'Delete a book.',
            'Bulk import books from structured CSV/JSON input.',
            'Toggle public/private visibility in bulk.',
            'View the current catalog in a management table.',
            'Change global payment settings such as preview limits and prices.',
            'Change per-book premium rules.',
            'View payment orders.',
            'Grant or revoke admin access (owner-only behavior).',
            'View admin activity logs.',
            'Run simple backend health checks.',
          ]) +
          `<h3>7.2 Authentication and authorization model</h3>` +
          p('The owner email is treated specially by the backend. <code>requireAdmin.js</code> and related config helpers can auto-recognize the owner and ensure that the owner retains admin power. That is why the portal has a difference between “admin routes” and “owner-only routes.” Regular admins can manage books, but the owner gets additional power over admin permissions and payment administration.') +
          `<h3>7.3 Data reads and writes</h3>` +
          p('The portal reads the book catalog, health status, admin user list, activity log, payment settings, per-book premium configuration, and order history. It writes to <code>books_data</code>, <code>admin_activity_logs</code>, <code>payment_settings</code>, <code>book_premium_rules</code>, and indirectly to order-related tables only through the normal payment flow.') +
          `<h3>7.4 How admin changes affect the live website</h3>` +
          list([
            'When a book is added or updated, the homepage, detail page, readers, and SEO layers can all change because they all derive from the same book dataset.',
            'When a book is marked private, public readers and crawlers should stop seeing it in public catalog queries.',
            'When payment settings change, preview behavior and checkout prices change immediately for frontend clients that fetch the new config.',
            'When per-book premium rules change, the same frontend read button can lead to a different access outcome because the backend is the final decision-maker.',
            'When admin access changes, who can use the portal itself changes immediately after the next protected route check.',
          ]) +
          `<h3>7.5 Why the portal is built this way</h3>` +
          p('The portal is optimized for direct control by the owner rather than for a large internal team. That is why it is one big page instead of a many-page back office. This reduces navigation overhead and deployment complexity, but it concentrates responsibility into one large file. That tradeoff is worth remembering if you ever decide to expand the team or grow the admin tool into a more modular internal product.'),
      )}

      ${section(
        'payments',
        '8. Payment System Deep Analysis',
        p('The payment provider used by the live codebase is Razorpay. The code is structured so that Razorpay secrets never need to live in browser code. The browser asks the backend to create orders. The backend signs and verifies. The browser only receives the public key and order metadata needed to open checkout.') +
          p('The payment code supports three business scopes: site-wide premium subscription, per-book purchase, and support contribution. This is a strong sign that payments were treated as a reusable platform feature, not just a single checkout button.') +
          `<h3>8.1 Main payment files</h3>` +
          list([
            '<code>PDF-Library/frontend/assets/js/payments.js</code> - browser helper for payment config, access checks, order creation requests, Razorpay checkout bootstrapping, and verification callbacks.',
            '<code>PDF-Library/frontend/support.html</code> and <code>support.js</code> - support-specific checkout and media flow.',
            '<code>PDF-Library/backend/src/routes/paymentRoutes.js</code> - payment route map.',
            '<code>PDF-Library/backend/src/routes/paymentWebhookRoutes.js</code> - raw webhook endpoint route map.',
            '<code>PDF-Library/backend/src/controllers/paymentController.js</code> - HTTP entrypoints for payment actions.',
            '<code>PDF-Library/backend/src/controllers/adminPaymentController.js</code> - owner-facing admin screens for prices, rules, and order visibility.',
            '<code>PDF-Library/backend/src/services/paymentService.js</code> - the real business engine.',
            '<code>PDF-Library/sql/005_payments.sql</code> and <code>006_support_contributions.sql</code> - database structure for orders, entitlements, and support records.',
          ]) +
          `<h3>8.2 Checkout flow step by step</h3>` +
          p('<strong>Site premium or book premium flow:</strong> the frontend first checks <code>/api/payments/access</code> to learn whether a book is free, preview-only, or already unlocked. If the user needs payment, <code>payments.js</code> asks the backend to create a Razorpay order. The backend calculates the correct amount, creates a receipt, stores a <code>payment_orders</code> row, calls Razorpay, and returns safe order information. The frontend opens Razorpay Checkout. After payment, Razorpay returns a payment ID, order ID, and signature to the frontend. The frontend sends those values back to the backend. The backend verifies the signature and then creates or extends a <code>user_entitlements</code> row before reporting success.') +
          p('<strong>Support contribution flow:</strong> the flow is similar, but the meaning is different. The backend stores supporter name, message, optional local amount information, and a generated upload token hash in <code>support_contributions</code>. After payment verification, the supporter may optionally upload audio or video media using that upload token. The upload is accepted only after payment is confirmed, which is a very important safety rule.') +
          `<h3>8.3 Webhook flow</h3>` +
          p('The webhook exists because browser flows are not always reliable. A user might close the tab after payment or lose connection before the frontend can finish verification. Razorpay webhooks give the backend a second trustworthy signal. That is why the webhook route is mounted before JSON body parsing and why the controller reuses signature verification logic based on the raw request body.') +
          `<h3>8.4 What admin can see</h3>` +
          p('The owner-facing admin payment screens can see global payment settings, per-book premium rules, and payment order records. This means support and monetization are not hidden in an external dashboard only. The application keeps enough local payment data to support internal operations and audit.') +
          `<h3>8.5 Failure cases and how the code handles them</h3>` +
          list([
            'If the browser tries to access a premium book without entitlement, the backend can return a <code>402 PAYMENT_REQUIRED</code>-style response payload that the frontend understands.',
            'If Razorpay checkout returns but signature verification fails, the backend refuses to grant access. A payment ID alone is not trusted.',
            'If webhook verification fails, the backend ignores the event rather than trusting a forged callback.',
            'If the payment/support schema is missing or older than expected, <code>paymentService.js</code> can attempt a self-repair path. This is helpful operationally, but it is also a maintenance signal that schema evolution has been active.',
            'If a support media upload is attempted before payment is marked successful, the upload is rejected because the upload token is tied to a paid contribution state.',
          ]) +
          `<h3>8.6 Secrets and configuration pattern</h3>` +
          p('Razorpay key secrets, webhook secrets, and other private values live in backend environment configuration, not in frontend files. The frontend only exposes the public checkout key and enabled-state information. This is correct architecture for payment security.') +
          `<div class="callout"><strong>Payment design lesson:</strong> the browser can start checkout, but only the backend can decide what a payment means.</div>`,
      )}

      ${section(
        'google-seo',
        '9. Google / SEO / Integration Deep Analysis',
        p('This project is deeply connected to Google-related services, but each integration has a different purpose. Some are for user identity. Some are for storage. Some are for AI. Some are for search visibility and advertising. It is helpful to separate them clearly.') +
          `<h3>9.1 Google Identity Services</h3>` +
          p('The frontend uses Google Identity Services scripts for sign-in. The browser obtains a Google access token and sends it to the backend. The backend then verifies that token with Google before it trusts the user. The main code files are <code>frontend/assets/js/auth.js</code>, <code>frontend/admin-upload.html</code>, <code>backend/src/controllers/authController.js</code>, and <code>backend/src/utils/googleToken.js</code>.') +
          `<h3>9.2 Google Drive</h3>` +
          p('Google Drive is the main active storage system in the current live code path for many assets: PDF files, EPUB files, covers, videos, and support media uploads. <code>backend/src/config/drive.js</code> creates the API client. <code>pdfController.js</code>, <code>videoController.js</code>, and <code>paymentService.js</code> use that client or Drive-derived URLs to serve or upload content. The frontend does not need to know the raw storage details because the backend normalizes delivery through book-ID routes.') +
          `<h3>9.3 Firebase / Firestore</h3>` +
          p('Firebase is present, but it is optional for startup according to both the code and recent commits. The backend can sync user data to Firestore, but the site is intentionally able to keep running without Firebase credentials in production. This is a sign that Firebase is useful but not the primary database.') +
          `<h3>9.4 Gemini AI</h3>` +
          p('Gemini powers the AI reader assistant. The backend does not simply pass prompts through. It builds a site-aware prompt, redacts sensitive-looking values from context, extracts text from uploads, and tries fallback models/keys when needed. This is the Google AI integration layer of the project.') +
          `<h3>9.5 Google Search Console</h3>` +
          p('Search Console verification is present through meta tags in public HTML pages. The homepage and SEO pages also expose canonical URLs and structured data. This means the site has already been prepared to be recognized and managed in Google search tooling.') +
          `<h3>9.6 Google AdSense</h3>` +
          p('AdSense is implemented through both the AdSense script tags and the <code>ads.txt</code> file. The public publisher ID appears in HTML meta tags and the dedicated verification file. This is the code-level link between the site and Google advertising monetization.') +
          `<h3>9.7 SEO system as a whole</h3>` +
          p('The SEO system is more than meta tags. It includes the homepage metadata, category/book/language pages, <code>robots.txt</code>, <code>sitemap.xml</code>, a dynamic sitemap function, Cloudflare-rendered SEO HTML, JSON-LD for search engines, Open Graph tags for social previews, Twitter card tags, and a static cache of books so SEO pages can still be rendered when the backend API is down.') +
          importantFileBreakdowns['Cloudflare SEO layer: seo.js + [[path]].js + sitemap.xml.js'] +
          `<h3>9.8 What is not clearly implemented in the current code</h3>` +
          list([
            'I did not find a Google Analytics implementation.',
            'I did not find Google Tag Manager snippets.',
            'I did not find Google Maps integration.',
            'I did not find Google reCAPTCHA integration.',
            'I did not find Google Ads conversion tracking code beyond AdSense and the publisher verification path.',
          ]) +
          `<h3>9.9 Static SEO page family</h3>` +
          p('The repository contains many committed static pages under <code>PDF-Library/frontend/books/</code>. These are generated, repetitive, and intentionally indexable. I inspected representative examples from these paths:') +
          `<ul>${staticPageExamples}</ul>` +
          p('The purpose of these pages is to let search engines and direct visitors land on book/category/language URLs that already contain useful HTML. They are not the place where the reading app logic lives. They are the discoverability wrapper around the real app.'),
      )}

      ${section(
        'file-by-file',
        '10. File-by-File Explanation',
        p('Section 2 listed every tracked file. This section explains the file tree in a more human way: not just what exists, but why that path belongs where it does and what kinds of changes should start there. Think of this as the practical map you would keep open while maintaining the repository.') +
          groupedFileMapRows,
      )}

      ${section(
        'features',
        '11. Feature-by-Feature Explanation',
        p('This section groups the codebase by product behavior instead of by file path. That is useful because real maintenance usually starts with a feature change request, not with a raw filename.') +
          featureTable +
          `<h3>11.1 Existing major features currently implemented</h3>` +
          list([
            'Public library homepage with rows, search, history, settings, and account/profile behaviors.',
            'Book detail page with poster, metadata, format switching, and recommendations.',
            'Separate PDF and EPUB readers with preview and full-access modes.',
            'Google sign-in with backend-verified sessions.',
            'Admin portal for book CRUD, bulk import, visibility control, payment settings, admin permissions, and audit logs.',
            'Premium site subscription and premium per-book access with Razorpay.',
            'Support/donation page with recent supporters and optional paid media messages.',
            'AI reading assistant connected to the site context and current book/page.',
            'SEO pages, sitemap, robots, structured data, AdSense, and Search Console verification.',
            'Support for book assets across Drive and schema-level support for other storage providers such as R2 and GCS.',
          ]) +
          `<h3>11.2 Features that look newly introduced or recently changed on the live branch</h3>` +
          list([
            'AdSense and <code>ads.txt</code> were added recently according to the most recent live commits.',
            'Static sitemap and SEO behavior were recently changed several times, which suggests active tuning for Google Search Console and crawl reliability.',
            'Support payment reliability and schema auto-repair were also recent changes, which suggests this area was under active stabilization.',
            'Cover delivery from Drive to the frontend was recently fixed in the latest main-branch commit, which suggests media delivery behavior was still being refined.',
          ]) +
          `<h3>11.3 Features in progress or under rewrite</h3>` +
          p('The strongest in-progress signal is the <code>origin/update-website</code> branch. The diff shows a broad rewrite with many deletions, a new set of frontend pages such as <code>library.html</code>, <code>login.html</code>, <code>register.html</code>, and new backend placeholder files such as <code>env.js</code>, <code>redis.js</code>, and several new services. Because many of those files are empty or incomplete in the branch snapshot, they read as architecture work in progress rather than finished product behavior.') +
          `<div class="callout warning"><strong>Maintenance warning:</strong> if you work on the live site, use the <code>main</code> branch logic described in this report. If you work on the rewrite branch, first confirm which pieces of the live system are intentionally being replaced and which are accidentally being dropped.</div>`,
      )}

      ${section(
        'end-to-end-flows',
        '12. End-to-End Flow Explanations',
        p('The best way to understand a connected system is often to follow a real request from start to finish. The flows below show how the pieces interact.') +
          `<h3>12.1 Normal homepage page load</h3>` +
          list([
            'The browser requests <code>index.html</code> from the static hosting layer.',
            'The page loads CSS and JavaScript files such as <code>config.js</code>, <code>theme-toggle.js</code>, <code>payments.js</code>, <code>ai-sidebar.js</code>, and <code>auth.js</code>.',
            'The homepage script restores local account-scoped state such as theme, history, and current user markers.',
            'The script asks the backend for session state and the public books catalog.',
            'The backend reads public books from MySQL through <code>pdfModel.js</code>, joins premium metadata, and returns normalized public-safe book objects.',
            'The homepage script builds rows, cards, continue-reading sections, and search indexes from that data.',
          ]) +
          `<h3>12.2 Google sign-in flow</h3>` +
          list([
            'The reader chooses Google sign-in in the browser.',
            'Google Identity Services returns an access token to the frontend.',
            'The frontend sends that token to <code>/api/auth/login</code>.',
            'The backend verifies the token with Google and obtains trusted identity details.',
            'The backend upserts the local user row, sets/returns a signed session token, and generates a CSRF token.',
            'The frontend stores the session state and updates UI surfaces that depend on login.',
          ]) +
          `<h3>12.3 Reading a free or previewable book</h3>` +
          list([
            'The user opens the detail page and chooses a format.',
            'The reader page asks the backend whether full access is allowed.',
            'If the book is free or already unlocked, the frontend requests the full stream route.',
            'If the book requires preview mode, the backend returns only a generated preview document.',
            'The frontend reader engine renders the pages/chapters and stores reading progress locally.',
          ]) +
          `<h3>12.4 Buying premium access and then reading</h3>` +
          list([
            'The frontend requests a payment order from the backend.',
            'The backend calculates pricing and creates a Razorpay order and a local <code>payment_orders</code> row.',
            'Razorpay Checkout runs in the browser and returns signed payment data after success.',
            'The frontend sends that data back to the backend for verification.',
            'The backend verifies the signature, marks the order paid, creates/extends the correct entitlement, and records timestamps.',
            'The reader page can now request the full file stream successfully because the access check sees the new entitlement.',
          ]) +
          `<h3>12.5 Support contribution with optional media</h3>` +
          list([
            'The supporter opens <code>support.html</code> and chooses an amount.',
            'The frontend asks the backend to create a support contribution order.',
            'The backend saves the support record with an upload token hash and starts a Razorpay order.',
            'After payment, the backend verifies the checkout result or webhook event and marks the contribution paid.',
            'If the supporter recorded audio or video, the frontend uploads it using the post-payment upload token.',
            'The backend uploads the media to Google Drive and updates the contribution record to <code>media_uploaded</code>.',
          ]) +
          `<h3>12.6 Admin adds a book</h3>` +
          list([
            'The admin signs in via Google and receives a verified backend session and CSRF token.',
            'The admin portal sends a protected POST request with the book form data and CSRF token.',
            'The backend checks session validity, role, and CSRF.',
            'The admin controller normalizes the payload into the <code>books_data</code> structure and inserts the row.',
            'The controller writes an admin activity log entry and invalidates the public catalog cache.',
            'The next public catalog fetch can now show the new book if it is public.',
          ]) +
          `<h3>12.7 Googlebot crawl of a public book page</h3>` +
          list([
            'Googlebot visits a clean URL under <code>/books/...</code>.',
            'The static page or Cloudflare Function returns direct HTML with title, description, canonical URL, and structured data.',
            'The page links a user-facing route into the real app.',
            'Googlebot can also discover the page through <code>sitemap.xml</code> and is guided by <code>robots.txt</code>.',
          ]),
      )}

      ${section(
        'maintenance-guide',
        '13. If I Want to Change X, Where Do I Go?',
        p('This is the shortest practical maintenance guide for the whole system. Start with the row that matches your goal, then follow the files outward from there.') +
          maintenanceTable,
      )}

      ${section(
        'risks',
        '14. Risks, Technical Debt, Unfinished Areas, and Hidden Dependencies',
        list(risksList) +
          `<h3>14.1 Hidden external dependencies</h3>` +
          list([
            'Google Drive folder/file permissions must remain consistent with what the backend expects.',
            'Razorpay account keys and webhook secret must match the backend environment.',
            'Cloudflare Pages configuration must continue serving <code>_headers</code>, <code>_redirects</code>, and function routes correctly.',
            'Render environment variables and networking must continue matching the frontend API origin and MySQL connectivity assumptions.',
            'MySQL hosting must keep the expected tables, indexes, and character set behavior intact.',
          ]) +
          `<h3>14.2 Analysis limitations and what could not be fully verified from source alone</h3>` +
          list(limitationsList),
      )}

      ${section(
        'conclusion',
        '15. Final Conclusion: How the Entire Website Works as One Connected System',
        p('E-LIBRARY works as one connected system by keeping a clean separation between public experience and trusted operations. The public side is fast and static: HTML pages, CSS, JavaScript, SEO pages, and reader interfaces. The trusted side is dynamic: Express routes, MySQL writes, payment verification, Google identity checks, asset streaming, and admin enforcement. The system only feels simple to a reader because those responsibilities are divided carefully.') +
          p('If you want to understand where a change belongs, the pattern is consistent. Visual or interaction changes usually begin in a frontend page plus its matching JS/CSS files. Identity, admin, payments, access rules, and database changes begin in the backend. Storage behavior begins in <code>bookStorage.js</code>, <code>pdfController.js</code>, and the asset-related schema fields. Search visibility begins in the SEO functions, static SEO pages, and metadata files. This separation is the main organizing idea of the codebase.') +
          p('The code also tells a story of growth. The project started as a reading website, then added admin operations, then payments, then support contributions, then AI, then a stronger SEO layer, and now appears to be exploring a rewrite branch. That history matters because it explains both the strengths of the current system and the places where technical debt has accumulated. Once you understand that growth path, the file layout becomes much easier to own.') +
          `<div class="callout"><strong>Bottom line:</strong> if you keep the layer boundaries in mind, this website is understandable. The browser is for experience, the backend is for trust, the database is for truth, and the SEO layer is for discoverability.</div>`,
      )}

      <section class="footer-note">
        <p>This report was generated from the local repository contents, local workspace artifacts, Git history, and the linked GitHub repository state visible from the local clone.</p>
      </section>
    </div>
  </body>
</html>`;

fs.writeFileSync(outputHtml, html, 'utf8');
console.log(outputHtml);
