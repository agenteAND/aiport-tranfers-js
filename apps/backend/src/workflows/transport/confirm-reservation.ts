import TransportModuleService, { TransferQuoteSnapshot } from "../../modules/transport/service"

export const confirmTransferReservation = async (
  transportService: TransportModuleService,
  input: {
    order_id: string
    cart_id: string
    line_item_id: string
    quote_snapshot: TransferQuoteSnapshot
    order_snapshot: Record<string, unknown>
    hold_expires_at: Date
  }
) => transportService.confirmTransferReservation(input)
