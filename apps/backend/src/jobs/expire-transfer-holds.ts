import { MedusaContainer } from "@medusajs/framework/types"

import { TRANSPORT_MODULE } from "../modules/transport"
import TransportModuleService from "../modules/transport/service"

export default async function expireTransferHoldsJob(container: MedusaContainer) {
  const transportService = container.resolve(
    TRANSPORT_MODULE
  ) as TransportModuleService

  return transportService.expireReservationHolds()
}
