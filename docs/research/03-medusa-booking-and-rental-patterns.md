# Medusa Booking and Rental/Reservation Patterns

**Status:** Research deliverable
**Date:** 2026-09-19
**Subject repository:** `ground-transportation-fare` (`@dtc/backend`, MedusaJS 2.20.1)
**Companion documents:** `docs/research/01-transfer-booking-market-and-mozio.md`, `docs/research/02-medusa-capabilities-and-zone-tech.md`, `odd/index.md`

## 0. Scope, method, and evidence rules

This document answers one question in depth: **how does MedusaJS (and its official recipes/examples/tests) model booking and rental/reservation flows, so we can adapt our custom transport reservation module to native patterns instead of keeping bespoke machinery.**

**Method.** Primary sources only: `docs.medusajs.com` (Recipes, Commerce Modules, Learn/fundamentals, testing chapters) and the official `medusajs/examples` repository. Claims are tagged:

- **[verified]** — read verbatim at the cited source.
- **[inference]** — derived by combining cited facts; not stated verbatim.
- **[assumption]** — plausible but unverified for 2.20.1.

**Version discipline.** The installed package is pinned to `@medusajs/*@2.20.1`. Features gated behind later releases are flagged inline. `allowFields` is v2.21.0+ (as documented in the prior research) and is not relied on here.

**What the prior research already established and this document does not re-derive:** order edits are native (confirmation, version increment, `pending_difference`, `paid_total`/`refunded_total`, one-pending-edit rule); holds/geocoding/zones/reservations/fiscal invoicing are ours; native pricing is the fare source; `calculatePrices` has no exact-match guarantee.

---

## 1. Official recipes and examples: is there a booking/rental/reservation recipe?

**Short answer: there is no dedicated recipe or example for booking engines, rentals, reservations, appointments, or service bookings. [verified by absence in the Recipes index]**

The official Recipes index lists exactly these recipes [verified — `https://docs.medusajs.com/recipes`]:

- Marketplace — `https://docs.medusajs.com/resources/recipes/marketplace`
- Subscriptions — `https://docs.medusajs.com/resources/recipes/subscriptions`
- Digital Products — `https://docs.medusajs.com/resources/recipes/digital-products`
- Integrate ERP — `https://docs.medusajs.com/resources/recipes/erp`
- B2B — `https://docs.medusajs.com/resources/recipes/b2b`
- Bundled Products — `https://docs.medusajs.com/resources/recipes/bundled-products`
- Commerce Automation — `https://docs.medusajs.com/resources/recipes/commerce-automation`
- Ecommerce — `https://docs.medusajs.com/resources/recipes/ecommerce`
- Multi-Region Store — `https://docs.medusajs.com/resources/recipes/multi-region-store`
- Omnichannel Store — `https://docs.medusajs.com/resources/recipes/omnichannel`
- OMS — `https://docs.medusajs.com/resources/recipes/oms`
- Personalized Products — `https://docs.medusajs.com/resources/recipes/personalized-products`
- POS — `https://docs.medusajs.com/resources/recipes/pos`

None of these is a rental, booking, reservation, appointment, or service-booking recipe. I did not find one elsewhere in the Recipes section either.

**What the closest official patterns are:**

1. **Digital Products recipe** — `https://docs.medusajs.com/resources/recipes/digital-products` (full step-by-step example at `https://docs.medusajs.com/resources/recipes/digital-products/examples/standard`; reference code at `https://github.com/medusajs/examples/tree/main/digital-product`). This is the canonical template for *"a sale of something that is not a shippable physical good, with a custom module linked to the product/order."* Its building blocks transfer almost one-to-one to a booking: a custom module with a data model → `defineLink` to `ProductVariant` and to `Order` → workflow steps with compensation → admin/store API routes → a fulfillment path. [verified]

