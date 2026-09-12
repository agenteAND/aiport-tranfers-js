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
}

export default TransportModuleService
