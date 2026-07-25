// Named "actions" per Feature Driven Design convention, but these are fetch()
// wrappers, not Next.js Server Actions — the Firebase client SDK (and the
// idToken it produces) only exists in the browser, so a literal Server Action
// would have no idToken to receive.
const SESSION_ENDPOINT = "/api/auth/session";

export async function syncSession(idToken: string): Promise<void> {
  const response = await fetch(SESSION_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    throw new Error(`Failed to sync session (status ${response.status})`);
  }
}

export async function clearSession(): Promise<void> {
  const response = await fetch(SESSION_ENDPOINT, { method: "DELETE" });

  if (!response.ok) {
    throw new Error(`Failed to clear session (status ${response.status})`);
  }
}
