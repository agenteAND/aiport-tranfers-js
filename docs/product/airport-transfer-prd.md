# Product Requirements Document: Single-Provider Airport Transfer Platform

**Status:** Draft for review  
**Date:** 2026-09-10  
**Product model:** Mozio-like booking experience without a marketplace  
**Commerce foundation:** MedusaJS  
**Geospatial model:** H3-only zones

## 1. Executive Summary

### Problem Statement

Single-provider airport-transfer companies need to quote and sell scheduled transportation based on pickup zone, drop-off zone, vehicle type, trip direction, date, passengers, and optional services. Generic ecommerce platforms provide catalog, checkout, promotions, payments, orders, taxes, and refunds, but do not provide transport-zone pricing or editable reservations that can be safely requoted after payment.

### Proposed Solution

Build a single-provider airport-transfer booking platform on MedusaJS. Medusa will remain the system of record for products, prices, promotions, taxes, payments, and orders. A custom Transport Module will manage H3 zones, transfer quotes, availability, reservations, and reservation changes. Each vehicle type will be represented by a real Medusa product and variant, while the Medusa Pricing Module will be evaluated and used for origin-zone, destination-zone, and vehicle-based price rules.

The MVP ends when a transfer reservation is confirmed and fully paid. Driver assignment, dispatch, and trip execution are outside the MVP.

### Success Criteria

The MVP is successful when all of the following are demonstrated in production-like acceptance testing:

1. A customer can enter arbitrary supported addresses, receive a valid zone-based quote, apply an eligible promotion, pay, and receive a confirmed reservation.
2. Every configured H3 cell resolves deterministically to exactly one active transport zone, with zero ambiguous matches.
3. Given the same quote inputs and pricing version, the pricing engine returns the same total in 100% of automated test cases.
4. A paid reservation can be modified and requoted without duplicate charges, duplicate refunds, or loss of the original confirmed booking under retries, concurrent requests, or repeated payment webhooks.
5. Positive price differences generate an additional payment request; negative differences follow the configured refund or credit policy; zero differences update the reservation without a financial transaction.
6. A reservation reaches `confirmed` only when the associated Medusa order is fully paid for the current accepted reservation version.
7. Internal quote calculation after geocoding completes within 250 ms at p95 under the agreed MVP load test; production volume and concurrency targets remain TBD.
8. All critical booking and reservation-edit journeys pass end-to-end tests before release.

## 2. User Experience & Functionality

### User Personas

- **Traveler:** Books and pays for an airport, hotel, residence, or other supported-zone transfer.
- **Booking agent:** Creates or modifies a reservation on behalf of a customer.
- **Operations administrator:** Manages zones, vehicles, availability, extras, and directed fare rules.
- **Finance administrator:** Reviews payments, balances, refunds, taxes, and financial history.

### User Stories and Acceptance Criteria

#### Story 1 — Obtain a transfer quote

As a traveler, I want to enter my transfer details and receive an exact price so that I can decide whether to book.

**Acceptance Criteria**

- The customer can enter pickup and drop-off addresses accepted by the configured geocoding provider.
- The system stores the selected formatted address, coordinates, provider place identifier, and raw customer instructions separately.
- Each coordinate is converted to an H3 cell at the platform's configured resolution.
- The system resolves origin and destination cells to active transport zones.
- Unsupported or ambiguous locations do not produce an automatic price and display an actionable message.
- The customer selects a pickup date and time, passenger count, luggage count, trip type, vehicle, and available extras.
- Airport transfers collect airport code, flight number, airline, arrival or departure context, and flight date when applicable.
- The quote shows base fare, extras, discounts, taxes, total, currency, cancellation conditions, and expiration time.
- A round trip is represented as two transfer legs and may have independently priced directions.

#### Story 2 — Calculate a directed zone price

As an operations administrator, I want to define prices by origin zone, destination zone, and vehicle so that each route is quoted correctly.

**Acceptance Criteria**

