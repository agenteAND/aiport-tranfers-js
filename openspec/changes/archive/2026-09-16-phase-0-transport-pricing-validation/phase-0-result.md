# Phase 0 Result — Native Transport Pricing Validation

## Decision

**PASS** — Medusa 2.20.1's native Pricing Module supports directed transport
pricing for all 9 assertions. Phase 1 MAY use the native Pricing Module.

| # | Assertion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | `PUJ -> Punta Cana` and reverse are independent directed prices | PASS | `native-pricing.integration.spec.ts` A1, A1b (5200 / 4800; reverse-only fixture returns `no_price`) |
| 2 | Two vehicle variants price the same directed pair differently | PASS | A2 (5200 vs 9000) and A2b (`vehicle_variant_id` discriminates inside one price set) |
| 3 | Currency-specific prices resolve; no cross-currency fallback | PASS | A3 (`usd` 5200, `dop` 312000, absent `dop` → `no_price`) |
| 4 | Equal-context equal-priority rules detected deterministically, no quote | PASS | A4 (two active override price lists with identical context → `ambiguous`, native selection still returns one id) |
| 5 | Selected rule references returned for a future quote snapshot | PASS | A5 (price set id, price id, price list id), A5b (workflow) |
| 6 | Calculated price attaches to a cart item on a real variant | PASS | A6/A7 |
| 7 | Item retains product, variant, unit price, and transport context | PASS | A6/A7 |
| 8 | Promotions and taxes keep operating on that cart | PASS | A8 |
| 9 | Identical inputs return identical results | PASS | A9 |

No assertion is `FAIL`. No assertion was skipped or stubbed.

## Evidence — executed commands

```
TEST_TYPE=integration:modules NODE_OPTIONS=--experimental-vm-modules \
  npx jest src/modules/transport/__tests__/native-pricing.integration.spec.ts \
           src/modules/transport/__tests__/fare-matrix-benchmark.spec.ts \
  --runInBand --forceExit
  (with DB_USERNAME=solis)
-> Test Suites: 2 passed, 2 total
-> Tests: 14 passed, 14 total
```

```
pnpm exec ts-node scripts/phase-0-acceptance.ts   # = pnpm run phase0:acceptance
-> exit 0; outbound priced, reverse priced, different vehicle priced,
   currency-specific priced, absent currency reported no price,
   ambiguity detected, cart retrieved — all true
-> cart id cart_01M2M49Z0R01WDBS2TET63Q7X4
-> retained product id prod_01M2M49YSZCEXK1QK1DTPC5MF9
-> retained variant id variant_01M2M49YVKJZCFKR8QNPX6BZ92
-> calculated line-item unit price 5200
-> promotion discount total 590, tax total 846, final cart total 5546
-> deterministic repeat result: true
```

```
npx medusa build
-> exit 0; Backend build completed successfully (3.52s); Frontend build completed successfully
```

```
git diff --check
-> exit 0 (no whitespace errors)
```

`npx medusa lint` -> **exit 1**, `Linting skipped: the "eslint" package is not
installed in this project`. Pre-existing environment condition; not caused by
this change. Not used as evidence.

## Benchmark results

Internal calculation latency of `resolveNativeTransportPrice`. The `acceptance`
row comes from the documented acceptance command; `small`/`medium` from
`fare-matrix-benchmark.spec.ts`.

| matrix | zones | variants | currencies | directed prices | calculations | p50 (ms) | p95 (ms) | max (ms) | PRD 250 ms |
|--------|-------|----------|------------|-----------------|--------------|----------|----------|----------|------------|
| small | 4 | 2 | 1 | 24 | 40 | 8.46 | 9.57 | 11.89 | within |
| medium | 6 | 2 | 2 | 120 | 60 | 11.59 | 13.53 | 15.76 | within |
| acceptance | 4 | 2 | 1 | 24 | 40 | 6.39 | 7.82 | 8.28 | within |

Environment: Node v26.3.0, darwin arm64, 8 CPUs, Medusa 2.20.1, Postgres
`postgresql://localhost/fareDB`.

