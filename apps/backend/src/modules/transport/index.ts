import { Module } from "@medusajs/framework/utils"

import TransportModuleService from "./service"

export const TRANSPORT_MODULE = "transport"

export default Module(TRANSPORT_MODULE, {
  service: TransportModuleService,
})
