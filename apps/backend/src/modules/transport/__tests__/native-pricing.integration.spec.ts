/**
 * Phase 0 — native transport pricing integration evidence.
 *
 * Verified Medusa 2.20.1 API (recorded per task 1.2):
 *
 * 1. `pricing.createPriceSets({ prices: [{ amount, currency_code, rules }] })`
 *    persists a price set whose prices carry arbitrary custom rule attributes
 *    (`origin_zone_id`, `destination_zone_id`, `vehicle_variant_id`).
 * 2. `pricing.calculatePrices({ id: [priceSetId] }, { context })` accepts those
 *    custom rule attributes in `context` and returns one calculated price per
 *    price set, ordered by `price_list_id IS NOT NULL DESC`,
 *    `rules_count DESC`, `amount ASC`. That ordering silently prefers a single
 *    "most relevant" price, so equal-context ambiguity must be counted
 *    independently (see `resolveNativeTransportPrice`).
 * 3. `pricing.listPrices({ price_set_id, currency_code }, { relations:
 *    ["price_rules", "price_list"] })` is the DB-level source for the
 *    deterministic rule count.
 * 4. A variant is linked to its price set through the
 *    `product_variant_price_set` link; `query.graph` exposes it as
 *    `product_variant.price_set`.
 * 5. `addToCartWorkflow` accepts `unit_price` on an item and keeps the
 *    product/variant relationship plus item metadata.
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

import {
  PHASE0_FIXTURE_ID_PREFIX,
  PHASE0_ZONE_PUJ,
  PHASE0_ZONE_PUNTA_CANA,
  addPhase0TransportLineItem,
  createPhase0AppliedPromotion,
  createPhase0Cart,
  createPhase0CommerceFixture,
  createPhase0FarePriceList,
  createPhase0FarePriceSet,
  createPhase0VehicleVariant,
  retrievePhase0Cart,
  type Phase0DirectedFare,
} from "../fixtures/native-fare-matrix"
import {
  resolveVariantPriceSetIds,
  resolveNativeTransportPrice,
  type NativeTransportPricingAccess,
  type NativeTransportPriceContext,
} from "../pricing/native-transport-pricing"
import { calculateTransportPriceWorkflow } from "../../../workflows/transport/calculate-transport-price"

jest.setTimeout(180 * 1000)

const ALT_CURRENCY = "dop"

const fare = (
  variantId: string,
  origin: string,
  destination: string,
  amount: number,
  currencyCode = "usd"
): Phase0DirectedFare => ({
  origin_zone_id: origin,
  destination_zone_id: destination,
  vehicle_variant_id: variantId,
  currency_code: currencyCode,
  amount,
})

const context = (
  variantId: string,
  origin = PHASE0_ZONE_PUJ,
  destination = PHASE0_ZONE_PUNTA_CANA,
  currencyCode = "usd"
): NativeTransportPriceContext => ({
  origin_zone_id: origin,
  destination_zone_id: destination,
  vehicle_variant_id: variantId,
  currency_code: currencyCode,
})

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("Phase 0 native transport pricing", () => {
      const pricingAccess = (container: any) =>
        container.resolve(Modules.PRICING) as unknown as NativeTransportPricingAccess

      const seedVehicles = async () => {
        const container = getContainer() as any
        const commerce = await createPhase0CommerceFixture(container, {
          currency_code: "usd",
        })
        const sedan = await createPhase0VehicleVariant(container, {
          title: "Sedan",
          sku: "SEDAN",
          shipping_profile_id: commerce.shipping_profile_id,
        })
        const van = await createPhase0VehicleVariant(container, {
          title: "Van",
          sku: "VAN",
          shipping_profile_id: commerce.shipping_profile_id,
        })

        return { container, commerce, sedan, van }
      }

      it("A1: resolves PUJ -> Punta Cana and Punta Cana -> PUJ as independent directed prices", async () => {
        const { container, sedan } = await seedVehicles()
        const priceSet = await createPhase0FarePriceSet(container, {
          variant_id: sedan.variant_id,
          fares: [
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 5200),
            fare(sedan.variant_id, PHASE0_ZONE_PUNTA_CANA, PHASE0_ZONE_PUJ, 4800),
          ],
        })

        const outbound = await resolveNativeTransportPrice({
          pricing: pricingAccess(container),
          price_set_ids: [priceSet.price_set_id],
          context: context(sedan.variant_id),
        })
        const reverse = await resolveNativeTransportPrice({
          pricing: pricingAccess(container),
          price_set_ids: [priceSet.price_set_id],
          context: context(
            sedan.variant_id,
            PHASE0_ZONE_PUNTA_CANA,
            PHASE0_ZONE_PUJ
          ),
        })

        expect(outbound.status).toBe("priced")
        expect(reverse.status).toBe("priced")
        expect(
          outbound.status === "priced" ? outbound.price.amount : undefined
        ).toBe(5200)
        expect(
          reverse.status === "priced" ? reverse.price.amount : undefined
        ).toBe(4800)
      })

      it("A1b: does not return the outbound price for the reverse direction", async () => {
        const { container, sedan } = await seedVehicles()
        const priceSet = await createPhase0FarePriceSet(container, {
          variant_id: sedan.variant_id,
          fares: [
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 5200),
          ],
        })

        const reverse = await resolveNativeTransportPrice({
          pricing: pricingAccess(container),
          price_set_ids: [priceSet.price_set_id],
          context: context(
            sedan.variant_id,
            PHASE0_ZONE_PUNTA_CANA,
            PHASE0_ZONE_PUJ
          ),
        })

        expect(reverse.status).toBe("no_price")
      })

      it("A2: two vehicle variants price the same directed pair differently", async () => {
        const { container, sedan, van } = await seedVehicles()
        const sedanPrices = await createPhase0FarePriceSet(container, {
          variant_id: sedan.variant_id,
          fares: [
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 5200),
          ],
        })
        const vanPrices = await createPhase0FarePriceSet(container, {
          variant_id: van.variant_id,
          fares: [
            fare(van.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 9000),
          ],
        })

        const sedanResult = await resolveNativeTransportPrice({
          pricing: pricingAccess(container),
          price_set_ids: [sedanPrices.price_set_id],
          context: context(sedan.variant_id),
        })
        const vanResult = await resolveNativeTransportPrice({
          pricing: pricingAccess(container),
          price_set_ids: [vanPrices.price_set_id],
          context: context(van.variant_id),
        })

        expect(
          sedanResult.status === "priced" ? sedanResult.price.amount : undefined
        ).toBe(5200)
        expect(
          vanResult.status === "priced" ? vanResult.price.amount : undefined
        ).toBe(9000)
      })

      it("A2b: vehicle_variant_id discriminates within a single price set", async () => {
        const { container, sedan, van } = await seedVehicles()
        const sharedPriceSet = await createPhase0FarePriceSet(container, {
          variant_id: sedan.variant_id,
          fares: [
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 5200),
            fare(van.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 9000),
          ],
        })

        const vanResult = await resolveNativeTransportPrice({
          pricing: pricingAccess(container),
          price_set_ids: [sharedPriceSet.price_set_id],
          context: context(van.variant_id),
        })

        expect(vanResult.status).toBe("priced")
        expect(
          vanResult.status === "priced" ? vanResult.price.amount : undefined
        ).toBe(9000)
        expect(
          vanResult.status === "priced"
            ? vanResult.price.rule.vehicle_variant_id
            : undefined
        ).toBe(van.variant_id)
      })

      it("A3: currency-specific prices resolve and never fall back to another currency", async () => {
        const { container, sedan } = await seedVehicles()
        const priceSet = await createPhase0FarePriceSet(container, {
          variant_id: sedan.variant_id,
          fares: [
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 5200, "usd"),
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 312000, ALT_CURRENCY),
          ],
        })

        const usdResult = await resolveNativeTransportPrice({
          pricing: pricingAccess(container),
          price_set_ids: [priceSet.price_set_id],
          context: context(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, "usd"),
        })
        const dopResult = await resolveNativeTransportPrice({
          pricing: pricingAccess(container),
          price_set_ids: [priceSet.price_set_id],
          context: context(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, ALT_CURRENCY),
        })
        const absentResult = await resolveNativeTransportPrice({
          pricing: pricingAccess(container),
          price_set_ids: [priceSet.price_set_id],
          context: context(sedan.variant_id, PHASE0_ZONE_PUNTA_CANA, PHASE0_ZONE_PUJ, ALT_CURRENCY),
        })

        expect(usdResult.status).toBe("priced")
        expect(
          usdResult.status === "priced" ? usdResult.price.amount : undefined
        ).toBe(5200)
        expect(
          usdResult.status === "priced" ? usdResult.price.currency_code : undefined
        ).toBe("usd")
        expect(dopResult.status).toBe("priced")
        expect(
          dopResult.status === "priced" ? dopResult.price.amount : undefined
        ).toBe(312000)
        expect(
          dopResult.status === "priced" ? dopResult.price.currency_code : undefined
        ).toBe(ALT_CURRENCY)
        expect(absentResult.status).toBe("no_price")
      })

      it("A4: equal-context equal-priority rules are ambiguous and return no quote", async () => {
        const { container, sedan } = await seedVehicles()
        const priceSet = await createPhase0FarePriceSet(container, {
          variant_id: sedan.variant_id,
          fares: [
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 5200),
          ],
        })

        // Two active override price lists carrying an identical directed
        // context. The native price hash distinguishes prices by price_list_id,
        // so this equal-priority ambiguity is reachable through the public API
        // even though two plain identical prices are de-duplicated by
        // `normalizePrices`.
        await createPhase0FarePriceList(container, {
          price_set_id: priceSet.price_set_id,
          type: "override",
          fares: [
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 4200),
          ],
        })
        await createPhase0FarePriceList(container, {
          price_set_id: priceSet.price_set_id,
          type: "override",
          fares: [
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 4000),
          ],
        })

        const result = await resolveNativeTransportPrice({
          pricing: pricingAccess(container),
          price_set_ids: [priceSet.price_set_id],
          context: context(sedan.variant_id),
        })

        expect(result.status).toBe("ambiguous")
        if (result.status === "ambiguous") {
          expect(result.matches).toHaveLength(2)
          expect(result.matches.every((match) => match.price_list_id)).toBe(true)
          // The native calculator still returns a single "most relevant" price,
          // which proves the detection does not rely on it.
          expect(result.native_selected_price_id).toEqual(expect.any(String))
          expect(result).not.toHaveProperty("price")
        }
      })

      it("A4b: a single matching rule is unambiguous", async () => {
        const { container, sedan } = await seedVehicles()
        const priceSet = await createPhase0FarePriceSet(container, {
          variant_id: sedan.variant_id,
          fares: [
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 5200),
          ],
        })

        const result = await resolveNativeTransportPrice({
          pricing: pricingAccess(container),
          price_set_ids: [priceSet.price_set_id],
          context: context(sedan.variant_id),
        })

        expect(result.status).toBe("priced")
      })

      it("A5: returns price set, price, and price list references for a quote snapshot", async () => {
        const { container, sedan } = await seedVehicles()
        const priceSet = await createPhase0FarePriceSet(container, {
          variant_id: sedan.variant_id,
          fares: [
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 5200),
          ],
        })
        const priceList = await createPhase0FarePriceList(container, {
          price_set_id: priceSet.price_set_id,
          type: "override",
          fares: [
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 4200),
          ],
        })

        const result = await resolveNativeTransportPrice({
          pricing: pricingAccess(container),
          price_set_ids: [priceSet.price_set_id],
          context: context(sedan.variant_id),
        })

        expect(result.status).toBe("priced")
        if (result.status === "priced") {
          expect(result.price.rule.price_set_id).toBe(priceSet.price_set_id)
          expect(result.price.rule.price_id).toEqual(expect.any(String))
          expect(result.price.rule.price_list_id).toBe(priceList.price_list_id)
        }
      })

      it("A5b: the workflow resolves the variant price set and returns the priced result", async () => {
        const { container, sedan } = await seedVehicles()
        await createPhase0FarePriceSet(container, {
          variant_id: sedan.variant_id,
          fares: [
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 5200),
          ],
        })

        const priceSetIds = await resolveVariantPriceSetIds(
          container.resolve("query"),
          sedan.variant_id
        )
        expect(priceSetIds).toHaveLength(1)

        const { result } = await calculateTransportPriceWorkflow(container).run({
          input: { context: context(sedan.variant_id) },
        })

        expect(result.status).toBe("priced")
        expect(result.status === "priced" ? result.price.amount : undefined).toBe(5200)
      })

      it("A6/A7: calculated price attaches to a cart item on a real variant and retains relationships", async () => {
        const { container, commerce, sedan } = await seedVehicles()
        const priceSet = await createPhase0FarePriceSet(container, {
          variant_id: sedan.variant_id,
          fares: [
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 5200),
          ],
        })
        const resolved = await resolveNativeTransportPrice({
          pricing: pricingAccess(container),
          price_set_ids: [priceSet.price_set_id],
          context: context(sedan.variant_id),
        })
        expect(resolved.status).toBe("priced")

        const cart = await createPhase0Cart(container, {
          region_id: commerce.region_id,
          country_code: commerce.country_code,
        })
        await addPhase0TransportLineItem(container, {
          cart_id: cart.id,
          variant_id: sedan.variant_id,
          unit_price: resolved.status === "priced" ? resolved.price.amount : 0,
          metadata: {
            transport_context: context(sedan.variant_id),
            transport_rule:
              resolved.status === "priced" ? resolved.price.rule : undefined,
          },
        })

        const storedCart = await retrievePhase0Cart(container, cart.id)
        const item = storedCart.items[0]

        expect(storedCart.id).toBe(cart.id)
        expect(item.product_id).toBe(sedan.product_id)
        expect(item.variant_id).toBe(sedan.variant_id)
        expect(Number(item.unit_price)).toBe(5200)
        expect(item.metadata.transport_context).toMatchObject({
          origin_zone_id: PHASE0_ZONE_PUJ,
          destination_zone_id: PHASE0_ZONE_PUNTA_CANA,
          vehicle_variant_id: sedan.variant_id,
          currency_code: "usd",
        })
        expect(item.metadata.transport_rule.price_id).toEqual(expect.any(String))
      })

      it("A8: promotions and taxes keep operating on the transport-priced cart", async () => {
        const { container, commerce, sedan } = await seedVehicles()
        const priceSet = await createPhase0FarePriceSet(container, {
          variant_id: sedan.variant_id,
          fares: [
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 5200),
          ],
        })
        const resolved = await resolveNativeTransportPrice({
          pricing: pricingAccess(container),
          price_set_ids: [priceSet.price_set_id],
          context: context(sedan.variant_id),
        })
        const unitPrice = resolved.status === "priced" ? resolved.price.amount : 0

        const plainCart = await createPhase0Cart(container, {
          region_id: commerce.region_id,
          country_code: commerce.country_code,
        })
        await addPhase0TransportLineItem(container, {
          cart_id: plainCart.id,
          variant_id: sedan.variant_id,
          unit_price: unitPrice,
          metadata: { transport_context: context(sedan.variant_id) },
        })
        const promotedCart = await createPhase0Cart(container, {
          region_id: commerce.region_id,
          country_code: commerce.country_code,
        })
        await addPhase0TransportLineItem(container, {
          cart_id: promotedCart.id,
          variant_id: sedan.variant_id,
          unit_price: unitPrice,
          metadata: { transport_context: context(sedan.variant_id) },
        })
        await createPhase0AppliedPromotion(container, {
          cart_id: promotedCart.id,
          currency_code: "usd",
          value: 500,
        })

        const plain = await retrievePhase0Cart(container, plainCart.id)
        const promoted = await retrievePhase0Cart(container, promotedCart.id)

        // Tax keeps operating on the transport-priced line item.
        expect(Number(promoted.tax_total)).toBeGreaterThan(0)
        expect(Number(promoted.items[0].tax_total)).toBeGreaterThan(0)
        // The promotion keeps operating: it reduces the cart total.
        expect(Number(promoted.discount_total)).toBeGreaterThan(0)
        expect(Number(promoted.total)).toBeLessThan(Number(plain.total))
      })

      it("A9: repeating the same calculation returns identical amount and rule references", async () => {
        const { container, sedan } = await seedVehicles()
        const priceSet = await createPhase0FarePriceSet(container, {
          variant_id: sedan.variant_id,
          fares: [
            fare(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 5200),
          ],
        })

        const request = {
          pricing: pricingAccess(container),
          price_set_ids: [priceSet.price_set_id],
          context: context(sedan.variant_id),
        }

        const first = await resolveNativeTransportPrice(request)
        const second = await resolveNativeTransportPrice(request)

        expect(second).toEqual(first)
      })

      it("fixtures are marked as non-production data", async () => {
        const { container, sedan } = await seedVehicles()

        expect(sedan.sku.startsWith(PHASE0_FIXTURE_ID_PREFIX)).toBe(true)
        expect(sedan.title).not.toContain(PHASE0_FIXTURE_ID_PREFIX)

        const query = container.resolve("query")
        const { data } = await query.graph({
          entity: "product",
          fields: ["id", "metadata", "variants.metadata"],
          filters: { id: sedan.product_id },
        })

        expect(data[0].metadata.phase0_fixture).toBe(true)
        expect(data[0].variants[0].metadata.phase0_fixture).toBe(true)
      })
    })
  },
})
