export type PujBoundaryFixture = {
  label: string
  lat: number
  lng: number
  expectedCell: string
  expectedZoneId: string
  expectedZoneName: string
}

export const PUJ_BOUNDARY_FIXTURES: PujBoundaryFixture[] = [
  {
    label: "PUJ Airport Terminal A",
    lat: 18.5674,
    lng: -68.3634,
    expectedCell: "894cc602bb3ffff",
    expectedZoneId: "zone-puj-airport",
    expectedZoneName: "PUJ Airport",
  },
  {
    label: "Punta Cana Village",
    lat: 18.5601,
    lng: -68.3725,
    expectedCell: "894cc602b63ffff",
    expectedZoneId: "zone-punta-cana-village",
    expectedZoneName: "Punta Cana Village",
  },
  {
    label: "Cabeza de Toro boundary",
    lat: 18.6497,
    lng: -68.3671,
    expectedCell: "894cc610973ffff",
    expectedZoneId: "zone-cabeza-de-toro",
    expectedZoneName: "Cabeza de Toro",
  },
]
