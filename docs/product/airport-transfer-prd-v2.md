# Product Requirements Document — Single-Provider Airport Transfer Platform (v2)

**Status:** Draft for product-owner review
**Date:** 2026-09-19
**Supersedes for new work:** `docs/product/airport-transfer-prd.md` (v1, retained for comparison)
**Platform:** MedusaJS 2.20.1 (`apps/backend`), single-provider, native-first
**Evidence base:** `docs/research/01-*`, `docs/research/02-*`, `docs/research/03-*`, `odd/decisions.md`, `odd/index.md`

> This document takes positions. Where v1 listed everything as equally required, v2 states what is MVP, what is deliberately not built, and what is deferred. Every factual claim is grounded in the research documents or the repository. Opinions are labelled **Recommendation**. The research's "could not verify" list is respected and is not upgraded into fact.

---

## 1. Executive Summary

**Problem.** A single airport-transfer operator needs to quote and sell scheduled ground transportation from an address to an address, priced by zone pair, vehicle class, and direction, then reserve capacity and take payment. Generic commerce platforms supply catalog, pricing, promotions, tax, cart, payment, and orders, but no zone model, no transport reservation, and no capacity hold.

**Solution.** Build the operator's own booking channel on MedusaJS, reusing Medusa natively for everything commerce and adding only a thin transport domain on top: H3 zones, directed zone-pair fares on the native Pricing Module, a TTL capacity hold, and a thin reservation linked to the order. This follows Medusa's official Ticket Booking recipe shape (custom module linked to Product, ProductVariant, and Order, with per-window capacity expressed as inventory items).

**What "done" means for the MVP.** A traveler can enter a supported address pair, see an all-in fixed price for a vehicle that fits their party, pay, and receive an operational confirmation. An operator can open Medusa Admin, resolve a zone, edit a directed fare, see the reservation and its hold, and cancel inside policy. Driver assignment, dispatch, and live tracking are explicitly out of the MVP.

**Recommendation.** Keep the MVP stop-line at *confirmed, paid, operational reservation*. Cut the v1 paid-reservation edit lifecycle from MVP. Every story below ends in a screen a human can open in Medusa Admin or the storefront.

### 1.1 Corrections to the previous PRD

| v1 position | Correction | Evidence |
|---|---|---|
| Extras generic; capacity checked loosely | Extras are booking inputs validated against vehicle capacity. Child seats by age/weight, meet-and-greet, extra stops; a child seat plus passengers must not exceed capacity. | research 01 §6.2, §3 |
| `luggage_count` alone | Luggage needs size semantics: trunk items are luggage, oversized items count as two pieces. A bare count misquotes families with strollers. | research 01 §6.3 |
| Automated flight monitoring is a non-goal (flight data capture implied only) | Flight-number capture is a launch requirement, plus a **published free-waiting/delay policy**. Monitoring automation is deferred, not the policy. | research 01 §6.5 |
| Prepay assumed | Prepay is the market norm and the recommendation, but pay-on-arrival is a real competitor option in this market. This is an open decision (§11), not a silent assumption. | research 01 §4, §6.8 |
| "Refund or credit according to configured policy" | Refund **form** and cancellation **window** are product decisions: a one-year credit voucher is the aggregator default; cash refund is a deliberate competitive choice. Surface, do not configure away. | research 01 §6.7 |
| Stories 7–8 (versioned paid-reservation edit lifecycle) | Reduced to a thin requote + native order edit, and **deferred from MVP**. Even Mozio does not run a formal proposal/accept/collect/refund lifecycle. | research 01 §5, §6.6; research 03 §6.2 |
| H3-only, PostGIS explicitly excluded | Superseded: H3 **and** PostGIS together. Cells stay authoritative for pricing; PostGIS is authoring/validation/metric only. | decisions 2026-09-19 |
| Fiscal invoicing a launch dependency | Deferred. Medusa's order is not a fiscal invoice. | decisions 2026-09-19 |

---

## 2. Scope: In / Out

### In (MVP)

- Address → H3 cell → zone resolution for supported areas.
- Directed, flat, all-in zone-pair fares per vehicle variant, in the transaction currency.
- Vehicle selection filtered by passenger and luggage capacity to a single fitting vehicle.
- Time-windowed capacity using one inventory item per window (official pattern).
- A TTL capacity hold that auto-releases when checkout is abandoned or unpaid.
- Checkout, payment, order, and a thin confirmed reservation linked to the order.
- Round trip as two independently priced legs in one checkout.
- An operational confirmation carrying pickup instructions, meeting point, waiting policy, and support contact.
- Cancellation inside a configurable window, with the refund form decided by policy.
- Admin surfaces: zone authoring/publish, directed fare authoring, reservation and hold console.

