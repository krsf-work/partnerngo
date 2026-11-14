# Changelog

## V77.5 — 2026-11-14

### Added
- Partnership leads can upload their own OKR / MBO sheet from the OKRs page (the PM can still upload for anyone).
- Leads can upload an NGO's OKR sheet from that NGO's OKR tab. Key results for the months in the file replace that NGO's key results for those months; action rows are left out.
- A + button on a lead's Home screen adds an action item for an NGO: pick the NGO, write the item, deadline set to 7 days from today (can be changed). When Home is already filtered to one NGO, that NGO is used.

## V77.4 — 2026-11-09
### Added
- Upload on the OKRs page (Program Manager): pick whose OKRs (yourself
  included), choose the MBO / OKR spreadsheet, check the preview, then
  Import. Nothing is saved before Import. After importing, the page opens
  on that person and month.
### Changed
- The OKRs page picks the person and the month from two compact pickers
  instead of rows of buttons; the "Tap an objective…" hint is gone.
- Objective and key-result text is a little smaller and lighter.
### Fixed
- A spreadsheet whose sheet isn't named MBO/OKR (for example "Sheet1") is
  now read when it is laid out like an MBO, instead of being skipped.
- Offline cache bumped to pulse-v77-5.

## V77.3 — 2026-11-09
### Changed
- On phones the bottom bar now sits flush on the bottom edge (solid white,
  no floating gap), and the page uses the full screen including the area
  behind the iPhone home bar.
### Fixed
- Icon files have new names (pulse-192.png, pulse-512.png,
  pulse-maskable-512.png, pulse-apple-touch.png) so phones and browsers
  can't reuse a cached copy of the old logo. The old files stay in place
  for anything that still points at them.
- Offline cache bumped to pulse-v77-4.

## V77.2 — 2026-11-09
### Added
- "Install Pulse" card at the top of Today/Overview, and an Install row on
  Me, wherever the app can be installed. On Android and desktop it opens the
  browser's install box; on iPhone it shows the Share → Add to Home Screen
  steps. The card can be dismissed and hides once Pulse is installed.
### Fixed
- The welcome greeting no longer cuts off the top of Gujarati letters
  (the sign on તે in નમસ્તે); the Gujarati word also sits slightly lower.
- Offline cache bumped to pulse-v77-3.

## V77.1 — 2026-11-09
### Changed
- The menu's third item is now OKRs (key results and action items) instead
  of Add. Menu: Today/Overview · NGOs · OKRs · Me.
- The Overview no longer shows the "KRs done" card.
- Offline cache bumped to pulse-v77-2.
### Removed
- The Add menu. Debit notes and NGO actions are added from the NGO's page.

## V77 — 2026-11-09
### Added
- Program Manager Overview: budget used this year (with the expected pace),
  NGOs active/passive, debit notes pending (count and amount), KRs done,
  overdue items, budget used by each NGO, and a summary for each
  Partnership Lead.
- An Add button (the round "+" on phones) for a debit note, an NGO action,
  your own OKR action or the daily log.
### Changed
- One way to every page. The menu is now Today (Overview for the PM) ·
  NGOs · Add · Me. The 11-page "Workspace" list is gone; the PM's older
  tools are under Me → Programme tools.
- Partnership Leads see their NGOs at the bottom of Today instead of
  duplicate shortcuts.
- Offline cache bumped to pulse-v77-1.

## V76.1 — 2026-11-08
### Changed
- The sign-in card no longer shows the "NGO OKRs, my OKRs, budgets and
  debit notes" line.
### Fixed
- The security policy now lets the database's fallback connection (used on
  networks that block WebSockets) open its hidden frame.
- Offline cache bumped to pulse-v76-2.

## V76 — 2026-11-08
### Changed
- The app is renamed **Pulse** (it was Sahkar), with the new Pulse logo on
  the sign-in screen, sidebar, intro splash, home-screen icons and browser
  tab. The demo, reminders and downloaded login list use the new name too.
- New home-screen icons, including a padded version for Android's round
  icons and an iPhone home-screen icon.
- Nothing changes for sign-in, data or settings: the address stays the same
  and internal names are kept, so every device keeps its session.
- Offline cache renamed to pulse-v76-1.

## V75.6 — 2026-11-08
### Security
- The page now has a Content-Security-Policy. Scripts may only come from
  this site, cdnjs, gstatic, jsdelivr and the Firebase database; network
  calls only go to Firebase and Google APIs; plugins are blocked and the
  page's base address can't be changed. Inline handlers are still allowed
  for now (the app has about 180 of them).
- Every outside script (SheetJS, the four Firebase files, the styled Excel
  library) carries an integrity hash. If a CDN ever serves a changed file,
  the browser refuses to run it.
- The offline cache keeps only successful answers, so an error page can no
  longer replace the app when offline, and only page loads fall back to the
  cached app.
