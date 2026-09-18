/* eslint prefer-rest-params: 0 */

import {page} from "$app/stores"
import {getSetting} from "@app/settings"

export const analyticsAvailable = true

const w = window as any

w.plausible =
  w.plausible ||
  function () {
    ;(w.plausible.q = w.plausible.q || []).push(arguments)
  }

// Modals live in page state, so the page store also emits when one opens or closes
export const setupAnalytics = () => {
  let prevHref: string | undefined

  return page.subscribe($page => {
    if ($page.route && getSetting("report_usage") && $page.url.href !== prevHref) {
      prevHref = $page.url.href

      w.plausible("pageview", {u: $page.route.id})
    }
  })
}
