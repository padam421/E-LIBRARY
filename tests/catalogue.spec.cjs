// Run with Node and Playwright installed (or NODE_PATH pointing to its package directory).
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../PDF-Library/frontend');

(async function () {
  const server = http.createServer(async (req, res) => {
    const filename = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    try {
      const content = await fs.readFile(filename);
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(filename)] || 'application/octet-stream');
      res.end(content);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const books = Array.from({ length: 26 }, (_, i) => ({ id: i + 1, title: 'Book ' + String(i + 1).padStart(2, '0'), author: 'Author ' + i, category: i % 2 ? 'Fiction' : 'Technology', has_pdf: true, has_epub: i % 2 === 0 }));
    books[0].title = '<img src=x onerror=alert(1)>';
    let mode = 'ready';
    // Match the configured API origin on both a fresh clone and local setups.
    await page.route('**/api/pdfs', route => {
      if (mode === 'error') return route.fulfill({ status: 503, body: '{}' });
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(mode === 'invalid' ? { error: 'Invalid response' } : mode === 'empty' ? [] : books) });
    });
    const origin = 'http://127.0.0.1:' + server.address().port;
    await page.goto(origin + '/catalogue.html');
    await page.getByRole('table').waitFor();
    assert.equal(await page.locator('tbody tr').count(), 20);
    assert.equal(await page.evaluate(() => React.version), '18.3.1');
    assert.ok((await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bs-body-font-family'))).trim());
    assert.equal(await page.locator('tbody img').count(), 0, 'Book titles must render as escaped text.');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    assert.equal(await page.locator('tbody tr').count(), 6);
    await page.getByLabel('Search books').fill('Book 02');
    assert.equal(await page.locator('tbody tr').count(), 1);
    assert.equal(await page.getByRole('link', { name: 'Book 02', exact: true }).getAttribute('href'), 'book-detail.html?id=2');
    await page.getByLabel('Search books').fill('no-such-book');
    await page.getByText('No books match these filters.').waitFor();
    assert.ok(await page.getByRole('button', { name: 'Print this page' }).isDisabled());
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.getByLabel('Category', { exact: true }).selectOption('Technology');
    assert.equal(await page.locator('tbody tr').count(), 13);
    await page.getByLabel('Reading format').selectOption('has_epub');
    assert.equal(await page.locator('tbody tr').count(), 13);
    await page.getByLabel('Category', { exact: true }).selectOption('Fiction');
    await page.getByText('No books match these filters.').waitFor();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await page.evaluate(() => { window.print = () => { window.printCalled = true; }; });
    await page.getByRole('button', { name: 'Print this page' }).click();
    assert.equal(await page.evaluate(() => window.printCalled), true);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page must not overflow horizontally.');
    if (process.env.SCREENSHOT_DIR) {
      await fs.mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'catalogue-mobile.png'), fullPage: true });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'catalogue-desktop.png'), fullPage: true });
    }
    mode = 'error';
    await page.getByRole('button', { name: 'Refresh catalogue' }).click();
    await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    mode = 'ready';
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByRole('table').waitFor();
    mode = 'invalid';
    await page.getByRole('button', { name: 'Refresh catalogue' }).click();
    await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
    mode = 'empty';
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByText('No books match these filters.').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: catalogue rendering, filters, pagination, links, escaping, printing, mobile layout, API errors, retry, invalid response and empty state.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
