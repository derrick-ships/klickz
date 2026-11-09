// Failed email callbacks only. Never render provider text or touch Higgsfield OAuth.
export function takeSignInLinkError(href: string): { message: string; cleanUrl: string } | null {
  const url = new URL(href);
  if (url.searchParams.has("state")) return null;
  const hash = new URLSearchParams(url.hash.slice(1));
  const failed = hash.has("error") || hash.has("error_code") || url.searchParams.has("error") || url.searchParams.has("error_code");
  if (!failed) return null;
  const code = hash.get("error_code") || url.searchParams.get("error_code");
  const message = code === "otp_expired"
    ? "This sign-in link has expired or was already used. Enter your email below to get a new link, or sign in with your password."
    : "This sign-in link could not be verified. Request a new email below, or sign in with your password.";
  for (const key of ["error", "error_code", "error_description"]) {
    hash.delete(key);
    url.searchParams.delete(key);
  }
  url.hash = hash.toString();
  return { message, cleanUrl: url.pathname + url.search + url.hash };
}
