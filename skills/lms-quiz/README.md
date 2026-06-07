# LMS Quiz Skill

Browser primitives for an **interactive quiz study workflow** on Great Learning
(Olympus). The agent acts as tutor — presenting questions, evaluating answers
against the course material, and explaining with source references — while this
skill handles the browser plumbing.

Designed for **practice quizzes** ("Test Your Understanding", unlimited attempts)
as a study aid. Do not use it to auto-answer graded assessments.

## Requirements
- CUA Edge running and logged in (`scripts/start-edge.sh`), course open
- `node` + `playwright`

## Commands
```bash
node skills/lms-quiz/quiz.js <command> [arg]
```
| Command | Description |
|---------|-------------|
| `list [courseId]` | JSON of all quizzes with `attempted` status |
| `open <itemId>` | Navigate to a quiz, click Start, print Q1 (question + options + progress) |
| `question` | Print the current question + options + progress |
| `listen` | Inject the persistent selection listener (idempotent) |
| `read` | Print the current selection: `{idx, q}` (idx is 0-based, -1 = none) |
| `wait [sec]` | Block until the user selects an option; print `{idx, q}` |
| `next` / `prev` | Navigate questions; print the new question |
| `submit` | Submit + confirm the modal; print `{submitted, marks}` |

Env overrides: `CDP_PORT` (9222), `COURSE_ID`, `PB_ID`, `STUDENT_ID`.

## Tutoring loop (how the agent uses it)
1. `list` → find unattempted practice quizzes.
2. `open <itemId>` → present Q1 to the user.
3. `wait` → user clicks an option in the browser; read the selection (0-based
   index maps to options A, B, C, D...).
4. Tutor evaluates correctness and explains **with a source reference**
   (course note + video timestamp). If wrong, ask the user to re-select.
5. `next` → repeat for each question.
6. `submit` → on the last question, submit and report the score.

## Notes
- The selection listener is injected into the page and survives across questions
  within the quiz (single-page app), so selections are read instantly.
- Option indices are 0-based: idx 0 = A, 1 = B, 2 = C, 3 = D.
