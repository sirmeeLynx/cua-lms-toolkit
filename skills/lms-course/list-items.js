// Enumerate all video lecture pages in a Great Learning course.
//
// Video lectures are "Page" items. This fetches the course modules and their
// items through the authenticated CUA browser, then emits a JSON manifest of
// candidate video pages for the course downloader to process.
//
// Usage: node list-items.js [cdpPort] [courseId] [outFile]
//   courseId omitted -> inferred from the current Great Learning tab URL.

const { chromium } = require('playwright');
const fs = require('fs');

const CDP_PORT = process.argv[2] || '9222';
let COURSE_ID = process.argv[3] || '';
const OUT_FILE = process.argv[4] || '/tmp/lms-course/items.json';

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:' + CDP_PORT);
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => p.url().includes('mygreatlearning.com'));
  if (!page) throw new Error('No Great Learning tab found.');

  const startUrl = page.url();
  if (!COURSE_ID) COURSE_ID = (startUrl.match(/courses\/(\d+)/) || [])[1] || '';
  if (!COURSE_ID) throw new Error('Could not determine courseId.');

  // Navigate to the course page so the SPA fires its modules/profile APIs,
  // which expose student_id and pb_id (don't depend on prior tab state).
  await page.goto('https://olympus.mygreatlearning.com/courses/' + COURSE_ID, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });

  // Wait until a /users/<id>/ API call has fired (carries student_id).
  let pbId = '';
  let studentId = '';
  for (let i = 0; i < 30; i++) {
    const d = await page.evaluate(() => {
      const urls = performance.getEntriesByType('resource').map((r) => r.name);
      let sid = '';
      let pb = '';
      for (const u of urls) {
        if (!sid) sid = (u.match(/\/users\/(\d+)/) || [])[1] || '';
        if (!pb) pb = (u.match(/pb_id=(\d+)/) || [])[1] || '';
      }
      return { sid, pb };
    });
    studentId = d.sid;
    pbId = d.pb;
    if (studentId) break;
    await page.waitForTimeout(1000);
  }
  if (!studentId) throw new Error('Could not detect studentId from course APIs.');

  const base = 'https://olympus.mygreatlearning.com/api/v1/courses/' + COURSE_ID;
  const q = 'student_id=' + studentId + '&pb_id=' + pbId + '&source=web_app';

  const modsUrl = base + '/modules_v2?include[]=content_details&use_new_flow=true&page=1&per_page=100&' + q;
  const modules = await page.evaluate(async (u) => {
    const r = await fetch(u, { headers: { accept: 'application/json' } });
    const d = await r.json();
    return Array.isArray(d) ? d : d.modules || [];
  }, modsUrl);

  const items = [];
  for (const m of modules) {
    let pageNum = 1;
    const perPage = 50; // API caps responses at 50; use it so pagination advances
    while (true) {
      const itemsUrl =
        base + '/modules/' + m.id + '/items?include[]=content_details&page=' +
        pageNum + '&per_page=' + perPage + '&' + q;
      const modItems = await page.evaluate(async (u) => {
        const r = await fetch(u, { headers: { accept: 'application/json' } });
        const d = await r.json();
        return Array.isArray(d) ? d : d.items || [];
      }, itemsUrl);

      for (const it of modItems) {
        if (it.type !== 'Page') continue; // video lectures are Page items
        const title = (it.title || '').trim();
        const likelyVideo = /^\d+\.\d+(\.\d+)?\s/.test(title) || /\bvideo\b/i.test(title);
        items.push({
          itemId: it.id,
          title,
          moduleId: m.id,
          moduleName: (m.name || '').trim(),
          likelyVideo,
        });
      }

      if (modItems.length < perPage) break;
      pageNum += 1;
    }
  }

  const manifest = { courseId: COURSE_ID, pbId, studentId, count: items.length, items };
  fs.mkdirSync(require('path').dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2));

  console.log('courseId:', COURSE_ID, '| pbId:', pbId, '| studentId:', studentId);
  console.log('modules:', modules.length, '| page items:', items.length);
  console.log('manifest:', OUT_FILE);

  await browser.close();
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
