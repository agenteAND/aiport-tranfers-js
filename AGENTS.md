# Project Instructions

## Workflow: ODD (Organic Driven Development)

This is the only workflow. No formal phases, no gates, no preflight, no proposals or specs.

1. **Authorize** — investigation, review, comparison, and audit are read-only. Implement only on explicit request.
2. **Explore** — read the relevant code and requirements first, proportioned to the task. Do not re-read established context.
3. **Resolve uncertainty** — ask one focused question only for a real unresolved product decision. Research only for a named unknown, from primary sources.
4. **Classify** — Lite, Standard, or Full (below). State the level and justify it in one sentence.
5. **Track before the first write** — create `odd/tasks/<feature>.md` and its memory mirror, and say so in one line. Small, understood work creates no document.
6. **Implement task by task** — smallest useful topology. One work-unit commit per task; Conventional Commits; tests and docs land with the code. Check an item off only after observing its outcome.
7. **Close** — report the verified outcome, the checks that failed or were skipped, and one concrete next step.

Work on one change at a time.

## Levels

Select by risk and uncertainty, never by line count. State the level and justify it in one sentence before implementing.

### Lite
A local change with clear expected behavior and an existing implementation pattern. Introduces no contract, persistence behavior, authorization rule, financial policy, external side effect, or architecture decision.

*Execution:* implement and verify. No task document.

### Standard
Bounded behavior inside the existing architecture and accepted contracts, with no unresolved critical decision.

*Execution:* focused exploration, implement, verify.

### Full
Defines or changes architecture, domain or public contracts, pricing or financial semantics, authorization, integrations with external effects, migrations, data integrity, concurrency, or destructive operations.

*Execution:* resolve the specific uncertainty with the smallest investigation that answers it, then implement and verify. When business policy is missing, ask for the decision — a model must never invent it.

## Artifacts

Three files carry all the durable context. Nothing else is required.

| File | Purpose |
|---|---|
| `odd/tasks/<feature>.md` | One per feature: objective, checklist with stable task IDs, progress, evidence, next step. |
| `odd/decisions.md` | Append-only decision log. One entry per decision: date, decision, why, alternatives rejected. |
| `odd/index.md` | Map of the repository: what exists, where, and what it does. Its purpose is that a task never requires reading the whole codebase. Keep it current when structure changes. |

If a decision is worth remembering it goes in `odd/decisions.md`. Do not create a document to restate information that already exists.

## Verification

- Run the strongest relevant check and report what you actually observed. Never claim a check passed unless you ran it and saw it pass.
- Never declare work done because code was written.
- Unit tests: `pnpm test`
- Integration tests (modules): `cd apps/backend && DB_USERNAME=solis pnpm run test:integration:modules`
- Type check and build: `cd apps/backend && npx medusa build`
- `medusa lint` is unavailable here — `eslint` is not installed. Do not claim it as a gate.
- Root `pnpm test` runs unit tests only; it does not exercise integration paths.

## Commits and delivery

- Conventional Commits. Never add AI attribution or `Co-Authored-By`.
- One work-unit commit per task, on a feature branch. Branch first if you are on the default branch.
- Commit, push, pull request, and merge gates belong to the human. Ordinary repository policy decides delivery.

## Usable deliverables

For operational features, first define the action the user performs in Medusa Admin and how its outcome is verified. Implement the end-to-end path: UI → endpoint → persistence → visible result. Reuse working components; do not expand scope.

A feature is complete when it can be opened and used in Medusa Admin or the storefront, uses real application data, persists writes, reflects persisted data in read-only views, handles loading/empty/error states, and its checks pass.

Where end-to-end behavior matters, prefer Playwright to exercise it rather than asserting it by hand. For purely visual or documentation changes, verify their own acceptance criteria without unrelated backend work.

If runtime verification was unavailable, say so explicitly rather than implying it passed.

## Specialists

Consult `sol-specialist` for a bounded reasoning blocker on money, authorization, data-integrity, or concurrency correctness, or after two distinct failed fixes for the same defect. Consult `astra-architect` for cross-domain architecture or incompatible contracts requiring redesign. Provide one concrete question with the relevant files and evidence. Specialists advise; their answer is not proof that anything passed.

## Required completion report

End every development session with:

- `Implemented`: repository behavior that changed and works, plus the principal entry point or where to open/use it when applicable.
- `Verified`: exact executable checks and results, plus how to reproduce or test the delivered behavior when applicable.
- `Remaining`: concrete unfinished work or `None`.
- `Escalations`: unresolved decisions or `None`.

This is the only completion-report format. Do not output a second overlapping checklist.
