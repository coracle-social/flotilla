import {writable} from "svelte/store"

// Whether the page is still waiting on content, which the page bar is what shows.
export const pageLoading = writable(false)