- Price selection uses `origin_zone_id`, `destination_zone_id`, `vehicle_variant_id`, and `currency_code` as required context.
- A PUJ Airport → Punta Cana fare does not imply a Punta Cana → PUJ Airport fare.
- An administrator may explicitly copy a fare to the reverse direction, but the system stores and audits both directed rules.
- Different vehicle types may have different prices for the same zone pair.
- Prices can be scheduled, overridden, disabled, and configured in supported currencies.
- The system rejects duplicate active rules with equal effective priority and context.
- Price changes do not retroactively modify accepted quote snapshots or historical orders.

#### Story 3 — Manage transport zones with H3

As an operations administrator, I want to define service zones visually so that any address inside a supported area can be priced.

**Acceptance Criteria**

- The administrator can draw an area on a map and convert it to H3 cells at the configured resolution.
- The administrator previews the resulting cells before saving.
- Individual boundary cells can be added to or removed from a zone.
- An active H3 cell belongs to no more than one active zone.
- Zone changes are versioned and auditable.
- Existing quote and reservation snapshots retain the zone and pricing versions used when accepted.
- The MVP stores H3 indices in PostgreSQL using ordinary indexed columns and does not require PostGIS.
- The H3 resolution is selected through real-world tests covering PUJ, Punta Cana, Bávaro, Cap Cana, and representative boundary addresses.

#### Story 4 — Select a real transport product

As a traveler, I want to choose an appropriate vehicle so that capacity and price match my party.

**Acceptance Criteria**

- Every sellable vehicle type is linked to a real Medusa product and variant.
- Product data includes passenger capacity, luggage capacity, description, images, active status, and service restrictions.
- The checkout line item retains its product and variant relationship.
- The line item receives the calculated transport price and an immutable quote snapshot.
- Native Medusa order, catalog, promotion, tax, and product-linked reporting data remain available.
- A vehicle that cannot satisfy passenger or luggage requirements is not offered.

#### Story 5 — Check availability

As a traveler, I want to see only bookable vehicles so that payment cannot create an knowingly unavailable reservation.

**Acceptance Criteria**

- Administrators can configure sellable capacity and blackout periods by vehicle type.
- Availability is checked when quoting, before payment authorization, and before final reservation confirmation.
- A temporary hold prevents overselling while checkout is active.
- Holds expire automatically when checkout is abandoned or payment fails.
- The MVP does not assign a specific physical vehicle or driver.

#### Story 6 — Complete checkout and confirm a reservation

As a traveler, I want to pay securely and receive confirmation so that my transfer is reserved.

**Acceptance Criteria**

- Checkout uses Medusa carts, customer data, promotions, taxes, payment collections, and orders.
- Eligible Medusa promotions and coupons can be applied to the transfer product and extras.
- Payment completion is processed idempotently.
- A custom completion workflow creates the transport reservation and links it to the Medusa order.
- The reservation is confirmed only after the required payment is captured or otherwise recorded as fully paid according to the configured payment method.
- The customer receives an email confirmation with reservation number, itinerary, passenger details, vehicle, payment summary, and support contact.
- The system records consent to booking and cancellation terms.

#### Story 7 — Edit and requote an unpaid reservation

As a traveler or booking agent, I want to change booking details before payment so that the quote reflects the new trip.

**Acceptance Criteria**

- Changes to addresses, coordinates, zones, pickup time, trip legs, vehicle, passenger or luggage counts, extras, currency, or eligible promotions invalidate the previous quote.
- The system generates a new quote and quote version.
- Expired or superseded quotes cannot be paid.
- No order edit is required before the initial order is completed.

#### Story 8 — Edit and requote a paid reservation

As a traveler or booking agent, I want to change a paid reservation and settle the price difference safely.

**Acceptance Criteria**

