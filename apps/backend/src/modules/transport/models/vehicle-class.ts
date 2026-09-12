import { model } from "@medusajs/framework/utils"

const TransportVehicleClass = model.define("transport_vehicle_class", {
  id: model.id().primaryKey(),
  name: model.text(),
  active: model.boolean().default(true),
})

export default TransportVehicleClass
