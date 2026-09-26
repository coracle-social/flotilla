<script lang="ts">
  import cx from "classnames"
  import {sleep} from "@welshman/lib"
  import Spinner from "@lib/components/Spinner.svelte"

  type Props = {
    loadingMessage: string
    failureMessage: string
    class?: string
  }

  const {loadingMessage, failureMessage, ...props}: Props = $props()
</script>

<div class={cx("flex justify-center py-20", props.class)}>
  {#await sleep(5000)}
    <Spinner loading>{loadingMessage}</Spinner>
  {:then}
    <p>{failureMessage}</p>
  {/await}
</div>