2. **Subscriptions recipe** — `https://docs.medusajs.com/resources/recipes/subscriptions`. Closest to the *time/recurrence* aspect of a booking. Its "Option 1: custom subscription logic" is exactly our hold/expiry shape: a workflow that completes a cart and creates the subscription record, plus **scheduled jobs** that check daily for renewals and expirations. [verified] This is the strongest official precedent for "a scheduled job mutates domain records on a time boundary" — the same mechanism our `expire-transfer-holds` job already uses.

3. **"Configure Selling Products" guide** — `https://docs.medusajs.com/resources/commerce-modules/product/selling-products`. This is the only official page that names our exact use case in words: it explicitly lists "selling digital products, **services, or booking appointments**" as a selling requirement Medusa supports by disabling shipping/inventory requirements. [verified] See §4.

**Net:** Medusa deliberately does not ship a booking/rental recipe. The documented stance is that a booking is a *custom commerce concept you model yourself* with the standard extension toolkit (custom module + module link + workflow), and that "no shipping" is a supported native product configuration. Any claim that Medusa "has a booking engine" would be false.

---

## 2. Canonical native pattern: a reservation that references a product variant

The pattern Medusa documents repeatedly (Digital Products recipe, "Extend Product Data Model", "Create a Module" example) is the one our transport module already half-follows. The canonical building blocks, each with its source:

**2a. Custom module + data model** — `https://docs.medusajs.com/learn/fundamentals/modules`, `https://docs.medusajs.com/resources/recipes/digital-products/examples/standard` (Step 2). A module declares models via `model.define(...)` and a main service that `extends MedusaService({...})`, which generates `create*`, `retrieve*`, `list*`, `update*`, `delete*`/`softDelete*` methods. [verified]

**2b. Module link to Product/Variant** — `https://docs.medusajs.com/learn/fundamentals/module-links`. The canonical form, verbatim from the Digital Products recipe:

```ts
// src/links/digital-product-variant.ts
import DigitalProductModule from "../modules/digital-product"
import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"

export default defineLink(
  { linkable: DigitalProductModule.linkable.digitalProduct, deleteCascade: true },
  ProductModule.linkable.productVariant
)
```

Our equivalent already exists as `apps/backend/src/links/transport-reservation-order.ts` (link to `Order`). The *missing* native link is reservation ↔ **product variant**: the reservation should reference the variant it was priced against, not just a loose `line_item_id` text column. [inference from the recipe]

**2c. Module link to Order** — same recipe defines `src/links/digital-product-order.ts` linking the custom order concept to `OrderModule.linkable.order`. [verified] This is our `transport-reservation-order` link.

**2d. Workflow steps with compensation** — `https://docs.medusajs.com/learn/fundamentals/workflows`, `https://docs.medusajs.com/learn/fundamentals/workflows/compensation-function`. The recipe's `createDigitalProductStep` resolves the module service in a `createStep`, returns `new StepResponse(result, compensationData)`, and the compensation function deletes the created record on failure. The workflow composes native core flows via `createProductsWorkflow.runAsStep(...)` and links records via `createRemoteLinkStep([...])` (both from `@medusajs/medusa/core-flows`). [verified]

**2e. Native pricing rides on the variant** — the price comes from the Product Variant's price set through the Pricing Module; the reservation never computes or stores an authoritative commerce price, it references the variant. Our `resolveTransferFare` already delegates to native pricing (§2 of the prior research). [verified / carried forward]

**What this means for us [opinion]:** our `confirm-reservation` and `quote-cart` workflows are already the right shape (module service behind a workflow). The two gaps versus the canonical pattern are (1) we hold `order_id`/`cart_id`/`line_item_id` as loose text columns instead of relying on module links, and (2) we have no link from `reservation` to the product variant that carries the price and capacity. Both are fixable by adopting the link-first pattern above.

---

## 3. Availability, inventory, and time-windowed holds

**What the Inventory Module actually provides [verified — `https://docs.medusajs.com/resources/commerce-modules/inventory` and `/concepts`]:**

