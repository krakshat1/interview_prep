# Interview Prep
A personal AI career-preparation platform for becoming a job-ready Data
Scientist / ML Engineer / AI Engineer - not just a question-and-answer quiz.
It generates a personalized 3-month or 6-month daily/weekly study plan,
tracks real mastery per topic (spaced repetition, not "answered once so
done"), and combines voice mock interviews, hands-on Python/SQL coding
practice (graded by actually running your code, not guessing), resume-defense
question generation, and job-description gap analysis into one place.

Everything runs locally. Your data - question bank, roadmap, session history,
mastery/readiness tracking, applications - is stored as JSON files in
`data/`. Nothing leaves your machine except the text sent to the
configured AI provider for evaluation (answer transcripts, submitted code/SQL,
resume text, job descriptions).

## Setup

1. Install dependencies (Node.js is already installed on this machine):
   ```
   npm install
   ```
2. Provide an AI API key: copy `.env.example` to `.env`, set `AI_PROVIDER` to
   the provider you want to use, and fill in the matching key/model pair.
   Make sure that key's account/project has billing/quota available.
3. Coding practice needs a local Python interpreter on PATH (already present
   on this machine - `python --version` should work).
4. Start the app (restart it after any `.env` change):
   ```
   npm start
   ```
   Other commands: `npm run dev` (auto-restart), `npm test` (API smoke tests),
   `npm run reset-password -- <email> <new-password>` (forgotten password).
5. Open http://localhost:3000 in **Chrome or Edge** (voice input needs the
   Web Speech API - the app falls back to typed answers elsewhere).

## Using it

New here, or not sure any of this will actually help you? Start at
**Start Here** (the post-login landing page) - it explains in plain words what
each part is for, gives you one small 10-minute task if you can't find the
motivation to begin, and points you at onboarding if you're not sure where to
start at all. Once you're past that, **Roadmap** generates a personalized
plan - everything else also works standalone if you'd rather just practice ad
hoc.

- **Start Here** - the landing page after login. Written for someone who's
  confused about how any of this helps, or has zero motivation to open it:
  a plain-English map of what each feature is for and which real interview
  round it practices, a "give me one 10-minute task" shortcut for low-
  motivation days, and a "welcome back" summary (readiness %, what's due for
  review) once you have a profile and some history.
- **Dashboard** - your *measured* readiness per skill area (Python, SQL, Math
  & Stats, ML, DL, LLM/AI Engineering, MLOps, Coding, System Design,
  Behavioral), computed from actual practice/interview data via a spaced-
  repetition tracker, not a self-report. Shows what's due for review, this
  week's report, and recent sessions.
- **Roadmap** - onboarding sets your career track (Data Scientist / ML
  Engineer / AI Engineer), a 3-month or 6-month plan, hours/day, and known
  weak areas. Generates a real week-by-week, day-by-day plan (Learn / Code /
  Interview / Communicate / Submit / Evaluate / Revise tasks, not just topic
  names) following the weekly structure and month-by-month curriculum you
  specified. Deep-links straight into the Mock Interview and Practice pages.
  Regenerate any time (e.g. after updating your profile or when weak topics
  change).
- **Mock Interview** - the original voice-based interview engine: one
  question at a time, spoken aloud, you answer by voice, scored on technical
  accuracy / communication / confidence / filler words, follow-ups asked when
  warranted, correct answer only revealed after you respond.
- **Code & SQL** - hands-on practice, graded by actually executing your
  submission: 30 Python DSA problems (arrays/hashmaps, strings, two pointers,
  sliding window, binary search, recursion, DP, stacks, queues, linked lists,
  trees, graphs) run against real test cases via a local Python subprocess,
  and 10 SQL problems (joins, subqueries,
  CTEs, window functions, deduplication) run against a real seeded SQLite
  database via sql.js. The AI reviews code quality/efficiency/edge cases (or
  SQL style/efficiency) on top of the pass/fail result.
- **Question Bank** - add/edit/delete questions (question, category,
  difficulty, expected answer, key concepts, follow-ups, common mistakes).
  Seeded with 250 questions across Python, Math (Linear Algebra, Calculus &
  Optimization, Probability & Statistics, Information Theory), SQL, Coding &
  DSA, Data Analysis, Machine Learning, Deep Learning, Generative AI/LLMs,
  MLOps, System Design, and Behavioral/HR.
- **Papers** - a curated reading list of 14 foundational AI papers (Attention
  Is All You Need, BERT, LoRA, RAG, diffusion models, RLHF/InstructGPT, and
  more), each led by a plain-English explanation for readers who don't want to
  read the original - with the technical concepts and an arXiv link one click
  away for readers who do.
