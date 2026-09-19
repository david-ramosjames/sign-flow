/** Full-page redirect to login when the Sign Flow session cookie is missing/invalid. */
export function redirectToLogin(nextPath?: string) {
  if (typeof window === "undefined") return;
  const fallback = `${window.location.pathname}${window.location.search}`;
  const next = nextPath || fallback || "/dashboard";
  window.location.replace(`/login?next=${encodeURIComponent(next)}`);
}

export function redirectToLoginIfUnauthorized(status: number, nextPath?: string): boolean {
  if (status !== 401) return false;
  redirectToLogin(nextPath);
  return true;
}
