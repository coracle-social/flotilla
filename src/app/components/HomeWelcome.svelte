<script lang="ts">
  import Link from "@app/components/Link.svelte"
  import HomeSection from "@app/components/HomeSection.svelte"
  import LogInOptions from "@app/components/LogInOptions.svelte"
  import {
    PLATFORM_ABOUT,
    PLATFORM_TERMS,
    PLATFORM_PRIVACY,
    PLATFORM_NAME,
    PLATFORM_DESCRIPTION,
  } from "@app/core/env"
</script>

<HomeSection title="Welcome to {PLATFORM_NAME}">
  <div class="@container px-4 pb-4">
    <div class="flex flex-col gap-4 @2xl:flex-row @2xl:items-center @2xl:gap-8">
      <div class="flex flex-col gap-3 @2xl:flex-1">
        <p>{PLATFORM_DESCRIPTION}</p>
        <p class="text-xs opacity-75">
          By using <Link external class="link" href={PLATFORM_ABOUT}>{PLATFORM_NAME}</Link>, you
          consent to our
          <Link external class="link" href={PLATFORM_TERMS}>Terms of Service</Link> and
          <Link external class="link" href={PLATFORM_PRIVACY}>Privacy Policy</Link>.
        </p>
      </div>
      <div class="flex flex-col gap-3 @2xl:flex-1">
        <LogInOptions />
      </div>
    </div>
  </div>
</HomeSection>
