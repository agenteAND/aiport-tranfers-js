# Design: Airport Transfer MVP

## Technical Approach
Add a dedicated Medusa `Transport` Module for airport-transfer domain state, with workflows and file-based Store/Admin APIs orchestrating Medusa Product, Cart, Pricing, Order, Payment, and Refund primitives. H3 cells are the primary zone model; the MVP starts at configurable resolution `9` and validates real PUJ fixtures before quote/cart work lands.

## Architecture Decisions
| Area | Choice | Rejected | Rationale |
|---|---|---|---|
| Domain boundary | `apps/backend/src/modules/transport` custom module | Scattering transfer tables across routes/workflows | Keeps reservation, zone, change, and audit rules isolated while using Medusa commerce modules through workflows. |
| Zones | H3 cells only: `transport_zone` + `transport_zone_cell` | Dual polygon/H3 runtime model | Confirmed H3 primary choice; polygons are only fixture/import inputs if needed, not persisted operational truth. |
| Fare lookup | Medusa Pricing Rules with attributes `origin_zone_id`, `destination_zone_id`, `vehicle_class_id` | Custom fare table first | Matches the confirmed choice; the Production Pricing Rules Acceptance Slice implements the actual production resolver and proves collision handling and representative-fixture performance before dependent quote/cart work. |
| Paid changes | Assisted Admin workflow with `change_request_id` unique business key | Customer self-service repricing | Reduces MVP risk; separates business idempotency from provider webhook dedupe. |
| Provider events | Persist `provider_event_id` unique in `transport_provider_event` | Reusing `change_request_id` for webhooks | Provider retries are delivery identity; changes are business identity. |

## Data Flow
`Store quote request -> geocode/lat-lng input -> H3 cell -> zone lookup -> Pricing Rule lookup -> quote snapshot -> cart real variant with server unit_price -> checkout/order -> reservation snapshot`

`Admin change -> change_request_id -> recompute delta -> provider payment link or original-method refund if supported -> provider_event_id webhook -> reservation/change audit`

## File Changes
| File | Action | Description |
|---|---|---|
| `apps/backend/medusa-config.ts` | Modify | Register Transport Module and `transport.h3Resolution` defaulting to `9`. |
| `apps/backend/package.json` | Modify | Add H3 library dependency. |
| `apps/backend/src/modules/transport/index.ts` | Create | Module export and constant. |
| `apps/backend/src/modules/transport/service.ts` | Create | Zone, quote, reservation, change, and event methods. |
| `apps/backend/src/modules/transport/models/*.ts` | Create | `zone`, `zone_cell`, `vehicle_class`, `quote`, `reservation`, `reservation_hold`, `reservation_change`, `provider_event`, `audit_event`. |
| `apps/backend/src/workflows/transport/*.ts` | Create | Quote, cart insert, confirm reservation, request change, provider event handling. |
| `apps/backend/src/api/store/transfers/**/route.ts` | Create | Quote, cart, reservation lookup APIs. |
| `apps/backend/src/api/admin/transport/**/route.ts` | Create | Zone/fare/reservation/change operator APIs. |
| `apps/backend/src/links/*.ts` | Create | Link transport vehicle classes/reservations to Medusa variants/orders where needed. |
| `apps/backend/src/jobs/expire-transfer-holds.ts` | Create | Release expired quote/hold records. |
| `apps/backend/src/migration-scripts/initial-data-seed.ts` | Modify | Seed transfer product/variants plus PUJ H3 fixture data. |

## Interfaces / Contracts
Store quote input: `{ origin: { lat, lng }, destination: { lat, lng }, vehicle_class_id, pickup_at, passengers, luggage }`. Quote output: `{ quote_id, amount, currency_code, origin_zone_id, destination_zone_id, h3_resolution, variant_id, expires_at }`. Admin change input: `{ reservation_id, change_request_id, patch, reason }`. Provider webhook contract requires `{ provider_event_id, change_request_id?, provider_status }`.

## Testing Strategy
| Layer | What to Test | Approach |
|---|---|---|
| Unit | H3 resolution config, zone lookup, idempotency keys | RED tests in `src/modules/transport/__tests__/**/*.unit.spec.ts`. |
| Integration | Production fare resolver acceptance for one/no/multiple Pricing Rule matches and representative-fixture performance; quote-to-cart; reservation confirmation; assisted change deltas | `test:integration:modules` and `test:integration:http` with real PUJ boundary fixtures. |
| E2E | MVP happy path through Store/Admin APIs | Thin HTTP tests after unit/integration pass. |

Strict TDD: every slice starts with failing tests and stays below 400 changed lines; split into chained PRs when forecast exceeds the budget. The Production Pricing Rules Acceptance Slice is production code, not throwaway research. If its acceptance tests or performance check fail, stop dependent quote/cart work and revise the fare mechanism; do not build a parallel speculative engine.

## Threat Matrix
N/A — no shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary is changed. HTTP file-based API routes are ordinary Medusa extension points and do not map to the listed matrix rows.

## Migration / Rollout
Roll out in chained slices: module schema + H3 fixtures, Production Pricing Rules Acceptance Slice, quote/cart, reservation confirmation, assisted changes, admin operations. Generate/run Transport migrations per Medusa module flow. If pricing acceptance fails, stop before customer routes depend on it and revise the fare mechanism in the same production path. Rollback is per-slice: unregister module, revert migrations/seed data, and leave starter commerce behavior intact.

## Open Questions
- [ ] Which payment provider supports payment links, original-method refunds, and a stable webhook event identifier?
- [ ] What are the final PUJ fixture addresses and boundary acceptance criteria for resolution `9`?
- [ ] What currency, cancellation, and fiscal policies should be layered after MVP confirmation?
