# E-Library Production Deployment Checklist

This website is meant to be public.

That means normal visitors should be able to open the website, browse books, view book details, use the public preview, and sign in if they want full PDF access. The admin panel is separate and must stay private.

## Public vs Private Access

Public pages:

- `frontend/index.html`
- `frontend/book-detail.html`
- `frontend/view-pdf.html`
- `GET /api/pdfs`
- `GET /api/pdfs/preview/:driveId`
- `GET /api/video/url/:driveId`

Sign-in required:

- `GET /api/pdfs/stream/:driveId`
- `GET /api/auth/session`
- `POST /api/auth/logout`

Admin-only:

- `frontend/admin-upload.html`
- `GET /api/admin/books`
- `POST /api/admin/books`
- `PUT /api/admin/books/:id`
- `DELETE /api/admin/books/:id`

## What Was Prepared

1. Backend has a real production start command:

```powershell
cd backend
npm start
```

2. Backend has a health endpoint:

```text
GET /api/health
```

3. Frontend API URL is now configurable in:

```text
frontend/assets/js/config.js
```

Local testing can leave `API_ORIGIN` blank.

For public hosting, set it to your backend URL:

```js
window.PDF_LIBRARY_CONFIG = {
  API_ORIGIN: "https://your-backend-domain.com",
};
```

4. Backend CORS is controlled by:

```env
CORS_ORIGIN=https://your-frontend-domain.com
```

5. Full PDF access is protected by backend session cookie.

6. Signed-out users can still view the public 5-page preview.

7. Admin routes require a signed-in user with `role = 'admin'` in the database.

8. Backend now checks important production settings at startup.

If a required secret or production setting is missing, the backend will stop instead of launching insecurely.

Checked in:

```text
backend/src/config/validateEnv.js
```

It also stops production if placeholder values like `change_me`, `your_...`, or `replace_with...` are still being used.

9. Backend now has Docker deployment files.

These help hosting platforms build the backend in a clean production container.

```text
backend/Dockerfile
backend/.dockerignore
```

10. Production CORS is stricter now.

This means your backend should accept requests only from your real website domain in production. Local testing still works on `localhost` and `127.0.0.1`.

## Required Production Environment Variables

Set these in your backend hosting dashboard. Do not put real secrets in GitHub.

```env
NODE_ENV=production
PORT=3000

CORS_ORIGIN=https://your-frontend-domain.com

DB_HOST=your-database-host
DB_PORT=3306
DB_USER=your-database-user
DB_PASSWORD=your-database-password
DB_NAME=pdf_library
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
DB_CONNECTION_LIMIT=25
DB_QUEUE_LIMIT=5000

REQUEST_BODY_LIMIT=50mb
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_BUCKETS=100000
PDF_LIST_RATE_LIMIT=1200
PDF_READ_RATE_LIMIT=300
VIDEO_RATE_LIMIT=300
AUTH_READ_RATE_LIMIT=600
AUTH_LOGIN_RATE_LIMIT=30
AI_ASK_RATE_LIMIT=30
ADMIN_RATE_LIMIT=2000
PUBLIC_BOOKS_CACHE_TTL_MS=30000
PREVIEW_CACHE_MAX_ENTRIES=50
PUBLIC_INCLUDE_PRIVATE_BOOKS=false
ALLOW_RAW_DRIVE_ROUTES=false

GOOGLE_CLIENT_ID=your-google-web-client-id.apps.googleusercontent.com
OWNER_ADMIN_EMAIL=padamkishore90@gmail.com

DRIVE_CLIENT_ID=your-drive-client-id
DRIVE_CLIENT_SECRET=your-drive-client-secret
DRIVE_REDIRECT_URI=https://your-backend-domain.com
DRIVE_REFRESH_TOKEN=your-drive-refresh-token

FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_JSON=
FIREBASE_SERVICE_ACCOUNT_BASE64=your-base64-service-account-json

SESSION_TOKEN_SECRET=replace_with_a_long_random_secret
SESSION_COOKIE_SAME_SITE=none
SESSION_COOKIE_SECURE=true
SESSION_TOKEN_TTL_SECONDS=2592000

GEMINI_API_KEY=your-gemini-key
GEMINI_API_KEYS=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODELS=
GEMINI_TIMEOUT_MS=30000
GEMINI_MAX_OUTPUT_TOKENS=1200

AI_MAX_FILES=6
AI_MAX_FILE_BYTES=10485760
AI_MAX_TEXT_CHARS_PER_FILE=6000
AI_ENABLE_IMAGE_OCR=true
AI_OCR_LANGUAGE=eng
```

