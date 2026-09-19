# Transfer Zone Modeling

## Purpose
Define validated H3-based operating zones for transfer pricing and quoting.

## Requirements
### Requirement: Zone model and validation
The system MUST represent transfer coverage as named H3 zone cells using configurable resolution, initially 9, and MUST validate imported cells and local boundary fixtures before activation.
#### Scenario: Activate valid zone cells
- GIVEN a zone import with valid cells at the configured resolution
- WHEN an operator activates the zone
- THEN the zone SHALL become selectable for transfer pricing and quoting.
#### Scenario: Reject invalid or duplicate cells
- GIVEN an import with malformed, wrong-resolution, or duplicate cells
- WHEN validation runs
- THEN the system MUST reject invalid cells and MUST NOT activate unresolved duplicates.
#### Scenario: Boundary address validation
- GIVEN local PUJ-area boundary fixtures
- WHEN validation classifies pickup or dropoff addresses
- THEN each address MUST resolve to the expected zone or a documented validation failure.
