/* ═══════════════════════════════════════════
   BOOK DETAIL PAGE — JavaScript Logic
   Apple Premium Design System
   ═══════════════════════════════════════════ */

function resolveApiOrigin() {
  const configured = String(
    window.PDF_LIBRARY_CONFIG?.API_ORIGIN ||
      window.PDF_LIBRARY_API_BASE_URL ||
      "",
  ).trim();
  if (configured) return configured.replace(/\/+$/, "");

  const host = String(window.location.hostname || "").toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return isLocal
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : String(window.location.origin || "").replace(/\/+$/, "");
}

const API_BASE = `${resolveApiOrigin()}/api`;
const PUBLIC_SITE_ORIGIN = "https://e-library-c9t.pages.dev";
const ACTIVE_EMAIL_KEY = "pdf_lib_active_email";
const ACCOUNTS_KEY = "pdf_lib_accounts";
const RECENT_HISTORY_KEY_PREFIX = "pdf_lib_recent_books";
const MY_LIST_KEY_PREFIX = "pdf_lib_my_list_v1";
const LIBRARY_SETTINGS_KEY_PREFIX = "pdf_lib_user_settings_v1";
const STORAGE_MIGRATION_META_KEY = "pdf_lib_storage_migration_v2";
let selectedReadFormat = "pdf";

function normalizeEmailKey(email) {
  return String(email || "").trim().toLowerCase();
}

function getScopedStorageKey(prefix, email) {
  const emailKey = normalizeEmailKey(email);
  if (!emailKey) return null;
  return `${prefix}::${emailKey}`;
}

function getActiveEmail() {
  return normalizeEmailKey(localStorage.getItem(ACTIVE_EMAIL_KEY));
}

function getPreferredLegacyOwnerEmailKey(fallbackEmail) {
  const fallback = normalizeEmailKey(fallbackEmail);
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = normalizeEmailKey(parsed[0]?.email);
      if (first) return first;
    }
  } catch {
    // Ignore malformed account cache.
  }
  return fallback;
}

function readStorageMigrationState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_MIGRATION_META_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function writeStorageMigrationState(state) {
  try {
    localStorage.setItem(STORAGE_MIGRATION_META_KEY, JSON.stringify(state || {}));
  } catch {
    // Ignore storage write errors (quota/private mode).
  }
}

function migrateLegacyValueIfNeeded(prefix, email) {
  const scopedKey = getScopedStorageKey(prefix, email);
  if (!scopedKey) return null;

  const scopedRaw = localStorage.getItem(scopedKey);
  if (scopedRaw !== null) return scopedRaw;

  const legacyRaw = localStorage.getItem(prefix);
  if (legacyRaw === null) return null;

  const migrationState = readStorageMigrationState();
  const owner = normalizeEmailKey(migrationState[prefix]);
  const emailKey = normalizeEmailKey(email);
  const preferredOwner = owner || getPreferredLegacyOwnerEmailKey(emailKey);
  if (preferredOwner && preferredOwner !== emailKey) return null;

  try {
    localStorage.setItem(scopedKey, legacyRaw);
  } catch {
    return null;
  }

  migrationState[prefix] = preferredOwner || emailKey;
  writeStorageMigrationState(migrationState);
  return legacyRaw;
}

function readScopedHistory(email) {
  const scopedKey = getScopedStorageKey(RECENT_HISTORY_KEY_PREFIX, email);
  if (!scopedKey) return [];

  const raw =
    localStorage.getItem(scopedKey) ?? migrateLegacyValueIfNeeded(RECENT_HISTORY_KEY_PREFIX, email);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isLibraryActivitySavingAllowed() {
  const email = getActiveEmail() || "guest";
  const key = getScopedStorageKey(LIBRARY_SETTINGS_KEY_PREFIX, email);
  if (!key) return true;

  try {
    const settings = JSON.parse(localStorage.getItem(key) || "{}");
    return settings?.saveActivity !== false;
  } catch {
    return true;
  }
}

// ── URL PARAMS ──
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const cleanPathMatch = window.location.pathname.match(/^\/books\/([^/]+)(?:\/|$)/);
  return { id: params.get("id") || cleanPathMatch?.[1] || "", title: params.get("title") || "" };
}

// ── FETCH BOOKS ──
async function fetchAllBooks() {
  try {
    const res = await fetch(`${API_BASE}/pdfs`);
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch books:", err);
    return [];
  }
}

// ── FIND BOOK ──
function findBook(books, params) {
  if (params.id) {
    const byId = books.find((b) => String(b.id) === String(params.id));
    if (byId) return byId;
  }
  if (params.title) {
    return books.find(
      (b) =>
        b.title.toLowerCase() ===
        decodeURIComponent(params.title).toLowerCase()
    );
  }
  return null;
}

// ── HELPERS ──
function hasVideo(book) {
  return Boolean(book?.video_url || book?.has_video || getVideoDriveId(book));
}

function normalizeDriveAssetId(value) {
  const id = String(value || "").trim();
  if (!id) return "";
  const lowered = id.toLowerCase();
  const placeholderText = lowered
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const emptyAssetLabels = new Set([
    "no poster available",
    "no cover available",
    "no image available",
    "no pdf available",
    "no epub available",
    "no video available",
    "no video",
    "no file available",
    "not available",
    "video not available",
    "file not available",
    "file does not exist",
    "file not found",
    "missing",
    "none",
    "null",
    "undefined",
    "n a",
    "na",
    "0",
    "-",
  ]);

  if (emptyAssetLabels.has(placeholderText) || placeholderText.includes("file you have requested does not exist")) {
    return "";
  }

  try {
    const url = new URL(id);
    const queryId = url.searchParams.get("id");
    if (queryId) return queryId.trim();

    const pathMatch = url.pathname.match(/\/(?:file\/d|folders)\/([^/]+)/);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]).trim();
  } catch {
    // Plain Drive IDs are expected, so non-URL values are fine.
  }

  const inlineMatch = id.match(/(?:\/d\/|id=|\/folders\/)([A-Za-z0-9_-]{10,})/);
  if (inlineMatch?.[1]) return inlineMatch[1].trim();

  return id;
}

