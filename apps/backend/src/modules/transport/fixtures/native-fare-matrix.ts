/**
 * Phase 0 native transport pricing fixtures.
 *
 * This module builds throwaway commerce data (shipping profile, region, tax
 * region, product variants, directed fare price sets, promotion) used to prove
 * that Medusa's native Pricing Module can resolve directed transport fares.
 *
 * Everything produced here is NON-PRODUCTION test data:
 * - generated identifiers use the `phase0_nonprod_` prefix, and
 * - supported records carry `metadata.phase0_fixture = true`.
 *
 * The module lives outside any `__tests__` directory because the
 * `integration:modules` jest project collects that whole tree.
 */

import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  addToCartWorkflow,
  createCartWorkflow,
  createProductsWorkflow,
  createPromotionsWorkflow,
  createRegionsWorkflow,
  createShippingProfilesWorkflow,
  createTaxRatesWorkflow,
  createTaxRegionsWorkflow,
  updateCartPromotionsWorkflow,
} from "@medusajs/medusa/core-flows"

import { resolveVariantPriceSetIds } from "../pricing/native-transport-pricing"

export const PHASE0_FIXTURE_ID_PREFIX = "phase0_nonprod_"

export const PHASE0_FIXTURE_METADATA = {
  phase0_fixture: true,
} as const

/** Zone identifiers used by the directed fare fixtures. */
export const PHASE0_ZONE_PUJ = `${PHASE0_FIXTURE_ID_PREFIX}zone-puj`
export const PHASE0_ZONE_PUNTA_CANA = `${PHASE0_FIXTURE_ID_PREFIX}zone-punta-cana`

export type Phase0DirectedFare = {
  origin_zone_id: string
  destination_zone_id: string
  vehicle_variant_id: string
  currency_code: string
  amount: number
}

export type Phase0CommerceFixture = {
  currency_code: string
  country_code: string
  shipping_profile_id: string
  region_id: string
  tax_region_id: string
  tax_rate_id: string
}

export type Phase0VehicleFixture = {
  product_id: string
  variant_id: string
  sku: string
  title: string
}

export type Phase0FarePriceSetFixture = {
  price_set_id: string
  variant_id: string
  prices: Array<{
    id: string
    amount: number
    currency_code: string
    rules: Record<string, string>
  }>
}

type Container = {
  resolve: (key: string) => unknown
}

type PricingFixtureAccess = {
  createPriceSets: (input: {
    prices: Array<{
      title?: string
      amount: number
      currency_code: string
      rules?: Record<string, string>
    }>
  }) => Promise<{ id: string; prices?: Array<{ id: string }> }>
  addPrices: (input: {
    priceSetId: string
    prices: Array<{
      title?: string
      amount: number
      currency_code: string
      rules?: Record<string, string>
    }>
  }) => Promise<unknown>
  createPriceLists: (input: Array<{
    title: string
    description?: string
    status?: string
    type?: string
    metadata?: Record<string, unknown>
    prices: Array<{
      price_set_id: string
      amount: number
      currency_code: string
      rules?: Record<string, string>
    }>
  }>) => Promise<Array<{ id: string }>>
  listPrices: (
    filters: Record<string, unknown>,
    config?: Record<string, unknown>
  ) => Promise<
    Array<{
      id: string
      currency_code?: string
      amount?: unknown
      price_rules?: Array<{ attribute: string; value: string }>
    }>
  >
}

type LinkFixtureAccess = {
  create: (data: Array<Record<string, Record<string, string>>>) => Promise<unknown>
}

type RegionFixtureAccess = {
  listRegions: (
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ) => Promise<
    Array<{
      id: string
      currency_code: string
      countries?: Array<{ iso_2?: string }>
    }>
  >
}

type TaxFixtureAccess = {
  listTaxRegions: (
    filters?: Record<string, unknown>
  ) => Promise<Array<{ id: string; country_code?: string }>>
  listTaxRates: (
    filters?: Record<string, unknown>
  ) => Promise<Array<{ id: string; is_default?: boolean }>>
}

const uniqueSuffix = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

const resolvePricing = (container: Container) =>
  container.resolve(Modules.PRICING) as PricingFixtureAccess

