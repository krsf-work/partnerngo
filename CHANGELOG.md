# Changelog

## V74.8 — 2026-11-04
### Changed
- Tap anywhere on a key result or action line to tick it, like Google Keep.
  No extra screen opens. A small › at the end of the line opens the status
  and note.
- Objectives on My OKRs and the NGO page fold. Tap an objective to show its
  key results, then tick them in place. A fully done objective shows a green
  tick.

## V74.7 — 2026-11-04
### Fixed
- 9 am reminder sign-up now saves and checks the phone's record with a direct
  HTTPS request to the database. The database library could show the record
  as saved from its local copy while the server never got it.

## V74.6 — 2026-11-04
### Fixed
- 9 am reminder sign-up reads its record back from the server before showing
  ON; the bell panel shows a live server check of registered phones.

## V74.5 — 2026-11-04
### Changed
- Bell panel says plainly whether 9 am reminders are ON or NOT set up on this
  phone, with the reason; shows the app version at the bottom.

## V74.4 — 2026-11-04
### Fixed
- Phone sign-up for the 9 am reminder now reports why it failed. The bell
  panel shows the reason and a "Turn on 9 am" button to retry.
- Removed duplicate copies of a few functions left by the build script
  (they were identical, so behaviour did not change).
- Reminder job: loads the app helpers it needs inside its sandbox.

## V74.3 — 2026-11-04
### Added
- 9 am deadline reminder on phones, even when Sahkar is closed. "Turn on"
  registers the phone with Firebase Cloud Messaging (token under
  push/{auth uid}); a GitHub Actions job (.github/workflows/daily-reminders.yml,
  push/send-daily.js) works out each person's deadlines with the app's own
  functions and sends one notification: e.g. "3 overdue · 2 due today".
- Service worker shows the push and sets the app-icon badge.
- Database rule for push/{uid}: only that team login can write its tokens.

### Changed
- The on-open reminder no longer fires when the 9 am push is set up.

## V74.2 — 2026-11-04
### Added
- Home: "Done today" list. Items you tick stay visible there, ticked and
  struck through; tick again to reopen.
- Home: a filter to show one NGO's items (every open action and key result,
  including later and undated ones) or only your own OKRs and actions.

### Changed
- Demo: Partnership Lead and Associate Partnership Lead are one role; no
  reporting line between demo users.

## V74.1 — 2026-11-04
Simpler screens, one-tap ticks.

### Changed
- Home is a plain checklist: Overdue, Today, This week. Tick the circle on a
  line to mark it done; Undo appears for a few seconds. The purple deadline
  box and the sideways "Up next" cards are gone.
- Ticking works on the line everywhere: NGO actions, NGO key results, my key
  results and my action items. Tapping the text still opens details and notes.
- NGO cards are now simple rows; Money shows one summary and the debit note
  stages as a list.
- Flatter look: no card shadows, month and person chips wrap instead of
  scrolling sideways. No page scrolls sideways on a phone.

### Added
- demo.html: the app with made-up data and a role switcher; nothing is saved.

## V74 — 2026-11-03
A new interface built around the three jobs a team member does in Sahkar:
their NGOs' OKRs and action items, their own OKRs and action items, and each
NGO's budget and debit notes.

### Added
- **Home**: greeting, a deadline panel (overdue, due today, this week, later)
  across personal OKRs, NGO action items and NGO key results, "Up next" cards
  with a one-tap Done, and summary cards for the three jobs.
- **Notifications**: a bell with the count of overdue + due-today items and a
  panel listing every dated item by urgency. Optional daily phone/desktop
  reminder (browser notifications) and an app-icon badge; tapping the
  reminder opens Sahkar.
- **My NGOs**: searchable cards with KRs done, open/late actions, budget used
  and pending debit notes; the team's NGOs listed separately.
- **NGO page** with OKRs (by month, grouped by objective, plus milestones),
  Actions (tick off, add) and Money (budget vs spend by category, debit notes).
- **My OKRs**: personal key results and action items by month; set status and
  add a note on your own rows; add your own action items; managers can view
  each team member (read-only).
- **Budget & debit notes**: portfolio budget used, debit notes by stage,
  per-NGO list.
- **More**: account, reminders and every older module.
- Phone layout with a bottom tab bar, bottom sheets and an app bar whose title
  appears as you scroll; sidebar on tablet and desktop.
- Design tokens (colour, spacing, radius, type, elevation, motion), one icon
  set, subtle motion that respects "reduce motion".
- `docs/SPEC.md`; `tests/v74-home.test.js` (deadline buckets, scope, ownership).

### Changed
- The older modules keep working inside the new shell with the new colours.
- A Team MBO re-import keeps action items that were added in the app.
- Test harness keeps `async` when it extracts a function.

### Not in this release
- Reminders while the app is fully closed (needs a push server on the
  Firebase Blaze plan). Dark mode.

## V73 — 2026-11-03
Firebase sign-in, per-NGO data, locked database rules.

## V72 — 2026-11-03
NGO logins with a phone-first OKR and task view.