- `InventoryItem` — a stock-kept item (e.g., a product variant). Has `requires_shipping` (default `true`) and, since v2.20.0, an optional `unit_of_measure`. [verified]
- `InventoryLevel` — quantity at a location: `stocked_quantity`, `reserved_quantity`, `incoming_quantity`, keyed by `location_id` (linked to the Stock Location Module). [verified]
- `ReservationItem` — *"represents unavailable quantity of an inventory item in a location."* Created when an order is placed; the reserved quantity is deducted from availability but still physically in stock. [verified]

**Can it model time-windowed capacity for a service with no physical stock? No. [inference, strongly grounded]**

The Inventory Module is a **quantity-at-a-location** model. There is no time dimension on `InventoryLevel` or `ReservationItem`: no start time, no end time, no slot, no expiry field. The docs' own closest example is instructive and confirms the boundary — for event tickets it says *"you can create a reservation item when a customer selects a ticket. Then, you can remove the reservation item if the customer doesn't complete the purchase within a specific time."* [verified] The **time-limited hold is *our* removal logic**, not an inventory concept: the module reserves a *count*, and something outside the module (a scheduled job) releases it. For "two vans free at 14:30 on 2027-01-04," there is nothing in the module to express "14:30" or "2027-01-04."

**Conclusion:** availability for a time-windowed, no-stock service is **inherently a custom module in Medusa's model.** [inference] This matches §10.1 of the prior research. Our `reservation-hold` model (`quote_id`, `cart_id`, `status`, `expires_at`) is the correct custom shape, and the 60-second `expire-transfer-holds` job is the correct native execution mechanism (scheduled job). Do **not** attempt to model vehicle slots as `InventoryItem`/`ReservationItem`.

**The one native tool to add for concurrency:** `https://docs.medusajs.com/learn/fundamentals/workflows/locks` documents `acquireLockStep`/`releaseLockStep` (from `@medusajs/medusa/core-flows`) and the Locking Module service (`Modules.LOCKING`). Medusa uses these to prevent overselling in its cart workflows. For capacity holds — where two concurrent quotes must not claim the last remaining vehicle in a window — acquiring a lock keyed on `zone-origin + zone-destination + variant + window` is the native way to serialize the claim. This replaces ad-hoc race guards in `confirmTransferReservation`. [verified for mechanism; adoption is a recommendation]

---

## 4. Service (no physical shipment) vs fulfillment

**The native way to mark an item as a service/booking line is a shipping requirement of "none," not a bespoke "type = service" flag.** [verified]

The "Configure Selling Products" guide — `https://docs.medusajs.com/resources/commerce-modules/product/selling-products` — states the exact decision rule for whether a purchased item requires shipping/fulfillment, evaluated in order:

1. If the variant has an inventory item, its `requires_shipping` property decides.
2. If the variant has no inventory item, the presence of a **shipping profile** on the product decides (no shipping profile ⇒ no shipping required).

It then lists the four supported configurations, including verbatim: *"Items that don't require shipping or inventory management, such as selling digital products, **services, or booking appointments**."* [verified] The final row is *"Item that doesn't require shipping and its variant inventory isn't managed by Medusa."* [verified]

**Two concrete native mechanisms, both already visible in our repo's direction:**

1. **`requires_shipping: false`** on the inventory item (`https://docs.medusajs.com/resources/commerce-modules/inventory/concepts`). For a digital license with limited stock, set `requires_shipping: false`; the item still has quantity but never needs a shipment.
2. **No shipping profile on the product** (or `manage_inventory: false` with no inventory item). The Digital Products recipe's own create-form sets `manage_inventory: false` on the variant. [verified — recipe Step 10]

**Fulfillment for a service** has three native options, from `https://docs.medusajs.com/resources/commerce-modules/fulfillment` and the Digital Products recipe:

- **No fulfillment at all** — if nothing requires shipping, no fulfillment is created; the order's "delivery" is the confirmation/notification itself.
- **Custom fulfillment provider** — the Digital Products recipe explicitly uses a custom fulfillment provider to "deliver" the digital product (send the download/confirmation). For us that maps to *"delivering" the booking confirmation voucher*.
- **Manual/other fulfillment forms** — the Fulfillment Module supports "shipping or pick up" forms (`/concepts`), but for a booking these are less relevant than "no fulfillment" or a custom provider. [verified]

