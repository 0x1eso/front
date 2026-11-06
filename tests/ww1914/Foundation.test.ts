import {
  GameMapType,
  GameType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { GameConfigSchema } from "@openfront/engine-api/Schemas";
import {
  GW_CALENDARS,
  gwChapters,
} from "@openfront/engine-lib/ww1914/Calendars";
import {
  applyGreatWar1914Rules,
  normalizeModeConfig,
} from "@openfront/engine-lib/ww1914/ModeConfig";
import { describe, expect, test } from "vitest";
import { testGameConfig } from "../util/Wire";
import { stamped, step, stepTo } from "../ww1936/util";
import { gwRunner, HUMAN, order, playChapter, seat, view } from "./util";

describe("the config key", () => {
  test("is the last of the schema but its calendar and recent list", () => {
    const keys = Object.keys(GameConfigSchema.shape);
    expect(keys.slice(-3)).toEqual([
      "greatWar1914",
      "greatWar1914Calendar",
      "greatWar1914Recent",
    ]);
  });

  test("off: the very object comes back", () => {
    const c = testGameConfig();
    expect(normalizeModeConfig(c)).toBe(c);
  });

  test("wins over World War 1936 and fixes map and units", () => {
    const c = testGameConfig({ greatWar1914: true, worldWar1936: true });
    applyGreatWar1914Rules(c);
    expect(c.worldWar1936).toBeUndefined();
    expect(c.gameMap).toBe(GameMapType.World1936);
    expect(c.disabledUnits).toContain(UnitType.City);
    expect(c.disabledUnits).toContain(UnitType.Warship);
    expect(c.greatWar1914Calendar).toBe("y1914");
  });
});

describe("the start", () => {
  test("no 1936 body, the human sits as Germany, the map has 1914 owners", async () => {
    const { runner } = await gwRunner();
    const g = runner.game;
    expect(g.worldWar()).toBeNull();
    const gw = g.greatWar()!;
    expect(gw.s.seats.map((s) => s.tag)).toEqual(["DEU"]);
    expect(gw.world.tags).toEqual(["DEU", "RUS", "FRA", "GBR", "ITA"]);
    expect(g.playerByClientID(HUMAN)?.name()).toBe("Germany");
    expect(g.inSpawnPhase()).toBe(false);
    for (const p of g.players()) expect(p.numTilesOwned()).toBeGreaterThan(0);
  });

  test("the first tick sends the view; quiet ticks send nothing", async () => {
    const { runner, updates } = await gwRunner();
    const sent = () =>
      updates.flatMap((u) => u.updates[GameUpdateType.GreatWar]).length;
    expect(sent()).toBe(1);
    step(runner, 5);
    expect(sent()).toBe(1);
  });

  test("a vanilla attack does nothing", async () => {
    const { runner } = await gwRunner();
    const g = runner.game;
    const me = g.playerByClientID(HUMAN)!;
    const troops = me.troops();
    const tiles = me.numTilesOwned();
    step(runner, 5, [
      stamped(HUMAN, {
        type: "attack",
        targetID: g
          .players()
          .find((p) => p !== me)!
          .id(),
        troops: 100,
      }),
    ]);
    expect(me.outgoingAttacks()).toEqual([]);
    expect(me.troops()).toBe(troops);
    expect(me.numTilesOwned()).toBe(tiles);
  });
});

describe("the chapter clock", () => {
  test("solo: no deadline, nothing moves until ready", async () => {
    const { runner } = await gwRunner();
    expect(view(runner).deadlineTick).toBeNull();
    step(runner, 3000);
    expect(view(runner).chapter).toBe(0);
    expect(view(runner).date).toBe("1914-06-28");
  });

  test("ready is refused with a decision open, then moves the chapter", async () => {
    const { runner } = await gwRunner();
    order(runner, { kind: "ready", chapter: 0, on: true });
    expect(seat(runner).ready).toBe(false);
    expect(seat(runner).readyBlock).toBe("open_cards");
    playChapter(runner);
    const v = view(runner);
    expect(v.chapter).toBe(1);
    expect(v.date).toBe("1914-07-05");
    expect(v.stage).toBe("crisis");
    expect(seat(runner).ready).toBe(false);
  });

  test("a stale ready is refused", async () => {
    const { runner } = await gwRunner();
    playChapter(runner);
    order(runner, { kind: "ready", chapter: 0, on: true });
    expect(seat(runner).ready).toBe(false);
  });

  test("the whole 1914 game: 12 chapters, then closed", async () => {
    const { runner } = await gwRunner();
    const seen: string[] = [];
    while (view(runner).ended === null) {
      seen.push(view(runner).date);
      playChapter(runner);
    }
    expect(seen).toHaveLength(12);
    expect(seen[6]).toBe("1914-08-09");
    expect(seen[11]).toBe("1915-01-01");
    expect(view(runner).ended).not.toBeNull();
    expect(seat(runner).world.memoir?.ending).toBe(view(runner).ended);
  });

  test("with friends: the deadline closes it and proxies the cards", async () => {
    const { runner } = await gwRunner({ gameType: GameType.Private });
    const v = view(runner);
    expect(v.deadlineTick).not.toBeNull();
    stepTo(runner, v.deadlineTick! + 2);
    expect(view(runner).chapter).toBe(1);
    expect(seat(runner).log.map((l) => l.key)).toContain("proxy_signed");
    // `wait` is the sample's fallback.
    expect(seat(runner).log.map((l) => l.key)).toContain("sample_waited");
  });

  test("a pause keeps the time left", async () => {
    const { runner } = await gwRunner({ gameType: GameType.Private });
    const left = view(runner).deadlineTick! - runner.game.ticks();
    step(runner, 1, [stamped(HUMAN, { type: "toggle_pause", paused: true })]);
    step(runner, 50);
    expect(runner.game.isPaused()).toBe(true);
    const now = view(runner).deadlineTick! - runner.game.ticks();
    expect(Math.abs(now - left)).toBeLessThanOrEqual(2);
  });

  test("chapter count, spans and summons all come from the table", async () => {
    expect(gwChapters("y1914")).toHaveLength(12);
    expect(gwChapters("full")).toHaveLength(60);
    expect(gwChapters("standard")).toHaveLength(36);
    expect(Object.keys(GW_CALENDARS)).toEqual(["y1914", "full", "standard"]);
    const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
    expect(view(runner).chapterCount).toBe(60);
    expect(seat(runner).audiences).toBe(gwChapters("full")[0].summons);
    const y = gwChapters("y1914");
    expect(y[1].day - y[0].day).toBe(y[0].spanDays);
  });
});

describe("the two sample scenes", () => {
  test("a decision: the talk opens an option", async () => {
    const { runner } = await gwRunner();
    const envoy = () =>
      seat(runner).desk.find((c) => c.scene === "deu_sample_envoy")!;
    expect(envoy().variant).toBe("base");
    const limit = envoy().options.find((o) => o.id === "term_limit")!;
    expect(limit.open).toBe(false);
    // A closed option is refused.
    order(runner, {
      kind: "choose",
      card: envoy().uid,
      option: "term_limit",
    });
    expect(envoy()).toBeDefined();

    const person = seat(runner).people.find((p) => p.id === "deu_bethmann")!;
    expect(person.topics).toEqual(["deu_sample_talk"]);
    const before = seat(runner).audiences;
    order(runner, {
      kind: "summon",
      person: person.id,
      topic: "deu_sample_talk",
    });
    expect(seat(runner).audiences).toBe(before - 1);
    const card = seat(runner).desk.find((c) => c.kind === "talk")!;
    expect(card.who).toBe("deu_bethmann");
    expect(card.node).toBe("open");
    order(runner, { kind: "reply", card: card.uid, reply: "ask_vienna" });
    const next = seat(runner).desk.find((c) => c.uid === card.uid)!;
    expect(next.node).toBe("vienna");
    order(runner, { kind: "reply", card: card.uid, reply: "thank" });
    expect(seat(runner).desk.some((c) => c.uid === card.uid)).toBe(false);
    // Plus whatever the two replies did with this game's temperament.
    expect(
      seat(runner).people.find((p) => p.id === person.id)!.trust,
    ).toBeGreaterThanOrEqual(1);

    expect(envoy().options.find((o) => o.id === "term_limit")!.open).toBe(true);
    order(runner, { kind: "choose", card: envoy().uid, option: "term_limit" });
    expect(envoy()).toBeUndefined();
    expect(runner.game.greatWar()!.s.seats[0].flags).toContain(
      "deu_sample_backed",
    );
  });

  test("the person's temperament changes what a push does", async () => {
    const outcome = async (gameID: string) => {
      const { runner } = await gwRunner({}, gameID);
      const gw = runner.game.greatWar()!;
      order(runner, {
        kind: "summon",
        person: "deu_bethmann",
        topic: "deu_sample_talk",
      });
      const card = seat(runner).desk.find((c) => c.kind === "talk")!;
      const mood = gw.person("deu_bethmann")!.temperament;
      order(runner, { kind: "reply", card: card.uid, reply: "press" });
      const open = seat(runner).desk.some((c) => c.uid === card.uid);
      return { mood, open };
    };
    const runs = await Promise.all(
      ["GWA", "GWB", "GWC", "GWD", "GWE", "GWF"].map(outcome),
    );
    for (const r of runs) expect(r.open).toBe(r.mood === "anxious");
    expect(new Set(runs.map((r) => r.mood)).size).toBe(2);
  });

  test("summons run out; a topic isn't opened twice", async () => {
    const { runner } = await gwRunner();
    const st = runner.game.greatWar()!.s.seats[0];
    const summon = () =>
      order(runner, {
        kind: "summon",
        person: "deu_bethmann",
        topic: "deu_sample_talk",
      });
    const talk = () => seat(runner).desk.find((c) => c.kind === "talk");
    summon();
    summon();
    expect(seat(runner).audiences).toBe(2);
    order(runner, { kind: "reply", card: talk()!.uid, reply: "leave" });
    // Closed: the topic is in its cooldown, and no summons goes on it.
    summon();
    expect(talk()).toBeUndefined();
    expect(seat(runner).audiences).toBe(2);
    delete st.seen["deu_sample_talk"];
    st.audiences = 0;
    summon();
    expect(talk()).toBeUndefined();
  });

  test("dismiss and appoint", async () => {
    const { runner } = await gwRunner();
    const office = (id: string) =>
      seat(runner).people.find((p) => p.id === id)!.office;
    order(runner, {
      kind: "appoint",
      person: "deu_jagow",
      office: "chancellor",
    });
    expect(office("deu_jagow")).toBe("chancellor");
    expect(office("deu_bethmann")).toBeNull();
    order(runner, { kind: "dismiss", person: "deu_jagow" });
    expect(office("deu_jagow")).toBeNull();
  });

  test("the view hides what the seat may not know", async () => {
    const { runner } = await gwRunner();
    const json = JSON.stringify(view(runner));
    for (const word of ["competence", "health", "temperament", "strength"]) {
      expect(json).not.toContain(word);
    }
  });
});
