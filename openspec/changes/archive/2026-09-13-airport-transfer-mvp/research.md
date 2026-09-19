# SDD Research: airport-transfer-mvp

schemaName: gentle-ai.sdd-research/v1
revision: 4
outcome: done
change: airport-transfer-mvp

## Selected Request
One bounded documentation-only recovery pass against current official Medusa v2 and H3 documentation. Validate only: (1) Medusa contextual/custom pricing primitives and fare-matrix documentation gaps; (2) H3 size and containment/boundary behavior without selecting a PUJ resolution; and (3) Medusa order-edit, payment/refund, and workflow primitives without inventing reservation-specific webhook idempotency.

## Questions
1. Which Medusa primitives support server-calculated custom prices on real variants and contextual pricing, and what remains undocumented for fare-matrix overlap, tie-breaking, and scale?
2. Which H3 cell-size and containment/boundary behaviors matter for operational zones without prescribing a PUJ resolution?
3. Which Medusa order-edit, payment/refund, and workflow primitives are documented, and which reservation-specific idempotency assumptions are unsupported?

## Admission
- capability_schema: gentle-ai.sdd-research-capability/v1
- schema_valid: true
- requested_classes: [documentation]
- authoritative_runtime_grants: documentation=[context7_resolve-library-id, context7_query-docs]; open-web=[]
- admitted_classes: [documentation]
- admission: granted
- bounded_passes_executed: 1
- source_limits: maximum two authoritative source records per domain

## Sources
### MED-PRICE-1
- class: documentation
- title: Pricing Module — Price Rules
- publisher: Medusa
- URL: https://docs.medusajs.com/resources/commerce-modules/pricing/price-rules
- accessed_at: 2026-09-11
- excerpt: Price sets can contain prices conditional on rule attributes; official examples attach customer-group rules to product-variant prices and also show location-oriented contextual attributes.

### MED-PRICE-2
- class: documentation
- title: Custom Item Price
- publisher: Medusa
- URL: https://docs.medusajs.com/resources/examples/guides/custom-item-price
- accessed_at: 2026-09-11
- excerpt: A server workflow retrieves cart and variant context, calculates an external/custom amount, locks the cart, and invokes addToCartWorkflow with the real variant_id and unit_price.

### H3-SIZE-1
- class: documentation
- title: H3 Resolution Table
- publisher: Uber H3
- URL: https://h3geo.org/docs/core-library/restable/
- accessed_at: 2026-09-11
- excerpt: H3 publishes resolution-indexed average hexagon area and average edge length; the corresponding APIs describe these as averages and exclude pentagons.

### H3-REGION-2
- class: documentation
- title: H3 Regions API
- publisher: Uber H3
- URL: https://h3geo.org/docs/api/regions/
- accessed_at: 2026-09-11
- excerpt: polygonToCells uses cell-center containment; the experimental API exposes center, full, overlap, and bounding-box-overlap containment modes.

### MED-ORDER-1
- class: documentation
- title: Order Edit
- publisher: Medusa
- URL: https://docs.medusajs.com/resources/commerce-modules/order/edit
- accessed_at: 2026-09-11
- excerpt: Order changes/actions support edits; confirming an edit increments the order version, and payment or refund consequences are derived by comparing the updated order summary with existing transactions.

### MED-WORKFLOW-2
- class: documentation
- title: Workflow Engine — How to Use
- publisher: Medusa
- URL: https://docs.medusajs.com/resources/architectural-modules/workflow-engine/how-to-use
- accessed_at: 2026-09-11
- excerpt: Workflow steps can define execution and compensation; workflow transaction steps expose retry, timeout, asynchronous, and failure-handling controls, while engine step status uses transaction/workflow/step idempotency coordinates.

## Validated Claims
1. Medusa supports contextual prices by attaching rules to prices in a price set, including price sets associated with product variants. [MED-PRICE-1]
2. Medusa supports a server-calculated custom unit price on a cart item that still references a real variant: the documented workflow calculates the amount server-side and passes variant_id plus unit_price through addToCartWorkflow under a cart lock. [MED-PRICE-2]
3. The admitted pricing pages do not define a transport fare-matrix overlap policy, deterministic tie-break rule for multiple fare candidates, or supported performance/cardinality limit for a large origin-by-destination-by-vehicle matrix. Those remain application validation concerns, not documented guarantees. [MED-PRICE-1, MED-PRICE-2]
4. H3 resolution determines published average hexagon area and average edge length, but those figures are averages rather than guarantees for a specific PUJ cell and exclude pentagons in the documented average APIs. [H3-SIZE-1]
5. Standard polygonToCells selects cells whose centroids are contained by the polygon; experimental containment modes distinguish center-contained, fully contained, overlapping, and bounding-box-overlapping cells. Therefore operational boundary inclusion depends on an explicit policy. [H3-REGION-2]
6. H3 cell boundaries at one selected resolution are concrete, while hierarchical geographic containment across resolutions is approximate; operational validation must test real addresses and boundary cases rather than infer exact zone fidelity from parent-child hierarchy. [H3-REGION-2, H3-SIZE-1]
7. Medusa order edits provide order-change actions and confirmation semantics; confirmation increments order version and Medusa derives required payment/refund consequences from the changed summary relative to existing transactions. [MED-ORDER-1]
8. Medusa exposes order payment-collection and payment/refund handling as commerce primitives around changed order totals, but the business policy deciding whether a reservation change is allowed, repriced, charged, credited, or refunded is not supplied by those primitives. [MED-ORDER-1]
9. Medusa workflows support multi-step execution with compensation and configurable retries/timeouts/failure behavior; workflow-engine idempotency coordinates are transaction-step mechanics, not a documented reservation-level deduplication identity. [MED-WORKFLOW-2]
10. Neither admitted Medusa lifecycle source specifies reservation-specific webhook deduplication keys, provider-event retention, or the business identity that makes repeated reservation-change/payment events equivalent. Those must remain pending and be designed explicitly. [MED-ORDER-1, MED-WORKFLOW-2]

## Contradictions
- None found between the admitted official sources within this bounded pass.

## Uncertainty
- Medusa documentation confirms primitives, not fitness or performance for a production-scale directed fare matrix.
- The pricing source set does not establish precedence for overlapping transport fare rules; a spike must measure and define deterministic behavior before adopting a storage mechanism.
- H3 averages do not choose a PUJ resolution or operational boundary policy; local address, road-access, coastline, airport-property, and edge-case validation remains necessary.
- Order-edit and workflow primitives do not define reservation product policy, payment-provider behavior, refund timing, webhook replay retention, or business idempotency identity.

## Freshness
- assessed_at: 2026-09-11
- source_policy: Current official documentation retrieved through the admitted Context7 documentation tools only; no open-web evidence was requested or admitted.

## Product Choices
- authoritative: false
- confirmed:
  - H3 is included from the start.
- pending:
  - fare storage and rule mechanism
  - exact H3 resolution
  - operational zone boundary policy
  - policy for reservation changes that alter price
  - payment and refund policy/provider behavior
  - business idempotency identity and webhook deduplication design
- note: Evidence validates available primitives and constraints; it does not decide pending product choices.

## Recovery State
- retained_selected_intent: true
- retained_canonical_desired_content: true
- prior_research_reference: engram observation #2251 revision 3
- blocker: none
- automatic_retry_allowed: false
- continuation: Return control to the orchestrator after persistence readback. Do not broaden research or launch another pass.
