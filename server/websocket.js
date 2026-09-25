// Bundling ws breaks its buffer helpers ("o.mask is not a function"), and node has its own client.
export default globalThis.WebSocket