function getNumericBookId(value) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function buildReaderDocumentId(book, format, fallbackValue = "") {
  const normalizedFallback = normalizeDriveAssetId(fallbackValue);
  if (normalizedFallback && /^book:\d+:(pdf|epub)$/i.test(normalizedFallback)) {
    return normalizedFallback;
  }

  const bookId = getNumericBookId(book?.id);
  const hasReadableFormat = format === "epub"
    ? Boolean(book?.has_epub || normalizedFallback)
    : Boolean(book?.has_pdf || normalizedFallback);

  if (bookId && hasReadableFormat) {
    return `book:${bookId}:${format}`;
  }

  return normalizedFallback;
}

function isLikelyDriveFileId(value) {
  const id = normalizeDriveAssetId(value);
  return /^[A-Za-z0-9_-]{10,}$/.test(id) ? id : "";
}

function getVideoDriveId(book) {
  return isLikelyDriveFileId(book?.video_drive_id);
}

function getResolvedVideoUrl(book) {
  const rawUrl = String(book?.video_url || "").trim();
  if (rawUrl) {
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    return `${resolveApiOrigin()}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`;
  }

  const bookId = getNumericBookId(book?.id);
  if (bookId) {
    return `${resolveApiOrigin()}/api/video/book/${encodeURIComponent(bookId)}/stream`;
  }

  const driveId = getVideoDriveId(book);
  return driveId ? `${resolveApiOrigin()}/api/video/${encodeURIComponent(driveId)}` : "";
}

function hasPoster(book) {
  return Boolean(normalizeDriveAssetId(book?.poster_drive_id));
}

function getBookCoverDriveId(book) {
  return (
    normalizeDriveAssetId(book?.poster_url) ||
    normalizeDriveAssetId(book?.cover_url) ||
    normalizeDriveAssetId(book?.poster_drive_id) ||
    normalizeDriveAssetId(book?.cover_drive_id)
  );
}

function getDriveThumbnailUrl(driveId, size = "w400") {
  const safeId = normalizeDriveAssetId(driveId);
  if (!safeId) return "";
  if (safeId.startsWith("/api/")) return `${resolveApiOrigin()}${safeId}`;
  if (/^https?:\/\//i.test(safeId)) return safeId;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(safeId)}&sz=${size}`;
}

function getDriveFileViewUrl(driveId) {
  const safeId = normalizeDriveAssetId(driveId);
  if (!safeId) return "";
  return `https://drive.google.com/file/d/${encodeURIComponent(safeId)}/view`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slugifyPublicUrlPart(value, fallback = "book") {
  const slug = String(value || "")
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
  return slug || fallback;
}

function buildPublicBookUrl(book, { absolute = false } = {}) {
  const id = String(book?.id ?? "").trim();
  const title = String(book?.title || "Untitled").trim();
  const author = String(book?.author || book?.creator || "").trim();
  const path = id
    ? `/books/${encodeURIComponent(id)}/${slugifyPublicUrlPart([title, author].filter(Boolean).join(" "))}/`
    : `/books/`;
  return absolute ? `${PUBLIC_SITE_ORIGIN}${path}` : path;
}

function getBookSeoDescription(book) {
  const fallback = `${book?.title || "This book"} by ${book?.author || "Unknown author"} is available in E-Library.`;
  return truncateText(book?.description || fallback, 180);
}

function getBookSeoImage(book) {
  const coverId = getBookCoverDriveId(book);
  return coverId ? getDriveThumbnailUrl(coverId, "w800") : `${PUBLIC_SITE_ORIGIN}/favicon.png`;
}

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
}

function upsertCanonical(href) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

function upsertJsonLd(id, data) {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement("script");
    element.id = id;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data);
}

function updateBookSeoMetadata(book) {
  if (!book) return;

  const title = `${book.title || "Book"} by ${book.author || "Unknown Author"} | E-Library`;
  const description = getBookSeoDescription(book);
  const canonical = buildPublicBookUrl(book, { absolute: true });
  const image = getBookSeoImage(book);
  const formats = getFormatLabels(book, false);

  document.title = title;
  upsertCanonical(canonical);
  upsertMeta('meta[name="description"]', { name: "description", content: description });
  upsertMeta('meta[name="robots"]', { name: "robots", content: "noindex, follow" });
  upsertMeta('meta[property="og:type"]', { property: "og:type", content: "book" });
  upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "E-Library" });
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
  upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
  upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
  upsertMeta('meta[property="og:image"]', { property: "og:image", content: image });
  upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
  upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });
  upsertJsonLd("book-json-ld", {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title || "Book",
    author: book.author ? { "@type": "Person", name: book.author } : undefined,
    description,
    url: canonical,
    image,
    encodingFormat: formats.map((format) => (format === "PDF" ? "application/pdf" : "application/epub+zip")),
    isAccessibleForFree: !book.payment_required,
    publisher: {
      "@type": "Organization",
      name: "E-Library",
      url: PUBLIC_SITE_ORIGIN,
    },
  });
}

function getReadableFormats(book) {
  const formats = [];
  const pdfDriveId = buildReaderDocumentId(book, "pdf", book?.pdf_drive_id);
  const epubDriveId = buildReaderDocumentId(book, "epub", book?.epub_drive_id);

  if (pdfDriveId) {
    formats.push({
      key: "pdf",
      label: "PDF",
      icon: "menu_book",
      driveId: pdfDriveId,
    });
  }

  if (epubDriveId) {
    formats.push({
      key: "epub",
      label: "EPUB",
      icon: "auto_stories",
      driveId: epubDriveId,
    });
  }

  return formats;
}

function getFormatLabels(book, includeVideo = true) {
  const labels = getReadableFormats(book).map((format) => format.label);
  if (includeVideo && hasVideo(book)) labels.push("Video Preview");
  return labels.length > 0 ? labels : ["Not available"];
}

