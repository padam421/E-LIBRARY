import express from "express";
import cors from "cors";
import aiRoutes from "./routes/aiRoutes.js";
import pdfRoutes from "./routes/pdfRoutes.js"; // <-- We added this

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Your existing AI routes
app.use("/api/ai", aiRoutes);

// Your NEW PDF routes
app.use("/api/pdfs", pdfRoutes); // <-- We added this

// A simple test route to make sure the server is awake
app.get("/", (req, res) => {
  res.send("Digital Library API is running!");
});

export default app;
