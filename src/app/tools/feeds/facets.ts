import {synced} from "@welshman/store"
import {kv} from "@app/core/storage"

export type NoteFacet = "notes" | "replies" | "interactions"

export type FacetCounts = Map<NoteFacet, number>

const isNoteFacet = (value: unknown): value is NoteFacet =>
  value === "notes" || value === "replies" || value === "interactions"

// The stored key outlives the facet's old names, so a "popular" or "engaged" comes back as interactions.
const readIncludedNoteFacets = async (key: string): Promise<NoteFacet[] | undefined> => {
  const stored = await kv.get<unknown[]>(key)

  if (Array.isArray(stored)) {
    const migrated = stored.map(value =>
      value === "popular" || value === "engaged" ? "interactions" : value,
    )

    return migrated.filter(isNoteFacet)
  }
}

export const includedNoteFacets = synced<NoteFacet[]>({
  key: "includedNetworkFeedTypes",
  defaultValue: ["notes", "replies"],
  storage: {get: readIncludedNoteFacets, set: kv.set},
})

export const includesAnyFacet = (included: NoteFacet[], facets: NoteFacet[]): boolean =>
  facets.some(facet => included.includes(facet))

// Resolves the first time the facet is included, so a source only it shows starts once it's wanted.
export const whenIncluded = (facet: NoteFacet, signal: AbortSignal) =>
  new Promise<void>(resolve => {
    const unsubscribe = includedNoteFacets.subscribe($facets => {
      if ($facets.includes(facet)) {
        resolve()
      }
    })

    signal.addEventListener("abort", unsubscribe, {once: true})
  })
