import {
  createBookPurchaseOrder,
  createSiteSubscriptionOrder,
  getAuthenticatedPaymentUser,
  getPaymentSettings,
  getPublicPaymentConfig,
  getReaderAccess,
  markWebhookPaymentCaptured,
  verifyPaymentAndGrantAccess,
  verifyWebhookSignature,
} from "../services/paymentService.js";

function sendError(res, error, fallbackMessage = "Payment request failed.") {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  return res.status(statusCode).json({
    error: error?.message || fallbackMessage,
  });
}

function parseBookId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

export async function getPaymentConfig(req, res) {
  try {
    const settings = await getPaymentSettings();
    return res.status(200).json({
      ...getPublicPaymentConfig(),
      paymentsEnabled: settings.paymentsEnabled,
      sitePremiumEnabled: settings.sitePremiumEnabled,
      previewPageLimit: settings.previewPageLimit,
      currency: settings.currency,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getBookAccess(req, res) {
  try {
    const bookId = parseBookId(req.query?.bookId);
    if (!bookId) {
      return res.status(400).json({ error: "Valid bookId is required." });
    }

    let user = null;
    try {
      user = await getAuthenticatedPaymentUser(req);
    } catch {
      user = null;
    }

    const access = await getReaderAccess(user, bookId);
    return res.status(200).json({
      ...access,
      signedIn: Boolean(user?.email),
    });
  } catch (error) {
    return sendError(res, error, "Could not check access.");
  }
}

export async function createSiteOrder(req, res) {
  try {
    const user = await getAuthenticatedPaymentUser(req);
    const order = await createSiteSubscriptionOrder(user, req.body?.planKey);
    return res.status(201).json(order);
  } catch (error) {
    return sendError(res, error, "Could not create subscription order.");
  }
}

export async function createBookOrder(req, res) {
  try {
    const user = await getAuthenticatedPaymentUser(req);
    const bookId = parseBookId(req.body?.bookId);
    if (!bookId) {
      return res.status(400).json({ error: "Valid bookId is required." });
    }

    const order = await createBookPurchaseOrder(user, bookId);
    return res.status(201).json(order);
  } catch (error) {
    return sendError(res, error, "Could not create book payment order.");
  }
}

export async function verifyPayment(req, res) {
  try {
    await getAuthenticatedPaymentUser(req);
    const result = await verifyPaymentAndGrantAccess({
      gatewayOrderId: req.body?.razorpay_order_id,
      gatewayPaymentId: req.body?.razorpay_payment_id,
      signature: req.body?.razorpay_signature,
    });
    return res.status(200).json({
      message: "Payment verified and access unlocked.",
      orderId: result.orderId,
      entitlement: result.entitlement,
    });
  } catch (error) {
    return sendError(res, error, "Payment verification failed.");
  }
}

export async function handleRazorpayWebhook(req, res) {
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(JSON.stringify(req.body || {}));
  const signature = String(req.headers["x-razorpay-signature"] || "").trim();

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ error: "Invalid webhook signature." });
  }

  try {
    const event = JSON.parse(rawBody.toString("utf8"));
    const eventName = String(event?.event || "");

    if (["payment.captured", "order.paid"].includes(eventName)) {
      const payment = event?.payload?.payment?.entity || {};
      const order = event?.payload?.order?.entity || {};
      const gatewayOrderId = payment.order_id || order.id;
      const gatewayPaymentId = payment.id || "";

      if (gatewayOrderId) {
        await markWebhookPaymentCaptured({ gatewayOrderId, gatewayPaymentId });
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[Payments] Webhook handling failed:", error?.message || error);
    return res.status(200).json({ received: true, warning: "Webhook stored no local change." });
  }
}
