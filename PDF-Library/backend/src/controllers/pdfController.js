import * as pdfModel from "../models/pdfModel.js";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { Readable } from "stream";
import {
  readSessionTokenFromRequest,
  verifySessionToken,
} from "../utils/sessionToken.js";
import {
  getAuthenticatedPaymentUser,
  getReaderAccess,
} from "../services/paymentService.js";

function normalizeDriveId(driveId) {
  const id = String(driveId || "").trim();
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) {
    const error = new Error("Invalid Google Drive file ID.");
    error.statusCode = 400;
    throw error;
  }
  return id;
}

const DRIVE_DOWNLOAD_URL = (driveId) =>
  `https://drive.usercontent.google.com/download?id=${encodeURIComponent(normalizeDriveId(driveId))}&export=download`;
const PREVIEW_PAGE_LIMIT = Math.min(
  50,
  Math.max(1, Number.parseInt(String(process.env.PREVIEW_PAGE_LIMIT || "10"), 10) || 10),
);
const PREVIEW_CACHE_TTL_MS = 1000 * 60 * 30;
const PREVIEW_CACHE_MAX_ENTRIES = Number(process.env.PREVIEW_CACHE_MAX_ENTRIES || 50);
const previewCache = new Map();
const previewBuilds = new Map();

function rawDriveRoutesAllowed() {
  const configured = String(process.env.ALLOW_RAW_DRIVE_ROUTES || "")
    .trim()
    .toLowerCase();
  if (["1", "true", "yes", "on"].includes(configured)) return true;
  if (["0", "false", "no", "off"].includes(configured)) return false;
  return String(process.env.NODE_ENV || "").trim() !== "production";
}

function getCachedPreview(driveId) {
  const cached = previewCache.get(driveId);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    previewCache.delete(driveId);
    return null;
  }

  return cached.buffer;
}

function setCachedPreview(driveId, buffer) {
  while (previewCache.size >= PREVIEW_CACHE_MAX_ENTRIES) {
    const oldestKey = previewCache.keys().next().value;
    if (!oldestKey) break;
    previewCache.delete(oldestKey);
  }

  previewCache.set(driveId, {
    buffer,
    expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS,
  });
}

function getPreviewCacheKey(kind, driveId) {
  return `${kind}:${String(driveId || "").trim()}`;
}

function sendPaymentRequired(res, access) {
  return res.status(402).json({
    error: "Premium access is required to read the full book.",
    code: "PAYMENT_REQUIRED",
    access,
  });
}

async function buildPreviewPdfBuffer(driveId) {
  const sourceBytes = await fetchDrivePdfBuffer(driveId);
  const sourcePdf = await PDFDocument.load(sourceBytes);
  const previewPdf = await PDFDocument.create();
  const previewCount = Math.min(PREVIEW_PAGE_LIMIT, sourcePdf.getPageCount());

  if (previewCount <= 0) {
    const error = new Error("Document has no readable pages.");
    error.statusCode = 404;
    throw error;
  }

  const pageIndexes = Array.from({ length: previewCount }, (_, index) => index);
  const copiedPages = await previewPdf.copyPages(sourcePdf, pageIndexes);
  copiedPages.forEach((page) => previewPdf.addPage(page));

  const previewBytes = await previewPdf.save();
  const previewBuffer = Buffer.from(previewBytes);
  setCachedPreview(driveId, previewBuffer);
  return previewBuffer;
}

function getAttributeValue(source, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  return String(source || "").match(pattern)?.[1] || "";
}

function normalizeZipPath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function resolveZipPath(basePath, href) {
  const rawHref = String(href || "").trim().split("#")[0];
  if (!rawHref || /^[a-z][a-z0-9+.-]*:/i.test(rawHref) || rawHref.startsWith("//")) {
    return "";
  }

  let decodedHref = rawHref;
  try {
    decodedHref = decodeURIComponent(rawHref);
  } catch {
    decodedHref = rawHref;
  }

  const base = normalizeZipPath(basePath);
  const baseDir = base.includes("/") ? base.slice(0, base.lastIndexOf("/") + 1) : "";
  const parts = normalizeZipPath(`${baseDir}${decodedHref}`).split("/");
  const stack = [];

  parts.forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") stack.pop();
    else stack.push(part);
  });

  return stack.join("/");
}

