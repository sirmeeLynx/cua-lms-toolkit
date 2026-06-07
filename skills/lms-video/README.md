# LMS Video Skill

Extract and understand Great Learning (Olympus) LMS video lessons.

LMS videos are AES-128 encrypted HLS streams (not DRM). The CUA Edge browser is
authenticated, so its cookies can fetch the decryption key and segments. This
skill uses those cookies with `ffmpeg` to download the video and its official
timestamped transcript, then extracts key frames for visual understanding.

## Requirements
- CUA Edge running with the target video **playing** (`scripts/start-edge.sh`)
- `ffmpeg` (brew install ffmpeg)
- `node` + `playwright` (already in the workspace)

## Usage
Play the video in the CUA browser, then:

```bash
./skills/lms-video/study-video.sh [cdp_port] [work_dir] [scene_threshold] [interval]
# example:
./skills/lms-video/study-video.sh 9222 /tmp/lms-test 0.20 20
```

## Steps (also runnable individually)
1. `resolve-master.js <port> <dir> [page_url]` — navigate to a video page (or use
   the current tab), play it, and capture the signed master playlist URL + cookies.
2. `download.sh <dir>` — ffmpeg downloads `video.mp4` + `transcript.vtt`.
3. `keyframes.sh <dir> <threshold> <interval>` — scene-change + interval frames,
   named by `mmss` timestamp.

## Output
```
<work_dir>/
  descriptor.json   # title, itemId, courseId, master URL, capture time
  video.mp4         # full lecture (1080p H.264 + AAC)
  transcript.vtt    # official timestamped transcript
  frames/0042.png   # key frames, filename = mm ss timestamp
```

## Knowledge-graph integration
The VTT timestamps + frame timestamps let each concept note link to the exact
moment it is explained, e.g. in note frontmatter:

```yaml
sources:
  - video: "1.1.1 Introduction to NumPy"
    item_id: 7718368
    at: "00:19"
```

## Notes
- The signed master URL expires; always run `extract.js` immediately before download.
- Transcript source is VTT (official). Whisper can be added later as a fallback
  for videos without captions.
