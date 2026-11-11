import unicode from "@/lib/profile-unicode.json";
import { AppError } from "@/lib/validation";

export type ProfileKind = "persona" | "style";
export type NamedProfile = { id: string; name: string };
export type DatedProfile = NamedProfile & { created_at: string };

export function profileNameKey(name: string) {
  const chars = Array.from(name.trim());
  const isCased = (char: string) => unicode.cased.includes(char);
  const isIgnorable = (char: string) => unicode.ignorable.includes(char);
  const mapping: Record<string, string> = unicode.map;
  return chars.map((char, index) => {
    if (char === "Σ") {
      const before = chars.slice(0, index).reverse().find((part) => !isIgnorable(part));
      const after = chars.slice(index + 1).find((part) => !isIgnorable(part));
      if (before && isCased(before) && (!after || !isCased(after))) return "ς";
    }
    return mapping[char] ?? char;
  }).join("");
}

export function profileNameTakenError(kind: ProfileKind, name: string) {
  return `A ${kind} named ${name.trim()} already exists.`;
}

export function suffixProfileName(base: string, n: number) {
  const suffix = ` (${n})`;
  const trimmed = base.trim();
  if (trimmed.length + suffix.length <= 80) return `${trimmed}${suffix}`;
  const prefix = trimmed.slice(0, Math.max(0, 80 - suffix.length));
  return `${/[\uD800-\uDBFF]$/.test(prefix) ? prefix.slice(0, -1) : prefix}${suffix}`;
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
    const key = profileNameKey(row.name);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
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
  const key = profileNameKey(trimmed);
  const matches = rows.filter((row) => profileNameKey(row.name) === key);
  if (matches.length === 1) return { status: 200, profile: matches[0] };
  if (matches.length === 0) return { status: 404, error: `No ${kind} named ${trimmed}` };
  const candidates = matches.map((row) => `${row.name} (${row.id})`).join(", ");
  return {
    status: 409,
    error: `Several ${kind}s are named ${trimmed}. Rename one in the studio. Candidates: ${candidates}.`,
  };
}
