# Medusa 2.20.1 Capabilities and Zone-Modeling Technology

**Status:** Research deliverable
**Date:** 2026-09-19
**Subject repository:** `ground-transportation-fare` (`@dtc/backend`, MedusaJS 2.20.1)
**Companion documents:** `docs/product/airport-transfer-prd.md`, `odd/index.md`

> ## ⚠ CORRECTION — 2026-09-19
>
> Two claims in this document were **wrong** and have been corrected:
>
> 1. "Availability / time-windowed capacity holds — **Not available**" → the official
>    **Ticket Booking System recipe** models capacity per window by creating one inventory
>    item per window. Only the **TTL hold** is ours. The advice "do not model capacity holds
>    as inventory" is retracted. See §10.1.
> 2. "Transport reservations as a booking concept — **NOT native**" → true that there is no
>    native aggregate, but Medusa ships **two official booking patterns** to copy (Ticket
>    Booking recipe, Product Rentals tutorial). See §10.4 and
>    `docs/research/03-medusa-booking-and-rental-patterns.md`.
>
> The PostGIS verdict, the pricing findings, and the geocoding/zone-modeling findings are
> unaffected and still stand.

## 0. Scope, method, and evidence rules

This document answers two questions:

- **Part A** — What does MedusaJS 2.20.1 already provide for the airport-transfer product, and what must we build ourselves?
- **Part B** — Do we need PostGIS, or can H3 cells in ordinary indexed PostgreSQL columns carry the zone model?

**Method.** Primary sources only: `docs.medusajs.com`, `h3geo.org`, `postgis.net`, and `dgii.gov.do`. Claims are tagged:

- **[verified]** — stated explicitly in a cited primary source.
- **[inference]** — derived by combining cited facts; not stated verbatim.
- **[assumption]** — believed but not confirmed for 2.20.1; must be validated.

**Version discipline.** The installed package is pinned to `@medusajs/*@2.20.1` (`apps/backend/package.json`). Some Medusa documentation pages describe features gated behind later releases; those are flagged inline and must not be planned against. Where the docs do not confirm 2.20.1 behavior explicitly, that is stated rather than assumed.

**Repository constraints carried into this document:**
`h3-js@4.5.0` is already a dependency; the transport module currently stores zone cells as H3 strings; the architecture convention is Module → Workflow → API Route; the project has no storefront and no custom admin UI.

---

## 1. Capability table

