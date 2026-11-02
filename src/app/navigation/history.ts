import {get, writable} from "svelte/store"
import {page} from "$app/stores"
import {PLATFORM_RELAYS} from "@app/core/env"
import {navigate} from "@app/navigation/navigate"
import * as pages from "@app/navigation/pages"

export let lastMessagesUrl: string | undefined = undefined

const lastPageBySpaceUrl = new Map<string, string>()

// The space the user was in most recently, so the space menu opens from a page outside a space.
export const lastSpaceUrl = writable<string | undefined>(undefined)

// The page store notifies on a modal opening as well as on a navigation, and a modal leaves the url where it is.
export const setupHistory = () => {
  let lastPath: string | undefined

  return page.subscribe($page => {
    const path = $page.url.pathname

    if (path !== lastPath) {
      lastPath = path

      if ($page.params.relay) {
        const url = pages.decodeRelay($page.params.relay)

        if (path !== pages.space.path({url})) {
          lastPageBySpaceUrl.set(url, path)
        }

        lastSpaceUrl.set(url)
      }

      if ($page.params.chat) {
        lastMessagesUrl = path
      }
    }
  })
}

export const forgetSpacePage = (url: string) => lastPageBySpaceUrl.delete(url)

export const hasSpacePage = (url: string) => lastPageBySpaceUrl.has(url)

export const makeSpaceEntryPath = (url: string) =>
  lastPageBySpaceUrl.get(url) ?? pages.spaceAbout.path({url})

export const goToSpace = (url: string, options: {replaceState?: boolean} = {}) =>
  navigate(makeSpaceEntryPath(url), options)

export const goToMovedSpace = (oldUrl: string, newUrl: string) =>
  navigate(get(page).url.pathname.replace(pages.encodeRelay(oldUrl), pages.encodeRelay(newUrl)))

export const getHomePath = () =>
  PLATFORM_RELAYS.length > 0 ? makeSpaceEntryPath(PLATFORM_RELAYS[0]) : pages.home.path()

export const goToHome = () => navigate(getHomePath(), {keepModal: true, replaceState: true})
