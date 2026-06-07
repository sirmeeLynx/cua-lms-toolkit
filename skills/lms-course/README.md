# LMS Course Skill

Bulk-download all video lectures in a Great Learning (Olympus) course.

Composes the `lms-video` skill: it enumerates the course's video pages, then for
each one resolves the HLS master URL (navigating the authenticated CUA browser)
and spawns a **background** download. Downloads run in parallel with a
concurrency cap; navigation/resolution stays sequential (one browser tab).

By design this downloads **video + transcript only**. Key frames are generated
on-demand later with the `lms-video` skill when you actually study a video.

## Requirements
- CUA Edge running and logged in (`scripts/start-edge.sh`), with a course tab open
- `ffmpeg`, `node`, `playwright`
- The `lms-video` skill alongside this one (`skills/lms-video/`)

## Usage
Open the course in the CUA browser, then:

```bash
./skills/lms-course/download-course.sh [course_id] [out_root] [max_parallel] [cdp_port]
# example:
./skills/lms-course/download-course.sh 141734 ~/lms/foundations-of-ai 3 9222

# limit for testing / partial runs:
LIMIT=5 ./skills/lms-course/download-course.sh 141734 /tmp/course 3
```

## How it works
1. `list-items.js` — calls the LMS `modules_v2` + `modules/<id>/items` APIs to
   enumerate `Page` items, flagging likely video lectures (numbered titles).
2. For each likely video (skipping ones already downloaded):
   - `lms-video/resolve-master.js` navigates to the page and captures the master
     URL + cookies. Pages with no video exit cleanly and are skipped.
   - `lms-video/download.sh` runs in the background (video + transcript).
   - A poll-based throttle caps concurrent downloads (`max_parallel`, default 3).
3. Waits for all background downloads to finish.

## Output
```
<out_root>/
  items.json                 # course manifest (modules, items, flags)
  <module_id>/<item_id>/
    descriptor.json
    video.mp4
    transcript.vtt
```

## Notes
- Resume-friendly: items whose `video.mp4` already exists are skipped.
- Signed master URLs are captured immediately before each download, so they do
  not expire mid-run.
- `LIMIT=<n>` processes only the first n videos (testing / incremental pulls).
