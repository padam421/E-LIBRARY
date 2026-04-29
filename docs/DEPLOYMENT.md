# Deployment

This project is designed to run on free hosting while making the production limitations clear.

## Recommended Free Layout

| Layer | Recommended platform | Reason |
| --- | --- | --- |
| Frontend | Cloudflare Pages | Fast global static hosting, free SSL, no server sleep |
| Backend | Render Web Service | Easy Node/Docker deployment and environment variables |
| Database | Aiven MySQL free tier if available | Managed MySQL for development and early public use |
| File storage | Google Drive API | Existing project integration for PDF, EPUB, cover, and video assets |
| Auth | Google Identity Services plus backend verification | No password storage |
| Payments | Razorpay | Existing account and bank settlement |

## Frontend Deployment

Cloudflare Pages settings:

```text
Project root: PDF-Library/frontend
Build command: none
Output directory: /
```

Before deploying, set the backend URL in:

```text
PDF-Library/frontend/assets/js/config.js
```

Example:

```js
window.PDF_LIBRARY_CONFIG = {
  API_ORIGIN: "https://e-library-dtx4.onrender.com",
  GOOGLE_CLIENT_ID: "your-google-client-id.apps.googleusercontent.com",
};
```

## Backend Deployment

Render settings:

```text
Root directory: PDF-Library/backend
Runtime: Docker or Node
Start command: npm start
Health check path: /api/health
```

Set all production variables in the Render dashboard. Do not commit real values.

Important:

```env
NODE_ENV=production
CORS_ORIGIN=https://e-library-c9t.pages.dev
SESSION_COOKIE_SAME_SITE=none
SESSION_COOKIE_SECURE=true
PUBLIC_INCLUDE_PRIVATE_BOOKS=false
ALLOW_RAW_DRIVE_ROUTES=false
```

## Database Deployment

Use a hosted MySQL database. Set:

```env
DB_HOST=your-host
DB_PORT=your-port
DB_USER=your-user
DB_PASSWORD=your-password
DB_NAME=your-database
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
```

Run:

```powershell
cd PDF-Library/backend
npm run setup:payments
npm run repair:books-schema
```

## Razorpay Webhook

In Razorpay Dashboard, set:

```text
https://your-backend-domain.com/api/payments/webhook/razorpay
```

Enable:

```text
payment.captured
order.paid
```

Paste the webhook secret into:

```env
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
```

## Google OAuth

In Google Cloud Console, add frontend origins:

```text
https://e-library-c9t.pages.dev
https://your-custom-domain.example
```

If backend URLs are used in OAuth redirects for Drive setup, add the backend domain there as required.

## Cron / Warmup

For free backend plans, configure cron-job.org:

```text
https://your-backend-domain.com/api/health/warm
```

Recommended interval:

```text
Every 10 minutes
```

This is a mitigation for free-tier sleep, not a permanent SLA.

## Production Checklist

- Frontend opens publicly.
- Backend `/api/health` is healthy.
- Backend `/api/health/warm` touches database and public books query.
- `CORS_ORIGIN` includes the real frontend domain.
- Google sign-in works from the deployed frontend.
- Public books load without sign-in.
- Full reader access behaves according to payment settings.
- Admin page blocks non-admin users.
- Admin owner can add/edit/delete books.
- Razorpay test payment verifies.
- Razorpay webhook verifies.
- Support page records paid support.
- `sitemap.xml` returns XML.
- Search Console URL Inspection says important pages are indexable.

## When To Upgrade

Free frontend hosting is strong enough for a real public launch. The backend and database are the parts to upgrade first if the site grows.

Upgrade when:

- cold starts hurt users
- database sleep causes errors
- storage or request volume grows
- payment traffic becomes important
- placement/interview demo reliability matters
