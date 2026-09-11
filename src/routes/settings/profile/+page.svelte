<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import {Client} from "@pomade/core"
  import {hexToBytes} from "@welshman/lib"
  import {displayNip05} from "@welshman/util"
  import {displayPubkey} from "@welshman/domain"
  import {slideAndFade} from "@lib/transition"
  import PenNewSquare from "@assets/icons/pen-new-square.svg?dataurl"
  import UserRounded from "@assets/icons/user-rounded.svg?dataurl"
  import Key from "@assets/icons/key-minimalistic.svg?dataurl"
  import Letter from "@assets/icons/letter.svg?dataurl"
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import Settings from "@assets/icons/settings.svg?dataurl"
  import AltArrowDown from "@assets/icons/alt-arrow-down.svg?dataurl"
  import AltArrowUp from "@assets/icons/alt-arrow-up.svg?dataurl"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import FieldInline from "@lib/components/FieldInline.svelte"
  import Button from "@lib/components/Button.svelte"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import ProfileCircle from "@app/components/ProfileCircle.svelte"
  import ProfileAbout from "@app/components/ProfileAbout.svelte"
  import ProfileEdit from "@app/components/ProfileEdit.svelte"
  import ProfileDelete from "@app/components/ProfileDelete.svelte"
  import SignerStatus from "@app/components/SignerStatus.svelte"
  import PasswordReset from "@app/components/PasswordReset.svelte"
  import InfoKeys from "@app/components/InfoKeys.svelte"
  import {pushModal} from "@app/modal"
  import {POMADE_NETWORK_ERROR_MESSAGE} from "@app/pomade"
  import {makeProfilePath} from "@app/routes"
  import {clip, pushToast} from "@app/toast"
  import {profiles, session, user} from "@app/core"
  import {isPomadeSession, requirePomadeSession} from "@app/pomade"

  const npub = nip19.npubEncode($user.pubkey)
  const profile = $profiles.one($user.pubkey)
  const pomadeEmail = $derived(isPomadeSession($session) ? $session.data.email : undefined)
  const nip01Secret = $derived(
    $session?.method === "nip01" ? (($session.data as {secret: string}).secret ?? "") : undefined,
  )
  const pubkeyDisplay = displayPubkey($user.pubkey)

  const copyNpub = () => clip(npub)

  const copyNsec = () => clip(nip19.nsecEncode(hexToBytes(nip01Secret!)))

  const startEdit = () => pushModal(ProfileEdit)

  const startDelete = () => pushModal(ProfileDelete)

  const startPasswordReset = async () => {
    loading = true

    try {
      const {ok, peersByPrefix} = await Client.requestChallenge(
        requirePomadeSession($session).data.email,
      )

      if (!ok) {
        console.error("Pomade challenge request failed during password reset initiation")

        pushToast({
          theme: "error",
          message: POMADE_NETWORK_ERROR_MESSAGE,
        })

        return
      }

      pushModal(PasswordReset, {peersByPrefix})
    } catch (error) {
      console.error(error)

      pushToast({
        theme: "error",
        message: POMADE_NETWORK_ERROR_MESSAGE,
      })
    } finally {
      loading = false
    }
  }

  const startRecovery = () => pushModal(InfoKeys)

  let loading = $state(false)
  let showAdvanced = $state(false)
</script>

<PageContent>
  <div class="card shadow-md flex flex-col gap-2">
    <div class="flex justify-between gap-2">
      <Link href={makeProfilePath($user.pubkey)} class="flex max-w-full gap-3">
        <div class="py-1">
          <ProfileCircle pubkey={$user.pubkey} size={10} />
        </div>
        <div class="flex min-w-0 flex-col">
          <div class="flex items-center gap-2">
            <div class="text-bold overflow-hidden text-ellipsis">
              {$profile?.display(pubkeyDisplay) ?? pubkeyDisplay}
            </div>
          </div>
          <div class="overflow-hidden text-ellipsis text-sm opacity-75">
            {$profile?.nip05() ? displayNip05($profile.nip05()!) : pubkeyDisplay}
          </div>
        </div>
      </Link>
      <Button
        class="button button-neutral button-circle flex justify-center items-center -mr-2 -mt-2 h-12 w-12"
        onclick={startEdit}>
        <Icon icon={PenNewSquare} />
      </Button>
    </div>
    <ProfileAbout pubkey={$user.pubkey} />
  </div>
  <div class="card flex flex-col gap-4 shadow-md">
    {#if pomadeEmail}
      <FieldInline>
        {#snippet label()}
          <Icon icon={Letter} />
          <p>Email Address</p>
        {/snippet}
        {#snippet input()}
          <label class="input flex w-full items-center gap-2">
            <Icon icon={UserRounded} />
            <input readonly value={pomadeEmail} class="grow" />
          </label>
        {/snippet}
      </FieldInline>
    {/if}
    <FieldInline>
      {#snippet label()}
        <p class="flex items-center gap-3">
          <Icon icon={Key} />
          Public Key
        </p>
      {/snippet}
      {#snippet input()}
        <label class="input flex w-full items-center justify-between gap-2">
          <div class="flex gap-2 grow items-center">
            <Icon icon={LinkRound} />
            <input readonly class="truncate min-w-0 grow" value={npub} />
          </div>
          <Button class="flex items-center" onclick={copyNpub}>
            <Icon icon={Copy} />
          </Button>
        </label>
      {/snippet}
      {#snippet info()}
        <p>
          Your public key is your user identifier. It also allows other people to authenticate your
          messages.
        </p>
      {/snippet}
    </FieldInline>
    {#if $session?.method === "nip01"}
      <FieldInline>
        {#snippet label()}
          <p class="flex items-center gap-3">
            <Icon icon={Key} />
            Private Key
          </p>
        {/snippet}
        {#snippet input()}
          <label class="input flex w-full items-center gap-2">
            <Icon icon={LinkRound} />
            <input readonly value={nip01Secret} class="grow" type="password" />
            <Button class="flex items-center" onclick={copyNsec}>
              <Icon icon={Copy} />
            </Button>
          </label>
        {/snippet}
        {#snippet info()}
          <p>Your private key is your nostr password. Keep this somewhere safe!</p>
        {/snippet}
      </FieldInline>
    {/if}
    <SignerStatus />
    {#if pomadeEmail}
      <div class="flex flex-col lg:flex-row gap-4 lg:gap-2 justify-end">
        <Button class="button button-neutral" onclick={startPasswordReset} disabled={loading}>
          <Spinner {loading}>Update your password</Spinner>
        </Button>
        <Button class="button button-primary" onclick={startRecovery}
          >Start holding your own keys</Button>
      </div>
    {/if}
  </div>
  <div class="card shadow-md">
    <div class="flex items-center justify-between">
      <strong class="flex items-center gap-3">
        <Icon icon={Settings} />
        Advanced
      </strong>
      <Button onclick={() => (showAdvanced = !showAdvanced)}>
        {#if showAdvanced}
          <Icon icon={AltArrowUp} />
        {:else}
          <Icon icon={AltArrowDown} />
        {/if}
      </Button>
    </div>
    {#if showAdvanced}
      <div transition:slideAndFade class="flex flex-col gap-2 pt-4">
        <Button class="button button-error" onclick={startDelete}>
          <Icon icon={TrashBin2} />
          Delete your profile
        </Button>
      </div>
    {/if}
  </div>
</PageContent>
