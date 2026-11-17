export const elementKinds = ['prop', 'logo', 'place', 'clothing'] as const;
export type ElementKind = (typeof elementKinds)[number];
/** Shared by the library, API preparation, mediator and MCP. */
export const elementDefinitions: Record<ElementKind, { label: string; description: string }> = {
  prop: { label: 'Prop', description: 'A physical object held by or placed near the subject. Reproduce its shape, colours and details from the photos.' },
  logo: { label: 'Logo', description: 'A brand mark to copy exactly from the reference, never redraw from memory or substitute. Place it as a mark on a sign, screen or product.' },
  place: { label: 'Place', description: 'A location used as the scene, background or environment. Preserve recognisable landmarks.' },
  clothing: { label: 'Clothing', description: 'Something the persona or subject wears. Put it on the subject with its exact design, colours and print.' },
};
export type Element = { id: string; name: string; kind: ElementKind; notes: string; refs: string[]; created_at: string; identity_brief?: string | null; profile_status?: 'draft' | 'ready' };
export type ReferenceAttachment = { role: 'persona' | 'style' | 'reference'; name?: string; images: number[] } | { role: 'element'; kind: ElementKind; name: string; images: number[] };
/** Only remove an element's images when no other saved row still uses them. */
export function unusedElementImages(refs: string[], otherRefs: (string | null | undefined)[]) {
  const used = new Set(otherRefs.filter(Boolean));
  return [...new Set(refs)].filter(path => !used.has(path));
}
export function profileTable(kind: 'persona' | 'style' | 'element') { return kind === 'persona' ? 'studio_personas' : kind === 'style' ? 'studio_styles' : 'studio_elements'; }
