<script lang="ts">
  import Button from "@lib/components/Button.svelte"
  import {clip} from "@app/toast"

  const {code, ...props} = $props()

  let canvas: HTMLCanvasElement | undefined = $state()
  let wrapper: Element | undefined = $state()
  let scale = $state(0.1)
  let height = $state(0)

  const copy = () => clip(code)

  // qrcode is imported here rather than at the top of the module because svelte strips effect
  // bodies when compiling for SSR, which would leave the import with no remaining use.
  const draw = async (canvas: HTMLCanvasElement, wrapper: Element, code: string) => {
    const QRCode = await import("qrcode")

    await QRCode.toCanvas(canvas, code)

    scale = wrapper.getBoundingClientRect().width / canvas.width
    height = canvas.height * scale
  }

  $effect(() => {
    if (canvas && wrapper && code) {
      draw(canvas, wrapper, code)
    }
  })
</script>

<Button class="flex w-full justify-center {props.class}" onclick={copy}>
  <div bind:this={wrapper} class="w-md" style={`height: ${height}px`}>
    <canvas
      class="rounded-2xl"
      bind:this={canvas}
      style={`transform-origin: top left; transform: scale(${scale}, ${scale})`}>
    </canvas>
  </div>
</Button>
