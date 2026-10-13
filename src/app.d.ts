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
      // The entry was pushed to open the note in the url, so closing the note goes back over it.
      note?: boolean
      reply?: boolean
    }
    // interface Platform {}
  }
}

export {}
