import { moduleIntegrationTestRunner } from "@medusajs/test-utils"

import { TRANSPORT_MODULE } from ".."
import TransportAuditEvent from "../models/audit-event"
import TransportReservationHold from "../models/reservation-hold"
import TransportReservation from "../models/reservation"
import TransportModuleService, { TransferQuoteSnapshot } from "../service"

const quoteSnapshot: TransferQuoteSnapshot = {
  quote_id: "trq_checkout_confirm",
  amount: 5200,
  currency_code: "usd",
  origin_zone_id: "zone-puj",
  destination_zone_id: "zone-bavaro",
  vehicle_class_id: "variant-transfer-van",
  variant_id: "variant-transfer-van",
  price_set_id: "ps_transfer",
  price_id: "price_transfer",
  h3_resolution: 9,
  expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
}

const confirmationInput = (orderId = "order_checkout_confirm") => ({
  order_id: orderId,
  cart_id: "cart_checkout_confirm",
  line_item_id: "line_transfer_1",
  quote_snapshot: quoteSnapshot,
  order_snapshot: { id: orderId, display_id: 1001, total: 5200 },
  hold_expires_at: new Date(Date.now() + 15 * 60 * 1000),
})

moduleIntegrationTestRunner<TransportModuleService>({
  moduleName: TRANSPORT_MODULE,
  resolve: "./src/modules/transport",
  moduleModels: [TransportReservation, TransportReservationHold, TransportAuditEvent],
  testSuite: ({ service }) => {
    describe("checkout-backed transfer reservation lifecycle", () => {
      it("confirms one reservation with immutable quote and order snapshots, hold, lookup, and audit", async () => {
        const reservation = await service.confirmTransferReservation(confirmationInput())
        const [hold] = await (service as any).listTransportReservationHolds({
          reservation_id: reservation.id,
        })
        const [audit] = await (service as any).listTransportAuditEvents({
          reservation_id: reservation.id,
        })
        const lookup = await service.lookupReservationByOrder("order_checkout_confirm")

        expect(reservation).toEqual(
          expect.objectContaining({
            order_id: "order_checkout_confirm",
            status: "confirmed",
            quote_snapshot: expect.objectContaining({ payload: expect.objectContaining({ amount: 5200 }) }),
            order_snapshot: expect.objectContaining({ payload: expect.objectContaining({ total: 5200 }) }),
          })
        )
        expect(hold).toEqual(expect.objectContaining({ status: "confirmed" }))
        expect(lookup.id).toBe(reservation.id)
        expect(audit.snapshot).toEqual(
          expect.objectContaining({ payload: expect.objectContaining({ reservation_id: reservation.id }) })
        )
      })

      it("replays duplicate checkout confirmation without creating another reservation", async () => {
        const first = await service.confirmTransferReservation(confirmationInput("order_duplicate"))
        const replay = await service.confirmTransferReservation(confirmationInput("order_duplicate"))
        const reservations = await (service as any).listTransportReservations({
          order_id: "order_duplicate",
        })

        expect(replay.id).toBe(first.id)
        expect(reservations).toHaveLength(1)
      })

      it("expires only active holds whose deadline has passed", async () => {
        await (service as any).createTransportReservationHolds({
          quote_id: "trq_expired",
          cart_id: "cart_expired",
          status: "active",
          expires_at: new Date("2026-01-01T00:00:00.000Z"),
        })
        await (service as any).createTransportReservationHolds({
          quote_id: "trq_future",
          cart_id: "cart_future",
          status: "active",
          expires_at: new Date("2026-12-31T00:00:00.000Z"),
        })

        const expired = await service.expireReservationHolds({
          now: new Date("2026-06-01T00:00:00.000Z"),
        })
        const active = await (service as any).listTransportReservationHolds({ status: "active" })

        expect(expired).toHaveLength(1)
        expect(expired[0].quote_id).toBe("trq_expired")
        expect(active.map((hold: any) => hold.quote_id)).toContain("trq_future")
      })
    })
  },
})

jest.setTimeout(60 * 1000)