function getActiveReadableFormat(book) {
  const formats = getReadableFormats(book);
  if (formats.length === 0) return null;
  return formats.find((format) => format.key === selectedReadFormat) || formats[0];
}

function buildFormatOptionMarkup(format, isActive) {
  return `
    <button
      type="button"
      class="format-option${isActive ? " active" : ""}"
      data-format-option="${format.key}"
      role="radio"
      aria-checked="${isActive ? "true" : "false"}"
    >
      <span class="material-symbols-outlined">${format.icon}</span>
      <span>${format.label}</span>
    </button>
  `;
}

function buildFormatSwitcherMarkup(book, extraClass = "") {
  const formats = getReadableFormats(book);
  if (formats.length < 2) return "";

  const activeFormat = getActiveReadableFormat(book) || formats[0];
  const shellClass = ["format-switcher-shell", extraClass].filter(Boolean).join(" ");
  return `
    <div class="${shellClass}">
      <span class="format-switcher-label">Choose format</span>
      <div class="format-switcher" role="radiogroup" aria-label="Choose reading format">
        ${formats
          .map((format) => buildFormatOptionMarkup(format, format.key === activeFormat.key))
          .join("")}
      </div>
    </div>
  `;
}

function formatMoney(amountPaise, currency = "INR") {
  const amount = Number(amountPaise || 0) / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: String(currency || "INR").toUpperCase(),
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `INR ${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
  }
}

function getPremiumAccessDetails(book) {
  const paymentsEnabled = Boolean(book?.payments_enabled);
  const sitePremiumEnabled = Boolean(book?.site_premium_enabled);
  const bookPremiumEnabled = Boolean(book?.book_premium_enabled);
  const paymentRequired = Boolean(book?.payment_required) && paymentsEnabled;
  const previewPageLimit = Math.max(1, Number(book?.preview_page_limit || 10));
  const currency = String(book?.payment_currency || "INR").trim().toUpperCase() || "INR";
  const monthlyPricePaise = Number(book?.site_monthly_price_paise || 0);
  const annualPricePaise = Number(book?.site_annual_price_paise || 0);
  const bookPricePaise = Number(book?.book_price_paise || 0);
  const bookAccessDurationDays =
    book?.book_access_duration_days === null || book?.book_access_duration_days === undefined
      ? null
      : Number(book.book_access_duration_days || 0);

  if (!paymentRequired) {
    return {
      paymentRequired: false,
      previewPageLimit,
      badgeText: "",
      buttonLabel: "Read Now",
      accessSummary: "Free to Read",
      noteText: "",
    };
  }

  const sitePriceParts = [];
  if (sitePremiumEnabled && monthlyPricePaise > 0) {
    sitePriceParts.push(`${formatMoney(monthlyPricePaise, currency)}/month`);
  }
  if (sitePremiumEnabled && annualPricePaise > 0) {
    sitePriceParts.push(`${formatMoney(annualPricePaise, currency)}/year`);
  }

  const bookPriceLabel = bookPremiumEnabled && bookPricePaise > 0
    ? (
      bookAccessDurationDays == null
        ? `${formatMoney(bookPricePaise, currency)} one-time`
        : `${formatMoney(bookPricePaise, currency)} for ${bookAccessDurationDays} day${bookAccessDurationDays === 1 ? "" : "s"}`
    )
    : "";

  if (sitePremiumEnabled && bookPremiumEnabled) {
    return {
      paymentRequired: true,
      previewPageLimit,
      badgeText: "Premium Access",
      buttonLabel: "Preview & Unlock",
      accessSummary: `Preview first ${previewPageLimit} pages, then unlock with site premium or this book purchase.`,
      noteText: [sitePriceParts.join(" • "), bookPriceLabel].filter(Boolean).join(" • "),
    };
  }

  if (sitePremiumEnabled) {
    return {
      paymentRequired: true,
      previewPageLimit,
      badgeText: "Premium",
      buttonLabel: "Preview & Unlock",
      accessSummary: `Preview first ${previewPageLimit} pages, then subscribe to unlock the full library.`,
      noteText: sitePriceParts.join(" • "),
    };
  }

  return {
    paymentRequired: true,
    previewPageLimit,
    badgeText: "Paid Book",
    buttonLabel: "Preview & Unlock",
    accessSummary: `Preview first ${previewPageLimit} pages, then buy this book to keep reading.`,
    noteText: bookPriceLabel,
  };
}

function renderPaymentAccess(book) {
  const details = getPremiumAccessDetails(book);
  const badges = [
    document.getElementById("premium-access-badge"),
    document.getElementById("hero-premium-access-badge"),
  ].filter(Boolean);
  const notes = [
    document.getElementById("payment-access-note"),
    document.getElementById("hero-payment-access-note"),
  ].filter(Boolean);
  const accessStatus = document.getElementById("detail-access-status");

  badges.forEach((badge) => {
    if (details.paymentRequired) {
      badge.textContent = details.badgeText;
      badge.classList.remove("hidden");
      badge.title = details.noteText || details.accessSummary;
    } else {
      badge.textContent = "";
      badge.classList.add("hidden");
      badge.removeAttribute("title");
    }
  });

  notes.forEach((note) => {
    if (details.paymentRequired) {
      note.textContent = [details.accessSummary, details.noteText].filter(Boolean).join(" ");
      note.classList.remove("hidden");
    } else {
      note.textContent = "";
      note.classList.add("hidden");
    }
  });

  if (accessStatus) {
    accessStatus.textContent = details.paymentRequired
      ? [details.accessSummary, details.noteText].filter(Boolean).join(" ")
      : "Free to Read";
  }
}

function updateReadButtons(book) {
  const activeFormat = getActiveReadableFormat(book);
  const access = getPremiumAccessDetails(book);
  document.querySelectorAll("[data-read-action], #btn-read-pdf, #hero-read-pdf-btn").forEach((button) => {
    if (!button) return;
    if (!activeFormat) {
      button.disabled = true;
      button.innerHTML = `
        <span class="material-symbols-outlined">block</span>
        Not Available
      `;
      return;
    }

    button.disabled = false;
    button.innerHTML = `
      <span class="material-symbols-outlined">${activeFormat.icon}</span>
      ${access.buttonLabel}
    `;
    button.setAttribute(
      "aria-label",
      access.paymentRequired
        ? `Preview ${activeFormat.label} and unlock ${book.title || "this book"}`
        : `Read ${activeFormat.label} for ${book.title || "this book"}`,
    );
  });
}

function setSelectedReadFormat(book, formatKey) {
  const formats = getReadableFormats(book);
  if (!formats.some((format) => format.key === formatKey)) return;

  selectedReadFormat = formatKey;
  document.querySelectorAll("[data-format-option]").forEach((button) => {
    const isActive = button.dataset.formatOption === selectedReadFormat;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-checked", isActive ? "true" : "false");
  });
  updateReadButtons(book);
}

function wireFormatSwitcher(book, container = document) {
  container.querySelectorAll("[data-format-option]").forEach((button) => {
    button.addEventListener("click", () => {
      setSelectedReadFormat(book, button.dataset.formatOption);
    });
  });
}

function renderFormatSwitcher(book) {
  const shell = document.getElementById("format-switcher-shell");
  const switcher = document.getElementById("format-switcher");
  if (!shell || !switcher) return;

  const formats = getReadableFormats(book);
  if (formats.length < 2) {
    shell.classList.add("hidden");
    switcher.innerHTML = "";
    return;
  }

  const activeFormat = getActiveReadableFormat(book) || formats[0];
  shell.classList.remove("hidden");
  switcher.innerHTML = formats
    .map((format) => buildFormatOptionMarkup(format, format.key === activeFormat.key))
    .join("");
  wireFormatSwitcher(book, shell);
}

function openReadableFormat(book) {
  const activeFormat = getActiveReadableFormat(book);
  if (!activeFormat) {
    alert("This book does not have a readable PDF or EPUB file yet.");
    return;
  }

  if (activeFormat.key === "pdf") {
    saveBookToRecentHistory({ ...book, pdf_drive_id: activeFormat.driveId });
    window.location.href = `view-pdf.html?id=${encodeURIComponent(activeFormat.driveId)}&title=${encodeURIComponent(book.title || "Book")}`;
    return;
  }

  if (activeFormat.key === "epub") {
    saveBookToRecentHistory({ ...book, epub_drive_id: activeFormat.driveId });
    window.location.href = `view-epub.html?id=${encodeURIComponent(activeFormat.driveId)}&title=${encodeURIComponent(book.title || "Book")}`;
  }
}

function getBookInitials(title) {
  const words = String(title || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "BK";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function createCoverFallbackElement(title, className = "") {
  const fallback = document.createElement("div");
  fallback.className = `${className} book-cover-fallback`.trim();
  fallback.setAttribute("aria-hidden", "true");
  const initials = document.createElement("span");
  initials.textContent = getBookInitials(title);
  fallback.appendChild(initials);
  return fallback;
}

function createCoverNode(book, options = {}) {
  const {
    className = "",
    fallbackClassName = "",
    size = "w400",
    altText = String(book?.title || "Book cover"),
  } = options;

  const coverId = getBookCoverDriveId(book);
  if (!coverId) {
    return createCoverFallbackElement(altText, `${className} ${fallbackClassName}`.trim());
  }

  const img = document.createElement("img");
  img.className = className;
  img.alt = altText;
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.src = getDriveThumbnailUrl(coverId, size);
  img.addEventListener(
    "error",
    () => {
      const fallback = createCoverFallbackElement(
        altText,
        `${className} ${fallbackClassName}`.trim(),
      );
      img.replaceWith(fallback);
    },
    { once: true },
  );
  return img;
}

function truncateText(text, maxLen) {
  if (!text) return "No description available.";
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen).trim() + "…";
}

function generateTags(book) {
  const tags = [];
  const desc = (book.description || "").toLowerCase();
  const cat = (book.category || "").toLowerCase();

  if (cat.includes("fiction")) tags.push("Literary Fiction", "Classic");
  if (cat.includes("drama")) tags.push("Dramatic", "Emotional");
  if (cat.includes("science")) tags.push("Scientific", "Educational");
  if (cat.includes("history")) tags.push("Historical", "Informative");
  if (cat.includes("philosophy")) tags.push("Philosophical");
  if (cat.includes("poetry")) tags.push("Poetic", "Lyrical");
  if (cat.includes("adventure")) tags.push("Adventurous");

  if (desc.includes("war") || desc.includes("battle")) tags.push("War");
  if (desc.includes("love") || desc.includes("romance")) tags.push("Romance");
  if (desc.includes("mystery") || desc.includes("detective"))
    tags.push("Mystery");
  if (
    desc.includes("horror") ||
    desc.includes("vampire") ||
    desc.includes("dark")
  )
    tags.push("Gothic");
  if (desc.includes("fantasy") || desc.includes("magic")) tags.push("Fantasy");

  if (tags.length === 0) tags.push("Engaging", "Well-Written");
  return tags.slice(0, 4);
}

function historyKey(item) {
  const driveId =
    normalizeDriveAssetId(item?.pdf_drive_id) ||
    normalizeDriveAssetId(item?.epub_drive_id);
  if (driveId) return `drive:${driveId}`;

  const id = String(item?.id ?? "").trim();
  if (id) return `id:${id}`;

  return `title:${String(item?.title || "").trim().toLowerCase()}`;
}

function saveBookToRecentHistory(book) {
  if (!book || !book.title) return;
  if (!isLibraryActivitySavingAllowed()) return;
  const activeEmail = getActiveEmail();
  if (!activeEmail) return;

  const entry = {
    id: book.id ?? Date.now(),
    title: String(book.title || "").trim() || "Untitled",
    pdf_drive_id: buildReaderDocumentId(book, "pdf", book.pdf_drive_id) || null,
    epub_drive_id: buildReaderDocumentId(book, "epub", book.epub_drive_id) || null,
  };

  const historyStorageKey = getScopedStorageKey(RECENT_HISTORY_KEY_PREFIX, activeEmail);
  if (!historyStorageKey) return;

  let userHistory = readScopedHistory(activeEmail);

  userHistory = userHistory
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: item.id ?? Date.now(),
      title: String(item.title || "").trim(),
      pdf_drive_id: normalizeDriveAssetId(item.pdf_drive_id) || null,
      epub_drive_id: normalizeDriveAssetId(item.epub_drive_id) || null,
    }))
    .filter((item) => item.title.length > 0);

  const key = historyKey(entry);
  userHistory = userHistory.filter((item) => historyKey(item) !== key);
  userHistory.unshift(entry);
  localStorage.setItem(historyStorageKey, JSON.stringify(userHistory.slice(0, 200)));
}

function getMyListOwnerEmail() {
  return getActiveEmail() || "guest";
}

function myListKey(item) {
  const pdfDriveId = normalizeDriveAssetId(item?.pdf_drive_id);
  if (pdfDriveId) return `pdf:${pdfDriveId}`;

  const epubDriveId = normalizeDriveAssetId(item?.epub_drive_id);
  if (epubDriveId) return `epub:${epubDriveId}`;

  const id = String(item?.id ?? "").trim();
  if (id) return `id:${id}`;

  return `title:${String(item?.title || "").trim().toLowerCase()}`;
}

function sanitizeMyList(list) {
  if (!Array.isArray(list)) return [];

  const seen = new Set();
  const sanitized = [];

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;

    const title = String(raw.title || "").trim();
    if (!title) continue;

    const item = {
      id: raw.id ?? "",
      title,
      author: String(raw.author || "Unknown Author").trim() || "Unknown Author",
      category: String(raw.category || "Book").trim() || "Book",
      pdf_drive_id: normalizeDriveAssetId(raw.pdf_drive_id) || null,
      epub_drive_id: normalizeDriveAssetId(raw.epub_drive_id) || null,
      poster_url: String(raw.poster_url || "").trim() || null,
      cover_url: String(raw.cover_url || "").trim() || null,
      poster_drive_id: normalizeDriveAssetId(raw.poster_drive_id) || null,
      cover_drive_id: normalizeDriveAssetId(raw.cover_drive_id) || null,
      addedAt: Number(raw.addedAt || Date.now()),
    };

    const key = myListKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    sanitized.push(item);
  }

  return sanitized.slice(0, 500);
}

function loadMyList() {
  const storageKey = getScopedStorageKey(MY_LIST_KEY_PREFIX, getMyListOwnerEmail());
  if (!storageKey) return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return sanitizeMyList(parsed);
  } catch {
    return [];
  }
}

function saveMyList(list) {
  const storageKey = getScopedStorageKey(MY_LIST_KEY_PREFIX, getMyListOwnerEmail());
  if (!storageKey) return;

  try {
    localStorage.setItem(storageKey, JSON.stringify(sanitizeMyList(list)));
  } catch {
    // Ignore storage write errors.
  }
}

function buildMyListEntry(book) {
  return {
    id: book?.id ?? "",
    title: String(book?.title || "Untitled").trim() || "Untitled",
    author: String(book?.author || "Unknown Author").trim() || "Unknown Author",
    category: String(book?.category || "Book").trim() || "Book",
    pdf_drive_id: normalizeDriveAssetId(book?.pdf_drive_id) || null,
    epub_drive_id: normalizeDriveAssetId(book?.epub_drive_id) || null,
    poster_url: String(book?.poster_url || "").trim() || null,
    cover_url: String(book?.cover_url || "").trim() || null,
    poster_drive_id: normalizeDriveAssetId(book?.poster_drive_id) || null,
    cover_drive_id: normalizeDriveAssetId(book?.cover_drive_id) || null,
    addedAt: Date.now(),
  };
}

function isBookInMyList(book) {
  const key = myListKey(buildMyListEntry(book));
  return loadMyList().some((item) => myListKey(item) === key);
}

function toggleBookInMyList(book) {
  const entry = buildMyListEntry(book);
  const key = myListKey(entry);
  const list = loadMyList();
  const exists = list.some((item) => myListKey(item) === key);

  if (exists) {
    saveMyList(list.filter((item) => myListKey(item) !== key));
    return false;
  }

  saveMyList([entry, ...list.filter((item) => myListKey(item) !== key)]);
  return true;
}

function updateMyListButtons(book) {
  const saved = isBookInMyList(book);
  document.querySelectorAll("#btn-add-list, #hero-add-list-btn").forEach((button) => {
    const iconName = saved ? "check" : "add";
    button.classList.toggle("my-list-active", saved);
    button.setAttribute("aria-pressed", String(saved));
    button.innerHTML = `
      <span class="material-symbols-outlined">${iconName}</span>
      ${saved ? "In My List" : "My List"}
    `;
  });
}

function wireMyListButtons(book) {
  document.querySelectorAll("#btn-add-list, #hero-add-list-btn").forEach((button) => {
    if (button.dataset.myListReady === "true") return;
    button.dataset.myListReady = "true";
    button.addEventListener("click", () => {
      toggleBookInMyList(book);
      updateMyListButtons(book);
    });
  });

  updateMyListButtons(book);
}

// ═══════════════════════════════════════════
// RENDER HERO — Poster first → then video
// ═══════════════════════════════════════════
function renderHero(book) {
  const heroSection = document.getElementById("hero-section");
  const heroVideo = document.getElementById("hero-video");
  const heroPoster = document.getElementById("hero-poster");
  const heroVideoError = document.getElementById("hero-video-error");
  const heroVideoRetry = document.getElementById("hero-video-retry");
  const heroTitle = document.getElementById("hero-title");
  const heroOverlay = document.getElementById("hero-title-overlay");

  heroTitle.textContent = book.title;

  if (hasVideo(book)) {
    heroSection.classList.remove("no-video-state");
    heroSection.classList.add("loading");
    heroVideo.style.display = "block";
    heroVideo.classList.remove("is-hidden");
    heroPoster.style.display = "block";
    heroPoster.classList.remove("fade-out");
    if (heroVideoError) heroVideoError.classList.add("hidden");
    if (heroOverlay) heroOverlay.classList.remove("subtle");

    const posterId = getBookCoverDriveId(book);
    const posterUrl = posterId ? getDriveThumbnailUrl(posterId, "w1280") : "";
    if (posterId) {
      heroPoster.src = posterUrl;
      heroPoster.style.display = "block";
      heroVideo.poster = posterUrl;
    } else {
      heroPoster.removeAttribute("src");
      heroVideo.removeAttribute("poster");
      heroPoster.style.display = "none";
    }

    const showPosterState = () => {
      heroSection.classList.remove("loading");
      heroPoster.classList.remove("fade-out");
      if (heroVideoError) heroVideoError.classList.add("hidden");
      if (heroOverlay) heroOverlay.classList.remove("subtle");
    };

    const showPlaybackState = () => {
      heroSection.classList.remove("loading");
      heroVideo.classList.remove("is-hidden");
      heroPoster.classList.add("fade-out");
      if (heroVideoError) heroVideoError.classList.add("hidden");
      if (heroOverlay) heroOverlay.classList.add("subtle");
    };

    const showErrorState = () => {
      heroSection.classList.remove("loading");
      heroVideo.classList.add("is-hidden");
      heroPoster.classList.remove("fade-out");
      if (heroVideoError) heroVideoError.classList.remove("hidden");
      if (heroOverlay) heroOverlay.classList.add("subtle");
    };

    heroVideo.controls = true;
    heroVideo.playsInline = true;
    heroVideo.setAttribute("playsinline", "");
    heroVideo.setAttribute("webkit-playsinline", "true");
    heroVideo.setAttribute("controlslist", "nodownload noplaybackrate");
    heroVideo.setAttribute("disablepictureinpicture", "true");

    heroVideo.onloadedmetadata = () => {
      heroSection.classList.remove("loading");
    };
    heroVideo.oncanplay = () => {
      heroSection.classList.remove("loading");
    };
    heroVideo.onplay = showPlaybackState;
    heroVideo.onpause = () => {
      if ((heroVideo.currentTime || 0) <= 0.1) {
        showPosterState();
      }
    };
    heroVideo.onended = showPosterState;
    heroVideo.onerror = showErrorState;
    heroVideo.onabort = () => {
      heroSection.classList.remove("loading");
    };
    heroVideo.onstalled = () => {
      heroSection.classList.remove("loading");
    };

    const videoUrl = getResolvedVideoUrl(book);
    if (heroVideoRetry) {
      heroVideoRetry.onclick = () => {
        heroSection.classList.add("loading");
        heroVideo.classList.remove("is-hidden");
        if (heroVideoError) heroVideoError.classList.add("hidden");
        heroPoster.classList.remove("fade-out");
        if (videoUrl) {
          heroVideo.src = videoUrl;
          heroVideo.load();
        } else {
          showErrorState();
        }
      };
    }

    if (!videoUrl) {
      showErrorState();
      return;
    }

    if (heroVideo.dataset.videoSrc !== videoUrl) {
      heroVideo.pause();
      heroVideo.src = videoUrl;
      heroVideo.dataset.videoSrc = videoUrl;
    }
    heroVideo.load();
  } else {
    // No video — show poster + complete info layout
    heroSection.classList.remove("loading");
    heroVideo.pause();
    heroVideo.removeAttribute("src");
    heroVideo.removeAttribute("poster");
    heroVideo.load();
    heroVideo.style.display = "none";
    heroVideo.classList.remove("is-hidden");
    heroPoster.removeAttribute("src");
    heroPoster.style.display = "none";
    heroPoster.classList.remove("fade-out");
    if (heroVideoError) heroVideoError.classList.add("hidden");
    if (heroOverlay) heroOverlay.classList.remove("subtle");
    heroSection.classList.add("no-video-state");

    const formats = getFormatLabels(book);
    const safeTitle = escapeHtml(book.title || "Untitled");
    const safeCategory = escapeHtml(book.category || "Fiction");
    const safeDescription = escapeHtml(truncateText(book.description, 160));
    const safeAuthor = escapeHtml(book.author || "Unknown Author");

     heroSection.innerHTML = `
      <div class="hero-no-video-content">
        <div class="hero-no-video-cover-slot"></div>
        <div class="hero-no-video-info">
          <h1>${safeTitle}</h1>
          <div class="info-meta">
            <span class="match-badge">98% Match</span>
            <span class="rating-badge">U/A 13+</span>
            <span class="category-badge">${safeCategory}</span>
            <span class="premium-access-badge hidden" id="hero-premium-access-badge"></span>
          </div>
          <p class="info-description">${safeDescription}</p>

          ${buildFormatSwitcherMarkup(book, "hero-format-switcher-shell")}

          <!-- Action Buttons -->
          <div class="action-buttons" style="margin-top: 18px;">
            <button class="btn-apple-primary" id="hero-read-pdf-btn" data-read-action="primary">
              <span class="material-symbols-outlined">menu_book</span>
              Read Now
            </button>
            <button class="btn-apple-secondary" id="hero-add-list-btn">
              <span class="material-symbols-outlined">add</span>
              My List
            </button>
          </div>
          <p class="payment-access-note hidden" id="hero-payment-access-note"></p>

          <!-- Author / Category / Format -->
          <div class="hero-no-video-meta" style="margin-top: 20px; display: flex; gap: 32px; flex-wrap: wrap;">
            <div>
              <span class="meta-label">Author</span>
              <span class="meta-value">${safeAuthor}</span>
            </div>
            <div>
              <span class="meta-label">Category</span>
              <span class="meta-value">${escapeHtml(book.category || "Uncategorized")}</span>
            </div>
            <div>
              <span class="meta-label">Format</span>
              <span class="meta-value">${escapeHtml(formats.join(", "))}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const heroNoVideoCoverSlot = heroSection.querySelector(
      ".hero-no-video-cover-slot",
    );
    if (heroNoVideoCoverSlot) {
      heroNoVideoCoverSlot.replaceWith(
        createCoverNode(book, {
          className: "hero-no-video-poster",
          fallbackClassName: "hero-no-video-poster-fallback",
          size: "w800",
          altText: book.title || "Book cover",
        }),
      );
    }

    wireFormatSwitcher(book, heroSection);
    updateReadButtons(book);
    renderPaymentAccess(book);

    // Wire up the hero Read Now button
    const heroReadBtn = document.getElementById("hero-read-pdf-btn");
    if (heroReadBtn) {
      heroReadBtn.addEventListener("click", () => {
        openReadableFormat(book);
      });
    }
    wireMyListButtons(book);
  }
}