| # | Capability | Medusa 2.20.1 | Primary source | Implication for us |
|---|---|---|---|---|
| 1 | Product / variant catalog, options, images, admin UI | **Native** | [Product extend](https://docs.medusajs.com/resources/commerce-modules/product/extend) | Vehicle type = real product + variant. Do not build a catalog. |
| 1b | Arbitrary custom product fields (capacity, luggage, restrictions) | **Partial** | [Product extend](https://docs.medusajs.com/resources/commerce-modules/product/extend) | Native `metadata` JSON exists; typed/indexed fields require a custom module model + module link. |
| 2 | Price sets, price lists, custom rules, currencies | **Native** | [Pricing](https://docs.medusajs.com/resources/commerce-modules/pricing) | Fares can be modeled as price rules. |
| 2b | Strict "exactly one match or reject" price selection | **Not available** | [Price calculation](https://docs.medusajs.com/resources/commerce-modules/pricing/price-calculation) | `calculatePrices` resolves partial matches silently. Our reject-unless-unique rule is ours to enforce. |
| 3 | Promotions, coupons, campaigns | **Native** | [Promotion module](https://docs.medusajs.com/resources/commerce-modules/promotion) | Reuse for discounts; do not build a coupon engine. |
| 3b | Tax regions, rates, tax lines | **Native** | [Tax module](https://docs.medusajs.com/resources/commerce-modules/tax) | ITBIS = configured tax rate. Calculation only. |
| 3c | Legally valid Dominican fiscal invoice (e-CF) | **Not available** | [DGII e-CF](https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/default.aspx) | Must integrate an authorized e-CF provider/emitter. Medusa's order is not an invoice. |
| 4 | Cart, checkout, order creation, totals | **Native** | [Order module](https://docs.medusajs.com/resources/commerce-modules/order) | Reuse cart → order completion. |
| 4b | Order edits, versioning, financial delta | **Native** | [Order edit](https://docs.medusajs.com/resources/commerce-modules/order/edit) | Use order edits + `pending_difference`; do not build a parallel totals engine. |
| 5 | Payment collections, authorize, capture, refund | **Native** | [Payment module](https://docs.medusajs.com/resources/commerce-modules/payment) | Reuse collections and refunds. |
| 5b | Payment webhook listener + processing | **Native** | [Payment webhook events](https://docs.medusajs.com/resources/commerce-modules/payment/webhook-events) | Reuse `/hooks/payment/{identifier}_{provider}`. |
| 5c | Guaranteed webhook deduplication / idempotency | **Partial** | [processPaymentWorkflow](https://docs.medusajs.com/resources/references/medusa-workflows/processPaymentWorkflow) | Cart locking is built in; event-level dedupe for our side effects is ours. |
| 6 | Admin widgets, pages, custom API routes | **Native** | [Widgets](https://docs.medusajs.com/learn/fundamentals/admin/widgets), [UI routes](https://docs.medusajs.com/learn/fundamentals/admin/ui-routes), [API routes](https://docs.medusajs.com/learn/fundamentals/api-routes) | Build zone editor and reservation console as UI routes. |
| 7 | Storefront | **Partial** | [Next.js starter](https://docs.medusajs.com/resources/nextjs-starter) | Medusa ships a starter, not a solution. This repo has none; we must add one. |
| 8 | Module links across isolated modules | **Native** | [Module links](https://docs.medusajs.com/learn/fundamentals/module-links) | Link vehicle profiles and reservations to Medusa entities. |
| 9 | Scheduled jobs | **Native** | [Scheduled jobs](https://docs.medusajs.com/learn/fundamentals/scheduled-jobs) | Expire-holds job pattern is supported. |
| 9b | Subscribers / events | **Native** | [Events and subscribers](https://docs.medusajs.com/learn/fundamentals/events-and-subscribers) | Notifications and side effects hang off events. |
| 9c | Notifications (email/SMS) | **Native** | [Notification module](https://docs.medusajs.com/resources/infrastructure-modules/notification) | Use the Notification Module + provider instead of a bespoke mailer. |
| 10 | Availability / time-windowed capacity holds | **Partial — composable** | [Ticket booking recipe](https://docs.medusajs.com/resources/recipes/ticket-booking) | Capacity windows ARE supported natively by creating **one inventory item per window** (the official ticket-booking pattern: one item per show date and section). Only the TTL hold is ours. See §10.1. |
| 10b | Address geocoding | **Not available** | — | External provider + our own persistence. |
| 10c | Zone / polygon modeling | **Not available** | — | Ours (H3 module already exists). |
| 10d | Transport reservations as a domain concept | **Not provided, but officially templated** | [Ticket booking recipe](https://docs.medusajs.com/resources/recipes/ticket-booking), [Product rentals tutorial](https://docs.medusajs.com/resources/how-to-tutorials/tutorials/product-rentals) | No native reservation aggregate, but Medusa ships two official booking patterns to copy. `transport_reservation` stays custom, linked to Order. See §10.4. |
| 11 | H3 polygon→cells, coordinate→cell, hierarchy | **N/A (library)** | [H3 regions](https://h3geo.org/docs/api/regions), [H3 indexing](https://h3geo.org/docs/highlights/indexing) | Fits the existing module. |
| 12 | Point-in-polygon containment in the DB | **N/A (PostGIS)** | [ST_Contains](https://postgis.net/docs/ST_Contains.html) | Not required by the H3 model. |
| 13 | PostGIS | **Not required (recommendation)** | [Spatial indexing](https://postgis.net/workshops/postgis-intro/indexing.html) | See §12–§13. |

---

## Part A — Medusa 2.20.1 capabilities

### 1. Products and variants as the vehicle-type anchor

**Verified.** Medusa's Product Module owns products, variants, options, and images, and the admin dashboard provides full CRUD for them, including variant options, prices, and images. Custom data is attached by either:

1. the native `metadata` JSON field on product/variant (flexible, untyped, not first-class indexable), or
2. a custom module data model plus a module link — the documented "Extend Product Data Model" pattern. The example creates a `Custom` model, links it to `Product` with `defineLink`, consumes `productsCreated` / `productsUpdated` workflow hooks, and passes values through `additional_data` validated in `src/api/middlewares.ts`. The same procedure applies to `ProductVariant` and `ProductOption`.

Sources: [Extend Product Data Model](https://docs.medusajs.com/resources/commerce-modules/product/extend), [Create Product Variant endpoint](https://docs.medusajs.com/api/admin/products/confirm-product-import-2).

**What the admin product UI already gives us [verified].** Product create/edit flows, product options and variants, variant-level prices, images, organization, sales channels, and metadata editing. The product details page exposes an injection zone (`product.details`) for custom widgets.

**Implication.** A sellable vehicle type maps cleanly to one product with one (or more) variants. Capacity, luggage capacity, and service restrictions are not native typed fields. Our recommendation:

- Keep `metadata` only for non-queried descriptive data.
- Model **queryable** attributes (passenger capacity, luggage capacity, active restriction flags) as a custom `VehicleProfile`-style module model linked to the product/variant, with real indexed columns. The PRD already anticipates this with `VehicleProfile`.
- Do not add foreign keys to Medusa tables — use a module link (§8).

**Confidence:** high for the mechanism; the exact admin UI form fields for variant metadata are standard Medusa behavior and not re-verified field-by-field for 2.20.1.

---

### 2. Pricing: price sets, price lists, rule attributes, currency, and what `calculatePrices` does **not** guarantee

**Verified — what exists.**
The Pricing Module supports price sets, prices with arbitrary rule attributes (e.g. `region_id`, `city`, and any custom rule key), price lists of type `sale` or `override` with start/end dates, multiple currencies per price set, and tiered pricing via `min_quantity` / `max_quantity`. The service API is `calculatePrices({ id: [priceSetIds] }, { context })`.
Sources: [Pricing module](https://docs.medusajs.com/resources/commerce-modules/pricing), [Price calculation](https://docs.medusajs.com/resources/commerce-modules/pricing/price-calculation), [calculatePrices reference](https://docs.medusajs.com/resources/references/pricing/calculatePrices/index.html.md), [Price rules](https://docs.medusajs.com/resources/commerce-modules/pricing/price-rules/index.html.md).

**Verified — the partial-match behavior (this is the internal finding, confirmed).**
The documentation's "Original Price Selection Logic" states the algorithm explicitly:

1. If the context has no rules, select the default price.
2. If the context has rules and a price matches **all** rules, select it.
3. If no price matches all rules: *"Find all the prices whose rules match at least one rule in the context. Sort the matched prices by the number of matched rules in descending order. Select the first price in the sorted list (the one that matches the most rules)."*

Source: [Price calculation — Original Price Selection Logic](https://docs.medusajs.com/resources/commerce-modules/pricing/price-calculation).

**What this means [verified + inference].**

- `calculatePrices` **never fails on an ambiguous or partial match**. It deterministically picks one "most relevant" price by matched-rule count.
- The return object exposes `calculated_amount`, `calculated_price`, `is_calculated_price_price_list`, etc., but the documented shape exposes **no match-quality flag** — there is no "exact vs partial" discriminant in the return value [verified by absence in the documented return type; treat as inference for 2.20.1].
- Therefore our `resolveTransferFare` contract (reject if zero matches **or** more than one match) is **stricter than the platform** and cannot be delegated to `calculatePrices` alone. We must validate the context ourselves — by querying the price set's prices/rules and asserting an exact, unique match — before or alongside calling `calculatePrices`.

**Currency [verified].** Price sets store per-currency amounts; Medusa currency codes are lowercase ISO codes. This aligns with the project's "prices stored as-is with lowercase currency codes" convention. Medusa does not perform implicit FX conversion between currencies; a context resolves within the requested `currency_code`.

**Implication.** Keep using the Pricing Module as the fare source, but wrap it: the workflow must (a) build a fully-populated context, (b) assert exactly one exact-match rule, (c) call `calculatePrices` for the authoritative amount, and (d) snapshot the selected `price.id` and context used. The PRD's Phase-0 spike requirement is therefore not about *capability* but about *scale and ambiguity control*.

**Confidence:** high on the algorithm; medium on the absence of a match-quality flag (documented return shape only).

---

### 3. Promotions and taxes — and the Dominican fiscal-invoice gap

**Promotions [verified].** The Promotion Module provides discount application methods (percentage/fixed), target types (items, shipping methods, order), flexible rules, campaigns with shared budgets/dates, and workflows to apply promotions to carts and orders.
Source: [Promotion module](https://docs.medusajs.com/resources/commerce-modules/promotion).

**Taxes [verified].** The Tax Module provides tax regions per country, default tax rates, conditioned rate overrides, and tax-line calculation for carts and orders through tax providers. It also supports custom tax providers.
Source: [Tax module](https://docs.medusajs.com/resources/commerce-modules/tax).

**ITBIS [verified].** ITBIS is a value-added-type consumption tax on transfers of industrialized goods and the provision of services. The DGII states the general rate from 2016 onward is **18%**, with a reduced 16% rate for a specific goods list that does not include transport services.
Source: [DGII — ITBIS](https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/principalesImpuestos/Paginas/Itbis.aspx).

**The fiscal-invoice gap [verified].** Medusa produces orders, payment records, and tax lines. It does **not** produce a legally valid Dominican fiscal invoice:

- Electronic fiscal receipts (**e-CF**) are mandatory in the Dominican Republic under **Ley 32-23** and **Norma General 06-2018**. Emitters must be authorized by the DGII, hold a digital certificate for tax procedures, generate the standard XML format, and pass DGII certification.
- Small, micro, and unclassified taxpayers had until **15 November 2026** to be authorized and emitting e-CF (Aviso 06-26 extension; reiterated by DGII on 17 August 2026).
Sources: [DGII e-CF](https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/default.aspx), [DGII e-CF FAQ](https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Preguntas%20frecuentes/Generales/Preguntas%20Frecuentes%20e-CF%20Generales.pdf).

**Implication.** Configure ITBIS as a tax rate, but treat the fiscal document as an **external integration**, not a Medusa feature. The system must keep a payment **receipt** / **payment request** distinct from a legally valid **fiscal invoice**, and store the external invoice reference. The PRD already lists this as a launch dependency; this research confirms it is not a Medusa gap that will be closed by configuration.

**Assumption to validate:** the exact tax treatment of ground-transfer services (rate, withholding, and exemption status) is a business/tax decision. We must not let the model invent it — it requires a Dominican accountant's signed-off decision.

---

### 4. Cart and order — checkout, creation, edits, totals, history

**Verified — cart and checkout.** Carts are region-scoped, accept line items (including custom-priced items retaining a real variant — see §5 note and the custom-item-price guide), and flow through promotions, tax lines, payment collections, and cart completion into an order.
Source: [Order module](https://docs.medusajs.com/resources/commerce-modules/order), [Custom item price guide](https://docs.medusajs.com/resources/examples/guides/custom-item-price).

**Verified — order management.** The Order Module provides order retrieval/creation/cancellation, draft orders, promotion and tax adjustments, returns, exchanges, claims, edits, order-change tracking, and **order versioning** over the order timeline.
Source: [Order module](https://docs.medusajs.com/resources/commerce-modules/order).

**Verified — order edits.** Order edits are *not* applied immediately; they must be confirmed. Confirmation increments the order's **version**, and payments/refunds are derived by comparing the order summary with existing transactions. The summary exposes `paid_total`, `refunded_total`, `pending_difference`, `current_order_total`, `original_order_total`, `transaction_total`, and `accounting_total`. After confirmation, outstanding amounts are captured or refunded through standard payment handling.
Sources: [Order edit](https://docs.medusajs.com/resources/commerce-modules/order/edit), [Manage order payments](https://docs.medusajs.com/user-guide/orders/edit), [Order edit JSON structure](https://docs.medusajs.com/api/admin/order-edits/add-shipping-method.md).

**Verified constraint.** Medusa currently allows only one requested (pending) order edit at a time.
Source: [Medusa Admin — edit orders](https://docs.medusajs.com/user-guide/orders/edit).

**Implication.** This maps almost one-to-one onto the PRD's paid-reservation-change story: one active change, version-based control, `pending_difference` as the settlement amount, additional payment collection or refund after confirmation. We should implement our reservation change as a **proposal** that drives a Medusa order edit, and let Medusa own the order financial history.

**Confidence:** high.

---

### 5. Payment module — collections, captures, refunds, webhooks, idempotency

**Verified — features.** The Payment Module provides payment collections (all payments for one resource, e.g. a cart), authorize/capture/refund, third-party providers (Stripe and others), saved payment methods, and webhook handling.
Source: [Payment module](https://docs.medusajs.com/resources/commerce-modules/payment).

**Verified — webhooks.** Medusa exposes an out-of-the-box webhook route `/hooks/payment/[identifier]_[provider]`. It calls `getWebhookActionAndData` on the Payment Module, which delegates to the relevant provider. On `authorized` or `captured`, Medusa updates the payment session and, if the cart is not yet completed, completes the cart. The underlying `processPaymentWorkflow` acquires a lock on the cart before mutating it and releases it before completion.
Sources: [Payment webhook events](https://docs.medusajs.com/resources/commerce-modules/payment/webhook-events), [processPaymentWorkflow reference](https://docs.medusajs.com/resources/references/medusa-workflows/processPaymentWorkflow).

**Idempotency — what is and is not guaranteed.**
[inference] The docs describe **cart locking** inside `processPaymentWorkflow` and warn that reusing that workflow requires acquiring and releasing a lock. They do **not** document a general, provider-agnostic idempotency-key mechanism that deduplicates repeated webhook deliveries for the whole application. Provider-level duplicate suppression is provider-specific and must not be assumed.
Therefore:
- Medusa protects the **core payment/cart mutation** from concurrent races via locking.
- Deduplication of **our own side effects** (creating reservation changes, capturing deltas, writing audit events) remains our responsibility. The repository already has a `provider_event` model with `provider_event_id`, which is the correct shape. It must be paired with a unique constraint on the provider event id.

**Additional payment collections for edits [verified].** Post-edit outstanding amounts (including positive `pending_difference`) are settled through additional payment collections / captures on the original order, per the order-edit documentation.

**Confidence:** high on capability; medium on the precise idempotency surface for 2.20.1 (documented behavior is lock-based, not a documented dedupe store).

---

### 6. Admin dashboard extensibility

**Verified.**

- **Widgets** live in `src/admin/widgets/*.tsx`, export a React component plus `defineWidgetConfig({ zone })`, and are injected into predefined zones. Detail-page widgets receive the page entity in a `data` prop typed via `DetailWidgetProps<T>`. Since **v2.17.2**, widget placement is controlled by Layout Configurations and `.before`/`.after` suffixes are deprecated (login page excepted). Source: [Admin widgets](https://docs.medusajs.com/learn/fundamentals/admin/widgets).
- **UI routes / custom pages** live under `src/admin/routes/**/page.tsx`, with file-relative paths becoming admin URLs (`/app/...`). They support `defineRouteConfig({ label, icon, rank, nested })`, settings pages under `settings/`, path params via `[param]`, breadcrumbs via `handle.breadcrumb`, and dynamic page titles via `handle.seo` (**v2.17.2+**; `loaderData` replaces `data` from **v2.19.0**). Source: [Admin UI routes](https://docs.medusajs.com/learn/fundamentals/admin/ui-routes).
- **Custom API routes** live under `src/api/**/route.ts`, export method handlers, and are validated/transformed via `src/api/middlewares.ts`. Source: [API routes](https://docs.medusajs.com/learn/fundamentals/api-routes).

**Version caveat for this repo.** `allowFields` (used to expose linked custom fields on Store API routes) is documented as **available since v2.21.0**, so it is **not** available at 2.20.1. If we need linked vehicle data on `/store` routes, we must implement a custom allowed-fields middleware rather than use `allowFields`. Source: [Product extend — Store API retrieval](https://docs.medusajs.com/resources/commerce-modules/product/extend).

**Repository state.** `odd/index.md` confirms there are currently **no** custom admin widgets or pages; only admin API routes exist. The zone editor, reservation console, and exceptions view are therefore greenfield UI work.

**Implication.** Every back-office surface in the PRD (zone editor, fare corrections, reservation search, change review, exceptions/reconciliation) has a native extension point. Do not build a separate admin SPA.

**Confidence:** high for the extension points; the `allowFields` version gate is [verified] from the docs.

---

### 7. Storefront — what ships vs. what we build

**Verified.** Since Medusa **v2.14.0**, the Next.js Starter storefront is installed in a monorepo alongside the Medusa application via `create-medusa-app --with-nextjs-starter` (or copied from the DTC starter). The **standalone** Next.js starter is deprecated. The storefront is hosted separately from the backend and communicates through the Store API using a publishable API key. Medusa deliberately leaves the frontend stack to the team.
Source: [Next.js Starter Storefront](https://docs.medusajs.com/resources/nextjs-starter).

**Repository state [verified].** `apps/` contains only `backend/`; there is no storefront, and `odd/index.md` states this explicitly. Nothing in the current tree serves customer-facing quote, checkout, or reservation-change screens.

**Implication.** The storefront is real work, not a given. The fastest path is to add `apps/storefront` from the DTC starter and then build the transfer-specific flows (quote form, map/address confirmation, vehicle selection, checkout, reservation management) on top of its existing cart/checkout primitives. Reuse its cart, region, and checkout plumbing; do not write a custom cart client.

**Confidence:** high.

---

### 8. Module links — relating our entities to Medusa entities without breaking isolation

**Verified.** A module link associates data models of two different modules while preserving module isolation. Links are declared with `defineLink(...)` in `src/links/*.ts` and materialized by `npx medusa db:sync-links` (or `db:migrate`). The link table contains **only the IDs** of the linked records and **no foreign-key constraint**. Options include `isList` (one-to-many / many-to-many), `alias` (**v2.17.2+**), `deleteCascade`, and custom link-table columns. Cross-module reads use Query (`query.graph({ entity, fields, filters })`).
Sources: [Module links](https://docs.medusajs.com/learn/fundamentals/module-links), [Extend Product Data Model](https://docs.medusajs.com/resources/commerce-modules/product/extend).

**Repository state [verified].** `apps/backend/src/links/transport-reservation-order.ts` already links `transportReservation` to Medusa `order` via `defineLink`.

**Implication.** Link a `VehicleProfile`/vehicle model to `Product`/`ProductVariant`, and keep the reservation↔order link. Never reach into Medusa tables with a raw FK from a custom module. Because the link table has no FK, integrity for "variant must exist" is enforced at our service layer, not by the database.

**Confidence:** high.

---

### 9. Scheduled jobs and subscribers

**Verified — jobs.** A scheduled job is a file in `src/jobs/*.ts` exporting an async function `(container, context) => {}` and a `config = { name, schedule }` where `schedule` is a cron expression. Jobs run only while the application is running. The `context.scheduledFor` value is available since **v2.17.0**. Do not disable a job by leaving a `config`-less file in `src/jobs`.
Source: [Scheduled jobs](https://docs.medusajs.com/learn/fundamentals/scheduled-jobs).

**Verified — subscribers and events.** A subscriber is a file in `src/subscribers/*.ts` exporting a handler and `config.event` (a string or array). Medusa emits events for core commerce flows (the canonical example is `order.placed`), and events are handled by an Event Module — the **Local** event module by default, with a **Redis** event module recommended in production. If the action is integral to the main flow, use a **workflow hook** instead of a subscriber.
Source: [Events and subscribers](https://docs.medusajs.com/learn/fundamentals/events-and-subscribers).

**Verified — notifications.** The Notification Module sends notifications through providers, with native support for email (SendGrid, Resend), Mailchimp, Slack, and Twilio SMS; the default local provider only logs. Only one provider per channel can be configured.
Source: [Notification module](https://docs.medusajs.com/resources/infrastructure-modules/notification).

**Repository state [verified].** `src/jobs/expire-transfer-holds.ts` runs every 60 seconds; there are no subscribers beyond the starter README; `REDIS_URL` is present in env but no Redis event module is registered (the build reports a fake Redis instance). This means the current event delivery is the **Local** event module — acceptable for development, not for production event durability.

**Implication.** Expiring holds, webhook side-effect processing, and booking/payment/change notifications all have native attachment points. The production-readiness gap is enabling the **Redis event module** and a real Notification provider; those are configuration, not new architecture. The "integral vs ancillary" distinction matters: reservation confirmation is integral to checkout and belongs in a workflow hook; the confirmation email is ancillary and belongs in a subscriber.

**Confidence:** high, with the Redis production recommendation being explicitly documented.

---

### 10. What Medusa does **not** give us (and is therefore ours)

These are the gaps. Each is stated with the reason it is a gap and the recommendation.

**10.1 Availability and time-windowed capacity holds — PARTLY NATIVE, and officially templated.**
*(Corrected: an earlier draft said "NOT native" and advised against using inventory. That was wrong — see below.)*

Medusa's Inventory Module is a **quantity-at-a-location** model: `InventoryLevel` and `ReservationItem` carry no start time, end time, or expiry field. That part of the earlier finding stands. [verified]

What the earlier draft missed: **the official Ticket Booking System recipe solves exactly this problem using inventory items as per-window capacity buckets.** It creates one inventory item per show date and seating section, with the available quantity set to the seats in that section for that date, explicitly to prevent overbooking. The time dimension lives in *our* item identity, not in the Inventory Module. ([Ticket booking recipe](https://docs.medusajs.com/resources/recipes/ticket-booking))

So the correct split is:
- **Capacity per window → use inventory.** One inventory item per (service window × vehicle variant), then reserve against it. This is the supported, documented pattern, and it gives us overselling protection through the engine rather than beside it.
- **TTL hold (reserve now, auto-release if unpaid) → ours.** There is no native primitive for a temporary hold with expiry. Release is a scheduled job, and concurrency is serialized with the Locking Module. The community plugin `RSC-Labs/medusa-booking-system` covers this gap with `reservation_ttl_seconds` and a `/hold` endpoint and is worth reading as a reference design.

**Recommendation (corrected):** keep the existing `reservation_hold` model with `quote_id`, `cart_id`, `status`, and `expires_at` for the **TTL hold**, and evaluate migrating **per-window capacity** onto inventory items created per window rather than maintaining a separate capacity policy plus blackout calendar. Expiry stays on the 60-second job.

**10.2 Address geocoding — NOT native.**
Medusa has no geocoder, autocomplete, or map component. Coordinates, place IDs, and formatted addresses must come from an external provider and be persisted by us. [verified by absence; the Tax/Product/Cart modules contain no geocoding surface]
**Recommendation (ours + external):** store `formatted_address`, `place_id`, `latitude`, `longitude`, and raw customer instructions separately (PRD Story 1 already requires this), and convert coordinates to H3 cells at our configured resolution. Geocoder failure/ambiguity is a first-class state, not an exception.

**10.3 Zone / polygon modeling — NOT native.**
No geometry type, no polygon model, no spatial queries. This is entirely the Transport Module's domain. [verified by absence]
**Recommendation (ours):** zones are clusters of H3 cells with a unique active ownership constraint. The polygon is an **authoring input** (drawn in the admin), converted to cells, and the cells are the commercial source of truth. See Part B.

**10.4 Transport reservations as a booking concept — no native aggregate, but officially templated.**
*(Corrected: an earlier draft read as if Medusa had nothing to offer here. It has no native aggregate, but it does ship two official patterns to copy.)*

Medusa's word "reservation" means an Inventory reservation (stock), not a booking. There is no native booking aggregate with a lifecycle like `pending_payment → confirmed → change_pending → ...`. [verified]

However, this is **not** unexplored territory in the framework:
- The official **[Ticket Booking System recipe](https://docs.medusajs.com/resources/recipes/ticket-booking)** builds exactly this shape: a custom module whose models link to `Product`, `ProductVariant`, and `Order`, with capacity per window (inventory items, §10.1) and availability enforced through `validate` hooks on `addToCartWorkflow` and `completeCartWorkflow`.
- The official **[Product Rentals tutorial](https://docs.medusajs.com/resources/how-to-tutorials/tutorials/product-rentals)** adds the rental-period validation points and order-cancellation guards.
- See `docs/research/03-medusa-booking-and-rental-patterns.md` §1 and §6 for the full mapping.

**Recommendation (ours, following the official shape):** `transport_reservation` stays custom and linked to the order, but it should be modelled to match the recipe's structure rather than invented independently. Financial truth stays in Medusa (order edits own the delta mechanics); trip truth stays in Transport. The commerce half of our reservation model is largely deletable in favour of links and native order versioning.

**10.5 Fiscal invoicing — NOT native.**
See §3. Medusa produces tax lines and receipts, not a legally valid e-CF.
**Recommendation (ours + certified external):** integrate a DGII-certified electronic invoicing provider (or build to the certified e-CF specification) and persist the external invoice reference against the order/reservation. Never present a Medusa order confirmation as a fiscal invoice.

**10.6 Implicitly out of scope for Medusa and confirmed as ours:** driver assignment, dispatch, trip execution, live tracking — the PRD already lists these as non-goals; nothing in Medusa addresses them and nothing should be added to the commerce modules for them.

---

## Part B — Zone-modeling technology

### 11. Uber H3

**What it is [verified].** H3 is a hierarchical geospatial index. Every cell has seven children (aperture 7). There are 16 resolutions (0–15). Cell counts follow `c(r) = 2 + 120·7^r`; there are always 12 pentagons per resolution. Hierarchical operations (`h3ToParent`, `h3ToChildren`, `compactCells`) are cheap bitwise operations, and numerically close indexes tend to be geographically close.
Sources: [H3 indexing](https://h3geo.org/docs/highlights/indexing), [H3 cell statistics](https://h3geo.org/docs/core-library/restable).

**What it is good at [verified].** Point indexing, neighbor traversal, hierarchical aggregation, compacting contiguous sets, and fast logical containment within a resolution. H3 is an exact **logical** index even though truncating to a parent is geographically approximate.

**Polygon → cells [verified].** `polygonToCells(polygon, res)` returns the cells **contained** in the polygon, where **containment is determined by cell centroids**, so a partitioning of polygons yields a partitioning of cells. `polygonToCellsExperimental` adds explicit containment modes: center, full, overlapping, and bounding-box overlap.
Source: [H3 region functions](https://h3geo.org/docs/api/regions).

**Coverage / containment tradeoffs [verified + inference].**

- **Centroid containment** means a cell whose center sits just outside the boundary is excluded even when it physically overlaps the drawn area. For hotel and resort polygons drawn by hand, this produces a boundary that is quantized to whole cells and can differ from the drawn line by up to roughly one cell radius.
- Two adjacent polygons converted independently can claim the same boundary cell (the centroid rule makes each set deterministic, but does not make disjoint polygon sets disjoint in their cell sets). This is why the platform's "one active zone per cell" invariant must be enforced in our data layer, not assumed from H3. The repository already has `assertUniqueCells` and a uniqueness constraint for this reason.
- **`polygonToCells` is fully contained vs `polygonToCellsExperimental` overlap mode:** overlap mode inflates the zone (includes cells that only partly touch), full mode deflates it. For commercial zones, **center (default)** is the sane default, with manual add/remove of boundary cells as the correction mechanism the PRD already requires.
- H3 does not model arbitrary polygons at query time. The polygon exists only at authoring time; the cells are the runtime truth.

**Resolution choice for Punta Cana [inference from verified H3 statistics].**
The relevant H3 published figures:

| Resolution | Avg hex area | Avg edge length |
|---|---|---|
| 8 | 0.737 km² (~737,328 m²) | ~531 m |
| 9 | 0.105 km² (~105,333 m²) | ~201 m |
| 10 | 0.0150 km² (~15,048 m²) | ~76 m |

Source: [H3 cell statistics](https://h3geo.org/docs/core-library/restable).

Practical reading for a Punta Cana / Bávaro / Cap Cana service area:

- **Resolution 9** (the project default via `TRANSPORT_H3_RESOLUTION`) gives ~200 m cells. A large resort property can span several cells, and distinct nearby properties can land in the same cell — which means two commercially different addresses may resolve to one zone. That is often acceptable for **resort-corridor zone pricing**, because zones aggregate many properties anyway.
- **Resolution 10** (~76 m) separates individual properties more cleanly but multiplies the cell count by ~7× and makes boundary editing and zone maintenance heavier.
- The resolution must be chosen from **real fixtures** across PUJ, Punta Cana, Bávaro, and Cap Cana, exactly as the PRD's Story 3 and Phase 0 require. This research supports the *range* (9–10); it does not substitute for that fixture test.

**Confidence:** high on H3 mechanics and the published area/edge figures; the zone-granularity judgment for specific Punta Cana properties is an inference pending fixtures.

---

### 12. Is PostGIS necessary? A direct answer

**Short answer: No.** H3 cells stored in ordinary indexed PostgreSQL columns are sufficient and preferable for this product. PostGIS would add operational and migration surface without changing any MVP capability.

**Can H3 alone answer "which zone is this coordinate in?" — Yes [inference].**
The runtime question is entirely answerable with one equality lookup:

1. `cell = latLngToCell(lat, lng, resolution)` — computed in the application with `h3-js` (already a dependency), no database extension.
2. `SELECT zone_id FROM transport_zone_cell WHERE cell = $1 AND active ...` — served by a B-tree/unique index.

That is an equality probe on an indexed column, independent of the number of zones: cost grows with `log(cells)`, not with polygon complexity or zone count. It cannot be beaten in practice by a polygon test, and it is the query the repository's `findActiveZoneForLocation` already implements.

**Comparison**

| Dimension | (a) H3 cells in indexed columns | (b) PostGIS geometry + containment |
|---|---|---|
| Point-in-zone lookup | Equality on indexed `cell` string. Cheap, constant-shape query. | `ST_Contains(polygon, point)`; GiST spatial index does a bounding-box pass then exact GEOS test. Fast, but heavier per row and depends on an extension. [verified: PostGIS indexing](https://postgis.net/workshops/postgis-intro/indexing.html), [ST_Contains](https://postgis.net/docs/ST_Contains.html) |
| Polygon editing | Edit the drawn polygon in the admin, recompute cells, diff the cell set. Polygon is authoring-only. | Polygon is the source of truth; edits are native, but point lookups still pay a topology test. |
| Boundary-cell editing | First-class: insert/delete a cell row; enforced by a unique active-owner constraint. Matches PRD Story 3 ("individual boundary cells can be added or removed"). | Polygons are edited, not cells; "adjust one boundary cell" is not a natural operation. |
| Query simplicity | One indexed equality; no spatial SQL in the hot path. | Spatial SQL, SRID discipline, geometry validity handling. |
| Exactness | Zone boundary = cell-quantized (up to ~one cell radius off the drawn line). Deterministic and reproducible. | Exact geometric containment. |
| Operational cost | None beyond stock PostgreSQL; no extension, no native build dependency; `h3-js` already installed. | Requires the PostGIS extension and a PostgreSQL build/plan that supports it; MikroORM/Medusa module migrations do not model `geometry` columns natively, so migrations would need raw SQL and careful maintenance. [inference, grounded in PostGIS being a server extension and Medusa using MikroORM] |
| Distance / buffer / nearest-neighbor | Not supported (H3 has grid distance and neighbors, not metric distance). | Native (`ST_Distance`, `ST_DWithin`, `ST_Buffer`) — but with the `geography` caveat below. |
| Best fit | Commercial zones quantized to a fixed grid; high-volume point lookups. | Exact legal/administrative boundaries and cross-dataset spatial joins. |

**Where PostGIS is genuinely stronger [verified].** Exact polygon containment, geometry validation tooling, and distance/buffer/nearest operations. PostGIS explicitly warns about operational subtleties: `ST_Contains` requires valid geometry and silently uses spatial indexes only if present; `geometry` is Cartesian and distance/area results are meaningless for lat/lon unless a projection is used, while the `geography` type is spheroidal but supports fewer functions and is slower.
Sources: [ST_Contains](https://postgis.net/docs/ST_Contains.html), [PostGIS spatial indexing](https://postgis.net/workshops/postgis-intro/indexing.html), [PostGIS data management — geography](https://postgis.net/docs/using_postgis_dbmanagement.html).

**Why (a) wins for this product [inference].** The domain deliberately quantizes zones to a commercial grid (the PRD's non-goals explicitly reject "an exact polygon system"). Every requirement that matters — deterministic point lookup, unique cell ownership, boundary-cell add/remove, cheap high-volume quoting — is satisfied by (a). PostGIS would introduce a second source of truth (polygons) and a heavier persistence layer to answer a question H3 already answers, while fighting Medusa's migration model.

**What we must still enforce ourselves (in both options):** the single-active-owner invariant, zone versioning, and the snapshot of the zone/pricing versions on each quote. These are data-model concerns, not spatial-engine concerns.

---

### 13. Recommendation

**Do not add PostGIS for the MVP.** Store H3 cell indices in ordinary indexed PostgreSQL columns and treat the drawn polygon as an authoring input only:

- Runtime lookup: `latLngToCell` (in `h3-js`) → indexed equality lookup on `transport_zone_cell.cell` → zone.
- Authoring: draw polygon in the admin → `polygonToCells` at the configured resolution → preview → persist cells; allow manual add/remove of boundary cells.
- Integrity: unique constraint for "one active cell → one active zone", plus zone versioning and quote snapshots (all already represented in the Transport Module's direction).

**Conditions that would change the answer** (each is a concrete trigger, not a hypothetical):

1. **A legal/regulatory requirement** that the commercial boundary exactly match an official polygon (e.g. a municipal or airport authority boundary), rather than a commercial grid.
2. **Sub-cell precision requirements** that cannot be met at the finest resolution we are willing to pay for — i.e. two addresses that must price differently keep collapsing into one cell at resolution 10, and neither boundary-cell editing nor a finer resolution fixes it.
3. **A new product requirement for metric distance, buffers, or nearest-neighbor** (e.g. ETA-by-distance, "within 5 km of the airport"), which H3 does not provide.
4. **Spatial joins across external datasets** (e.g. matching third-party geospatial data to zones) where importing polygons is materially cheaper than re-deriving cells.

If any of these becomes true, add PostGIS as a **derived, authoring-side layer only**: store polygons in PostGIS to generate and validate cells, but keep the runtime zone lookup in H3. That preserves the fast, simple hot path and avoids making geometry part of the checkout path.

**Confidence:** high for the MVP recommendation; medium for the trigger conditions (they are inferred from the product's stated non-goals and the H3/PostGIS capability sets).

---

## Stop rebuilding what exists

These are things Medusa already provides, where building our own would duplicate a working, tested surface:

1. **Product, variant, option, image, and price administration.** The catalog and its admin UI are complete. A vehicle type is a product + variant; capacity/luggage/restrictions attach via a linked model or metadata. Do not build a vehicle catalog.
2. **Price sets, price lists, multi-currency storage, and the price-calculation engine.** Model directed zone fares as price rules. Do **not** build a fare-matrix lookup table as the primary path; wrap `calculatePrices` with our stricter exact-match validation instead.
3. **Promotions, coupons, campaigns, and budgets.** Reuse the Promotion Module for eligible discounts and extras bundles.
4. **Tax calculation and tax lines.** Configure ITBIS (18% general rate) as a tax rate. Do **not** build a tax calculator.
5. **Cart, checkout, and order creation.** Use carts → completion → orders. Do not build a parallel order store for the commerce side.
6. **Order edits, versioning, and financial summaries.** Use order edits for paid reservation changes and read `pending_difference` / `paid_total` / `refunded_total` rather than recomputing deltas. Medusa already enforces "one pending edit at a time", matching our product rule.
7. **Payment collections, authorization, capture, and refunds.** Use the Payment Module and its providers; use additional payment collections for positive post-edit differences.
8. **The payment webhook listener and its cart-locking flow.** Use `/hooks/payment/{identifier}_{provider}` and `processPaymentWorkflow`. Do not write a competing webhook dispatcher.
9. **The admin dashboard shell and its extension points.** Widgets, UI routes, and custom API routes are the supported way to add zone editors and reservation consoles. Do not build a separate back-office app.
10. **Scheduled job and event/subscriber infrastructure.** Cron jobs and pub/sub event handling are native. Do not stand up an external cron or message broker to run hold expiry or notifications.
11. **The Notification Module.** Transactional email/SMS belongs here, with a real provider (SendGrid/Resend/Twilio) and the Redis event module for production. Do not write a bespoke mailer.
12. **The Next.js storefront starter.** Its cart, region, and checkout plumbing should be reused, not rewritten; only transfer-specific flows are new.

The genuinely new surfaces are: **availability/capacity holds, geocoding integration, H3 zone modeling, transport reservations and changes, and fiscal-invoice integration** — exactly the five gaps in §10.

---

## Confidence and gaps

### High-confidence, verified facts
- Full mechanism of product extension, module links, admin widgets/routes/API routes, scheduled jobs, subscribers, the Notification Module. (Multiple primary docs.)
- The exact `calculatePrices` partial-match algorithm and the absence of a uniqueness guarantee in the documented contract.
- Order edits require confirmation, increment order version, and expose `pending_difference`; one pending edit at a time.
- Payment webhooks are handled by a native route and `processPaymentWorkflow` with cart locking; no documented general webhook dedupe store.
- H3 resolution statistics and `polygonToCells` centroid containment; `polygonToCellsExperimental` containment modes.
- PostGIS spatial indexing behavior and `ST_Contains` index usage.
- ITBIS general rate 18% and the mandatory-e-CF regime (Ley 32-23, Norma General 06-2018, 15 Nov 2026 deadline for small/micro/unclassified).

### Medium-confidence (inference)
- That `calculatePrices` exposes no match-quality flag in 2.20.1 — inferred from the documented return shape, not an explicit statement.
- That Medusa provides no general webhook idempotency-key mechanism — inferred from absence in the payment/webhook docs, not an explicit denial.
- That Medusa's MikroORM migrations do not natively model PostGIS `geometry` columns — inferred from PostGIS being a server extension and Medusa's migration tooling; test if this ever matters.
- The zone-granularity judgment (resolution 9 vs 10) for specific Punta Cana properties — inferred, pending the PRD's real-address fixtures.
- That Medusa does not deduplicate `processPaymentWorkflow` runs per event id — lock-based concurrency is documented, event-level dedupe is not.

### Assumptions requiring validation
- The exact Dominican tax treatment of ground-transfer services (rate, withholding, exemptions) — a business/accountant decision, not a Medusa or model decision.
- ~~That capacity/time-windowed holds cannot be cleanly expressed with the Inventory Module~~ — **RESOLVED 2026-09-19: this assumption was FALSE.** The official Ticket Booking recipe expresses capacity per window by creating one inventory item per window (per show date and section). See §10.1. Only the TTL hold remains custom. The earlier advice "do not model capacity holds as inventory" is retracted.
- That the current Local event module is acceptable during development only — true for durability; confirm the production infrastructure decision separately.

### Open gaps for version 2.20.1 specifically
- `allowFields` is documented as v2.21.0+ and is therefore unavailable at 2.20.1. Any Store API exposure of linked custom fields needs a hand-written allowed-fields middleware.
- Widget `id` and Layout Configurations are documented from v2.17.2 onward; verify the exact zone list for the product and order detail pages in 2.20.1 before designing widgets around specific zones.
- `ScheduledJobContext.scheduledFor` is documented from v2.17.0; available at 2.20.1, but the job signature change should be validated in a test.
- The complete list of emitted events should be read from the 2.20.1 events reference before wiring subscribers, rather than from general documentation pages.

---

## Source index

Medusa:
- https://docs.medusajs.com/resources/commerce-modules/product/extend
- https://docs.medusajs.com/resources/commerce-modules/pricing
- https://docs.medusajs.com/resources/commerce-modules/pricing/price-calculation
- https://docs.medusajs.com/resources/commerce-modules/pricing/price-rules/index.html.md
- https://docs.medusajs.com/resources/references/pricing/calculatePrices/index.html.md
- https://docs.medusajs.com/resources/commerce-modules/promotion
- https://docs.medusajs.com/resources/commerce-modules/tax
- https://docs.medusajs.com/resources/commerce-modules/order
- https://docs.medusajs.com/resources/commerce-modules/order/edit
- https://docs.medusajs.com/user-guide/orders/edit
- https://docs.medusajs.com/api/admin/order-edits/add-shipping-method.md
- https://docs.medusajs.com/resources/commerce-modules/payment
- https://docs.medusajs.com/resources/commerce-modules/payment/webhook-events
- https://docs.medusajs.com/resources/references/medusa-workflows/processPaymentWorkflow
- https://docs.medusajs.com/resources/examples/guides/custom-item-price
- https://docs.medusajs.com/learn/fundamentals/admin/widgets
- https://docs.medusajs.com/learn/fundamentals/admin/ui-routes
- https://docs.medusajs.com/learn/fundamentals/api-routes
- https://docs.medusajs.com/learn/fundamentals/module-links
- https://docs.medusajs.com/learn/fundamentals/scheduled-jobs
- https://docs.medusajs.com/learn/fundamentals/events-and-subscribers
- https://docs.medusajs.com/resources/infrastructure-modules/notification
- https://docs.medusajs.com/resources/nextjs-starter

H3:
- https://h3geo.org/docs/highlights/indexing
- https://h3geo.org/docs/api/regions
- https://h3geo.org/docs/core-library/restable

PostGIS:
- https://postgis.net/docs/ST_Contains.html
- https://postgis.net/workshops/postgis-intro/indexing.html
- https://postgis.net/docs/using_postgis_dbmanagement.html

Dominican fiscal:
- https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/principalesImpuestos/Paginas/Itbis.aspx
- https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/default.aspx
- https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Preguntas%20frecuentes/Generales/Preguntas%20Frecuentes%20e-CF%20Generales.pdf
