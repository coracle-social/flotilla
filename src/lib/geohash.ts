export const encodeGeohash = (latitude: number, longitude: number, precision: number) => {
  const latitudes = [-90, 90]
  const longitudes = [-180, 180]

  let hash = ""
  let bits = 0
  let index = 0
  let even = true

  while (hash.length < precision) {
    const bounds = even ? longitudes : latitudes
    const middle = (bounds[0] + bounds[1]) / 2

    if ((even ? longitude : latitude) > middle) {
      index = index * 2 + 1
      bounds[0] = middle
    } else {
      index = index * 2
      bounds[1] = middle
    }

    even = !even
    bits += 1

    if (bits === 5) {
      hash += "0123456789bcdefghjkmnpqrstuvwxyz"[index]
      bits = 0
      index = 0
    }
  }

  return hash
}

export const decodeGeohash = (hash?: string) => {
  const indexes = (hash ?? "")
    .toLowerCase()
    .split("")
    .map(character => "0123456789bcdefghjkmnpqrstuvwxyz".indexOf(character))

  if (indexes.length === 0 || indexes.includes(-1)) {
    return undefined
  }

  const latitudes = [-90, 90]
  const longitudes = [-180, 180]

  let even = true

  for (const index of indexes) {
    for (const mask of [16, 8, 4, 2, 1]) {
      const bounds = even ? longitudes : latitudes
      const middle = (bounds[0] + bounds[1]) / 2

      if (index & mask) {
        bounds[0] = middle
      } else {
        bounds[1] = middle
      }

      even = !even
    }
  }

  return {
    latitude: (latitudes[0] + latitudes[1]) / 2,
    longitude: (longitudes[0] + longitudes[1]) / 2,
  }
}
