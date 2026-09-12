import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import path from "path"

import { TransferFarePricingAccess } from "../service"
import { resolveTransferFare } from "../../../workflows/transport/resolve-transfer-fare"

const medusaPackageRoot = path.dirname(require.resolve("@medusajs/medusa/package.json"))
const pricingModuleResolve = medusaPackageRoot.replace(
  `${path.sep}@medusajs${path.sep}medusa`,
  `${path.sep}@medusajs${path.sep}pricing`
)

type PricingModuleService = TransferFarePricingAccess & {
  createPriceSets: (input: {
    prices: Array<{
      amount: number
      currency_code: string
      rules: Record<string, string>
    }>
  }) => Promise<{ id: string }>
}

const currencyCode = "usd"

const inputFor = (scenario: string) => ({
  origin_zone_id: `zone-origin-${scenario}`,
  destination_zone_id: `zone-destination-${scenario}`,
  vehicle_class_id: `vehicle-${scenario}`,
  currency_code: currencyCode,
})

const createFare = async (
  pricingModuleService: PricingModuleService,
  input: ReturnType<typeof inputFor>,
  amount: number,
  overrides: Partial<ReturnType<typeof inputFor>> = {}
) => {
  const rulesInput = {
    ...input,
    ...overrides,
  }

  return pricingModuleService.createPriceSets({
    prices: [
      {
        amount,
        currency_code: currencyCode,
        rules: {
          origin_zone_id: rulesInput.origin_zone_id,
          destination_zone_id: rulesInput.destination_zone_id,
          vehicle_class_id: rulesInput.vehicle_class_id,
        },
      },
    ],
  })
}

moduleIntegrationTestRunner<PricingModuleService>({
  moduleName: Modules.PRICING,
  resolve: pricingModuleResolve,
  testSuite: ({ service }) => {
    describe("production transfer fare pricing rules", () => {
      it("returns exactly one active directed fare from persisted Medusa price rules", async () => {
        const input = inputFor("single")
        await createFare(service, input, 6400, {
          origin_zone_id: input.destination_zone_id,
          destination_zone_id: input.origin_zone_id,
        })
        const matchingPriceSet = await createFare(service, input, 5200)

        const result = await resolveTransferFare({
          input,
          pricingModuleService: service,
        })

        expect(result).toEqual({
          status: "priced",
          fare: {
            price_set_id: matchingPriceSet.id,
            price_id: expect.any(String),
            amount: 5200,
            currency_code: currencyCode,
            origin_zone_id: input.origin_zone_id,
            destination_zone_id: input.destination_zone_id,
            vehicle_class_id: input.vehicle_class_id,
          },
        })
      })

      it("returns unavailable without a quote when no persisted active fare matches", async () => {
        const input = inputFor("none")
        await createFare(service, input, 4100, {
          vehicle_class_id: "vehicle-sedan",
        })

        const result = await resolveTransferFare({
          input,
          pricingModuleService: service,
        })

        expect(result).toEqual({
          status: "unavailable",
          reason: "no_active_fare",
        })
      })

      it("returns ambiguous without a quote when multiple persisted active fares match", async () => {
        const input = inputFor("multiple")
        await createFare(service, input, 5200)
        await createFare(service, input, 5400)

        const result = await resolveTransferFare({
          input,
          pricingModuleService: service,
        })

        expect(result).toEqual({
          status: "unavailable",
          reason: "ambiguous_active_fare",
        })
      })

      it("measures a representative persisted pricing-rule fixture matrix", async () => {
        const input = inputFor("representative")
        for (let index = 0; index < 48; index++) {
          await createFare(service, input, 3000 + index, {
            origin_zone_id: `zone-origin-representative-${index}`,
            destination_zone_id: `zone-destination-representative-${index}`,
            vehicle_class_id: index === 31 ? input.vehicle_class_id : "vehicle-sedan",
          })
        }
        await createFare(service, input, 5700)

        const startedAt = performance.now()
        const result = await resolveTransferFare({
          input,
          pricingModuleService: service,
        })
        const elapsedMs = performance.now() - startedAt

        expect(result.status).toBe("priced")
        expect(result.status === "priced" ? result.fare.amount : undefined).toBe(5700)
        expect(elapsedMs).toBeLessThan(500)
      })
    })
  },
})

jest.setTimeout(60 * 1000)
