import {
  GameMapSize,
  GameMapType,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import { GwOrderSchema } from "@openfront/engine-api/ww1914/GwOrders";
import type { GreatWarData } from "@openfront/engine-api/ww1914/GwView";
import {
  createGameRunnerFromSnapshot,
  GameRunner,
} from "@openfront/engine/GameRunner";
import { readSnapshotHeader } from "@openfront/engine/snapshot/GameSnapshot";
import { allReady } from "@openfront/engine/ww1914/Chapters";
import {
  closeSeat,
  generalEnding,
  memoirOf,
} from "@openfront/engine/ww1914/Endings";
import { warScore } from "@openfront/engine/ww1914/Fronts";
import { gwPlayers } from "@openfront/engine/ww1914/GwPlayers";
import { regentStep } from "@openfront/engine/ww1914/Seats";
import { gwView } from "@openfront/engine/ww1914/View";
import { ruledBySeat } from "@openfront/engine/ww1914/World";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { describe, expect, it } from "vitest";
import { TestDataMapLoader } from "../util/ScriptedGame";
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

async function friends(config = {}) {
  const made = await wwRunnerCapture(
    {
      greatWar1914: true,
      gameType: GameType.Private,
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

const clause = (
  kind: "alliance" | "neutrality" | "loan" | "passage" | "entry" | "territory",
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

  it("holds no seat for a spectator", async () => {
    const { runner } = await friends();
    expect(gwView(gwOf(runner), null).seats).toEqual([]);
  });
});

describe("the chapter clock with friends", () => {
  it("runs on the host's timer, the closing chapter on the table's", async () => {
    const { runner } = await friends({ greatWar1914TimerSec: 60 });
    const gw = gwOf(runner);
    expect(gw.s.deadlineTick! - runner.game.ticks()).toBeLessThanOrEqual(600);
    expect(gw.s.deadlineTick! - runner.game.ticks()).toBeGreaterThan(590);
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

describe("proxy and regency", () => {
  const timeOut = (r: GameRunner) => {
    const left = gwOf(r).s.deadlineTick! - r.game.ticks();
    step(r, left + 2);
  };

  it("stamps what the timer decided and hands a seat empty twice to its regent", async () => {
    const { runner } = await friends({ greatWar1914TimerSec: 60 });
    timeOut(runner);
    expect(seatOf(runner, "GBR").regent).toBe(false);
    timeOut(runner);
    expect(seatOf(runner, "GBR").regent).toBe(true);
    expect(seatOf(runner, "GBR").log.map((l) => l.key)).toContain(
      "regent_took_over",
    );
  });

  it("gives the seat back on the first order", async () => {
    const { runner } = await friends({ greatWar1914TimerSec: 60 });
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
    const { runner } = await friends({ greatWar1914TimerSec: 60 });
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
    const { runner } = await friends({ greatWar1914TimerSec: 60 });
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
    const { runner } = await friends({ greatWar1914TimerSec: 60 });
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

  it("does not wait for a regent's seat", async () => {
    const { runner } = await friends({ greatWar1914TimerSec: 60 });
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

  it("bars a war on the partner until the treaty is broken", async () => {
    const { r, t } = await signed([clause("neutrality", "GBR")]);
    const gw = gwOf(r);
    gw.s.warChapter = gw.s.chapter;
    gw.nation("DEU")!.side = "central";
    send(r, C, { kind: "enter_war", side: "entente" });
    expect(gw.nation("GBR")!.side).toBe(null);
    send(r, C, { kind: "treaty_break", treaty: t.uid });
    expect(t.state).toBe("broken");
    expect(t.brokenBy).toBe("GBR");
    send(r, C, { kind: "enter_war", side: "entente" });
    expect(gw.nation("GBR")!.side).toBe("entente");
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
  it("reads ahead and behind from each seat's side", async () => {
    const { runner: r } = await friends();
    const gw = gwOf(r);
    gw.s.warChapter = 0;
    gw.nation("DEU")!.side = "central";
    gw.nation("RUS")!.side = "entente";
    gw.s.ended = "first_winter_level";
    const of = (tag: string) => generalEnding(gw, seatOf(r, tag));
    const scoreDeu = warScore(gw, "central");
    expect(scoreDeu).toBe(-warScore(gw, "entente"));
    if (Math.abs(scoreDeu) >= 15) expect(of("DEU")).not.toBe(of("RUS"));
    expect(memoirOf(gw, seatOf(r, "DEU")).ending).toBe(of("DEU"));
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