- The current confirmed reservation remains valid while a proposed change is pending.
- Only one proposed edit can be active for a reservation at a time.
- Every edit uses an idempotency key and optimistic reservation version.
- The system requotes the complete reservation rather than applying an unverified manual delta.
- The system uses Medusa order edits and order financial summaries where compatible, including `pending_difference`.
- If the new total is higher, the system creates an additional payment collection and balance invoice or payment request.
- The modified reservation becomes confirmed only after the additional amount is successfully paid.
- If additional payment fails or expires, the proposed edit is not applied and the original confirmed reservation remains unchanged.
- If the new total is lower, the system creates an auditable partial refund or credit according to the configured policy.
- If totals are equal, the accepted edit updates the reservation without creating a payment or refund.
- Duplicate requests and repeated provider webhooks cannot create duplicate order edits, collections, captures, refunds, or invoices.
- The audit history shows the previous snapshot, proposed snapshot, accepted snapshot, actor, timestamps, price difference, and related Medusa financial identifiers.

#### Story 9 — Administer reservations

As a booking or finance administrator, I want to search and review reservations so that I can support customers and reconcile payments.

**Acceptance Criteria**

- Administrators can search by reservation number, order number, customer, email, phone, date, flight number, zone, and status.
- The reservation view displays all legs, addresses, H3 cells, zones, vehicle, passengers, luggage, extras, quote snapshot, payment state, edits, and audit events.
- Role-based permissions restrict zone pricing, refunds, and financial actions.
- Manual adjustments require a reason and create an audit event.
- Reservation and order financial totals can be reconciled.

#### Story 10 — Cancel a reservation

As a traveler or administrator, I want to cancel an eligible reservation so that the applicable refund policy is enforced.

**Acceptance Criteria**

- Cancellation eligibility is calculated from configured policy, pickup time, booking channel, and reservation state.
- The customer sees the refundable amount before confirming cancellation.
- Approved refunds use Medusa payment records and are idempotent.
- Cancellation releases any associated capacity or hold.
- Cancellation reason, actor, refund amount, and payment-provider references are audited.

### Non-Goals

The MVP does not include:

- A multi-provider marketplace, supplier bidding, supplier commissions, or supplier settlement.
- Driver onboarding, driver applications, driver mobile apps, or driver payouts.
- Assignment of a specific driver or physical vehicle.
- Dispatch, route optimization, live vehicle tracking, or trip execution states.
- Dynamic metered pricing based on distance or travel duration.
- PostGIS or an exact polygon system; H3 cells define the commercial zone boundaries.
- Automated flight-status monitoring unless separately approved.
- A complete accounting or government fiscal platform. Required fiscal-document integration must be defined before production launch.

## 3. AI System Requirements

AI is not required for the MVP's runtime behavior. Pricing, zone membership, availability, payment handling, and reservation state transitions must be deterministic and testable.

AI-assisted development may be used, but generated code must pass the same automated tests, security controls, review standards, and acceptance criteria as human-written code. AI must not autonomously change prices, zones, refunds, or confirmed reservations.

## 4. Technical Specifications

### Architecture Overview

The system will be a modular MedusaJS application with the following components:

1. **Storefront:** Collects trip details, requests quotes, displays vehicles and prices, completes checkout, and manages eligible reservation changes.
2. **Medusa commerce modules:** Own products, variants, price sets, price lists, promotions, taxes, customers, carts, payments, refunds, and orders.
3. **Custom Transport Module:** Owns transport zones, H3 cells, availability, quote snapshots, reservations, trip legs, proposed edits, and transport-specific audit events.
4. **Custom workflows:** Coordinate quoting, cart item creation, checkout completion, reservation confirmation, requoting, order edits, additional collections, and refunds.
5. **Admin extensions:** Manage zones, vehicle products, directed price rules, availability, reservations, changes, and financial exceptions.
6. **PostgreSQL:** Stores Medusa and Transport Module data. H3 cell identifiers use indexed string or 64-bit representations supported consistently by the application and database driver.
7. **External providers:** Geocoding/maps, payments, transactional email, and optional fiscal invoicing.

### Core Data Model

