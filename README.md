# CUA LMS Toolkit

A small computer-use-agent (CUA) toolkit for studying Great Learning (Olympus)
LMS courses **inside VS Code Insiders**. It runs a headless Microsoft Edge whose
screencast is shown in VS Code via the Edge DevTools extension, drives it with
Playwright over CDP, and extracts video lectures (video + official transcript +
key frames) for note-taking.

## What's inside

```
scripts/
  start-edge.sh        # launch headless Edge (real profile) with remote debugging
  stop-edge.sh         # stop the tracked Edge session for this VS Code window
skills/
  lms-video/           # extract & understand a single LMS video
    resolve-master.js  # video page -> HLS master URL + auth cookies
    download.sh        # master -> video.mp4 + transcript.vtt (VTT-first)
    keyframes.sh       # video -> timestamped key frames
    study-video.sh     # orchestrator
  lms-course/          # bulk-download a whole course (composes lms-video)
    list-items.js      # enumerate course video pages via LMS API
    download-course.sh # parallel background downloads (concurrency-capped)
```

## How it works

LMS videos are AES-128 encrypted HLS (not DRM). The Edge instance is logged in,
so its `*.mygreatlearning.com` cookies fetch the decryption key and segments.
`ffmpeg` + those cookies download and decrypt the video and the official
timestamped VTT transcript. Edge runs **headless** so the Edge DevTools
extension renders its screencast inside a VS Code panel.

## Requirements

- VS Code Insiders + the **Microsoft Edge Tools** extension
  (set `"vscode-edge-devtools.headless": true`)
- Microsoft Edge
- `ffmpeg` (`brew install ffmpeg`)
- Node + `npm install` (Playwright)

## Setup

```bash
npm install
```

Set Edge Tools to headless mode (see `.vscode/settings.json`), then in VS Code
use the Edge DevTools sidebar to attach to the running instance for the
screencast.

## Usage

```bash
# 1. Start the CUA browser (headless Edge on an auto-assigned port from 9222)
./scripts/start-edge.sh
# attach via the Edge DevTools sidebar to see the screencast in VS Code

# 2a. Study a single video (play it in the browser, or pass its page URL)
./skills/lms-video/study-video.sh 9222 /tmp/lms-video 0.20 20 "<video_page_url>"

# 2b. Bulk-download an entire course (open the course in the browser first)
./skills/lms-course/download-course.sh <course_id> ~/lms/<course> 3

# 3. Stop the browser when done
./scripts/stop-edge.sh
```

Per-video output: `video.mp4`, `transcript.vtt`, and (for the single-video skill)
`frames/` named by `mmss` timestamp. The course skill downloads video +
transcript only; generate frames on-demand with the `lms-video` skill.

## Notes

- Each VS Code window gets its own Edge session under `.vscode/<vscode_pid>/`.
- Signed HLS URLs are captured immediately before each download so they don't
  expire mid-run.
- This toolkit is for personal study of courses you are enrolled in.
