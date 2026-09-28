import {randomId} from "@welshman/lib"
import {synced, withGetter} from "@welshman/store"
import {kv} from "@app/storage"

export const device = withGetter(synced({key: "device", storage: kv, defaultValue: randomId()}))
