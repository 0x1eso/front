// World War 1936 P6 lane U3 (plan Task 12, spec §20.6): what the
// intelligence drawer shows, as plain data. Every judgement is engine-lib's
// (IntelRules: levels, bands, operation days and success, capture chance,
// operative slots); the model only reads views and builds orders.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import {
  AGENCY_FOUND_PP,
  AGENCY_UPGRADES,
  AgencyUpgrade,
  ID_AIR,
  ID_ARMY,
  ID_CIVIL,
  ID_NAVY,
  INTEL_MISSIONS,
  INTEL_OPERATIONS,
  IntelMission,
  IntelOperation,
  OPERATIVE_RECRUIT_DAYS,
  WW_MAX_OPERATIVES,
  WwDepthDetail,
  WwOperativeData,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayIndex } from "@openfront/engine-lib/ww1936/Calendar";
import {
  capturePmMilli,
  intelBand,
  OPERATION_DEFS,
  operationDays,
  operativeSlots,
  opSuccessPm,
  UPGRADE_NEEDS,
  upgradeBit,
} from "@openfront/engine-lib/ww1936/IntelRules";
import { translateText } from "../../Utils";
import type { GameView } from "../../view/GameView";
import { enemiesOf } from "./WorldWarModel";

/** The department upgrade of each domain (civil: ag_civil_dept …). */
export const DEPARTMENT: Readonly<Record<number, AgencyUpgrade>> = {
  [ID_CIVIL]: "ag_civil_dept",
  [ID_ARMY]: "ag_army_dept",
  [ID_NAVY]: "ag_navy_dept",
  [ID_AIR]: "ag_air_dept",
};

export type AgencyState = "owned" | "building" | "ready" | "locked";
export interface AgencyCard {
  id: AgencyUpgrade;
  state: AgencyState;
  progressPm: number;
  /** The upgrade this one waits for (locked), if any. */
  needs: AgencyUpgrade | null;
}

export interface OperativeCard {
  /** 0 for an empty slot. */
  uid: number;
  codename: string;
  skill: number;
  state: WwOperativeData["state"] | "empty";
  target: number;
  mission: IntelMission | null;
  op: number;
  /** Operation progress 0..1000 (0 for a mission). */
  progressPm: number;
  daysLeft: number;
  /** "0.3%" a day. */
  risk: string;
}

export interface TargetRow {
  id: number;
  name: string;
  flag: string;
  atWar: boolean;
  neighbour: boolean;
  networkPm: number;
  /** Civil, army, navy, air bands (0..3). */
  bands: [number, number, number, number];
  infiltrated: boolean;
}

export interface MissionChip {
  mission: IntelMission;
  enabled: boolean;
}

export interface OperationCondition {
  key: string;
  have: number;
  need: number;
  ok: boolean;
}
export interface OperationRow {
  op: IntelOperation;
  conditions: OperationCondition[];
  days: number;
  /** Collaboration and coup only; null otherwise. */
  successPm: number | null;
  ok: boolean;
}

export interface SourceLine {
  /** `ww1936.intel.src.<key>`. */
  key: string;
  value: number;
}

export interface CryptoCard {
  agency: boolean;
  cipher: number;
  decrypt: number;
  target: number;
  progressPm: number;
  /** Days left at the pace seen so far; null before two readings. */
  daysLeft: number | null;
  /** Broken codes: exploiting while activeUntil ≥ 0 (lane I sends −1 for a code broken but not used now). */
  decrypted: {
    target: number;
    activeUntil: number;
    exploiting: boolean;
    daysLeft: number;
  }[];
  /** Lane I's decryptLog: who read our codes (we learn it when they stop). */
  brokenLog: { target: number; day: number }[];
}

/** One day's capture chance as the card's text: "0.3%" (from milli‰: 1% = 10 000). */
export function riskText(milli: number): string {
  const tenths = Math.round(milli / 1000);
  return `${Math.floor(tenths / 10)}.${tenths % 10}%`;
}

