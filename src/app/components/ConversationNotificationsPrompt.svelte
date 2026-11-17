<script lang="ts">
  import {preventDefault} from "@lib/html"
  import Bell from "@assets/icons/bell.svg?dataurl"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import {enableMessageNotifications, getPermissionMessage, isGranted} from "@app/features/push"
  import {popModal} from "@app/navigation/dialogs"
  import {pushToast} from "@app/navigation/toast"

  const enable = async () => {
    loading = true

    try {
      const permission = await enableMessageNotifications()

      if (isGranted(permission)) {
        await popModal()
        pushToast({message: "You'll be notified about new direct messages."})
      } else {
        pushToast({theme: "error", message: getPermissionMessage(permission)})
      }
    } catch (error) {
      console.error(error)
      pushToast({theme: "error", message: "Failed to enable notifications."})
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
</script>

<Modal tag="form" onsubmit={preventDefault(enable)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Notify you about direct messages?</ModalTitle>
      <ModalSubtitle>Your device asks for permission once</ModalSubtitle>
    </ModalHeader>
    <div class="m-auto flex flex-col gap-4">
      <p>
        Allowing notifications lets this app tell you when a direct message arrives. It also turns
        on the other alert types, each of which you can change in Settings → Alerts.
      </p>
      <p>
        A refusal covers all of them until you allow notifications again in your browser or device
        settings.
      </p>
    </div>
  </ModalBody>
  <ModalFooter>
    <div class="flex flex-col gap-2 sm:flex-row sm:justify-between">
      <Button class="button button-neutral" onclick={popModal} disabled={loading}>
        {#if !loading}
          <Icon icon={CloseCircle} />
        {/if}
        <Spinner {loading}>Not now</Spinner>
      </Button>
      <Button type="submit" class="button button-primary" disabled={loading}>
        {#if !loading}
          <Icon icon={Bell} />
        {/if}
        <Spinner {loading}>Enable notifications</Spinner>
      </Button>
    </div>
  </ModalFooter>
</Modal>
