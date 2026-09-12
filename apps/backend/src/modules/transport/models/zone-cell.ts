import { model } from "@medusajs/framework/utils"

const TransportZoneCell = model.define("transport_zone_cell", {
  id: model.id().primaryKey(),
  zone_id: model.text(),
  cell: model.text(),
  resolution: model.number(),
})

export default TransportZoneCell
