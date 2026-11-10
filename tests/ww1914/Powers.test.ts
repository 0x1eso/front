// ww169: the 통치 tab's powers. Fixture rows on the real content; the seats'
// own rows are written by the W1 lanes.
import { flag, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import {
  GW_CONTENT,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { GW_PLOT_WARN_GAP } from "@openfront/engine-lib/ww1914/HouseRows";
import {
  GW_BEYOND_AGAIN,
  gwPowerProblems,
  type GwPowerRow,
} from "@openfront/engine-lib/ww1914/PowerRows";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { govEntry, govStep } from "@openfront/engine/ww1914/Government";
import { GW_GOV } from "@openfront/engine/ww1914/GovTable";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { plotsStep } from "@openfront/engine/ww1914/Plots";
import {
  powerRow,
  riskPct,
  takePower,
  willSign,
} from "@openfront/engine/ww1914/Powers";
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
  // Phase 2: beyond the law, harsh measures, the person's own end.
  {
    id: "deu_pw_t_coup",
    tag: "DEU",
    group: "house",
    kind: "beyond",
    cooldown: 0,
    tags: ["decree"],
    effects: [{ kind: "flag", flag: "f_t_coup" }],
    heats: [{ id: "deu_parliament", by: 30 }],
    risk: {
      pct: 100,
      then: [{ kind: "flag", flag: "f_t_caught" }],
      heats: [{ id: "deu_pl_army", by: 30 }],
    },
  },
  {
    id: "deu_pw_t_harsh",
    tag: "DEU",
    group: "home",
    kind: "lawful",
    cooldown: 0,
    tags: ["harsh_home"],
    effects: [],
  },
  {
    id: "deu_pw_t_abdicate",
    tag: "DEU",
    group: "home",
    kind: "lawful",
    once: true,
    tags: [],
    effects: [],
    ends: "deu_end_abdicated",
  },
  {
    id: "deu_pw_t_closed",
    tag: "DEU",
    group: "home",
    kind: "lawful",
    target: { kind: "option", of: [{ id: "a", when: flag("f_never") }] },
    tags: [],
    effects: [],
  },
  {
    id: "deu_pw_t_field_shut",
    tag: "DEU",
    group: "home",
    kind: "lawful",
    fields: [{ id: "how", options: [{ id: "x", when: flag("f_never") }] }],
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
  ({ runner } = await gwRunner({ greatWar1914Calendar: "full" }, "GWPW1"));
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

  test("a list whose every entry is closed greys the row, target or field", () => {
    const v = seatView(runner).powers!;
    expect(v.find((p) => p.id === "deu_pw_t_closed")!.why).toBe("no_target");
    expect(v.find((p) => p.id === "deu_pw_t_field_shut")!.why).toBe(
      "no_target",
    );
    const closed = ROWS.filter((r) => r.id === "deu_pw_t_closed");
    expect(gwPowerProblems({ powers: closed }, new Map())).toEqual([]);
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

/** A month-long chapter past every threat's and plot's first date. */
function late(): void {
  const list = gwChapters(gw.s.calendar);
  gw.s.chapter = list.findIndex((c) => c.spanDays >= 28 && c.day > 0) + 40;
  gw.s.day = list[gw.s.chapter].day;
}

/** The next chapter: what was scheduled for it is read, then the threats move. */
function month(): string[] {
  gw.s.chapter++;
  gw.s.day = gwChapters(gw.s.calendar)[gw.s.chapter].day;
  const due = st().scheduled.filter((q) => q.chapter <= gw.s.chapter);
  st().scheduled = st().scheduled.filter((q) => q.chapter > gw.s.chapter);
  for (const q of due) st().seen[q.scene] = gw.s.chapter;
  govStep(gw);
  return due.map((q) => q.scene);
}

describe("phase 2: beyond the law and harsh measures", () => {
  test("no click loses the game: a fatal threat's last step waits for its warning", () => {
    late();
    const row = GW_GOV.find((r) => r.id === "deu_parliament")!;
    const n = row.steps.length;
    const warn = row.steps[n - 2].scene;
    const last = row.steps[n - 1].scene;
    // The warning was read long ago; the threat sits a step from the end.
    st().seen[warn] = gw.s.chapter - 20;
    Object.assign(govEntry(st(), row.id), { heat: 0, step: n - 1, rest: -1 });
    expect(takePower(gw, st(), { id: "deu_pw_t_coup", ...plain })).toBeNull();
    expect(st().flags).toEqual(
      expect.arrayContaining(["f_t_coup", "f_t_caught"]),
    );
    expect(gw.s.ended).toBeNull();
    expect(st().memoir).toBeNull();
    const e = govEntry(st(), row.id);
    expect(e.heat).toBe(row.steps[n - 1].at - 1);
    expect(st().scheduled.map((q) => q.scene)).toContain(warn);
    // Chapter by chapter, the last step comes only GW_PLOT_WARN_GAP after
    // the warning was read again, and the plot never ends the seat unwarned.
    // The Reichstag hostile: the threat feeds, so the last step does come.
    gw.nation("DEU")!.inst.reichstag = -3;
    let warnedAt = -1;
    let sawLast = false;
    for (let i = 0; i < 8; i++) {
      const read = month();
      if (read.includes(warn)) warnedAt = gw.s.chapter;
      if (st().scheduled.some((q) => q.scene === last)) {
        sawLast = true;
        expect(warnedAt).toBeGreaterThan(0);
        expect(gw.s.chapter - warnedAt).toBeGreaterThanOrEqual(
          GW_PLOT_WARN_GAP,
        );
      }
      expect(gw.s.ended).toBeNull();
    }
    expect(sawLast).toBe(true);
  });

  test("a fresh warning lets the heat stand; the plot is heated but never named", () => {
    late();
    const row = GW_GOV.find((r) => r.id === "deu_parliament")!;
    const n = row.steps.length;
    st().seen[row.steps[n - 2].scene] = gw.s.chapter - 1;
    Object.assign(govEntry(st(), row.id), { heat: 0, step: n - 1, rest: -1 });
    takePower(gw, st(), { id: "deu_pw_t_coup", ...plain });
    expect(govEntry(st(), row.id).heat).toBe(row.steps[n - 1].at);
    expect(govEntry(st(), "deu_pl_army").heat).toBeGreaterThan(0);
    const keys = st().log.map((l) => l.key);
    expect(keys).toContain("power_threat_up");
    expect(keys).toContain("power_went_wrong");
    expect(keys.some((k) => k.includes("pl_army"))).toBe(false);
    // The plot's last step needs its signs and warning: months pass, no end.
    for (let i = 0; i < 6; i++) {
      gw.s.chapter++;
      plotsStep(gw, st());
      expect(gw.s.ended).toBeNull();
      expect(st().memoir).toBeNull();
    }
  });

  test("the content check refuses a power that could end a seat in one click", () => {
    const bad: GwPowerRow = {
      id: "deu_pw_t_bad",
      tag: "DEU",
      group: "home",
      kind: "beyond",
      tags: [],
      effects: [
        { kind: "end", ending: "home_collapse" },
        {
          kind: "maybe",
          when: flag("f_x"),
          then: [
            {
              kind: "world",
              of: { do: "gov_heat", id: "deu_parliament", delta: 9 },
            },
          ],
        },
      ],
      heats: [{ id: "deu_nothing", by: 1 }],
    };
    const out = gwPowerProblems(
      { powers: [bad] },
      new Map(),
      new Set(GW_GOV.map((r) => r.id)),
    ).join("\n");
    expect(out).toContain(": end");
    expect(out).toContain(": gov_heat");
    expect(out).toContain("heats no threat or plot deu_nothing");
  });

  test("risk grows with every act beyond the law lately", () => {
    const ctx = { gw, seat: st(), cast: {} };
    const row = powerRow("deu_pw_t_coup")!;
    const plainRow = { ...row, risk: { ...row.risk!, pct: 10 } };
    expect(riskPct(ctx, plainRow)).toBe(10);
    takePower(gw, st(), { id: "deu_pw_t_coup", ...plain });
    expect(riskPct(ctx, plainRow)).toBe(10 + GW_BEYOND_AGAIN);
  });

  test("a harsh measure is answered, each line naming the power; again, louder", () => {
    takePower(gw, st(), { id: "deu_pw_t_harsh", ...plain });
    const lines = st().log.filter((l) => l.power === "deu_pw_t_harsh");
    const keys = lines.map((l) => l.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "react_people_workers_down",
        "react_people_court_up",
        "react_harsh_conscience",
      ]),
    );
    expect(
      keys.includes("react_harsh_quiet") ||
        keys.includes("react_harsh_streets"),
    ).toBe(true);
    expect(keys).not.toContain("react_harsh_again");
    gw.s.chapter++;
    takePower(gw, st(), { id: "deu_pw_t_harsh", ...plain });
    expect(st().log.map((l) => l.key)).toContain("react_harsh_again");
  });

  test("abdication is the person's own end: said as a fact, and it ends the game", () => {
    const v = seatView(runner).powers!.find(
      (p) => p.id === "deu_pw_t_abdicate",
    )!;
    expect(v.ends).toBe(true);
    expect(
      seatView(runner).powers!.find((p) => p.id === "deu_pw_t_plain")!.ends,
    ).toBe(false);
    expect(gw.s.ended).toBeNull();
    order(runner, { kind: "power", id: "deu_pw_t_abdicate", ...plain });
    expect(gw.s.ended).toBe("deu_end_abdicated");
  });
});
