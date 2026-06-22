// lms-quiz: screenshot the current Great Learning tab in the CUA Edge browser.
//
// Usage:
//   node shot.js [outPath]   -> save PNG (default /tmp/quiz-shot.png), print path
//
// Assumes a logged-in Great Learning tab in the CUA Edge browser on CDP :9222.

const { chromium } = require('playwright');

const CDP = 'http://127.0.0.1:' + (process.env.CDP_PORT || '9222');

async function page(b) {
  const p = b.contexts()[0].pages().find((x) => x.url().includes('mygreatlearning'));
  if (!p) throw new Error('No Great Learning tab found.');
  return p;
}

(async () => {
  const out = process.argv[2] || '/tmp/quiz-shot.png';
  const b = await chromium.connectOverCDP(CDP);
  try {
    const p = await page(b);
    await p.screenshot({ path: out, fullPage: false });
    console.log(JSON.stringify({ saved: out }));
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
