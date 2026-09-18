export const gitea = ({repository, token}) => {
  const base = `${repository.origin}/api/v1/repos${repository.pathname}`

  const api = async (method, path, {body, allow404} = {}) => {
    const multipart = body instanceof FormData
    const response = await fetch(base + path, {
      method,
      headers: {
        Authorization: `token ${token}`,
        ...(body && !multipart ? {"Content-Type": "application/json"} : {}),
      },
      body: multipart ? body : body && JSON.stringify(body),
    })

    if (response.status === 404 && allow404) {
      return undefined
    }

    if (!response.ok) {
      throw new Error(`${method} ${path} responded ${response.status}: ${await response.text()}`)
    }

    return response.status === 204 ? undefined : response.json()
  }

  return {
    hasTag: async tag => Boolean(await api("GET", `/tags/${tag}`, {allow404: true})),

    upsertRelease: async (tag, notes) =>
      (await api("GET", `/releases/tags/${tag}`, {allow404: true})) ??
      (await api("POST", "/releases", {body: {tag_name: tag, name: tag, body: notes}})),

    attach: async (releaseId, filename, data) => {
      const {assets} = await api("GET", `/releases/${releaseId}`)
      const existing = assets?.find(asset => asset.name === filename)

      if (existing) {
        await api("DELETE", `/releases/${releaseId}/assets/${existing.id}`)
      }

      const form = new FormData()

      form.append("attachment", new Blob([data]), filename)

      const asset = await api(
        "POST",
        `/releases/${releaseId}/assets?name=${encodeURIComponent(filename)}`,
        {body: form},
      )

      return asset.browser_download_url
    },
  }
}