const resolveLink = (container: Container) =>
  container.resolve(ContainerRegistrationKeys.LINK) as LinkFixtureAccess

/**
 * Finds an existing region already owning the country. Medusa allows a country
 * to belong to exactly one region, so re-running the acceptance command against
 * a shared database must reuse it instead of failing.
 */
const findRegionForCountry = async (
  container: Container,
  countryCode: string
) => {
  const regionService = container.resolve(Modules.REGION) as RegionFixtureAccess
  const regions = await regionService.listRegions({}, { relations: ["countries"] })

  return regions.find((region) =>
    (region.countries ?? []).some(
      (country) => (country.iso_2 ?? "").toLowerCase() === countryCode
    )
  )
}

/**
 * Creates the commerce scaffolding required to price and tax a transport line
 * item: an active shipping profile, a region in the requested currency, a tax
 * region for the target country, and a default tax rate.
 *
 * Region and tax region are reused when the country is already assigned, which
 * keeps the documented acceptance command re-runnable against a shared
 * database.
 */
export const createPhase0CommerceFixture = async (
  container: Container,
  options: { currency_code?: string; country_code?: string; tax_rate?: number } = {}
): Promise<Phase0CommerceFixture> => {
  const requestedCurrency = (options.currency_code ?? "usd").toLowerCase()
  const countryCode = (options.country_code ?? "do").toLowerCase()
  const taxRate = options.tax_rate ?? 18
  const suffix = uniqueSuffix()

  const {
    result: [shippingProfile],
  } = await createShippingProfilesWorkflow(container as never).run({
    input: {
      data: [
        {
          name: `${PHASE0_FIXTURE_ID_PREFIX}shipping-${suffix}`,
          type: "default",
        },
      ],
    },
  })

  const existingRegion = await findRegionForCountry(container, countryCode)
  const currencyCode = (
    existingRegion?.currency_code ?? requestedCurrency
  ).toLowerCase()

  const region =
    existingRegion ??
    (
      await createRegionsWorkflow(container as never).run({
        input: {
          regions: [
            {
              name: `${PHASE0_FIXTURE_ID_PREFIX}region-${suffix}`,
              currency_code: currencyCode,
              countries: [countryCode],
              payment_providers: ["pp_system_default"],
              metadata: { ...PHASE0_FIXTURE_METADATA },
            },
          ],
        },
      })
    ).result[0]

  const taxService = container.resolve(Modules.TAX) as TaxFixtureAccess
  const existingTaxRegions = await taxService.listTaxRegions({
    country_code: countryCode,
  })

  const taxRegion =
    existingTaxRegions[0] ??
    (
      await createTaxRegionsWorkflow(container as never).run({
        input: [
          {
            country_code: countryCode,
            provider_id: "tp_system",
            metadata: { ...PHASE0_FIXTURE_METADATA },
          },
        ],
      })
    ).result[0]

  const existingTaxRates = await taxService.listTaxRates({
    tax_region_id: taxRegion.id,
  })
  const existingDefaultRate = existingTaxRates.find((rate) => rate.is_default)

  const taxRateRecord =
    existingDefaultRate ??
    (
      await createTaxRatesWorkflow(container as never).run({
        input: [
          {
            tax_region_id: taxRegion.id,
            name: `${PHASE0_FIXTURE_ID_PREFIX}tax-${suffix}`,
            code: `${PHASE0_FIXTURE_ID_PREFIX}tax-code-${suffix}`,
            rate: taxRate,
            is_default: true,
          },
        ],
      })
    ).result[0]

  return {
    currency_code: currencyCode,
    country_code: countryCode,
    shipping_profile_id: shippingProfile.id,
    region_id: region.id,
    tax_region_id: taxRegion.id,
    tax_rate_id: taxRateRecord.id,
  }
}

/**
 * Creates one published product with a single variant. The variant carries no
 * prices of its own; a dedicated directed-fare price set is linked afterwards.
 */
