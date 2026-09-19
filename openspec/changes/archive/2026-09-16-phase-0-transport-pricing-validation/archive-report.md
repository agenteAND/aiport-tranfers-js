# Archive Report: Phase 0 Transport Pricing Validation

## Final State

- Change: `phase-0-transport-pricing-validation`
- Artifact store: OpenSpec
- Archive destination: `openspec/changes/archive/2026-09-16-phase-0-transport-pricing-validation/`
- Archive date: 2026-09-16
- Capability affected: `transport-native-pricing` (NEW capability, full spec — no prior canonical spec)
- Status: archived successfully

## Readiness Gates

- Task Completion Gate: the persisted task artifact (`tasks.md`, the completion-visibility source of truth) shows **31 checked, 0 unchecked**. No stale-checkbox reconciliation was required or performed.
- `verify-report.md` verdict was `pass_with_warnings`, with `blockers: 0` and `critical_findings: 0`. No CRITICAL issue was present, so no override boundary was approached.
- `rules.archive` from `openspec/config.yaml` requires a warning before merging a destructive delta. **This delta is not destructive.**

### Destructive-Delta Warning (mandatory per `openspec/config.yaml`)

`rules.archive` states: *"Warn before merging destructive deltas."* The warning is issued here, and then resolved:

- The capability `transport-native-pricing` is **NEW**. `openspec/specs/transport-native-pricing/` did not exist before this archive (verified: the directory was absent, and `openspec/specs/` contained only `transfer-fare-pricing`, `transfer-zone-modeling`, `transfer-quote-cart`, `transfer-reservation-lifecycle`, `transfer-change-operations`, and `transport-admin-operations`).
- **No existing requirement is overwritten, modified, renamed, or removed.** The delta spec contains no `ADDED`/`MODIFIED`/`REMOVED`/`RENAMED` operation headers — it is a complete spec, not a delta against a canonical file.
- No other canonical spec was read, edited, or touched by this archive. The six pre-existing capability specs are byte-for-byte unchanged.

Therefore no destructive merge occurred and no confirmation was required. The warning is recorded because the rule mandates it, not because a risk was present.

## Specs Synced

Because the canonical spec did NOT exist, the delta spec IS the full spec. It was copied **mechanically with the shell** — never by routing content through model Read/Write:

```bash
target_dir="openspec/specs/transport-native-pricing"
target_path="$target_dir/spec.md"
source_spec="openspec/changes/phase-0-transport-pricing-validation/specs/transport-native-pricing/spec.md"

mkdir -p "$target_dir"
temp_path="$(mktemp "$target_dir/.spec.md.XXXXXX")"
cp "$source_spec" "$temp_path"          # COPY_STATUS=0
diff -r "$source_spec" "$temp_path"     # DIFF_R_EXIT=0 EMPTY=yes
mv "$temp_path" "$target_path"          # MOVE_STATUS=0
```

The `mktemp` intermediate plus `mv` kept the write atomic: the canonical spec only ever appeared as the verified copy, never as a partial write. No temporary file remains.

| Domain | Action | Details |
|---|---|---|
| `transport-native-pricing` | Created (new capability) | 12 requirements, 19 scenarios. Full spec installed from the change's delta spec. |

Byte-identity evidence (source vs. canonical):

```text
e5a8d3725e9d28a5c36a1a1b94f9fc8e6ebc678a90a16725cda34f1e525268ec  openspec/changes/phase-0-transport-pricing-validation/specs/transport-native-pricing/spec.md
e5a8d3725e9d28a5c36a1a1b94f9fc8e6ebc678a90a16725cda34f1e525268ec  openspec/specs/transport-native-pricing/spec.md
```

Structural verification of the composed canonical spec:

- `### Requirement:` headings: 12
- `#### Scenario:` headings: 19
- Delta operation headers (`## ADDED` / `## MODIFIED` / `## REMOVED` / `## RENAMED`): none — consistent with a full spec.

## Final-State Facts Applied (snapshot reconciliation)

`verify-report.md` and `tasks.md` are **intermediate snapshots**. Their "done" statements remain true; their pending statements are valid only for the moment they were written. Per the Final-State Authority hierarchy, the launch-reported final-state facts outrank those snapshots. The differences are recorded explicitly:

### WARNING-1 — RESOLVED (snapshot says OPEN; snapshot is stale)

