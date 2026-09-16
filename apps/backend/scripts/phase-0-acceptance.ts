/**
 * Phase 0 documented acceptance command.
 *
 * Run from `apps/backend`:
 *
 *   pnpm exec ts-node scripts/phase-0-acceptance.ts
 *   # or, via the package script:
 *   pnpm run phase0:acceptance
 *
 * It boots the Medusa application against `DATABASE_URL`, prepares the
 * non-production `phase0_nonprod_` fixtures, runs the complete acceptance
 * scenario, prints every required value, and prints the benchmark p50/p95.
 *
 * WARNING: this writes `phase0_nonprod_` fixtures into the configured database
 * (by default the development database `fareDB`). Fixtures are additive and
 * clearly marked as non-production test data.
 */

import path from "path"

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
} from "../src/modules/transport/fixtures/native-fare-matrix"
import {
  formatNativeFareMatrixBenchmark,
  runNativeFareMatrixBenchmark,
} from "../src/modules/transport/fixtures/native-fare-matrix-benchmark"
import {
  resolveNativeTransportPrice,
  type NativeTransportPricingAccess,
  type NativeTransportPriceContext,
} from "../src/modules/transport/pricing/native-transport-pricing"

const APP_DIR = path.resolve(__dirname, "..")

const print = (label: string, value: unknown) => {
  const rendered =
    typeof value === "string" ? value : JSON.stringify(value, null, 2)

  console.log(`${label}: ${rendered}`)
}

const section = (title: string) => {
  console.log("")
  console.log(`=== ${title} ===`)
}

