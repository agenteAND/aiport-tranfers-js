import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ProductStatus } from "@medusajs/framework/utils"
import { createApiKeysWorkflow, createCartWorkflow, createProductsWorkflow, createRegionsWorkflow, createShippingProfilesWorkflow } from "@medusajs/medusa/core-flows"

import { PUJ_BOUNDARY_FIXTURES } from "../../../../modules/transport/fixtures/puj-boundary"

type PricingModuleService = {
  createPriceSets: (input: {
    prices: Array<{
      amount: number
      currency_code: string
      rules: Record<string, string>
    }>
  }) => Promise<{ id: string }>
}

const currencyCode = "usd"

const quoteFixture = PUJ_BOUNDARY_FIXTURES[0]
const destinationFixture = PUJ_BOUNDARY_FIXTURES[1]

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("store transfer quote to cart", () => {
      const createVariantAndCart = async () => {
        const container = getContainer()
        const pricing = container.resolve("pricing") as PricingModuleService
        const {
          result: [shippingProfile],
        } = await createShippingProfilesWorkflow(container).run({
          input: { data: [{ name: "Transfer Shipping", type: "default" }] },
        })

        const {
          result: [region],
        } = await createRegionsWorkflow(container).run({
          input: {
            regions: [{ name: "Transfer Region", currency_code: currencyCode, countries: ["do"], payment_providers: ["pp_system_default"] }],
          },
        })
        const {
          result: [product],
        } = await createProductsWorkflow(container).run({
          input: {
            products: [
              {
                title: "Airport Transfer",
                status: ProductStatus.PUBLISHED,
                shipping_profile_id: shippingProfile.id,
                options: [{ title: "Vehicle", values: ["Van"] }],
                variants: [{ title: "Van", sku: `TRANSFER-VAN-${Date.now()}`, options: { Vehicle: "Van" }, manage_inventory: false, prices: [{ amount: 1, currency_code: currencyCode }] }],
              },
            ],
          },
        })
        const {
          result: cart,
        } = await createCartWorkflow(container).run({
          input: { region_id: region.id },
        })
        const variantId = product.variants![0].id

        await pricing.createPriceSets({
          prices: [
            {
              amount: 5200,
              currency_code: currencyCode,
              rules: { origin_zone_id: quoteFixture.expectedZoneId, destination_zone_id: destinationFixture.expectedZoneId, vehicle_class_id: variantId },
            },
          ],
        })

        const {
          result: [publishableApiKey],
        } = await createApiKeysWorkflow(container).run({
          input: {
            api_keys: [{ title: `Transfer Store Key ${Date.now()}`, type: "publishable", created_by: "quote-cart-test" }],
          },
        })

        return { cartId: cart.id, variantId, publishableKey: publishableApiKey.token }
      }

      const storeHeaders = (publishableKey: string) => ({
        headers: { "x-publishable-api-key": publishableKey },
      })

      const quotePayload = (vehicleClassId: string) => ({
        origin: { lat: quoteFixture.lat, lng: quoteFixture.lng },
        destination: { lat: destinationFixture.lat, lng: destinationFixture.lng },
        vehicle_class_id: vehicleClassId,
        currency_code: currencyCode,
      })

      const postQuote = (vehicleClassId: string, publishableKey: string) =>
        api.post(
          "/store/transfers/quotes",
          quotePayload(vehicleClassId),
          storeHeaders(publishableKey)
        )

      const postQuoteToCart = (
        cartId: string,
        quoteId: string,
        publishableKey: string
      ) => api.post("/store/transfers/carts", { cart_id: cartId, quote_id: quoteId }, storeHeaders(publishableKey))

      it("returns a server-priced transfer quote for a valid fare", async () => {
        const { variantId, publishableKey } = await createVariantAndCart()

        const response = await postQuote(variantId, publishableKey)

        expect(response.status).toBe(200)
        expect(response.data.quote).toEqual(
          expect.objectContaining({
            amount: 5200,
            currency_code: currencyCode,
            origin_zone_id: quoteFixture.expectedZoneId,
            destination_zone_id: destinationFixture.expectedZoneId,
            variant_id: variantId,
          })
        )
      })

      it("rejects unavailable fares before creating a quote", async () => {
        const { variantId, publishableKey } = await createVariantAndCart()

        await expect(
          postQuote(`${variantId}-unpriced`, publishableKey)
        ).rejects.toMatchObject({
          response: {
            status: 400,
            data: expect.objectContaining({
              message: "No transfer fare is available for this trip.",
            }),
          },
        })
      })

      it("adds an accepted quote to a real Medusa cart with the immutable quoted price", async () => {
        const { cartId, variantId, publishableKey } = await createVariantAndCart()
        const quoteResponse = await postQuote(variantId, publishableKey)

        const response = await postQuoteToCart(
          cartId,
          quoteResponse.data.quote.quote_id,
          publishableKey
        )

        expect(response.status).toBe(200)
        expect(response.data.cart.items).toHaveLength(1)
        expect(response.data.cart.items[0]).toEqual(
          expect.objectContaining({
            variant_id: variantId,
            quantity: 1,
            unit_price: 5200,
            metadata: expect.objectContaining({
              transfer_quote_id: quoteResponse.data.quote.quote_id,
              transfer_quote_snapshot: expect.objectContaining({ amount: 5200 }),
            }),
          })
        )
      })

      it("returns the existing transfer line when the same accepted quote is retried", async () => {
        const { cartId, variantId, publishableKey } = await createVariantAndCart()
        const quoteResponse = await postQuote(variantId, publishableKey)

        await postQuoteToCart(cartId, quoteResponse.data.quote.quote_id, publishableKey)
        const retryResponse = await postQuoteToCart(
          cartId,
          quoteResponse.data.quote.quote_id,
          publishableKey
        )

        expect(retryResponse.status).toBe(200)
        expect(retryResponse.data.cart.items).toHaveLength(1)
        expect(retryResponse.data.cart.items[0].variant_id).toBe(variantId)
      })
    })
  },
})

jest.setTimeout(60 * 1000)
