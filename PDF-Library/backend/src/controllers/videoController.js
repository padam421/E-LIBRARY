import drive from "../config/drive.js";

/**
 * VIDEO STREAMING PROXY CONTROLLER (WITH FALLBACK)
 * ==================================================
 * Primary: Streams via Google Drive API (authenticated, supports Range headers)
 * Fallback: Redirects to Google Drive's direct download URL (works for public files)
 *
 * The "invalid_grant" error means the OAuth2 refresh token has expired.
 * When this happens, the controller falls back to a redirect-based approach
 * that works for publicly shared Google Drive files.
 */
export const streamVideo = async (req, res) => {
  const { driveId } = req.params;

  if (!driveId) {
    return res.status(400).json({ error: "Missing driveId parameter." });
  }

  try {
    // ─── ATTEMPT 1: Authenticated Google Drive API streaming ───
    // This is the best method — supports Range headers, private files, caching
    const metaResponse = await drive.files.get({
      fileId: driveId,
      fields: "size,mimeType,name",
    });

    const fileSize = parseInt(metaResponse.data.size, 10);
    const mimeType = metaResponse.data.mimeType || "video/mp4";

    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      // ═══ PARTIAL CONTENT (206) ═══
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1]
        ? parseInt(parts[1], 10)
        : Math.min(start + 2 * 1024 * 1024 - 1, fileSize - 1);
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      });

      const streamResponse = await drive.files.get(
        { fileId: driveId, alt: "media" },
        {
          responseType: "stream",
          headers: { Range: `bytes=${start}-${end}` },
        }
      );

      streamResponse.data.pipe(res);
    } else {
      // ═══ FULL CONTENT (200) ═══
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      });

      const streamResponse = await drive.files.get(
        { fileId: driveId, alt: "media" },
        { responseType: "stream" }
      );

      streamResponse.data.pipe(res);
    }
  } catch (error) {
    console.error("Video proxy error, falling back to redirect:", error.message);

    // ─── FALLBACK: Redirect to Google Drive direct download URL ───
    // This works for files shared as "Anyone with the link can view"
    // The browser will follow the redirect and load the video directly
    const directUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
    res.redirect(302, directUrl);
  }
};

/**
 * FALLBACK ENDPOINT: Returns the best available video URL for a given Drive ID
 * The frontend can call this to get a working video URL without needing
 * to know the current auth state.
 */
export const getVideoUrl = async (req, res) => {
  const { driveId } = req.params;

  if (!driveId) {
    return res.status(400).json({ error: "Missing driveId parameter." });
  }

  // Try authenticated API first to check if token is valid
  try {
    await drive.files.get({
      fileId: driveId,
      fields: "id",
    });
    // Token works! Use the streaming proxy URL
    console.log("✅ Drive API token is VALID — using proxy mode");
    res.json({
      url: `/api/video/${driveId}`,
      method: "proxy",
    });
  } catch (error) {
    // Token expired — return the Google Drive embed/preview URL
    console.error("❌ Drive API token check failed:", error.message);
    if (error.response) {
      console.error("   Status:", error.response.status, error.response.statusText);
    }
    res.json({
      url: `https://drive.google.com/file/d/${driveId}/preview`,
      method: "iframe",
    });
  }
};
