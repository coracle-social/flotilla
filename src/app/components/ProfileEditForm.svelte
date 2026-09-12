<script module lang="ts">
  export type ProfileValues = {
    name?: string
    about?: string
    picture?: string
    banner?: string
    website?: string
    nip05?: string
    lud06?: string
    lud16?: string
  }

  export type Values = {
    profile: ProfileValues
  }
</script>

<script lang="ts">
  import type {Snippet} from "svelte"
  import {preventDefault} from "@lib/html"
  import UserCircle from "@assets/icons/user-circle.svg?dataurl"
  import MapPoint from "@assets/icons/map-point.svg?dataurl"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import InputProfilePicture from "@app/components/InputProfilePicture.svelte"
  import InfoHandle from "@app/components/InfoHandle.svelte"
  import {pushModal} from "@app/modal"

  type Props = {
    initialValues: Values
    onsubmit: (values: Values) => void
    isSignup?: boolean
    footer: Snippet
    progressBar?: Snippet
  }

  const {initialValues, isSignup, onsubmit, footer, progressBar}: Props = $props()

  const values = $state(initialValues)

  const submit = () => onsubmit($state.snapshot(values))

  let file: File | undefined = $state()
</script>

<Modal
  label={isSignup ? "Create a profile" : "Edit profile"}
  tag="form"
  onsubmit={preventDefault(submit)}>
  <ModalBody>
    {#if isSignup}
      <div class="grid grid-cols-2">
        <div class="flex flex-col gap-2">
          <p class="text-2xl">Create a Profile</p>
          <p class="text-sm">
            Give people something to go on — but remember, privacy matters! Be careful about sharing
            sensitive information.
          </p>
        </div>
        <div class="flex flex-col items-center justify-center gap-2">
          <InputProfilePicture bind:file bind:url={values.profile.picture} />
          <p class="text-xs">Upload an Avatar</p>
        </div>
      </div>
    {:else}
      <div class="flex items-center justify-center py-4">
        <InputProfilePicture bind:file bind:url={values.profile.picture} />
      </div>
    {/if}
    <Field>
      {#snippet label()}
        <p>Nickname</p>
      {/snippet}
      {#snippet input()}
        <label class="input flex w-full items-center gap-2">
          <Icon icon={UserCircle} />
          <input bind:value={values.profile.name} class="grow" type="text" />
        </label>
      {/snippet}
      {#snippet info()}
        What would you like people to call you?
      {/snippet}
    </Field>
    <Field>
      {#snippet label()}
        <p>About You</p>
      {/snippet}
      {#snippet input()}
        <textarea class="textarea input leading-4 w-full" rows="5" bind:value={values.profile.about}
        ></textarea>
      {/snippet}
      {#snippet info()}
        Give a brief introduction to why you're here.
      {/snippet}
    </Field>
    {#if !isSignup}
      <Field>
        {#snippet label()}
          <p>Website</p>
        {/snippet}
        {#snippet input()}
          <label class="input flex w-full items-center gap-2">
            <Icon icon={LinkRound} />
            <input
              bind:value={values.profile.website}
              class="grow"
              type="text"
              placeholder="https://" />
          </label>
        {/snippet}
        {#snippet info()}
          A link to your personal site or portfolio.
        {/snippet}
      </Field>
      <Field>
        {#snippet label()}
          <p>Nostr Address</p>
        {/snippet}
        {#snippet input()}
          <label class="input flex w-full items-center gap-2">
            <Icon icon={MapPoint} />
            <input bind:value={values.profile.nip05} class="grow" type="text" />
          </label>
        {/snippet}
        {#snippet info()}
          <p>
            <Button class="button button-link" onclick={() => pushModal(InfoHandle)}
              >What is a nostr address?</Button>
          </p>
        {/snippet}
      </Field>
    {/if}
  </ModalBody>
  {#if progressBar}
    {@render progressBar()}
  {/if}
  <ModalFooter>
    {@render footer()}
  </ModalFooter>
</Modal>
