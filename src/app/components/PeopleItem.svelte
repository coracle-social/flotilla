<script lang="ts">
  import UserCircle from "@assets/icons/user-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Link from "@lib/components/Link.svelte"
  import Cv from "@lib/components/Cv.svelte"
  import Profile from "@app/components/Profile.svelte"
  import ProfileAbout from "@app/components/ProfileAbout.svelte"
  import ProfileBadges from "@app/components/ProfileBadges.svelte"
  import {makeProfilePath} from "@app/routes"

  type Props = {
    pubkey: string
    url?: string
  }

  const {pubkey, url}: Props = $props()
</script>

<Cv class="card card-interactive flex flex-col gap-4">
  <div class="flex justify-between">
    <Profile {pubkey} {url} />
    <Link href={makeProfilePath(pubkey)} class="button button-primary hidden sm:flex">
      <Icon icon={UserCircle} />
      View Profile
    </Link>
  </div>
  <ProfileAbout {pubkey} {url} />
  <ProfileBadges {pubkey} {url} />
  <Link href={makeProfilePath(pubkey)} class="button button-primary sm:hidden">
    <Icon icon={UserCircle} />
    View Profile
  </Link>
</Cv>
