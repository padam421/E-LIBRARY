import "./config/loadEnv.js";

import "./config/validateEnv.js";
import app from "./app.js";

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(
      `[Server] Port ${PORT} is already in use. The backend is probably already running. ` +
        "Close the existing backend terminal, stop the old node process, or run: npm run start:local",
    );
    process.exit(1);
  }

  console.error("[Server] Failed to start:", error);
  process.exit(1);
});