- **What the snapshot says:** `verify-report.md` records WARNING-1 as OPEN — integration test A3's absent-currency probe requested a zone direction that had no rule in *any* currency, so it demonstrated missing-direction handling rather than currency isolation.
- **Current state (authoritative):** **RESOLVED.** Fixed in commit `9a78bb6` (`test(pricing): prove currency isolation in A3, not missing direction`).
- **Repository corroboration** (`git show 9a78bb6` confirms the change on disk): the reverse direction is now priced in `usd` only (added `fare(sedan.variant_id, PUNTA_CANA, PUJ, 4800, "usd")`); the same direction is requested in `dop` and must return `no_price`; and a **premise guard** asserts the `usd` rule exists and returns `4800` first, so the absent-currency assertion can no longer silently regress into testing a direction with no rule at all. The commit also added the Phase 0 verification report.
- **Post-fix evidence:** `native-pricing.integration.spec.ts` passes **13/13**.
- **This report does NOT carry WARNING-1 forward as open.** The behavior it flagged is now guarded by an executable test, not only by the acceptance command.

### WARNING-2 — remains OPEN (environment condition, not a defect)

- Verification and tests ran against a working tree that also carried unrelated uncommitted edits — `adminUpdateVehicleClass` in `apps/backend/src/modules/transport/service.ts`, `admin-helpers.ts`, `apps/backend/package.json`, and `pnpm-lock.yaml`. None of them are part of this change's commits.
- This is an **environment condition, not a code defect**. It means the recorded test/build evidence corresponds to the working tree rather than to a commit in isolation. It is carried forward as an open, non-blocking caveat.
- Additional unrelated untracked working-tree items also exist and are outside this change. They were not touched, not archived, and are not enumerated here as change artifacts.

### SUGGESTION — consciously declined

- `verify-report.md` suggested asserting the benchmark's `p95_within_prd_target` flag in tests. This was **deliberately NOT applied**:
  1. It would introduce a **flaky timing assertion** into the suite (wall-clock latency is not stable on shared/dev machines).
  2. The spec **forbids asserting production capacity requirements** (`Requirement: Benchmark evidence` — "It MUST NOT assert a production capacity requirement"), and an in-test assertion of the PRD target flag moves in that direction.
- This is recorded as a **conscious, reasoned decline**, not as an oversight.

## Verification Snapshot at Close

Numbers below are final values from the highest-ranked source covering them (launch-reported terminal state, corroborated by commit `9a78bb6` on disk). They are not copied from stale intermediate snapshots.

- Verdict: `pass_with_warnings` — **0 blockers, 0 CRITICAL findings, 12/12 requirements, 19/19 scenarios, 31/31 tasks**.
- The single real warning (WARNING-1) is **fixed**; the remaining warning (WARNING-2) is an environment condition.
- Canonical capability spec at close: 12 requirements, 19 scenarios — matching the verified 12/12 and 19/19.

### Evidence of record

- `native-pricing.integration.spec.ts`: **13/13 passing** after the `9a78bb6` fix.
- `fare-matrix-benchmark.spec.ts`: **1/1 passing**; benchmark matrix rows reported with p50/p95/max and environment; all observed below the 250 ms PRD internal-calculation target; `production_validation: "pending"`.
- `pnpm run phase0:acceptance`: **exit 0** — full scenario printed, all acceptance booleans true, deterministic repeat true, p50 7.38 / p95 9.04 ms.
- `npx medusa build`: **exit 0** — backend and frontend builds completed successfully.
- `medusa lint`: **exit 1**, unavailable (`eslint` not installed) — a pre-existing environment condition, not caused by this change, and **never recorded as a pass**.

### Scope shipped

- New adapter `apps/backend/src/modules/transport/pricing/native-transport-pricing.ts`, the `calculate-transport-price` workflow and its step, fixture modules, integration + benchmark specs, and `scripts/phase-0-acceptance.ts`.
- `service.ts`'s bespoke `resolveTransferFare` remains **authoritative and untouched**; replacing it is a Phase 1 decision, not a Phase 0 outcome.
- **No dedicated fare-matrix fallback** was implemented and none is required by this evidence. If a later decision rejects native pricing, that fallback requires its own separate proposal.

## Phase 0 Decision

**PASS** — Medusa 2.20.1's native Pricing Module supports directed transport pricing for all 9 assertions. **Phase 1 MAY use the native Pricing Module.** The adapter and workflow are written as reusable production code, not spike scaffolding.