## Before Public Launch

Do these steps in order.

1. Rotate all exposed secrets.

Any key that appeared in screenshots, chat, terminal output, or Git history should be replaced.

Rotate:

- database password
- Google Drive refresh token
- Google Drive client secret
- Gemini API keys
- Firebase service account key
- session secret

For Firebase, after you download the new service account JSON file and place it locally at:

```text
backend/src/config/firebase-key.json
```

Run this command:

```powershell
cd backend
npm run copy:firebase-base64
```

This copies the Firebase secret to your clipboard without printing it on screen.

Paste it only into your backend hosting environment variable:

```env
FIREBASE_SERVICE_ACCOUNT_BASE64=your_copied_value
```

Before hosting, also check that private local files are not accidentally tracked by Git:

```powershell
cd backend
npm run check:secret-files
```

Expected result:

```text
[SecretCheck] No tracked secret files found.
```

It may also warn that `backend/.env` or `backend/src/config/firebase-key.json` exists locally. That is OK on your own computer only. These files must not be uploaded manually to GitHub or hosting.

After replacing production environment variables in the hosting dashboard, run this local safety check:

```powershell
cd backend
npm run check:production-env
```

Expected result when everything is ready:

```text
[Preflight] Production environment settings look ready.
```

If it says something is missing or still a placeholder, fix that value before deploying.

## Cloud Database Move

This is the next real hosting step.

Your website currently uses the MySQL database on your computer. A public hosted website cannot depend on your computer's local database. You need to copy the database to a cloud MySQL database.

### 1. Create The Cloud MySQL Database

Recommended beginner path:

- Create an Aiven account.
- Create a MySQL service.
- Choose the free tier if it is available in your account/region.
- Copy the MySQL connection values from the dashboard.

You need these values:

```text
host
port
user
password
database name
SSL required or not
```

### 2. Create A Local Cloud Database Settings File

Copy this file:

```text
backend/.env.cloud.example
```

Create this private local file:

```text
backend/.env.cloud
```

Put your cloud MySQL values inside `backend/.env.cloud`.

Do not upload `backend/.env.cloud` to GitHub. It is already ignored by `.gitignore`.

### 3. Test The Cloud Database Connection

Run:

```powershell
cd backend
npm run db:test-cloud
```

Expected result:

```text
Database connection test completed.
```

If this fails, check host, port, username, password, database name, and SSL settings.

### 4. Export Your Local Database

Run:

```powershell
cd backend
npm run db:export
```

This creates a private SQL backup file in:

```text
db-backups/
```

That file may contain book records, Google Drive IDs, user emails, and admin activity. Keep it private.

### 5. Import The Backup Into The Cloud Database

Use the backup file path shown by the export command.

