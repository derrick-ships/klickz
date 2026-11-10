export const scopes = ["studio:read", "studio:write", "studio:ai", "studio:agent"] as const;
export type Scope = (typeof scopes)[number];
export const scopeCopy: Record<Scope, { heading: string; detail: string }> = {
  "studio:read": {
    heading: "Read your workspace",
    detail:
      "Access your thumbnails, scores, persona pictures and style references.",
  },
  "studio:write": {
    heading: "Save and edit your work",
    detail:
      "Upload references, create profiles, save scores and resize thumbnails. Originals are preserved.",
  },
  "studio:ai": {
    heading: "Use your connected AI providers",
    detail:
      "Generate images, suggest titles, score and fix thumbnails using credits on your own API accounts.",
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
