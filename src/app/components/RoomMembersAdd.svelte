<script lang="ts">
  import {addRoomMember, waitForThunkError} from "@welshman/app"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import ProfileMultiSelect from "@app/components/ProfileMultiSelect.svelte"
  import {pushToast} from "@app/util/toast"
  import {deriveRoom} from "@app/core/state"

  interface Props {
    url: string
    h: string
  }

  const {url, h}: Props = $props()

  const room = deriveRoom(url, h)

  const back = () => history.back()

  const addMember = async () => {
    loading = true

    try {
      const errors = await Promise.all(
        pubkeys.map(pubkey => waitForThunkError(addRoomMember(url, $room, pubkey))),
      )

      for (const error of errors) {
        if (error) {
          return pushToast({theme: "error", message: errors[0]})
        }
      }

      pushToast({message: "Members have successfully been added!"})
      back()
    } finally {
      loading = false
    }
  }

  let loading = $state(false)
  let pubkeys: string[] = $state([])
</script>

<div class="column gap-4">
  <ModalHeader>
    {#snippet title()}
      <div>Add Members</div>
    {/snippet}
    {#snippet info()}
      <div>to <RoomName {url} {h} /></div>
    {/snippet}
  </ModalHeader>
  <Field>
    {#snippet label()}
      <p>Search for People</p>
    {/snippet}
    {#snippet input()}
      <ProfileMultiSelect bind:value={pubkeys} />
    {/snippet}
  </Field>
  <ModalFooter>
    <Button class="btn btn-link" onclick={back}>
      <Icon icon={AltArrowLeft} />
      Go back
    </Button>
    <Button class="btn btn-primary" onclick={addMember} disabled={loading}>
      <Spinner {loading}>Save changes</Spinner>
    </Button>
  </ModalFooter>
</div>
