try {
/**
 * Premium Custom Document Engine (Continuous Scrolling)
 * Uses PDF.js to render documents natively, providing a fully transparent, seamless UI experience.
 */

let pdfDoc = null;
let currentScale = 1.0;
let fitMode = 'fit';
let baseViewport = null;
let currentPage = 1;
let contentWidthFactor = 1.0;

let searchIndex = null;
let searchIndexPromise = null;
let pageTextCache = new Map();

const pdfPageContainer = document.getElementById('pdf-page-container');
const pageNumInput = document.getElementById('page-num');
const pageCountSpan = document.getElementById('page-count');
const zoomSelect = document.getElementById('zoom-select');
const loadingOverlay = document.getElementById('pdf-loading');

const sidebar = document.getElementById('pdf-sidebar');
const showSidebarBtn = document.getElementById('show-sidebar-btn');
const hideSidebarBtn = document.getElementById('hide-sidebar-btn');

let pageObserver = null;
let renderObserver = null;

let isPreviewMode = false;
const PREVIEW_PAGE_LIMIT = Math.min(
    50,
    Math.max(1, Math.floor(Number(window.VIEWER_PREVIEW_PAGE_LIMIT || 10)) || 10)
);
function resolveApiOrigin() {
    const configured = String(
        window.PDF_LIBRARY_CONFIG?.API_ORIGIN ||
        window.PDF_LIBRARY_API_BASE_URL ||
        ''
    ).trim();
    if (configured) return configured.replace(/\/+$/, '');

    const host = String(window.location.hostname || '').toLowerCase();
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    return isLocal
        ? `${window.location.protocol}//${window.location.hostname}:3000`
        : String(window.location.origin || '').replace(/\/+$/, '');
}

const API_ORIGIN = resolveApiOrigin();
const ACTIVE_EMAIL_KEY = 'pdf_lib_active_email';
const SESSION_TOKEN_KEY_PREFIX = 'pdf_lib_session_token_v1';

function normalizeEmailKey(email) {
    return String(email || '').trim().toLowerCase();
}

function getReaderSessionHeaders() {
    const email = normalizeEmailKey(localStorage.getItem(ACTIVE_EMAIL_KEY));
    if (!email) return {};

    const token = String(
        localStorage.getItem(`${SESSION_TOKEN_KEY_PREFIX}::${email}`) || ''
    ).trim();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function parseBookDocumentToken(documentId) {
    const match = String(documentId || '').trim().match(/^book:(\d+):pdf$/);
    return match ? match[1] : '';
}

function buildPdfApiPath(documentId, isPreview) {
    const bookId = parseBookDocumentToken(documentId);
    if (bookId) {
        return isPreview
            ? `${API_ORIGIN}/api/pdfs/book/${encodeURIComponent(bookId)}/preview`
            : `${API_ORIGIN}/api/pdfs/book/${encodeURIComponent(bookId)}/stream`;
    }

    return isPreview
        ? `${API_ORIGIN}/api/pdfs/preview/${encodeURIComponent(documentId)}`
        : `${API_ORIGIN}/api/pdfs/stream/${encodeURIComponent(documentId)}`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getState() {
    const totalPages = pdfDoc ? pdfDoc.numPages : 0;
    const readablePages = pdfDoc ? (isPreviewMode ? Math.min(PREVIEW_PAGE_LIMIT, pdfDoc.numPages) : pdfDoc.numPages) : 0;
    const safePage = totalPages > 0 ? clamp(currentPage, 1, totalPages) : 1;
    const progress = totalPages > 0 ? Math.round((safePage / totalPages) * 100) : 0;

    return {
        currentPage: safePage,
        totalPages,
        readablePages,
        progress,
        isPreviewMode,
        fitMode,
        currentScale,
        contentWidthFactor
    };
}

function notifyStateChange() {
    document.dispatchEvent(new CustomEvent('reader:state', { detail: getState() }));
}

function countOccurrences(haystack, needle) {
    if (!needle) return 0;
    let fromIndex = 0;
    let count = 0;
    while (true) {
        const idx = haystack.indexOf(needle, fromIndex);
        if (idx === -1) break;
        count += 1;
        fromIndex = idx + needle.length;
    }
    return count;
}

function extractSnippet(source, matchIndex, matchLength) {
    const radius = 62;
    const start = Math.max(0, matchIndex - radius);
    const end = Math.min(source.length, matchIndex + matchLength + radius);
    const prefix = start > 0 ? '... ' : '';
    const suffix = end < source.length ? ' ...' : '';
    return `${prefix}${source.slice(start, end).trim()}${suffix}`;
}

function renderSimpleTextLayer(container, textContent, viewport) {
    const textDivs = [];
    const styles = textContent.styles || {};

    for (const item of textContent.items || []) {
        const text = item.str || '';
        if (!text.trim()) continue;

        const textDiv = document.createElement('span');
        textDiv.textContent = text;

        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const angle = Math.atan2(tx[1], tx[0]);
        const fontHeight = Math.hypot(tx[2], tx[3]);
        const horizontalScale = fontHeight > 0 ? Math.hypot(tx[0], tx[1]) / fontHeight : 1;

        const style = styles[item.fontName] || {};
        textDiv.style.left = `${tx[4]}px`;
        textDiv.style.top = `${tx[5] - fontHeight}px`;
        textDiv.style.fontSize = `${fontHeight || 10}px`;
        textDiv.style.fontFamily = style.fontFamily || 'serif';
        textDiv.style.transform = `rotate(${angle}rad) scaleX(${horizontalScale || 1})`;

        container.appendChild(textDiv);
        textDivs.push(textDiv);
    }

    return textDivs;
}

async function ensureSearchIndex() {
    if (searchIndex) {
        return searchIndex;
    }

    if (searchIndexPromise) {
        return searchIndexPromise;
    }

    searchIndexPromise = (async () => {
        if (!pdfDoc) return [];

        const indexedPages = [];

        for (let i = 1; i <= pdfDoc.numPages; i += 1) {
            const plainText = await extractPlainTextFromPage(i);

            indexedPages.push({
                page: i,
                text: plainText,
                textLower: plainText.toLowerCase()
            });
        }

        searchIndex = indexedPages;
        return indexedPages;
    })().finally(() => {
        searchIndexPromise = null;
    });

    return searchIndexPromise;
}

async function extractPlainTextFromPage(pageNumber) {
    const safePage = clamp(Math.floor(Number(pageNumber || 1)), 1, pdfDoc ? pdfDoc.numPages : 1);
    if (pageTextCache.has(safePage)) {
        return pageTextCache.get(safePage);
    }

    if (!pdfDoc) return '';
    const page = await pdfDoc.getPage(safePage);
    const textContent = await page.getTextContent();
    const plainText = textContent.items
        .map((entry) => (entry.str || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    pageTextCache.set(safePage, plainText);
    return plainText;
}

async function searchDocument(rawQuery, maxResults = 40) {
    const query = (rawQuery || '').trim().toLowerCase();
    if (!query) return [];

    const index = await ensureSearchIndex();
    const results = [];

    for (const pageEntry of index) {
        const firstMatch = pageEntry.textLower.indexOf(query);
        if (firstMatch === -1) continue;

        results.push({
            page: pageEntry.page,
            count: countOccurrences(pageEntry.textLower, query),
            snippet: extractSnippet(pageEntry.text, firstMatch, query.length)
        });

        if (results.length >= maxResults) break;
    }

    return results;
}

async function getPageText(pageNumber = currentPage) {
    const requestedPage = clamp(Math.floor(Number(pageNumber || currentPage || 1)), 1, pdfDoc ? pdfDoc.numPages : 1);
    if (searchIndex) {
        return searchIndex.find((entry) => Number(entry.page) === requestedPage)?.text || '';
    }
    return extractPlainTextFromPage(requestedPage);
}

async function getDocumentText(options = {}) {
    const maxChars = Math.max(2000, Math.min(50000, Math.floor(Number(options.maxChars || 18000))));
    const maxPages = Math.max(1, Math.min(80, Math.floor(Number(options.maxPages || 40))));
    const totalPages = pdfDoc ? pdfDoc.numPages : 0;
    const pagesToRead = Math.min(totalPages, maxPages);
    const parts = [];
    let usedChars = 0;

    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
        const pageText = String(await extractPlainTextFromPage(pageNumber) || '').trim();
        if (!pageText) continue;
        const label = `Page ${pageNumber}: ${pageText}`;
        const remaining = maxChars - usedChars;
        if (remaining <= 0) break;
        parts.push(label.length > remaining ? label.slice(0, remaining).trim() : label);
        usedChars += parts[parts.length - 1].length;
    }

    if (totalPages > maxPages || usedChars >= maxChars) {
        parts.push(`[Only the first ${pagesToRead} page(s) or ${maxChars} characters were sent to the AI.]`);
    }

    return parts.join('\n\n');
}

// Initialize the engine
window.initCustomViewer = async function(documentId, isPreview = false) {
    isPreviewMode = isPreview;
    currentPage = 1;
    searchIndex = null;
    searchIndexPromise = null;
    pageTextCache = new Map();
    const requestedStartPage = Math.floor(Number(window.VIEWER_INITIAL_PAGE || 1));
    
    // Show spinner only if authenticated (preview mode = spinner is hidden, gate is shown instead)
    if (!isPreview) {
        loadingOverlay.style.display = 'flex';
        loadingOverlay.innerHTML = `<div class="spinner"></div>`;
    }
    
    // Remote fetch endpoint through our secure backend proxy
    const proxyUrl = buildPdfApiPath(documentId, isPreview);
    
    // ── TIMEOUT PROTECTION ──
    // Preview: 20s timeout; Full PDF: 60s timeout — prevents infinite spinner
    const TIMEOUT_MS = isPreview ? 20000 : 60000;

    try {
        // Quick connectivity check before attempting heavy PDF load
        if (!isPreview) {
            try {
                const healthCheck = await Promise.race([
                    fetch(`${API_ORIGIN}/api/health`, { mode: 'cors' }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Backend unreachable')), 5000))
                ]);
                if (!healthCheck.ok) throw new Error('Backend not healthy');
            } catch (connectError) {
                throw new Error(`Cannot connect to the library server. Please ensure the backend is running. (${connectError.message})`);
            }
        }

        const loadingTaskConfig = {
            url: proxyUrl,
            withCredentials: !isPreview,
            httpHeaders: isPreview ? {} : getReaderSessionHeaders(),
            disableRange: false,
            disableStream: false,
            disableAutoFetch: true,
            rangeChunkSize: 65536,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'
        };

        const loadingTask = pdfjsLib.getDocument(loadingTaskConfig);
        
        // Race the PDF load against the timeout — applies to BOTH preview and full mode
        pdfDoc = await Promise.race([
            loadingTask.promise,
            new Promise((_, reject) => {
                setTimeout(() => {
                    loadingTask.destroy();
                    reject(new Error(isPreview ? 'Preview timed out' : 'Reader preparation timed out. Please try again.'));
                }, TIMEOUT_MS);
            })
        ]);
        
        pageCountSpan.textContent = pdfDoc.numPages;
        pageNumInput.max = pdfDoc.numPages;
        pageNumInput.value = "1";

        // Get base aspect ratio from page 1 to set up placeholder spacing
        const firstPage = await pdfDoc.getPage(1);
        baseViewport = firstPage.getViewport({ scale: 1.0 });

        // Build continuous scrolling DOM
        buildPageContainers();

        // Hide loader
        loadingOverlay.style.display = 'none';

        // Initialize features
        await buildThumbnails();
        await buildOutline();
        const maxAllowed = isPreviewMode ? Math.min(PREVIEW_PAGE_LIMIT, pdfDoc.numPages) : pdfDoc.numPages;
        const initialPage = clamp(requestedStartPage, 1, Math.max(1, maxAllowed));
        if (initialPage > 1) {
            goToPage(initialPage, { smooth: false });
        } else {
            notifyStateChange();
        }

    } catch (error) {
        console.error('Reader preparation error:', error);
        
        if (isPreview) {
            // For preview failure: hide the loading overlay completely
            // The sign-in gate is already showing — user just needs to sign in
            loadingOverlay.style.display = 'none';
            console.warn('[PDF Engine] Preview load failed or timed out. Sign-in gate is already shown.');
        } else {
            // For full PDF failure (authenticated): show error with retry button
            loadingOverlay.style.display = 'flex';
            const errorMsg = error?.message || 'The secure reader could not be prepared.';
            loadingOverlay.innerHTML = `<div style="text-align:center;padding:20px;max-width:400px">
                <span class="material-symbols-outlined" style="font-size:48px;color:#ff3b30;margin-bottom:12px;display:block">error</span>
                <p style="color:#ff3b30;font-size:15px;margin-bottom:8px;font-weight:500">Reader could not start</p>
                <p style="color:#999;font-size:13px;margin-bottom:20px;line-height:1.5">${escapeHtml(errorMsg)}</p>
                <button onclick="location.reload()" style="background:#3b82f6;color:white;border:none;padding:10px 28px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:500;transition:opacity 0.2s" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">Retry</button>
            </div>`;
        }
    }
};

/**
 * Build Continuous DOM structure of all pages
 */
function buildPageContainers() {
    pdfPageContainer.innerHTML = ''; // Clear any existing
    
    const maxPages = isPreviewMode ? Math.min(PREVIEW_PAGE_LIMIT, pdfDoc.numPages) : pdfDoc.numPages;

    for (let i = 1; i <= maxPages; i++) {
        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-page-wrapper';
        wrapper.id = `page-wrapper-${i}`;
        wrapper.dataset.pageNumber = i;
        
        // Exact aspect ratio for smooth scrolling placeholder
        const aspectRatio = baseViewport.width / baseViewport.height;
        wrapper.style.aspectRatio = aspectRatio.toString();
        
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page-canvas';
        wrapper.appendChild(canvas);

        const textLayer = document.createElement('div');
        textLayer.className = 'pdf-text-layer';
        textLayer.setAttribute('aria-hidden', 'true');
        wrapper.appendChild(textLayer);

        const highlightLayer = document.createElement('div');
        highlightLayer.className = 'pdf-highlight-layer';
        highlightLayer.setAttribute('aria-hidden', 'true');
        wrapper.appendChild(highlightLayer);
        
        pdfPageContainer.appendChild(wrapper);
    }
    
    if (isPreviewMode) {
        // Append gate container at end
        const gate = document.getElementById('reader-gate');
        const fade = document.getElementById('pdf-preview-fade');
        
        if (gate && fade) {
            const gateContainer = document.createElement('div');
            gateContainer.id = 'preview-gate-container';
            gateContainer.style.position = 'relative';
            gateContainer.style.width = '100%';
            gateContainer.style.display = 'flex';
            gateContainer.style.flexDirection = 'column';
            gateContainer.style.alignItems = 'center';
            gateContainer.style.zIndex = '30';
            gateContainer.style.marginTop = '-50px'; // Slight overlap
            gateContainer.style.paddingBottom = '100px';
            
            // Adjust elements
            fade.style.position = 'absolute';
            fade.style.bottom = '100%'; // Sits right above the gate
            fade.style.left = '0';
            fade.style.width = '100%';
            fade.style.height = '250px'; 
            fade.classList.remove('hidden');
            
            gate.style.display = 'flex';
            gate.style.width = '100%';
            gate.style.position = 'relative';
            gate.style.zIndex = '31';
            
            gateContainer.appendChild(fade);
            gateContainer.appendChild(gate);
            
            pdfPageContainer.appendChild(gateContainer);
        }
    }
    
    updateAllWrapperSizes();
    setupObservers();
    document.dispatchEvent(new CustomEvent('reader:pages-rebuilt'));
}

/**
 * Dynamically resize all wrappers based on current Zoom/Fitmode
 */
function updateAllWrapperSizes() {
    let containerWidth = (pdfPageContainer.clientWidth - 40) * contentWidthFactor; // padding + layout factor
    
    // Store scroll anchor to prevent page jumping
    const activePageNum = parseInt(pageNumInput.value) || 1;
    const activeWrapper = document.getElementById(`page-wrapper-${activePageNum}`);
    
    let relativeScroll = 0;
    if (activeWrapper) {
        const wrapperRect = activeWrapper.getBoundingClientRect();
        const containerRect = pdfPageContainer.getBoundingClientRect();
        const offsetFromContainerTop = containerRect.top - wrapperRect.top;
        relativeScroll = offsetFromContainerTop / wrapperRect.height;
    }

    document.querySelectorAll('.pdf-page-wrapper').forEach(wrapper => {
        let renderWidth = baseViewport.width * currentScale;
        
        if (fitMode === 'fit') {
            renderWidth = containerWidth;
            if (renderWidth / baseViewport.width > 2.0) renderWidth = baseViewport.width * 2.0; // limit stretch
        }
        
        wrapper.style.width = renderWidth + "px";
        wrapper.dataset.rendered = "false"; 
    });
    
    // Restore scroll position so the current page remains anchored
    if (activeWrapper) {
        requestAnimationFrame(() => {
            const newHeight = activeWrapper.getBoundingClientRect().height;
            const newOffset = relativeScroll * newHeight;
            pdfPageContainer.scrollTop = activeWrapper.offsetTop + newOffset - 80; // 80 is padding box
        });
    }
}

/**
 * Setup Intersection Observers to lazy load canvas render & tracker Page number UI
 */
function setupObservers() {
    // 1. Render Observer (lazily renders canvas when in view)
    renderObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const wrapper = entry.target;
                if (wrapper.dataset.rendered !== "true" && wrapper.dataset.rendering !== "true") {
                    renderPageCanvas(wrapper);
                }
            }
        });
    }, { root: pdfPageContainer, rootMargin: '300px 0px', threshold: 0.01 });

    // 2. Active Page Observer (updates the top pill "Page X / Y")
    pageObserver = new IntersectionObserver((entries) => {
        let maxRatio = 0;
        let activePageNum = null;
        
        entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            activePageNum = parseInt(entry.target.dataset.pageNumber);
        }
    });
        
        if (activePageNum && document.activeElement !== pageNumInput) {
            pageNumInput.value = activePageNum;
            currentPage = activePageNum;
            highlightActiveThumbnail(activePageNum);
            notifyStateChange();
        }
    }, { root: pdfPageContainer, threshold: [0.1, 0.4, 0.6, 0.9] });

    document.querySelectorAll('.pdf-page-wrapper').forEach(wrapper => {
        renderObserver.observe(wrapper);
        pageObserver.observe(wrapper);
    });
}

