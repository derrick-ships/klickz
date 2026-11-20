import { describe, expect, it } from "vitest";
import { optimisticUpdate } from "../src/lib/optimistic";

describe("optimisticUpdate", () => {
  it("applies immediately and keeps the update after success", async () => {
    let value = "old";
    let finish!: () => void;
    const pending = optimisticUpdate({ apply: () => { value = "new"; }, rollback: () => { value = "old"; }, persist: () => new Promise<void>(resolve => { finish = resolve; }) });
    expect(value).toBe("new");
    finish(); await pending;
    expect(value).toBe("new");
  });
  it("rolls back and propagates a failed save", async () => {
    let value = "old";
    const pending = optimisticUpdate({ apply: () => { value = "new"; }, rollback: () => { value = "old"; }, persist: async () => { throw new Error("failed"); } });
    expect(value).toBe("new");
    await expect(pending).rejects.toThrow("failed");
    expect(value).toBe("old");
  });
});