**Recommendation:** a transport booking line is *"no shipping profile + no inventory management"*, and the confirmation is delivered through the Notification Module (`https://docs.medusajs.com/resources/infrastructure-modules/notification`) or a thin custom fulfillment provider — not through the shipping machinery. We should not invent a `service`/`booking` product type; the native "no shipping" configuration *is* the service marker.

---

## 5. Tests and proofs they have done

Medusa documents a specific, layered testing approach — and our repo is already using it. The concrete runners and where they're documented:

**5a. `medusaIntegrationTestRunner`** — runs a *full* Medusa application for API-route and workflow tests. Provides `testSuite({ api, getContainer })` with `api.get/post/delete` helpers and container resolution. Creates/drops a DB `medusa-{random}-integration-{worker}`. Documented at `https://docs.medusajs.com/learn/debugging-and-testing/testing-tools/integration-tests`. [verified]

**5b. Workflow integration tests** — `https://docs.medusajs.com/learn/debugging-and-testing/testing-tools/integration-tests/workflows`. Patterns shown: run the workflow with `.run()` and assert `result`; assert thrown errors via `.run({ throwOnError: false })` and the returned `errors[]`; verify DB writes afterwards by resolving the module service or using Query; seed data in `beforeAll`/`beforeEach` via a service or another workflow. Long-running workflows are tested by subscribing to the Workflow Engine (`setStepSuccess`, `subscribe`). [verified]

**5c. API-route integration tests** — `https://docs.medusajs.com/learn/debugging-and-testing/testing-tools/integration-tests/api-routes`. [verified by presence; not re-read in full]

**5d. `moduleIntegrationTestRunner`** — runs a test Medusa app with *only the specified module* enabled, for testing a module's main service in isolation. Takes `moduleName`, `moduleModels`, `resolve`, `moduleOptions`, `injectedDependencies` (e.g. `MockEventBusService`), `testSuite({ service })`. DB `medusa-{module}-integration-{worker}`, tables created/dropped per test. Documented at `https://docs.medusajs.com/learn/debugging-and-testing/testing-tools/modules-tests`. [verified]

**5e. Module-link tests** — there is **no dedicated "module link test runner."** Links are exercised *through* the runners above: `defineLink`-created links expose an `entryPoint` usable with Query (`query.graph({ entity: link.entryPoint, ... })`), which the Digital Products recipe uses in a step (`retrieveDigitalProductsToDeleteStep` queries `DigitalProductVariantLink.entryPoint`). Link correctness is therefore proven in workflow/HTTP tests that traverse the link, not in a separate link harness. [verified for the entryPoint mechanism; inference for "no dedicated runner"]

**5f. Test tooling reference** — `https://docs.medusajs.com/resources/test-tools-reference` (parameter reference for both runners).

**What our repo already does [verified against the working tree]:** unit tests (`*.unit.spec.ts`), module integration tests using **both** `moduleIntegrationTestRunner` (`changes.integration.spec.ts`, `reservation.integration.spec.ts`) and `medusaIntegrationTestRunner` (`pricing.integration.spec.ts`, `native-pricing.integration.spec.ts`), and HTTP integration tests (`admin-transport.http.spec.ts`, `quote-cart.http.spec.ts`). This is the documented native pattern, not a deviation. The one refinement the docs add is the **workflow `throwOnError: false` + `errors[]`** idiom for asserting failure paths — useful for our reject-ambiguous-fare and duplicate-provider-event cases.

---

## 6. Map our transport models to native Medusa

This is the opinionated section. Mapping table first, then per-model reasoning.

