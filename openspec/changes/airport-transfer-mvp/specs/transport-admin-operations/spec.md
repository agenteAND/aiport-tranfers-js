# Transport Admin Operations

## Purpose
Define audited operator controls without introducing unresolved product policy.

## Requirements
### Requirement: Operator controls
The system MUST provide admin operations for zones, fares, reservations, assisted changes, exceptions, and audit review without exposing unresolved provider, fiscal, currency, cancellation, or volume policy.
#### Scenario: Admin correction
- GIVEN an authorized operator updates zone, fare, or reservation data
- WHEN the operation passes validation
- THEN the system SHALL save the change and audit who changed what.
#### Scenario: Invalid admin operation
- GIVEN validation fails or a duplicate identity is supplied
- WHEN an admin operation is submitted
- THEN the system MUST reject it without changing customer-visible reservation state.
