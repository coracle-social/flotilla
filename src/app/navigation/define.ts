import type {RouteId, RouteParams} from "$app/types"
import type {Maybe} from "@welshman/lib"

// SvelteKit names these after directories and layouts, but nothing is served at them.
export type PageId = Exclude<RouteId, "/notes" | "/people" | "/settings">

export type Route<Id extends RouteId, P> = {
  id: Id
  path: (params: P) => string
  decode: (params: RouteParams<Id>, search?: URLSearchParams) => P
  title: (params: P) => string
  pageTitle: (params: RouteParams<Id>, search: URLSearchParams) => string
}

export type RouteSpec<Id extends RouteId, P> = {
  encode: (params: P) => RouteParams<Id>
  decode: (params: RouteParams<Id>, search: URLSearchParams) => P
  search?: (params: P) => Record<string, Maybe<string>>
  title: (params: P) => string
}

export const defineRoute = <Id extends RouteId, P>(
  id: Id,
  {encode, decode, search, title}: RouteSpec<Id, P>,
): Route<Id, P> => ({
  id,
  title,
  decode: (params, query = new URLSearchParams()) => decode(params, query),
  pageTitle: (params, query) => title(decode(params, query)),
  path: params => {
    const segments: Record<string, string> = encode(params)
    const pathname = id.replace(/\[(\w+)\]/g, (_, name: string) => segments[name])
    const query = new URLSearchParams()

    for (const [key, value] of Object.entries(search?.(params) ?? {})) {
      if (value) {
        query.set(key, value)
      }
    }

    return query.size > 0 ? `${pathname}?${query}` : pathname
  },
})

export const defineStaticRoute = <Id extends RouteId>(id: Id, title: string): Route<Id, void> => ({
  id,
  decode: () => undefined,
  title: () => title,
  pageTitle: () => title,
  path: () => id,
})
