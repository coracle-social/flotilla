<script lang="ts">
  import {onMount} from "svelte"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import ShieldUser from "@assets/icons/shield-user.svg?dataurl"
  import UserMinus from "@assets/icons/user-minus.svg?dataurl"
  import MinusCircle from "@assets/icons/minus-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import SpaceMemberMethods from "@app/components/SpaceMemberMethods.svelte"
  import SpaceMemberRoles from "@app/components/SpaceMemberRoles.svelte"
  import {profiles, relayManagement} from "@app/core"
  import {deriveSpaceSupportedMethods} from "@app/management"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

  type Props = {
    url: string
    pubkey: string
    onClick: () => void
  }

  const {url, pubkey, onClick}: Props = $props()

  const supportedMethods = deriveSpaceSupportedMethods(url)

  const canUnallow = $derived($supportedMethods.includes("unallowpubkey"))
  const canBan = $derived($supportedMethods.includes("banpubkey"))
  const canAssign = $derived($supportedMethods.includes("assignrole"))
  const canUnassign = $derived($supportedMethods.includes("unassignrole"))
  const canEditMethods = $derived(
    $supportedMethods.includes("listmethodassignees") &&
      ["assignmethod", "unassignmethod"].some(method => $supportedMethods.includes(method)),
  )

  const back = () => history.back()

  const editRoles = () => pushModal(SpaceMemberRoles, {url, pubkey})

  const editMethods = () => pushModal(SpaceMemberMethods, {url, pubkey})

  const removeMember = () =>
    pushModal(Confirm, {
      title: "Remove Member",
      message: `Remove @${$profiles.display(pubkey, [url]).get()} from the space?`,
      confirm: async () => {
        const {error} = await $relayManagement.forUrl(url).unallowPubkey(pubkey)

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Member has successfully been removed!"})
          back()
        }
      },
    })

  const banMember = () =>
    pushModal(Confirm, {
      title: "Ban Member",
      message: `Ban @${$profiles.display(pubkey, [url]).get()} from the space?`,
      confirm: async () => {
        const {error} = await $relayManagement.forUrl(url).banPubkey(pubkey)

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Member has successfully been banned!"})
          back()
        }
      },
    })

  let ul: Element

  onMount(() => {
    ul.addEventListener("click", onClick)
  })
</script>

<ul class="menu whitespace-nowrap rounded-2xl bg-surface p-2" bind:this={ul}>
  {#if canAssign || canUnassign}
    <li>
      <Button onclick={editRoles}>
        <Icon icon={Pen} />
        Edit roles
      </Button>
    </li>
  {/if}
  {#if canEditMethods}
    <li>
      <Button onclick={editMethods}>
        <Icon icon={ShieldUser} />
        Edit permissions
      </Button>
    </li>
  {/if}
  {#if canUnallow}
    <li>
      <Button onclick={removeMember}>
        <Icon icon={UserMinus} />
        Remove member
      </Button>
    </li>
  {/if}
  {#if canBan}
    <li>
      <Button class="text-error" onclick={banMember}>
        <Icon icon={MinusCircle} />
        Ban member
      </Button>
    </li>
  {/if}
</ul>
