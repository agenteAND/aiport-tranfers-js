import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import TransportModuleService from "../../../../modules/transport/service"
import { addTransferQuoteToCart } from "../../../../workflows/transport/quote-cart"

type CartRequestBody = {
  cart_id: string
  quote_id: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const transportService = req.scope.resolve("transport") as TransportModuleService
  const cart = await addTransferQuoteToCart(req.scope, transportService, req.body as CartRequestBody)
  res.status(200).json({ cart })
}
