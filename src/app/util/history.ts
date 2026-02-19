import {page} from "$app/stores"

export const lastPageBySpaceUrl = new Map<string, string>()
export let lastChatUrl: string | undefined = undefined

export const setupHistory = () =>
  page.subscribe($page => {
    if ($page.params.relay) {
      lastPageBySpaceUrl.set($page.params.relay, $page.url.pathname)
    }
    if ($page.params.chat) {
      lastChatUrl = $page.url.pathname
    }
  })
