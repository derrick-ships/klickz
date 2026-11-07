import { describe, it, expect, vi, afterEach } from "vitest";
import {
  providerContext,
  providerKey,
  userKeys,
} from "../src/lib/provider-context";
import { seal } from "../src/lib/crypto";
afterEach(() => vi.unstubAllEnvs());
describe("BYOK tenant isolation", () => {
  it("never uses global owner keys without an explicitly authenticated owner", async () => {
    vi.stubEnv("OPENAI_API_KEY", "owner-secret-placeholder");
    vi.stubEnv("OWNER_PROVIDER_KEYS", "true");
    const db: any = {
      from: () => ({
        select: () => ({ eq: async () => ({ data: [], error: null }) }),
      }),
      rpc: async () => ({ data: false, error: null }),
    };
    expect(await userKeys(db, "other-user")).toEqual({});
    expect(() => providerKey("openai")).toThrow("your own");
  });
  it("decrypts only a key bound to its exact owner and provider", async () => {
    vi.stubEnv("STUDIO_ENCRYPTION_KEY", "b".repeat(64));
    vi.stubEnv("OWNER_PROVIDER_KEYS", "false");
    const ciphertext = seal(
      { key: "alice-key-placeholder" },
      "provider:alice:openai",
    );
    const db: any = {
      from: () => ({
        select: () => ({
          eq: async () => ({
            data: [{ provider: "openai", ciphertext }],
            error: null,
          }),
        }),
      }),
    };
    expect(await userKeys(db, "alice")).toEqual({
      openai: "alice-key-placeholder",
    });
    await expect(userKeys(db, "bob")).rejects.toThrow();
  });
  it("keeps concurrent request keys independent", async () => {
    const seen = await Promise.all(
      ["alice-key", "bob-key"].map((key) =>
        providerContext.run({ openai: key }, async () => {
          await Promise.resolve();
          return providerKey("openai");
        }),
      ),
    );
    expect(seen).toEqual(["alice-key", "bob-key"]);
    expect(providerContext.getStore()).toBeUndefined();
  });
});
