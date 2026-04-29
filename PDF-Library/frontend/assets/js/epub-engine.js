try {
/**
 * Secure EPUB Reader Engine
 *
 * This keeps EPUB as EPUB: the browser receives the protected .epub file,
 * unpacks its XHTML chapters, keeps safe EPUB CSS, and renders reflowable
 * book text inside the website. It does not convert EPUB to PDF.
 */

let zipFile = null;
let chapters = [];
let objectUrls = [];
let currentChapter = 1;
let searchIndex = null;
let shadowRoot = null;
let activeDocumentId = "";
let activeHighlightColor = "yellow";
let lastSelectionData = null;
let isPreviewMode = false;
let epubToastTimer = null;

const readerApp = document.getElementById("epub-reader-app");
const loadingOverlay = document.getElementById("epub-loading");
const contentHost = document.getElementById("epub-content-host");
const chapterList = document.getElementById("epub-chapter-list");
const chaptersPanel = document.getElementById("epub-chapters-panel");
const chaptersButton = document.getElementById("epub-chapters-btn");
const tocIconButton = document.getElementById("epub-toc-icon-btn");
const chaptersCloseButton = document.getElementById("epub-chapters-close");
const typographyButton = document.getElementById("epub-typography-btn");
const typographyPanel = document.getElementById("epub-typography-panel");
const typographyCloseButton = document.getElementById("epub-typography-close");
const searchToggle = document.getElementById("epub-search-toggle");
const searchPanel = document.getElementById("epub-search-panel");
const searchClose = document.getElementById("epub-search-close");
const searchInput = document.getElementById("epub-search-input");
const searchResults = document.getElementById("epub-search-results");
const bookmarkButton = document.getElementById("epub-bookmark-btn");
const prevButton = document.getElementById("epub-prev-btn");
const nextButton = document.getElementById("epub-next-btn");
const currentLabel = document.getElementById("epub-current-label");
const progressLabel = document.getElementById("epub-progress-label");
const progressFill = document.getElementById("epub-progress-fill");
const fontSizeControl = document.getElementById("epub-font-size");
const lineHeightControl = document.getElementById("epub-line-height");
const readingWidthControl = document.getElementById("epub-reading-width");
const fontFamilyControl = document.getElementById("epub-font-family");
const toolTabButtons = Array.from(document.querySelectorAll("[data-tool-tab]"));
const toolPanels = Array.from(document.querySelectorAll("[data-tool-panel]"));
const modeButtons = Array.from(document.querySelectorAll("[data-epub-mode]"));
const highlightsList = document.getElementById("epub-highlights-list");
const notesList = document.getElementById("epub-notes-list");
const bookmarksList = document.getElementById("epub-bookmarks-list");
const noteInput = document.getElementById("epub-note-input");
const saveNoteButton = document.getElementById("epub-save-note");
const selectionPopover = document.getElementById("epub-selection-popover");
const selectionHighlightButton = document.getElementById("epub-selection-highlight");
const selectionNoteButton = document.getElementById("epub-selection-note");
const highlightActionButton = document.getElementById("epub-highlight-selection");
const highlightStatus = document.getElementById("epub-highlight-status");
const highlightColorButtons = Array.from(document.querySelectorAll("[data-highlight-color]"));
const chaptersInitials = document.getElementById("epub-chapters-initials");
const chaptersHero = document.getElementById("epub-chapters-hero");
const panelTitle = document.getElementById("epub-panel-title");
const panelSummary = document.getElementById("epub-panel-summary");
const panelProgress = document.getElementById("epub-panel-progress");
const panelTotal = document.getElementById("epub-panel-total");

const readerSettings = {
  fontSize: 22,
  lineHeight: 176,
  readingWidth: 880,
  fontFamily: "serif",
  mode: "night",
};

const FONT_OPTIONS = [
  "serif",
  "literata",
  "lora",
  "merriweather",
  "garamond",
  "classic",
  "sans",
  "dyslexic",
];

const MODE_OPTIONS = ["night", "paper", "sepia", "focus", "oled"];
const DEFAULT_HIGHLIGHT_COLOR = "yellow";
const HIGHLIGHT_COLORS = {
  yellow: {
    label: "Sun Yellow",
    swatch: "#f8d96a",
    background: "linear-gradient(180deg, rgba(248, 217, 106, 0.24), rgba(248, 217, 106, 0.54))",
    glow: "rgba(248, 217, 106, 0.24)",
  },
  honey: {
    label: "Honey Orange",
    swatch: "#ffae42",
    background: "linear-gradient(180deg, rgba(255, 174, 66, 0.22), rgba(255, 174, 66, 0.5))",
    glow: "rgba(255, 174, 66, 0.24)",
  },
  mint: {
    label: "Mint Green",
    swatch: "#7be7b7",
    background: "linear-gradient(180deg, rgba(123, 231, 183, 0.2), rgba(123, 231, 183, 0.46))",
    glow: "rgba(123, 231, 183, 0.22)",
  },
  sky: {
    label: "Sky Blue",
    swatch: "#83c5ff",
    background: "linear-gradient(180deg, rgba(131, 197, 255, 0.22), rgba(131, 197, 255, 0.48))",
    glow: "rgba(131, 197, 255, 0.22)",
  },
  violet: {
    label: "Soft Violet",
    swatch: "#b69cff",
    background: "linear-gradient(180deg, rgba(182, 156, 255, 0.22), rgba(182, 156, 255, 0.48))",
    glow: "rgba(182, 156, 255, 0.23)",
  },
  rose: {
    label: "Rose Pink",
    swatch: "#ff8fb3",
    background: "linear-gradient(180deg, rgba(255, 143, 179, 0.22), rgba(255, 143, 179, 0.48))",
    glow: "rgba(255, 143, 179, 0.23)",
  },
  coral: {
    label: "Coral",
    swatch: "#ff8d76",
    background: "linear-gradient(180deg, rgba(255, 141, 118, 0.22), rgba(255, 141, 118, 0.48))",
    glow: "rgba(255, 141, 118, 0.23)",
  },
  graphite: {
    label: "Soft Grey",
    swatch: "#b8c0cc",
    background: "linear-gradient(180deg, rgba(184, 192, 204, 0.2), rgba(184, 192, 204, 0.42))",
    glow: "rgba(184, 192, 204, 0.2)",
  },
  lime: {
    label: "Lime Glow",
    swatch: "#c8f76b",
    background: "linear-gradient(180deg, rgba(200, 247, 107, 0.2), rgba(200, 247, 107, 0.46))",
    glow: "rgba(200, 247, 107, 0.22)",
  },
  aqua: {
    label: "Aqua",
    swatch: "#55e6ff",
    background: "linear-gradient(180deg, rgba(85, 230, 255, 0.2), rgba(85, 230, 255, 0.46))",
    glow: "rgba(85, 230, 255, 0.22)",
  },
  lavender: {
    label: "Lavender",
    swatch: "#d7b8ff",
    background: "linear-gradient(180deg, rgba(215, 184, 255, 0.22), rgba(215, 184, 255, 0.48))",
    glow: "rgba(215, 184, 255, 0.23)",
  },
  ruby: {
    label: "Ruby",
    swatch: "#ff5f7e",
    background: "linear-gradient(180deg, rgba(255, 95, 126, 0.2), rgba(255, 95, 126, 0.44))",
    glow: "rgba(255, 95, 126, 0.22)",
  },
};
const READING_PROGRESS_KEY_PREFIX = "pdf_lib_reading_progress_v1";
const LIBRARY_SETTINGS_KEY_PREFIX = "pdf_lib_user_settings_v1";
const PREVIEW_CHAPTER_LIMIT = Math.min(
  50,
  Math.max(1, Math.floor(Number(window.VIEWER_PREVIEW_PAGE_LIMIT || 10)) || 10),
);

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

const API_ORIGIN = resolveApiOrigin();
const ACTIVE_EMAIL_KEY = "pdf_lib_active_email";
const SESSION_TOKEN_KEY_PREFIX = "pdf_lib_session_token_v1";

function getReaderSessionHeaders() {
  const email = normalizeEmailKey(localStorage.getItem(ACTIVE_EMAIL_KEY));
  if (!email) return {};

  const token = String(
    localStorage.getItem(`${SESSION_TOKEN_KEY_PREFIX}::${email}`) || "",
  ).trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function parseBookDocumentToken(documentId) {
  const match = String(documentId || "").trim().match(/^book:(\d+):epub$/);
  return match ? match[1] : "";
}

function buildEpubApiPath(documentId, isPreview = false) {
  const bookId = parseBookDocumentToken(documentId);
  if (bookId) {
    return isPreview
      ? `${API_ORIGIN}/api/pdfs/book/${encodeURIComponent(bookId)}/epub/preview`
      : `${API_ORIGIN}/api/pdfs/book/${encodeURIComponent(bookId)}/epub/stream`;
  }
  return `${API_ORIGIN}/api/pdfs/epub/stream/${encodeURIComponent(documentId)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getHighlightColor(colorKey) {
  const key = String(colorKey || DEFAULT_HIGHLIGHT_COLOR).toLowerCase();
  const resolvedKey = HIGHLIGHT_COLORS[key] ? key : DEFAULT_HIGHLIGHT_COLOR;
  return {
    key: resolvedKey,
    ...HIGHLIGHT_COLORS[resolvedKey],
  };
}

function updateHighlightStatus(message, tone = "muted") {
  if (!highlightStatus) return;
  highlightStatus.textContent = message;
  highlightStatus.dataset.tone = tone;
}

function getToastRegion() {
  let region = document.getElementById("epub-toast-region");
  if (region) return region;

  region = document.createElement("div");
  region.id = "epub-toast-region";
  region.className = "epub-toast-region";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  document.body.appendChild(region);
  return region;
}

function showEpubToast(message, tone = "success") {
  const region = getToastRegion();
  region.innerHTML = "";

  const toast = document.createElement("div");
  toast.className = "epub-toast";
  toast.dataset.tone = tone;
  toast.innerHTML = `
    <span class="material-symbols-outlined" aria-hidden="true">${tone === "muted" ? "bookmark_remove" : "bookmark_added"}</span>
    <span>${escapeHtml(message)}</span>
  `;

  region.appendChild(toast);
  window.clearTimeout(epubToastTimer);
  epubToastTimer = window.setTimeout(() => {
    toast.remove();
  }, 2800);
}

function setActiveHighlightColor(colorKey) {
  const color = getHighlightColor(colorKey);
  activeHighlightColor = color.key;
  highlightColorButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.highlightColor === color.key);
  });
  selectionPopover?.style.setProperty("--active-highlight-swatch", color.swatch);

  if (lastSelectionData) {
    updateHighlightStatus(`${color.label} selected. Click "Highlight selected text" to save it.`, "ready");
  }
}

function normalizeEmailKey(email) {
  return String(email || "").trim().toLowerCase();
}

function getActiveEmailKey() {
  return normalizeEmailKey(localStorage.getItem("pdf_lib_active_email"));
}

function isLibraryActivitySavingAllowed() {
  const email = getActiveEmailKey() || "guest";
  try {
    const settings = JSON.parse(
      localStorage.getItem(`${LIBRARY_SETTINGS_KEY_PREFIX}::${email}`) || "{}",
    );
    return settings?.saveActivity !== false;
  } catch {
    return true;
  }
}

function getSettingsKey() {
  const email = getActiveEmailKey() || "guest";
  return `pdf_lib_epub_reader_settings::${email}`;
}

function getBookmarkKey() {
  const email = getActiveEmailKey() || "guest";
  const documentId = activeDocumentId || window.VIEWER_DOCUMENT_ID || "unknown";
  return `pdf_lib_epub_bookmark::${email}::${documentId}`;
}

function getCollectionKey(type) {
  const email = getActiveEmailKey() || "guest";
  const documentId = activeDocumentId || window.VIEWER_DOCUMENT_ID || "unknown";
  return `pdf_lib_epub_${type}::${email}::${documentId}`;
}

function getBookmarksKey() {
  return getCollectionKey("bookmarks");
}

function getHighlightsKey() {
  return getCollectionKey("highlights");
}

function getNotesKey() {
  return getCollectionKey("notes");
}

function readCollection(key, fallback = []) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeCollection(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
  } catch {
    // Personal reader data should never block reading.
  }
}

function getReadingProgressStorageKey() {
  const email = getActiveEmailKey() || "guest";
  return `${READING_PROGRESS_KEY_PREFIX}::${email}`;
}

function loadReadingProgressMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(getReadingProgressStorageKey()) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveReadingProgressMap(progressMap) {
  try {
    const safeMap =
      progressMap && typeof progressMap === "object" && !Array.isArray(progressMap)
        ? progressMap
        : {};
    localStorage.setItem(getReadingProgressStorageKey(), JSON.stringify(safeMap));
  } catch {
    // Progress is helpful, but reading must keep working if storage is full.
  }
}

function getProgressEntryKey() {
  const documentId = String(activeDocumentId || window.VIEWER_DOCUMENT_ID || "").trim();
  return documentId ? `epub:${documentId}` : "";
}

function getBookTitleForProgress() {
  return (
    String(window.VIEWER_BOOK_TITLE || "").trim() ||
    String(document.getElementById("reader-title")?.textContent || "").trim() ||
    "EPUB Book"
  );
}

function saveEpubReadingProgressNow() {
  if (!isLibraryActivitySavingAllowed()) return;
  const progressKey = getProgressEntryKey();
  if (!progressKey) return;

  const total = Math.max(0, Math.floor(Number(chapters.length || 0)));
  if (!total) return;

  const section = clamp(Math.floor(Number(currentChapter || 1)), 1, total);
  const progress = Math.round((section / total) * 100);
  const progressMap = loadReadingProgressMap();
  progressMap[progressKey] = {
    title: getBookTitleForProgress(),
    format: "epub",
    documentId: String(activeDocumentId || window.VIEWER_DOCUMENT_ID || "").trim(),
    lastPage: section,
    totalPages: total,
    progress,
    locationLabel: `Section ${section} / ${total}`,
    updatedAt: Date.now(),
  };
  saveReadingProgressMap(progressMap);
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(getSettingsKey()) || "{}");
    if (Number.isFinite(Number(parsed.fontSize))) {
      readerSettings.fontSize = clamp(Number(parsed.fontSize), 16, 32);
    }
    if (Number.isFinite(Number(parsed.lineHeight))) {
      readerSettings.lineHeight = clamp(Number(parsed.lineHeight), 135, 220);
    }
    if (Number.isFinite(Number(parsed.readingWidth))) {
      readerSettings.readingWidth = clamp(Number(parsed.readingWidth), 560, 1120);
    }
    if (FONT_OPTIONS.includes(parsed.fontFamily)) {
      readerSettings.fontFamily = parsed.fontFamily;
    }
    if (MODE_OPTIONS.includes(parsed.mode)) {
      readerSettings.mode = parsed.mode;
    }
  } catch {
    // Defaults are fine.
  }

  fontSizeControl.value = String(readerSettings.fontSize);
  lineHeightControl.value = String(readerSettings.lineHeight);
  readingWidthControl.value = String(readerSettings.readingWidth);
  fontFamilyControl.value = readerSettings.fontFamily;
  applySettings();
}

function saveSettings() {
  try {
    localStorage.setItem(getSettingsKey(), JSON.stringify(readerSettings));
  } catch {
    // Reading settings should never block reading.
  }
}

function getFontStack() {
  if (readerSettings.fontFamily === "sans") {
    return '"IBM Plex Sans", "Segoe UI", sans-serif';
  }
  if (readerSettings.fontFamily === "literata") {
    return '"Literata", "Source Serif 4", Georgia, serif';
  }
  if (readerSettings.fontFamily === "lora") {
    return '"Lora", "Source Serif 4", Georgia, serif';
  }
  if (readerSettings.fontFamily === "merriweather") {
    return '"Merriweather", Georgia, serif';
  }
  if (readerSettings.fontFamily === "garamond") {
    return '"Cormorant Garamond", Garamond, Georgia, serif';
  }
  if (readerSettings.fontFamily === "dyslexic") {
    return '"IBM Plex Sans", "Trebuchet MS", Verdana, sans-serif';
  }
  if (readerSettings.fontFamily === "classic") {
    return 'Georgia, "Times New Roman", serif';
  }
  return '"Source Serif 4", Georgia, serif';
}

function applySettings() {
  document.documentElement.style.setProperty(
    "--epub-reader-font-size",
    `${readerSettings.fontSize}px`,
  );
  document.documentElement.style.setProperty(
    "--epub-reader-line-height",
    String(readerSettings.lineHeight / 100),
  );
  document.documentElement.style.setProperty(
    "--epub-reader-width",
    `${readerSettings.readingWidth}px`,
  );
  document.documentElement.style.setProperty("--epub-reader-font", getFontStack());
  document.body.dataset.epubMode = readerSettings.mode;
  modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.epubMode === readerSettings.mode);
  });
}

function cleanupObjectUrls() {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls = [];
}

function parseXml(text) {
  return new DOMParser().parseFromString(text, "application/xml");
}

function parseHtml(text) {
  return new DOMParser().parseFromString(text, "text/html");
}

function getXmlText(node, selector) {
  return node.querySelector(selector)?.textContent?.trim() || "";
}

function normalizeZipPath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function resolveZipPath(basePath, href) {
  const rawHref = String(href || "").trim().split("#")[0];
  if (!rawHref || /^[a-z][a-z0-9+.-]*:/i.test(rawHref) || rawHref.startsWith("//")) {
    return "";
  }

  let decodedHref = rawHref;
  try {
    decodedHref = decodeURIComponent(rawHref);
  } catch {
    // Keep original path.
  }

  const base = normalizeZipPath(basePath);
  const baseDir = base.includes("/") ? base.slice(0, base.lastIndexOf("/") + 1) : "";
  const parts = normalizeZipPath(`${baseDir}${decodedHref}`).split("/");
  const stack = [];

  parts.forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") stack.pop();
    else stack.push(part);
  });

  return stack.join("/");
}

function findZipEntry(path) {
  const normalized = normalizeZipPath(path);
  if (!normalized || !zipFile) return null;

  return (
    zipFile.file(normalized) ||
    zipFile.file(normalized.replace(/^\.\//, "")) ||
    Object.values(zipFile.files).find(
      (entry) => normalizeZipPath(entry.name).toLowerCase() === normalized.toLowerCase(),
    ) ||
    null
  );
}

function sanitizeInlineStyle(styleValue) {
  return String(styleValue || "")
    .replace(/url\s*\(\s*(['"]?)(?:https?:|javascript:|data:text\/html|\/\/)[^)]*\)/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/position\s*:\s*(?:fixed|sticky)\s*;?/gi, "");
}

function sanitizeCss(cssText) {
  return String(cssText || "")
    .replace(/<\/style/gi, "<\\/style")
    .replace(/@import[^;]+;/gi, "")
    .replace(/url\s*\(\s*(['"]?)(?:https?:|javascript:|data:text\/html|\/\/)[^)]*\)/gi, "none")
    .replace(/position\s*:\s*(?:fixed|sticky)\s*;?/gi, "")
    .replace(/(^|[,{]\s*)(html|body)\b/gi, "$1.epub-book-body");
}

function sanitizeElementTree(root) {
  root
    .querySelectorAll("script, iframe, object, embed, form, input, button, textarea, select")
    .forEach((node) => node.remove());

  root.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value || "";

      if (name.startsWith("on")) {
        node.removeAttribute(attribute.name);
        return;
      }

      if (name === "style") {
        const cleanStyle = sanitizeInlineStyle(value);
        if (cleanStyle.trim()) node.setAttribute(attribute.name, cleanStyle);
        else node.removeAttribute(attribute.name);
        return;
      }

      if (["src", "href", "xlink:href", "poster"].includes(name)) {
        const lowered = value.trim().toLowerCase();
        if (
          lowered.startsWith("javascript:") ||
          lowered.startsWith("data:text/html") ||
          lowered.startsWith("http:") ||
          lowered.startsWith("https:") ||
          lowered.startsWith("//")
        ) {
          node.removeAttribute(attribute.name);
        }
      }
    });
  });
}

async function rewriteImageSources(root, chapterPath) {
  const imageNodes = Array.from(root.querySelectorAll("img, image"));

  for (const imageNode of imageNodes) {
    const source =
      imageNode.getAttribute("src") ||
      imageNode.getAttribute("href") ||
      imageNode.getAttribute("xlink:href") ||
      "";
    const imagePath = resolveZipPath(chapterPath, source);
    const imageEntry = findZipEntry(imagePath);

    if (!imageEntry) {
      imageNode.removeAttribute("src");
      imageNode.removeAttribute("href");
      imageNode.removeAttribute("xlink:href");
      continue;
    }

    const blob = await imageEntry.async("blob");
    const url = URL.createObjectURL(blob);
    objectUrls.push(url);

    if (imageNode.tagName.toLowerCase() === "image") {
      imageNode.setAttribute("href", url);
      imageNode.setAttribute("xlink:href", url);
    } else {
      imageNode.setAttribute("src", url);
      imageNode.setAttribute("loading", "lazy");
      imageNode.setAttribute("referrerpolicy", "no-referrer");
    }
  }
}

async function readCssEntry(path) {
  const entry = findZipEntry(path);
  if (!entry) return "";
  try {
    return sanitizeCss(await entry.async("text"));
  } catch {
    return "";
  }
}

async function collectChapterCss(chapterDoc, chapterPath) {
  const cssParts = [];
  const links = Array.from(chapterDoc.querySelectorAll('link[rel~="stylesheet"][href]'));

  for (const link of links) {
    const cssPath = resolveZipPath(chapterPath, link.getAttribute("href"));
    const css = await readCssEntry(cssPath);
    if (css) cssParts.push(css);
  }

  chapterDoc.querySelectorAll("style").forEach((styleNode) => {
    const css = sanitizeCss(styleNode.textContent || "");
    if (css.trim()) cssParts.push(css);
    styleNode.remove();
  });

  chapterDoc.querySelectorAll("link").forEach((link) => link.remove());
  return cssParts.join("\n\n");
}

async function readPackageDocument() {
  const containerEntry = findZipEntry("META-INF/container.xml");
  if (!containerEntry) throw new Error("This EPUB is missing META-INF/container.xml.");

  const containerXml = parseXml(await containerEntry.async("text"));
  const opfPath = containerXml.querySelector("rootfile")?.getAttribute("full-path");
  if (!opfPath) throw new Error("This EPUB does not declare a package document.");

  const opfEntry = findZipEntry(opfPath);
  if (!opfEntry) throw new Error("The EPUB package document could not be found.");

  return {
    opfPath: normalizeZipPath(opfPath),
    opfXml: parseXml(await opfEntry.async("text")),
  };
}

function buildManifest(opfXml, opfPath) {
  const manifest = new Map();
  opfXml.querySelectorAll("manifest item").forEach((item) => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (!id || !href) return;

    manifest.set(id, {
      id,
      href,
      path: resolveZipPath(opfPath, href),
      mediaType: item.getAttribute("media-type") || "",
      properties: item.getAttribute("properties") || "",
    });
  });
  return manifest;
}

function getSpineItems(opfXml, manifest) {
  const items = [];
  opfXml.querySelectorAll("spine itemref").forEach((itemref) => {
    const idref = itemref.getAttribute("idref");
    const item = manifest.get(idref);
    if (!item) return;
    if (!/(xhtml|html)/i.test(item.mediaType)) return;
    items.push(item);
  });
  return items;
}

async function extractTocMap(opfXml, manifest, opfPath) {
  const tocMap = new Map();
  const navItem = Array.from(manifest.values()).find((item) =>
    String(item.properties || "").split(/\s+/).includes("nav"),
  );

  if (navItem) {
    const navEntry = findZipEntry(navItem.path);
    if (navEntry) {
      const navDoc = parseHtml(await navEntry.async("text"));
      navDoc.querySelectorAll("nav a, nav span").forEach((node) => {
        const href = node.getAttribute("href") || "";
        const label = node.textContent?.replace(/\s+/g, " ").trim() || "";
        const path = resolveZipPath(navItem.path, href);
        if (path && label && !tocMap.has(path)) tocMap.set(path, label);
      });
    }
  }

  const spine = opfXml.querySelector("spine");
  const ncxId = spine?.getAttribute("toc");
  const ncxItem = ncxId ? manifest.get(ncxId) : null;
  if (ncxItem) {
    const ncxEntry = findZipEntry(ncxItem.path);
    if (ncxEntry) {
      const ncxDoc = parseXml(await ncxEntry.async("text"));
      ncxDoc.querySelectorAll("navPoint").forEach((point) => {
        const label = getXmlText(point, "navLabel text");
        const src = point.querySelector("content")?.getAttribute("src") || "";
        const path = resolveZipPath(ncxItem.path || opfPath, src);
        if (path && label && !tocMap.has(path)) tocMap.set(path, label);
      });
    }
  }

  return tocMap;
}

function getBookTitleFromOpf(opfXml) {
  return (
    getXmlText(opfXml, "metadata title") ||
    getXmlText(opfXml, "dc\\:title") ||
    ""
  );
}

async function buildChapter(item, index, tocMap) {
  const entry = findZipEntry(item.path);
  if (!entry) return null;

  const raw = await entry.async("text");
  const chapterDoc = parseHtml(raw);
  const css = await collectChapterCss(chapterDoc, item.path);
  const body = chapterDoc.body || chapterDoc.documentElement;

  sanitizeElementTree(body);
  await rewriteImageSources(body, item.path);

  body.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const targetPath = resolveZipPath(item.path, href);
    const hash = href.includes("#") ? href.split("#").pop() : "";
    link.removeAttribute("href");
    if (targetPath) link.dataset.epubTargetPath = targetPath;
    if (hash) link.dataset.epubTargetHash = hash;
  });

  const title =
    tocMap.get(item.path) ||
    chapterDoc.querySelector("h1, h2, h3, title")?.textContent?.replace(/\s+/g, " ").trim() ||
    `Chapter ${index + 1}`;

  return {
    path: item.path,
    title,
    css,
    html: body.innerHTML,
  };
}

async function loadEpub(documentId, previewOnly = false) {
  const response = await fetch(
    buildEpubApiPath(documentId, previewOnly),
    {
      credentials: "include",
      cache: "no-store",
      headers: previewOnly ? {} : getReaderSessionHeaders(),
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error("Please sign in again to open this EPUB.");
  }
  if (response.status === 402) {
    throw new Error("Premium access is required to open the full EPUB.");
  }
  if (!response.ok) {
    throw new Error("The EPUB could not be loaded from the library server.");
  }

  cleanupObjectUrls();
  zipFile = await JSZip.loadAsync(await response.arrayBuffer());
  const { opfPath, opfXml } = await readPackageDocument();
  const manifest = buildManifest(opfXml, opfPath);
  const spineItems = getSpineItems(opfXml, manifest);
  const tocMap = await extractTocMap(opfXml, manifest, opfPath);
  const bookTitle = getBookTitleFromOpf(opfXml);

  const loadedChapters = [];
  for (let index = 0; index < spineItems.length; index += 1) {
    const chapter = await buildChapter(spineItems[index], index, tocMap);
    if (chapter) loadedChapters.push(chapter);
  }

  if (loadedChapters.length === 0) {
    throw new Error("This EPUB does not contain readable chapters.");
  }

  chapters = previewOnly ? loadedChapters.slice(0, PREVIEW_CHAPTER_LIMIT) : loadedChapters;
  searchIndex = null;

  if (bookTitle) {
    const titleNode = document.getElementById("reader-title");
    if (titleNode && !titleNode.dataset.userTitleLocked) {
      titleNode.textContent = bookTitle;
    }
  }
}

function ensureShadowRoot() {
  if (!shadowRoot) {
    shadowRoot = contentHost.attachShadow({ mode: "open" });
  }
  return shadowRoot;
}

function getShadowBaseCss(chapterCss) {
  return `
    :host {
      display: block;
      color: var(--epub-text);
      font-family: var(--epub-reader-font);
      font-size: var(--epub-reader-font-size);
      line-height: var(--epub-reader-line-height);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    .epub-book-body {
      width: min(var(--epub-reader-width), 100%);
      margin: 0 auto;
      color: var(--epub-text);
      font-family: var(--epub-reader-font);
      font-size: var(--epub-reader-font-size);
      line-height: var(--epub-reader-line-height);
      overflow-wrap: anywhere;
    }

    .epub-book-body,
    .epub-book-body section,
    .epub-book-body article,
    .epub-book-body div {
      background: transparent !important;
    }

    .epub-book-body p,
    .epub-book-body li,
    .epub-book-body blockquote,
    .epub-book-body dd,
    .epub-book-body td {
      color: var(--epub-text) !important;
    }

    .epub-book-body h1,
    .epub-book-body h2,
    .epub-book-body h3,
    .epub-book-body h4,
    .epub-book-body h5,
    .epub-book-body h6 {
      color: var(--epub-text) !important;
      font-family: "Fraunces", var(--epub-reader-font);
      line-height: 1.16;
      margin-block: 1.2em 0.55em;
    }

    .epub-book-body p {
      margin-block: 0 1.05em;
    }

    .epub-book-body a {
      color: var(--epub-link) !important;
      text-decoration: underline;
      text-underline-offset: 0.18em;
      cursor: pointer;
    }

    .epub-book-body img,
    .epub-book-body svg {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 1.2em auto;
    }

    .epub-book-body table {
      max-width: 100%;
      border-collapse: collapse;
    }

    .epub-book-body pre {
      white-space: pre-wrap;
    }

    .epub-book-body sup,
    .epub-book-body sub {
      line-height: 0;
    }

    .epub-reader-highlight {
      border-radius: 0.42em;
      background: var(--epub-highlight-bg, linear-gradient(180deg, rgba(255, 219, 102, 0.18), rgba(255, 219, 102, 0.42)));
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      box-shadow:
        0 0 0 0.2em var(--epub-highlight-glow, rgba(255, 219, 102, 0.13)),
        0 0.18em 0.42em rgba(0, 0, 0, 0.16);
      color: inherit !important;
      margin-inline: 0.02em;
      padding: 0.04em 0.2em 0.08em;
      text-shadow: 0 1px 0 rgba(0, 0, 0, 0.14);
    }

    .epub-reader-highlight.flash {
      animation: epub-highlight-flash 1.1s ease;
    }

    @keyframes epub-highlight-flash {
      0%, 100% { filter: none; }
      35% { filter: brightness(1.35); }
    }

    ${chapterCss || ""}
  `;
}

function attachInternalLinkHandlers(root) {
  const pathToIndex = new Map(chapters.map((chapter, index) => [chapter.path, index + 1]));

  root.querySelectorAll("[data-epub-target-path]").forEach((link) => {
    link.addEventListener("click", () => {
      const targetPath = link.dataset.epubTargetPath || "";
      const targetChapter = pathToIndex.get(targetPath);
      if (targetChapter) {
        goToPage(targetChapter);
      }
    });
  });
}

function getReaderBody(root = shadowRoot) {
  return root?.querySelector(".epub-book-body") || null;
}

function serializeNodePath(node, root) {
  if (!node || !root) return null;
  const path = [];
  let current = node;

  while (current && current !== root) {
    const parent = current.parentNode;
    if (!parent) return null;
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
    current = parent;
  }

  return current === root ? path : null;
}

function resolveNodePath(root, path) {
  if (!root || !Array.isArray(path)) return null;
  let current = root;

  for (const index of path) {
    current = current?.childNodes?.[Number(index)];
    if (!current) return null;
  }

  return current;
}

function isNodeInsideReader(node) {
  const body = getReaderBody();
  return Boolean(body && node && (node === body || body.contains(node)));
}

function getCurrentSelection() {
  try {
    const shadowSelection =
      typeof shadowRoot?.getSelection === "function" ? shadowRoot.getSelection() : null;
    if (shadowSelection?.rangeCount && !shadowSelection.isCollapsed) {
      return shadowSelection;
    }
  } catch {
    // Some browsers expose selection only on window.
  }

  try {
    return window.getSelection();
  } catch {
    return null;
  }
}

function getSelectionData() {
  const selection = getCurrentSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (!isNodeInsideReader(range.startContainer) || !isNodeInsideReader(range.endContainer)) {
    return null;
  }

  const body = getReaderBody();
  const text = selection.toString().replace(/\s+/g, " ").trim();
  if (!body || text.length < 2) return null;

  const startPath = serializeNodePath(range.startContainer, body);
  const endPath = serializeNodePath(range.endContainer, body);
  if (!startPath || !endPath) return null;

  return {
    chapter: currentChapter,
    title: chapters[currentChapter - 1]?.title || `Chapter ${currentChapter}`,
    text: text.slice(0, 1600),
    range: {
      startPath,
      startOffset: range.startOffset,
      endPath,
      endOffset: range.endOffset,
    },
  };
}

function rememberSelection(selectionData = getSelectionData()) {
  if (!selectionData) return null;
  lastSelectionData = selectionData;
  const preview =
    selectionData.text.length > 90 ? `${selectionData.text.slice(0, 90)}...` : selectionData.text;
  updateHighlightStatus(`Selected: "${preview}"`, "ready");
  return selectionData;
}

function getRangeFromData(root, rangeData) {
  const body = getReaderBody(root);
  if (!body || !rangeData) return null;

  const startNode = resolveNodePath(body, rangeData.startPath);
  const endNode = resolveNodePath(body, rangeData.endPath);
  if (!startNode || !endNode) return null;

  const range = document.createRange();
  try {
    range.setStart(startNode, Number(rangeData.startOffset || 0));
    range.setEnd(endNode, Number(rangeData.endOffset || 0));
  } catch {
    return null;
  }
  return range.collapsed ? null : range;
}

function comparePathDesc(left, right) {
  const a = left?.range?.startPath || [];
  const b = right?.range?.startPath || [];
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const aPart = Number(a[index] ?? -1);
    const bPart = Number(b[index] ?? -1);
    if (aPart !== bPart) return bPart - aPart;
  }
  return Number(right?.range?.startOffset || 0) - Number(left?.range?.startOffset || 0);
}

function createHighlightMark(item) {
  const color = getHighlightColor(item?.color);
  const mark = document.createElement("mark");
  mark.className = "epub-reader-highlight";
  mark.dataset.highlightId = item.id;
  mark.dataset.highlightColor = color.key;
  mark.title = `${color.label} highlight`;
  mark.style.setProperty("--epub-highlight-bg", color.background);
  mark.style.setProperty("--epub-highlight-glow", color.glow);
  return mark;
}

function applyTextHighlight(root, item) {
  const body = getReaderBody(root);
  if (!body || !item?.text) return false;

  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest("mark.epub-reader-highlight")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node = walker.nextNode();
  while (node) {
    const index = node.nodeValue.indexOf(item.text);
    if (index >= 0) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + item.text.length);
      const mark = createHighlightMark(item);
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
      return true;
    }
    node = walker.nextNode();
  }

  return false;
}

function getTextNodesInsideRange(root, range) {
  const body = getReaderBody(root);
  if (!body || !range) return [];

  const nodes = [];
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest("mark.epub-reader-highlight")) {
        return NodeFilter.FILTER_REJECT;
      }
      try {
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      } catch {
        return NodeFilter.FILTER_REJECT;
      }
    },
  });

  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }
  return nodes;
}

function wrapTextSegment(node, startOffset, endOffset, item) {
  const length = node.nodeValue?.length || 0;
  const start = clamp(Math.floor(Number(startOffset || 0)), 0, length);
  const end = clamp(Math.floor(Number(endOffset || length)), 0, length);
  if (end <= start) return false;

  try {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const mark = createHighlightMark(item);
    mark.appendChild(range.extractContents());
    range.insertNode(mark);
    return true;
  } catch {
    return false;
  }
}

function applySegmentedHighlight(root, item) {
  const range = getRangeFromData(root, item.range);
  if (!range) return false;

  const nodes = getTextNodesInsideRange(root, range);
  if (!nodes.length) return false;

  const startContainer = range.startContainer;
  const endContainer = range.endContainer;
  const startOffset = range.startOffset;
  const endOffset = range.endOffset;
  let applied = false;
  [...nodes].reverse().forEach((node) => {
    const start = node === startContainer ? startOffset : 0;
    const end = node === endContainer ? endOffset : node.nodeValue.length;
    applied = wrapTextSegment(node, start, end, item) || applied;
  });

  return applied;
}

function applyHighlightRange(root, item) {
  if (applySegmentedHighlight(root, item)) {
    return true;
  }

  return applyTextHighlight(root, item);
}

function applyStoredHighlights(root) {
  const highlights = readCollection(getHighlightsKey())
    .filter((item) => Number(item.chapter) === currentChapter)
    .sort(comparePathDesc);

  highlights.forEach((item) => applyHighlightRange(root, item));
}

function clearReaderSelection() {
  try {
    shadowRoot?.getSelection?.()?.removeAllRanges();
  } catch {
    // Ignore Shadow DOM selection cleanup errors.
  }
  try {
    window.getSelection()?.removeAllRanges();
  } catch {
    // Ignore selection cleanup errors.
  }
}

function hideSelectionPopover() {
  selectionPopover?.classList.add("hidden");
}

function updateSelectionPopover() {
  const data = getSelectionData();
  if (!data || !selectionPopover) {
    hideSelectionPopover();
    return;
  }
  rememberSelection(data);

  const selection = getCurrentSelection();
  const rect = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
  if (!rect || (!rect.width && !rect.height)) {
    hideSelectionPopover();
    return;
  }

  const left = clamp(rect.left + rect.width / 2, 118, window.innerWidth - 118);
  const top = clamp(rect.top - 58, 82, window.innerHeight - 92);
  selectionPopover.style.left = `${left}px`;
  selectionPopover.style.top = `${top}px`;
  selectionPopover.classList.remove("hidden");
}

function switchToolTab(nextTab) {
  const safeTab = nextTab || "default";
  toolTabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.toolTab === safeTab);
  });
  toolPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.toolPanel === safeTab);
  });
}

function formatSavedDate(timestamp) {
  if (!timestamp) return "Saved";
  try {
    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Saved";
  }
}

function getItemSection(item) {
  const section = Math.floor(Number(item?.chapter || item?.page || 1));
  return Number.isFinite(section) && section > 0 ? section : 1;
}

function formatLocationLabel(item) {
  const section = getItemSection(item);
  const total = Math.max(0, Math.floor(Number(chapters.length || 0)));
  return total ? `Section ${section} / ${total}` : `Section ${section}`;
}

function removeCollectionItem(key, id) {
  const next = readCollection(key).filter((item) => item.id !== id);
  writeCollection(key, next);
  renderReaderCollections();
  if (key === getBookmarksKey()) updateBookmarkButton();
  if (key === getHighlightsKey()) renderChapter(currentChapter, { scroll: false, smooth: false });
}

function renderCollection(container, items, emptyText, type, storageKey) {
  if (!container) return;
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `<div class="epub-collection-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = `epub-collection-item ${type}`;
    const excerpt = item.excerpt || item.text || item.title || "";
    const locationLabel = item.locationLabel || formatLocationLabel(item);
    const highlightColor = type === "highlight" ? getHighlightColor(item.color) : null;
    const colorChip = highlightColor
      ? `<i class="epub-highlight-chip" style="--highlight-swatch: ${highlightColor.swatch};" aria-hidden="true"></i>`
      : "";
    row.innerHTML = `
      <button type="button" class="epub-collection-jump">
        <div class="epub-collection-heading">
          ${colorChip}
          <strong>${escapeHtml(item.title || `Chapter ${item.chapter || 1}`)}</strong>
        </div>
        <span>${escapeHtml(String(excerpt).slice(0, 130))}</span>
        <small class="epub-collection-location">${escapeHtml(locationLabel)}</small>
        <small>${escapeHtml(formatSavedDate(item.createdAt || item.savedAt))}</small>
      </button>
      <button type="button" class="epub-collection-remove" aria-label="Remove saved item">
        <span class="material-symbols-outlined">close</span>
      </button>
    `;

    row.querySelector(".epub-collection-jump").addEventListener("click", () => {
      renderChapter(getItemSection(item));
      if (item.id) {
        window.setTimeout(() => flashSavedItem(item.id), 180);
      }
    });
    row.querySelector(".epub-collection-remove").addEventListener("click", () => {
      removeCollectionItem(storageKey, item.id);
    });

    container.appendChild(row);
  });
}

function renderReaderCollections() {
  renderCollection(
    highlightsList,
    readCollection(getHighlightsKey()),
    "No highlights yet. Select text, open A > Highlight, choose a color, then save it.",
    "highlight",
    getHighlightsKey(),
  );
  renderCollection(
    notesList,
    readCollection(getNotesKey()),
    "No notes yet. Write a note for this section or select text and tap Note.",
    "note",
    getNotesKey(),
  );
  renderCollection(
    bookmarksList,
    readCollection(getBookmarksKey()),
    "No bookmarks yet. Tap the bookmark icon while reading.",
    "bookmark",
    getBookmarksKey(),
  );
}

function flashSavedItem(id) {
  const root = ensureShadowRoot();
  const mark = root.querySelector(`[data-highlight-id="${CSS.escape(String(id))}"]`);
  if (!mark) return;
  mark.classList.add("flash");
  mark.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => mark.classList.remove("flash"), 1300);
}

