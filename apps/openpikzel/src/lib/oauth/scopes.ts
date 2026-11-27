export const scopes = ["studio:read", "studio:write", "studio:ai", "studio:agent"] as const;
export type Scope = (typeof scopes)[number];
export const scopeCopy: Record<Scope, { heading: string; detail: string }> = {
  "studio:read": {
    heading: "Read your workspace",
    detail:
      "Access your YouTube channels, 16 synthetic Minds, Pre-Flight Studies, Executive Reports, personas, styles, and thumbnails.",
  },
  "studio:write": {
    heading: "Save and edit your work",
    detail:
      "Edit Minds and Creator Personas, upload references, configure models, manage report sharing, email reports, and organize creations.",
  },
  "studio:ai": {
    heading: "Use your connected AI providers",
    detail:
      "Ingest YouTube channels, run async Pre-Flight Studies, generate thumbnails, and score or fix packaging using credits on your own API accounts.",
  },
  "studio:agent": {
    heading: "Let your local agent keep memory and send you cards",
    detail:
      "The local companion can remember facts and send approval or question cards to your studio.",
  },
};
export function localAgentLinked(
  grants: { scope?: string[]; revoked_at?: string | null }[],
) {
  return grants.some(
    (grant) => !grant.revoked_at && (grant.scope || []).includes("studio:agent"),
  );
}
