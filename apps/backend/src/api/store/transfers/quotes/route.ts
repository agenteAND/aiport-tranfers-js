import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { PUJ_BOUNDARY_FIXTURES } from "../../../../modules/transport/fixtures/puj-boundary"
import TransportModuleService from "../../../../modules/transport/service"
import { createTransferQuote } from "../../../../workflows/transport/quote-cart"

type QuoteRequestBody = {
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  vehicle_class_id: string
  currency_code?: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const transportService = req.scope.resolve("transport") as TransportModuleService
  seedFixtureZones(transportService)

  const body = req.body as QuoteRequestBody
  const origin_zone_id = transportService.findActiveZoneForLocation(body.origin)?.id
  const destination_zone_id = transportService.findActiveZoneForLocation(body.destination)?.id

  if (!origin_zone_id || !destination_zone_id) {
    res.status(400).json({ message: "No transfer fare is available for this trip." })
    return
  }

  const quote = await createTransferQuote(req.scope, transportService, {
    origin_zone_id,
    destination_zone_id,
    vehicle_class_id: body.vehicle_class_id,
    variant_id: body.vehicle_class_id,
    currency_code: body.currency_code ?? "usd",
  })

  res.status(200).json({ quote })
}

const seedFixtureZones = (transportService: TransportModuleService) => {
  for (const fixture of PUJ_BOUNDARY_FIXTURES) {
    if (transportService.getZone(fixture.expectedZoneId)) continue

    transportService.importZoneCells({
      id: fixture.expectedZoneId,
      name: fixture.expectedZoneName,
      active: true,
      cells: [fixture.expectedCell],
    })
  }
}
