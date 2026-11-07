import { unseal, hash } from "@/lib/crypto";
import {
  activeGrant,
  type GrantToken,
  readClient,
  database,
} from "@/lib/oauth/core";
import { limitedText, oauthHeaders } from "@/lib/oauth/http";
export async function POST(request: Request) {
  try {
    const form = new URLSearchParams(await limitedText(request));
    const client = form.get("client_id") || "";
    readClient(client);
    let token: GrantToken;
    try {
      token = unseal<GrantToken>(form.get("token") || "", "oauth-access");
    } catch {
      token = unseal<GrantToken>(form.get("token") || "", "oauth-refresh");
    }
    if (token.client === hash(client)) {
      if (token.refresh) {
        const refreshed = await database(token.access).auth.refreshSession({
          refresh_token: token.refresh,
        });
        if (!refreshed.data.session) throw new Error("Session expired");
        token.access = refreshed.data.session.access_token;
      }
      const { db } = await activeGrant(token);
      await db
        .from("studio_oauth_grants")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", token.grant);
    }
  } catch {}
  return new Response(null, { status: 200, headers: oauthHeaders });
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: oauthHeaders });
}
