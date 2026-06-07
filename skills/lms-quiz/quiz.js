// lms-quiz: browser primitives for the interactive quiz study workflow.
//
// The agent (tutor) drives the loop; this CLI provides the browser plumbing:
// enumerate quizzes + attempt status, open a quiz, read the current question,
// listen for the user's selection, navigate, and submit.
//
// Usage:
//   node quiz.js list [courseId]            -> JSON: quizzes with attempted status
//   node quiz.js open <itemId>              -> start quiz, print current question
//   node quiz.js question                   -> print current question + options
//   node quiz.js listen                     -> inject persistent selection listener
//   node quiz.js read                       -> print current selection: idx, q
//   node quiz.js wait [timeoutSec]          -> block until an option is selected
//   node quiz.js next | prev                -> navigate, print new question
//   node quiz.js submit                     -> submit + confirm, print result/score
//
// Assumes a logged-in Great Learning tab in the CUA Edge browser on CDP :9222.

const { chromium } = require('playwright');

const CDP = 'http://127.0.0.1:' + (process.env.CDP_PORT || '9222');
const COURSE = process.env.COURSE_ID || '141734';
const PB = process.env.PB_ID || '19853';
const STUDENT = process.env.STUDENT_ID || '16083487';

async function page(b) {
  const p = b.contexts()[0].pages().find((x) => x.url().includes('mygreatlearning'));
  if (!p) throw new Error('No Great Learning tab found.');
  return p;
}

async function getJSON(p, url) {
  return p.evaluate(async (u) => {
    const r = await fetch(u, { headers: { accept: 'application/json' } });
    return r.json();
  }, url);
}