export const createPhase0VehicleVariant = async (
  container: Container,
  options: {
    title: string
    sku: string
    shipping_profile_id: string
  }
): Promise<Phase0VehicleFixture> => {
  const suffix = uniqueSuffix()
  const optionValue = options.title

  const {
    result: [product],
  } = await createProductsWorkflow(container as never).run({
    input: {
      products: [
        {
          title: `${PHASE0_FIXTURE_ID_PREFIX}${options.title}`,
          handle: `phase0-nonprod-${options.sku}-${suffix}`.toLowerCase(),
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: options.shipping_profile_id,
          metadata: { ...PHASE0_FIXTURE_METADATA },
          options: [{ title: "Vehicle", values: [optionValue] }],
          variants: [
            {
              title: optionValue,
              sku: `${PHASE0_FIXTURE_ID_PREFIX}${options.sku}-${suffix}`,
              options: { Vehicle: optionValue },
              manage_inventory: false,
              metadata: { ...PHASE0_FIXTURE_METADATA },
            },
          ],
        },
      ],
    },
  })

  const variant = product.variants?.[0]

  if (!variant?.id) {
    throw new Error("Phase 0 fixture could not create a product variant.")
  }

  return {
    product_id: product.id,
    variant_id: variant.id,
    sku: variant.sku ?? `${PHASE0_FIXTURE_ID_PREFIX}${options.sku}-${suffix}`,
    title: optionValue,
  }
}

/**
 * Adds the directed fare rules to the vehicle variant's price set.
 *
 * Medusa creates a price set for every product variant, and a variant can only
 * be linked to one price set, so the fares are appended to that price set
 * rather than linked as a second one.
 */
export const createPhase0FarePriceSet = async (
  container: Container,
  options: {
    variant_id: string
    fares: Phase0DirectedFare[]
  }
): Promise<Phase0FarePriceSetFixture> => {
  const pricing = resolvePricing(container)
  const link = resolveLink(container)
  const suffix = uniqueSuffix()

  const priceInputs = options.fares.map((fare) => ({
    title: `${PHASE0_FIXTURE_ID_PREFIX}fare-${suffix}`,
    amount: fare.amount,
    currency_code: fare.currency_code.toLowerCase(),
    rules: {
      origin_zone_id: fare.origin_zone_id,
      destination_zone_id: fare.destination_zone_id,
      vehicle_variant_id: fare.vehicle_variant_id,
    },
  }))

  const existingPriceSetIds = await resolveVariantPriceSetIds(
    (container as { resolve: (key: string) => any }).resolve(
      ContainerRegistrationKeys.QUERY
    ),
    options.variant_id
  )

  let priceSetId = existingPriceSetIds[0]

  if (priceSetId) {
    await pricing.addPrices({ priceSetId, prices: priceInputs })
  } else {
    const created = await pricing.createPriceSets({ prices: priceInputs })

    if (!created?.id) {
      throw new Error("Phase 0 fixture could not create a fare price set.")
    }

    priceSetId = created.id

    await link.create([
      {
        [Modules.PRODUCT]: { variant_id: options.variant_id },
        [Modules.PRICING]: { price_set_id: priceSetId },
      },
    ])
  }

  const persisted = await pricing.listPrices(
    { price_set_id: [priceSetId] },
    { relations: ["price_rules"] }
  )

  const prices = options.fares.map((fare) => {
    const persistedPrice = persisted.find((price) => {
      const rules = price.price_rules ?? []

      return (
        (price.currency_code ?? "").toLowerCase() ===
          fare.currency_code.toLowerCase() &&
        rules.some(
          (rule) =>
            rule.attribute === "origin_zone_id" &&
            rule.value === fare.origin_zone_id
        ) &&
        rules.some(
          (rule) =>
            rule.attribute === "destination_zone_id" &&
            rule.value === fare.destination_zone_id
        ) &&
        rules.some(
          (rule) =>
            rule.attribute === "vehicle_variant_id" &&
            rule.value === fare.vehicle_variant_id
        )
      )
    })

    if (!persistedPrice?.id) {
      throw new Error("Phase 0 fixture could not persist a fare price.")
    }

    return {
      id: persistedPrice.id,
      amount: fare.amount,
      currency_code: fare.currency_code.toLowerCase(),
      rules: {
        origin_zone_id: fare.origin_zone_id,
        destination_zone_id: fare.destination_zone_id,
        vehicle_variant_id: fare.vehicle_variant_id,
      },
    }
  })

  return {
    price_set_id: priceSetId,
    variant_id: options.variant_id,
    prices,
  }
}

