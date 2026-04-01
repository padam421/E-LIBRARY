/* ═══════════════════════════════════════════
   BOOK DETAIL PAGE — JavaScript Logic
   Apple Premium Design System
   ═══════════════════════════════════════════ */

const API_BASE = "http://localhost:3000/api";

// ── URL PARAMS ──
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return { id: params.get("id"), title: params.get("title") };
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
  return book.video_drive_id && book.video_drive_id !== "No Video Available";
}

function hasPoster(book) {
  return book.poster_drive_id && book.poster_drive_id !== "No Poster Available";
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

// ═══════════════════════════════════════════
// RENDER HERO — Poster first → then video
// ═══════════════════════════════════════════
function renderHero(book) {
  const heroSection = document.getElementById("hero-section");
  const heroVideo = document.getElementById("hero-video");
  const heroPoster = document.getElementById("hero-poster");
  const heroTitle = document.getElementById("hero-title");
  const heroOverlay = document.getElementById("hero-title-overlay");

  heroTitle.textContent = book.title;

  if (hasVideo(book)) {
    // ── STEP 1: Show poster immediately ──
    const posterId = hasPoster(book)
      ? book.poster_drive_id
      : book.cover_drive_id;
    heroPoster.src = `https://drive.google.com/thumbnail?id=${posterId}&sz=w1280`;
    heroPoster.style.display = "block";

    // ── STEP 2: Load video BEHIND poster ──
    heroVideo.src = `https://drive.google.com/file/d/${book.video_drive_id}/preview`;

    // ── STEP 3: After 3 seconds, fade poster → reveal video ──
    setTimeout(() => {
      heroPoster.classList.add("fade-out");
      // Make title subtle so video is prominent
      if (heroOverlay) heroOverlay.classList.add("subtle");
    }, 3000);
  } else {
    // No video — show poster + info layout (NO duplicate Read PDF)
    heroVideo.style.display = "none";
    heroPoster.style.display = "none";
    heroSection.classList.add("no-video-state");

    const posterUrl = hasPoster(book)
      ? `https://drive.google.com/thumbnail?id=${book.poster_drive_id}&sz=w800`
      : `https://drive.google.com/thumbnail?id=${book.cover_drive_id}&sz=w800`;

    heroSection.innerHTML = `
      <div class="hero-no-video-content">
        <img src="${posterUrl}" alt="${book.title}" class="hero-no-video-poster" referrerpolicy="no-referrer" />
        <div class="hero-no-video-info">
          <h1>${book.title}</h1>
          <div class="info-meta">
            <span class="match-badge">98% Match</span>
            <span class="rating-badge">U/A 13+</span>
            <span class="category-badge">${book.category || "Fiction"}</span>
          </div>
          <p class="info-description">${truncateText(book.description, 160)}</p>
        </div>
      </div>
      <div class="hero-gradient-bottom"></div>
    `;
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

  const formats = ["PDF"];
  if (hasVideo(book)) formats.push("Video Preview");
  document.getElementById("meta-format").textContent = formats.join(", ");

  const readBtn = document.getElementById("btn-read-pdf");
  if (readBtn) {
    readBtn.addEventListener("click", () => {
      window.location.href = `view-pdf.html?id=${encodeURIComponent(book.pdf_drive_id)}&title=${encodeURIComponent(book.title)}`;
    });
  }

  document.title = `${book.title} — PDF Library`;
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

  document.getElementById("detail-format").textContent = "PDF Document";
  document.getElementById("detail-video-status").textContent = hasVideo(book)
    ? "✓ Available"
    : "—  Not available";

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
  limit = limit || 15;

  const sameCat = allBooks.filter(
    (b) => b.category === currentBook.category && b.id !== currentBook.id
  );
  const others = allBooks.filter(
    (b) => b.category !== currentBook.category && b.id !== currentBook.id
  );

  const recommendations = [...sameCat, ...others].slice(0, limit);
  container.innerHTML = "";

  recommendations.forEach((book) => {
    const card = document.createElement("div");
    card.className = "reco-card";

    const imgId = hasPoster(book) ? book.poster_drive_id : book.cover_drive_id;
    const imgUrl = `https://drive.google.com/thumbnail?id=${imgId}&sz=w400`;

    card.innerHTML = `
      <img src="${imgUrl}" alt="${book.title}" referrerpolicy="no-referrer" loading="lazy" />
      <div class="reco-card-info">
        <div class="reco-card-title">${book.title}</div>
        <div class="reco-card-author">${book.author || ""}</div>
        <span class="reco-card-category">${book.category || ""}</span>
      </div>
    `;

    card.addEventListener("click", () => {
      window.location.href = `book-detail.html?id=${book.id}&title=${encodeURIComponent(book.title)}`;
    });

    container.appendChild(card);
  });
}

// ═══════════════════════════════════════════
// RENDER TRENDING
// ═══════════════════════════════════════════
function renderTrending(allBooks, currentBook) {
  const container = document.getElementById("trending-row");
  const titleEl = document.getElementById("trending-title");
  if (!container || !titleEl) return;

  const otherCategories = [
    ...new Set(allBooks.map((b) => b.category)),
  ].filter((c) => c !== currentBook.category);

  if (otherCategories.length === 0) {
    document.getElementById("trending-section").classList.add("hidden");
    return;
  }

  const randomCat =
    otherCategories[Math.floor(Math.random() * otherCategories.length)];
  titleEl.textContent = `More in ${randomCat}`;

  const trendingBooks = allBooks
    .filter((b) => b.category === randomCat && b.id !== currentBook.id)
    .slice(0, 12);

  container.innerHTML = "";

  trendingBooks.forEach((book) => {
    const card = document.createElement("div");
    card.className = "reco-card";

    const imgId = hasPoster(book) ? book.poster_drive_id : book.cover_drive_id;
    const imgUrl = `https://drive.google.com/thumbnail?id=${imgId}&sz=w400`;

    card.innerHTML = `
      <img src="${imgUrl}" alt="${book.title}" referrerpolicy="no-referrer" loading="lazy" />
      <div class="reco-card-info">
        <div class="reco-card-title">${book.title}</div>
        <div class="reco-card-author">${book.author || ""}</div>
        <span class="reco-card-category">${book.category || ""}</span>
      </div>
    `;

    card.addEventListener("click", () => {
      window.location.href = `book-detail.html?id=${book.id}&title=${encodeURIComponent(book.title)}`;
    });

    container.appendChild(card);
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

  renderHero(book);
  renderInfo(book);
  renderDetails(book);
  renderRecommendations(allBooks, book, "reco-row", 15);
  renderTrending(allBooks, book);
  setupScrollArrows();
  setupNavScroll();

  window.scrollTo(0, 0);
}

init();
