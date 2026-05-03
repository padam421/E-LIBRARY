# Cloudflare R2 Migration Guide

## What this project is using right now

- The application database is MySQL.
- Local development reads `backend/.env`, which currently points to `DB_HOST=127.0.0.1`.
- The separate `backend/.env.cloud` file contains a cloud MySQL connection, but it is not auto-loaded during normal local startup.
- Book files are not stored in MySQL. The live code has been using Google Drive IDs in `books_data.pdf_drive_id`, `epub_drive_id`, `cover_drive_id`, and `video_drive_id`.

## Important clarification

Cloudflare R2 is object storage, not a SQL database.

That means:

- R2 can replace Google Drive for PDFs, EPUBs, covers, and videos.
- R2 does not replace the MySQL database itself.
- If you want the SQL database on Cloudflare too, that is a separate migration to D1 or another Cloudflare-compatible database path, and it is not a config-only swap for this codebase.

## What was changed in this repo

The backend now supports mixed book storage providers:

- Existing books can keep using `storage_provider='drive'`.
- Migrated books can use `storage_provider='r2'`.
- The public book routes, preview routes, PDF/EPUB readers, cover route, and video-by-book routes now read from the provider stored in the database row.

This gives you a zero-downtime cutover path because you can migrate one book at a time instead of deleting Google Drive first.

## Required environment variables

Set these on the backend host before switching any rows to R2:

```env
DEFAULT_BOOK_STORAGE_PROVIDER=drive
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ENDPOINT=
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_BASE_URL=
```

Notes:

- Use either `R2_ACCOUNT_ID` or `R2_ENDPOINT`.
- If `R2_ENDPOINT` is blank, the backend builds it as `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
- Keep `DEFAULT_BOOK_STORAGE_PROVIDER=drive` until the migration is fully verified.
- `R2_PUBLIC_BASE_URL` is optional.

## Step-by-step migration

1. Create the R2 bucket and API token in Cloudflare.

2. Add the R2 environment variables to the backend deployment and to your local private env file if you want to test locally.

3. Repair the schema so existing databases accept `storage_provider='r2'`.

```powershell
cd backend
npm run repair:books-schema
```

4. Upload each book asset to R2.

Recommended key structure:

```text
books/<book-id>/book.pdf
books/<book-id>/book.epub
books/<book-id>/cover.jpg
books/<book-id>/video.mp4
```

5. Update each migrated row in MySQL.

Example:

```sql
UPDATE books_data
SET
  storage_provider = 'r2',
  pdf_drive_id = 'books/101/book.pdf',
  epub_drive_id = 'books/101/book.epub',
  cover_drive_id = 'books/101/cover.jpg',
  poster_drive_id = 'books/101/cover.jpg',
  video_drive_id = 'books/101/video.mp4'
WHERE id = 101;
```

You can leave a column `NULL` if that asset does not exist for that book.

6. Test the migrated book through the website routes:

```text
GET /api/pdfs/book/101/preview
GET /api/pdfs/book/101/stream
GET /api/pdfs/book/101/epub/preview
GET /api/pdfs/book/101/epub/stream
GET /api/pdfs/cover/101
GET /api/video/book/101/stream
```

7. Repeat for the rest of the books.

8. Only after every migrated book is working, remove the old Google Drive dependency for books if you still want to retire it.

## What not to delete yet

Do not delete or disconnect the old Google Drive setup before all rows have been updated and tested.

The safe sequence is:

1. Upload files to R2.
2. Update the matching MySQL rows.
3. Test the website.
4. Retire Drive after successful verification.

## Current limitation

Supporter media uploads in `paymentService.js` still target Google Drive through `SUPPORT_MEDIA_DRIVE_FOLDER_ID`.

That is separate from the library-book migration and was not switched in this change.
