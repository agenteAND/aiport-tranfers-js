# Decision Log

Append-only. One entry per decision: date, decision, why, alternatives rejected.

Newest first.

---

## 2026-09-18 — Adopt ODD, abandon SDD

**Decision:** The project uses ODD (Organic Driven Development) as its only workflow. SDD artifacts and ceremony are removed.

**Why:** SDD's phase machine (preflight, proposal, spec, design, tasks, apply, verify, archive, review workload gates) consumed disproportionate tokens and time relative to delivered behavior. Most phases produced documents that restated already-known requirements.

**Alternatives rejected:** Keeping SDD for "Full" changes only — rejected because the classification itself added ceremony without changing outcomes. Keeping OpenSpec artifact requirements — rejected as the durable context now lives in `odd/tasks/`, `odd/decisions.md`, and `odd/index.md`.

**Consequences:** `openspec/sdd-delivery-policy.md` deleted. The generated FDD corpus under `docs/features/` deleted. The archived OpenSpec changes and capability specs are retained in git as historical record only, not as a workflow.

---

## 2026-09-18 — Medusa products and variants replace a bespoke `TransportVehicleClass`

**Decision:** A sellable vehicle type is a Medusa product + variant. The custom `TransportVehicleClass` model (`id`, `name`, `active`) is deprecated and must not be built upon.

**Why:** The PRD requires every sellable vehicle type to link to a real Medusa product variant carrying capacity, luggage, images, active status, and service restrictions. `TransportVehicleClass` has none of that and no link to any product or variant. Medusa already ships admin product management, so the bespoke surface duplicated it in a thinner form.

**Alternatives rejected:** Extending `TransportVehicleClass` with capacity/luggage fields and linking it manually — rejected because it re-implements the Product and Pricing modules. Keeping it as an operational grouping — rejected because the PRD defines no such grouping.

**Consequences:** The vehicle-class work is preserved on branch `legacy/admin-vehicle-classes` (commit `2fc3142`) and is not a foundation. Existing fare rules that key on `vehicle_class_id` migrate to `vehicle_variant_id` in Phase 1.

---

## 2026-09-16 — Adopt the native Medusa Pricing Module for directed transport fares

**Decision:** Directed transport prices resolve through Medusa's native Pricing Module using the rule attributes `origin_zone_id`, `destination_zone_id`, `vehicle_variant_id`, and `currency_code`. No dedicated fare-matrix entity.

**Why:** Phase 0 validation passed all 9 required assertions with executable evidence: independent directed prices, vehicle-specific prices, currency-specific prices with no cross-currency fallback, deterministic ambiguity rejection, quote-snapshot rule references, cart integration on a real variant, retained product/variant/price/metadata, working promotions and taxes, and deterministic repeats. Internal calculation p95 measured 7-19 ms against the PRD target of 250 ms.

**Alternatives rejected:** A dedicated fare-matrix fallback — not required by the evidence; it stays unimplemented and would need its own proposal.

**Consequences:** Reusable adapter at `apps/backend/src/modules/transport/pricing/native-transport-pricing.ts`. The bespoke `resolveTransferFare` in `service.ts` remains authoritative until Phase 1 migrates it. Delivered as PR #1 on branch `spike/phase-0-transport-pricing-validation`.

---

## 2026-09-16 — Ambiguity detection cannot rely on `calculatePrices`

**Decision:** Equal-context, equal-priority fare rules are detected by explicitly counting persisted matching rules, not by inspecting the native calculation result.

**Why:** Medusa's `calculatePrices` supports partial matches and silently returns one "most relevant" price per price set, ordered by `price_list_id IS NOT NULL DESC`, then `rules_count DESC`, then `amount ASC`. Equal-context duplicates are therefore invisible in its return value. Additionally, `normalizePrices`/`hashPrice` de-duplicates identical plain prices, so equal-priority ambiguity is only reachable through a genuine priority tie such as two active override price lists.

**Alternatives rejected:** Trusting the native result — rejected because it silently quotes one of several equal-context prices, which violates the requirement to refuse such quotes.

---

## Established (pre-ODD, still in force)

- **Architecture:** Module → Workflow → API Route. Mutations go through workflows; business logic lives in workflow steps, never in routes. Only `GET`, `POST`, `DELETE` — never `PUT`/`PATCH`.
- **Money:** prices are stored as-is; never multiply or divide by 100. Currency codes are lowercase.
- **Zone modeling:** H3 cell indices via `h3-js`, stored in PostgreSQL as ordinary indexed columns. PostGIS is not required for the MVP.
- **Integration tests:** jest with `TEST_TYPE=integration:modules` and `DB_USERNAME=solis`; specs live under `apps/backend/src/modules/*/__tests__/`.
