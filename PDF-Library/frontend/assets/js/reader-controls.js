try {
(function () {
  "use strict";

  const quickBtn = document.getElementById("reader-quick-btn");
  const pdfSidebar = document.getElementById("pdf-sidebar");
  const showSidebarBtn = document.getElementById("show-sidebar-btn");
  const tabChapters = document.getElementById("tab-chapters");
  const tabThumbnails = document.getElementById("tab-thumbnails");

  if (!quickBtn) return;

  const params = new URLSearchParams(window.location.search);
  const documentId = params.get("id") || "default";
  const bookTitle = params.get("title") || "This Book";

  const ACTIVE_EMAIL_KEY = "pdf_lib_active_email";
  const ACCOUNTS_KEY = "pdf_lib_accounts";
  const STORAGE_MIGRATION_META_KEY = "pdf_lib_storage_migration_v2";
  const SETTINGS_KEY_PREFIX = "pdf_reader_controls_settings_v2";
  const SETTINGS_BACKUP_KEY_PREFIX = "pdf_reader_controls_settings_backup_v2";
  const BOOKMARK_KEY_PREFIX = `pdf_reader_bookmarks_v2_${documentId}`;
  const HIGHLIGHT_KEY_PREFIX = `pdf_reader_highlights_v2_${documentId}`;
  const NOTES_KEY_PREFIX = `pdf_reader_notes_v2_${documentId}`;
  const READING_PROGRESS_KEY_PREFIX = "pdf_lib_reading_progress_v1";
  const LIBRARY_SETTINGS_KEY_PREFIX = "pdf_lib_user_settings_v1";

  function normalizeEmailKey(email) {
    return String(email || "").trim().toLowerCase();
  }

  function getActiveEmailKey() {
    return normalizeEmailKey(localStorage.getItem(ACTIVE_EMAIL_KEY));
  }

  function isLibraryActivitySavingAllowed() {
    const emailKey = getActiveEmailKey() || "guest";
    try {
      const parsed = JSON.parse(
        localStorage.getItem(`${LIBRARY_SETTINGS_KEY_PREFIX}::${emailKey}`) || "{}",
      );
      return parsed?.saveActivity !== false;
    } catch {
      return true;
    }
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

  function getScopedStorageKey(prefix, emailKey = getActiveEmailKey()) {
    if (!emailKey) return null;
    return `${prefix}::${emailKey}`;
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
      // Ignore storage write errors.
    }
  }

  function migrateLegacyValueIfNeeded(prefix) {
    const emailKey = getActiveEmailKey();
    const scopedKey = getScopedStorageKey(prefix, emailKey);
    if (!scopedKey) return null;

    const scopedRaw = localStorage.getItem(scopedKey);
    if (scopedRaw !== null) return scopedRaw;

    const legacyRaw = localStorage.getItem(prefix);
    if (legacyRaw === null) return null;

    const migrationState = readStorageMigrationState();
    const owner = normalizeEmailKey(migrationState[prefix]);
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

  function safeLoadScopedJSON(prefix, fallback) {
    const scopedKey = getScopedStorageKey(prefix);
    if (!scopedKey) return fallback;

    const raw = localStorage.getItem(scopedKey) ?? migrateLegacyValueIfNeeded(prefix);
    if (raw === null || raw === undefined) return fallback;

    try {
      const parsed = JSON.parse(raw);
      if (parsed === null || parsed === undefined) return fallback;
      return parsed;
    } catch {
      return fallback;
    }
  }

  function saveScopedJSON(prefix, value) {
    const scopedKey = getScopedStorageKey(prefix);
    if (!scopedKey) return;
    try {
      localStorage.setItem(scopedKey, JSON.stringify(value));
    } catch {
      // Ignore storage write errors.
    }
  }

  const FONT_OPTIONS = [
    { id: "Original", stack: '"Source Serif 4", Georgia, serif' },
    { id: "Athelas", stack: 'Athelas, "Palatino Linotype", serif' },
    { id: "Avenir Next", stack: '"Avenir Next", "Helvetica Neue", Arial, sans-serif' },
    { id: "Canela", stack: '"Canela", "Palatino Linotype", "Source Serif 4", serif' },
    { id: "Charter", stack: '"Charter", "Bitstream Charter", "Source Serif 4", serif' },
    { id: "Georgia", stack: "Georgia, serif" },
    { id: "Iowan", stack: '"Iowan Old Style", "Palatino Linotype", serif' },
    { id: "Palatino", stack: '"Palatino Linotype", Palatino, serif' },
    { id: "Proxima Nova", stack: '"Proxima Nova", "Avenir Next", Arial, sans-serif' },
    { id: "Publico", stack: '"Publico", Georgia, serif' },
    { id: "San Francisco", stack: '"SF Pro Text", "San Francisco", "Helvetica Neue", Arial, sans-serif' },
    { id: "New York", stack: '"New York", "Times New Roman", serif' },
    { id: "Seravek", stack: '"Seravek", "Avenir Next", Arial, sans-serif' },
    { id: "Times New Roman", stack: '"Times New Roman", Times, serif' },
  ];

  const HIGHLIGHT_COLORS = [
    { id: "yellow", label: "Yellow", value: "rgba(255, 231, 76, 0.55)" },
    { id: "green", label: "Green", value: "rgba(140, 225, 140, 0.55)" },
    { id: "blue", label: "Blue", value: "rgba(119, 199, 255, 0.52)" },
    { id: "pink", label: "Pink", value: "rgba(255, 164, 214, 0.55)" },
    { id: "orange", label: "Orange", value: "rgba(255, 184, 103, 0.58)" },
    { id: "purple", label: "Purple", value: "rgba(198, 172, 255, 0.56)" },
  ];

  const defaultSettings = {
    brightness: 92,
    theme: "original",
    compactLayout: false,
    highContrast: false,
    selectedHighlightColor: "yellow",
    fontFamily: "Original",
    boldText: false,
    customiseEnabled: false,
    lineSpacing: 120,
    charSpacing: 0,
    wordSpacing: 0,
    margins: 0,
    justifyText: false,
    useDefaultAppearance: false,
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  let settings = { ...defaultSettings, ...safeLoadScopedJSON(SETTINGS_KEY_PREFIX, {}) };
  let bookmarks = safeLoadScopedJSON(BOOKMARK_KEY_PREFIX, []);
  let highlights = safeLoadScopedJSON(HIGHLIGHT_KEY_PREFIX, []);
  let notes = safeLoadScopedJSON(NOTES_KEY_PREFIX, []);
  let settingsBackup = safeLoadScopedJSON(SETTINGS_BACKUP_KEY_PREFIX, null);

  if (!Array.isArray(bookmarks)) bookmarks = [];
  if (!Array.isArray(highlights)) highlights = [];
  if (!Array.isArray(notes)) notes = [];

  bookmarks = bookmarks
    .map((item) => {
      if (item && typeof item === "object") {
        return {
          page: Number(item.page),
          createdAt: Number(item.createdAt || Date.now()),
        };
      }

      return {
        page: Number(item),
        createdAt: Date.now(),
      };
    })
    .filter((item) => Number.isFinite(item.page) && item.page > 0)
    .map((item) => ({
      page: Math.floor(item.page),
      createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
    }));

  const bookmarkMap = new Map();
  for (const item of bookmarks) {
    const existing = bookmarkMap.get(item.page);
    if (!existing || item.createdAt > existing.createdAt) {
      bookmarkMap.set(item.page, item);
    }
  }
  bookmarks = Array.from(bookmarkMap.values()).sort((a, b) => b.createdAt - a.createdAt);

  highlights = highlights
    .filter((item) => item && Array.isArray(item.rects) && Number.isFinite(Number(item.page)))
    .map((item) => ({
      id: String(item.id || `hl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      page: Number(item.page),
      color: item.color || "yellow",
      quote: String(item.quote || ""),
      rects: item.rects
        .filter(
          (rect) =>
            rect &&
            Number.isFinite(Number(rect.x)) &&
            Number.isFinite(Number(rect.y)) &&
            Number.isFinite(Number(rect.w)) &&
            Number.isFinite(Number(rect.h))
        )
        .map((rect) => ({
          x: clamp(Number(rect.x), 0, 1),
          y: clamp(Number(rect.y), 0, 1),
          w: clamp(Number(rect.w), 0.001, 1),
          h: clamp(Number(rect.h), 0.001, 1),
        })),
      createdAt: Number(item.createdAt || Date.now()),
    }))
    .filter((item) => item.rects.length > 0);

  notes = notes
    .filter((item) => item && typeof item.text === "string")
    .map((item) => ({
      id: String(item.id || `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      text: String(item.text || "").trim().slice(0, 2000),
      page: clamp(Number(item.page || 1), 1, 100000),
      createdAt: Number(item.createdAt || Date.now()),
    }))
    .filter((item) => item.text.length > 0);

  if (!settingsBackup || typeof settingsBackup !== "object") {
    settingsBackup = {};
  }

  let currentState = {
    currentPage: 1,
    totalPages: 0,
    readablePages: 0,
    progress: 0,
    isPreviewMode: false,
  };

  const controlsShell = document.createElement("div");
  controlsShell.id = "reader-controls-shell";
  controlsShell.innerHTML = `
    <button id="reader-quick-fab" class="reader-quick-fab" aria-label="Reader Controls" title="Reader Controls" data-hover-label="Reader Controls">
      <span class="reader-quick-glyph" aria-hidden="true">
        <span class="reader-quick-dot"></span>
        <span class="reader-quick-line"></span>
        <span class="reader-quick-dot"></span>
        <span class="reader-quick-line"></span>
        <span class="reader-quick-dot"></span>
      </span>
    </button>

    <section id="reader-quick-sheet" class="reader-quick-sheet" aria-hidden="true">
      <div class="reader-sheet-header">
        <h3>Reader Controls</h3>
        <button class="reader-close-btn" id="reader-close-quick-sheet" type="button" aria-label="Close Reader Controls">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <button class="reader-sheet-row reader-progress-row" id="reader-open-contents" type="button" data-hover-label="Contents">
        <span id="reader-progress-label">Contents - 0%</span>
        <span class="material-symbols-outlined">menu</span>
      </button>

      <button class="reader-sheet-row" id="reader-open-search" type="button" data-hover-label="Search Bar">
        <span>Search Book</span>
        <span class="material-symbols-outlined">search</span>
      </button>

      <button class="reader-sheet-row" id="reader-open-theme" type="button" data-hover-label="Themes and Settings">
        <span>Themes & Settings</span>
        <span class="reader-aa-icon">AA</span>
      </button>

      <button class="reader-sheet-row" id="reader-open-bookmarks" type="button" data-hover-label="Bookmarks">
        <span>Bookmark History</span>
        <span class="material-symbols-outlined">bookmarks</span>
      </button>

      <button class="reader-sheet-row" id="reader-open-notes" type="button" data-hover-label="Your Notes">
        <span>Your Notes</span>
        <span class="material-symbols-outlined">edit_note</span>
      </button>

      <div class="reader-sheet-actions">
        <button class="reader-action-btn" id="reader-lock-btn" type="button" title="Lock Screen" data-hover-label="Lock Screen">
          <span class="material-symbols-outlined">lock</span>
        </button>
        <button class="reader-action-btn" id="reader-highlight-btn" type="button" title="Highlighting" data-hover-label="Highlighting">
          <span class="material-symbols-outlined">ink_highlighter</span>
        </button>
        <button class="reader-action-btn" id="reader-bookmark-btn" type="button" title="Bookmark" data-hover-label="Bookmark">
          <span class="material-symbols-outlined">bookmark</span>
        </button>
      </div>
    </section>

    <section id="reader-search-popover" class="reader-popover reader-search-popover" aria-hidden="true">
      <div class="reader-popover-header">
        <h3>Search Book</h3>
        <button class="reader-close-btn" id="reader-close-search" type="button" aria-label="Close Search" data-hover-label="Close Search">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <input id="reader-search-input" class="reader-search-input" type="text" placeholder="Type words to search..." autocomplete="off" data-hover-label="Search Bar" />
      <p id="reader-search-status" class="reader-search-status">Enter at least 2 characters.</p>
      <div id="reader-search-results" class="reader-search-results"></div>
    </section>

    <section id="reader-bookmarks-popover" class="reader-popover reader-bookmarks-popover" aria-hidden="true">
      <div class="reader-popover-header">
        <h3>Bookmark History</h3>
        <button class="reader-close-btn" id="reader-close-bookmarks" type="button" aria-label="Close Bookmarks" data-hover-label="Close Bookmarks">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <p class="reader-search-status">Saved pages for this book. Click any entry to jump.</p>
      <div id="reader-bookmarks-list" class="reader-bookmarks-list"></div>
    </section>

    <section id="reader-notes-popover" class="reader-popover reader-notes-popover" aria-hidden="true">
      <div class="reader-popover-header">
        <h3>Your Notes</h3>
        <button class="reader-close-btn" id="reader-close-notes" type="button" aria-label="Close Notes">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <p id="reader-notes-book-title" class="reader-notes-book-title"></p>
      <div class="reader-notes-input-wrap">
        <textarea id="reader-notes-input" class="reader-notes-input" rows="2" placeholder="Write a note and press Enter to save."></textarea>
      </div>
      <p class="reader-search-status">Press Enter to save. Use Shift+Enter for a new line.</p>
      <div id="reader-notes-list" class="reader-notes-list"></div>
    </section>

    <section id="reader-highlight-popover" class="reader-popover reader-highlight-popover" aria-hidden="true">
      <div class="reader-popover-header">
        <h3>Highlighting</h3>
        <button class="reader-close-btn" id="reader-close-highlighting" type="button" aria-label="Close Highlighting" data-hover-label="Close Highlighting">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <p class="reader-search-status">Select text normally, then click "Highlight Selection". For box highlights, hold Alt and drag in the PDF.</p>
      <div id="reader-highlight-colors" class="reader-highlight-colors"></div>
      <div class="reader-highlight-actions">
        <button id="reader-apply-highlight" type="button" data-hover-label="Apply Highlight">Highlight Selection</button>
        <button id="reader-clear-page-highlights" type="button" data-hover-label="Clear Page Highlights">Clear Page Highlights</button>
        <button id="reader-clear-all-highlights" type="button" data-hover-label="Clear All Highlights">Clear All Highlights</button>
      </div>
      <p id="reader-highlight-status" class="reader-search-status">No text selected.</p>
      <div id="reader-highlight-library" class="reader-highlight-library"></div>
    </section>

    <section id="reader-theme-modal" class="reader-theme-modal" aria-hidden="true">
      <div class="reader-theme-header">
        <h3>Themes & Settings</h3>
        <button class="reader-close-btn" id="reader-close-theme" type="button" aria-label="Close Themes and Settings" data-hover-label="Close Themes and Settings">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="reader-theme-top-controls">
        <div class="reader-font-steps">
          <button id="reader-font-smaller" type="button" data-hover-label="Smaller Page">A</button>
          <button id="reader-font-larger" type="button" data-hover-label="Larger Page">A</button>
        </div>
        <div class="reader-mode-toggles">
          <button id="reader-layout-toggle" type="button" title="Compact Layout" data-hover-label="Compact Layout">
            <span class="material-symbols-outlined">fullscreen_exit</span>
          </button>
          <button id="reader-contrast-toggle" type="button" title="High Contrast" data-hover-label="High Contrast">
            <span class="material-symbols-outlined">contrast</span>
          </button>
        </div>
      </div>

      <div class="reader-brightness-wrap">
        <span class="material-symbols-outlined">light_mode</span>
        <input id="reader-brightness-slider" type="range" min="45" max="100" step="1" data-hover-label="Brightness" />
        <span class="material-symbols-outlined">wb_twilight</span>
      </div>

      <div class="reader-theme-grid" id="reader-theme-grid">
        <button class="reader-theme-card" data-theme="original" type="button" data-hover-label="Original Theme"><span>Aa</span><small>Original</small></button>
        <button class="reader-theme-card" data-theme="quiet" type="button" data-hover-label="Quiet Theme"><span>Aa</span><small>Quiet</small></button>
        <button class="reader-theme-card" data-theme="paper" type="button" data-hover-label="Paper Theme"><span>Aa</span><small>Paper</small></button>
        <button class="reader-theme-card" data-theme="bold" type="button" data-hover-label="Bold Theme"><span>Aa</span><small>Bold</small></button>
        <button class="reader-theme-card" data-theme="calm" type="button" data-hover-label="Calm Theme"><span>Aa</span><small>Calm</small></button>
        <button class="reader-theme-card" data-theme="focus" type="button" data-hover-label="Focus Theme"><span>Aa</span><small>Focus</small></button>
      </div>

      <button id="reader-open-customise" class="reader-customise-btn" type="button" data-hover-label="Customise Theme">
        <span class="material-symbols-outlined">settings</span>
        Customise
      </button>
    </section>

    <section id="reader-customise-modal" class="reader-customise-modal" aria-hidden="true">
      <div class="reader-customise-top">
        <button id="reader-customise-close" class="reader-customise-round" type="button" data-hover-label="Close Customise Theme">
          <span class="material-symbols-outlined">close</span>
        </button>
        <h3>Customise Theme</h3>
        <button id="reader-customise-done" class="reader-customise-round reader-customise-done" type="button" data-hover-label="Apply Customise Theme">
          <span class="material-symbols-outlined">check</span>
        </button>
      </div>

      <div class="reader-customise-preview">
        <h4 id="reader-customise-preview-aa">Aa</h4>
        <p id="reader-customise-preview-text">"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?" Mr. Bennet replied that he had not.</p>
      </div>

      <div class="reader-customise-section-title">Text</div>
      <div class="reader-customise-card">
        <button id="reader-font-picker-btn" class="reader-customise-row reader-font-row" type="button" data-hover-label="Font">
          <span class="reader-customise-row-left"><strong>Aa</strong><span>Font</span></span>
          <span class="reader-customise-row-right"><em id="reader-font-current">Original</em><span class="material-symbols-outlined">chevron_right</span></span>
        </button>
        <div id="reader-font-options" class="reader-font-options"></div>
        <label class="reader-customise-row reader-switch-row" data-hover-label="Bold Text">
          <span class="reader-customise-row-left"><strong>B</strong><span>Bold Text</span></span>
          <span class="reader-switch">
            <input id="reader-bold-toggle" type="checkbox" />
            <span class="reader-switch-track"></span>
          </span>
        </label>
      </div>

      <div class="reader-customise-section-title">Accessibility & Layout Options</div>
      <div class="reader-customise-card">
        <label class="reader-customise-row reader-switch-row" data-hover-label="Default Appearance">
          <span class="reader-customise-row-left"><span>Default</span></span>
          <span class="reader-switch">
            <input id="reader-default-toggle" type="checkbox" />
            <span class="reader-switch-track"></span>
          </span>
        </label>

        <label class="reader-customise-row reader-switch-row" data-hover-label="Customise Layout">
          <span class="reader-customise-row-left"><span>Customise</span></span>
          <span class="reader-switch">
            <input id="reader-layout-customise-toggle" type="checkbox" />
            <span class="reader-switch-track"></span>
          </span>
        </label>

        <div id="reader-layout-custom-controls" class="reader-layout-custom-controls">
          <label class="reader-slider-row" data-hover-label="Line Spacing">
            <span class="reader-slider-label">LINE SPACING</span>
            <div class="reader-slider-track-row">
              <span class="material-symbols-outlined">format_line_spacing</span>
              <input id="reader-line-spacing-slider" type="range" min="80" max="180" step="1" />
              <span id="reader-line-spacing-value">1.20</span>
            </div>
          </label>

          <label class="reader-slider-row" data-hover-label="Character Spacing">
            <span class="reader-slider-label">CHARACTER SPACING</span>
            <div class="reader-slider-track-row">
              <span class="material-symbols-outlined">text_select_start</span>
              <input id="reader-char-spacing-slider" type="range" min="0" max="100" step="1" />
              <span id="reader-char-spacing-value">0%</span>
            </div>
          </label>

          <label class="reader-slider-row" data-hover-label="Word Spacing">
            <span class="reader-slider-label">WORD SPACING</span>
            <div class="reader-slider-track-row">
              <span class="material-symbols-outlined">notes</span>
              <input id="reader-word-spacing-slider" type="range" min="0" max="100" step="1" />
              <span id="reader-word-spacing-value">0%</span>
            </div>
          </label>

          <label class="reader-slider-row" data-hover-label="Margins">
            <span class="reader-slider-label">MARGINS</span>
            <div class="reader-slider-track-row">
              <span class="material-symbols-outlined">crop_16_9</span>
              <input id="reader-margins-slider" type="range" min="0" max="40" step="1" />
              <span id="reader-margins-value">0%</span>
            </div>
          </label>
        </div>
      </div>

      <div class="reader-customise-card">
        <label class="reader-customise-row reader-switch-row" data-hover-label="Justify Text">
          <span class="reader-customise-row-left"><span>Justify Text</span></span>
          <span class="reader-switch">
            <input id="reader-justify-toggle" type="checkbox" />
            <span class="reader-switch-track"></span>
          </span>
        </label>
      </div>

      <p id="reader-default-help" class="reader-default-help">Turn on Default to use the original PDF appearance. Turn it off to restore your previous custom style.</p>

      <button id="reader-reset-customise" class="reader-customise-reset" type="button" data-hover-label="Reset Theme">Reset Theme</button>
    </section>

    <button id="reader-unlock-btn" class="reader-unlock-btn" type="button" data-hover-label="Unlock Screen">
      <span class="material-symbols-outlined">lock_open</span>
      Unlock Screen
    </button>

    <div id="reader-controls-backdrop" class="reader-controls-backdrop" aria-hidden="true"></div>
    <div id="reader-toast" class="reader-toast" aria-live="polite"></div>
    <div id="reader-hover-label" class="reader-hover-label" aria-hidden="true"></div>
  `;
  document.body.appendChild(controlsShell);

  const quickFab = document.getElementById("reader-quick-fab");
  const quickSheet = document.getElementById("reader-quick-sheet");
  const closeQuickSheetBtn = document.getElementById("reader-close-quick-sheet");
  const quickBackdrop = document.getElementById("reader-controls-backdrop");
  const progressLabel = document.getElementById("reader-progress-label");
  const openContentsBtn = document.getElementById("reader-open-contents");
  const openSearchBtn = document.getElementById("reader-open-search");
  const openThemeBtn = document.getElementById("reader-open-theme");
  const openBookmarksBtn = document.getElementById("reader-open-bookmarks");
  const openNotesBtn = document.getElementById("reader-open-notes");
  const lockBtn = document.getElementById("reader-lock-btn");
  const highlightBtn = document.getElementById("reader-highlight-btn");
  const bookmarkBtn = document.getElementById("reader-bookmark-btn");

  const searchPopover = document.getElementById("reader-search-popover");
  const closeSearchBtn = document.getElementById("reader-close-search");
  const searchInput = document.getElementById("reader-search-input");
  const searchStatus = document.getElementById("reader-search-status");
  const searchResults = document.getElementById("reader-search-results");

  const bookmarksPopover = document.getElementById("reader-bookmarks-popover");
  const closeBookmarksBtn = document.getElementById("reader-close-bookmarks");
  const bookmarksList = document.getElementById("reader-bookmarks-list");

  const notesPopover = document.getElementById("reader-notes-popover");
  const closeNotesBtn = document.getElementById("reader-close-notes");
  const notesBookTitle = document.getElementById("reader-notes-book-title");
  const notesInput = document.getElementById("reader-notes-input");
  const notesList = document.getElementById("reader-notes-list");

  const highlightPopover = document.getElementById("reader-highlight-popover");
  const closeHighlightingBtn = document.getElementById("reader-close-highlighting");
  const highlightColorsEl = document.getElementById("reader-highlight-colors");
  const applyHighlightBtn = document.getElementById("reader-apply-highlight");
  const clearPageHighlightsBtn = document.getElementById("reader-clear-page-highlights");
  const clearAllHighlightsBtn = document.getElementById("reader-clear-all-highlights");
  const highlightStatus = document.getElementById("reader-highlight-status");
  const highlightLibrary = document.getElementById("reader-highlight-library");

  const themeModal = document.getElementById("reader-theme-modal");
  const closeThemeBtn = document.getElementById("reader-close-theme");
  const fontSmallerBtn = document.getElementById("reader-font-smaller");
  const fontLargerBtn = document.getElementById("reader-font-larger");
  const layoutToggleBtn = document.getElementById("reader-layout-toggle");
  const contrastToggleBtn = document.getElementById("reader-contrast-toggle");
  const brightnessSlider = document.getElementById("reader-brightness-slider");
  const themeGrid = document.getElementById("reader-theme-grid");
  const openCustomiseBtn = document.getElementById("reader-open-customise");

  const customiseModal = document.getElementById("reader-customise-modal");
  const customiseCloseBtn = document.getElementById("reader-customise-close");
  const customiseDoneBtn = document.getElementById("reader-customise-done");
  const customisePreviewAa = document.getElementById("reader-customise-preview-aa");
  const customisePreviewText = document.getElementById("reader-customise-preview-text");
  const fontPickerBtn = document.getElementById("reader-font-picker-btn");
  const fontCurrent = document.getElementById("reader-font-current");
  const fontOptionsEl = document.getElementById("reader-font-options");
  const boldToggle = document.getElementById("reader-bold-toggle");
  const layoutCustomiseToggle = document.getElementById("reader-layout-customise-toggle");
  const layoutCustomControls = document.getElementById("reader-layout-custom-controls");
  const lineSpacingSlider = document.getElementById("reader-line-spacing-slider");
  const lineSpacingValue = document.getElementById("reader-line-spacing-value");
  const charSpacingSlider = document.getElementById("reader-char-spacing-slider");
  const charSpacingValue = document.getElementById("reader-char-spacing-value");
  const wordSpacingSlider = document.getElementById("reader-word-spacing-slider");
  const wordSpacingValue = document.getElementById("reader-word-spacing-value");
  const marginsSlider = document.getElementById("reader-margins-slider");
  const marginsValue = document.getElementById("reader-margins-value");
  const justifyToggle = document.getElementById("reader-justify-toggle");
  const defaultToggle = document.getElementById("reader-default-toggle");
  const defaultHelp = document.getElementById("reader-default-help");
  const resetCustomiseBtn = document.getElementById("reader-reset-customise");

  const unlockBtn = document.getElementById("reader-unlock-btn");
  const toastEl = document.getElementById("reader-toast");
  const pdfPageContainer = document.getElementById("pdf-page-container");

  let isQuickOpen = false;
  let activePopover = null;
  let isThemeOpen = false;
  let isCustomiseOpen = false;
  let searchRunId = 0;
  let toastTimeout = null;
  let searchRetryTimer = null;
  let hasPrimedSearchIndex = false;
  let drawSession = null;
  let pendingDrawHighlight = null;
  let readingProgressSaveTimer = null;

  if (notesBookTitle) {
    notesBookTitle.textContent = `Book Title: ${bookTitle}`;
  }

  function saveSettings() {
    saveScopedJSON(SETTINGS_KEY_PREFIX, settings);
  }

  function saveBookmarks() {
    saveScopedJSON(BOOKMARK_KEY_PREFIX, bookmarks);
  }

  function saveHighlights() {
    saveScopedJSON(HIGHLIGHT_KEY_PREFIX, highlights);
  }

  function saveNotes() {
    saveScopedJSON(NOTES_KEY_PREFIX, notes);
  }

  function loadReadingProgressMap() {
    const parsed = safeLoadScopedJSON(READING_PROGRESS_KEY_PREFIX, {});
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  }

  function saveReadingProgressNow() {
    if (!isLibraryActivitySavingAllowed()) return;
    const driveId = String(documentId || "").trim();
    if (!driveId || driveId === "default") return;

    const page = Math.max(1, Math.floor(Number(currentState.currentPage || 1)));
    const totalPages = Math.max(0, Math.floor(Number(currentState.totalPages || 0)));
    if (!totalPages) return;

    const map = loadReadingProgressMap();
    map[driveId] = {
      title: String(bookTitle || "").trim() || "Untitled Book",
      format: "pdf",
      documentId: driveId,
      lastPage: Math.min(page, totalPages),
      totalPages,
      progress: Math.round((Math.min(page, totalPages) / totalPages) * 100),
      locationLabel: `Page ${Math.min(page, totalPages)} / ${totalPages}`,
      updatedAt: Date.now(),
    };
    saveScopedJSON(READING_PROGRESS_KEY_PREFIX, map);
  }

  function scheduleReadingProgressSave() {
    if (readingProgressSaveTimer) clearTimeout(readingProgressSaveTimer);
    readingProgressSaveTimer = setTimeout(() => {
      readingProgressSaveTimer = null;
      saveReadingProgressNow();
    }, 260);
  }

  function saveSettingsBackup() {
    saveScopedJSON(SETTINGS_BACKUP_KEY_PREFIX, settingsBackup);
  }

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("show");
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastEl.classList.remove("show");
    }, 1700);
  }

  function getFontStack(fontId) {
    const found = FONT_OPTIONS.find((option) => option.id === fontId);
    return found ? found.stack : FONT_OPTIONS[0].stack;
  }

  function getHighlightColorValue(colorId) {
    const found = HIGHLIGHT_COLORS.find((color) => color.id === colorId);
    return found ? found.value : HIGHLIGHT_COLORS[0].value;
  }

  function getAppearanceSnapshot() {
    return {
      brightness: settings.brightness,
      theme: settings.theme,
      compactLayout: settings.compactLayout,
      highContrast: settings.highContrast,
      fontFamily: settings.fontFamily,
      boldText: settings.boldText,
      customiseEnabled: settings.customiseEnabled,
      lineSpacing: settings.lineSpacing,
      charSpacing: settings.charSpacing,
      wordSpacing: settings.wordSpacing,
      margins: settings.margins,
      justifyText: settings.justifyText,
    };
  }

  function applyAppearanceSnapshot(snapshot) {
    const next = { ...defaultSettings, ...(snapshot || {}) };
    applyBrightness(next.brightness);
    applyTheme(next.theme);
    applyLayout(next.compactLayout);
    applyContrast(next.highContrast);
    applyFontFamily(next.fontFamily);
    applyBoldText(next.boldText);
    applyCustomiseEnabled(next.customiseEnabled);
    applyLineSpacing(next.lineSpacing);
    applyCharSpacing(next.charSpacing);
    applyWordSpacing(next.wordSpacing);
    applyMargins(next.margins);
    applyJustifyText(next.justifyText);
    applyTypographyMode();
    refreshCustomisePreview();
  }

  function refreshDefaultAppearanceUI() {
    const defaultOn = Boolean(settings.useDefaultAppearance);
    defaultToggle.checked = defaultOn;
    customiseModal.classList.toggle("reader-default-active", defaultOn);

    const customiseControls = [
      fontPickerBtn,
      boldToggle,
      layoutCustomiseToggle,
      lineSpacingSlider,
      charSpacingSlider,
      wordSpacingSlider,
      marginsSlider,
      justifyToggle,
      resetCustomiseBtn,
    ];
    customiseControls.forEach((control) => {
      if (!control) return;
      control.disabled = defaultOn;
    });

    fontSmallerBtn.disabled = defaultOn;
    fontLargerBtn.disabled = defaultOn;
    layoutToggleBtn.disabled = defaultOn;
    contrastToggleBtn.disabled = defaultOn;
    brightnessSlider.disabled = defaultOn;
    themeGrid.querySelectorAll(".reader-theme-card").forEach((card) => {
      card.disabled = defaultOn;
    });

    if (defaultHelp) {
      defaultHelp.textContent = defaultOn
        ? "Default is ON. Turn it off to restore your previous custom style."
        : "Turn on Default to use the original PDF appearance. Turn it off to restore your previous custom style.";
    }

    if (defaultOn) fontOptionsEl.classList.remove("open");
  }

  function setDefaultAppearance(enabled) {
    const turnOn = Boolean(enabled);
    if (turnOn === Boolean(settings.useDefaultAppearance)) {
      refreshDefaultAppearanceUI();
      return;
    }

    if (turnOn) {
      settingsBackup = getAppearanceSnapshot();
      saveSettingsBackup();
      settings.useDefaultAppearance = true;
      saveSettings();
      applyAppearanceSnapshot(defaultSettings);
      showToast("Default appearance enabled");
    } else {
      settings.useDefaultAppearance = false;
      saveSettings();
      const restoreSnapshot =
        settingsBackup && Object.keys(settingsBackup).length > 0 ? settingsBackup : defaultSettings;
      applyAppearanceSnapshot(restoreSnapshot);
      showToast("Previous custom style restored");
    }

    refreshDefaultAppearanceUI();
  }

  function setQuickOpen(nextOpen) {
    isQuickOpen = Boolean(nextOpen);
    quickSheet.classList.toggle("open", isQuickOpen);
    quickSheet.setAttribute("aria-hidden", String(!isQuickOpen));
    syncBackdrop();
  }

  function setActivePopover(popoverId) {
    activePopover = popoverId;
    searchPopover.classList.toggle("open", popoverId === "search");
    bookmarksPopover.classList.toggle("open", popoverId === "bookmarks");
    notesPopover.classList.toggle("open", popoverId === "notes");
    highlightPopover.classList.toggle("open", popoverId === "highlighting");
    searchPopover.setAttribute("aria-hidden", String(popoverId !== "search"));
    bookmarksPopover.setAttribute("aria-hidden", String(popoverId !== "bookmarks"));
    notesPopover.setAttribute("aria-hidden", String(popoverId !== "notes"));
    highlightPopover.setAttribute("aria-hidden", String(popoverId !== "highlighting"));
    if (popoverId !== "highlighting" && drawSession?.preview) {
      drawSession.preview.remove();
      drawSession = null;
      pendingDrawHighlight = null;
    }
    syncBackdrop();
  }

  function setThemeOpen(nextOpen) {
    isThemeOpen = Boolean(nextOpen);
    themeModal.classList.toggle("open", isThemeOpen);
    themeModal.setAttribute("aria-hidden", String(!isThemeOpen));
    syncBackdrop();
  }

  function setCustomiseOpen(nextOpen) {
    isCustomiseOpen = Boolean(nextOpen);
    customiseModal.classList.toggle("open", isCustomiseOpen);
    customiseModal.setAttribute("aria-hidden", String(!isCustomiseOpen));
    syncBackdrop();
  }

  function syncBackdrop() {
    quickBackdrop.classList.toggle(
      "show",
      isQuickOpen || Boolean(activePopover) || isThemeOpen || isCustomiseOpen
    );
    quickBackdrop.classList.toggle("pass-through", activePopover === "highlighting");
  }

  function closeAllMenus() {
    setQuickOpen(false);
    setActivePopover(null);
    setThemeOpen(false);
    setCustomiseOpen(false);
  }

  function disableHoverLabelsAndTitles() {
    const hoverLabel = document.getElementById("reader-hover-label");
    if (hoverLabel) hoverLabel.remove();

    const hoverElements = document.querySelectorAll("[data-hover-label]");
    hoverElements.forEach((element) => element.removeAttribute("data-hover-label"));

    const titleElements = document.querySelectorAll(
      "#reader-page [title], #reader-controls-shell [title], #nav-right-slot [title]"
    );
    titleElements.forEach((element) => element.removeAttribute("title"));
  }

  function applyBrightness(brightness) {
    settings.brightness = Number(brightness);
    document.documentElement.style.setProperty("--reader-brightness", String(settings.brightness / 100));
    brightnessSlider.value = String(settings.brightness);
    saveSettings();
  }

  function applyTheme(themeName) {
    settings.theme = themeName;
    document.body.setAttribute("data-reader-theme", themeName);
    themeGrid.querySelectorAll(".reader-theme-card").forEach((card) => {
      card.classList.toggle("active", card.dataset.theme === themeName);
    });
    saveSettings();
  }

  function applyLayout(compactMode) {
    settings.compactLayout = Boolean(compactMode);
    document.body.classList.toggle("reader-layout-compact", settings.compactLayout);
    layoutToggleBtn.classList.toggle("active", settings.compactLayout);
    saveSettings();
  }

  function applyContrast(highContrast) {
    settings.highContrast = Boolean(highContrast);
    document.body.classList.toggle("reader-high-contrast", settings.highContrast);
    contrastToggleBtn.classList.toggle("active", settings.highContrast);
    saveSettings();
  }

  function applyFontFamily(fontFamily) {
    settings.fontFamily = fontFamily;
    fontCurrent.textContent = fontFamily;
    document.documentElement.style.setProperty("--reader-text-font-family", getFontStack(fontFamily));
    saveSettings();
    refreshFontOptions();
    applyTypographyMode();
    refreshCustomisePreview();
  }

  function applyBoldText(enabled) {
    settings.boldText = Boolean(enabled);
    boldToggle.checked = settings.boldText;
    document.documentElement.style.setProperty("--reader-text-font-weight", settings.boldText ? "700" : "500");
    saveSettings();
    applyTypographyMode();
    refreshCustomisePreview();
  }

  function applyCustomiseEnabled(enabled) {
    settings.customiseEnabled = Boolean(enabled);
    layoutCustomiseToggle.checked = settings.customiseEnabled;
    layoutCustomControls.classList.toggle("open", settings.customiseEnabled);
    document.body.classList.toggle("reader-customise-enabled", settings.customiseEnabled);
    saveSettings();
    applyTypographyMode();
    refreshCustomisePreview();
  }

  function applyLineSpacing(value) {
    settings.lineSpacing = Number(value);
    lineSpacingSlider.value = String(settings.lineSpacing);
    lineSpacingValue.textContent = (settings.lineSpacing / 100).toFixed(2);
    document.documentElement.style.setProperty("--reader-line-spacing-scale", (settings.lineSpacing / 120).toFixed(3));
    saveSettings();
    refreshCustomisePreview();
  }

  function applyCharSpacing(value) {
    settings.charSpacing = Number(value);
    charSpacingSlider.value = String(settings.charSpacing);
    charSpacingValue.textContent = `${settings.charSpacing}%`;
    document.documentElement.style.setProperty("--reader-letter-spacing", `${(settings.charSpacing / 100) * 1.6}px`);
    saveSettings();
    applyTypographyMode();
    refreshCustomisePreview();
  }

  function applyWordSpacing(value) {
    settings.wordSpacing = Number(value);
    wordSpacingSlider.value = String(settings.wordSpacing);
    wordSpacingValue.textContent = `${settings.wordSpacing}%`;
    document.documentElement.style.setProperty("--reader-word-spacing", `${(settings.wordSpacing / 100) * 5.2}px`);
    saveSettings();
    applyTypographyMode();
    refreshCustomisePreview();
  }

  function applyMargins(value) {
    settings.margins = Number(value);
    marginsSlider.value = String(settings.margins);
    marginsValue.textContent = `${settings.margins}%`;
    const widthFactor = clamp(1 - settings.margins * 0.0075, 0.68, 1.05);
    if (window.readerEngine && typeof window.readerEngine.setContentWidthFactor === "function") {
      window.readerEngine.setContentWidthFactor(widthFactor);
    }
    document.documentElement.style.setProperty("--reader-custom-margin", `${settings.margins}px`);
    saveSettings();
  }

  function applyJustifyText(enabled) {
    settings.justifyText = Boolean(enabled);
    justifyToggle.checked = settings.justifyText;
    document.body.classList.toggle("reader-justify-text", settings.justifyText);
    saveSettings();
    applyTypographyMode();
    refreshCustomisePreview();
  }

  function resetCustomiseSettings() {
    applyFontFamily(defaultSettings.fontFamily);
    applyBoldText(defaultSettings.boldText);
    applyCustomiseEnabled(defaultSettings.customiseEnabled);
    applyLineSpacing(defaultSettings.lineSpacing);
    applyCharSpacing(defaultSettings.charSpacing);
    applyWordSpacing(defaultSettings.wordSpacing);
    applyMargins(defaultSettings.margins);
    applyJustifyText(defaultSettings.justifyText);
    showToast("Customise settings reset");
  }

  function applyTypographyMode() {
    const typographyEnabled =
      settings.fontFamily !== "Original" ||
      settings.boldText ||
      settings.customiseEnabled ||
      settings.justifyText ||
      settings.charSpacing > 0 ||
      settings.wordSpacing > 0 ||
      settings.lineSpacing !== 120;

    document.body.classList.toggle("reader-typography-enabled", typographyEnabled);

    const xScale = 1 + settings.charSpacing * 0.0018 + settings.wordSpacing * 0.0012;
    const yScale = settings.lineSpacing / 120;
    document.documentElement.style.setProperty("--reader-text-scale-x", xScale.toFixed(3));
    document.documentElement.style.setProperty("--reader-text-scale-y", yScale.toFixed(3));
  }

  function refreshCustomisePreview() {
    const fontStack = getFontStack(settings.fontFamily);
    customisePreviewAa.style.fontFamily = fontStack;
    customisePreviewText.style.fontFamily = fontStack;
    customisePreviewText.style.fontWeight = settings.boldText ? "700" : "500";
    customisePreviewText.style.letterSpacing = `${(settings.charSpacing / 100) * 1.2}px`;
    customisePreviewText.style.wordSpacing = `${(settings.wordSpacing / 100) * 4}px`;
    customisePreviewText.style.lineHeight = (settings.lineSpacing / 100).toFixed(2);
    customisePreviewText.style.textAlign = settings.justifyText ? "justify" : "left";
  }

  function setHighlightColor(colorId) {
    settings.selectedHighlightColor = colorId;
    highlightColorsEl.querySelectorAll(".reader-highlight-swatch").forEach((button) => {
      button.classList.toggle("active", button.dataset.color === colorId);
    });
    saveSettings();
  }

  function renderHighlightPalette() {
    highlightColorsEl.innerHTML = "";
    for (const color of HIGHLIGHT_COLORS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "reader-highlight-swatch";
      button.dataset.color = color.id;
      button.style.setProperty("--highlight-color", color.value);
      button.innerHTML = `<span>${color.label}</span>`;
      button.addEventListener("click", () => setHighlightColor(color.id));
      highlightColorsEl.appendChild(button);
    }
    setHighlightColor(settings.selectedHighlightColor);
  }

  function syncProgress() {
    const progress = Number(currentState.progress || 0);
    progressLabel.textContent = `Contents - ${progress}%`;
    syncBookmarkState();
    saveReadingProgressNow();
  }

  function syncBookmarkState() {
    const page = Number(currentState.currentPage || 1);
    const isBookmarked = bookmarks.some((bookmark) => bookmark.page === page);
    bookmarkBtn.classList.toggle("active", isBookmarked);
    bookmarkBtn.querySelector(".material-symbols-outlined").textContent = isBookmarked
      ? "bookmark_added"
      : "bookmark";
  }

  function formatDateTime(value) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    } catch {
      return "";
    }
  }

  function renderBookmarksList() {
    bookmarksList.innerHTML = "";
    if (!bookmarks.length) {
      bookmarksList.innerHTML = `<p class="reader-empty-state">No bookmarks yet. Use the bookmark button to save pages.</p>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const bookmark of bookmarks) {
      const page = Number(bookmark.page || 0);
      if (!page) continue;
      const row = document.createElement("div");
      row.className = "reader-bookmark-row";
      row.innerHTML = `
        <button class="reader-bookmark-jump" type="button" data-page="${page}" data-hover-label="Open Bookmarked Page ${page}">
          <span class="reader-bookmark-main">Page ${page}</span>
          <small>${formatDateTime(bookmark.createdAt)}</small>
        </button>
        <button class="reader-bookmark-remove" type="button" data-page="${page}" data-hover-label="Remove Bookmark Page ${page}">
          <span class="material-symbols-outlined">close</span>
        </button>
      `;
      fragment.appendChild(row);
    }
    bookmarksList.appendChild(fragment);
  }

  function toggleBookmark() {
    const page = Number(currentState.currentPage || 1);
    const foundIndex = bookmarks.findIndex((bookmark) => bookmark.page === page);
    if (foundIndex >= 0) {
      bookmarks.splice(foundIndex, 1);
      showToast(`Removed bookmark from page ${page}`);
    } else {
      bookmarks.unshift({
        page,
        createdAt: Date.now(),
      });
      showToast(`Bookmarked page ${page}. Open Bookmarks to view all.`);
    }
    saveBookmarks();
    syncBookmarkState();
    renderBookmarksList();
  }

  function removeBookmark(page) {
    bookmarks = bookmarks.filter((bookmark) => bookmark.page !== page);
    saveBookmarks();
    syncBookmarkState();
    renderBookmarksList();
  }

  function renderNotesList() {
    notesList.innerHTML = "";
    if (!notes.length) {
      notesList.innerHTML = `<p class="reader-empty-state">No notes yet. Write your first note for this book.</p>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    const sorted = [...notes].sort((a, b) => b.createdAt - a.createdAt);

    for (const note of sorted) {
      const page = clamp(Number(note.page || 1), 1, 100000);
      const row = document.createElement("div");
      row.className = "reader-note-row";
      row.innerHTML = `
        <button class="reader-note-jump" type="button" data-id="${note.id}" data-page="${page}">
          <strong>Page ${page}</strong>
          <p>${note.text}</p>
          <small>${formatDateTime(note.createdAt)}</small>
        </button>
        <button class="reader-note-remove" type="button" data-id="${note.id}" aria-label="Delete Note">
          <span class="material-symbols-outlined">delete</span>
        </button>
      `;
      fragment.appendChild(row);
    }

    notesList.appendChild(fragment);
  }

  function addNote(textValue) {
    const text = String(textValue || "").trim();
    if (!text) return;

    notes.unshift({
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: text.slice(0, 2000),
      page: clamp(Number(currentState.currentPage || 1), 1, 100000),
      createdAt: Date.now(),
    });
    saveNotes();
    renderNotesList();
    showToast("Note saved");
  }

  function removeNoteById(noteId) {
    const before = notes.length;
    notes = notes.filter((note) => note.id !== noteId);
    if (notes.length === before) return false;
    saveNotes();
    renderNotesList();
    return true;
  }

  function setScreenLock(locked) {
    document.body.classList.toggle("reader-screen-locked", locked);
    lockBtn.classList.toggle("active", locked);
    unlockBtn.classList.toggle("show", locked);
    lockBtn.querySelector(".material-symbols-outlined").textContent = locked ? "lock_open" : "lock";
    showToast(locked ? "Screen locked" : "Screen unlocked");
    if (locked) closeAllMenus();
  }

  function scheduleSearchRetry() {
    if (searchRetryTimer) clearTimeout(searchRetryTimer);
    searchRetryTimer = setTimeout(() => {
      searchRetryTimer = null;
      if (activePopover === "search" && searchInput.value.trim().length >= 2) {
        runSearch();
      }
    }, 700);
  }

  function primeSearchIndex() {
    if (hasPrimedSearchIndex) return;
    if (!window.readerEngine || typeof window.readerEngine.ensureSearchIndex !== "function") return;
    const state = typeof window.readerEngine.getState === "function" ? window.readerEngine.getState() : null;
    if (!state || Number(state.totalPages || 0) === 0) return;
    hasPrimedSearchIndex = true;
    window.readerEngine.ensureSearchIndex().catch(() => {
      hasPrimedSearchIndex = false;
    });
  }

  async function runSearch() {
    const query = searchInput.value.trim();
    if (query.length < 2) {
      searchStatus.textContent = "Enter at least 2 characters.";
      searchResults.innerHTML = "";
      return;
    }

    if (!window.readerEngine || typeof window.readerEngine.searchDocument !== "function") {
      searchStatus.textContent = "Search is still loading...";
      return;
    }

    if (
      typeof window.readerEngine.getState === "function" &&
      Number(window.readerEngine.getState().totalPages || 0) === 0
    ) {
      searchStatus.textContent = "Document is still loading. Please wait...";
      searchResults.innerHTML = "";
      scheduleSearchRetry();
      return;
    }

    const activeRunId = ++searchRunId;
    searchStatus.textContent = "Searching...";
    searchResults.innerHTML = "";

    try {
      const results = await window.readerEngine.searchDocument(query, 60);
      if (activeRunId !== searchRunId) return;

      if (!results.length) {
        searchStatus.textContent = "No matching text found.";
        return;
      }

      const readableLimit = Number(currentState.readablePages || currentState.totalPages || 0);
      searchStatus.textContent = `${results.length} result${results.length === 1 ? "" : "s"} found`;

      const fragment = document.createDocumentFragment();
      for (const result of results) {
        const isLockedPage = readableLimit > 0 && result.page > readableLimit;
        const item = document.createElement("button");
        item.type = "button";
        item.className = "reader-search-item";
        item.dataset.hoverLabel = `Search Result Page ${result.page}`;
        if (isLockedPage) item.classList.add("locked");
        item.innerHTML = `
          <div>
            <strong>Page ${result.page}</strong>
            <p>${result.snippet || "Matching text found."}</p>
          </div>
          <span>${result.count}x</span>
        `;

        item.addEventListener("click", () => {
          if (isLockedPage) {
            showToast("Sign in to access this page");
            return;
          }
          if (window.readerEngine && typeof window.readerEngine.goToPage === "function") {
            window.readerEngine.goToPage(result.page);
          }
          closeAllMenus();
        });

        fragment.appendChild(item);
      }
      searchResults.appendChild(fragment);
    } catch (error) {
      console.error("Search error:", error);
      if (activeRunId !== searchRunId) return;
      searchStatus.textContent = "Search failed. Please try again.";
    }
  }

  function renderHighlightLibrary() {
    highlightLibrary.innerHTML = "";
    if (!highlights.length) {
      highlightLibrary.innerHTML = `<p class="reader-empty-state">No highlights yet. Select text in the PDF and click "Highlight Selection".</p>`;
      return;
    }

    const sorted = [...highlights].sort((a, b) => a.page - b.page || a.createdAt - b.createdAt);
    const fragment = document.createDocumentFragment();

    for (const item of sorted.slice(-80).reverse()) {
      const row = document.createElement("div");
      row.className = "reader-highlight-row";
      row.innerHTML = `
        <button class="reader-highlight-jump" type="button" data-id="${item.id}" data-page="${item.page}" data-hover-label="Open Highlight Page ${item.page}">
          <span class="reader-highlight-chip" style="background:${getHighlightColorValue(item.color)}"></span>
          <div>
            <strong>Page ${item.page}</strong>
            <p>${item.quote || "Highlighted content"}</p>
          </div>
        </button>
        <button class="reader-highlight-remove" type="button" data-id="${item.id}" data-hover-label="Remove Highlight">
          <span class="material-symbols-outlined">close</span>
        </button>
      `;
      fragment.appendChild(row);
    }
    highlightLibrary.appendChild(fragment);
  }

  function renderHighlightsForPage(pageNumber) {
    const wrapper = document.getElementById(`page-wrapper-${pageNumber}`);
    if (!wrapper) return;
    const layer = wrapper.querySelector(".pdf-highlight-layer");
    if (!layer) return;

    layer.innerHTML = "";
    const pageHighlights = highlights.filter((highlight) => highlight.page === pageNumber);
    for (const highlight of pageHighlights) {
      for (const rect of highlight.rects) {
        const mark = document.createElement("span");
        mark.className = "pdf-highlight-mark";
        mark.dataset.highlightId = highlight.id;
        mark.dataset.page = String(pageNumber);
        mark.dataset.color = highlight.color;
        mark.style.left = `${rect.x * 100}%`;
        mark.style.top = `${rect.y * 100}%`;
        mark.style.width = `${rect.w * 100}%`;
        mark.style.height = `${rect.h * 100}%`;
        mark.style.setProperty("--highlight-color", getHighlightColorValue(highlight.color));
        layer.appendChild(mark);
      }
    }
  }

  function renderAllHighlights() {
    const wrappers = document.querySelectorAll(".pdf-page-wrapper");
    wrappers.forEach((wrapper) => {
      const page = Number(wrapper.dataset.pageNumber || 0);
      if (page > 0) renderHighlightsForPage(page);
    });
  }

  function removeHighlightById(highlightId) {
    const before = highlights.length;
    highlights = highlights.filter((highlight) => highlight.id !== highlightId);
    if (highlights.length === before) return false;
    saveHighlights();
    renderAllHighlights();
    renderHighlightLibrary();
    return true;
  }

  function clearPageHighlights() {
    const page = Number(currentState.currentPage || 1);
    const before = highlights.length;
    highlights = highlights.filter((highlight) => highlight.page !== page);
    if (before === highlights.length) {
      showToast("No highlights on this page");
      return;
    }
    saveHighlights();
    renderHighlightsForPage(page);
    renderHighlightLibrary();
    showToast(`Cleared highlights on page ${page}`);
  }

  function clearAllHighlights() {
    if (!highlights.length) {
      showToast("No highlights to clear");
      return;
    }
    highlights = [];
    saveHighlights();
    renderAllHighlights();
    renderHighlightLibrary();
    showToast("All highlights cleared");
  }

  function beginDrawHighlight(event) {
    if (activePopover !== "highlighting") return;
    if (drawSession) return;
    if (event.target.closest("#reader-controls-shell")) return;
    if (event.button !== 0) return;

    // Prioritize native text selection for precision.
    // Area-draw highlight starts only outside text, or when Alt is held.
    if (!event.altKey && event.target.closest(".pdf-text-layer")) {
      pendingDrawHighlight = null;
      return;
    }

    let wrapper = event.target.closest(".pdf-page-wrapper");
    if (!wrapper && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      const pointTarget = document.elementFromPoint(event.clientX, event.clientY);
      if (pointTarget) wrapper = pointTarget.closest(".pdf-page-wrapper");
    }
    if (!wrapper) return;
    const layer = wrapper.querySelector(".pdf-highlight-layer");
    if (!layer) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const page = Number(wrapper.dataset.pageNumber || 0);
    if (!page || wrapperRect.width <= 1 || wrapperRect.height <= 1) return;

    const startX = clamp((event.clientX - wrapperRect.left) / wrapperRect.width, 0, 1);
    const startY = clamp((event.clientY - wrapperRect.top) / wrapperRect.height, 0, 1);

    const preview = document.createElement("span");
    preview.className = "pdf-highlight-preview";
    preview.style.setProperty("--highlight-color", getHighlightColorValue(settings.selectedHighlightColor));
    preview.style.left = `${startX * 100}%`;
    preview.style.top = `${startY * 100}%`;
    preview.style.width = "0%";
    preview.style.height = "0%";
    preview.dataset.x = String(startX);
    preview.dataset.y = String(startY);
    preview.dataset.w = "0";
    preview.dataset.h = "0";

    layer.appendChild(preview);
    drawSession = { wrapperRect, page, startX, startY, preview };
    pendingDrawHighlight = null;
    event.preventDefault();
  }

  function updateDrawHighlight(event) {
    if (!drawSession) return;
    const { wrapperRect, startX, startY, preview } = drawSession;

    const currentX = clamp((event.clientX - wrapperRect.left) / wrapperRect.width, 0, 1);
    const currentY = clamp((event.clientY - wrapperRect.top) / wrapperRect.height, 0, 1);

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    preview.style.left = `${left * 100}%`;
    preview.style.top = `${top * 100}%`;
    preview.style.width = `${width * 100}%`;
    preview.style.height = `${height * 100}%`;
    preview.dataset.x = String(left);
    preview.dataset.y = String(top);
    preview.dataset.w = String(width);
    preview.dataset.h = String(height);
  }

  function endDrawHighlight(event) {
    if (!drawSession) return;
    const { preview, page, wrapperRect, startX, startY } = drawSession;

    let x = Number(preview.dataset.x || startX || 0);
    let y = Number(preview.dataset.y || startY || 0);
    let w = Number(preview.dataset.w || 0);
    let h = Number(preview.dataset.h || 0);

    if (
      (w < 0.003 || h < 0.003) &&
      event &&
      Number.isFinite(event.clientX) &&
      Number.isFinite(event.clientY) &&
      wrapperRect &&
      wrapperRect.width > 1 &&
      wrapperRect.height > 1
    ) {
      const currentX = clamp((event.clientX - wrapperRect.left) / wrapperRect.width, 0, 1);
      const currentY = clamp((event.clientY - wrapperRect.top) / wrapperRect.height, 0, 1);
      x = Math.min(startX, currentX);
      y = Math.min(startY, currentY);
      w = Math.abs(currentX - startX);
      h = Math.abs(currentY - startY);
    }

    preview.remove();
    drawSession = null;

    if (w < 0.003 || h < 0.003) {
      pendingDrawHighlight = null;
      return;
    }

    pendingDrawHighlight = {
      page,
      rect: { x, y, w, h },
    };
    highlightStatus.textContent = `Area selected on page ${page}. Click "Highlight Selection" to save.`;
    showToast("Highlight area selected");
  }

  function extractSelectionRects() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    if (!selectedText) return null;

    const ancestor =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    if (!ancestor || !ancestor.closest(".pdf-page-wrapper")) return null;

    const rawRects = Array.from(range.getClientRects()).filter((rect) => rect.width > 1.5 && rect.height > 1.5);
    if (!rawRects.length) return null;

    const startAnchor =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer
        : range.startContainer.parentElement;
    const endAnchor =
      range.endContainer.nodeType === Node.ELEMENT_NODE
        ? range.endContainer
        : range.endContainer.parentElement;
    const startWrapper = startAnchor?.closest(".pdf-page-wrapper") || null;
    const endWrapper = endAnchor?.closest(".pdf-page-wrapper") || null;

    const wrappers =
      startWrapper && endWrapper && startWrapper === endWrapper
        ? [startWrapper]
        : Array.from(document.querySelectorAll(".pdf-page-wrapper"));

    const grouped = new Map();
    const seenRects = new Set();

    for (const rect of rawRects) {
      for (const wrapper of wrappers) {
        const page = Number(wrapper.dataset.pageNumber || 0);
        if (!page) continue;
        const wrapperRect = wrapper.getBoundingClientRect();
        const left = Math.max(rect.left, wrapperRect.left);
        const right = Math.min(rect.right, wrapperRect.right);
        const top = Math.max(rect.top, wrapperRect.top);
        const bottom = Math.min(rect.bottom, wrapperRect.bottom);
        const width = right - left;
        const height = bottom - top;

        if (width <= 1 || height <= 1) continue;

        if (!grouped.has(page)) grouped.set(page, []);
        const normalizedRect = {
          x: clamp((left - wrapperRect.left) / wrapperRect.width, 0, 1),
          y: clamp((top - wrapperRect.top) / wrapperRect.height, 0, 1),
          w: clamp(width / wrapperRect.width, 0.001, 1),
          h: clamp(height / wrapperRect.height, 0.001, 1),
        };
        const dedupeKey = [
          page,
          Math.round(normalizedRect.x * 1000),
          Math.round(normalizedRect.y * 1000),
          Math.round(normalizedRect.w * 1000),
          Math.round(normalizedRect.h * 1000),
        ].join(":");
        if (seenRects.has(dedupeKey)) break;
        seenRects.add(dedupeKey);
        grouped.get(page).push(normalizedRect);
        break;
      }
    }

    const groupedEntries = Array.from(grouped.entries()).filter((entry) => entry[1].length > 0);
    if (!groupedEntries.length) return null;

    return { text: selectedText, groupedEntries };
  }

  function applyHighlightSelection() {
    const payload = extractSelectionRects();
    const usePendingArea = !payload && pendingDrawHighlight;
    if (!payload && !usePendingArea) {
      highlightStatus.textContent = "No valid text selection found. Select text first.";
      return;
    }

    const stamp = Date.now();
    const quote = payload ? payload.text.slice(0, 180) : "Area highlight";
    const selectedColor = settings.selectedHighlightColor;

    if (payload) {
      for (const [page, rects] of payload.groupedEntries) {
        highlights.push({
          id: `hl-${stamp}-${page}-${Math.random().toString(36).slice(2, 8)}`,
          page,
          color: selectedColor,
          quote,
          rects,
          createdAt: stamp,
        });
        renderHighlightsForPage(page);
      }
      highlightStatus.textContent = `Saved highlight in ${payload.groupedEntries.length} page(s).`;
    } else if (pendingDrawHighlight) {
      highlights.push({
        id: `hl-${stamp}-${pendingDrawHighlight.page}-${Math.random().toString(36).slice(2, 8)}`,
        page: pendingDrawHighlight.page,
        color: selectedColor,
        quote,
        rects: [pendingDrawHighlight.rect],
        createdAt: stamp,
      });
      renderHighlightsForPage(pendingDrawHighlight.page);
      highlightStatus.textContent = `Saved area highlight on page ${pendingDrawHighlight.page}.`;
      pendingDrawHighlight = null;
    }

    saveHighlights();
    renderHighlightLibrary();
    window.getSelection()?.removeAllRanges();
    showToast("Highlight saved");
  }

  function refreshFontOptions() {
    fontOptionsEl.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button.dataset.font === settings.fontFamily);
      button.querySelector(".material-symbols-outlined").style.opacity =
        button.dataset.font === settings.fontFamily ? "1" : "0";
    });
  }

  function buildFontOptions() {
    const fragment = document.createDocumentFragment();
    for (const option of FONT_OPTIONS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "reader-font-option";
      button.dataset.font = option.id;
      button.dataset.hoverLabel = option.id;
      button.innerHTML = `
        <span>${option.id}</span>
        <span class="material-symbols-outlined">check</span>
      `;
      button.addEventListener("click", () => {
        applyFontFamily(option.id);
        fontOptionsEl.classList.remove("open");
      });
      fragment.appendChild(button);
    }
    fontOptionsEl.innerHTML = "";
    fontOptionsEl.appendChild(fragment);
    refreshFontOptions();
  }

  function toggleFontList() {
    fontOptionsEl.classList.toggle("open");
  }

  quickBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const nextOpen = !isQuickOpen;
    setQuickOpen(nextOpen);
    if (nextOpen) {
      setActivePopover(null);
      setThemeOpen(false);
      setCustomiseOpen(false);
    }
  });

  quickFab.addEventListener("click", (event) => {
    event.stopPropagation();
    const nextOpen = !isQuickOpen;
    setQuickOpen(nextOpen);
    if (nextOpen) {
      setActivePopover(null);
      setThemeOpen(false);
      setCustomiseOpen(false);
    }
  });

  closeQuickSheetBtn.addEventListener("click", () => {
    setQuickOpen(false);
  });

  openContentsBtn.addEventListener("click", () => {
    if (pdfSidebar && pdfSidebar.classList.contains("collapsed") && showSidebarBtn) {
      showSidebarBtn.click();
    }
    if (tabChapters) tabChapters.click();
    closeAllMenus();
  });

  openSearchBtn.addEventListener("click", () => {
    setActivePopover("search");
    searchInput.focus();
  });

  openBookmarksBtn.addEventListener("click", () => {
    renderBookmarksList();
    setActivePopover("bookmarks");
  });

  openNotesBtn.addEventListener("click", () => {
    renderNotesList();
    setQuickOpen(false);
    setActivePopover("notes");
    notesInput.focus();
  });

  closeSearchBtn.addEventListener("click", () => setActivePopover(null));
  closeBookmarksBtn.addEventListener("click", () => setActivePopover(null));
  closeNotesBtn.addEventListener("click", () => setActivePopover(null));
  closeHighlightingBtn.addEventListener("click", () => setActivePopover(null));

  openThemeBtn.addEventListener("click", () => {
    setQuickOpen(false);
    setActivePopover(null);
    setThemeOpen(true);
  });

  closeThemeBtn.addEventListener("click", () => setThemeOpen(false));

  searchInput.addEventListener("input", () => {
    runSearch();
  });

  lockBtn.addEventListener("click", () => {
    setScreenLock(!document.body.classList.contains("reader-screen-locked"));
  });

  unlockBtn.addEventListener("click", () => setScreenLock(false));

  bookmarkBtn.addEventListener("click", () => {
    toggleBookmark();
  });

  highlightBtn.addEventListener("click", () => {
    const openingHighlight = activePopover !== "highlighting";
    setActivePopover(openingHighlight ? "highlighting" : null);
    if (openingHighlight) {
      setQuickOpen(false);
      highlightStatus.textContent = 'Select text, then click "Highlight Selection". (Alt+drag for area highlight.)';
    }
    renderHighlightLibrary();
  });

  notesInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    const value = notesInput.value;
    if (!value.trim()) return;
    addNote(value);
    notesInput.value = "";
  });

  applyHighlightBtn.addEventListener("click", () => {
    applyHighlightSelection();
  });

  clearPageHighlightsBtn.addEventListener("click", () => {
    clearPageHighlights();
  });

  clearAllHighlightsBtn.addEventListener("click", () => {
    clearAllHighlights();
  });

  bookmarksList.addEventListener("click", (event) => {
    const jumpBtn = event.target.closest(".reader-bookmark-jump");
    if (jumpBtn) {
      const page = Number(jumpBtn.dataset.page || 0);
      if (page > 0 && window.readerEngine && typeof window.readerEngine.goToPage === "function") {
        window.readerEngine.goToPage(page);
      }
      closeAllMenus();
      return;
    }

    const removeBtn = event.target.closest(".reader-bookmark-remove");
    if (removeBtn) {
      const page = Number(removeBtn.dataset.page || 0);
      if (page > 0) {
        removeBookmark(page);
        showToast(`Removed bookmark from page ${page}`);
      }
    }
  });

  highlightLibrary.addEventListener("click", (event) => {
    const jumpBtn = event.target.closest(".reader-highlight-jump");
    if (jumpBtn) {
      const page = Number(jumpBtn.dataset.page || 0);
      if (page > 0 && window.readerEngine && typeof window.readerEngine.goToPage === "function") {
        window.readerEngine.goToPage(page);
      }
      closeAllMenus();
      return;
    }

    const removeBtn = event.target.closest(".reader-highlight-remove");
    if (removeBtn) {
      const id = removeBtn.dataset.id;
      if (id && removeHighlightById(id)) {
        showToast("Highlight removed");
      }
    }
  });

  notesList.addEventListener("click", (event) => {
    const jumpBtn = event.target.closest(".reader-note-jump");
    if (jumpBtn) {
      const page = Number(jumpBtn.dataset.page || 0);
      if (page > 0 && window.readerEngine && typeof window.readerEngine.goToPage === "function") {
        window.readerEngine.goToPage(page);
      }
      closeAllMenus();
      return;
    }

    const removeBtn = event.target.closest(".reader-note-remove");
    if (removeBtn) {
      const id = removeBtn.dataset.id;
      if (id && removeNoteById(id)) {
        showToast("Note deleted");
      }
    }
  });

  if (pdfPageContainer) {
    pdfPageContainer.addEventListener("pointerdown", beginDrawHighlight);
    pdfPageContainer.addEventListener("mousedown", beginDrawHighlight);
    window.addEventListener("pointermove", updateDrawHighlight);
    window.addEventListener("mousemove", updateDrawHighlight);
    window.addEventListener("pointerup", endDrawHighlight);
    window.addEventListener("mouseup", endDrawHighlight);
    window.addEventListener("pointercancel", endDrawHighlight);
  }

  fontSmallerBtn.addEventListener("click", () => {
    if (settings.useDefaultAppearance) {
      showToast("Turn off Default to customize appearance");
      return;
    }
    if (window.readerEngine && typeof window.readerEngine.adjustScale === "function") {
      window.readerEngine.adjustScale(-0.1);
      showToast("Smaller page scale");
    }
  });

  fontLargerBtn.addEventListener("click", () => {
    if (settings.useDefaultAppearance) {
      showToast("Turn off Default to customize appearance");
      return;
    }
    if (window.readerEngine && typeof window.readerEngine.adjustScale === "function") {
      window.readerEngine.adjustScale(0.1);
      showToast("Larger page scale");
    }
  });

  layoutToggleBtn.addEventListener("click", () => {
    if (settings.useDefaultAppearance) {
      showToast("Turn off Default to customize appearance");
      return;
    }
    applyLayout(!settings.compactLayout);
    showToast(settings.compactLayout ? "Compact layout enabled" : "Standard layout enabled");
  });

  contrastToggleBtn.addEventListener("click", () => {
    if (settings.useDefaultAppearance) {
      showToast("Turn off Default to customize appearance");
      return;
    }
    applyContrast(!settings.highContrast);
    showToast(settings.highContrast ? "High contrast enabled" : "High contrast disabled");
  });

  brightnessSlider.addEventListener("input", () => {
    if (settings.useDefaultAppearance) {
      brightnessSlider.value = String(defaultSettings.brightness);
      return;
    }
    applyBrightness(brightnessSlider.value);
  });

  themeGrid.addEventListener("click", (event) => {
    if (settings.useDefaultAppearance) {
      showToast("Turn off Default to customize appearance");
      return;
    }
    const card = event.target.closest(".reader-theme-card");
    if (!card) return;
    applyTheme(card.dataset.theme);
    showToast(`${card.dataset.theme[0].toUpperCase()}${card.dataset.theme.slice(1)} theme`);
  });

  openCustomiseBtn.addEventListener("click", () => {
    setThemeOpen(false);
    setCustomiseOpen(true);
  });

  customiseCloseBtn.addEventListener("click", () => setCustomiseOpen(false));
  customiseDoneBtn.addEventListener("click", () => {
    setCustomiseOpen(false);
    showToast("Customise theme applied");
  });

  fontPickerBtn.addEventListener("click", () => toggleFontList());
  boldToggle.addEventListener("change", () => applyBoldText(boldToggle.checked));
  defaultToggle.addEventListener("change", () => setDefaultAppearance(defaultToggle.checked));
  layoutCustomiseToggle.addEventListener("change", () => applyCustomiseEnabled(layoutCustomiseToggle.checked));
  justifyToggle.addEventListener("change", () => applyJustifyText(justifyToggle.checked));
  lineSpacingSlider.addEventListener("input", () => applyLineSpacing(lineSpacingSlider.value));
  charSpacingSlider.addEventListener("input", () => applyCharSpacing(charSpacingSlider.value));
  wordSpacingSlider.addEventListener("input", () => applyWordSpacing(wordSpacingSlider.value));
  marginsSlider.addEventListener("input", () => applyMargins(marginsSlider.value));
  resetCustomiseBtn.addEventListener("click", () => resetCustomiseSettings());

  quickBackdrop.addEventListener("click", () => {
    closeAllMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllMenus();
  });

  window.addEventListener("beforeunload", () => {
    saveReadingProgressNow();
  });

  window.addEventListener("pagehide", () => {
    saveReadingProgressNow();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      saveReadingProgressNow();
    }
  });

  document.addEventListener("click", (event) => {
    if (activePopover === "highlighting") {
      return;
    }
    const insideControls = controlsShell.contains(event.target);
    const clickedQuickTrigger = event.target.closest("#reader-quick-btn");
    if (!insideControls && !clickedQuickTrigger) {
      closeAllMenus();
    }
  });

  document.addEventListener("reader:state", (event) => {
    currentState = { ...currentState, ...event.detail };
    syncProgress();
    primeSearchIndex();
  });

  document.addEventListener("reader:pages-rebuilt", () => {
    renderAllHighlights();
  });

  document.addEventListener("reader:page-rendered", (event) => {
    const page = Number(event?.detail?.page || 0);
    if (page > 0) renderHighlightsForPage(page);
  });

  if (window.readerEngine && typeof window.readerEngine.getState === "function") {
    currentState = { ...currentState, ...window.readerEngine.getState() };
  }

  buildFontOptions();
  renderHighlightPalette();
  renderBookmarksList();
  renderHighlightLibrary();
  renderNotesList();
  disableHoverLabelsAndTitles();

  if (settings.useDefaultAppearance) {
    applyAppearanceSnapshot(defaultSettings);
  } else {
    applyAppearanceSnapshot(settings);
  }
  refreshDefaultAppearanceUI();

  syncProgress();
  primeSearchIndex();
  renderAllHighlights();
})();

} catch(e) { console.error('READER CONTROLS CRASH: ', e.stack); window._READER_ERROR = e.stack; }
