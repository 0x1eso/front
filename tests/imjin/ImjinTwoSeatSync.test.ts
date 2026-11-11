// ww177 P7a (Imjin design §10): Joseon and Japan are both human seats, and
// the same scripted game runs twice: a landing, a fleet battle with
// formations and board / keep-range orders, the land battles' and sieges'
// picks, and a truce that ends in the investiture peace. The game's hash
// must be equal in both runs every SYNC_TICKS ticks, and the ending equal.
// The hand (as seaAirLockstep's) sets only what no order reaches on the
// small map: the war, a landing army in Japan's island port, Joseon's
// fleet, and the truce's first step.
import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { GameConfig, StampedIntent } from "@openfront/engine-api/Schemas";
import { INVASION_STATES } from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { JP_SCENE } from "@openfront/engine-lib/imjin/JapanContent";
import {
  ATTACK_ORDERS,
  DEFENCE_STANCES,
} from "@openfront/engine-lib/imjin/LandRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  type ImjinJapanState,
  TRUCE_PHASE,
} from "@openfront/engine/imjin/japan/ImjinJapan";
import { addFleet } from "@openfront/engine/imjin/sea/SeaState";
import { describe, expect, test } from "vitest";
import {
  byTag,
  gameHash,
  HUMAN,
  order,
  placeArmy,
  step,
  wwRunner,
} from "../ww1936/util";

const CONFIG: Partial<GameConfig> = {
  gameMap: GameMapType.Imjin1592,
  ww1936Scenario: "imjin1590",
  ww1936Designer: undefined,
};
const JPN_HUMAN = "HUMAN002";
const SEATS = [
  { clientID: HUMAN, country: "JOS" as const },
  { clientID: JPN_HUMAN, country: "JPN" as const },
];
const WAR_TICK = WW_PREP_TICKS + 1;
const TRUCE_TICK = WW_PREP_TICKS + 1_500;
const LAST_TICK = WW_PREP_TICKS + 2_400;
const SYNC_TICKS = 100;
const READY = INVASION_STATES.indexOf("ready");
/** imjinmini: Japan's island port, Joseon's port, and the Korean region
 * next to Japan's land. */
const JPN_PORT = 10;
const JOS_PORT = 2;
const KOREA_NEAR = 1;

interface Played {
  hashes: number[];
  seen: Set<string>;
  ending: unknown;
  winner: unknown;
}

/** The first water tile at least `d` tiles east of (x, y), in milli-tiles. */
function waterEast(r: GameRunner, x: number, y: number, d: number): number[] {
  const map = r.game.map();
  const ty = Math.floor(y / 1000);
  for (let tx = Math.floor(x / 1000) + d; tx < map.width(); tx++) {
    if (map.isWater(map.ref(tx, ty))) return [tx * 1000 + 500, ty * 1000 + 500];
  }
  throw new Error("no water east of the fleet");
}