function saveHighlightFromSelection() {
  const selectionData = getSelectionData() || lastSelectionData;
  if (!selectionData) {
    switchToolTab("highlights");
    typographyPanel.classList.remove("hidden");
    updateHighlightStatus("Select text in the book first, then click this button.", "warning");
    return;
  }

  const highlights = readCollection(getHighlightsKey());
  const color = getHighlightColor(activeHighlightColor);
  const savedId = makeId("highlight");
  highlights.unshift({
    id: savedId,
    chapter: selectionData.chapter,
    page: selectionData.chapter,
    title: selectionData.title,
    text: selectionData.text,
    excerpt: selectionData.text,
    range: selectionData.range,
    color: color.key,
    locationLabel: formatLocationLabel({ chapter: selectionData.chapter }),
    createdAt: Date.now(),
  });
  writeCollection(getHighlightsKey(), highlights.slice(0, 300));

  lastSelectionData = null;
  clearReaderSelection();
  hideSelectionPopover();
  switchToolTab("highlights");
  typographyPanel.classList.remove("hidden");
  renderChapter(currentChapter, { scroll: false, smooth: false });
  renderReaderCollections();
  updateHighlightStatus(`Saved ${color.label} highlight.`, "success");
  window.setTimeout(() => flashSavedItem(savedId), 180);
}

