// =========================================
// PREMIUM AI SIDEBAR INJECTOR
// =========================================

(function() {
    const AI_FALLBACK_MESSAGE = "Not Working";

    if (!document.querySelector('link[href*="ai-sidebar.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
  link.href = 'assets/css/ai-sidebar.css?v=14';
        document.head.appendChild(link);
    }

    if (!document.querySelector('link[href*="Material+Symbols"]')) {
        const preconnect1 = document.createElement('link');
        preconnect1.rel = 'preconnect';
        preconnect1.href = 'https://fonts.googleapis.com';
        document.head.appendChild(preconnect1);
        
        const preconnect2 = document.createElement('link');
        preconnect2.rel = 'preconnect';
        preconnect2.href = 'https://fonts.gstatic.com';
        preconnect2.crossOrigin = '';
        document.head.appendChild(preconnect2);

        const iconLink = document.createElement('link');
        iconLink.rel = 'stylesheet';
        iconLink.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
        document.head.appendChild(iconLink);
    }
    
    if (!document.querySelector('link[href*="Google+Sans"]')) {
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;800&family=Source+Serif+4:wght@500;600;700&display=swap';
        document.head.appendChild(fontLink);
    }

    if (typeof marked === 'undefined' && !document.querySelector('script[src*="marked.min.js"]')) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
        document.head.appendChild(script);
    }

    if (typeof DOMPurify === 'undefined' && !document.querySelector('script[src*="purify.min.js"]')) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/dompurify@3.2.7/dist/purify.min.js';
        document.head.appendChild(script);
    }

    const aiHtmlString = "    <!-- START OF PREMIUM AI SIDEBAR -->\n    <!-- Floating AI Button (Bottom Right) -->\n    <button id=\"ai-chat-btn\" class=\"ai-chat-btn\">AI</button>\n\n    <!-- The Right Sidebar Panel -->\n    <div id=\"ai-sidebar\" class=\"ai-sidebar\">\n      <!-- Clean Close Button & History Menu inside the sidebar -->\n      <div\n        class=\"ai-sidebar-top\"\n        style=\"\n          display: flex;\n          justify-content: space-between;\n          align-items: center;\n        \"\n      >\n        <button id=\"ai-close-btn\" class=\"ai-icon-btn\">\n          <span class=\"material-symbols-outlined\">arrow_forward</span>\n        </button>\n\n        <!-- Three Dots History Menu -->\n        <div style=\"position: relative\">\n          <button id=\"ai-history-btn\" class=\"ai-icon-btn\" title=\"Chat History\">\n            <span class=\"material-symbols-outlined\">more_vert</span>\n          </button>\n\n          <!-- The History Dropdown Popup -->\n          <div\n            id=\"ai-history-dropdown\"\n            class=\"ai-history-dropdown hidden-dropdown\"\n          >\n            <div class=\"history-dropdown-header\">Interaction History</div>\n            <div id=\"ai-history-list\" class=\"history-list-container\">\n              <!-- History items will appear here -->\n            </div>\n          </div>\n        </div>\n      </div>\n      <!-- Chat History Area (No Header) -->\n      <div id=\"ai-chat-body\" class=\"ai-chat-body\">\n        <!-- Messages will appear here -->\n      </div>\n\n      <!-- The Sophisticated Perplexity-Style Search Bar -->\n      <!-- The Sophisticated Perplexity-Style Search Bar -->\n      <div class=\"ai-input-container\">\n        <div class=\"ai-input-box\">\n          <!-- Top half: Text Input -->\n          <div class=\"ai-input-top\">\n            <!-- START OF FILE DISPLAY AREA -->\n            <div\n              id=\"file-preview-container\"\n              class=\"file-preview-container\"\n            ></div>\n            <!-- END OF FILE DISPLAY AREA -->\n            <input\n              type=\"text\"\n              id=\"ai-chat-input\"\n              placeholder=\"Type / for search modes and shortcuts\"\n              autocomplete=\"off\"\n            />\n          </div>\n\n          <!-- Bottom half: Buttons -->\n          <div class=\"ai-input-bottom\">\n            <!-- START OF NEW UPLOAD CONTAINER -->\n            <div class=\"upload-container\">\n              <!-- The Plus Button -->\n              <!-- The Plus Button -->\n              <button\n                id=\"ai-plus-btn\"\n                class=\"action-btn\"\n                type=\"button\"\n                title=\"Attach file\"\n                style=\"\n                  background: transparent;\n                  border: none;\n                  cursor: pointer;\n                  display: flex;\n                  align-items: center;\n                  justify-content: center;\n                  padding: 4px;\n                \"\n              >\n                <span\n                  class=\"material-symbols-outlined\"\n                  style=\"font-size: 22px; color: #a0a0a0\"\n                  >add</span\n                >\n              </button>\n\n              <!-- New Chat Button & Hover Popup -->\n              <div\n                style=\"position: relative; display: flex; align-items: center\"\n              >\n                <button\n                  id=\"ai-new-chat-btn\"\n                  class=\"action-btn\"\n                  type=\"button\"\n                  style=\"\n                    background: transparent;\n                    border: none;\n                    cursor: pointer;\n                    display: flex;\n                    align-items: center;\n                    justify-content: center;\n                    padding: 4px;\n                    margin-left: 4px;\n                  \"\n                >\n                  <span\n                    class=\"material-symbols-outlined\"\n                    style=\"\n                      font-size: 22px;\n                      color: #a0a0a0;\n                      transition: color 0.2s;\n                    \"\n                    >edit_square</span\n                  >\n                </button>\n\n                <!-- The Pill-Shaped Hover Popup -->\n                <div class=\"new-chat-tooltip\">\n                  <span\n                    class=\"material-symbols-outlined\"\n                    style=\"font-size: 18px\"\n                    >edit_square</span\n                  >\n                  New chat\n                </div>\n              </div>\n\n              <!-- The Hidden Popup Menu -->\n              <div id=\"ai-upload-popup\" class=\"upload-popup\">\n                <button\n                  id=\"ai-upload-device-btn\"\n                  class=\"popup-item\"\n                  type=\"button\"\n                >\n                  <svg\n                    width=\"16\"\n                    height=\"16\"\n                    viewBox=\"0 0 24 24\"\n                    fill=\"none\"\n                    stroke=\"currentColor\"\n                    stroke-width=\"2\"\n                    stroke-linecap=\"round\"\n                    stroke-linejoin=\"round\"\n                  >\n                    <path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path>\n                    <polyline points=\"17 8 12 3 7 8\"></polyline>\n                    <line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"15\"></line>\n                  </svg>\n                  Upload from device\n                </button>\n              </div>\n\n              <!-- The Hidden File Input (This actually opens the computer folder) -->\n              <input\n                type=\"file\"\n                id=\"ai-file-input\"\n                style=\"display: none\"\n                multiple\n              />\n            </div>\n            <!-- END OF NEW UPLOAD CONTAINER -->\n\n            <!-- Right side: Model, Mic, and Send -->\n            <!-- Right side: Dynamic Royal Send Button -->\n            <div class=\"ai-input-actions\">\n              <button\n                id=\"ai-send-btn\"\n                class=\"royal-send-btn hidden-send\"\n                type=\"button\"\n                title=\"Send message\"\n              >\n                <span class=\"material-symbols-outlined\">send</span>\n              </button>\n            </div>\n          </div>\n        </div>\n      </div>\n    </div>\n    <!-- END OF PREMIUM AI SIDEBAR -->\n";
    const aiContainer = document.createElement('div');
    aiContainer.innerHTML = aiHtmlString;
    while(aiContainer.firstChild) {
        document.body.appendChild(aiContainer.firstChild);
    }

    // Now execute the extracted logic:
// =========================================
// PREMIUM AI SIDEBAR FUNCTIONALITY
// =========================================

document.addEventListener("DOMContentLoaded", () => {
  const aiChatBtn = document.getElementById("ai-chat-btn");
  const aiSidebar = document.getElementById("ai-sidebar");
  const aiCloseBtn = document.getElementById("ai-close-btn");
  const aiChatBody = document.getElementById("ai-chat-body");
  const aiChatInput = document.getElementById("ai-chat-input");
  const aiSendBtn = document.getElementById("ai-send-btn");
  const PUBLIC_AI_FAILURE_MESSAGE = AI_FALLBACK_MESSAGE;
  const AI_REQUEST_TIMEOUT_MS = 45000;
  const backendBaseUrl = resolveBackendBaseUrl();
  let aiLibraryContextCache = { fetchedAt: 0, books: [] };
  let aiConversationContext = [];
  const AI_LIBRARY_SUGGESTIONS = [
    {
      icon: "auto_stories",
      title: "Find my next read",
      prompt: "Recommend 5 books from this library for someone who likes mystery, classics, and short chapters.",
    },
    {
      icon: "psychology",
      title: "Explain simply",
      prompt: "Explain this topic in simple words and give me a beginner-friendly reading path.",
    },
    {
      icon: "quiz",
      title: "Create quiz",
      prompt: "Create 10 practice questions from the book or topic I am studying.",
    },
    {
      icon: "summarize",
      title: "Summarize",
      prompt: "Summarize the key ideas and give me the most important points to remember.",
    },
  ];

  if (!aiChatBtn || !aiSidebar) return; // Safety check

  function resolveBackendBaseUrl() {
    const configured = String(
      window.PDF_LIBRARY_CONFIG?.API_ORIGIN ||
        window.PDF_LIBRARY_API_BASE_URL ||
        "",
    ).trim();
    if (configured) {
      return configured.replace(/\/+$/, "");
    }

    const host = String(window.location.hostname || "").toLowerCase();
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    return isLocalhost
      ? `${window.location.protocol}//${window.location.hostname}:3000`
      : String(window.location.origin || "").replace(/\/+$/, "");
  }

  function updateSendButtonVisibility() {
    if (!aiSendBtn) return;
    const hasText = Boolean(aiChatInput && aiChatInput.value.trim().length > 0);
    const hasFiles = Array.isArray(window.attachedFiles) && window.attachedFiles.length > 0;
    aiSendBtn.classList.toggle("hidden-send", !(hasText || hasFiles));
  }

  function renderAiStartScreen() {
    if (!aiChatBody || aiChatBody.querySelector("#ai-empty-state")) return;

    aiChatBody.classList.remove("has-messages");
    const emptyState = document.createElement("section");
    emptyState.id = "ai-empty-state";
    emptyState.className = "ai-empty-state";
    emptyState.innerHTML = `
      <div class="ai-empty-orb" aria-hidden="true">
        <span class="material-symbols-outlined">local_library</span>
      </div>
      <p class="ai-empty-kicker">Smart Library Help</p>
      <h2>Ask for summaries, book ideas, or study help.</h2>
      <div class="ai-suggestion-grid">
        ${AI_LIBRARY_SUGGESTIONS.map((item) => `
          <button class="ai-suggestion-card" type="button" data-prompt="${escapeHtmlAttribute(item.prompt)}">
            <span class="material-symbols-outlined" aria-hidden="true">${item.icon}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.prompt)}</small>
          </button>
        `).join("")}
      </div>
      <div class="ai-capability-strip" aria-label="Assistant capabilities">
        <span>PDF help</span>
        <span>EPUB help</span>
        <span>Book search</span>
        <span>Study notes</span>
      </div>
    `;

    emptyState.querySelectorAll(".ai-suggestion-card").forEach((button) => {
      button.addEventListener("click", () => {
        const prompt = button.getAttribute("data-prompt") || "";
        if (aiChatInput) {
          aiChatInput.value = prompt;
          aiChatInput.focus();
        }
        updateSendButtonVisibility();
      });
    });

    aiChatBody.appendChild(emptyState);
  }

  function hideAiStartScreen() {
    if (!aiChatBody) return;
    const emptyState = aiChatBody.querySelector("#ai-empty-state");
    if (emptyState) emptyState.remove();
    aiChatBody.classList.add("has-messages");
  }

  function resetAiConversationShell() {
    aiConversationContext = [];
    if (aiChatBody) {
      aiChatBody.innerHTML = "";
      aiChatBody.classList.remove("has-messages");
      renderAiStartScreen();
    }
    if (aiChatInput) {
      aiChatInput.value = "";
      aiChatInput.focus();
    }
    window.attachedFiles = [];
    if (typeof window.renderFilePreviews === "function") {
      window.renderFilePreviews();
    }
    updateSendButtonVisibility();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeHtmlAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function safeParseJson(value, fallback) {
    try {
      const parsed = JSON.parse(String(value || ""));
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function normalizeAiText(value, limit = 240) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
  }

  function normalizeSearchText(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\b(the|a|an|book|novel|pdf|epub|about|tell|me|this|tha|ke|ki|ka|hai|is|in|library)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compactTitleFromCard(card) {
    if (!card) return "";
    const imgAlt = card.querySelector("img")?.getAttribute("alt") || "";
    const raw =
      card.dataset?.title ||
      card.dataset?.bookTitle ||
      card.getAttribute("data-title") ||
      card.getAttribute("aria-label") ||
      card.querySelector(".pdf-title, .book-title, .my-list-title, strong, h3")?.textContent ||
      imgAlt ||
      card.textContent ||
      "";

    return normalizeAiText(
      String(raw)
        .replace(/\b(open|start reading|cover|premium)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim(),
      160,
    );
  }

  function scoreBookForPrompt(promptText, book) {
    const prompt = normalizeSearchText(promptText);
    const title = normalizeSearchText(book?.title);
    if (!prompt || !title) return 0;
    if (prompt === title || prompt.includes(title)) return 100;
    if (title.includes(prompt) && prompt.length > 3) return 85;

    const titleWords = title.split(" ").filter((word) => word.length > 2);
    if (titleWords.length === 0) return 0;
    const matchedWords = titleWords.filter((word) => prompt.includes(word));
    const ratio = matchedWords.length / titleWords.length;
    const strongWordBonus = matchedWords.some((word) => word.length >= 7) ? 12 : 0;
    return Math.round(ratio * 70 + strongWordBonus);
  }

  function findBestLibraryMatch(title, libraryBooks) {
    const query = normalizeSearchText(title);
    if (!query || !Array.isArray(libraryBooks)) return null;

    let best = null;
    let bestScore = 0;
    libraryBooks.forEach((book) => {
      const score = scoreBookForPrompt(query, book);
      if (score > bestScore) {
        best = book;
        bestScore = score;
      }
    });

    return bestScore >= 42 ? best : null;
  }

  function selectPromptMatchedBooks(prompt, books) {
    if (!Array.isArray(books) || books.length === 0) return [];
    return books
      .map((book) => ({
        book,
        score: scoreBookForPrompt(prompt, book),
      }))
      .filter((entry) => entry.score >= 35)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((entry) => ({
        ...entry.book,
        matchScore: entry.score,
      }));
  }

  function collectConversationContext() {
    return aiConversationContext.slice(-10).map((turn) => ({
      role: turn.role,
      text: normalizeAiText(turn.text, 1400),
    }));
  }

  function rememberConversationTurn(role, text) {
    const normalizedRole = role === "assistant" ? "assistant" : "user";
    const normalizedText = normalizeAiText(text, 1800);
    if (!normalizedText) return;
    aiConversationContext.push({
      role: normalizedRole,
      text: normalizedText,
    });
    if (aiConversationContext.length > 20) {
      aiConversationContext = aiConversationContext.slice(-20);
    }
  }

  window.setAiConversationContext = function (turns) {
    aiConversationContext = [];
    if (!Array.isArray(turns)) return;
    turns.forEach((turn) => {
      rememberConversationTurn(turn?.role, turn?.text);
    });
  };

  function setAiSidebarMode(isOpen) {
    document.body.classList.toggle("ai-sidebar-open", Boolean(isOpen));

    const siteSidebar = document.getElementById("sidebar");
    const siteSidebarOverlay = document.getElementById("sidebar-overlay");
    const pdfSidebar = document.getElementById("pdf-sidebar");
    const showSidebarBtn = document.getElementById("show-sidebar-btn");
    const epubChaptersPanel = document.getElementById("epub-chapters-panel");
    const epubChaptersBtn = document.getElementById("epub-chapters-btn");

    if (isOpen) {
      document.body.classList.remove("book-sidebar-open");
      siteSidebar?.classList.remove("active");
      siteSidebarOverlay?.classList.remove("active");
      epubChaptersPanel?.classList.remove("open");
      epubChaptersBtn?.setAttribute("aria-expanded", "false");

      if (pdfSidebar && !pdfSidebar.dataset.aiPreviousCollapsed) {
        pdfSidebar.dataset.aiPreviousCollapsed = pdfSidebar.classList.contains("collapsed")
          ? "true"
          : "false";
      }
      pdfSidebar?.classList.add("collapsed");
      showSidebarBtn?.classList.add("hidden");
      return;
    }

    if (pdfSidebar && pdfSidebar.dataset.aiPreviousCollapsed) {
      const wasCollapsed = pdfSidebar.dataset.aiPreviousCollapsed === "true";
      pdfSidebar.classList.toggle("collapsed", wasCollapsed);
      if (showSidebarBtn) {
        showSidebarBtn.classList.toggle("hidden", !wasCollapsed);
      }
      document.body.classList.toggle("book-sidebar-open", !wasCollapsed);
      delete pdfSidebar.dataset.aiPreviousCollapsed;
    }
  }

  window.closeAiSidebarForBookPanel = function () {
    aiSidebar.classList.remove("active");
    setAiSidebarMode(false);
  };

  function getQueryParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || "";
    } catch {
      return "";
    }
  }

  function simplifyBookForAi(book) {
    if (!book || typeof book !== "object") return null;
    const title = normalizeAiText(book.title, 160);
    if (!title) return null;

    const format = book.has_epub || book.epub_drive_id ? "EPUB" : "PDF";
    return {
      id: book.id ?? null,
      title,
      searchTitle: normalizeSearchText(title),
      author: normalizeAiText(book.author || book.creator || "Unknown Author", 120),
      category: normalizeAiText(book.category || book.genre || "Book", 80),
      format,
      hasPdf: Boolean(book.has_pdf || book.pdf_drive_id),
      hasEpub: Boolean(book.has_epub || book.epub_drive_id),
      premium: Boolean(book.is_premium || book.access_type === "premium" || Number(book.price || 0) > 0),
      price: Number(book.price || book.premium_price || 0) || 0,
      description: normalizeAiText(book.description || book.summary || book.subject || "", 700),
    };
  }

  function readScopedStorage(prefix, fallback = []) {
    const activeEmail = String(localStorage.getItem("pdf_lib_active_email") || "guest")
      .trim()
      .toLowerCase();
    const scopedKey = `${prefix}::${activeEmail}`;
    const scopedRaw = localStorage.getItem(scopedKey);
    const legacyRaw = localStorage.getItem(prefix);
    return safeParseJson(scopedRaw ?? legacyRaw, fallback);
  }

  function collectUserReadingContext() {
    const recent = readScopedStorage("pdf_lib_recent_books", []);
    const myList = readScopedStorage("pdf_lib_my_list_v1", []);
    const progress = readScopedStorage("pdf_lib_reading_progress_v1", {});

    const progressItems = Object.entries(progress || {})
      .map(([key, value]) => ({
        key: normalizeAiText(key, 120),
        title: normalizeAiText(value?.title, 140),
        page: Number(value?.lastPage || value?.page || 0) || null,
        totalPages: Number(value?.totalPages || 0) || null,
        progress: Number(value?.progress || 0) || null,
        format: normalizeAiText(value?.format, 24),
        updatedAt: Number(value?.updatedAt || 0) || null,
      }))
      .filter((item) => item.title)
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
      .slice(0, 8);

    return {
      recentBooks: Array.isArray(recent)
        ? recent.slice(0, 8).map(simplifyBookForAi).filter(Boolean)
        : [],
      myList: Array.isArray(myList)
        ? myList.slice(0, 12).map(simplifyBookForAi).filter(Boolean)
        : [],
      readingProgress: progressItems,
    };
  }

  async function fetchLibraryBooksForAi() {
    if (
      Array.isArray(window.PDF_LIBRARY_BOOKS) &&
      window.PDF_LIBRARY_BOOKS.length > 0
    ) {
      return window.PDF_LIBRARY_BOOKS;
    }

    const now = Date.now();
    if (now - aiLibraryContextCache.fetchedAt < 15000) {
      return aiLibraryContextCache.books;
    }

    try {
      const response = await fetch(`${backendBaseUrl}/api/pdfs`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Book list request failed");
      const books = await response.json();
      aiLibraryContextCache = {
        fetchedAt: now,
        books: Array.isArray(books) ? books : [],
      };
      return aiLibraryContextCache.books;
    } catch {
      return [];
    }
  }

  function collectVisibleBooksForAi(libraryBooks = []) {
    const cards = Array.from(
      document.querySelectorAll(
        ".pdf-card, .reco-card, .continue-card, .continue-reading-card, .search-result-item, .my-list-item",
      ),
    );
    return cards
      .slice(0, 40)
      .map((card) => {
        const cardTitle = compactTitleFromCard(card);
        const matched = findBestLibraryMatch(cardTitle, libraryBooks);
        const base = matched ? simplifyBookForAi(matched) : null;
        return {
          ...(base || {}),
          title: base?.title || cardTitle,
          author:
            base?.author ||
            normalizeAiText(
              card.dataset?.author ||
                card.querySelector(".pdf-author, .book-author, p")?.textContent,
              120,
            ),
          category:
            base?.category ||
            normalizeAiText(card.dataset?.category || card.dataset?.genre || "", 80),
          visibleOnPage: true,
        };
      })
      .filter((book) => book.title);
  }

  function collectDomBookContext() {
    const path = String(window.location.pathname || "");
    const isDetail = path.includes("book-detail");
    const isReader = path.includes("view-pdf") || path.includes("view-epub");
    const titleFromQuery = normalizeAiText(getQueryParam("title"), 180);
    const titleFromWindow = normalizeAiText(window.VIEWER_BOOK_TITLE, 180);
    const titleFromPage = normalizeAiText(
      document.getElementById("detail-title")?.textContent ||
        document.getElementById("reader-title")?.textContent ||
        document.querySelector(".book-title, h1")?.textContent,
      180,
    );

    const activeBook = simplifyBookForAi(window.PDF_LIBRARY_CURRENT_BOOK);
    const basicBook = {
      id: getQueryParam("id") || activeBook?.id || null,
      title: activeBook?.title || titleFromWindow || titleFromQuery || titleFromPage,
      author:
        activeBook?.author ||
        normalizeAiText(
          document.getElementById("detail-author")?.textContent ||
            document.querySelector("[data-detail-author]")?.textContent,
          120,
        ),
      category:
        activeBook?.category ||
        normalizeAiText(
          document.getElementById("detail-category")?.textContent ||
            document.querySelector("[data-detail-category]")?.textContent,
          80,
        ),
      format:
        activeBook?.format ||
        normalizeAiText(
          window.VIEWER_DOCUMENT_FORMAT ||
            (path.includes("view-epub") ? "EPUB" : path.includes("view-pdf") ? "PDF" : ""),
          24,
        ),
      description:
        activeBook?.description ||
        normalizeAiText(
          document.getElementById("detail-full-desc")?.textContent ||
            document.getElementById("detail-description")?.textContent,
          500,
        ),
    };

    if (!isDetail && !isReader && !basicBook.title) return null;
    return Object.fromEntries(
      Object.entries({
        ...basicBook,
        pageType: isReader ? "reader" : isDetail ? "book_detail" : "library",
      }).filter(([, value]) => value !== "" && value !== null && value !== undefined),
    );
  }

  function promptNeedsWholeBookText(prompt) {
    return /\b(whole|entire|full)\s+book\b|summari[sz]e\s+(this\s+)?book|about\s+this\s+book/i.test(
      String(prompt || ""),
    );
  }

  function promptNeedsCurrentPageText(prompt) {
    return /\b(this|current)\s+(page|section|chapter)\b|summari[sz]e\s+this|explain\s+this|create\s+(a\s+)?quiz|practice\s+questions|notes?\s+from\s+this|what\s+am\s+i\s+reading/i.test(
      String(prompt || ""),
    );
  }

  async function collectReaderContext(prompt) {
    const engine = window.PDF_LIBRARY_READER_CONTEXT || window.readerEngine || null;
    const state =
      typeof engine?.getState === "function"
        ? engine.getState()
        : typeof window.getPdfReaderState === "function"
          ? window.getPdfReaderState()
          : null;

    const hasReader =
      state ||
      String(window.location.pathname || "").includes("view-pdf") ||
      String(window.location.pathname || "").includes("view-epub");
    if (!hasReader) return null;

    const reader = {
      format:
        normalizeAiText(window.VIEWER_DOCUMENT_FORMAT, 24) ||
        (String(window.location.pathname || "").includes("view-epub") ? "EPUB" : "PDF"),
      documentId: normalizeAiText(window.VIEWER_DOCUMENT_ID || getQueryParam("id"), 180),
      title: normalizeAiText(window.VIEWER_BOOK_TITLE || getQueryParam("title") || document.title, 180),
      state,
    };

    const currentPage = Number(state?.currentPage || 1) || 1;
    const wantsWholeBook = promptNeedsWholeBookText(prompt);
    const wantsPage = promptNeedsCurrentPageText(prompt) || !wantsWholeBook;

    try {
      if (wantsWholeBook && typeof engine?.getDocumentText === "function") {
        reader.documentText = await engine.getDocumentText({ maxChars: 42000, maxPages: 80 });
        reader.documentTextNote =
          "This may be a shortened extract when the book is long, so answer honestly if more text is needed.";
      }

      if (wantsPage && typeof engine?.getPageText === "function") {
        reader.currentPageText = await engine.getPageText(currentPage);
      } else if (wantsPage && typeof window.getPdfPageText === "function") {
        reader.currentPageText = await window.getPdfPageText(currentPage);
      }
    } catch {
      reader.textExtractionWarning = "The reader is open, but page text could not be extracted yet.";
    }

    if (reader.currentPageText) {
      reader.currentPageText = normalizeAiText(reader.currentPageText, 8000);
    }
    if (reader.documentText) {
      reader.documentText = normalizeAiText(reader.documentText, 42000);
    }

    return reader;
  }

  async function collectAiWebsiteContext(prompt) {
    const [libraryBooks, reader] = await Promise.all([
      fetchLibraryBooksForAi(),
      collectReaderContext(prompt),
    ]);
    const simplifiedBooks = Array.isArray(libraryBooks)
      ? libraryBooks.map(simplifyBookForAi).filter(Boolean)
      : [];
    const visibleBooks = collectVisibleBooksForAi(libraryBooks);
    const matchedBooks = selectPromptMatchedBooks(prompt, [
      ...visibleBooks,
      ...simplifiedBooks,
    ]);

    return {
      instruction:
        "Use this website context first. If currentBook, reader.currentPageText, library.matchedBooks, or library.visibleBooks is present, answer about that exact book/page instead of asking which book. Before saying a book is unavailable, fuzzy-match the user's words against matchedBooks, visibleBooks, books, currentBook, and reading history.",
      page: {
        url: window.location.href,
        path: window.location.pathname,
        title: document.title,
      },
      currentBook: collectDomBookContext(),
      reader,
      library: {
        totalBooks: simplifiedBooks.length,
        books: simplifiedBooks.slice(0, 160),
        visibleBooks,
        matchedBooks,
      },
      userLibraryHistory: collectUserReadingContext(),
      conversation: collectConversationContext(),
    };
  }

  function appendFilesToQueue(files) {
    if (!Array.isArray(window.attachedFiles)) {
      window.attachedFiles = [];
    }
    if (!Array.isArray(files) || files.length === 0) return;
    window.attachedFiles = window.attachedFiles.concat(files);
    if (typeof window.renderFilePreviews === "function") {
      window.renderFilePreviews();
    }
    updateSendButtonVisibility();
  }

  function extractImageFilesFromClipboard(event) {
    const clipboardItems = event?.clipboardData?.items;
    if (!clipboardItems || clipboardItems.length === 0) return [];

    const now = Date.now();
    const files = [];
    Array.from(clipboardItems).forEach((item, index) => {
      if (item.kind !== "file" || !String(item.type || "").startsWith("image/")) {
        return;
      }
      const rawFile = item.getAsFile();
      if (!rawFile) return;
      const mimeType = rawFile.type || "image/png";
      const extension = mimeType.split("/")[1] || "png";
      const fileName = rawFile.name || `pasted-image-${now}-${index + 1}.${extension}`;
      files.push(
        new File([rawFile], fileName, {
          type: mimeType,
          lastModified: now,
        }),
      );
    });
    return files;
  }

  function removeLoadingIndicator(id) {
    const loadingNode = document.getElementById(id);
    if (loadingNode) {
      loadingNode.remove();
    }
  }

  function appendMessageNode(node) {
    if (!aiChatBody || !node) return;
    const previousScrollTop = aiChatBody.scrollTop;
    aiChatBody.appendChild(node);
    aiChatBody.scrollTop = previousScrollTop;
    window.requestAnimationFrame(() => {
      aiChatBody.scrollTop = previousScrollTop;
    });
  }

  function renderPlainTextWithBreaks(target, text) {
    target.textContent = "";
    String(text || "").split("\n").forEach((line, index) => {
      if (index > 0) target.appendChild(document.createElement("br"));
      target.appendChild(document.createTextNode(line));
    });
  }

  function renderMarkdownSafely(target, text) {
    if (typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
      target.innerHTML = DOMPurify.sanitize(marked.parse(String(text || "")));
      return;
    }

    renderPlainTextWithBreaks(target, text);
  }

  window.updateAiSendButtonVisibility = updateSendButtonVisibility;
  window.renderAiStartScreen = renderAiStartScreen;
  window.hideAiStartScreen = hideAiStartScreen;
  window.resetAiConversationShell = resetAiConversationShell;

  // 1. Open Sidebar
  aiChatBtn.addEventListener("click", () => {
    setAiSidebarMode(true);
    aiSidebar.classList.add("active");
    aiChatInput.focus(); // Auto-focus the typing area
    updateSendButtonVisibility();
  });

  // 2. Close Sidebar
  aiCloseBtn.addEventListener("click", () => {
    aiSidebar.classList.remove("active");
    setAiSidebarMode(false);
  });
  // 3. Append Message to UI (Now with Markdown formatting!)
  function appendMessage(text, sender) {
    const msgDiv = document.createElement("div");
    msgDiv.className = sender === "user" ? "ai-msg-user" : "ai-msg-bot";

    if (sender === "bot") {
      renderMarkdownSafely(msgDiv, text);
    } else {
      // If it's the user speaking, just show normal text
      msgDiv.textContent = text;
    }

    appendMessageNode(msgDiv);
  }

  // 4. Send Message to Backend (NOW WITH FILE SUPPORT)
  async function sendChatMessage() {
    const text = aiChatInput.value.trim();
    // Grab the files from the global array
    const filesToSend = window.attachedFiles || [];

    // Stop if there is no text AND no files
    if (!text && filesToSend.length === 0) return;

    // Create the visual message for the user
    let displayMsg = text;
    if (filesToSend.length > 0) {
      const fileNames = filesToSend.map((f) => f.name).join(", ");
      displayMsg = text
        ? `${text}\n\n*[Attached: ${fileNames}]*`
        : `*[Attached: ${fileNames}]*`;
    }

    // Show user message
    hideAiStartScreen();
    appendMessage(displayMsg, "user");
    aiChatInput.value = "";
    updateSendButtonVisibility();

    // Show loading state
    const loadingId = "loading-" + Date.now();
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "ai-msg-bot ai-loading-indicator";
    loadingDiv.id = loadingId;
    loadingDiv.innerHTML =
      '<span class="ai-thinking-spinner" aria-hidden="true"></span><span>Thinking...</span>';
    appendMessageNode(loadingDiv);

    try {
      // Convert all attached files to Base64 format so the server can read them
      const filePromises = filesToSend.map((file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            resolve({
              inlineData: {
                data: reader.result.split(",")[1], // Extracts the raw Base64 data
                mimeType: file.type, // Tells the backend what kind of file is attached.
              },
            });
          };
          reader.onerror = (error) => reject(error);
        });
      });

      const processedFiles = await Promise.all(filePromises);
      const websiteContext = await collectAiWebsiteContext(text);
      rememberConversationTurn("user", displayMsg);

      // Clear the attachments UI now that they are being sent
      window.attachedFiles = [];
      if (typeof window.renderFilePreviews === "function")
        window.renderFilePreviews();

      // Call your Node.js backend, sending BOTH text and files
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
      const response = await fetch(`${backendBaseUrl}/api/ai/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: text,
          files: processedFiles,
          context: websiteContext,
        }),
      });
      clearTimeout(timeoutId);

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      removeLoadingIndicator(loadingId);
      if (response.ok && data && typeof data.answer === "string") {
        appendMessage(data.answer, "bot");
        rememberConversationTurn("assistant", data.answer);
        // NEW: Save this interaction to our persistent history
        if (window.saveInteractionToHistory) {
          window.saveInteractionToHistory(displayMsg, data.answer);
        }
      } else {
        appendMessage(PUBLIC_AI_FAILURE_MESSAGE, "bot");
      }
    } catch (error) {
      removeLoadingIndicator(loadingId);
      appendMessage(PUBLIC_AI_FAILURE_MESSAGE, "bot");
    }
  }
  // 5. Event Listeners for Input
  // 5. Event Listeners for Input & Dynamic Send Button
  if (aiSendBtn) {
    // Triggers the Enter action when the button is clicked
    aiSendBtn.addEventListener("click", () => {
      sendChatMessage();
    });
  }

  if (aiChatInput) {
    // Triggers the Enter action when the Enter key is pressed
    aiChatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendChatMessage();
      }
    });

    // Keep the welcome suggestions visible while typing; clear them only after send.
    aiChatInput.addEventListener("input", () => {
      updateSendButtonVisibility();
    });

    aiChatInput.addEventListener("paste", (event) => {
      const pastedImages = extractImageFilesFromClipboard(event);
      if (pastedImages.length === 0) return;
      event.preventDefault();
      appendFilesToQueue(pastedImages);
    });
  }

  // Supports Ctrl+V image paste even when the focus is not inside the input.
  document.addEventListener("paste", (event) => {
    if (!aiSidebar.classList.contains("active")) return;
    if (event.target instanceof Element && event.target.closest("#ai-sidebar")) {
      return;
    }

    const pastedImages = extractImageFilesFromClipboard(event);
    if (pastedImages.length === 0) return;
    event.preventDefault();
    appendFilesToQueue(pastedImages);
    if (aiChatInput) {
      aiChatInput.focus();
    }
  });

  // Add spin animation for the loading icon
  const style = document.createElement("style");
  style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
  renderAiStartScreen();
  updateSendButtonVisibility();
});
//* --- START OF COMPLETE UPLOAD & FILE CHIP LOGIC --- */
// Make these global so sendChatMessage can access them
window.attachedFiles = [];
window.renderFilePreviews = function () {
  const filePreviewContainer = document.getElementById(
    "file-preview-container",
  );
  if (!filePreviewContainer) return;
  filePreviewContainer.innerHTML = "";

  window.attachedFiles.forEach((file, index) => {
    const chip = document.createElement("div");
    chip.className = "file-chip";
    chip.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
        <span class="file-chip-name"></span>
        <button class="file-chip-remove" data-index="${index}" type="button" title="Remove file">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;
    const nameNode = chip.querySelector(".file-chip-name");
    if (nameNode) {
      nameNode.textContent = file.name;
      nameNode.title = file.name;
    }
    filePreviewContainer.appendChild(chip);
  });

  document.querySelectorAll(".file-chip-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const indexToRemove = parseInt(
        e.currentTarget.getAttribute("data-index"),
      );
      window.attachedFiles.splice(indexToRemove, 1);
      window.renderFilePreviews();
    });
  });

  if (typeof window.updateAiSendButtonVisibility === "function") {
    window.updateAiSendButtonVisibility();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const plusBtn = document.getElementById("ai-plus-btn");
  const uploadPopup = document.getElementById("ai-upload-popup");
  const aiUploadDeviceBtn = document.getElementById("ai-upload-device-btn");
  const fileInput = document.getElementById("ai-file-input");

  if (plusBtn && uploadPopup) {
    plusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      uploadPopup.classList.toggle("show");
    });
  }

  document.addEventListener("click", (e) => {
    if (
      uploadPopup &&
      uploadPopup.classList.contains("show") &&
      !e.target.closest(".upload-container")
    ) {
      uploadPopup.classList.remove("show");
    }
  });

  if (aiUploadDeviceBtn && fileInput) {
    aiUploadDeviceBtn.addEventListener("click", () => {
      fileInput.click();
      uploadPopup.classList.remove("show");
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        window.attachedFiles = window.attachedFiles.concat(files);
        window.renderFilePreviews();
        fileInput.value = "";
      }
    });
  }
});
/* --- END OF COMPLETE UPLOAD & FILE CHIP LOGIC --- */

/* --- START OF AI HISTORY LOGIC --- */
document.addEventListener("DOMContentLoaded", () => {
  const historyBtn = document.getElementById("ai-history-btn");
  const historyDropdown = document.getElementById("ai-history-dropdown");
  const historyList = document.getElementById("ai-history-list");
  const aiChatBody = document.getElementById("ai-chat-body");

  const CHAT_HISTORY_KEY_PREFIX = "ai_chat_history";
  const ACTIVE_EMAIL_KEY = "pdf_lib_active_email";
  const ACCOUNTS_KEY = "pdf_lib_accounts";
  const STORAGE_MIGRATION_META_KEY = "pdf_lib_storage_migration_v2";

  function normalizeEmailKey(email) {
    return String(email || "").trim().toLowerCase();
  }

  function getActiveEmailKey() {
    return normalizeEmailKey(localStorage.getItem(ACTIVE_EMAIL_KEY)) || "guest";
  }

  function getScopedChatHistoryKey(emailKey = getActiveEmailKey()) {
    if (!emailKey) return null;
    return `${CHAT_HISTORY_KEY_PREFIX}::${emailKey}`;
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

  function readMigrationState() {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(STORAGE_MIGRATION_META_KEY) || "{}",
      );
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {};
      }
      return parsed;
    } catch {
      return {};
    }
  }

  function writeMigrationState(state) {
    try {
      localStorage.setItem(
        STORAGE_MIGRATION_META_KEY,
        JSON.stringify(state || {}),
      );
    } catch {
      // Ignore storage write errors.
    }
  }

  function migrateLegacyChatHistoryIfNeeded(emailKey = getActiveEmailKey()) {
    const scopedKey = getScopedChatHistoryKey(emailKey);
    if (!scopedKey) return null;

    const scopedValue = localStorage.getItem(scopedKey);
    if (scopedValue !== null) return scopedValue;

    const legacyValue = localStorage.getItem(CHAT_HISTORY_KEY_PREFIX);
    if (legacyValue === null) return null;

    const migrationState = readMigrationState();
    const owner = normalizeEmailKey(migrationState[CHAT_HISTORY_KEY_PREFIX]);
    const preferredOwner = owner || getPreferredLegacyOwnerEmailKey(emailKey);
    if (preferredOwner && preferredOwner !== emailKey) return null;

    try {
      localStorage.setItem(scopedKey, legacyValue);
    } catch {
      return null;
    }

    migrationState[CHAT_HISTORY_KEY_PREFIX] = preferredOwner || emailKey;
    writeMigrationState(migrationState);
    return legacyValue;
  }

  function sanitizeStoredBotReply(botText) {
    const text = String(botText || "");
    const normalized = text.toLowerCase();
    if (
      normalized.includes("api error") ||
      normalized.includes("error fetching from") ||
      normalized.includes("service unavailable") ||
      normalized.includes("rate limit")
    ) {
      return AI_FALLBACK_MESSAGE;
    }
    return text;
  }

  function loadChatHistoryForActiveUser() {
    const scopedKey = getScopedChatHistoryKey();
    if (!scopedKey) return [];
    const raw =
      localStorage.getItem(scopedKey) ??
      migrateLegacyChatHistoryIfNeeded(getActiveEmailKey());
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          ...item,
          bot: sanitizeStoredBotReply(item.bot),
        }));
    } catch {
      return [];
    }
  }

  function saveChatHistoryForActiveUser(list) {
    const scopedKey = getScopedChatHistoryKey();
    if (!scopedKey) return;
    localStorage.setItem(scopedKey, JSON.stringify(Array.isArray(list) ? list : []));
  }

  function renderPlainTextWithBreaks(target, text) {
    target.textContent = "";
    String(text || "").split("\n").forEach((line, index) => {
      if (index > 0) target.appendChild(document.createElement("br"));
      target.appendChild(document.createTextNode(line));
    });
  }

  function renderMarkdownSafely(target, text) {
    if (typeof marked !== "undefined" && typeof DOMPurify !== "undefined") {
      target.innerHTML = DOMPurify.sanitize(marked.parse(String(text || "")));
      return;
    }

    renderPlainTextWithBreaks(target, text);
  }

  // 1. PERMANENT STORAGE: Load history for the active account only
  let chatHistory = loadChatHistoryForActiveUser();

  // Expose save function globally so sendChatMessage can use it
  window.saveInteractionToHistory = function (userText, botText) {
    const interaction = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      user: userText,
      bot: sanitizeStoredBotReply(botText),
    };
    chatHistory.unshift(interaction); // Add newest to the top
    // Save only for the active signed-in account
    saveChatHistoryForActiveUser(chatHistory);
    renderHistoryDropdown();
  };

  function renderHistoryDropdown() {
    if (!historyList) return;
    historyList.innerHTML = "";

    if (chatHistory.length === 0) {
      historyList.innerHTML =
        '<div style="padding: 12px 16px; color: #9aa0a6; font-size: 12px;">No history yet.</div>';
      return;
    }

    chatHistory.forEach((item) => {
      const div = document.createElement("div");
      div.className = "ai-history-item";

      // Injecting the text, the 3 dots, and the hidden delete menu
      div.innerHTML = `
                <div class="ai-history-item-content">
                    <div class="ai-history-item-query"></div>
                    <div class="ai-history-item-date"></div>
                </div>
                <button class="ai-history-more-btn" title="More options">
                    <span class="material-symbols-outlined" style="font-size: 18px;">more_vert</span>
                </button>
                <div class="ai-history-delete-menu">
                    <button class="ai-history-delete-btn">
                        <span class="material-symbols-outlined">delete</span>
                        Delete
                    </button>
                </div>
            `;

      const queryNode = div.querySelector(".ai-history-item-query");
      const dateNode = div.querySelector(".ai-history-item-date");
      if (queryNode) queryNode.textContent = String(item.user || "").replace(/\n/g, " ");
      if (dateNode) dateNode.textContent = String(item.date || "");

      const contentArea = div.querySelector(".ai-history-item-content");
      const moreBtn = div.querySelector(".ai-history-more-btn");
      const deleteMenu = div.querySelector(".ai-history-delete-menu");
      const deleteBtn = div.querySelector(".ai-history-delete-btn");

      // Action A: Click the text area to load the chat
      contentArea.addEventListener("click", () => {
        loadInteraction(item);
        historyDropdown.classList.add("hidden-dropdown");
      });

      // Action B: Click the 3 dots to open the delete menu
      moreBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevents the chat from loading
        // Close any other open delete menus first
        document.querySelectorAll(".ai-history-delete-menu").forEach((menu) => {
          if (menu !== deleteMenu) menu.classList.remove("is-visible");
        });
        deleteMenu.classList.toggle("is-visible");
      });

      // Action C: Click "Delete" to PERMANENTLY remove the item
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        // Remove this specific item from the array
        chatHistory = chatHistory.filter((h) => h.id !== item.id);
        // Save updated array for the active account only
        saveChatHistoryForActiveUser(chatHistory);
        // Redraw the list
        renderHistoryDropdown();
      });

      historyList.appendChild(div);
    });
  }

  function loadInteraction(item) {
    if (!aiChatBody) return;
    aiChatBody.innerHTML = ""; // Clear current chat screen
    aiChatBody.classList.add("has-messages");
    if (typeof window.hideAiStartScreen === "function") {
      window.hideAiStartScreen();
    }

    // Re-create AI message bubble (with Markdown formatting)
    const botDiv = document.createElement("div");
    botDiv.className = "ai-msg-bot";
    renderMarkdownSafely(botDiv, item.bot);

    // Re-create user message bubble
    const userDiv = document.createElement("div");
    userDiv.className = "ai-msg-user";
    userDiv.textContent = item.user;

    aiChatBody.appendChild(userDiv);
    aiChatBody.appendChild(botDiv);
    aiChatBody.scrollTop = 0;

    if (typeof window.setAiConversationContext === "function") {
      window.setAiConversationContext([
        { role: "user", text: item.user },
        { role: "assistant", text: item.bot },
      ]);
    }
  }

  // Handle opening and closing the main history menu
  if (historyBtn && historyDropdown) {
    historyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      historyDropdown.classList.toggle("hidden-dropdown");
      renderHistoryDropdown(); // Refresh list when opened
    });

    // Close dropdowns if user clicks anywhere else on the screen
    document.addEventListener("click", (e) => {
      // Close main history dropdown
      if (
        !e.target.closest("#ai-history-dropdown") &&
        !e.target.closest("#ai-history-btn")
      ) {
        historyDropdown.classList.add("hidden-dropdown");
      }
      // Close individual delete menus if clicking outside them
      if (
        !e.target.closest(".ai-history-more-btn") &&
        !e.target.closest(".ai-history-delete-menu")
      ) {
        document.querySelectorAll(".ai-history-delete-menu").forEach((menu) => {
          menu.classList.remove("is-visible");
        });
      }
    });
  }

  // Initial render on page load
  renderHistoryDropdown();

  window.addEventListener("pdf-lib:active-user-changed", () => {
    chatHistory = loadChatHistoryForActiveUser();
    renderHistoryDropdown();
    if (historyDropdown) {
      historyDropdown.classList.add("hidden-dropdown");
    }
    if (aiChatBody) {
      aiChatBody.innerHTML = "";
      aiChatBody.classList.remove("has-messages");
      if (typeof window.renderAiStartScreen === "function") {
        window.renderAiStartScreen();
      }
    }
  });

  window.addEventListener("storage", (event) => {
    const scopedKey = getScopedChatHistoryKey();
    if (event.key !== ACTIVE_EMAIL_KEY && event.key !== scopedKey) return;
    chatHistory = loadChatHistoryForActiveUser();
    renderHistoryDropdown();
  });
});
/* --- END OF AI HISTORY LOGIC --- */
/* --- START OF NEW CHAT LOGIC --- */
document.addEventListener("DOMContentLoaded", () => {
  const newChatBtn = document.getElementById("ai-new-chat-btn");
  const aiChatBody = document.getElementById("ai-chat-body");
  const aiChatInput = document.getElementById("ai-chat-input");
  const aiSendBtn = document.getElementById("ai-send-btn");

  if (newChatBtn) {
    newChatBtn.addEventListener("click", () => {
      if (typeof window.resetAiConversationShell === "function") {
        window.resetAiConversationShell();
      } else {
        if (aiChatBody) aiChatBody.innerHTML = "";
        if (aiChatInput) aiChatInput.value = "";
        window.attachedFiles = [];
        if (typeof window.renderFilePreviews === "function") {
          window.renderFilePreviews();
        }
        if (aiSendBtn) {
          aiSendBtn.classList.add("hidden-send");
        }
      }
    });
  }
});
/* --- END OF NEW CHAT LOGIC --- */


})();
