import { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GwOrder,
  GwOrderBlock,
  GwOrderSchema,
} from "@openfront/engine-api/ww1914/GwOrders";
import { GW_READ_ONLY_KINDS } from "@openfront/engine-api/ww1914/SceneDsl";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_PREMIER_PICKS } from "@openfront/engine-lib/ww1914/StoryRows";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { takeAct } from "./Acts";
import { declareAim } from "./Aims";
import {
  askFirst,
  isPrivateTalk,
  paySummon,
  spentTalk,
  summonPrice,
} from "./AskFirst";
import { budgetOrder } from "./Budget";
import { setClaims } from "./Claims";
import { fieldOrder, raiseFooting } from "./Craft";
import {
  answerPaper,
  briefDept,
  callHead,
  deptChosen,
  deptRead,
  deptSentBack,
  giveGift,
  giveTask,
  isPetitioner,
  paperReadable,
  passOn,
  petitionerSeen,
  pushTask,
  replyQuestion,
  roomShut,
  shelvePaper,
  turnAway,
} from "./Departments";
import { inStage, makeCard, placeCard, repeatable, sceneWear } from "./Desk";
import { proposalsFor } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { answerPetition, holdHonours } from "./Honours";
import { lawOrder } from "./Laws";
import { GW_OFFENSIVE_PAPERS, signOffensivePaper } from "./Offensives";
import {
  candidatesFor,
  dismissedFrom,
  dismissPerson,
  dismissPrice,
  pressPremier,
} from "./People";
import { grainLocked, grainTaken } from "./Persona";
import { postGeneral } from "./Post";
import { takePower } from "./Powers";
import { pressCensor, pressInvite, pressLeak } from "./Press";
import { prologueRefuses } from "./Prologue";
import {
  castOf,
  ctxOf,
  needsDecision,
  optionOpen,
  removeCard,
  sceneHolds,
  sceneOf,
  setOffice,
  takeOption,
} from "./SceneRun";
import { answerSlow, askSlow, closeByHost, noteActed } from "./Seats";
import { sendBack } from "./SendBack";
import { serviceOrder } from "./Spies";
import { inOpening, newcomers } from "./Story";
import { tableClaim, tableNext, tablePass, tableWord } from "./Table";
import { applyReply, summonScenes } from "./Talk";
import { sendTelegram } from "./Telegrams";
import { offerTerms } from "./Terms";
import { answerTreaty, breakOrder, offerTreaty } from "./Treaties";
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
  if (prologueRefuses(gw, o.kind)) return "prologue";
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
      if (card !== undefined && !paperReadable(card)) return "wrong_kind";
      removeCard(seat, o.card);
      if (card !== undefined) deptRead(gw, seat, card);
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
      if (grainLocked(gw, seat, card, scene, opt)) return "closed";
      removeCard(seat, card.uid);
      takeOption(ctx, scene, opt, false);
      grainTaken(gw, seat, card, scene, opt);
      deptChosen(gw, seat, card, opt.id);
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
      const scene = sceneOf(o.topic);
      const price = summonPrice(seat, scene, o.topic);
      if (price !== null) return price;
      if (scene?.kind !== "talk" || scene.summon !== true) return "no_topic";
      if (!summonable(gw, seat, o.person, o.topic)) return "no_topic";
      // ww193: on a trip the room is shut; private meetings go on.
      if (!isPrivateTalk(scene) && roomShut(gw, seat)) return "room_shut";
      const card = makeCard(gw, seat, scene, "summon");
      if (card === null) return "no_topic";
      paySummon(seat, scene, o.topic);
      placeCard(gw, seat, card);
      if (isPetitioner(seat, o.person)) petitionerSeen(seat, o.person);
      return null;
    }
    case "dismiss": {
      const p = gw.person(o.person);
      if (!ownPerson(seat, o.person) || p === null) return "no_person";
      if (p.office === null || p.status !== "active") return "no_person";
      // A premier falls in the house, not by the President's hand.
      const picks = GW_PREMIER_PICKS[seat.tag] !== undefined;
      if (picks && p.office === "chancellor") return "premier_house";
      const n = gw.nation(seat.tag);
      if (n === null || n.authority < dismissPrice(p.id)) return "no_authority";
      dismissPerson(gw, seat, p);
      pressPremier(gw, seat, p.id);
      return null;
    }
    case "appoint": {
      const p = gw.person(o.person);
      if (!ownPerson(seat, o.person) || p === null) return "no_person";
      // One whose day hasn't come only when the vacancy box offers him.
      const early =
        p.status === "waiting" &&
        candidatesFor(gw, seat, o.office).includes(p.id);
      if (p.status !== "active" && !early) return "no_person";
      // The premier is called at the consultations, never named from the list.
      const picks = GW_PREMIER_PICKS[seat.tag] !== undefined;
      if (picks && o.office === "chancellor") return "premier_house";
      if (dismissedFrom(seat, p.id, o.office)) return "no_person";
      setOffice({ gw, seat, cast: {} }, p, o.office);
      if (o.office !== "chancellor") pressPremier(gw, seat, p.id);
      return null;
    }
    case "allocate": {
      if (seat.signed === gw.s.chapter) return "signed";
      // The great offensive's papers answer by their id (ww173).
      const paper = proposalsFor(gw, seat).find((p) =>
        o.paper !== undefined && GW_OFFENSIVE_PAPERS.includes(o.paper)
          ? p.id === o.paper && p.main === o.main
          : !GW_OFFENSIVE_PAPERS.includes(p.id) &&
            p.main === o.main &&
            p.posture === o.posture &&
            p.scale === o.scale &&
            p.allyShare === o.allyShare,
      );
      if (paper === undefined) return "not_proposed";
      if (!paper.open) return "closed";
      const pick = {
        method: o.method,
        months: o.months,
        feint: o.feint,
        quiet: o.quiet,
      };
      // Only the great offensive's own papers go through its file: a plain
      // plan of the chief's has no offensive behind it (ww187 merge fix).
      if (GW_OFFENSIVE_PAPERS.includes(paper.id)) {
        const no = signOffensivePaper(
          gw,
          seat,
          paper.id,
          paper.main,
          pick,
          true,
        );
        if (no !== null) return no;
        signOffensivePaper(gw, seat, paper.id, paper.main, pick);
      }
      seat.signed = gw.s.chapter;
      seat.alloc = {
        main: paper.main,
        posture: paper.posture,
        scale: paper.scale,
        allyShare: paper.allyShare,
        research: o.research,
      };
      return null;
    }
    case "budget":
      return budgetOrder(gw, seat, { shares: o.shares, mix: o.mix }, o.force);
    case "law":
      return lawOrder(gw, seat, o.law, o.act, o.sponsor ?? null);
    case "press_censor":
      return pressCensor(gw, seat, o.up);
    case "press_invite":
      return pressInvite(gw, seat, o.paper);
    case "press_leak":
      if (!ownPerson(seat, o.person)) return "no_person";
      return pressLeak(gw, seat, o.person);
    case "act":
      return takeAct(gw, seat, o.act, o.picks);
    case "send_back": {
      const card = seat.desk.find((c) => c.uid === o.card);
      const no = sendBack(gw, seat, o.card, o.direction);
      if (no === null && card !== undefined) deptSentBack(gw, seat, card);
      return no;
    }
    case "aim":
      return declareAim(gw, seat, o.aim);
    case "claims":
      return setClaims(gw, seat, o.places);
    case "table_claim":
      return tableClaim(gw, seat, o.place);
    case "table_pass":
      return tablePass(gw, seat);
    case "table_word":
      return tableWord(gw, seat, o.claim, o.word, o.trade);
    case "table_next":
      return tableNext(gw);
    case "terms":
      return offerTerms(gw, seat, o.tag, o.give, o.ask);
    case "post":
      return postGeneral(gw, seat, o.person, o.theatre);
    case "field":
      return fieldOrder(gw, seat, o.invention);
    case "footing":
      return raiseFooting(gw, seat);
    case "slow":
      return askSlow(gw, seat);
    case "slow_answer":
      return answerSlow(gw, seat, o.grant);
    case "telegram":
      return sendTelegram(gw, seat, o.to, o.cipher, o.text);
    case "treaty_offer":
      return offerTreaty(gw, seat, o.to, o.clauses);
    case "treaty_answer":
      return answerTreaty(gw, seat, o.treaty, o.sign);
    case "treaty_break":
      return breakOrder(gw, seat, o.treaty);
    case "close_chapter":
      return closeByHost(gw, seat, o.chapter);
    case "power":
      return takePower(gw, seat, o);
    case "ask":
      return askFirst(gw, seat, o.card, o.topic);
    case "front_tempo":
      // A standing word, not a paper: it holds until changed (ww173 §5).
      if (o.tempo === null) delete seat.tempo;
      else seat.tempo = o.tempo;
      return null;
    case "service":
      // ww180: a standing word on the service's money and men.
      return serviceOrder(gw, seat, o.branch, o.share);
    case "task":
      return giveTask(gw, seat, o.office, o.row, o.topic);
    case "brief":
      return briefDept();
    case "pass_on":
      return passOn(gw, seat, o.card, o.office);
    case "shelve":
      return shelvePaper(gw, seat, o.card);
    case "gift":
      return giveGift();
    case "turn_away":
      return turnAway(gw, seat, o.person);
    case "task_push":
      return pushTask(gw, seat, o.office, o.how, o.person);
    case "answer":
      return answerPaper(gw, seat, o.card, o.course, o.redo);
    case "dept_reply":
      return replyQuestion(gw, seat, o.card, o.pick);
    case "call":
      return callHead(gw, seat, o.card);
    case "honours":
      return holdHonours(gw, seat, o.card, o.give);
    case "petition_answer":
      return answerPetition(gw, seat, o.card, o.answer);
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
  own = false,
): string[] {
  return summonScenes()
    .filter((x) => isPrivateTalk(x) === own)
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
  if (inOpening(gw, seat) && newcomers(gw, seat, [person]).length > 0) {
    return false;
  }
  if (seat.desk.some((c) => c.scene === topic)) return false;
  if (!inStage(gw, scene) || !repeatable(gw, seat, scene)) return false;
  if (spentTalk(gw, seat, scene)) return false;
  const cast = castOf(gw, seat, scene);
  if (cast === null || cast[scene.who] !== person) return false;
  return sceneHolds({ gw, seat, cast }, scene);
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
    noteActed(gw, seat);
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
