<script lang="ts">
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"

  const back = () => history.back()
</script>

<div class="column gap-4">
  <ModalHeader>
    {#snippet title()}
      <div>What are digital signatures?</div>
    {/snippet}
  </ModalHeader>
  <p>
    Most online services ask their users to trust them that they're being honest, and they usually
    are. However, traditional social media platforms have the ability to <strong
      >create forged content</strong> that can appear to be genuinely authored, but which are actually
    counterfeit.
  </p>
  <p>
    On <Link external href="https://nostr.com/">Nostr</Link>, all your content is authenticated
    using <strong>digital signatures</strong>, which cryptographically tie a particular person to a
    given post or message.
  </p>
  <p>
    The result is that you don't normally have to trust service providers not to tamper with the
    information flowing through the network — instead, your client software can prove that a given
    piece of data is authentic.
  </p>
  <Button class="btn btn-primary" onclick={back}>Got it</Button>
</div>
