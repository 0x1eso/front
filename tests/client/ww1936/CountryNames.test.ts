// A country nobody plays is named by the same source on the map and in every
// message: the screens' name (a puppet's or renamed country's included), never
// the engine's Latin name ("UK", "USSR").
import { describe, expect, it } from "vitest";
import {
  countryName,
  setLiveCountryNames,
} from "../../../src/client/hud/ww1936/WorldWarModel";
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

describe("ww237: the live name of a civil-war side", () => {
  const SLOT = translateText("ww1936.country.CW7");
  const side = {
    smallID: 7,
    nameKey: "ww1936.cw_name.deu_communist",
    nameArg: "DEU",
  } as never;

  it("a woken slot reads its endgame name, never the slot's text", () => {
    const eg = new WwEndgameView();
    eg.apply({ news: [], countries: [side] });
    const name = eg.displayName(7, () => "CW7");
    expect(name).toBe(translateText("ww1936.cw_name.deu_communist"));
    expect(name).not.toBe(SLOT);
    expect(name).not.toContain("분리 국가");
    // A lost side that sleeps again keeps the name it fought under.
    eg.apply({
      news: [],
      countries: [{ smallID: 7, nameKey: null, nameArg: null } as never],
    });
    expect(eg.liveName(7)).toBe(name);
  });

  it("countryName(tag) on every screen reads the running game's name", () => {
    const eg = new WwEndgameView();
    eg.apply({ news: [], countries: [side] });
    setLiveCountryNames((tag) => (tag === "CW7" ? eg.liveName(7) : null));
    try {
      expect(countryName("CW7")).toBe(
        translateText("ww1936.cw_name.deu_communist"),
      );
      expect(countryName("DEU")).toBe(translateText("ww1936.country.DEU"));
    } finally {
      setLiveCountryNames(null);
    }
    expect(SLOT).not.toMatch(/분리 국가|Breakaway/);
  });
});
