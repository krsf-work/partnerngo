# Changelog

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