| Our custom model | Native Medusa equivalent | Verdict | Rationale |
|---|---|---|---|
| `reservation` (trip anchor: status, quote_snapshot, confirmed_at) | `Order` + `orderChange` versioning + the existing `transport-reservation-order` link | **Keep thin, delete commerce duplication** | Order owns money/status/versioning; `reservation` keeps only trip facts (zones, H3 cells, pickup time, capacity, provider ref) + quote snapshot. Delete loose `order_id`/`cart_id`/`line_item_id`/`order_snapshot` in favor of links + Order versioning. |
| `reservation-change` (financial delta machinery) | `OrderEdit` / `OrderChange` + additional payment collections / refunds | **Delete the financial half; keep a thin requote record** | Native order edits already do confirmation, version increment, `pending_difference`, `paid_total`/`refunded_total`, one-pending-edit. Keep only the transport requote (previous/requested quote snapshot + trip delta). |
| `reservation-hold` (temporary hold, `expires_at`) | *None* (Inventory `ReservationItem` is quantity-only, no time dimension) | **Keep custom** | Time-windowed capacity is inherently ours. Native integration = scheduled job for expiry (already present) + Locking Module for concurrency. |
| `provider-event` (webhook idempotency) | Payment webhook route + `processPaymentWorkflow` (cart locking) | **Keep thin; add a unique constraint** | Native listener + processing exist; event-level dedupe is ours. `provider_event_id` must be `.unique()`, not `.index()`. |
| `audit-event` (append-only snapshots) | Order timeline (`orderChange` history) + Workflow Engine execution history | **Keep thin for transport-domain only** | Native timeline covers commerce events; it does not cover zone/fare corrections or reservation status corrections. Do not re-record order history. |
| `zone` / `zone-cell` | *None* (H3 model is ours) | **Keep custom** | Established in prior research (§10.3, Part B). Not in scope to delete. |
| `vehicle-class` | `Product` + `ProductVariant` | **Delete (already deprecated)** | Decision logged in `odd/decisions.md` (2026-09-18). Sellable vehicle = product+variant. |

### 6.1 `reservation` → Order plus a thin link

**[verified]** An Order already carries: line items (each referencing a variant), status, totals, versioned history (`orderChange`), and a back-reference to its originating cart. Medusa's own "extend the order" pattern (the Digital Products recipe links a custom `DigitalProductOrder` to `Order`) is exactly a "thin record linked to Order."

**[opinion]** The commerce half of `transport_reservation` is redundant: `order_id`, `cart_id`, `line_item_id`, and `order_snapshot` all duplicate state the Order (plus its version history) already owns, reachable through the existing `transport-reservation-order` link. What must stay custom is the **trip truth**: origin/destination H3 cells (or zone ids), pickup date/time, passenger/luggage counts, the quote snapshot (which freezes the price *rule/context* — something Order does not preserve), and the provider-facing reference. Keep a thin `reservation` holding exactly those, linked to Order (and ideally to the `product_variant` it was priced against).

### 6.2 `reservation-change` → native `orderEdit` (the big deletion)

**[verified — carried from prior research §4, sources re-cited here]** Order edits in Medusa are *not* applied immediately; they require confirmation, which increments the order **version**. Financial reconciliation is derived by comparing the order summary with existing transactions, exposing `paid_total`, `refunded_total`, `pending_difference`, `current_order_total`, `original_order_total`, `transaction_total`, `accounting_total`. Post-confirmation, positive differences are collected through additional payment collections and negative ones refunded. Medusa enforces **one pending edit at a time**.
Sources: `https://docs.medusajs.com/resources/commerce-modules/order/edit`, `https://docs.medusajs.com/user-guide/orders/edit`, `https://docs.medusajs.com/api/admin/order-edits/add-shipping-method.md`.

**[opinion]** This maps ~1:1 to `requestReservationChange` + `handleChangeProviderEvent`. The columns we should **delete** because native order edits own them:

- `delta_amount` → native `pending_difference`.
- `payment_link_status` / `refund_status` → native payment collections and refunds.
- `change_request_id` → native order change id (the edit itself).
- The confirmation/version/one-pending-edit mechanics in `service.ts` → native order edit workflow.

What stays custom is a **thin requote record**: `previous_quote_snapshot` and `requested_quote_snapshot` (the transport-specific fare context before/after), plus the changed trip facts (new zone/time). The flow becomes: compute new fare from the variant → propose an order edit that changes the line item (price and/or trip attributes) → let Medusa drive confirmation, version bump, and the payment/refund delta.

