const CLIENT_ID =
  window.PDF_LIBRARY_CONFIG?.GOOGLE_CLIENT_ID ||
  "492249193220-e9hpnb9hgnmsrdi68m64mvuomg8589n3.apps.googleusercontent.com";

let tokenClient;
let accounts = [];
let activeEmail = null;
let isAccordionExpanded = false;
const READING_PROGRESS_KEY_PREFIX = "pdf_lib_reading_progress_v1";
const RECENT_HISTORY_KEY_PREFIX = "pdf_lib_recent_books";
const MY_LIST_KEY_PREFIX = "pdf_lib_my_list_v1";
const LIBRARY_SETTINGS_KEY_PREFIX = "pdf_lib_user_settings_v1";
const DB_USER_ID_KEY_PREFIX = "db_user_id";
const SESSION_TOKEN_KEY_PREFIX = "pdf_lib_session_token_v1";
const ACCESS_TOKEN_KEY_PREFIX = "pdf_lib_google_access_token_v1";
const ACCESS_TOKEN_EXPIRY_KEY_PREFIX = "pdf_lib_google_access_token_expiry_v1";
const STORAGE_MIGRATION_META_KEY = "pdf_lib_storage_migration_v2";
const PUBLIC_LIBRARY_CACHE_KEY = "pdf_lib_public_books_cache_v1";
const PUBLIC_LIBRARY_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LIBRARY_FETCH_TIMEOUT_MS = 75000;
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

// DOM Elements
const signInBtn = document.getElementById("sign-in-btn");
const profileBtn = document.getElementById("profile-btn");
const sitePremiumBtn = document.getElementById("site-premium-btn");
const profileImg = document.getElementById("profile-img");
const profileInitials = document.getElementById("profile-initials");
const profileName = document.getElementById("profile-name");
const profilePopup = document.getElementById("profile-popup");
const closePopupBtn = document.getElementById("close-popup-btn");
const globalSearchBtn = document.getElementById("search-open-btn");

const popupEmail = document.getElementById("popup-email");
const popupImg = document.getElementById("popup-img");
const popupInitials = document.getElementById("popup-initials");
const popupGreeting = document.getElementById("popup-greeting");
const trainingMegaShell = document.getElementById("training-mega-shell");
const trainingNavBar = document.getElementById("training-nav-bar");
const trainingMegaPanel = document.getElementById("training-mega-panel");
const trainingMegaBackdrop = document.getElementById("training-mega-backdrop");
const trainingPanelLinks = document.getElementById("training-panel-links");
const trainingPanelTitle = document.getElementById("training-panel-title");
const trainingBookGrid = document.getElementById("training-book-grid");
const openSettingsBtn = document.getElementById("open-settings-btn");
const settingsBackdrop = document.getElementById("settings-backdrop");
const settingsPanel = document.getElementById("settings-panel");
const closeSettingsBtn = document.getElementById("close-settings-btn");
const settingsDetail = document.getElementById("settings-detail");
const settingsMyListCount = document.getElementById("settings-my-list-count");

let allLibraryBooks = [];
let searchableBooks = [];
let currentSearchResults = [];
let searchCloseTimer = null;
let hasRestoredSession = false;
let currentSettingsSection = "my-list";
let pendingSitePremiumCheckout = false;
const HOME_ROW_SIZE = 10;
const HOME_PAGE_BOOK_LIMIT = 68;
const HOME_MAX_ROWS = Math.ceil(HOME_PAGE_BOOK_LIMIT / HOME_ROW_SIZE);
const HOME_TRENDING_ROW_SIZE = 10;
const SEARCH_PANEL_LIMIT = 15;
const HOME_FIXED_TITLES = [
  "Editor Picks",
  "Trending Fiction & Masterpieces",
  "Critically Acclaimed & Drama",
  "Fascinating Reads & Non-Fiction",
  "Academic, Science & History",
  "Fresh Discoveries",
  "More Top Picks",
  "Explore More Books",
];
const TRAINING_BOOK_COUNT = 10;
const TRAINING_TAB_CONFIG = [
  {
    id: "training",
    label: "Training",
    title: "Training Essentials",
    terms: [
      "training",
      "study",
      "education",
      "academic",
      "science",
      "engineering",
      "business",
      "technology",
      "skills",
      "programming",
    ],
  },
  {
    id: "fiction",
    label: "Fiction Books",
    title: "Fiction Books",
    terms: ["fiction", "literature", "fantasy", "drama", "romance", "adventure"],
  },
  {
    id: "novels",
    label: "Novels",
    title: "Novel Collection",
    terms: ["novel", "novella", "literary"],
  },
  {
    id: "trending",
    label: "Trending",
    title: "Trending Right Now",
    terms: [],
  },
  {
    id: "mystery",
    label: "Mystery",
    title: "Mystery & Thriller",
    terms: ["mystery", "thriller", "crime", "detective", "suspense", "horror"],
  },
  {
    id: "classics",
    label: "Classics",
    title: "Classic Masterpieces",
    terms: [
      "classic",
      "classics",
      "shakespeare",
      "jane austen",
      "mark twain",
      "jules verne",
      "dickens",
      "poe",
    ],
  },
];
let trainingCategoryBooks = {};
let activeTrainingCategoryId = TRAINING_TAB_CONFIG[0].id;
let trainingMegaInitialized = false;
let trainingCloseTimer = null;
let restoreSessionPromise = null;
let authStateVersion = 0;
let signInResetTimer = null;

