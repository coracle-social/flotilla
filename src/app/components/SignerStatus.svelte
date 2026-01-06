<script lang="ts">
  import {spec, avg} from "@welshman/lib"
  import {session, SessionMethod, signerLog} from "@welshman/app"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import ClockCircle from "@assets/icons/clock-circle.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import LogOut from "@app/components/LogOut.svelte"
  import {pushModal} from "@app/util/modal"

  const finished = $derived($signerLog.filter(x => x.finished_at))
  const pending = $derived($signerLog.filter(x => !x.finished_at))
  const failure = $derived(finished.filter(spec({ok: false})))
  const success = $derived(finished.filter(spec({ok: true})))
  const recent = $derived($signerLog.slice(-10))
  const recentFinished = $derived(recent.filter(x => x.finished_at))
  const recentPending = $derived(recent.filter(x => !x.finished_at))
  const recentAvg = $derived(avg(recentFinished.map(x => x.finished_at! - x.started_at)))
  const recentFailure = $derived(recentFinished.filter(x => !x.ok))
  const recentSuccess = $derived(recentFinished.filter(x => x.ok))
  const isDisconnected = $derived(
    recent.length > 0 && recentFailure.length + recentPending.length === recent.length,
  )

  const logout = () => pushModal(LogOut)
</script>

{#if $session && $session.method !== SessionMethod.Anonymous}
  <div class="card2 bg-alt flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-xl font-bold">Signer Status</span>
        <span class="flex items-center gap-2">
          {#if isDisconnected}
            <Icon icon={CloseCircle} class="text-error" size={4} /> Disconnected
          {:else if recentFailure.length > 3}
            <Icon icon={Danger} class="text-warning" size={4} /> Partial Failure
          {:else if recentAvg > 1000 || recentPending.length > 3}
            <Icon icon={ClockCircle} class="text-warning" size={4} /> Slow connection
          {:else if recentSuccess.length === 0 && recentFailure.length > 0}
            <Icon icon={Danger} class="text-warning" size={4} /> Partial Failure
          {:else}
            <Icon icon={CheckCircle} class="text-success" size={4} /> Ok
          {/if}
        </span>
      </div>
      <div class="flex justify-between text-sm opacity-75">
        <p>
          Logged in with
          {#if $session.method === SessionMethod.Nip01}
            private key
          {:else if $session.method === SessionMethod.Nip07}
            browser extension
          {:else if $session.method === SessionMethod.Nip46}
            remote signer
          {:else if $session.method === SessionMethod.Nip55}
            {$session.signer}
          {:else if $session.method === SessionMethod.Pubkey}
            public key (readonly)
          {/if}
        </p>
        <p>
          {success.length} requests succeeded, {failure.length} failed, {pending.length} pending
        </p>
      </div>
    </div>
    {#if isDisconnected}
      <Button class="btn btn-outline btn-error" onclick={logout}>Logout to Reconnect</Button>
    {/if}
  </div>
{/if}
