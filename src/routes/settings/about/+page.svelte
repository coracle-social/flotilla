<script lang="ts">
  import {Capacitor} from "@capacitor/core"
  import Link from "@lib/components/Link.svelte"
  import Button from "@lib/components/Button.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Card from "@lib/components/Card.svelte"
  import Code from "@assets/icons/code-2.svg?dataurl"
  import Planet from "@assets/icons/planet.svg?dataurl"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import HeadphonesRound from "@assets/icons/headphones-round.svg?dataurl"
  import Zap from "@app/components/Zap.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import {PLATFORM_NAME, PLATFORM_ABOUT} from "@app/env"
  import {pushModal} from "@app/modal"
  import {makeSpacePath} from "@app/routes"

  const hash = import.meta.env.VITE_BUILD_HASH

  const pubkey = "97c70a44366a6535c145b333f973ea86dfdc2d7a99da618c40c64705ad98e322"

  const openProfile = () => pushModal(ProfileDetail, {pubkey})

  const zap = () => pushModal(Zap, {pubkey})
</script>

<div class="flex flex-col gap-6 p-8 max-w-2xl h-screen justify-center m-auto">
  <p class="text-center text-2xl">Thanks for using</p>
  <h1 class="mb-4 text-center text-5xl font-bold uppercase">{PLATFORM_NAME}</h1>
  <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
    {#if Capacitor.getPlatform() !== "ios"}
      <Card class="flex flex-col gap-2 text-center">
        <h3 class="text-2xl sm:h-12">Donate</h3>
        <p class="sm:h-16">Funds will be used to support development.</p>
        <Button onclick={zap} class="button button-primary">Zap the Developer</Button>
      </Card>
    {/if}
    <Card class="flex flex-col gap-2 text-center">
      <h3 class="text-2xl sm:h-12">Get in touch</h3>
      <p class="sm:h-16">Having problems? Let us know.</p>
      <Link class="button button-primary" href={makeSpacePath("support.flotilla.social")}>
        Get Support
      </Link>
    </Card>
  </div>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2 items-center text-center">
      <p class="text-sm">
        Built with 💜 by
        <span class="text-primary">
          @<Button onclick={openProfile} class="button button-link">hodlbod</Button>
        </span>
      </p>
      <p class="text-xs">
        Icons by <Link
          external
          class="link"
          href="https://www.figma.com/community/file/1396367368966571051">480 Design</Link>
      </p>
      {#if hash}
        <p class="text-xs">Running build {hash.slice(0, 8)}</p>
      {/if}
    </div>
    <div class="flex justify-center gap-4">
      <div class="tip tip-top" data-tip="Source Code">
        <Link external href="https://github.com/coracle-social/flotilla">
          <Icon icon={Code} />
        </Link>
      </div>
      <div class="tip tip-top" data-tip="About {PLATFORM_NAME}">
        <Link external href={PLATFORM_ABOUT}>
          <Icon icon={Planet} />
        </Link>
      </div>
      <div class="tip tip-top" data-tip="Dev Blog">
        <Link external href="https://hodlbod.npub.pro/">
          <Icon icon={Pen} />
        </Link>
      </div>
      <div class="tip tip-top" data-tip="Podcast">
        <Link external href="https://fountain.fm/show/vnmoRQQ50siLFRE8k061">
          <Icon icon={HeadphonesRound} />
        </Link>
      </div>
    </div>
  </div>
</div>