/**
 * Renders the canvas for a specific wrapper
 */
async function renderPageCanvas(wrapper) {
    const pageNum = parseInt(wrapper.dataset.pageNumber);
    wrapper.dataset.rendering = "true";
    
    try {
        const page = await pdfDoc.getPage(pageNum);
        
        // Compute correct scale relative to DOM width
        const domWidth = wrapper.clientWidth;
        const nativeViewport = page.getViewport({ scale: 1.0 });
        const renderScale = domWidth / nativeViewport.width;
        
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = wrapper.querySelector('canvas');
        const textLayer = wrapper.querySelector('.pdf-text-layer');
        const ctx = canvas.getContext('2d', { alpha: false });
        
        // Fix PDF.js 3.11+ missing scale-factor error
        wrapper.style.setProperty('--scale-factor', viewport.scale);
        if (textLayer) {
            textLayer.style.setProperty('--scale-factor', viewport.scale);
        }

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = "100%";
        canvas.style.height = "100%";

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        await page.render({
            canvasContext: ctx,
            transform: transform,
            viewport: viewport,
            background: 'white'
        }).promise;

        if (textLayer) {
            textLayer.innerHTML = '';
            const textContent = await page.getTextContent();
            let textDivs = [];

            if (typeof pdfjsLib.renderTextLayer === 'function') {
                const renderTextLayerConfig = {
                    container: textLayer,
                    viewport,
                    textDivs
                };

                try {
                    await pdfjsLib.renderTextLayer({
                        ...renderTextLayerConfig,
                        textContentSource: textContent
                    }).promise;
                } catch {
                    await pdfjsLib.renderTextLayer({
                        ...renderTextLayerConfig,
                        textContent
                    }).promise;
                }
            } else {
                textDivs = renderSimpleTextLayer(textLayer, textContent, viewport);
            }

            wrapper.classList.toggle('has-text-layer', textDivs.length > 0 || textLayer.children.length > 0);
        }
        
        wrapper.dataset.rendered = "true";
        document.dispatchEvent(new CustomEvent('reader:page-rendered', { detail: { page: pageNum } }));
    } catch(err) {
        console.error("Render error on page " + pageNum, err);
    } finally {
        wrapper.dataset.rendering = "false";
    }
}

