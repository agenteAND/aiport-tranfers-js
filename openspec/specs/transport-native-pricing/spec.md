# Transport Native Pricing

## Purpose
Prove that Medusa's native Pricing Module resolves directed transport fares from custom rule attributes, and that the resulting price can flow onto a real product-variant cart line item while promotions and taxes keep operating.

All prices in this capability are stored as-is, with no cents conversion, and currency codes are lowercase.

## Requirements

### Requirement: Directed fare resolution
The system MUST resolve transport fares from the validated context `origin_zone_id`, `destination_zone_id`, `vehicle_variant_id`, and `currency_code`, and the two directions of a zone pair MUST be independent.

#### Scenario: Outbound direction resolves
- GIVEN an active fare rule for `PUJ -> Punta Cana` for a given vehicle variant and currency
- WHEN a price is requested with that exact directed context
- THEN the system SHALL return the price belonging to the `PUJ -> Punta Cana` rule.

#### Scenario: Reverse direction is not implied
- GIVEN an active fare rule for `PUJ -> Punta Cana` and no rule for the reverse direction
- WHEN a price is requested with the reversed origin and destination
- THEN the system MUST NOT return the outbound price.

#### Scenario: Both directions priced independently
- GIVEN distinct active rules for `PUJ -> Punta Cana` and `Punta Cana -> PUJ` with different amounts
- WHEN each direction is requested
- THEN each request SHALL return only its own price, and the two amounts SHALL be independent.

### Requirement: Vehicle-specific pricing
The system MUST support different prices for the same directed zone pair and currency across different vehicle variants.

#### Scenario: Two variants price one directed pair differently
- GIVEN an active rule for `PUJ -> Punta Cana` for vehicle variant A and another for vehicle variant B, with different amounts
- WHEN the price is requested once per variant with identical remaining context
- THEN the system SHALL return the amount belonging to the requested variant.

### Requirement: Currency-specific pricing
The system MUST resolve the price matching the requested `currency_code` and MUST NOT substitute a price in another currency.

#### Scenario: Currency selects the matching price
- GIVEN active rules for the same directed pair and vehicle in both `usd` and `dop`, with different amounts
- WHEN the price is requested with `currency_code usd`
- THEN the system SHALL return the `usd` amount.

#### Scenario: Absent currency does not fall back
- GIVEN active rules for the same directed pair and vehicle in `usd` only
- WHEN the price is requested with `currency_code dop`
- THEN the system MUST report that no price is available rather than returning the `usd` amount.

### Requirement: Ambiguous rule detection
When two or more active rules share equal context and equal effective priority, the system MUST detect the ambiguity deterministically and MUST NOT return a quoted price. Deterministic detection MUST NOT depend on the native price calculation silently selecting a single "most relevant" price.

#### Scenario: Equal-context rules are rejected
- GIVEN two active rules with identical `origin_zone_id`, `destination_zone_id`, `vehicle_variant_id`, and `currency_code`
- WHEN a price is requested with that context
- THEN the system MUST report an ambiguous result and MUST NOT return a quoted price.

#### Scenario: Ambiguity detection is not reliant on the native selection
- GIVEN the same equal-context rules
- WHEN a price is requested
- THEN the ambiguity SHALL be detected by an explicit deterministic check over the matching rules, independent of whichever single price the native calculation would otherwise prefer.

#### Scenario: Single match is unambiguous
- GIVEN exactly one active rule for the requested context
- WHEN a price is requested
- THEN the system SHALL return that rule without reporting ambiguity.

### Requirement: Quote snapshot references
A successful resolution MUST return the selected pricing-rule references, sufficient to persist a future immutable quote snapshot.

#### Scenario: Rule references returned with the price
- GIVEN exactly one active rule for the requested context
- WHEN a price is requested
- THEN the result SHALL include the price set identifier, the price identifier, and the price list identifier when the price is governed by a price list.

### Requirement: Cart item with custom transport price
The calculated transport price MUST be addable to a Medusa cart as a line item linked to a real product variant.

#### Scenario: Custom price attaches to a real variant
- GIVEN a cart in a supported currency and a resolved transport price for a real product variant
- WHEN the price is added to the cart
- THEN the cart SHALL contain a line item carrying that calculated transport unit price.

### Requirement: Cart item relationship retention
The added line item MUST retain its product relationship, its variant relationship, the calculated transport unit price, and transport pricing context or snapshot metadata.

#### Scenario: Relationships and context survive addition
- GIVEN a line item added with a calculated transport price
- WHEN the cart is retrieved
- THEN the line item SHALL expose its product identifier, its variant identifier, the calculated unit price, and the transport pricing context or snapshot metadata.

### Requirement: Promotion and tax compatibility
Medusa promotions and taxes MUST continue to operate on a cart containing a transport-priced line item.

#### Scenario: Promotion applies to a transport-priced cart
- GIVEN a cart containing a transport-priced line item and an applicable promotion
- WHEN cart totals are computed
- THEN the promotion SHALL reduce the cart total.

#### Scenario: Tax applies to a transport-priced cart
- GIVEN a cart containing a transport-priced line item and a configured tax region
- WHEN cart totals are computed
- THEN the cart SHALL report a tax total for that line item.

### Requirement: Deterministic repeatability
Repeating the same calculation with identical inputs MUST return the same selected price and the same rule references.

#### Scenario: Repeat calculation is stable
- GIVEN an unchanged set of active rules for a context
- WHEN the same price request is performed repeatedly
- THEN every repetition SHALL return the same amount and the same rule references.

### Requirement: Benchmark evidence
An executable benchmark MUST generate directed fare-rule fixtures across several matrix sizes and report, for every tested matrix, the number of zones, number of vehicle variants, number of currencies, total directed prices, number of calculations, p50, p95, maximum duration, and the test environment. It MUST compare the observed internal calculation p95 against the PRD target of 250 ms and MUST state that final production validation remains pending until expected load and infrastructure are defined. It MUST NOT assert a production capacity requirement.

#### Scenario: Benchmark reports a full matrix row
- GIVEN generated directed fare-rule fixtures for a matrix size
- WHEN the benchmark runs its repeated calculations
- THEN it SHALL report every listed metric for that matrix.

#### Scenario: Latency is reported against the PRD target
- GIVEN a completed benchmark run
- WHEN results are reported
- THEN the observed internal calculation p95 SHALL be compared with 250 ms, and the report SHALL state that production validation is pending defined load and infrastructure.

### Requirement: Documented acceptance command
Exactly one documented command MUST prepare the test fixtures and run the complete acceptance scenario.

#### Scenario: Acceptance output demonstrates the full scenario
- GIVEN the documented acceptance command
- WHEN it is executed
- THEN its output SHALL visibly demonstrate the outbound selected price and rule, the reverse selected price and rule, a different vehicle price, a currency-specific price, ambiguity handling, the cart identifier, the retained product and variant identifiers, the calculated line-item price, the promotion total, the tax total, the final cart total, the deterministic repeat result, and the benchmark p50 and p95.

### Requirement: Fixture provenance
All generated pricing fixtures MUST be clearly identified as non-production test data.

#### Scenario: Fixtures are marked as test data
- GIVEN any generated pricing fixture
- WHEN it is created or reported
- THEN it SHALL be explicitly identifiable as non-production test data.

## Out of Scope

Customer quote UI; geocoding; H3 zone administration; availability; checkout payment; reservations; paid reservation edits; vehicle-class administration; a dedicated fare-matrix fallback.
