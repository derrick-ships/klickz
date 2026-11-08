import { higgsfieldMetadata } from "@/lib/higgsfield";
export function GET() { return Response.json(higgsfieldMetadata(), { headers: { "Cache-Control": "public, max-age=300" } }); }
