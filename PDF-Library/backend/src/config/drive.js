import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

// Set up the Google OAuth2 client using your .env credentials
const oauth2Client = new google.auth.OAuth2(
  process.env.DRIVE_CLIENT_ID,
  process.env.DRIVE_CLIENT_SECRET,
  process.env.DRIVE_REDIRECT_URI,
);

// Give the client your Refresh Token so it never logs out
oauth2Client.setCredentials({
  refresh_token: process.env.DRIVE_REFRESH_TOKEN,
});

// Create the Drive API service
const drive = google.drive({
  version: "v3",
  auth: oauth2Client,
});

console.log("Google Drive API connected successfully.");

export default drive;
