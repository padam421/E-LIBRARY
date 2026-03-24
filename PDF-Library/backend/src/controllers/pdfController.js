import * as pdfModel from "../models/pdfModel.js";

// Controller to handle fetching all PDFs
export const getPdfs = async (req, res) => {
  try {
    const pdfs = await pdfModel.getAllPDFs();
    res.status(200).json(pdfs);
  } catch (error) {
    console.error("Error in pdfController:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch PDFs from the database." });
  }
};
