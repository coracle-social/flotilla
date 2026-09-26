/** The lower aspect bound is 1:1 on landscape and 3:4 on portrait, and the upper is 16:9. */
const TILE_ASPECT_PORTRAIT = 3 / 4
const TILE_ASPECT_LANDSCAPE = 16 / 9
const TILE_GAP = 8

/** Below this the grid scrolls rather than forcing portrait tiles, which is ~6-8 tiles on a portrait phone. */
const MIN_TILE_HEIGHT = 120

export type TileRow = {
  columnCount: number
  tileWidth: number
  tileHeight: number
  /** Total width of this row including gaps — for the template's max-width */
  rowWidth: number
  aspectRatio: number
}

/** All tiles share one size. Full rows fill the container width and a partial row is centered. */
export type AdaptiveTileGrid = {
  rows: TileRow[]
  totalWidth: number
  totalHeight: number
}

/** Score for comparing candidate layouts. Lower is better. */
type LayoutScore = {
  /** Penalty for vertical overflow: 0 if none, else huge */
  verticalOverflowPenalty: number
  /** Penalty for horizontal overflow: 0 if none, else huge */
  horizontalOverflowPenalty: number
  /** Penalty when tiles fall below MIN_TILE_HEIGHT even while fitting */
  minTileHeightPenalty: number
  /** Negative tile area (we want to maximize area, so negate) */
  negativeArea: number
  /** Leftover whitespace (underflow) in px */
  whitespace: number
  /** Average absolute deviation from 16:9 across all tiles */
  aspectDeviation: number
}

const compareScores = (a: LayoutScore, b: LayoutScore): number => {
  const fields: (keyof LayoutScore)[] = [
    "verticalOverflowPenalty",
    "horizontalOverflowPenalty",
    "minTileHeightPenalty",
    "negativeArea",
    "whitespace",
    "aspectDeviation",
  ]
  for (const field of fields) {
    if (a[field] !== b[field]) {
      return a[field] - b[field]
    }
  }
  return 0
}

/** The largest tile that fits, shrunk to whichever dimension is more constraining. */
const fitTile = (availWidth: number, availHeight: number, minAspect: number) => {
  const fillAspect = availWidth / availHeight
  const aspectRatio = Math.max(minAspect, Math.min(TILE_ASPECT_LANDSCAPE, fillAspect))
  if (fillAspect >= aspectRatio) {
    const tileWidth = availHeight * aspectRatio
    return {tileWidth, tileHeight: availHeight, aspectRatio}
  }
  const tileHeight = availWidth / aspectRatio
  return {tileWidth: availWidth, tileHeight, aspectRatio}
}

/** A candidate grid for a given column count, with the partial last row centered. */
const buildCandidate = (
  tileCount: number,
  columnCount: number,
  containerWidth: number,
  containerHeight: number,
  minAspect: number,
): AdaptiveTileGrid | undefined => {
  const gap = TILE_GAP
  const fullRowCount = Math.floor(tileCount / columnCount)
  const remainder = tileCount % columnCount
  const totalRowCount = fullRowCount + (remainder > 0 ? 1 : 0)

  const availHeight = (containerHeight - (totalRowCount - 1) * gap) / totalRowCount
  const availWidth = (containerWidth - (columnCount - 1) * gap) / columnCount
  if (availWidth <= 0 || availHeight <= 0) {
    return undefined
  }

  const {tileWidth, tileHeight, aspectRatio} = fitTile(availWidth, availHeight, minAspect)

  const rows: TileRow[] = []
  for (let r = 0; r < fullRowCount; r++) {
    rows.push({
      columnCount,
      tileWidth,
      tileHeight,
      rowWidth: columnCount * tileWidth + (columnCount - 1) * gap,
      aspectRatio,
    })
  }
  if (remainder > 0) {
    rows.push({
      columnCount: remainder,
      tileWidth,
      tileHeight,
      rowWidth: remainder * tileWidth + (remainder - 1) * gap,
      aspectRatio,
    })
  }

  const totalHeight = totalRowCount * tileHeight + (totalRowCount - 1) * gap
  const totalWidth = columnCount * tileWidth + (columnCount - 1) * gap

  return {rows, totalWidth, totalHeight}
}

/** Scored on overflow first, then whitespace, then distance from 16:9, then tile size. */
export const computeAdaptiveGrid = (
  tileCount: number,
  containerWidth: number,
  containerHeight: number,
): AdaptiveTileGrid | undefined => {
  if (tileCount <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return undefined
  }

  const minAspect = containerWidth / containerHeight >= 4 / 3 ? 1 : TILE_ASPECT_PORTRAIT

  let best: AdaptiveTileGrid | undefined
  let bestScore: LayoutScore | undefined

  for (let columnCount = 1; columnCount <= tileCount; columnCount++) {
    const candidate = buildCandidate(
      tileCount,
      columnCount,
      containerWidth,
      containerHeight,
      minAspect,
    )
    if (!candidate) {
      continue
    }

    const {tileWidth, tileHeight, aspectRatio} = candidate.rows[0]
    const verticalOverflow = Math.max(0, candidate.totalHeight - containerHeight)
    const horizontalOverflow = Math.max(0, candidate.totalWidth - containerWidth)
    const whitespace =
      Math.max(0, containerWidth - candidate.totalWidth) +
      Math.max(0, containerHeight - candidate.totalHeight)
    const totalArea = tileWidth * tileHeight * tileCount

    const overflowPenaltyMultiplier = tileHeight >= MIN_TILE_HEIGHT ? 1_000_000 : 1
    const verticalOverflowPenalty = verticalOverflow * overflowPenaltyMultiplier
    const horizontalOverflowPenalty = horizontalOverflow * overflowPenaltyMultiplier
    const minTileHeightPenalty =
      tileHeight < MIN_TILE_HEIGHT ? (MIN_TILE_HEIGHT - tileHeight) * 1000 : 0

    const score: LayoutScore = {
      verticalOverflowPenalty,
      horizontalOverflowPenalty,
      minTileHeightPenalty,
      negativeArea: -totalArea,
      whitespace,
      aspectDeviation: Math.abs(aspectRatio - TILE_ASPECT_LANDSCAPE),
    }

    if (!bestScore || compareScores(score, bestScore) < 0) {
      bestScore = score
      best = candidate
    }
  }

  return best
}
