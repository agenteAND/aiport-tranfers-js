import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import {
  resolveNativeTransportPrice,
  resolveVariantPriceSetIds,
  type NativeTransportPriceContext,
  type NativeTransportPriceResult,
} from "../../modules/transport/pricing/native-transport-pricing"

export type ResolveNativeTransportPriceStepInput = {
  context: NativeTransportPriceContext
}

export const resolveNativeTransportPriceStepId =
  "resolve-native-transport-price"

/**
 * Read-only step: resolves the vehicle variant's price sets, then asks the
 * native Pricing Module for the directed transport price. It performs no
 * mutation, so no compensation function is required.
 */
export const resolveNativeTransportPriceStep = createStep(
  resolveNativeTransportPriceStepId,
  async (
    input: ResolveNativeTransportPriceStepInput,
    { container }
  ): Promise<StepResponse<NativeTransportPriceResult>> => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const pricing = container.resolve(Modules.PRICING)

    const priceSetIds = await resolveVariantPriceSetIds(
      query as never,
      input.context.vehicle_variant_id
    )

    const result = await resolveNativeTransportPrice({
      pricing: pricing as never,
      price_set_ids: priceSetIds,
      context: input.context,
    })

    return new StepResponse(result)
  }
)
