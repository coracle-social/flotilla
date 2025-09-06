<script lang="ts">
  import type {Snippet} from "svelte"
  import {tryCatch, fromPairs} from "@welshman/lib"
  import {isRelayUrl, normalizeRelayUrl} from "@welshman/util"
  import {Pool, AuthStatus} from "@welshman/net"
  import {preventDefault} from "@lib/html"
  import {slideAndFade} from "@lib/transition"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Field from "@lib/components/Field.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalFooter from "@lib/components/ModalFooter.svelte"
  import RelaySummary from "@app/components/RelaySummary.svelte"
  import SpaceJoinConfirm, {confirmSpaceJoin} from "@app/components/SpaceJoinConfirm.svelte"
  import {pushToast} from "@app/util/toast"
  import {pushModal} from "@app/util/modal"
  import {attemptRelayAccess} from "@app/core/commands"

  type Props = {
    invite: string
    abortAction?: Snippet
  }

  let {invite = "", abortAction}: Props = $props()

  const back = () => history.back()

  const joinRelay = async () => {
    const {url, claim} = inviteData!

    const error = await attemptRelayAccess(url, claim)

    if (error) {
      return pushToast({theme: "error", message: error, timeout: 30_000})
    }

    if (Pool.get().get(url).auth.status === AuthStatus.None) {
      pushModal(SpaceJoinConfirm, {url}, {replaceState: true})
    } else {
      await confirmSpaceJoin(url)
    }
  }

  const join = async () => {
    loading = true

    try {
      await joinRelay()
    } finally {
      loading = false
    }
  }

  let loading = $state(false)

  const inviteData = $derived.by(
    () =>
      tryCatch(() => {
        const {r: relay = "", c: claim = ""} = fromPairs(Array.from(new URL(invite).searchParams))
        const url = normalizeRelayUrl(relay)

        if (isRelayUrl(url)) {
          return {url, claim}
        }
      }) ||
      tryCatch(() => {
        const url = normalizeRelayUrl(invite)

        if (isRelayUrl(url)) {
          return {url, claim: ""}
        }
      }),
  )
</script>

<form class="column gap-4" onsubmit={preventDefault(join)}>
  <ModalHeader>
    {#snippet title()}
      <div>Join a Space</div>
    {/snippet}
    {#snippet info()}
      <div>Enter a relay URL or invite link below to join an existing space.</div>
    {/snippet}
  </ModalHeader>
  <Field>
    {#snippet label()}
      <p>Invite Link*</p>
    {/snippet}
    {#snippet input()}
      <label class="input input-bordered flex w-full items-center gap-2">
        <Icon icon="link-round" />
        <input bind:value={invite} class="grow" type="text" />
      </label>
    {/snippet}
  </Field>
  <div class="-my-4">
    {#if inviteData}
      <div transition:slideAndFade class="flex flex-col gap-4 py-4">
        <div class="card2 bg-alt flex flex-col gap-4">
          <p class="opacity-75">You're about to join:</p>
          <RelaySummary url={inviteData.url} />
        </div>
      </div>
    {/if}
  </div>
  <ModalFooter>
    {#if abortAction}
      {@render abortAction?.()}
    {:else}
      <Button class="btn btn-link" onclick={back}>
        <Icon icon="alt-arrow-left" />
        Go back
      </Button>
    {/if}
    <Button type="submit" class="btn btn-primary" disabled={!inviteData || loading}>
      <Spinner {loading}>Join Space</Spinner>
      <Icon icon="alt-arrow-right" />
    </Button>
  </ModalFooter>
</form>