- **Reports** - session history, a score trend chart, and detailed per-
  session reports (coaching summary, recurring issues, missed concepts,
  recommended next questions).
- **Resume** - paste your resume; the AI generates pointed "defend your
  resume" questions from every substantive claim and adds them to the
  Question Bank under "Resume-Based" so they flow through the normal mock
  interview engine.
- **Job Match** - paste a job description; the AI compares it against your
  *actual measured* skill levels (from the Dashboard, not self-reported) and
  produces a gap table (required skill / current level / required level /
  gap / priority / recommended action).
- **Applications** - a lightweight tracker for companies/roles/status/
  interview-stage feedback, so you can spot recurring weaknesses across real
  interviews over time.

## Project layout

```
src/
  server.js              Entry point (starts the HTTP server)
  app.js                 Express app: middleware + route mounting
  config/                Env loading and filesystem paths (DATA_DIR, PORT)
  routes/                One router per feature; index.js lists them all
  middleware/            Auth (session cookie, admin-only guard)
  services/              Business logic and integrations
    aiClient.js            All AI calls; providers: anthropic, gemini, groq, openrouter
    store.js               JSON file persistence
    curriculum.js          Deterministic 3-/6-month roadmap generator
    mastery.js             Spaced-repetition mastery + readiness tracking
    codeSandbox.js         Runs submitted Python against test cases
    sqlSandbox.js          Runs submitted SQL against a seeded SQLite DB
    filler.js, questionSelector.js, report.js
client/                  Static front end (HTML pages, style.css, shared.js, theme.js, voice.js)
data/                    Seed content (questions, coding/SQL/system-design problems, papers)
                         plus your personal data (accounts, sessions, mastery) - gitignored
scripts/                 Maintenance scripts (reset-password.js)
tests/                   API smoke tests (npm test)
docs/                    Architecture notes
resources/               Study PDFs and spreadsheets (gitignored)
```

## Notes, scope decisions, and what's deliberately NOT built yet

This covers most of the original spec, but a few things were deliberately
scoped out rather than half-built:

- **No real calendar (Google/Outlook) integration** - the Roadmap page *is*
  the calendar; syncing it to an external calendar app would need OAuth app
  registration that can't be set up unilaterally on your behalf.
- **Resume input is paste-only, not file upload/PDF parsing** - simpler and
  more reliable than OCR/PDF-extraction; paste the text from your resume file.
- **Coding practice covers arrays/strings/hashmaps/two-pointers/sliding-
  window/binary-search/recursion/DP/stacks/queues/linked-lists/trees/graphs**
  (30 problems). Linked lists and trees are represented as plain lists in the
  test-case JSON (a linked list as its value sequence, a binary tree as a
  level-order array with `null` for missing nodes), the same pattern used for
  every other data structure here.
- **The roadmap is deterministic/template-driven, not LLM-generated** - on
  purpose, so it's fast, free, reproducible, and doesn't hallucinate a study
  plan. It does use your weak areas (from onboarding or from `mastery.json`)
  to reorder what gets scheduled first.
- **A visual/graph-rendered "personal knowledge graph" (section 20) wasn't
  built** - prerequisite relationships aren't modeled yet; the closest
  equivalent today is the Dashboard's "due for review" list and the
  roadmap's weak-topic weighting.
- **Monthly assessment (section 30) as a distinct one-time exam flow isn't
  built** - the Dashboard's readiness score is the continuously-updated
  equivalent; a discrete "take a monthly test" flow would be a good next
  addition.

## Other things you can tune

- The UI has a light/dark theme toggle in the navbar (follows your OS setting
  until you choose). Colours live in the CSS variables at the top of
  `client/style.css`.
- `MAX_FOLLOW_UP_DEPTH` in `src/routes/interview.js` caps follow-up chains
  at 1 level - raise it for deeper probing.
- The filler-word list lives in `src/services/filler.js`.
- `AI_PROVIDER` in `.env` switches between AI providers ("anthropic",
  "gemini", "groq" or "openrouter"; groq and gemini have free tiers) with no code changes - each has its own key/model env pair.
  `AI_MODEL_ANTHROPIC` / `AI_MODEL_GEMINI` switch the evaluation model within
  a provider. Since several features call it per submission, point it at a
  cheaper/faster model if you're running a lot of practice reps.
- Mastery box->interval mapping (`BOX_INTERVAL_DAYS`) and the promotion/
  demotion thresholds live in `src/services/mastery.js`.
- The curriculum's topic pool, weekly day-role template, and phase/month
  themes live in `src/services/curriculum.js` - edit `TOPICS` to add/remove
  subjects or `WEEK_TEMPLATE` to change the weekly structure.
