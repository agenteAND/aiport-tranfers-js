import { MedusaService } from "@medusajs/framework/utils"
import { latLngToCell } from "h3-js"

import { assertCellAtResolution, assertUniqueCells } from "./h3-validation"
import TransportAuditEvent from "./models/audit-event"
import TransportReservation from "./models/reservation"
import TransportReservationHold from "./models/reservation-hold"
import TransportVehicleClass from "./models/vehicle-class"
import TransportZone from "./models/zone"
import TransportZoneCell from "./models/zone-cell"

type TransportModuleOptions = {
  h3Resolution?: number
}

export type ImportedTransportZone = {
  id: string
  name: string
  active: boolean
  cells: string[]
}

type ImportZoneCellsInput = ImportedTransportZone

type FindZoneInput = {
  lat: number
  lng: number
}

export type ResolveTransferFareInput = {
  origin_zone_id: string
  destination_zone_id: string
  vehicle_class_id: string
  currency_code: string
}

type PricingRule = {
  attribute: string
  operator?: string
  value: string | string[]
}

type PricingPrice = {
  id: string
  amount: number
  currency_code: string
  deleted_at?: Date | string | null
  price_list?: { status?: string } | null
  price_rules?: PricingRule[]
}

type PricingPriceSet = {
  id: string
  prices?: PricingPrice[]
}

export type TransferFarePricingAccess = {
  listPriceSets: (
    filters?: Record<string, unknown>,
    config?: Record<string, unknown>
  ) => Promise<PricingPriceSet[]>
}

export type TransferFareResolution =
  | {
      status: "priced"
      fare: {
        price_set_id: string
        price_id: string
        amount: number
        currency_code: string
        origin_zone_id: string
        destination_zone_id: string
        vehicle_class_id: string
      }
    }
  | {
      status: "unavailable"
      reason: "no_active_fare" | "ambiguous_active_fare"
    }

export type TransferQuoteSnapshot = {
  quote_id: string
  amount: number
  currency_code: string
  origin_zone_id: string
  destination_zone_id: string
  vehicle_class_id: string
  variant_id: string
  price_set_id: string
  price_id: string
  h3_resolution: number
  expires_at: string
}

type ConfirmTransferReservationInput = {
  order_id: string
  cart_id: string
  line_item_id: string
  quote_snapshot: TransferQuoteSnapshot
  order_snapshot: Record<string, unknown>
  hold_expires_at: Date
}

type ExpireReservationHoldsInput = {
  now?: Date
}

const TRANSFER_FARE_RULES = [
  "origin_zone_id",
  "destination_zone_id",
  "vehicle_class_id",
] as const

