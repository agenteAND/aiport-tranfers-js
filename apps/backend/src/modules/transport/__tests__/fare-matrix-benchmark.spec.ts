/**
 * Phase 0 — directed fare-matrix benchmark.
 *
 * Generates directed fare-rule fixtures across several matrix sizes and reports
 * the required metrics per matrix: zones, vehicle variants, currencies, total
 * directed prices, calculations, p50, p95, maximum duration, and environment.
 *
 * It compares the observed internal calculation p95 against the PRD target of
 * 250 ms and states that final production validation remains pending until
 * expected load and infrastructure are defined. It deliberately asserts NO
 * production capacity requirement, because projected launch volume is TBD.
 */

import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

import {
  PHASE0_BENCHMARK_PRD_TARGET_MS,
  formatNativeFareMatrixBenchmark,
  runNativeFareMatrixBenchmark,
  type Phase0BenchmarkReport,
} from "../fixtures/native-fare-matrix-benchmark"

jest.setTimeout(300 * 1000)

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("Phase 0 directed fare matrix benchmark", () => {
      it("reports a full metric row per matrix and compares p95 to the PRD target", async () => {
        const report: Phase0BenchmarkReport = await runNativeFareMatrixBenchmark(
          getContainer() as never,
          {
            matrices: [
              {
                label: "small",
                zones: 4,
                variants: 2,
                currencies: ["usd"],
                calculations: 40,
              },
              {
                label: "medium",
                zones: 6,
                variants: 2,
                currencies: ["usd", "dop"],
                calculations: 60,
              },
            ],
          }
        )

        // The rendered report is the acceptance evidence; keep it visible.
        console.log(`\n${formatNativeFareMatrixBenchmark(report)}\n`)

        expect(report.rows).toHaveLength(2)

        for (const row of report.rows) {
          expect(row.zones).toBeGreaterThan(1)
          expect(row.vehicle_variants).toBeGreaterThanOrEqual(1)
          expect(row.currencies).toBeGreaterThanOrEqual(1)
          expect(row.total_directed_prices).toBeGreaterThan(0)
          expect(row.calculations).toBeGreaterThan(0)
          expect(row.p50_ms).toBeGreaterThanOrEqual(0)
          expect(row.p95_ms).toBeGreaterThanOrEqual(row.p50_ms)
          expect(row.max_ms).toBeGreaterThanOrEqual(row.p95_ms)
          expect(row.prd_target_ms).toBe(PHASE0_BENCHMARK_PRD_TARGET_MS)
        }

        // PRD target comparison is mandatory.
        expect(PHASE0_BENCHMARK_PRD_TARGET_MS).toBe(250)

        // Production validation stays pending and no capacity requirement is
        // asserted, because projected launch volume is explicitly TBD.
        expect(report.production_validation).toBe("pending")
        expect(report.note).toContain("pending")
        expect(report.note).toContain("No production")
      })
    })
  },
})
