import {writable} from "svelte/store"

// Whether the page is still waiting on content. The page bar is where that shows, so a view
// says so here rather than putting a loader among its own rows.
export const pageLoading = writable(false)
