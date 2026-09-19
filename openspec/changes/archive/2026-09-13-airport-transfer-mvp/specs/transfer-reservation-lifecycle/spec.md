# Transfer Reservation Lifecycle

## Purpose
Define checkout-backed reservation state, snapshots, holds, confirmation, lookup, and audit history.

## Requirements
### Requirement: Reservation state and audit
The system MUST create reservations from checkout-backed cart lines, preserve quote/order snapshots, manage holds, confirmation, lookup, and audit history.
#### Scenario: Checkout confirmation
- GIVEN checkout succeeds for a transfer line
- WHEN confirmation is processed
- THEN one reservation SHALL be confirmed with immutable quote and order snapshots.
#### Scenario: Duplicate confirmation
- GIVEN a reservation already exists for the checkout
- WHEN confirmation is processed again
- THEN the system MUST return the existing reservation and MUST NOT duplicate it.
