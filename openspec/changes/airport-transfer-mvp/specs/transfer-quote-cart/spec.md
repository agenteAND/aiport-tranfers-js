# Transfer Quote Cart

## Purpose
Define server-priced transfer quotes and idempotent conversion to real cart variants.

## Requirements
### Requirement: Quote and cart conversion
The system MUST create server-priced quotes from valid trip inputs and MUST add accepted quotes to cart as real transfer variants with the quoted price preserved.
#### Scenario: Quote to cart
- GIVEN a valid quote with an available fare
- WHEN the customer accepts it
- THEN the cart SHALL contain one transfer line priced from the quote.
#### Scenario: Duplicate cart request
- GIVEN the same accepted quote is submitted again
- WHEN cart insertion is retried
- THEN the system MUST NOT add a second chargeable transfer line.
#### Scenario: Fare unavailable
- GIVEN pricing returns unavailable
- WHEN a quote is requested
- THEN the system MUST reject the quote and explain that no fare is available.
