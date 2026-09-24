import {removeUndefined} from "@welshman/lib"
import {tagSpec, tagValue} from "@welshman/util"
import type {ProfileReader} from "@welshman/domain"
import {encodeGeohash} from "@lib/geohash"

export type Place = {
  city?: string
  region?: string
  country: string
  latitude: number
  longitude: number
}

export type Granularity = "city" | "region" | "country"

export const granularityLabels: Record<Granularity, string> = {
  city: "City",
  region: "State or region",
  country: "Country",
}

type GeocodingResult = {
  name: string
  admin1?: string
  country?: string
  feature_code: string
  population?: number
  latitude: number
  longitude: number
}

// Open-Meteo indexes GeoNames' populated places and countries, never a state on its own.
export const searchPlaces = async (term: string) => {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search")

  url.searchParams.set("name", term)
  url.searchParams.set("count", "20")
  url.searchParams.set("language", "en")
  url.searchParams.set("format", "json")

  const response = await fetch(url)
  const {results = []}: {results?: GeocodingResult[]} = await response.json()
  const places: Place[] = []

  for (const result of results) {
    const {name, admin1, country, feature_code, population, latitude, longitude} = result

    if (feature_code === "PCLI") {
      places.push({country: name, latitude, longitude})
    } else if (country && population && population >= 1000) {
      places.push({city: name, region: admin1, country, latitude, longitude})
    }
  }

  return places
}

export const placeGranularities = (place: Place) => {
  const granularities: Granularity[] = []

  if (place.city) {
    granularities.push("city")
  }

  if (place.region) {
    granularities.push("region")
  }

  granularities.push("country")

  return granularities
}

export const displayPlace = (place: Place, granularity: Granularity) =>
  removeUndefined([
    granularity === "city" ? place.city : undefined,
    granularity === "country" ? undefined : place.region,
    place.country,
  ]).join(", ")

// A pin is finer than a state or a country asked to be, so only a city publishes one.
export const placeGeohash = (place: Place, granularity: Granularity) =>
  granularity === "city" ? encodeGeohash(place.latitude, place.longitude, 5) : undefined

export const getProfileLocation = (profile?: ProfileReader): string | undefined =>
  profile?.values.location

export const getProfileGeohash = (profile?: ProfileReader) =>
  profile ? tagValue(tagSpec("g"), profile.tags()) : undefined
