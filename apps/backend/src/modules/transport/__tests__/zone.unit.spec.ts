import TransportModuleService from "../service"
import { PUJ_BOUNDARY_FIXTURES } from "../fixtures/puj-boundary"

describe("Transport zone H3 validation", () => {
  it("accepts active zone cells at the configured H3 resolution", () => {
    const service = new TransportModuleService({ h3Resolution: 9 })
    const fixture = PUJ_BOUNDARY_FIXTURES[0]

    const zone = service.importZoneCells({
      id: "zone-puj-airport",
      name: "PUJ Airport",
      active: true,
      cells: [fixture.expectedCell],
    })

    expect(zone.active).toBe(true)
    expect(zone.cells).toEqual([fixture.expectedCell])
  })

  it("rejects malformed H3 cells", () => {
    const service = new TransportModuleService({ h3Resolution: 9 })

    expect(() =>
      service.importZoneCells({
        id: "zone-puj-airport",
        name: "PUJ Airport",
        active: true,
        cells: ["not-a-cell"],
      })
    ).toThrow("Invalid H3 cell")
  })

  it("rejects cells that do not match the configured H3 resolution", () => {
    const service = new TransportModuleService({ h3Resolution: 8 })
    const fixture = PUJ_BOUNDARY_FIXTURES[0]

    expect(() =>
      service.importZoneCells({
        id: "zone-puj-airport",
        name: "PUJ Airport",
        active: true,
        cells: [fixture.expectedCell],
      })
    ).toThrow("H3 resolution mismatch")
  })

  it("rejects duplicate cells and leaves the zone inactive", () => {
    const service = new TransportModuleService({ h3Resolution: 9 })
    const fixture = PUJ_BOUNDARY_FIXTURES[0]

    expect(() =>
      service.importZoneCells({
        id: "zone-puj-airport",
        name: "PUJ Airport",
        active: true,
        cells: [fixture.expectedCell, fixture.expectedCell],
      })
    ).toThrow("Duplicate H3 cell")
    expect(service.getZone("zone-puj-airport")?.active).toBeUndefined()
  })

  it("classifies real PUJ-area boundary fixtures into their expected zones", () => {
    const service = new TransportModuleService({ h3Resolution: 9 })

    for (const fixture of PUJ_BOUNDARY_FIXTURES) {
      service.importZoneCells({
        id: fixture.expectedZoneId,
        name: fixture.expectedZoneName,
        active: true,
        cells: [fixture.expectedCell],
      })

      const zone = service.findActiveZoneForLocation({
        lat: fixture.lat,
        lng: fixture.lng,
      })

      expect(zone?.id).toBe(fixture.expectedZoneId)
    }
  })
})