function prepareNoteFromSelection() {
  const selectionData = getSelectionData() || lastSelectionData;
  if (!selectionData || !noteInput) {
    switchToolTab("notes");
    typographyPanel.classList.remove("hidden");
    return;
  }

  noteInput.dataset.selection = JSON.stringify(selectionData);
  noteInput.placeholder = `Note about: "${selectionData.text.slice(0, 90)}"`;
  switchToolTab("notes");
  typographyPanel.classList.remove("hidden");
  noteInput.focus();
  hideSelectionPopover();
}

function saveNoteFromInput() {
  if (!noteInput) return;
  const text = noteInput.value.trim();
  if (!text) return;

  let selectionData = null;
  try {
    selectionData = noteInput.dataset.selection
      ? JSON.parse(noteInput.dataset.selection)
      : null;
  } catch {
    selectionData = null;
  }

  const notes = readCollection(getNotesKey());
  notes.unshift({
    id: makeId("note"),
    chapter: Number(selectionData?.chapter || currentChapter),
    page: Number(selectionData?.chapter || currentChapter),
    title:
      selectionData?.title ||
      chapters[currentChapter - 1]?.title ||
      `Chapter ${currentChapter}`,
    text,
    excerpt: selectionData?.text || "",
    range: selectionData?.range || null,
    locationLabel: formatLocationLabel({ chapter: Number(selectionData?.chapter || currentChapter) }),
    createdAt: Date.now(),
  });
  writeCollection(getNotesKey(), notes.slice(0, 400));

  noteInput.value = "";
  delete noteInput.dataset.selection;
  noteInput.placeholder = "Write your note here...";
  renderReaderCollections();
}