- Tapping a reminder only ever opens a page of this site.
- The demo keeps its own browser storage, so trying the demo can no longer
  change the live app's cache, session or weekly-backup date on the same
  device. The demo no longer contains the Firebase settings.
### Changed
- Offline cache bumped to sahkar-v75-7.

## V75.5 — 2026-11-08
### Fixed (data safety)
- Two people saving at the same time no longer wipe each other out. A save
  now merges with what is on the server: different rows, and different
  fields of the same row, are both kept. If the same field was changed, the
  later save wins. If a list can't be merged safely, nothing is overwritten:
  the app shows "Someone else changed this at the same time" and loads the
  server copy.
- Edits made while offline are merged on reconnect instead of replacing
  changes others made in the meantime. Rows added by the email-capture
  script are kept.
- First-time setup only fills a completely empty database. A missing
  settings entry can no longer reset the tracker, and an empty database
  can now be set up (before, setup failed and the app went offline).
- Restore from backup now checks the file first (right shape, every row
  has a unique id, a PM user exists), shows record counts now vs in the
  backup, warns in red when the backup has far fewer records, and
  downloads a copy of the current data before replacing it.
### Changed
- Offline cache bumped to sahkar-v75-6.

## V75.4 — 2026-11-08
### Changed
- Saving now sends only the lists your role is allowed to change: only the
  PM sends the user list, and a Viewer sends only their own OKR ticks and
  daily logs. Nothing changes for what anyone can do in the app.
- This prepares for the per-role database rules (next step): once those
  are live, a save never includes a list the rules would refuse, so no
  one's saves start failing.
- Offline cache bumped to sahkar-v75-5.

## V75.3 — 2026-11-08
### Fixed (security)
- The PM's login actions (remove, reset password, set up, change role or
  username, NGO logins) now decide which accounts to change from the
  PM-only roles/ and logins/ in the database, not from the user list that
  any team login can edit. A tampered user record can no longer keep a
  removed login alive, remove someone else's access, give itself a higher
  role on reset, point an NGO login at another NGO, or take over another
  person's username.
- Restoring a backup now matches every user's login to the live accounts,
  so an old backup can't bring back a retired password.
- A device signs out as soon as its login is removed or its role changes,
  with a message saying why.
- Your own role always comes from the database. A changed user-list entry
  can no longer sign the PM out.
- In the downloaded "Sahkar logins" CSV, a name that starts with = + - or @
  is kept as plain text, not run as a spreadsheet formula.
### Changed
- Offline cache bumped to sahkar-v75-4.

## V75.2.1 — 2026-11-08 (reminder job only; the app is unchanged)
### Fixed (security)
- The 9 am reminder job installs firebase-admin from a committed lockfile
  (push/package-lock.json: exact versions and checksums for all 167
  packages) with `npm ci --ignore-scripts`. A newly published bad version
  of any package can no longer slip in on its own.
- GitHub Actions are pinned to exact commits, and checkout no longer keeps
  its GitHub token on disk.
### Removed
- A debug step that re-read the push list and put a live access token in
  a web address. The public log now shows counts only.

## V75.2 — 2026-11-08
### Fixed (security)
- Saved text can no longer run as code. A name, note or ID with an
  apostrophe or code in it used to be able to break out of a button's
  click action. Every value inside a click action now goes through a new
  jsArg() helper (193 places).
- Links saved in the app (Drive links on debit notes, documents, OKRs)
  open only if they start with http:// or https://. Anything else, such as
  a javascript: link, becomes a dead link (10 places, new safeHref()).
- Date and month formatters now show non-date text as plain text.
- NGO short name in the "Mark … as …" prompt and the partnership tag are
  now escaped.
### Changed
- Offline cache bumped to sahkar-v75-3 so phones pick up the fix.

## V75.1 — 2026-11-08
### Removed
- An old, unused offline seed of real partner OKR rows (with Drive links)
  is gone from index.html and demo.html. These files are public, and the
  data was never shown: real OKRs live only in the database. Nothing in
  the app changes for users.

## V75 — 2026-11-04
### Changed
- New look. Colour now means something: red for overdue, amber for today,
  blue for this week, green for done.
- Home opens with a "day bar" that shows overdue, today, this week and done
  today in one line, in place of number boxes.
- Each Home group (Overdue, Today, This week, Done today) is a soft card
  with its own icon and count.
- Every NGO has its own colour dot, so lines are easy to scan. Key results
  and actions are marked with a small icon.
- Ticking: the circle pops green, the line strikes through, and it slides
  into Done today. The tick ring is tinted by how urgent the item is.
- Objectives show a progress ring, which turns green when all their key
  results are done.
- Floating bottom bar, rounder sheets, pill month chips, deeper cards.
- Pages animate in once when opened and don't flicker when you tick.

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
