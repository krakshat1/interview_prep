# Architecture

**Request flow:** browser (`client/*.html` + `shared.js`) -> `/api/*` ->
`src/app.js` (cors, JSON, cookies, `attachUser`) -> `requireAuth` -> a router in
`src/routes/` -> services in `src/services/` -> JSON files in `data/`.

**Auth:** email + bcrypt password, session cookie stored in
`data/authSessions.json`. The first account created is the `admin` (the only
role that sees the Question Bank editor).

**Data:** shared content (question bank, coding/SQL/system-design problems) is
one file each in `data/`. Per-user data lives under `data/users/<userId>/`.
Set `DATA_DIR` to point the app (or tests) at a different folder.

**AI:** every AI call goes through `callAI()` in `src/services/aiClient.js`,
which dispatches on `AI_PROVIDER`. Each feature supplies a Zod schema (and a
JSON schema) so replies are validated the same way for every provider.

**Theme:** `client/theme.js` sets `data-theme` on `<html>` before first paint;
`client/style.css` defines dark defaults and a light override block.