function findZipFile(zip, path) {
  const normalized = normalizeZipPath(path);
  if (!normalized) return null;
  return (
    zip.file(normalized) ||
    zip.file(normalized.replace(/^\.\//, "")) ||
    Object.values(zip.files).find(
      (entry) => normalizeZipPath(entry.name).toLowerCase() === normalized.toLowerCase(),
    ) ||
    null
  );
}

async function buildPreviewEpubBuffer(driveId) {
  const sourceBuffer = await fetchDrivePdfBuffer(driveId);
  const zip = await JSZip.loadAsync(sourceBuffer);
  const containerEntry = findZipFile(zip, "META-INF/container.xml");
  if (!containerEntry) {
    const error = new Error("EPUB package metadata was not found.");
    error.statusCode = 422;
    throw error;
  }

  const containerXml = await containerEntry.async("text");
  const opfPath = getAttributeValue(
    containerXml.match(/<rootfile\b[^>]*>/i)?.[0] || "",
    "full-path",
  );
  const opfEntry = findZipFile(zip, opfPath);
  if (!opfEntry) {
    const error = new Error("EPUB package file was not found.");
    error.statusCode = 422;
    throw error;
  }

  const opfText = await opfEntry.async("text");
  const manifest = new Map();
  const manifestPattern = /<item\b[^>]*>/gi;
  let manifestMatch;
  while ((manifestMatch = manifestPattern.exec(opfText))) {
    const itemTag = manifestMatch[0];
    const id = getAttributeValue(itemTag, "id");
    const href = getAttributeValue(itemTag, "href");
    if (id && href) {
      manifest.set(id, href);
    }
  }

  const itemRefs = [];
  const itemRefPattern = /<itemref\b[^>]*\bidref\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;
  let itemRefMatch;
  while ((itemRefMatch = itemRefPattern.exec(opfText))) {
    itemRefs.push({
      idref: itemRefMatch[1],
      raw: itemRefMatch[0],
    });
  }

  if (itemRefs.length === 0) {
    const error = new Error("EPUB has no readable spine sections.");
    error.statusCode = 422;
    throw error;
  }

  const keepIds = new Set(itemRefs.slice(0, PREVIEW_PAGE_LIMIT).map((item) => item.idref));
  const removeIds = itemRefs.slice(PREVIEW_PAGE_LIMIT).map((item) => item.idref);
  let seenItemRefs = 0;
  const nextOpfText = opfText.replace(itemRefPattern, (match) => {
    seenItemRefs += 1;
    return seenItemRefs <= PREVIEW_PAGE_LIMIT ? match : "";
  });

  removeIds.forEach((idref) => {
    const href = manifest.get(idref);
    const fullPath = resolveZipPath(opfPath, href);
    const entry = findZipFile(zip, fullPath);
    if (entry) {
      zip.remove(entry.name);
    }
  });

  zip.file(opfEntry.name, nextOpfText);

  const previewBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const cacheKey = getPreviewCacheKey("epub", driveId);
  setCachedPreview(cacheKey, previewBuffer);
  return previewBuffer;
}

async function fetchDriveResponse(driveId, options = {}) {
  const headers = options.headers || {};
  const response = await fetch(DRIVE_DOWNLOAD_URL(driveId), { headers });
  if (!response.ok) {
    const error = new Error(`Error fetching document: ${response.statusText}`);
    error.statusCode = response.status;
    throw error;
  }

  return response;
}

async function fetchDrivePdfBuffer(driveId) {
  const response = await fetchDriveResponse(driveId);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function setPdfHeaders(res, options = {}) {
  const filename = options.filename || "document.pdf";
  const contentLength = options.contentLength;
  const contentRange = options.contentRange;
  const acceptRanges = options.acceptRanges || "bytes";
  const lastModified = options.lastModified;
  const etag = options.etag;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Accept-Ranges", acceptRanges);

  if (contentLength) {
    res.setHeader("Content-Length", contentLength);
  }

  if (contentRange) {
    res.setHeader("Content-Range", contentRange);
  }

  if (lastModified) {
    res.setHeader("Last-Modified", lastModified);
  }

  if (etag) {
    res.setHeader("ETag", etag);
  }

  res.setHeader(
    "Access-Control-Expose-Headers",
    "Accept-Ranges, Content-Length, Content-Range",
  );
}

// Controller to handle fetching all PDFs
export const getPdfs = async (req, res) => {
  try {
    const pdfs = await pdfModel.getAllPDFs();
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    res.status(200).json(pdfs);
  } catch (error) {
    console.error("Error in pdfController:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch remote assets." });
  }
};

export const streamPdfFromDrive = async (req, res) => {
  if (!rawDriveRoutesAllowed()) {
    return res.status(404).send("Not found.");
  }

  const { driveId } = req.params;
  const sessionToken = readSessionTokenFromRequest(req);
  const rangeHeader = String(req.headers.range || "").trim();
  
  if (!driveId) return res.status(400).send("No Document ID provided");
  if (!sessionToken) {
    return res.status(401).json({ error: "Sign in required to open this book." });
  }

  try {
    verifySessionToken(sessionToken);
  } catch (error) {
    return res
      .status(Number.isInteger(error?.statusCode) ? error.statusCode : 401)
      .json({ error: "Your reading session is invalid or expired. Please sign in again." });
  }

  try {
    const response = await fetchDriveResponse(driveId, {
      headers: rangeHeader ? { Range: rangeHeader } : {},
    });

    setPdfHeaders(res, {
      filename: "document.pdf",
      contentLength: response.headers.get("content-length"),
      contentRange: response.headers.get("content-range"),
      acceptRanges: response.headers.get("accept-ranges") || "bytes",
      lastModified: response.headers.get("last-modified"),
      etag: response.headers.get("etag"),
    });

    res.status(response.status === 206 ? 206 : 200);

    if (!response.body) {
      return res.end();
    }

    const upstreamStream = Readable.fromWeb(response.body);
    req.on("close", () => upstreamStream.destroy());
    upstreamStream.on("error", (streamError) => {
      console.error("Error proxying PDF stream:", streamError);
      if (!res.headersSent) {
        res.status(500).send("Failed to stream document.");
      } else {
        res.destroy(streamError);
      }
    });
    upstreamStream.pipe(res);
  } catch (error) {
    console.error("Error streaming document:", error);
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    res.status(statusCode).send(statusCode === 400 ? "Invalid document ID." : "Failed to stream document.");
  }
};

export const streamPdfByBookId = async (req, res) => {
  const rangeHeader = String(req.headers.range || "").trim();
  let user;

  try {
    user = await getAuthenticatedPaymentUser(req);
  } catch (error) {
    return res.status(401).json({ error: "Sign in required to open this book." });
  }

  try {
    const asset = await pdfModel.getBookAssetById(req.params.bookId, "pdf");
    const access = await getReaderAccess(user, asset.bookId);
    if (!access.fullAccess) {
      return sendPaymentRequired(res, access);
    }

    const response = await fetchDriveResponse(asset.driveId, {
      headers: rangeHeader ? { Range: rangeHeader } : {},
    });

    setPdfHeaders(res, {
      filename: `${asset.title || "document"}.pdf`,
      contentLength: response.headers.get("content-length"),
      contentRange: response.headers.get("content-range"),
      acceptRanges: response.headers.get("accept-ranges") || "bytes",
      lastModified: response.headers.get("last-modified"),
      etag: response.headers.get("etag"),
    });

    res.status(response.status === 206 ? 206 : 200);

    if (!response.body) return res.end();

    const upstreamStream = Readable.fromWeb(response.body);
    req.on("close", () => upstreamStream.destroy());
    upstreamStream.on("error", (streamError) => {
      console.error("Error proxying book PDF stream:", streamError);
      if (!res.headersSent) {
        res.status(500).send("Failed to stream document.");
      } else {
        res.destroy(streamError);
      }
    });
    upstreamStream.pipe(res);
  } catch (error) {
    console.error("Error streaming book document:", error);
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    res.status(statusCode).send(statusCode === 404 ? "Book file not found." : "Failed to stream document.");
  }
};

function setEpubHeaders(res, options = {}) {
  const filename = options.filename || "document.epub";
  const contentLength = options.contentLength;
  const contentRange = options.contentRange;
  const acceptRanges = options.acceptRanges || "bytes";
  const lastModified = options.lastModified;
  const etag = options.etag;

  res.setHeader("Content-Type", "application/epub+zip");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Accept-Ranges", acceptRanges);

  if (contentLength) {
    res.setHeader("Content-Length", contentLength);
  }

  if (contentRange) {
    res.setHeader("Content-Range", contentRange);
  }

  if (lastModified) {
    res.setHeader("Last-Modified", lastModified);
  }

  if (etag) {
    res.setHeader("ETag", etag);
  }

  res.setHeader(
    "Access-Control-Expose-Headers",
    "Accept-Ranges, Content-Length, Content-Range",
  );
}

export const streamEpubFromDrive = async (req, res) => {
  if (!rawDriveRoutesAllowed()) {
    return res.status(404).send("Not found.");
  }

  const { driveId } = req.params;
  const sessionToken = readSessionTokenFromRequest(req);
  const rangeHeader = String(req.headers.range || "").trim();

  if (!driveId) return res.status(400).send("No EPUB ID provided");
  if (!sessionToken) {
    return res.status(401).json({ error: "Sign in required to open this EPUB." });
  }

  try {
    verifySessionToken(sessionToken);
  } catch (error) {
    return res
      .status(Number.isInteger(error?.statusCode) ? error.statusCode : 401)
      .json({ error: "Your reading session is invalid or expired. Please sign in again." });
  }

  try {
    const response = await fetchDriveResponse(driveId, {
      headers: rangeHeader ? { Range: rangeHeader } : {},
    });

    setEpubHeaders(res, {
      filename: "document.epub",
      contentLength: response.headers.get("content-length"),
      contentRange: response.headers.get("content-range"),
      acceptRanges: response.headers.get("accept-ranges") || "bytes",
      lastModified: response.headers.get("last-modified"),
      etag: response.headers.get("etag"),
    });

    res.status(response.status === 206 ? 206 : 200);

    if (!response.body) {
      return res.end();
    }

    const upstreamStream = Readable.fromWeb(response.body);
    req.on("close", () => upstreamStream.destroy());
    upstreamStream.on("error", (streamError) => {
      console.error("Error proxying EPUB stream:", streamError);
      if (!res.headersSent) {
        res.status(500).send("Failed to stream EPUB.");
      } else {
        res.destroy(streamError);
      }
    });
    upstreamStream.pipe(res);
  } catch (error) {
    console.error("Error streaming EPUB:", error);
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    res.status(statusCode).send(statusCode === 400 ? "Invalid EPUB ID." : "Failed to stream EPUB.");
  }
};

export const streamEpubByBookId = async (req, res) => {
  const rangeHeader = String(req.headers.range || "").trim();
  let user;

  try {
    user = await getAuthenticatedPaymentUser(req);
  } catch (error) {
    return res.status(401).json({ error: "Sign in required to open this EPUB." });
  }

  try {
    const asset = await pdfModel.getBookAssetById(req.params.bookId, "epub");
    const access = await getReaderAccess(user, asset.bookId);
    if (!access.fullAccess) {
      return sendPaymentRequired(res, access);
    }

    const response = await fetchDriveResponse(asset.driveId, {
      headers: rangeHeader ? { Range: rangeHeader } : {},
    });

    setEpubHeaders(res, {
      filename: `${asset.title || "document"}.epub`,
      contentLength: response.headers.get("content-length"),
      contentRange: response.headers.get("content-range"),
      acceptRanges: response.headers.get("accept-ranges") || "bytes",
      lastModified: response.headers.get("last-modified"),
      etag: response.headers.get("etag"),
    });

    res.status(response.status === 206 ? 206 : 200);

    if (!response.body) return res.end();

    const upstreamStream = Readable.fromWeb(response.body);
    req.on("close", () => upstreamStream.destroy());
    upstreamStream.on("error", (streamError) => {
      console.error("Error proxying book EPUB stream:", streamError);
      if (!res.headersSent) {
        res.status(500).send("Failed to stream EPUB.");
      } else {
        res.destroy(streamError);
      }
    });
    upstreamStream.pipe(res);
  } catch (error) {
    console.error("Error streaming book EPUB:", error);
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    res.status(statusCode).send(statusCode === 404 ? "Book EPUB not found." : "Failed to stream EPUB.");
  }
};

export const previewPdfFromDrive = async (req, res) => {
  if (!rawDriveRoutesAllowed()) {
    return res.status(404).send("Not found.");
  }

  const { driveId } = req.params;
  if (!driveId) return res.status(400).send("No Document ID provided");

  try {
    const normalizedDriveId = String(driveId).trim();
    const cachedPreview = getCachedPreview(normalizedDriveId);
    const previewBuffer = cachedPreview
      || await (previewBuilds.get(normalizedDriveId)
        || (() => {
          const buildPromise = buildPreviewPdfBuffer(normalizedDriveId)
            .finally(() => previewBuilds.delete(normalizedDriveId));
          previewBuilds.set(normalizedDriveId, buildPromise);
          return buildPromise;
        })());

    setPdfHeaders(res, { filename: "preview.pdf" });
    return res.status(200).send(previewBuffer);
  } catch (error) {
    console.error("Error building preview document:", error);
    return res
      .status(Number.isInteger(error?.statusCode) ? error.statusCode : 500)
      .send(error?.message || "Failed to build preview document.");
  }
};

export const previewPdfByBookId = async (req, res) => {
  try {
    const asset = await pdfModel.getBookAssetById(req.params.bookId, "pdf", {
      publicOnly: true,
    });
    const cacheKey = asset.driveId;
    const cachedPreview = getCachedPreview(cacheKey);
    const previewBuffer = cachedPreview
      || await (previewBuilds.get(cacheKey)
        || (() => {
          const buildPromise = buildPreviewPdfBuffer(asset.driveId)
            .finally(() => previewBuilds.delete(cacheKey));
          previewBuilds.set(cacheKey, buildPromise);
          return buildPromise;
        })());

    setPdfHeaders(res, { filename: "preview.pdf" });
    return res.status(200).send(previewBuffer);
  } catch (error) {
    console.error("Error building book preview document:", error);
    return res
      .status(Number.isInteger(error?.statusCode) ? error.statusCode : 500)
      .send(error?.message || "Failed to build preview document.");
  }
};

export const previewEpubByBookId = async (req, res) => {
  try {
    const asset = await pdfModel.getBookAssetById(req.params.bookId, "epub", {
      publicOnly: true,
    });
    const cacheKey = getPreviewCacheKey("epub", asset.driveId);
    const cachedPreview = getCachedPreview(cacheKey);
    const previewBuffer = cachedPreview
      || await (previewBuilds.get(cacheKey)
        || (() => {
          const buildPromise = buildPreviewEpubBuffer(asset.driveId)
            .finally(() => previewBuilds.delete(cacheKey));
          previewBuilds.set(cacheKey, buildPromise);
          return buildPromise;
        })());

    setEpubHeaders(res, { filename: "preview.epub" });
    return res.status(200).send(previewBuffer);
  } catch (error) {
    console.error("Error building book EPUB preview:", error);
    return res
      .status(Number.isInteger(error?.statusCode) ? error.statusCode : 500)
      .send(error?.message || "Failed to build EPUB preview.");
  }
};

export const redirectCoverByBookId = async (req, res) => {
  try {
    const size = String(req.query?.size || "w400").trim();
    const safeSize = /^w\d{2,4}$/.test(size) ? size : "w400";
    const asset = await pdfModel.getBookAssetById(req.params.bookId, "cover", {
      publicOnly: true,
    });
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    const response = await fetch(
      `https://drive.google.com/thumbnail?id=${encodeURIComponent(asset.driveId)}&sz=${encodeURIComponent(safeSize)}`,
    );

    if (!response.ok || !response.body) {
      return res.status(404).send("Cover not found.");
    }

    res.setHeader("Content-Type", response.headers.get("content-type") || "image/jpeg");
    const contentLength = response.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);
    const upstreamStream = Readable.fromWeb(response.body);
    req.on("close", () => upstreamStream.destroy());
    upstreamStream.pipe(res);
  } catch (error) {
    return res.status(Number.isInteger(error?.statusCode) ? error.statusCode : 404).send("Cover not found.");
  }
};