function makeBookInitials(title) {
  const words = String(title || "Book")
    .replace(/[^a-z0-9 ]/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return (words[0] || "BK").slice(0, 2).toUpperCase();
}

function updateChaptersHero() {
  const total = chapters.length || 0;
  const progress = total ? Math.round((currentChapter / total) * 100) : 0;
  const title = document.getElementById("reader-title")?.textContent || "This book";
  const chapter = chapters[currentChapter - 1];

  if (chaptersInitials) chaptersInitials.textContent = makeBookInitials(title);
  if (panelTitle) panelTitle.textContent = title;
  if (panelSummary) {
    panelSummary.textContent = chapter
      ? `Now reading: ${chapter.title}`
      : "Choose a section to continue reading.";
  }
  if (panelProgress) panelProgress.textContent = `${progress}% complete`;
  if (panelTotal) panelTotal.textContent = `${total} sections`;
  if (chaptersHero) {
    chaptersHero.style.setProperty("--epub-art-hue", String(title.length * 23 + total * 11));
  }
}

function renderChapter(chapterNumber, options = {}) {
  const safeChapter = clamp(
    Math.floor(Number(chapterNumber || 1)),
    1,
    Math.max(1, chapters.length),
  );

  const chapter = chapters[safeChapter - 1];
  if (!chapter) return;

  if (currentChapter !== safeChapter) {
    lastSelectionData = null;
    hideSelectionPopover();
    updateHighlightStatus("Select text in the book first. Then this button will save it.");
  }
  currentChapter = safeChapter;
  const root = ensureShadowRoot();
  root.innerHTML = `
    <style>${getShadowBaseCss(chapter.css)}</style>
    <main class="epub-book-body" part="book-body">${chapter.html}</main>
  `;
  applyStoredHighlights(root);
  attachInternalLinkHandlers(root);

  updateReaderState();
  highlightChapterButton();
  updateBookmarkButton();
  updateChaptersHero();
  renderReaderCollections();

  if (options.scroll !== false) {
    window.scrollTo({ top: 0, behavior: options.smooth === false ? "auto" : "smooth" });
  }
}

function updateReaderState() {
  const total = chapters.length || 1;
  const progress = Math.round((currentChapter / total) * 100);

  currentLabel.textContent = `Chapter ${currentChapter} of ${total}`;
  progressLabel.textContent = `${progress}%`;
  progressFill.style.width = `${progress}%`;
  prevButton.disabled = currentChapter <= 1;
  nextButton.disabled = currentChapter >= total;

  document.dispatchEvent(
    new CustomEvent("reader:state", {
      detail: {
        currentPage: currentChapter,
        totalPages: total,
        readablePages: total,
        progress,
        isPreviewMode,
        fitMode: "epub",
        currentScale: readerSettings.fontSize / 22,
        contentWidthFactor: readerSettings.readingWidth / 880,
      },
    }),
  );
  saveEpubReadingProgressNow();
}

function buildChapterList() {
  chapterList.innerHTML = "";

  chapters.forEach((chapter, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "epub-chapter-item";
    button.dataset.chapter = String(index + 1);
    button.innerHTML = `
      <span class="epub-chapter-number">${index + 1}</span>
      <span class="epub-chapter-title">${escapeHtml(chapter.title)}</span>
    `;
    button.addEventListener("click", () => {
      closeChaptersPanel();
      renderChapter(index + 1);
    });
    chapterList.appendChild(button);
  });

  highlightChapterButton();
  updateChaptersHero();
}

function highlightChapterButton() {
  chapterList.querySelectorAll(".epub-chapter-item").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.chapter) === currentChapter);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function openChaptersPanel() {
  if (typeof window.closeAiSidebarForBookPanel === "function") {
    window.closeAiSidebarForBookPanel();
  }
  document.body.classList.add("book-sidebar-open");
  chaptersPanel.classList.add("open");
  chaptersButton.setAttribute("aria-expanded", "true");
}

