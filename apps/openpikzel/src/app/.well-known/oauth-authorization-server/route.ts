import { metadata } from "@/lib/oauth/core";
export function GET() {
  return Response.json(metadata(), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public,max-age=300",
    },
  });
}
