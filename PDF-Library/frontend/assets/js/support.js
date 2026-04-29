(function attachSupportPad() {
  const els = {
    form: document.getElementById("support-form"),
    amount: document.getElementById("support-amount"),
    quickAmounts: document.getElementById("support-quick-amounts"),
    localEstimate: document.getElementById("support-local-estimate"),
    name: document.getElementById("support-name"),
    email: document.getElementById("support-email"),
    message: document.getElementById("support-message"),
    submit: document.getElementById("support-submit-btn"),
    status: document.getElementById("support-status"),
    supportersList: document.getElementById("supporters-list"),
    recordBtn: document.getElementById("support-record-btn"),
    stopBtn: document.getElementById("support-stop-btn"),
    clearMediaBtn: document.getElementById("support-clear-media-btn"),
    recordStatus: document.getElementById("support-record-status"),
    mediaPreview: document.getElementById("support-media-preview"),
  };

  if (!els.form) return;

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
  const DEFAULT_QUICK_AMOUNTS = [100, 9900, 24900];
  const DEFAULT_MIN_AMOUNT_PAISE = 100;
  const DEFAULT_MAX_AMOUNT_PAISE = 10000000;
  const REQUEST_TIMEOUT_MS = 20000;
  const MAX_RECORDING_MS = 60 * 1000;
  const COUNTRY_TO_CURRENCY = {
    US: "USD",
    CA: "CAD",
    GB: "GBP",
    EU: "EUR",
    DE: "EUR",
    FR: "EUR",
    IT: "EUR",
    ES: "EUR",
    AE: "AED",
    AU: "AUD",
    NZ: "NZD",
    SG: "SGD",
    NP: "NPR",
    BD: "BDT",
    PK: "PKR",
    LK: "LKR",
    JP: "JPY",
    KR: "KRW",
    ZA: "ZAR",
    IN: "INR",
  };
  const INR_TO_LOCAL = {
    USD: 0.012,
    CAD: 0.016,
    GBP: 0.0096,
    EUR: 0.011,
    AED: 0.044,
    AUD: 0.018,
    NZD: 0.02,
    SGD: 0.016,
    NPR: 1.6,
    BDT: 1.32,
    PKR: 3.35,
    LKR: 3.6,
    JPY: 1.86,
    KRW: 16.4,
    ZAR: 0.22,
    INR: 1,
  };

  let supportConfig = null;
  let selectedMode = "video";
  let mediaRecorder = null;
  let mediaChunks = [];
  let mediaBlob = null;
  let mediaMimeType = "";
  let mediaObjectUrl = "";
  let activeStream = null;
  let recordTimer = null;
  let recordStartedAt = 0;

  function buildApiUrl(path) {
    return `${API_ORIGIN}${path}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function readJsonResponse(response) {
    return response.json().catch(() => ({})).then((data) => {
      if (!response.ok) throw new Error(data?.error || "Support request failed.");
      return data;
    });
  }

  function normalizeFetchError(error) {
    const message = String(error?.message || "");
    if (error?.name === "AbortError") {
      return new Error("Payment server is taking too long to respond. Please wait a few seconds and try again.");
    }
    if (error instanceof TypeError || message.toLowerCase().includes("failed to fetch")) {
      return new Error("Payment server is not reachable right now. Please wait 30 seconds, refresh, and try again.");
    }
    return error;
  }

  async function fetchSupportJson(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(buildApiUrl(path), {
        ...options,
        signal: controller.signal,
      });
      return await readJsonResponse(response);
    } catch (error) {
      throw normalizeFetchError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  function formatMoney(amountPaise, currency = "INR") {
    if (window.PdfLibraryPayments?.formatMoney) {
      return window.PdfLibraryPayments.formatMoney(amountPaise, currency);
    }
    const amount = Number(amountPaise || 0) / 100;
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
      }).format(amount);
    } catch {
      return `INR ${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
    }
  }

  function normalizeAmountValue(value) {
    const cleaned = String(value || "")
      .replace(/,/g, "")
      .replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length <= 1) return parts[0] || "";
    return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
  }

  function readAmountRupees() {
    const normalized = normalizeAmountValue(els.amount?.value || "");
    return normalized ? Number(normalized) : NaN;
  }

  function getActiveUser() {
    try {
      const activeEmail = String(localStorage.getItem("pdf_lib_active_email") || "").trim().toLowerCase();
      const accounts = JSON.parse(localStorage.getItem("pdf_lib_accounts") || "[]");
      return Array.isArray(accounts)
        ? accounts.find((account) => String(account?.email || "").trim().toLowerCase() === activeEmail) || null
        : null;
    } catch {
      return null;
    }
  }

  function prefillFromUser() {
    const user = getActiveUser();
    if (!user) return;
    if (els.name && !els.name.value.trim()) {
      els.name.value = user.name || user.given_name || "";
    }
    if (els.email && !els.email.value.trim()) {
      els.email.value = user.email || "";
    }
  }

  function inferLocalCurrency() {
    const language = navigator.languages?.[0] || navigator.language || "en-IN";
    const regionMatch = String(language).toUpperCase().match(/-([A-Z]{2})$/);
    const region = regionMatch ? regionMatch[1] : "IN";
    return COUNTRY_TO_CURRENCY[region] || "INR";
  }

  function formatLocalAmount(amountInr, currency) {
    const rate = INR_TO_LOCAL[currency] || 1;
    const localAmount = amountInr * rate;
    try {
      return {
        currency,
        amount: localAmount,
        text: new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
          maximumFractionDigits: localAmount >= 100 ? 0 : 2,
        }).format(localAmount),
      };
    } catch {
      return {
        currency: "INR",
        amount: amountInr,
        text: formatMoney(Math.round(amountInr * 100), "INR"),
      };
    }
  }

  function updateEstimate() {
    const amountInr = readAmountRupees();
    if (!Number.isFinite(amountInr) || amountInr <= 0) {
      els.localEstimate.textContent = "Estimated in your currency; charged securely in INR.";
      return null;
    }

    const currency = inferLocalCurrency();
    if (currency === "INR") {
      els.localEstimate.textContent = `${formatMoney(Math.round(amountInr * 100), "INR")} will be charged securely in INR.`;
      return { currency: "INR", amount: amountInr };
    }

    const local = formatLocalAmount(amountInr, currency);
    els.localEstimate.textContent = `Approx. ${local.text}; checkout charges ${formatMoney(Math.round(amountInr * 100), "INR")} in INR.`;
    return local;
  }

  function setStatus(message, type = "") {
    els.status.textContent = message || "";
    els.status.className = `support-status${type ? ` ${type}` : ""}`;
  }

  function setCheckoutEnabled(enabled) {
    els.submit.disabled = !enabled;
    if (!enabled) {
      els.submit.title = "Support checkout is not enabled yet.";
    } else {
      els.submit.removeAttribute("title");
    }
  }

  function setRecorderEnabled(enabled) {
    document.querySelectorAll("[data-support-mode]").forEach((button) => {
      button.disabled = !enabled;
    });
    els.recordBtn.disabled = !enabled;
    els.clearMediaBtn.disabled = !enabled || !mediaBlob;
    if (!enabled) {
      els.stopBtn.disabled = true;
      els.recordStatus.textContent = "Audio/video messages need Drive setup";
    } else if (!mediaBlob) {
      els.recordStatus.textContent = "Optional short message";
    }
  }

  function renderQuickAmounts(amountsPaise) {
    const amounts = Array.isArray(amountsPaise) && amountsPaise.length
      ? amountsPaise
      : DEFAULT_QUICK_AMOUNTS;
    els.quickAmounts.innerHTML = amounts.slice(0, 3).map((amountPaise) => {
      const rupees = Math.round(Number(amountPaise || 0) / 100);
      return `<button type="button" data-support-amount="${rupees}">+${formatMoney(amountPaise, "INR")}</button>`;
    }).join("");

    els.quickAmounts.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        els.amount.value = button.dataset.supportAmount || "";
        els.quickAmounts.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        updateEstimate();
      });
    });
  }

  async function loadSupportConfig() {
    try {
      supportConfig = await fetchSupportJson("/api/support/config", {
        credentials: "include",
      });
      renderQuickAmounts(supportConfig.quickAmountsPaise);
      if (!els.amount.value) {
        els.amount.value = Math.round(Number((supportConfig.quickAmountsPaise || DEFAULT_QUICK_AMOUNTS)[0]) / 100);
      }
      els.amount.min = String(Math.ceil(Number(supportConfig.minAmountPaise || 100) / 100));
      setCheckoutEnabled(Boolean(supportConfig.supportEnabled));
      setRecorderEnabled(Boolean(supportConfig.mediaEnabled));
      if (!supportConfig.supportEnabled) {
        setStatus("Support checkout will turn on after Razorpay and support tables are configured.", "error");
      }
      updateEstimate();
    } catch (error) {
      supportConfig = {
        minAmountPaise: DEFAULT_MIN_AMOUNT_PAISE,
        maxAmountPaise: DEFAULT_MAX_AMOUNT_PAISE,
        quickAmountsPaise: DEFAULT_QUICK_AMOUNTS,
        supportEnabled: false,
        mediaEnabled: false,
      };
      renderQuickAmounts(DEFAULT_QUICK_AMOUNTS);
      if (!els.amount.value) {
        els.amount.value = "1";
      }
      setCheckoutEnabled(false);
      setRecorderEnabled(false);
      setStatus(normalizeFetchError(error).message, "error");
      updateEstimate();
    }
  }

  async function loadRecentSupporters() {
    try {
      const data = await fetchSupportJson("/api/support/recent?limit=8", {
        credentials: "include",
      });
      const supporters = Array.isArray(data.supporters) ? data.supporters : [];
      if (!supporters.length) {
        els.supportersList.innerHTML = `<div class="supporter-empty">Be the first person to support this library.</div>`;
        return;
      }

      els.supportersList.innerHTML = supporters.map((supporter) => {
        const label = supporter.handle
          ? `${supporter.name} · ${supporter.handle}`
          : supporter.name;
        return `
          <div class="supporter-item">
            <div class="supporter-item-top">
              <div class="supporter-name">${escapeHtml(label)}</div>
              <div class="supporter-amount">${escapeHtml(formatMoney(supporter.amountPaise, supporter.currency || "INR"))}</div>
            </div>
            <div class="supporter-message">${escapeHtml(supporter.message || "Supported the E-Library mission.")}</div>
          </div>
        `;
      }).join("");
    } catch {
      els.supportersList.innerHTML = `<div class="supporter-empty">Recent supporters are unavailable right now.</div>`;
    }
  }

  function getSupportedMimeType(mode) {
    const candidates = mode === "video"
      ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
      : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

    if (!window.MediaRecorder?.isTypeSupported) {
      return "";
    }
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  function stopActiveStream() {
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      activeStream = null;
    }
  }

  function clearMedia() {
    if (mediaObjectUrl) {
      URL.revokeObjectURL(mediaObjectUrl);
      mediaObjectUrl = "";
    }
    mediaBlob = null;
    mediaMimeType = "";
    mediaChunks = [];
    els.mediaPreview.innerHTML = "";
    els.mediaPreview.classList.add("hidden");
    els.clearMediaBtn.disabled = true;
    els.recordStatus.textContent = "Optional short message";
  }

  function renderMediaPreview() {
    if (!mediaBlob) return;
    if (mediaObjectUrl) URL.revokeObjectURL(mediaObjectUrl);
    mediaObjectUrl = URL.createObjectURL(mediaBlob);
    const isVideo = mediaBlob.type.startsWith("video/");
    els.mediaPreview.innerHTML = isVideo
      ? `<video src="${mediaObjectUrl}" controls playsinline></video>`
      : `<audio src="${mediaObjectUrl}" controls></audio>`;
    els.mediaPreview.classList.remove("hidden");
    els.clearMediaBtn.disabled = false;
    els.recordStatus.textContent = `${isVideo ? "Video" : "Audio"} message ready`;
  }

  function stopRecording() {
    if (recordTimer) {
      clearInterval(recordTimer);
      recordTimer = null;
    }
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStatus("This browser does not support recording.", "error");
      return;
    }

    clearMedia();
    stopActiveStream();
    const mimeType = getSupportedMimeType(selectedMode);
    try {
      activeStream = await navigator.mediaDevices.getUserMedia(
        selectedMode === "video"
          ? { video: { facingMode: "user" }, audio: true }
          : { audio: true, video: false },
      );
      mediaChunks = [];
      mediaRecorder = new MediaRecorder(activeStream, mimeType ? { mimeType } : undefined);
      mediaMimeType = mimeType || mediaRecorder.mimeType || (selectedMode === "video" ? "video/webm" : "audio/webm");
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) mediaChunks.push(event.data);
      });
      mediaRecorder.addEventListener("stop", () => {
        mediaBlob = new Blob(mediaChunks, { type: mediaMimeType });
        stopActiveStream();
        els.recordBtn.disabled = false;
        els.stopBtn.disabled = true;
        renderMediaPreview();
      });

      mediaRecorder.start();
      recordStartedAt = Date.now();
      els.recordBtn.disabled = true;
      els.stopBtn.disabled = false;
      recordTimer = setInterval(() => {
        const elapsed = Math.round((Date.now() - recordStartedAt) / 1000);
        els.recordStatus.textContent = `Recording ${elapsed}s / 60s`;
        if (elapsed >= 60) stopRecording();
      }, 500);
    } catch (error) {
      stopActiveStream();
      els.recordBtn.disabled = false;
      els.stopBtn.disabled = true;
      setStatus(error?.message || "Camera or microphone permission was blocked.", "error");
    }
  }

  async function submitSupport(event) {
    event.preventDefault();
    const amountRupees = readAmountRupees();
    const minRupees = Math.ceil(Number(supportConfig?.minAmountPaise || 100) / 100);
    if (!Number.isFinite(amountRupees) || amountRupees < minRupees) {
      setStatus(`Please choose at least ${formatMoney(minRupees * 100, "INR")}.`, "error");
      return;
    }
    if (!window.PdfLibraryPayments?.startSupportCheckout) {
      setStatus("Payment tools are still loading. Please try again.", "error");
      return;
    }

    const local = updateEstimate();
    const activeUser = getActiveUser();
    const originalText = els.submit.innerHTML;
    els.submit.disabled = true;
    els.submit.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">hourglass_empty</span> Processing`;
    setStatus("Opening secure Razorpay checkout...");

    try {
      const result = await window.PdfLibraryPayments.startSupportCheckout({
        amountPaise: Math.round(amountRupees * 100),
        amountRupees,
        name: els.name.value.trim(),
        email: els.email.value.trim(),
        handle: els.name.value.trim().startsWith("@") ? els.name.value.trim() : "",
        message: els.message.value.trim(),
        localCurrency: local?.currency || "INR",
        localAmount: local?.amount || amountRupees,
        user: activeUser,
      });

      if (mediaBlob && result.supportUploadToken && window.PdfLibraryPayments.uploadSupportMedia) {
        setStatus("Payment received. Uploading your media message...");
        try {
          await window.PdfLibraryPayments.uploadSupportMedia({
            uploadToken: result.supportUploadToken,
            blob: mediaBlob,
            mimeType: mediaBlob.type || mediaMimeType,
          });
          clearMedia();
          setStatus("Thank you. Your support and media message were received.", "success");
        } catch (uploadError) {
          setStatus(`Payment received. Media upload needs retry: ${uploadError.message}`, "error");
        }
      } else {
        setStatus("Thank you. Your support was received successfully.", "success");
      }

      els.message.value = "";
      await loadRecentSupporters();
    } catch (error) {
      setStatus(error.message || "Support payment was not completed.", "error");
    } finally {
      els.submit.innerHTML = originalText;
      setCheckoutEnabled(Boolean(supportConfig?.supportEnabled));
    }
  }

  document.querySelectorAll("[data-support-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedMode = button.getAttribute("data-support-mode") || "video";
      document.querySelectorAll("[data-support-mode]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      clearMedia();
    });
  });

  els.amount.addEventListener("input", () => {
    const normalized = normalizeAmountValue(els.amount.value);
    if (els.amount.value !== normalized) {
      els.amount.value = normalized;
    }
    els.quickAmounts.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button.dataset.supportAmount === String(els.amount.value));
    });
    updateEstimate();
  });
  els.recordBtn.addEventListener("click", startRecording);
  els.stopBtn.addEventListener("click", stopRecording);
  els.clearMediaBtn.addEventListener("click", clearMedia);
  els.form.addEventListener("submit", submitSupport);
  window.addEventListener("pdf-lib:active-user-changed", prefillFromUser);
  window.addEventListener("beforeunload", () => {
    stopRecording();
    stopActiveStream();
    if (mediaObjectUrl) URL.revokeObjectURL(mediaObjectUrl);
  });

  prefillFromUser();
  loadSupportConfig();
  loadRecentSupporters();
})();
