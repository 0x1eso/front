// World War 1936: what a library entry can do in the game right now, and the
// auto-creator that sends the ready ones. The checks are the designers' own
// engine-lib functions (designBlock through DesignerModel.checkNew,
// templateBlock), so an entry the engine would refuse is
// shown with the reason and never sent.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  DesignDef,
  DesignDefSchema,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BATTALION_IDS,
  BattalionId,
  SUPPORT_IDS,
  SupportId,
  TemplateDef,
  WW_MAX_ARMY_DIVISIONS,
  WW_MAX_BATTALIONS,
  WW_MAX_SUPPORT,
  WW_MAX_TEMPLATES,
  WW_TEMPLATE_NAME_MAX,
} from "@openfront/engine-api/ww1936/LandTypes";
import { BATTALIONS, SUPPORTS } from "@openfront/engine-lib/ww1936/Battalions";
import { DESIGN_ONLY_GROUP } from "@openfront/engine-lib/ww1936/TemplatePresets";
import { templateBlock } from "@openfront/engine-lib/ww1936/TemplateStats";
import { translateText } from "../../Utils";
import type { GameView } from "../../view/GameView";
import { DesignerGame, DesignerModel } from "./DesignerModel";
import {
  cellOf,
  contentKey,
  LibEntry,
  LibraryStore,
  templateKey,
} from "./DesignLibrary";
import { designDisplayName } from "./DesignName";
import { blockText } from "./EconomyModel";
import { designGroupsOf, researchedOf } from "./LandModel";

export type EntryState = "ready" | "have" | "blocked" | "stale";

export interface EntryStatus {
  state: EntryState;
  /** Plain text for the card: the missing tech, the XP, or why it is unusable. */
  reason: string;
  /** The normal order the load button sends; only when ready. */
  order: WwOrder | null;
}

type StatusGame = DesignerGame & Pick<GameView, "worldWarScenario">;

const stale = (): EntryStatus => ({
  state: "stale",
  reason: translateText("ww1936.library.stale"),
  order: null,
});

function needsText(
  techs: readonly WwTechId[],
  projects: readonly string[],
): string {
  const names = [
    ...techs.map((t) => translateText(`ww1936.tech.${t}`)),
    ...projects.map((p) => translateText(`ww1936.project.${p}`)),
  ];
  return translateText("ww1936.library.needs", { list: names.join(", ") });
}

/** The designs and templates the game already has, as content keys (obsolete designs count). */
export function existingKeys(game: StatusGame): Set<string> {
  const out = new Set<string>();
  const me = game.myPlayer()?.smallID() ?? 0;
  const designs = game.wwDepth?.()?.detail(me)?.designs ?? [];
  for (const d of designs) {
    out.add(
      contentKey({
        type: "design",
        def: { ...d.def, modules: [...d.def.modules] },
      }),
    );
  }
  const land = (
    game.wwLand?.() as { details?: Map<number, unknown> } | null
  )?.details?.get(me) as
    | { templates?: { battalions: string[]; support: string[] }[] }
    | undefined;
  for (const t of land?.templates ?? []) {
    out.add(templateKey(t.battalions, t.support));
  }
  return out;
}

/** My own tank or plane design already sits in `cell` (DesignLibrary.cellOf). */
export function cellTaken(game: StatusGame, cell: string): boolean {
  const me = game.myPlayer()?.smallID() ?? 0;
  const designs = game.wwDepth?.()?.detail(me)?.designs ?? [];
  return designs.some(
    (d) =>
      d.kind !== "ship" &&
      d.origin === "own" &&
      cellOf({ type: "design", def: d.def }) === cell,
  );
}

/** What `e` can do now. Never throws: a broken entry is "stale". */
export function entryStatus(
  e: LibEntry,
  game: StatusGame,
  have: ReadonlySet<string> = existingKeys(game),
): EntryStatus {
  try {
    // An army template is used from the army panel, not loaded here.
    if (e.type === "army") return armyCardStatus(e);
    return e.type === "design"
      ? designStatus(e, game, have)
      : templateStatus(e, game, have);
  } catch {
    return stale();
  }
}

function armyCardStatus(e: Extract<LibEntry, { type: "army" }>): EntryStatus {
  let n = 0;
  for (const i of e.items) n += i.count;
  return {
    state: "have",
    reason: translateText("ww1936.army_tpl.total", {
      n,
      max: WW_MAX_ARMY_DIVISIONS,
    }),
    order: null,
  };
}

const HAVE = (): EntryStatus => ({
  state: "have",
  reason: translateText("ww1936.library.have"),
  order: null,
});

function designStatus(
  e: Extract<LibEntry, { type: "design" }>,
  game: StatusGame,
  have: ReadonlySet<string>,
): EntryStatus {
  const parsed = DesignDefSchema.safeParse(e.def);
  if (!parsed.success) return stale();
  const def: DesignDef = parsed.data;
  if (have.has(contentKey(e))) return HAVE();
  const c = new DesignerModel(game).checkNew(def);
  if (c.block === null) {
    return {
      state: "ready",
      reason: translateText("ww1936.library.ready"),
      order: { kind: "design_save", def } as WwOrder,
    };
  }
  const blocked = (reason: string): EntryStatus => ({
    state: "blocked",
    reason,
    order: null,
  });
  if (c.techs.length > 0 || c.projects.length > 0) {
    return blocked(needsText(c.techs, c.projects));
  }
  if (c.block === "bad_base" || c.block === "module_bad_slot") return stale();
  return blocked(blockText(c.block));
}