function closeChaptersPanel() {
  chaptersPanel.classList.remove("open");
  document.body.classList.remove("book-sidebar-open");
  chaptersButton.setAttribute("aria-expanded", "false");
}

function toggleChaptersPanel() {
  if (chaptersPanel.classList.contains("open")) closeChaptersPanel();
  else {
    openChaptersPanel();
  }
}

function toggleTypographyPanel() {
  chaptersPanel.classList.remove("open");
  typographyPanel.classList.remove("hidden");
}

function setLoading(message = "") {
  loadingOverlay.style.display = "grid";
  loadingOverlay.innerHTML = message
    ? `<div class="epub-load-message"><div class="epub-spinner"></div><span>${escapeHtml(message)}</span></div>`
    : `<div class="epub-spinner"></div>`;
}

function hideLoading() {
  loadingOverlay.style.display = "none";
}

function showLoadError(error) {
  console.error("Error loading EPUB:", error);
  loadingOverlay.style.display = "grid";
  loadingOverlay.innerHTML = `<div class="epub-error-card">
    <span class="material-symbols-outlined">error</span>
    <strong>Reader could not start</strong>
    <p>${escapeHtml(error?.message || "Please try again.")}</p>
    <button type="button" onclick="location.reload()">Retry</button>
  </div>`;
}