/** An operative's codename: lane I's counter n is K5's c<n % 60>, " 2" and on past 60. */
export function codenameText(n: number): string {
  const name = translateText(`ww1936.codename.c${n % 60}`);
  return n >= 60 ? `${name} ${Math.floor(n / 60) + 1}` : name;
}

export class IntelModel {
  private observer = 0;
  private rowsKey = -1;
  private rowsCache: TargetRow[] = [];
  private cryptoMemo: { target: number; pm: number; day: number } | null = null;
  private cryptoRate = 0;

  constructor(readonly view: GameView) {}

  setObserver(smallID: number): void {
    this.observer = smallID;
    this.rowsKey = -1;
  }

  me(): number {
    return this.observer || (this.view.myPlayer?.()?.smallID() ?? 0);
  }

  detail(): WwDepthDetail | undefined {
    return this.view.wwDepth?.()?.detail(this.me());
  }

  agency(): boolean {
    return this.detail()?.intel.agency ?? false;
  }

  hasUpgrade(u: AgencyUpgrade): boolean {
    return ((this.detail()?.intel.upgrades ?? 0) & upgradeBit(u)) !== 0;
  }

  private today(): number {
    const prep = this.view.worldWarData?.()?.prepEndTick ?? WW_PREP_TICKS;
    return dayIndex(this.view.ticks?.() ?? 0, prep);
  }

  // ---- tab 1: the agency ------------------------------------------------

  /** 12 cards (3 columns × 4 rows). */
  agencyCards(): AgencyCard[] {
    const d = this.detail();
    const up = d?.intel.upId ?? -1;
    return AGENCY_UPGRADES.map((id, i) => {
      const owned = this.hasUpgrade(id);
      const need = UPGRADE_NEEDS[id] ?? null;
      const state: AgencyState = owned
        ? "owned"
        : up === i
          ? "building"
          : need !== null && !this.hasUpgrade(need)
            ? "locked"
            : "ready";
      return {
        id,
        state,
        progressPm: up === i ? (d?.intel.upProgressPm ?? 0) : 0,
        needs: need,
      };
    });
  }

  /** A card tap starts the upgrade when it is ready and none is running. */
  canStartUpgrade(card: AgencyCard): boolean {
    return (
      this.agency() &&
      card.state === "ready" &&
      (this.detail()?.intel.upId ?? -1) < 0
    );
  }

  foundOrder(): WwOrder {
    return { kind: "intel_found" } as WwOrder;
  }
  foundCost(): number {
    return AGENCY_FOUND_PP;
  }
  upgradeOrder(id: AgencyUpgrade): WwOrder {
    return { kind: "intel_upgrade", id } as WwOrder;
  }

  // ---- tab 2: the operatives --------------------------------------------

  /** Capture chance a day for an operative, milli‰ (the engine's capturePm is ‰). */
  captureMilli(o: WwOperativeData): number {
    return o.capturePm > 0
      ? o.capturePm * 1000
      : capturePmMilli(
          o.state === "operation",
          Math.max(1, o.skill),
          this.counterOf(o.target),
          false,
        );
  }

  /** Lane I's targetCounter: a target's counter-intelligence, half units. */
  counterOf(target: number): number {
    return (
      (this.detail()?.intel.targetCounter ?? []).find(
        (x) => x[0] === target,
      )?.[1] ?? 0
    );
  }