function buildApiUrl(path) {
  return `${API_ORIGIN}${path}`;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function slugifyPublicUrlPart(value, fallback = "book") {
  const slug = normalizeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
  return slug || fallback;
}

function buildPublicBookUrl(book) {
  const id = normalizeText(book?.id);
  const title = normalizeText(book?.title) || "Untitled";
  if (!id) {
    const params = new URLSearchParams({ q: title });
    return `/?${params.toString()}`;
  }
  const params = new URLSearchParams({ id, title });
  return `book-detail.html?${params.toString()}`;
}

function hasPosterAsset(book) {
  if (book?.poster_url || book?.cover_url) return true;
  const posterId = normalizeText(book?.poster_drive_id).toLowerCase();
  return Boolean(posterId) && posterId !== "no poster available";
}

function normalizeDriveAssetId(value) {
  const id = normalizeText(value);
  if (!id) return "";
  const lowered = id.toLowerCase();
  if (
    lowered === "no poster available" ||
    lowered === "no cover available" ||
    lowered === "no image available" ||
    lowered === "no pdf available" ||
    lowered === "no epub available" ||
    lowered === "null" ||
    lowered === "undefined" ||
    lowered === "n/a" ||
    lowered === "na"
  ) {
    return "";
  }
  return id;
}

function getNumericBookId(value) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function buildReaderDocumentId(bookOrId, format, fallbackValue = "") {
  const normalizedFallback = normalizeDriveAssetId(fallbackValue);
  if (normalizedFallback && /^book:\d+:(pdf|epub)$/i.test(normalizedFallback)) {
    return normalizedFallback;
  }

  const book =
    bookOrId && typeof bookOrId === "object"
      ? bookOrId
      : null;
  const bookId =
    book
      ? getNumericBookId(book?.id)
      : getNumericBookId(bookOrId);
  const hasReadableFormat = format === "epub"
    ? Boolean(book?.has_epub || normalizedFallback)
    : Boolean(book?.has_pdf || normalizedFallback);

  if (bookId && hasReadableFormat) {
    return `book:${bookId}:${format}`;
  }

  return normalizedFallback;
}

function getBookCoverDriveId(book) {
  return (
    normalizeDriveAssetId(book?.poster_url) ||
    normalizeDriveAssetId(book?.cover_url) ||
    normalizeDriveAssetId(book?.poster_drive_id) ||
    normalizeDriveAssetId(book?.cover_drive_id)
  );
}

function hasDisplayableCoverArt(book) {
  return Boolean(getBookCoverDriveId(book));
}

function buildDriveThumbnailUrl(driveId, size = "w800") {
  const safeId = normalizeDriveAssetId(driveId);
  if (!safeId) return "";
  if (safeId.startsWith("/api/")) return buildApiUrl(safeId);
  if (/^https?:\/\//i.test(safeId)) return safeId;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(safeId)}&sz=${size}`;
}

function hasReadablePdf(book) {
  return Boolean(book?.has_pdf || normalizeDriveAssetId(book?.pdf_drive_id));
}

function hasReadableEpub(book) {
  return Boolean(book?.has_epub || normalizeDriveAssetId(book?.epub_drive_id));
}

function hasReadableBook(book) {
  return hasReadablePdf(book) || hasReadableEpub(book);
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

function getBookPremiumDetails(book) {
  const paymentsEnabled = Boolean(book?.payments_enabled);
  const bookPremiumEnabled = Boolean(book?.book_premium_enabled);
  const currency = String(book?.payment_currency || "INR").trim().toUpperCase() || "INR";

  if (!paymentsEnabled || !bookPremiumEnabled) {
    return {
      paymentRequired: false,
      badgeText: "",
      priceText: "",
    };
  }

  return {
    paymentRequired: true,
    badgeText: "Premium",
    priceText: Number(book?.book_price_paise || 0) > 0
      ? formatMoney(book.book_price_paise, currency)
      : "",
  };
}

function getSitePremiumDetails() {
  const sourceBook = allLibraryBooks.find(
    (book) => Boolean(book?.payments_enabled && book?.site_premium_enabled),
  );

  if (!sourceBook) {
    return {
      enabled: false,
      planKey: "monthly",
      priceText: "",
    };
  }

  const currency = String(sourceBook?.payment_currency || "INR").trim().toUpperCase() || "INR";
  const monthly = Number(sourceBook?.site_monthly_price_paise || 0);
  const annual = Number(sourceBook?.site_annual_price_paise || 0);

  return {
    enabled: true,
    planKey: monthly > 0 || annual <= 0 ? "monthly" : "annual",
    priceText: monthly > 0
      ? `${formatMoney(monthly, currency)}/month`
      : annual > 0
        ? `${formatMoney(annual, currency)}/year`
        : "",
  };
}

function getActiveUser() {
  return activeEmail ? accounts.find((account) => account.email === activeEmail) : null;
}

function renderSitePremiumButton() {
  if (!sitePremiumBtn) return;

  const sitePremium = getSitePremiumDetails();
  if (!sitePremium.enabled) {
    sitePremiumBtn.classList.add("hidden");
    sitePremiumBtn.disabled = true;
    sitePremiumBtn.removeAttribute("data-plan-key");
    sitePremiumBtn.title = "Join Premium";
    return;
  }

  sitePremiumBtn.disabled = false;
  sitePremiumBtn.classList.remove("hidden");
  sitePremiumBtn.dataset.planKey = sitePremium.planKey;
  sitePremiumBtn.title = sitePremium.priceText
    ? `Join Premium - ${sitePremium.priceText}`
    : "Join Premium";
}

async function startSitePremiumCheckout() {
  const sitePremium = getSitePremiumDetails();
  if (!sitePremium.enabled) return;

  const activeUser = getActiveUser();
  if (!activeUser) {
    pendingSitePremiumCheckout = true;
    requestGoogleAccessToken();
    return;
  }

  if (!window.PdfLibraryPayments?.startCheckout) {
    console.error("Payment checkout is not ready yet.");
    return;
  }

  if (sitePremiumBtn) {
    sitePremiumBtn.disabled = true;
    sitePremiumBtn.classList.add("is-loading");
  }

  try {
    await window.PdfLibraryPayments.startCheckout({
      scope: "site_subscription",
      planKey: sitePremium.planKey || "monthly",
      bookId: 0,
      title: "Premium subscription",
      user: activeUser,
    });
  } catch (error) {
    console.warn("Premium checkout was not completed:", error);
  } finally {
    if (sitePremiumBtn) {
      sitePremiumBtn.classList.remove("is-loading");
    }
    renderSitePremiumButton();
  }
}

function createPremiumBadgeNode(book) {
  const premium = getBookPremiumDetails(book);
  if (!premium.paymentRequired) return null;

  const badge = document.createElement("span");
  badge.className = "pdf-premium-badge";
  badge.textContent = premium.priceText
    ? `${premium.badgeText} â€¢ ${premium.priceText}`
    : premium.badgeText;
  badge.title = premium.priceText || premium.badgeText;
  return badge;
}

function shuffleArray(items) {
  const copy = Array.isArray(items) ? [...items] : [];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getNormalizedCategory(book) {
  const raw = normalizeText(book?.category);
  return raw || "Uncategorized";
}

function getRowTitle(index, rowBooks) {
  if (index < HOME_FIXED_TITLES.length) return HOME_FIXED_TITLES[index];
  const cat = normalizeText(rowBooks?.[0]?.category);
  if (cat && cat.toLowerCase() !== "uncategorized") {
    return `${cat} & Similar Reads`;
  }
  return "More Top Picks";
}

function getHomeBookKey(book) {
  const id = String(book?.id ?? "").trim();
  if (id) return `id:${id}`;

  const pdfId = normalizeDriveAssetId(book?.pdf_drive_id);
  if (pdfId) return `pdf:${pdfId}`;

  const epubId = normalizeDriveAssetId(book?.epub_drive_id);
  if (epubId) return `epub:${epubId}`;

  return `title:${normalizeText(book?.title).toLowerCase()}`;
}

function getFriendlyCategoryTitle(category, fallbackIndex) {
  const cleanCategory = normalizeText(category);
  if (cleanCategory && cleanCategory.toLowerCase() !== "uncategorized") {
    return `${cleanCategory} & Similar Reads`;
  }
  return HOME_FIXED_TITLES[fallbackIndex % HOME_FIXED_TITLES.length];
}

function getUniqueHomeRowTitle(title, usedTitles, fallbackIndex) {
  let cleanTitle = normalizeText(title) || HOME_FIXED_TITLES[fallbackIndex % HOME_FIXED_TITLES.length];
  if (!usedTitles.has(cleanTitle.toLowerCase())) return cleanTitle;

  const fallbackTitle = HOME_FIXED_TITLES.find(
    (candidate) => !usedTitles.has(candidate.toLowerCase()),
  );
  if (fallbackTitle) return fallbackTitle;

  return `More Library Picks ${fallbackIndex + 1}`;
}

function getBookActivityScore(book) {
  const key = getHomeBookKey(book);
  const bookId = String(book?.id ?? "").trim();
  let score = Number(book?.trending_score || book?.read_count || book?.view_count || 0);

  if (Array.isArray(userHistory)) {
    userHistory.forEach((item, index) => {
      const itemKey = getHomeBookKey(item);
      if (itemKey === key || (bookId && String(item?.id ?? "").trim() === bookId)) {
        score += Math.max(1, 12 - index);
      }
    });
  }

  if (typeof loadReadingProgressMap === "function") {
    const progressMap = loadReadingProgressMap();
    const progressKeys = [
      buildReaderDocumentId(book, "pdf", book?.pdf_drive_id),
      buildReaderDocumentId(book, "epub", book?.epub_drive_id),
      normalizeDriveAssetId(book?.pdf_drive_id),
      normalizeDriveAssetId(book?.epub_drive_id),
    ].filter(Boolean);

    progressKeys.forEach((progressKey) => {
      const progress = progressMap[progressKey];
      if (!progress) return;
      score += 2 + Math.max(0, Math.min(100, Number(progress.progress || 0))) / 10;
    });
  }

  return score;
}

function getTrendingHomeBooks(source, usedBookKeys) {
  return source
    .map((book) => ({
      book,
      score: getBookActivityScore(book),
    }))
    .filter((entry) => entry.score > 0 && !usedBookKeys.has(getHomeBookKey(entry.book)))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.book)
    .slice(0, HOME_TRENDING_ROW_SIZE);
}

function takeUniqueBooks(source, usedBookKeys, count) {
  const picked = [];
  for (const book of source) {
    if (picked.length >= count) break;
    const key = getHomeBookKey(book);
    if (!key || usedBookKeys.has(key)) continue;
    usedBookKeys.add(key);
    picked.push(book);
  }
  return picked;
}

function fillHomeRow(primaryBooks, fallbackBooks, usedBookKeys) {
  const rowBooks = takeUniqueBooks(primaryBooks, usedBookKeys, HOME_ROW_SIZE);
  if (rowBooks.length < HOME_ROW_SIZE) {
    rowBooks.push(
      ...takeUniqueBooks(fallbackBooks, usedBookKeys, HOME_ROW_SIZE - rowBooks.length),
    );
  }
  return rowBooks;
}

function buildHomeRows(sourceBooks) {
  const sourcePool = shuffleArray(sourceBooks).slice(0, HOME_PAGE_BOOK_LIMIT);
  const shuffledBooks = shuffleArray(sourcePool);
  const displayLimit = Math.min(HOME_PAGE_BOOK_LIMIT, shuffledBooks.length);
  const usedBookKeys = new Set();
  const usedTitles = new Set();
  const rows = [];
  let displayedBookCount = 0;

  const addRow = (title, books) => {
    if (displayedBookCount >= displayLimit) return;
    if (!Array.isArray(books) || books.length === 0) return;

    const remainingSlots = displayLimit - displayedBookCount;
    const rowBooks = books.slice(0, Math.min(HOME_ROW_SIZE, remainingSlots));
    if (rowBooks.length === 0) return;

    const cleanTitle = getUniqueHomeRowTitle(title, usedTitles, rows.length);
    usedTitles.add(cleanTitle.toLowerCase());
    rows.push({
      title: cleanTitle,
      books: rowBooks,
    });
    displayedBookCount += rowBooks.length;
  };

  const categoryMap = new Map();
  for (const book of shuffledBooks) {
    const category = getNormalizedCategory(book);
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category).push(book);
  }

  addRow("Editor Picks", fillHomeRow(shuffledBooks, shuffledBooks, usedBookKeys));

  const categoryNames = shuffleArray(Array.from(categoryMap.keys()));

  const trendingBooks = getTrendingHomeBooks(shuffledBooks, usedBookKeys);
  if (trendingBooks.length > 0 && rows.length < HOME_MAX_ROWS) {
    const trendingRowBooks = fillHomeRow(trendingBooks, shuffledBooks, usedBookKeys);
    addRow("Trending Now", trendingRowBooks);
  }

  for (const category of categoryNames) {
    if (rows.length >= HOME_MAX_ROWS || displayedBookCount >= displayLimit) break;
    addRow(
      getFriendlyCategoryTitle(category, rows.length),
      fillHomeRow(shuffleArray(categoryMap.get(category)), shuffledBooks, usedBookKeys),
    );
  }

  let fallbackIndex = 0;
  while (
    rows.length < HOME_MAX_ROWS &&
    displayedBookCount < displayLimit &&
    usedBookKeys.size < shuffledBooks.length
  ) {
    const title = HOME_FIXED_TITLES[fallbackIndex % HOME_FIXED_TITLES.length];
    fallbackIndex += 1;
    addRow(title, fillHomeRow(shuffledBooks, shuffledBooks, usedBookKeys));
  }

  return rows.slice(0, HOME_MAX_ROWS);
}

function getSearchSourceBooks() {
  const source = Array.isArray(allLibraryBooks) ? allLibraryBooks : [];
  return source.filter((book) => {
    if (!book || typeof book !== "object") return false;
    if (!normalizeText(book.title)) return false;
    return hasReadableBook(book);
  });
}

function getBookInitials(title) {
  const words = normalizeText(title).split(/\s+/).filter(Boolean);
  if (words.length === 0) return "BK";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function createBookCoverFallbackElement(title, className = "") {
  const fallback = document.createElement("div");
  fallback.className = `${className} book-cover-fallback`.trim();
  fallback.setAttribute("aria-hidden", "true");

  const initials = document.createElement("span");
  initials.textContent = getBookInitials(title);
  fallback.appendChild(initials);
  return fallback;
}

function createBookCoverNode(book, options = {}) {
  const {
    className = "",
    fallbackClassName = "",
    size = "w800",
    altText = normalizeText(book?.title) || "Book cover",
    fallbackBehavior = "show",
    onMissingCover = null,
    onCoverError = null,
  } = options;

  const coverId = getBookCoverDriveId(book);
  if (!coverId) {
    if (fallbackBehavior === "none") {
      if (typeof onMissingCover === "function") onMissingCover();
      return null;
    }
    return createBookCoverFallbackElement(altText, `${className} ${fallbackClassName}`.trim());
  }

  const img = document.createElement("img");
  img.className = className;
  img.alt = altText;
  img.loading = "lazy";
  img.referrerPolicy = "no-referrer";
  img.src = buildDriveThumbnailUrl(coverId, size);
  img.addEventListener(
    "error",
    () => {
      if (fallbackBehavior === "none") {
        if (typeof onCoverError === "function") onCoverError();
        img.remove();
        return;
      }
      const fallback = createBookCoverFallbackElement(
        altText,
        `${className} ${fallbackClassName}`.trim(),
      );
      img.replaceWith(fallback);
    },
    { once: true },
  );

  return img;
}

function getSearchCoverMarkup(book) {
  const safeTitle = escapeHtml(book?.title || "Book");
  const coverId = getBookCoverDriveId(book);
  if (coverId) {
    const posterUrl = buildDriveThumbnailUrl(coverId, "w260");
    return `<img src="${posterUrl}" alt="${safeTitle}" class="search-result-cover" loading="lazy" referrerpolicy="no-referrer" />`;
  }

  const initials = escapeHtml(getBookInitials(book?.title));
  return `
    <div class="search-result-cover search-result-cover-fallback" aria-hidden="true">
      <span>${initials}</span>
    </div>
  `;
}

function getSearchPremiumMarkup(book) {
  const premium = getBookPremiumDetails(book);
  if (!premium.paymentRequired) return "";
  return `<small class="search-premium-badge">${escapeHtml(premium.priceText || premium.badgeText)}</small>`;
}

function getTrainingTabById(categoryId) {
  return TRAINING_TAB_CONFIG.find((tab) => tab.id === categoryId) || TRAINING_TAB_CONFIG[0];
}

function getTrainingBookKey(book) {
  if (!book || typeof book !== "object") return "";
  const id = normalizeText(book.id);
  if (id) return `id:${id}`;
  const driveId = normalizeDriveAssetId(book.pdf_drive_id) || normalizeDriveAssetId(book.epub_drive_id);
  if (driveId) return `drive:${driveId}`;
  return `title:${normalizeText(book.title).toLowerCase()}`;
}

function getTrainingSourceBooks() {
  const source = Array.isArray(allLibraryBooks) ? allLibraryBooks : [];
  return source.filter(
    (book) =>
      book &&
      typeof book === "object" &&
      hasReadableBook(book) &&
      hasDisplayableCoverArt(book) &&
      normalizeText(book.title).length > 0,
  );
}

function matchesAnyTerm(book, terms) {
  if (!Array.isArray(terms) || terms.length === 0) return false;
  const haystack = `${normalizeText(book?.title)} ${normalizeText(book?.author)} ${normalizeText(book?.category)}`.toLowerCase();
  return terms.some((term) => haystack.includes(String(term || "").toLowerCase()));
}

function pickTrainingBooks(source, matcher, count = TRAINING_BOOK_COUNT) {
  const primary = shuffleArray(source.filter((book) => matcher(book)));
  const fallback = shuffleArray(source);
  const picked = [];
  const seen = new Set();

  const addBook = (book) => {
    const key = getTrainingBookKey(book);
    if (!key || seen.has(key)) return;
    seen.add(key);
    picked.push(book);
  };

  for (const book of primary) {
    if (picked.length >= count) break;
    addBook(book);
  }

  for (const book of fallback) {
    if (picked.length >= count) break;
    addBook(book);
  }

  return picked;
}

function buildTrainingCategoryBooks(source) {
  const bookSource = Array.isArray(source) ? source : [];
  const map = {};

  for (const config of TRAINING_TAB_CONFIG) {
    if (config.id === "trending") {
      map[config.id] = shuffleArray(bookSource).slice(0, TRAINING_BOOK_COUNT);
      continue;
    }
    map[config.id] = pickTrainingBooks(
      bookSource,
      (book) => matchesAnyTerm(book, config.terms),
      TRAINING_BOOK_COUNT,
    );
  }

  return map;
}

function updateTrainingActiveStates() {
  if (!trainingMegaShell) return;

  trainingMegaShell
    .querySelectorAll(".training-nav-item, .training-panel-link")
    .forEach((node) => {
      const isActive = node.dataset.categoryId === activeTrainingCategoryId;
      node.classList.toggle("active", isActive);
      if (node.classList.contains("training-nav-item")) {
        node.setAttribute("aria-selected", isActive ? "true" : "false");
      }
    });
}

function renderTrainingBooks(categoryId) {
  if (!trainingBookGrid) return;
  const books = Array.isArray(trainingCategoryBooks[categoryId])
    ? trainingCategoryBooks[categoryId]
    : [];

  trainingBookGrid.innerHTML = "";

  for (const book of books) {
    const card = document.createElement("button");
    const title = normalizeText(book.title) || "Untitled";
    const resumePage =
      typeof getResumePageForBook === "function" ? getResumePageForBook(book) : null;

    card.type = "button";
    card.className = "training-book-card";
    card.setAttribute("aria-label", `Open ${title}`);

    const img = createBookCoverNode(book, {
      className: "training-book-cover",
      fallbackClassName: "training-book-cover-fallback",
      size: "w800",
      altText: title,
      fallbackBehavior: "none",
      onMissingCover: () => card.remove(),
      onCoverError: () => card.remove(),
    });
    if (!img) continue;

    const label = document.createElement("span");
    label.className = "training-book-title";
    label.textContent = title;

    card.appendChild(img);
    card.appendChild(label);
    card.addEventListener("click", () => {
      if (typeof window.openBook === "function") {
        window.openBook(book.id, title, book.pdf_drive_id, resumePage);
        return;
      }
      window.location.href = buildPublicBookUrl(book);
    });

    trainingBookGrid.appendChild(card);
  }
}

function setActiveTrainingCategory(categoryId) {
  const config = getTrainingTabById(categoryId);
  activeTrainingCategoryId = config.id;
  if (trainingPanelTitle) {
    trainingPanelTitle.textContent = config.title;
  }
  updateTrainingActiveStates();
  renderTrainingBooks(config.id);
}

function renderTrainingPanelLinks() {
  if (!trainingPanelLinks) return;
  trainingPanelLinks.innerHTML = "";

  for (const config of TRAINING_TAB_CONFIG) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "training-panel-link";
    button.dataset.categoryId = config.id;
    button.textContent = config.label;
    button.addEventListener("mouseenter", () => setActiveTrainingCategory(config.id));
    button.addEventListener("focus", () => setActiveTrainingCategory(config.id));
    button.addEventListener("click", () => setActiveTrainingCategory(config.id));
    trainingPanelLinks.appendChild(button);
  }
}

function isCompactTrainingMegaPanel() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function renderTrainingNavTabs() {
  if (!trainingNavBar) return;
  trainingNavBar.innerHTML = "";

  for (const config of TRAINING_TAB_CONFIG) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "training-nav-item";
    button.dataset.categoryId = config.id;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", "false");
    button.textContent = config.label;
    button.addEventListener("mouseenter", () => openTrainingMegaPanel(config.id));
    button.addEventListener("focus", () => openTrainingMegaPanel(config.id));
    button.addEventListener("click", () => openTrainingMegaPanel(config.id));

    trainingNavBar.appendChild(button);
  }
}

function openTrainingMegaPanel(categoryId = activeTrainingCategoryId) {
  if (!trainingMegaShell || !trainingMegaPanel) return;
  if (trainingCloseTimer) {
    clearTimeout(trainingCloseTimer);
    trainingCloseTimer = null;
  }
  if (trainingMegaBackdrop && trainingNavBar && !isCompactTrainingMegaPanel()) {
    const navRect = trainingNavBar.getBoundingClientRect();
    const overlayTop = Math.max(0, Math.floor(navRect.bottom + 8));
    trainingMegaBackdrop.style.top = `${overlayTop}px`;
  }
  setActiveTrainingCategory(categoryId);
  trainingMegaShell.classList.add("open");
  trainingMegaPanel.setAttribute("aria-hidden", "false");
}

function closeTrainingMegaPanel() {
  if (!trainingMegaShell || !trainingMegaPanel) return;
  trainingMegaShell.classList.remove("open");
  trainingMegaPanel.setAttribute("aria-hidden", "true");
}

function scheduleCloseTrainingMegaPanel() {
  if (!trainingMegaShell) return;
  if (trainingCloseTimer) {
    clearTimeout(trainingCloseTimer);
  }
  trainingCloseTimer = window.setTimeout(() => {
    closeTrainingMegaPanel();
    trainingCloseTimer = null;
  }, 130);
}

function ensureTrainingMegaInteractions() {
  if (trainingMegaInitialized || !trainingMegaShell) return;
  trainingMegaInitialized = true;

  trainingMegaShell.addEventListener("mouseenter", () => {
    if (trainingCloseTimer) {
      clearTimeout(trainingCloseTimer);
      trainingCloseTimer = null;
    }
  });
  trainingMegaShell.addEventListener("mouseleave", scheduleCloseTrainingMegaPanel);

  if (trainingMegaBackdrop) {
    trainingMegaBackdrop.addEventListener("click", closeTrainingMegaPanel);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && trainingMegaShell.classList.contains("open")) {
      closeTrainingMegaPanel();
    }
  });
}