const fair = (
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

const runScenario = async (container: any) => {
  const pricing = container.resolve(
    Modules.PRICING
  ) as unknown as NativeTransportPricingAccess

  const context = (
    variantId: string,
    origin: string,
    destination: string,
    currencyCode = "usd"
  ): NativeTransportPriceContext => ({
    origin_zone_id: origin,
    destination_zone_id: destination,
    vehicle_variant_id: variantId,
    currency_code: currencyCode,
  })

  section("Fixtures (non-production)")
  console.log(
    `All generated records use the "${PHASE0_FIXTURE_ID_PREFIX}" prefix and metadata.phase0_fixture = true.`
  )

  const commerce = await createPhase0CommerceFixture(container, {
    currency_code: "usd",
  })
  const primaryCurrency = commerce.currency_code
  const secondaryCurrency = primaryCurrency === "usd" ? "dop" : "usd"

  print("region currency (primary)", primaryCurrency)
  print("secondary currency", secondaryCurrency)

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

  const sedanFares = await createPhase0FarePriceSet(container, {
    variant_id: sedan.variant_id,
    fares: [
      fair(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 5200, primaryCurrency),
      fair(sedan.variant_id, PHASE0_ZONE_PUNTA_CANA, PHASE0_ZONE_PUJ, 4800, primaryCurrency),
      fair(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 312000, secondaryCurrency),
    ],
  })
  const vanFares = await createPhase0FarePriceSet(container, {
    variant_id: van.variant_id,
    fares: [
      fair(van.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, 9000, primaryCurrency),
    ],
  })

  print("sedan price set", sedanFares.price_set_id)
  print("van price set", vanFares.price_set_id)

  section("Assertion 1 — independent directed prices")
  const outbound = await resolveNativeTransportPrice({
    pricing,
    price_set_ids: [sedanFares.price_set_id],
    context: context(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA),
  })
  const reverse = await resolveNativeTransportPrice({
    pricing,
    price_set_ids: [sedanFares.price_set_id],
    context: context(sedan.variant_id, PHASE0_ZONE_PUNTA_CANA, PHASE0_ZONE_PUJ),
  })

  print("outbound PUJ -> Punta Cana selected price", outbound)
  print("reverse Punta Cana -> PUJ selected price", reverse)

  section("Assertion 2 — vehicle-specific price")
  const vanResult = await resolveNativeTransportPrice({
    pricing,
    price_set_ids: [vanFares.price_set_id],
    context: context(van.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA),
  })
  print("van PUJ -> Punta Cana selected price", vanResult)

  section("Assertion 3 — currency-specific price (no fallback)")
  const usdResult = await resolveNativeTransportPrice({
    pricing,
    price_set_ids: [sedanFares.price_set_id],
    context: context(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, primaryCurrency),
  })
  const dopResult = await resolveNativeTransportPrice({
    pricing,
    price_set_ids: [sedanFares.price_set_id],
    context: context(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA, secondaryCurrency),
  })
  const absentCurrency = await resolveNativeTransportPrice({
    pricing,
    price_set_ids: [sedanFares.price_set_id],
    context: context(sedan.variant_id, PHASE0_ZONE_PUNTA_CANA, PHASE0_ZONE_PUJ, secondaryCurrency),
  })
  print("usd selected price", usdResult)
  print("dop selected price", dopResult)
  print("absent dop price (must not fall back)", absentCurrency)

  section("Assertion 4 — equal-context ambiguity handling")
  const ambiguousDestination = `${PHASE0_FIXTURE_ID_PREFIX}zone-ambiguous-target`
  await createPhase0FarePriceList(container, {
    price_set_id: sedanFares.price_set_id,
    type: "override",
    fares: [
      fair(sedan.variant_id, PHASE0_ZONE_PUJ, ambiguousDestination, 4200, primaryCurrency),
    ],
  })
  await createPhase0FarePriceList(container, {
    price_set_id: sedanFares.price_set_id,
    type: "override",
    fares: [
      fair(sedan.variant_id, PHASE0_ZONE_PUJ, ambiguousDestination, 4000, primaryCurrency),
    ],
  })
  const ambiguous = await resolveNativeTransportPrice({
    pricing,
    price_set_ids: [sedanFares.price_set_id],
    context: context(sedan.variant_id, PHASE0_ZONE_PUJ, ambiguousDestination),
  })
  print("equal-context ambiguity result (no quoted price)", ambiguous)

  section("Assertions 6 and 7 — cart item with retained relationships")
  const cart = await createPhase0Cart(container, {
    region_id: commerce.region_id,
    country_code: commerce.country_code,
  })
  const unitPrice = outbound.status === "priced" ? outbound.price.amount : 0
  await addPhase0TransportLineItem(container, {
    cart_id: cart.id,
    variant_id: sedan.variant_id,
    unit_price: unitPrice,
    metadata: {
      transport_context: context(
        sedan.variant_id,
        PHASE0_ZONE_PUJ,
        PHASE0_ZONE_PUNTA_CANA
      ),
      transport_rule:
        outbound.status === "priced" ? outbound.price.rule : undefined,
    },
  })
  print("cart id", cart.id)
  print("retained product id", sedan.product_id)
  print("retained variant id", sedan.variant_id)
  print("calculated line-item unit price", unitPrice)

  section("Assertion 8 — promotion and tax on the transport-priced cart")
  await createPhase0AppliedPromotion(container, {
    cart_id: cart.id,
    currency_code: primaryCurrency,
    value: 500,
  })
  const storedCart = await retrievePhase0Cart(container, cart.id)
  print("promotion discount total", Number(storedCart.discount_total))
  print("tax total", Number(storedCart.tax_total))
  print("final cart total", Number(storedCart.total))
  print("line-item total", Number(storedCart.items[0].total))

  section("Assertion 9 — deterministic repeatability")
  const repeatFirst = await resolveNativeTransportPrice({
    pricing,
    price_set_ids: [sedanFares.price_set_id],
    context: context(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA),
  })
  const repeatSecond = await resolveNativeTransportPrice({
    pricing,
    price_set_ids: [sedanFares.price_set_id],
    context: context(sedan.variant_id, PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA),
  })
  print(
    "deterministic repeat result (amount + rule references identical)",
    JSON.stringify(repeatFirst) === JSON.stringify(repeatSecond)
  )
  print("repeated result", repeatSecond)

  section("Benchmark (p50 / p95)")
  const benchmark = await runNativeFareMatrixBenchmark(container, {
    commerce,
    matrices: [
      {
        label: "acceptance",
        zones: 4,
        variants: 2,
        currencies: [primaryCurrency],
        calculations: 40,
      },
    ],
  })
  console.log(formatNativeFareMatrixBenchmark(benchmark))

  section("Acceptance summary")
  print("outbound priced?", outbound.status === "priced")
  print("reverse priced?", reverse.status === "priced")
  print("different vehicle priced?", vanResult.status === "priced")
  print("currency-specific priced?", dopResult.status === "priced")
  print("absent currency reported no price?", absentCurrency.status === "no_price")
  print("ambiguity detected?", ambiguous.status === "ambiguous")
  print("cart retrieved?", Boolean(storedCart?.id))
  print("benchmark p50 ms", benchmark.rows[0]?.p50_ms)
  print("benchmark p95 ms", benchmark.rows[0]?.p95_ms)
  print("production validation", benchmark.production_validation)
}

const main = async () => {
  const { configLoaderOverride, startApp } = await import("@medusajs/test-utils")

  const databaseUrl =
    process.env.DATABASE_URL ?? "postgresql://localhost/fareDB"

  console.log(`Phase 0 acceptance — booting Medusa against ${databaseUrl}`)
  await configLoaderOverride(APP_DIR, { clientUrl: databaseUrl })

  const { container, shutdown } = await startApp({ cwd: APP_DIR })

  try {
    await runScenario(container)
  } finally {
    await shutdown()
  }
}

main().then(
  () => {
    console.log("\nPhase 0 acceptance command completed.")
    process.exit(0)
  },
  (error) => {
    console.error("\nPhase 0 acceptance command failed.")
    console.error(error)
    process.exit(1)
  }
)
