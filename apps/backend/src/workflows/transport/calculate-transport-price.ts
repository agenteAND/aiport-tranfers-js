import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import type { NativeTransportPriceContext } from "../../modules/transport/pricing/native-transport-pricing"
import { resolveNativeTransportPriceStep } from "../steps/resolve-native-transport-price"

export type CalculateTransportPriceInput = {
  context: NativeTransportPriceContext
}

/**
 * Resolves a directed transport price through the native Pricing Module.
 *
 * The composition function is a synchronous `function` with a single step and
 * no branching, per Medusa's workflow composition rules.
 */
export const calculateTransportPriceWorkflow = createWorkflow(
  "calculate-transport-price",
  function (input: CalculateTransportPriceInput) {
    const resolved = resolveNativeTransportPriceStep(input)

    return new WorkflowResponse(resolved)
  }
)

export default calculateTransportPriceWorkflow