function buildSearchIndex() {
  searchIndex = chapters.map((chapter, index) => {
    const temp = document.createElement("div");
    temp.innerHTML = chapter.html;
    const text = `${chapter.title} ${temp.textContent || ""}`
      .replace(/\s+/g, " ")
      .trim();
    return {
      chapter: index + 1,
      title: chapter.title,
      text,
      textLower: text.toLowerCase(),
    };
  });
  return searchIndex;
}

function extractSnippet(source, matchIndex, matchLength) {
  const radius = 78;
  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(source.length, matchIndex + matchLength + radius);
  return `${start > 0 ? "... " : ""}${source.slice(start, end).trim()}${end < source.length ? " ..." : ""}`;
}

async function searchDocument(rawQuery, maxResults = 50) {
  const query = String(rawQuery || "").trim().toLowerCase();
  if (!query) return [];

  const index = searchIndex || buildSearchIndex();
  const results = [];

  for (const entry of index) {
    const firstMatch = entry.textLower.indexOf(query);
    if (firstMatch === -1) continue;
    results.push({
      page: entry.chapter,
      chapter: entry.chapter,
      title: entry.title,
      snippet: extractSnippet(entry.text, firstMatch, query.length),
    });
    if (results.length >= maxResults) break;
  }

  return results;
}

