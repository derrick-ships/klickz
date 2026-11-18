import { describe, expect, it } from "vitest";
import { elementsMissing, libraryPaths } from "../src/lib/use-studio";

describe("elementsMissing", () => {
  it("accepts missing relation and schema cache errors only", () => {
    expect(elementsMissing({ code: "42P01" })).toBe(true);
    expect(elementsMissing({ code: "PGRST205" })).toBe(true);
    expect(elementsMissing({ message: 'relation "studio_elements" does not exist' })).toBe(true);
    expect(elementsMissing({ message: "Could not find studio_elements in the schema cache" })).toBe(true);
    expect(elementsMissing({ code: "42501", message: "permission denied for studio_elements" })).toBe(false);
    expect(elementsMissing({ message: "another_table does not exist" })).toBe(false);
    expect(elementsMissing(null)).toBe(false);
  });
});

describe("libraryPaths", () => {
  it("handles a missing elements table and null references", () => {
    const rows = [
      { data: [{ image_path: "image", reference_paths: ["reference"] }] },
      { data: [{ refs: null }, { refs: ["reference", "persona"] }] },
      { data: [{ refs: null }] },
      { data: [] },
      { data: null },
    ];
    expect(libraryPaths(rows)).toEqual(["image", "reference", "persona"]);
    rows[4] = { data: [{ refs: null }, { refs: ["element"] }] };
    expect(libraryPaths(rows)).toEqual(["image", "reference", "persona", "element"]);
  });
});
