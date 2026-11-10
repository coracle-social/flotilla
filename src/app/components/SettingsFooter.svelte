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

<!-- The spacer keeps the end of the page clear of the bar, which floats over the page column. -->
<div class="h-28 shrink-0 sm:h-32" aria-hidden="true"></div>
<div
  data-component="SettingsFooter"
  class="pointer-events-none absolute inset-x-0 bottom-0 z-nav px-2 pb-2 sm:px-4 sm:pb-4">
  <div
    class={cx(
      "card flex flex-row items-center justify-between gap-4 transition-[translate,opacity] duration-300 ease-out",
      {
        "pointer-events-auto": dirty,
        "translate-y-[calc(100%+1rem)] opacity-0": !dirty,
      },
    )}
    inert={!dirty}
    aria-hidden={!dirty}>
    <Button class="button button-neutral" onclick={reset} disabled={loading}
      >Discard Changes</Button>
    <Button class="button button-primary" type="submit" disabled={loading}>
      <Spinner {loading}>Save Changes</Spinner>
    </Button>
  </div>
</div>
