# Transfer Change Operations

## Purpose
Define safe assisted reservation changes and distinct business/provider idempotency identities.

## Requirements
### Requirement: Assisted reservation changes
The system MUST allow only assisted operator changes for price-changing edits, track each business operation by change_request_id, and dedupe provider webhooks by provider_event_id.
#### Scenario: Positive price difference
- GIVEN an operator submits a valid change with a higher fare
- WHEN the change is accepted
- THEN the system SHALL create one pending change and require a payment link before confirmation.
#### Scenario: Negative price difference
- GIVEN an operator submits a valid change with a lower fare
- WHEN the change is accepted
- THEN the system SHALL request an original-method refund before completing the change.
#### Scenario: Assisted-change errors
- GIVEN an unavailable fare, duplicate change_request_id, duplicate provider_event_id, or failed payment/refund event
- WHEN the change flow handles it
- THEN the system MUST keep the reservation unchanged and record an actionable error state.
