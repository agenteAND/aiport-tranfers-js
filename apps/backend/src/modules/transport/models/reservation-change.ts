import { model } from "@medusajs/framework/utils"

const TransportReservationChange = model.define("transport_reservation_change", {
  id: model.id().primaryKey(),
  reservation_id: model.text().index(),
  change_request_id: model.text().index(),
  status: model.enum(["pending_payment", "pending_refund", "confirmed", "error"]).default("pending_payment"),
  delta_amount: model.number(),
  payment_link_status: model.text().nullable(),
  refund_status: model.text().nullable(),
  error_code: model.text().nullable(),
  reason: model.text().nullable(),
  previous_quote_snapshot: model.json(),
  requested_quote_snapshot: model.json().nullable(),
})

export default TransportReservationChange