### Out (explicit non-goals)

See §9. In one line: no marketplace mechanics, no distance-based pricing, no runtime exact-boundary matching, no fiscal invoicing, no dispatch/driver assignment, no live tracking, no versioned paid-edit lifecycle in MVP.

---

## 3. Personas

- **Traveler.** Books and pays for an airport, hotel, or address transfer. Cares about a price shown before payment, a vehicle that fits the party, and a confirmation usable on the day.
- **Booking agent.** Creates or changes a reservation on a customer's behalf and needs the same quote and confirmation path.
- **Operations administrator.** Authors zones and directed fares, watches capacity, handles a reservation day-of.
- **Finance administrator.** Reviews payments, refunds, and reconciliation between reservation and order.

v2 drops the v1 "supplier-facing" abstraction: there is no second supplier, so there is no supplier persona (research 01 §5).

---

## 4. Domain Model

The model is deliberately thin where Medusa is already the truth. **Order is commerce truth; Transport is trip truth; native order edits are change/refund truth** (research 03 §7).

| Domain concept | Owned by | Shape |
|---|---|---|
| Vehicle class (sellable) | Medusa Product + Variant | Product and variant carry catalog, images, prices, status. Capacity/luggage/restrictions are a linked `VehicleProfile` with real indexed columns, or metadata for non-queried data. |
| Zone | Transport (custom) | `transport_zone` + `transport_zone_cell` (H3). Polygon stored on the zone as the authoring record. |
| Fare | Medusa Pricing | Price on the vehicle variant's price set, rule-keyed by directed zone pair and currency. Transport snapshots the chosen price id. Never a fare-matrix entity. |
| Quote | Transport (custom, thin) | Immutable snapshot: quote id/version, expiry, currency, totals, zone versions, fare price id, input hash. The price itself comes from native pricing. |
| Capacity window | Medusa Inventory | One inventory item per (service window × vehicle variant); quantity = sellable capacity for that window (official Ticket Booking pattern). |
| Hold | Transport (custom) | TTL record only: `quote_id`, `cart_id`, `status`, `expires_at`, `reservation_id`. Expiry by scheduled job; concurrency by the Locking Module. |
| Reservation | Transport (custom, thin) | Trip facts only + quote snapshot + `confirmed_at` + status; linked to `Order` and to the priced `ProductVariant`. |
| Change (deferred) | Native Order Edit + thin requote | Native order edit owns confirmation, version bump, `pending_difference`, collection/refund. Transport keeps only previous/requested quote snapshots and the trip delta. |
| Provider event | Transport (custom, thin) | `provider_event_id` **unique**, not merely indexed. Dedupe ledger for our own webhook side effects. |
| Audit event | Transport (custom, thin) | Only transport-domain corrections with no native counterpart (zone, fare, reservation status). Do not mirror the order timeline. |

**Relationship to Medusa entities.** Links, never foreign keys: `transport_reservation ↔ order` already exists. Add `transport_reservation ↔ product_variant` and `VehicleProfile ↔ product/variant` via `defineLink`. Delete the loose `order_id` / `cart_id` / `line_item_id` / `order_snapshot` duplication in favour of links and native order versioning (research 03 §6.1).

**Current-repo gap to close.** Zones and quote snapshots are currently held in in-memory `Map`s; only `adminCorrectZone` writes to the database, and fixture zones are reseeded on each quote call (`odd/index.md` known gotchas). Persistence is a Phase 1 blocker, not an optional refinement.

---

## 5. Pricing Strategy

**Model.** Flat, all-in, directed zone-pair prices. The pricing context is `origin_zone_id`, `destination_zone_id`, `vehicle_variant_id`, `currency_code`. Reverse direction is an explicit, separately stored price; an admin may copy a fare to the reverse direction, but the system keeps both directed rules. This matches how this market actually prices and is already the v1 core (research 01 §4; decisions 2026-09-16).

**Native mechanism.** Fares live on the native Pricing Module, not in a bespoke table.
- The vehicle variant selects the price set; the directed origin/destination zone pair selects the price within it; currency is the pricing currency.
- Price lists provide scheduled overrides and promotional pricing.
- Customs rule attributes carry the transport context; currency codes stay lowercase and amounts are stored as-is.

