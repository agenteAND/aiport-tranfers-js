import { model } from "@medusajs/framework/utils"

const TransportAuditEvent = model.define("transport_audit_event", {
  id: model.id().primaryKey(),
  reservation_id: model.text().index(),
  event_type: model.text(),
  snapshot: model.json(),
})

export default TransportAuditEvent
