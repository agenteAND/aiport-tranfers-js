import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

import { TRANSPORT_MODULE } from "../../../../modules/transport"
import TransportModuleService, { TransferQuoteSnapshot } from "../../../../modules/transport/service"

const jwt = require("jsonwebtoken")

const quoteSnapshot: TransferQuoteSnapshot = {
  quote_id: "trq_admin_original",
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

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("admin transport readiness", () => {
      const authHeaders = async () => {
        const container = getContainer()
        const auth = container.resolve("auth") as any
        const users = container.resolve("user") as any
        const user = await users.createUsers({ email: `operator-${Date.now()}@dtc.test` })
        const identity = await auth.createAuthIdentities({
          provider_identities: [{ provider: "emailpass", entity_id: user.email }],
          app_metadata: { user_id: user.id },
        })

        return {
          authorization: `Bearer ${jwt.sign({ actor_id: user.id, actor_type: "user", auth_identity_id: identity.id }, "supersecret")}`,
        }
      }

      const createReservation = async (id: string) => {
        const service = getContainer().resolve(TRANSPORT_MODULE) as TransportModuleService
        return service.confirmTransferReservation({
          order_id: `order_${id}`,
          cart_id: `cart_${id}`,
          line_item_id: `line_${id}`,
          quote_snapshot: quoteSnapshot,
          order_snapshot: { id: `order_${id}`, total: quoteSnapshot.amount },
          hold_expires_at: new Date(Date.now() + 15 * 60 * 1000),
        })
      }

      it("rejects unauthenticated admin transport operations", async () => {
        await expect(api.post("/admin/transport/zones/zone-puj/corrections", { name: "PUJ" })).rejects.toMatchObject({
          response: { status: 401 },
        })
      })

      it("authorizes assisted-change commands through the admin route", async () => {
        const reservation = await createReservation("authorized_change")
        const newQuote = { ...quoteSnapshot, quote_id: "trq_admin_change", amount: 6100 }

        await expect(api.post(`/admin/transport/reservations/${reservation.id}/changes`, { change_request_id: "chg_admin_route", new_quote_snapshot: newQuote, reason: "Operator assisted change" })).rejects.toMatchObject({
          response: { status: 401 },
        })

        const response = await api.post(
          `/admin/transport/reservations/${reservation.id}/changes`,
          { change_request_id: "chg_admin_route", new_quote_snapshot: newQuote, reason: "Operator assisted change" },
          { headers: await authHeaders() }
        )

        expect(response.status).toBe(202)
        expect(response.data.change).toEqual(expect.objectContaining({ change_request_id: "chg_admin_route", status: "pending_payment" }))
      })

      it("applies authorized zone, fare, and reservation corrections with persisted audits", async () => {
        const headers = await authHeaders()
        const reservation = await createReservation("admin_correction")
        const service = getContainer().resolve(TRANSPORT_MODULE) as TransportModuleService

        const zone = await api.post("/admin/transport/zones/zone-puj/corrections", { name: "PUJ Airport", active: true, reason: "Correct display name" }, { headers })
        const fare = await api.post("/admin/transport/fares/corrections", { origin_zone_id: "zone-puj", destination_zone_id: "zone-bavaro", vehicle_class_id: "variant-transfer-van", amount: 6100, currency_code: "usd", reason: "Correct fare" }, { headers })
        const corrected = await api.post(`/admin/transport/reservations/${reservation.id}/corrections`, { status: "cancelled", reason: "Operator correction" }, { headers })
        const audits = await (service as any).listTransportAuditEvents({ reservation_id: reservation.id })

        expect(zone.data.zone).toEqual(expect.objectContaining({ id: "zone-puj", name: "PUJ Airport", active: true }))
        expect(fare.data.fare.price_set_id).toEqual(expect.any(String))
        expect(corrected.data.reservation).toEqual(expect.objectContaining({ id: reservation.id, status: "cancelled" }))
        expect(audits.map((event: any) => event.event_type)).toEqual(expect.arrayContaining(["admin.reservation.corrected"]))
      })

      it("rejects invalid corrections without changing reservation state", async () => {
        const headers = await authHeaders()
        const reservation = await createReservation("invalid_admin_correction")
        const service = getContainer().resolve(TRANSPORT_MODULE) as TransportModuleService

        await expect(api.post(`/admin/transport/reservations/${reservation.id}/corrections`, { status: "refunded", reason: "Invalid" }, { headers })).rejects.toMatchObject({
          response: { status: 400 },
        })

        const unchanged = await (service as any).retrieveTransportReservation(reservation.id)
        expect(unchanged.status).toBe("confirmed")
      })

      it("shows actionable reservation exceptions to authorized operators", async () => {
        const headers = await authHeaders()
        const reservation = await createReservation("admin_exception")
        const service = getContainer().resolve(TRANSPORT_MODULE) as TransportModuleService
        await service.requestReservationChange({ reservation_id: reservation.id, change_request_id: "chg_admin_exception", reason: "Unavailable fare" })

        const response = await api.get("/admin/transport/exceptions", { headers })

        expect(response.data.exceptions).toEqual([expect.objectContaining({ change_request_id: "chg_admin_exception", error_code: "fare_unavailable" })])
      })
    })
  },
})

jest.setTimeout(60 * 1000)
