/** Client-side POST to resend signing link via SMS and/or email (staff session). */
export async function postSigningResend(
  signingRequestId: string,
  opts: { sms: boolean; email: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`/api/signing-requests/${signingRequestId}/resend`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { ok: false, error: j.error ?? `Resend failed (${res.status}).` };
  return { ok: true };
}
