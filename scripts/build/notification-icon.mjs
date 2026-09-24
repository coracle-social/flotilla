#!/usr/bin/env node
// Generates the Android notification (status-bar) small icon from the app's
// source logo. @capacitor/assets does NOT produce notification icons, so the
// build pipeline calls this after `@capacitor/assets generate` to keep the
// notification icon in sync with a custom platform logo (VITE_PLATFORM_LOGO).
//
// A notification small icon must be a monochrome silhouette: Android renders
// only its alpha channel and tints it. We take the logo's alpha channel as the
// shape and fill it white, with a little transparent padding so it isn't
// edge-to-edge in the status bar.
import sharp from "sharp"
import {mkdir} from "node:fs/promises"
import {dirname, join} from "node:path"

const source = process.argv[2] || "assets/logo.png"
const resDir = process.argv[3] || "android/app/src/main/res"

// density bucket -> small-icon size in px
const densities = {mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96}

const generate = async (size, out) => {
  const pad = Math.round(size * 0.14)
  const inner = size - pad * 2

  // The logo's alpha channel is the shape we want to render. Trim the source's
  // own transparent margin first — logo.png carries ~15% baked-in padding, and
  // without trimming that stacks on top of `pad` below, leaving the glyph at
  // only ~half the icon's width. Trimming lets `pad` be the single source of
  // padding so the shape actually fills the status-bar icon.
  const alpha = await sharp(source)
    .trim({threshold: 1})
    .resize(inner, inner, {fit: "contain", background: {r: 0, g: 0, b: 0, alpha: 0}})
    .ensureAlpha()
    .extractChannel(3)
    .toColourspace("b-w")
    .raw()
    .toBuffer()

  await sharp({
    create: {width: inner, height: inner, channels: 3, background: {r: 255, g: 255, b: 255}},
  })
    .joinChannel(alpha, {raw: {width: inner, height: inner, channels: 1}})
    .extend({top: pad, bottom: pad, left: pad, right: pad, background: {r: 0, g: 0, b: 0, alpha: 0}})
    .png()
    .toFile(out)

  console.log(`wrote ${out} (${size}px)`)
}

for (const [density, size] of Object.entries(densities)) {
  const out = join(resDir, `drawable-${density}`, "ic_stat_notify.png")
  await mkdir(dirname(out), {recursive: true})
  await generate(size, out)
}
