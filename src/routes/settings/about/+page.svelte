<script lang="ts">
  import Link from "@lib/components/Link.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import ProfileDetail from "@app/components/ProfileDetail.svelte"
  import {pushDrawer} from "@app/modal"

  const openProfile = () =>
    pushDrawer(ProfileDetail, {
      pubkey: "97c70a44366a6535c145b333f973ea86dfdc2d7a99da618c40c64705ad98e322",
    })
</script>

<div class="mt-8 min-h-screen bg-base-200 sm:hero">
  <div class="hero-content">
    <div class="column content gap-6">
      <p class="text-center text-2xl">Thanks for using</p>
      <h1 class="mb-4 text-center text-5xl font-bold uppercase">Flotilla</h1>
      <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div class="card2 bg-alt flex flex-col gap-2 text-center shadow-2xl">
          <h3 class="text-2xl sm:h-12">Support development</h3>
          <p class="sm:h-16">Funds will be used to support development.</p>
          <Button class="btn btn-primary">Zap the Developer</Button>
        </div>
        <div class="card2 bg-alt flex flex-col gap-2 text-center shadow-2xl">
          <h3 class="text-2xl sm:h-12">Get in touch</h3>
          <p class="sm:h-16">Having problems? Let us know by.</p>
          <Link
            class="btn btn-primary"
            href="/home/97c70a44366a6535c145b333f973ea86dfdc2d7a99da618c40c64705ad98e322">
            Chat with the Developer
          </Link>
        </div>
      </div>
      <div class="flex flex-col gap-4">
        <p class="text-center">
          Built with 💜 by
          <span class="text-primary">
            @<Button on:click={openProfile} class="link">hodlbod</Button>
          </span>
        </p>
        <div class="flex justify-center gap-4">
          <div class="tooltip" data-tip="Source Code">
            <Link external href="https://github.com/coracle-social/flotilla">
              <Icon icon="code-2" />
            </Link>
          </div>
          <div class="tooltip" data-tip="About the Developer">
            <Link external href="https://coracle.tools">
              <Icon icon="earth" />
            </Link>
          </div>
          <div class="tooltip" data-tip="Dev Blog">
            <Link external href="https://hodlbod.npub.pro/">
              <Icon icon="pen" />
            </Link>
          </div>
          <div class="tooltip" data-tip="Podcast">
            <Link external href="https://fountain.fm/show/vnmoRQQ50siLFRE8k061">
              <Icon icon="headphones-round" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
