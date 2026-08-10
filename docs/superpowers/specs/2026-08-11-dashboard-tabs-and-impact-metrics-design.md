# Dashboard tabs redesign + Beneficiaries/Impact-amount metrics

Status: approved by Munjal 2026-08-11, ready for implementation plan.

## Why

Munjal is unhappy with the current Dashboard for three reasons: it's visually plain, information is hard to scan, and the wrong things are prioritized — one long vertical scroll stacking the KPI grid, a dense 6-column NGO table, a scorecard heatmap, and an activity feed, all competing for attention at once.

Separately, he wants two new headline numbers on the Dashboard: total beneficiaries reached, and a total impact amount (₹) — neither of which exists today.

## Part 1 — Dashboard tabs

`pageDash()` (index.html, `function pageDash()`) splits into three tabs, following the same in-page-tab pattern already used elsewhere in this file (`NGO_TAB` on the NGO detail page, `SC_VIEW` on the scorecard panel: a module-level `let` variable, a row of buttons that set it and call `render()`, and the tab body chosen by a ternary/switch). New state: `let DASH_TAB = "overview";`

The page header (`FY 2025-26 · Aug 2026` eyebrow + "Dashboard" h1) stays exactly as-is, unchanged, above the tab bar.

**Overview tab (default)**:
- The existing `dailyHomeWidget()` call (unchanged — APL/Programme only).
- A compact KPI summary containing the four existing metrics (NGO Partnerships, Approved Budget, Milestones — Delivery, Partner Scorecard) **plus the two new ones below** — six tiles total, restyled to read as a light summary strip rather than the current four large boxed panels. No alert/call-out cards — that content was removed from the Dashboard in the previous change and stays removed.

**NGOs tab**:
- The existing "Partner NGOs" table (`dashNgoRow` rows), moved here unchanged.
- The existing `scorecardPanel(ngos)` (grid/trend heatmap), moved here unchanged, directly below the table.

**Activity tab**:
- The existing "Recent activity across partners" panel (`portfolioActivityStream`), moved here unchanged.

Nothing about how any of these five existing pieces (`dailyHomeWidget`, the four original KPI tiles, the NGO table, the scorecard panel, the activity feed) computes its data changes — this is purely a layout regrouping. `ngos = visibleNgos()` is still computed once at the top of `pageDash()` and passed to whichever tab needs it, same as today.

## Part 2 — Beneficiaries KPI (new)

**Data source**: existing `DB.bigBets` milestone records — no new data, no new input from anyone. A bet counts if `bet.unit === "beneficiaries"` (matches Munjal's explicit choice: only milestones literally using that unit, not every people-denominated unit like households/women/students/farmers). This is a real undercount relative to total people reached across the portfolio — a known, accepted tradeoff, not a bug.

**Computation**: for each qualifying bet in scope (its `ngoId` in `visibleNgos()`), compute `betCumulative(bet, lastReportedMonth(bet))` — the exact same "cumulative achieved so far this FY" helper the app already uses for milestone progress (index.html, `function betCumulative`). Sum across all qualifying bets. A bet with no reported months yet (`lastReportedMonth` returns `null`) contributes 0.

```js
function totalBeneficiaries(ngos){
  const ids = new Set(ngos.map(n=>n.id));
  return (DB.bigBets||[])
    .filter(b=>ids.has(b.ngoId) && b.unit==="beneficiaries")
    .reduce((sum,b)=>{
      const lm = lastReportedMonth(b);
      return sum + (lm ? betCumulative(b, lm) : 0);
    }, 0);
}
```

Rendered as a sixth KPI tile in the Overview summary: icon, the number, label "Beneficiaries reached".

## Part 3 — Impact amount KPI (new) + NGO-level manual field

**Why not derive this from milestones**: only one existing milestone (`b2`, NGO `n1`) is a genuine cumulative ₹ total (`levelType:false`); the other two ₹-unit milestones (`b5` and one more) are *average income levels* (`levelType:true`) — a rate, not a sum — and summing them together with `b2` would produce a meaningless number. Deriving "impact amount" from milestone data today would represent 1 of 23 NGOs. Munjal confirmed: add a manual field instead.

**New NGO field**: `impactAmount` (number, ₹, optional — blank/undefined treated as 0), added to the NGO record shape alongside existing fields like `name`, `vertical`, `state`, etc.

**Data entry**: a new field in the NGO edit form (`openNgoForm(ngoId)` / its save handler, index.html — the same form behind the "Edit partner" button, which is already PM-only per the existing `${ME.role==="PM"?...}` gate at the call site). Label: "Total impact amount (₹)" with a hint: "Optional — a one-off figure representing this NGO's overall impact so far, entered manually." A plain numeric input, following the same pattern as other ₹ fields already in this form (e.g. budget fields use `type="text" inputmode="numeric"` with the existing `fmtAmtInput` comma-formatting helper).

**Computation**: sum across NGOs in scope.

```js
function totalImpactAmount(ngos){
  return ngos.reduce((sum,n)=>sum+(n.impactAmount||0), 0);
}
```

Rendered as the sixth KPI tile in the Overview summary (Beneficiaries reached is the fifth — together the two new tiles join the four existing ones, six total, per Part 1). Icon, `fmtRs(totalImpactAmount(ngos))`, label "Total impact amount".

## Explicitly out of scope

- No change to how the four *existing* KPI metrics are computed.
- No migration or backfill of `impactAmount` for existing NGOs — it starts undefined (treated as 0) for all 23 until someone fills it in.
- No broadening of the "beneficiaries" unit filter beyond the literal `"beneficiaries"` unit string — already explicitly decided.
- No visual restyling beyond what's needed to fit six tiles in a "compact summary" instead of the current four large panels — this is a layout/grouping change, not a full re-skin (Munjal's "plain/boring" complaint is addressed by the tab restructure itself: less on screen at once, KPIs read as a summary strip instead of the dominant first thing on the page — no new color scheme or illustration work is in scope here).

## Testing / verification plan

- Confirm all three tabs render their correct, unchanged content (nothing dropped in the regroup) — spot-check against what `pageDash()` renders today before the change.
- Confirm Overview is the default tab on page load, and switching tabs preserves via the same `DASH_TAB` + `render()` pattern used by `NGO_TAB`/`SC_VIEW` elsewhere (no page reload, no state loss for `dailyHomeWidget`'s unsaved-input risk — since the widget lives on Overview only, switching to NGOs/Activity and back should behave like navigating away from a form, same as any existing tab switch already does).
- Confirm `totalBeneficiaries()` and `totalImpactAmount()` both correctly scope to `visibleNgos()` (an APL/Programme login sees a smaller number than PM, matching only their assigned NGOs — reusing the same `ids` scoping already fixed for `visibleNgos()`/`canEditNgo()` earlier this session).
- Confirm a bet with `unit==="beneficiaries"` but zero reported months contributes 0, not `null`/`NaN`, to the total (scratch-test `totalBeneficiaries` against a small fixture before pasting into `index.html`, same convention as this session's other pure-logic functions).
- Confirm the new `impactAmount` field appears only in the PM-gated NGO edit form, saves correctly, and an NGO with no value set contributes 0 (not `NaN`) to `totalImpactAmount()`.
- Manual pass at 375px width for the new tab bar and six-tile KPI summary.
