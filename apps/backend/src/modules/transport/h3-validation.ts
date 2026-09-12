import { getResolution, isValidCell } from "h3-js"

export function assertCellAtResolution(cell: string, resolution: number): void {
  if (!isValidCell(cell)) {
    throw new Error(`Invalid H3 cell: ${cell}`)
  }

  if (getResolution(cell) !== resolution) {
    throw new Error(`H3 resolution mismatch: expected ${resolution}`)
  }
}

export function assertUniqueCells(cells: string[]): void {
  const seen = new Set<string>()

  for (const cell of cells) {
    if (seen.has(cell)) {
      throw new Error(`Duplicate H3 cell: ${cell}`)
    }

    seen.add(cell)
  }
}