/**
 * Go to Previous / Next / Specific Page
 */
function goToPage(num, options = {}) {
    const maxAllowed = isPreviewMode ? Math.min(PREVIEW_PAGE_LIMIT, pdfDoc.numPages) : pdfDoc.numPages;
    if (num <= 0 || num > maxAllowed) return;
    const wrapper = document.getElementById(`page-wrapper-${num}`);
    if (wrapper) {
        const smooth = options && options.smooth === false ? 'auto' : 'smooth';
        wrapper.scrollIntoView({ behavior: smooth });
        pageNumInput.value = num;
        currentPage = num;
        highlightActiveThumbnail(num);
        notifyStateChange();
    }
}

function setContentWidth(nextFactor) {
    contentWidthFactor = clamp(nextFactor, 0.65, 1.05);
    updateAllWrapperSizes();
    notifyStateChange();
}

function adjustScale(delta) {
    if (fitMode === 'fit') {
        currentScale = 1.0;
        fitMode = 'custom';
    }
    currentScale = clamp(currentScale + delta, 0.5, 3.0);
    zoomSelect.value = "custom";
    updateAllWrapperSizes();
    notifyStateChange();
}


/**
 * UI Event Listeners
 */

// Custom Zoom Controls
document.getElementById('zoom-in').addEventListener('click', () => {
    adjustScale(0.25);
});

