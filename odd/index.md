# Repository Index

Map of `ground-transportation-fare`. Purpose: locate anything without reading the whole codebase.
Verified against the working tree on 2026-09-18. Update when structure changes.

## 1. Workspace layout

| Path | Role |
|---|---|
| `package.json` | Root workspace package; only script is `test` → `pnpm --recursive run test` |
| `pnpm-workspace.yaml` | pnpm workspace, globs `apps/*` |
| `pnpm-lock.yaml` | Single lockfile for the workspace |
| `apps/backend/` | The only application/package: MedusaJS 2.20.1 backend + admin |
| `odd/` | ODD durable context: `index.md`, `decisions.md`, `tasks/` (tasks created per feature) |
| `docs/` | Product documents (PRD) |
| `openspec/` | Historical SDD artifacts. NOT an active workflow |
| `AGENTS.md` | ODD workflow instructions |
| `.opencode/` | Agent/escalation configuration, not application code |
| `.codegraph/` | Local CodeGraph index (gitignored, not source) |
| `node_modules/` | Workspace dependency install |

- Package manager: `pnpm@10.33.0` (declared in both root and backend `packageManager`).
- Node engine: `^20.19.0 || >=22.12.0`.
- No storefront exists. `apps/` contains only `backend/`.
- No CI configuration exists (no `.github/`, `.gitlab-ci.yml`, or `.circleci/`).
- No `pnpm-workspace` package other than `@dtc/backend`.

### Root scripts

| Script | Command |
|---|---|
| `pnpm test` (root) | `pnpm --recursive run test` → runs backend unit tests only |

### `apps/backend/package.json` scripts

| Script | Command |
|---|---|
| `build` | `medusa build` |
| `start` | `medusa start` |
| `dev` | `medusa develop` |
| `lint` | `medusa lint` (unavailable — eslint not installed; see §9) |
| `test` | `TEST_TYPE=unit ... jest --passWithNoTests` |
| `test:unit` | `TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules jest --silent --runInBand --forceExit` |
| `test:integration:modules` | `TEST_TYPE=integration:modules NODE_OPTIONS=--experimental-vm-modules jest --silent=false --runInBand --forceExit` |
| `test:integration:http` | `TEST_TYPE=integration:http NODE_OPTIONS=--experimental-vm-modules jest --silent=false --runInBand --forceExit` |

## 2. Backend

### Module: `apps/backend/src/modules/transport/`

| Path | Purpose |
|---|---|
| `index.ts` | Module definition; registers `TransportModuleService` under key `"transport"` (`TRANSPORT_MODULE`) |
| `service.ts` | `TransportModuleService extends MedusaService(...)`; all transport business logic (525 lines) |
| `h3-validation.ts` | `assertCellAtResolution`, `assertUniqueCells` — H3 cell guards |
| `fixtures/puj-boundary.ts` | `PUJ_BOUNDARY_FIXTURES`: 3 Punta Cana test locations → H3 cell + zone id/name |
| `migrations/Migration20260912161900.ts` | Initial schema: 8 transport tables + 2 indexes |

Service entry points (`service.ts`):

| Method | Line | Purpose |
|---|---|---|
| `importZoneCells(input)` | 178 | Validate and register a zone + its H3 cells (in-memory) |
| `getZone(id)` | 194 | Retrieve an imported zone (in-memory) |
| `findActiveZoneForLocation({lat,lng})` | 198 | Resolve lat/lng → H3 cell → active zone (in-memory) |
| `resolveTransferFare(pricingAccess, input)` | 206 | Match an active fare price set by origin/destination zone + vehicle + currency; rejects 0 or >1 matches |
| `createQuoteSnapshot(input)` | 246 | Freeze a 15-min quote; returns `quote_id` / `expires_at` (in-memory) |
| `getQuoteSnapshot(quoteId)` | 258 | Retrieve a stored quote snapshot (in-memory) |
| `confirmTransferReservation(input)` | 262 | Idempotently create reservation + hold, mark hold confirmed, write audit event |
| `lookupReservationByOrder(orderId)` | 306 | Find the reservation for a Medusa order |
| `expireReservationHolds({now?})` | 314 | Mark active holds past `expires_at` as expired |
| `requestReservationChange(input)` | 330 | Idempotently create a reservation change; computes delta and initial state |
| `handleChangeProviderEvent(input)` | 373 | Idempotently apply provider payment/refund event; confirms or errors the change |
| `adminCorrectZone(input)` | 421 | Admin zone create/update + audit |
| `adminCorrectReservation(input)` | 438 | Admin reservation status correction + audit |
| `listAdminExceptions()` | 456 | List reservation changes in `error` status |
| `recordAdminAudit(input)` | 467 | Write an admin audit event |
| `createAuditSnapshot(type, payload)` | 479 | Deep-clone + freeze audit payload |

### Data models (`apps/backend/src/modules/transport/models/`)

