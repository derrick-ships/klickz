import { appOrigin, mcpResource } from "@/lib/crypto";
import { scopes } from "@/lib/oauth/core";
export function GET() {
  return Response.json(
    {
      resource: mcpResource(),
      authorization_servers: [appOrigin()],
      scopes_supported: scopes,
      bearer_methods_supported: ["header"],
      resource_name: "OpenPikzels Studio",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public,max-age=300",
      },
    },
  );
}
