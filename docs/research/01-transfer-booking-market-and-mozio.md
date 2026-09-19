# Transfer Booking Market and Mozio — Research

**Date:** 2026-09-19
**Scope:** How the airport-transfer market actually works, using Mozio as the reference
aggregator, and what that means for a single-provider platform on MedusaJS.
**Companion document:** `docs/product/airport-transfer-prd.md` (read first; compared in
section 6).

## Method and evidence labels

Claims are labeled:

- **[F] Verified fact** — read at the source URL.
- **[I] Inference** — my reasoning from verified facts; not directly stated by a source.
- **[A] Assumption** — plausible but unverified; treat as a hypothesis.

Primary sources are Mozio's own consumer and partner pages and Mozio's help center and
terms. Mozio's public API reference could not be reached (see "Confidence and gaps"), so
API-level behavior is evidenced through a partner integration guide (Nezasa) and Mozio's
provider-facing pages. Practitioner pricing material (software vendors) is used for the
market's pricing conventions and is labeled as such.

---

## 1. What Mozio sells, and to whom

Mozio is two products in one company, and conflating them is the fastest way to misread
the market.

**1a. Consumer product.** www.mozio.com and the iOS/Android app sell airport and
point-to-point ground transportation to individual travelers. The consumer enters a route
and sees a comparison of licensed provider options, then books and pays online. Mozio
states 180+ countries, 3,500+ airports, 3,000+ providers, 39 currencies, and 17 support
languages ([mozio.com](https://www.mozio.com/); [travelers page](https://app.mozio.com/travelers)).
It presents private cars, shared shuttles, luxury vehicles, taxis, vans and minibuses,
coaches and buses, trains, and accessible vehicles ([Punta Cana page](https://www.mozio.com/airport-transfers/punta-cana-transfers)).
For travelers, Mozio says there are "no subscriptions, no platform fees — you only pay for
your transfer" ([about](https://www.mozio.com/about)).

**1b. B2B / partner layer.** Mozio sells the same inventory as infrastructure to travel
businesses under four models: full API integration, white-label booking flow, embeddable
widget, and a Travel Agent Booking Tool ([business partners](https://www.mozio.com/business-partners)).
Its named audiences are OTAs and marketplaces, airlines, hotels, GDS/travel distribution
platforms, tour operators, corporate travel/TMCs, and independent travel agents
([mozio.com](https://www.mozio.com/); [GDS page](https://www.mozio.com/gds-platforms)).
Public logos include Agoda, Priceline, Trip.com, JetBlue, Amadeus, and TBO.
Commercial models are revenue share / commission, custom enterprise agreements, and
affiliate; partners set their own markup or commission
([online marketplaces](https://developer.mozio.com/online-travel-marketplaces);
[independent agents](https://www.mozio.com/travel-agents/independent-travel-agents)).

**1c. The separating line that matters.** The consumer product is a comparison/checkout
experience. The B2B layer is a *distribution contract and settlement machine*: Mozio signs
providers, sets a commission, collects the customer's money, and pays providers monthly.
Mozio describes itself plainly as "a marketplace where airport transfer providers can sell
their own products" ([providers](https://www.mozio.com/providers)). Provider-facing pages
show Mozio as merchant of record: it collects card payments, deducts card fees from
provider payouts (3% + $0.30 per booking), runs a monthly report-then-pay cycle (report on
the 5th, payment on the 15th), and applies penalties for no-pickup ([provider finances](https://sites.google.com/mozio.com/mozio-providers/finances);
[provider quality policy](https://sites.google.com/mozio.com/mozio-providers/bookings/quality)).
An example commission of 20% appears in the provider quality policy; that is an
illustrative figure in a policy example, not a published standard rate.

**[I]** The B2B layer, not the consumer site, is Mozio's moat. The consumer site
demonstrates the flow; the partner layer is the business. A single-provider operator needs
the former's UX and almost none of the latter's machinery.

---

## 2. How Mozio models the domain

**Locations.** Search accepts pickup and drop-off as "Airport, address, place or hotel
name" ([widget markup on mozio.com](https://www.mozio.com/)). Mozio's help center describes
the field as "an airport, hotel, or any address of your choice"
([help center](https://www.mygroundbooking.com/hc/en-us/articles/15230587295757-How-can-I-book-or-get-a-quote)).
A partner integration guide (Nezasa's Mozio connector) adds detail: Mozio receives
location data (hotels, piers, airports) as coordinates, cross-references it with Google
Maps, and supports three transfer scenarios — airport-to-point, point-to-airport, and
point-to-point. For airport transfers the connector passes the flight number and the
airport IATA code so the provider can identify the flight
([Nezasa connector doc](https://help.tripbuilder.app/en/articles/623031-mozio-connector)).
**[F]** Locations are therefore geocoded *points* plus a place taxonomy (airport, hotel,
etc.). There is no public evidence that Mozio exposes "zones" to the customer at all.

**[I]** Mozio does not resolve customers into zones. It resolves a point and asks
providers who serve that point for a price. The "zone" concept may exist inside provider
feeds, but it is not a customer-facing Mozio abstraction.

**Vehicles.** Mozio presents buyer-facing *vehicle types/classes*, not SKUs: private
car/sedan, SUV, shared shuttle, luxury vehicle, taxi, van/minibus, coach/bus, train,
accessible vehicle, plus an hourly car service
([Punta Cana](https://www.mozio.com/airport-transfers/punta-cana-transfers);
[Nezasa](https://help.tripbuilder.app/en/articles/623031-mozio-connector)). Each result
shows passenger capacity and luggage capacity; luggage is defined as anything that goes in
the trunk, and oversized items (bikes, strollers, foldable wheelchairs) count as two pieces
([luggage article](https://www.mygroundbooking.com/hc/en-us/articles/37747407507725-What-counts-as-luggage-and-how-much-can-I-bring-Will-it-fit-in-the-vehicle)).
Results are filtered to vehicles that fit the *entire* party in a *single* vehicle;
booking multiple vehicles in one reservation is not supported ([Nezasa](https://help.tripbuilder.app/en/articles/623031-mozio-connector)).
Providers are rated 1–10 from customer feedback ([help center](https://www.mygroundbooking.com/hc/en-us/articles/15230587295757-How-can-I-book-or-get-a-quote)).

**Pricing model.** **[F]** Mozio's consumer prices are fixed at booking and stated to
include taxes and fees ([help center](https://www.mygroundbooking.com/hc/en-us/articles/15230587295757-How-can-I-book-or-get-a-quote); [Punta Cana FAQ](https://www.mozio.com/airport-transfers/punta-cana-transfers)).
Private options are priced per vehicle; shared options are priced per person (the Punta
Cana page gives shared "from $10.20 USD per person" while private is "per vehicle"). Prices
depend on destination, vehicle type, and travel dates, and providers set their own pricing
([providers](https://www.mozio.com/providers)). Mozio's provider dashboard shows providers
manage "routes" and "pricing" ([provider dashboard page](https://sites.google.com/mozio.com/mozio-providers/tracking-tool/dashboard)).
Some partner pages also reference "dynamic pricing" that adjusts fares by demand
([online marketplaces](https://developer.mozio.com/online-travel-marketplaces)).

**[I]** The economically correct description is **per-route, provider-defined flat fares**
(O-D pair or route corridor), not a distance meter and not a global zone matrix. Whether
Mozio internally stores routes or zone-pairs is not public (see gaps). What is verified is
that the *product* behaves like a flat, per-route, per-vehicle-class price.

**[A]** The closest defensible model for a single provider is a flat, directed
(named origin → named destination) fare per vehicle class — which is also what airport
transfer practitioners describe as the standard (section 4).

**Search → compare → book flow.** **[F]** Mozio's own "How to book" steps are: search and
compare (enter pickup/drop-off) → choose the ride (shuttle, private, group, taxi, premium,
van, etc.) → confirm (see clear pricing, receive confirmation). The help center adds the
detail: search fields are pickup and drop-off address, pickup time, number of travelers
(including infants), and a round-trip toggle with return date/time. Results show vehicle
type, capacity, provider rating, and all-in pricing. The booking step collects passenger
contact details, an optional flight number for airport pickups (which then shows flight
landing time, scheduled pickup time, and free waiting time), and a special-instructions
field for child seats or other requests. Payment completes the booking and sends a
confirmation email ([travelers](https://app.mozio.com/travelers); [help center](https://www.mygroundbooking.com/hc/en-us/articles/15230587295757-How-can-I-book-or-get-a-quote)).
At the API level, the partner guide confirms support for search offers, offer details,
availability check, book, and cancel; it explicitly does *not* support name changes,
webhooks, or offer-level terms-and-conditions
([Nezasa](https://help.tripbuilder.app/en/articles/623031-mozio-connector)).

---

## 3. What the market expects of an airport-transfer booking flow

Synthesized from Mozio's pages and from comparable single-operator booking guides
(Transfeero, BA Transfer, Airport Move, Airport Only). Mozio-specific items are cited;
the rest are convergent across multiple operators and labeled **[F] convergence**.

**What the traveler chooses.**

- Pickup and drop-off: airport, hotel, or address ([Mozio help](https://www.mygroundbooking.com/hc/en-us/articles/15230587295757-How-can-I-book-or-get-a-quote)).
- Date and time. For airport pickups, operators consistently ask for the *flight landing
  time*, not the desired pickup time ([BA Transfer](https://batransfer.com/how-to-book-airport-transfer)).
- Passengers, including infants, and luggage (count and size class)
  ([Mozio luggage](https://www.mygroundbooking.com/hc/en-us/articles/37747407507725-What-counts-as-luggage-and-how-much-can-I-bring-Will-it-fit-in-the-vehicle)).
- One-way vs round trip. Mozio's round-trip toggle takes a return date/time in the same
  flow; return legs can be added at checkout ([Mozio help](https://www.mygroundbooking.com/hc/en-us/articles/15230587295757-How-can-I-book-or-get-a-quote);
  [Punta Cana FAQ](https://www.mozio.com/airport-transfers/punta-cana-transfers)).
- Vehicle class, with capacity shown and enforced ([Mozio help](https://www.mygroundbooking.com/hc/en-us/articles/15230587295757-How-can-I-book-or-get-a-quote)).
- Flight number (arrival for pickups; departure flight for drop-offs) to enable flight
  tracking and pickup-time adjustment ([Mozio help](https://www.mygroundbooking.com/hc/en-us/articles/15230587295757-How-can-I-book-or-get-a-quote)).
- Extras: child/booster seats by age and weight, meet-and-greet, extra stops, special
  instructions ([Mozio child seats](https://www.mygroundbooking.com/hc/en-us/articles/34749460352653-How-to-add-child-seats);
  [BA Transfer](https://batransfer.com/how-to-book-airport-transfer)).
- Actual passenger's contact details, especially when booking on someone else's behalf
  ([Transfeero](https://help.transfeero.com/getting-started/step-by-step-guide-to-book-a-ride-with-t)).

**What confirmation and fulfilment look like.**

- Instant confirmation (email and/or voucher) at booking, with agreed price, route, pickup
  instructions, and provider/support contact ([Punta Cana FAQ](https://www.mozio.com/airport-transfers/punta-cana-transfers);
  [Mozio help](https://www.mygroundbooking.com/hc/en-us/articles/15230587295757-How-can-I-book-or-get-a-quote)).
- Flight tracking adjusts pickup for delays at no charge, with a stated free waiting time
  ([Punta Cana FAQ](https://www.mozio.com/airport-transfers/punta-cana-transfers)).
- Driver/vehicle details delivered closer to the trip (varies: Mozio exposes provider
  contact; curated operators like Welcome Pickups send driver name/photo/contact days
  ahead) ([The Traveler](https://www.thetraveler.org/is-welcome-pickups-worth-booking-for-airport-transfers/)).
- Self-service change and cancel from the confirmation email or account
  ([Mozio change](https://www.mygroundbooking.com/hc/en-us/articles/36234848701581-Can-I-change-my-reservation-after-I-ve-confirmed-it)).
- 24/7 support, multi-language ([Mozio about](https://www.mozio.com/about)).

**[I]** The market's "confirmation" is not just a receipt — it is an *operational
handoff*: price, meeting instructions, flight context, waiting policy, and a contact that
answers. The PRD's MVP stop-line ("fully paid reservation confirmed") is compatible with
this only if the confirmation itself carries pickup instructions and a support contact.

---

## 4. Pricing mechanics in this market

**Flat zone/route pricing dominates.** Practitioner sources are unusually blunt: distance
pricing is "the wrong model for airport transfers" because it penalizes the driver for
choosing a faster (longer) motorway route; the standard is a fixed fare between a pickup
zone and a drop-off zone, overridden before any distance calculation
([RideCab](https://ridecabwp.com/use-cases/airport-transfer-business/)). A second vendor
describes zone pricing as the most widely used model for airport-to-city corridors, with
rules keyed on pickup zone, drop zone, service type, and time band
([Codico](https://codico.io/automate-zone-based-pricing-taxi-chauffeur/)). The common rule
shape is origin zone + destination zone + vehicle type + fixed price, optionally
bidirectional ([RideCab](https://ridecabwp.com/use-cases/airport-transfer-business/)).
Mozio's product is consistent with flat per-route fares (section 2).

**But not every premium player uses zones.** Blacklane states its fare is calculated from
route, distance, time, vehicle class, and local operating costs, fixed at booking, with no
surge pricing ([Blacklane about](https://www.blacklane.com/en-gb/about/);
[Blacklane help](https://help.blacklane.com/en/articles/2693315-what-factors-influence-the-price)).
So "flat fare" and "distance-based" can coexist — the constant is *a fixed price shown
before payment*, not the underlying formula.

**Currency.** Mozio supports 39 currencies and lets the user pick one from a selector on
the page ([travelers page](https://app.mozio.com/travelers)). Mozio's own consumer
marketing for a Dominican route quotes USD ([Punta Cana FAQ](https://www.mozio.com/airport-transfers/punta-cana-transfers)).

**Deposits vs pay-on-arrival.** **[F]** Mozio's consumer flow is prepay online: "pay
securely online and receive instant confirmation" and "no need to arrange cash or currency
on arrival" ([Punta Cana page](https://www.mozio.com/airport-transfers/punta-cana-transfers)).
Mozio collects the money and later pays providers, so prepay with Mozio as merchant of
record is structural, not incidental. **[F] convergence:** some single operators offer
"pay the driver in cash" while still issuing an instant confirmation
([BA Transfer](https://batransfer.com/how-to-book-airport-transfer)), so pay-on-arrival is
a real, competitor-specific option in this market — not an aggregator norm.

**Cancellation windows.** Mozio's standard free cancellation is up to the provider's
window, "usually 24 hours or less before your scheduled pickup"
([Mozio cancel](https://www.mygroundbooking.com/hc/en-us/articles/36234881763853-How-do-I-cancel-my-reservation)).
The Punta Cana page says some transfers are free up to 12 hours, and that the exact policy
is always shown before booking. Crucially, the *default* standard cancellation refund is a
**credit voucher valid one year**, not cash; a paid "Enhanced Cancellation" option selected
at checkout converts it to a cash refund minus a non-refundable fee
([Mozio TOS §18.2](https://www.mozio.com/terms-of-service); a third-party FAQ states the
add-on fee is $5 ([TaxiOnline](https://www.taxionline.international/online-helpdesk/))).
Once the cutoff passes, changes and refunds are refused (TOS §18.1.3, §18.2.1). Changes
before the cutoff may cost more and may require re-entering a card; Mozio recommends
cancel-and-rebook as the simplest path
([Mozio change](https://www.mygroundbooking.com/hc/en-us/articles/36234848701581-Can-I-change-my-reservation-after-I-ve-confirmed-it)).

**Round-trip presentation.** **[F]** A round trip is added as a return leg within the same
checkout and charged in one transaction; the return can be adjusted or added later subject
to availability ([Mozio TOS §18.1](https://www.mozio.com/terms-of-service);
[Punta Cana FAQ](https://www.mozio.com/airport-transfers/punta-cana-transfers)). Operators
commonly auto-swap origin/destination for the return
([BA Transfer](https://batransfer.com/how-to-book-airport-transfer)). Nothing verified
indicates a mandatory "round-trip discount" — round trips are effectively two priced legs.

---

## 5. Single-provider vs marketplace aggregator (the important one)

This section is deliberately opinionated.

**What an aggregator needs that a single provider does not.**

- Multi-supplier onboarding, licensing/insurance vetting, and contract management
  ([providers](https://www.mozio.com/providers)).
- Commission, markup, revenue-share, and partner settlement — including partner-set
  margins ([about](https://www.mozio.com/about)).
- Supplier payouts, monthly statement reconciliation, card-fee deductions, and penalties
  for no-pickup or quality failures ([provider finances](https://sites.google.com/mozio.com/mozio-providers/finances);
  [provider quality](https://sites.google.com/mozio.com/mozio-providers/bookings/quality)).
- Provider dashboards, driver assignment, tracking, and a fulfillment SLA across many
  companies ([provider dashboard](https://sites.google.com/mozio.com/mozio-providers/tracking-tool/dashboard)).
- Ranking and comparison across providers, plus provider ratings
  ([help center](https://www.mygroundbooking.com/hc/en-us/articles/15230587295757-How-can-I-book-or-get-a-quote)).
- Demand-side distribution: API, white-label, widget, agent tool, plus per-channel
  credentials and markup controls ([business partners](https://www.mozio.com/business-partners);
  [Nezasa](https://help.tripbuilder.app/en/articles/623031-mozio-connector)).
- Multi-modal content normalization (trains, buses, water taxis) across regions
  ([coverage](https://www.mozio.com/coverage)).
- Reallocation when a provider fails: aggregators carry a no-pickup penalty precisely
  because they must source a last-minute replacement
  ([provider finances](https://sites.google.com/mozio.com/mozio-providers/finances)).

**What a single provider needs that an aggregator does not.**

- Its own fleet/capacity and availability truth (the aggregator queries suppliers for this;
  a single provider *is* the supply).
- Its own cost-based margin control (no supplier price feed to protect).
- Direct customer relationship and repeat-booking/CRM value.
- One brand's service standard instead of a network-wide quality program.

**[I] The build trap.** Because the reference product (Mozio) visibly contains all of the
first list, it is tempting to model the platform on Mozio's *internal* seams — suppliers,
commission, editable reservations with financial proposals — even though the business only
has itself as a supplier. Every marketplace feature you build is a feature with no user:
there is no second supplier to onboard, no partner to settle with, no provider ranking to
compute.

**[I] The fulfilment trap is the opposite risk.** The one thing a single provider cannot
copy from Mozio is offloading quality to a supplier network. Mozio's guarantee ("pickup
guaranteed", licensed and insured providers) is backed by an entire provider network and
penalties. A single provider must own dispatch, driver assignment, and day-of support —
or be explicit that those are out of scope for the MVP, which leaves the confirmation as
the only customer touchpoint.

**Recommendations — what to build, skip, and defer.**

*Build (single-provider, market-aligned):*

- **Build:** Flat, directed zone/route-pair fares per vehicle class, shown as an all-in
  fixed price. Reason: this is the market standard and it is what the PRD already targets,
  minus the marketplace overhead.
- **Build:** Passenger + luggage capacity filtering to a single vehicle, with size
  semantics (oversized = two pieces) and a clear "party does not fit" outcome.
- **Build:** Flight-number capture on airport legs plus a published free-waiting policy,
  even if flight monitoring is manual at launch.
- **Build:** Prepay with the platform as merchant of record, plus an instant confirmation
  voucher carrying pickup instructions and a support contact. This is the closest to the
  market norm and the most defensible with one supplier.
- **Build:** Round trip as two independently priced legs in one checkout, with
  origin/destination auto-swap for the return.
- **Build:** Child seats and extras selected at booking, validated against vehicle
  capacity. Do not assume they are paid — many operators give child seats free.
- **Build:** Self-service change/cancel inside a configurable window. Implement change as
  either cancel-and-rebook or a single modify-and-pay-difference step, not a formal
  proposal lifecycle.

*Skip (marketplace-only, no first-party user):*

- **Skip:** Supplier onboarding, licensing/insurance vetting, and contracts.
- **Skip:** Commission, revenue share, partner markup, and supplier payouts/statements.
- **Skip:** Provider ranking, ratings, bidding, or auctions.
- **Skip:** White-label/API-as-a-product distribution and per-channel credentials.
- **Skip:** Multi-modal inventory (trains, buses, ferries, water taxis).
- **Skip:** A 39-currency selector and broad localization; support the currencies the
  business actually transacts in (likely USD and DOP).

*Defer (real, but not launch-critical):*

- **Defer:** Automated flight-status polling (capture the flight number now; automate
  later). The PRD already lists automated monitoring as a non-goal.
- **Defer:** Driver assignment, dispatch, and live tracking — but keep the reservation
  model open to attaching a driver/vehicle later.
- **Defer:** A paid "enhanced cancellation" add-on; start with the default
  window-and-voucher-or-refund policy.
- **Defer:** Dynamic/surge pricing; flat fares are the market promise.

**Opinionated challenge to the PRD's reservation-edit design.** Mozio — an aggregator
with far more change volume than a single operator — does not implement a versioned
"propose change / accept / collect difference / refund difference" lifecycle. It offers a
self-service edit that may charge more and may re-enter a card, and otherwise recommends
cancel-and-rebook ([Mozio change](https://www.mygroundbooking.com/hc/en-us/articles/36234848701581-Can-I-change-my-reservation-after-I-ve-confirmed-it)).
**[I]** The PRD's Stories 7 and 8 (proposed snapshots, optimistic versions, additional
payment collections, order edits, duplicate-refund protections) are a large, high-risk
build justified by an internal-consistency ideal, not by observed market behavior. It is
reasonable to keep the invariant "the old reservation stays valid until any difference is
paid", but the full proposal/versioning machinery should be deferred or simplified unless
the business can name a concrete customer scenario that cancel-and-rebook cannot serve.

---

## 6. Where the current PRD is out of step with the market

Based on the evidence above. Each item names the tension, not a prescribed rewrite.

1. **Zones are an internal mechanism, but the PRD makes H3 fixed-resolution cells the
   product's spine.** The market's customers type an address and get a price; zones are an
   operator-side implementation detail. Practitioner zone systems use **editable polygon
   geofences** on a map ([RideCab](https://ridecabwp.com/use-cases/airport-transfer-business/);
   [Codico](https://codico.io/automate-zone-based-pricing-taxi-chauffeur/)), which are
   easier to reason about and adjust than a fixed hex resolution. **[I]** H3 is defensible
   as a storage/geometry choice, but the PRD treats coarse-cell boundary risk as a testing
   problem to be mitigated; the market treats zone edges as an operations-editable
   concern. Consider allowing boundary-cell overrides (the PRD does) and, longer term,
   polygon-authored zones with H3 as an index rather than the source of truth.

2. **Extras are under-specified relative to what travelers choose.** The PRD mentions
   "extras" generically. The market consistently sells or at least offers child/booster
   seats by age and weight, meet-and-greet, and extra stops, all validated against vehicle
   capacity ([Mozio child seats](https://www.mygroundbooking.com/hc/en-us/articles/34749460352653-How-to-add-child-seats)).
   A child seat plus passengers must not exceed vehicle capacity — that is a pricing and
   availability input, not a note.

3. **Luggage is a count, but the market uses size semantics.** Mozio treats trunk items as
   luggage, oversized items as two pieces, and cabin-sized cases over 20 kg as large
   luggage ([luggage article](https://www.mygroundbooking.com/hc/en-us/articles/37747407507725-What-counts-as-luggage-and-how-much-can-I-bring-Will-it-fit-in-the-vehicle)).
   The PRD's `luggage_count` alone will misquote families with strollers.

4. **The PRD stops at confirmation and does not define the confirmation's content as
   fulfilment.** The market's confirmation includes pickup instructions, meeting point,
   provider/support contact, flight-tracking behavior, and free waiting time
   ([Punta Cana FAQ](https://www.mozio.com/airport-transfers/punta-cana-transfers)). The
   PRD's Story 6 email lists itinerary, vehicle, payment summary, and support contact —
   close, but missing pickup/meeting instructions and waiting policy, which are the parts
   that make a "confirmed" booking usable.

5. **Flight monitoring is a non-goal, but flight *data capture* is a launch requirement.**
   Every comparable flow asks for the flight number and landing time on airport legs and
   adjusts pickup for delays ([BA Transfer](https://batransfer.com/how-to-book-airport-transfer);
   [Mozio help](https://www.mygroundbooking.com/hc/en-us/articles/15230587295757-How-can-I-book-or-get-a-quote)).
   The PRD captures airport code, flight number, and airline, which is good — but it should
   commit to a manual waiting/delay policy at launch, not leave the gap implicit.

6. **Reservation editing is heavier than the market (section 5).** This is the largest
   scope risk in the PRD and the clearest place to cut before rewriting requirements.

7. **Cancellation refund semantics are generic.** The PRD says "refund or credit according
   to configured policy." The market's dominant pattern is more specific: free cancellation
   inside a ~24h window, with the *default* refund being a one-year credit voucher and cash
   refunds gated behind a paid add-on ([Mozio TOS §18.2](https://www.mozio.com/terms-of-service)).
   If the business intends cash refunds by default, that is a deliberate competitive choice,
   not a detail to leave to configuration.

8. **Pay-on-arrival is absent from the PRD's payment model.** The PRD assumes Medusa
   checkout with full payment before confirmation. That matches Mozio, but some single
   operators in this market still accept pay-the-driver with instant confirmation
   ([BA Transfer](https://batransfer.com/how-to-book-airport-transfer)). If the launch
   market (Dominican Republic) expects cash-on-arrival, the reservation state model needs
   an explicit unpaid-but-confirmed path. This is a product decision (see open questions).

9. **Currency scope may be larger than needed.** The PRD allows USD and DOP coexisting
   with no implicit conversion. Mozio exposes 39 currencies to consumers. For a
   single-country operator, a currency *selector* is optional; what matters is an
   unambiguous transaction currency per order, which the PRD already enforces.

**What the PRD gets right and should keep.** The non-goals list (no marketplace, no
supplier settlement, no driver apps, no distance metering, no PostGIS) is exactly the
boundary this research supports. Prepay through Medusa as system of record matches the
aggregator norm. Directed zone-pair pricing matches the flat-fare market. Round trip as two
legs matches Mozio.

---

## What this means for us

Each recommendation is marked **build**, **skip**, or **defer**.

| # | Recommendation | Verdict | One-line reason |
|---|---|---|---|
| 1 | Flat, directed zone/route-pair fare per vehicle class, all-in fixed price | **build** | Market standard and already the PRD's core; distance metering is explicitly rejected by practitioners. |
| 2 | Passenger + luggage capacity filter to one vehicle, with oversized-item semantics | **build** | Mozio filters to a single fitting vehicle and defines oversized as two pieces; a bare count misquotes. |
| 3 | Flight-number capture + published free-waiting/delay policy (manual at launch) | **build** | Every comparable flow asks for it and customers judge the booking on it. |
| 4 | Prepay online, platform as merchant of record, instant voucher with pickup instructions and support contact | **build** | Matches Mozio and removes pay-on-arrival risk; makes "confirmed" mean something operationally. |
| 5 | Round trip as two priced legs in one checkout, auto-swapped return | **build** | Matches Mozio and every operator guide reviewed. |
| 6 | Child seats / meet-and-greet / extra stops as booking options, capacity-validated | **build** | Travelers expect them; pricing them is optional (many operators give child seats free). |
| 7 | Self-service change/cancel in a configurable window as modify-and-pay or cancel-and-rebook | **build** | Matches Mozio's actual behavior at a fraction of the PRD's complexity. |
| 8 | Full versioned reservation-edit lifecycle (propose/accept/collect/refund) for paid bookings | **defer** | Even Mozio does not do this; name a real scenario before building it. |
| 9 | Supplier onboarding, licensing vetting, contracts | **skip** | There is no second supplier; this is aggregator-only. |
| 10 | Commission, markup, revenue share, supplier payouts and statements | **skip** | No partner to settle with; adds financial surface with no first-party user. |
| 11 | Provider ranking, ratings, bidding/auctions | **skip** | Meaningless with one provider. |
| 12 | API / white-label / widget distribution as a product, per-channel credentials | **skip** | The platform is the operator's own channel, not a tech product. |
| 13 | Multi-modal inventory (trains, buses, ferries, water taxis) | **skip** | Outside an airport-transfer operator's fleet. |
| 14 | 39-currency selector and broad localization | **skip** | Support USD and DOP; a selector is cosmetic for one country. |
| 15 | Automated flight-status polling | **defer** | Capture flight numbers now; automate after launch when volume justifies it. |
| 16 | Driver assignment, dispatch, live tracking | **defer** | PRD already defers execution, but keep the model able to attach driver/vehicle later. |
| 17 | Paid "enhanced cancellation" cash-refund add-on | **defer** | Attractive margin lever, but it is a second cancellation policy to test. |
| 18 | Dynamic/surge pricing | **defer** | Flat fares are the market promise; surge contradicts the brand. |

**One-line summary:** build the flat-fare, capacity-aware, prepay booking and confirmation
experience the market expects; skip everything that exists only because a marketplace has
multiple suppliers; defer the operator-side execution and the heavyweight reservation-edit
lifecycle until the business can name the scenario that requires them.

---

## Confidence and gaps

**Verified (read at the source).**

- Mozio's consumer product, coverage claims, vehicle types, and search/compare/book flow.
- Mozio's B2B layer: four integration models, target segments, commission/revenue-share.
- Mozio as marketplace and merchant of record: collects payment, pays providers monthly,
  deducts card fees, applies no-pickup penalties.
- Mozio's booking inputs (addresses, passengers, round trip, flight number), capacity
  filtering to a single vehicle, luggage semantics, child-seat handling.
- Mozio's pricing presentation (fixed at booking, taxes/fees included, per vehicle vs per
  person) and currency support (39 currencies).
- Mozio's cancellation mechanics (provider window, typically ~24h; default credit voucher;
  paid enhanced cancellation for cash refund) from Mozio's own terms and help center.
- API-level behavior from a named partner integration guide (Nezasa): search, offer
  details, availability, book, cancel, cancellation policies; no name change, no webhooks,
  single-vehicle bookings, coordinates + flight number/IATA passed through.
- Practitioner claims that flat zone-to-zone/flat-route pricing is the airport-transfer
  norm, and that distance pricing is inappropriate for it.
- Blacklane's distance/time/vehicle-class-based upfront fixed pricing as a counterexample.

**Inferred (reasoning, not stated by a source).**

- Mozio's internal data model is provider-defined per-route flat fares, not a customer-facing
  zone matrix.
- The B2B layer is Mozio's economic center of gravity.
- A single provider should model flat directed route pairs; H3 is an implementation detail.
- The PRD's paid-reservation-edit lifecycle is over-built relative to market behavior.
- Confirmation content functions as operational fulfilment, not just a receipt.

**Could not confirm.**

- Mozio's public API reference. `docs.mozio.com` returned a transport error and
  `developer.mozio.com/api` returned 404; the API guide surfaced in search results lives on
  Scribd, which is not a primary source and was not used. Consequently I cannot verify
  Mozio's actual request/response schema, endpoint list, or how it stores locations,
  routes, or zone pairs.
- Mozio's standard commission rate. A 20% figure appears only in an illustrative
  provider-quality policy example; it is not published as the standard rate.
- Whether Mozio charges consumers any platform fee. Its consumer copy says "no platform
  fees," but the provider economics (3% + $0.30 card fee, commission) show the margin is
  taken from the supply side; the net consumer price was not independently verified.
- The default provider cancellation window (Mozio says "usually 24h or less"; the Punta
  Cana page cites 12h for some transfers) and the exact enhanced-cancellation fee (a
  third-party FAQ says $5; Mozio's own terms describe the fee without a number).
- Dominican-Republic-specific competitor prices and the prevalence of pay-on-arrival vs
  prepay locally. The only DR pricing datum found is Mozio's own "shared from $10.20 USD
  per person."
- Any market-size, market-share, or growth figures for Mozio or the transfer market.
  None were asserted.

---

## Open questions for the product owner

These are business decisions, not research gaps.

1. **Is the launch business a single fleet, a single operator with subcontractors, or a
   brand that will later onboard other operators?** The answer decides whether any of the
   "skip" marketplace features must become "defer."
2. **Prepay only, or pay-on-arrival too?** The PRD assumes prepay; some operators in this
   market still accept cash to the driver. This changes the reservation state model.
3. **What is the default refund form:** one-year credit voucher (Mozio's default) or cash
   refund? And what is the cancellation window (12h, 24h, 48h)?
4. **Is driver assignment in scope at launch, or truly post-MVP?** The market's
   confirmation promises a driver/vehicle before pickup; if that is out of scope, the
   confirmation and support process must compensate.
5. **Will child seats and meet-and-greet be paid add-ons or included?** Many competitors
   include child seats free; this is a positioning choice with pricing consequences.
6. **Can the business name a concrete paid-booking edit scenario that cancel-and-rebook
   cannot serve?** If not, the PRD's edit lifecycle should be cut.
7. **Who maintains zones, and how often do boundaries change?** This decides whether H3
   fixed cells or editable polygons are the better operations model.
8. **Currency display:** USD only, or a user-selectable USD/DOP? The PRD enforces one
   transaction currency per order either way.
9. **What is the day-of support model** (hours, language, channel) that the confirmation
   email will promise? The market's baseline is 24/7 with multi-language support; a single
   provider must decide what it can actually staff.