**Exactness guard (non-negotiable).** `calculatePrices` supports partial matches and silently returns one "most relevant" price; it exposes no exact-vs-partial discriminant. The workflow therefore:
1. builds a fully populated context,
2. counts persisted matching rules and **rejects zero matches or more than one match**,
3. calls `calculatePrices` for the authoritative amount,
4. snapshots the selected `price.id`, the context, and the zone versions on the quote.

This is our rule, stricter than the platform's, and it cannot be delegated (research 02 §2; decisions 2026-09-16).

**Evidence.** Phase 0 passed all 9 required assertions, including independent directed prices, vehicle-specific prices, currency-specific prices with no cross-currency fallback, deterministic ambiguity rejection, and real-variant cart integration. Internal calculation measured p95 7–19 ms against the 250 ms target (decisions 2026-09-16). No fare-matrix fallback is required.

**Not distance-metered.** Distance is not a pricing input. PostGIS metric distance exists for authoring and eligibility, never for a fare (decisions 2026-09-19).

**All-in.** The price the traveler sees is fixed before payment and inclusive of configured tax and fees. Tax is a configured Medusa rate (research 01 §4, §2; research 02 §3).

---

## 6. Zone Strategy

**Division of labour (binding).**

| Layer | Owns | Must never do |
|---|---|---|
| H3 cells in ordinary indexed columns | Runtime "which zone is this coordinate in?", pricing context, quote snapshots, boundary-cell add/remove | Metric distance, exact containment, geometry validation |
| PostGIS polygons | Authoring the drawn polygon, `ST_IsValid`/`ST_MakeValid`, overlap detection between zones, metric distance/buffer/nearest, exact areas, importing GeoJSON/shapefiles | Answering a pricing or quote question at runtime |

**The non-negotiable rule:** cells stay authoritative for pricing. PostGIS must never answer a pricing question at runtime, or the same address could produce two answers (decisions 2026-09-19).

**Runtime lookup.** `latLngToCell` (`h3-js`, already a dependency) → one indexed equality lookup on `transport_zone_cell.cell` → zone. Constant-shape query, independent of polygon complexity.

**Authoring.** Draw polygon → validate and detect overlaps in PostGIS → `polygonToCells` at the configured resolution → preview → persist cells → **explicit publish step**. Polygon edits regenerate cells; zone versioning matters more under this model, not less. Store the polygon from day one so any future re-derivation is a backfill, not a re-draw.

**Resolution.** Default 9 (`TRANSPORT_H3_RESOLUTION`). Research supports the **9–10 range**: resolution 9 gives ~200 m cells (a large resort can span several cells); resolution 10 (~76 m) separates properties more cleanly at ~7× the cell count and heavier maintenance. The resolution is chosen from **real fixtures** across PUJ, Punta Cana, Bávaro, and Cap Cana, as v1 Story 3 and Phase 0 already require. This document supports the range; it does not substitute for that fixture test (research 02 §11).

**Integrity.** One active cell → one active zone, enforced by a unique constraint (`assertUniqueCells` already exists). `polygonToCells` centroid containment means independently drawn adjacent polygons can both claim a boundary cell; the data-layer invariant is what prevents that, not H3.

---

## 7. Native vs Build

The v1 document implied far more custom work than is required. This is what we get free and what we actually build.

| Capability | Native / Build | Detail |
|---|---|---|
| Product/variant catalog, options, images, admin CRUD | **Native** | Vehicle type = product + variant. Do not build a catalog. |
| Queryable vehicle capacity/luggage/restrictions | **Build (thin)** | Linked `VehicleProfile` model with indexed columns; metadata only for non-queried copy. |
| Price sets, price lists, multi-currency, custom rules | **Native** | Fares are rules. Wrap with our exact-match guard. |
| Promotions, coupons, campaigns | **Native** | Reuse; do not build a coupon engine. |
| Tax regions, rates, tax lines | **Native** | Configure the rate; calculation only. |
| Cart, checkout, order creation | **Native** | Reuse carts → completion → orders. |
| Order edits, versioning, `pending_difference`, refunds | **Native** | `paid_total`, `refunded_total`, `pending_difference`; one pending edit at a time. |
| Payment collections, authorize/capture/refund, webhook route | **Native** | Reuse `/hooks/payment/...` and `processPaymentWorkflow`. Event-level dedupe is ours. |
| Capacity per time window | **Native (composed)** | One inventory item per window — the official Ticket Booking pattern. |
| TTL hold (reserve now, auto-release) | **Build (thin)** | No native primitive. Keep `reservation_hold`; expire via the 60 s scheduled job. |
| Admin shell, widgets, UI routes, custom API routes | **Native** | Zone editor and reservation console are UI routes/widgets. Do not build a separate SPA. |
| Scheduled jobs, events/subscribers, notifications | **Native** | Notification Module for email/SMS; Redis event module is a production config step. |
| Module links across isolated modules | **Native** | `defineLink`; add reservation ↔ variant and vehicle ↔ variant. |
| Storefront | **Partial** | Medusa ships a Next.js starter, not a solution. This repo has **no storefront**; it is real work. |
| Geocoding/autocomplete | **Build + external** | Store formatted address, place id, coordinates separately. |
| H3 zone modeling + PostGIS authoring | **Build** | The zone module is ours. |
| Transport reservation | **Build (thin, templated)** | No native aggregate; copy the Ticket Booking recipe shape. |
| Fiscal invoice (e-CF) | **Build + external (deferred)** | Medusa's order is not a fiscal invoice. |

