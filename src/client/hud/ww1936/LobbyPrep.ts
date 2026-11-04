// World War 1936 lobby preparation (logic): the picked country's start
// templates, the lobby adapter the designers read instead of a live game,
// the "with this template: N start divisions" preview, and the sender that
// applies the edited templates in the preparation minute.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  EquipmentType,
  WW_MEN_PER_INF_EQUIPMENT,
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  GROUND_SLOTS,
  NEED_GROUPS,
  SupportId,
  TemplateData,
  TemplateDef,
  WW_MAX_TEMPLATES,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  isMajor,
  startArmy,
  startStock,
  startTechs,
} from "@openfront/engine-lib/ww1936/EconomyStart";
import {
  landStartTechs,
  START_OOB,
  StartTemplate,
  startTemplates,
} from "@openfront/engine-lib/ww1936/LandStart";
import {
  groupStockOf,
  previewReforms,
  ReformEdit,
  StartKind,
} from "@openfront/engine-lib/ww1936/StartReform";
import { DESIGN_ONLY_GROUP } from "@openfront/engine-lib/ww1936/TemplatePresets";
import {
  genMixOf,
  templateBlock,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import {
  isNewTemplateKey,
  markPrepSent,
  prepArmiesOf,
  prepPlanOf,
  prepSentFor,
  PrepTemplate,
} from "../../components/ww1936/PrepPlan";
import { translateText } from "../../Utils";
import type { GameView } from "../../view/GameView";
import { LibEntry, templateKey } from "./DesignLibrary";
import { blockText } from "./EconomyModel";
import { designGroupsOf, researchedOf } from "./LandModel";
import { hasStartOob, oobModel, oobOrderOf, PrepOobModel } from "./PrepOob";
import { prepSecondsLeft } from "./WorldWarModel";

/** The lobby's single player slot id in the adapter. */
export const LOBBY_ME = 1;
/** The transient template id a library division is edited under. */
export const LIB_DRAFT_ID = 99;

/** The country's start templates as the lobby lists them. */
export function lobbyStartTemplates(tag: CountryTag): StartTemplate[] {
  // A major's templates do not depend on development. A minor's do, and its
  // development comes from scenario data the lobby does not have: it gets
  // its main template only (which exists at every development).
  return isMajor(tag)
    ? startTemplates(tag, 5)
    : startTemplates(tag, 2).slice(0, 1);
}

/**
 * The divisions an army template can use in the lobby: the country's start
 * templates as the plan leaves them (one that cannot be applied is skipped
 * at the start, so it is not offered), then the library's division entries,
 * each content once.
 */
export function lobbyArmyChoices(
  tag: CountryTag,
  plan: readonly PrepTemplate[],
  library: readonly LibEntry[],
): TemplateData[] {
  const researched = lobbyResearched(tag);
  const out: TemplateData[] = [];
  const seen = new Set<string>();
  const push = (def: TemplateDef) => {
    const key = templateKey(def.battalions, def.support);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: out.length + 1,
      key: "",
      name: def.name,
      battalions: [...def.battalions],
      support: [...def.support],
      inUse: 0,
    });
  };
  for (const st of lobbyStartTemplates(tag)) {
    const p = plan.find((x) => x.key === st.key);
    if (p === undefined) {
      push({ ...st.def, name: translateText(`ww1936.tpl.${st.key}`) });
    } else {
      const def: TemplateDef = {
        name: p.name,
        battalions: p.battalions as BattalionId[],
        support: p.support as SupportId[],
      };
      if (planProblem(def, researched, new Set()) === null) push(def);
    }
  }
  for (const e of library) {
    if (e.type === "template") {
      push({
        name: e.name,
        battalions: e.battalions as BattalionId[],
        support: e.support as SupportId[],
      });
    }
  }
  return out;
}

/** What the country has researched at the start, as far as the lobby knows. */
export function lobbyResearched(tag: CountryTag): Set<WwTechId> {
  return new Set<WwTechId>([
    ...startTechs(tag, 0),
    ...landStartTechs(tag, isMajor(tag), 0),
  ]);
}

