// A country nobody plays is named by the same source on the map and in every
// message: the screens' name (a puppet's or renamed country's included), never
// the engine's Latin name ("UK", "USSR").
import { describe, expect, it } from "vitest";
import { translateText } from "../../../src/client/Utils";
import { PlayerView } from "../../../src/client/view/PlayerView";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";

function fake(over: {
  clientID: string | null;
  tag: string | null;
  eg: WwEndgameView | null;
}) {
  return {
    anonymousName: null,
    static: { clientID: over.clientID, displayName: "UK" },
    countryTag: () => over.tag,
    smallID: () => 7,
    game: { wwEndgame: () => over.eg },
  };
}
const nameOf = (f: ReturnType<typeof fake>) =>
  (PlayerView.prototype.displayName as () => string).call(f);

describe("PlayerView.displayName in World War 1936", () => {
  it("an AI country is named as the screens name it", () => {
    expect(nameOf(fake({ clientID: null, tag: "GBR", eg: null }))).toBe(
      translateText("ww1936.country.GBR"),
    );
  });

  it("a renamed country or a puppet slot takes the endgame's name", () => {
    const eg = new WwEndgameView();
    eg.apply({
      news: [],
      countries: [
        {
          smallID: 7,
          tag: "GBR",
          nameKey: "ww1936.rename.serbia",
        } as never,
      ],
    });
    expect(nameOf(fake({ clientID: null, tag: "GBR", eg }))).toBe(
      translateText("ww1936.rename.serbia"),
    );
  });

  it("a human's name and other modes keep the engine's name", () => {
    expect(nameOf(fake({ clientID: "abc", tag: "GBR", eg: null }))).toBe("UK");
    expect(nameOf(fake({ clientID: null, tag: null, eg: null }))).toBe("UK");
  });
});
