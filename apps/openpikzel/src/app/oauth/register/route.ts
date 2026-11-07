import { registerClient } from "@/lib/oauth/core";
import { oauthFailure, oauthHeaders, limitedJson } from "@/lib/oauth/http";
export async function POST(request: Request) {
  try {
    return Response.json(registerClient(await limitedJson(request)), {
      status: 201,
      headers: oauthHeaders,
    });
  } catch (e) {
    return oauthFailure(e, "invalid_client_metadata");
  }
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: oauthHeaders });
}
