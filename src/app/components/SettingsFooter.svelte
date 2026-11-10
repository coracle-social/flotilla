<script lang="ts">
  import cx from "classnames"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"

  type Props = {
    dirty: boolean
    loading?: boolean
    reset: () => void
  }

  const {dirty, loading = false, reset}: Props = $props()
</script>

<!-- Hidden rather than removed, so the page doesn't jump when there is something to save. -->
<div
  data-component="SettingsFooter"
  class={cx(
    "card sticky -bottom-3 flex flex-row items-center justify-between gap-4 transition-opacity duration-200",
    {"pointer-events-none opacity-0": !dirty},
  )}
  inert={!dirty}
  aria-hidden={!dirty}>
  <Button class="button button-neutral" onclick={reset} disabled={loading}>Discard Changes</Button>
  <Button class="button button-primary" type="submit" disabled={loading}>
    <Spinner {loading}>Save Changes</Spinner>
  </Button>
</div>
