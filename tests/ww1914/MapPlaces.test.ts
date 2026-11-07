import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import {
  GW_FRONT_START,
  GW_LINES,
  GW_SIDES,
  GW_THEATRES,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { GW_PLACES, GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type { GwTableClaim } from "@openfront/engine-api/ww1914/GwTable";
import { ScenarioDataSchema } from "@openfront/engine-api/ww1936/ScenarioTypes";
import {
  frontLandAt,
  frontPlaces,
  GW_FRONT_LAND,
} from "@openfront/engine-lib/ww1914/FrontLand";
import { scenarioFolderOf } from "@openfront/engine-lib/ww1914/ModeConfig";
import { gwWorldOf } from "@openfront/engine-lib/ww1914/World1914";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import {
  createGameRunner,
  createGameRunnerFromSnapshot,
  GameRunner,
} from "@openfront/engine/GameRunner";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { frontLandStep, holderOf } from "@openfront/engine/ww1914/Land";
import { closeTable, tableStart } from "@openfront/engine/ww1914/Table";
import { GW_THEATRE_SIDES } from "@openfront/engine/ww1914/Tables";
import fs from "fs";
import path from "path";
import { beforeAll, describe, expect, test } from "vitest";
import { listHashedPublicAssetPaths } from "../../src/server/PublicAssetManifest";
import { offlineAssetSizes } from "../../src/server/PwaBuild";
import { HUMAN, step, wwGameStart } from "../ww1936/util";

const res = (p: string) => path.join(__dirname, "../../resources", p);
const bin = (p: string) => new Uint8Array(fs.readFileSync(res(p)));
const json = (p: string): unknown =>
  JSON.parse(fs.readFileSync(res(p), "utf8"));

function realMap(): MapFiles {
  return {
    map: GameMapType.World1936,
    mapSize: GameMapSize.Normal,
    manifest: json("maps/world1936/manifest.json") as MapFiles["manifest"],
    mapBin: bin("maps/world1936/map.bin"),
    map4xBin: bin("maps/world1936/map4x.bin"),
    regionsBin: bin("maps/world1914/regions.bin"),
    scenario: ScenarioDataSchema.parse(json("maps/world1914/scenario.json")),
  };
}

describe("the 1914 set", () => {
  const data = ScenarioDataSchema.parse(json("maps/world1914/scenario.json"));
  const index = ScenarioIndex.fromFiles(
    data,
    bin("maps/world1914/regions.bin"),
  );

  test("a Great War game reads it", () => {
    expect(scenarioFolderOf({ greatWar1914: true })).toBe("world1914");
    expect(scenarioFolderOf({})).toBeUndefined();
  });

  test("its files reach the production build and the offline list", () => {
    const dir = path.join(__dirname, "../../resources");
    const hashed = listHashedPublicAssetPaths([dir]);
    const sizes = offlineAssetSizes([dir]);
    for (const file of ["regions.bin", "scenario.json"]) {
      expect(hashed).toContain(`maps/world1914/${file}`);
      expect(sizes[`maps/world1914/${file}`]).toBeGreaterThan(0);
    }
  });

  test("every place is a region with tiles, under its name and owner", () => {
    const world = gwWorldOf(index);
    for (const [key, p] of Object.entries(GW_PLACES)) {
      const r = data.regions.find((x) => x.id === p.id);
      expect(r?.place, key).toBe(key);
      expect(r?.gwOwner, key).toBe(p.owner);
      expect(r?.nameKo, key).toBe(p.nameKo);
      expect(r?.tiles, key).toBeGreaterThan(0);
      expect(index.regionIds[p.center[1] * data.width + p.center[0]]).toBe(
        p.id,
      );
      expect(world.places.get(key)).toBe(p.id);
    }
    expect(data.regions.every((r) => r.gwOwner !== undefined)).toBe(true);
  });

  test("the disputed lands stand as they did in June 1914", () => {
    const owners: Readonly<Record<string, readonly GwPlace[]>> = {
      DEU: [
        "metz",
        "strasbourg",
        "mulhouse",
        "posen",
        "danzig",
        "memel",
        "north_schleswig",
        "togo",
        "kamerun",
        "windhoek",
        "dar_es_salaam",
      ],
      AUH: [
        "trento",
        "bozen",
        "gorizia",
        "trieste",
        "krakow",
        "lemberg",
        "prague",
        "kolozsvar",
        "brasso",
        "sarajevo",
        "temesvar",
      ],
      RUS: ["warsaw", "lodz", "lublin", "vilna", "kishinev", "kars"],
      FRA: ["verdun", "reims", "arras", "belfort"],
      BEL: ["ypres", "liege", "antwerp"],
      SRB: ["belgrade", "nis", "skopje", "pristina"],
      OTT: [
        "constantinople",
        "gallipoli",
        "edirne",
        "damascus",
        "jerusalem",
        "basra",
        "trabzon",
      ],
      ITA: ["udine", "venice", "verona"],
      BGR: ["dedeagach", "sofia"],
      ROU: ["bucharest", "constanta"],
      GRC: ["salonika"],
      MNE: ["cetinje"],
      ALB: ["durazzo"],
    };
    for (const [tag, list] of Object.entries(owners)) {
      for (const p of list) expect(GW_PLACES[p].owner, p).toBe(tag);
    }
  });

  test("it is drawn on 1936's terrain, whose files it doesn't touch", () => {
    const old = ScenarioDataSchema.parse(json("maps/world1936/scenario.json"));
    expect([data.width, data.height]).toEqual([old.width, old.height]);
    const land = (d: typeof data) =>
      d.regions.reduce((sum, r) => sum + r.tiles, 0);
    expect(land(data)).toBe(land(old));
    expect(old.regions.some((r) => r.place ?? r.gwOwner)).toBe(false);
    expect(fs.existsSync(res("maps/world1914/map.bin"))).toBe(false);
  });
});

describe("the table of fronts", () => {
  test("names only lines that exist, and a place in one theatre", () => {
    const seen = new Map<GwPlace, string>();
    for (const t of GW_THEATRES) {
      for (const line of Object.keys(GW_FRONT_LAND[t])) {
        expect(GW_LINES[t], `${t} ${line}`).toContain(line);
      }
      for (const p of frontPlaces(t)) {
        expect(seen.get(p), p).toBeUndefined();
        seen.set(p, t);
      }
    }
  });

  test("a side only ever takes land that isn't its own", () => {
    for (const t of GW_THEATRES) {
      for (const land of Object.values(GW_FRONT_LAND[t])) {
        for (const side of GW_SIDES) {
          for (const p of land[side] ?? []) {
            const mine: readonly GwTag[] = GW_THEATRE_SIDES[t][side];
            expect(mine, `${t} ${p}`).not.toContain(GW_PLACES[p].owner);
          }
        }
      }
    }
  });

  test("every line but the start moves land, in all land theatres", () => {
    for (const t of GW_THEATRES) {
      if (t === "sea") continue;
      GW_LINES[t].forEach((line, i) => {
        if (i === GW_FRONT_START[t]) return;
        expect(GW_FRONT_LAND[t][line], `${t} ${line}`).toBeDefined();
      });
    }
  });

  test("land adds up along the lines, both ways from the start", () => {
    expect(frontLandAt("west", 1).size).toBe(0);
    const somme = frontLandAt("west", 3);
    expect(somme.get("liege")).toBe("central");
    expect(somme.get("arras")).toBe("central");
    expect(somme.has("paris")).toBe(false);
    expect(frontLandAt("west", 0).get("strasbourg")).toBe("entente");
    expect(frontLandAt("mesopotamia", 0).get("basra")).toBe("entente");
  });
});

describe("fronts move land on the real map", () => {
  let runner: GameRunner;
  let gw: GreatWar;

  const ownerAt = (r: GameRunner, p: GwPlace): GwTag => {
    const g = r.game.greatWar()!;
    const [x, y] = GW_PLACES[p].center;
    return g.tagOf(r.game.ownerID(r.game.ref(x, y)));
  };
  const west = () => gw.s.theatres.find((t) => t.id === "west")!;
  const standAt = (line: string) => {
    west().line = GW_LINES.west.indexOf(line);
    frontLandStep(gw);
  };

  beforeAll(async () => {
    runner = await createGameRunner(
      wwGameStart({ greatWar1914: true }, [
        { clientID: HUMAN, country: "DEU" },
      ]),
      undefined,
      realMap(),
      () => {},
    );
    step(runner, 2);
    gw = runner.game.greatWar()!;
    gw.nation("DEU")!.side = "central";
    gw.nation("FRA")!.side = "entente";
    west().since = 0;
  }, 60000);

  test("a neutral's land stays out of it, France's does not", () => {
    standAt("hindenburg");
    expect(ownerAt(runner, "lille")).toBe("DEU");
    expect(ownerAt(runner, "liege")).toBe("BEL");
    expect(gw.s.held.lille).toBe("DEU");
    expect(gw.s.landMoves).toContainEqual({
      place: "lille",
      theatre: "west",
      from: "FRA",
      to: "DEU",
    });
  });

  test("a country at war loses its land, and every tile of it", () => {
    gw.nation("BEL")!.side = "entente";
    standAt("somme");
    expect(ownerAt(runner, "liege")).toBe("DEU");
    expect(ownerAt(runner, "ypres")).toBe("DEU");
    expect(holderOf(gw, "ypres")).toBe("DEU");
    const de = gw.world.tags.indexOf("DEU") + 1;
    const tiles = gw.scenario.regionTiles(GW_PLACES.ypres.id);
    expect(tiles.length).toBeGreaterThan(0);
    for (const t of tiles) expect(runner.game.ownerID(t)).toBe(de);
  });

  test("a save keeps the land where it stands", async () => {
    const copy = await createGameRunnerFromSnapshot(
      wwGameStart({ greatWar1914: true }, [
        { clientID: HUMAN, country: "DEU" },
      ]),
      runner.snapshot(),
      undefined,
      realMap(),
      () => {},
    );
    expect(ownerAt(copy, "ypres")).toBe("DEU");
    expect(copy.game.greatWar()!.s.held.ypres).toBe("DEU");
    expect(copy.game.greatWar()!.hash()).toBe(gw.hash());
  }, 60000);

  test("land waits for the whole step back from the start", () => {
    gw.nation("RUS")!.side = "entente";
    const east = gw.s.theatres.find((t) => t.id === "east")!;
    east.since = 0;
    east.line = 0;
    east.progress = 1;
    frontLandStep(gw);
    expect(ownerAt(runner, "konigsberg")).toBe("DEU");
    east.progress = 0;
    frontLandStep(gw);
    expect(ownerAt(runner, "konigsberg")).toBe("RUS");
    east.line = 1;
    frontLandStep(gw);
    expect(ownerAt(runner, "konigsberg")).toBe("DEU");
  });

  test("land goes home when the line goes back, and past it the war turns", () => {
    standAt("liege");
    expect(ownerAt(runner, "ypres")).toBe("BEL");
    expect(ownerAt(runner, "lille")).toBe("FRA");
    expect(gw.s.held).toEqual({});
    standAt("rhine");
    expect(ownerAt(runner, "strasbourg")).toBe("FRA");
    standAt("liege");
    expect(ownerAt(runner, "strasbourg")).toBe("DEU");
  });

  test("the table moves land at once; what wasn't agreed goes home at the end", () => {
    gw.nation("BEL")!.side = "entente";
    standAt("somme");
    gw.s.armistice = { kind: "entente_lost", chapter: gw.s.chapter, by: "GBR" };
    gw.s.conferenceLeft = 3;
    gw.s.table = tableStart(gw);
    const t = gw.s.table;
    const claim = (place: GwPlace, state: GwTableClaim["state"]) =>
      t.claims.push({
        id: t.claims.length,
        place,
        by: "DEU",
        against: "BEL",
        session: 0,
        state,
        step: "asked",
        offer: null,
        offerBy: null,
        offers: 0,
        pressed: false,
      });
    claim("liege", "agreed");
    closeTable(gw);
    expect(ownerAt(runner, "liege")).toBe("DEU");
    expect(ownerAt(runner, "ypres")).toBe("BEL");
    expect(gw.s.held.ypres).toBeUndefined();
    expect(gw.s.held.liege).toBe("DEU");
  });
});
