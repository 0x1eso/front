// P6 lane U2 fills this file (plan Task 11): the tank, ship and plane
// designer (spec §20.5). The foundation's stub: the Step 18 methods with
// the engine-lib functions the engine uses (Review Focus 2: the preview
// is designStats), no screen state beyond the draft.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type {
  DesignDef,
  DesignKind,
  DesignStats,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type {
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  designBlock,
  designStats,
  designXpCost,
} from "@openfront/engine-lib/ww1936/DesignRules";
import type { GameView } from "../../view/GameView";

export class DesignerModel {
  /** The design being edited; null before open(). */
  draft: DesignDef | null = null;
  /** The saved design it was opened from (the compare column, the xp cost). */
  private base: DesignDef | null = null;

  constructor(readonly view: GameView) {}

  open(kind: DesignKind, base?: string): void {
    this.base = null;
    this.draft =
      base === undefined ? null : { kind, base, modules: [], name: base };
  }

  setModule(slot: number, id: string): void {
    if (this.draft === null) return;
    const modules = [...this.draft.modules];
    modules[slot] = id;
    this.draft = { ...this.draft, modules };
  }

  setLevel(armor: number, engine: number): void {
    if (this.draft === null) return;
    this.draft = { ...this.draft, armorLevel: armor, engineLevel: engine };
  }

  /** The draft's numbers: engine-lib designStats, as the engine computes them. */
  stats(): DesignStats | null {
    if (this.draft === null) return null;
    return designStats(this.draft, {
      techs: this.techs(),
      projects: this.projects(),
      relPp: 0,
      costPct: 0,
    });
  }

  /** Why the draft cannot be saved (engine-lib designBlock); null when it can. */
  block(): WwOrderBlock | null {
    if (this.draft === null) return "bad_base";
    return designBlock(this.draft, {
      techs: this.techs(),
      projects: this.projects(),
      treatyMember: false,
      treatyEscalated: false,
    });
  }

  compareTo(): DesignStats | null {
    return null;
  }

  xpCost(): number {
    return this.draft === null ? 0 : designXpCost(this.base, this.draft);
  }

  save(): WwOrder | null {
    if (this.draft === null || this.block() !== null) return null;
    return { kind: "design_save", def: this.draft } as WwOrder;
  }

  private techs(): ReadonlySet<WwTechId> {
    const me = this.view.myPlayer()?.smallID() ?? 0;
    const d = this.view.wwEconomy()?.detail(me);
    return new Set<WwTechId>(d?.researched ?? []);
  }

  private projects(): number {
    const me = this.view.myPlayer()?.smallID() ?? 0;
    return this.view.wwDepth()?.detail(me)?.projects.done ?? 0;
  }
}