Example:

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File scripts/import-database.ps1 -DumpPath ..\db-backups\pdf-library-YYYYMMDD-HHMMSS.sql -EnvPath .env.cloud
```

Expected result:

```text
Database import completed.
```

### 6. Point The Backend To The Cloud Database

When deploying the backend, copy the same cloud database values into the backend hosting dashboard environment variables:

```env
DB_HOST=your-cloud-mysql-host
DB_PORT=3306
DB_USER=your-cloud-mysql-user
DB_PASSWORD=your-cloud-mysql-password
DB_NAME=your-cloud-mysql-database
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
```

Do not paste these into frontend files.

## If Admin Book Upload Fails

The admin upload page saves book information into the database table named:

```text
books_data
```

If that table was created with the old structure, upload can fail because new columns are missing or because the `id` column is not auto-increment.

Safe repair command:

```powershell
cd backend
npm run repair:books-schema
```

Expected result:

```text
[Schema] books_data table is ready for admin uploads.
```

After the admin audit-log upgrade, the successful message may also say:

```text
[Schema] books_data table and admin activity log are ready.
```

## Admin Book Management

The admin portal supports:

- adding one book manually
- importing many books from CSV or JSON
- editing an existing book
- deleting one book
- selecting multiple books on the current page and deleting them together
- storing PDF-only, EPUB-only, or PDF+EPUB books under one book entry
- showing who added or last updated each new book
- showing owner-only admin activity history

Admin page:

```text
frontend/admin-upload.html
```

Owner/admin rules:

- `OWNER_ADMIN_EMAIL=padamkishore90@gmail.com` is the owner account.
- The owner can always access the Admin Portal.
- Only the owner can add or remove other admin users from the Admins section.
- Other admins can add, import, edit, and delete books, but they cannot remove the owner.
- The Activity section shows Padam who added, edited, deleted, imported, or changed admin permissions.

Bulk CSV columns:

```text
title,pdf_drive_id,epub_drive_id,author,category,description,poster_drive_id,cover_drive_id,video_drive_id
```

Required columns:

```text
title plus either pdf_drive_id or epub_drive_id
```

Safe import rule:

The browser sends books to the backend in batches. Each backend request accepts up to 1000 books. This avoids one giant request timing out or crashing the browser.

2. Choose final public URLs.

Example:

- frontend: `https://your-library-domain.com`
- backend: `https://your-backend-domain.com`

3. Update frontend config.

Open:

```text
frontend/assets/js/config.js
```

Set:

```js
API_ORIGIN: "https://your-backend-domain.com"
```

4. Update backend CORS.

Set:

```env
CORS_ORIGIN=https://your-library-domain.com
```

If you also use `www`, include both:

```env
CORS_ORIGIN=https://your-library-domain.com,https://www.your-library-domain.com
```

5. Update Google OAuth settings.

In Google Cloud Console, add your frontend domain as an authorized JavaScript origin.

Example:

```text
https://your-library-domain.com
```

6. Create a proper production session secret.

Run:

```powershell
cd backend
npm run copy:session-secret
```

This copies the secret to your clipboard without printing it in the terminal.

Paste it into your backend hosting environment variable:

```env
SESSION_TOKEN_SECRET=generated_value_here
```

7. Confirm admin owner account.

Padam's Gmail should be the owner email:

```env
OWNER_ADMIN_EMAIL=padamkishore90@gmail.com
```

The database should also keep that email as an admin:

```sql
UPDATE users SET role = 'admin' WHERE email = 'padamkishore90@gmail.com';
```

After hosting, use the Admins section inside the Admin Portal if Padam wants to give another person permission.

8. Test the public visitor flow.

Expected result:

- homepage opens without sign-in
- books load without sign-in
- book detail opens without sign-in
- PDF preview opens without sign-in
- full PDF requires sign-in
- AI button opens

9. Test the signed-in reader flow.

Expected result:

- Google sign-in works
- selected Gmail account stays correct
- full PDF opens after sign-in
- going back to the homepage does not ask for sign-in again
- logout returns the user to preview-only access

10. Test the admin flow.

Expected result:

- non-admin users cannot open admin data
- admin user can list books
- admin user can add/edit/delete books

11. Confirm legal rights.

Do not publicly launch books, PDFs, covers, or videos unless you have permission or they are public domain / properly licensed.

12. Back up the database.

Before launch, export a database backup and store it safely.

## Final Launch Rule

The public website should be open to everyone.

Only these things should be restricted:

- full PDF reading
- admin upload/edit/delete tools
- backend management actions

Do not make the whole website admin-only.
