import { describe, expect, it } from "vitest";
import { libraryPaths } from "../src/lib/use-studio";

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
