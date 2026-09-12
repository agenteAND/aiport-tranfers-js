import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import TransportModuleService from "../../../../../../modules/transport/service"
import { optionalBoolean, requireAdminActor, requiredString } from "../../../admin-helpers"

type ZoneCorrectionBody = { name?: string; active?: boolean; reason?: string }

export async function POST(req: AuthenticatedMedusaRequest<ZoneCorrectionBody>, res: MedusaResponse) {
  const actorId = requireAdminActor(req)
  const transportService = req.scope.resolve("transport") as TransportModuleService
  const body = req.body ?? {}
  const zone = await transportService.adminCorrectZone({
    id: req.params.id,
    name: requiredString(body.name, "name"),
    active: optionalBoolean(body.active, true),
    reason: requiredString(body.reason, "reason"),
    actor_id: actorId,
  })

  res.status(200).json({ zone })
}
