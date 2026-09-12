import { model } from "@medusajs/framework/utils"

const TransportReservationHold = model.define("transport_reservation_hold", {
  id: model.id().primaryKey(),
  quote_id: model.text().index(),
  cart_id: model.text().index(),
  status: model.enum(["active", "confirmed", "expired"]).default("active"),
  expires_at: model.dateTime().index(),
  reservation_id: model.text().nullable(),
})

export default TransportReservationHold
