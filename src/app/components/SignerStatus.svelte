<script lang="ts">
  import {spec} from "@welshman/lib"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import ClockCircle from "@assets/icons/clock-circle.svg?dataurl"
  import CheckCircle from "@assets/icons/check-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import LogOut from "@app/components/LogOut.svelte"
  import {pushModal} from "@app/modal"
  import {session} from "@app/core"
  import {signerHealth, signerRequests} from "@app/signer"
  import PomadeSessions from "@app/components/PomadeSessions.svelte"

  const finished = $derived($signerRequests.filter(request => request.finishedAt))
  const pending = $derived($signerRequests.filter(request => !request.finishedAt))
  const success = $derived(finished.filter(spec({ok: true})))
  const failure = $derived(finished.filter(spec({ok: false})))

  const logout = () => pushModal(LogOut)
</script>

{#if $session}
  <div class="card flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-xl font-bold">Signer Status</span>
        <span class="flex items-center gap-2">
          {#if $signerHealth.disconnected}
            <Icon icon={CloseCircle} class="text-error" size={4} /> Disconnected
          {:else if $signerHealth.failing}
            <Icon icon={Danger} class="text-warning" size={4} /> Partial Failure
          {:else if $signerHealth.slow}
            <Icon icon={ClockCircle} class="text-warning" size={4} /> Slow connection
          {:else}
            <Icon icon={CheckCircle} class="text-success" size={4} /> Ok
          {/if}
        </span>
      </div>
      <div class="flex flex-col justify-between text-sm opacity-75 sm:flex-row">
        <p>
          Logged in with
          {#if $session.method === "nip01"}
            private key
          {:else if $session.method === "nip07"}
            browser extension
          {:else if $session.method === "nip46"}
            remote signer
          {:else if $session.method === "nip55"}
            an external signer
          {:else if $session.method === "pomade"}
            email and password
          {/if}
        </p>
        <p>
          {success.length} requests succeeded, {failure.length} failed, {pending.length} pending
        </p>
      </div>
    </div>
    {#if $signerHealth.disconnected}
      <Button class="button button-error" onclick={logout}>Logout to Reconnect</Button>
    {:else}
      <PomadeSessions />
    {/if}
  </div>
{/if}