  operativeCards(): OperativeCard[] {
    const d = this.detail();
    if (d === undefined || !d.intel.agency) return [];
    const slots = Math.min(WW_MAX_OPERATIVES, operativeSlots(d.intel.upgrades));
    const today = this.today();
    const out: OperativeCard[] = [];
    for (const o of d.intel.operatives) {
      const operation = d.intel.operations.find((x) =>
        x.operatives.includes(o.uid),
      );
      const total = operation ? operation.endDay - operation.startDay : 0;
      const left = operation ? operation.endDay - today : 0;
      out.push({
        uid: o.uid,
        codename: codenameText(o.codename),
        skill: o.skill,
        state: o.state,
        target: o.target,
        mission: o.mission,
        op: o.op,
        progressPm:
          operation !== undefined && total > 0
            ? Math.max(
                0,
                Math.min(1000, Math.floor(((total - left) * 1000) / total)),
              )
            : 0,
        daysLeft: operation !== undefined ? Math.max(0, left) : o.daysLeft,
        risk: riskText(this.captureMilli(o)),
      });
    }
    while (out.length < slots) {
      out.push({
        uid: 0,
        codename: "",
        skill: 0,
        state: "empty",
        target: 0,
        mission: null,
        op: -1,
        progressPm: 0,
        daysLeft: OPERATIVE_RECRUIT_DAYS,
        risk: "",
      });
    }
    return out;
  }

  recruitOrder(): WwOrder {
    return { kind: "operative_recruit" } as WwOrder;
  }

  /** Spec §20.6: at war first, then neighbours, then the rest by size (threat). */
  targetRows(): TargetRow[] {
    const v = this.view;
    const key =
      (v.wwDepth?.()?.version ?? 0) * 1_000 +
      (v.wwLand?.()?.version ?? 0) +
      this.me() * 1_000_003;
    if (key === this.rowsKey) return this.rowsCache;
    this.rowsKey = key;
    const me = this.me();
    const d = this.detail();
    const scenario = v.worldWarScenario?.();
    const land = v.wwLand?.();
    const depth = v.wwDepth?.();
    if (scenario === undefined || scenario === null || me === 0) {
      this.rowsCache = [];
      return this.rowsCache;
    }
    const wars = new Set(enemiesOf(v as never, me));
    const neighbours = new Set<number>();
    if (land) {
      for (const r of scenario.landRegions) {
        if (land.controller[r.id] !== me) continue;
        for (const n of scenario.regionNeighbours(r.id)) {
          const c = land.controller[n];
          if (c !== 0 && c !== me) neighbours.add(c);
        }
      }
    }
    // Running infiltrations and lane I's finished ones.
    const infiltrating = new Set<number>();
    for (const o of d?.intel.operations ?? []) {
      if (o.kind.startsWith("op_infiltrate")) infiltrating.add(o.target);
    }
    for (const [t, bits] of d?.intel.infiltrated ?? []) {
      if (bits !== 0) infiltrating.add(t);
    }
    const nets = new Map<number, number>(d?.intel.networks ?? []);
    const rows: TargetRow[] = [];
    for (const tag of scenario.scenarioTags()) {
      const id = scenario.smallIdOf(tag);
      if (id === me || depth?.summary(id) === undefined) continue;
      rows.push({
        id,
        name: translateText(`ww1936.country.${tag}`),
        flag: COUNTRIES[tag].flag,
        atWar: wars.has(id),
        neighbour: neighbours.has(id),
        networkPm: nets.get(id) ?? 0,
        bands: [
          this.bandOn(id, ID_CIVIL),
          this.bandOn(id, ID_ARMY),
          this.bandOn(id, ID_NAVY),
          this.bandOn(id, ID_AIR),
        ],
        infiltrated: infiltrating.has(id),
      });
    }
    const size = (id: number) => land?.countries.get(id)?.divisions ?? 0;
    const rank = (r: TargetRow) => (r.atWar ? 0 : r.neighbour ? 1 : 2);
    rows.sort(
      (a, b) => rank(a) - rank(b) || size(b.id) - size(a.id) || a.id - b.id,
    );
    this.rowsCache = rows;
    return rows;
  }

  /** The observer's intel level (0..100) on a target in a domain. */
  levelOn(target: number, domain: number): number {
    return this.view.wwDepth?.()?.intelOf(this.me(), target, domain) ?? 0;
  }