Phase 1 guidance carried forward: deterministic ambiguity detection **must be retained** — relying on `calculatePrices` alone would silently quote one of several equal-context prices.

## Delivery

- Branch `spike/phase-0-transport-pricing-validation`, commits **`bed501e`** and **`9a78bb6`**, pushed.
- PR **https://github.com/agenteAND/aiport-tranfers-js/pull/1** is **OPEN and NOT merged**. PR merge state was not fetched by this archive phase; remote state is reported as provided by the orchestrator and was not independently verified here.
- Delivery strategy for this change: `single-pr` with a `size:exception` against the 400-line review budget (Task `Review Workload Forecast`: 800–1,000 estimated changed lines, slices not independently shippable).
- Delivery is human-owned. **No commit, push, or PR operation was performed by this archive phase.**

## Mechanical Readback Evidence

Copies and moves used shell commands only (`cp`, `mv`, `git mv`). Artifact content was never routed through model Read/Write.

- Canonical spec copy (new capability): `diff -r "$source_spec" "$temp_path"` → exit 0, no output (`DIFF_R_EXIT=0 EMPTY=yes`).
- Archive move: `git mv` **succeeded** (`GIT_MV_STATUS=0`); the plain-`mv` fallback branch did not run and was not needed.
- Source removal confirmed before comparison: `SOURCE_ABSENT=yes`.
- Mandatory post-move readback: `diff -r "$snapshot_root/source" "$destination"` → exit 0, no output:

```text
DIFF_R_EXIT=0 EMPTY=yes
```

An empty `diff -r` is the only passing evidence for byte-identity, and it was neither skipped nor substituted. No non-empty output, non-zero status, or missing comparison occurred. This `archive-report.md` is additive-only and was excluded from the comparison because it did not exist in the source snapshot.

Structural checks after the move:

- `openspec/changes/` contains only `archive/` — the change is no longer active.
- Archived `tasks.md`: **31 checked, 0 unchecked**.
- Pre-existing archives `2026-09-13-airport-transfer-mvp/` and `2026-09-15-admin-vehicle-class-management/` were **not modified**.
- `git status` records the folder move as four clean `R` (rename) entries, one per tracked artifact.
- No `apps/**` source file was modified by this archive phase.

## Archive Contents

- `proposal.md`
- `specs/transport-native-pricing/spec.md`
- `tasks.md` (31/31 complete)
- `verify-report.md` (intermediate snapshot; WARNING-1 superseded by the final-state reconciliation above)
- `phase-0-result.md` (Phase 0 PASS/FAIL decision, benchmark table, discovered limitations, Phase 1 guidance)
- `archive-report.md` (this file)

No `design.md` exists **by intent**: the open question was empirical and resolved by executable evidence rather than by an architectural design (`tasks.md` header). No `exploration.md` or `apply-progress.md` were produced for this change.

## Reconciliation and Discrepancy Records

- **`verify-report.md` and `tasks.md` are attributed as intermediate snapshots.** Their statements are preserved as history and are not restated in bare present tense as current facts. Where they conflict with the launch-reported final state, the final state governs and the fix is cited (`9a78bb6`).
- **No unrankable contradiction was found.** The launch-reported claim that WARNING-1 was fixed is corroborated by repository evidence: commit `9a78bb6` is present on the current branch, and its diff implements exactly the described premise-guarded currency-isolation test. Where a claim could not be corroborated locally (the PR's remote state), it is explicitly marked as not independently verified rather than asserted.
- **Distinct items were not merged into one causal story.** WARNING-1 (test-fixture shape) and WARNING-2 (uncommitted working-tree edits) are recorded as separate findings with separate causes; only WARNING-1 was fixed. WARNING-2's cause is explicitly recorded as **environmental**, and no diagnosis is invented for it.

## Completion

The change has been planned, implemented, verified (`pass_with_warnings` — 0 blockers, 0 CRITICAL), synced into the canonical OpenSpec capability spec as a new capability, and archived. **The SDD cycle is complete.**

Open items carried forward, none blocking:

1. **WARNING-2** — verification evidence corresponds to a working tree that carried unrelated uncommitted edits.
2. **Lint unavailable** — `medusa lint` cannot run (`eslint` not installed); recorded as unavailable and never as a pass.
3. **Production capacity validation** — explicitly out of scope and pending defined load and infrastructure; the benchmark asserts no capacity requirement.
4. **Phase 1 decision** — whether to replace `resolveTransferFare` with the native pricing path, and to retain deterministic ambiguity detection.
