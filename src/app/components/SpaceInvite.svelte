<script lang="ts">
  import {onMount} from "svelte"
  import {sleep} from "@welshman/lib"
  import {request} from "@welshman/net"
  import {displayRelayUrl, getTagValue, RELAY_INVITE} from "@welshman/util"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import Spinner from "@lib/components/Spinner.svelte"
  import Field from "@lib/components/Field.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import QRCode from "@app/components/QRCode.svelte"
  import {clip} from "@app/util/toast"
  import {PLATFORM_URL} from "@app/core/state"
  import {deriveRelayAuthError} from "@app/core/commands"

  const {url} = $props()

  const authError = deriveRelayAuthError(url)

  const back = () => history.back()

  const copyInvite = () => clip(invite)

  let claim = $state("")
  let loading = $state(true)

  let invite = $state("")

  $effect(() => {
    const relay = displayRelayUrl(url)
    const params = new URLSearchParams({r: relay, c: claim}).toString()

    invite = PLATFORM_URL + "/join?" + params
  })

  onMount(async () => {
    const [[event]] = await Promise.all([
      request({
        relays: [url],
        autoClose: true,
        signal: AbortSignal.timeout(3000),
        filters: [{kinds: [RELAY_INVITE]}],
      }),
      sleep(2000),
    ])

    claim = getTagValue("claim", event?.tags || []) || ""
    loading = false
  })
</script>

<div class="col-4">
  <ModalHeader>
    {#snippet title()}
      <div>Create an Invite</div>
    {/snippet}
    {#snippet info()}
      <div>
        Get a link that you can use to invite people to
        <span class="text-primary">{displayRelayUrl(url)}</span>
      </div>
    {/snippet}
  </ModalHeader>
  <div>
    {#if loading}
      <p class="center">
        <Spinner {loading}>Requesting an invite link...</Spinner>
      </p>
    {:else if $authError}
      <p class="center">Oops! It looks like you're not a member of this relay.</p>
    {:else}
      <div class="flex flex-col items-center gap-6">
        <QRCode code={invite} />
        <Field>
          {#snippet input()}
            <label class="input input-bordered flex w-full items-center gap-2">
              <Icon icon={LinkRound} />
              <input bind:value={invite} class="grow" type="text" />
              <Button onclick={copyInvite}>
                <Icon icon={Copy} />
              </Button>
            </label>
          {/snippet}
          {#snippet info()}
            <p>
              This invite link can be used by clicking "Add Space" and pasting it there.
              {#if !claim}
                This space did not issue a claim for this link, so additional steps might be
                required.
              {/if}
            </p>
          {/snippet}
        </Field>
      </div>
    {/if}
  </div>
  <ModalFooter>
    <Button class="btn btn-primary flex-grow" onclick={back}>Done</Button>
  </ModalFooter>
</div>
