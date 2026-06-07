// Build an index of downloaded video transcripts: itemId, title, module, paths.
// Usage: node transcript-index.js [downloadRoot] [outFile]
// Output: JSON array of { itemId, title, moduleId, moduleName, dir, transcript, video, hasTranscript }

const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2] || process.env.HOME + '/lms/foundations-of-ai';
const OUT = process.argv[3] || ROOT + '/transcript-index.json';

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'items.json'), 'utf8'));

// Find a transcript file anywhere under ROOT for a given itemId.
function findFile(itemId, name) {
  // search shallow: <root>/<module>/<itemId>/<name>
  const hits = [];
  for (const mod of fs.readdirSync(ROOT)) {
    const dir = path.join(ROOT, mod, String(itemId));
    const f = path.join(dir, name);
    if (fs.existsSync(f)) hits.push(f);
  }
  return hits[0] || '';
}

const index = manifest.items
  .filter((it) => it.likelyVideo)
  .map((it) => {
    const transcript = findFile(it.itemId, 'transcript.vtt');
    const video = findFile(it.itemId, 'video.mp4');
    return {
      itemId: it.itemId,
      title: it.title,
      moduleId: it.moduleId,
      moduleName: it.moduleName,
      transcript,
      video,
      hasTranscript: transcript.length > 0,
    };
  });

fs.writeFileSync(OUT, JSON.stringify(index, null, 2));
const ready = index.filter((x) => x.hasTranscript).length;
console.log('indexed:', index.length, '| with transcript:', ready);
console.log('out:', OUT);
