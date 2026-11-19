<script lang="ts">
  import {onDestroy} from "svelte"
  import {poll} from "@welshman/lib"
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Lock from "@assets/icons/lock-keyhole.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import {errorMessage} from "@lib/util"
  import Field from "@lib/components/Field.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Link from "@app/components/Link.svelte"
  import {PLATFORM_NAME} from "@app/core/env"
  import {popModal} from "@app/navigation/dialogs"
  import {getSetting, publishSettings} from "@app/core/settings"
  import {pushToast} from "@app/navigation/toast"
  import {trackSubmit} from "@app/components/flows/submit"

  type Props = {
    feature: string
    subtitle: string
    onReady?: () => void
    onCancel?: () => void
  }

  const {feature, subtitle, onReady, onCancel}: Props = $props()

  const action = `Enable ${feature.toLowerCase()}`

  const {loading, submit: save} = trackSubmit(
    error => `Failed to save your key: ${errorMessage(error)}`,
    async () => {
      await publishSettings({openrouter_key: openrouterKey.trim()})

      // The settings projection lands after the publish, so the key reads back only once it has.
      await poll({
        interval: 30,
        condition: () => Boolean(getSetting("openrouter_key")),
        signal: AbortSignal.timeout(3000),
      })

      pushToast({message: `${feature} is ready to use!`})

      pending = false
      popModal()
      onReady?.()
    },
  )

  let pending = true
  let openrouterKey = $state("")

  // Leaving without a key hands the decision back to whoever asked for it.
  onDestroy(() => {
    if (pending) {
      onCancel?.()
    }
  })
</script>

<Modal tag="form" onsubmit={preventDefault(save)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>{action}?</ModalTitle>
      <ModalSubtitle>{subtitle}</ModalSubtitle>
    </ModalHeader>
    <p>
      {feature} is powered by <Link external href="https://openrouter.ai" class="text-primary"
        >OpenRouter</Link
      >, which charges a fraction of a cent for each use. To turn it on, add some credit to an
      OpenRouter account, then
      <Link external href="https://openrouter.ai/settings/keys" class="text-primary"
        >create an API key</Link> and paste it below.
    </p>
    <Field>
      {#snippet label()}
        OpenRouter API Key
      {/snippet}
      {#snippet input()}
        <label class="input flex w-full items-center gap-2">
          <Icon icon={Lock} />
          <input
            bind:value={openrouterKey}
            autocomplete="off"
            name="flotilla-openrouter-key"
            class="grow"
            type="password" />
        </label>
      {/snippet}
      {#snippet info()}
        Your key is stored in your {PLATFORM_NAME} settings, encrypted to your nostr identity.
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={popModal}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={!openrouterKey || $loading}>
      <Spinner loading={$loading}>{action}</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