document.getElementById('zoom-out').addEventListener('click', () => {
    adjustScale(-0.25);
});

// Dropdown Zoom
zoomSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'fit') {
        fitMode = 'fit';
    } else {
        fitMode = 'custom';
        currentScale = parseFloat(val);
    }
    updateAllWrapperSizes();
    notifyStateChange();
});

// Page Number Input Jump
pageNumInput.addEventListener('change', (e) => {
    let requested = parseInt(e.target.value);
    if (isNaN(requested)) return;
    if (requested < 1) requested = 1;
    const maxAllowed = isPreviewMode ? Math.min(PREVIEW_PAGE_LIMIT, pdfDoc.numPages) : pdfDoc.numPages;
    if (requested > maxAllowed) requested = maxAllowed;
    goToPage(requested);
});

// Responsive resize listener: when container width changes significantly, update Fit
let resizeTimeout;
window.addEventListener('resize', () => {
    if (fitMode === 'fit' && pdfDoc) {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updateAllWrapperSizes();
        }, 200);
    }
});

// Sidebar Toggles
  hideSidebarBtn.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    document.body.classList.remove('book-sidebar-open');
    showSidebarBtn.classList.remove('hidden');
    setTimeout(() => { if(fitMode==='fit') updateAllWrapperSizes(); }, 350); 
  });

  showSidebarBtn.addEventListener('click', () => {
    if (typeof window.closeAiSidebarForBookPanel === 'function') {
        window.closeAiSidebarForBookPanel();
    }
    sidebar.classList.remove('collapsed');
    document.body.classList.add('book-sidebar-open');
    showSidebarBtn.classList.add('hidden');
    setTimeout(() => { if(fitMode==='fit') updateAllWrapperSizes(); }, 350);
  });
  document.body.classList.toggle('book-sidebar-open', !sidebar.classList.contains('collapsed'));

