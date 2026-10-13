<script lang="ts">
  import {onMount} from "svelte"
  import {sleep} from "@welshman/lib"
  import {setKey, popKey} from "@lib/implicit"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import ProfileMultiSelect from "@app/components/ProfileMultiSelect.svelte"
  import {profiles, relayMemberLists} from "@app/core/plugins"
  import {pushToast} from "@app/ui/toast"
  import {pushModal} from "@app/ui/modal"
  import {addRoomMembers} from "@app/features/rooms"

  type Props = {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const spaceMembers = $relayMemberLists.forUrl(url)

  const back = () => history.back()

  const addMembers = async () => {
    loading = true

    try {
      // Show loading for auto submit callback
      await sleep(500)

      const error = await addRoomMembers(url, {h}, pubkeys)

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: "Members have successfully been added!"})
        back()
      }
    } catch (e) {
      console.error(e)
      pushToast({theme: "error", message: "Failed to add members."})
    } finally {
      loading = false
    }
  }

  const onSubmit = () => {
    const members = $spaceMembers
    const pubkeysSnapshot = $state.snapshot(pubkeys)
    const nonSpaceMembers = members
      ? pubkeysSnapshot.filter(pubkey => !members.isMember(pubkey))
      : []

    if (nonSpaceMembers.length > 0) {
      setKey("RoomMembersAdd.pubkeys", pubkeysSnapshot)

      pushModal(Confirm, {
        title: "New Space Members",
        subtitle: "Automatically add members to space",
        message:
          nonSpaceMembers.length === 1
            ? `${$profiles.display(nonSpaceMembers[0], [url]).get()} is not a member of this space. Add them?`
            : `${nonSpaceMembers.length} people are not members of this space. Add them?`,
        confirm: async () => {
          setKey("RoomMembersAdd.confirm", true)
          back()
        },
      })
    } else {
      addMembers()
    }
  }

  let loading = $state(false)
  let pubkeys: string[] = $state(popKey("RoomMembersAdd.pubkeys") || [])

  onMount(() => {
    if (popKey("RoomMembersAdd.confirm")) {
      addMembers()
    }
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Add Members</ModalTitle>
      <ModalSubtitle>to <RoomName {url} {h} class="text-primary" /></ModalSubtitle>
    </ModalHeader>
    <Field>
      {#snippet label()}
        <p>Search for People</p>
      {/snippet}
      {#snippet input()}
        <ProfileMultiSelect bind:value={pubkeys} />
      {/snippet}
    </Field>
  </ModalBody>
  <ModalFooter>
    <Button class="button button-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="button button-primary" onclick={onSubmit} disabled={loading}>
      <Spinner {loading}>Save changes</Spinner>
    </Button>
  </ModalFooter>
</Modal>
