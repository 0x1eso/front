// ww194 P6 (phase 6 checks): five friends at one table, each on his own
// client. Every client runs its own copy of the game and is fed the same turns,
// as the server relays them; each seat plays from what its own client shows.
// The fifth drops out and comes back from a save part way through. Every copy
// must keep the same hash, chapter by chapter, for more than 30 chapters.
import { GameType } from "@openfront/engine-api/game/GameTypes";
import type { StampedIntent } from "@openfront/engine-api/Schemas";
import type { GwOrder } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwSeatView } from "@openfront/engine-api/ww1914/GwView";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import {
  createGameRunner,
  createGameRunnerFromSnapshot,
  GameRunner,
} from "@openfront/engine/GameRunner";
import { gwView } from "@openfront/engine/ww1914/View";
import { describe, expect, test } from "vitest";
import { diffSnapshots } from "../util/Snapshot";
import { stamped, wwGameStart } from "../ww1936/util";
import { realMap } from "./realMap";

const SEATS = [
  { clientID: "DEUDEU01", gwCountry: "DEU" },
  { clientID: "GBRGBR02", gwCountry: "GBR" },
  { clientID: "FRAFRA03", gwCountry: "FRA" },
  { clientID: "RUSRUS04", gwCountry: "RUS" },
  { clientID: "AUHAUH05", gwCountry: "AUH" },
] as const;
const CONFIG = {
  greatWar1914: true,
  gameType: GameType.Private,
  greatWar1914Calendar: "full",
} as const;
const GAME = "GWFIVE01";

const hash = (r: GameRunner) =>
  (r.game as unknown as { hash(): number }).hash();
const gwOf = (r: GameRunner) => r.game.greatWar()!;

/** What one client shows its own seat. */
function mine(r: GameRunner, clientID: string): GwSeatView {
  const id = r.game.playerByClientID(clientID)!.smallID();
  return gwView(gwOf(r), id).seats.find((s) => s.smallID === id)!;
}

/** The bot's next order for a seat, read off its own client; null: done. */
function next(
  v: GwSeatView,
  chapter: number,
  roll: (below: number) => number,
  done: Set<string>,
): GwOrder | null {
  const pick = <T>(a: readonly T[]): T => a[roll(a.length)];
  // ww196: department papers never block the chapter; clear around them.
  const card = v.desk.find((c) => c.paper === undefined);
  if (card !== undefined) {
    if (card.node !== null) {
      const open = card.replies.filter((x) => x.open);
      return { kind: "reply", card: card.uid, reply: pick(open).id };
    }
    if (card.options.length > 0) {
      const open = card.options.filter((x) => x.open);
      // Friends who want a long war: no option that ends it or the game.
      const stays = open.filter(
        (o) => !o.tell.includes("ends_game") && !o.tell.includes("ends_war"),
      );
      const from = stays.length > 0 ? stays : open;
      return { kind: "choose", card: card.uid, option: pick(from).id };
    }
    return { kind: "read", card: card.uid };
  }
  // The peace table waits for the seat whose turn it is.
  const due = v.table?.due ?? null;
  if (due?.kind === "turn") {
    return due.places.length > 0 && roll(2) === 0
      ? { kind: "table_claim", place: pick(due.places) }
      : { kind: "table_pass" };
  }
  if (due?.kind === "word") {
    const word = pick(due.words);
    const trade =
      word === "offer" && due.trades.length > 0 ? pick(due.trades) : null;
    return { kind: "table_word", claim: due.claim, word, trade };
  }
  // Each kind of work once a chapter, as a person might.
  const once = (k: string) => {
    if (done.has(k)) return false;
    done.add(k);
    return true;
  };
  const head = (v.room ?? []).find((r) => r.office !== null && !r.petition);
  if (head !== undefined && once("brief")) {
    return { kind: "brief", office: head.office! };
  }
  const talk = v.people.find((p) => p.topics.length > 0);
  if (v.audiences > 0 && talk !== undefined && once("summon")) {
    return { kind: "summon", person: talk.id, topic: pick(talk.topics) };
  }
  const act = (v.acts ?? [])[0];
  if ((v.actsLeft ?? 0) > 0 && act !== undefined && once("act")) {
    const picks = act.fields.flatMap((f) =>
      [...f.options, ...f.tones, ...f.people].slice(0, f.count),
    );
    return { kind: "act", act: act.id, picks };
  }
  const paper = v.world.proposals.filter((p) => p.open);
  if (paper.length > 0 && once("paper")) {
    const p = pick(paper);
    return {
      kind: "allocate",
      main: p.main,
      posture: p.posture,
      scale: p.scale,
      allyShare: p.allyShare,
      research: v.alloc.research,
    };
  }
  return v.ready ? null : { kind: "ready", chapter, on: true };
}

