import { latLngToCell } from "h3-js"

import { assertCellAtResolution, assertUniqueCells } from "./h3-validation"

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

const TRANSFER_FARE_RULES = [
  "origin_zone_id",
  "destination_zone_id",
  "vehicle_class_id",
] as const

class TransportModuleService {
  private readonly h3Resolution: number
  private readonly zones = new Map<string, ImportedTransportZone>()

  constructor({ h3Resolution = 9 }: TransportModuleOptions = {}) {
    this.h3Resolution = h3Resolution
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