| Model file | Table | Key fields |
|---|---|---|
| `zone.ts` | `transport_zone` | id, name, active (default `false`) |
| `zone-cell.ts` | `transport_zone_cell` | id, zone_id, cell, resolution |
| `vehicle-class.ts` | `transport_vehicle_class` | id, name, active (DEPRECATED — do not build on; see `odd/decisions.md`) |
| `reservation.ts` | `transport_reservation` | order_id, cart_id, line_item_id, status, quote_snapshot, order_snapshot, confirmed_at |
| `reservation-hold.ts` | `transport_reservation_hold` | quote_id, cart_id, status, expires_at, reservation_id |
| `reservation-change.ts` | `transport_reservation_change` | reservation_id, change_request_id, status, delta_amount, payment/refund status, quote snapshots |
| `provider-event.ts` | `transport_provider_event` | provider_event_id, change_request_id, provider_status, change_id |
| `audit-event.ts` | `transport_audit_event` | reservation_id, event_type, snapshot |

### Registered links (`apps/backend/src/links/`)

| Path | Links |
|---|---|
| `transport-reservation-order.ts` | `transportReservation` ↔ Medusa `order` (defineLink) |

### Migrations

- Module migrations: `apps/backend/src/modules/transport/migrations/*.ts`
- Link sync + module migrations are applied by `npx medusa db:migrate`.

## 3. API surface

### Admin routes (`apps/backend/src/api/admin/`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/custom` | Medusa starter placeholder; returns 200 |
| GET | `/admin/transport/exceptions` | List reservation changes in `error` status (auth required) |
| POST | `/admin/transport/fares/corrections` | Create a fare price set + audit (auth required) |
| POST | `/admin/transport/reservations/[id]/changes` | Request a reservation change → 202, or 409 on error (auth required) |
| POST | `/admin/transport/reservations/[id]/corrections` | Correct reservation status (`confirmed`/`cancelled`) + audit (auth required) |
| POST | `/admin/transport/zones/[id]/corrections` | Correct zone name/active + audit (auth required) |
| — | `apps/backend/src/api/admin/transport/admin-helpers.ts` | Shared auth/validation helpers (`requireAdminActor`, `requiredString`, `optionalBoolean`, `requiredAmount`, `reservationStatus`) — not a route |

### Store routes (`apps/backend/src/api/store/`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/store/custom` | Medusa starter placeholder; returns 200 |
| POST | `/store/transfers/quotes` | Resolve zone pair + fare → return a quote; seeds PUJ fixture zones on call |
| POST | `/store/transfers/carts` | Add a stored quote to a cart item via `addToCartWorkflow` |

- No `src/api/middlewares.ts` exists (no custom route middleware).

## 4. Workflows

| Path | Purpose |
|---|---|
| `apps/backend/src/workflows/transport/resolve-transfer-fare.ts` | Thin wrapper over `transportService.resolveTransferFare` |
| `apps/backend/src/workflows/transport/quote-cart.ts` | `createTransferQuote` (resolve fare → snapshot) and `addTransferQuoteToCart` (add snapshot to cart) |
| `apps/backend/src/workflows/transport/confirm-reservation.ts` | Thin wrapper over `transportService.confirmTransferReservation` |
| `apps/backend/src/workflows/transport/request-reservation-change.ts` | `requestTransferReservationChange` and `handleTransferChangeProviderEvent` wrappers |
| `apps/backend/src/workflows/README.md` | Medusa starter documentation, not executable |

- Workflows are plain async functions (not `createWorkflow`); business logic lives in the module service.

## 5. Admin UI

| Path | Purpose |
|---|---|
| `apps/backend/src/admin/README.md` | Medusa starter documentation |
| `apps/backend/src/admin/i18n/index.ts` | Placeholder i18n export (`export default {}`) |
| `apps/backend/src/admin/tsconfig.json` | Admin Vite/TS config |
| `apps/backend/src/admin/vite-env.d.ts` | Vite type shims |

- No custom admin widgets or pages exist (no `widgets/`, no `routes/` under `src/admin/`).
- Admin API routes exist (§3) but are not surfaced by any custom admin UI.

## 6. Tests

| Kind | Location | Files |
|---|---|---|
| Unit | `apps/backend/src/**/__tests__/**/*.unit.spec.ts` | `src/modules/transport/__tests__/zone.unit.spec.ts` |
| Integration (modules) | `apps/backend/src/modules/*/__tests__/**/*.[jt]s` | `changes.integration.spec.ts`, `pricing.integration.spec.ts`, `reservation.integration.spec.ts` |
| Integration (HTTP) | `apps/backend/src/api/**/__tests__/**/*.http.spec.ts` and `apps/backend/integration-tests/http/*.spec.ts` | `admin/transport/__tests__/admin-transport.http.spec.ts`, `store/transfers/__tests__/quote-cart.http.spec.ts` |
| Jest setup | `apps/backend/integration-tests/setup.js` | Clears MikroORM `MetadataStorage` before tests |

Prerequisites:

- Running PostgreSQL on `localhost:5432` (verified: postgresql@14 via Homebrew).
- `DATABASE_URL` set in `apps/backend/.env` for the app; tests create their own databases.
- `DB_USERNAME=solis` is REQUIRED for both integration commands on this machine (default `postgres` role does not exist).
- Unit tests need no database.