function renderTrainingMegaSection() {
  if (!trainingMegaShell) return;

  const sourceBooks = getTrainingSourceBooks();
  if (!sourceBooks.length) {
    trainingMegaShell.classList.add("hidden");
    return;
  }

  trainingMegaShell.classList.remove("hidden");
  ensureTrainingMegaInteractions();
  trainingCategoryBooks = buildTrainingCategoryBooks(sourceBooks);

  if (!trainingCategoryBooks[activeTrainingCategoryId]?.length) {
    activeTrainingCategoryId = TRAINING_TAB_CONFIG[0].id;
  }

  renderTrainingNavTabs();
  renderTrainingPanelLinks();
  setActiveTrainingCategory(activeTrainingCategoryId);
}

function rerenderLibraryRowsForFreshLayout() {
  if (!Array.isArray(allLibraryBooks) || allLibraryBooks.length === 0) return;
  renderPDFRows(allLibraryBooks);
  renderTrainingMegaSection();
}

function normalizeEmailKey(email) {
  return String(email || "").trim().toLowerCase();
}

function emitActiveUserChanged() {
  window.dispatchEvent(
    new CustomEvent("pdf-lib:active-user-changed", {
      detail: { activeEmail: normalizeEmailKey(activeEmail) || null },
    }),
  );
}

function getPreferredLegacyOwnerEmailKey(fallbackEmail) {
  const fallback = normalizeEmailKey(fallbackEmail);
  try {
    const parsed = JSON.parse(localStorage.getItem("pdf_lib_accounts") || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = normalizeEmailKey(parsed[0]?.email);
      if (first) return first;
    }
  } catch {
    // Ignore malformed account cache.
  }
  return fallback;
}

function getScopedStorageKey(prefix, email = activeEmail) {
  const emailKey = normalizeEmailKey(email);
  return emailKey ? `${prefix}::${emailKey}` : `${prefix}::guest`;
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

function readRawStorageValue(key) {
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function migrateLegacyValueIfNeeded(prefix, email = activeEmail) {
  const scopedKey = getScopedStorageKey(prefix, email);
  if (!scopedKey) return null;

  const scopedRaw = readRawStorageValue(scopedKey);
  if (scopedRaw !== null) return scopedRaw;

  const legacyRaw = readRawStorageValue(prefix);
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

function readScopedJSON(prefix, fallbackValue, email = activeEmail) {
  const scopedKey = getScopedStorageKey(prefix, email);
  if (!scopedKey) return fallbackValue;

  const rawValue = readRawStorageValue(scopedKey);
  const valueToParse =
    rawValue !== null ? rawValue : migrateLegacyValueIfNeeded(prefix, email);
  if (valueToParse === null || valueToParse === undefined) return fallbackValue;

  try {
    const parsed = JSON.parse(valueToParse);
    return parsed === null || parsed === undefined ? fallbackValue : parsed;
  } catch {
    return fallbackValue;
  }
}

function writeScopedJSON(prefix, value, email = activeEmail) {
  const scopedKey = getScopedStorageKey(prefix, email);
  if (!scopedKey) return;
  try {
    localStorage.setItem(scopedKey, JSON.stringify(value));
  } catch {
    // Ignore storage write errors (quota/private mode).
  }
}

function writeScopedValue(prefix, value, email = activeEmail) {
  const scopedKey = getScopedStorageKey(prefix, email);
  if (!scopedKey) return;
  try {
    localStorage.setItem(scopedKey, String(value));
  } catch {
    // Ignore storage write errors (quota/private mode).
  }
}

function readScopedValue(prefix, email = activeEmail) {
  const scopedKey = getScopedStorageKey(prefix, email);
  if (!scopedKey) return null;
  const scopedRaw = readRawStorageValue(scopedKey);
  if (scopedRaw !== null) return scopedRaw;
  return migrateLegacyValueIfNeeded(prefix, email);
}

function removeScopedValue(prefix, email = activeEmail) {
  const scopedKey = getScopedStorageKey(prefix, email);
  if (!scopedKey) return;
  try {
    localStorage.removeItem(scopedKey);
  } catch {
    // Ignore storage write errors (quota/private mode).
  }
}

function clearSignInResetTimer() {
  if (!signInResetTimer) return;
  window.clearTimeout(signInResetTimer);
  signInResetTimer = null;
}

function resetMainSignInButton() {
  clearSignInResetTimer();
  if (!signInBtn) return;
  signInBtn.disabled = false;
  signInBtn.classList.remove("is-loading");
  signInBtn.removeAttribute("aria-busy");
  signInBtn.textContent = "Sign in";
}

function markMainSignInBusy(requestVersion) {
  if (!signInBtn || signInBtn.classList.contains("hidden")) return;
  clearSignInResetTimer();
  signInBtn.disabled = true;
  signInBtn.classList.add("is-loading");
  signInBtn.setAttribute("aria-busy", "true");
  signInBtn.textContent = "Opening...";
  signInResetTimer = window.setTimeout(() => {
    if (requestVersion === authStateVersion) {
      resetMainSignInButton();
    }
  }, 25000);
}

function initializeGoogleIdentityClient() {
  if (tokenClient) return;
  if (!window.google || !google.accounts || !google.accounts.oauth2) return;

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: "openid email profile",
    prompt: "select_account",
    callback: async (tokenResponse) => {
      const requestVersion = authStateVersion;
      clearSignInResetTimer();
      if (tokenResponse && tokenResponse.access_token) {
        try {
          await handleLogin(
            tokenResponse.access_token,
            Number(tokenResponse.expires_in || 0),
            { requestVersion },
          );
        } catch (error) {
          console.error("Failed to fetch user info", error);
          resetMainSignInButton();
        }
      } else {
        resetMainSignInButton();
      }
    },
    error_callback: () => {
      resetMainSignInButton();
    },
  });
}

async function fetchServerSessionUser() {
  try {
    const headers = {};
    const sessionToken = getStoredSessionToken();
    if (sessionToken) {
      headers.Authorization = `Bearer ${sessionToken}`;
    }

    const response = await fetch(buildApiUrl("/api/auth/session"), {
      credentials: "include",
      headers,
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (data?.sessionToken && data?.user?.email) {
      storeSessionToken(data.sessionToken, data.user.email);
    }
    return data?.user?.email ? data.user : null;
  } catch {
    return null;
  }
}

function getStoredSessionToken(email = activeEmail) {
  return readScopedValue(SESSION_TOKEN_KEY_PREFIX, email);
}

function storeSessionToken(sessionToken, email = activeEmail) {
  if (!sessionToken || !email) return;
  writeScopedValue(SESSION_TOKEN_KEY_PREFIX, sessionToken, email);
}

function storeAccessToken(accessToken, expiresInSeconds, email = activeEmail) {
  if (!accessToken || !email) return;
  writeScopedValue(ACCESS_TOKEN_KEY_PREFIX, accessToken, email);

  const expiresIn = Number(expiresInSeconds || 0);
  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    writeScopedValue(ACCESS_TOKEN_EXPIRY_KEY_PREFIX, Date.now() + expiresIn * 1000, email);
    return;
  }

  removeScopedValue(ACCESS_TOKEN_EXPIRY_KEY_PREFIX, email);
}

function clearLegacyReaderTokens(email = activeEmail) {
  if (!email) return;
  removeScopedValue(SESSION_TOKEN_KEY_PREFIX, email);
  removeScopedValue(ACCESS_TOKEN_KEY_PREFIX, email);
  removeScopedValue(ACCESS_TOKEN_EXPIRY_KEY_PREFIX, email);
}

function syncScopedLibraryStateDeferred() {
  if (typeof window.syncScopedLibraryState === "function") {
    window.syncScopedLibraryState();
  } else {
    setTimeout(() => {
      if (typeof window.syncScopedLibraryState === "function") {
        window.syncScopedLibraryState();
      }
    }, 0);
  }
}

function restoreSavedSession() {
  if (hasRestoredSession) return restoreSessionPromise;
  hasRestoredSession = true;

  const savedAccounts = localStorage.getItem("pdf_lib_accounts");
  if (savedAccounts) {
    try {
      const parsed = JSON.parse(savedAccounts);
      accounts = Array.isArray(parsed) ? parsed : [];
    } catch {
      accounts = [];
    }
  } else {
    accounts = [];
  }

  const savedActiveEmail = normalizeEmailKey(localStorage.getItem("pdf_lib_active_email"));
  const savedActiveAccount =
    accounts.find((account) => normalizeEmailKey(account?.email) === savedActiveEmail) ||
    accounts[0] ||
    null;
  activeEmail = savedActiveAccount?.email || null;
  if (activeEmail) {
    localStorage.setItem("pdf_lib_active_email", activeEmail);
  } else {
    localStorage.removeItem("pdf_lib_active_email");
  }

  updateUI();

  restoreSessionPromise = (async () => {
    const restoreVersion = authStateVersion;
    const sessionUser = await fetchServerSessionUser();
    if (restoreVersion !== authStateVersion) {
      return;
    }

    if (sessionUser?.email) {
      const exists = accounts.find((account) => account.email === sessionUser.email);
      if (!exists) {
        accounts.push(sessionUser);
      } else {
        Object.assign(exists, sessionUser);
      }
      activeEmail = sessionUser.email;
      localStorage.setItem("pdf_lib_accounts", JSON.stringify(accounts));
      localStorage.setItem("pdf_lib_active_email", activeEmail);
    } else {
      const stillActive =
        accounts.find((account) => normalizeEmailKey(account?.email) === normalizeEmailKey(activeEmail)) ||
        accounts[0] ||
        null;
      activeEmail = stillActive?.email || null;
      if (activeEmail) {
        localStorage.setItem("pdf_lib_active_email", activeEmail);
      } else {
        localStorage.removeItem("pdf_lib_active_email");
      }
    }

    updateUI();
    syncScopedLibraryStateDeferred();
  })();

  return restoreSessionPromise;
}

function requestGoogleAccessToken() {
  initializeGoogleIdentityClient();
  if (!tokenClient) {
    console.error("Google Identity client is not ready yet.");
    resetMainSignInButton();
    return;
  }
  authStateVersion += 1;
  const requestVersion = authStateVersion;
  markMainSignInBusy(requestVersion);
  try {
    tokenClient.requestAccessToken({ prompt: "select_account" });
  } catch (error) {
    console.error("Google sign-in could not start:", error);
    resetMainSignInButton();
  }
}

window.addEventListener("load", () => {
  initializeGoogleIdentityClient();
  restoreSavedSession();
});

if (document.readyState !== "loading") {
  restoreSavedSession();
  initializeGoogleIdentityClient();
} else {
  document.addEventListener("DOMContentLoaded", () => {
    restoreSavedSession();
    initializeGoogleIdentityClient();
  });
}


// Listen for auth changes from reader pages (PDF viewer, EPUB viewer)
// If user signs in on a reader page, auto-update the main homepage UI
window.addEventListener("storage", (event) => {
  if (event.key === "pdf_lib_active_email" && event.newValue) {
    const newEmailKey = normalizeEmailKey(event.newValue);
    if (newEmailKey && newEmailKey !== normalizeEmailKey(activeEmail)) {
      // Re-read accounts from localStorage (the reader page may have added them)
      try {
        const parsed = JSON.parse(localStorage.getItem("pdf_lib_accounts") || "[]");
        accounts = Array.isArray(parsed) ? parsed : [];
      } catch {
        accounts = [];
      }
      activeEmail = event.newValue;
      updateUI();
      if (typeof window.syncScopedLibraryState === "function") {
        window.syncScopedLibraryState();
      }
    }
  }
});

function getInitials(name, email) {
  if (name)
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  if (email) return email.substring(0, 2).toUpperCase();
  return "U";
}

async function handleLogin(accessToken, _expiresInSeconds = 0, context = {}) {
  if (!accessToken) {
    throw new Error("Missing Google access token.");
  }

  const response = await fetch(buildApiUrl("/api/auth/login"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accessToken,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Backend login verification failed.");
  }

  const user = data?.user;
  if (!user?.email) {
    throw new Error("Verified user profile is missing from backend response.");
  }

  const requestVersion = Number(context?.requestVersion || 0);
  if (requestVersion && requestVersion < authStateVersion) {
    return;
  }

  // Move the newly-logged-in account to position 0 (top of list = active)
  const existingIndex = accounts.findIndex((a) => a.email === user.email);
  if (existingIndex === -1) {
    accounts.unshift(user); // New account â€” add to top
  } else {
    Object.assign(accounts[existingIndex], user);
    // Move to top if not already there
    if (existingIndex !== 0) {
      const updated = accounts.splice(existingIndex, 1)[0];
      accounts.unshift(updated);
    }
  }
  authStateVersion = Math.max(authStateVersion, requestVersion || 0);
  activeEmail = user.email;
  localStorage.setItem("pdf_lib_accounts", JSON.stringify(accounts));
  localStorage.setItem("pdf_lib_active_email", activeEmail);
  storeSessionToken(data.sessionToken, user.email);
  storeAccessToken(accessToken, _expiresInSeconds, user.email);

  console.log("Backend Response:", data.message);

  // Save the internal Database User ID for future features (like history)
  if (data.userId) {
      localStorage.setItem("db_user_id", data.userId);
      writeScopedValue(DB_USER_ID_KEY_PREFIX, data.userId, user.email);
  } else if (data.user && data.user.id) {
      localStorage.setItem("db_user_id", data.user.id);
      writeScopedValue(DB_USER_ID_KEY_PREFIX, data.user.id, user.email);
  }
  updateUI();

  if (typeof window.syncScopedLibraryState === "function") {
    window.syncScopedLibraryState();
  }

  if (pendingSitePremiumCheckout) {
    pendingSitePremiumCheckout = false;
    startSitePremiumCheckout();
  }
}

window.switchAccount = function (email) {
  if (!email || email === activeEmail) {
    profilePopup.classList.add("hidden");
    isAccordionExpanded = false;
    return;
  }

  const targetIndex = accounts.findIndex((a) => a.email === email);
  if (targetIndex === -1) {
    // Not stored locally â€” fall back to Google picker
    profilePopup.classList.add("hidden");
    isAccordionExpanded = false;
    requestGoogleAccessToken();
    return;
  }

  // Reorder: move clicked account to position 0, keep rest in order
  const targetAccount = accounts[targetIndex];
  accounts.splice(targetIndex, 1);      // remove from current spot
  accounts.unshift(targetAccount);      // place at top
  activeEmail = email;

  localStorage.setItem("pdf_lib_accounts", JSON.stringify(accounts));
  localStorage.setItem("pdf_lib_active_email", activeEmail);

  isAccordionExpanded = false;
  profilePopup.classList.add("hidden");
  updateUI();
  syncScopedLibraryStateDeferred();
};

window.handleLogout = async function () {
  try {
    await fetch(buildApiUrl("/api/auth/logout"), {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.warn("Logout request failed:", error);
  }

  // Remove only the currently-active account from the stored list
  const prevEmail = activeEmail;
  clearLegacyReaderTokens(prevEmail);
  accounts = accounts.filter((a) => a.email !== prevEmail);
  authStateVersion += 1;
  isAccordionExpanded = false;
  profilePopup.classList.add("hidden");

  if (accounts.length > 0) {
    // Auto-activate the next account in the list (the one that was below)
    activeEmail = accounts[0].email;
    localStorage.setItem("pdf_lib_accounts", JSON.stringify(accounts));
    localStorage.setItem("pdf_lib_active_email", activeEmail);
  } else {
    // No more accounts â€” fully sign out
    activeEmail = null;
    localStorage.removeItem("pdf_lib_active_email");
    localStorage.removeItem("pdf_lib_accounts");
  }

  updateUI();
  syncScopedLibraryStateDeferred();

  // If auto-switched to next account, silently re-sync with backend
  // so server session reflects the new active account (best-effort)
  if (accounts.length > 0) {
    fetchServerSessionUser().then((sessionUser) => {
      if (sessionUser?.email && sessionUser.email === activeEmail) {
        const exists = accounts.find((a) => a.email === sessionUser.email);
        if (exists) Object.assign(exists, sessionUser);
        localStorage.setItem("pdf_lib_accounts", JSON.stringify(accounts));
        updateUI();
      }
    }).catch(() => { /* network error â€” UI already updated locally */ });
  }
};

window.toggleAccordion = function () {
  isAccordionExpanded = !isAccordionExpanded;
  renderAuthActions();
};

window.addAccount = function () {
  requestGoogleAccessToken();
};

function renderAuthActions() {
  const container = document.getElementById("auth-actions-container");
  if (!container) return;

  const inactiveAccounts = accounts.filter((a) => a.email !== activeEmail);

  if (inactiveAccounts.length === 0) {
    // â”€â”€ Single Account View â”€â”€ (original design)
    container.innerHTML = `
      <div class="single-account-actions">
        <button class="action-btn" onclick="addAccount()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add account
        </button>
        <div class="divider"></div>
        <button class="action-btn" onclick="handleLogout()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Sign out
        </button>
      </div>
    `;
  } else {
    // â”€â”€ Multiple Accounts View â”€â”€ (original accordion design)
    if (!isAccordionExpanded) {
      // Collapsed: show avatar previews of other accounts
      const avatarsHtml = inactiveAccounts
        .slice(0, 2)
        .map((acc) => {
          const initials = escapeHtml(getInitials(acc.name, acc.email));
          const pictureSrc = safeImageSrc(acc.picture);
          return pictureSrc
            ? `<div class="collapsed-avatar"><img src="${escapeHtml(pictureSrc)}" referrerpolicy="no-referrer" alt=""></div>`
            : `<div class="collapsed-avatar"><span>${initials}</span></div>`;
        })
        .join("");

      container.innerHTML = `
        <div class="accounts-accordion">
          <button class="accordion-toggle" onclick="toggleAccordion()">
            <span style="font-size: 14px; font-weight: 500;">Show more accounts</span>
            <div class="accordion-toggle-right">
              <div class="collapsed-avatars">${avatarsHtml}</div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </button>
        </div>
      `;
    } else {
      // Expanded: show full account list
      let listHtml = "";
      inactiveAccounts.forEach((acc) => {
        const initials = escapeHtml(getInitials(acc.name, acc.email));
        const pictureSrc = safeImageSrc(acc.picture);
        const avatarHtml = pictureSrc
          ? `<img src="${escapeHtml(pictureSrc)}" referrerpolicy="no-referrer" alt="">`
          : `<span>${initials}</span>`;
        const safeEmail = escapeJsString(acc.email || "");

        listHtml += `
          <button class="secondary-account-item" onclick="switchAccount('${safeEmail}')">
            <div class="secondary-account-avatar">${avatarHtml}</div>
            <div class="secondary-account-info">
              <div class="secondary-account-name">${escapeHtml(acc.name || "User")}</div>
              <div class="secondary-account-email">${escapeHtml(acc.email)}</div>
            </div>
          </button>
        `;
      });

      container.innerHTML = `
        <div class="accounts-accordion">
          <button class="accordion-toggle" style="border-bottom: 1px solid #3c4043;" onclick="toggleAccordion()">
            <span style="font-size: 14px; font-weight: 500;">Hide more accounts</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
          </button>
          <div class="secondary-accounts-list">${listHtml}</div>
          <div class="expanded-actions">
            <button class="action-btn" onclick="addAccount()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Add another account
            </button>
            <button class="action-btn" onclick="handleLogout()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              Sign out
            </button>
          </div>
        </div>
      `;
    }
  }
}

function updateUI() {
  const activeUser = activeEmail
    ? accounts.find((a) => a.email === activeEmail)
    : null;

  if (activeUser) {
    signInBtn.classList.add("hidden");
    profileBtn.classList.remove("hidden");

    popupEmail.textContent = activeUser.email;
    const firstName =
      activeUser.given_name ||
      (activeUser.name ? activeUser.name.split(" ")[0] : "User");
    popupGreeting.textContent = `Hi, ${firstName}!`;
    if (profileName) profileName.textContent = firstName;

    const pictureSrc = safeImageSrc(activeUser.picture);
    if (pictureSrc) {
      profileImg.src = pictureSrc;
      profileImg.classList.remove("hidden");
      profileInitials.classList.add("hidden");

      popupImg.src = pictureSrc;
      popupImg.classList.remove("hidden");
      popupInitials.classList.add("hidden");
    } else {
      const initials = getInitials(activeUser.name, activeUser.email);
      profileInitials.textContent = initials;
      profileInitials.classList.remove("hidden");
      profileImg.classList.add("hidden");

      popupInitials.textContent = initials;
      popupInitials.classList.remove("hidden");
      popupImg.classList.add("hidden");
    }

    renderAuthActions();
  } else {
    signInBtn.classList.remove("hidden");
    profileBtn.classList.add("hidden");
    profilePopup.classList.add("hidden");
    if (profileName) profileName.textContent = "User";
  }

  renderSitePremiumButton();
}

// Event Listeners
signInBtn.addEventListener("click", () => requestGoogleAccessToken());
if (sitePremiumBtn) {
  sitePremiumBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startSitePremiumCheckout();
  });
}
profileBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  // Always collapse "other accounts" list when re-opening the popup
  isAccordionExpanded = false;
  profilePopup.classList.toggle("hidden");
});
profilePopup.addEventListener("click", (e) => {
  e.stopPropagation();
});
closePopupBtn.addEventListener("click", () =>
  profilePopup.classList.add("hidden"),
);
document.addEventListener("click", (e) => {
  if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
    profilePopup.classList.add("hidden");
  }
});
// =========================================
// CHANGE PROFILE PICTURE FUNCTIONALITY
// =========================================

