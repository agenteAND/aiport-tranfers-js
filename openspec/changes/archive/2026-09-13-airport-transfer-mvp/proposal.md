# Proposal: Airport Transfer MVP

## Intent
Launch an MVP airport-transfer backend on the existing Medusa starter: deterministic quotes, checkout-backed reservations, H3-based operating zones, and assisted paid changes without committing to unresolved providers or fiscal policy.

## In Scope
- Transport domain module for zones, H3 cells, vehicles, quotes, reservations, changes, holds, and audit snapshots.
- H3 as primary zone representation; configurable resolution initially `9`, validated with real PUJ-area addresses and boundary cases.
- MVP fare mechanism using Medusa Pricing Rules, beginning with a Production Pricing Rules Acceptance Slice for collision behavior and representative-fixture performance.
- Store/Admin APIs and workflows for quote-to-cart, checkout confirmation, reservation lookup, admin-assisted changes, payment links, refunds, and webhook dedupe.
- Auto-chained delivery slices that keep each PR within the 400-line review budget.

## Out of Scope
- Provider choices for maps/geocoding, payments, email, fiscal invoicing, or messaging.
- Fiscal rules, currency policy, cancellation cutoffs, launch volume, and production-scale fare matrices before the Production Pricing Rules Acceptance Slice passes.
- Self-service price-changing reservation edits.

## Capabilities
### New Capabilities
- `transfer-zone-modeling`: H3 zones, resolution config, boundary validation, and zone-cell import.
- `transfer-fare-pricing`: directed origin/destination/vehicle fare lookup through Medusa Pricing Rules plus collision/performance acceptance validation.
- `transfer-quote-cart`: quote calculation and custom-priced real-variant cart insertion.
- `transfer-reservation-lifecycle`: reservation creation, snapshots, holds, confirmation, lookup, and audit trail.
- `transfer-change-operations`: assisted operator changes, `change_request_id`, payment links, refunds, and `provider_event_id` webhook dedupe.
- `transport-admin-operations`: admin zone, fare, reservation, and exception operations.

### Modified Capabilities
None.

## Approach
Use a dedicated `Transport` Module integrated with Medusa products, variants, carts, pricing, payments, orders, and workflows. Start with production acceptance slices: H3 fixtures, then a strict-TDD Production Pricing Rules Acceptance Slice that implements the actual fare resolver and proves one, no, and multiple matches plus representative-fixture performance. If pricing acceptance fails, stop dependent quote/cart work and revise the fare mechanism rather than building a parallel speculative engine. Continue with quote/cart, reservation confirmation, assisted changes, and admin readiness only after acceptance.

## Affected Areas
| Area | Impact | Description |
|---|---|---|
| `apps/backend/medusa-config.ts` | Modified | Register Transport Module/config. |
| `apps/backend/src/modules/transport/**` | New | Domain models/services. |
| `apps/backend/src/workflows/**` | New | Quote, cart, reservation, change, refund flows. |
| `apps/backend/src/api/store/transfers/**` | New | Customer-facing transfer APIs. |
| `apps/backend/src/api/admin/transport/**` | New | Operator APIs. |
| `apps/backend/src/links/**`, `src/subscribers/**`, `src/jobs/**` | New | Links, webhook/event handling, expirations. |
| `apps/backend/src/migration-scripts/initial-data-seed.ts`, tests | Modified/New | Airport-transfer fixtures and coverage. |

## Risks
| Risk | Likelihood | Mitigation |
|---|---:|---|
| Pricing-rule collisions or slow matrix lookup | Med | Production acceptance before dependent quote/cart work. |
| H3 boundary mismatch | Med | Validate real PUJ and edge addresses. |
| Paid-change idempotency errors | High | Separate business and provider event identities. |

## Rollback Plan
Ship in chained PRs. Revert the affected slice, unregister the module if needed, roll back transport migrations/data, and leave existing Medusa starter commerce behavior intact.

## Dependencies
- Production Pricing Rules Acceptance Slice result.
- PUJ-area address/boundary fixture set.
- Provider capability confirmation for payment links and original-method refunds.
- Later product decisions for fiscal, currency, cancellation, providers, and launch scale.

## Success Criteria
- [ ] H3 resolution `9` fixtures and boundary cases pass or produce documented adjustment criteria.
- [ ] The Production Pricing Rules Acceptance Slice implements the production fare resolver and passes one/no/multiple-match acceptance tests plus a representative-fixture performance check.
- [ ] Quote-to-cart uses real variants with server-calculated custom prices.
- [ ] Assisted changes create one operation per `change_request_id` and dedupe repeated `provider_event_id` webhooks.
- [ ] Each implementation PR forecast stays within 400 changed lines or is split.
