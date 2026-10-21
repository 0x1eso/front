// @vitest-environment jsdom
// World War 1936 P5 (lane U3): the endgame on the map — a civil-war slot's
// English label and flag pushed once, nothing pushed in a vanilla game, and
// the six civil-war slots' distinct colours.
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import type { WwCountryView } from "@openfront/engine-api/ww1936/EndgameTypes";
import { colord } from "colord";
import { describe, expect, it } from "vitest";
import { WebGLFrameBuilder } from "../../../src/client/WebGLFrameBuilder";
import { GameView } from "../../../src/client/view/GameView";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";

const SID = 7;

function cw1(): WwCountryView {
  return {
    smallID: SID,
    state: "alive",
    nameKey: "ww1936.cw_name.democratic",
    nameArg: "POL",
    color: null,
    flag: "ww_cw_democratic",
  } as unknown as WwCountryView;
}

function setup(ww: WwEndgameView | null | undefined) {
  const names: Array<Map<string, string>> = [];
  const uploads: Array<Array<{ displayName: string; flag?: string }>> = [];
  const view = {
    refreshNames: (m: Map<string, string>) => names.push(m),
    updatePlayerCosmetics: (p: never[]) => uploads.push(p as never),
    setPlayerSkin: () => {},
  };
  const builder = new WebGLFrameBuilder(view as never) as unknown as {
    knownSmallIDs: Set<number>;
    syncWwCountries(g: unknown): void;
  };
  builder.knownSmallIDs.add(SID);
  const player = {
    isPlayer: () => true,
    id: () => "p7",
    smallID: () => SID,
    displayName: () => "Breakaway State 1",
    static: { id: "p7", smallID: SID },
    cosmetics: {},
    equippedCosmetics: {},
    territoryColor: () => colord("#112233"),
    borderColor: () => colord("#445566"),
  };
  const game = {
    wwEndgame: ww === undefined ? undefined : () => ww,
    playerBySmallID: () => player,
  };
  return { builder, game, names, uploads };
}

describe("endgame names on the map", () => {
  it("a civil war slot gets its English label and flag once", () => {
    const ww = new WwEndgameView();
    ww.countries.set(SID, cw1());
    const { builder, game, names, uploads } = setup(ww);
    builder.syncWwCountries(game);
    expect(names).toHaveLength(1);
    expect(names[0].get("p7")).toBe("Free Poland");
    expect(uploads).toHaveLength(1);
    expect(uploads[0][0].flag).toMatch(/ww_cw_democratic\.svg$/);
    // The same view again pushes nothing.
    builder.syncWwCountries(game);
    expect(names).toHaveLength(1);
    expect(uploads).toHaveLength(1);
  });

  it("a vanilla game pushes nothing", () => {
    for (const ww of [undefined, null]) {
      const { builder, game, names, uploads } = setup(ww);
      builder.syncWwCountries(game);
      expect(names).toHaveLength(0);
      expect(uploads).toHaveLength(0);
    }
  });
});

describe("civil war slot colours", () => {
  const cosmeticsOf = (tag: string) =>
    (
      GameView.prototype as unknown as {
        countryCosmetics(
          this: unknown,
          id: number,
        ): { color?: { color: string } };
      }
    ).countryCosmetics.call(
      { worldWarScenario: () => ({ tagOfSmallId: () => tag }) },
      1,
    );

  it("CW1..CW6 get six distinct colours, others keep theirs", () => {
    const cw = ["CW1", "CW2", "CW3", "CW4", "CW5", "CW6"].map(
      (t) => cosmeticsOf(t).color!.color,
    );
    expect(new Set(cw).size).toBe(6);
    expect(cw).not.toContain("#808080");
    const [r, g, b] = COUNTRIES.DEU.color;
    expect(colord(cosmeticsOf("DEU").color!.color).toRgb()).toMatchObject({
      r,
      g,
      b,
    });
  });
});