**Native code to delete when touched.** The reservation-change financial engine (`delta_amount`, `payment_link_status`, `refund_status`, `change_request_id`, confirmation/version mechanics) duplicates native order edits. The `provider_event_id` `.index()` should become `.unique()` — the single highest-value data-model fix surfaced by research 03 §6.4.

**Version caveat.** `allowFields` is v2.21.0+ and unavailable at 2.20.1. Exposing linked custom fields on Store routes needs a hand-written allowed-fields middleware (research 02 §6).

---

## 8. User Stories

Each story ends in something a human can open in Medusa Admin or the storefront, and is marked **MVP** or **deferred**.

### S1 — Quote a transfer  ·  MVP

As a traveler, I want to enter a pickup and drop-off and see an exact all-in price so I can decide whether to book.

- **Given** two supported addresses, **when** the traveler submits them, **then** each coordinate becomes an H3 cell, resolves to exactly one zone, and the system returns a quote with base fare, tax, total, currency, and an expiry.
- **Given** an unsupported or ambiguous address, **when** the traveler submits it, **then** no automatic price is produced and an actionable message is shown.
- **Given** an airport leg, **when** the traveler books, **then** flight number and airport code are captured, and the pickup time is based on the flight landing time.
- **Given** a quote, **when** trip details change before an order exists, **then** re-quoting is a normal quote refresh — no versioned proposal machinery.

*Openable in:* storefront quote page (to be added), with the quote snapshot visible on the resulting Admin order.

### S2 — Choose a fitting vehicle  ·  MVP

As a traveler, I want only vehicles that fit my party so I am not offered a vehicle I cannot use.

- **Given** passenger count and luggage (with oversized items counting as two pieces), **when** results are shown, **then** only vehicles fitting the whole party in a single vehicle are offered.
- **Given** a child seat added, **when** capacity is evaluated, **then** seat plus passengers must not exceed capacity.
- **Given** no vehicle fits, **when** results are shown, **then** a clear "party does not fit" outcome is shown rather than a partial match.

*Openable in:* storefront vehicle selection; the chosen product/variant line item is visible on the Admin order.

### S3 — Book, pay, and receive an operational confirmation  ·  MVP

As a traveler, I want to pay and get a confirmation I can actually use on the day.

- **Given** a valid quote and cart, **when** payment completes, **then** a Medusa order is created and a thin reservation is linked to it and to the priced variant.
- **Given** a completed order, **when** the reservation is created, **then** it is `confirmed` only when the order is fully paid for the accepted quote.
- **Given** a confirmed reservation, **when** the confirmation is sent, **then** it carries reservation number, itinerary, vehicle, payment summary, **pickup/meeting instructions, free-waiting policy, and a support contact**.
- **Given** a repeated provider webhook, **when** it is processed, **then** no duplicate order, capture, or reservation is created (`provider_event_id` unique).

*Openable in:* storefront checkout; the order and linked reservation in Medusa Admin.

### S4 — Define zones by drawing and publishing cells  ·  MVP

As an operations administrator, I want to draw a service area and publish its cells so any supported address can be priced.

- **Given** a drawn polygon, **when** saved, **then** PostGIS validates it and flags overlaps with existing zones.
- **Given** a valid polygon, **when** previewed, **then** the administrator sees the resulting H3 cells and may add or remove boundary cells.
- **Given** an approved preview, **when** published, **then** the cell set is persisted with a new zone version.
- **Given** an active cell, **when** another zone claims it, **then** the write is rejected — one active cell, one active zone.

