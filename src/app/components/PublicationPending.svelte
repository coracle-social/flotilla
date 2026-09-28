<script lang="ts">
  import cx from "classnames"
  import {stopPropagation} from "svelte/legacy"
  import type {Publishable} from "@welshman/app"

  type Props = {
    publication: Publishable
    // A standalone usage fills its own row, and forcing that inside a flex row costs that row a line.
    inline?: boolean
    class?: string
  }

  const {publication, inline = false, ...restProps}: Props = $props()

  const abort = () => publication.abort()

  const canAbort = $derived($publication.canAbort())
</script>

<div class={cx("flex px-1 text-xs", {"w-full justify-end": !inline}, restProps.class)}>
  <span class="flex items-center gap-1">
    <span class="spinner spinner-xs mx-1 translate-y-px"></span>
    <span class="opacity-50">Sending...</span>
    <button
      type="button"
      class={cx("underline transition-all", {
        link: canAbort,
        "pointer-events-none opacity-25": !canAbort,
      })}
      onclick={stopPropagation(abort)}>
      Cancel
    </button>
  </span>
</div>
