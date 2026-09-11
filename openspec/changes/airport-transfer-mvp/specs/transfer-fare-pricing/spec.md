# Transfer Fare Pricing

## Purpose
Define deterministic directed fare resolution through Medusa Pricing Rules.

## Requirements
### Requirement: Directed fare resolution
The system MUST resolve fares by directed origin zone, destination zone, and vehicle through Medusa Pricing Rules, returning exactly one active fare or no fare.
#### Scenario: Fare found
- GIVEN one active matching rule
- WHEN pricing is requested
- THEN the system SHALL return that fare with its matched zones and vehicle.
#### Scenario: Fare unavailable or ambiguous
- GIVEN no active rule or multiple matching active rules
- WHEN pricing is requested
- THEN the system MUST report fare unavailable and MUST NOT quote a price.