/** Why a template cannot be applied at the start, or null. */
export function planProblem(
  def: TemplateDef,
  researched: ReadonlySet<WwTechId>,
  designGroups: ReadonlySet<number>,
): string | null {
  const b = templateBlock(def, researched, Infinity);
  if (b !== null) return blockText(b);
  for (const id of def.battalions) {
    const g = DESIGN_ONLY_GROUP[id];
    if (g !== undefined && !designGroups.has(g)) {
      return translateText("ww1936.land.needs_design", {
        battalion: translateText(`ww1936.battalion.${id}`),
      });
    }
  }
  return null;
}

export interface StartPreview {
  /** Start divisions with this template. */
  count: number;
  /** The 1936 count of the original template. */
  original: number;
  /** The equipment that cut the count (a shortage in the stock), or null. */
  limitedBy: EquipmentType | null;
}

export function statsOf(def: TemplateDef, researched: ReadonlySet<WwTechId>) {
  return templateStats(
    def,
    techTotals(researched),
    genMixOf(new Array<number>(GROUND_SLOTS).fill(0)),
  );
}

/**
 * The need groups' stock of a country at the start: startStock and the
 * army's rifles. It is also what the start's divisions hold plus what is
 * left, which is what a re-form gets to draw from.
 */
export function startGroupStock(tag: CountryTag): number[] {
  const army = startArmy(tag, 0);
  const stock = startStock(tag, army, 0, 0);
  stock[equipKey("infantry_equipment", 1)] += Math.ceil(
    army / WW_MEN_PER_INF_EQUIPMENT,
  );
  return groupStockOf(stock);
}

/**
 * The start divisions each edited template of a major would make, by the
 * engine's own pure rule: the start's stock (startStock and the army's
 * rifles), the 1936 order of battle fielded in order with the shortages it
 * brings, then each edit in the plan's order (the order the sender uses)
 * giving back what its divisions hold and drawing it again. Men are not
 * modelled (the pool is far larger than the army). Exact for one edited
 * template, in step with the engine for several. Empty for a minor: its
 * 1936 count comes from scenario data the lobby has not got.
 */
export function startPreviews(
  tag: CountryTag,
  plan: readonly PrepTemplate[],
): Map<string, StartPreview> {
  const out = new Map<string, StartPreview>();
  const oob = START_OOB[tag];
  if (oob === undefined) return out;
  const researched = lobbyResearched(tag);
  const originals = new Map(
    lobbyStartTemplates(tag).map((t) => [t.key, t.def]),
  );
  const counts = new Map<string, number>();
  const field: StartKind[] = [];
  const need = new Map<string, readonly number[]>();
  for (const { divisions } of oob) {
    for (const [key, n] of divisions) {
      const def = originals.get(key);
      if (def === undefined) continue;
      if (!need.has(key)) need.set(key, statsOf(def, researched).need);
      counts.set(key, (counts.get(key) ?? 0) + n);
      for (let i = 0; i < n; i++) field.push({ key, need: need.get(key)! });
    }
  }
  const edits: ReformEdit[] = [];
  const keys: string[] = [];
  for (const p of plan) {
    const def = originals.get(p.key);
    const n = counts.get(p.key);
    if (def === undefined || n === undefined) continue;
    const old = statsOf(def, researched);
    const now = statsOf(
      {
        name: p.name,
        battalions: p.battalions as BattalionId[],
        support: p.support as SupportId[],
      },
      researched,
    );
    if (old.men <= 0 || now.men <= 0) continue;
    keys.push(p.key);
    edits.push({
      key: p.key,
      need: now.need,
      men: now.men,
      originalCount: n,
      budget: n * old.men,
    });
  }
  const res = previewReforms(startGroupStock(tag), field, edits);
  res.forEach((r, i) => {
    const group = r.limitedBy < 0 ? null : NEED_GROUPS[r.limitedBy];
    out.set(keys[i], {
      count: r.count,
      original: edits[i].originalCount,
      limitedBy:
        group === null || group === undefined ? null : (group as EquipmentType),
    });
  });
  return out;
}

export type LobbyMode = "start" | "library";

export interface LobbyAdapterOptions {
  mode: LobbyMode;
  /** The edits of the start templates (start mode). */
  plan?: readonly PrepTemplate[];
  /** The library division being edited, under LIB_DRAFT_ID (library mode). */
  draft?: TemplateDef | null;
}