// ═══════════════════════════════════════════
// RENDER INFO — Short description, no duplicates
// ═══════════════════════════════════════════
function renderInfo(book) {
  document.getElementById("info-description").textContent = truncateText(
    book.description,
    160
  );
  document.getElementById("category-badge").textContent =
    book.category || "Fiction";
  document.getElementById("meta-author").textContent =
    book.author || "Unknown Author";
  document.getElementById("meta-category").textContent =
    book.category || "Uncategorized";

  document.getElementById("meta-format").textContent = getFormatLabels(book).join(", ");
  renderFormatSwitcher(book);
  updateReadButtons(book);
  renderPaymentAccess(book);

  const readBtn = document.getElementById("btn-read-pdf");
  if (readBtn) {
    readBtn.addEventListener("click", () => {
      openReadableFormat(book);
    });
  }
  wireMyListButtons(book);

  updateBookSeoMetadata(book);
}

// ═══════════════════════════════════════════
// RENDER DETAILS — Compact
// ═══════════════════════════════════════════
function renderDetails(book) {
  document.getElementById("detail-author").textContent =
    book.author || "Unknown Author";
  document.getElementById("detail-category").textContent =
    book.category || "Uncategorized";

  const tags = generateTags(book);
  document.getElementById("detail-tags").textContent = tags.join(", ");

  const readableFormats = getReadableFormats(book).map((format) => format.label);
  document.getElementById("detail-format").textContent =
    readableFormats.length > 0
      ? `${readableFormats.join(" + ")} ${readableFormats.length > 1 ? "Documents" : "Document"}`
      : "Not available";
  document.getElementById("detail-video-status").textContent = hasVideo(book)
    ? "✓ Available"
    : "—  Not available";
  renderPaymentAccess(book);

  document.getElementById("detail-full-desc").textContent = truncateText(
    book.description,
    140
  );
}