  /** The observer's band on a target in a domain. */
  bandOn(target: number, domain: number): number {
    return intelBand(this.levelOn(target, domain));
  }

  /** Idle operatives, the chosen one first (a recruit still training is not free: lane I refuses it). */
  freeOperatives(first = 0): WwOperativeData[] {
    return (this.detail()?.intel.operatives ?? [])
      .filter((o) => o.state === "idle" && o.daysLeft <= 0)
      .sort(
        (a, b) =>
          Number(b.uid === first) - Number(a.uid === first) || a.uid - b.uid,
      );
  }

  /** Six mission chips. */
  missionChips(operative: number, target: number): MissionChip[] {
    const ok = (this.detail()?.intel.operatives ?? []).some(
      (o) => o.uid === operative && o.state !== "captured",
    );
    return INTEL_MISSIONS.map((mission) => ({
      mission,
      enabled: ok && target !== 0,
    }));
  }

  assignOrder(
    operative: number,
    target: number,
    mission: IntelMission,
  ): WwOrder {
    return { kind: "operative_assign", operative, target, mission } as WwOrder;
  }
  recallOrder(operative: number): WwOrder {
    return { kind: "operative_recall", operative } as WwOrder;
  }

  /** The operation list for a target: conditions with ✓/✗, days, success. */
  operationRows(target: number, operative = 0): OperationRow[] {
    const d = this.detail();
    const pp = Math.floor(
      (this.view.wwPolitics?.()?.summary(this.me())?.ppMilli ?? 0) / 1000,
    );
    const net =
      (d?.intel.networks ?? []).find((n) => n[0] === target)?.[1] ?? 0;
    const free = this.freeOperatives(operative);
    const captive = (d?.intel.operatives ?? []).filter(
      (o) => o.state === "captured" && o.target === target,
    ).length;
    return INTEL_OPERATIONS.map((op) => {
      const def = OPERATION_DEFS[op];
      const conditions: OperationCondition[] = [
        {
          key: "network",
          have: net,
          need: def.networkPm,
          ok: net >= def.networkPm,
        },
        {
          key: "operatives",
          have: Math.min(free.length, def.operatives),
          need: def.operatives,
          ok: free.length >= def.operatives,
        },
        { key: "pp", have: pp, need: def.pp, ok: pp >= def.pp },
      ];
      if (op === "op_rescue") {
        conditions.push({
          key: "captive",
          have: Math.min(1, captive),
          need: 1,
          ok: captive > 0,
        });
      }
      const picked = free.slice(0, def.operatives);
      const avg =
        picked.length === 0
          ? 1_000
          : Math.floor(
              (picked.reduce((s, o) => s + o.skill, 0) * 1_000) / picked.length,
            );
      return {
        op,
        conditions,
        days: operationDays(
          op,
          this.hasUpgrade("ag_army_dept"),
          this.hasUpgrade("ag_special_ops"),
          0,
        ),
        successPm: def.rolls
          ? opSuccessPm(
              net,
              avg,
              this.hasUpgrade("ag_civil_dept"),
              this.counterOf(target),
            )
          : null,
        ok: conditions.every((c) => c.ok),
      };
    });
  }

  opStartOrder(op: IntelOperation, target: number, first = 0): WwOrder | null {
    const need = OPERATION_DEFS[op].operatives;
    const free = this.freeOperatives(first).slice(0, need);
    if (free.length < need) return null;
    return {
      kind: "operation_start",
      op,
      target,
      operatives: free.map((o) => o.uid),
    } as WwOrder;
  }

  // ---- tab 3: the levels ------------------------------------------------

