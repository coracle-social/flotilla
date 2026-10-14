import "@poppanator/sveltekit-svg/dist/svg"
import "vite-plugin-pwa/pwa-assets"

// See https://kit.svelte.dev/docs/types#app
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    interface PageState {
      modals?: string[]
      // The note an entry opened in place, since shallow routing leaves page.url as it was.
      note?: string
      // The entry was pushed to open the note, so closing the note goes back over it.
      ownsNote?: boolean
      reply?: boolean
    }
    // interface Platform {}
  }
}

export {}
