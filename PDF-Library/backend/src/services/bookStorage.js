import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

const STORAGE_PROVIDER_DEFAULT = "drive";
const SUPPORTED_STORAGE_PROVIDERS = new Set(["drive", "r2", "gcs", "url"]);

const EMPTY_ASSET_LABELS = new Set([
  "no poster available",
  "no cover available",
  "no image available",
  "no pdf available",
  "no epub available",
  "no video available",
  "no video",
  "no file available",
  "not available",
  "video not available",
  "file not available",
  "file does not exist",
  "file not found",
  "missing",
  "none",
  "null",
  "undefined",
  "n a",
  "na",
  "0",
  "-",
]);

let r2Client = null;

function normalizeEmptyLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeStorageProvider(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized) return STORAGE_PROVIDER_DEFAULT;
  if (normalized === "google_drive") return "drive";
  if (normalized === "cloudflare_r2") return "r2";
  if (SUPPORTED_STORAGE_PROVIDERS.has(normalized)) return normalized;
  return STORAGE_PROVIDER_DEFAULT;
}

export function getDefaultBookStorageProvider() {
  return normalizeStorageProvider(process.env.DEFAULT_BOOK_STORAGE_PROVIDER);
}

export function sanitizeAssetReference(value, provider = STORAGE_PROVIDER_DEFAULT) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (EMPTY_ASSET_LABELS.has(normalizeEmptyLabel(raw))) {
    return null;
  }

  const normalizedProvider = normalizeStorageProvider(provider);
  if (normalizedProvider === "drive") {
    const driveIdMatch =
      raw.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
      raw.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
      raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    return driveIdMatch ? driveIdMatch[1] : raw;
  }

  return raw;
}

function normalizeR2Key(assetRef) {
  const raw = String(assetRef || "").trim();
  if (!raw) {
    const error = new Error("Missing R2 object key.");
    error.statusCode = 400;
    throw error;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return raw.replace(/^\/+/, "");
  }

  const pathname = decodeURIComponent(url.pathname || "").replace(/^\/+/, "");
  if (!pathname) {
    const error = new Error("R2 object URL does not contain an object key.");
    error.statusCode = 400;
    throw error;
  }

  return pathname;
}

function resolveR2Config() {
  const endpoint = String(process.env.R2_ENDPOINT || "").trim();
  const accountId = String(process.env.R2_ACCOUNT_ID || "").trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = String(process.env.R2_BUCKET_NAME || "").trim();
  const publicBaseUrl = String(process.env.R2_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");

  return {
    bucket,
    endpoint: endpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ""),
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  };
}

function ensureR2Config() {
  const config = resolveR2Config();
  if (config.bucket && config.endpoint && config.accessKeyId && config.secretAccessKey) {
    return config;
  }

  const error = new Error(
    "R2 storage is not fully configured. Set R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and either R2_ACCOUNT_ID or R2_ENDPOINT.",
  );
  error.statusCode = 500;
  throw error;
}

function getR2Client() {
  const config = ensureR2Config();
  if (r2Client) {
    return {
      client: r2Client,
      config,
    };
  }

  r2Client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    client: r2Client,
    config,
  };
}

function mapR2Error(error) {
  const mapped = error;
  const statusCode = Number(
    error?.$metadata?.httpStatusCode || error?.statusCode || 0,
  );

  if (
    statusCode === 404 ||
    error?.name === "NoSuchKey" ||
    error?.Code === "NoSuchKey" ||
    error?.code === "NoSuchKey"
  ) {
    mapped.statusCode = 404;
    return mapped;
  }

  if (statusCode === 403) {
    mapped.statusCode = 403;
    return mapped;
  }

  if (statusCode === 416) {
    mapped.statusCode = 416;
    return mapped;
  }

  if (!Number.isInteger(mapped.statusCode)) {
    mapped.statusCode = 500;
  }

  return mapped;
}

function formatHttpDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toUTCString();
}

function normalizeHeaderValue(value) {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

export function createAssetCacheKey(kind, asset = {}) {
  return [
    kind,
    normalizeStorageProvider(asset.storageProvider),
    String(asset.assetRef || "").trim(),
  ].join(":");
}

export function buildR2PublicUrl(assetRef) {
  const { publicBaseUrl } = resolveR2Config();
  if (!publicBaseUrl) return null;
  const objectKey = normalizeR2Key(assetRef)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${publicBaseUrl}/${objectKey}`;
}

export async function headR2Object(assetRef) {
  try {
    const objectKey = normalizeR2Key(assetRef);
    const { client, config } = getR2Client();
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
      }),
    );

    return {
      contentLength: normalizeHeaderValue(response.ContentLength),
      contentType: response.ContentType || "application/octet-stream",
      etag: normalizeHeaderValue(response.ETag)?.replace(/^"|"$/g, "") || null,
      lastModified: formatHttpDate(response.LastModified),
      acceptRanges: "bytes",
    };
  } catch (error) {
    throw mapR2Error(error);
  }
}

export async function getR2ObjectResponse(assetRef, options = {}) {
  try {
    const objectKey = normalizeR2Key(assetRef);
    const { client, config } = getR2Client();
    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Range: options.rangeHeader || undefined,
      }),
    );

    return {
      statusCode: options.rangeHeader ? 206 : 200,
      body: response.Body,
      headers: {
        "content-length": normalizeHeaderValue(response.ContentLength),
        "content-type": response.ContentType || "application/octet-stream",
        "content-range": normalizeHeaderValue(response.ContentRange),
        "accept-ranges": "bytes",
        "last-modified": formatHttpDate(response.LastModified),
        etag: normalizeHeaderValue(response.ETag)?.replace(/^"|"$/g, "") || null,
      },
    };
  } catch (error) {
    throw mapR2Error(error);
  }
}
