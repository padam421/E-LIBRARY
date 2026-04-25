const { test } = require('@playwright/test');

test('reader load check', async ({ page, context }) => {
  await context.addCookies([{
    name: 'pdf_library_session',
    value: 'eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJuYW1lIjoiVGVzdCBVc2VyIiwicGljdHVyZSI6IiIsImdpdmVuX25hbWUiOiIiLCJzdWIiOiIiLCJpYXQiOjE3NzY1MjQ5MTIsImV4cCI6MTc3NjU2ODExMn0.Z4iP7VwauQSwQZb0XawLKJ_SoWDJXSs_ooq3uD7qAj8',
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax'
  }]);

  page.on('requestfinished', request => {
    if (request.url().includes('/api/pdfs/stream/')) {
      console.log('stream finished', request.url());
    }
  });

  await page.goto('http://127.0.0.1:5504/PDF-Library/frontend/view-pdf.html?id=1FEiZgkWzEz_2MLReOKMb1lbnbHX_FjYi&title=Meditations&page=28', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  const loadingVisible = await page.locator('#pdf-loading').evaluate((el) => getComputedStyle(el).display !== 'none');
  console.log('loadingVisible=' + loadingVisible);
});