**Cross-reference — the market caveat:** doc 01 (§5–§6) argues that even this versioned proposal lifecycle is heavier than what the market (Mozio) actually does — it prefers modify-and-pay-difference or cancel-and-rebook. That is a *product-scope* decision, not a Medusa-capability question. Native order edits fully *support* the heavier design; whether the business should *deploy* it is the PRD's open question. Native support removes the "we must build a financial delta engine" reason to build bespoke machinery either way.

### 6.3 `reservation-hold` → ours; native expiry only

**[verified]** There is **no native time-windowed hold** (see §3). Inventory `ReservationItem` has no time dimension. The hold is ours.

**Minimal native integration:**
1. **Scheduled job for expiry** — `https://docs.medusajs.com/learn/fundamentals/scheduled-jobs`. Already implemented as `src/jobs/expire-transfer-holds.ts` (every 60s). Keep it; this is the native pattern (the Subscriptions recipe uses the same "daily expiry job" shape).
2. **Locking for capacity claims** — `https://docs.medusajs.com/learn/fundamentals/workflows/locks`. Wrap the confirm path with `acquireLockStep`/`releaseLockStep` keyed on the capacity window to prevent overselling. This is the one genuinely native addition worth making.
3. **Anchor the hold on the cart** — our hold already carries `cart_id`; the cart is the natural native "shopping session" to tie a hold to (a quote becomes a cart line item via `addToCartWorkflow`). No custom lifecycle needed beyond expiry.

### 6.4 `provider-event` → native listener + our unique ledger

**[verified — carried from prior research §5]** Medusa ships the webhook route `/hooks/payment/{identifier}_{provider}` and `processPaymentWorkflow`, which acquires a cart lock. It does **not** document a general idempotency-key store that deduplicates repeated webhook deliveries app-wide.

**What stays ours:** the `provider_event` ledger keyed by `provider_event_id`. **One correction to our current model:** `provider_event_id` is defined with `.index()`, but idempotency requires a **unique constraint** — `model.text().unique()`. Without it, two concurrent/repeated deliveries of the same provider event can both insert and double-apply the change. This is the single highest-value data-model fix this research surfaces. The `handleChangeProviderEvent` logic (confirm-or-error the change, then drive the native order edit confirmation) stays, but its "apply financial delta" tail is deleted in favor of native order edits.

### 6.5 `audit-event` → native timeline for commerce; thin custom for transport

**[verified]** Medusa records order history on the order timeline via `orderChange` (each edit/change/return is an immutable entry), and the Workflow Engine can persist execution history (`https://docs.medusajs.com/learn/fundamentals/workflows/store-executions`). But there is **no generic audit-log module**.

**Recommendation:** for *commerce* mutations (order edits, payments, refunds), the native timeline is authoritative — do not mirror it into `transport_audit_event`. Keep `audit_event` **only** for transport-domain mutations with no native counterpart: zone corrections (`adminCorrectZone`), fare corrections, and reservation status corrections (`adminCorrectReservation`). That is a thin, append-only, immutable-snapshot ledger — which is exactly what the current `createAuditSnapshot` deep-clone already does.

---

## 7. "As native as possible" target architecture

**Become native (delete custom code):**

1. **The reservation-change financial engine.** Delete `delta_amount`, `payment_link_status`, `refund_status`, `change_request_id`, and the confirmation/version mechanics. Re-implement `requestReservationChange`/`handleChangeProviderEvent` as: compute new fare → propose a native `orderEdit` (change the line item) → let Medusa handle confirmation, version bump, `pending_difference`, and the additional payment collection or refund.
2. **`reservation`'s commerce fields.** Delete `order_id`/`cart_id`/`line_item_id`/`order_snapshot`. Reach the Order (and its history) through the existing `transport-reservation-order` link; add a `reservation ↔ product_variant` link so the variant (price + capacity source) is a first-class reference.
3. **`audit-event` for commerce events.** Delete any recording of order-history events; rely on the native order timeline. Keep audit only for zone/fare/reservation corrections.

