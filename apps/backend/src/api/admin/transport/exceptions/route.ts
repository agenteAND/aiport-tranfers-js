import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import TransportModuleService from "../../../../modules/transport/service"
import { requireAdminActor } from "../admin-helpers"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  requireAdminActor(req)
  const transportService = req.scope.resolve("transport") as TransportModuleService
  const exceptions = await transportService.listAdminExceptions()

  res.status(200).json({ exceptions })
}
