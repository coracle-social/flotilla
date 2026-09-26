<script module lang="ts">
  export type Values = {
    label: string
    description: string
    color: number
  }
</script>

<script lang="ts">
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {roleColor} from "@app/roles"

  type Props = {
    initialValues?: Partial<Values>
    loading?: boolean
    onSubmit: (values: Values) => void
  }

  const {initialValues = {}, loading = false, onSubmit}: Props = $props()

  const values = $state({
    label: initialValues.label ?? "",
    description: initialValues.description ?? "",
  })

  let hue = $state(initialValues.color ?? Math.floor(Math.random() * 360))

  const back = () => history.back()

  const submit = () => onSubmit({...values, color: hue})
</script>

<div class="flex flex-col gap-4">
  <Field>
    {#snippet label()}
      <p>Name</p>
    {/snippet}
    {#snippet input()}
      <input bind:value={values.label} class="input w-full" placeholder="Moderator" />
    {/snippet}
  </Field>
  <Field>
    {#snippet label()}
      <p>Description</p>
    {/snippet}
    {#snippet input()}
      <textarea bind:value={values.description} class="textarea input w-full" rows="2"></textarea>
    {/snippet}
  </Field>
  <Field>
    {#snippet label()}
      <p>Color</p>
    {/snippet}
    {#snippet input()}
      <div class="flex items-center gap-3">
        <div
          class="h-8 w-8 shrink-0 rounded-full border-2 border-line"
          style="background-color: {roleColor(hue)}">
        </div>
        <input
          type="range"
          min="0"
          max="360"
          bind:value={hue}
          class="range grow"
          style="color: {roleColor(hue)}; --range-shdw: {roleColor(hue)}" />
      </div>
    {/snippet}
  </Field>
</div>
<ModalFooter>
  <Button class="button button-link" onclick={back}>
    <Icon icon={AltArrowLeft} />
    Go back
  </Button>
  <Button class="button button-primary" onclick={submit} disabled={loading || !values.label}>
    <Spinner {loading}>Save changes</Spinner>
  </Button>
</ModalFooter>