async function getPageText(chapterNumber = currentChapter) {
  const safeChapter = clamp(
    Math.floor(Number(chapterNumber || currentChapter || 1)),
    1,
    Math.max(1, chapters.length),
  );
  const chapter = chapters[safeChapter - 1];
  if (!chapter) return "";
  const temp = document.createElement("div");
  temp.innerHTML = chapter.html;
  return `${chapter.title || `Chapter ${safeChapter}`} ${temp.textContent || ""}`
    .replace(/\s+/g, " ")
    .trim();
}

async function getDocumentText(options = {}) {
  const maxChars = Math.max(2000, Math.min(50000, Math.floor(Number(options.maxChars || 18000))));
  const maxPages = Math.max(1, Math.min(80, Math.floor(Number(options.maxPages || 40))));
  const index = searchIndex || buildSearchIndex();
  const parts = [];
  let usedChars = 0;

  for (const entry of index.slice(0, maxPages)) {
    const chapterText = String(entry.text || "").trim();
    if (!chapterText) continue;
    const label = `Section ${entry.chapter} - ${entry.title}: ${chapterText}`;
    const remaining = maxChars - usedChars;
    if (remaining <= 0) break;
    parts.push(label.length > remaining ? label.slice(0, remaining).trim() : label);
    usedChars += parts[parts.length - 1].length;
  }

  if (index.length > maxPages || usedChars >= maxChars) {
    parts.push(`[Only the first ${Math.min(index.length, maxPages)} section(s) or ${maxChars} characters were sent to the AI.]`);
  }

  return parts.join("\n\n");
}

function renderSearchResults(results, query) {
  if (!query) {
    searchResults.innerHTML = "";
    return;
  }

  if (results.length === 0) {
    searchResults.innerHTML = `<div class="epub-search-empty">No matches found.</div>`;
    return;
  }

  searchResults.innerHTML = "";
  results.forEach((result) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "epub-search-result";
    button.innerHTML = `
      <strong>${escapeHtml(result.title || `Chapter ${result.chapter}`)}</strong>
      <span>${escapeHtml(result.snippet)}</span>
    `;
    button.addEventListener("click", () => {
      searchPanel.classList.add("hidden");
      renderChapter(result.chapter);
    });
    searchResults.appendChild(button);
  });
}

function toggleSearchPanel() {
  searchPanel.classList.toggle("hidden");
  if (!searchPanel.classList.contains("hidden")) {
    searchInput.focus();
  }
}

function toggleBookmark() {
  if (!chapters.length) {
    showEpubToast("Open a chapter before adding a bookmark.", "muted");
    return;
  }

  let toastMessage = "";
  let toastTone = "success";

  try {
    const bookmarks = readCollection(getBookmarksKey());
    const existingIndex = bookmarks.findIndex((item) => Number(item.chapter) === currentChapter);
    if (existingIndex >= 0) {
      bookmarks.splice(existingIndex, 1);
      writeCollection(getBookmarksKey(), bookmarks);
      const existing = JSON.parse(localStorage.getItem(getBookmarkKey()) || "null");
      if (existing?.chapter === currentChapter) {
        localStorage.removeItem(getBookmarkKey());
      }
      toastMessage = `Removed bookmark for ${formatLocationLabel({ chapter: currentChapter })}.`;
      toastTone = "muted";
    } else {
      const savedAt = Date.now();
      const bookmark = {
        id: makeId("bookmark"),
        chapter: currentChapter,
        page: currentChapter,
        title: chapters[currentChapter - 1]?.title || "",
        excerpt: `Section ${currentChapter}`,
        locationLabel: formatLocationLabel({ chapter: currentChapter }),
        savedAt,
        createdAt: savedAt,
      };
      bookmarks.unshift(bookmark);
      writeCollection(getBookmarksKey(), bookmarks.slice(0, 200));
      localStorage.setItem(
        getBookmarkKey(),
        JSON.stringify(bookmark),
      );
      toastMessage = `Bookmarked ${bookmark.locationLabel}. Saved in bookmark history.`;
    }
  } catch {
    toastMessage = "Bookmark could not be saved in this browser.";
    toastTone = "muted";
  }
  updateBookmarkButton();
  renderReaderCollections();
  if (toastMessage) showEpubToast(toastMessage, toastTone);
}