function templateStatus(
  e: Extract<LibEntry, { type: "template" }>,
  game: StatusGame,
  have: ReadonlySet<string>,
): EntryStatus {
  const battalions = e.battalions as BattalionId[];
  const support = e.support as SupportId[];
  const known =
    battalions.every((b) => (BATTALION_IDS as readonly string[]).includes(b)) &&
    support.every((s) => (SUPPORT_IDS as readonly string[]).includes(s));
  const name = e.name.trim();
  if (
    !known ||
    battalions.length < 1 ||
    battalions.length > WW_MAX_BATTALIONS ||
    support.length > WW_MAX_SUPPORT ||
    name === "" ||
    name.length > WW_TEMPLATE_NAME_MAX
  ) {
    return stale();
  }
  if (have.has(contentKey(e))) return HAVE();
  const me = game.myPlayer()?.smallID() ?? 0;
  const economy = game.wwEconomy?.();
  const land = game.wwLand?.()?.details.get(me);
  if (!economy || !land) return stale();
  const researched = researchedOf(economy, me);
  const def: TemplateDef = { name, battalions, support };
  const blocked = (reason: string): EntryStatus => ({
    state: "blocked",
    reason,
    order: null,
  });
  // The engine's order: too many templates, templateBlock, then the XP.
  if (land.templates.length >= WW_MAX_TEMPLATES) {
    return blocked(blockText("too_many_templates"));
  }
  const b = templateBlock(def, researched, Infinity);
  if (b !== null) {
    if (b === "no_tech") {
      const lack: WwTechId[] = [];
      for (const id of battalions) {
        for (const t of BATTALIONS[id].techs) {
          if (!researched.has(t) && !lack.includes(t)) lack.push(t);
        }
      }
      for (const id of support) {
        for (const t of SUPPORTS[id].techs) {
          if (!researched.has(t) && !lack.includes(t)) lack.push(t);
        }
      }
      return blocked(needsText(lack, []));
    }
    return b === "bad_template" ? stale() : blocked(blockText(b));
  }
  const groups = designGroupsOf(game.wwDepth?.()?.detail(me)?.designs);
  const noDesign = battalions.filter((id, i) => {
    const g = DESIGN_ONLY_GROUP[id];
    return g !== undefined && !groups.has(g) && battalions.indexOf(id) === i;
  });
  if (noDesign.length > 0) {
    return blocked(
      noDesign
        .map((id) =>
          translateText("ww1936.land.needs_design", {
            battalion: translateText(`ww1936.battalion.${id}`),
          }),
        )
        .join(" · "),
    );
  }
  return {
    state: "ready",
    reason: translateText("ww1936.library.ready"),
    order: {
      kind: "template_save",
      template: 0,
      base: 0,
      name,
      battalions: [...battalions],
      support: [...support],
    } as WwOrder,
  };
}

// ---- the auto-creator ----

/** Not before this long after the last look, unless the game's state changed. */
export const AUTO_MIN_GAP_MS = 2_000;
/** Look again at this pace even without a change. */
export const AUTO_POLL_MS = 15_000;
/** After sending an entry, leave it alone this long (the order is on its way). */
export const AUTO_SENT_HOLD_MS = 30_000;

export class LibraryAuto {
  private lastLook = -Infinity;
  private lastKey = "";
  /** The state key an order was sent in: nothing else is sent until the state moves on. */
  private sentKey: string | null = null;
  private readonly sentAt = new Map<string, number>();

  constructor(
    private readonly store: LibraryStore,
    private readonly send: (o: WwOrder) => void,
    private readonly notice: (text: string) => void,
    private readonly now: () => number = () => performance.now(),
  ) {}

  /** Called every tick; cheap unless it is time to look. Returns the entry it sent, if any. */
  tick(game: (StatusGame & Partial<GameView>) | null): LibEntry | null {
    if (
      game === null ||
      game === undefined ||
      game.worldWarScenario?.() === null ||
      game.worldWarScenario?.() === undefined
    )
      return null;
    const me = game.myPlayer?.();
    if (!me || !me.isAlive()) return null;
    if (!this.store.entries.some((e) => e.auto)) return null;
    const t = this.now();
    const key = `${game.wwDepth?.()?.version ?? 0}|${game.wwEconomy?.()?.version ?? 0}|${game.wwLand?.()?.version ?? 0}|${this.store.entries.length}`;
    const changed = key !== this.lastKey;
    if (t - this.lastLook < AUTO_MIN_GAP_MS) return null;
    if (!changed && t - this.lastLook < AUTO_POLL_MS) return null;
    this.lastLook = t;
    this.lastKey = key;
    if (this.sentKey !== null && this.sentKey === key) return null;
    const have = existingKeys(game);
    for (const e of this.store.entries) {
      if (!e.auto) continue;
      const hold = this.sentAt.get(e.id);
      if (hold !== undefined && t - hold < AUTO_SENT_HOLD_MS) continue;
      // A cell that already has a design of mine is left alone: the
      // auto-creator opens a game with the player's designs, it never
      // overwrites what the player made since (loading by hand does).
      const cell = cellOf(e);
      if (cell !== null && cellTaken(game, cell)) continue;
      const s = entryStatus(e, game, have);
      if (s.state !== "ready" || s.order === null) continue;
      this.sentAt.set(e.id, t);
      this.sentKey = key;
      this.send(s.order);
      this.notice(
        translateText("ww1936.library.auto_made", { name: entryName(e) }),
      );
      return e;
    }
    return null;
  }
}

/** The name an entry shows (an automatic design name is drawn as the designer draws it). */
export function entryName(e: LibEntry): string {
  if (e.type === "template" || e.type === "army") return e.name;
  return designDisplayName(e.def as DesignDef);
}