class TransportModuleService extends MedusaService({
  TransportZone,
  TransportZoneCell,
  TransportVehicleClass,
  TransportReservation,
  TransportReservationHold,
  TransportAuditEvent,
}) {
  private readonly h3Resolution: number
  private readonly zones = new Map<string, ImportedTransportZone>()
  private readonly quotes = new Map<string, TransferQuoteSnapshot>()

  constructor(containerOrOptions: any = {}, options?: TransportModuleOptions) {
    super(...arguments)
    const directResolution = Object.prototype.hasOwnProperty.call(
      containerOrOptions,
      "h3Resolution"
    )
      ? containerOrOptions.h3Resolution
      : undefined
    this.h3Resolution = options?.h3Resolution ?? directResolution ?? 9
  }

  importZoneCells(input: ImportZoneCellsInput): ImportedTransportZone {
    assertUniqueCells(input.cells)
    input.cells.forEach((cell) => assertCellAtResolution(cell, this.h3Resolution))

    const zone = {
      id: input.id,
      name: input.name,
      active: input.active,
      cells: [...input.cells],
    }

    this.zones.set(zone.id, zone)

    return zone
  }

  getZone(id: string): ImportedTransportZone | undefined {
    return this.zones.get(id)
  }

  findActiveZoneForLocation(input: FindZoneInput): ImportedTransportZone | undefined {
    const cell = latLngToCell(input.lat, input.lng, this.h3Resolution)

    return [...this.zones.values()].find(
      (zone) => zone.active && zone.cells.includes(cell)
    )
  }

  async resolveTransferFare(
    pricingAccess: TransferFarePricingAccess,
    input: ResolveTransferFareInput
  ): Promise<TransferFareResolution> {
    const priceSets = await pricingAccess.listPriceSets(
      {},
      {
        relations: ["prices", "prices.price_rules", "prices.price_list"],
      }
    )
    const matches = priceSets.flatMap((priceSet) =>
      (priceSet.prices ?? [])
        .filter((price) => this.isActiveTransferFare(price, input))
        .map((price) => ({ priceSet, price }))
    )

    if (matches.length === 0) {
      return { status: "unavailable", reason: "no_active_fare" }
    }

    if (matches.length > 1) {
      return { status: "unavailable", reason: "ambiguous_active_fare" }
    }

    const [{ priceSet, price }] = matches

    return {
      status: "priced",
      fare: {
        price_set_id: priceSet.id,
        price_id: price.id,
        amount: price.amount,
        currency_code: price.currency_code,
        origin_zone_id: input.origin_zone_id,
        destination_zone_id: input.destination_zone_id,
        vehicle_class_id: input.vehicle_class_id,
      },
    }
  }

  createQuoteSnapshot(input: Omit<TransferQuoteSnapshot, "quote_id" | "expires_at">) {
    const quote = Object.freeze({
      ...input,
      quote_id: `trq_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })

    this.quotes.set(quote.quote_id, quote)

    return quote
  }

  getQuoteSnapshot(quoteId: string): TransferQuoteSnapshot | undefined {
    return this.quotes.get(quoteId)
  }

  async confirmTransferReservation(input: ConfirmTransferReservationInput) {
    const [existing] = await (this as any).listTransportReservations({
      order_id: input.order_id,
      line_item_id: input.line_item_id,
    })

    if (existing) {
      return existing
    }

    const hold = await (this as any).createTransportReservationHolds({
      quote_id: input.quote_snapshot.quote_id,
      cart_id: input.cart_id,
      status: "active",
      expires_at: input.hold_expires_at,
    })
    const reservation = await (this as any).createTransportReservations({
      order_id: input.order_id,
      cart_id: input.cart_id,
      line_item_id: input.line_item_id,
      status: "confirmed",
      quote_snapshot: this.createAuditSnapshot("quote", input.quote_snapshot),
      order_snapshot: this.createAuditSnapshot("order", input.order_snapshot),
      confirmed_at: new Date(),
    })

    await (this as any).updateTransportReservationHolds({
      id: hold.id,
      status: "confirmed",
      reservation_id: reservation.id,
    })
    await (this as any).createTransportAuditEvents({
      reservation_id: reservation.id,
      event_type: "reservation.confirmed",
      snapshot: this.createAuditSnapshot("reservation", {
        reservation_id: reservation.id,
        quote_snapshot: reservation.quote_snapshot,
        order_snapshot: reservation.order_snapshot,
      }),
    })

    return reservation
  }

  async lookupReservationByOrder(orderId: string) {
    const [reservation] = await (this as any).listTransportReservations({
      order_id: orderId,
    })

    return reservation
  }

  async expireReservationHolds(input: ExpireReservationHoldsInput = {}) {
    const now = input.now ?? new Date()
    const holds = await (this as any).listTransportReservationHolds({
      status: "active",
    })
    const expired = holds.filter((hold: any) => new Date(hold.expires_at) <= now)

    await Promise.all(
      expired.map((hold: any) =>
        (this as any).updateTransportReservationHolds({ id: hold.id, status: "expired" })
      )
    )

    return expired.map((hold: any) => ({ ...hold, status: "expired" }))
  }

  createAuditSnapshot(type: string, payload: Record<string, unknown>) {
    return Object.freeze({ type, payload: structuredClone(payload) })
  }

  private isActiveTransferFare(
    price: PricingPrice,
    input: ResolveTransferFareInput
  ): boolean {
    if (price.deleted_at || price.currency_code !== input.currency_code) {
      return false
    }

    if (price.price_list?.status && price.price_list.status !== "active") {
      return false
    }

    return TRANSFER_FARE_RULES.every((attribute) =>
      matchesRule(price.price_rules ?? [], attribute, input[attribute])
    )
  }
}

const matchesRule = (
  rules: PricingRule[],
  attribute: (typeof TRANSFER_FARE_RULES)[number],
  expectedValue: string
) =>
  rules.some(
    (rule) =>
      rule.attribute === attribute &&
      (rule.operator ?? "eq") === "eq" &&
      rule.value === expectedValue
  )

export default TransportModuleService
