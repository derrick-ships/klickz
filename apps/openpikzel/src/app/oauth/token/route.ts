import { exchange } from "@/lib/oauth/core";
import { limitedText, oauthHeaders, oauthFailure } from "@/lib/oauth/http";
export async function POST(request: Request) {
  try {
    if (
      !request.headers
        .get("content-type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      return Response.json(
        { error: "invalid_request" },
        { status: 400, headers: oauthHeaders },
      );
    return Response.json(
      await exchange(new URLSearchParams(await limitedText(request))),
      { headers: oauthHeaders },
    );
  } catch (e) {
    return oauthFailure(e);
  }
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: oauthHeaders });
}
