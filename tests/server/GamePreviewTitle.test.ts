import { GAME_TITLE } from "@openfront/shared/Branding";
import { describe, expect, test } from "vitest";
import { buildPreview } from "../../src/server/GamePreviewBuilder";

describe("game link preview", () => {
  test("names this game, not OpenFront, when it knows nothing else", async () => {
    const meta = await buildPreview(
      "abcdefgh",
      "https://play.example.com",
      "w0",
      null,
      null,
    );
    expect(meta.title).toBe(`${GAME_TITLE} game`);
  });
});