#### TransportZone

- `id`
- `name`
- `code`
- `status`
- `version`
- `effective_from`
- `effective_to`
- `metadata`

#### TransportZoneCell

- `id`
- `zone_id`
- `h3_index`
- `h3_resolution`
- `active_from`
- `active_to`
- Unique active ownership constraint for `h3_index`

#### VehicleProfile

- `id`
- `medusa_product_id`
- `medusa_variant_id`
- `passenger_capacity`
- `luggage_capacity`
- `status`
- `availability_policy_id`
- `metadata`

#### TransferQuote

- `id`
- `version`
- `status`
- `expires_at`
- `currency_code`
- `subtotal`
- `discount_total`
- `tax_total`
- `total`
- `pricing_rule_references`
- `zone_version_references`
- `input_hash`
- `snapshot`

#### TransferReservation

- `id`
- `reservation_number`
- `version`
- `status`
- `customer_id`
- `order_id`
- `accepted_quote_id`
- `currency_code`
- `paid_total`
- `current_total`
- `terms_version`
- `created_by`
- `metadata`

#### TransferLeg

- `id`
- `reservation_id`
- `sequence`
- `pickup_at`
- `pickup_address`
- `pickup_place_id`
- `pickup_latitude`
- `pickup_longitude`
- `pickup_h3_index`
- `origin_zone_id`
- `dropoff_address`
- `dropoff_place_id`
- `dropoff_latitude`
- `dropoff_longitude`
- `dropoff_h3_index`
- `destination_zone_id`
- `airport_code`
- `flight_number`
- `airline`
- `passenger_count`
- `luggage_count`
- `vehicle_profile_id`
- `customer_notes`

#### ReservationChange

- `id`
- `reservation_id`
- `base_reservation_version`
- `status`
- `idempotency_key`
- `previous_snapshot`
- `proposed_snapshot`
- `previous_total`
- `proposed_total`
- `difference`
- `order_edit_id`
- `payment_collection_id`
- `refund_id`
- `invoice_reference`
- `expires_at`
- `requested_by`

### Pricing Strategy

The primary approach is to use Medusa's Pricing Module and Rule Engine rather than maintaining a fully isolated fare table.

- Every vehicle profile links to a real product variant and its Medusa price set.
- Custom pricing rule attributes represent `origin_zone_id`, `destination_zone_id`, and other approved transport context.
- Direction is represented by the ordered origin/destination pair; reverse fares are explicit rules.
- Price lists provide scheduled overrides and promotional pricing where appropriate.
- Currency-specific prices are stored in the applicable price set.
- Tax-inclusive or tax-exclusive behavior follows Medusa region or currency price preferences.
- The quote workflow invokes `calculatePrices` with validated transport context and persists the selected rule identifiers in the quote snapshot.

Before full implementation, a technical spike must prove that Medusa's Rule Engine can:

1. Resolve the expected number of directed zone-pair and vehicle combinations without ambiguous matches.
2. Support required administrative maintenance and bulk import/export.
3. Produce acceptable query latency at projected fare-matrix size.
4. Preserve currency, price-list, promotion, and tax behavior.

Only if that spike fails may the technical design introduce a dedicated fare-matrix entity. That fallback must still feed a custom price into a real Medusa product variant line item.

### Required Workflows

- `resolveTransportZonesWorkflow`
- `quoteTransferWorkflow`
- `createTransferCartItemWorkflow`
- `holdTransferAvailabilityWorkflow`
- `completeCartWithTransferWorkflow`
- `createTransferReservationWorkflow`
- `proposeReservationChangeWorkflow`
- `requoteReservationWorkflow`
- `collectReservationBalanceWorkflow`
- `applyPaidReservationChangeWorkflow`
- `refundReservationDifferenceWorkflow`
- `cancelTransferReservationWorkflow`

All financial and state-changing workflows must support idempotent retries and compensating actions.

### Reservation State Model

Minimum reservation states:

