<script lang="ts">
  import {randomId} from "@welshman/lib"
  import {preventDefault, stopPropagation, stripExifData} from "@lib/html"
  import CloseCircle from "@assets/icons/close-circle.svg?dataurl"
  import AddCircle from "@assets/icons/add-circle.svg?dataurl"
  import GallerySend from "@assets/icons/gallery-send.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"

  interface Props {
    file?: File | undefined
    url?: string | undefined
  }

  let {file = $bindable(undefined), url = $bindable(undefined)}: Props = $props()

  const id = randomId()

  const onDragEnter = () => {
    active = true
  }

  const onDragOver = () => {
    active = true
  }

  const onDragLeave = () => {
    active = false
  }

  const onDrop = async (e: any) => {
    active = false

    file = await stripExifData(e.dataTransfer.files[0])
  }

  const onChange = async (e: any) => {
    file = await stripExifData(e.target.files[0])
  }

  const onClear = () => {
    initialUrl = undefined
    file = undefined
    url = undefined
  }

  let active = $state(false)
  let initialUrl = $state(url)

  $effect(() => {
    if (file) {
      const reader = new FileReader()

      reader.addEventListener(
        "load",
        () => {
          url = reader.result as string
        },
        false,
      )

      reader.readAsDataURL(file)
    } else {
      url = initialUrl
    }
  })
</script>

<form>
  <input {id} type="file" accept="image/*" onchange={onChange} class="hidden" />
  <label
    for={id}
    aria-label="Drag and drop files here."
    style="background-image: url({url});"
    class="relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-base-content bg-base-300 bg-cover bg-center transition-all"
    class:border-primary={active}
    ondragenter={stopPropagation(preventDefault(onDragEnter))}
    ondragover={stopPropagation(preventDefault(onDragOver))}
    ondragleave={stopPropagation(preventDefault(onDragLeave))}
    ondrop={stopPropagation(preventDefault(onDrop))}>
    <div
      class="absolute right-0 top-0 h-5 w-5 overflow-hidden rounded-full bg-primary"
      class:bg-error={file}
      class:bg-primary={!file}>
      {#if file}
        <span
          role="button"
          tabindex="-1"
          onmousedown={stopPropagation(onClear)}
          ontouchstart={stopPropagation(onClear)}>
          <Icon icon={CloseCircle} class="scale-150 !bg-base-300" />
        </span>
      {:else}
        <Icon icon={AddCircle} class="scale-150 !bg-base-300" />
      {/if}
    </div>
    {#if !file}
      <Icon icon={GallerySend} size={7} />
    {/if}
  </label>
</form>
