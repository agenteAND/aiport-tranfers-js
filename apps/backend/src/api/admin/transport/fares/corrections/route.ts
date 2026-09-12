import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import TransportModuleService from "../../../../../modules/transport/service"
import { requireAdminActor, requiredAmount, requiredString } from "../../admin-helpers"

type FareCorrectionBody = {
  origin_zone_id?: string
  destination_zone_id?: string
  vehicle_class_id?: string
  amount?: number
  currency_code?: string
  reason?: string
}

export async function POST(req: AuthenticatedMedusaRequest<FareCorrectionBody>, res: MedusaResponse) {
  const actorId = requireAdminActor(req)
  const pricing = req.scope.resolve("pricing") as any
  const transportService = req.scope.resolve("transport") as TransportModuleService
  const body = req.body ?? {}
  const fare = await pricing.createPriceSets({
    prices: [{
      amount: requiredAmount(body.amount),
      currency_code: requiredString(body.currency_code, "currency_code"),
      rules: {
        origin_zone_id: requiredString(body.origin_zone_id, "origin_zone_id"),
        destination_zone_id: requiredString(body.destination_zone_id, "destination_zone_id"),
        vehicle_class_id: requiredString(body.vehicle_class_id, "vehicle_class_id"),
      },
    }],
  })
  await transportService.recordAdminAudit({ target_id: fare.id, event_type: "admin.fare.corrected", actor_id: actorId, reason: requiredString(body.reason, "reason"), payload: { price_set_id: fare.id } })

  res.status(200).json({ fare: { price_set_id: fare.id } })
}
