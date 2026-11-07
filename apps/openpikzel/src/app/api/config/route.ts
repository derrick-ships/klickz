import { NextResponse } from "next/server";
import { publicSupabaseConfig } from "@/lib/config";
export function GET() {
  const db = publicSupabaseConfig();
  return NextResponse.json(
    {
      cloud: !!db,
      ownerGate: process.env.OWNER_GATE !== "false",
      ai: process.env.AI_ENABLED === "true",
      openai: !!process.env.OPENAI_API_KEY,
      jev: !!process.env.JEV_API_KEY,
      supabaseUrl: db?.url || "",
      supabaseKey: db?.key || "",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
