import {page} from "$app/stores"

export const lastPageBySpaceUrl = new Map<string, string>()

export const setupHistory = () =>
  page.subscribe($page => {
    if ($page.params.relay) {
      lastPageBySpaceUrl.set($page.params.relay, $page.url.pathname)
    }
  })
