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
### Requirement: Vehicle class listing

The system MUST expose an authenticated admin operation listing persisted transport vehicle classes with `limit`/`offset` pagination and total `count`, and MUST reject unauthenticated requests.

#### Scenario: List persisted classes

- GIVEN an authenticated admin and two persisted vehicle classes
- WHEN the admin requests the list
- THEN the system SHALL return both classes with `id`, `name`, and `active`
- AND SHALL return `count`, `offset`, and `limit`

#### Scenario: Paginate the list

- GIVEN more persisted classes than the requested `limit`
- WHEN the admin requests a page with `limit` and `offset`
- THEN the system SHALL return only that page plus the full `count`

#### Scenario: Unauthenticated listing

- GIVEN no authenticated admin
- WHEN the list is requested
- THEN the system MUST reject it without returning data

### Requirement: Vehicle class editing

The system MUST update only the `name` and/or `active` of an existing persisted vehicle class. `name` MUST be trimmed and rejected when blank or non-string. `active` MUST be a strict boolean when present. Unsupported fields and a body-supplied `id` MUST be rejected; the path `id` MUST be immutable. Omitted fields MUST be preserved.

#### Scenario: Update name and active

- GIVEN a persisted vehicle class
- WHEN the admin submits a trimmed `name` and boolean `active`
- THEN the system SHALL persist both and return the updated class

#### Scenario: Partial update preserves omitted fields

- GIVEN a persisted vehicle class
- WHEN the admin submits only `name`
- THEN the system SHALL update `name` and leave `active` unchanged

#### Scenario: Invalid name rejected

- GIVEN a persisted vehicle class
- WHEN the admin submits a blank or non-string `name`
- THEN the system MUST reject it and leave the class unchanged

#### Scenario: Invalid active rejected

- GIVEN a persisted vehicle class
- WHEN the admin submits `active` that is not a boolean
- THEN the system MUST reject it and leave the class unchanged

#### Scenario: Unsupported field or body id rejected

- GIVEN a persisted vehicle class
- WHEN the admin submits an unsupported field or a body `id`
- THEN the system MUST reject it and leave the class unchanged

#### Scenario: Unknown id is not created

- GIVEN no persisted class with the requested id
- WHEN the admin submits an update for that id
- THEN the system MUST return a not-found error
- AND MUST NOT create a class

### Requirement: Vehicle class active semantics preserved

Editing `active` MUST remain display-only. The system SHALL NOT change transfer fare resolution or reservation behavior based on the edited value.

#### Scenario: Active edit does not affect fares

- GIVEN an existing fare resolution for a vehicle class
- WHEN the admin flips that class's `active`
- THEN the fare resolution behavior SHALL remain unchanged

### Requirement: Vehicle classes admin page

The system MUST provide an admin page at `/app/vehicle-classes` that loads persisted classes on mount, shows loading, empty, and error states, edits an existing class in a Drawer, and refreshes the list after a successful edit so changes persist across reload.

#### Scenario: Page loads classes on mount

- GIVEN an authenticated admin opens the page
- WHEN the page mounts
- THEN the system SHALL request and display the persisted classes
- AND SHALL show a loading state until the request resolves

#### Scenario: Empty and error states

- GIVEN the page is open
- WHEN the list request returns no classes or fails
- THEN the page SHALL show an empty state or an error state, not an unhandled blank

#### Scenario: Edit persists across reload

- GIVEN the admin edits a class in the Drawer and saves
- WHEN the save succeeds and the admin reloads
- THEN the page SHALL show the updated values from the server