// Sidebar Tabs Toggle
const tabThumbnails = document.getElementById('tab-thumbnails');
const tabChapters = document.getElementById('tab-chapters');
const viewThumbnails = document.getElementById('thumbnails-view');
const viewChapters = document.getElementById('chapters-view');

tabThumbnails.addEventListener('click', () => {
    tabThumbnails.classList.add('active');
    tabChapters.classList.remove('active');
    viewThumbnails.classList.add('active');
    viewChapters.classList.remove('active');
});

tabChapters.addEventListener('click', () => {
    tabChapters.classList.add('active');
    tabThumbnails.classList.remove('active');
    viewChapters.classList.add('active');
    viewThumbnails.classList.remove('active');
});

/**
 * Build Thumbnails Sidebar Structure
 */
async function buildThumbnails() {
    const maxPages = isPreviewMode ? Math.min(PREVIEW_PAGE_LIMIT, pdfDoc.numPages) : pdfDoc.numPages;
    for (let i = 1; i <= maxPages; i++) {
        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'thumbnail-item';
        thumbDiv.id = `thumb-wrapper-${i}`;
        
        const label = document.createElement('span');
        label.className = 'thumb-label';
        label.textContent = i;
        
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.className = 'thumb-canvas';
        thumbCanvas.id = `thumb-${i}`;
        
        thumbCanvas.addEventListener('click', () => {
            goToPage(i);
        });

        thumbDiv.appendChild(label);
        thumbDiv.appendChild(thumbCanvas);
        viewThumbnails.appendChild(thumbDiv);
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const idNum = parseInt(entry.target.id.split('-').pop());
                renderThumbnail(idNum);
                observer.unobserve(entry.target);
            }
        });
    }, { root: viewThumbnails, rootMargin: '100px' });

    for (let i = 1; i <= maxPages; i++) {
        observer.observe(document.getElementById(`thumb-wrapper-${i}`));
    }
    
    highlightActiveThumbnail(1);
}

