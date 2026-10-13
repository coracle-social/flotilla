<script lang="ts">
  import {onMount} from "svelte"
  import {writable} from "svelte/store"
  import {uniq} from "@welshman/lib"
  import {decodePubkey} from "@lib/util"
  import {preventDefault} from "@lib/html"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import AltArrowRight from "@assets/icons/alt-arrow-right.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ProfileMultiSelect from "@app/components/ProfileMultiSelect.svelte"
  import {goToChat} from "@app/ui/routes"
  import {messagingRelayLists} from "@app/core/plugins"

  const back = () => history.back()

  const onSubmit = () => goToChat(pubkeys)

  const addPubkey = (pubkey: string) => {
    pubkeys = uniq([...pubkeys, pubkey])
    term.set("")
  }

  const term = writable("")

  let pubkeys: string[] = $state([])

  $effect(() => {
    pubkeys.forEach(pubkey => $messagingRelayLists.load(pubkey))
  })

  onMount(() => {
    return term.subscribe(t => {
      const pubkey = decodePubkey(t)

      if (pubkey) {
        addPubkey(pubkey)
      }
    })
  })
</script>

<Modal tag="form" onsubmit={preventDefault(onSubmit)}>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Start a Chat</ModalTitle>
      <ModalSubtitle>Create an encrypted chat room for private conversations.</ModalSubtitle>
    </ModalHeader>
    <Field>
      {#snippet input()}
        <ProfileMultiSelect autofocus bind:value={pubkeys} {term} />
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button type="submit" class="button button-primary" disabled={pubkeys.length === 0}>
      Create Chat
      <Icon icon={AltArrowRight} />
    </Button>
  </ModalFooter>
</Modal>
