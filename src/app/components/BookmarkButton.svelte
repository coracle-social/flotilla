<script lang="ts">
  import {getIdOrAddress} from "@welshman/util"
  import type {TrustedEvent} from "@welshman/util"
  import Bookmark from "@assets/icons/bookmark.svg?dataurl"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import {addBookmark, deriveIsBookmarked, eventToBookmark, removeBookmark} from "@app/bookmarks"
  import {pushToast} from "@app/toast"

  type Props = {
    url?: string
    event: TrustedEvent
    onClick?: () => void
    class?: string
  }

  const {url, event, onClick, class: className = ""}: Props = $props()

  const isBookmarked = deriveIsBookmarked(getIdOrAddress(event))

  const toggle = () => {
    onClick?.()

    if ($isBookmarked) {
      removeBookmark(getIdOrAddress(event))
      pushToast({message: "Bookmark removed"})
    } else {
      addBookmark(eventToBookmark(event, url))
      pushToast({message: "Bookmark saved!"})
    }
  }
</script>

<Button onclick={toggle} class={className}>
  <Icon size={4} icon={Bookmark} />
  {$isBookmarked ? "Remove Bookmark" : "Add Bookmark"}
</Button>
