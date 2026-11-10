export function pendingRequestKey(creationId: string, fingerprint: string) {
  return creationId + "\n" + fingerprint;
}

export function rememberPendingRequest(
  pending: Map<string, string>,
  creationId: string,
  fingerprint: string,
  createId: () => string = () => crypto.randomUUID(),
) {
  const key = pendingRequestKey(creationId, fingerprint);
  const existing = pending.get(key);
  if (existing) return existing;
  const id = createId();
  pending.set(key, id);
  return id;
}

export function forgetPendingRequest(
  pending: Map<string, string>,
  creationId: string,
  fingerprint: string,
) {
  pending.delete(pendingRequestKey(creationId, fingerprint));
}