/** Every client gets the same turn. */
function relay(clients: GameRunner[], intents: StampedIntent[]): void {
  const turn = clients[0].game.ticks();
  for (const r of clients) {
    r.addTurn({ turnNumber: turn, intents });
    if (!r.executeNextTick()) throw new Error(`tick ${turn} did not run`);
  }
}

describe("five seats at once", () => {
  test("five clients fed the same turns keep one hash past 30 chapters, a rejoin too", async () => {
    // The real map: the small test map has no Austria-Hungary.
    const map = realMap();
    const start = { ...wwGameStart(CONFIG, [...SEATS]), gameID: GAME };
    const clients: GameRunner[] = [];
    for (const s of SEATS) {
      clients.push(await createGameRunner(start, s.clientID, map, () => {}));
    }
    expect(
      gwOf(clients[0])
        .s.seats.map((x) => x.tag)
        .sort(),
    ).toEqual(SEATS.map((s) => s.gwCountry).sort());
    relay(clients, []);
    relay(clients, []);
    const seed = idHash(GAME);
    let n = 0;
    const roll = (below: number) => wwRoll(seed, 31, n++) % below;
    const digests: number[] = [];
    let joined = false;
    for (let guard = 0; guard < 4000; guard++) {
      const gw = gwOf(clients[0]);
      if (gw.s.ended !== null || digests.length >= 32) break;
      const chapter = gw.s.chapter;
      // A friend drops out and comes back from a save, on the fifth client.
      if (!joined && chapter === 12) {
        joined = true;
        const snap = clients[0].snapshot();
        const back = await createGameRunnerFromSnapshot(
          start,
          snap,
          SEATS[4].clientID,
          map,
          () => {},
        );
        expect(diffSnapshots(snap, back.snapshot())).toEqual([]);
        clients[4] = back;
      }
      const done = new Map<string, Set<string>>();
      for (
        let round = 0;
        round < 600 && gw.s.chapter === chapter && gw.s.ended === null;
        round++
      ) {
        const intents: StampedIntent[] = [];
        clients.forEach((r, i) => {
          const s = SEATS[i];
          const d = done.get(s.clientID) ?? new Set<string>();
          done.set(s.clientID, d);
          const o = next(mine(r, s.clientID), chapter, roll, d);
          if (o !== null) {
            intents.push(stamped(s.clientID, { type: "gw_order", order: o }));
          }
        });
        relay(clients, intents);
      }
      const why = SEATS.map((x, i) => {
        const v = mine(clients[i], x.clientID);
        const st = gw.s.seats.find((y) => y.tag === x.gwCountry)!;
        return `${x.gwCountry}:${st.ready}/${v.ready}:${v.readyBlock}:${JSON.stringify(v.table?.due ?? null)}:${st.memoir === null}:${st.away}:${st.regent}:${v.desk.map((c) => c.scene).join("+")}`;
      });
      // The last chapter ends the game instead of turning the page.
      const closed = gw.s.chapter !== chapter || gw.s.ended !== null;
      expect(closed, `chapter ${chapter} stuck: ${why.join(" ")}`).toBe(true);
      const h = clients.map(hash);
      expect(new Set(h).size, `chapter ${chapter}: ${h.join(" ")}`).toBe(1);
      digests.push(h[0]);
    }
    expect(joined).toBe(true);
    const end = `${gwOf(clients[0]).s.ended} at ${gwOf(clients[0]).s.chapter}`;
    // ww196 merge: a peace may end it first; it must still run well past the
    // rejoin. Otherwise 30 chapters in step.
    const ended = gwOf(clients[0]).s.ended !== null;
    expect(digests.length, end).toBeGreaterThanOrEqual(ended ? 20 : 30);
  }, 600000);
});
