# Proposal: Phase 0 Transport Pricing Validation

## Intent
Prove Medusa's native Pricing Module resolves transport fares from custom attributes (`origin_zone_id`, `destination_zone_id`, `vehicle_variant_id`, `currency_code`), later replacing the JS-filtered `resolveTransferFare` (`service.ts:212-250`). Source: PRD 449, 339-346; Engram #2266 mandates a production acceptance slice, not scaffolding.

## Scope

### In Scope
- Reusable transport-pricing adapter and workflow calling native `calculatePrices`.
- Medusa products, variants, price sets, and rules; fixtures marked non-production.
- Evidence for 9 assertions:
  1. `PUJ→Punta Cana` and `Punta Cana→PUJ` price independently.
  2. Two variants price one directed pair differently.
  3. Currency-specific prices resolve correctly.
  4. Ambiguous equal-context rules are rejected or detected deterministically.
  5. Selected rule references return for a future quote snapshot.
  6. Calculated price attaches to a cart item on a real variant.
  7. The item keeps product link, variant link, unit price, pricing context.
  8. Promotions and taxes keep operating on that cart.
  9. Identical inputs return identical results.
- Benchmark across matrix sizes reports zones, variants, currencies, calculations, p50, p95, max, environment; compares p95 to the PRD 250 ms target, with production validation pending defined load and infrastructure.
- One documented acceptance command plus tests for every assertion.
- Concise Phase 0 PASS/FAIL decision recorded.

### Out of Scope
Customer quote UI; geocoding; H3 zone administration; availability; checkout payment; reservations; paid reservation edits; vehicle-class administration; dedicated fare-matrix fallback.

## Capabilities

### New Capabilities
- `transport-native-pricing`: adapter, workflow, snapshot references, acceptance command, benchmark evidence.

### Modified Capabilities
None; bespoke resolution stays authoritative.

## Approach
Module→Workflow→API route: a step calls the Pricing Module with validated context; match counting detects ambiguity beyond `calculatePrices`. Reuse `medusaIntegrationTestRunner`, `TEST_TYPE=integration:modules`, `DATABASE_URL`. Prices as-is; lowercase currency codes.

## Affected Areas
All New.
- `apps/backend/src/modules/transport/pricing/native-transport-pricing.ts` — pricing adapter
- `apps/backend/src/workflows/transport/calculate-transport-price.ts`, `workflows/steps/` — workflow, step
- `apps/backend/src/modules/transport/__tests__/native-pricing.integration.spec.ts` — assertions 1-9
- `apps/backend/src/modules/transport/__tests__/fare-matrix-benchmark.spec.ts` — benchmark
- `apps/backend/scripts/phase-0-acceptance.ts` — acceptance command
- `openspec/changes/phase-0-transport-pricing-validation/**` — this change

## Risks
- Partial-match pricing may not fail on ambiguity — count matches (High).
- Cart items may lose variant/product links (2.20.1) — assert both (Med).
- No variant-to-vehicle-class link — use `vehicle_variant_id` (Med).
- Test-environment latency is not capacity evidence (High).
- Fixtures are non-production data — mark them (Low).

## Rollback Plan
Revert the PR: delete the new adapter, workflow, tests, benchmark, and script, plus the additive OpenSpec change. `resolveTransferFare` in `service.ts` stays authoritative; archived changes unmodified; no migration alters existing tables.

## Dependencies
- Medusa 2.20.1 Pricing Module; local PostgreSQL (`DATABASE_URL`).
- PRD pricing-spike acceptance (`docs/product/airport-transfer-prd.md`).

## Success Criteria
- 9 assertions pass as integration tests on native pricing.
- One acceptance command covers every required output.
- Benchmark gives real measurements, separating latency from capacity assumptions.
- Phase 0 PASS/FAIL recorded.
- No fare-matrix entity; fallback unimplemented.
