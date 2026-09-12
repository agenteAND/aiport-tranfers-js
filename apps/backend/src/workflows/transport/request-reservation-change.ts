import TransportModuleService, { TransferQuoteSnapshot } from "../../modules/transport/service"

export const requestTransferReservationChange = async (
  transportService: TransportModuleService,
  input: {
    reservation_id: string
    change_request_id: string
    new_quote_snapshot?: TransferQuoteSnapshot
    reason?: string
  }
) => transportService.requestReservationChange(input)

export const handleTransferChangeProviderEvent = async (
  transportService: TransportModuleService,
  input: {
    provider_event_id: string
    change_request_id: string
    provider_status: "succeeded" | "failed"
  }
) => transportService.handleChangeProviderEvent(input)
