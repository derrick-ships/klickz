// Only browser-safe Supabase keys may leave the server. Reject secret/service-role misconfiguration.
export function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  let publicKey = key.startsWith("sb_publishable_");
  if (!publicKey && key.split(".").length === 3) {
    try {
      publicKey =
        JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
          .role === "anon";
    } catch {
      publicKey = false;
    }
  }
  let validUrl = false;
  try {
    validUrl = new URL(url).protocol === "https:";
  } catch {}
  return publicKey && validUrl ? { url, key } : null;
}
