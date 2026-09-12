import { model } from "@medusajs/framework/utils"

const TransportProviderEvent = model.define("transport_provider_event", {
  id: model.id().primaryKey(),
  provider_event_id: model.text().index(),
  change_request_id: model.text().index(),
  provider_status: model.text(),
  change_id: model.text().nullable(),
})

export default TransportProviderEvent