**Stay as a thin custom module (keep, but shrink):**

- `reservation` — trip facts only: origin/destination cells or zones, pickup date/time, passenger/luggage, quote snapshot, provider reference, `confirmed_at`. Linked to Order and ProductVariant.
- `reservation-hold` — quote id, cart id, `expires_at`, status. Expiry via scheduled job; concurrency via Locking Module.
- `provider-event` — **with `provider_event_id` made `.unique()`**.
- `audit-event` — transport-domain corrections only.
- `zone` / `zone-cell` — unchanged (H3 model, established).
- Workflows — shrunk to thin composition over native core flows (`createRemoteLinkStep`, order edit flows, `acquireLockStep`), no longer containing business logic that native modules already own.

**The smallest set of custom workflows that remain:**

1. `quote-cart` — resolve fare (native pricing, our exact-match guard) → snapshot → add to cart. (Unavoidably custom because of the exact-match rule.)
2. `confirm-reservation` — create the thin `reservation` + hold (with lock), link to Order, emit notification. (Custom because the booking aggregate is ours.)
3. `request-reservation-change` — compute new fare → drive a native order edit → record thin requote. (Custom shell over native order edit.)
4. `expire-transfer-holds` job — already a native scheduled job wrapping `expireReservationHolds`.

Everything else — catalog, pricing, tax, payment, cart/checkout, order creation, order edits/versioning, webhooks, notifications, admin shell, scheduled jobs — is native and must not be re-implemented.

**One-line target:** *Order is the commerce truth; a thin `reservation`/`hold` module is the trip truth; native order edits are the change/refund truth; and the only genuinely bespoke logic left is zone/fare resolution with exact-match rejection, time-windowed capacity, and webhook idempotency.*

---

## 8. Confidence and gaps

