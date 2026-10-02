import {test, expect} from "@playwright/test"

test("dictation resamples decoded audio to 16 kHz and mixes stereo to mono", async ({page}) => {
  await page.route("**/speech-audio-test", route => route.fulfill({body: "<html></html>"}))
  await page.goto("/speech-audio-test")

  const results = await page.evaluate(async () => {
    const path = "/src/lib/speech/audio.ts"
    const {decodeDictation}: typeof import("../../src/lib/speech/audio") = await import(path)
    const decode = OfflineAudioContext.prototype.decodeAudioData
    const results = []
    try {
      for (const rate of [16000, 44100, 48000]) {
        const audio = new AudioBuffer({numberOfChannels: 2, length: rate, sampleRate: rate})
        audio.getChannelData(0).fill(0.25)
        audio.getChannelData(1).fill(0.75)
        // Exercise a decoder returning its original sample rate, including on mobile WebViews.
        OfflineAudioContext.prototype.decodeAudioData = async () => audio
        const samples = await decodeDictation(new Blob())
        results.push({rate, length: samples.length, middle: samples[8000]})
      }
    } finally {
      OfflineAudioContext.prototype.decodeAudioData = decode
    }
    return results
  })

  for (const result of results) {
    expect(result.length, `sample rate ${result.rate}`).toBe(16000)
    expect(result.middle).toBeCloseTo(0.5, 4)
  }
})
