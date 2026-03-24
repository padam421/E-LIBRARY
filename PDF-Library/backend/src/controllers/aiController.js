import { GoogleGenerativeAI } from "@google/generative-ai";

export const askAI = async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "CRITICAL: The API key is missing from the .env file!",
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // NOW RECEIVING BOTH PROMPT AND FILES
    const { prompt, files } = req.body;

    if (!prompt && (!files || files.length === 0)) {
      return res
        .status(400)
        .json({ error: "Please ask a question or attach a file!" });
    }
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
      systemInstruction:
        "You are a highly helpful and engaging AI assistant. You MUST dynamically use relevant emojis throughout your responses to make them visually appealing. Always use emojis for headings, bullet points, warnings, tips, and general context, exactly like modern chat interfaces.",
    });

    // Combine text and files into one package for Gemini
    const parts = [];
    if (prompt) {
      parts.push({ text: String(prompt) });
    }
    if (files && files.length > 0) {
      // Add all uploaded files to the AI's vision/reading context
      parts.push(...files);
    }

    // Send the combined package to the AI
    const result = await model.generateContent(parts);
    const response = await result.response;

    res.json({ answer: response.text() });
  } catch (error) {
    console.error("CRITICAL AI ERROR DETAILS:", error);
    res.status(500).json({
      error: "API Error: " + (error.message || "Something went wrong."),
    });
  }
};
