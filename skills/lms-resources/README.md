# LMS Resources Skill

Download course **File resources** (datasets, notebooks, slides, templates) from
Great Learning (Olympus) — the hands-on materials that go with the videos, plus
project files.

## Requirements
- CUA Edge running and logged in, with a course tab open
- `node` + `playwright`, `curl`

## Usage
```bash
./skills/lms-resources/download-resources.sh [course_id] [out_root] [filter_regex]
# all resources:
./skills/lms-resources/download-resources.sh 141734 ~/lms/foundations-of-ai/resources
# only the FoodHub project:
./skills/lms-resources/download-resources.sh 141734 ~/lms/foundations-of-ai/resources "Project Assessment"
# only datasets in Week 1:
./skills/lms-resources/download-resources.sh 141734 ~/lms/foundations-of-ai/resources "Week 1"
```

`filter_regex` matches against `"<module> <filename>"` (case-insensitive).

## How it works
1. `enumerate-resources.js` lists all `File` module items, then calls the
   `/api/v1/courses/<id>/files/<file_id>` endpoint to resolve each file's real
   download URL + filename. Saves a manifest + the session cookies.
2. The shell script downloads each file with `curl` (cookies + follow redirects;
   the download endpoint 302-redirects to a signed CDN URL).

## Output
```
<out_root>/<module>/<filename>
```
Resume-friendly: existing files are skipped.

## Notes
- In-browser `fetch` of the download URL fails due to CDN CORS, so we use
  `curl` with the session cookies instead.