/**
 * A small stand-in for the live game the designers read: one player, the
 * start research of the country (every technology in library mode, which is
 * a draft), no designs, no politics (so no country modifiers).
 */
export function lobbyGame(
  tag: CountryTag,
  opts: LobbyAdapterOptions,
): GameView {
  const researched =
    opts.mode === "library"
      ? ([...WW_TECH_IDS] as WwTechId[])
      : [...lobbyResearched(tag)];
  const templates: TemplateData[] = [];
  if (opts.mode === "start") {
    lobbyStartTemplates(tag).forEach((st, i) => {
      const p = opts.plan?.find((x) => x.key === st.key);
      templates.push(
        p === undefined
          ? {
              id: i + 1,
              key: st.key,
              name: "",
              battalions: [...st.def.battalions],
              support: [...st.def.support],
              inUse: 0,
            }
          : {
              id: i + 1,
              key: "",
              name: p.name,
              battalions: [...p.battalions] as BattalionId[],
              support: [...p.support] as SupportId[],
              inUse: 0,
            },
      );
    });
    // Templates the plan made (a major's), after the start templates.
    let next = templates.length + 1;
    for (const p of opts.plan ?? []) {
      if (!isNewTemplateKey(p.key) || templates.length >= WW_MAX_TEMPLATES) {
        continue;
      }
      templates.push({
        id: next++,
        key: "",
        name: p.name,
        battalions: [...p.battalions] as BattalionId[],
        support: [...p.support] as SupportId[],
        inUse: 0,
      });
    }
  } else if (opts.draft) {
    templates.push({
      id: LIB_DRAFT_ID,
      key: "",
      name: opts.draft.name,
      battalions: [...opts.draft.battalions],
      support: [...opts.draft.support],
      inUse: 0,
    });
  }
  const econ = {
    version: 1,
    detail: () => ({ researched, lines: [], stock: [] }),
  };
  const depth = {
    version: 1,
    treatyData: { members: [] as number[], escalated: false, endDay: 0 },
    marketData: { pendingLicences: [] as { from: number; to: number }[] },
    detail: () => ({ designs: [], projects: { done: 0 } }),
  };
  const land = { version: 1, details: new Map([[LOBBY_ME, { templates }]]) };
  const game = {
    myPlayer: () => ({
      smallID: () => LOBBY_ME,
      isAlive: () => true,
      countryTag: () => tag,
    }),
    wwEconomy: () => econ,
    wwDepth: () => depth,
    wwPolitics: () => ({ detail: () => null }),
    wwLand: () => land,
    worldWarScenario: () => null,
  };
  return game as unknown as GameView;
}

// ---- applying the plan at the start of the preparation minute ----

/** The sender acts only in the first seconds of a game (a resumed one is past it). */
export const START_WINDOW_TICKS = 100;
/** Ticks a sent start_oob has to show as applied before it counts as refused. */
export const OOB_CONFIRM_TICKS = 50;

type StartGame = Pick<
  GameView,
  | "myPlayer"
  | "wwEconomy"
  | "wwDepth"
  | "wwLand"
  | "worldWarScenario"
  | "worldWarData"
  | "ticks"
  | "gameID"
  | "isCatchingUp"
  | "config"
>;

/**
 * Sends one `template_save` per edited start template of the country actually
 * played, once, in the preparation minute. It runs before the library's
 * auto-creator: a start template holds only parts of the 1936 research (no
 * design-only battalion), so it needs no design, and the re-forming should
 * see the stock before anything else of the minute touches it.
 *
 * Not on a replay (the recorded intents carry the orders), not while the
 * client catches up or past the first seconds (a resumed game), not twice (a
 * game marker in storage covers a reload), and a template that already holds
 * the plan's contents is left alone.
 */
export class StartPrep {
  private done = false;
  /** A sent start_oob not yet seen applied: the notice waits for the game's answer. */
  private pending: { summary: string; at: number } | null = null;

  constructor(
    private readonly send: (o: WwOrder) => void,
    private readonly notice: (text: string) => void,
  ) {}