// ═══════════════════════════════════════════
// RENDER RECOMMENDATIONS
// ═══════════════════════════════════════════
function renderRecommendations(allBooks, currentBook, containerId, limit) {
  const container = document.getElementById(containerId);
  if (!container) return;
  limit = limit || 10;

  const posterBooks = getPosterRecommendationBooks(allBooks, currentBook);
  const sameCat = shuffleDetailBooks(
    posterBooks.filter((b) => b.category === currentBook.category),
  );
  const others = shuffleDetailBooks(
    posterBooks.filter((b) => b.category !== currentBook.category),
  );

  const recommendations = [...sameCat, ...others].slice(0, limit);
  container.innerHTML = "";

  recommendations.forEach((book) => {
    container.appendChild(createRecommendationCard(book));
  });
}

function getDetailBookKey(book) {
  const id = String(book?.id ?? "").trim();
  if (id) return `id:${id}`;

  const pdfId = normalizeDriveAssetId(book?.pdf_drive_id);
  if (pdfId) return `pdf:${pdfId}`;

  const epubId = normalizeDriveAssetId(book?.epub_drive_id);
  if (epubId) return `epub:${epubId}`;

  return `title:${String(book?.title || "").trim().toLowerCase()}`;
}

function getPosterRecommendationBooks(allBooks, currentBook) {
  const currentKey = getDetailBookKey(currentBook);
  return (Array.isArray(allBooks) ? allBooks : []).filter((book) => {
    if (!book || typeof book !== "object") return false;
    if (getDetailBookKey(book) === currentKey) return false;
    return Boolean(getBookCoverDriveId(book));
  });
}

