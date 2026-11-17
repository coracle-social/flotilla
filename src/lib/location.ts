import {removeUndefined, uniqBy} from "@welshman/lib"
import {tagSpec, tagValue} from "@welshman/util"
import type {ProfileReader} from "@welshman/domain"
import {encodeGeohash} from "@lib/geohash"

export type Place = {
  type: "city" | "state" | "country"
  name: string
  state?: string
  country?: string
  latitude: number
  longitude: number
}

type GeocodingFeature = {
  geometry: {coordinates: [number, number]}
  properties: {type: string; name: string; state?: string; country?: string}
}

const isPlaceType = (type: string): type is Place["type"] =>
  type === "city" || type === "state" || type === "country"

const toPlace = ({geometry, properties}: GeocodingFeature): Place | undefined => {
  const {type, name, state, country} = properties
  const [longitude, latitude] = geometry.coordinates

  return isPlaceType(type) ? {type, name, state, country, latitude, longitude} : undefined
}

export const displayPlace = (place: Place) =>
  removeUndefined([
    place.name,
    place.state,
    place.type === "country" ? undefined : place.country,
  ]).join(", ")

// Photon indexes OpenStreetMap for autocomplete; osm_tag=place keeps streets and buildings out.
export const searchPlaces = async (term: string) => {
  const url = new URL("https://photon.komoot.io/api/")

  url.searchParams.set("q", term)
  url.searchParams.set("limit", "15")
  url.searchParams.set("lang", "en")
  url.searchParams.set("osm_tag", "place")

  const response = await fetch(url)
  const {features = []}: {features?: GeocodingFeature[]} = await response.json()

  return uniqBy(displayPlace, removeUndefined(features.map(toPlace)))
}

// A pin is finer than a state or a country asked to be, so only a city publishes one.
export const placeGeohash = (place: Place) =>
  place.type === "city" ? encodeGeohash(place.latitude, place.longitude, 5) : undefined

export const getProfileLocation = (profile?: ProfileReader): string | undefined =>
  profile?.values.location

export const getProfileGeohash = (profile?: ProfileReader) =>
  profile ? tagValue(tagSpec("g"), profile.tags()) : undefined
