# Desktop secure storage plugin

This package provides Flotilla's Electron implementation of protected secret storage. Capawesome
discovers the implementation at `electron/dist/plugin.mjs`; the encrypted store is kept in the
Electron user-data directory and requires an operating-system keyring or keychain.

The [Electron 43 safeStorage API](https://github.com/electron/electron/blob/v43.0.0/docs/api/safe-storage.md)
defines `isAsyncEncryptionAvailable()` as `Promise<boolean>` and `decryptStringAsync()` as
`Promise<{result: string, shouldReEncrypt: boolean}>`.

Initialization failures show one warning and use memory only for that process. The saved file
is preserved for recovery; explicit logout still clears it. No desktop plaintext migration is
needed because desktop has not been deployed. Web and mobile keep their existing adapter.
