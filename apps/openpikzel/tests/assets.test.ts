import { describe, it, expect } from "vitest";
import { ownedAsset } from "../src/lib/assets";
import { AppError } from "../src/lib/validation";

const uid = "11111111-1111-4111-8111-111111111111";

describe("ownedAsset", () => {
  it("maps a sharp decode error to 400", async () => {
    const db = {
      storage: {
        from: () => ({
          download: async () => ({
            data: new Blob([Buffer.from("<html>not an image</html>")]),
            error: null,
          }),
        }),
      },
    };
    await expect(
      ownedAsset(db as any, uid, `${uid}/references/x.png`),
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof AppError && error.status === 400,
    );
  });
});
