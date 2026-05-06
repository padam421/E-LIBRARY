(function mobileVideoPlayerFix() {
  const MOBILE_PLAYER_QUERY =
    "(max-width: 900px), (hover: none) and (pointer: coarse)";
  const MOBILE_PLAYER_ID = "hero-video-mobile-fix";
  const MOBILE_PLAYER_STYLE_ID = "hero-video-mobile-fix-style";
  const MAX_BOOK_LOOKUPS = 12;
  const BOOK_LOOKUP_DELAY_MS = 250;

  function isMobileViewport() {
    return window.matchMedia(MOBILE_PLAYER_QUERY).matches;
  }

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

  function normalizeDriveAssetId(value) {
    const id = String(value || "").trim();
    if (!id) return "";

    try {
      const url = new URL(id);
      const queryId = url.searchParams.get("id");
      if (queryId) return queryId.trim();

      const pathMatch = url.pathname.match(/\/(?:file\/d|folders)\/([^/]+)/);
      if (pathMatch && pathMatch[1]) {
        return decodeURIComponent(pathMatch[1]).trim();
      }
    } catch {
      // Plain IDs are valid too.
    }

    const inlineMatch = id.match(/(?:\/d\/|id=|\/folders\/)([A-Za-z0-9_-]{10,})/);
    return inlineMatch && inlineMatch[1] ? inlineMatch[1].trim() : id;
  }

  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const cleanPathMatch = window.location.pathname.match(/^\/books\/([^/]+)(?:\/|$)/);
    return {
      id: params.get("id") || cleanPathMatch?.[1] || "",
      title: params.get("title") || "",
    };
  }

  function findBook(books, params) {
    if (params.id) {
      const byId = books.find((book) => String(book.id) === String(params.id));
      if (byId) return byId;
    }

    if (params.title) {
      const wantedTitle = decodeURIComponent(params.title).toLowerCase();
      return books.find(
        (book) => String(book.title || "").toLowerCase() === wantedTitle,
      );
    }

    return null;
  }

  async function fetchCurrentBook() {
    const params = getUrlParams();
    if (!params.id && !params.title) return null;

    try {
      const response = await fetch(`${resolveApiOrigin()}/api/pdfs`);
      if (!response.ok) return null;
      const books = await response.json();
      return Array.isArray(books) ? findBook(books, params) : null;
    } catch {
      return null;
    }
  }

  function getNativeVideoUrl(book) {
    if (!book || typeof book !== "object") return "";

    if (book.video_proxy_url) {
      return `${resolveApiOrigin()}${book.video_proxy_url}`;
    }

    const driveId = normalizeDriveAssetId(book.video_drive_id);
    return driveId
      ? `${resolveApiOrigin()}/api/video/${encodeURIComponent(driveId)}`
      : "";
  }

  function ensureMobilePlayerStyles() {
    if (document.getElementById(MOBILE_PLAYER_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = MOBILE_PLAYER_STYLE_ID;
    style.textContent = `
      @media (max-width: 900px), (hover: none) and (pointer: coarse) {
        #${MOBILE_PLAYER_ID} {
          background: #000;
          object-fit: contain;
        }

        #hero-poster {
          pointer-events: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function buildNativePlayer(src, posterSrc, className) {
    const video = document.createElement("video");
    video.id = MOBILE_PLAYER_ID;
    video.className = className;
    video.controls = true;
    video.defaultMuted = true;
    video.muted = true;
    video.preload = "metadata";
    video.src = src;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("controlslist", "nodownload noplaybackrate");
    video.setAttribute("disablepictureinpicture", "");

    if (posterSrc) {
      video.setAttribute("poster", posterSrc);
    }

    return video;
  }

  function swapToNativePlayer(book) {
    if (!isMobileViewport()) return false;
    if (document.getElementById("hero-video-native")) return false;

    const iframe = document.getElementById("hero-video");
    const poster = document.getElementById("hero-poster");
    const titleOverlay = document.getElementById("hero-title-overlay");
    if (!iframe) return false;

    const src = getNativeVideoUrl(book);
    if (!src) return false;

    ensureMobilePlayerStyles();

    const posterSrc = poster ? poster.getAttribute("src") : "";
    const nativePlayer = buildNativePlayer(src, posterSrc, iframe.className || "hero-video");
    iframe.replaceWith(nativePlayer);

    if (poster) {
      poster.removeAttribute("src");
      poster.style.display = "none";
      poster.classList.remove("fade-out");
    }

    if (titleOverlay) {
      titleOverlay.classList.add("subtle");
    }

    const playPromise = nativePlayer.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }

    return true;
  }

  async function resolveCurrentBook() {
    for (let attempt = 0; attempt < MAX_BOOK_LOOKUPS; attempt += 1) {
      if (window.PDF_LIBRARY_CURRENT_BOOK) {
        return window.PDF_LIBRARY_CURRENT_BOOK;
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, BOOK_LOOKUP_DELAY_MS);
      });
    }

    return fetchCurrentBook();
  }

  async function applyMobilePlayerFix() {
    if (!isMobileViewport()) return;
    if (document.getElementById("hero-video-native")) return;

    const book = await resolveCurrentBook();
    if (!book) return;
    swapToNativePlayer(book);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyMobilePlayerFix, {
      once: true,
    });
  } else {
    applyMobilePlayerFix();
  }
})();
