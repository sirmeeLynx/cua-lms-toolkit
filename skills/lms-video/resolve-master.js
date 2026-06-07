// Resolve the HLS master playlist URL (and auth cookies) for an LMS video page.
//
// Composable primitive used by both the single-video and course-download skills.
// Given a video page (by URL) it navigates there, plays the video, waits for the
// HLS stream to load, and captures the signed master playlist URL + metadata.
// If the page has no video, it exits with code 3.
//
// Usage:
//   node resolve-master.js [cdpPort] [outDir] [pageUrl]
//   - pageUrl omitted -> resolve the currently open Great Learning tab
//
// Output: <outDir>/descriptor.json  and  <outDir>/cookie_header.txt

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CDP_PORT = process.argv[2] || '9222';
const OUT_DIR = process.argv[3] || '/tmp/lms-video';
const PAGE_URL = process.argv[4] || '';

const MASTER_RE = /\/[0-9a-f-]+\.m3u8\?Expires/i;

async function waitForMaster(page, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const master = await page.evaluate((reSrc) => {
      const re = new RegExp(reSrc, 'i');
      const urls = performance.getEntriesByType('resource').map((r) => r.name);
      return urls.filter((u) => re.test(u)).pop() || '';
    }, MASTER_RE.source);
    if (master) return master;
    await page.waitForTimeout(500);
  }
  return '';
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + CDP_PORT);
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find((p) => p.url().includes('mygreatlearning.com'));
  if (!page) page = await ctx.newPage();

  if (PAGE_URL) {
    await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  }

  // Clear stale timings so we only capture THIS page's stream.
  await page.evaluate(() => performance.clearResourceTimings());

  // Nudge the player to start loading the stream.
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) {
      v.muted = true;
      v.play().catch(() => {});
    }
  });

  const master = await waitForMaster(page);
  if (!master) {
    console.error('no_video');
    await browser.close();
    process.exit(3);
  }

  const title = await page.evaluate(() => {
    const txt = document.body.innerText || '';
    const line = txt.split('\n').map((s) => s.trim()).find((s) => /^\d+\.\d+/.test(s));
    return line || document.title || 'untitled';
  });

  const url = page.url();
  const itemId = (url.match(/items\/(\d+)/) || [])[1] || 'unknown';
  const courseId = (url.match(/courses\/(\d+)/) || [])[1] || 'unknown';

  const cookies = (await ctx.cookies()).filter((c) => c.domain.includes('greatlearning'));
  const cookieHeader = cookies.map((c) => c.name + '=' + c.value).join('; ');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'descriptor.json'),
    JSON.stringify({ title, itemId, courseId, master, capturedAt: new Date().toISOString() }, null, 2)
  );
  fs.writeFileSync(path.join(OUT_DIR, 'cookie_header.txt'), cookieHeader);

  console.log('title:', title);
  console.log('itemId:', itemId);
  console.log('master_ok: true');
  console.log('outDir:', OUT_DIR);

  await browser.close();
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
