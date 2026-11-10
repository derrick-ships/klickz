import { unseal, hash } from "@/lib/crypto";
import { type GrantToken, readClient, database } from "@/lib/oauth/core";
import { AppError } from "@/lib/validation";
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
    if (token.client !== hash(client))
      return new Response(null, { status: 200, headers: oauthHeaders });
    if (token.refresh) {
      const refreshed = await database(token.access).auth.refreshSession({
        refresh_token: token.refresh,
      });
      if (refreshed.data?.session)
        token.access = refreshed.data.session.access_token;
    }
    const result = await database(token.access)
      .from("studio_oauth_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", token.grant)
      .eq("client_id", token.client);
    if (result.error)
      throw new AppError(503, "Agent access could not be revoked.");
  } catch (error) {
    if (error instanceof AppError && error.status >= 500)
      return new Response(null, {
        status: error.status,
        headers: oauthHeaders,
      });
  }
  return new Response(null, { status: 200, headers: oauthHeaders });
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: oauthHeaders });
}
