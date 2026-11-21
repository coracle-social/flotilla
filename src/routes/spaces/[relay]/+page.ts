import {redirect} from "@sveltejs/kit"
import theme from "tailwindcss/defaultTheme"
import {makeSpaceEntryPath} from "@app/navigation/history"
import * as pages from "@app/navigation/pages"
import type {PageLoad} from "./$types"

// A wide screen shows the space's menu beside its pages, so it goes to a page before this one renders.
export const load: PageLoad = ({params}) => {
  if (window.innerWidth > parseFloat(theme.screens.md) * 16) {
    redirect(307, makeSpaceEntryPath(pages.space.decode(params).url))
  }
}
