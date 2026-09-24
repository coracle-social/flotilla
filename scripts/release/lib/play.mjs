import {createSign} from "node:crypto"

const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url")

const getAccessToken = async ({client_email, private_key}) => {
  const issued = Math.floor(Date.now() / 1000)
  const claims = {
    iss: client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: issued,
    exp: issued + 3600,
  }

  const signed = `${encode({alg: "RS256", typ: "JWT"})}.${encode(claims)}`
  const signature = createSign("RSA-SHA256").update(signed).sign(private_key, "base64url")

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${signed}.${signature}`,
    }),
  })

  const body = await response.json()

  if (!response.ok) {
    throw new Error(`Google rejected the service account: ${body.error_description ?? body.error}`)
  }

  return body.access_token
}

export const play = async ({credentials, packageName}) => {
  const accessToken = await getAccessToken(credentials)
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}`

  const api = async (method, url, body) => {
    const binary = body instanceof Uint8Array
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? {"Content-Type": binary ? "application/octet-stream" : "application/json"} : {}),
      },
      body: binary ? body : body && JSON.stringify(body),
    })

    if (response.status === 204) {
      return undefined
    }

    const result = await response.json()

    if (!response.ok) {
      throw new Error(`Play API: ${result.error?.message ?? JSON.stringify(result)}`)
    }

    return result
  }

  return {
    // Listing bundles needs an edit, which is thrown away so the build can run before the real one
    bundles: async () => {
      const edit = await api("POST", `${base}/edits`)

      try {
        return (await api("GET", `${base}/edits/${edit.id}/bundles`)).bundles ?? []
      } finally {
        await api("DELETE", `${base}/edits/${edit.id}`)
      }
    },

    release: async ({bundle, versionCode, track, status, notes}) => {
      const edit = await api("POST", `${base}/edits`)

      if (bundle) {
        await api(
          "POST",
          `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${packageName}/edits/${edit.id}/bundles?uploadType=media`,
          bundle,
        )
      }

      await api("PUT", `${base}/edits/${edit.id}/tracks/${track}`, {
        track,
        releases: [
          {
            status,
            versionCodes: [String(versionCode)],
            releaseNotes: [{language: "en-US", text: notes}],
          },
        ],
      })

      await api("POST", `${base}/edits/${edit.id}:commit`)
    },
  }
}