const popupProfileContainer = document.getElementById(
  "popup-profile-container",
);
const changePicBackdrop = document.getElementById("change-pic-backdrop"); // NEW
const changePicModal = document.getElementById("change-pic-modal");
const closeChangePicBtn = document.getElementById("close-change-pic");
const largePreviewImg = document.getElementById("large-preview-img");
const largePreviewInitials = document.getElementById("large-preview-initials");

const uploadDeviceBtn = document.getElementById("upload-device-btn");
const hiddenFileInput = document.getElementById("hidden-file-input");

const takePictureBtn = document.getElementById("take-picture-btn");
const cameraUi = document.getElementById("camera-ui");
const cameraVideo = document.getElementById("camera-video");
const captureBtn = document.getElementById("capture-btn");
const cancelCameraBtn = document.getElementById("cancel-camera-btn");
const cameraCanvas = document.getElementById("camera-canvas");

let currentStream = null;

// 1. Open the Centered Panel when profile pic is clicked
popupProfileContainer.addEventListener("click", (e) => {
  e.stopPropagation(); // Stop the main popup from closing
  changePicBackdrop.classList.remove("hidden"); // Show the blurred backdrop

  // Load the current active user's picture into the large display
  const activeUser = accounts.find((a) => a.email === activeEmail);
  if (activeUser) {
    if (activeUser.picture) {
      // --- HD IMAGE TRICK ---
      // Google sends a small 96px image by default (=s96-c).
      // We replace it with =s400-c to get a crisp, high-quality 400px image.
      let highResPic = activeUser.picture;
      if (highResPic.includes("=s96-c")) {
        highResPic = highResPic.replace("=s96-c", "=s400-c");
      }

      largePreviewImg.src = highResPic;
      largePreviewImg.classList.remove("hidden");
      largePreviewInitials.classList.add("hidden");
    } else {
      largePreviewInitials.textContent = getInitials(
        activeUser.name,
        activeUser.email,
      );
      largePreviewInitials.classList.remove("hidden");
      largePreviewImg.classList.add("hidden");
    }
  }
});
// 2. Close the Panel
closeChangePicBtn.addEventListener("click", () => {
  changePicBackdrop.classList.add("hidden");
});

// Close when clicking the blurred background outside the modal
changePicBackdrop.addEventListener("click", (e) => {
  if (e.target === changePicBackdrop) {
    changePicBackdrop.classList.add("hidden");
  }
});

// Prevent clicks inside the modal from closing it
changePicModal.addEventListener("click", (e) => {
  e.stopPropagation();
});

// ... (Keep your existing code for Upload from Device and Take a Picture below this) ...

// 3. FUNCTION: Upload from Device
uploadDeviceBtn.addEventListener("click", () => {
  hiddenFileInput.click(); // Triggers the hidden file input
});

hiddenFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const newImageUrl = event.target.result;
      updateProfilePicture(newImageUrl);
    };
    reader.readAsDataURL(file); // Converts image to a usable URL
  }
});

// 4. FUNCTION: Take a Picture (Webcam)
takePictureBtn.addEventListener("click", async () => {
  try {
    cameraUi.classList.remove("hidden");
    // Request camera access
    currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraVideo.srcObject = currentStream;
  } catch (err) {
    alert("Camera access denied or not available on this device.");
    cameraUi.classList.add("hidden");
  }
});

cancelCameraBtn.addEventListener("click", () => {
  stopCamera();
});

captureBtn.addEventListener("click", () => {
  // Draw the current video frame onto a hidden canvas
  const context = cameraCanvas.getContext("2d");
  cameraCanvas.width = cameraVideo.videoWidth;
  cameraCanvas.height = cameraVideo.videoHeight;

  // Mirror the image if needed, then draw
  context.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);

  // Convert canvas to an image URL
  const newImageUrl = cameraCanvas.toDataURL("image/png");
  updateProfilePicture(newImageUrl);
  stopCamera();
});

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop()); // Turn off camera light
  }
  cameraUi.classList.add("hidden");
}

// 5. Helper function to apply the new picture everywhere
function updateProfilePicture(newImageUrl) {
  // Update the user in our local array
  const userIndex = accounts.findIndex((a) => a.email === activeEmail);
  if (userIndex !== -1) {
    accounts[userIndex].picture = newImageUrl;
    localStorage.setItem("pdf_lib_accounts", JSON.stringify(accounts));

    // Update the large preview in the side panel
    largePreviewImg.src = newImageUrl;
    largePreviewImg.classList.remove("hidden");
    largePreviewInitials.classList.add("hidden");

    // Call your existing updateUI function to update the main header and popup!
    updateUI();
  }
}

function sanitizeReadingProgressMap(rawMap) {
  if (!rawMap || typeof rawMap !== "object" || Array.isArray(rawMap)) {
    return {};
  }

  const cleaned = {};

  for (const [driveId, value] of Object.entries(rawMap)) {
    if (!value || typeof value !== "object") continue;

    const key = String(driveId || "").trim();
    if (!key) continue;

    const totalPages = Math.max(0, Math.floor(Number(value.totalPages || 0)));
    const lastPage = Math.max(1, Math.floor(Number(value.lastPage || 1)));
    const progress =
      totalPages > 0
        ? Math.round((Math.min(lastPage, totalPages) / totalPages) * 100)
        : Math.max(0, Math.min(100, Math.floor(Number(value.progress || 0))));
    const updatedAt = Number(value.updatedAt || Date.now());
    const rawFormat = String(value.format || (key.startsWith("epub:") ? "epub" : "pdf")).toLowerCase();
    const format = rawFormat === "epub" ? "epub" : "pdf";
    const documentId = String(
      value.documentId || key.replace(/^epub:/, "").replace(/^pdf:/, ""),
    ).trim();

    cleaned[key] = {
      title: String(value.title || "").trim(),
      format,
      documentId,
      lastPage,
      totalPages,
      progress,
      locationLabel: String(value.locationLabel || "").trim(),
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    };
  }

  return cleaned;
}

function loadReadingProgressMap() {
  return sanitizeReadingProgressMap(readScopedJSON(READING_PROGRESS_KEY_PREFIX, {}, activeEmail));
}