The observed internal calculation p95 (7.8–13.5 ms) is below the PRD target of
250 ms on this machine. **Final production validation remains pending until
expected load and infrastructure are defined.** Projected launch volume is TBD,
so this benchmark asserts no production capacity requirement.

## Limitations discovered

1. **Native ambiguity is silently resolved.** `calculatePrices` returns one
   calculated price per price set, ordered by
   `price_list_id IS NOT NULL DESC`, then `rules_count DESC`, then `amount ASC`.
   Equal-context duplicates therefore cannot be detected from its return value
   alone. The adapter counts persisted matching rules explicitly first.
2. **Identical plain prices are de-duplicated by the module.**
   `normalizePrices`/`hashPrice` collapses prices that share
   `currency + price_set + price_list + min/max quantity + rules`. Two plain
   identical-context prices cannot be created through `createPriceSets`,
   `addPrices`, or `upsertPriceSets`. Equal-priority ambiguity is only reachable
   through a genuine priority tie, e.g. two active override price lists holding
   an identical directed context.
3. **A variant owns exactly one price set.** `createProductsWorkflow` already
   creates the variant's price set and `link.create` rejects a second
   `product_variant_price_set` link. Fare rules must be appended with
   `pricing.addPrices({ priceSetId, prices })`.
4. **Rule attributes are not DB-filterable through the module service.**
   `FilterablePriceRuleProps` exposes only id/name/price_set_id/price_id.
   `listPrices` can filter only by price set, currency, price list, and id. The
   adapter therefore narrows at the database level by price set + currency and
   performs the deterministic rule count over that bounded result.
5. **Tax needs a default rate and a cart address.** Tax only applied after
   creating the tax rate with `is_default: true` and giving the cart a
   `shipping_address.country_code` matching the tax region.
6. **A fixed-value promotion allocates tax-inclusively.** A 500 fixed promotion
   produced `discount_total` 590 on a tax-inclusive cart. Recorded as a Medusa
   allocation behavior; the promoted cart total is still lower than the
   unpromoted total.
7. **The acceptance command boots the full application against `DATABASE_URL`**
   and writes `phase0_nonprod_` fixtures into it (default `fareDB`). Region and
   tax region are reused when the country is already assigned, so the command is
   re-runnable.
8. **Integration harness requires `DB_USERNAME`.** The default `postgres` role
   does not exist on this machine; the repo-established `DB_USERNAME=solis` was
   used. Root `pnpm test` is unit-only and does not exercise these paths.

## Phase 1 guidance

- Phase 1 MAY use the native Pricing Module. The adapter
  (`src/modules/transport/pricing/native-transport-pricing.ts`) and the
  `calculate-transport-price` workflow are written as reusable production code,
  not spike scaffolding.
- Deterministic ambiguity detection must be retained. Relying on
  `calculatePrices` alone would silently quote one of several equal-context
  prices.
- The bespoke `resolveTransferFare` in `service.ts` remains authoritative and
  untouched; replacing it is a Phase 1 decision, not a Phase 0 outcome.

## Dedicated fare-matrix fallback

A dedicated fare-matrix fallback is **not required** by this evidence and was
**not implemented**. If a later decision rejects native pricing for any reason
(for example, capacity at defined production load), the fallback needs its own
separate proposal before any implementation.

## Artifacts

- `apps/backend/src/modules/transport/pricing/native-transport-pricing.ts`
- `apps/backend/src/workflows/transport/calculate-transport-price.ts`
- `apps/backend/src/workflows/steps/resolve-native-transport-price.ts`
- `apps/backend/src/modules/transport/fixtures/native-fare-matrix.ts`
- `apps/backend/src/modules/transport/fixtures/native-fare-matrix-benchmark.ts`
- `apps/backend/src/modules/transport/__tests__/native-pricing.integration.spec.ts`
- `apps/backend/src/modules/transport/__tests__/fare-matrix-benchmark.spec.ts`
- `apps/backend/scripts/phase-0-acceptance.ts`
- `apps/backend/package.json` (`phase0:acceptance` script)
