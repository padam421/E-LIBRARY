import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const projectDir = path.resolve(backendDir, "..");
const frontendDir = path.join(projectDir, "frontend");

const PORT = Number(process.env.SHARE_PORT || 8080);
const BACKEND_ORIGIN = String(process.env.BACKEND_ORIGIN || "http://127.0.0.1:3000").replace(/\/+$/, "");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".epub": "application/epub+zip",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(message);
}

function safeStaticPath(rawUrl) {
  const url = new URL(rawUrl, `http://127.0.0.1:${PORT}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/PDF-Library/frontend/")) {
    pathname = pathname.replace("/PDF-Library/frontend", "");
  }

  if (pathname === "/" || pathname === "") {
    pathname = "/index.html";
  }

  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(frontendDir, normalized);
  const relativePath = path.relative(frontendDir, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return filePath;
}

function serveStatic(req, res) {
  const filePath = safeStaticPath(req.url);
  if (!filePath) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendText(res, 404, "File not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function proxyApi(req, res) {
  const target = new URL(req.url, BACKEND_ORIGIN);
  const proxyHeaders = {
    ...req.headers,
    host: target.host,
  };

  const proxyReq = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers: proxyHeaders,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", () => {
    sendText(res, 502, "Backend is not reachable. Make sure it is running on port 3000.");
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/api/")) {
    proxyApi(req, res);
    return;
  }

  serveStatic(req, res);
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`[Share] Port ${PORT} is already in use. Close the old share server or set SHARE_PORT to another number.`);
    process.exit(1);
  }

  console.error("[Share] Failed to start temporary share server:", error);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`[Share] Temporary website server running at http://127.0.0.1:${PORT}`);
  console.log(`[Share] API requests are forwarded to ${BACKEND_ORIGIN}`);
  console.log("[Share] Keep this running while your friend is viewing the website.");
});
