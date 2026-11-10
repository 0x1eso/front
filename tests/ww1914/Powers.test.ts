// ww169: the 통치 tab's powers. Fixture rows on the real content; the seats'
// own rows are written by the W1 lanes.
import { flag, not } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  GW_CONTENT,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import type { GwPowerRow } from "@openfront/engine-lib/ww1914/PowerRows";
import type { GameRunner } from "@openfront/engine/GameRunner";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { takePower, willSign } from "@openfront/engine/ww1914/Powers";
import { holderOf } from "@openfront/engine/ww1914/SceneRun";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { gwRunner, order, seat as seatView } from "./util";

const ROWS: GwPowerRow[] = [
  {
    id: "deu_pw_t_plain",
    tag: "DEU",
    group: "war",
    kind: "lawful",
    target: {
      kind: "option",
      of: [
        { id: "east", effects: [{ kind: "flag", flag: "f_t_east" }] },
        { id: "never", when: flag("f_never") },
      ],
    },
    tags: ["mobilise"],
    effects: [{ kind: "flag", flag: "f_t_plain" }],
  },
  {
    id: "deu_pw_t_signed",
    tag: "DEU",
    group: "home",
    kind: "lawful",
    needs: { office: "chancellor" },
    beyond: "deu_pw_t_signed_b",
    tags: [],
    effects: [{ kind: "flag", flag: "f_t_signed" }],
  },
  {
    id: "deu_pw_t_signed_b",
    tag: "DEU",
    group: "home",
    kind: "beyond",
    formOnly: true,
    tags: ["decree"],
    effects: [{ kind: "flag", flag: "f_t_without" }],
  },
  {
    id: "deu_pw_t_house",
    tag: "DEU",
    group: "house",
    kind: "lawful",
    needs: { house: { stance: {}, lean: -20 } },
    tags: [],
    effects: [{ kind: "flag", flag: "f_t_house" }],
    failed: [{ kind: "flag", flag: "f_t_house_lost" }],
  },
  {
    id: "deu_pw_t_person",
    tag: "DEU",
    group: "cabinet",
    kind: "custom",
    target: { kind: "person", people: "cabinet" },
    tags: [],
    effects: [{ kind: "person_trust", who: { role: "target" }, delta: 1 }],
  },
  {
    id: "deu_pw_t_shut",
    tag: "DEU",
    group: "army",
    kind: "lawful",
    opens: [{ when: flag("f_never"), why: "closed" }],
    tags: [],
    effects: [],
  },
  {
    id: "gbr_pw_t_other",
    tag: "GBR",
    group: "war",
    kind: "lawful",
    shows: not(flag("f_never")),
    tags: [],
    effects: [],
  },
];

const plain = { target: null, picks: [], without: false, sound: false };

let runner: GameRunner;
let gw: GreatWar;
const st = () => gw.s.seats[0];

beforeEach(async () => {
  useGwContent({ ...GW_CONTENT, powers: ROWS });
  ({ runner } = await gwRunner({}, "GWPW1"));
  gw = runner.game.greatWar()!;
});
afterEach(() => useGwContent(null));

describe("the 통치 tab", () => {
  test("lists the seat's rows as facts: greyed ones say why, forms stay hidden", () => {
    const v = seatView(runner).powers!;
    const ids = v.map((p) => p.id);
    expect(ids).toContain("deu_pw_t_plain");
    expect(ids).not.toContain("deu_pw_t_signed_b");
    expect(ids).not.toContain("gbr_pw_t_other");
    const shut = v.find((p) => p.id === "deu_pw_t_shut")!;
    expect(shut.why).toBe("closed");
    const plainRow = v.find((p) => p.id === "deu_pw_t_plain")!;
    expect(plainRow.target).toEqual({ kind: "option", ids: ["east"] });
    const signed = v.find((p) => p.id === "deu_pw_t_signed")!;
    expect(signed.needs.office).toBe("chancellor");
    expect(signed.without).toBe(true);
    expect(JSON.stringify(v)).not.toContain("f_t_");
  });

  test("a plain power runs through the order, with the world's answer, then rests", () => {
    expect(
      takePower(gw, st(), { id: "deu_pw_t_plain", ...plain, target: "never" }),
    ).toBe("no_target");
    order(runner, {
      kind: "power",
      id: "deu_pw_t_plain",
      ...plain,
      target: "east",
    });
    expect(st().flags).toEqual(
      expect.arrayContaining(["f_t_plain", "f_t_east"]),
    );
    expect(st().log.map((l) => l.key)).toContain("react_people_workers_down");
    expect(st().powers!.used.slice(-1)[0]).toMatchObject({ end: "done" });
    expect(
      takePower(gw, st(), { id: "deu_pw_t_plain", ...plain, target: "east" }),
    ).toBe("power_closed");
    expect(takePower(gw, st(), { id: "deu_pw_t_shut", ...plain })).toBe(
      "power_closed",
    );
  });

  test("the signer can refuse; going past him is the beyond form", () => {
    const chan = holderOf(gw, st(), "chancellor")!;
    chan.trust = -3;
    const row = ROWS[1];
    expect(willSign(chan, row)).toBe(false);
    expect(takePower(gw, st(), { id: row.id, ...plain })).toBeNull();
    expect(st().flags).not.toContain("f_t_signed");
    expect(st().powers!.used.slice(-1)[0].end).toBe("refused");
    expect(st().log.map((l) => l.key)).toContain("power_refused");
    chan.trust = 1;
    expect(
      takePower(gw, st(), { id: row.id, ...plain, without: true }),
    ).toBeNull();
    expect(st().flags).toContain("f_t_without");
    expect(st().flags).not.toContain("f_t_signed");
    expect(chan.trust).toBe(-1);
    expect(st().log.map((l) => l.key)).toContain("power_without");
  });

  test("sounding out spends an audience and lays the talk; once a chapter", () => {
    const chan = holderOf(gw, st(), "chancellor")!;
    chan.trust = 2;
    const before = st().audiences;
    const sound = { id: "deu_pw_t_signed", ...plain, sound: true };
    expect(takePower(gw, st(), sound)).toBeNull();
    expect(st().audiences).toBe(before - 1);
    expect(st().desk.some((c) => c.scene === "gw_pw_sound")).toBe(true);
    expect(st().powers!.sounded[0]).toMatchObject({
      person: chan.id,
      said: true,
    });
    expect(takePower(gw, st(), sound)).toBe("sounded");
    expect(
      seatView(runner).powers!.find((p) => p.id === "deu_pw_t_signed")!.sounded,
    ).toEqual({ person: chan.id, said: true });
  });

  test("the house can vote it down: only `failed` runs", () => {
    expect(takePower(gw, st(), { id: "deu_pw_t_house", ...plain })).toBeNull();
    expect(st().flags).toContain("f_t_house_lost");
    expect(st().flags).not.toContain("f_t_house");
    expect(st().powers!.used.slice(-1)[0].end).toBe("house_lost");
  });

  test("a person target is cast as `target`", () => {
    const chan = holderOf(gw, st(), "chancellor")!;
    const was = chan.trust;
    expect(
      takePower(gw, st(), {
        id: "deu_pw_t_person",
        ...plain,
        target: "deu_nobody",
      }),
    ).toBe("no_target");
    expect(
      takePower(gw, st(), { id: "deu_pw_t_person", ...plain, target: chan.id }),
    ).toBeNull();
    expect(chan.trust).toBe(was + 1);
  });
});
