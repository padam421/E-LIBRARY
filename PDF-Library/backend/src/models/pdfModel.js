import db from "../config/db.js";

// Function to get all books from the database
export const getAllPDFs = async () => {
  try {
    // NOTE: If your MySQL table is named something else (like 'pdfs' or 'documents'),
    // change 'books' in the line below to match your actual table name!
    const [rows] = await db.query("SELECT * FROM books_data");
    return rows;
  } catch (error) {
    console.error("Database query error:", error);
    throw error;
  }
};
