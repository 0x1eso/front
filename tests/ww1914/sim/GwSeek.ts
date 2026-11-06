// Great War 1914 (design §5.6): is every locked option really open to a player
// who goes after it? The random bot of GwSim says how often; this bot says
// whether. For one option it calls the talks that write what the option asks
// for, walks them to that line, and plays the rest as it comes.
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type {
  GwCard,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwCond,
  GwEffect,
  GwReply,
  GwScene,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { proposalsFor } from "@openfront/engine/ww1914/Fronts";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { applyGwOrder, openTopics } from "@openfront/engine/ww1914/Orders";
import { ctxOf, optionOpen, sceneOf } from "@openfront/engine/ww1914/SceneRun";
import { newGame, startOf } from "./GwSim";

function condKeys(c: GwCond | undefined, out: Set<string>): void {
  if (c === undefined) return;
  if (c.kind === "memory") out.add(c.key);
  if (c.kind === "flag") out.add(c.flag);
  if (c.kind === "all" || c.kind === "any") {
    for (const x of c.of) condKeys(x, out);
  }
}

function writes(list: readonly GwEffect[] | undefined, keys: Set<string>) {
  return (list ?? []).some(
    (e) =>
      (e.kind === "remember" && keys.has(e.key)) ||
      (e.kind === "flag" && keys.has(e.flag)) ||
      (e.kind === "maybe" && writes(e.then, keys)) ||
      (e.kind === "roll" && writes(e.then, keys)),
  );
}

const replyWrites = (r: GwReply, keys: Set<string>) =>
  writes(r.effects, keys) ||
  writes(r.gain, keys) ||
  (r.reacts ?? []).some((x) => writes(x.effects, keys));

/** Steps from each node to a reply that writes one of `keys`. */
function distances(s: GwScene, keys: Set<string>): Record<string, number> {
  const nodes = s.nodes ?? {};
  const out: Record<string, number> = {};
  for (let grew = true; grew; ) {
    grew = false;
    for (const [id, n] of Object.entries(nodes)) {
      for (const r of n.replies) {
        let d = replyWrites(r, keys) ? 0 : Infinity;
        for (const next of [r.next, ...(r.reacts ?? []).map((x) => x.next)]) {
          if (next !== null && out[next] !== undefined) {
            d = Math.min(d, out[next] + 1);
          }
        }
        if (d < (out[id] ?? Infinity)) {
          out[id] = d;
          grew = true;
        }
      }
    }
  }
  return out;
}

function pickReply(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  scene: GwScene,
  keys: Set<string>,
  roll: (below: number) => number,
): GwReply {
  const ctx = ctxOf(gw, seat, card);
  const open = scene.nodes![card.node!].replies.filter((r) =>
    optionOpen(ctx, r),
  );
  const dist = distances(scene, keys);
  const score = (r: GwReply) => {
    if (replyWrites(r, keys)) return 0;
    const nexts = [r.next, ...(r.reacts ?? []).map((x) => x.next)];
    return Math.min(
      ...nexts.map((n) => (n === null ? 99 : (dist[n] ?? 50) + 1)),
    );
  };
  const best = Math.min(...open.map(score));
  const top = open.filter((r) => score(r) === best);
  return top[roll(top.length)];
}

function talk(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  keys: Set<string>,
  roll: (below: number) => number,
): void {
  const scene = sceneOf(card.scene)!;
  for (let g = 0; g < 60 && seat.desk.includes(card); g++) {
    const reply = pickReply(gw, seat, card, scene, keys, roll);
    applyGwOrder(gw, seat, { kind: "reply", card: card.uid, reply: reply.id });
  }
}

/** Topics that can write `keys`, or what those topics themselves wait on. */
function wanted(keys: Set<string>): Set<string> {
  const all = new Set(keys);
  for (let grew = true; grew; ) {
    grew = false;
    for (const s of gwContent().scenes) {
      if (s.kind !== "talk" || s.summon !== true) continue;
      if (
        !Object.values(s.nodes ?? {}).some((n) =>
          n.replies.some((r) => replyWrites(r, all)),
        )
      ) {
        continue;
      }
      const before = all.size;
      condKeys(s.when, all);
      if (all.size > before) grew = true;
    }
  }
  return all;
}

export interface GwSeekResult {
  scene: string;
  option: string;
  /** Games played until it stood open, or all of them. */
  games: number;
  /** Games the card came. */
  came: number;
  open: boolean;
}

/** One game after one option; true if the option stood open on its card. */
async function chase(
  map: MapFiles,
  gameID: string,
  target: GwScene,
  option: string,
): Promise<"open" | "shut" | "absent"> {
  const opt = target.options!.find((o) => o.id === option)!;
  const direct = new Set<string>();
  condKeys(opt.when, direct);
  const keys = wanted(direct);
  const runner = await newGame(map, startOf(gameID, "y1914", []));
  const gw = runner.game.greatWar()!;
  const seat = gw.s.seats[0];
  const seed = idHash(gameID);
  let n = 0;
  const roll = (below: number) => wwRoll(seed, 78, n++) % below;
  let saw: "shut" | "absent" = "absent";
  while (gw.s.ended === null) {
    const people = gwContent().people.filter((p) => p.tag === seat.tag);
    for (const p of people) {
      if (gw.person(p.id)?.status !== "active") continue;
      for (const topic of openTopics(gw, seat, p.id)) {
        if (seat.audiences <= 0) break;
        const s = sceneOf(topic)!;
        const useful = Object.values(s.nodes ?? {}).some((x) =>
          x.replies.some((r) => replyWrites(r, keys)),
        );
        if (!useful) continue;
        const before = seat.desk.length;
        if (applyGwOrder(gw, seat, { kind: "summon", person: p.id, topic })) {
          continue;
        }
        talk(gw, seat, seat.desk[before], keys, roll);
      }
    }
    for (let g = 0; g < 200 && seat.desk.length > 0; g++) {
      const card = seat.desk[0];
      const scene = sceneOf(card.scene)!;
      if (card.node !== null) {
        talk(gw, seat, card, keys, roll);
        continue;
      }
      if ((scene.options ?? []).length === 0) {
        applyGwOrder(gw, seat, { kind: "read", card: card.uid });
        continue;
      }
      const ctx = ctxOf(gw, seat, card);
      if (scene.id === target.id) {
        if (optionOpen(ctx, opt)) return "open";
        saw = "shut";
      }
      const open = scene.options!.filter(
        (o) => optionOpen(ctx, o) && !o.tell.includes("ends_game"),
      );
      const helps = open.filter((o) => writes(o.effects, keys));
      const from = helps.length > 0 ? helps : open;
      applyGwOrder(gw, seat, {
        kind: "choose",
        card: card.uid,
        option: from[roll(from.length)].id,
      });
    }
    if (gw.s.ended !== null) break;
    const paper = proposalsFor(gw, seat).find((p) => p.open);
    if (paper !== undefined) {
      applyGwOrder(gw, seat, {
        kind: "allocate",
        main: paper.main,
        posture: paper.posture,
        scale: paper.scale,
        allyShare: paper.allyShare,
        research: seat.alloc.research,
      });
    }
    seat.ready = true;
    advanceChapter(gw, runner.game.ticks(), false);
  }
  return saw;
}

/** Every option with a `when`, chased over at most `tries` games each. */
export async function seekOptions(
  map: MapFiles,
  tries: number,
  label = "seek",
): Promise<GwSeekResult[]> {
  const out: GwSeekResult[] = [];
  for (const s of gwContent().scenes) {
    for (const o of s.options ?? []) {
      if (o.when === undefined) continue;
      const r: GwSeekResult = {
        scene: s.id,
        option: o.id,
        games: 0,
        came: 0,
        open: false,
      };
      for (let i = 0; i < tries && !r.open; i++) {
        const got = await chase(map, `${label}-${s.id}-${o.id}-${i}`, s, o.id);
        r.games++;
        if (got !== "absent") r.came++;
        r.open = got === "open";
      }
      out.push(r);
    }
  }
  return out;
}