// Parse the current question, options, and progress from the rendered DOM.
async function readQuestion(p) {
  return p.evaluate(() => {
    const body = document.body.innerText || '';
    const qm = body.match(/Question\s+(\d+)\s*\/\s*(\d+)/);
    const progress = qm ? qm[1] + '/' + qm[2] : '?';
    // question text: between the "<n> Marks" line and "Answer Choices"
    let question = '';
    const am = body.indexOf('Answer Choices');
    if (am > 0) {
      const before = body.slice(0, am);
      const marksIdx = before.search(/\n\d+\s*Marks?\n/);
      if (marksIdx >= 0) {
        question = before.slice(before.indexOf('\n', marksIdx + 1)).trim();
      }
    }
    // options: lines between "Select the right answer" and "Previous"
    let options = [];
    const sa = body.indexOf('Select the right answer');
    const pv = body.indexOf('Previous');
    if (sa >= 0 && pv > sa) {
      options = body
        .slice(sa + 'Select the right answer'.length, pv)
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return { progress, question, options };
  });
}

async function injectListener(p) {
  await p.evaluate(() => {
    if (window.__quizListenerInstalled) return;
    window.__quizListenerInstalled = true;
    window.__quiz = { idx: -1, q: '?', ts: 0 };
    const compute = () => {
      const aria = [...document.querySelectorAll('[aria-checked]')];
      let idx = aria.findIndex((e) => e.getAttribute('aria-checked') === 'true');
      if (idx < 0) {
        const r = [...document.querySelectorAll('input[type=radio]')];
        idx = r.findIndex((x) => x.checked);
      }
      const m = (document.body.innerText || '').match(/Question\s+(\d+)\s*\/\s*(\d+)/);
      window.__quiz = { idx, q: m ? m[1] + '/' + m[2] : '?', ts: Date.now() };
    };
    document.addEventListener('click', () => setTimeout(compute, 60), true);
    document.addEventListener('change', () => setTimeout(compute, 60), true);
  });
}

async function clickText(p, text) {
  const els = await p.getByText(text, { exact: true }).all();
  if (!els.length) throw new Error('No element with text: ' + text);
  await els[els.length - 1].click({ timeout: 5000 });
}

async function main() {
  const cmd = process.argv[2];
  const arg = process.argv[3];
  const b = await chromium.connectOverCDP(CDP);
  try {
    const p = await page(b);

    if (cmd === 'list') {
      const courseId = arg || COURSE;
      const base = 'https://olympus.mygreatlearning.com/api/v1/courses/' + courseId;
      const q = 'student_id=' + STUDENT + '&pb_id=' + PB + '&source=web_app';
      const mods = await getJSON(p, base + '/modules_v2?use_new_flow=true&page=1&per_page=100&' + q);
      const modules = Array.isArray(mods) ? mods : mods.modules || [];
      const quizzes = [];
      for (const m of modules) {
        let pageNum = 1;
        while (true) {
          const items = await getJSON(p, base + '/modules/' + m.id + '/items?include[]=content_details&page=' + pageNum + '&per_page=50&' + q);
          const arr = Array.isArray(items) ? items : items.items || [];
          for (const it of arr) {
            if (it.type === 'Quiz') quizzes.push({ id: it.id, title: it.title, module: m.name, content_id: it.content_id });
          }
          if (arr.length < 50) break;
          pageNum += 1;
        }
      }
      const qbase = base + '/quizzes/';
      const withStatus = await p.evaluate(async ({ list, qbase }) => {
        const out = [];
        for (let i = 0; i < list.length; i += 8) {
          const slice = list.slice(i, i + 8);
          const r = await Promise.all(slice.map(async (z) => {
            try {
              const res = await fetch(qbase + z.content_id + '/submission?source=web_app', { headers: { accept: 'application/json' } });
              const d = await res.json();
              return { ...z, attempted: (d.quiz_submissions || []).length > 0 };
            } catch (e) { return { ...z, attempted: null }; }
          }));
          out.push(...r);
        }
        return out;
      }, { list: quizzes, qbase });
      console.log(JSON.stringify(withStatus, null, 1));
      return;
    }

    if (cmd === 'open') {
      if (!arg) throw new Error('open requires <itemId>');
      await p.goto('https://olympus.mygreatlearning.com/courses/' + COURSE + '/modules/items/' + arg + '?pb_id=' + PB, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await p.waitForTimeout(2500);
      // click Start if present
      const start = await p.getByText('Start', { exact: true }).all();
      if (start.length) { await start[0].click({ timeout: 5000 }); await p.waitForTimeout(3000); }
      await injectListener(p);
      // poll until the question renders (it loads after a spinner)
      let q = await readQuestion(p);
      for (let i = 0; i < 15 && !q.question; i++) { await p.waitForTimeout(800); q = await readQuestion(p); }
      console.log(JSON.stringify(q, null, 1));
      return;
    }

    if (cmd === 'question') { console.log(JSON.stringify(await readQuestion(p), null, 1)); return; }
    if (cmd === 'listen') { await injectListener(p); console.log('listener installed'); return; }
    if (cmd === 'read') { const s = await p.evaluate(() => window.__quiz || { idx: -1, q: '?' }); console.log(JSON.stringify(s)); return; }

    if (cmd === 'wait') {
      const timeout = parseInt(arg || '5', 10);
      const minTs = parseInt(process.argv[4] || '0', 10); // for re-selections
      await injectListener(p);
      const curQ = (await readQuestion(p)).progress;
      const deadline = Date.now() + timeout * 1000;
      while (Date.now() < deadline) {
        const s = await p.evaluate(() => window.__quiz || { idx: -1, q: '?', ts: 0 });
        // return a selection made for the CURRENT question (even if made earlier)
        if (s.idx >= 0 && s.q === curQ && s.ts >= minTs) { console.log(JSON.stringify(s)); return; }
        await p.waitForTimeout(250);
      }
      console.log(JSON.stringify({ idx: -1, q: curQ, timeout: true }));
      return;
    }

    if (cmd === 'next') { await clickText(p, 'Next'); await p.waitForTimeout(1500); await injectListener(p); let q = await readQuestion(p); for (let i = 0; i < 15 && !q.question; i++) { await p.waitForTimeout(800); q = await readQuestion(p); } console.log(JSON.stringify(q, null, 1)); return; }
    if (cmd === 'prev') { await clickText(p, 'Previous'); await p.waitForTimeout(2000); console.log(JSON.stringify(await readQuestion(p), null, 1)); return; }

    if (cmd === 'submit') {
      await clickText(p, 'Submit');           // opens confirm modal
      await p.waitForTimeout(1500);
      await clickText(p, 'Submit');           // confirm in modal
      await p.waitForTimeout(3000);
      const t = await p.evaluate(() => document.body.innerText || '');
      const marks = (t.match(/Marks Received:\s*([\d]+\s*out of\s*[\d]+)/) || [])[1] || (t.match(/Your Marks:\s*\n?\s*(\d+)/) || [])[1] || 'unknown';
      console.log(JSON.stringify({ submitted: true, marks }));
      return;
    }

    throw new Error('Unknown command: ' + cmd);
  } finally {
    await b.close();
  }
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
