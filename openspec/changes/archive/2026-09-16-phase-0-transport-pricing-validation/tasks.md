# Tasks: Phase 0 Transport Pricing Validation

No design.md by intent: the open question is empirical, resolved by executable evidence.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 800-1,000 |
| Files touched | 8 (fixture module, adapter, 2 workflow files, 2 specs, 1 script, 1 doc) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Single PR with documented `size:exception`; slices are not independently shippable |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Fixtures, adapter, 9 assertions | PR 1 | `pnpm --filter @dtc/backend run test:integration:modules` | `medusaIntegrationTestRunner` on `DATABASE_URL` db `fareDB` | Delete adapter, fixture module, spec; `service.ts` untouched |
| 2 | Benchmark, acceptance command, decision | PR 2 (after 1) | `ts-node scripts/phase-0-acceptance.ts` | Same DB; prints scenario plus p50/p95 | Delete benchmark spec, script, `phase-0-result.md` |

## Phase 1: Fixture Groundwork (RED first)

- [x] 1.1 RED: create `apps/backend/src/modules/transport/__tests__/native-pricing.integration.spec.ts` importing `../pricing/native-transport-pricing`; `test:integration:modules` must fail on the missing module.
- [x] 1.2 Establish the exact Medusa 2.20.1 API for attaching a price set to a variant and declaring custom price-rule attributes; record the verified snippet in the spec header.
- [x] 1.3 Create `apps/backend/src/modules/transport/fixtures/native-fare-matrix.ts` (outside `__tests__`, which jest collects wholesale) building products, variants, price sets, region, currencies, tax region, promotion.
- [x] 1.4 Mark fixtures non-production: id prefix `phase0_nonprod_` plus `metadata.phase0_fixture = true`.
- [x] 1.5 GREEN: fixture smoke test proves created products, variants, prices are queryable; confirm both spec paths are collected.

## Phase 2: Pricing Adapter

- [x] 2.1 RED: directed-resolution tests (outbound, reverse-not-implied, both directions independent), vehicle specificity, currency specificity all fail.
- [x] 2.2 GREEN: implement `apps/backend/src/modules/transport/pricing/native-transport-pricing.ts` from `origin_zone_id`, `destination_zone_id`, `vehicle_variant_id`, `currency_code`; prices as-is, lowercase codes.
- [x] 2.3 GREEN: return `no_price`, never another currency, when the requested currency has no rule.
- [x] 2.4 RED: equal-context ambiguity test demands an `ambiguous` result with no quoted price, plus a single-match control; fails before counting exists.
- [x] 2.5 GREEN: detect ambiguity by explicit deterministic counting over persisted matching rules, independent of native partial-match selection.
- [x] 2.6 GREEN: return `price_set_id`, `price_id`, and `price_list_id` when a price list governs the price.
- [x] 2.7 REFACTOR: separate counting from the native call; typed `priced | no_price | ambiguous` union with stable ordering.

## Phase 3: Workflow

- [x] 3.1 RED: test importing `apps/backend/src/workflows/transport/calculate-transport-price.ts` fails.
- [x] 3.2 GREEN: add the step under `apps/backend/src/workflows/steps/`, resolving pricing from the container and calling the adapter.
- [x] 3.3 GREEN: compose with a synchronous `function`, `WorkflowResponse`, unique step name; read-only step needs no compensation.
- [x] 3.4 REFACTOR: no `async`/arrow/conditionals in composition; validation errors surfaced as `MedusaError`.

## Phase 4: Cart, Promotion, Tax, Determinism

- [x] 4.1 RED: cart test requiring a line item on a real variant with the calculated unit price fails.
- [x] 4.2 GREEN: add the price to the cart; assert returned `product_id`, `variant_id`, `unit_price`, and transport context metadata survive retrieval.
- [x] 4.3 RED: promotion and tax tests fail — reduced cart total and a tax total on the transport-priced line item.
- [x] 4.4 GREEN: configure tax region and promotion fixtures so both apply to that cart.
- [x] 4.5 RED: determinism test repeats identical inputs and compares amount plus rule references.
- [x] 4.6 GREEN: repetition is identical; all 9 assertions plus fixture provenance pass.

## Phase 5: Benchmark

- [x] 5.1 Create `apps/backend/src/modules/transport/__tests__/fare-matrix-benchmark.spec.ts` generating several matrix sizes.
- [x] 5.2 Report per matrix: zones, variants, currencies, total directed prices, calculations, p50, p95, max, environment.
- [x] 5.3 Compare internal-calculation p95 to the PRD 250 ms target; state production validation is pending defined load and infrastructure, asserting no capacity requirement.

## Phase 6: Acceptance Command and Decision

- [x] 6.1 Create `apps/backend/scripts/phase-0-acceptance.ts` as the single documented command preparing fixtures and running the full scenario.
- [x] 6.2 Print outbound price/rule, reverse price/rule, different vehicle price, currency price, ambiguity handling, cart id, product id, variant id, line-item price, promotion total, tax total, final total, repeat result, benchmark p50/p95.
- [x] 6.3 Run `pnpm --filter @dtc/backend exec ts-node scripts/phase-0-acceptance.ts` and capture the output as evidence.
- [x] 6.4 Write `openspec/changes/phase-0-transport-pricing-validation/phase-0-result.md` with a concise PASS/FAIL and the production-validation caveat.
- [x] 6.5 Verify gates: `pnpm --filter @dtc/backend run test:integration:modules`, `run build` (type check), `run lint`.
- [x] 6.6 Confirm `apps/backend/src/modules/transport/service.ts` (read-only) is unchanged and `resolveTransferFare` stays authoritative.

## Verification Notes

- Acceptance command: `pnpm --filter @dtc/backend run phase0:acceptance` (verified as `pnpm exec ts-node scripts/phase-0-acceptance.ts`), exit 0.
- Integration harness requires `DB_USERNAME=solis`; the default `postgres` role does not exist on this machine (pre-existing).
- `medusa lint` exits 1 with `Linting skipped: the "eslint" package is not installed in this project` (pre-existing environment condition). It is not used as evidence.
- Root `pnpm test` is unit-only with `--passWithNoTests`; it does not exercise these integration paths.

