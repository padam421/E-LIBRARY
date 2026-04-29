(function attachPaymentHelpers() {
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

  function buildApiUrl(path) {
    return `${API_ORIGIN}${path}`;
  }

  function normalizeEmailKey(email) {
    return String(email || "").trim().toLowerCase();
  }

  function getReaderSessionHeaders(extraHeaders = {}) {
    const email = normalizeEmailKey(localStorage.getItem(ACTIVE_EMAIL_KEY));
    const token = email
      ? String(localStorage.getItem(`${SESSION_TOKEN_KEY_PREFIX}::${email}`) || "").trim()
      : "";
    return token
      ? { ...extraHeaders, Authorization: `Bearer ${token}` }
      : { ...extraHeaders };
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
      return `₹${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
    }
  }

  function parseBookId(documentId, format) {
    const match = String(documentId || "")
      .trim()
      .match(new RegExp(`^book:(\\d+):${format}$`));
    return match ? Number(match[1]) : 0;
  }

  async function readJsonResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || "Payment request failed.");
    }
    return data;
  }

  async function getAccess(bookId) {
    if (!bookId) {
      return {
        signedIn: false,
        fullAccess: true,
        requiresPayment: false,
        previewPageLimit: 10,
        offers: [],
      };
    }

    const response = await fetch(buildApiUrl(`/api/payments/access?bookId=${encodeURIComponent(bookId)}`), {
      credentials: "include",
      headers: getReaderSessionHeaders(),
    });
    return readJsonResponse(response);
  }

  async function ensureCheckoutScript() {
    if (window.Razorpay) return;

    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function createOrder({ scope, planKey, bookId, support }) {
    const endpoint = scope === "site_subscription"
      ? "/api/payments/orders/site"
      : scope === "support_contribution"
        ? "/api/payments/orders/support"
        : "/api/payments/orders/book";
    const body = scope === "site_subscription"
      ? { planKey }
      : scope === "support_contribution"
        ? { ...(support || {}) }
        : { bookId };

    const response = await fetch(buildApiUrl(endpoint), {
      method: "POST",
      credentials: "include",
      headers: getReaderSessionHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    return readJsonResponse(response);
  }

  async function verifyCheckout(response) {
    const verifyResponse = await fetch(buildApiUrl("/api/payments/verify"), {
      method: "POST",
      credentials: "include",
      headers: getReaderSessionHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(response),
    });
    return readJsonResponse(verifyResponse);
  }

  async function startCheckout({ scope, planKey, bookId, title, user }) {
    await ensureCheckoutScript();
    const order = await createOrder({ scope, planKey, bookId });

    return new Promise((resolve, reject) => {
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "Grand Old Books",
        description: title || (scope === "site_subscription" ? "Premium subscription" : "Premium book access"),
        order_id: order.gatewayOrderId,
        prefill: {
          name: user?.name || order.prefill?.name || "",
          email: user?.email || order.prefill?.email || "",
        },
        theme: {
          color: "#2563eb",
        },
        handler: async (paymentResponse) => {
          try {
            const verified = await verifyCheckout(paymentResponse);
            resolve(verified);
          } catch (error) {
            reject(error);
          }
        },
        modal: {
          ondismiss: () => reject(new Error("Payment was closed before completion.")),
        },
      });

      checkout.on("payment.failed", (failure) => {
        reject(new Error(failure?.error?.description || "Payment failed."));
      });

      checkout.open();
    });
  }

  async function startSupportCheckout({ amountPaise, amountRupees, name, handle, email, message, localCurrency, localAmount, user }) {
    await ensureCheckoutScript();
    const order = await createOrder({
      scope: "support_contribution",
      support: {
        amountPaise,
        amountRupees,
        name,
        handle,
        email,
        message,
        localCurrency,
        localAmount,
      },
    });

    return new Promise((resolve, reject) => {
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "E-Library",
        description: "Support Padam Kishore's free digital library",
        order_id: order.gatewayOrderId,
        prefill: {
          name: name || user?.name || order.prefill?.name || "",
          email: email || user?.email || order.prefill?.email || "",
        },
        notes: {
          scope: "support_contribution",
          supporter: name || handle || "Anonymous reader",
        },
        theme: {
          color: "#0ea5e9",
        },
        handler: async (paymentResponse) => {
          try {
            const verified = await verifyCheckout(paymentResponse);
            resolve({
              ...verified,
              order,
              supportUploadToken: order.supportUploadToken || "",
            });
          } catch (error) {
            reject(error);
          }
        },
        modal: {
          ondismiss: () => reject(new Error("Support payment was closed before completion.")),
        },
      });

      checkout.on("payment.failed", (failure) => {
        reject(new Error(failure?.error?.description || "Support payment failed."));
      });

      checkout.open();
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Could not read media."));
      reader.readAsDataURL(blob);
    });
  }

  async function uploadSupportMedia({ uploadToken, blob, mimeType }) {
    if (!uploadToken || !blob) return null;
    const mediaDataUrl = await blobToDataUrl(blob);
    const response = await fetch(buildApiUrl(`/api/support/media/${encodeURIComponent(uploadToken)}`), {
      method: "POST",
      credentials: "include",
      headers: getReaderSessionHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        mediaDataUrl,
        mimeType: mimeType || blob.type || "video/webm",
      }),
    });
    return readJsonResponse(response);
  }

  window.PdfLibraryPayments = {
    formatMoney,
    parseBookId,
    getAccess,
    startCheckout,
    startSupportCheckout,
    uploadSupportMedia,
  };
})();
