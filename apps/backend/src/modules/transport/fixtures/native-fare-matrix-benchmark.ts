/**
 * Phase 0 directed fare-matrix benchmark.
 *
 * Generates directed fare-rule fixtures for several matrix sizes and measures
 * the internal calculation latency of `resolveNativeTransportPrice`.
 *
 * The benchmark measures INTERNAL CALCULATION latency only. It is not capacity
 * evidence: final production validation remains pending until expected load and
 * infrastructure are defined, and this module asserts no production capacity
 * requirement.
 */

import { Modules } from "@medusajs/framework/utils"

import {
  PHASE0_FIXTURE_ID_PREFIX,
  PHASE0_ZONE_PUJ,
  PHASE0_ZONE_PUNTA_CANA,
  createPhase0CommerceFixture,
  createPhase0FarePriceSet,
  createPhase0VehicleVariant,
  type Phase0DirectedFare,
} from "./native-fare-matrix"
import {
  resolveNativeTransportPrice,
  type NativeTransportPricingAccess,
  type NativeTransportPriceContext,
} from "../pricing/native-transport-pricing"

export const PHASE0_BENCHMARK_PRD_TARGET_MS = 250

export type Phase0BenchmarkMatrix = {
  label: string
  zones: number
  variants: number
  currencies: string[]
  /** Number of price requests issued for the matrix. */
  calculations: number
}

export type Phase0BenchmarkRow = {
  label: string
  zones: number
  vehicle_variants: number
  currencies: number
  total_directed_prices: number
  calculations: number
  p50_ms: number
  p95_ms: number
  max_ms: number
  prd_target_ms: number
  p95_within_prd_target: boolean
}

export type Phase0BenchmarkReport = {
  environment: {
    node: string
    platform: string
    cpu_count: number
    medusa_version: string
    database: string
  }
  rows: Phase0BenchmarkRow[]
  production_validation: "pending"
  note: string
}

type Container = {
  resolve: (key: string) => unknown
}

const percentile = (values: number[], p: number): number => {
  if (!values.length) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(p * sorted.length) - 1)
  )

  return sorted[index]
}

const round = (value: number) => Math.round(value * 100) / 100

const zoneId = (index: number) => `${PHASE0_FIXTURE_ID_PREFIX}zone-${index}`

const medusaVersion = (): string => {
  try {
    return require("@medusajs/medusa/package.json").version as string
  } catch {
    return "unknown"
  }
}

const databaseLabel = (): string => {
  const url = process.env.DATABASE_URL ?? ""

  return url.replace(/:\/\/[^@/]*@/, "://***@").replace(/\?.*$/, "")
}

/**
 * Runs the benchmark for every matrix, then reports the full metric row plus
 * the PRD target comparison.
 */