  /**
   * The lines of the observer's intel level on a target in a domain
   * (spec §8.8), rebuilt from what the screen knows with the engine's own
   * formulas (the network line is floor(network / 20)). Whatever the screen
   * cannot see (infiltration, recon, radar, the target's counter-
   * intelligence, intelPct, the same-faction floor of 80) is one signed
   * "other" line, so the lines always add up to the engine level.
   */
  levelSources(target: number, domain: number): SourceLine[] {
    // Lane I's own lines (they add up to the level) when it sends them.
    const parts = this.detail()?.intel.levelParts;
    if (parts !== undefined) {
      return parts
        .filter((x) => x[0] === target && x[1] === domain && x[3] !== 0)
        .map((x) => ({ key: x[2], value: x[3] }));
    }
    const engine = this.levelOn(target, domain);
    const me = this.me();
    const row = this.targetRows().find((r) => r.id === target);
    const d = this.detail();
    const pol = this.view.wwPolitics?.();
    const f = pol?.factionIdx(me) ?? -1;
    const sameFaction = f >= 0 && f === pol?.factionIdx(target);
    const lines: SourceLine[] = [{ key: "base", value: 5 }];
    const add = (key: string, v: number) => {
      if (v !== 0) lines.push({ key, value: v });
    };
    add("neighbour", row?.neighbour ? 10 : 0);
    add("same_faction", sameFaction ? 10 : 0);
    add("at_war", row?.atWar ? 15 : 0);
    const net =
      (d?.intel.networks ?? []).find((n) => n[0] === target)?.[1] ?? 0;
    add("network", Math.min(50, Math.floor(net / 20)));
    add("department", this.hasUpgrade(DEPARTMENT[domain]) ? 10 : 0);
    const exploit = (d?.intel.decrypted ?? []).some(
      (x) => x.target === target && x.activeUntil >= 0,
    );
    add("exploiting", exploit ? (domain === ID_CIVIL ? 15 : 30) : 0);
    const known = lines.reduce((s, l) => s + l.value, 0);
    add("other", engine - known);
    return lines;
  }

  levelTotal(target: number, domain: number): number {
    return this.levelSources(target, domain).reduce((s, l) => s + l.value, 0);
  }

  // ---- tab 4: the codes -------------------------------------------------

  cryptoCard(): CryptoCard {
    const i = this.detail()?.intel;
    const today = this.today();
    const target = i?.cryptoTarget ?? 0;
    const pm = i?.cryptoPm ?? 0;
    const memo = this.cryptoMemo;
    if (memo === null || memo.target !== target || pm < memo.pm) {
      this.cryptoMemo = { target, pm, day: today };
      this.cryptoRate = 0;
    } else if (today > memo.day && pm > memo.pm) {
      this.cryptoRate = (pm - memo.pm) / (today - memo.day);
      this.cryptoMemo = { target, pm, day: today };
    }
    return {
      agency: i?.agency ?? false,
      cipher: i?.cipher ?? 0,
      decrypt: i?.decrypt ?? 0,
      target,
      progressPm: pm,
      // Lane I's own estimate when it sends one; else the pace seen here.
      daysLeft:
        target === 0
          ? null
          : i?.cryptoDaysLeft !== undefined
            ? i.cryptoDaysLeft >= 0
              ? i.cryptoDaysLeft
              : null
            : this.cryptoRate > 0
              ? Math.ceil((1000 - pm) / this.cryptoRate)
              : null,
      decrypted: (i?.decrypted ?? []).map((x) => ({
        target: x.target,
        activeUntil: x.activeUntil,
        exploiting: x.activeUntil >= 0,
        daysLeft: x.activeUntil >= 0 ? Math.max(0, x.activeUntil - today) : 0,
      })),
      brokenLog: [...(i?.decryptLog ?? [])].sort(
        (a, b) => b.day - a.day || a.target - b.target,
      ),
    };
  }

  cryptoTargetOrder(target: number): WwOrder {
    return { kind: "crypto_target", target } as WwOrder;
  }
  cryptoActivateOrder(target: number): WwOrder {
    return { kind: "crypto_activate", target } as WwOrder;
  }
}
