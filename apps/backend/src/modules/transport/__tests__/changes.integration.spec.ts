import { moduleIntegrationTestRunner } from "@medusajs/test-utils"

import { TRANSPORT_MODULE } from ".."
import TransportAuditEvent from "../models/audit-event"
import TransportProviderEvent from "../models/provider-event"
import TransportReservationChange from "../models/reservation-change"
import TransportReservationHold from "../models/reservation-hold"
import TransportReservation from "../models/reservation"
import TransportModuleService, { TransferQuoteSnapshot } from "../service"
import {
  handleTransferChangeProviderEvent,
  requestTransferReservationChange,
} from "../../../workflows/transport/request-reservation-change"

const originalQuote: TransferQuoteSnapshot = {
  quote_id: "trq_change_original",
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

const createReservation = async (service: TransportModuleService, id: string) =>
  service.confirmTransferReservation({
    order_id: `order_${id}`,
    cart_id: `cart_${id}`,
    line_item_id: `line_${id}`,
    quote_snapshot: originalQuote,
    order_snapshot: { id: `order_${id}`, total: originalQuote.amount },
    hold_expires_at: new Date(Date.now() + 15 * 60 * 1000),
  })

moduleIntegrationTestRunner<TransportModuleService>({
  moduleName: TRANSPORT_MODULE,
  resolve: "./src/modules/transport",
  moduleModels: [
    TransportReservation,
    TransportReservationHold,
    TransportAuditEvent,
    TransportReservationChange,
    TransportProviderEvent,
  ],
  testSuite: ({ service }) => {
    describe("assisted transfer reservation changes", () => {
      it("creates one pending payment-link change for a positive fare delta and confirms on provider success", async () => {
        const reservation = await createReservation(service, "positive_change")

        const change = await requestTransferReservationChange(service, {
          reservation_id: reservation.id,
          change_request_id: "chg_positive_delta",
          new_quote_snapshot: { ...originalQuote, quote_id: "trq_positive", amount: 6400 },
          reason: "Upgrade vehicle",
        })
        const confirmed = await handleTransferChangeProviderEvent(service, {
          provider_event_id: "evt_positive_paid",
          change_request_id: "chg_positive_delta",
          provider_status: "succeeded",
        })
        const updated = await (service as any).retrieveTransportReservation(reservation.id)

        expect(change).toEqual(
          expect.objectContaining({
            status: "pending_payment",
            delta_amount: 1200,
            payment_link_status: "requires_payment_link",
          })
        )
        expect(confirmed.status).toBe("confirmed")
        expect(updated.quote_snapshot.payload).toEqual(expect.objectContaining({ amount: 6400 }))
      })

      it("creates one pending refund change for a negative fare delta and confirms on provider success", async () => {
        const reservation = await createReservation(service, "negative_change")

        const change = await requestTransferReservationChange(service, {
          reservation_id: reservation.id,
          change_request_id: "chg_negative_delta",
          new_quote_snapshot: { ...originalQuote, quote_id: "trq_negative", amount: 4700 },
          reason: "Downgrade vehicle",
        })
        const confirmed = await handleTransferChangeProviderEvent(service, {
          provider_event_id: "evt_negative_refunded",
          change_request_id: "chg_negative_delta",
          provider_status: "succeeded",
        })

        expect(change).toEqual(
          expect.objectContaining({
            status: "pending_refund",
            delta_amount: -500,
            refund_status: "requires_refund",
          })
        )
        expect(confirmed.status).toBe("confirmed")
      })

      it("dedupes change requests and provider events while preserving reservation state", async () => {
        const reservation = await createReservation(service, "dedupe_change")
        const input = {
          reservation_id: reservation.id,
          change_request_id: "chg_replayed",
          new_quote_snapshot: { ...originalQuote, quote_id: "trq_replayed", amount: 5900 },
          reason: "Change pickup time",
        }

        const first = await requestTransferReservationChange(service, input)
        const replay = await requestTransferReservationChange(service, input)
        const event = await handleTransferChangeProviderEvent(service, {
          provider_event_id: "evt_replayed",
          change_request_id: "chg_replayed",
          provider_status: "succeeded",
        })
        const eventReplay = await handleTransferChangeProviderEvent(service, {
          provider_event_id: "evt_replayed",
          change_request_id: "chg_replayed",
          provider_status: "succeeded",
        })

        expect(replay.id).toBe(first.id)
        expect(eventReplay.id).toBe(event.id)
        expect(await (service as any).listTransportReservationChanges({ change_request_id: "chg_replayed" })).toHaveLength(1)
        expect(await (service as any).listTransportProviderEvents({ provider_event_id: "evt_replayed" })).toHaveLength(1)
      })

      it("records actionable error states for unavailable fares and failed provider events without changing the reservation", async () => {
        const reservation = await createReservation(service, "failed_change")
        const unavailable = await requestTransferReservationChange(service, {
          reservation_id: reservation.id,
          change_request_id: "chg_unavailable",
          new_quote_snapshot: undefined,
          reason: "Unavailable fare",
        })
        const failed = await requestTransferReservationChange(service, {
          reservation_id: reservation.id,
          change_request_id: "chg_failed_payment",
          new_quote_snapshot: { ...originalQuote, quote_id: "trq_failed", amount: 5800 },
          reason: "Failed payment",
        })
        const providerFailure = await handleTransferChangeProviderEvent(service, {
          provider_event_id: "evt_failed_payment",
          change_request_id: failed.change_request_id,
          provider_status: "failed",
        })
        const unchanged = await (service as any).retrieveTransportReservation(reservation.id)

        expect(unavailable).toEqual(expect.objectContaining({ status: "error", error_code: "fare_unavailable" }))
        expect(providerFailure.status).toBe("error")
        expect(providerFailure.error_code).toBe("provider_event_failed")
        expect(unchanged.quote_snapshot.payload).toEqual(expect.objectContaining({ amount: 5200 }))
      })
    })
  },
})

jest.setTimeout(60 * 1000)
