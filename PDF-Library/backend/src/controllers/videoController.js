import drive from "../config/drive.js";
import { getBookAssetById } from "../models/pdfModel.js";

function rawDriveRoutesAllowed() {
  const configured = String(process.env.ALLOW_RAW_DRIVE_ROUTES || "")
    .trim()
    .toLowerCase();
  if (["1", "true", "yes", "on"].includes(configured)) return true;
  if (["0", "false", "no", "off"].includes(configured)) return false;
  return String(process.env.NODE_ENV || "").trim() !== "production";
}

function normalizeDriveId(driveId) {
  const id = String(driveId || "").trim();
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) {
    const error = new Error("Invalid Google Drive file ID.");
    error.statusCode = 400;
    throw error;
  }
  return id;
}

/**
 * Video streaming proxy controller with Google Drive fallback.
 *
 * Primary path: stream through the backend using the Google Drive API.
 * Fallback path: redirect to Google Drive preview/download when the file is public.
 */
export const streamVideo = async (req, res) => {
  if (!req.allowResolvedDriveId && !rawDriveRoutesAllowed()) {
    return res.status(404).json({ error: "Not found." });
  }

  let driveId;
  try {
    driveId = normalizeDriveId(req.params.driveId);
  } catch (error) {
    return res.status(400).json({ error: "Missing driveId parameter." });
  }

  try {
    const metaResponse = await drive.files.get({
      fileId: driveId,
      fields: "size,mimeType,name",
    });

    const fileSize = parseInt(metaResponse.data.size, 10);
    const mimeType = metaResponse.data.mimeType || "video/mp4";

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return res.status(502).json({ error: "Video size could not be read from Google Drive." });
    }

    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const rangeMatch = String(rangeHeader).match(/^bytes=(\d*)-(\d*)$/);
      if (!rangeMatch || (!rangeMatch[1] && !rangeMatch[2])) {
        return res.status(416).json({ error: "Invalid video range request." });
      }
      const parts = [rangeMatch[1], rangeMatch[2]];
      const start = parseInt(parts[0], 10);
      const end = parts[1]
        ? parseInt(parts[1], 10)
        : Math.min(start + 2 * 1024 * 1024 - 1, fileSize - 1);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= fileSize) {
        return res.status(416).json({ error: "Requested video range is not satisfiable." });
      }
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=86400",
      });

      const streamResponse = await drive.files.get(
        { fileId: driveId, alt: "media" },
        {
          responseType: "stream",
          headers: { Range: `bytes=${start}-${end}` },
        },
      );

      streamResponse.data.pipe(res);
      return;
    }

    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": mimeType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
    });

    const streamResponse = await drive.files.get(
      { fileId: driveId, alt: "media" },
      { responseType: "stream" },
    );

    streamResponse.data.pipe(res);
  } catch (error) {
    console.error("Video proxy error, falling back to Google Drive redirect:", error.message);

    const directUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`;
    res.redirect(302, directUrl);
  }
};

export const streamVideoByBookId = async (req, res) => {
  try {
    const asset = await getBookAssetById(req.params.bookId, "video", {
      publicOnly: true,
    });
    req.allowResolvedDriveId = true;
    req.params.driveId = asset.driveId;
    return streamVideo(req, res);
  } catch (error) {
    return res
      .status(Number.isInteger(error?.statusCode) ? error.statusCode : 404)
      .json({ error: "Video not found." });
  }
};

/**
 * Return the best available video URL for a Google Drive file.
 */
export const getVideoUrl = async (req, res) => {
  if (!rawDriveRoutesAllowed()) {
    return res.status(404).json({ error: "Not found." });
  }

  let driveId;
  try {
    driveId = normalizeDriveId(req.params.driveId);
  } catch (error) {
    return res.status(400).json({ error: "Missing driveId parameter." });
  }

  try {
    await drive.files.get({
      fileId: driveId,
      fields: "id",
    });

    console.log("[Video] Drive API token is valid; using proxy mode.");
    res.json({
      url: `/api/video/${encodeURIComponent(driveId)}`,
      method: "proxy",
    });
  } catch (error) {
    console.error("[Video] Drive API token check failed:", error.message);
    if (error.response) {
      console.error("[Video] Status:", error.response.status, error.response.statusText);
    }

    res.json({
      url: `https://drive.google.com/file/d/${encodeURIComponent(driveId)}/preview`,
      method: "iframe",
    });
  }
};

export const getVideoUrlByBookId = async (req, res) => {
  try {
    const asset = await getBookAssetById(req.params.bookId, "video", {
      publicOnly: true,
    });

    await drive.files.get({
      fileId: asset.driveId,
      fields: "id",
    });

    res.json({
      url: `/api/video/book/${encodeURIComponent(asset.bookId)}/stream`,
      method: "proxy",
    });
  } catch (error) {
    console.error("[Video] Book video URL failed:", error.message);
    return res
      .status(Number.isInteger(error?.statusCode) ? error.statusCode : 404)
      .json({ error: "Video not found." });
  }
};

export const redirectVideoEmbedByBookId = async (req, res) => {
  try {
    const asset = await getBookAssetById(req.params.bookId, "video", {
      publicOnly: true,
    });
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.redirect(
      302,
      `https://drive.google.com/file/d/${encodeURIComponent(asset.driveId)}/preview`,
    );
  } catch (error) {
    return res
      .status(Number.isInteger(error?.statusCode) ? error.statusCode : 404)
      .json({ error: "Video not found." });
  }
};