/**
 * Render single thumbnail canvas
 */
async function renderThumbnail(pageNo) {
    try {
        const page = await pdfDoc.getPage(pageNo);
        const viewport = page.getViewport({ scale: 0.25 }); 
        const thumbCanvas = document.getElementById(`thumb-${pageNo}`);
        const thumbCtx = thumbCanvas.getContext('2d');
        
        thumbCanvas.height = viewport.height;
        thumbCanvas.width = viewport.width;

        await page.render({
            canvasContext: thumbCtx,
            viewport: viewport,
            background: 'white'
        }).promise;
    } catch(err) {
        console.error("Thumbnail error", err);
    }
}

/**
 * Highlight active thumbnail
 */
function highlightActiveThumbnail(num) {
    document.querySelectorAll('.thumbnail-item').forEach(el => el.classList.remove('active'));
    const activeThumb = document.getElementById(`thumb-wrapper-${num}`);
    if (activeThumb) {
        activeThumb.classList.add('active');
        // Prevent aggressive auto-scroll if user is scrolling manually 
        // to not hijack the sidebar scroll unless clicked
    }
}

/**
 * Extract and build Document Outline (Chapters)
 */
async function buildOutline() {
    try {
        const outline = await pdfDoc.getOutline();
        if (!outline || outline.length === 0) {
            viewChapters.innerHTML = '<p class="no-outline">No chapters embedded in document.</p>';
            return;
        }

        const ul = document.createElement('ul');
        ul.className = 'chapter-list';
        buildOutlineTree(outline, ul);
        viewChapters.appendChild(ul);
    } catch(err) {
        console.error("Outline error", err);
        viewChapters.innerHTML = '<p class="no-outline">Chapters outline unavailable.</p>';
    }
}