### High confidence (verified)
- There is **no** dedicated booking/rental/reservation/appointment/service-booking recipe; the Recipes index lists 13 recipes, none of which is one. The closest official patterns are Digital Products and Subscriptions.
- The "Configure Selling Products" guide names "services, or booking appointments" and documents the two-level shipping-requirement decision rule (`requires_shipping` on the inventory item, else the product's shipping profile).
- The Inventory Module is quantity-at-location (`InventoryLevel`, `ReservationItem`); `ReservationItem` has no time dimension, and the docs' event-ticket example makes the expiry logic *ours*, not the module's.
- The full Digital Products recipe building blocks: custom module → `defineLink` to `ProductVariant` and `Order` → workflow steps with compensation → `createRemoteLinkStep` → admin/store API → fulfillment provider.
- The testing layers: `medusaIntegrationTestRunner` (API routes + workflows), `moduleIntegrationTestRunner` (module service), and the `throwOnError:false`/`errors[]` workflow-test idiom. No dedicated module-link test runner; links are exercised via `link.entryPoint` + Query.
- Locking in workflows via `acquireLockStep`/`releaseLockStep` and the Locking Module.
- Our repo already uses both test runners and both `test:integration:modules` and `test:integration:http` layouts.

### Medium confidence (inference)
- That `reservation`'s `order_id`/`cart_id`/`line_item_id`/`order_snapshot` are fully redundant with Order + version history — true of the mechanism, but the exact minimal trip-fact field set depends on PRD details (round-trip legs, passenger/luggage) not fully enumerated here.
- That a `reservation ↔ product_variant` link should replace the `line_item_id` column — the pattern is documented, but whether our flows need the variant at the reservation level vs. the line-item level is a design choice.
- The exact `orderEdit` programmatic flow (workflow names, step inputs) for proposing a line-item price change at 2.20.1 — the *capability* is verified from the order-edit docs, but the precise core-flow invocation is not re-verified against the 2.20.1 workflow reference here.

### Could not verify / open gaps
- Whether `medusajs/examples` contains any additional booking/rental example repos beyond `digital-product` and the recipes listed. I enumerated the official Recipes index and the digital-product example; I did not exhaustively list every repo under `github.com/medusajs/examples`.
- The complete 2.20.1 `ReservationItem` / `OrderChange` model field lists from the API reference (I relied on the concepts pages and the prior research's order-edit findings rather than the full model references).
- Whether a custom fulfillment provider (to "deliver" a booking confirmation) is actually needed, or whether "no shipping + Notification Module" suffices — this is a UX/ops decision, not a documented fact.
- The precise capacity-lock key semantics (which fields define a claimable "window") — a product decision on whether capacity is per-variant, per-zone-pair, and at what time granularity.
- Native support for a *draft/quote-only* order state (i.e., a reservation not yet tied to a completed cart). Medusa has draft orders, but whether a draft order should carry our quote/hold is not verified here.

---

## Source index

Recipes and examples:
- https://docs.medusajs.com/recipes
- https://docs.medusajs.com/resources/recipes/digital-products
- https://docs.medusajs.com/resources/recipes/digital-products/examples/standard
- https://github.com/medusajs/examples/tree/main/digital-product
- https://docs.medusajs.com/resources/recipes/subscriptions
- https://docs.medusajs.com/resources/recipes/marketplace
- https://docs.medusajs.com/resources/recipes/erp
- https://docs.medusajs.com/resources/recipes/b2b
- https://docs.medusajs.com/resources/recipes/bundled-products
- https://docs.medusajs.com/resources/recipes/commerce-automation
- https://docs.medusajs.com/resources/recipes/ecommerce
- https://docs.medusajs.com/resources/recipes/multi-region-store
- https://docs.medusajs.com/resources/recipes/omnichannel
- https://docs.medusajs.com/resources/recipes/oms
- https://docs.medusajs.com/resources/recipes/personalized-products
- https://docs.medusajs.com/resources/recipes/pos

Commerce modules:
- https://docs.medusajs.com/resources/commerce-modules/inventory
- https://docs.medusajs.com/resources/commerce-modules/inventory/concepts
- https://docs.medusajs.com/resources/commerce-modules/product/selling-products
- https://docs.medusajs.com/resources/commerce-modules/product/extend
- https://docs.medusajs.com/resources/commerce-modules/fulfillment
- https://docs.medusajs.com/resources/commerce-modules/order
- https://docs.medusajs.com/resources/commerce-modules/order/edit
- https://docs.medusajs.com/user-guide/orders/edit
- https://docs.medusajs.com/api/admin/order-edits/add-shipping-method.md
- https://docs.medusajs.com/resources/commerce-modules/payment/webhook-events

Fundamentals:
- https://docs.medusajs.com/learn/fundamentals/modules
- https://docs.medusajs.com/learn/fundamentals/module-links
- https://docs.medusajs.com/learn/fundamentals/modules/service-factory
- https://docs.medusajs.com/learn/fundamentals/workflows
- https://docs.medusajs.com/learn/fundamentals/workflows/compensation-function
- https://docs.medusajs.com/learn/fundamentals/workflows/locks
- https://docs.medusajs.com/learn/fundamentals/workflows/store-executions
- https://docs.medusajs.com/learn/fundamentals/scheduled-jobs
- https://docs.medusajs.com/learn/fundamentals/events-and-subscribers

Testing:
- https://docs.medusajs.com/learn/debugging-and-testing/testing-tools
- https://docs.medusajs.com/learn/debugging-and-testing/testing-tools/integration-tests
- https://docs.medusajs.com/learn/debugging-and-testing/testing-tools/integration-tests/workflows
- https://docs.medusajs.com/learn/debugging-and-testing/testing-tools/integration-tests/api-routes
- https://docs.medusajs.com/learn/debugging-and-testing/testing-tools/modules-tests
- https://docs.medusajs.com/resources/test-tools-reference

Infrastructure modules:
- https://docs.medusajs.com/resources/infrastructure-modules/workflow-engine
- https://docs.medusajs.com/resources/infrastructure-modules/locking
- https://docs.medusajs.com/resources/infrastructure-modules/notification
