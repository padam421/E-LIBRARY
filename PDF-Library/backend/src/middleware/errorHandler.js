export default function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (String(err?.message || "").startsWith("CORS blocked for origin:")) {
    return res.status(403).json({
      error: "This website is not allowed to call the backend from the current origin.",
    });
  }

  const statusCode =
    Number.isInteger(err?.statusCode) && err.statusCode >= 400
      ? err.statusCode
      : 500;

  if (statusCode >= 500) {
    console.error("[Server] Unhandled error:", err);
  }

  return res.status(statusCode).json({
    error:
      statusCode >= 500
        ? "Something went wrong on the server."
        : String(err?.message || "Request failed."),
  });
}
