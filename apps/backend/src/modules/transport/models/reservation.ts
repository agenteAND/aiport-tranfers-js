import { model } from "@medusajs/framework/utils"

const TransportReservation = model.define("transport_reservation", {
  id: model.id().primaryKey(),
  order_id: model.text().index(),
  cart_id: model.text().index(),
  line_item_id: model.text().index(),
  status: model.enum(["confirmed", "cancelled"]).default("confirmed"),
  quote_snapshot: model.json(),
  order_snapshot: model.json(),
  confirmed_at: model.dateTime(),
})

export default TransportReservation
