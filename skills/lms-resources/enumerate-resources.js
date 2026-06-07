// Enumerate course File resources and resolve each one's real download URL +
// filename. Writes a manifest the downloader shell script consumes, and saves
// the session cookies for curl.
//
// Usage: node enumerate-resources.js [courseId] [manifestPath]
// Output: manifest JSON [{module, filename, url, size}] and /tmp/gl_cookie.txt

const { chromium } = require('playwright');
const fs = require('fs');

const COURSE = process.argv[2] || '141734';
const OUT = process.argv[3] || '/tmp/gl-resources.json';
const PB = process.env.PB_ID || '19853';
const STUDENT = process.env.STUDENT_ID || '16083487';

(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:' + (process.env.CDP_PORT || '9222'));
  const ctx = b.contexts()[0];
  const p = ctx.pages().find((x) => x.url().includes('mygreatlearning.com'));
  if (!p) throw new Error('No Great Learning tab found.');

  const cookies = (await ctx.cookies()).filter((c) => c.domain.includes('greatlearning'));
  fs.writeFileSync('/tmp/gl_cookie.txt', cookies.map((c) => c.name + '=' + c.value).join('; '));

  const base = 'https://olympus.mygreatlearning.com/api/v1/courses/' + COURSE;
  const q = 'student_id=' + STUDENT + '&pb_id=' + PB + '&source=web_app';
  const getJSON = (u) => p.evaluate(async (x) => {
    const r = await fetch(x, { headers: { accept: 'application/json' } });
    return r.json();
  }, u);

  const mods = await getJSON(base + '/modules_v2?use_new_flow=true&page=1&per_page=100&' + q);
  const modules = Array.isArray(mods) ? mods : mods.modules || [];

  const out = [];
  for (const m of modules) {
    let pageNum = 1;
    while (true) {
      const items = await getJSON(base + '/modules/' + m.id + '/items?include[]=content_details&page=' + pageNum + '&per_page=50&' + q);
      const arr = Array.isArray(items) ? items : items.items || [];
      for (const it of arr) {
        if (it.type !== 'File' || !it.content_id) continue;
        const d = await getJSON(base + '/files/' + it.content_id + '?' + q);
        out.push({
          module: m.name,
          title: it.title,
          filename: d.display_name || d.filename || (it.title + '.bin'),
          url: d.url,
          size: d.size,
        });
      }
      if (arr.length < 50) break;
      pageNum += 1;
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('resources:', out.length, '| manifest:', OUT);
  await b.close();
})().catch((e) => { console.error('Error:', e.message); process.exit(1); });
