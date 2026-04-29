import {
  getSupportConfig,
  listRecentSupportContributions,
  uploadSupportMedia,
} from "../services/paymentService.js";

function sendError(res, error, fallbackMessage = "Support request failed.") {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  return res.status(statusCode).json({
    error: error?.message || fallbackMessage,
  });
}

export async function getPublicSupportConfig(req, res) {
  try {
    const config = await getSupportConfig();
    return res.status(200).json(config);
  } catch (error) {
    return sendError(res, error, "Could not load support settings.");
  }
}

export async function getRecentSupporters(req, res) {
  try {
    const supporters = await listRecentSupportContributions({
      limit: req.query?.limit,
    });
    return res.status(200).json({ supporters });
  } catch (error) {
    return sendError(res, error, "Could not load recent supporters.");
  }
}

export async function uploadSupportMessageMedia(req, res) {
  try {
    const result = await uploadSupportMedia(req.params?.uploadToken, req.body || {});
    return res.status(201).json({
      message: "Support media uploaded.",
      ...result,
    });
  } catch (error) {
    return sendError(res, error, "Could not upload support media.");
  }
}
