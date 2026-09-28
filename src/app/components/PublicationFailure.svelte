<script lang="ts">
  import cx from "classnames"
  import {stopPropagation} from "svelte/legacy"
  import {noop} from "@welshman/lib"
  import {PublicationGroup} from "@welshman/app"
  import type {Publishable} from "@welshman/app"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import PublicationToast from "@app/components/PublicationToast.svelte"
  import PublicationStatusDetail from "@app/components/PublicationStatusDetail.svelte"
  import {publisher} from "@app/core"
  import {pushToast} from "@app/toast"

  type Props = {
    publication: Publishable
    showToastOnRetry?: boolean
    // See PublicationPending's `inline` — same trade-off, same default.
    inline?: boolean
    class?: string
  }

  const {publication, showToastOnRetry, inline = false, ...restProps}: Props = $props()

  const showFailure = $derived($publication.isComplete() && $publication.getFailedUrls().length > 0)

  const retry = (url: string) => {
    const retried =
      publication instanceof PublicationGroup
        ? $publisher.retry(publication, [url])
        : $publisher.retry(publication, [url])

    if (showToastOnRetry) {
      pushToast({
        timeout: 30_000,
        children: {
          component: PublicationToast,
          props: {publication: retried},
        },
      })
    }
  }
</script>

{#if showFailure}
  <button
    class={cx("flex px-1 text-xs", {"w-full justify-end": !inline}, restProps.class)}
    onclick={stopPropagation(noop)}>
    <Tippy
      class="flex items-center"
      component={PublicationStatusDetail}
      props={{publication, retry}}
      params={{interactive: true, maxWidth: "none", trigger: "click"}}>
      <span class="flex cursor-pointer items-center gap-1 opacity-75">
        <Icon icon={Danger} class="text-error" size={3} />
        <span>Failed to send!</span>
      </span>
    </Tippy>
  </button>
{/if}
