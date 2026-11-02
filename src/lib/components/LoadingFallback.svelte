<script lang="ts">
  import cx from "classnames"
  import Spinner from "@lib/components/Spinner.svelte"

  type Props = {
    loadingMessage: string
    failureMessage: string
    // Re-runs the caller's load while the value is still missing.
    retry?: () => void
    class?: string
  }

  const {loadingMessage, failureMessage, retry, ...props}: Props = $props()

  // Only call it failed once the repository has had time to fill in.
  let attempts = $state(0)
  let failed = $state(false)

  $effect(() => {
    if (failed) return

    if (attempts >= 3) {
      failed = true

      return
    }

    const timer = setTimeout(() => {
      attempts += 1

      if (attempts < 3) {
        retry?.()
      }
    }, 5000)

    return () => clearTimeout(timer)
  })
</script>

<div class={cx("flex justify-center py-20", props.class)}>
  {#if failed}
    <p>{failureMessage}</p>
  {:else}
    <Spinner loading>{loadingMessage}</Spinner>
  {/if}
</div>
