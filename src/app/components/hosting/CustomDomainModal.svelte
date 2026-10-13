<script lang="ts">
  import {preventDefault} from "@lib/html"
  import Global from "@assets/icons/global.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import VerifiedCheck from "@assets/icons/verified-check.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {pushToast} from "@app/ui/toast"
  import {
    canonicalRelayHost,
    flagToBool,
    followHostedRelay,
    hostingErrorMessage,
    updateRelay,
    type HostedRelay,
  } from "@app/features/hosting"

  type Props = {
    relay: HostedRelay
  }

  const {relay}: Props = $props()

  const back = () => history.back()

  const clearDomain = () => {
    domain = ""
  }

  const submit = async (value: string) => {
    if (!loading) {
      loading = true

      try {
        const updated = await updateRelay(relay.id, {custom_domain: value})

        pushToast({message: value ? "Custom domain saved." : "Custom domain removed."})
        back()

        // Removing a verified domain moves the relay back to its subdomain.
        await followHostedRelay(relay, updated)
      } catch (e) {
        pushToast({theme: "error", message: hostingErrorMessage(e, "Failed to save domain.")})
      } finally {
        loading = false
      }
    }
  }

  const onSubmit = () => submit(domain.trim())

  let domain = $state(relay.custom_domain ?? "")
  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(onSubmit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Custom domain</ModalTitle>
      <ModalSubtitle>
        Point a domain you control at this relay instead of the default
        <span class="text-primary">{canonicalRelayHost(relay)}</span> address.
      </ModalSubtitle>
    </ModalHeader>

    <Field>
      {#snippet label()}
        <Icon icon={Global} size={4} />
        <p>Domain</p>
      {/snippet}
      {#snippet secondary()}
        {#if relay.custom_domain && flagToBool(relay.custom_domain_verified, false)}
          <span class="badge badge-primary">
            <Icon icon={VerifiedCheck} size={3} />
            Verified
          </span>
        {/if}
      {/snippet}
      {#snippet input()}
        <div class="input input-group">
          <input
            bind:value={domain}
            type="text"
            placeholder="relay.example.com"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false" />
          {#if domain}
            <Button
              onclick={clearDomain}
              aria-label="Clear domain"
              class="shrink-0 text-content-subtle hover:text-content">
              <Icon icon={CloseCircle} size={4} />
            </Button>
          {/if}
        </div>
      {/snippet}
      {#snippet info()}
        <p>Must be a domain you control, e.g. relay.example.com.</p>
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back} disabled={loading}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={loading}>
      <Spinner {loading}>Save</Spinner>
    </Button>
  </ModalFooter>
</Modal>