- `pending_payment`
- `confirmed`
- `change_pending`
- `additional_payment_pending`
- `cancellation_pending`
- `canceled`
- `expired`

A reservation edit is a proposed version, not an immediate mutation. The confirmed version remains authoritative until the proposed version satisfies validation, availability, customer acceptance, and payment requirements.

### Integration Points

- **Medusa Product Module:** Vehicle products and variants.
- **Medusa Pricing Module:** Price sets, price lists, custom rules, currencies, and price calculation.
- **Medusa Promotion Module:** Coupons and eligible discounts.
- **Medusa Tax Module:** Tax calculations, including configured ITBIS behavior.
- **Medusa Cart and Order Modules:** Checkout, order creation, order edits, totals, and history.
- **Medusa Payment Module:** Initial payments, additional payment collections, captures, and refunds.
- **Geocoding and map provider:** Address autocomplete, place resolution, coordinates, and zone editor basemap.
- **H3 library:** Polygon-to-cells conversion, coordinate-to-cell lookup, and cell rendering.
- **Email provider:** Booking, payment, edit, refund, and cancellation notifications.
- **Fiscal invoicing provider:** TBD. The system must distinguish a payment request or receipt from a legally valid Dominican fiscal invoice.

### Currency, Tax, and Invoicing Rules

- Each cart and order has one transaction currency.
- USD and DOP prices may coexist in price sets, but a reservation edit cannot silently change the order currency.
- No implicit exchange-rate conversion is permitted without a separately approved conversion policy.
- ITBIS treatment is determined by Medusa tax configuration and the business's verified Dominican tax obligations.
- A positive reservation difference creates a balance invoice or payment request linked to the original order and reservation change.
- The legal format, numbering, and DGII/e-CF integration requirements for fiscal invoices remain a production-launch dependency, not an assumption supplied by Medusa.

### API Surface

Minimum custom endpoints:

- `POST /store/transfers/quotes`
- `POST /store/transfers/cart-items`
- `GET /store/transfers/reservations/:id`
- `POST /store/transfers/reservations/:id/changes`
- `POST /store/transfers/reservations/:id/changes/:changeId/accept`
- `POST /store/transfers/reservations/:id/cancel`
- `POST /admin/transport/zones`
- `PUT /admin/transport/zones/:id/cells`
- `POST /admin/transport/prices/import`
- `GET /admin/transport/reservations`
- `POST /admin/transport/reservations/:id/changes`

Exact route conventions and authorization middleware will be finalized in technical design.

### Security & Privacy

- Customer, itinerary, flight, location, and payment-reference data are treated as sensitive business and personal data.
- Payment card data must remain with the payment provider; the platform stores only approved tokens and references.
- Store and admin endpoints require separate authorization policies.
- Role-based permissions protect pricing, zone changes, refunds, manual adjustments, and exports.
- All webhook signatures are verified before processing.
- Idempotency keys and unique constraints protect payment, refund, order-edit, and reservation-change operations.
- Sensitive fields are excluded from application logs.
- Administrative mutations produce immutable audit events.
- Data retention, export, correction, and deletion policies must be defined before production launch.

### Testing Requirements

- Unit tests for H3 zone resolution, directed price selection, fare reversals, quote expiration, total calculations, and state transitions.
- Property-based or generated tests ensuring each active H3 cell has at most one owner.
- Integration tests for Medusa price rules, promotions, taxes, order edits, payment collections, captures, and refunds.
- Concurrency tests for simultaneous reservation edits and repeated webhook delivery.
- End-to-end tests for one-way booking, round trip, coupon, paid price increase, paid price decrease, failed additional payment, cancellation, and unsupported address.
- Contract tests for geocoding, payment, email, and fiscal providers.
- Real boundary-address fixtures for PUJ, Punta Cana, Bávaro, Cap Cana, and other launch zones.

## 5. Risks & Roadmap

### Phased Rollout

