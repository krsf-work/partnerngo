# Sahkar — product spec (V74)

## Purpose and users
Sahkar is the KRSF Partnership Program's work app. Team members (Partnership
Leads, Associate Partnership Leads, the Program Manager) use it mostly on a
phone, sometimes on a laptop. Partner NGOs have their own phone-only view
(V72/V73) and are unchanged by this release apart from styling.

A team member uses the app for three jobs:

1. **My NGOs** — follow each assigned NGO's OKRs (key results by month,
   milestones) and the action items raised for it.
2. **My OKRs** — follow and update their own monthly key results and action
   items (the Team MBO rows).
3. **Money** — each NGO's budget against spend, and its debit notes.

## Screens
| Screen | Who | What |
|---|---|---|
| Home | team | Greeting; deadline strip (overdue / due today / this week) across all three jobs; summary cards for the three jobs; my NGOs |
| Notifications | team | Panel from the bell: every open deadline, grouped by urgency; turn on phone reminders |
| NGOs | team | My NGOs, then my team's NGOs; per-NGO health (KRs done, open actions, budget used, pending debit notes); search |
| NGO | team | Header + tabs: OKRs (KRs by month + milestones), Actions (tasks), Money (budget, spend by category, debit notes) |
| My OKRs | team | Month picker; key results and action items grouped by objective; set status, comment, add an action item; managers can switch to a team member (read-only) |
| Money | team | Portfolio budget used, debit notes by stage, per-NGO list |
| More | team | Every older module (Milestones, Dashboard, Daily sheet, Documents, Team MBO import, Finance, Debit notes, Admin), account, sign out |

Mobile (<768px): top app bar + bottom tab bar (Home, NGOs, My OKRs, Money,
More). Desktop: left sidebar with the same five plus the older modules.

## Data model (unchanged storage, V73 paths)
| Entity | Path | Read | Write from new screens |
|---|---|---|---|
| NGO | tracker/ngos | visibleNgos() | none |
| NGO key result | ngoData/{ngo}/mbo | team | status, comment — canEditNgo |
| NGO action item | ngoData/{ngo}/tasks | team | status, create (existing form) — canEditNgo |
| Milestone | tracker/bigBets | team | none (older Milestones page) |
| Personal KR / action | tracker/teamMbo | visibleTeamMbo() | status, comment on own rows (PM: any); create own action items |
| Budget | tracker/budgets | team | none |
| Debit note | tracker/debits | team | create/edit via existing form — canEditNgo |

New field: `teamMbo[].source = "app"` on action items made in the app. A Team
MBO re-import of that month keeps them.

## Deadlines
- Personal rows: `deadline`.
- NGO action items: `due`.
- NGO key results: `timeline` parsed as a date, else the last day of the KR's month.
- Buckets: overdue (1–30 days late), today, this week (≤7 days), later.
  Open items more than 30 days late are counted as "older, still open", not
  shown as urgent.

## Notifications
In-app bell with a count. Phone/desktop reminders through the browser
Notification API: once a day, when the app opens, a summary notification and
an app-icon badge. Reminders while the app is fully closed need a push
server (Firebase Cloud Messaging + Cloud Functions on the Blaze plan) —
out of scope for V74.

## Done when
- A team member sees what is overdue and due this week at the top of Home in one glance.
- Marking a personal KR or NGO action done takes two taps from Home.
- Every new screen works at 360px, 768px and 1280px with no sideways scroll.
- An NGO's budget used and pending debit notes are visible from its page in one tap.
- All existing tests and the write-guard test pass.

## Out of scope (V74)
Dark mode; push while the app is closed; rebuilding the older modules'
internals (they get the new shell and colours only).