export const runNativeFareMatrixBenchmark = async (
  container: Container,
  options: {
    matrices: Phase0BenchmarkMatrix[]
    currency_code?: string
    /** Overrides the fixture currency set used by each matrix. */
    commerce?: Awaited<ReturnType<typeof createPhase0CommerceFixture>>
  }
): Promise<Phase0BenchmarkReport> => {
  const pricing = container.resolve(Modules.PRICING)
  const commerce =
    options.commerce ??
    (await createPhase0CommerceFixture(container, {
      currency_code: options.currency_code ?? "usd",
    }))

  const rows: Phase0BenchmarkRow[] = []

  for (const matrix of options.matrices) {
    const vehicles: Array<{ variant_id: string; price_set_id: string }> = []
    const totalDirectedPrices =
      matrix.zones * (matrix.zones - 1) * matrix.variants * matrix.currencies.length

    for (let variantIndex = 0; variantIndex < matrix.variants; variantIndex++) {
      const vehicle = await createPhase0VehicleVariant(container, {
        title: `Bench ${matrix.label} ${variantIndex}`,
        sku: `BENCH-${matrix.label}-${variantIndex}`,
        shipping_profile_id: commerce.shipping_profile_id,
      })

      const fares: Phase0DirectedFare[] = []

      for (let origin = 0; origin < matrix.zones; origin++) {
        for (let destination = 0; destination < matrix.zones; destination++) {
          if (origin === destination) {
            continue
          }

          for (const currencyCode of matrix.currencies) {
            fares.push({
              origin_zone_id: zoneId(origin),
              destination_zone_id: zoneId(destination),
              vehicle_variant_id: vehicle.variant_id,
              currency_code: currencyCode,
              amount: 1000 + origin * 10 + destination + variantIndex,
            })
          }
        }
      }

      const priceSet = await createPhase0FarePriceSet(container, {
        variant_id: vehicle.variant_id,
        fares,
      })

      vehicles.push({
        variant_id: vehicle.variant_id,
        price_set_id: priceSet.price_set_id,
      })
    }

    const durations: number[] = []

    for (let index = 0; index < matrix.calculations; index++) {
      const vehicle = vehicles[index % vehicles.length]
      const origin = 0
      const destination = (index % (matrix.zones - 1)) + 1
      const currencyCode = matrix.currencies[index % matrix.currencies.length]
      const context: NativeTransportPriceContext = {
        origin_zone_id: zoneId(origin),
        destination_zone_id: zoneId(destination),
        vehicle_variant_id: vehicle.variant_id,
        currency_code: currencyCode,
      }

      const startedAt = performance.now()
      const result = await resolveNativeTransportPrice({
        pricing: pricing as unknown as NativeTransportPricingAccess,
        price_set_ids: [vehicle.price_set_id],
        context,
      })
      durations.push(performance.now() - startedAt)

      if (result.status !== "priced") {
        throw new Error(
          `Benchmark matrix ${matrix.label} expected a priced result but received ${result.status}.`
        )
      }
    }

    const p95 = percentile(durations, 0.95)

    rows.push({
      label: matrix.label,
      zones: matrix.zones,
      vehicle_variants: matrix.variants,
      currencies: matrix.currencies.length,
      total_directed_prices: totalDirectedPrices,
      calculations: matrix.calculations,
      p50_ms: round(percentile(durations, 0.5)),
      p95_ms: round(p95),
      max_ms: round(Math.max(...durations)),
      prd_target_ms: PHASE0_BENCHMARK_PRD_TARGET_MS,
      p95_within_prd_target: p95 <= PHASE0_BENCHMARK_PRD_TARGET_MS,
    })
  }

  return {
    environment: {
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      cpu_count: require("os").cpus().length as number,
      medusa_version: medusaVersion(),
      database: databaseLabel(),
    },
    rows,
    production_validation: "pending",
    note:
      "Internal calculation latency only. Final production validation remains " +
      "pending until expected load and infrastructure are defined. No production " +
      "capacity requirement is asserted because projected launch volume is TBD.",
  }
}

/** Renders the report as the acceptance command's benchmark section. */
export const formatNativeFareMatrixBenchmark = (
  report: Phase0BenchmarkReport
): string => {
  const lines: string[] = []
  const { environment } = report

  lines.push("Benchmark environment:")
  lines.push(
    `  node=${environment.node} platform=${environment.platform} cpus=${environment.cpu_count}`
  )
  lines.push(
    `  medusa=${environment.medusa_version} database=${environment.database}`
  )
  lines.push("")
  lines.push(
    "  matrix | zones | variants | currencies | directed prices | calculations | p50 ms | p95 ms | max ms | PRD 250 ms"
  )

  for (const row of report.rows) {
    lines.push(
      `  ${row.label} | ${row.zones} | ${row.vehicle_variants} | ${row.currencies} | ` +
        `${row.total_directed_prices} | ${row.calculations} | ${row.p50_ms} | ` +
        `${row.p95_ms} | ${row.max_ms} | ${row.p95_within_prd_target ? "within" : "above"}`
    )
  }

  lines.push("")
  lines.push(`  production validation: ${report.production_validation}`)
  lines.push(`  note: ${report.note}`)

  return lines.join("\n")
}

export { PHASE0_ZONE_PUJ, PHASE0_ZONE_PUNTA_CANA }