/** The two seats' orders for this tick, from the state (both runs alike). */
function orders(r: GameRunner, seen: Set<string>): StampedIntent[] {
  const g = r.game;
  const t = g.ticks();
  const ww = g.worldWar()!;
  const im = ww.imjinWar!;
  const jos = byTag(g, "JOS").smallID();
  const jpn = byTag(g, "JPN").smallID();
  const out: StampedIntent[] = [];
  const japan = [...ww.land.armies.values()].filter((a) => a.owner === jpn);
  // The hand's army sails; the first marches over the land border.
  const landing = japan.length > 1 ? japan[japan.length - 1] : undefined;
  const field = japan[0];
  const fleetOf = (owner: number) =>
    im.st.sea.fleets.find((f) => f.owner === owner);
  // The landing: from the island port across to Joseon's.
  if (t > WAR_TICK + 2 && t % 25 === 0 && landing !== undefined) {
    const inv = ww.navy.invasions.get(landing.id);
    if (inv === undefined && !seen.has("invasion")) {
      out.push(
        order(JPN_HUMAN, {
          kind: "army_invade",
          army: landing.id,
          target: JOS_PORT,
        }),
      );
    } else if (inv !== undefined) {
      seen.add("invasion");
      if (inv.state === READY) {
        out.push(
          order(JPN_HUMAN, { kind: "invasion_execute", army: landing.id }),
        );
      }
    }
  }
  // The march: Japan's field army attacks the next Korean region.
  if (t === WAR_TICK + 5 && field !== undefined) {
    out.push(
      order(JPN_HUMAN, {
        kind: "army_attack",
        army: field.id,
        region: KOREA_NEAR,
      }),
    );
  }
  // The fleets: formations, then Japan closes to board and Joseon keeps range.
  const jf = fleetOf(jpn);
  const kf = fleetOf(jos);
  if (t === WAR_TICK + 3 && jf !== undefined && kf !== undefined) {
    const fleet = (
      who: string,
      id: number,
      o: "formation" | "board" | "keep_range" | "move",
      formation: "wedge" | "crane" | "line",
      tile = 0,
    ) =>
      order(who, { kind: "imjin_fleet", fleet: id, order: o, tile, formation });
    const target = g
      .map()
      .ref(Math.floor(kf.x / 1000), Math.floor(kf.y / 1000));
    out.push(
      fleet(JPN_HUMAN, jf.id, "formation", "wedge"),
      fleet(HUMAN, kf.id, "formation", "crane"),
      fleet(JPN_HUMAN, jf.id, "move", "wedge", target),
    );
  }
  if (jf !== undefined && kf !== undefined && t % 25 === 0) {
    if (jf.battle !== 0 || kf.battle !== 0) seen.add("sea_battle");
    if (jf.battle !== 0 && jf.order !== "board") {
      out.push(
        order(JPN_HUMAN, {
          kind: "imjin_fleet",
          fleet: jf.id,
          order: "board",
          tile: 0,
          formation: "wedge",
        }),
      );
    }
    if (kf.battle !== 0 && kf.order !== "keep_range") {
      out.push(
        order(HUMAN, {
          kind: "imjin_fleet",
          fleet: kf.id,
          order: "keep_range",
          tile: 0,
          formation: "crane",
        }),
      );
    }
  }
  // The land battles' and sieges' picks: storm a besieged fort, else charge;
  // the defence holds.
  if (t % 25 === 0) {
    for (const o of im.st.orders) {
      const siege = im.st.sieges.some((s) => s.region === o.region);
      if (siege) seen.add("siege_pick");
      seen.add("land_pick");
      const attack = ATTACK_ORDERS.indexOf(siege ? "storm" : "charge");
      out.push(
        order(JPN_HUMAN, {
          kind: "imjin_battle",
          region: o.region,
          attack: true,
          index: attack,
        }),
        order(HUMAN, {
          kind: "imjin_battle",
          region: o.region,
          attack: false,
          index: DEFENCE_STANCES.indexOf("hold"),
        }),
      );
    }
  }
  // The truce, then the investiture: Japan's seat answers both scenes.
  const pending = ww.politics.country(jpn)?.pending ?? [];
  for (const [scene, option] of [
    [JP_SCENE.mingReply, "a"],
    [JP_SCENE.investiture, "b"],
    [JP_SCENE.investitureRegents, "a"],
  ] as const) {
    const ev = pending.find((p) => p.eventId === scene);
    if (ev !== undefined && t % 25 === 0) {
      seen.add(scene);
      out.push(order(JPN_HUMAN, { kind: "event_choose", uid: ev.uid, option }));
    }
  }
  return out;
}

/** The hand: what the small map's orders cannot reach. */
function hand(r: GameRunner, seen: Set<string>): void {
  const g = r.game;
  const t = g.ticks();
  const ww = g.worldWar()!;
  const im = ww.imjinWar!;
  const jos = byTag(g, "JOS").smallID();
  const jpn = byTag(g, "JPN").smallID();
  if (t === WAR_TICK) {
    ww.setWar(jpn, jos, t);
    placeArmy(g, "JPN", JPN_PORT, 2);
    const jf = im.st.sea.fleets.find((f) => f.owner === jpn)!;
    const [x, y] = waterEast(r, jf.x, jf.y, 4);
    addFleet(im.st.sea, jos, x, y, [
      "panokseon",
      "panokseon",
      "turtle",
      "hyeopseon",
    ]);
  }
  const js = ww.japan!.state() as ImjinJapanState;
  if (t === TRUCE_TICK) {
    // Talks went through and the go-betweens softened the texts.
    js.phase = TRUCE_PHASE.replyAsked;
    js.phaseDay = ww.day(t);
    ww.politics.queueEvent(JP_SCENE.mingReply, jpn, jpn, 0, 0);
  }
  if (js.phase === TRUCE_PHASE.truce && !seen.has("truce")) {
    // The envoys are on their way: they arrive tomorrow.
    seen.add("truce");
    js.phaseDay = ww.day(t) + 1;
  }
}

async function play(): Promise<Played> {
  const r = await wwRunner(CONFIG, SEATS, "imjinmini");
  const seen = new Set<string>();
  const hashes: number[] = [];
  while (r.game.ticks() < LAST_TICK) {
    hand(r, seen);
    step(r, 1, orders(r, seen));
    if (r.game.ticks() % SYNC_TICKS === 0) hashes.push(gameHash(r));
  }
  return {
    hashes,
    seen,
    ending: r.game.worldWar()!.imjinWar!.endings.ending(),
    winner: r.game.getWinner(),
  };
}

describe("the Imjin War with two human seats", () => {
  test("the same orders give the same game, tick for tick", async () => {
    const a = await play();
    const b = await play();
    expect(b.hashes).toEqual(a.hashes);
    expect(b.ending).toEqual(a.ending);
    expect(a.hashes.length).toBe(Math.floor(LAST_TICK / SYNC_TICKS));
    // The script reached each step.
    for (const s of [
      "invasion",
      "sea_battle",
      "land_pick",
      "siege_pick",
      JP_SCENE.mingReply,
      "truce",
      JP_SCENE.investiture,
    ]) {
      expect(a.seen.has(s), s).toBe(true);
    }
    // The investiture peace ends the game by treaty.
    expect(a.ending).toMatchObject({
      ending: "investiture_peace",
      cause: "treaty",
    });
    expect(a.winner).toBe("investiture_peace");
  }, 240_000);
});
