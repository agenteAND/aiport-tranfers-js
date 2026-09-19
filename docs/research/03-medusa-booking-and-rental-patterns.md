# Medusa Booking and Rental/Reservation Patterns

**Status:** Research deliverable
**Date:** 2026-09-19
**Subject repository:** `ground-transportation-fare` (`@dtc/backend`, MedusaJS 2.20.1)
**Companion documents:** `docs/research/01-transfer-booking-market-and-mozio.md`, `docs/research/02-medusa-capabilities-and-zone-tech.md`, `odd/index.md`

> ## ⚠ CORRECTION — 2026-09-19
>
> Section 1 of this document originally claimed that Medusa ships **no** booking or rental
> recipe. **That claim was false.** Medusa ships an official **Ticket Booking System recipe**
> (`https://docs.medusajs.com/resources/recipes/ticket-booking`) and an official **Product
> Rentals tutorial** (`https://docs.medusajs.com/resources/how-to-tutorials/tutorials/product-rentals`),
> and the community plugin `RSC-Labs/medusa-booking-system` implements time-windowed holds and
> availability rules.
>
> Section 1 has been rewritten with the verified sources. **Any conclusion elsewhere in this
> document that depends on "no official booking pattern exists" must be re-read against the
> corrected Section 1.** In particular, statements that availability/holds are "inherently ours"
> describe what Medusa's *Inventory* module does not do — they do not mean no booking pattern
> exists to copy.

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

**Short answer: YES — and an earlier draft of this document was wrong to say otherwise.** Medusa ships an official **Ticket Booking System recipe** and an official **Product Rentals tutorial**, and a community plugin implements time-windowed holds and availability rules. The correct conclusion is the opposite of the original text: we should be adapting to a documented booking pattern, not inventing one.

### 1.1 Official Ticket Booking System recipe [verified]
- Recipe: `https://docs.medusajs.com/resources/recipes/ticket-booking`
- Full step-by-step example: `https://docs.medusajs.com/resources/recipes/ticket-booking/example`

This is the closest official template to our product. It covers:

- A **Ticket Booking Module** with `Venue`, `TicketProduct`, `TicketProductVariant`, and `TicketPurchase` data models.
- Module links: `TicketProduct` → Product `Product`; `TicketProductVariant` → `ProductVariant` (gaining native pricing and inventory); `TicketPurchase` → Order `Order` (gaining native orders and payments).
- **Capacity per time window**: inventory items are set up per show date and seating section, with available quantity equal to the seats available in that section on that date — explicitly to prevent overbooking.
- **Disable shipping** by setting `requires_shipping` to `false` on the product variant's inventory item, then trimming shipping steps from checkout so only billing address and payment are required.
- **`validate` hooks on `addToCartWorkflow` and `completeCartWorkflow`** to check availability at add-to-cart and at order placement. This is the officially sanctioned place to enforce availability.
- Order confirmation email with a QR code via a subscriber on `order.placed` plus the Notification Module.
- Admin widgets/UI routes for venues and shows, and storefront customization of the Next.js starter.

### 1.2 Official Product Rentals tutorial [verified]
- Tutorial: `https://docs.medusajs.com/resources/how-to-tutorials/tutorials/product-rentals`
- Announcement post: `https://medusajs.com/blog/product-rentals`

- A **Rental Module** holding rental configurations and customer rental records.
- Links: rental configuration → product; rental record → order.
- An admin rental section per product, with minimum and maximum rental durations.
- Rental-period validation in the backend at selection time, **at add-to-cart, and at order placement** — the same three-point validation shape as ticket booking.
- `cancelOrderWorkflow.hooks.orderCanceled` to block cancelling an order whose rentals are already out, plus a subscriber that cancels rentals when the order is cancelled.
- Explicit guidance on removing shipping requirements and managing inventory.

### 1.3 Reservation Management (Inventory module) [verified]
`https://medusajs.com/blog/announcing-reservation-management` — reservations are **virtual stock reductions** with admin visibility, advanced filters, and APIs. Merchants can create and edit reservations directly from Admin with a description and metadata. This confirms the earlier finding: **inventory reservations carry no time dimension**, so time-windowed holds remain ours. The useful part is that admin-created reservations with descriptive metadata are a supported building block for holding stock for a specific purpose.

### 1.4 Production precedent: Viessmann [verified]
`https://medusajs.com/blog/viessmann` (September 2024) — Viessmann Climate Solutions launched a marketplace for mobile heating and cooling rentals on Medusa, built with Agilo, live in 8 weeks. Their custom post-order flow (draft order → supplier accept/reject email → status sync → replacement sourcing → booking and fulfillment) is marketplace machinery we do not need. The relevant proof is narrower and important: **a real rental-booking platform runs on Medusa in production**, built as a custom booking flow plus Admin UI routes/widgets, with multi-region support.