  private sendOob(
    gameID: string,
    m: PrepOobModel | null,
    gameKeys: ReadonlySet<string>,
    ticks: number,
  ): number {
    if (m === null) return 0;
    for (const t of m.templates) {
      if (t.problem !== null && t.edited) {
        this.notice(
          translateText("ww1936.prep.skipped", {
            name: t.def.name,
            reason: t.problem,
          }),
        );
      }
    }
    const o = oobOrderOf(m, gameKeys);
    if (typeof o === "string") {
      this.notice(translateText("ww1936.prep.oob_blocked", { reason: o }));
      return 0;
    }
    this.send(o.order);
    markPrepSent(gameID);
    // The game may refuse the order; the success text waits until it shows.
    this.pending = { summary: o.summary, at: ticks };
    return 1;
  }

  /** The start_oob took (the game says so), or after a while: it was refused. */
  private confirm(game: StartGame): void {
    const p = this.pending;
    const id = game.myPlayer?.()?.smallID();
    if (p === null || id === undefined) return;
    if (game.wwLand?.()?.details.get(id)?.startOob === true) {
      this.pending = null;
      this.notice(p.summary);
    } else if (game.ticks() - p.at >= OOB_CONFIRM_TICKS) {
      this.pending = null;
      this.notice(translateText("ww1936.prep.oob_refused"));
    }
  }

  /** Called every tick; returns the number of orders it sent. */
  tick(game: StartGame | null): number {
    if (this.pending !== null && game) this.confirm(game);
    if (this.done || game === null || game === undefined) return 0;
    const scenario = game.worldWarScenario?.();
    if (scenario === null || scenario === undefined) return 0;
    const me = game.myPlayer?.();
    if (!me || !me.isAlive()) return 0;
    if (game.config().isReplay() || game.isCatchingUp()) return 0;
    if (
      game.ticks() > START_WINDOW_TICKS ||
      prepSecondsLeft(game as never) <= 0
    ) {
      this.done = true;
      return 0;
    }
    const tag = me.countryTag();
    const economy = game.wwEconomy?.();
    const land = game.wwLand?.()?.details.get(me.smallID());
    // Wait for the first economy and land updates: an empty research set
    // would make every template look invalid.
    if (
      tag === null ||
      !economy?.detail(me.smallID()) ||
      !land ||
      land.templates.length === 0
    ) {
      return 0;
    }
    this.done = true;
    const gameID = String(game.gameID());
    if (prepSentFor() === gameID) return 0;
    const plan = prepPlanOf(tag);
    const armies = prepArmiesOf(tag);
    const researched = researchedOf(economy, me.smallID());
    const groups = designGroupsOf(
      game.wwDepth?.()?.detail(me.smallID())?.designs,
    );
    // A major plans its whole start army: one start_oob replaces the per-template saves.
    if (hasStartOob(tag)) {
      if (plan.length === 0 && armies === null) return 0;
      return this.sendOob(
        gameID,
        oobModel(tag, plan, armies, researched, groups),
        new Set(land.templates.map((x) => x.key).filter((k) => k !== "")),
        game.ticks(),
      );
    }
    if (plan.length === 0) return 0;
    let sent = 0;
    for (const p of plan) {
      const t = land.templates.find((x) => x.key === p.key);
      if (t === undefined) continue;
      const def: TemplateDef = {
        name: p.name,
        battalions: p.battalions as BattalionId[],
        support: p.support as SupportId[],
      };
      if (
        t.battalions.join() === def.battalions.join() &&
        [...t.support].join() === def.support.join()
      ) {
        continue;
      }
      const why = planProblem(def, researched, groups);
      if (why !== null || p.name.trim() === "") {
        this.notice(
          translateText("ww1936.prep.skipped", {
            name: p.name,
            reason: why ?? "",
          }),
        );
        continue;
      }
      this.send({
        kind: "template_save",
        template: t.id,
        base: 0,
        name: p.name,
        battalions: [...def.battalions],
        support: [...def.support],
      } as WwOrder);
      sent++;
    }
    if (sent > 0) {
      markPrepSent(gameID);
      this.notice(translateText("ww1936.prep.applied", { n: sent }));
    }
    return sent;
  }
}
