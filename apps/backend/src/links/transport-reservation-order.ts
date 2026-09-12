import OrderModule from "@medusajs/medusa/order"
import { defineLink } from "@medusajs/framework/utils"

import TransportModule from "../modules/transport"

export default defineLink(
  TransportModule.linkable.transportReservation,
  OrderModule.linkable.order
)
