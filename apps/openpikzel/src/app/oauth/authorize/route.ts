import { parseAuthorization } from "@/lib/oauth/core";
import { appOrigin, seal, hash } from "@/lib/crypto";
import { oauthFailure } from "@/lib/oauth/http";
export function GET(request: Request) {
  try {
    const auth = parseAuthorization(new URL(request.url)),
      token = seal(auth, "oauth-request");
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${appOrigin()}/oauth/consent?request=${encodeURIComponent(token)}`,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Set-Cookie": `opz_consent=${hash(token)}; HttpOnly; SameSite=Lax; Path=/api/oauth/consent; Max-Age=600${appOrigin().startsWith("https:") ? "; Secure" : ""}`,
      },
    });
  } catch (e) {
    return oauthFailure(e, "invalid_request");
  }
}
