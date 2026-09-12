import { model } from "@medusajs/framework/utils"

const TransportZone = model.define("transport_zone", {
  id: model.id().primaryKey(),
  name: model.text(),
  active: model.boolean().default(false),
})

export default TransportZone