*Openable in:* Medusa Admin transport UI route (zone editor).

### S5 — Author directed zone-pair fares  ·  MVP

As an operations administrator, I want to set a flat fare per zone pair and vehicle so each direction is quoted correctly.

- **Given** origin zone, destination zone, vehicle variant, and currency, **when** a fare is saved, **then** it is stored as a native price and a reverse direction is **not** implied.
- **Given** an administrator copies a fare to the reverse direction, **when** saved, **then** both directed rules are stored and auditable.
- **Given** equal-context, equal-priority rules, **when** saved or quoted, **then** the system rejects the ambiguity rather than picking one silently.
- **Given** a fare change, **when** saved, **then** accepted quote snapshots and historical orders are unchanged.

*Openable in:* Medusa Admin vehicle product prices plus the transport fare widget.

### S6 — Enforce time-windowed capacity  ·  MVP

As a traveler, I want to see only bookable vehicles so payment cannot create a knowingly unavailable reservation.

- **Given** a service window and vehicle variant, **when** capacity is configured, **then** an inventory item exists for that window with the sellable quantity.
- **Given** capacity is claimed, **when** a concurrent quote tries to claim the last unit, **then** the claim is serialized with the Locking Module and enforced at add-to-cart and at order placement (the official `validate` hook points).

*Openable in:* Medusa Admin inventory for the window items; reservations in the transport console.

### S7 — Hold capacity with a TTL while checkout is open  ·  MVP

As a traveler, I want my vehicle held while I pay so it is not sold to someone else mid-checkout.

- **Given** a quote added to a cart, **when** checkout starts, **then** a hold is created with an expiry.
- **Given** an unpaid or abandoned checkout, **when** the hold expires, **then** the 60 s scheduled job releases it and the capacity returns to the window.

*Openable in:* the hold is visible against the reservation in the Admin transport console.

### S8 — Book a round trip as two priced legs  ·  MVP

As a traveler, I want a round trip in one checkout so I pay once for both directions.

- **Given** a round-trip request, **when** quoted, **then** the return leg is auto-swapped (destination → origin) and priced independently.
- **Given** two legs, **when** the order is created, **then** both legs appear on one order and one reservation.

*Openable in:* storefront round-trip toggle; both legs on the Admin order.

### S9 — Cancel inside the policy window  ·  MVP

As a traveler, I want to cancel an eligible reservation so the applicable policy is enforced.

- **Given** a reservation inside the free-cancellation window, **when** the traveler cancels, **then** the refundable amount is shown before confirmation and the refund follows the configured form.
- **Given** the window has passed, **when** the traveler requests cancellation, **then** it is refused with the policy reason.
- **Given** a cancellation, **when** processed, **then** capacity is released and reason, actor, amount, and provider references are audited.
- **Given** a repeated cancellation request, **when** processed, **then** it is idempotent.

*Openable in:* storefront reservation management; refund and order state in Medusa Admin.

### S10 — Support a reservation from Admin  ·  MVP

As an operations administrator, I want to search and inspect reservations so I can support customers on the day.

- **Given** a reservation number, order number, customer, date, or flight number, **when** searched, **then** the matching reservations are listed.
- **Given** an open reservation, **when** inspected, **then** legs, addresses, H3 cells, zones, vehicle, passengers, luggage, extras, quote snapshot, payment state, and hold are shown.
- **Given** a manual adjustment, **when** applied, **then** it requires a reason and writes a transport audit event.

*Openable in:* Medusa Admin transport UI route (reservation console).

---

### Deferred Stories

### S11 — Modify a paid reservation and settle the difference  ·  **DEFERRED**

As a traveler, I want to change a paid booking and settle the price difference so my reservation reflects the new trip.

**Recommendation: do not build this in the MVP.** The market evidence is unambiguous: Mozio, an aggregator with far more change volume than a single operator, does not run a versioned "propose change / accept / collect difference / refund difference" lifecycle. It offers a self-service edit that may charge more and may re-enter a card, and otherwise recommends **cancel-and-rebook** (research 01 §5). v1 Stories 7–8 are justified by an internal-consistency ideal, not observed market behavior (research 01 §6.6).

**What we do instead in the MVP:**
- Before an order exists, changing trip details is just re-quoting the cart (S1) — no lifecycle.
- After an order exists, the operator uses **cancel-and-rebook**, or a single **modify-and-pay-difference** step if a concrete scenario requires it.

**Invariant to keep regardless.** The original confirmed reservation stays valid until any difference is paid. This is the one part of the v1 design worth preserving (research 01 §5).