function saveReadingProgressMap(progressMap) {
  const cleaned = sanitizeReadingProgressMap(progressMap);
  writeScopedJSON(READING_PROGRESS_KEY_PREFIX, cleaned, activeEmail);
}

function removeFromContinueReading(driveId) {
  const normalized = String(driveId || "").trim();
  if (!normalized) return;

  const progressMap = loadReadingProgressMap();
  if (!progressMap[normalized]) return;
  delete progressMap[normalized];
  saveReadingProgressMap(progressMap);

  const books = getContinueReadingBooks();
  if (books.length) {
    renderContinueReadingSection(books);
  }
}

function getResumePageForBook(book) {
  const progressMap = loadReadingProgressMap();
  const readerDocumentId = buildReaderDocumentId(book, "pdf", book?.pdf_drive_id);
  const rawDriveId = normalizeDriveAssetId(book?.pdf_drive_id);
  const entry =
    progressMap[readerDocumentId] ||
    (rawDriveId ? progressMap[rawDriveId] : null);
  if (!entry) return null;

  const page = Math.floor(Number(entry.lastPage || 0));
  return Number.isFinite(page) && page > 1 ? page : null;
}

function formatRelativeTime(timestamp) {
  const value = Number(timestamp || 0);
  if (!Number.isFinite(value) || value <= 0) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  if (seconds < 172800) return "Yesterday";
  return `${Math.floor(seconds / 86400)} days ago`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeImageSrc(value) {
  const src = String(value || "").trim();
  if (!src) return "";

  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(src)) {
    return src;
  }

  try {
    const url = new URL(src, window.location.href);
    return ["https:", "http:"].includes(url.protocol) ? src : "";
  } catch {
    return "";
  }
}

function getProgressFormat(progressKey, state) {
  const rawFormat = String(state?.format || "").toLowerCase();
  if (rawFormat === "epub") return "epub";
  if (String(progressKey || "").startsWith("epub:")) return "epub";
  return "pdf";
}

function getProgressDocumentId(progressKey, state) {
  return String(
    state?.documentId || String(progressKey || "").replace(/^epub:/, "").replace(/^pdf:/, ""),
  ).trim();
}

function getProgressLookupKey(format, documentId) {
  return format === "epub" ? `epub:${documentId}` : documentId;
}

function getContinueReadingBooks() {
  return Array.isArray(allLibraryBooks) && allLibraryBooks.length
    ? allLibraryBooks
    : Array.isArray(searchableBooks)
      ? searchableBooks
      : [];
}

function openContinueReadingEntry(entry) {
  const book = entry?.book || {};
  const state = entry?.state || {};
  const page = Math.max(1, Math.floor(Number(state.lastPage || 1)));
  const title = normalizeText(book.title) || normalizeText(state.title) || "Untitled Book";

  if (entry.format === "epub") {
    const readerDocumentId = buildReaderDocumentId(
      book,
      "epub",
      entry.documentId || book.epub_drive_id,
    );
    closeSidebar();
    closeSearch();
    if (window.saveToRecentHistory) {
      window.saveToRecentHistory({
        id: book.id,
        title,
        pdf_drive_id: normalizeDriveAssetId(book.pdf_drive_id) || null,
        epub_drive_id: readerDocumentId || null,
      });
    }
    const pageQuery = page > 1 ? `&page=${encodeURIComponent(page)}` : "";
    window.location.href = `view-epub.html?id=${encodeURIComponent(readerDocumentId)}&title=${encodeURIComponent(title)}${pageQuery}`;
    return;
  }

  window.openBook(book.id, title, entry.documentId || book.pdf_drive_id, page);
}

function renderContinueReadingSection(books) {
  const section = document.getElementById("continue-reading-section");
  if (!section) return;

  const validBooks = Array.isArray(books) ? books : [];
  const byProgressKey = new Map();
  for (const book of validBooks) {
    const pdfDriveId = normalizeDriveAssetId(book?.pdf_drive_id);
    const epubDriveId = normalizeDriveAssetId(book?.epub_drive_id);
    const premiumPdfId = buildReaderDocumentId(book, "pdf", pdfDriveId);
    const premiumEpubId = buildReaderDocumentId(book, "epub", epubDriveId);
    if (pdfDriveId) {
      byProgressKey.set(pdfDriveId, book);
      byProgressKey.set(`pdf:${pdfDriveId}`, book);
    }
    if (premiumPdfId) {
      byProgressKey.set(premiumPdfId, book);
      byProgressKey.set(`pdf:${premiumPdfId}`, book);
    }
    if (epubDriveId) {
      byProgressKey.set(`epub:${epubDriveId}`, book);
    }
    if (premiumEpubId) {
      byProgressKey.set(`epub:${premiumEpubId}`, book);
    }
  }

  const progressMap = loadReadingProgressMap();
  const entries = Object.entries(progressMap)
    .map(([progressKey, state]) => {
      const format = getProgressFormat(progressKey, state);
      const documentId = getProgressDocumentId(progressKey, state);
      const lookupKey = getProgressLookupKey(format, documentId);
      return {
        progressKey,
        format,
        documentId,
        state,
        book: byProgressKey.get(lookupKey),
      };
    })
    .filter((entry) => {
      if (!entry.book) return false;
      if (entry.state.progress >= 100) return false;
      if (!entry.documentId) return false;
      return Number(entry.state.lastPage || 0) > 0;
    })
    .sort((a, b) => Number(b.state.updatedAt || 0) - Number(a.state.updatedAt || 0))
    .slice(0, 8);

  if (!entries.length) {
    section.classList.add("hidden");
    section.innerHTML = "";
    return;
  }

  section.classList.remove("hidden");
  section.innerHTML = `
    <div class="continue-reading-head">
      <h2 class="row-title">Continue Reading</h2>
      <p>Jump back to where you stopped.</p>
    </div>
    <div class="continue-reading-list"></div>
  `;

  const list = section.querySelector(".continue-reading-list");
  if (!list) return;

  for (const entry of entries) {
    const book = entry.book;
    const state = entry.state;
    const safeProgress = Math.max(0, Math.min(100, Number(state.progress || 0)));
    const page = Math.max(1, Math.floor(Number(state.lastPage || 1)));
    const total = Math.max(0, Math.floor(Number(state.totalPages || 0)));
    const displayTotal = total > 0 ? total : "--";
    const formatLabel = entry.format === "epub" ? "EPUB" : "PDF";
    const locationLabel =
      entry.format === "epub"
        ? `Section ${page} / ${displayTotal}`
        : `Page ${page} / ${displayTotal}`;
    const card = document.createElement("article");
    card.className = "continue-reading-card";
    card.dataset.driveId = entry.documentId;
    card.dataset.progressKey = entry.progressKey;
    card.dataset.format = entry.format;
    card.dataset.resumePage = String(page);
    card.innerHTML = `
      <button type="button" class="continue-remove-btn" aria-label="Remove ${escapeHtml(book.title)} from Continue Reading">
        <span class="material-symbols-outlined">close</span>
      </button>
      <div class="continue-cover-slot"></div>
      <div class="continue-meta">
        <h3>${escapeHtml(book.title)}</h3>
        <p>${escapeHtml(book.author || "Unknown Author")}</p>
        <div class="continue-progress-track">
          <span style="width:${safeProgress}%"></span>
        </div>
        <div class="continue-foot">
          <span>${escapeHtml(locationLabel)}</span>
          <span>${escapeHtml(formatLabel)} - ${safeProgress}%</span>
        </div>
      </div>
      <div class="continue-time-wrap">
        <small class="continue-time">${formatRelativeTime(state.updatedAt)}</small>
      </div>
    `;

    const coverSlot = card.querySelector(".continue-cover-slot");
    if (coverSlot) {
      const coverNode = createBookCoverNode(book, {
        className: "continue-cover",
        fallbackClassName: "continue-cover-fallback",
        size: "w520",
        altText: normalizeText(book.title) || "Book cover",
        fallbackBehavior: "show",
      });
      if (!coverNode) {
        card.remove();
        continue;
      }
      coverSlot.replaceWith(coverNode);
    }

    card.addEventListener("click", () => {
      openContinueReadingEntry(entry);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openContinueReadingEntry(entry);
      }
    });
    card.tabIndex = 0;
    card.setAttribute("role", "button");

    const removeBtn = card.querySelector(".continue-remove-btn");
    if (removeBtn) {
      removeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        removeFromContinueReading(entry.progressKey);
      });
      removeBtn.addEventListener("keydown", (event) => {
        event.stopPropagation();
      });
    }

    list.appendChild(card);
  }
}

window.addEventListener("focus", () => {
  const books = getContinueReadingBooks();
  if (books.length) {
    renderContinueReadingSection(books);
  }
});

document.addEventListener("visibilitychange", () => {
  const books = getContinueReadingBooks();
  if (!document.hidden && books.length) {
    renderContinueReadingSection(books);
  }
});
// =========================================
// SIDEBAR & HISTORY FUNCTIONALITY
// =========================================

const openSidebarBtn = document.getElementById("open-sidebar-btn");
const closeSidebarBtn = document.getElementById("close-sidebar-btn");
const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const historyList = document.getElementById("history-list");

function historyKey(item) {
  const driveId = String(item?.pdf_drive_id || "").trim();
  if (driveId) return `drive:${driveId}`;

  const epubDriveId = String(item?.epub_drive_id || "").trim();
  if (epubDriveId) return `epub:${epubDriveId}`;

  const id = String(item?.id ?? "").trim();
  if (id) return `id:${id}`;

  return `title:${String(item?.title || "").trim().toLowerCase()}`;
}

function sanitizeHistory(list) {
  if (!Array.isArray(list)) return [];

  const seen = new Set();
  const sanitized = [];

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;

    const title = String(raw.title || "").trim();
    if (!title) continue;

    const item = {
      id: raw.id ?? Date.now(),
      title,
      pdf_drive_id: raw.pdf_drive_id ? String(raw.pdf_drive_id).trim() : null,
      epub_drive_id: raw.epub_drive_id ? String(raw.epub_drive_id).trim() : null,
    };

    const key = historyKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    sanitized.push(item);
  }

  return sanitized.slice(0, 200);
}

function persistHistory(nextHistory) {
  userHistory = sanitizeHistory(nextHistory);
  writeScopedJSON(RECENT_HISTORY_KEY_PREFIX, userHistory, activeEmail);
}

function buildHistoryEntry(book, fallbackId) {
  return {
    id: book?.id ?? fallbackId ?? Date.now(),
    title: String(book?.title || "").trim() || "Untitled",
    pdf_drive_id: buildReaderDocumentId(book, "pdf", book?.pdf_drive_id) || null,
    epub_drive_id: buildReaderDocumentId(book, "epub", book?.epub_drive_id) || null,
  };
}

