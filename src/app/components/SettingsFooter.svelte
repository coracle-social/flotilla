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

<!-- The spacer holds the bar's height, so revealing the bar never slides a field under it. -->
<div class="h-24 shrink-0" aria-hidden="true"></div>
<div
  data-component="SettingsFooter"
  class="pointer-events-none fixed inset-x-0 bottom-[calc(var(--saib)+var(--mobile-nav-height))] z-nav px-2 sm:px-4">
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
