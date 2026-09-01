# ManaPeer

One place for your assignments, projects, and tasks across Canvas, Gradescope,
and PrairieLearn — synced automatically and shown as a dashboard, calendar,
and per-course tabs.

**Status: Phase 1 + 2 + 3 + 4.** Canvas and Gradescope are fully wired up end
to end and verified against real accounts (connect → automatic background
sync → dashboard/calendar/tabs), in-app reminders fire automatically ahead of
each due date. PrairieLearn is built the same way, its parser grounded in
PrairieLearn's actual open-source template code (not guesswork) and its
plumbing self-tested against the real site — but **not yet confirmed against
a real PrairieLearn account**, since that requires completing your school's
own SSO/Duo login, which only you can do. See
[Connect PrairieLearn](#connect-prairielearn) for exactly what that means.

## Why no computer vision / OCR?

Canvas has a real, official REST API — reading its structured JSON is far more
reliable than screenshotting a page and running computer vision over it (it
survives UI redesigns, has exact due-date timestamps, and is instant). CV is
not used anywhere in this app. Where a platform has no public API (Gradescope,
PrairieLearn), the plan is authenticated scraping of the page's underlying
data, not image recognition — see the roadmap below.

## Architecture

- **Backend:** Python + FastAPI + SQLModel (SQLite), APScheduler for a
  background sync job every 15 minutes (configurable), plus a manual "Sync
  now" button.
- **Frontend:** React + Vite + TypeScript + Tailwind, React Query, React Router.
- **Adapter pattern:** every platform implements the same interface
  (`fetch_courses()` / `fetch_tasks()`) in `backend/app/adapters/`. The sync
  engine and database only know a task's `source` string — adding PrairieLearn
  later means writing one new adapter class (reusing `browser_login.py` the
  same way Gradescope does), nothing else changes.
- **Single-user, local-first:** runs on your own machine, SQLite database file
  on disk, nothing hosted or shared.

## Setup

### Backend

```
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env
```

Download the Chromium browser Playwright needs (used for Gradescope's login
flow and headless re-syncs — a one-time ~150-300MB download):

```
python -m playwright install chromium
```

Generate a secret key and put it in `.env` as `MANAPEER_SECRET_KEY`:

```
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Run it:

```
uvicorn app.main:app --reload
```

Visit `http://127.0.0.1:8000/docs` for the interactive API docs.

### Frontend

```
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`.

### Connect Canvas

1. In Canvas: **Account → Settings → "+ New Access Token"**. Copy the token
   (you only see it once).
2. In ManaPeer: go to **Settings**, enter your Canvas URL (e.g.
   `https://yourschool.instructure.com`) and the token, click **Connect Canvas**.
3. Courses and assignments sync immediately, then automatically every 15
   minutes in the background. Use **Sync now** to force it any time.

Your token is encrypted at rest (Fernet, key from `MANAPEER_SECRET_KEY`) in
the local SQLite database and is only ever sent to your Canvas instance.

### Where your data actually lives, and what's protected

- **Canvas token** - encrypted (Fernet) in `backend/manapeer.db`, key in
  `backend/.env`.
- **Gradescope/PrairieLearn passwords** - never touch ManaPeer at all. You
  type them directly into your school's SSO/Duo page in the real browser
  window that opens; that traffic goes straight from the browser to your
  school, bypassing the backend entirely.
- **Gradescope/PrairieLearn sessions** - two things get stored instead: a real
  Chromium profile per platform (`backend/.browser_profiles/<platform>/` -
  Chromium encrypts its own cookie store here via Windows DPAPI, tied to your
  Windows account) and a small cookie-jar file
  (`<platform>.cookies.json`) that carries the session between syncs (see
  `browser_login.py`'s module docstring for why a plain kept-open browser
  didn't work). That cookie-jar file is **encrypted the same way as the
  Canvas token** (same Fernet key) - it holds real session cookies, not just
  a file path, so it gets the same protection. An older version of this file
  format was plaintext; it's migrated to encrypted automatically the first
  time it's read after upgrading, with no need to reconnect.
- **None of this** is designed to resist someone who already has access to
  your Windows user account - that's true of the `.env` key, the database,
  and the browser profiles alike. It protects against the database or cookie
  files ending up somewhere else on their own (a backup, a copy, etc.), not
  against full access to this machine.
- The backend only listens on `127.0.0.1` - it isn't reachable from your
  network or the internet, only from this machine. All outbound traffic
  (Canvas, Gradescope, PrairieLearn) goes over normal HTTPS.

### Reminders

Every synced task gets a `Reminder` row per configured lead time (default: 3
days / 1 day / 3 hours before its due date). The bell icon in the header polls
`/reminders` every minute and shows a badge for any reminder whose time has
passed and whose task is still pending — click it to see, dismiss, or "clear
all". Change lead times any time in **Settings → Reminders**; saving
immediately regenerates reminders for every already-synced task, not just new
ones. Besides the preset checkboxes, a **Custom** field lets you add any lead
time as a number + unit (minutes/hours/days/weeks) - the backend accepts any
positive lead time already, this just exposes it in the UI.

If a task's due date is closer than one of your lead times when it's first
synced (e.g. a quiz due in 2 hours shows up when you have a "3 days before"
reminder configured), every configured threshold for that task has
technically already passed at once — ManaPeer only surfaces the single most
urgent one per task instead of stacking duplicates for the same assignment.

If a task's due date has *already fully passed* the first time it's ever
synced (e.g. importing a past semester's Gradescope courses), no reminders are
generated for it at all — every lead time would already be simultaneously
"active," which is backlog noise from old, already-finished work, not a useful
nudge. A task already being tracked keeps updating normally even once its due
date has since passed; this only guards a task's very first sync.

This is in-app only for now; there's no email/push channel yet (see roadmap).

### Late-submission deadlines (Gradescope)

Some Gradescope assignments allow a late submission past the regular due
date, shown on the real page as a third "Late Due Date:" timestamp alongside
the release date and regular due date (confirmed directly against a real
course page - a 2-`<time>`-tag row has no late option, 3 tags means it does).
ManaPeer tracks this as `Task.late_due_at` and treats it as the deadline that
actually matters once the regular one has passed:

- **Dashboard** - a task isn't bucketed into "Overdue" the moment its regular
  due date passes if a late option exists; it stays in whichever bucket its
  late cutoff falls into instead, and the task card says so explicitly
  ("Due date passed · late submission until ...").
- **Calendar** - shows the assignment on its regular due date until that
  passes, then moves it to show on the late-cutoff date instead (with a ⏰ and
  a tooltip noting it's the late cutoff) - never both at once.

Only Gradescope currently exposes this; Canvas and PrairieLearn tasks simply
have no `late_due_at`, so nothing changes for them.

### Auto-dismissing old tasks

Every sync also sweeps for tasks that are still "pending" but more than 1
month (30 days) past their due date, and marks them "dismissed" automatically
- old, already-irrelevant work (e.g. a past semester's Gradescope/PrairieLearn
courses) that would otherwise sit in the Dashboard/Calendar/Tabs forever. Only
`pending` tasks are touched - anything you've already marked `done`, or
already dismissed, is left alone. This is a continuous rule, not a one-time
check: a task crosses the threshold and gets dismissed automatically the next
time a sync runs, even if it's been sitting there a while. You can always
undo a dismissal for a specific task from its card.

### Courses page: current semester vs. archived

The Courses tabs only show courses from your **most recent semester**; every
older course is grouped under a collapsed "Archived / past classes" section
instead (click to expand, then click any archived course to see its board
same as a current one). The most recent semester is determined by parsing
each course's `term` (e.g. "Fall 2026") into a `(season, year)` and finding
the latest one across every synced course - not by matching the term text
itself, since different platforms phrase it differently (Gradescope: "Fall
2026"; PrairieLearn sometimes: "PHYS 214 Fall 2026", with the course name
folded in). A course whose term can't be parsed at all (e.g. PrairieLearn's
occasional non-semester text like "Proficiency Exam Practice: PHYS 213") is
kept in the current/active list rather than guessed into archived.

### Same class, tracked on two platforms

If a real class is tracked on both Gradescope and PrairieLearn (common - e.g.
Gradescope for submissions, PrairieLearn for online homework/exams), it would
otherwise show up as two separate tabs with two separate names ("University
Physics: Thermal Physics" vs. "PHYS 213: Thermal Physics" - same class,
phrased completely differently by each platform). ManaPeer instead merges
them into one tab per real class, labeled by the shared course code (e.g.
"PHYS 213"), combining both platforms' assignments into one To-do/Done board.

This is matched by extracting a "subject + number" code (e.g. "PHYS 213" out
of Gradescope's "PHYS 213 Fall 2026", or PrairieLearn's already-clean "PHYS
213") from each course, and only merging when the SAME code is shared
**across different platforms**. Two entries from the same platform sharing a
code (e.g. Gradescope's separate "ECE 110-ABA" / "-ABE" / "-HOMEWORK" - three
genuinely different lab sections/rosters) are deliberately NOT merged just
because they simplify to the same code - only a cross-platform match
represents the same real class tracked twice. A course with no extractable
code (a plain descriptive name with no leading course number) is never
merged, just shown as its own tab as before.

### Connect Gradescope

Gradescope has no public student API, and your school routes it through the
same SSO as Canvas, so this doesn't work like Canvas's token. Instead:

1. In ManaPeer: go to **Settings**, click **Connect Gradescope**.
2. A real, visible Chromium window opens on your screen at Gradescope's login
   page. Log in there yourself — school SSO, Duo, whatever your school
   requires — exactly as you would in any browser.
3. Once you land back on Gradescope's dashboard, ManaPeer detects it
   automatically (polling for a genuine "Log Out" link, not just the absence
   of a login form) and the window closes on its own. Settings updates to
   "Connected", and courses/assignments sync immediately.
4. Every later sync (the 15-minute background job, or "Sync now") opens its
   own fresh, headless browser rather than keeping one open (see below for
   why), carrying your session forward via a small saved-cookie file. If a
   session does expire, the integration shows an error asking you to
   reconnect (repeat step 1).

**How this was actually verified:** this isn't just self-tested against
fixtures - it's been run against a real Gradescope account through multiple
consecutive syncs, confirmed to keep working without re-prompting login. That
took three real bugs found and fixed along the way, in case any of this ever
needs revisiting:

1. Gradescope's own "pick your school" SSO chooser page (`/saml`) looks
   enough like "not showing a login form" that a naive check falsely reported
   login success before anyone had actually logged in. Fixed by requiring
   landing back on Gradescope's own dashboard **and** finding a genuine "Log
   Out" link.
2. Gradescope's real session is carried by a true session-only cookie that
   Chromium discards the moment its browser context closes; a `remember_me`
   cookie is also set but does not silently restore full access on its own.
   Fixed by capturing the live cookie jar right before closing and re-injecting
   it into the next browser open, rather than trusting disk persistence alone.
3. The obvious-looking fix for #2 - keep one browser open across every sync
   instead of closing it - hit a different wall: Playwright's sync API binds a
   session to the exact OS thread that created it, and a login thread /
   scheduler thread / HTTP request thread are all different threads. Fixed by
   never holding a session open between calls at all (see #2's cookie file).
4. Gradescope's per-semester course grouping (`<div class="courseList--term">
   Fall 2026</div>`) was originally guessed as an `<h2>`, which never matched
   the real page - every course's `term` silently came out `null`. Found only
   once a real feature (splitting courses into current/archived by semester)
   depended on it actually working; fixed against the real captured markup.

### Connect PrairieLearn

Same idea as Gradescope - no public student API, same school SSO - and reuses
`browser_login.py` completely unchanged (same cookie-file session handoff,
same per-platform lock), so none of the three Gradescope bugs above should
resurface here. The steps are identical to Gradescope's: click **Connect
PrairieLearn** in Settings, a real Chromium window opens at your school's
PrairieLearn SSO entry point, log in yourself, and it closes automatically
once ManaPeer detects a genuine `/pl/logout` link on the page (applying the
"positive proof, not absence of a login form" lesson from bug #1 above from
the start, rather than discovering it the hard way again).

**What's actually been verified vs. not:** PrairieLearn is open source, so
the parser (course list, assessments, due dates) was written against
PrairieLearn's real current template code fetched from
`github.com/PrairieLearn/PrairieLearn`, not memory or guesswork - and its due
date handling is the trickiest part here: PrairieLearn's visible "next
deadline" text is human-formatted and year-less, and for a multi-tier
assessment (100% credit until X, 50% until Y) only shows the *next* tier, not
the final one. The real due date comes from a Credit/Start/End timeline
embedded in each row's "access details" popover (present in the raw page HTML
even unclicked); the parser takes the *last* row's End date as the true final
deadline. All of this, plus the login-success/session-expiry detection and
the cookie-persistence/cross-thread mechanics, has been tested - against
fixture HTML built from the real templates, and the login/sync plumbing
against the real `us.prairielearn.com` (an unauthenticated profile correctly
produces a clean "reconnect" error, proving the real browser launch, real
network navigation, and error surfacing all work). What hasn't been tested
is a real login: only you can complete your school's actual SSO/Duo prompt.
If a due date looks wrong, or the page layout doesn't match once you're in
(e.g. an unrecognized timezone abbreviation), tell me what you see and the
parser gets adjusted - exactly how Gradescope's real bugs got found and fixed.

## Roadmap

- ~~**Phase 2 — Reminders.**~~ Done. Configurable lead-time notifications,
  in-app only, driven off `Task.due_at`. Email/push notifications were
  explicitly deferred, not forgotten — revisit if in-app polling isn't enough.
- ~~**Phase 3 — Gradescope adapter.**~~ Done, verified against a real account
  across multiple syncs: one-time interactive login via a real Chromium
  window (Playwright), session carried forward via a saved cookie file for
  every later headless sync — see [Connect Gradescope](#connect-gradescope).
- ~~**Phase 4 — PrairieLearn adapter.**~~ Built and self-tested (parser
  grounded in PrairieLearn's real template source, login/sync plumbing tested
  against the real site) — not yet confirmed against a real account, since
  that needs your own SSO/Duo login. See
  [Connect PrairieLearn](#connect-prairielearn).
- **Phase 5 — Polish.** Drag-and-drop kanban tabs, packaging the whole thing
  as a single `docker compose up`.

## Project layout

```
backend/app/
  main.py            FastAPI app, CORS, router mounting, scheduler startup, stranded-login recovery
  config.py          Settings (secret key, DB path, sync interval)
  db.py              SQLModel engine/session, plus a tiny add-missing-columns migration helper
  security.py        Fernet encrypt/decrypt for stored credentials
  browser_login.py    Generic interactive-login mechanism (headed login, encrypted saved-cookie handoff)
  models.py           User, Integration, Course (name/term/code), Task (due_at/late_due_at), Reminder, AppSettings
  schemas.py           Pydantic request/response models
  sync_service.py      Runs every integration's adapter, upserts Course/Task rows, closes adapters
  reminders.py          Reminder generation + lead-time settings
  scheduler.py          APScheduler background job wrapper
  adapters/
    base.py              Adapter interface (SyncedCourse, SyncedTask) + extract_course_code()
    canvas.py            CanvasAdapter (official REST API)
    gradescope.py         GradescopeAdapter (headless Playwright + BeautifulSoup parsing)
    prairielearn.py        PrairieLearnAdapter (same pattern; popover-based due-date parsing)
  routers/
    integrations.py       Connect/disconnect Canvas + Gradescope + PrairieLearn (incl. interactive login)
    courses.py             List synced courses
    tasks.py               List tasks, mark done/dismissed
    reminders.py            List/dismiss reminders (with same-task collapsing)
    settings.py             Get/update reminder lead times
    sync.py                 Manual sync trigger + status

frontend/src/
  api/client.ts        Typed fetch wrapper for the backend API
  lib/
    date.ts               parseApiDate() - correctly interprets the backend's naive-UTC timestamps;
                           effectiveDueDate() - regular due date, or the late cutoff once it's passed
    term.ts                parseTermRank()/compareTermRank() - season+year comparison across platforms
    courseGroups.ts          groupCourses() - merges the same real class across platforms by course code
    sourceColors.ts          Per-platform badge/pill color coding (Canvas green, Gradescope blue, PrairieLearn orange)
  pages/
    Onboarding.tsx        Connect Canvas/Gradescope/PrairieLearn, manage integrations, reminder settings, manual sync
    Dashboard.tsx           Upcoming tasks grouped by due date
    CalendarPage.tsx        Month calendar of due dates (overlaps into adjacent months' leading/trailing days)
    CourseTabs.tsx           Per-course-group to-do/done board, current-semester vs. archived split,
                              merging the same real class across platforms
  components/
    TaskCard.tsx, CalendarGrid.tsx, ConnectCanvasForm.tsx,
    NotificationBell.tsx, ReminderSettings.tsx,
    ConnectPlatformButton.tsx   (shared by Gradescope + PrairieLearn's connect flow)
```
