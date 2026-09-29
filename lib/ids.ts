// Random ids for storage paths, generated on the client or the server.
export function randomId(): string {
  return globalThis.crypto.randomUUID();
}