**What would have to be true to justify building S11.** All of the following:
1. The business can name a concrete, recurring paid-booking change scenario that cancel-and-rebook cannot serve — for example a corporate/contract booking whose order reference and price must persist, or a partially paid/deposit booking where rebooking loses money or capacity.
2. It can show change volume high enough that manual handling is a real cost.
3. It accepts that native order edits (confirmation, version bump, `pending_difference`, collection/refund, one-pending-edit) do the financial work and only a thin requote record is custom.

If justified, implement it as: compute new fare → propose a native order edit on the line item → let Medusa drive confirmation, version, and the payment/refund delta (research 03 §6.2). Until then, it is explicitly deferred.

### S12 — Automated flight-status monitoring  ·  deferred

Capture flight numbers now; poll status later when volume justifies it. Deferred per research 01 §5 (the capture is MVP; the automation is not).

### S13 — Driver / vehicle assignment and live tracking  ·  deferred

No native support and no MVP user. The reservation model stays open to attaching a driver/vehicle later. In the MVP the confirmation is the only customer touchpoint, so it must carry strong pickup instructions and a staffed support contact (research 01 §5, §6.5).

### S14 — Fiscal invoice issuance (e-CF)  ·  deferred

Explicitly deferred by the product owner. Medusa's order, payment record, and tax lines are not a legally valid Dominican fiscal invoice, and nothing built now may be presented as one. Revisit before any production launch (decisions 2026-09-19; research 02 §3).

### S15 — Enhanced-cancellation cash-refund add-on  ·  deferred

A real margin lever, but it is a second cancellation policy to build and test. Start with the default window-and-voucher-or-refund policy (research 01 §5).

---

## 9. What We Deliberately Do NOT Build

| Not built | One-line reason |
|---|---|
| Supplier onboarding, licensing/insurance vetting, contracts | There is no second supplier, so there is no first-party user. |
| Commission, markup, revenue share, supplier payouts/statements | No partner to settle with; adds financial surface with no user. |
| Provider ranking, ratings, bidding, auctions | Meaningless with one provider. |
| White-label / API-as-a-product / per-channel credentials | The platform is the operator's own channel, not a tech product. |
| Distance-based or metered pricing | Practitioners explicitly reject distance for airport transfers; flat fares are the market promise. |
| Exact legal-boundary matching at runtime | Cells are the commercial boundary; exactness is not a product requirement and PostGIS is confined to authoring. |
| Fiscal invoicing (e-CF) in the MVP | Deferred by owner decision; Medusa's order is not a fiscal invoice. |
| Dispatch, driver assignment, live tracking | No native support, no MVP user; model left open to attach later. |
| Versioned paid-reservation edit lifecycle | Even Mozio does not do this; defer until a scenario demands it (§8 S11). |
| A bespoke fare-matrix entity | Native pricing passed Phase 0; the fallback would need its own proposal. |
| A bespoke `TransportVehicleClass` model | Deprecated; a vehicle type is a Medusa product + variant. |
| Bespoke coupon, tax, payment, webhook, or mailer engines | All native; rebuilding duplicates a working, tested surface. |
| Multi-modal inventory (trains, buses, ferries) | Outside an airport-transfer operator's fleet. |
| A 39-currency selector and broad localization | Support the currencies actually transacted (likely USD and DOP); one transaction currency per order is what matters. |
| Dynamic / surge pricing | Flat fares are the brand promise; surge contradicts it. |

---

## 10. Phased Roadmap

### Phase 0 — Native pricing validation · **DONE**

Directed zone-pair fares on the native Pricing Module were proven against 9 assertions with executable evidence; p95 7–19 ms (decisions 2026-09-16). No further Phase 0 pricing work is required.

### Phase 1 — Zone and fare foundation

- **Persist zones and quotes.** Currently in-memory `Map`s; only zone corrections reach the database. This is the first blocker.
- Add PostGIS (extension in every environment; hand-written raw-SQL migration for the polygon column) and the explicit polygon → cells publish step.
- Add the `VehicleProfile` link and migrate fare rules from `vehicle_class_id` to `vehicle_variant_id`.
- Choose the H3 resolution from real PUJ / Punta Cana / Bávaro / Cap Cana fixtures.
- Build the Admin zone editor (UI route) and the directed-fare authoring surface.
- Add the storefront from the DTC starter and the quote flow.
- Rename the `provider_event_id` index to `.unique()`.

### Phase 2 — Booking and payment