function updateBookmarkButton() {
  let isBookmarked = false;
  try {
    isBookmarked = readCollection(getBookmarksKey()).some(
      (item) => Number(item.chapter) === currentChapter,
    );
    if (!isBookmarked) {
      const existing = JSON.parse(localStorage.getItem(getBookmarkKey()) || "null");
      isBookmarked = existing?.chapter === currentChapter;
    }
  } catch {
    isBookmarked = false;
  }
  bookmarkButton.classList.toggle("active", isBookmarked);
  bookmarkButton.setAttribute("aria-pressed", isBookmarked ? "true" : "false");
  bookmarkButton.setAttribute(
    "aria-label",
    isBookmarked ? "Remove bookmark for this chapter" : "Bookmark chapter",
  );
}

function readInitialChapter() {
  const requestedStart = Math.floor(Number(window.VIEWER_INITIAL_PAGE || 1));
  if (requestedStart > 0) return requestedStart;

  try {
    const savedProgress = loadReadingProgressMap()[getProgressEntryKey()];
    if (savedProgress?.lastPage) return Number(savedProgress.lastPage);
  } catch {
    // Ignore broken reading progress.
  }

  try {
    const bookmarks = readCollection(getBookmarksKey());
    if (bookmarks[0]?.chapter) return Number(bookmarks[0].chapter);

    const existing = JSON.parse(localStorage.getItem(getBookmarkKey()) || "null");
    if (existing?.chapter) return Number(existing.chapter);
  } catch {
    // Ignore broken bookmark.
  }

  return 1;
}

window.initEpubViewer = async function(documentId, previewOnly = false) {
  activeDocumentId = String(documentId || "");
  isPreviewMode = Boolean(previewOnly);
  currentChapter = 1;
  searchIndex = null;
  loadSettings();
  setLoading(isPreviewMode ? "Preparing your preview..." : "Preparing your reading space...");

  try {
    await loadEpub(activeDocumentId, isPreviewMode);
    buildChapterList();
    readerApp.classList.remove("hidden");

    const firstChapter = clamp(readInitialChapter(), 1, chapters.length);
    renderChapter(firstChapter, { smooth: false, scroll: false });
    hideLoading();
  } catch (error) {
    showLoadError(error);
  }
};

prevButton.addEventListener("click", () => {
  if (currentChapter > 1) renderChapter(currentChapter - 1);
});

nextButton.addEventListener("click", () => {
  if (currentChapter < chapters.length) renderChapter(currentChapter + 1);
});

chaptersButton.addEventListener("click", toggleChaptersPanel);
tocIconButton.addEventListener("click", toggleChaptersPanel);
chaptersCloseButton.addEventListener("click", closeChaptersPanel);
typographyButton.addEventListener("click", toggleTypographyPanel);
typographyCloseButton.addEventListener("click", () => typographyPanel.classList.add("hidden"));
searchToggle.addEventListener("click", toggleSearchPanel);
searchClose.addEventListener("click", () => searchPanel.classList.add("hidden"));
bookmarkButton.addEventListener("click", toggleBookmark);
selectionHighlightButton?.addEventListener("click", saveHighlightFromSelection);
selectionNoteButton?.addEventListener("click", prepareNoteFromSelection);
highlightActionButton?.addEventListener("click", saveHighlightFromSelection);
saveNoteButton?.addEventListener("click", saveNoteFromInput);

[
  selectionHighlightButton,
  selectionNoteButton,
  highlightActionButton,
  ...highlightColorButtons,
].forEach((button) => {
  button?.addEventListener("mousedown", (event) => {
    // Keep the text selection alive while the user chooses a highlight action.
    event.preventDefault();
  });
});

toolTabButtons.forEach((button) => {
  button.addEventListener("click", () => switchToolTab(button.dataset.toolTab));
});

highlightColorButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveHighlightColor(button.dataset.highlightColor));
});
setActiveHighlightColor(activeHighlightColor);

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextMode = button.dataset.epubMode;
    if (!MODE_OPTIONS.includes(nextMode)) return;
    readerSettings.mode = nextMode;
    applySettings();
    saveSettings();
  });
});

fontSizeControl.addEventListener("input", () => {
  readerSettings.fontSize = Number(fontSizeControl.value);
  applySettings();
  saveSettings();
});

lineHeightControl.addEventListener("input", () => {
  readerSettings.lineHeight = Number(lineHeightControl.value);
  applySettings();
  saveSettings();
});

readingWidthControl.addEventListener("input", () => {
  readerSettings.readingWidth = Number(readingWidthControl.value);
  applySettings();
  saveSettings();
});

fontFamilyControl.addEventListener("change", () => {
  readerSettings.fontFamily = fontFamilyControl.value;
  applySettings();
  saveSettings();
});

contentHost.addEventListener("mouseup", () => {
  window.setTimeout(updateSelectionPopover, 0);
});

contentHost.addEventListener("keyup", () => {
  window.setTimeout(updateSelectionPopover, 0);
});

document.addEventListener("selectionchange", () => {
  window.setTimeout(updateSelectionPopover, 0);
});

let searchTimer = null;
searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  const query = searchInput.value;
  searchTimer = window.setTimeout(async () => {
    renderSearchResults(await searchDocument(query), query.trim());
  }, 180);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeChaptersPanel();
    searchPanel.classList.add("hidden");
    hideSelectionPopover();
  }
  if (event.key === "ArrowLeft" && currentChapter > 1) {
    renderChapter(currentChapter - 1);
  }
  if (event.key === "ArrowRight" && currentChapter < chapters.length) {
    renderChapter(currentChapter + 1);
  }
});

document.addEventListener("click", (event) => {
  if (
    !chaptersPanel.contains(event.target) &&
    !chaptersButton.contains(event.target) &&
    !tocIconButton.contains(event.target)
  ) {
    closeChaptersPanel();
  }
  if (!selectionPopover?.contains(event.target) && !contentHost.contains(event.target)) {
    hideSelectionPopover();
  }
});

window.addEventListener("pagehide", saveEpubReadingProgressNow);
window.addEventListener("beforeunload", saveEpubReadingProgressNow);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) saveEpubReadingProgressNow();
});

window.readerEngine = {
  getState() {
    const totalPages = chapters.length || 0;
    return {
      currentPage: currentChapter,
      totalPages,
      readablePages: totalPages,
      progress: totalPages > 0 ? Math.round((currentChapter / totalPages) * 100) : 0,
      isPreviewMode,
      fitMode: "epub",
      currentScale: readerSettings.fontSize / 22,
      contentWidthFactor: readerSettings.readingWidth / 880,
    };
  },
  goToPage,
  searchDocument,
  ensureSearchIndex: async () => searchIndex || buildSearchIndex(),
  getPageText,
  getDocumentText,
  setContentWidthFactor(nextFactor) {
    readerSettings.readingWidth = clamp(Math.round(880 * Number(nextFactor || 1)), 560, 1120);
    readingWidthControl.value = String(readerSettings.readingWidth);
    applySettings();
    saveSettings();
  },
  adjustScale(delta) {
    readerSettings.fontSize = clamp(readerSettings.fontSize + Number(delta || 0) * 10, 16, 32);
    fontSizeControl.value = String(readerSettings.fontSize);
    applySettings();
    saveSettings();
  },
  setFitMode() {
    applySettings();
  },
};

window.PDF_LIBRARY_READER_CONTEXT = window.readerEngine;

function goToPage(chapterNumber) {
  renderChapter(chapterNumber);
}

} catch (error) {
  console.error("EPUB ENGINE CRASH:", error?.stack || error);
  window._EPUB_ENGINE_ERROR = error?.stack || String(error);
}
