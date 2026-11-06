import { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GwOrder,
  GwOrderBlock,
  GwOrderSchema,
} from "@openfront/engine-api/ww1914/GwOrders";
import { GW_READ_ONLY_KINDS } from "@openfront/engine-api/ww1914/SceneDsl";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { inStage, makeCard, placeCard, repeatable, sceneWear } from "./Desk";
import { proposalsFor } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { dismissPerson, dismissPrice } from "./People";
import {
  castOf,
  ctxOf,
  holds,
  needsDecision,
  optionOpen,
  removeCard,
  sceneOf,
  setOffice,
  takeOption,
} from "./SceneRun";
import { applyReply, summonScenes } from "./Talk";
import { seatPerson } from "./World";

/** Why this seat can't say ready; null when it can. */
export function readyBlock(seat: GwSeatState): GwOrderBlock | null {
  return seat.desk.some(needsDecision) ? "open_cards" : null;
}

/** Applies one order for `seat`; null when it took effect. */
export function applyGwOrder(
  gw: GreatWar,
  seat: GwSeatState,
  o: GwOrder,
): GwOrderBlock | null {
  if (gw.s.ended !== null) return "ended";
  switch (o.kind) {
    case "ready": {
      if (o.chapter !== gw.s.chapter) return "stale_chapter";
      if (o.on) {
        const block = readyBlock(seat);
        if (block !== null) return block;
      }
      seat.ready = o.on;
      return null;
    }
    case "read": {
      const card = seat.desk.find((c) => c.uid === o.card);
      const scene = card === undefined ? null : sceneOf(card.scene);
      if (scene === null) return "no_card";
      if (!GW_READ_ONLY_KINDS.includes(scene.kind)) return "wrong_kind";
      removeCard(seat, o.card);
      return null;
    }
    case "choose": {
      const card = seat.desk.find((c) => c.uid === o.card);
      const scene = card === undefined ? null : sceneOf(card.scene);
      if (card === undefined || scene === null) return "no_card";
      const opt = scene.options?.find((x) => x.id === o.option);
      if (opt === undefined) return "no_option";
      const ctx = ctxOf(gw, seat, card);
      if (!optionOpen(ctx, opt)) return "closed";
      removeCard(seat, card.uid);
      takeOption(ctx, scene, opt, false);
      return null;
    }
    case "reply": {
      const card = seat.desk.find((c) => c.uid === o.card);
      const scene = card === undefined ? null : sceneOf(card.scene);
      if (card === undefined || scene === null) return "no_card";
      if (scene.kind !== "talk" || card.node === null) return "wrong_kind";
      const reply = scene.nodes?.[card.node].replies.find(
        (r) => r.id === o.reply,
      );
      if (reply === undefined) return "no_option";
      const ctx = ctxOf(gw, seat, card);
      if (!optionOpen(ctx, reply)) return "closed";
      applyReply(gw, seat, card, scene, reply);
      return null;
    }
    case "summon": {
      if (seat.audiences <= 0) return "no_audience";
      const scene = sceneOf(o.topic);
      if (scene?.kind !== "talk" || scene.summon !== true) return "no_topic";
      if (!summonable(gw, seat, o.person, o.topic)) return "no_topic";
      const card = makeCard(gw, seat, scene, "summon");
      if (card === null) return "no_topic";
      seat.audiences--;
      placeCard(gw, seat, card);
      return null;
    }
    case "dismiss": {
      const p = gw.person(o.person);
      if (!ownPerson(seat, o.person) || p === null) return "no_person";
      if (p.office === null || p.status !== "active") return "no_person";
      const n = gw.nation(seat.tag);
      if (n === null || n.authority < dismissPrice(p.id)) return "no_authority";
      dismissPerson(gw, seat, p);
      return null;
    }
    case "appoint": {
      const p = gw.person(o.person);
      if (!ownPerson(seat, o.person) || p === null) return "no_person";
      if (p.status !== "active") return "no_person";
      setOffice({ gw, seat, cast: {} }, p, o.office);
      return null;
    }
    case "allocate": {
      if (seat.signed === gw.s.chapter) return "signed";
      const paper = proposalsFor(gw, seat).find(
        (p) =>
          p.main === o.main &&
          p.posture === o.posture &&
          p.scale === o.scale &&
          p.allyShare === o.allyShare,
      );
      if (paper === undefined) return "not_proposed";
      if (!paper.open) return "closed";
      seat.signed = gw.s.chapter;
      seat.alloc = {
        main: o.main,
        posture: o.posture,
        scale: o.scale,
        allyShare: o.allyShare,
        research: o.research,
      };
      return null;
    }
  }
}

/**
 * The topics `person` can be called on now, for the people screen: fresh ones
 * before those of the last games, those before what was talked through here,
 * the weightiest first in each.
 */
export function openTopics(
  gw: GreatWar,
  seat: GwSeatState,
  person: string,
): string[] {
  return summonScenes()
    .filter((x) => summonable(gw, seat, person, x.id))
    .map((x, i) => ({ x, i }))
    .sort(
      (a, b) =>
        sceneWear(gw, seat, a.x) - sceneWear(gw, seat, b.x) ||
        b.x.salience - a.x.salience ||
        a.i - b.i,
    )
    .map(({ x }) => x.id);
}

function ownPerson(seat: GwSeatState, id: string): boolean {
  if (id === seatPerson(seat)) return false;
  return gwContent().people.some((d) => d.id === id && d.tag === seat.tag);
}

/** Whether `person` can be called on `topic` now. */
export function summonable(
  gw: GreatWar,
  seat: GwSeatState,
  person: string,
  topic: string,
): boolean {
  const scene = sceneOf(topic);
  if (scene === null || scene.who === undefined) return false;
  if (!scene.nation.includes(seat.tag)) return false;
  if (seat.desk.some((c) => c.scene === topic)) return false;
  if (!inStage(gw, scene) || !repeatable(gw, seat, scene)) return false;
  const cast = castOf(gw, seat, scene);
  if (cast === null || cast[scene.who] !== person) return false;
  return scene.when === undefined || holds({ gw, seat, cast }, scene.when);
}

export class GwOrderExecution implements Execution {
  constructor(
    private player: Player,
    private order: GwOrder,
  ) {}

  init(mg: Game, _ticks: number): void {
    const gw = mg.greatWar();
    const seat = gw?.seatOf(this.player.smallID()) ?? null;
    if (gw === null || seat === null) return;
    applyGwOrder(gw, seat, this.order);
    gw.touch();
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return GwOrderExecutionSnapshot.write({
      player: w.player(this.player),
      order: JSON.stringify(this.order),
    });
  }

  restoreSnapshot(s: GwOrderState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.order = GwOrderSchema.parse(JSON.parse(s.order));
  }
}

const GwOrderStateSchema = z.object({
  player: zPlayerRef(),
  order: z.string(),
});
type GwOrderState = z.infer<typeof GwOrderStateSchema>;

export const GwOrderExecutionSnapshot = execSnapshotType({
  name: "GwOrder",
  version: 1,
  schema: GwOrderStateSchema,
  cls: () => GwOrderExecution,
});