- Vehicle products/variants with capacity and luggage semantics.
- Capacity windows as one inventory item per window; Locking Module on the claim path.
- TTL hold wired to the existing 60 s expiry job.
- Checkout → order → thin reservation → operational confirmation voucher.
- Round trip as two legs; flight-number capture and the published free-waiting policy.
- Add the Redis event module and a real Notification provider.

### Phase 3 — Cancel and support

- Cancellation window and refund form as policy.
- Admin reservation console (search, inspect, manual correction with reason + audit).
- End-to-end acceptance testing.

### Phase 4 — Deferred / future

Revisit S11 (paid edit lifecycle) only against the §8 conditions; then driver assignment, flight monitoring, fiscal invoicing, and the enhanced-cancellation add-on.

---

## 11. Open Decisions Requiring the Product Owner

Each has a recommendation and the consequence of choosing the other way.

**D1. Own fleet vs subcontracted drivers.**
*Recommendation:* own fleet for the MVP; treat any overflow drivers as internal staff under payroll, not as settleable suppliers.
*Consequence of subcontracting through the platform:* it pulls driver payout, settlement, and quality-tracking onto the platform — precisely the marketplace machinery §9 excludes. If that is chosen, "skip" becomes "defer" and a payout surface is added that has no user today.

**D2. Prepay vs pay-on-arrival.**
*Recommendation:* prepay, platform as merchant of record.
*Consequence of pay-on-arrival:* the reservation needs an explicit unpaid-but-confirmed state, capacity is extended on credit with no-show risk, and the TTL hold largely loses its purpose. Competitor evidence shows pay-on-arrival is real in this market, so this is a genuine choice, not a detail (research 01 §4, §6.8).

**D3. Cancellation window and refund form (cash vs credit).**
*Recommendation:* a 24 h free-cancellation window; default refund as a one-year credit voucher, with cash refund as an option.
*Consequence of cash-by-default:* a deliberate competitive choice that raises refund volume and cost. *Consequence of a shorter window:* less traveler flexibility. The window and form must be stored as policy data, and the research's exact-window and enhanced-cancellation-fee figures are unverified and must not be treated as fact (research 01 §4, gaps).

**D4. Whether the MVP assigns a specific driver/vehicle.**
*Recommendation:* no for the MVP. The confirmation promises meeting instructions, waiting policy, and a support contact instead.
*Consequence of assigning in MVP:* requires driver/vehicle resources, assignment logic, and a day-of handoff — the dispatch surface §9 excludes. *Consequence of not assigning:* the confirmation is the only touchpoint, so support must genuinely be staffed, and the customer cannot see a driver ahead of pickup (research 01 §5, §6.5).

**D5. Whether the paid-reservation edit lifecycle is built at all.**
*Recommendation:* do not build it in the MVP; defer (S11). Use cancel-and-rebook, or a single modify-and-pay-difference step if a concrete scenario appears.
*Consequence of building it:* a large, high-risk build (proposal snapshots, optimistic versions, additional collections, refunds, duplicate protections) justified by an ideal rather than observed behavior. *Consequence of not building it:* some corporate or partially paid bookings may be handled manually, and a small set of customers may find cancel-and-rebook cumbersome (research 01 §5, §6.6).

**Also unresolved (lower stakes, listed so they are not silently defaulted):** currency display (USD only vs selectable USD/DOP), whether child seats and meet-and-greet are paid or included, who maintains zone boundaries and how often, and the day-of support model the confirmation will promise (research 01 open questions).

---

## 12. Risks

1. **Zones and quotes are not persisted.** They live in in-memory `Map`s and fixture zones are reseeded per quote. *Mitigation:* Phase 1 persistence before any booking work.
2. **PostGIS is an extension dependency everywhere.** Managed PostgreSQL must permit `CREATE EXTENSION postgis`; MikroORM migrations do not model `geometry`, so those migrations are hand-written raw SQL. *Mitigation:* confirm provider support early; keep the raw-SQL migration isolated and reviewed.
3. **Two sources of truth (polygon and cells).** They can drift silently. *Mitigation:* mandatory publish step on every polygon edit; zone versioning; quote snapshots retain the version used.
4. **H3 resolution mis-chosen.** Coarse cells can group two addresses that must price differently. *Mitigation:* choose from real fixtures; resolution 10 is the escape hatch, with the cell-count cost accepted.
5. **`calculatePrices` partial matches.** It never fails on ambiguity and exposes no match-quality flag. *Mitigation:* count persisted matching rules and reject unless exactly one (already the adopted rule).
6. **Webhook idempotency.** Medusa locks cart mutations but does not document app-wide event dedupe. *Mitigation:* `provider_event_id` unique, plus unique constraints on our side effects.
7. **Event durability in production.** No Redis event module is registered; the Local event module is development-only. *Mitigation:* register Redis before launch.
8. **No storefront exists.** `apps/` contains only `backend/`. *Mitigation:* add the DTC starter in Phase 1; treat transfer flows as new work.
9. **Capacity-window explosion.** One inventory item per window multiplies with window granularity. *Mitigation:* fix the window granularity as a product decision before creating items.
10. **Confirmation as the only touchpoint.** With no driver assignment, pickup must be flawless. *Mitigation:* pickup/meeting instructions, waiting policy, and a staffed support contact in every confirmation.
11. **Fiscal exposure.** No MVP output may be presented as a fiscal invoice. *Mitigation:* keep Medusa's confirmation explicitly a receipt/voucher; revisit e-CF before production.

