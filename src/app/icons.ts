const iconModules = import.meta.glob<{default: string}>("@assets/icons/*.svg", {
  query: "?dataurl",
  eager: true,
})

export type IconOption = {
  name: string
  url: string
  searchText: string
}

export const icons: IconOption[] = Object.entries(iconModules)
  .map(([path, module]) => {
    const name = path.split("/").pop()?.replace(".svg", "") || ""
    return {
      name,
      url: module.default,
      searchText: name.replace(/[-_]/g, " ").toLowerCase(),
    }
  })
  .filter(icon => icon.name && !icon.name.startsWith("icon-") && icon.name !== "index")
  .sort((a, b) => a.name.localeCompare(b.name))
