## Exploration: airport-transfer-mvp

### Current State
The repository is a fresh pnpm workspace with a single Medusa backend at `apps/backend`. The backend is MedusaJS 2.20.1 with starter structure only: placeholder store/admin custom routes return HTTP 200, extension folders contain README guidance, and there are no transport modules, workflows, links, subscribers, jobs, middleware, or tests yet.

The Medusa configuration currently only defines `projectConfig` with database and CORS/secrets. No custom module is registered, so a Transport Module would need to be added under `src/modules/transport` and registered in `medusa-config.ts` before its service and models are resolvable from routes/workflows.

The seed script is generic Medusa demo commerce data: European regions/countries, default sales channel/API key/store, manual fulfillment, tax regions, shipping options, and apparel products. It does not seed vehicle products, Dominican launch currencies/tax settings, airport zones, fare rules, or transport availability.

Testing is configured but empty. Root `pnpm test` delegates recursively. Backend Jest supports unit tests under `src/**/__tests__/**/*.unit.spec.[jt]s`, module integration tests under `src/modules/*/__tests__/**/*.[jt]s`, and HTTP integration tests under `integration-tests/http/*.spec.[jt]s`; the default backend test script runs unit tests with `--passWithNoTests`.

CodeGraph-first mapping was attempted as required, but the runtime lacks both `gentle-ai` and `codegraph` binaries. Investigation therefore used bounded filesystem inspection after the required CodeGraph attempts failed.

### Affected Areas
- `apps/backend/medusa-config.ts` — must register the future Transport Module and any required providers/configuration.
- `apps/backend/src/modules/transport/**` — new custom module should own zones, H3 cells, vehicle profiles, quotes, reservations, legs, changes, availability/holds, and audit events.
- `apps/backend/src/links/**` — likely needed to link transport vehicle profiles or reservations to Medusa product variants, orders, customers, and possibly payment/order-edit records while preserving module isolation.
- `apps/backend/src/workflows/**` — core implementation point for quote calculation, cart item creation, availability holds, checkout completion, reservation confirmation, requoting, paid changes, refunds, and cancellation.
- `apps/backend/src/api/store/transfers/**` — new store endpoints for quotes, cart items, reservation lookup, changes, accepting changes, and cancellation.
- `apps/backend/src/api/admin/transport/**` — new admin endpoints for zones, zone cells, price import, reservation search, and admin-initiated changes.
- `apps/backend/src/api/middlewares.ts` — likely needed for route validation/auth policy once custom store/admin endpoints exist.
- `apps/backend/src/subscribers/**` — likely needed for payment/order events or webhook-driven confirmation if Medusa workflows do not cover every completion path directly.
- `apps/backend/src/jobs/**` — likely needed for expiring quotes, availability holds, proposed changes, and abandoned checkout holds.
- `apps/backend/src/migration-scripts/initial-data-seed.ts` — should be replaced or extended for launch-oriented seed data: store currencies, Dominican/airport-transfer region choices, vehicle products/variants, zones, and starter fare rules.
- `apps/backend/src/admin/**` — future admin UI extensions can manage zones, fare imports, availability, reservations, and financial exceptions; likely not first PR for MVP foundation.
- `apps/backend/package.json` — likely needs dependencies such as H3 and possibly provider SDKs; no H3/geocoding/email/fiscal packages are installed today.
- `apps/backend/jest.config.js` — existing test match patterns can support the needed unit/module/http tests without immediate config changes.
- `docs/product/airport-transfer-prd.md` — authoritative product scope and unresolved decisions for design; no code changes here during explore.

### Approaches
1. **Transport module plus Medusa-native commerce integration** — Build a dedicated Transport Module for transport domain state, then use Medusa products/variants, pricing, carts, promotions, taxes, payments, orders, and order edits through workflows.
   - Pros: Preserves Medusa as commerce system of record, keeps transport state isolated, aligns with the PRD, supports audit snapshots and reservation edits, and uses existing extension patterns.
   - Cons: Requires careful module links, workflow orchestration, idempotency, and a technical spike around Pricing Module rule scale.
   - Effort: High overall, but suitable for incremental MVP slices.

2. **Minimal custom routes with metadata-heavy Medusa carts/orders** — Store most transfer details in cart/order line item metadata and add only enough custom services for quote calculation.
   - Pros: Faster first visible checkout path and fewer new tables initially.
   - Cons: Weak domain model, poor auditability/versioning, difficult paid reservation edits, weak admin search, and high risk of losing deterministic quote/reservation behavior under retries.
   - Effort: Medium initially, high later due to rework.

3. **Standalone fare/reservation subsystem beside Medusa** — Build a separate fare matrix, reservation, and payment-difference engine, then synchronize totals into Medusa orders.
   - Pros: Full control over transport-specific pricing and state transitions.
   - Cons: Duplicates commerce concerns, weakens Medusa reporting/promotions/taxes, increases reconciliation risk, and conflicts with the PRD's Medusa-first direction unless the Pricing Module spike fails.
   - Effort: High.

### Recommendation
Use Approach 1 for the MVP: a dedicated Transport Module with Medusa-native commerce integration through workflows. Start with a technical validation slice before broad implementation: prove H3 zone resolution, custom Medusa Pricing Module rule attributes for directed origin/destination/vehicle pricing, custom-priced real variant cart items, and the paid-change/order-edit path.

This should be delivered through auto-chained PRs because the full MVP touches module models, migrations, workflows, API routes, tests, and seed/admin concerns and will exceed a 400 changed-line review budget if attempted as one PR. The first proposal/design should explicitly separate technical validation, quote/cart foundation, booking/payment confirmation, editable reservations, and operational admin readiness.

### Risks
- Medusa Pricing Module rule scale or ambiguity may not handle realistic directed zone-pair matrices acceptably; the fallback is a dedicated fare-matrix entity that still feeds custom prices into real variant line items.
- H3 resolution is a product/operations decision and must be validated with real PUJ, Punta Cana, Bávaro, Cap Cana, and boundary addresses before data modeling hardens.
- Paid reservation edits combine reservation versioning, order edits, additional payment collections, refunds/credits, repeated webhooks, and idempotency; this is the highest-risk workflow group.
- Current seed data is generic European apparel commerce data and may mislead implementation/testing unless replaced with airport-transfer fixtures.
- Provider decisions remain unresolved: geocoding/maps, payments, email, fiscal invoicing, launch currencies, ITBIS/fiscal rules, cancellation/refund policy, availability hold duration, launch volume/concurrency, exact zones, and H3 resolution.
- No tests exist yet; strict TDD means the design/tasks should add tests before behavior and avoid relying on `--passWithNoTests` as proof of coverage.

### Ready for Proposal
Yes — ready for SDD proposal, with explicit unresolved product decisions carried forward rather than inferred. The proposal should commit only to technical validation and MVP architecture boundaries, not to a specific geocoder, payment provider, fiscal-invoice policy, launch currency policy, availability granularity, or H3 resolution until the user/product owner decides them.