---

## 13. Testing and Acceptance Strategy

**Unit tests.** H3 resolution and boundary-cell ownership, directed fare selection, fare reversal independence, ambiguity rejection, quote expiry, and state transitions.

**Module integration tests** (`moduleIntegrationTestRunner`). Transport module service: zone publish, cell uniqueness, quote snapshots, hold expiry, reservation linkage. Assert failure paths with the documented `throwOnError: false` + `errors[]` idiom for reject-ambiguous-fare and duplicate-provider-event cases.

**HTTP integration tests** (`medusaIntegrationTestRunner`). Quote → cart → order → reservation; admin zone and fare corrections; cancellation. Existing suites (`quote-cart.http.spec.ts`, `admin-transport.http.spec.ts`) are the starting shell.

**Playwright (to be added — none exists today).** End-to-end flows, which are the real acceptance bar:
- Quote → vehicle selection → checkout → operational confirmation.
- Admin draw polygon → publish → storefront quote reflects the new zone.
- Admin edit directed fare → storefront quote reflects it; reverse direction unchanged.
- Round trip with auto-swapped return and one transaction.
- Capacity window fills → next quote shows no availability; expired hold releases.
- Cancel inside and outside the window, with the correct refund form.

**Real fixtures.** PUJ, Punta Cana, Bávaro, and Cap Cana boundary addresses, used both for resolution choice and as regression fixtures.

**Commands.** Unit: `pnpm test`. Integration (modules): `cd apps/backend && DB_USERNAME=solis pnpm run test:integration:modules`. Integration (HTTP): `cd apps/backend && DB_USERNAME=solis pnpm run test:integration:http`. Build: `cd apps/backend && npx medusa build`. `medusa lint` is unavailable (eslint not installed) and must not be cited as a gate. No CI configuration exists; adding one is part of Phase 3.

**Acceptance rule.** A story is accepted only when a human can open the delivered behavior in Medusa Admin or the storefront and observe the persisted result. Writing code is not completion.

---

## 14. Deferred / Future Work

- **Paid-reservation edit lifecycle** (S11) — only if the §8 conditions are met.
- **Automated flight-status monitoring** (S12) — after flight-number capture is live.
- **Driver/vehicle assignment and live tracking** (S13) — attach to the reservation model later.
- **Fiscal invoicing / e-CF** (S14) — before any Dominican production launch.
- **Enhanced-cancellation cash-refund add-on** (S15).
- **Dynamic/surge pricing** — contradicts the flat-fare promise today.
- **Multi-modal inventory and broad localization** — outside the operator's fleet and market.
- **Optional `h3-pg` bindings** — compute cells in the database later; not part of the PostGIS decision.

---

## Appendix — Evidence Discipline and Unverifiable Items

**Labels used:** facts are grounded in the research documents and repository; recommendations are opinions and are labelled as such.

**Do not treat the following as fact** (research 01 "Could not confirm"): Mozio's request/response schema and endpoint list; Mozio's standard commission rate (the 20 % figure is an illustrative policy example only); whether Mozio charges consumers a platform fee; the exact provider cancellation window and enhanced-cancellation fee; Dominican-Republic-specific competitor prices and domestic prepay prevalence; any market-size, market-share, or growth figure. None of these may be upgraded into a requirement or a benchmark.

**Confidence notes carried forward:** the zone-granularity judgment (resolution 9 vs 10) is an inference pending fixtures; the absence of a `calculatePrices` match-quality flag is inferred from the documented return shape; `allowFields` is unavailable at 2.20.1.
