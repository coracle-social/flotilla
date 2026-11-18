<script lang="ts">
  import LinkRound from "@assets/icons/link-round.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@app/components/Link.svelte"

  export let value: string
</script>

<Link external href="mailto:{value}">
  <Icon icon={LinkRound} size={3} />
  {value}
</Link>