### 1.5 Community plugin: RSC-Labs/medusa-booking-system [verified]
`https://github.com/RSC-Labs/medusa-booking-system` — Apache-2.0, requires Medusa v2.7.0+, installable as `@rsc-labs/medusa-booking-system`. Non-official, but its primitives map almost directly onto our domain:

- **Bookable resources** with custom types, pricing units (hourly/daily/weekly), product-variant integration, and draft/published status.
- **Availability rules**: multiple rules per resource, priority-based evaluation, available/unavailable effects, date-range validity, active/inactive state.
- **Booking rules (policies)**: `require_payment`, `require_confirmation`, and **`reservation_ttl_seconds`** — i.e. hold expiry, the exact concept we built by hand — with global-or-per-resource scope, priority, and validity windows, resolved by merging on priority.
- **Pricing** per resource: currency-based, multiple configurations, product-variant integration.
- Store API includes **`POST /store/booking-resources/[id]/hold`**, and booking carts whose item-add creates a temporary allocation that is finalized at cart completion.
- Admin UI with Overview, Resources, Rules, and Bookings sections.

**Why this matters:** this plugin already implements the two things the original draft of this document called inherently ours — time-windowed holds and availability rules. Whether or not we adopt it, it should be read before we write a competing module.

### 1.6 Other official recipes, for context [verified]
The Recipes index also lists Marketplace, Subscriptions, Digital Products, Integrate ERP, B2B, Bundled Products, Commerce Automation, Ecommerce, Multi-Region Store, Omnichannel, OMS, Personalized Products, and POS — `https://docs.medusajs.com/resources/recipes`. These remain useful secondary patterns; Subscriptions is still the best-verified precedent for a scheduled job that mutates domain records on a time boundary, and Digital Products remains a clean example of a custom-module-plus-link shape.

**Net (corrected):** Medusa ships **two** official templates directly relevant to us — the Ticket Booking recipe and the Product Rentals tutorial — plus at least one community plugin that already implements holds and availability rules. Any conclusion that treats booking as "something Medusa does not model" rests on a false premise and must be discarded.

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

**Can it model time-windowed capacity for a service with no physical stock? Not by itself — but the official booking recipe shows how to compose it. [verified + inference]**

The Inventory Module is a **quantity-at-a-location** model. There is no time dimension on `InventoryLevel` or `ReservationItem`: no start time, no end time, no slot, no expiry field. The docs' own closest example is instructive — for event tickets it says *"you can create a reservation item when a customer selects a ticket. Then, you can remove the reservation item if the customer doesn't complete the purchase within a specific time."* [verified] The **time-limited hold is our removal logic**, not an inventory concept: the module reserves a *count*, and something outside the module (a scheduled job) releases it.

**The important correction to the original draft of this section:** "no time dimension in `InventoryLevel`" does **not** mean time-windowed capacity is unsupported. The official Ticket Booking recipe (§1.1) models capacity per window by **creating one inventory item per window** — per show date and seating section — and setting the available quantity to the seats in that section for that date. The time dimension lives in *our* item identity, not in the module. That is the supported native composition, and it is materially different from "you must invent a parallel capacity system."

What genuinely has no native primitive is the **temporary hold with a TTL** (reserve now, auto-release if unpaid). The community plugin covers exactly that gap with `reservation_ttl_seconds` and `POST /store/booking-resources/[id]/hold` (§1.5) — useful as a reference design, not as a Medusa primitive.

**Conclusion (corrected):** model capacity windows as **one inventory item per window** (the official pattern), and keep the **TTL hold** as a thin custom record. Our `reservation-hold` model (`quote_id`, `cart_id`, `status`, `expires_at`) remains the right custom shape, and the 60-second `expire-transfer-holds` job remains the right native execution mechanism (scheduled job). Do not attempt to express "14:30 on 2027-01-04" *inside* `InventoryLevel`; express it by which inventory item you reserve.

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
| `reservation-hold` (temporary hold, `expires_at`) | *No direct equivalent.* Capacity windows map to **one `InventoryItem` per window** (the official ticket-booking pattern, §1.1); the TTL hold itself has no native primitive | **Keep the TTL hold custom; adopt per-window inventory items for capacity** | Inventory `ReservationItem` is quantity-only with no time dimension, so the TTL hold stays ours. Native integration = scheduled job for expiry (already present) + Locking Module for concurrency. Reference design for the hold itself: the community plugin's `reservation_ttl_seconds` (§1.5). |
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
