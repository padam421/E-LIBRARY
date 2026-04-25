// =========================================
// PREMIUM THEME TOGGLE - Dark/Light Mode
// Per-account preference (email-scoped)
// =========================================

(function () {
  "use strict";

  const LS_THEME_KEY_PREFIX = "pdf_lib_theme";
  const LS_ACTIVE_EMAIL_KEY = "pdf_lib_active_email";
  const LS_ACCOUNTS_KEY = "pdf_lib_accounts";
  const LS_STORAGE_MIGRATION_META_KEY = "pdf_lib_storage_migration_v2";

  function normalizeEmailKey(email) {
    return String(email || "").trim().toLowerCase();
  }

  function getActiveEmailKey() {
    return normalizeEmailKey(localStorage.getItem(LS_ACTIVE_EMAIL_KEY));
  }

  function getScopedThemeKey(emailKey = getActiveEmailKey()) {
    if (!emailKey) return null;
    return `${LS_THEME_KEY_PREFIX}::${emailKey}`;
  }

  function getPreferredLegacyOwnerEmailKey(fallbackEmail) {
    const fallback = normalizeEmailKey(fallbackEmail);
    try {
      const parsed = JSON.parse(localStorage.getItem(LS_ACCOUNTS_KEY) || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = normalizeEmailKey(parsed[0] && parsed[0].email);
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
        localStorage.getItem(LS_STORAGE_MIGRATION_META_KEY) || "{}",
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
        LS_STORAGE_MIGRATION_META_KEY,
        JSON.stringify(state || {}),
      );
    } catch {
      // Ignore storage write errors.
    }
  }

  function migrateLegacyThemeIfNeeded(emailKey = getActiveEmailKey()) {
    const scopedKey = getScopedThemeKey(emailKey);
    if (!scopedKey) return null;

    const scopedValue = localStorage.getItem(scopedKey);
    if (scopedValue !== null) return scopedValue;

    const legacyValue = localStorage.getItem(LS_THEME_KEY_PREFIX);
    if (legacyValue === null) return null;

    const migrationState = readMigrationState();
    const owner = normalizeEmailKey(migrationState[LS_THEME_KEY_PREFIX]);
    const preferredOwner = owner || getPreferredLegacyOwnerEmailKey(emailKey);
    if (preferredOwner && preferredOwner !== emailKey) return null;

    try {
      localStorage.setItem(scopedKey, legacyValue);
    } catch {
      return null;
    }

    migrationState[LS_THEME_KEY_PREFIX] = preferredOwner || emailKey;
    writeMigrationState(migrationState);
    return legacyValue;
  }

  function readThemeForActiveUser() {
    const emailKey = getActiveEmailKey();
    if (!emailKey) return null;

    const scopedKey = getScopedThemeKey(emailKey);
    if (!scopedKey) return null;

    const raw =
      localStorage.getItem(scopedKey) ?? migrateLegacyThemeIfNeeded(emailKey);
    if (raw === "light" || raw === "dark") return raw;
    return null;
  }

  function applyThemeForActiveUser() {
    const savedTheme = readThemeForActiveUser();
    if (savedTheme === "light") {
      document.body.classList.add("light-mode");
    } else {
      document.body.classList.remove("light-mode");
    }
  }

  function saveThemeForActiveUser(mode) {
    const scopedKey = getScopedThemeKey();
    if (!scopedKey) return;
    localStorage.setItem(scopedKey, mode === "light" ? "light" : "dark");
  }

  // 1. Inject Theme Toggle CSS (if not already present)
  if (!document.querySelector('link[href*="theme-toggle.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "assets/css/theme-toggle.css";
    document.head.appendChild(link);
  }

  // 2. Apply saved theme for active account (guest stays default)
  applyThemeForActiveUser();

  // 3. Create the Toggle Button HTML
  function createToggleButton() {
    const btn = document.createElement("button");
    btn.id = "theme-toggle-btn";
    btn.className = "theme-toggle-btn";
    btn.setAttribute("title", "Toggle Dark/Light Mode");
    btn.setAttribute("aria-label", "Toggle Dark/Light Mode");
    btn.innerHTML = `
      <span class="theme-icon theme-icon-sun">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3" stroke="#f5c518" stroke-width="2" stroke-linecap="round"/>
          <line x1="12" y1="21" x2="12" y2="23" stroke="#f5c518" stroke-width="2" stroke-linecap="round"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="#f5c518" stroke-width="2" stroke-linecap="round"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="#f5c518" stroke-width="2" stroke-linecap="round"/>
          <line x1="1" y1="12" x2="3" y2="12" stroke="#f5c518" stroke-width="2" stroke-linecap="round"/>
          <line x1="21" y1="12" x2="23" y2="12" stroke="#f5c518" stroke-width="2" stroke-linecap="round"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="#f5c518" stroke-width="2" stroke-linecap="round"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="#f5c518" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="theme-icon theme-icon-moon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
        </svg>
      </span>
    `;
    return btn;
  }

  // 4. Insert Button into the Correct Location
  function insertToggleButton() {
    if (document.getElementById("theme-toggle-btn")) return;

    const btn = createToggleButton();

    const headerRight = document.querySelector(".header-right");
    if (headerRight) {
      const signInBtn = headerRight.querySelector("#sign-in-btn");
      const profileBtn = headerRight.querySelector("#profile-btn");
      if (signInBtn) {
        headerRight.insertBefore(btn, signInBtn);
      } else if (profileBtn) {
        headerRight.insertBefore(btn, profileBtn);
      } else {
        headerRight.prepend(btn);
      }
      setupToggleListener(btn);
      return;
    }

    const readerNav = document.querySelector(".reader-nav");
    if (readerNav) {
      const navRightSlot = document.getElementById("nav-right-slot");
      if (navRightSlot && navRightSlot.parentNode) {
        navRightSlot.parentNode.insertBefore(btn, navRightSlot);
      } else {
        readerNav.appendChild(btn);
      }
      setupToggleListener(btn);
      return;
    }

    const detailNav = document.querySelector(".detail-nav");
    if (detailNav) {
      detailNav.appendChild(btn);
      btn.style.marginLeft = "auto";
      setupToggleListener(btn);
    }
  }

  // 5. Toggle Logic
  function setupToggleListener(btn) {
    btn.addEventListener("click", function () {
      document.body.classList.add("theme-transitioning");
      document.body.classList.toggle("light-mode");

      const isLight = document.body.classList.contains("light-mode");
      saveThemeForActiveUser(isLight ? "light" : "dark");

      setTimeout(() => {
        document.body.classList.remove("theme-transitioning");
      }, 500);
    });
  }

  // 6. Initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", insertToggleButton);
  } else {
    insertToggleButton();
  }

  window.addEventListener("pdf-lib:active-user-changed", () => {
    applyThemeForActiveUser();
  });

  setTimeout(insertToggleButton, 100);
  setTimeout(insertToggleButton, 500);
})();
