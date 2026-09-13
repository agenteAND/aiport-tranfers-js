import TransportModuleService, {
  ResolveTransferFareInput,
  TransferFarePricingAccess,
  TransferFareResolution,
} from "../../modules/transport/service"

type ResolveTransferFareArgs = {
  input: ResolveTransferFareInput
  pricingModuleService: TransferFarePricingAccess
  transportService: TransportModuleService
}

export const resolveTransferFare = async ({
  input,
  pricingModuleService,
  transportService,
}: ResolveTransferFareArgs): Promise<TransferFareResolution> => {
  return transportService.resolveTransferFare(pricingModuleService, input)
}
