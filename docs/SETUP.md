# Local Setup

This guide is for running E-Library on a development machine without committing private secrets.

## 1. Clone

```powershell
git clone https://github.com/padam421/E-LIBRARY.git
cd E-LIBRARY
```

## 2. Backend Dependencies

```powershell
cd PDF-Library/backend
npm install
```

## 3. Create Backend Environment File

```powershell
Copy-Item .env.example .env
```

Edit:

```text
PDF-Library/backend/.env
```

Use `.env.example` as the checklist. Real secrets must stay in `.env` or hosting dashboards only.

Required minimum values for local backend boot:

```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://127.0.0.1:5500,http://localhost:5500
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=library_app_user
DB_PASSWORD=change_me
DB_NAME=pdf_library
DB_SSL=false
GOOGLE_CLIENT_ID=your_google_web_client_id
OWNER_ADMIN_EMAIL=padamkishore90@gmail.com
SESSION_TOKEN_SECRET=replace_with_a_long_random_secret
```

Add Drive, Firebase, Razorpay, and Gemini values only when testing those features.

## 4. Create Database

Create a MySQL database and user, then run these SQL files in order:

```text
PDF-Library/sql/001_schema.sql
PDF-Library/sql/003_repair_books_schema.sql
PDF-Library/sql/004_admin_audit_log.sql
PDF-Library/sql/005_payments.sql
PDF-Library/sql/006_support_contributions.sql
```

If you already have an older database, use the repair scripts instead of dropping tables.

## 5. Start Backend

```powershell
cd PDF-Library/backend
npm start
```

Expected log examples:

```text
[DB] MySQL connection pool configured.
[Drive] Google Drive API client configured.
Server running on port 3000
```

## 6. Serve Frontend

Open a second terminal:

```powershell
cd PDF-Library/frontend
python -m http.server 5500
```

Open:

```text
http://127.0.0.1:5500/
```

If your backend is not on `http://127.0.0.1:3000`, update:

```text
PDF-Library/frontend/assets/js/config.js
```

## 7. Verify

Backend syntax check:

```powershell
cd PDF-Library/backend
npm run check
```

Secret-file check:

```powershell
npm run check:secret-files
```

Health check:

```text
http://127.0.0.1:3000/api/health
```

## 8. Admin Access

The owner email is configured by:

```env
OWNER_ADMIN_EMAIL=padamkishore90@gmail.com
```

When that Google account signs in, the backend treats it as owner/admin.

## 9. Payment Test Mode

Use Razorpay test keys in `.env`:

```env
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your_test_secret
RAZORPAY_WEBHOOK_SECRET=your_test_webhook_secret
```

Then run:

```powershell
npm run setup:payments
```

Use Razorpay test cards from Razorpay documentation. Do not put live secrets in code.

## 10. Support Media

Support audio/video upload requires:

```env
SUPPORT_MEDIA_DRIVE_FOLDER_ID=your_private_drive_folder_id
```

The Google Drive refresh token must have access to that folder.

## 11. Common Problems

### CORS blocked

Add your frontend URL to `CORS_ORIGIN`.

### Database connection lost

Confirm hosted database sleep behavior, SSL settings, and credentials. The app retries transient read queries, but hosted free databases can still sleep.

### Razorpay payment failed

Check:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- payment settings enabled in admin
- `005_payments.sql` and `006_support_contributions.sql` have run
- minimum support amount is configured as paise, not rupees

### Google sign-in fails

Add your exact frontend origin in Google Cloud Console under authorized JavaScript origins.
