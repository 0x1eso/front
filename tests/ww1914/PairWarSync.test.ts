// ww171 merge 4 (the owner's cut of phase 6): two seats at one table. One
// declares war on the other from the 통치 tab, later offers a peace of the
// two, and the other takes it on its card. The same game run twice digests
// the same at every chapter, and the declaration arrives the next chapter.
import { GameType } from "@openfront/engine-api/game/GameTypes";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { gwView } from "@openfront/engine/ww1914/View";
import { atWarWith } from "@openfront/engine/ww1914/Wars";
import { describe, expect, test } from "vitest";
import { stamped, step, wwRunnerCapture } from "../ww1936/util";

const A = "AAAAAAA1";
const B = "BBBBBBB2";
const plain = { target: null, without: false, sound: false };

async function table(): Promise<GameRunner> {
  const { runner } = await wwRunnerCapture(
    {
      greatWar1914: true,
      gameType: GameType.Private,
      greatWar1914Calendar: "friends",
    },
    [
      { clientID: A, gwCountry: "DEU" },
      { clientID: B, gwCountry: "FRA" },
    ],
    undefined,
    "GWSYNC1",
    A,
  );
  step(runner, 2);
  return runner;
}

const gwOf = (r: GameRunner) => r.game.greatWar()!;
const hash = (r: GameRunner) =>
  (r.game as unknown as { hash(): number }).hash();
const send = (r: GameRunner, who: string, o: GwOrder) => {
  step(r, 1, [stamped(who, { type: "gw_order", order: o })]);
  step(r, 1);
};
const seatView = (r: GameRunner, tag: string) => {
  const gw = gwOf(r);
  const me = gw.s.seats.find((x) => x.tag === tag)!;
  return gwView(gw, me.smallID).seats.find((x) => x.tag === tag)!;
};

/** Clears a seat's desk the plain way; a peace offer is taken. */
function clearDesk(r: GameRunner, who: string, tag: string): string[] {
  const seen: string[] = [];
  for (let guard = 0; guard < 50; guard++) {
    // ww196: department papers never block the chapter; the plain way
    // leaves them on the desk.
    const card = seatView(r, tag).desk.find((c) => c.paper === undefined);
    if (card === undefined) break;
    seen.push(card.scene);
    if (card.node !== null) {
      const reply = card.replies.find((x) => x.open)!;
      send(r, who, { kind: "reply", card: card.uid, reply: reply.id });
    } else if (card.options.length > 0) {
      const take = card.options.find((x) => x.id === "make_peace" && x.open);
      const option = take ?? card.options.find((x) => x.open)!;
      send(r, who, { kind: "choose", card: card.uid, option: option.id });
    } else {
      send(r, who, { kind: "read", card: card.uid });
    }
  }
  return seen;
}

/** Both seats clear their desks and say ready; the chapter closes. */
function chapter(r: GameRunner, seen: Record<string, string[]>): void {
  const gw = gwOf(r);
  const at = gw.s.chapter;
  for (const [who, tag] of [
    [A, "DEU"],
    [B, "FRA"],
  ] as const) {
    seen[tag].push(...clearDesk(r, who, tag));
  }
  for (const who of [A, B]) {
    send(r, who, { kind: "ready", chapter: at, on: true });
  }
  for (let i = 0; i < 20 && gw.s.chapter === at && gw.s.ended === null; i++) {
    step(r, 1);
  }
}

interface Run {
  digests: number[];
  declaredAt: number;
  warAt: number;
  offeredAt: number;
  peaceAt: number;
  frenchCards: string[];
}

async function play(): Promise<Run> {
  const r = await table();
  const gw = gwOf(r);
  // A quiet table: no July chain; Paris refused Berlin's note last month.
  gw.s.chain = null;
  gw.s.spark = null;
  gw.s.chains.push({ topic: "balkan", outcome: "compromise", chapter: 0 });
  gw.s.ladders.push({
    from: "DEU",
    to: "FRA",
    step: "rejected",
    opened: 0,
    chapter: 0,
  });
  // The chancellor signs: this test is about the table, not his mood.
  for (const p of gw.s.people) p.trust = 3;
  const seen: Record<string, string[]> = { DEU: [], FRA: [] };
  const run: Run = {
    digests: [],
    declaredAt: -1,
    warAt: -1,
    offeredAt: -1,
    peaceAt: -1,
    frenchCards: seen.FRA,
  };
  for (let i = 0; i < 8 && gw.s.ended === null; i++) {
    if (run.declaredAt < 0) {
      send(r, A, {
        kind: "power",
        id: "deu_pw_war_on",
        picks: ["fra"],
        ...plain,
      });
      if (gw.s.pairNotes.some((x) => x.kind === "war" && x.to === "FRA")) {
        run.declaredAt = gw.s.chapter;
        // Not yet: it goes as an order and lands as the chapter closes.
        expect(atWarWith(gw, "DEU", "FRA")).toBe(false);
      }
    } else if (run.offeredAt < 0 && gw.s.chapter >= run.warAt + 2) {
      send(r, A, {
        kind: "power",
        id: "deu_pw_peace_with",
        picks: ["fra"],
        ...plain,
      });
      if (gw.s.pairNotes.some((x) => x.kind === "peace" && x.to === "FRA")) {
        run.offeredAt = gw.s.chapter;
      }
    }
    chapter(r, seen);
    if (run.warAt < 0 && atWarWith(gw, "DEU", "FRA")) run.warAt = gw.s.chapter;
    const w = gw.s.wars.find(
      (x) => x.a === "DEU" && x.b === "FRA" && x.ended !== null,
    );
    if (run.peaceAt < 0 && w !== undefined) run.peaceAt = w.ended!;
    run.digests.push(hash(r));
  }
  return run;
}

describe("two seats at war and peace, in step", () => {
  test("the same table plays the same, chapter by chapter", async () => {
    const first = await play();
    const second = await play();
    expect(second.digests).toEqual(first.digests);
    expect(second).toEqual(first);
    // The declaration arrived as the chapter closed: war the next chapter.
    expect(first.declaredAt).toBeGreaterThanOrEqual(0);
    expect(first.warAt).toBe(first.declaredAt + 1);
    expect(first.frenchCards).toContain("gw_war_note");
    // The offer reached Paris's desk and Paris took it.
    expect(first.offeredAt).toBeGreaterThan(first.warAt);
    expect(first.frenchCards).toContain("gw_pair_offer");
    expect(first.peaceAt).toBe(first.offeredAt + 1);
  }, 120000);
});
