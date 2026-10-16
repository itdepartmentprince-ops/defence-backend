# Quiz and traffic analytics API

The Express backend is the source of truth for quiz questions, attempts, visitor events, and quiz analytics. The public Next.js app calls it through `NEXT_PUBLIC_API_URL`; the authenticated admin app uses the same backend API.

## Environment

Set these in `defence-backend/.env`:

- `MONGODB_URI` — MongoDB connection string for the academy database.
- `FRONTEND_ORIGINS` — comma-separated public frontend and admin origins (for production, include the exact HTTPS origins).
- `CSRF_TRUSTED_ORIGINS` — the same trusted browser origins for admin mutations.

Set `NEXT_PUBLIC_API_URL` in both Next.js apps to the backend API root, such as `http://localhost:5000/api` for local development. Do not put MongoDB credentials in either frontend app.

## API routes

- `POST /api/quiz/start` — start or resume a subject's scheduled quiz. The backend returns active questions for that subject and India-time date; `subject: "all"` starts all subjects. A visitor can start each subject once per India-time day.
- `GET /api/quiz/daily-stats` — public list of today's scheduled subjects with question counts; it does not expose participant or completion counts.
- `PUT /api/quiz/:attemptId/answers` — save an answer immediately while the attempt remains `in_progress`.
- `POST /api/quiz/:attemptId/submit` — explicitly complete the quiz; skipped questions are recorded only when the visitor submits.
- `GET /api/quiz/leaderboard?date=YYYY-MM-DD` — daily leaderboard.
- `GET /api/quiz/archive/:date` — scheduled question archive for a date.
- `GET /api/quiz/categories` / `POST /api/quiz/categories` — admin-managed dynamic quiz categories.
- `PATCH /api/quiz/questions/:questionId` — enable/disable a question.
- `DELETE /api/quiz/questions/:questionId` — permanently delete a question scheduled no later than today.
- `POST /api/analytics/track` — record a first-party page view.
- `GET /api/quiz/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&subject=...` — authenticated traffic and quiz analytics.
- `GET /api/quiz/analytics/page-views?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=20&search=...&routePath=/quiz` — authenticated quiz-route view history and traffic totals, optionally filtered to one exact quiz route.
- `GET /api/quiz/analytics/visitors?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=20&search=...` — authenticated visitor, page-view, and quiz engagement history.
- `DELETE /api/quiz/analytics/history` — super-admin-only, CSRF-protected permanent deletion of all visitor profiles, website page views, quiz page views, quiz attempts, and daily quiz participations. Quiz questions, categories, and settings are preserved.
- `GET /api/quiz/attempts/:attemptId` — authenticated admin detail view of every question, selected answer, correct answer, and explanation for one attempt.
- `POST /api/quiz/questions/import-word` — authenticated admin bulk-import endpoint for `.docx` Word tables (up to 500 questions, 5 MB).
- `DELETE /api/quiz/visitors/:visitorId` — admin-only removal of that visitor's quiz attempts and daily quiz participation; general website visitor/page-view analytics are kept.
- `GET /api/quiz/questions` and `POST /api/quiz/questions` — authenticated question bank management. Questions have a category and a quiz date; a question without a date is scheduled for today. Question/category creation requires the admin CSRF token.

Quiz dates and the one-attempt-per-subject daily limit use `Asia/Kolkata`; the same `visitorId` may take different subject quizzes on the same date. Visitor identity is based on the persistent browser `visitorId`, not the phone number, so clearing browser storage or using another device creates a new visitor. Daily site visitors are distinct visitor IDs per India-time date, so repeat page visits count once that day and the same visitor is counted again on the next date. General page-view totals are not reported; page views are reported only for `/quiz` and its archive routes. Only active questions scheduled for the selected subject and date are included. Leaving before explicit submission preserves an `in_progress` attempt and saved answers; it is not counted as completed and may be resumed that day. Analytics date ranges are limited to 366 days. API validation, origin checks, role authorization, CSRF protection for admin writes, and rate limits are applied as appropriate.

### Import quiz questions from Word

From Admin → Quiz → Question Bank, upload a `.docx` file containing a Word table with one question per row. The required column headings are `Question (English)`, `Category`, `Option A`, `Option B`, `Option C`, `Option D`, `Correct Option`, and `Explanation`. Optional headings are `Question (Hindi)`, `Subject`, and `Difficulty`. Do not include a date column: all questions in the file are scheduled for the upload date in India. Correct Option must be A, B, C, or D; Difficulty must be 1–5. Blank Subject defaults to Category and blank Difficulty defaults to 1. Imported categories are created or re-enabled automatically. The whole document is validated before any questions are inserted, and validation errors identify the Word table row.

Daily quiz attempts, answers, and the participant's Indian mobile number are stored in MongoDB (`quiz_attempts` and `quiz_daily_participations`). Phone numbers are available only through authenticated admin analytics and attempt details; they are not included in public quiz responses or leaderboards. Public daily schedule data contains question counts only, while participation and completion counts are restricted to admin analytics.

## Preserve existing quiz records

Older Next.js implementations may have stored records in MongoDB collections named `quizquestions`, `quizattempts`, and `pageviews`, separate from the backend collections. Before migrating, back up the database and configure the backend `MONGODB_URI` to point to the exact same database that contains those records. Run `npm run migrate:quiz` from this directory before enabling subject-based attempts. The script copies records idempotently into `quiz_questions`, `quiz_attempts`, and `page_views`; it does not delete the legacy collections. It also upgrades the unique attempt and participation indexes to allow one attempt per subject per visitor ID and date.

Do not run the migration until both the source and target database are verified. If the old frontend data is in a different database, export/restore or provide a one-time source URI before migration; the backend cannot discover another database automatically.