The phases below are implementation increments. They do not reduce the agreed MVP: production launch occurs only after all MVP capabilities described in this document are complete.

#### Phase 0 — Technical Validation

- Prove custom transport rule attributes in the Medusa Pricing Module.
- Benchmark realistic directed fare-matrix size.
- Select and validate the H3 resolution using real launch-zone addresses.
- Validate custom-priced real variant line items through checkout, promotions, taxes, and reporting.
- Prototype paid reservation change with order edit and additional payment collection.

#### Phase 1 — Commerce and Quoting Foundation

- Vehicle products and variants.
- H3 zone administration.
- Directed zone pricing.
- Address resolution, quote snapshots, availability, and cart integration.

#### Phase 2 — Booking and Payment

- Checkout, coupons, taxes, initial payment, order creation, reservation confirmation, and email confirmation.
- One-way and round-trip journeys.

#### Phase 3 — Editable Reservations

- Requoting, proposed changes, optimistic concurrency, order edits, additional payments, refunds or credits, and audit history.

#### Phase 4 — Operational Readiness

- Admin search and support tools.
- Cancellation flows.
- Reconciliation views.
- Security, privacy, load, failure-recovery, and end-to-end acceptance testing.
- Fiscal invoicing integration required for launch jurisdiction.

### Technical Risks

1. **Pricing rule scale or ambiguity:** The number of directed zone-pair rules may make native maintenance or calculation inefficient. Mitigation: mandatory pricing spike, uniqueness validation, benchmark, and controlled fallback to a fare matrix.
2. **H3 boundary classification:** Coarse cells may group locations that operations expects to separate. Mitigation: test real addresses, choose a sufficiently fine fixed resolution, preview cells, and permit boundary-cell editing.
3. **Geocoder inconsistency:** Providers may return inaccurate coordinates or duplicate place results. Mitigation: store place IDs and coordinates, display map confirmation, and support manual review for unsupported points.
4. **Reservation-edit races:** Repeated edits and payment webhooks may create conflicting financial operations. Mitigation: one active change, optimistic versions, locks, idempotency keys, unique constraints, and immutable snapshots.
5. **Additional-payment failure:** Applying an edit before payment would leave the reservation underpaid. Mitigation: retain the confirmed version until the difference is paid.
6. **Currency and tax assumptions:** Multi-currency support does not automatically satisfy Dominican fiscal requirements. Mitigation: validate ITBIS, receipt, invoice, and DGII/e-CF requirements with qualified local accounting and legal professionals.
7. **Availability overselling:** Checkout time creates a race between quotes. Mitigation: expiring holds and final availability validation before confirmation.
8. **Reporting expectations:** Custom metadata alone may not appear in native commerce reporting. Mitigation: preserve product/variant line-item links and build transport-specific admin views where required.

### Remaining Decisions Before Technical Design

- Payment provider and supported payment methods.
- Geocoding and map provider.
- Launch currencies and whether customers select currency or it is channel-based.
- Verified ITBIS and Dominican fiscal-invoice requirements.
- Cancellation and refund policy.
- Availability granularity and hold duration.
- Expected launch booking volume and concurrency.
- Exact launch zones and H3 resolution.

### Verified Platform Assumptions

- Medusa Pricing Module supports price sets, multiple currencies, price lists, custom rules, and contextual price calculation: <https://docs.medusajs.com/resources/commerce-modules/pricing>
- Medusa supports custom-priced cart items while retaining a real product variant: <https://docs.medusajs.com/resources/examples/guides/custom-item-price>
- Medusa order edits can update an item's price, require customer confirmation, and lead to additional payment or refund on the original order: <https://docs.medusajs.com/resources/commerce-modules/order/edit>
- Medusa currently allows only one requested order edit at a time: <https://docs.medusajs.com/user-guide/orders/edit>
- H3 converts coordinates to cells and can convert drawn polygons into cell sets with explicit containment modes: <https://github.com/uber/h3/blob/master/website/docs/api/regions.mdx>

