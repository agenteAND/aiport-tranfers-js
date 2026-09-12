# Tasks: Airport Transfer MVP

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,200-1,800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 H3 -> PR2 Production Pricing Rules Acceptance Slice -> PR3 Quote/Cart -> PR4 Reservations -> PR5 Changes -> PR6 Admin |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR/base | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | H3 zones, fixtures, import validation | PR1 base tracker | `pnpm test` | PUJ fixture zone import scenario | transport module/config/H3 seed |
| 2 | Production Pricing Rules Acceptance Slice | PR2 base PR1 | `pnpm test` | production resolver with one/no/multiple matches and representative fixture performance | production pricing resolver and acceptance tests |
| 3 | Quote and cart conversion | PR3 base PR2 | `pnpm test` | Store quote-to-cart HTTP scenario | quote/cart workflows/routes |
| 4 | Checkout reservation lifecycle | PR4 base PR3 | `pnpm test` | checkout confirmation replay | reservation models/workflows/job |
| 5 | Assisted paid changes | PR5 base PR4 | `pnpm test` | admin change plus webhook replay | change/event workflow/routes |
| 6 | Admin readiness | PR6 base PR5 | `pnpm test` | authorized admin correction scenario | admin transport routes/validators |

## Phase 1: H3 Zone Validation
- [x] 1.1 RED: add failing resolution, malformed, duplicate, and PUJ boundary tests in `apps/backend/src/modules/transport/__tests__/zone.unit.spec.ts`.
- [x] 1.2 GREEN: add H3 dependency/config, module export, zone/cell/vehicle models, service import logic, and fixtures in `apps/backend/package.json`, `apps/backend/medusa-config.ts`, `apps/backend/src/modules/transport/**`, `apps/backend/src/migration-scripts/initial-data-seed.ts`.
- [x] 1.3 REFACTOR: extract reusable H3 validation helpers in `apps/backend/src/modules/transport/service.ts`.

## Phase 2: Production Pricing Rules Acceptance Slice
- [x] 2.1 RED: real Medusa Pricing Module integration tests cover one active fare, no fare, multiple active fares, and a representative persisted fixture lookup.
- [x] 2.2 GREEN: the directed resolver path passes against real Medusa Pricing Module persistence when the local test database uses `DB_USERNAME=solis`.
- [x] 2.3 REFACTOR: pricing access remains isolated behind `apps/backend/src/modules/transport/service.ts`; the local username is environment-specific and CI must provide its own `DB_USERNAME` or standard PostgreSQL role.

## Phase 3: Quote and Cart
- [x] 3.1 RED: add quote, fare-unavailable, and duplicate-cart tests in `apps/backend/src/api/store/transfers/__tests__/quote-cart.http.spec.ts`.
- [x] 3.2 GREEN: create quote/cart workflows and Store routes in `apps/backend/src/workflows/transport/**`, `apps/backend/src/api/store/transfers/**/route.ts`, `apps/backend/src/links/**`.
- [x] 3.3 REFACTOR: centralize immutable quote price snapshot helpers in `apps/backend/src/modules/transport/service.ts`.

## Phase 4: Reservations
- [x] 4.1 RED: add checkout and duplicate-confirmation tests in `apps/backend/src/modules/transport/__tests__/reservation.integration.spec.ts`.
- [x] 4.2 GREEN: add reservation/hold/audit models, confirmation workflow, order links, and expiry job in `apps/backend/src/modules/transport/models/*.ts`, `apps/backend/src/workflows/transport/**`, `apps/backend/src/jobs/expire-transfer-holds.ts`.
- [x] 4.3 REFACTOR: reuse audit snapshot creation in `apps/backend/src/modules/transport/service.ts`.

## Phase 5: Assisted Changes and Admin
- [ ] 5.1 RED: add change delta, `change_request_id`, `provider_event_id`, and error-state tests in `apps/backend/src/modules/transport/__tests__/changes.integration.spec.ts`.
- [ ] 5.2 GREEN: implement provider-agnostic change/event workflows and admin routes in `apps/backend/src/workflows/transport/**`, `apps/backend/src/api/admin/transport/**/route.ts`.
- [ ] 5.3 REFACTOR: share admin validation/audit helpers without adding fiscal, currency, provider, or cancellation policy.
