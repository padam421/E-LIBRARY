# Security Policy

## Supported Scope

This repository contains the public source code for E-Library. Security-sensitive values must be configured through local `.env` files or hosting dashboard environment variables only.

## Never Commit

Do not commit:

- `.env` files
- Firebase service account JSON
- Google Drive refresh tokens
- Razorpay key secrets
- Razorpay webhook secrets
- Gemini API keys
- database passwords
- database backups
- exported user data
- private Google Drive folder IDs if they reveal private storage structure

The repository includes `.gitignore` rules for these common cases, but every contributor should still review changes before committing.

## Pre-Commit Checks

Run:

```powershell
cd PDF-Library/backend
npm run check:secret-files
```

Also inspect staged files:

```powershell
git status --short
git diff --cached
```

## Production Hardening

Production should use:

```env
NODE_ENV=production
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAME_SITE=none
PUBLIC_INCLUDE_PRIVATE_BOOKS=false
ALLOW_RAW_DRIVE_ROUTES=false
```

Use strong values for:

```env
SESSION_TOKEN_SECRET
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
FIREBASE_SERVICE_ACCOUNT_BASE64
DRIVE_REFRESH_TOKEN
```

## Reporting

If you find a security issue, contact the maintainer privately instead of posting the exploit publicly in an issue.

Maintainer:

- GitHub: [padam421](https://github.com/padam421)
- LinkedIn: [Padam Kishore](https://www.linkedin.com/in/padam-kishore-031b8b377/)