function buildOutlineTree(items, container) {
    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'chapter-item';
        
        const btn = document.createElement('button');
        btn.textContent = item.title;
        btn.addEventListener('click', async () => {
            let dest = item.dest;
            if (typeof dest === 'string') {
                dest = await pdfDoc.getDestination(dest);
            }
            if (dest) {
                const targetRef = dest[0];
                const pageIndex = await pdfDoc.getPageIndex(targetRef);
                goToPage(pageIndex + 1);
            }
        });
        
        li.appendChild(btn);

        if (item.items && item.items.length > 0) {
            const nestedUl = document.createElement('ul');
            nestedUl.className = 'chapter-nested';
            buildOutlineTree(item.items, nestedUl);
            li.appendChild(nestedUl);
        }

        container.appendChild(li);
    });
}

/**
 * Unlock PDF Engine and Rebuild
 */
window.unlockPdfEngine = async function() {
    if (!isPreviewMode) return;
    isPreviewMode = false;
    notifyStateChange();
    
    // Animate gate unlocking out
    const gateContainer = document.getElementById('preview-gate-container');
    const gate = document.getElementById('reader-gate');
    
    if (gate) {
        gate.classList.add('unlocking');
    }
    
    // Show success badge
    const badge = document.createElement("div");
    badge.className = "unlock-success-badge";
    badge.innerHTML = `<span class="material-symbols-outlined">lock_open</span> Full book unlocked`;
    document.body.appendChild(badge);
    
    // After animation, rebuild full DOM
    setTimeout(() => {
        if (badge) badge.remove();
        
        // Move gate elements back out so they don't get destroyed by innerHTML=''
        const fade = document.getElementById('pdf-preview-fade');
        if (fade && gate) {
            fade.classList.add('hidden');
            fade.style.position = 'absolute';
            fade.style.top = '';
            fade.style.bottom = '0';
            
            gate.style.display = 'none';
            gate.style.marginTop = '';
            gate.classList.remove('unlocking');
            
            const readerPage = document.getElementById('reader-page');
            readerPage.appendChild(fade);
            readerPage.appendChild(gate);
        }
        
        buildPageContainers();
        
        // Rebuild thumbnails for remaining pages
        viewThumbnails.innerHTML = '';
        buildThumbnails();
        notifyStateChange();
        
    }, 480);
};

window.readerEngine = {
    getState,
    goToPage,
    searchDocument,
    ensureSearchIndex,
    getPageText,
    getDocumentText,
    setContentWidthFactor: setContentWidth,
    adjustScale,
    setFitMode(mode) {
        if (mode === 'fit') {
            fitMode = 'fit';
        } else if (mode === 'custom') {
            fitMode = 'custom';
        }
        updateAllWrapperSizes();
        notifyStateChange();
    }
};

window.PDF_LIBRARY_READER_CONTEXT = window.readerEngine;
window.getPdfReaderState = getState;
window.getPdfPageText = getPageText;
window.getPdfDocumentText = getDocumentText;

} catch(e) { console.error('PDF ENGINE CRASH: ', e.stack); window._ENGINE_ERROR = e.stack; }
