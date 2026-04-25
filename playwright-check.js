const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([{
    name: 'pdf_library_session',
    value: 'eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJuYW1lIjoiVGVzdCBVc2VyIiwicGljdHVyZSI6IiIsImdpdmVuX25hbWUiOiIiLCJzdWIiOiIiLCJpYXQiOjE3NzY1MjQ5MTIsImV4cCI6MTc3NjU2ODExMn0.Z4iP7VwauQSwQZb0XawLKJ_SoWDJXSs_ooq3uD7qAj8',
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax'
  }]);
  const page = await context.newPage();
  page.on('requestfinished', async (request) => {
    if (request.url().includes('/api/pdfs/stream/')) {
      const timing = request.timing();
      console.log('stream request timing', JSON.stringify(timing));
    }
  });
  page.on('console', msg => console.log('console', msg.type(), msg.text()));
  const start = Date.now();
  await page.goto('http://127.0.0.1:5504/PDF-Library/frontend/view-pdf.html?id=1FEiZgkWzEz_2MLReOKMb1lbnbHX_FjYi&title=Meditations&page=28', { waitUntil: 'networkidle', timeout: 30000 });
  console.log('goto done ms', Date.now() - start);
  await page.waitForTimeout(5000);
  const loadingVisible = await page.locator('#pdf-loading').evaluate((el) => getComputedStyle(el).display !== 'none');
  console.log('loadingVisible', loadingVisible);
  await page.screenshot({ path: 'C:/Users/Padam Kishore/Pictures/E-LIBRARY/playwright-reader-check.png', fullPage: true });
  await browser.close();
})();
