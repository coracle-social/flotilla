import {randomId} from "@welshman/lib"
import {kv, syncedWithGetter} from "@app/storage"

export const device = syncedWithGetter({key: "device", storage: kv, defaultValue: randomId()})
