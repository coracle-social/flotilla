<script lang="ts">
  import {onMount} from "svelte"
  import {Share} from "@capacitor/share"
  import {displayRelayUrl} from "@welshman/util"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Upload from "@assets/icons/upload.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import AltArrowLeft from "@assets/icons/alt-arrow-left.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Divider from "@lib/components/Divider.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import ProfileMultiSelect from "@app/components/ProfileMultiSelect.svelte"
  import {deriveSpaceSupportedMethods} from "@app/management"
  import QRCode from "@app/components/QRCode.svelte"
  import {Access, makeInviteLink} from "@app/access"
  import {relayManagement, relayMemberLists} from "@app/core"
  import {clip, pushToast} from "@app/toast"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  const access = new Access(url)
  const {claim, loading} = access
  const inviteStatus = access.createInviteStatus(false)

  const back = () => history.back()
  const copyInvite = () => clip(invite)

  const shareInvite = async () => {
    if (!canShare) {
      return
    }

    try {
      await Share.share({url: invite})
    } catch (e) {
      console.error(e)
    }
  }

  const addMembers = async () => {
    adding = true

    try {
      const members = $relayMemberLists.get(url)
      const management = $relayManagement.forUrl(url)

      const responses = await Promise.all(
        pubkeys.filter(pk => !members?.isMember(pk)).map(pk => management.allowPubkey(pk)),
      )

      const error = responses.map(response => response.error).find(Boolean)

      if (error) {
        pushToast({theme: "error", message: error})
      } else {
        pushToast({message: "Members have successfully been added!"})
        back()
      }
    } finally {
      adding = false
    }
  }

  const supportedMethods = deriveSpaceSupportedMethods(url)

  const canAddMembers = $derived($supportedMethods.includes("allowpubkey"))

  let canShare = $state(false)
  let invite = $derived(makeInviteLink({url, claim: $claim}))

  let adding = $state(false)
  let pubkeys: string[] = $state([])

  onMount(async () => {
    try {
      const {value} = await Share.canShare()
      canShare = value
    } catch {
      canShare = false
    }

    await access.prepareInvite()
  })
</script>

<Modal>
  <ModalBody>
    <ModalHeader>
      <ModalTitle>Create an Invite</ModalTitle>
      <ModalSubtitle>
        Get a link that you can use to invite people to
        <span class="text-primary">{displayRelayUrl(url)}</span>
      </ModalSubtitle>
    </ModalHeader>
    <div>
      {#if $inviteStatus === "loading"}
        <p class="flex justify-center items-center">
          <Spinner loading={$loading}>Requesting an invite link...</Spinner>
        </p>
      {:else if $inviteStatus === "network"}
        <p class="flex justify-center items-center">
          Unable to reach the space. Please check your connection and try again.
        </p>
      {:else if $inviteStatus === "auth"}
        <p class="flex justify-center items-center">
          Oops! It looks like you're not a member of this space.
        </p>
      {:else}
        <div class="flex flex-col items-center gap-6">
          <div class="w-48">
            <QRCode code={invite} />
          </div>
          <Field>
            {#snippet input()}
              <div class="flex w-full gap-2">
                {#if canShare}
                  <Button
                    class="input flex w-12 shrink-0 items-center justify-center p-0"
                    onclick={shareInvite}>
                    <Icon icon={Upload} />
                  </Button>
                {/if}

                <label class="input flex min-w-0 flex-1 items-center gap-2">
                  <Icon icon={LinkRound} class="shrink-0" />
                  <input bind:value={invite} class="min-w-0 flex-1 truncate" type="text" readonly />
                  <Button class="shrink-0" onclick={copyInvite}>
                    <Icon icon={Copy} />
                  </Button>
                </label>
              </div>
            {/snippet}
            {#snippet info()}
              <p>
                This invite link can be used by clicking "Add Space" and pasting it there.
                {#if $inviteStatus === "noclaim"}
                  We weren't able to get an invite code from this space, so additional steps might
                  be required.
                {:else if !$claim}
                  This space did not issue a claim for this link, so additional steps might be
                  required.
                {/if}
              </p>
            {/snippet}
          </Field>
        </div>
      {/if}
    </div>
    {#if canAddMembers}
      <Divider>or</Divider>
      <Field>
        {#snippet label()}
          <p>Add members directly</p>
        {/snippet}
        {#snippet input()}
          <ProfileMultiSelect bind:value={pubkeys} />
        {/snippet}
      </Field>
    {/if}
  </ModalBody>
  <ModalFooter>
    {#if canAddMembers}
      <Button class="button button-link" onclick={back}>
        <Icon icon={AltArrowLeft} />
        Go back
      </Button>
      <Button
        class="button button-primary"
        onclick={addMembers}
        disabled={adding || pubkeys.length === 0}>
        <Spinner loading={adding}>Save</Spinner>
      </Button>
    {:else}
      <Button class="button button-primary grow" onclick={back}>Done</Button>
    {/if}
  </ModalFooter>
</Modal>
