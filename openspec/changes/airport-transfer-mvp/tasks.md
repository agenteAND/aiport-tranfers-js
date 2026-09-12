# Tasks: Airport Transfer MVP

## Review Workload Forecast

Estimate: 1,200-1,800 lines; auto-chain feature-branch-chain; split PR1 H3 -> PR2 Pricing -> PR3 Quote/Cart -> PR4 Reservations -> PR5 Changes -> PR6 Admin.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | PR/base | Goal | Focused command | Harness | Rollback |
|---|---|---|---|---|---|
| 1 | PR1 tracker | H3 zones | `pnpm test` | PUJ import | transport H3 seed |
| 2 | PR2 base PR1 | Pricing rules | `pnpm test` | one/no/multiple matches | pricing resolver/tests |
| 3 | PR3 base PR2 | Quote/cart | `pnpm test` | Store HTTP quote-cart | quote/cart routes |
| 4 | PR4 base PR3 | Reservations | `pnpm test` | checkout replay | reservation workflows/job |
| 5 | PR5 base PR4 | Assisted changes | `pnpm test -- changes.integration.spec.ts` | admin command + webhook replay | change workflow/state/events |
| 6 | PR6 base PR5 | Admin readiness | `pnpm test -- admin-transport.http.spec.ts` | authorized correction | admin routes/validators/audit |

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

## Phase 5: Assisted Changes
- [x] 5.1 RED: add delta, `change_request_id`, `provider_event_id`, payment-link/refund transition, replay, and error tests in `apps/backend/src/modules/transport/__tests__/changes.integration.spec.ts`.
- [x] 5.2 GREEN: implement provider-agnostic change workflow, minimal admin command route, event replay, and error states in `apps/backend/src/workflows/transport/**`, `apps/backend/src/api/admin/transport/reservations/**/route.ts`.
- [x] 5.3 REFACTOR: isolate change identity/state helpers in `apps/backend/src/modules/transport/service.ts`; keep routes as command boundaries, not admin CRUD.

## Phase 6: Admin Readiness
- [ ] 6.1 RED: add authorized zone, fare, reservation correction, validation, audit, and exception visibility tests in `apps/backend/src/api/admin/transport/__tests__/admin-transport.http.spec.ts`.
- [ ] 6.2 GREEN: add admin zone, fare, reservation correction APIs with validation and audit in `apps/backend/src/api/admin/transport/**/route.ts`, `apps/backend/src/modules/transport/service.ts`.
- [ ] 6.3 REFACTOR: share admin validators/audit serializers; exclude fiscal, currency, provider, and cancellation policy.
