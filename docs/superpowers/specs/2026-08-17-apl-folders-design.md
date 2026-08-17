# APL Folders on the Dashboard

Status: approved by Munjal 2026-08-17, ready for implementation plan.

## Why

Munjal wants a new way to browse the NGO portfolio on the Dashboard: one visual "folder" per Associate Partnership Lead (APL), each opening to show that APL's assigned NGOs. He shared a reference React component (`beui.dev/components/blocks/project-folder` — Framer Motion, Next.js, `lucide-react`) demonstrating the interaction he wants: hovering a folder fans out a peek of a few preview cards behind it; clicking expands it into a full view of everything inside.

That component can't run in this app — this is a single-file vanilla JS/HTML page with none of those dependencies. This spec recreates the same *interaction* (hover fan-out, click-to-expand) in plain JS/CSS, reusing this app's existing components wherever they already do the job (avatar styling, modal system) rather than building bespoke equivalents.

## Scope

**Who sees it**: PM role only. APL/Programme logins already only ever see their own single NGO set in the existing table — a folder view adds nothing for them. `ME.role==="PM"` gates the whole section.

**Where it lives**: the PM's Dashboard, in a new panel immediately after the existing KPI grid and before the "Partner NGOs" table. Nothing existing on the Dashboard is removed, reordered, or restyled — this is purely additive, directly below `.kpi-grid` in `pageDash()`'s return template.

## Data

One folder per `DB.users` record with `role==="APL"` (the same set `dailyPmPage()` and others already use, filtered further to just `role==="APL"` since this view is specifically about APL-managed NGOs — Programme-role logins are a different assignment mechanism and are out of scope here). For each APL:

- **Folder title**: `apl.name`
- **NGO set**: `DB.ngos.filter(n => (apl.ngoIds||[]).includes(n.id))` — the exact same `ngoIds` field already used everywhere else in this app for APL↔NGO assignment (`visibleNgos()`, `canEditNgo()`, `aplNamesFor()`).
- **Count**: `ngos.length` (may be 0 — an APL with no assigned NGOs still gets a folder, showing "0 NGOs", no hover fan, and an empty message if clicked).

No new data fields, no schema change. Assignment is managed exactly where it already is today (Admin panel), not touched by this feature.

## Interaction

**Closed folder (default state)**: a card showing the APL's name and NGO count, visually similar to the reference component's folder shape (a small icon/tab element behind a labelled front panel) but built with plain CSS, not the reference's clip-path "paper stack" render — see Visuals below.

**Hover (desktop only, mouse-capable)**: up to 5 of the APL's NGOs fan out behind the folder as small angled avatar chips (CSS `transform: translate/rotate`, no JS animation library — a CSS transition on `:hover` is enough for this effect). Capped at 5 purely for visual tidiness; if the APL has more than 5 NGOs, only 5 preview chips show on hover, but this cap does **not** apply to the click-expanded view. On touch devices (no hover), this step is skipped entirely — tapping goes straight to the expanded view.

**Click**: opens via the app's existing `showModal(modalShell(eyebrow, title, body, footer))` system (the same modal used for the NGO edit form, debit note form, etc. — index.html, `function showModal`/`function modalShell`) rather than a new custom overlay. `eyebrow` = "APL Folder", `title` = the APL's name, `body` = a responsive grid of **all** the APL's NGOs (not capped at 5 — the hover cap is a decorative-only limit), `footer` = just a "Close" button matching the existing modal footer convention.

**Each NGO card** (both in the hover fan and the expanded grid): the existing `.ngo-avatar` component (index.html:626-630) — a 42px rounded-square with the NGO's initials, colored by vertical using the existing `.ngo-avatar.livelihood/education/advocacy/healthcare/climate` classes (index.html:631-635, already live elsewhere) — plus the NGO's short name underneath. Nothing else (no scorecard status, no budget %) — confirmed minimal, per Munjal's pick from the mockup round.

**Clicking an individual NGO card** inside the expanded grid navigates to that NGO's detail page — `go('ngo', ngoId)`, exactly the same call the existing "Partner NGOs" table row click already makes. Closes the modal first (`closeModal()`) the same way every other in-modal navigation in this app already does.

## Visuals

The reference component's folder shape (a rounded card with a label strip at the bottom, "paper" stacked behind it via `clip-path`/3D transforms) is more elaborate than this app's existing visual language (flat cards, soft shadows, no 3D transforms anywhere else in the file). Rather than importing that level of visual complexity, the folder itself will be a simpler flat card matching the existing `.panel`/`.ngo-card` styling already used throughout — a rounded card with a folder icon (📁 or similar), the APL's name, and a count badge. The *only* piece of the reference's visual language being recreated is the hover fan-out of small avatar chips behind the folder and the click-to-expand reveal — not the literal paper-stack/3D-flip rendering.

## Explicitly out of scope

- No drag-and-drop, no reassigning NGOs between APLs from this view (that stays in the Admin panel).
- No changes to the existing "Partner NGOs" table or any other Dashboard section.
- No mobile-specific redesign beyond the existing app's responsive breakpoints already handling `.panel`/grid layouts at 375px — the hover fan-out simply doesn't trigger on touch (skips straight to click behavior), which is standard behavior for hover-only affordances in this app already (e.g. table row hover states).
- No new avatar/color scheme — reuses `.ngo-avatar`'s existing five vertical colors as-is.

## Testing / verification plan

- Confirm the folders panel renders only for `ME.role==="PM"` — log in (read-only inspection, no live-data writes per this session's standing constraint) as PM vs. a non-PM role and confirm presence/absence.
- Confirm folder count matches `apl.ngoIds.length` for each APL, including an APL with 0 NGOs (folder still renders, "0 NGOs", no hover fan).
- Confirm hover fan caps at 5 chips even for an APL with more than 5 NGOs, but the click-expanded grid shows the full set.
- Confirm clicking an NGO card in the expanded grid closes the modal and navigates to that NGO's detail page, matching the existing table-row click behavior exactly.
- Confirm nothing else on the Dashboard (KPI grid, NGO table, scorecard, activity feed) changed — this is purely additive.
- Manual pass at 375px width: folders panel should wrap/stack sensibly, and tapping a folder (no hover) goes straight to the expanded modal.