/**
 * Creates an active override price list that governs directed fares inside an
 * existing price set, so the adapter can return the price list reference.
 */
export const createPhase0FarePriceList = async (
  container: Container,
  options: {
    price_set_id: string
    type?: "override" | "sale"
    fares: Phase0DirectedFare[]
  }
): Promise<{ price_list_id: string }> => {
  const pricing = resolvePricing(container)
  const suffix = uniqueSuffix()

  const [priceList] = await pricing.createPriceLists([
    {
      title: `${PHASE0_FIXTURE_ID_PREFIX}price-list-${suffix}`,
      description: "Phase 0 non-production fare price list",
      status: "active",
      type: options.type ?? "override",
      metadata: { ...PHASE0_FIXTURE_METADATA },
      prices: options.fares.map((fare) => ({
        price_set_id: options.price_set_id,
        amount: fare.amount,
        currency_code: fare.currency_code.toLowerCase(),
        rules: {
          origin_zone_id: fare.origin_zone_id,
          destination_zone_id: fare.destination_zone_id,
          vehicle_variant_id: fare.vehicle_variant_id,
        },
      })),
    },
  ])

  if (!priceList?.id) {
    throw new Error("Phase 0 fixture could not create a fare price list.")
  }

  return { price_list_id: priceList.id }
}

/** Creates an empty cart bound to the region and a tax-resolvable country. */
export const createPhase0Cart = async (
  container: Container,
  options: { region_id: string; country_code?: string }
) => {
  const { result: cart } = await createCartWorkflow(container as never).run({
    input: {
      region_id: options.region_id,
      shipping_address: {
        country_code: (options.country_code ?? "do").toLowerCase(),
      },
      billing_address: {
        country_code: (options.country_code ?? "do").toLowerCase(),
      },
    },
  })

  return cart
}

/**
 * Creates and immediately applies an item-targeted fixed promotion so cart
 * totals can be re-computed with the native promotion engine.
 */
export const createPhase0AppliedPromotion = async (
  container: Container,
  options: {
    cart_id: string
    currency_code: string
    value: number
  }
) => {
  const suffix = uniqueSuffix()
  const code = `${PHASE0_FIXTURE_ID_PREFIX}promo-${suffix}`.toUpperCase()

  const {
    result: [promotion],
  } = await createPromotionsWorkflow(container as never).run({
    input: {
      promotionsData: [
        {
          code,
          type: "standard",
          status: "active",
          is_automatic: false,
          application_method: {
            type: "fixed",
            target_type: "items",
            allocation: "across",
            value: options.value,
            currency_code: options.currency_code.toLowerCase(),
          },
        },
      ],
    },
  })

  await updateCartPromotionsWorkflow(container as never).run({
    input: {
      cart_id: options.cart_id,
      promo_codes: [code],
      action: "add" as never,
    },
  })

  return promotion
}

/**
 * Adds a transport line item to the cart with the already calculated unit price
 * and the transport pricing context as line-item metadata.
 */
export const addPhase0TransportLineItem = async (
  container: Container,
  options: {
    cart_id: string
    variant_id: string
    unit_price: number
    metadata: Record<string, unknown>
  }
) => {
  await addToCartWorkflow(container as never).run({
    input: {
      cart_id: options.cart_id,
      items: [
        {
          variant_id: options.variant_id,
          quantity: 1,
          unit_price: options.unit_price,
          metadata: {
            ...PHASE0_FIXTURE_METADATA,
            ...options.metadata,
          },
        },
      ],
    },
  })

  return undefined
}

/** Returns a cart with the fields required by the acceptance scenario. */
export const retrievePhase0Cart = async (
  container: Container,
  cartId: string
) => {
  const query = (container as { resolve: (key: string) => any }).resolve(
    ContainerRegistrationKeys.QUERY
  )
  const { data } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "currency_code",
      "subtotal",
      "discount_total",
      "tax_total",
      "total",
      "items.id",
      "items.product_id",
      "items.variant_id",
      "items.unit_price",
      "items.quantity",
      "items.metadata",
      "items.total",
      "items.tax_total",
      "items.adjustments.amount",
    ],
    filters: { id: cartId },
  })

  return data[0]
}
