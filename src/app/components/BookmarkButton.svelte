<script lang="ts">
  import {getIdOrAddress} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Bookmark from "@assets/icons/bookmark.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import {
    addBookmark,
    deriveIsBookmarked,
    eventToBookmark,
    removeBookmark,
  } from "@app/features/bookmarks"
  import {pushToast} from "@app/ui/toast"

  type Props = {
    url?: string
    event: TrustedEvent
    onClick?: () => void
    class?: string
  }

  const {url, event, onClick, class: className = ""}: Props = $props()

  const isBookmarked = deriveIsBookmarked(getIdOrAddress(event))

  const toggle = async () => {
    onClick?.()

    // The repository takes the write at once, so the label flips before the relays answer.
    const bookmarked = $isBookmarked
    const error = await (bookmarked
      ? removeBookmark(getIdOrAddress(event))
      : addBookmark(eventToBookmark(event, url)))

    if (error) {
      pushToast({theme: "error", message: error})
    } else {
      pushToast({message: bookmarked ? "Bookmark removed" : "Bookmark saved!"})
    }
  }
</script>

<Button onclick={toggle} class={className}>
  <Icon size={4} icon={Bookmark} />
  {$isBookmarked ? "Remove Bookmark" : "Add Bookmark"}
</Button>
