import { addToCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, MedusaError, Modules, remoteQueryObjectFromString } from "@medusajs/framework/utils"

import TransportModuleService, {
  ResolveTransferFareInput,
  TransferFarePricingAccess,
} from "../../modules/transport/service"

export const createTransferQuote = async (
  scope: any,
  transportService: TransportModuleService,
  input: ResolveTransferFareInput & { variant_id: string }
) => {
  const pricingService = scope.resolve(Modules.PRICING) as TransferFarePricingAccess
  const result = await transportService.resolveTransferFare(pricingService, input)

  if (result.status !== "priced") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No transfer fare is available for this trip."
    )
  }

  return transportService.createQuoteSnapshot({
    ...result.fare,
    variant_id: input.variant_id,
    h3_resolution: 9,
  })
}

export const addTransferQuoteToCart = async (
  scope: any,
  transportService: TransportModuleService,
  input: { cart_id: string; quote_id: string }
) => {
  const quote = transportService.getQuoteSnapshot(input.quote_id)
  if (!quote) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Transfer quote was not found.")
  }

  const existingCart = await refetchCart(input.cart_id, scope)
  if (!existingCart.items?.some((item: any) => item.metadata?.transfer_quote_id === quote.quote_id)) {
    await addToCartWorkflow(scope as any).run({
      input: {
        cart_id: input.cart_id,
        items: [
          {
            variant_id: quote.variant_id,
            quantity: 1,
            unit_price: quote.amount,
            metadata: {
              transfer_quote_id: quote.quote_id,
              transfer_quote_snapshot: quote,
            },
          },
        ],
      },
    })
  }

  return refetchCart(input.cart_id, scope)
}

const refetchCart = async (cartId: string, scope: any) => {
  const remoteQuery = scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)
  const [cart] = await remoteQuery(
    remoteQueryObjectFromString({
      entryPoint: "cart",
      variables: { filters: { id: cartId } },
      fields: ["id", "items.id", "items.variant_id", "items.quantity", "items.unit_price", "items.metadata"],
    })
  )

  if (!cart) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Cart with id '${cartId}' not found`)
  }

  return cart
}