function escapeJsString(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function deleteMenuId(rawId) {
  const safe = String(rawId ?? "").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `delete-menu-${safe}`;
}

function loadHistoryForActiveUser() {
  return sanitizeHistory(readScopedJSON(RECENT_HISTORY_KEY_PREFIX, [], activeEmail));
}

// Retrieve Recent History from the active account's storage or start empty
let userHistory = loadHistoryForActiveUser();
persistHistory(userHistory);

function getLibraryStorageOwner() {
  return normalizeEmailKey(activeEmail) || "guest";
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

    const title = normalizeText(raw.title);
    if (!title) continue;

    const item = {
      id: raw.id ?? "",
      title,
      author: normalizeText(raw.author) || "Unknown Author",
      category: normalizeText(raw.category) || "Book",
      pdf_drive_id: normalizeDriveAssetId(raw.pdf_drive_id) || null,
      epub_drive_id: normalizeDriveAssetId(raw.epub_drive_id) || null,
      poster_url: normalizeText(raw.poster_url) || null,
      cover_url: normalizeText(raw.cover_url) || null,
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
  return sanitizeMyList(
    readScopedJSON(MY_LIST_KEY_PREFIX, [], getLibraryStorageOwner()),
  );
}

function saveMyList(nextList) {
  writeScopedJSON(
    MY_LIST_KEY_PREFIX,
    sanitizeMyList(nextList),
    getLibraryStorageOwner(),
  );
  updateMyListCount();
}

function buildMyListEntry(book) {
  return {
    id: book?.id ?? "",
    title: normalizeText(book?.title) || "Untitled",
    author: normalizeText(book?.author) || "Unknown Author",
    category: normalizeText(book?.category) || "Book",
    pdf_drive_id: normalizeDriveAssetId(book?.pdf_drive_id) || null,
    epub_drive_id: normalizeDriveAssetId(book?.epub_drive_id) || null,
    poster_url: normalizeText(book?.poster_url) || null,
    cover_url: normalizeText(book?.cover_url) || null,
    poster_drive_id: normalizeDriveAssetId(book?.poster_drive_id) || null,
    cover_drive_id: normalizeDriveAssetId(book?.cover_drive_id) || null,
    addedAt: Date.now(),
  };
}

function findLibraryBookForMyListItem(item) {
  const source = Array.isArray(allLibraryBooks) ? allLibraryBooks : [];
  const itemId = String(item?.id ?? "").trim();
  const itemPdfId = normalizeDriveAssetId(item?.pdf_drive_id);
  const itemEpubId = normalizeDriveAssetId(item?.epub_drive_id);
  const itemTitle = normalizeText(item?.title).toLowerCase();

  return (
    source.find((book) => itemId && String(book?.id ?? "").trim() === itemId) ||
    source.find((book) => itemPdfId && normalizeDriveAssetId(book?.pdf_drive_id) === itemPdfId) ||
    source.find((book) => itemEpubId && normalizeDriveAssetId(book?.epub_drive_id) === itemEpubId) ||
    source.find((book) => itemTitle && normalizeText(book?.title).toLowerCase() === itemTitle) ||
    null
  );
}

function hydrateMyListItem(item) {
  const match = findLibraryBookForMyListItem(item);
  if (!match) return item;

  const hydrated = { ...item };
  [
    "id",
    "title",
    "author",
    "category",
    "pdf_drive_id",
    "epub_drive_id",
    "poster_url",
    "cover_url",
    "poster_drive_id",
    "cover_drive_id",
  ].forEach((field) => {
    if (!normalizeText(hydrated[field]) && normalizeText(match[field])) {
      hydrated[field] = match[field];
    }
  });
  return hydrated;
}

function addBookToMyList(book) {
  const entry = buildMyListEntry(book);
  if (!entry.title) return false;

  const entryKey = myListKey(entry);
  const nextList = loadMyList().filter((item) => myListKey(item) !== entryKey);
  nextList.unshift(entry);
  saveMyList(nextList);

  if (settingsPanel && !settingsPanel.classList.contains("hidden")) {
    renderSettingsSection(currentSettingsSection);
  }

  return true;
}

function removeBookFromMyList(key) {
  const normalizedKey = String(key || "");
  if (!normalizedKey) return;

  const nextList = loadMyList().filter((item) => myListKey(item) !== normalizedKey);
  saveMyList(nextList);

  if (settingsPanel && !settingsPanel.classList.contains("hidden")) {
    renderSettingsSection(currentSettingsSection);
  }
}

function isBookInMyList(book) {
  const key = myListKey(buildMyListEntry(book));
  return loadMyList().some((item) => myListKey(item) === key);
}

function updateMyListCount() {
  if (!settingsMyListCount) return;
  settingsMyListCount.textContent = String(loadMyList().length);
}

function extractDriveIdFromUrl(value) {
  const raw = normalizeDriveAssetId(value);
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) return raw.startsWith("/api/") ? "" : raw;

  try {
    const url = new URL(raw);
    const byQuery = url.searchParams.get("id");
    if (byQuery) return normalizeDriveAssetId(byQuery);

    const match = url.pathname.match(/\/d\/([^/]+)/);
    return match ? normalizeDriveAssetId(match[1]) : "";
  } catch {
    return "";
  }
}

function resolveCoverCandidate(value, size = "w240") {
  const raw = normalizeDriveAssetId(value);
  if (!raw) return "";

  if (raw.startsWith("/api/")) return buildApiUrl(raw);

  const driveId = extractDriveIdFromUrl(raw);
  if (driveId) return buildDriveThumbnailUrl(driveId, size);

  if (/^data:image\//i.test(raw)) return safeImageSrc(raw);
  if (/^https?:\/\//i.test(raw) && /\.(png|jpe?g|gif|webp|avif)(?:[?#].*)?$/i.test(raw)) {
    return safeImageSrc(raw);
  }

  return "";
}

function getMyListCoverSource(item) {
  const hydrated = hydrateMyListItem(item);
  const candidates = [
    hydrated?.poster_drive_id,
    hydrated?.cover_drive_id,
    hydrated?.poster_url,
    hydrated?.cover_url,
  ];

  for (const candidate of candidates) {
    const resolved = resolveCoverCandidate(candidate);
    if (resolved) return resolved;
  }

  const coverId = getBookCoverDriveId(hydrated);
  return coverId ? safeImageSrc(buildDriveThumbnailUrl(coverId, "w240")) : "";
}

function renderMyListCover(item) {
  const hydrated = hydrateMyListItem(item);
  const coverSource = getMyListCoverSource(item);
  const fallback = getBookInitials(hydrated.title);
  if (coverSource) {
    return `<img class="my-list-cover" src="${escapeHtml(coverSource)}" alt="${escapeHtml(hydrated.title)} cover" loading="lazy" data-fallback="${escapeHtml(fallback)}">`;
  }

  return `<div class="my-list-cover-fallback">${escapeHtml(fallback)}</div>`;
}

function sanitizeLibrarySettings(settings) {
  const source = settings && typeof settings === "object" ? settings : {};
  return {
    saveActivity:
      typeof source.saveActivity === "boolean" ? source.saveActivity : true,
    showContinueReading:
      typeof source.showContinueReading === "boolean"
        ? source.showContinueReading
        : true,
    reduceMotion: Boolean(source.reduceMotion),
  };
}

function loadLibrarySettings() {
  return sanitizeLibrarySettings(
    readScopedJSON(
      LIBRARY_SETTINGS_KEY_PREFIX,
      sanitizeLibrarySettings({}),
      getLibraryStorageOwner(),
    ),
  );
}

function saveLibrarySettings(nextSettings) {
  const cleaned = sanitizeLibrarySettings(nextSettings);
  writeScopedJSON(LIBRARY_SETTINGS_KEY_PREFIX, cleaned, getLibraryStorageOwner());
  applyLibrarySettings();
}

function applyLibrarySettings() {
  const settings = loadLibrarySettings();
  document.body.classList.toggle(
    "hide-continue-reading",
    !settings.showContinueReading || !settings.saveActivity,
  );
  document.body.classList.remove("library-compact-mode");
  document.body.classList.toggle("library-reduce-motion", settings.reduceMotion);
}

function renderSettingsToggle(key, title, description, checked) {
  return `
    <div class="settings-row">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(description)}</span>
      </div>
      <label class="settings-toggle" aria-label="${escapeHtml(title)}">
        <input type="checkbox" data-setting-key="${escapeHtml(key)}" ${checked ? "checked" : ""}>
        <span></span>
      </label>
    </div>
  `;
}

function renderMyListSettings() {
  const items = loadMyList();

  if (items.length === 0) {
    return `
      <h3 class="settings-section-title">My List</h3>
      <p class="settings-section-copy">Books you save will appear here.</p>
      <div class="settings-empty">No saved books yet.</div>
    `;
  }

  const itemMarkup = items
    .map((item) => {
      const displayItem = hydrateMyListItem(item);
      const key = myListKey(item);
      return `
        <article class="my-list-item">
          ${renderMyListCover(displayItem)}
          <div>
            <h4 class="my-list-title">${escapeHtml(displayItem.title)}</h4>
            <p class="my-list-meta">${escapeHtml(displayItem.author)} - ${escapeHtml(displayItem.category)}</p>
          </div>
          <div class="my-list-actions">
            <button class="settings-action-btn" type="button" data-settings-action="open-my-list-book" data-my-list-key="${escapeHtml(key)}">
              <span class="material-symbols-outlined">menu_book</span>
              Open
            </button>
            <button class="settings-action-btn danger" type="button" data-settings-action="remove-my-list-book" data-my-list-key="${escapeHtml(key)}">
              <span class="material-symbols-outlined">delete</span>
              Remove
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  return `
    <h3 class="settings-section-title">My List</h3>
    <p class="settings-section-copy">Saved books are private to this signed-in profile on this browser.</p>
    <div class="my-list-items">${itemMarkup}</div>
  `;
}

function getActiveAccount() {
  return activeEmail
    ? accounts.find((account) => normalizeEmailKey(account.email) === activeEmail) || null
    : null;
}

function renderAccountAvatar(account) {
  const picture = safeImageSrc(account?.picture || "");
  const name = account?.name || account?.email || "Guest";
  if (picture) {
    return `<img src="${escapeHtml(picture)}" alt="${escapeHtml(name)}" referrerpolicy="no-referrer">`;
  }

  return `<span>${escapeHtml(getInitials(account?.name, account?.email))}</span>`;
}

function getDeviceSummary() {
  const ua = navigator.userAgent || "";
  const browser = ua.includes("Edg/")
    ? "Microsoft Edge"
    : ua.includes("Chrome/")
      ? "Google Chrome"
      : ua.includes("Firefox/")
        ? "Firefox"
        : ua.includes("Safari/")
          ? "Safari"
          : "Current browser";
  const system = ua.includes("Windows")
    ? "Windows"
    : ua.includes("Mac OS")
      ? "macOS"
      : ua.includes("Android")
        ? "Android"
        : ua.includes("iPhone") || ua.includes("iPad")
          ? "iOS"
          : "This device";
  return `${browser} on ${system}`;
}

function renderSettingsSection(section = "my-list") {
  if (!settingsDetail) return;

  currentSettingsSection = section;
  document.querySelectorAll("[data-settings-section]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.getAttribute("data-settings-section") === section,
    );
  });

  const settings = loadLibrarySettings();
  const progressCount = Object.keys(loadReadingProgressMap()).length;
  const recentCount = userHistory.length;
  const myListCount = loadMyList().length;

  if (section === "my-list") {
    settingsDetail.innerHTML = renderMyListSettings();
  } else if (section === "reading") {
    settingsDetail.innerHTML = `
      <h3 class="settings-section-title">Reading</h3>
      <p class="settings-section-copy">Keep only the reading controls that matter.</p>
      <div class="settings-card">
        ${renderSettingsToggle("showContinueReading", "Continue Reading", "Show saved reading progress on the home page.", settings.showContinueReading && settings.saveActivity)}
        ${renderSettingsToggle("reduceMotion", "Reduce motion", "Use calmer motion while browsing and reading.", settings.reduceMotion)}
      </div>
    `;
  } else if (section === "privacy") {
    settingsDetail.innerHTML = `
      <h3 class="settings-section-title">Privacy & security</h3>
      <p class="settings-section-copy">Your reading activity stays in this browser unless you choose to clear it.</p>
      <div class="settings-card">
        ${renderSettingsToggle("saveActivity", "Save reading activity", "Allow Recent and Continue Reading to save on this browser.", settings.saveActivity)}
      </div>
      <div class="settings-card">
        <div class="settings-row">
          <div><strong>Recent books</strong><span>${recentCount} saved item${recentCount === 1 ? "" : "s"}</span></div>
          <button class="settings-action-btn danger" type="button" data-settings-action="clear-recent">Clear</button>
        </div>
        <div class="settings-row">
          <div><strong>Continue Reading</strong><span>${progressCount} saved item${progressCount === 1 ? "" : "s"}</span></div>
          <button class="settings-action-btn danger" type="button" data-settings-action="clear-progress">Clear</button>
        </div>
        <div class="settings-row">
          <div><strong>My List</strong><span>${myListCount} saved item${myListCount === 1 ? "" : "s"}</span></div>
          <button class="settings-action-btn danger" type="button" data-settings-action="clear-my-list">Clear</button>
        </div>
        <div class="settings-row">
          <div><strong>Library settings</strong><span>Reset display preferences to default.</span></div>
          <button class="settings-action-btn" type="button" data-settings-action="reset-settings">Reset</button>
        </div>
        <div class="settings-row">
          <div><strong>All local library data</strong><span>Clear Recent, Continue Reading, My List, and settings from this browser.</span></div>
          <button class="settings-action-btn danger" type="button" data-settings-action="clear-all-local-data">Clear all</button>
        </div>
      </div>
    `;
  } else if (section === "account") {
    const account = getActiveAccount();
    const displayName = account?.name || (activeEmail ? activeEmail.split("@")[0] : "Guest profile");
    const connectedLabel = activeEmail ? `Google - ${activeEmail}` : "No account connected";
    settingsDetail.innerHTML = `
      <h3 class="settings-section-title">Account</h3>
      <p class="settings-section-copy">Profile, connected account, and active device details.</p>
      <div class="settings-profile-card">
        <div class="settings-avatar">${renderAccountAvatar(account)}</div>
        <div>
          <h4>${escapeHtml(displayName)}</h4>
          <p>${escapeHtml(activeEmail || "Not signed in")}</p>
        </div>
        <span class="settings-pill">${activeEmail ? "Signed in" : "Guest"}</span>
      </div>
      <div class="settings-card">
        <div class="settings-row">
          <div><strong>Email address</strong><span>${escapeHtml(activeEmail || "Sign in to keep your library profile separate.")}</span></div>
          ${
            activeEmail
              ? ""
              : '<button class="settings-action-btn" type="button" data-settings-action="sign-in">Sign in</button>'
          }
        </div>
        <div class="settings-row">
          <div><strong>Connected account</strong><span>${escapeHtml(connectedLabel)}</span></div>
          ${activeEmail ? '<button class="settings-action-btn danger" type="button" data-settings-action="sign-out">Sign out</button>' : ""}
        </div>
      </div>
      <div class="settings-card">
        <div class="settings-row">
          <div><strong>Active device</strong><span>${escapeHtml(getDeviceSummary())} - this device</span></div>
          <span class="settings-pill">Active</span>
        </div>
        <div class="settings-row">
          <div><strong>Saved library data</strong><span>${recentCount} recent, ${progressCount} progress, ${myListCount} My List</span></div>
          <button class="settings-action-btn" type="button" data-settings-action="refresh-library">Refresh</button>
        </div>
      </div>
    `;
  } else {
    settingsDetail.innerHTML = `
      <h3 class="settings-section-title">Help</h3>
      <p class="settings-section-copy">Quick actions for common library work.</p>
      <div class="settings-card">
        <div class="settings-row">
          <div><strong>Find a book</strong><span>Open the search box.</span></div>
          <button class="settings-action-btn" type="button" data-settings-action="open-search">Search</button>
        </div>
        <div class="settings-row">
          <div><strong>Return to top</strong><span>Go back to the top of the library.</span></div>
          <button class="settings-action-btn" type="button" data-settings-action="back-to-top">Top</button>
        </div>
        <div class="settings-row">
          <div><strong>Reload library data</strong><span>Fetch the latest books from the backend.</span></div>
          <button class="settings-action-btn" type="button" data-settings-action="refresh-library">Refresh</button>
        </div>
      </div>
    `;
  }

  attachSettingsDetailEvents();
  updateMyListCount();
}

function closeSettings() {
  if (!settingsPanel || !settingsBackdrop) return;
  settingsPanel.classList.add("hidden");
  settingsPanel.setAttribute("aria-hidden", "true");
  settingsBackdrop.classList.add("hidden");
}

function openSettings(section = "my-list") {
  if (!settingsPanel || !settingsBackdrop) return;
  closeSidebar();
  applyLibrarySettings();
  renderSettingsSection(section);
  settingsPanel.classList.remove("hidden");
  settingsPanel.setAttribute("aria-hidden", "false");
  settingsBackdrop.classList.remove("hidden");
}

function findMyListItemByKey(key) {
  return loadMyList().find((item) => myListKey(item) === String(key || ""));
}

function handleSettingsAction(action, target) {
  if (action === "open-my-list-book") {
    const savedItem = findMyListItemByKey(target.getAttribute("data-my-list-key"));
    const item = savedItem ? hydrateMyListItem(savedItem) : null;
    if (!item) return;
    closeSettings();
    window.openSavedBook(item.id, item.title, item.pdf_drive_id, item.epub_drive_id);
    return;
  }

  if (action === "remove-my-list-book") {
    removeBookFromMyList(target.getAttribute("data-my-list-key"));
    return;
  }

  if (action === "clear-recent") {
    persistHistory([]);
    renderHistory();
    renderSettingsSection(currentSettingsSection);
    return;
  }

  if (action === "clear-progress") {
    saveReadingProgressMap({});
    renderContinueReadingSection(getContinueReadingBooks());
    renderSettingsSection(currentSettingsSection);
    return;
  }

  if (action === "clear-my-list") {
    saveMyList([]);
    renderSettingsSection(currentSettingsSection);
    return;
  }

  if (action === "clear-all-local-data") {
    persistHistory([]);
    saveReadingProgressMap({});
    saveMyList([]);
    removeScopedValue(LIBRARY_SETTINGS_KEY_PREFIX, getLibraryStorageOwner());
    applyLibrarySettings();
    renderHistory();
    renderContinueReadingSection(getContinueReadingBooks());
    renderSettingsSection("privacy");
    return;
  }

  if (action === "reset-settings") {
    removeScopedValue(LIBRARY_SETTINGS_KEY_PREFIX, getLibraryStorageOwner());
    applyLibrarySettings();
    renderSettingsSection(currentSettingsSection);
    return;
  }

  if (action === "open-search") {
    closeSettings();
    openSearch("");
    return;
  }

  if (action === "back-to-top") {
    closeSettings();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (action === "refresh-library") {
    fetchPDFs();
    renderSettingsSection(currentSettingsSection);
    return;
  }

  if (action === "sign-in") {
    closeSettings();
    requestGoogleAccessToken();
    return;
  }

  if (action === "sign-out") {
    closeSettings();
    if (typeof window.handleLogout === "function") {
      window.handleLogout();
    }
  }
}

function attachSettingsDetailEvents() {
  if (!settingsDetail) return;

  settingsDetail.querySelectorAll(".my-list-cover").forEach((image) => {
    image.addEventListener("error", () => {
      const fallback = document.createElement("div");
      fallback.className = "my-list-cover-fallback";
      fallback.textContent = image.getAttribute("data-fallback") || "BK";
      image.replaceWith(fallback);
    });
  });

  settingsDetail.querySelectorAll("[data-setting-key]").forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.getAttribute("data-setting-key");
      const settings = loadLibrarySettings();
      settings[key] = Boolean(input.checked);
      saveLibrarySettings(settings);
      if (key === "saveActivity" && !settings.saveActivity) {
        persistHistory([]);
        saveReadingProgressMap({});
        renderHistory();
        renderContinueReadingSection(getContinueReadingBooks());
      }
      renderSettingsSection(currentSettingsSection);
    });
  });

  settingsDetail.querySelectorAll("[data-settings-action]").forEach((button) => {
    button.addEventListener("click", () => {
      handleSettingsAction(button.getAttribute("data-settings-action"), button);
    });
  });
}

if (openSettingsBtn) {
  openSettingsBtn.addEventListener("click", () => openSettings("my-list"));
}

if (closeSettingsBtn) {
  closeSettingsBtn.addEventListener("click", closeSettings);
}

if (settingsBackdrop) {
  settingsBackdrop.addEventListener("click", closeSettings);
}

document.querySelectorAll("[data-settings-section]").forEach((button) => {
  button.addEventListener("click", () => {
    renderSettingsSection(button.getAttribute("data-settings-section") || "my-list");
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && settingsPanel && !settingsPanel.classList.contains("hidden")) {
    closeSettings();
  }
});

window.addBookToMyList = addBookToMyList;
window.removeBookFromMyList = removeBookFromMyList;
window.isBookInMyList = isBookInMyList;

window.syncScopedLibraryState = function () {
  userHistory = loadHistoryForActiveUser();
  renderHistory();
  applyLibrarySettings();
  updateMyListCount();
  const books = getContinueReadingBooks();
  if (books.length) {
    renderContinueReadingSection(books);
  }
  rerenderLibraryRowsForFreshLayout();
  if (searchModal && !searchModal.classList.contains("hidden")) {
    runSearch(searchInput.value);
  }
  if (settingsPanel && !settingsPanel.classList.contains("hidden")) {
    renderSettingsSection(currentSettingsSection);
  }
  emitActiveUserChanged();
};

// Global Save Function
window.saveToRecentHistory = function(book) {
  if (!loadLibrarySettings().saveActivity) return;
  const baseHistory = sanitizeHistory(userHistory);
  const entry = buildHistoryEntry(book, Date.now());
  const entryKey = historyKey(entry);
  const existing = baseHistory.find((item) => historyKey(item) === entryKey);

  if (existing && (entry.id === undefined || entry.id === null || entry.id === "")) {
    entry.id = existing.id;
  }

  const nextHistory = baseHistory.filter((item) => historyKey(item) !== entryKey);
  nextHistory.unshift(entry);
  persistHistory(nextHistory);

  if (typeof renderHistory === "function") {
    renderHistory();
  }
};

  // 1. Open Sidebar
openSidebarBtn.addEventListener("click", () => {
  if (typeof window.closeAiSidebarForBookPanel === "function") {
    window.closeAiSidebarForBookPanel();
  }
  document.body.classList.add("book-sidebar-open");
  sidebar.classList.add("active");
  sidebarOverlay.classList.add("active");
  renderHistory(); // Refresh list when opened
});

// 2. Close Sidebar (Clicking Back Arrow or Overlay)
function closeSidebar() {
  sidebar.classList.remove("active");
  sidebarOverlay.classList.remove("active");
  document.body.classList.remove("book-sidebar-open");
  // Close any open delete menus
  document
    .querySelectorAll(".delete-dropdown")
    .forEach((menu) => menu.classList.add("hidden"));
}

closeSidebarBtn.addEventListener("click", closeSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);

window.openSavedBook = function (id, title, pdfDriveId, epubDriveId) {
  const pdfId = buildReaderDocumentId(id, "pdf", pdfDriveId);
  if (pdfId) {
    window.openBook(id, title, pdfId);
    return;
  }

  const epubId = buildReaderDocumentId(id, "epub", epubDriveId);
  if (epubId) {
    closeSidebar();
    closeSearch();
    window.location.href = `view-epub.html?id=${encodeURIComponent(epubId)}&title=${encodeURIComponent(title)}`;
    return;
  }

  window.location.href = buildPublicBookUrl({ id, title });
};

// 3. Render History Items (With Tooltips)
function renderHistory() {
  historyList.innerHTML = ""; // Clear current list

  userHistory.forEach((item) => {
    const safeId = escapeJsString(item.id);
    const safeTitle = escapeJsString(item.title || "");
    const safeDriveId = escapeJsString(item.pdf_drive_id || "");
    const safeEpubDriveId = escapeJsString(item.epub_drive_id || "");
    const menuId = deleteMenuId(item.id);

    const wrapper = document.createElement("div");
    wrapper.className = "history-item-wrapper";
    wrapper.setAttribute("data-tooltip", item.title || ""); // Adds the sophisticated hover tooltip

    // Note: Clicking the left side opens the book. Clicking the 3 dots opens the delete menu.
        wrapper.innerHTML = `
            <div class="history-item">
                <div class="history-item-left" onclick="openSavedBook('${safeId}', '${safeTitle}', '${safeDriveId}', '${safeEpubDriveId}')">
                    <span class="material-symbols-outlined">menu_book</span>
                    <span class="history-text">${escapeHtml(item.title || "")}</span>
                </div>
                <button class="icon-btn history-more-btn" onclick="toggleDeleteMenu(event, '${safeId}')">
                    <span class="material-symbols-outlined">more_vert</span>
                </button>
            </div>
            <div id="${menuId}" class="delete-dropdown hidden">
                <button class="delete-btn" onclick="deleteHistoryItem('${safeId}', event)">
                    <span class="material-symbols-outlined">delete</span>
                    Delete
                </button>
            </div>
        `;
    historyList.appendChild(wrapper);
  });
}

// 4. Open Book (Closes sidebar/search and navigates to reader)
window.openBook = function (id, title, pdfDriveId, resumePage = null) {
  closeSidebar(); // Automatically close the sidebar
  closeSearch(); // Automatically close search if it's open
  const readerDocumentId = buildReaderDocumentId(id, "pdf", pdfDriveId);

  if (window.saveToRecentHistory) {
    window.saveToRecentHistory({
      id,
      title,
      pdf_drive_id: readerDocumentId || null,
    });
  }

  if (readerDocumentId && readerDocumentId !== 'null' && readerDocumentId !== 'undefined' && readerDocumentId.trim() !== '') {
    const resume = Math.floor(Number(resumePage || 0));
    const pageQuery =
      Number.isFinite(resume) && resume > 1
        ? `&page=${encodeURIComponent(resume)}`
        : "";
    window.location.href = `view-pdf.html?id=${encodeURIComponent(readerDocumentId)}&title=${encodeURIComponent(title)}${pageQuery}`;
  } else {
    // Fallback if no PDF ID saved
    window.location.href = buildPublicBookUrl({ id, title });
  }
};

// 5. Toggle Delete Menu
window.toggleDeleteMenu = function (event, id) {
  event.stopPropagation(); // Prevent opening the book accidentally
  const currentMenuId = deleteMenuId(id);

  // Close all other open menus first
  document.querySelectorAll(".delete-dropdown").forEach((menu) => {
    if (menu.id !== currentMenuId) {
      menu.classList.add("hidden");
    }
  });

  const menu = document.getElementById(currentMenuId);
  if (!menu) return;
  menu.classList.toggle("hidden");
};

// 6. Delete History Item (Permanently removes from list)
window.deleteHistoryItem = function (id, event) {
  if (event) event.stopPropagation(); // Prevent opening the book
  const normalizedId = String(id);

  // Filter out the deleted item from the array
  userHistory = userHistory.filter((item) => String(item.id) !== normalizedId);
  persistHistory(userHistory);

  renderHistory(); // Re-render the UI immediately

  // Re-render search if open
  if (searchModal && !searchModal.classList.contains("hidden")) {
      runSearch(searchInput.value);
  }
};

// Close delete menus if clicking anywhere else inside the sidebar
sidebar.addEventListener("click", (e) => {
  if (
    !e.target.closest(".history-more-btn") &&
    !e.target.closest(".delete-dropdown")
  ) {
    document
      .querySelectorAll(".delete-dropdown")
      .forEach((menu) => menu.classList.add("hidden"));
  }
});

// =========================================
// SEARCH FUNCTIONALITY
// =========================================
const sidebarSearchBtn = document.getElementById("sidebar-search-btn");
const searchBackdrop = document.getElementById("search-backdrop");
const searchModal = document.getElementById("search-modal");
const closeSearchBtn = document.getElementById("close-search-btn");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function getSearchResults(queryText) {
  const query = normalizeSearchValue(queryText);
  const source = getSearchSourceBooks();

  if (!query) {
    return shuffleArray(source).slice(0, SEARCH_PANEL_LIMIT);
  }

  const scored = source
    .map((book) => {
      const title = normalizeSearchValue(book.title);
      const author = normalizeSearchValue(book.author);
      const category = normalizeSearchValue(book.category);

      let score = 0;

      if (title === query) score += 100;
      else if (title.startsWith(query)) score += 75;
      else if (title.includes(query)) score += 60;

      if (author === query) score += 50;
      else if (author.startsWith(query)) score += 35;
      else if (author.includes(query)) score += 25;

      if (category === query) score += 20;
      else if (category.startsWith(query)) score += 10;
      else if (category.includes(query)) score += 5;

      return { book, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.book.title || "").localeCompare(String(b.book.title || ""));
    });

  return scored.slice(0, SEARCH_PANEL_LIMIT).map((entry) => entry.book);
}

function runSearch(rawQuery = searchInput.value) {
  currentSearchResults = getSearchResults(rawQuery);
  renderSearchResults(currentSearchResults, rawQuery);
}

function openSearch(initialQuery = "") {
  if (searchCloseTimer) {
    clearTimeout(searchCloseTimer);
    searchCloseTimer = null;
  }
  searchBackdrop.classList.remove("hidden");
  searchModal.classList.remove("hidden");
  searchBackdrop.classList.add("show");
  searchModal.classList.add("open");
  searchInput.value = String(initialQuery || "");
  runSearch(searchInput.value);
  requestAnimationFrame(() => {
    searchInput.focus();
    searchInput.select();
  });
}

function closeSearch() {
  searchBackdrop.classList.remove("show");
  searchModal.classList.remove("open");

  searchCloseTimer = window.setTimeout(() => {
    searchBackdrop.classList.add("hidden");
    searchModal.classList.add("hidden");
    searchCloseTimer = null;
  }, 120);
}

function openSearchResultDetail(book) {
  if (!book) return;
  window.location.href = buildPublicBookUrl(book);
}

if (sidebarSearchBtn) {
  sidebarSearchBtn.addEventListener("click", () => {
    closeSidebar();
    openSearch("");
  });
}

if (globalSearchBtn) {
  globalSearchBtn.addEventListener("click", () => openSearch(""));
}

closeSearchBtn.addEventListener("click", () => closeSearch());
searchBackdrop.addEventListener("click", () => closeSearch());

searchInput.addEventListener("input", (e) => {
  runSearch(e.target.value);
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    const topResult = currentSearchResults[0];
    if (!topResult) return;
    openSearchResultDetail(topResult);
  }
});

document.addEventListener("keydown", (event) => {
  const activeTag = document.activeElement?.tagName?.toLowerCase() || "";
  const typingInField =
    activeTag === "input" || activeTag === "textarea" || document.activeElement?.isContentEditable;

  if (event.key === "Escape" && searchModal.classList.contains("open")) {
    closeSearch();
    return;
  }

  if (typingInField) return;
  if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    openSearch("");
  }
});

function renderSearchResults(results, queryText) {
  searchResults.innerHTML = "";

  if (results.length === 0) {
    searchResults.innerHTML =
      '<div class="search-empty-state">No books found for your search.</div>';
    return;
  }

  const progressMap = loadReadingProgressMap();
  const fragment = document.createDocumentFragment();
  const limitedResults = results.slice(0, SEARCH_PANEL_LIMIT);

  for (const book of limitedResults) {
    const result = document.createElement("button");
    result.type = "button";
    result.className = "search-result-item rich-search-item";

    const driveId = String(book.pdf_drive_id || "").trim();
    const progress = progressMap[driveId];
    const resumePage = getResumePageForBook(book);
    const resumeText =
      resumePage && progress
        ? `Continue from page ${resumePage} â€¢ ${Math.max(0, Math.min(100, Number(progress.progress || 0)))}%`
        : "View details first";
    const coverMarkup = getSearchCoverMarkup(book);
    const premiumMarkup = getSearchPremiumMarkup(book);

    result.innerHTML = `
      ${coverMarkup}
      <div class="search-result-main">
        <strong>${escapeHtml(book.title)}</strong>
        <p>${escapeHtml(book.author || "Unknown Author")} â€¢ ${escapeHtml(book.category || "Book")}</p>
        ${premiumMarkup}
        <small>${escapeHtml(resumeText)}</small>
      </div>
      <span class="search-result-open">Details</span>
    `;

    result.addEventListener("click", () => {
      openSearchResultDetail(book);
    });

    fragment.appendChild(result);
  }

  searchResults.appendChild(fragment);
}
/* =========================================
   PREMIUM PDF LIBRARY FETCH & RENDER LOGIC
   ========================================= */
document.addEventListener("DOMContentLoaded", () => {
  applyLibrarySettings();
  updateMyListCount();
  fetchPDFs();
});

// Backend recovery system
// Renders cached books immediately when possible, then keeps retrying the live
// API while the backend/database wake up.
let _fetchPDFsRunning = false;
let _libraryCacheRendered = false;
let _initialSearchHandled = false;

function normalizeLibraryBooksPayload(pdfs) {
  return Array.isArray(pdfs)
    ? pdfs.filter(
        (book) =>
          book &&
          typeof book === "object" &&
          normalizeText(book.title).length > 0,
      )
    : [];
}

function readPublicLibraryCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PUBLIC_LIBRARY_CACHE_KEY) || "null");
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.books)) {
      return [];
    }

    const cachedAt = Number(parsed.cachedAt || 0);
    if (!cachedAt || Date.now() - cachedAt > PUBLIC_LIBRARY_CACHE_MAX_AGE_MS) {
      return [];
    }

    return normalizeLibraryBooksPayload(parsed.books);
  } catch {
    return [];
  }
}

function writePublicLibraryCache(books) {
  if (!Array.isArray(books) || books.length === 0) return;
  try {
    localStorage.setItem(
      PUBLIC_LIBRARY_CACHE_KEY,
      JSON.stringify({
        cachedAt: Date.now(),
        books,
      }),
    );
  } catch {
    // Ignore storage write errors in private mode or when storage is full.
  }
}

function handleInitialSearchQuery() {
  if (_initialSearchHandled) return;
  const params = new URLSearchParams(window.location.search);
  const query = normalizeText(params.get("q") || params.get("search"));
  if (!query) return;

  _initialSearchHandled = true;
  openSearch(query);
  runSearch(query);
}

function showLibraryLoadingStatus(message) {
  const loadingIndicator = document.getElementById("loading-indicator");
  if (!loadingIndicator || _libraryCacheRendered) return;

  let status = document.getElementById("library-loading-status");
  if (!status) {
    status = document.createElement("div");
    status.id = "library-loading-status";
    status.style.cssText =
      "margin:18px 0 0;color:rgba(255,255,255,0.62);font:500 14px/1.5 Inter,system-ui,sans-serif;";
    loadingIndicator.appendChild(status);
  }
  status.textContent = message;
}

function applyLibraryBooks(books, { fromCache = false } = {}) {
  allLibraryBooks = normalizeLibraryBooksPayload(books);
  window.PDF_LIBRARY_BOOKS = allLibraryBooks;
  searchableBooks = allLibraryBooks.filter((book) => hasReadableBook(book));

  const loadingIndicator = document.getElementById("loading-indicator");
  if (loadingIndicator) loadingIndicator.style.display = "none";

  if (fromCache) {
    _libraryCacheRendered = true;
  } else {
    _libraryCacheRendered = false;
    writePublicLibraryCache(allLibraryBooks);
  }

  renderSitePremiumButton();
  renderContinueReadingSection(allLibraryBooks);
  runSearch("");
  rerenderLibraryRowsForFreshLayout();
  handleInitialSearchQuery();
}

async function fetchPDFs(retryCount = 0) {
  if (retryCount === 0 && _fetchPDFsRunning) return;
  _fetchPDFsRunning = true;

  if (retryCount === 0 && !_libraryCacheRendered) {
    const cachedBooks = readPublicLibraryCache();
    if (cachedBooks.length > 0) {
      applyLibraryBooks(cachedBooks, { fromCache: true });
    }
  }

  const MAX_RETRIES = 20; // ~10 minutes of retrying

  try {
    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), LIBRARY_FETCH_TIMEOUT_MS);
    const response = await fetch(buildApiUrl("/api/pdfs"), { signal: controller.signal });
    clearTimeout(fetchTimeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const pdfs = await response.json();
    applyLibraryBooks(pdfs);

    _fetchPDFsRunning = false;

  } catch (error) {
    console.warn(`[Library] Attempt ${retryCount + 1} failed silently:`, error.message);

    if (retryCount < MAX_RETRIES) {
      // Backoff: 5s, 8s, 13s, 21s, then 30s capped.
      if (!_libraryCacheRendered && retryCount >= 1) {
        showLibraryLoadingStatus("Still connecting to the library server...");
      }
      const waitMs = Math.min(30000, Math.round(5000 * Math.pow(1.6, retryCount)));
      setTimeout(() => fetchPDFs(retryCount + 1), waitMs);

    } else {
      // After the retry window, keep probing and auto-recover when the server responds.
      if (!_libraryCacheRendered) {
        showLibraryLoadingStatus("The library server is still waking up. Retrying automatically...");
      }
      _fetchPDFsRunning = false;
      const backgroundPing = setInterval(async () => {
        try {
          const r = await fetch(buildApiUrl("/api/ping"));
          if (r.ok) {
            clearInterval(backgroundPing);
            fetchPDFs(0);
          }
        } catch (_) { /* still waiting */ }
      }, 30000);
    }
  }
}


function renderPDFRows(pdfs) {
  const container = document.getElementById("pdf-container");
  if (!container) return;
  container.innerHTML = "";

  const source = Array.isArray(pdfs) ? pdfs : [];
  const visiblePdfs = source.filter(
    (book) =>
      book &&
      typeof book === "object" &&
      hasReadableBook(book) &&
      hasDisplayableCoverArt(book) &&
      normalizeText(book.title).length > 0,
  );

  if (visiblePdfs.length === 0) {
    container.innerHTML =
      '<div class="search-empty-state">No books available right now.</div>';
    return;
  }

  const homeRows = buildHomeRows(visiblePdfs);
  const initialHomeKeys = new Set();
  homeRows.forEach((homeRow) => {
    homeRow.books.forEach((book) => {
      initialHomeKeys.add(getHomeBookKey(book));
    });
  });
  const spareHomeBooks = shuffleArray(visiblePdfs).filter(
    (book) => !initialHomeKeys.has(getHomeBookKey(book)),
  );

  const createHomeBookCard = (pdf, row) => {
    const card = document.createElement("a");
    card.className = "pdf-card";
    card.href = buildPublicBookUrl(pdf);
    card.setAttribute("aria-label", `Open ${normalizeText(pdf.title) || "book"}`);
    card.dataset.bookId = String(pdf.id ?? "");
    card.dataset.title = normalizeText(pdf.title) || "";
    card.dataset.author = normalizeText(pdf.author || pdf.creator) || "";
    card.dataset.category = normalizeText(pdf.category || pdf.genre) || "";

    const hasVideo =
      Boolean(pdf.video_url || pdf.has_video) ||
      (normalizeText(pdf.video_drive_id).toLowerCase() !== "no video available" &&
        normalizeText(pdf.video_drive_id).length > 0);
    const coverId = getBookCoverDriveId(pdf);

    const replaceBrokenCard = () => {
      const replacement = spareHomeBooks.shift();
      if (replacement && row) {
        card.replaceWith(createHomeBookCard(replacement, row));
      } else {
        const fallback = createBookCoverFallbackElement(
          normalizeText(pdf.title) || "Book cover",
          "pdf-thumbnail pdf-thumbnail-fallback"
        );
        if (coverNode && coverNode.parentNode) {
          coverNode.replaceWith(fallback);
        }
      }
    };

    const coverNode = createBookCoverNode(pdf, {
      className: "pdf-thumbnail",
      fallbackClassName: "pdf-thumbnail-fallback",
      size: "w800",
      altText: normalizeText(pdf.title) || "Book cover",
      fallbackBehavior: "none",
      onMissingCover: replaceBrokenCard,
      onCoverError: replaceBrokenCard,
    });
    if (!coverNode) return null;
    const premiumBadge = createPremiumBadgeNode(pdf);

    const info = document.createElement("div");
    info.className = "pdf-info";

    const titleEl = document.createElement("p");
    titleEl.className = "pdf-title";
    titleEl.textContent = normalizeText(pdf.title) || "Untitled";

    const authorEl = document.createElement("p");
    authorEl.className = "pdf-author";
    authorEl.textContent = normalizeText(pdf.author) || "Unknown Author";

    info.appendChild(titleEl);
    info.appendChild(authorEl);
    if (premiumBadge) {
      card.appendChild(premiumBadge);
    }
    card.appendChild(coverNode);
    card.appendChild(info);

    if (hasVideo && coverId) {
      card.addEventListener("mouseenter", () => {
        const preloadImg = new Image();
        preloadImg.src = buildDriveThumbnailUrl(coverId, "w1200");
      });
    }

    return card;
  };

  homeRows.forEach((homeRow, index) => {
    const rowBooks = homeRow.books;
    const rowContainer = document.createElement("div");
    rowContainer.className = "pdf-row-container";

    const title = document.createElement("h2");
    title.className = "row-title";
    title.textContent = homeRow.title || getRowTitle(index, rowBooks);
    rowContainer.appendChild(title);

    const row = document.createElement("div");
    row.className = "pdf-row";

    rowBooks.forEach((pdf) => {
      const card = createHomeBookCard(pdf, row);
      if (card) row.appendChild(card);
    });

    rowContainer.appendChild(row);
    container.appendChild(rowContainer);
  });
}
/* =========================================
   CINEMATIC MODAL LOGIC (Google Drive Iframe Ã¢â‚¬â€ Direct, No Backend Auth)
   ========================================= */
const cinematicBackdrop = document.getElementById("cinematic-modal-backdrop");
const closeCinematicBtn = document.getElementById("close-cinematic-btn");
const cinematicPoster = document.getElementById("cinematic-poster");
const cinematicVideo = document.getElementById("cinematic-video");
const cinematicTitle = document.getElementById("cinematic-title");
const cinematicCategory = document.getElementById("cinematic-category");
const cinematicDesc = document.getElementById("cinematic-desc");
const cinematicReadBtn = document.getElementById("cinematic-read-btn");

let videoFallbackTimeout = null;
let iframeLoadHandler = null;

function showVideo() {
  // Smooth transition: hide poster, show video iframe
  cinematicPoster.classList.add("hidden");
  cinematicVideo.classList.remove("hidden");
}

function openCinematicModal(pdf) {
  // 1. Populate Text Data
  cinematicTitle.textContent = pdf.title;
  cinematicCategory.textContent = pdf.category || "Fiction";
  cinematicDesc.textContent = pdf.description || "No description available.";

  // 2. Set Poster Image (high resolution)
  cinematicPoster.src = buildDriveThumbnailUrl(getBookCoverDriveId(pdf), "w1200");

  // 3. Setup "Read PDF" button
    if (cinematicReadBtn) {
      cinematicReadBtn.onclick = () => {
      const readerDocumentId = buildReaderDocumentId(pdf, "pdf", pdf?.pdf_drive_id);
      if (window.saveToRecentHistory) {
        window.saveToRecentHistory({
          ...pdf,
          pdf_drive_id: readerDocumentId || pdf?.pdf_drive_id || null,
        });
      }
      window.open(
        `view-pdf.html?id=${encodeURIComponent(readerDocumentId)}&title=${encodeURIComponent(pdf.title)}`,
        "_blank",
      );
      };
    }

  // 4. Reset visual state Ã¢â‚¬â€ show poster, hide video
  cinematicPoster.classList.remove("hidden");
  cinematicVideo.classList.add("hidden");

  // 5. Clean up any previous iframe load listener
  if (iframeLoadHandler) {
    cinematicVideo.removeEventListener("load", iframeLoadHandler);
    iframeLoadHandler = null;
  }
  clearTimeout(videoFallbackTimeout);

  // 6. Listen for iframe load event Ã¢â‚¬â€ this fires when Google Drive's
  //    preview page has finished loading its HTML (player is ready)
  iframeLoadHandler = () => {
    clearTimeout(videoFallbackTimeout);
    // Small delay to let Google's player JS initialize after HTML loads
    setTimeout(showVideo, 800);
  };
  cinematicVideo.addEventListener("load", iframeLoadHandler);

  // 7. Set iframe source Ã¢â‚¬â€ Google Drive /preview URL
  cinematicVideo.src = pdf.video_url
    ? buildApiUrl(pdf.video_url)
    : `https://drive.google.com/file/d/${encodeURIComponent(pdf.video_drive_id)}/preview?rm=minimal`;

  // 8. Show Modal
  cinematicBackdrop.classList.remove("hidden");

  // 9. SAFETY FALLBACK: If iframe load event doesn't fire within 12 seconds,
  //    show the iframe anyway (it might still be loading but at least the
  //    user sees Google's player UI instead of just the poster)
  videoFallbackTimeout = setTimeout(() => {
    if (!cinematicPoster.classList.contains("hidden")) {
      showVideo();
    }
  }, 12000);
}

function closeCinematicModal() {
  cinematicBackdrop.classList.add("hidden");
  clearTimeout(videoFallbackTimeout);

  // Remove load listener
  if (iframeLoadHandler) {
    cinematicVideo.removeEventListener("load", iframeLoadHandler);
    iframeLoadHandler = null;
  }

  // Stop the iframe Ã¢â‚¬â€ clear src to halt video playback and download
  cinematicVideo.src = "";
  cinematicVideo.classList.add("hidden");
  cinematicPoster.classList.remove("hidden");
}

// Event Listeners for closing modal
if (closeCinematicBtn)
  closeCinematicBtn.addEventListener("click", closeCinematicModal);
if (cinematicBackdrop) {
  cinematicBackdrop.addEventListener("click", (e) => {
    if (e.target === cinematicBackdrop) closeCinematicModal();
  });
}

