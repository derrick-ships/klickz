import { redirect } from "next/navigation";
import { StudiesDashboard } from "@/components/studies/studies-dashboard";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const mode = Array.isArray(query.mode) ? query.mode[0] : query.mode;
  // Preserve legacy deep links to Quick Studio modes
  if (["recreate", "generate", "analyze", "edit", "title"].includes(mode || "")) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        for (const item of Array.isArray(value) ? value : [value]) {
          params.append(key, item);
        }
      }
    }
    redirect("/studio" + (params.size ? "?" + params.toString() : ""));
  }
  return <StudiesDashboard />;
}
