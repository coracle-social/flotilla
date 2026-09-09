<script lang="ts">
  import {preventDefault} from "@lib/html"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Lock from "@assets/icons/lock-keyhole.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
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
  import {PLATFORM_NAME} from "@app/env"
  import {publishSettings} from "@app/settings"
  import {pushToast} from "@app/toast"

  type Props = {
    feature: string
    subtitle: string
  }

  const {feature, subtitle}: Props = $props()

  const action = `Enable ${feature.toLowerCase()}`

  const back = () => history.back()

  const save = async () => {
    loading = true

    try {
      await publishSettings({openrouter_key: openrouterKey.trim()})

      pushToast({message: `${feature} is ready to use!`})

      back()
    } catch (error) {
      console.error(error)
      pushToast({theme: "error", message: `Failed to save your key: ${errorMessage(error)}`})
    } finally {
      loading = false
    }
  }

  let openrouterKey = $state("")
  let loading = $state(false)
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
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={!openrouterKey || loading}>
      <Spinner {loading}>{action}</Spinner>
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