## 7. Configuration

| Path | Contents |
|---|---|
| `apps/backend/medusa-config.ts` | Registers only `./src/modules/transport` with option `h3Resolution` (env `TRANSPORT_H3_RESOLUTION`, default 9); sets DB URL + HTTP CORS/JWT/cookie from env |
| `apps/backend/.env` | Local secrets (gitignored) — names only: `MEDUSA_ADMIN_ONBOARDING_TYPE`, `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`, `REDIS_URL`, `JWT_SECRET`, `COOKIE_SECRET`, `AUTH_MFA_ENCRYPTION_KEY`, `DATABASE_URL` |
| `apps/backend/.env.template` | Committed template — names only: `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS`, `REDIS_URL`, `JWT_SECRET`, `COOKIE_SECRET`, `DATABASE_URL`, `DB_NAME` |
| `apps/backend/instrumentation.ts` | OpenTelemetry hook, fully commented out (inactive) |
| `apps/backend/jest.config.js` | Loads `.env.test`, selects `testMatch` by `TEST_TYPE` |
| `apps/backend/eslint.config.ts` | References `@medusajs/eslint-plugin` (package not installed → lint unavailable) |
| `apps/backend/tsconfig.json` | Node16, decorators, output `.medusa/server` |

External service wiring:

- None configured beyond PostgreSQL and Medusa's native modules.
- No Redis module is registered in `medusa-config.ts`; `REDIS_URL` is present in env but unused (build logs report a fake Redis instance).
- Native Medusa Pricing is the fare source, accessed via `scope.resolve("pricing")` / `Modules.PRICING`.

## 8. Documents

| Path | Status |
|---|---|
| `docs/product/airport-transfer-prd.md` | Draft PRD for the single-provider airport-transfer platform |
| `openspec/config.yaml` | HISTORICAL SDD config — not an active workflow |
| `openspec/specs/transfer-fare-pricing/spec.md` | HISTORICAL SDD spec |
| `openspec/specs/transfer-reservation-lifecycle/spec.md` | HISTORICAL SDD spec |
| `openspec/specs/transport-admin-operations/spec.md` | HISTORICAL SDD spec |
| `openspec/specs/transfer-zone-modeling/spec.md` | HISTORICAL SDD spec |
| `openspec/specs/transfer-change-operations/spec.md` | HISTORICAL SDD spec |
| `openspec/specs/transfer-quote-cart/spec.md` | HISTORICAL SDD spec |
| `openspec/changes/archive/2026-09-13-airport-transfer-mvp/*` | HISTORICAL archived SDD change (proposal, design, tasks, verify, archive, specs) |
| `odd/decisions.md` | Active append-only decision log |
| `odd/index.md` | This file |

- `openspec/**` and `docs/features/` are retained in git as historical record only. ODD is the active workflow. `docs/features/` no longer exists on disk.

## 9. Verification commands (currently working)

| Purpose | Command | Observed result (2026-09-18) |
|---|---|---|
| Unit tests | `cd apps/backend && pnpm run test:unit` | PASS — 1 suite, 5 tests |
| Unit tests (root) | `pnpm test` | Runs backend unit tests only |
| Integration (modules) | `cd apps/backend && DB_USERNAME=solis pnpm run test:integration:modules` | PASS — 4 suites, 16 tests |
| Integration (HTTP) | `cd apps/backend && DB_USERNAME=solis pnpm run test:integration:http` | PASS — 2 suites, 9 tests |
| Type check + build | `cd apps/backend && npx medusa build` | Backend + frontend build succeeded |

- `medusa lint` / `pnpm run lint` is NOT usable: `eslint` is not installed (no `eslint` binary in `node_modules/.bin`). Do not cite it as a gate.
- `test:integration:http` FAILS without `DB_USERNAME=solis` (error: `role "postgres" does not exist`).
- `test:integration:modules` also requires `DB_USERNAME=solis` and a running PostgreSQL.
- Test runs print transient `Connection Error: Connection ended unexpectedly` logs; suites still pass.

## Known gotchas

- `importZoneCells` / zone lookup / quote snapshots are stored in in-memory `Map`s on the service, not persisted; only `adminCorrectZone` writes zones to the database. Fixture zones are reseeded on each `POST /store/transfers/quotes`.
- Fare rule attributes currently used: `origin_zone_id`, `destination_zone_id`, `vehicle_class_id` (`service.ts` `TRANSFER_FARE_RULES`).
- The Phase-0 pricing adapter `src/modules/transport/pricing/native-transport-pricing.ts` referenced in `odd/decisions.md` is NOT in the current tree (lives on `spike/phase-0-transport-pricing-validation`).
- `legacy/admin-vehicle-classes` is a separate branch and is NOT part of the current tree.
- No subscribers exist (`src/subscribers/` has only `README.md`); the only scheduled job is `src/jobs/expire-transfer-holds.ts` (every 60s).
