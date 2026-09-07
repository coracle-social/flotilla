import {defineConfig} from "@playwright/test"

export default defineConfig({
  testDir: ".",
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: {timeout: 15_000},
  workers: 1,
  reporter: "list",
})
