import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import TransportModuleService from "../../../../../../modules/transport/service"
import { requireAdminActor, requiredString, reservationStatus } from "../../../admin-helpers"

type ReservationCorrectionBody = { status?: string; reason?: string }

export async function POST(req: AuthenticatedMedusaRequest<ReservationCorrectionBody>, res: MedusaResponse) {
  const actorId = requireAdminActor(req)
  const transportService = req.scope.resolve("transport") as TransportModuleService
  const body = req.body ?? {}
  const reservation = await transportService.adminCorrectReservation({
    id: req.params.id,
    status: reservationStatus(body.status),
    reason: requiredString(body.reason, "reason"),
    actor_id: actorId,
  })

  res.status(200).json({ reservation })
}
