<script lang="ts">
  import type {HTMLInputAttributes} from "svelte/elements"

  type Props = Omit<HTMLInputAttributes, "checked" | "onchange" | "type"> & {
    checked?: boolean
    onchange?: (checked: boolean) => void
  }

  let {checked = $bindable(), onchange, ...restProps}: Props = $props()

  const onInput = (event: Event & {currentTarget: HTMLInputElement}) =>
    onchange?.(event.currentTarget.checked)
</script>

<input {...restProps} type="checkbox" class="toggle" bind:checked onchange={onInput} />
