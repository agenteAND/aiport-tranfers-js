import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import TransportModuleService, { TransferQuoteSnapshot } from "../../../../../../modules/transport/service"
import { requestTransferReservationChange } from "../../../../../../workflows/transport/request-reservation-change"
import { requireAdminActor } from "../../../admin-helpers"

type ChangeRequestBody = {
  change_request_id: string
  new_quote_snapshot?: TransferQuoteSnapshot
  reason?: string
}

export async function POST(req: AuthenticatedMedusaRequest<ChangeRequestBody>, res: MedusaResponse) {
  requireAdminActor(req)
  const transportService = req.scope.resolve("transport") as TransportModuleService
  const body = req.body ?? {}
  const change = await requestTransferReservationChange(transportService, {
    reservation_id: req.params.id,
    change_request_id: body.change_request_id,
    new_quote_snapshot: body.new_quote_snapshot,
    reason: body.reason,
  })

  res.status(change.status === "error" ? 409 : 202).json({ change })
}
