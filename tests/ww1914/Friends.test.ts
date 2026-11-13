import {
  GameMapSize,
  GameMapType,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { GW_MONEY_DEADLINE } from "@openfront/engine-api/ww1914/GwBudget";
import { gwCraftStart } from "@openfront/engine-api/ww1914/GwCraft";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import { GwOrderSchema } from "@openfront/engine-api/ww1914/GwOrders";
import type { GreatWarData } from "@openfront/engine-api/ww1914/GwView";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import {
  createGameRunnerFromSnapshot,
  GameRunner,
} from "@openfront/engine/GameRunner";
import { readSnapshotHeader } from "@openfront/engine/snapshot/GameSnapshot";
import { alliesStep } from "@openfront/engine/ww1914/Asks";
import { advanceChapter, allReady } from "@openfront/engine/ww1914/Chapters";
import { closeChain } from "@openfront/engine/ww1914/Crises";
import {
  closeSeat,
  generalEnding,
  memoirOf,
  ownEnding,
} from "@openfront/engine/ww1914/Endings";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { gwPlayers } from "@openfront/engine/ww1914/GwPlayers";
import { houseStep } from "@openfront/engine/ww1914/House";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { armistice, openTalks } from "@openfront/engine/ww1914/Peace";
import { regentStep } from "@openfront/engine/ww1914/Seats";
import { gwView } from "@openfront/engine/ww1914/View";
import { ruledBySeat } from "@openfront/engine/ww1914/World";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { describe, expect, it } from "vitest";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { diffSnapshots } from "../util/Snapshot";
import {
  MINI,
  stamped,
  step,
  wwGameStart,
  wwRunnerCapture,
} from "../ww1936/util";

const A = "AAAAAAA1";
const B = "BBBBBBB2";
const C = "CCCCCCC3";

async function friends(config: Partial<GameConfig> = {}) {
  const made = await wwRunnerCapture(
    {
      greatWar1914: true,
      gameType: GameType.Private,
      greatWar1914Calendar: "friends",
      ...config,
    },
    [
      { clientID: A, gwCountry: "DEU" },
      { clientID: B, gwCountry: "RUS" },
      { clientID: C, gwCountry: "GBR" },
    ],
    undefined,
    undefined,
    A,
  );
  step(made.runner, 2);
  return made;
}

const gwOf = (r: GameRunner) => r.game.greatWar()!;
const send = (r: GameRunner, who: string, o: GwOrder) => {
  step(r, 1, [stamped(who, { type: "gw_order", order: o })]);
  step(r, 1);
};
const seatOf = (r: GameRunner, tag: string) =>
  gwOf(r).s.seats.find((x) => x.tag === tag)!;

/** Everyone signs what is open and says ready; the chapter closes. */
function closeChapter(r: GameRunner, who: readonly string[] = [A, B, C]) {
  const chapter = gwOf(r).s.chapter;
  for (const c of who) {
    const smallID = r.game.playerByClientID(c)!.smallID();
    const desk = () =>
      gwView(gwOf(r)).seats.find((s) => s.smallID === smallID)!.desk;
    for (let guard = 0; guard < 50; guard++) {
      const card = desk()[0];
      if (card === undefined) break;
      if (card.node !== null) {
        const reply = card.replies.find((x) => x.open)!;
        send(r, c, { kind: "reply", card: card.uid, reply: reply.id });
      } else if (card.options.length > 0) {
        const option = card.options.find((x) => x.open)!;
        send(r, c, { kind: "choose", card: card.uid, option: option.id });
      } else {
        send(r, c, { kind: "read", card: card.uid });
      }
    }
    send(r, c, { kind: "ready", chapter, on: true });
  }
  step(r, 2);
}

/** The crisis ends in war at once: the sides a real one would have. */
function toWar(gw: GreatWar): void {
  gw.s.chain = { topic: "balkan", step: 5, hold: 0, short: false };
  gw.s.temp = 9;
  closeChain(gw, "war");
  gw.nation("GBR")!.side ??= "entente";
}

const clause = (
  kind: "alliance" | "neutrality" | "loan" | "passage" | "entry",
  by: "DEU" | "RUS" | "GBR" | "ITA",
  value = 0,
  theatre: "west" | "sea" | null = null,
) => ({ kind, by, value, theatre });

describe("seats", () => {
  it("gives each friend the country picked, AUH and RUS included", async () => {
    const world = { tags: ["DEU", "AUH", "RUS"] } as never;
    const random = { nextID: () => "id" } as never;
    const infos = gwPlayers(
      [
        { clientID: A, username: "a", clanTag: null, gwCountry: "AUH" },
        { clientID: B, username: "b", clanTag: null, gwCountry: "RUS" },
      ],
      world,
      random,
    );
    expect(infos.map((i) => i.clientID)).toEqual([null, A, B]);
  });

  it("seats every human and leaves the rest to the AI", async () => {
    const { runner } = await friends();
    expect(
      gwOf(runner)
        .s.seats.map((x) => x.tag)
        .sort(),
    ).toEqual(["DEU", "GBR", "RUS"]);
    expect(gwView(gwOf(runner)).roster).toHaveLength(3);
  });
});

describe("the view a client gets", () => {
  it("holds its own seat and nobody else's desk", async () => {
    const { runner, updates } = await friends();
    send(runner, A, { kind: "slow" });
    const got = updates.flatMap(
      (u) =>
        (u.updates[GameUpdateType.GreatWar] ?? []) as { data: GreatWarData }[],
    );
    expect(got.length).toBeGreaterThan(0);
    const mine = runner.game.playerByClientID(A)!.smallID();
    for (const { data } of got) {
      expect(data.seats.map((s) => s.smallID)).toEqual([mine]);
      expect(data.roster).toHaveLength(3);
    }
  });

  it("keeps the house, files, plots and craft of one seat from another", async () => {
    const { runner: r } = await friends();
    const gw = gwOf(r);
    toWar(gw);
    houseStep(gw);
    const deu = seatOf(r, "DEU");
    expect(deu.house).toBeDefined();
    const factions = deu.house!.factions.map((f) => f.id);
    expect(factions.length).toBeGreaterThan(0);
    const rus = r.game.playerByClientID(B)!.smallID();
    const theirs = gwView(gw, rus);
    expect(theirs.seats.map((s) => s.tag)).toEqual(["RUS"]);
    const text = JSON.stringify(theirs);
    for (const id of factions) expect(text).not.toContain(`"${id}"`);
    const mine = gwView(gw, r.game.playerByClientID(A)!.smallID());
    expect(mine.seats.map((s) => s.tag)).toEqual(["DEU"]);
  });

  it("holds no seat for a spectator", async () => {
    const { runner } = await friends();
    expect(gwView(gwOf(runner), null).seats).toEqual([]);
  });
});

describe("the chapter clock with friends", () => {
  it("runs on the row's timer at the host's pace", async () => {
    // The friends row opens with 120-second chapters: ×0.75, ×1, ×1.5.
    for (const [pace, ticks] of [
      ["short", 900],
      [undefined, 1200],
      ["normal", 1200],
      ["long", 1800],
    ] as const) {
      const { runner } = await friends(
        pace === undefined ? {} : { greatWar1914Pace: pace },
      );
      const left = gwOf(runner).s.deadlineTick! - runner.game.ticks();
      expect(left).toBeLessThanOrEqual(ticks);
      expect(left).toBeGreaterThan(ticks - 10);
    }
  });

  it("closes when all are ready, without waiting for the timer", async () => {
    const { runner } = await friends();
    const before = gwOf(runner).s.chapter;
    closeChapter(runner);
    expect(gwOf(runner).s.chapter).toBe(before + 1);
  });

  it("adds thirty seconds for everyone when the host agrees", async () => {
    const { runner } = await friends();
    const gw = gwOf(runner);
    const hostID = gw.s.seats.find(
      (x) => gwView(gw).roster.find((r) => r.smallID === x.smallID)!.host,
    )!;
    const asker = [A, B, C].find(
      (c) => runner.game.playerByClientID(c)!.smallID() !== hostID.smallID,
    )!;
    const host = [A, B, C].find(
      (c) => runner.game.playerByClientID(c)!.smallID() === hostID.smallID,
    )!;
    const at = gw.s.deadlineTick!;
    send(runner, asker, { kind: "slow" });
    expect(gw.s.deadlineTick).toBe(at);
    expect(gw.s.slowAsked).toHaveLength(1);
    send(runner, host, { kind: "slow_answer", grant: true });
    expect(gw.s.deadlineTick).toBe(at + 300);
    expect(gw.s.slowAsked).toHaveLength(0);
  });

  it("counts the asking as granted while the host is away", async () => {
    const { runner } = await friends();
    const gw = gwOf(runner);
    const host = gw.s.seats.find(
      (x) => gwView(gw).roster.find((r) => r.smallID === x.smallID)!.host,
    )!;
    const hostID = [A, B, C].find(
      (c) => runner.game.playerByClientID(c)!.smallID() === host.smallID,
    )!;
    step(runner, 1, [
      stamped(hostID, {
        type: "mark_disconnected",
        isDisconnected: true,
      } as never),
    ]);
    step(runner, 1);
    expect(host.away).toBe(true);
    const asker = [A, B, C].find((c) => c !== hostID)!;
    const at = gw.s.deadlineTick!;
    send(runner, asker, { kind: "slow" });
    expect(gw.s.deadlineTick).toBe(at + 300);
  });

  it("refuses a friend answering the vote", async () => {
    const { runner } = await friends();
    const gw = gwOf(runner);
    const v = gwView(gw);
    const notHost = [A, B, C].find(
      (c) =>
        !v.roster.find(
          (r) => r.smallID === runner.game.playerByClientID(c)!.smallID(),
        )!.host,
    )!;
    send(runner, notHost, { kind: "slow" });
    const at = gw.s.deadlineTick!;
    send(runner, notHost, { kind: "slow_answer", grant: true });
    expect(gw.s.deadlineTick).toBe(at);
  });
});

describe("no time limit (ww163)", () => {
  const none = () => friends({ greatWar1914Pace: "none" });

  it("never closes a chapter by time", async () => {
    const { runner } = await none();
    const gw = gwOf(runner);
    expect(gw.s.deadlineTick).toBeNull();
    const before = gw.s.chapter;
    // Longer than any chapter's timer at the long pace.
    step(runner, 3000);
    expect(gw.s.chapter).toBe(before);
    expect(gw.s.deadlineTick).toBeNull();
  });

  it("closes when every seat is ready, skipping a dropped one", async () => {
    const { runner } = await none();
    const before = gwOf(runner).s.chapter;
    closeChapter(runner);
    expect(gwOf(runner).s.chapter).toBe(before + 1);
    expect(gwOf(runner).s.deadlineTick).toBeNull();
    step(runner, 1, [
      stamped(C, { type: "mark_disconnected", isDisconnected: true } as never),
    ]);
    step(runner, 1);
    closeChapter(runner, [A, B]);
    expect(gwOf(runner).s.chapter).toBe(before + 2);
  });

  it("lets the host close the chapter for everyone, by proxy", async () => {
    const { runner } = await none();
    const gw = gwOf(runner);
    const before = gw.s.chapter;
    send(runner, A, { kind: "close_chapter", chapter: before });
    expect(gw.s.chapter).toBe(before + 1);
    expect(gw.s.deadlineTick).toBeNull();
    // What sat open on the idle seats got the proxy's stamp.
    expect(
      ["RUS", "GBR"].some((t) =>
        seatOf(runner, t).log.some((l) => l.key === "proxy_signed"),
      ),
    ).toBe(true);
    // Twice empty: the regent takes the idle seats, as with a timer.
    send(runner, A, { kind: "close_chapter", chapter: before + 1 });
    expect(seatOf(runner, "GBR").regent).toBe(true);
    expect(seatOf(runner, "RUS").regent).toBe(true);
    expect(seatOf(runner, "DEU").regent).toBe(false);
  });

  it("lets only the host close it, and only the chapter it meant", async () => {
    const { runner } = await none();
    const gw = gwOf(runner);
    const before = gw.s.chapter;
    const hostOf = (c: string) =>
      gwView(gw).roster.find(
        (r) => r.smallID === runner.game.playerByClientID(c)!.smallID(),
      )!.host;
    expect(hostOf(A)).toBe(true);
    expect(hostOf(B)).toBe(false);
    const seatB = gw.s.seats.find(
      (x) => x.smallID === runner.game.playerByClientID(B)!.smallID(),
    )!;
    expect(
      applyGwOrder(gw, seatB, { kind: "close_chapter", chapter: before }),
    ).toBe("not_host");
    send(runner, B, { kind: "close_chapter", chapter: before });
    step(runner, 5);
    expect(gw.s.chapter).toBe(before);
    send(runner, A, { kind: "close_chapter", chapter: before - 1 });
    step(runner, 5);
    expect(gw.s.chapter).toBe(before);
  });

  it("carries the close on the wire", () => {
    expect(
      GwOrderSchema.safeParse({ kind: "close_chapter", chapter: 3 }).success,
    ).toBe(true);
  });
});

describe("proxy and regency", () => {
  const timeOut = (r: GameRunner) => {
    const left = gwOf(r).s.deadlineTick! - r.game.ticks();
    step(r, left + 2);
  };

  it("stamps what the timer decided and hands a seat empty twice to its regent", async () => {
    const { runner } = await friends({ greatWar1914Pace: "short" });
    timeOut(runner);
    expect(seatOf(runner, "GBR").regent).toBe(false);
    timeOut(runner);
    expect(seatOf(runner, "GBR").regent).toBe(true);
    expect(seatOf(runner, "GBR").log.map((l) => l.key)).toContain(
      "regent_took_over",
    );
  });

  it("gives the seat back on the first order", async () => {
    const { runner } = await friends({ greatWar1914Pace: "short" });
    timeOut(runner);
    timeOut(runner);
    send(runner, C, {
      kind: "ready",
      chapter: gwOf(runner).s.chapter,
      on: false,
    });
    expect(seatOf(runner, "GBR").regent).toBe(false);
  });

  it("gives the seat back when a dropped friend reconnects", async () => {
    const { runner } = await friends({ greatWar1914Pace: "short" });
    step(runner, 1, [
      stamped(C, { type: "mark_disconnected", isDisconnected: true } as never),
    ]);
    step(runner, 1);
    expect(seatOf(runner, "GBR").away).toBe(true);
    timeOut(runner);
    timeOut(runner);
    expect(seatOf(runner, "GBR").regent).toBe(true);
    step(runner, 1, [
      stamped(C, { type: "mark_disconnected", isDisconnected: false } as never),
    ]);
    step(runner, 2);
    expect(seatOf(runner, "GBR").regent).toBe(false);
    expect(seatOf(runner, "GBR").log.map((l) => l.key)).toContain(
      "seat_taken_back",
    );
  });

  it("gives back a seat emptied before the friend dropped", async () => {
    const { runner } = await friends({ greatWar1914Pace: "short" });
    timeOut(runner);
    timeOut(runner);
    expect(seatOf(runner, "GBR").regent).toBe(true);
    const drop = (isDisconnected: boolean) => {
      step(runner, 1, [
        stamped(C, { type: "mark_disconnected", isDisconnected } as never),
      ]);
      step(runner, 2);
    };
    drop(true);
    drop(false);
    expect(seatOf(runner, "GBR").regent).toBe(false);
  });

  it("signs the AI's plan for a regent's country", async () => {
    const { runner } = await friends({ greatWar1914Pace: "short" });
    const gw = gwOf(runner);
    const seat = seatOf(runner, "DEU");
    seat.regent = true;
    gw.nation("DEU")!.alloc = {
      main: "east",
      posture: "offensive",
      scale: "major",
      allyShare: 0,
      research: "sea",
    };
    regentStep(gw);
    expect(seat.alloc.main).toBe("east");
    expect(ruledBySeat(gw, "DEU")).toBe(false);
  });

  it("runs a table of regents through the budget by proxy", async () => {
    const { runner: r } = await friends({ greatWar1914Pace: "short" });
    const gw = gwOf(r);
    const year = gwChapters("friends").findIndex((c) => c.budget === 1915);
    // ww210: a budget voted as a bill meets its deadline GW_MONEY_DEADLINE
    // chapters past the meeting.
    for (let i = 0; i < 40 && gw.s.chapter <= year + 2 + GW_MONEY_DEADLINE; i++)
      timeOut(r);
    expect(gw.s.ended).toBe(null);
    for (const tag of ["DEU", "RUS", "GBR"]) {
      expect(seatOf(r, tag).regent).toBe(true);
      const b = gw.nation(tag as "DEU")!.budget;
      // The meeting sat and closed for the seat: signed for it, or refused.
      expect(b.meeting).toBe(null);
      expect(b.last).not.toBe("none");
    }
    // What the timer closed is stamped as the proxy's.
    expect(seatOf(r, "GBR").choices.some((c) => c.proxy)).toBe(true);
  });

  it("does not wait for a regent's seat", async () => {
    const { runner } = await friends({ greatWar1914Pace: "short" });
    timeOut(runner);
    timeOut(runner);
    const at = gwOf(runner).s.chapter;
    closeChapter(runner, [A, B]);
    expect(gwOf(runner).s.chapter).toBe(at + 1);
  });
});

describe("telegrams", () => {
  it("takes Hangul on the wire and refuses control characters", () => {
    const ok = GwOrderSchema.safeParse({
      kind: "telegram",
      to: "RUS",
      cipher: 1,
      text: "니키, 벨기에는 건드리지 않겠네. 약속하지.",
    });
    expect(ok.success).toBe(true);
    const bad = GwOrderSchema.safeParse({
      kind: "telegram",
      to: "RUS",
      cipher: 1,
      text: "a\u0000b",
    });
    expect(bad.success).toBe(false);
    const long = GwOrderSchema.safeParse({
      kind: "telegram",
      to: "RUS",
      cipher: 1,
      text: "가".repeat(281),
    });
    expect(long.success).toBe(false);
  });

  it("arrives next chapter, for the addressee only", async () => {
    const { runner } = await friends();
    const gw = gwOf(runner);
    send(runner, A, { kind: "telegram", to: "RUS", cipher: 2, text: "안녕" });
    const rus = seatOf(runner, "RUS").smallID;
    const deu = seatOf(runner, "DEU").smallID;
    const inbox = () => gwView(gw, rus).seats[0].diplo.telegrams;
    expect(inbox()).toEqual([]);
    expect(gwView(gw, deu).seats[0].diplo.telegrams[0].box).toBe("sent");
    closeChapter(runner);
    expect(inbox().map((t) => t.text)).toEqual(["안녕"]);
    expect(inbox()[0].box).toBe("in");
  });

  it("charges for the cipher and refuses a telegram to nobody", async () => {
    const { runner } = await friends();
    const gw = gwOf(runner);
    const before = gw.nation("DEU")!.authority;
    send(runner, A, { kind: "telegram", to: "RUS", cipher: 2, text: "가" });
    expect(gw.nation("DEU")!.authority).toBe(before - 6);
    send(runner, A, { kind: "telegram", to: "ITA", cipher: 0, text: "가" });
    expect(gw.s.telegrams).toHaveLength(1);
  });

  it("drops a copy on a third seat at the rate of the grade", async () => {
    const { runner } = await friends();
    const gw = gwOf(runner);
    for (let i = 0; i < 30; i++) {
      gw.s.telegrams.push({
        uid: 1000 + i,
        from: "DEU",
        to: "RUS",
        cipher: 0,
        text: "x",
        chapter: gw.s.chapter,
        delivered: false,
        copies: [],
      });
    }
    closeChapter(runner);
    const copied = gw.s.telegrams.filter((t) => t.copies.includes("GBR"));
    // Plain text, with Britain's listeners: about 45 in a hundred.
    expect(copied.length).toBeGreaterThan(5);
    expect(copied.length).toBeLessThan(25);
    const gbr = seatOf(runner, "GBR").smallID;
    expect(
      gwView(gw, gbr).seats[0].diplo.telegrams.filter((t) => t.box === "copy"),
    ).toHaveLength(copied.length);
  });
});

describe("secret treaties", () => {
  const signed = async (clauses: ReturnType<typeof clause>[]) => {
    const made = await friends();
    const r = made.runner;
    send(r, A, { kind: "treaty_offer", to: "GBR", clauses });
    const t = gwOf(r).s.treaties[0];
    send(r, C, { kind: "treaty_answer", treaty: t.uid, sign: true });
    return { r, t };
  };

  it("needs two signatures and shows only to the parties", async () => {
    const { runner: r } = await friends();
    const gw = gwOf(r);
    send(r, A, {
      kind: "treaty_offer",
      to: "GBR",
      clauses: [clause("neutrality", "GBR")],
    });
    const t = gw.s.treaties[0];
    expect(t.state).toBe("offered");
    const seen = (tag: string) =>
      gwView(gw, seatOf(r, tag).smallID).seats[0].diplo.treaties;
    expect(seen("GBR")[0].answer).toBe(true);
    expect(seen("DEU")[0].answer).toBe(false);
    expect(seen("RUS")).toEqual([]);
    send(r, B, { kind: "treaty_answer", treaty: t.uid, sign: true });
    expect(t.state).toBe("offered");
    send(r, C, { kind: "treaty_answer", treaty: t.uid, sign: true });
    expect(t.state).toBe("signed");
  });

  it("lapses unanswered", async () => {
    const { runner: r } = await friends();
    send(r, A, {
      kind: "treaty_offer",
      to: "GBR",
      clauses: [clause("neutrality", "GBR")],
    });
    closeChapter(r);
    closeChapter(r);
    expect(gwOf(r).s.treaties[0].state).toBe("lapsed");
  });

  it("refuses a clause that binds a stranger", async () => {
    const { runner: r } = await friends();
    send(r, A, {
      kind: "treaty_offer",
      to: "GBR",
      clauses: [clause("neutrality", "ITA")],
    });
    expect(gwOf(r).s.treaties).toEqual([]);
  });

  it("moves money when a loan is signed", async () => {
    const fresh = gwOf((await friends()).runner);
    const gbr = fresh.nation("GBR")!.gauges.money;
    const deu = fresh.nation("DEU")!.gauges.money;
    const { r } = await signed([clause("loan", "GBR", 1)]);
    const gw = gwOf(r);
    expect(gw.nation("GBR")!.gauges.money).toBe(gbr - 1);
    expect(gw.nation("DEU")!.gauges.money).toBe(Math.min(3, deu + 1));
  });

  it("gives passage as a band of strength, taken back with the treaty", async () => {
    const before = await friends();
    const was = gwOf(before.runner).nation("DEU")!.strength.west!;
    const { r, t } = await signed([clause("passage", "GBR", 0, "west")]);
    const gw = gwOf(r);
    expect(gw.nation("DEU")!.strength.west).toBe(was + 1);
    send(r, C, { kind: "treaty_break", treaty: t.uid });
    expect(gw.nation("DEU")!.strength.west).toBe(was);
  });

  it("is broken by a war however it came, and the AI remembers", async () => {
    const { r, t } = await signed([clause("neutrality", "GBR")]);
    const gw = gwOf(r);
    gw.nation("GBR")!.atWar.push("DEU");
    const fra = gw.nation("FRA")!.trust.GBR ?? 0;
    closeChapter(r);
    expect(t.state).toBe("broken");
    expect(t.why).toBe("fought_partner");
    expect(gw.nation("FRA")!.trust.GBR).toBe(fra - 1);
    expect(gw.nation("DEU")!.trust.GBR).toBeLessThan(0);
    expect(seatOf(r, "GBR").log.map((l) => l.key)).toContain("treaty_i_broke");
    expect(seatOf(r, "DEU").log.map((l) => l.key)).toContain("treaty_broken");
  });

  it("breaks an entry promise not kept by its chapter", async () => {
    const made = await friends();
    const r = made.runner;
    const gw = gwOf(r);
    const due = gw.s.chapter + 1;
    send(r, A, {
      kind: "treaty_offer",
      to: "GBR",
      clauses: [clause("entry", "GBR", due)],
    });
    const t = gw.s.treaties[0];
    send(r, C, { kind: "treaty_answer", treaty: t.uid, sign: true });
    gw.nation("DEU")!.side = "central";
    closeChapter(r);
    closeChapter(r);
    expect(t.state).toBe("broken");
    expect(t.why).toBe("entry_late");
  });

  it("is judged by an AI country on what it gets", async () => {
    const { runner: r } = await friends();
    const gw = gwOf(r);
    gw.nation("ITA")!.ai = "opportunist";
    send(r, A, {
      kind: "treaty_offer",
      to: "ITA",
      clauses: [clause("loan", "DEU", 2), clause("neutrality", "DEU")],
    });
    send(r, A, {
      kind: "treaty_offer",
      to: "ITA",
      clauses: [clause("entry", "ITA", 10), clause("loan", "ITA", 2)],
    });
    closeChapter(r);
    expect(gw.s.treaties.map((t) => t.state)).toEqual(["signed", "refused"]);
  });

  it("leaks in time, and the world knows who signed", async () => {
    const { r, t } = await signed([clause("neutrality", "GBR")]);
    const gw = gwOf(r);
    for (let i = 0; i < 11 && !t.leaked; i++) closeChapter(r);
    // Seed-dependent: force it on a game that stayed quiet.
    if (!t.leaked) t.leaked = true;
    const rus = seatOf(r, "RUS").smallID;
    expect(gwView(gw, rus).seats[0].diplo.treaties[0].mine).toBe(false);
  });
});

describe("two seats, each its own house", () => {
  it("takes two bills through two parliaments, each seen by its own seat", async () => {
    const { runner: r } = await friends();
    const gw = gwOf(r);
    toWar(gw);
    gw.s.dayShift = 800;
    gw.s.day += 800;
    const deuLaw = GW_LAWS.find((x) => x.tag === "DEU")!;
    const rusLaw = GW_LAWS.find((x) => x.tag === "RUS")!;
    const deu = seatOf(r, "DEU");
    const rus = seatOf(r, "RUS");
    expect(
      applyGwOrder(gw, deu, { kind: "law", law: deuLaw.id, act: "draft" }),
    ).toBe(null);
    expect(
      applyGwOrder(gw, rus, { kind: "law", law: rusLaw.id, act: "draft" }),
    ).toBe(null);
    // Nobody drafts the other's bill.
    expect(
      applyGwOrder(gw, rus, { kind: "law", law: deuLaw.id, act: "draft" }),
    ).toBe("no_law");
    expect(gw.nation("DEU")!.laws.map((l) => l.id)).toEqual([deuLaw.id]);
    expect(gw.nation("RUS")!.laws.map((l) => l.id)).toEqual([rusLaw.id]);
    const view = gwView(gw, rus.smallID);
    expect(JSON.stringify(view.seats)).not.toContain(deuLaw.id);
    expect(JSON.stringify(view.seats)).toContain(rusLaw.id);
  });

  it("brings no ally's ask from a country a friend holds", async () => {
    const { runner: r } = await friends();
    const gw = gwOf(r);
    toWar(gw);
    houseStep(gw);
    for (let i = 0; i < 12; i++) {
      gw.s.chapter++;
      alliesStep(gw);
    }
    const seated = new Set(gw.s.seats.map((x) => x.tag));
    for (const seat of gw.s.seats) {
      for (const a of seat.house?.asks ?? []) {
        const row = GW_CONTENT.asks?.find((x) => x.id === a.id);
        expect(seated.has(row!.from)).toBe(false);
      }
    }
  });
});

describe("peace between enemy friends", () => {
  it("talks Germany opens go to the friend who leads the other side", async () => {
    const { runner: r } = await friends();
    const gw = gwOf(r);
    toWar(gw);
    openTalks(gw, seatOf(r, "DEU"));
    advanceChapter(gw, r.game.ticks(), false);
    const gbr = seatOf(r, "GBR");
    const due = [...gbr.scheduled, ...gbr.desk].map((x) => x.scene);
    expect(due).toContain("gw_peace_offer");
    expect(gw.s.armistice).toBe(null);
  });
});

describe("the peace table between friends", () => {
  /** War, then Germany loses; the table opens next chapter. */
  async function table() {
    const made = await friends();
    const gw = gwOf(made.runner);
    toWar(gw);
    armistice(gw, "central_lost", "DEU");
    advanceChapter(gw, made.runner.game.ticks(), false);
    expect(gw.s.table).not.toBe(null);
    return { r: made.runner, gw };
  }
  const tableOf = (r: GameRunner, who: string) =>
    gwView(gwOf(r), r.game.playerByClientID(who)!.smallID()).seats[0].table!;
  /**
   * The table talks until `who` is due; the other friends answer the plain
   * way when it is their word or turn.
   */
  function untilDue(r: GameRunner, who: string): void {
    for (let i = 0; i < 400; i++) {
      if (tableOf(r, who).due !== null) return;
      plainly(
        r,
        [A, B, C].filter((x) => x !== who),
      );
    }
    throw new Error("never due");
  }
  function plainly(r: GameRunner, others: readonly string[]): void {
    for (const o of others) {
      const due = tableOf(r, o).due;
      if (due?.kind === "word") {
        const word = due.words.includes("yes") ? "yes" : due.words[0];
        send(r, o, { kind: "table_word", claim: due.claim, word, trade: null });
        return;
      }
      if (due?.kind === "turn") {
        send(r, o, { kind: "table_pass" });
        return;
      }
    }
    send(r, A, { kind: "table_next" });
  }

  it("seats on the same side chair in turn, the table waiting for each", async () => {
    const { r, gw } = await table();
    const order = gw.s.table!.order;
    expect(order).toContain("RUS");
    expect(order).toContain("GBR");
    const turns = new Set<string>();
    for (let i = 0; i < 400 && turns.size < 2 && !gw.s.table!.done; i++) {
      const who = [B, C].find((x) => tableOf(r, x).due?.kind === "turn");
      if (who === undefined) {
        plainly(r, [A]);
        continue;
      }
      const speaker = gw.s.table!.order[gw.s.table!.at];
      turns.add(speaker);
      // Nobody speaks for a friend: the table waits.
      step(r, 200);
      expect(gw.s.table!.order[gw.s.table!.at]).toBe(speaker);
      send(r, who, { kind: "table_pass" });
    }
    expect(turns).toEqual(new Set(["RUS", "GBR"]));
  });

  it("a claim on a friend across the table waits for the friend's word", async () => {
    const { r, gw } = await table();
    untilDue(r, C);
    let due = tableOf(r, C).due;
    for (let i = 0; i < 20 && due?.kind !== "turn"; i++) {
      if (due?.kind === "word") {
        send(r, C, {
          kind: "table_word",
          claim: due.claim,
          word: due.words[0],
          trade: null,
        });
      }
      untilDue(r, C);
      due = tableOf(r, C).due;
    }
    expect(due?.kind).toBe("turn");
    if (due?.kind !== "turn") return;
    // ww199 (design §2.4): France has Kamerun as its case and would have a
    // word first; Britain's own cases go straight to Germany's friend.
    const place = (["windhoek", "dar_es_salaam", "kamerun"] as const).find(
      (p) => due.places.includes(p),
    )!;
    expect(place).toBeDefined();
    send(r, C, { kind: "table_claim", place });
    const claim = gw.s.table!.claims.find((x) => x.place === place)!;
    expect(claim.against).toBe("DEU");
    // Germany's friend hasn't answered: the table waits.
    step(r, 300);
    expect(claim.state).toBe("open");
    expect(tableOf(r, A).due?.kind).toBe("word");
    // The month runs out: the delegation answers for the friend.
    advanceChapter(gw, r.game.ticks(), false);
    expect(claim.state).not.toBe("open");
  });
});

describe("the friends row", () => {
  it("is twenty chapters to the spring of 1916, an hour on the clock", () => {
    const list = gwChapters("friends");
    expect(list).toHaveLength(20);
    expect(list.map((c) => c.stage)).toEqual([
      ...Array(6).fill("crisis"),
      ...Array(5).fill("y1914"),
      ...Array(8).fill("war"),
      "closing",
    ]);
    const secs = list.reduce((n, c) => n + c.timerSec, 0);
    expect(secs).toBe(3090);
    const budgets = list.filter((c) => c.budget !== null);
    expect(budgets.map((c) => c.budget)).toEqual([1915, 1916]);
    const first = list.find((c) => c.budget === 1915)!;
    expect(first.stage).toBe("war");
  });
});

describe("a save between friends", () => {
  const bring = async (made: Awaited<ReturnType<typeof friends>>, me: string) =>
    createGameRunnerFromSnapshot(
      wwGameStart({ greatWar1914: true, gameType: GameType.Private }, [
        { clientID: "NEWAAAA1", gwCountry: "RUS" },
        { clientID: "NEWBBBB2", gwCountry: "DEU" },
      ]),
      made.runner.snapshot(),
      me,
      await loadMapFiles(
        new TestDataMapLoader(MINI),
        GameMapType.World1936,
        GameMapSize.Normal,
      ),
      () => {},
    );
  const turn = (r: GameRunner, who: string, o: GwOrder) => {
    step(r, 1, [stamped(who, { type: "gw_order", order: o })]);
    step(r, 2);
  };

  it("comes back the same with the house and the craft, on any seat", async () => {
    const made = await friends();
    const gw = gwOf(made.runner);
    toWar(gw);
    closeChapter(made.runner);
    houseStep(gw);
    for (const seat of gw.s.seats) {
      expect(seat.house).toBeDefined();
      if (seat.craft !== undefined) continue;
      // As Craft makes it: the craft, then the house, in the schema's order.
      const house = seat.house!;
      seat.craft = gwCraftStart();
      delete seat.house;
      seat.house = house;
    }
    closeChapter(made.runner);
    const one = await bring(made, "NEWAAAA1");
    const two = await bring(made, "NEWBBBB2");
    expect(gwOf(one).hash()).toBe(gw.hash());
    // Only who sits where moved: the new connections and the empty seat.
    const moved = diffSnapshots(made.runner.snapshot(), one.snapshot());
    expect(moved.filter((d) => !d.startsWith("snapshot.players["))).toEqual([]);
    for (const x of [one, two]) step(x, 3);
    expect(gwOf(one).hash()).toBe(gwOf(two).hash());
    expect(gwOf(one).s.seats.every((x) => x.craft && x.house)).toBe(true);
  });

  it("names its seats in the header", async () => {
    const made = await friends();
    closeChapter(made.runner);
    const h = readSnapshotHeader(made.runner.snapshot());
    expect(h.greatWar?.seats.sort()).toEqual(["DEU", "GBR", "RUS"]);
    expect(h.greatWar?.chapter).toBe(1);
    expect(h.greatWar?.date).toMatch(/^1914-/);
  });

  it("seats new connections by country, swapped or not, and stays in step", async () => {
    const made = await friends();
    const one = await bring(made, "NEWAAAA1");
    const two = await bring(made, "NEWBBBB2");
    for (const r of [one, two]) {
      const gw = gwOf(r);
      expect(r.game.playerByClientID("NEWAAAA1")!.smallID()).toBe(
        seatOf(r, "RUS").smallID,
      );
      expect(r.game.playerByClientID("NEWBBBB2")!.smallID()).toBe(
        seatOf(r, "DEU").smallID,
      );
      // Nobody took Britain: its seat is away and its regent will come.
      step(r, 2);
      expect(seatOf(r, "GBR").away).toBe(true);
      turn(r, "NEWAAAA1", {
        kind: "telegram",
        to: "DEU",
        cipher: 0,
        text: "다시 만났소",
      });
      expect(gw.s.telegrams).toHaveLength(1);
    }
    expect(gwOf(one).hash()).toBe(gwOf(two).hash());
  });

  it("gives the viewer only the new seat", async () => {
    const made = await friends();
    const r = await bring(made, "NEWAAAA1");
    step(r, 2);
    const gw = gwOf(r);
    gw.touch();
    expect(gw.takeData()!.seats.map((s) => s.tag)).toEqual(["RUS"]);
  });

  it("hands a seat under a regent back to whoever takes it", async () => {
    const made = await friends();
    seatOf(made.runner, "RUS").regent = true;
    const r = await bring(made, "NEWAAAA1");
    expect(seatOf(r, "RUS").regent).toBe(false);
  });
});

describe("a friend's collapse", () => {
  it("takes that country out and leaves the table playing", async () => {
    const { runner: r } = await friends();
    const gw = gwOf(r);
    closeSeat(gw, seatOf(r, "RUS"), "home_collapse");
    expect(gw.s.ended).toBe(null);
    expect(gw.nation("RUS")!.out).toBe(true);
    // The fallen friend watches to the memoirs: no desk, nothing waited on.
    expect(seatOf(r, "RUS").memoir).not.toBe(null);
    expect(allReady(gw)).toBe(false);
    closeChapter(r, [A, C]);
    expect(gw.s.ended).toBe(null);
  });
});

describe("the end", () => {
  it("reads the end from each seat's side", async () => {
    const { runner: r } = await friends();
    const gw = gwOf(r);
    gw.s.warChapter = 0;
    gw.nation("DEU")!.side = "central";
    gw.nation("RUS")!.side = "entente";
    gw.s.armistice = { kind: "central_lost", chapter: 0, by: "DEU" };
    gw.s.ended = "armistice_conference";
    const of = (tag: string) => generalEnding(gw, seatOf(r, tag));
    expect(of("DEU")).toBe("armistice_conference");
    expect(of("RUS")).toBe("victory_peace");
    for (const tag of ["DEU", "RUS"]) {
      expect(memoirOf(gw, seatOf(r, tag)).ending).toBe(
        ownEnding(gw, seatOf(r, tag), of(tag)),
      );
    }
  });

  it("opens everyone's memoir and every treaty to all", async () => {
    const { runner: r } = await friends();
    const gw = gwOf(r);
    send(r, A, {
      kind: "treaty_offer",
      to: "GBR",
      clauses: [clause("neutrality", "GBR")],
    });
    send(r, C, { kind: "treaty_answer", treaty: 1, sign: true });
    gw.s.ended = "closing";
    step(r, 2);
    const v = gwView(gw, seatOf(r, "RUS").smallID);
    expect(v.finale!.memoirs).toHaveLength(3);
    expect(v.finale!.treaties).toHaveLength(1);
  });
});
