import { AppError } from "@/lib/validation";

export type ProfileKind = "persona" | "style";
export type NamedProfile = { id: string; name: string };
export type DatedProfile = NamedProfile & { created_at: string };

export function profileNameKey(name: string) {
  return name.trim().toLowerCase();
}

export function profileNameTakenError(kind: ProfileKind, name: string) {
  return `A ${kind} named ${name.trim()} already exists.`;
}

export function suffixProfileName(base: string, n: number) {
  const suffix = ` (${n})`;
  const trimmed = base.trim();
  if (trimmed.length + suffix.length <= 80) return `${trimmed}${suffix}`;
  return `${trimmed.slice(0, Math.max(0, 80 - suffix.length))}${suffix}`;
}

export function assertUniqueProfileName(
  existing: Array<{ id?: string; name: string }>,
  name: string,
  kind: ProfileKind,
  exceptId?: string,
) {
  const key = profileNameKey(name);
  if (existing.some((row) => row.id !== exceptId && profileNameKey(row.name) === key)) {
    throw new AppError(409, profileNameTakenError(kind, name));
  }
}

export function dedupeProfileNames<T extends DatedProfile>(rows: T[]): T[] {
  const updated = rows.map((row) => ({ ...row, name: row.name.trim() || "Unnamed" }));
  const byId = new Map(updated.map((row) => [row.id, row]));
  const taken = new Set(updated.map((row) => profileNameKey(row.name)));
  const groups = new Map<string, T[]>();
  for (const row of updated) {
    const list = groups.get(profileNameKey(row.name)) || [];
    list.push(row);
    groups.set(profileNameKey(row.name), list);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    for (const row of group.slice(1)) {
      let n = 2;
      let candidate = suffixProfileName(row.name, n);
      while (taken.has(profileNameKey(candidate))) {
        n += 1;
        candidate = suffixProfileName(row.name, n);
      }
      row.name = candidate;
      taken.add(profileNameKey(candidate));
    }
  }
  return rows.map((row) => byId.get(row.id)!);
}

export function resolveProfileName<T extends NamedProfile>(
  rows: T[],
  name: string,
  kind: ProfileKind,
): { status: 200; profile: T } | { status: 404; error: string } | { status: 409; error: string } {
  const trimmed = name.trim();
  const matches = rows.filter((row) => profileNameKey(row.name) === profileNameKey(trimmed));
  if (matches.length === 1) return { status: 200, profile: matches[0] };
  if (matches.length === 0) return { status: 404, error: `No ${kind} named ${trimmed}` };
  const candidates = matches.map((row) => `${row.name} (${row.id})`).join(", ");
  return {
    status: 409,
    error: `Several ${kind}s are named ${trimmed}. Rename one in the studio. Candidates: ${candidates}.`,
  };
}