function shuffleDetailBooks(books) {
  const copy = Array.isArray(books) ? books.slice() : [];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildBookDetailUrl(book) {
  return buildPublicBookUrl(book);
}

function createRecommendationCard(book) {
  const card = document.createElement("a");
  card.className = "reco-card";
  card.href = buildBookDetailUrl(book);
  card.dataset.bookKey = getDetailBookKey(book);

  const coverNode = createCoverNode(book, {
    className: "reco-card-cover",
    fallbackClassName: "reco-cover-fallback",
    size: "w400",
    altText: book.title || "Book cover",
  });
  card.appendChild(coverNode);

  const info = document.createElement("div");
  info.className = "reco-card-info";

  const title = document.createElement("div");
  title.className = "reco-card-title";
  title.textContent = book.title || "Untitled";

  const author = document.createElement("div");
  author.className = "reco-card-author";
  author.textContent = book.author || "";

  const category = document.createElement("span");
  category.className = "reco-card-category";
  category.textContent = book.category || "";

  info.appendChild(title);
  info.appendChild(author);
  info.appendChild(category);
  card.appendChild(info);

  return card;
}

function takePosterRow(source, usedKeys, limit = 10) {
  const picked = [];
  for (const book of source) {
    if (picked.length >= limit) break;
    const key = getDetailBookKey(book);
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    picked.push(book);
  }
  return picked;
}

function renderExtraRecommendationRows(allBooks, currentBook) {
  document.querySelectorAll("[data-extra-reco-section]").forEach((section) => {
    section.remove();
  });

  const anchor = document.getElementById("trending-section");
  if (!anchor) return;

  const posterBooks = shuffleDetailBooks(getPosterRecommendationBooks(allBooks, currentBook));
  if (posterBooks.length === 0) return;

  const usedKeys = new Set();
  document.querySelectorAll("#reco-row .reco-card, #trending-row .reco-card").forEach((card) => {
    const key = card.getAttribute("data-book-key");
    if (key) usedKeys.add(key);
  });

  const rowConfigs = [
    {
      title: "Fresh From The Library",
      books: shuffleDetailBooks(posterBooks),
    },
  ];

  let insertAfter = anchor;
  rowConfigs.forEach((config) => {
    let rowBooks = takePosterRow(config.books, usedKeys, 10);
    if (rowBooks.length < 10) {
      rowBooks = rowBooks.concat(
        takePosterRow(shuffleDetailBooks(posterBooks), usedKeys, 10 - rowBooks.length),
      );
    }
    if (rowBooks.length === 0) return;

    const section = document.createElement("section");
    section.className = "recommendations-section extra-reco-section";
    section.dataset.extraRecoSection = "true";

    const title = document.createElement("h2");
    title.className = "section-title";
    title.textContent = config.title;

    const wrapper = document.createElement("div");
    wrapper.className = "reco-row-wrapper";

    const row = document.createElement("div");
    row.className = "reco-row";
    rowBooks.forEach((book) => {
      row.appendChild(createRecommendationCard(book));
    });

    wrapper.appendChild(row);
    section.appendChild(title);
    section.appendChild(wrapper);
    insertAfter.insertAdjacentElement("afterend", section);
    insertAfter = section;
  });
}

// ═══════════════════════════════════════════
// RENDER TRENDING
// ═══════════════════════════════════════════
function renderTrending(allBooks, currentBook) {
  const container = document.getElementById("trending-row");
  const titleEl = document.getElementById("trending-title");
  if (!container || !titleEl) return;

  const section = document.getElementById("trending-section");
  const posterBooks = getPosterRecommendationBooks(allBooks, currentBook);
  const otherCategories = [
    ...new Set(posterBooks.map((b) => b.category)),
  ].filter((c) => c !== currentBook.category);

  if (posterBooks.length === 0) {
    if (section) section.classList.add("hidden");
    return;
  }

  if (section) section.classList.remove("hidden");

  const randomCat =
    otherCategories.length > 0
      ? otherCategories[Math.floor(Math.random() * otherCategories.length)]
      : "";
  titleEl.textContent = randomCat ? `More in ${randomCat}` : "Featured Recommendations";

  const usedKeys = new Set();
  document.querySelectorAll("#reco-row .reco-card").forEach((card) => {
    const key = card.getAttribute("data-book-key");
    if (key) usedKeys.add(key);
  });

  const preferredBooks = randomCat
    ? posterBooks.filter((book) => book.category === randomCat)
    : posterBooks;
  let trendingBooks = takePosterRow(shuffleDetailBooks(preferredBooks), usedKeys, 10);
  if (trendingBooks.length < 10) {
    trendingBooks = trendingBooks.concat(
      takePosterRow(shuffleDetailBooks(posterBooks), usedKeys, 10 - trendingBooks.length),
    );
  }

  container.innerHTML = "";

  trendingBooks.forEach((book) => {
    container.appendChild(createRecommendationCard(book));
  });
}

// ── SCROLL ARROWS ──
function setupScrollArrows() {
  const row = document.getElementById("reco-row");
  const leftArrow = document.getElementById("reco-arrow-left");
  const rightArrow = document.getElementById("reco-arrow-right");
  if (!row || !leftArrow || !rightArrow) return;

  const scrollAmount = 420;

  leftArrow.addEventListener("click", () => {
    row.scrollBy({ left: -scrollAmount, behavior: "smooth" });
  });
  rightArrow.addEventListener("click", () => {
    row.scrollBy({ left: scrollAmount, behavior: "smooth" });
  });

  row.addEventListener("scroll", () => {
    leftArrow.classList.toggle("hidden", row.scrollLeft <= 10);
    rightArrow.classList.toggle(
      "hidden",
      row.scrollLeft + row.clientWidth >= row.scrollWidth - 10
    );
  });
}

// ── NAV SCROLL ──
function setupNavScroll() {
  const nav = document.querySelector(".detail-nav");
  window.addEventListener("scroll", () => {
    nav.classList.toggle("scrolled", window.scrollY > 50);
  });
}

// ════════════════════════════════════
// INIT
// ════════════════════════════════════
async function init() {
  const params = getUrlParams();

  if (!params.id && !params.title) {
    document.body.innerHTML =
      '<div style="padding:100px 40px;text-align:center;color:#f5f5f7;font-family:Source Serif 4,serif;"><h1>No book selected</h1><p style="margin-top:12px;color:rgba(255,255,255,0.5);">Go back to <a href="index.html" style="color:#0a84ff;">the library</a></p></div>';
    return;
  }

  const allBooks = await fetchAllBooks();
  if (allBooks.length === 0) {
    document.body.innerHTML =
      '<div style="padding:100px 40px;text-align:center;color:#f5f5f7;font-family:Source Serif 4,serif;"><h1>Could not load books</h1><p style="margin-top:12px;color:rgba(255,255,255,0.5);">Make sure the server is running on port 3000</p></div>';
    return;
  }

  const book = findBook(allBooks, params);
  if (!book) {
    document.body.innerHTML =
      '<div style="padding:100px 40px;text-align:center;color:#f5f5f7;font-family:Source Serif 4,serif;"><h1>Book not found</h1><p style="margin-top:12px;color:rgba(255,255,255,0.5);">Go back to <a href="index.html" style="color:#0a84ff;">the library</a></p></div>';
    return;
  }

  selectedReadFormat = getReadableFormats(book)[0]?.key || "pdf";
  window.PDF_LIBRARY_BOOKS = allBooks;
  window.PDF_LIBRARY_CURRENT_BOOK = book;

  renderHero(book);
  renderInfo(book);
  renderDetails(book);
  renderRecommendations(allBooks, book, "reco-row", 10);
  renderTrending(allBooks, book);
  renderExtraRecommendationRows(allBooks, book);
  setupScrollArrows();
  setupNavScroll();

  window.scrollTo(0, 0);
}

init();
