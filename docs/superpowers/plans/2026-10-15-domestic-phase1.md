# 내정 모드 1단계 (자원과 기술) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로비 토글로 켜는 "내정 모드"의 1단계를 구현한다. 범위는 과학력·정치력, 연구소·행정청, 기술 트리와 유닛 잠금, 도시 세수·징병비·유지비·징병 상한, 국정 패널(기술 탭), AI 기본 연구다.

**Architecture:** 공유 규칙과 데이터는 `packages/engine-lib/src/domestic/`에 둔다(기술 표, 보정값 합산, 잠금, 수치). 엔진과 화면이 함께 쓴다. 플레이어별 상태(`PlayerDomestic`)와 초당 처리(`DomesticExecution`)는 `packages/engine/src/domestic/`에 둔다. 화면은 `PlayerUpdate.domestic`으로 상태를 받는다. 기존 코드에는 "`domesticMode`가 켜져 있을 때만 보정값을 적용한다"는 짧은 연결 코드만 넣는다. 모드를 끄면 원작과 비트 단위로 같아야 한다.

**Tech Stack:** TypeScript 6, Vitest 4, zod + zbin, Lit + Tailwind 4, jq

**Spec:** `docs/superpowers/specs/2026-10-15-domestic-system-design.md` (이 계획은 §3, §4, §7, §9 일부, §10, §11, §13의 1단계를 구현한다)

---

## 시작 전에 (환경)

- 프로젝트는 Node 24를 요구한다(`package.json` engines). 이 PC에는 Node 26이 깔려 있다. 의존성은 이미 `npm ci --ignore-scripts --engine-strict=false`로 설치했다. 테스트·타입 검사는 Node 26에서도 통과했다. 정식으로 맞추려면 `sudo pacman -S nodejs-lts-krypton`(Node 24 LTS, 현재 `nodejs` 패키지를 대체)을 설치하고 `npm run inst`를 다시 실행한다.
- 작업 브랜치: `domestic-system`
- 단일 테스트 실행: `npx vitest tests/domestic/<File>.test.ts --run`
- 커밋 전에 바꾼 파일에 `npx prettier --write <files>`를 실행한다.

## Global Constraints

- 엔진 결정성: `packages/engine*`에서 `Math.random`, `Date.now`, `new Date`를 쓰지 않는다. `Math.pow/exp/log/sin...`과 2가 아닌 지수의 `**`도 쓰지 않는다(필요하면 `DetMath`). `Math.sqrt`, `Math.round`, `Math.floor`, `Math.ceil`은 허용된다.
- 패키지 경계(`tests/LayerBoundaries.test.ts`): `engine-api`는 zod/zbin/resources만, `engine-lib`는 여기에 `engine-api`, `engine`은 여기에 `engine-lib`까지 import할 수 있다. `src/client`는 `engine`을 import하지 않는다.
- 내정 모드 꺼짐(`domesticMode` 미설정 또는 false)이면 동작이 원작과 같아야 한다. 기존 테스트는 수정 없이 전부 통과해야 한다(예외: Task 3의 `tests/server/ConfigPatch.test.ts`에 키 하나 추가).
- 봇(`PlayerType.Bot`)은 내정 상태가 없다(`domestic()`이 `null`).
- 수치는 spec §11을 따른다. 모두 `packages/engine-lib/src/domestic/Balance.ts`에 모은다.
- enum 값(`UnitType`, `MessageType`), 인텐트 스키마, `GameConfigSchema` 필드는 맨 뒤에 추가한다(zbin은 선언 순서로 인코딩한다).
- 스냅샷 호환: 새 스냅샷 필드는 optional로 만든다. 새 Execution은 `ExecutionRegistry`에 등록한다.
- 화면 문구는 `translateText()`를 거친다. 키는 `resources/lang/en.json`(키 정렬 필수)과 `resources/lang/ko.json` 둘 다 추가한다.
- 보정값 합산 결과로 금액을 계산할 때 비용·무역 수익·과학력/정치력은 `Math.round`, 기본 금 수입은 원작처럼 `Math.floor`로 정수화한다(부동소수 0.85 같은 값 때문).

## Review Focus

1. **모드 꺼짐 회귀:** 기본 설정 게임에서 새 건물이 빌드 메뉴와 AI에 나타나지 않고, 비용·금 수입·병력 증가가 원작과 같아야 한다. 테스트는 Task 3 "disabled outside domestic mode", Task 9 "vanilla gold rate", 그리고 Task 15의 전체 스위트다.
2. **금이 바닥난 순간:** 징병비, 병력 유지비, 건물 운영비가 금을 음수로 만들면 안 되고, 병력도 음수가 되면 안 된다. 테스트는 Task 5 "institutes stop when upkeep can't be paid"·"desertion", Task 6 "recruitment is limited by gold"다.
3. **UI를 우회한 잠긴 유닛 명령:** 맨해튼 프로젝트 없이 `build_unit AtomBomb`이나 잠긴 Missile Silo 건설 명령이 오면 엔진이 거부해야 한다. 테스트는 Task 8 "build_unit for a locked unit is rejected"다.
4. **연구 도중 스냅샷/복원(재접속):** 진행 중인 연구, 보유 기술, 포인트가 복원 후에도 같아야 하고 이후 틱도 같게 흘러야 한다. 테스트는 Task 4 "snapshot round trip", Task 7 "research survives a snapshot"이다.
5. **징병 상한을 현재 병력보다 낮춤:** 병력이 즉시가 아니라 초과분의 1%씩 줄어야 하고, 상한 아래로 내려가면 안 된다. 테스트는 Task 5 "demobilizes 1% of the excess per second, never below target"이다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `packages/engine-api/src/domestic/DomesticTypes.ts` (새) | 기술 ID, StatKey, 조건, `Modifier`, `DomesticView`, `DomesticData` 타입 |
| `packages/engine-lib/src/domestic/Balance.ts` (새) | 모든 수치 |
| `packages/engine-lib/src/domestic/Techs.ts` (새) | 기술 21개 데이터 |
| `packages/engine-lib/src/domestic/Modifiers.ts` (새) | 보정값 합산·조건·상한 |
| `packages/engine-lib/src/domestic/Research.ts` (새) | 연구 가능 여부, 연구 시간, 부족분 금 계산 |
| `packages/engine-lib/src/domestic/Locks.ts` (새) | 유닛 잠금, 내정 전용 건물 목록 |
| `packages/engine-lib/src/domestic/Troops.ts` (새) | 내정 규칙의 병력 증가(회복 보정, 징병 상한) |
| `packages/engine/src/domestic/PlayerDomestic.ts` (새) | 플레이어별 상태, 스냅샷 |
| `packages/engine/src/domestic/DomesticEconomy.ts` (새) | 초당 처리, 징병비, 무역 보정, 방어 기지 보정 |
| `packages/engine/src/domestic/DomesticExecution.ts` (새) | 10틱마다 모든 플레이어의 초당 처리 실행 |
| `packages/engine/src/domestic/ResearchExecution.ts` (새) | `research_tech` 명령 |
| `packages/engine/src/domestic/SetRecruitTargetExecution.ts` (새) | `set_recruit_target` 명령 |
| `packages/engine/src/execution/nation/NationDomesticBehavior.ts` (새) | AI 연구 순서와 징병 상한 |
| `src/client/view/DomesticClientView.ts` (새) | 화면 쪽 `DomesticView` |
| `src/client/hud/domestic/DomesticEvents.ts` (새) | 패널 토글 이벤트 |
| `src/client/hud/domestic/DomesticHud.ts` (새) | 상단 과학력·정치력, 징병 상한 슬라이더, 패널 버튼 |
| `src/client/hud/domestic/DomesticPanel.ts` (새) | 국정 패널(기술 탭) |
| `resources/images/ResearchInstituteIconWhite.svg`, `AdminOfficeIconWhite.svg` (새) | 빌드 메뉴 아이콘 |
| `tests/domestic/*.test.ts`, `tests/domestic/util.ts` (새) | 테스트 |
| 기존 파일 수정 | 각 Task의 Files 목록 참고 |

---

### Task 1: 내정 타입, 수치, 기술 데이터

**Files:**
- Create: `packages/engine-api/src/domestic/DomesticTypes.ts`
- Create: `packages/engine-lib/src/domestic/Balance.ts`
- Create: `packages/engine-lib/src/domestic/Techs.ts`
- Test: `tests/domestic/Techs.test.ts`

**Interfaces:**
- Produces: `TECH_IDS`, `TechId`, `STAT_KEYS`, `StatKey`, `CONDITIONS`, `Condition`, `Modifier`, `DomesticView { pct(stat): number; hasTech(tech): boolean; recruitTargetPct(): number }`, `ResearchProgress { tech; ticksLeft; totalTicks }`, `DomesticData`; `Balance.ts`의 상수 전부; `TECHS: Record<TechId, TechDef>`, `TechDef { id, era, branch, cost, seconds, prereqs, modifiers, unlocks, interest? }`, `Era = 1|2|3|4`, `Branch = "economy"|"military"|"learning"`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/Techs.test.ts`:

```ts
import { TECH_IDS } from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";

describe("tech tree data", () => {
  test("every tech id has a definition with a matching id", () => {
    expect(Object.keys(TECHS).sort()).toEqual([...TECH_IDS].sort());
    for (const id of TECH_IDS) {
      expect(TECHS[id].id).toBe(id);
    }
  });

  test("eras hold 5 / 6 / 6 / 4 techs", () => {
    const counts = [1, 2, 3, 4].map(
      (era) => TECH_IDS.filter((id) => TECHS[id].era === era).length,
    );
    expect(counts).toEqual([5, 6, 6, 4]);
  });

  test("prerequisites point to the same or an earlier era", () => {
    for (const id of TECH_IDS) {
      for (const p of TECHS[id].prereqs) {
        expect(TECHS[p].era).toBeLessThanOrEqual(TECHS[id].era);
      }
    }
  });

  test("costs and times follow the era table; space program costs 4000", () => {
    expect(TECHS.currency.cost).toBe(100);
    expect(TECHS.currency.seconds).toBe(20);
    expect(TECHS.railroad.cost).toBe(250);
    expect(TECHS.radar.cost).toBe(500);
    expect(TECHS.mirv.cost).toBe(1000);
    expect(TECHS.mirv.seconds).toBe(60);
    expect(TECHS.space_program.cost).toBe(4000);
  });

  test("each locked unit is unlocked by exactly one tech", () => {
    const unlocked = TECH_IDS.flatMap((id) => [...TECHS[id].unlocks]).sort();
    expect(unlocked).toEqual(
      [
        UnitType.AtomBomb,
        UnitType.Factory,
        UnitType.HydrogenBomb,
        UnitType.MIRV,
        UnitType.MissileSilo,
        UnitType.SAMLauncher,
        UnitType.Warship,
      ].sort(),
    );
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/Techs.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine-api/domestic/DomesticTypes'`

- [ ] **Step 3: 타입 파일 작성**

`packages/engine-api/src/domestic/DomesticTypes.ts`:

```ts
// Domestic mode: the shared vocabulary of the science / political layer.
// Data (costs, effects, unlocks) lives in engine-lib/domestic; this file only
// holds ids and shapes, so schemas and read views can name them.

export const TECH_IDS = [
  // Era 1
  "currency",
  "navigation",
  "fortification",
  "academia",
  "bureaucracy",
  // Era 2
  "railroad",
  "banking",
  "steel_ships",
  "conscription",
  "scientific_method",
  "printing_press",
  // Era 3
  "industrialization",
  "global_trade",
  "rocketry",
  "radar",
  "manhattan_project",
  "computers",
  // Era 4
  "globalization",
  "thermonuclear",
  "mirv",
  "space_program",
] as const;
export type TechId = (typeof TECH_IDS)[number];

export const STAT_KEYS = [
  "goldIncome",
  "cityTax",
  "allGold",
  "trade",
  "tradeShip",
  "train",
  "foreignTrade",
  "alliedTrade",
  "tradeShipSpawn",
  "science",
  "political",
  "instituteOutput",
  "adminOutput",
  "researchTime",
  "lawCost",
  "goldPaymentCost",
  "maxTroops",
  "troopRegen",
  "recruitCost",
  "troopUpkeep",
  "upkeepFreeBand",
  "attackLoss",
  "defenseLoss",
  "attackSpeed",
  "expansionSpeed",
  "buildCost",
  "portCost",
  "siloSamCost",
  "nukeCost",
  "defensePostCost",
  "buildTime",
  "cityBuildTime",
  "defensePost",
  "samRange",
] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const CONDITIONS = [
  "attacking",
  "notAttacking",
  "troopsAtMostHalf",
] as const;
export type Condition = (typeof CONDITIONS)[number];

export interface Modifier {
  stat: StatKey;
  /** Percent change: +30 means x1.3, -25 means x0.75. */
  pct: number;
  /** Only applies while the condition holds; always when absent. */
  when?: Condition;
}

/** What rules code (Config, on engine and client) reads of a player's domestic state. */
export interface DomesticView {
  /** Summed, capped modifier percent for `stat`; 0 when nothing applies. */
  pct(stat: StatKey): number;
  hasTech(tech: TechId): boolean;
  /** Troops stop regrowing at this percent of max troops (10..100). */
  recruitTargetPct(): number;
}

export interface ResearchProgress {
  tech: TechId;
  ticksLeft: number;
  totalTicks: number;
}

/** Domestic state as sent worker -> main thread on PlayerUpdate. Never mutated. */
export interface DomesticData {
  /** Whole points available to spend. */
  science: number;
  political: number;
  /** Whole points produced since spawn (never decreases). */
  cumulativeScience: number;
  cumulativePolitical: number;
  /** Points produced in the last processed second. */
  sciencePerSec: number;
  politicalPerSec: number;
  techs: TechId[];
  research: ResearchProgress | null;
  recruitTargetPct: number;
}
```

- [ ] **Step 4: 수치 파일 작성**

`packages/engine-lib/src/domestic/Balance.ts`:

```ts
import { Difficulty } from "@openfront/engine-api/game/GameTypes";

// Domestic mode tunables (spec §11). Rates are per second unless noted; the
// engine runs the domestic economy once every DOMESTIC_INTERVAL_TICKS.

export const DOMESTIC_INTERVAL_TICKS = 10;
/** Science and political power are stored as integer milli-points. */
export const MILLI = 1000;

/** Territory output: this many points per second per sqrt(land share %). */
export const TERRITORY_YIELD_PER_SQRT_PCT = 0.5;
/** Research institute / admin office output per level. */
export const BUILDING_YIELD_PER_LEVEL = 1;
/** Research institute / admin office gold upkeep per level. */
export const BUILDING_UPKEEP_PER_LEVEL = 50n;
export const BUILDING_BASE_COST = 100_000;
export const BUILDING_MAX_COST = 1_000_000;
export const BUILDING_CONSTRUCTION_TICKS = 5 * 10;

/** Extra base gold per tick per city level (150 gold/s). */
export const CITY_TAX_PER_LEVEL_PER_TICK = 15;

export const RECRUIT_COST_PER_1000_TROOPS = 50;
/** Troops up to this percent of max troops cost no upkeep. */
export const UPKEEP_FREE_BAND_PCT = 40;
export const UPKEEP_GOLD_PER_1000_EXCESS = 1.5;
export const DESERTION_PCT_PER_SEC = 1;
export const DEMOBILIZE_PCT_PER_SEC = 1;

export const RECRUIT_TARGET_MIN_PCT = 10;
export const RECRUIT_TARGET_MAX_PCT = 100;
export const RECRUIT_TARGET_DEFAULT_PCT = 100;

/** Gold per missing point when paying a research shortfall. */
export const GOLD_PER_POINT = 1000;

export const TECH_COST_BY_ERA = [100, 250, 500, 1000] as const;
export const TECH_SECONDS_BY_ERA = [20, 30, 45, 60] as const;
export const SPACE_PROGRAM_COST = 4000;
export const TECHS_REQUIRED_FROM_PREVIOUS_ERA = 2;

/** Banking: stored gold earns 2% per minute, i.e. gold / 3000 per second. */
export const INTEREST_DIVISOR_PER_SEC = 3000n;
export const INTEREST_CAP_PER_SEC = 1500n;

/** Nations' science / political output by difficulty (like troop multipliers). */
export const NATION_YIELD_MULT: Record<Difficulty, number> = {
  [Difficulty.Easy]: 0.7,
  [Difficulty.Medium]: 0.85,
  [Difficulty.Hard]: 1,
  [Difficulty.Impossible]: 1.15,
};

export const STAT_CAPS = {
  combatLossMinPct: -50,
  reductionMinPct: -60,
  increaseMaxPct: 200,
} as const;
```

- [ ] **Step 5: 기술 데이터 작성**

`packages/engine-lib/src/domestic/Techs.ts`:

```ts
import {
  Modifier,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  SPACE_PROGRAM_COST,
  TECH_COST_BY_ERA,
  TECH_SECONDS_BY_ERA,
} from "./Balance";

export type Era = 1 | 2 | 3 | 4;
export type Branch = "economy" | "military" | "learning";

export interface TechDef {
  id: TechId;
  era: Era;
  branch: Branch;
  /** Science points. */
  cost: number;
  /** Research time before modifiers. */
  seconds: number;
  prereqs: readonly TechId[];
  modifiers: readonly Modifier[];
  unlocks: readonly UnitType[];
  /** Banking: stored gold earns interest. */
  interest?: true;
}

type TechExtras = Partial<
  Pick<TechDef, "prereqs" | "modifiers" | "unlocks" | "interest" | "cost">
>;

function tech(
  id: TechId,
  era: Era,
  branch: Branch,
  extra: TechExtras = {},
): TechDef {
  return {
    id,
    era,
    branch,
    cost: extra.cost ?? TECH_COST_BY_ERA[era - 1],
    seconds: TECH_SECONDS_BY_ERA[era - 1],
    prereqs: extra.prereqs ?? [],
    modifiers: extra.modifiers ?? [],
    unlocks: extra.unlocks ?? [],
    ...(extra.interest ? ({ interest: true } as const) : {}),
  };
}

// Spec §4.2.
export const TECHS: Readonly<Record<TechId, TechDef>> = {
  currency: tech("currency", 1, "economy", {
    modifiers: [{ stat: "cityTax", pct: 50 }],
  }),
  navigation: tech("navigation", 1, "economy", {
    modifiers: [
      { stat: "tradeShip", pct: 40 },
      { stat: "portCost", pct: -25 },
    ],
  }),
  fortification: tech("fortification", 1, "military", {
    modifiers: [
      { stat: "defensePost", pct: 50 },
      { stat: "defensePostCost", pct: -30 },
    ],
  }),
  academia: tech("academia", 1, "learning", {
    modifiers: [{ stat: "instituteOutput", pct: 40 }],
  }),
  bureaucracy: tech("bureaucracy", 1, "learning", {
    modifiers: [{ stat: "adminOutput", pct: 40 }],
  }),
  railroad: tech("railroad", 2, "economy", { unlocks: [UnitType.Factory] }),
  banking: tech("banking", 2, "economy", { interest: true }),
  steel_ships: tech("steel_ships", 2, "military", {
    unlocks: [UnitType.Warship],
  }),
  conscription: tech("conscription", 2, "military", {
    modifiers: [
      { stat: "troopRegen", pct: 25 },
      { stat: "recruitCost", pct: -30 },
    ],
  }),
  scientific_method: tech("scientific_method", 2, "learning", {
    modifiers: [
      { stat: "researchTime", pct: -30 },
      { stat: "science", pct: 15 },
    ],
  }),
  printing_press: tech("printing_press", 2, "learning", {
    modifiers: [
      { stat: "political", pct: 25 },
      { stat: "lawCost", pct: -15 },
    ],
  }),
  industrialization: tech("industrialization", 3, "economy", {
    modifiers: [
      { stat: "train", pct: 50 },
      { stat: "buildCost", pct: -15 },
    ],
  }),
  global_trade: tech("global_trade", 3, "economy", {
    modifiers: [
      { stat: "tradeShipSpawn", pct: 50 },
      { stat: "alliedTrade", pct: 50 },
    ],
  }),
  rocketry: tech("rocketry", 3, "military", {
    unlocks: [UnitType.MissileSilo],
  }),
  radar: tech("radar", 3, "military", { unlocks: [UnitType.SAMLauncher] }),
  manhattan_project: tech("manhattan_project", 3, "military", {
    prereqs: ["rocketry"],
    unlocks: [UnitType.AtomBomb],
  }),
  computers: tech("computers", 3, "learning", {
    modifiers: [
      { stat: "science", pct: 30 },
      { stat: "political", pct: 15 },
    ],
  }),
  globalization: tech("globalization", 4, "economy", {
    modifiers: [{ stat: "allGold", pct: 30 }],
  }),
  thermonuclear: tech("thermonuclear", 4, "military", {
    prereqs: ["manhattan_project"],
    unlocks: [UnitType.HydrogenBomb],
  }),
  mirv: tech("mirv", 4, "military", {
    prereqs: ["thermonuclear"],
    unlocks: [UnitType.MIRV],
  }),
  // The science-victory project itself arrives in phase 3.
  space_program: tech("space_program", 4, "learning", {
    prereqs: ["computers"],
    cost: SPACE_PROGRAM_COST,
  }),
};
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/domestic/Techs.test.ts --run`
Expected: PASS (5 tests)

- [ ] **Step 7: 커밋**

```bash
npx prettier --write packages/engine-api/src/domestic packages/engine-lib/src/domestic tests/domestic
git add packages/engine-api/src/domestic packages/engine-lib/src/domestic tests/domestic
git commit -m "feat(domestic): add tech tree data and balance constants"
```

---

### Task 2: 보정값 합산, 연구 규칙, 잠금

**Files:**
- Create: `packages/engine-lib/src/domestic/Modifiers.ts`
- Create: `packages/engine-lib/src/domestic/Research.ts`
- Create: `packages/engine-lib/src/domestic/Locks.ts`
- Test: `tests/domestic/DomesticRules.test.ts`

**Interfaces:**
- Consumes: Task 1의 `TECHS`, `Modifier`, `StatKey`, `Condition`, `DomesticView`, Balance 상수
- Produces:
  - `capPct(stat: StatKey, pct: number): number`
  - `capCombinedPct(pct: number): number`
  - `applyPct(value: number, pct: number): number`
  - `class ModifierTotals { constructor(modifiers: readonly Modifier[]); pct(stat: StatKey, active?: ReadonlySet<Condition>): number }`
  - `techModifiers(techs: Iterable<TechId>): Modifier[]`
  - `type ResearchBlock = "researched" | "busy" | "era" | "prereq"`
  - `researchBlock(researched: ReadonlySet<TechId>, busy: boolean, tech: TechId): ResearchBlock | null`
  - `researchTicks(tech: TechId, researchTimePct: number): number`
  - `shortfallGold(shortMilli: number, goldPaymentCostPct: number): bigint`
  - `requiredTech(type: UnitType): TechId | null`
  - `isLockedByTech(view: DomesticView | null, type: UnitType): boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/DomesticRules.test.ts`:

```ts
import {
  DomesticView,
  StatKey,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  isLockedByTech,
  requiredTech,
} from "@openfront/engine-lib/domestic/Locks";
import {
  capCombinedPct,
  capPct,
  ModifierTotals,
  techModifiers,
} from "@openfront/engine-lib/domestic/Modifiers";
import {
  researchBlock,
  researchTicks,
  shortfallGold,
} from "@openfront/engine-lib/domestic/Research";

function viewWith(techs: TechId[]): DomesticView {
  const set = new Set(techs);
  const totals = new ModifierTotals(techModifiers(techs));
  return {
    pct: (stat: StatKey) => totals.pct(stat),
    hasTech: (tech: TechId) => set.has(tech),
    recruitTargetPct: () => 100,
  };
}

describe("ModifierTotals", () => {
  test("sums modifiers of the same stat", () => {
    const t = new ModifierTotals([
      { stat: "science", pct: 15 },
      { stat: "science", pct: 30 },
    ]);
    expect(t.pct("science")).toBe(45);
    expect(t.pct("political")).toBe(0);
  });

  test("conditional modifiers apply only while their condition is active", () => {
    const t = new ModifierTotals([
      { stat: "political", pct: 30, when: "notAttacking" },
    ]);
    expect(t.pct("political")).toBe(0);
    expect(t.pct("political", new Set(["notAttacking"] as const))).toBe(30);
  });

  test("caps: combat losses -50, other reductions -60, increases +200", () => {
    expect(capPct("defenseLoss", -70)).toBe(-50);
    expect(capPct("buildCost", -90)).toBe(-60);
    expect(capPct("science", 500)).toBe(200);
    expect(capCombinedPct(-85)).toBe(-60);
    expect(capCombinedPct(250)).toBe(200);
  });

  test("tech modifiers come from the tech table", () => {
    const t = new ModifierTotals(
      techModifiers(["scientific_method", "computers"]),
    );
    expect(t.pct("science")).toBe(45);
    expect(t.pct("researchTime")).toBe(-30);
  });
});

describe("researchBlock", () => {
  test("era 1 is open from the start", () => {
    expect(researchBlock(new Set(), false, "currency")).toBeNull();
  });

  test("era 2 needs two era-1 techs", () => {
    expect(researchBlock(new Set(["currency"]), false, "railroad")).toBe(
      "era",
    );
    expect(
      researchBlock(new Set(["currency", "academia"]), false, "railroad"),
    ).toBeNull();
  });

  test("explicit prerequisites", () => {
    const done = new Set<TechId>(["currency", "academia", "railroad", "banking"]);
    expect(researchBlock(done, false, "manhattan_project")).toBe("prereq");
    done.add("rocketry");
    expect(researchBlock(done, false, "manhattan_project")).toBeNull();
  });

  test("already researched comes before busy", () => {
    expect(researchBlock(new Set(), true, "currency")).toBe("busy");
    expect(researchBlock(new Set(["currency"]), true, "currency")).toBe(
      "researched",
    );
  });
});

describe("research helpers", () => {
  test("researchTicks applies researchTime and never goes below one second", () => {
    expect(researchTicks("currency", 0)).toBe(200);
    expect(researchTicks("currency", -30)).toBe(140);
    expect(researchTicks("currency", -100)).toBe(10);
  });

  test("shortfallGold rounds missing points up and applies goldPaymentCost", () => {
    expect(shortfallGold(0, 0)).toBe(0n);
    expect(shortfallGold(1, 0)).toBe(1000n);
    expect(shortfallGold(2500, -50)).toBe(1500n);
  });
});

describe("locks", () => {
  test("required techs", () => {
    expect(requiredTech(UnitType.AtomBomb)).toBe("manhattan_project");
    expect(requiredTech(UnitType.City)).toBeNull();
  });

  test("no domestic view means nothing is locked", () => {
    expect(isLockedByTech(null, UnitType.AtomBomb)).toBe(false);
  });

  test("locked until researched", () => {
    expect(isLockedByTech(viewWith([]), UnitType.Factory)).toBe(true);
    expect(isLockedByTech(viewWith(["railroad"]), UnitType.Factory)).toBe(
      false,
    );
    expect(isLockedByTech(viewWith([]), UnitType.City)).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/DomesticRules.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine-lib/domestic/Locks'`

- [ ] **Step 3: Modifiers.ts 작성**

`packages/engine-lib/src/domestic/Modifiers.ts`:

```ts
import {
  Condition,
  Modifier,
  StatKey,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { STAT_CAPS } from "./Balance";
import { TECHS } from "./Techs";

const COMBAT_LOSS_STATS: ReadonlySet<StatKey> = new Set<StatKey>([
  "attackLoss",
  "defenseLoss",
]);
const NO_CONDITIONS: ReadonlySet<Condition> = new Set();

/** Clamps one stat's summed percent to the spec caps (§7.1). */
export function capPct(stat: StatKey, pct: number): number {
  const min = COMBAT_LOSS_STATS.has(stat)
    ? STAT_CAPS.combatLossMinPct
    : STAT_CAPS.reductionMinPct;
  return Math.min(STAT_CAPS.increaseMaxPct, Math.max(min, pct));
}

/** Clamps a sum over several stats (e.g. buildCost + portCost). */
export function capCombinedPct(pct: number): number {
  return Math.min(
    STAT_CAPS.increaseMaxPct,
    Math.max(STAT_CAPS.reductionMinPct, pct),
  );
}

export function applyPct(value: number, pct: number): number {
  return value * (1 + pct / 100);
}

/** Per-stat sums of a modifier list, split by condition. Immutable. */
export class ModifierTotals {
  private readonly always = new Map<StatKey, number>();
  private readonly conditional = new Map<Condition, Map<StatKey, number>>();

  constructor(modifiers: readonly Modifier[]) {
    for (const m of modifiers) {
      let bucket = this.always;
      if (m.when !== undefined) {
        bucket = this.conditional.get(m.when) ?? new Map<StatKey, number>();
        this.conditional.set(m.when, bucket);
      }
      bucket.set(m.stat, (bucket.get(m.stat) ?? 0) + m.pct);
    }
  }

  pct(stat: StatKey, active: ReadonlySet<Condition> = NO_CONDITIONS): number {
    let total = this.always.get(stat) ?? 0;
    for (const c of active) {
      total += this.conditional.get(c)?.get(stat) ?? 0;
    }
    return capPct(stat, total);
  }
}

export function techModifiers(techs: Iterable<TechId>): Modifier[] {
  const out: Modifier[] = [];
  for (const id of techs) {
    out.push(...TECHS[id].modifiers);
  }
  return out;
}
```

- [ ] **Step 4: Research.ts 작성**

`packages/engine-lib/src/domestic/Research.ts`:

```ts
import { TechId } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  GOLD_PER_POINT,
  MILLI,
  TECHS_REQUIRED_FROM_PREVIOUS_ERA,
} from "./Balance";
import { TECHS } from "./Techs";

export type ResearchBlock = "researched" | "busy" | "era" | "prereq";

/** Why `tech` can't be started now (cost aside), or null when it can. */
export function researchBlock(
  researched: ReadonlySet<TechId>,
  busy: boolean,
  tech: TechId,
): ResearchBlock | null {
  if (researched.has(tech)) return "researched";
  if (busy) return "busy";
  const def = TECHS[tech];
  if (def.era > 1) {
    let fromPreviousEra = 0;
    for (const r of researched) {
      if (TECHS[r].era === def.era - 1) fromPreviousEra++;
    }
    if (fromPreviousEra < TECHS_REQUIRED_FROM_PREVIOUS_ERA) return "era";
  }
  for (const p of def.prereqs) {
    if (!researched.has(p)) return "prereq";
  }
  return null;
}

/** Research duration in ticks after the researchTime modifier (at least 1 s). */
export function researchTicks(tech: TechId, researchTimePct: number): number {
  return Math.max(
    10,
    Math.round(TECHS[tech].seconds * 10 * (1 + researchTimePct / 100)),
  );
}

/** Gold that covers `shortMilli` missing milli-points, after goldPaymentCost. */
export function shortfallGold(
  shortMilli: number,
  goldPaymentCostPct: number,
): bigint {
  if (shortMilli <= 0) return 0n;
  const points = Math.ceil(shortMilli / MILLI);
  return BigInt(
    Math.ceil(points * GOLD_PER_POINT * (1 + goldPaymentCostPct / 100)),
  );
}
```

- [ ] **Step 5: Locks.ts 작성**

`packages/engine-lib/src/domestic/Locks.ts`:

```ts
import {
  DomesticView,
  TECH_IDS,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { TECHS } from "./Techs";

const UNLOCKING_TECH: ReadonlyMap<UnitType, TechId> = new Map(
  TECH_IDS.flatMap((id) => TECHS[id].unlocks.map((u) => [u, id] as const)),
);

/** The tech that unlocks `type` in domestic mode, or null if it never locks. */
export function requiredTech(type: UnitType): TechId | null {
  return UNLOCKING_TECH.get(type) ?? null;
}

/** True for a domestic-mode player who hasn't researched `type` yet. */
export function isLockedByTech(
  view: DomesticView | null,
  type: UnitType,
): boolean {
  if (view === null) return false;
  const tech = requiredTech(type);
  return tech !== null && !view.hasTech(tech);
}
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/domestic/DomesticRules.test.ts --run`
Expected: PASS (13 tests)

- [ ] **Step 7: 커밋**

```bash
npx prettier --write packages/engine-lib/src/domestic tests/domestic
git add packages/engine-lib/src/domestic tests/domestic
git commit -m "feat(domestic): add modifier totals, research rules and unit locks"
```

---

### Task 3: 내정 모드 설정과 새 건물(연구소, 행정청)

**Files:**
- Modify: `packages/engine-api/src/Schemas.ts` (`GameConfigSchema` 끝에 필드 추가)
- Modify: `packages/engine-api/src/game/GameTypes.ts` (`UnitType` 끝에 2개 추가, `Structures`에 추가)
- Modify: `packages/engine-lib/src/domestic/Locks.ts` (`DOMESTIC_ONLY_UNITS`)
- Modify: `packages/engine-lib/src/configuration/Config.ts` (`domesticMode()`, `isUnitDisabled`, `unitInfo`)
- Modify: `packages/engine/src/configuration/EngineConfig.ts` (`unitCost`)
- Modify: `packages/engine/src/game/Game.ts` (`UnitParamsMap`)
- Modify: `packages/engine/src/game/PlayerImpl.ts` (`canSpawnUnitType`)
- Modify: `packages/engine/src/execution/ConstructionExecution.ts` (`isStructure`, `completeConstruction`)
- Modify: `src/server/ConfigPatch.ts` (`COPIED_KEYS`)
- Modify: `tests/server/ConfigPatch.test.ts` (`EDITABLE`에 키 추가)
- Create: `tests/domestic/util.ts`
- Test: `tests/domestic/DomesticBuildings.test.ts`

**Interfaces:**
- Consumes: Balance의 `BUILDING_BASE_COST`, `BUILDING_MAX_COST`, `BUILDING_CONSTRUCTION_TICKS`
- Produces:
  - `UnitType.ResearchInstitute = "Research Institute"`, `UnitType.AdminOffice = "Admin Office"`
  - `GameConfig.domesticMode?: boolean`, `Config.domesticMode(): boolean`
  - `DOMESTIC_ONLY_UNITS: ReadonlySet<UnitType>`
  - 테스트 유틸 `HUMAN: PlayerInfo`, `domesticGame(config?: Partial<GameConfig>, humans?: PlayerInfo[]): Promise<Game>`, `conquerSquare(game, player, x0, y0, size): void`

- [ ] **Step 1: 테스트 유틸 작성**

`tests/domestic/util.ts`:

```ts
import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";

export const HUMAN = new PlayerInfo("human", PlayerType.Human, null, "human_id");

/** A plains game (100x100, all land) with domestic mode on. */
export async function domesticGame(
  config: Partial<GameConfig> = {},
  humans: PlayerInfo[] = [HUMAN],
): Promise<Game> {
  return setup("plains", { domesticMode: true, ...config }, humans);
}

export function conquerSquare(
  game: Game,
  player: Player,
  x0: number,
  y0: number,
  size: number,
): void {
  for (let x = x0; x < x0 + size; x++) {
    for (let y = y0; y < y0 + size; y++) {
      player.conquer(game.ref(x, y));
    }
  }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/domestic/DomesticBuildings.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { setup } from "../util/Setup";
import { constructionExecution } from "../util/utils";
import { conquerSquare, domesticGame, HUMAN } from "./util";

describe("domestic buildings", () => {
  test("are disabled outside domestic mode", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    expect(game.config().domesticMode()).toBe(false);
    expect(game.config().isUnitDisabled(UnitType.ResearchInstitute)).toBe(true);
    expect(game.config().isUnitDisabled(UnitType.AdminOffice)).toBe(true);
  });

  test("are enabled in domestic mode", async () => {
    const game = await domesticGame();
    expect(game.config().domesticMode()).toBe(true);
    expect(game.config().isUnitDisabled(UnitType.ResearchInstitute)).toBe(
      false,
    );
  });

  test("cost 100k doubling per owned level, capped at 1M", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    const cost = (extra = 0) =>
      game.unitInfo(UnitType.ResearchInstitute).cost(game, player, extra);
    expect(cost()).toBe(100_000n);
    expect(cost(1)).toBe(200_000n);
    expect(cost(4)).toBe(1_000_000n);
  });

  test("are built through ConstructionExecution and upgradable", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 20);
    player.addGold(1_000_000n);
    constructionExecution(game, player, 3, 3, UnitType.ResearchInstitute, 60);
    constructionExecution(game, player, 16, 16, UnitType.AdminOffice, 60);
    const institutes = player.units(UnitType.ResearchInstitute);
    expect(institutes).toHaveLength(1);
    expect(institutes[0].isUnderConstruction()).toBe(false);
    expect(player.units(UnitType.AdminOffice)).toHaveLength(1);
    expect(game.config().unitInfo(UnitType.AdminOffice).upgradable).toBe(true);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest tests/domestic/DomesticBuildings.test.ts --run`
Expected: FAIL — `game.config().domesticMode is not a function` 또는 `UnitType.ResearchInstitute`가 undefined

- [ ] **Step 4: 설정 스키마 필드 추가**

`packages/engine-api/src/Schemas.ts`의 `GameConfigSchema` 마지막 필드 `pool: PoolConfigSchema.optional(),` 바로 뒤에 추가:

```ts
  // Domestic mode (this fork): science / political power, tech tree, gold
  // sinks. Off by default. See docs/superpowers/specs/2026-10-15-domestic-system-design.md.
  domesticMode: z.boolean().optional(),
```

- [ ] **Step 5: 유닛 타입 추가**

`packages/engine-api/src/game/GameTypes.ts`의 `UnitType` enum에서 `Factory = "Factory",` 뒤에 추가:

```ts
  ResearchInstitute = "Research Institute",
  AdminOffice = "Admin Office",
```

같은 파일의 `Structures` 그룹을 다음으로 바꾼다:

```ts
export const Structures = unitTypeGroup([
  UnitType.City,
  UnitType.DefensePost,
  UnitType.SAMLauncher,
  UnitType.MissileSilo,
  UnitType.Port,
  UnitType.Factory,
  UnitType.ResearchInstitute,
  UnitType.AdminOffice,
] as const);
```

- [ ] **Step 6: 내정 전용 건물 목록**

`packages/engine-lib/src/domestic/Locks.ts` 끝에 추가:

```ts
/** Structures that exist only in domestic mode (disabled otherwise). */
export const DOMESTIC_ONLY_UNITS: ReadonlySet<UnitType> = new Set([
  UnitType.ResearchInstitute,
  UnitType.AdminOffice,
]);
```

- [ ] **Step 7: Config 수정**

`packages/engine-lib/src/configuration/Config.ts` 상단 import에 추가:

```ts
import { BUILDING_CONSTRUCTION_TICKS } from "../domestic/Balance";
import { DOMESTIC_ONLY_UNITS } from "../domestic/Locks";
```

`isUnitDisabled`를 다음으로 바꾸고, 바로 위에 `domesticMode()`를 추가한다:

```ts
  domesticMode(): boolean {
    return this._gameConfig.domesticMode ?? false;
  }

  isUnitDisabled(unitType: UnitType): boolean {
    if (DOMESTIC_ONLY_UNITS.has(unitType) && !this.domesticMode()) {
      return true;
    }
    return this._gameConfig.disabledUnits?.includes(unitType) ?? false;
  }
```

`unitInfo`의 `case UnitType.City: case UnitType.Factory:` 블록 뒤(`case UnitType.TransportShip:` 앞)에 추가:

```ts
      case UnitType.ResearchInstitute:
      case UnitType.AdminOffice:
        info = {
          constructionDuration: this.instantBuild()
            ? 0
            : BUILDING_CONSTRUCTION_TICKS,
          upgradable: true,
        };
        break;
```

- [ ] **Step 8: 비용 추가**

`packages/engine/src/configuration/EngineConfig.ts` import에 추가:

```ts
import {
  BUILDING_BASE_COST,
  BUILDING_MAX_COST,
} from "@openfront/engine-lib/domestic/Balance";
```

`unitCost`의 `case UnitType.Factory:` 블록 뒤(`case UnitType.TransportShip:` 앞)에 추가:

```ts
      case UnitType.ResearchInstitute:
      case UnitType.AdminOffice:
        return this.costWrapper(
          (numUnits: number) =>
            Math.min(BUILDING_MAX_COST, pow2(numUnits) * BUILDING_BASE_COST),
          type,
        );
```

- [ ] **Step 9: 엔진의 나머지 exhaustive 지점**

`packages/engine/src/game/Game.ts`의 `UnitParamsMap`에서 `[UnitType.City]: Record<string, never>;` 뒤에 추가:

```ts

  [UnitType.ResearchInstitute]: Record<string, never>;

  [UnitType.AdminOffice]: Record<string, never>;
```

`packages/engine/src/game/PlayerImpl.ts`의 `canSpawnUnitType`에서 `case UnitType.Factory:` 바로 뒤에 두 줄을 추가해 `landBasedStructureSpawn` 그룹에 넣는다:

```ts
      case UnitType.Factory:
      case UnitType.ResearchInstitute:
      case UnitType.AdminOffice:
        return this.landBasedStructureSpawn(targetTile, validTiles);
```

`packages/engine/src/execution/ConstructionExecution.ts`의 `completeConstruction` switch에서 `case UnitType.Factory:` 블록 뒤에 추가:

```ts
      case UnitType.ResearchInstitute:
      case UnitType.AdminOffice:
        // Output comes from owned levels each second (DomesticExecution).
        break;
```

같은 파일 `isStructure`의 `case UnitType.Factory:` 뒤에 추가:

```ts
      case UnitType.ResearchInstitute:
      case UnitType.AdminOffice:
```

- [ ] **Step 10: 서버 설정 패치 허용 목록**

`src/server/ConfigPatch.ts`의 `COPIED_KEYS`에서 `"nameRevealPublicIds",` 뒤에 `"domesticMode",`를 추가한다.

`tests/server/ConfigPatch.test.ts`의 `EDITABLE`에서 `nameRevealPublicIds: ["pub-b"],` 뒤에 `domesticMode: true,`를 추가한다.

- [ ] **Step 11: 통과 확인**

Run: `npx vitest tests/domestic tests/server/ConfigPatch.test.ts --run && npm run typecheck`
Expected: 테스트 PASS, typecheck 오류 없음

- [ ] **Step 12: 커밋**

```bash
npx prettier --write packages/engine-api/src packages/engine-lib/src/domestic packages/engine-lib/src/configuration/Config.ts packages/engine/src/configuration/EngineConfig.ts packages/engine/src/game/Game.ts packages/engine/src/game/PlayerImpl.ts packages/engine/src/execution/ConstructionExecution.ts src/server/ConfigPatch.ts tests/server/ConfigPatch.test.ts tests/domestic
git add -A packages src/server tests
git commit -m "feat(domestic): add domestic mode flag, research institute and admin office"
```

---

### Task 4: 플레이어 내정 상태, 읽기 뷰, 동기화, 스냅샷

**Files:**
- Create: `packages/engine/src/domestic/PlayerDomestic.ts`
- Create: `src/client/view/DomesticClientView.ts`
- Modify: `packages/engine-api/src/game/ReadViews.ts` (`PlayerLike.domestic()`)
- Modify: `packages/engine-api/src/game/GameUpdates.ts` (`PlayerUpdate.domestic`)
- Modify: `packages/engine/src/game/Game.ts` (`Player.domestic()`)
- Modify: `packages/engine/src/game/PlayerImpl.ts` (필드, 생성, `toFullUpdate`, `snapshot`, `restoreSnapshot`, `PlayerSnapshot` 스키마)
- Modify: `packages/engine/src/game/GameUpdateUtils.ts` (diff)
- Modify: `src/client/view/PlayerView.ts`
- Modify: `tests/util/Snapshot.ts` (`DERIVED_FIELDS`)
- Modify: `tests/domestic/util.ts` (`grantTechs`)
- Test: `tests/domestic/PlayerDomestic.test.ts`

**Interfaces:**
- Consumes: Task 1~2의 타입과 `ModifierTotals`, `techModifiers`, Balance 상수
- Produces:
  - `PlayerLike.domestic(): DomesticView | null`
  - `Player.domestic(): PlayerDomestic | null`
  - `PlayerUpdate.domestic?: DomesticData`
  - `class PlayerDomestic implements DomesticView`: `pct`, `hasTech`, `researchedTechs(): ReadonlySet<TechId>`, `recruitTargetPct()`, `setRecruitTargetPct(pct: number)`, `scienceMilliAvailable(): number`, `politicalMilliAvailable(): number`, `cumulativeScienceMilli(): number`, `cumulativePoliticalMilli(): number`, `currentResearch(): ResearchProgress | null`, `addYield(scienceMilli: number, politicalMilli: number)`, `spendScienceMilli(amount: number)`, `beginResearch(tech: TechId, ticks: number)`, `advanceResearch(ticks: number): TechId | null`, `toData(): DomesticData`, `snapshot(): DomesticState`, `static restore(s: DomesticState): PlayerDomestic`
  - `DomesticStateSchema`, `type DomesticState`
  - `class DomesticClientView implements DomesticView { readonly data: DomesticData }`
  - `PlayerView.domestic(): DomesticClientView | null`, `PlayerView.domesticData(): DomesticData | null`
  - 테스트 유틸 `grantTechs(player: Player, ...techs: TechId[]): void`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/util.ts` 위쪽 import 목록에 다음 두 줄을 추가한다:

```ts
import { TechId } from "@openfront/engine-api/domestic/DomesticTypes";
import { DOMESTIC_INTERVAL_TICKS } from "@openfront/engine-lib/domestic/Balance";
```

같은 파일 끝에 추가:

```ts
/** Gives a player techs directly, skipping costs and era rules. */
export function grantTechs(player: Player, ...techs: TechId[]): void {
  const d = player.domestic();
  if (d === null) throw new Error("player has no domestic state");
  for (const tech of techs) {
    d.beginResearch(tech, 0);
    d.advanceResearch(DOMESTIC_INTERVAL_TICKS);
  }
}
```

`tests/domestic/PlayerDomestic.test.ts`:

```ts
import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { PlayerDomestic } from "@openfront/engine/domestic/PlayerDomestic";
import { PlayerImpl } from "@openfront/engine/game/PlayerImpl";
import { setup } from "../util/Setup";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { conquerSquare, domesticGame, grantTechs, HUMAN } from "./util";

describe("PlayerDomestic", () => {
  test("humans and nations get domestic state; bots don't", async () => {
    const game = await domesticGame();
    const nation = game.addPlayer(
      new PlayerInfo("nation", PlayerType.Nation, null, "nation_id"),
    );
    const bot = game.addPlayer(
      new PlayerInfo("bot", PlayerType.Bot, null, "bot_id"),
    );
    expect(game.player(HUMAN.id).domestic()).not.toBeNull();
    expect(nation.domestic()).not.toBeNull();
    expect(bot.domestic()).toBeNull();
  });

  test("no domestic state outside domestic mode", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    expect(game.player(HUMAN.id).domestic()).toBeNull();
  });

  test("research completes after its ticks and grants its modifiers", () => {
    const d = new PlayerDomestic();
    d.beginResearch("computers", 25);
    expect(d.advanceResearch(10)).toBeNull();
    expect(d.currentResearch()?.ticksLeft).toBe(15);
    expect(d.advanceResearch(10)).toBeNull();
    expect(d.advanceResearch(10)).toBe("computers");
    expect(d.hasTech("computers")).toBe(true);
    expect(d.pct("science")).toBe(30);
    expect(d.currentResearch()).toBeNull();
  });

  test("toData is cached until something changes", () => {
    const d = new PlayerDomestic();
    const a = d.toData();
    expect(d.toData()).toBe(a);
    d.addYield(1500, 500);
    const b = d.toData();
    expect(b).not.toBe(a);
    expect(b.science).toBe(1);
    expect(b.political).toBe(0);
    expect(b.sciencePerSec).toBe(1.5);
    expect(b.cumulativeScience).toBe(1);
  });

  test("recruit target is clamped to 10..100", () => {
    const d = new PlayerDomestic();
    d.setRecruitTargetPct(5);
    expect(d.recruitTargetPct()).toBe(10);
    d.setRecruitTargetPct(250);
    expect(d.recruitTargetPct()).toBe(100);
  });

  test("spending more science than available throws", () => {
    const d = new PlayerDomestic();
    d.addYield(500, 0);
    expect(() => d.spendScienceMilli(501)).toThrow();
  });

  test("domestic state rides the player update and diffs by reference", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id) as PlayerImpl;
    const full = player.toUpdate()!;
    expect(full.domestic?.recruitTargetPct).toBe(100);
    expect(player.toUpdate()).toBeNull();
    player.domestic()!.setRecruitTargetPct(50);
    expect(player.toUpdate()?.domestic?.recruitTargetPct).toBe(50);
  });

  test("snapshot round trip keeps techs, research and points", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 10);
    const d = player.domestic()!;
    d.addYield(123_456, 7_890);
    grantTechs(player, "currency", "academia");
    d.beginResearch("railroad", 300);
    d.setRecruitTargetPct(60);

    const restored = await expectSnapshotRoundTrip(game, "plains", 5);
    const rd = restored.player(HUMAN.id).domestic()!;
    expect(rd.hasTech("academia")).toBe(true);
    expect(rd.currentResearch()?.tech).toBe("railroad");
    expect(rd.recruitTargetPct()).toBe(60);
    expect(rd.scienceMilliAvailable()).toBe(123_456);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/PlayerDomestic.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine/domestic/PlayerDomestic'`

- [ ] **Step 3: PlayerDomestic 작성**

`packages/engine/src/domestic/PlayerDomestic.ts`:

```ts
import {
  DomesticData,
  DomesticView,
  ResearchProgress,
  StatKey,
  TECH_IDS,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  MILLI,
  RECRUIT_TARGET_DEFAULT_PCT,
  RECRUIT_TARGET_MAX_PCT,
  RECRUIT_TARGET_MIN_PCT,
} from "@openfront/engine-lib/domestic/Balance";
import {
  ModifierTotals,
  techModifiers,
} from "@openfront/engine-lib/domestic/Modifiers";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";

export const DomesticStateSchema = z.object({
  scienceMilli: zInt(),
  politicalMilli: zInt(),
  cumScienceMilli: zInt(),
  cumPoliticalMilli: zInt(),
  lastScienceMilli: zInt(),
  lastPoliticalMilli: zInt(),
  techs: z.array(z.enum(TECH_IDS)),
  research: z
    .object({
      tech: z.enum(TECH_IDS),
      ticksLeft: zInt(),
      totalTicks: zInt(),
    })
    .nullable(),
  recruitTargetPct: zInt(),
});
export type DomesticState = z.infer<typeof DomesticStateSchema>;

/**
 * A player's domestic-mode state: science and political power (integer
 * milli-points, so accrual stays exact), researched techs, the current
 * research and the recruit target. Only non-bot players in a domestic-mode
 * game have one.
 */
export class PlayerDomestic implements DomesticView {
  private scienceMilli = 0;
  private politicalMilli = 0;
  private cumScienceMilli = 0;
  private cumPoliticalMilli = 0;
  private lastScienceMilli = 0;
  private lastPoliticalMilli = 0;
  private techs = new Set<TechId>();
  private research: ResearchProgress | null = null;
  private recruitTarget = RECRUIT_TARGET_DEFAULT_PCT;
  private totals = new ModifierTotals([]);
  /** toData() result until the next change. */
  private domesticDataCache: DomesticData | null = null;

  pct(stat: StatKey): number {
    return this.totals.pct(stat);
  }

  hasTech(tech: TechId): boolean {
    return this.techs.has(tech);
  }

  researchedTechs(): ReadonlySet<TechId> {
    return this.techs;
  }

  recruitTargetPct(): number {
    return this.recruitTarget;
  }

  setRecruitTargetPct(pct: number): void {
    const clamped = Math.min(
      RECRUIT_TARGET_MAX_PCT,
      Math.max(RECRUIT_TARGET_MIN_PCT, Math.round(pct)),
    );
    if (clamped === this.recruitTarget) return;
    this.recruitTarget = clamped;
    this.changed();
  }

  scienceMilliAvailable(): number {
    return this.scienceMilli;
  }

  politicalMilliAvailable(): number {
    return this.politicalMilli;
  }

  cumulativeScienceMilli(): number {
    return this.cumScienceMilli;
  }

  cumulativePoliticalMilli(): number {
    return this.cumPoliticalMilli;
  }

  currentResearch(): ResearchProgress | null {
    return this.research;
  }

  /** Adds one processed second of output. */
  addYield(scienceMilli: number, politicalMilli: number): void {
    this.scienceMilli += scienceMilli;
    this.politicalMilli += politicalMilli;
    this.cumScienceMilli += scienceMilli;
    this.cumPoliticalMilli += politicalMilli;
    this.lastScienceMilli = scienceMilli;
    this.lastPoliticalMilli = politicalMilli;
    this.changed();
  }

  spendScienceMilli(amount: number): void {
    if (amount < 0 || amount > this.scienceMilli) {
      throw new Error(
        `cannot spend ${amount} science milli-points, have ${this.scienceMilli}`,
      );
    }
    this.scienceMilli -= amount;
    this.changed();
  }

  beginResearch(tech: TechId, ticks: number): void {
    this.research = { tech, ticksLeft: ticks, totalTicks: ticks };
    this.changed();
  }

  /** Moves research forward by `ticks`; returns the tech it finished, if any. */
  advanceResearch(ticks: number): TechId | null {
    const r = this.research;
    if (r === null) return null;
    const left = r.ticksLeft - ticks;
    if (left > 0) {
      this.research = { ...r, ticksLeft: left };
      this.changed();
      return null;
    }
    this.research = null;
    this.techs.add(r.tech);
    this.totals = new ModifierTotals(techModifiers(this.techs));
    this.changed();
    return r.tech;
  }

  toData(): DomesticData {
    this.domesticDataCache ??= {
      science: Math.floor(this.scienceMilli / MILLI),
      political: Math.floor(this.politicalMilli / MILLI),
      cumulativeScience: Math.floor(this.cumScienceMilli / MILLI),
      cumulativePolitical: Math.floor(this.cumPoliticalMilli / MILLI),
      sciencePerSec: this.lastScienceMilli / MILLI,
      politicalPerSec: this.lastPoliticalMilli / MILLI,
      techs: [...this.techs],
      research: this.research === null ? null : { ...this.research },
      recruitTargetPct: this.recruitTarget,
    };
    return this.domesticDataCache;
  }

  snapshot(): DomesticState {
    return {
      scienceMilli: this.scienceMilli,
      politicalMilli: this.politicalMilli,
      cumScienceMilli: this.cumScienceMilli,
      cumPoliticalMilli: this.cumPoliticalMilli,
      lastScienceMilli: this.lastScienceMilli,
      lastPoliticalMilli: this.lastPoliticalMilli,
      techs: [...this.techs],
      research: this.research === null ? null : { ...this.research },
      recruitTargetPct: this.recruitTarget,
    };
  }

  static restore(s: DomesticState): PlayerDomestic {
    const d = new PlayerDomestic();
    d.scienceMilli = s.scienceMilli;
    d.politicalMilli = s.politicalMilli;
    d.cumScienceMilli = s.cumScienceMilli;
    d.cumPoliticalMilli = s.cumPoliticalMilli;
    d.lastScienceMilli = s.lastScienceMilli;
    d.lastPoliticalMilli = s.lastPoliticalMilli;
    d.techs = new Set(s.techs);
    d.research = s.research === null ? null : { ...s.research };
    d.recruitTarget = s.recruitTargetPct;
    d.totals = new ModifierTotals(techModifiers(d.techs));
    return d;
  }

  private changed(): void {
    this.domesticDataCache = null;
  }
}
```

- [ ] **Step 4: 읽기 뷰와 업데이트 타입**

`packages/engine-api/src/game/ReadViews.ts`:
- import 추가: `import type { DomesticView } from "../domestic/DomesticTypes";`
- `PlayerLike`의 `units(type: UnitType): readonly UnitLike[];` 뒤에 추가:

```ts
  /** Domestic-mode state; null outside domestic mode and for bots. */
  domestic(): DomesticView | null;
```

`packages/engine-api/src/game/GameUpdates.ts`:
- import 추가: `import type { DomesticData } from "../domestic/DomesticTypes";`
- `PlayerUpdate`의 `isLobbyCreator?: boolean;` 뒤에 추가:

```ts
  /** Domestic mode only; absent for bots and outside domestic mode. */
  domestic?: DomesticData;
```

- [ ] **Step 5: 엔진 Player 인터페이스와 PlayerImpl**

`packages/engine/src/game/Game.ts`:
- import 추가: `import type { PlayerDomestic } from "../domestic/PlayerDomestic";`
- `export interface Player extends PlayerLike {` 블록의 `isLobbyCreator(): boolean;` 뒤에 추가:

```ts
  /** Domestic-mode state; null outside domestic mode and for bots. */
  domestic(): PlayerDomestic | null;
```

`packages/engine/src/game/PlayerImpl.ts`:
- import 추가:

```ts
import {
  DomesticStateSchema,
  PlayerDomestic,
} from "../domestic/PlayerDomestic";
```

- 필드 추가(`private _goldEarned: bigint = 0n;` 뒤):

```ts
  private _domestic: PlayerDomestic | null = null;
```

- 생성자 끝(`this._pseudo_random = ...` 뒤)에 추가:

```ts
    this._domestic =
      mg.config().domesticMode() && playerInfo.playerType !== PlayerType.Bot
        ? new PlayerDomestic()
        : null;
```

  (`PlayerType`가 이 파일에 이미 import되어 있지 않으면 `@openfront/engine-api/game/GameTypes` import 목록에 추가한다.)

- 메서드 추가(`isLobbyCreator(): boolean {` 메서드 바로 뒤):

```ts
  domestic(): PlayerDomestic | null {
    return this._domestic;
  }
```

- `toFullUpdate`의 반환 객체 끝 `isLobbyCreator: this.isLobbyCreator(),` 뒤에 추가한다. 내정 상태가 없으면 키를 아예 넣지 않아서, 모드가 꺼진 게임의 업데이트는 원작과 똑같이 유지된다:

```ts
      ...(this._domestic === null
        ? {}
        : { domestic: this._domestic.toData() }),
```

- `snapshot`의 반환 객체 끝 `numUnitsConstructed: ...` 항목 뒤에 같은 이유로 조건부로 추가:

```ts
      ...(this._domestic === null
        ? {}
        : { domestic: this._domestic.snapshot() }),
```

- `restoreSnapshot` 끝(`this.nearbyMemo = null;` 뒤)에 추가:

```ts
    this._domestic = s.domestic ? PlayerDomestic.restore(s.domestic) : null;
```

- `PlayerSnapshot` 스키마의 `numUnitsConstructed: ...` 뒤에 추가:

```ts
    domestic: DomesticStateSchema.nullable().optional(),
```

- [ ] **Step 6: diff에 필드 추가**

`packages/engine/src/game/GameUpdateUtils.ts`:
- 빠른 경로 조건의 `prev.isLobbyCreator === next.isLobbyCreator &&` 뒤에 `prev.domestic === next.domestic &&`를 추가한다.
- `setIfDifferent("isLobbyCreator", ...)` 줄 뒤에 추가:

```ts
  // PlayerDomestic caches its DomesticData until it changes, so identity
  // is equality here.
  setIfDifferent("domestic", prev.domestic === next.domestic);
```

- [ ] **Step 7: 클라이언트 뷰**

`src/client/view/DomesticClientView.ts`:

```ts
import {
  DomesticData,
  DomesticView,
  StatKey,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  ModifierTotals,
  techModifiers,
} from "@openfront/engine-lib/domestic/Modifiers";

/** Client-side DomesticView over the last DomesticData the worker sent. */
export class DomesticClientView implements DomesticView {
  private readonly techSet: ReadonlySet<TechId>;
  private readonly totals: ModifierTotals;

  constructor(public readonly data: DomesticData) {
    this.techSet = new Set(data.techs);
    this.totals = new ModifierTotals(techModifiers(data.techs));
  }

  pct(stat: StatKey): number {
    return this.totals.pct(stat);
  }

  hasTech(tech: TechId): boolean {
    return this.techSet.has(tech);
  }

  recruitTargetPct(): number {
    return this.data.recruitTargetPct;
  }
}
```

`src/client/view/PlayerView.ts`:
- import 추가: `import type { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";`, `import { DomesticClientView } from "./DomesticClientView";`
- 필드 추가(`public cosmetics!: PlayerCosmetics;` 뒤):

```ts
  private _domestic: DomesticClientView | null = null;
```

- 생성자에서 `this.state = playerStateFromUpdate(data);` 뒤에 추가:

```ts
    this._domestic = data.domestic ? new DomesticClientView(data.domestic) : null;
```

- `applyUpdate`의 `applyStateUpdate(this.state, pu);` 뒤에 추가:

```ts
    if (pu.domestic !== undefined) {
      this._domestic = new DomesticClientView(pu.domestic);
    }
```

- 메서드 추가(`troops(): number {` 메서드 뒤):

```ts
  domestic(): DomesticClientView | null {
    return this._domestic;
  }

  /** The last domestic state the worker sent (same object until it changes). */
  domesticData(): DomesticData | null {
    return this._domestic?.data ?? null;
  }
```

- [ ] **Step 8: 스냅샷 비교 제외 필드**

`tests/util/Snapshot.ts`의 `DERIVED_FIELDS`에서 `// PlayerImpl` 그룹 끝(`"nearbyMemo",` 뒤)에 추가:

```ts
  // PlayerDomestic
  "domesticDataCache",
```

- [ ] **Step 9: 통과 확인**

Run: `npx vitest tests/domestic tests/GameUpdateUtils.test.ts tests/core/snapshot --run && npm run typecheck`
Expected: 모두 PASS, typecheck 오류 없음

- [ ] **Step 10: 커밋**

```bash
npx prettier --write packages/engine-api/src packages/engine/src/domestic packages/engine/src/game src/client/view tests/util/Snapshot.ts tests/domestic
git add -A packages src/client/view tests
git commit -m "feat(domestic): add per-player domestic state, sync and snapshots"
```

---

### Task 5: 초당 내정 경제 (DomesticExecution)

**Files:**
- Create: `packages/engine/src/domestic/DomesticEconomy.ts`
- Create: `packages/engine/src/domestic/DomesticExecution.ts`
- Modify: `packages/engine/src/snapshot/ExecutionRegistry.ts`
- Modify: `packages/engine/src/GameRunner.ts`
- Modify: `packages/engine-api/src/game/GameTypes.ts` (`MessageType.RESEARCH_COMPLETE`와 카테고리)
- Modify: `src/client/Utils.ts` (메시지 색)
- Test: `tests/domestic/DomesticEconomy.test.ts`

**Interfaces:**
- Consumes: `PlayerDomestic`(Task 4), Balance, `applyPct`, `TECHS`
- Produces:
  - `finishedLevels(player: Player, type: UnitType): number`
  - `processDomesticSecond(mg: Game, player: Player, d: PlayerDomestic): void`
  - `class DomesticExecution`, `DomesticExecutionSnapshot`
  - `MessageType.RESEARCH_COMPLETE`(메시지 키 `events_display.research_complete`, 파라미터 `{ tech: TechId }`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/DomesticEconomy.test.ts`:

```ts
import {
  MessageType,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { vi } from "vitest";
import { processDomesticSecond } from "@openfront/engine/domestic/DomesticEconomy";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { executeTicks } from "../util/utils";
import { conquerSquare, domesticGame, grantTechs, HUMAN } from "./util";

async function readyPlayer(): Promise<{ game: Game; player: Player }> {
  const game = await domesticGame();
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 10); // 100 of 10,000 land tiles = 1%
  return { game, player };
}

function second(game: Game, player: Player): void {
  processDomesticSecond(game, player, player.domestic()!);
}

describe("domestic economy, one second", () => {
  test("territory yields 0.5 * sqrt(land share %) of each resource", async () => {
    const { game, player } = await readyPlayer();
    second(game, player);
    const d = player.domestic()!;
    expect(d.scienceMilliAvailable()).toBe(500);
    expect(d.politicalMilliAvailable()).toBe(500);
    expect(d.cumulativeScienceMilli()).toBe(500);
  });

  test("nations' output scales with difficulty (Medium x0.85)", async () => {
    const game = await domesticGame();
    const nation = game.addPlayer(
      new PlayerInfo("nation", PlayerType.Nation, null, "nation_id"),
    );
    conquerSquare(game, nation, 50, 50, 10);
    second(game, nation);
    expect(nation.domestic()!.scienceMilliAvailable()).toBe(425);
  });

  test("an institute adds 1/s for 50 gold/s; academia adds 40%", async () => {
    const { game, player } = await readyPlayer();
    player.addGold(1_000_000n);
    player.buildUnit(UnitType.ResearchInstitute, game.ref(5, 5), {});
    grantTechs(player, "academia");
    const goldBefore = player.gold();
    second(game, player);
    expect(player.domestic()!.scienceMilliAvailable()).toBe(1900);
    expect(player.domestic()!.politicalMilliAvailable()).toBe(500);
    expect(player.gold()).toBe(goldBefore - 50n);
  });

  test("institutes stop when upkeep can't be paid", async () => {
    const { game, player } = await readyPlayer();
    player.addGold(100_000n);
    player.buildUnit(UnitType.ResearchInstitute, game.ref(5, 5), {});
    expect(player.gold()).toBe(0n);
    second(game, player);
    expect(player.domestic()!.scienceMilliAvailable()).toBe(500);
    expect(player.gold()).toBe(0n);
  });

  test("troops above 40% of max cost 1.5 gold per 1000 per second", async () => {
    const { game, player } = await readyPlayer();
    player.addGold(1_000_000n);
    const max = game.config().maxTroops(player);
    player.setTroops(max);
    const excess = player.troops() - (max * 40) / 100;
    const due = BigInt(Math.ceil((excess / 1000) * 1.5));
    second(game, player);
    expect(player.gold()).toBe(1_000_000n - due);
  });

  test("desertion: without gold, 1% of the excess leaves each second", async () => {
    const { game, player } = await readyPlayer();
    const max = game.config().maxTroops(player);
    player.setTroops(max);
    const before = player.troops();
    const excess = before - (max * 40) / 100;
    second(game, player);
    expect(player.troops()).toBe(before - Math.ceil(excess / 100));
    expect(player.gold()).toBe(0n);
  });

  test("demobilizes 1% of the excess per second, never below target", async () => {
    const { game, player } = await readyPlayer();
    player.addGold(100_000_000n);
    const max = game.config().maxTroops(player);
    player.setTroops(max);
    player.domestic()!.setRecruitTargetPct(50);
    const before = player.troops();
    const over = before - (max * 50) / 100;
    second(game, player);
    expect(player.troops()).toBe(
      before - Math.min(Math.floor(over), Math.ceil(over / 100)),
    );
    expect(player.troops()).toBeGreaterThanOrEqual((max * 50) / 100);
  });

  test("banking: 2% per minute interest, capped at 1500/s", async () => {
    const { game, player } = await readyPlayer();
    grantTechs(player, "banking");
    player.addGold(3_000_000n);
    second(game, player);
    expect(player.gold()).toBe(3_001_000n);
    player.addGold(5_999_000n); // 9,000,000
    second(game, player);
    expect(player.gold()).toBe(9_001_500n);
  });

  test("research advances a second at a time and announces completion", async () => {
    const { game, player } = await readyPlayer();
    const spy = vi.spyOn(game, "displayMessage");
    player.domestic()!.beginResearch("currency", 20);
    second(game, player);
    expect(player.domestic()!.hasTech("currency")).toBe(false);
    second(game, player);
    expect(player.domestic()!.hasTech("currency")).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      "events_display.research_complete",
      MessageType.RESEARCH_COMPLETE,
      player.id(),
      undefined,
      { tech: "currency" },
    );
  });
});

describe("DomesticExecution", () => {
  test("processes every domestic player once per 10 ticks", async () => {
    const { game, player } = await readyPlayer();
    game.addExecution(new DomesticExecution());
    executeTicks(game, 1); // init
    executeTicks(game, 10);
    expect(player.domestic()!.cumulativeScienceMilli()).toBe(500);
    executeTicks(game, 10);
    expect(player.domestic()!.cumulativeScienceMilli()).toBe(1000);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/DomesticEconomy.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine/domestic/DomesticEconomy'`

- [ ] **Step 3: 메시지 타입 추가**

`packages/engine-api/src/game/GameTypes.ts`의 `MessageType` enum에서 `RENEW_ALLIANCE,` 뒤에 `RESEARCH_COMPLETE,`를 추가한다. `MESSAGE_TYPE_CATEGORIES`의 `[MessageType.CHAT]: MessageCategory.CHAT,` 뒤에 추가:

```ts
  [MessageType.RESEARCH_COMPLETE]: MessageCategory.TRADE,
```

`src/client/Utils.ts`의 `getMessageTypeClasses`에서 `case MessageType.ALLIANCE_ACCEPTED:` 바로 뒤에 `case MessageType.RESEARCH_COMPLETE:`를 추가한다(초록색 "success" 그룹).

- [ ] **Step 4: DomesticEconomy 작성**

`packages/engine/src/domestic/DomesticEconomy.ts`:

```ts
import {
  MessageType,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  BUILDING_UPKEEP_PER_LEVEL,
  BUILDING_YIELD_PER_LEVEL,
  DEMOBILIZE_PCT_PER_SEC,
  DESERTION_PCT_PER_SEC,
  DOMESTIC_INTERVAL_TICKS,
  INTEREST_CAP_PER_SEC,
  INTEREST_DIVISOR_PER_SEC,
  MILLI,
  NATION_YIELD_MULT,
  TERRITORY_YIELD_PER_SQRT_PCT,
  UPKEEP_FREE_BAND_PCT,
  UPKEEP_GOLD_PER_1000_EXCESS,
} from "@openfront/engine-lib/domestic/Balance";
import { applyPct } from "@openfront/engine-lib/domestic/Modifiers";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";
import type { Game, Player } from "../game/Game";
import type { PlayerDomestic } from "./PlayerDomestic";

/** Sum of the levels of a player's finished units of `type`. */
export function finishedLevels(player: Player, type: UnitType): number {
  let levels = 0;
  for (const u of player.units(type)) {
    if (!u.isUnderConstruction()) levels += u.level();
  }
  return levels;
}

/** Pays `levels` worth of building upkeep; false when the player can't. */
function payBuildingUpkeep(player: Player, levels: number): boolean {
  if (levels === 0) return true;
  const due = BigInt(levels) * BUILDING_UPKEEP_PER_LEVEL;
  if (player.gold() < due) return false;
  player.removeGold(due);
  return true;
}

function territoryYield(mg: Game, player: Player): number {
  const land = mg.numLandTiles();
  if (land <= 0) return 0;
  return (
    TERRITORY_YIELD_PER_SQRT_PCT *
    Math.sqrt((player.numTilesOwned() * 100) / land)
  );
}

function yieldMultiplier(mg: Game, player: Player): number {
  return player.type() === PlayerType.Nation
    ? NATION_YIELD_MULT[mg.config().gameConfig().difficulty]
    : 1;
}

function hasInterest(d: PlayerDomestic): boolean {
  for (const t of d.researchedTechs()) {
    if (TECHS[t].interest) return true;
  }
  return false;
}

/**
 * One second of a player's domestic economy (spec §3): building upkeep and
 * output, troop upkeep and desertion, demobilization down to the recruit
 * target, banking interest, then research progress. The order is fixed so
 * every client runs it identically.
 */
export function processDomesticSecond(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
): void {
  const instituteLevels = finishedLevels(player, UnitType.ResearchInstitute);
  const officeLevels = finishedLevels(player, UnitType.AdminOffice);
  const institutesRun = payBuildingUpkeep(player, instituteLevels);
  const officesRun = payBuildingUpkeep(player, officeLevels);

  const territory = territoryYield(mg, player);
  const mult = yieldMultiplier(mg, player);
  const instituteOutput = institutesRun
    ? applyPct(
        instituteLevels * BUILDING_YIELD_PER_LEVEL,
        d.pct("instituteOutput"),
      )
    : 0;
  const officeOutput = officesRun
    ? applyPct(officeLevels * BUILDING_YIELD_PER_LEVEL, d.pct("adminOutput"))
    : 0;
  const science = applyPct(territory + instituteOutput, d.pct("science")) * mult;
  const political =
    applyPct(territory + officeOutput, d.pct("political")) * mult;
  d.addYield(Math.round(science * MILLI), Math.round(political * MILLI));

  const maxTroops = mg.config().maxTroops(player);
  const band =
    (maxTroops * (UPKEEP_FREE_BAND_PCT + d.pct("upkeepFreeBand"))) / 100;
  const excess = player.troops() - band;
  if (excess > 0) {
    const due = BigInt(
      Math.ceil(
        applyPct(
          (excess / 1000) * UPKEEP_GOLD_PER_1000_EXCESS,
          d.pct("troopUpkeep"),
        ),
      ),
    );
    if (player.gold() >= due) {
      player.removeGold(due);
    } else {
      player.removeGold(player.gold());
      player.removeTroops(Math.ceil((excess * DESERTION_PCT_PER_SEC) / 100));
    }
  }

  const target = (maxTroops * d.recruitTargetPct()) / 100;
  const overTarget = player.troops() - target;
  if (overTarget > 0) {
    const drop = Math.min(
      Math.floor(overTarget),
      Math.ceil((overTarget * DEMOBILIZE_PCT_PER_SEC) / 100),
    );
    if (drop > 0) player.removeTroops(drop);
  }

  if (hasInterest(d)) {
    const interest = player.gold() / INTEREST_DIVISOR_PER_SEC;
    const paid =
      interest < INTEREST_CAP_PER_SEC ? interest : INTEREST_CAP_PER_SEC;
    if (paid > 0n) player.addGold(paid);
  }

  const finished = d.advanceResearch(DOMESTIC_INTERVAL_TICKS);
  if (finished !== null) {
    mg.displayMessage(
      "events_display.research_complete",
      MessageType.RESEARCH_COMPLETE,
      player.id(),
      undefined,
      { tech: finished },
    );
  }
}
```

- [ ] **Step 5: DomesticExecution 작성**

`packages/engine/src/domestic/DomesticExecution.ts`:

```ts
import { DOMESTIC_INTERVAL_TICKS } from "@openfront/engine-lib/domestic/Balance";
import { z } from "zod";
import { Execution, Game } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type { ExecRecord, SnapshotReader } from "../snapshot/SnapshotContext";
import { processDomesticSecond } from "./DomesticEconomy";

/** Runs every domestic-mode player's economy once per second (spec §3). */
export class DomesticExecution implements Execution {
  private mg: Game | undefined = undefined;

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (this.mg === undefined || ticks % DOMESTIC_INTERVAL_TICKS !== 0) {
      return;
    }
    for (const player of this.mg.players()) {
      const d = player.domestic();
      if (d !== null && player.isAlive()) {
        processDomesticSecond(this.mg, player, d);
      }
    }
  }

  isActive(): boolean {
    return true;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(): ExecRecord {
    return DomesticExecutionSnapshot.write({
      initialized: this.mg !== undefined,
    });
  }

  restoreSnapshot(s: DomesticExecState, r: SnapshotReader): void {
    this.mg = s.initialized ? r.game : undefined;
  }
}

const DomesticExecStateSchema = z.object({ initialized: z.boolean() });
type DomesticExecState = z.infer<typeof DomesticExecStateSchema>;

export const DomesticExecutionSnapshot = execSnapshotType({
  name: "Domestic",
  version: 1,
  schema: DomesticExecStateSchema,
  cls: () => DomesticExecution,
});
```

- [ ] **Step 6: 등록과 게임 시작 연결**

`packages/engine/src/snapshot/ExecutionRegistry.ts`: import 목록에 `import { DomesticExecutionSnapshot } from "../domestic/DomesticExecution";`를 추가하고, `EXECUTION_SNAPSHOT_TYPES`의 `DeleteUnitExecutionSnapshot,` 뒤에 `DomesticExecutionSnapshot,`를 추가한다.

`packages/engine/src/GameRunner.ts`: `import { DomesticExecution } from "./domestic/DomesticExecution";`를 추가하고, `init()`의 `this.game.addExecution(new WinCheckExecution());` 뒤에 추가:

```ts
    if (this.game.config().domesticMode()) {
      this.game.addExecution(new DomesticExecution());
    }
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest tests/domestic tests/MessageTypeClasses.test.ts tests/core/snapshot --run && npm run typecheck`
Expected: 모두 PASS

- [ ] **Step 8: 커밋**

```bash
npx prettier --write packages/engine/src/domestic packages/engine/src/snapshot/ExecutionRegistry.ts packages/engine/src/GameRunner.ts packages/engine-api/src/game/GameTypes.ts src/client/Utils.ts tests/domestic
git add -A packages src/client/Utils.ts tests/domestic
git commit -m "feat(domestic): run the per-second domestic economy"
```

---

### Task 6: 병력 규칙(회복 보정, 징병 상한)과 징병비

**Files:**
- Create: `packages/engine-lib/src/domestic/Troops.ts`
- Modify: `packages/engine-lib/src/configuration/Config.ts` (`domesticOf`, `maxTroops`, `maxTroopsWithoutCities`, `troopIncreaseRate`)
- Modify: `packages/engine/src/domestic/DomesticEconomy.ts` (`payRecruitment`)
- Modify: `packages/engine/src/execution/PlayerExecution.ts`
- Test: `tests/domestic/Recruitment.test.ts`

**Interfaces:**
- Consumes: `DomesticView`, `applyPct`, Balance의 `RECRUIT_COST_PER_1000_TROOPS`
- Produces:
  - `domesticTroopIncrease(troops: number, baseIncrease: number, maxTroops: number, d: DomesticView): number`
  - `Config.domesticOf(player: PlayerLike): DomesticView | null` (protected; EngineConfig에서도 사용)
  - `payRecruitment(player: Player, troops: number): number` (실제로 늘릴 병력 수 반환)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/Recruitment.test.ts`:

```ts
import { payRecruitment } from "@openfront/engine/domestic/DomesticEconomy";
import { PlayerExecution } from "@openfront/engine/execution/PlayerExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { executeTicks } from "../util/utils";
import { conquerSquare, domesticGame, grantTechs, HUMAN } from "./util";

async function readyPlayer(): Promise<{ game: Game; player: Player }> {
  const game = await domesticGame();
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 10);
  return { game, player };
}

describe("recruitment", () => {
  test("troop growth stops at the recruit target", async () => {
    const { game, player } = await readyPlayer();
    const config = game.config();
    const max = config.maxTroops(player);
    player.domestic()!.setRecruitTargetPct(50);
    player.setTroops(Math.ceil(max * 0.5));
    expect(config.troopIncreaseRate(player)).toBe(0);
    player.setTroops(Math.floor(max * 0.3));
    const inc = config.troopIncreaseRate(player);
    expect(inc).toBeGreaterThan(0);
    expect(player.troops() + inc).toBeLessThanOrEqual((max * 50) / 100);
  });

  test("conscription raises regrowth by 25%", async () => {
    const { game, player } = await readyPlayer();
    player.setTroops(30_000);
    const base = game.config().troopIncreaseRate(player);
    grantTechs(player, "conscription");
    expect(game.config().troopIncreaseRate(player)).toBeCloseTo(base * 1.25, 6);
  });

  test("recruiting costs 50 gold per 1000 troops (35 with conscription)", async () => {
    const { player } = await readyPlayer();
    player.addGold(1_000_000n);
    expect(payRecruitment(player, 2000)).toBe(2000);
    expect(player.gold()).toBe(999_900n);
    grantTechs(player, "conscription");
    expect(payRecruitment(player, 2000)).toBe(2000);
    expect(player.gold()).toBe(999_830n);
  });

  test("recruitment is limited by gold", async () => {
    const { player } = await readyPlayer();
    player.addGold(30n);
    expect(payRecruitment(player, 2000)).toBe(600);
    expect(player.gold()).toBe(0n);
    expect(payRecruitment(player, 2000)).toBe(0);
  });

  test("players without domestic state recruit for free", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    const player = game.player(HUMAN.id);
    expect(payRecruitment(player, 2000)).toBe(2000);
    expect(player.gold()).toBe(0n);
  });

  test("PlayerExecution pays for troop growth", async () => {
    const { game, player } = await readyPlayer();
    player.setTroops(30_000);
    game.addExecution(new PlayerExecution(player));
    executeTicks(game, 21);
    // 20 ticks of 100 gold income, part of it spent on recruiting.
    expect(player.troops()).toBeGreaterThan(30_000);
    expect(player.gold()).toBeLessThan(2000n);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/Recruitment.test.ts --run`
Expected: FAIL — `payRecruitment` is not exported

- [ ] **Step 3: Troops.ts 작성**

`packages/engine-lib/src/domestic/Troops.ts`:

```ts
import { DomesticView } from "@openfront/engine-api/domestic/DomesticTypes";
import { applyPct } from "./Modifiers";

/**
 * Troop growth under domestic rules (spec §3.5): troopRegen scales growth
 * and growth stops at the recruit target. At or above the target growth is
 * zero (DomesticExecution demobilizes the excess gradually); troops over
 * max still snap down like vanilla.
 */
export function domesticTroopIncrease(
  troops: number,
  baseIncrease: number,
  maxTroops: number,
  d: DomesticView,
): number {
  const target = (maxTroops * d.recruitTargetPct()) / 100;
  if (troops >= target) {
    return Math.min(0, maxTroops - troops);
  }
  return (
    Math.min(troops + applyPct(baseIncrease, d.pct("troopRegen")), target) -
    troops
  );
}
```

- [ ] **Step 4: Config 수정**

`packages/engine-lib/src/configuration/Config.ts` import 추가:

```ts
import { DomesticView } from "@openfront/engine-api/domestic/DomesticTypes";
import { applyPct } from "../domestic/Modifiers";
import { domesticTroopIncrease } from "../domestic/Troops";
```

`domesticMode()` 메서드 바로 뒤에 추가:

```ts
  /** The player's domestic view in domestic mode; null otherwise (and for bots). */
  protected domesticOf(player: PlayerLike): DomesticView | null {
    return this.domesticMode() ? player.domestic() : null;
  }
```

`maxTroops`와 `maxTroopsWithoutCities`를 다음으로 바꾼다:

```ts
  maxTroops(player: PlayerLike): number {
    return this.withDomesticMaxTroops(player, this.troopCap(player, true));
  }

  /** maxTroops without what cities add */
  maxTroopsWithoutCities(player: PlayerLike): number {
    return this.withDomesticMaxTroops(player, this.troopCap(player, false));
  }

  private withDomesticMaxTroops(player: PlayerLike, cap: number): number {
    const domestic = this.domesticOf(player);
    return domestic === null ? cap : applyPct(cap, domestic.pct("maxTroops"));
  }
```

`troopIncreaseRate`의 마지막 줄 `return Math.min(player.troops() + toAdd, max) - player.troops();`를 다음으로 바꾼다:

```ts
    const domestic = this.domesticOf(player);
    if (domestic !== null) {
      return domesticTroopIncrease(player.troops(), toAdd, max, domestic);
    }
    return Math.min(player.troops() + toAdd, max) - player.troops();
```

- [ ] **Step 5: payRecruitment 작성**

`packages/engine/src/domestic/DomesticEconomy.ts`의 Balance import에 `RECRUIT_COST_PER_1000_TROOPS`를 추가하고 파일 끝에 추가:

```ts
/**
 * Charges the recruitment cost (spec §3.4) for `troops` new troops and
 * returns how many the player could pay for. Without enough gold it spends
 * what it has on as many troops as that buys.
 */
export function payRecruitment(player: Player, troops: number): number {
  const d = player.domestic();
  if (d === null || troops <= 0) return troops;
  const costPer1000 = applyPct(
    RECRUIT_COST_PER_1000_TROOPS,
    d.pct("recruitCost"),
  );
  if (costPer1000 <= 0) return troops;
  const due = BigInt(Math.ceil((troops * costPer1000) / 1000));
  const gold = player.gold();
  if (gold >= due) {
    player.removeGold(due);
    return troops;
  }
  const affordable = Math.floor((Number(gold) * 1000) / costPer1000);
  player.removeGold(gold);
  return Math.min(troops, affordable);
}
```

- [ ] **Step 6: PlayerExecution 연결**

`packages/engine/src/execution/PlayerExecution.ts`: `import { payRecruitment } from "../domestic/DomesticEconomy";`를 추가하고 다음 두 줄을

```ts
    const troopInc = this.config.troopIncreaseRate(this.player);
    this.player.addTroops(troopInc);
```

다음으로 바꾼다:

```ts
    const troopInc = payRecruitment(
      this.player,
      this.config.troopIncreaseRate(this.player),
    );
    this.player.addTroops(troopInc);
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest tests/domestic --run && npx vitest tests/Disconnected.test.ts tests/DoomsdayClockExecution.test.ts --run && npm run typecheck`
Expected: 모두 PASS(바닐라 PlayerExecution 테스트도 그대로 통과)

- [ ] **Step 8: 커밋**

```bash
npx prettier --write packages/engine-lib/src packages/engine/src/domestic packages/engine/src/execution/PlayerExecution.ts tests/domestic
git add -A packages tests/domestic
git commit -m "feat(domestic): recruit target, troop regen modifiers and recruitment cost"
```

---

### Task 7: 연구·징병 상한 명령(인텐트)

**Files:**
- Modify: `packages/engine-api/src/Schemas.ts` (인텐트 2개)
- Create: `packages/engine/src/domestic/ResearchExecution.ts`
- Create: `packages/engine/src/domestic/SetRecruitTargetExecution.ts`
- Modify: `packages/engine/src/execution/ExecutionManager.ts`
- Modify: `packages/engine/src/snapshot/ExecutionRegistry.ts`
- Test: `tests/domestic/ResearchExecution.test.ts`

**Interfaces:**
- Consumes: `researchBlock`, `researchTicks`, `shortfallGold`, `TECHS`, `MILLI`, `PlayerDomestic`
- Produces:
  - 인텐트 `{ type: "research_tech"; tech: TechId; payWithGold?: boolean }`, `{ type: "set_recruit_target"; percent: number /* 10..100 */ }`
  - `ResearchTechIntent`, `SetRecruitTargetIntent` 타입
  - `new ResearchExecution(player: Player, tech: TechId, payWithGold: boolean)`
  - `new SetRecruitTargetExecution(player: Player, percent: number)`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/ResearchExecution.test.ts`:

```ts
import { IntentSchema } from "@openfront/engine-api/Schemas";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { ResearchExecution } from "@openfront/engine/domestic/ResearchExecution";
import { SetRecruitTargetExecution } from "@openfront/engine/domestic/SetRecruitTargetExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { conquerSquare, domesticGame, grantTechs, HUMAN } from "./util";

async function readyPlayer(): Promise<{ game: Game; player: Player }> {
  const game = await domesticGame();
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 10);
  return { game, player };
}

describe("ResearchExecution", () => {
  test("spends science and starts research", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(150_000, 0);
    game.addExecution(new ResearchExecution(player, "currency", false));
    executeTicks(game, 1);
    expect(d.currentResearch()).toEqual({
      tech: "currency",
      ticksLeft: 200,
      totalTicks: 200,
    });
    expect(d.scienceMilliAvailable()).toBe(50_000);
  });

  test("a shortfall needs payWithGold and enough gold", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(40_000, 0);
    game.addExecution(new ResearchExecution(player, "currency", false));
    executeTicks(game, 1);
    expect(d.currentResearch()).toBeNull();

    player.addGold(59_999n);
    game.addExecution(new ResearchExecution(player, "currency", true));
    executeTicks(game, 1);
    expect(d.currentResearch()).toBeNull();

    player.addGold(1n);
    game.addExecution(new ResearchExecution(player, "currency", true));
    executeTicks(game, 1);
    expect(d.currentResearch()?.tech).toBe("currency");
    expect(player.gold()).toBe(0n);
    expect(d.scienceMilliAvailable()).toBe(0);
  });

  test("refuses era-locked techs and a second research", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(1_000_000, 0);
    game.addExecution(new ResearchExecution(player, "railroad", false));
    executeTicks(game, 1);
    expect(d.currentResearch()).toBeNull();

    game.addExecution(new ResearchExecution(player, "currency", false));
    game.addExecution(new ResearchExecution(player, "academia", false));
    executeTicks(game, 1);
    expect(d.currentResearch()?.tech).toBe("currency");
    expect(d.scienceMilliAvailable()).toBe(900_000);
  });

  test("scientific method shortens research by 30%", async () => {
    const { game, player } = await readyPlayer();
    grantTechs(player, "scientific_method");
    player.domestic()!.addYield(100_000, 0);
    game.addExecution(new ResearchExecution(player, "currency", false));
    executeTicks(game, 1);
    expect(player.domestic()!.currentResearch()?.totalTicks).toBe(140);
  });

  test("SetRecruitTargetExecution sets the target", async () => {
    const { game, player } = await readyPlayer();
    game.addExecution(new SetRecruitTargetExecution(player, 40));
    executeTicks(game, 1);
    expect(player.domestic()!.recruitTargetPct()).toBe(40);
  });

  test("research survives a snapshot and continues identically", async () => {
    const { game, player } = await readyPlayer();
    game.addExecution(new DomesticExecution());
    player.domestic()!.addYield(100_000, 0);
    game.addExecution(new ResearchExecution(player, "currency", false));
    executeTicks(game, 1);
    const restored = await expectSnapshotRoundTrip(game, "plains", 30);
    expect(
      restored.player(HUMAN.id).domestic()!.currentResearch()?.tech,
    ).toBe("currency");
  });

  test("intents validate", () => {
    expect(
      IntentSchema.safeParse({
        type: "research_tech",
        tech: "radar",
        payWithGold: true,
      }).success,
    ).toBe(true);
    expect(
      IntentSchema.safeParse({ type: "research_tech", tech: "warp_drive" })
        .success,
    ).toBe(false);
    expect(
      IntentSchema.safeParse({ type: "set_recruit_target", percent: 5 })
        .success,
    ).toBe(false);
    expect(
      IntentSchema.safeParse({ type: "set_recruit_target", percent: 60 })
        .success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/ResearchExecution.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine/domestic/ResearchExecution'`

- [ ] **Step 3: 인텐트 스키마 추가**

`packages/engine-api/src/Schemas.ts`:
- import 추가: `import { TECH_IDS } from "./domestic/DomesticTypes";`
- `Intent` 유니언 타입의 마지막 `| ToggleGameStartTimer;`를 다음으로 바꾼다:

```ts
  | ToggleGameStartTimer
  | ResearchTechIntent
  | SetRecruitTargetIntent;
```

- 다른 `export type ...Intent = z.infer<...>` 선언들 근처에 추가:

```ts
export type ResearchTechIntent = z.infer<typeof ResearchTechIntentSchema>;
export type SetRecruitTargetIntent = z.infer<
  typeof SetRecruitTargetIntentSchema
>;
```

- `ToggleGameStartTimerIntentSchema` 정의 바로 뒤에 추가:

```ts
// Domestic mode: start researching a tech, paying a science shortfall with
// gold when payWithGold is set.
export const ResearchTechIntentSchema = z.object({
  type: z.literal("research_tech"),
  tech: z.enum(TECH_IDS),
  payWithGold: z.boolean().optional(),
});

// Domestic mode: troops stop regrowing at this percent of max troops.
export const SetRecruitTargetIntentSchema = z.object({
  type: z.literal("set_recruit_target"),
  percent: zb.uint({ min: 10, max: 100 }),
});
```

- `IntentSchema` 목록 끝 `ToggleGameStartTimerIntentSchema,` 뒤에 추가:

```ts
  ResearchTechIntentSchema,
  SetRecruitTargetIntentSchema,
```

- [ ] **Step 4: ResearchExecution 작성**

`packages/engine/src/domestic/ResearchExecution.ts`:

```ts
import {
  TECH_IDS,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import {
  researchBlock,
  researchTicks,
  shortfallGold,
} from "@openfront/engine-lib/domestic/Research";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/** research_tech: pays for a tech and starts researching it (spec §4.1). */
export class ResearchExecution implements Execution {
  constructor(
    private player: Player,
    private tech: TechId,
    private payWithGold: boolean,
  ) {}

  init(_mg: Game, _ticks: number): void {
    const d = this.player.domestic();
    if (d === null || !this.player.isAlive()) return;
    if (
      researchBlock(
        d.researchedTechs(),
        d.currentResearch() !== null,
        this.tech,
      ) !== null
    ) {
      return;
    }
    const costMilli = TECHS[this.tech].cost * MILLI;
    const available = d.scienceMilliAvailable();
    if (available >= costMilli) {
      d.spendScienceMilli(costMilli);
    } else {
      if (!this.payWithGold) return;
      const gold = shortfallGold(
        costMilli - available,
        d.pct("goldPaymentCost"),
      );
      if (this.player.gold() < gold) return;
      this.player.removeGold(gold);
      d.spendScienceMilli(available);
    }
    d.beginResearch(this.tech, researchTicks(this.tech, d.pct("researchTime")));
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return ResearchExecutionSnapshot.write({
      player: w.player(this.player),
      tech: this.tech,
      payWithGold: this.payWithGold,
    });
  }

  restoreSnapshot(s: ResearchState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.tech = s.tech;
    this.payWithGold = s.payWithGold;
  }
}

const ResearchStateSchema = z.object({
  player: zPlayerRef(),
  tech: z.enum(TECH_IDS),
  payWithGold: z.boolean(),
});
type ResearchState = z.infer<typeof ResearchStateSchema>;

export const ResearchExecutionSnapshot = execSnapshotType({
  name: "Research",
  version: 1,
  schema: ResearchStateSchema,
  cls: () => ResearchExecution,
});
```

- [ ] **Step 5: SetRecruitTargetExecution 작성**

`packages/engine/src/domestic/SetRecruitTargetExecution.ts`:

```ts
import { zInt, zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/** set_recruit_target: where troop regrowth stops (spec §3.5). */
export class SetRecruitTargetExecution implements Execution {
  constructor(
    private player: Player,
    private percent: number,
  ) {}

  init(_mg: Game, _ticks: number): void {
    this.player.domestic()?.setRecruitTargetPct(this.percent);
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return SetRecruitTargetExecutionSnapshot.write({
      player: w.player(this.player),
      percent: this.percent,
    });
  }

  restoreSnapshot(s: SetRecruitTargetState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.percent = s.percent;
  }
}

const SetRecruitTargetStateSchema = z.object({
  player: zPlayerRef(),
  percent: zInt(),
});
type SetRecruitTargetState = z.infer<typeof SetRecruitTargetStateSchema>;

export const SetRecruitTargetExecutionSnapshot = execSnapshotType({
  name: "SetRecruitTarget",
  version: 1,
  schema: SetRecruitTargetStateSchema,
  cls: () => SetRecruitTargetExecution,
});
```

- [ ] **Step 6: 명령 연결과 등록**

`packages/engine/src/execution/ExecutionManager.ts`: import 추가

```ts
import { ResearchExecution } from "../domestic/ResearchExecution";
import { SetRecruitTargetExecution } from "../domestic/SetRecruitTargetExecution";
```

`createExec` switch의 `case "toggle_pause":` 블록 뒤(`default:` 앞)에 추가:

```ts
      case "research_tech":
        return new ResearchExecution(
          player,
          intent.tech,
          intent.payWithGold ?? false,
        );
      case "set_recruit_target":
        return new SetRecruitTargetExecution(player, intent.percent);
```

`packages/engine/src/snapshot/ExecutionRegistry.ts`: import에 `ResearchExecutionSnapshot`(`../domestic/ResearchExecution`)과 `SetRecruitTargetExecutionSnapshot`(`../domestic/SetRecruitTargetExecution`)을 추가하고, 배열의 `RecomputeRailClusterExecutionSnapshot,` 뒤에 `ResearchExecutionSnapshot,`, `SAMMissileExecutionSnapshot,` 뒤에 `SetRecruitTargetExecutionSnapshot,`를 추가한다.

- [ ] **Step 7: 통과 확인**

Run: `npx vitest tests/domestic tests/zbin tests/server --run && npm run typecheck`
Expected: 모두 PASS

- [ ] **Step 8: 커밋**

```bash
npx prettier --write packages/engine-api/src/Schemas.ts packages/engine/src/domestic packages/engine/src/execution/ExecutionManager.ts packages/engine/src/snapshot/ExecutionRegistry.ts tests/domestic
git add -A packages tests/domestic
git commit -m "feat(domestic): research_tech and set_recruit_target intents"
```

---

### Task 8: 기술 잠금으로 유닛 막기

**Files:**
- Modify: `packages/engine-api/src/game/GameTypes.ts` (`BuildableUnit.locked`)
- Modify: `packages/engine/src/game/Game.ts` (`Player.isUnitLocked`, `isUnitUnavailable`)
- Modify: `packages/engine/src/game/PlayerImpl.ts`
- Test: `tests/domestic/UnitLocks.test.ts`

**Interfaces:**
- Consumes: `isLockedByTech`(Task 2), `Player.domestic()`(Task 4)
- Produces: `Player.isUnitLocked(type: UnitType): boolean`, `Player.isUnitUnavailable(type: UnitType): boolean`(= 로비에서 꺼짐 또는 잠김), `BuildableUnit.locked?: boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/UnitLocks.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { setup } from "../util/Setup";
import { constructionExecution } from "../util/utils";
import { conquerSquare, domesticGame, grantTechs, HUMAN } from "./util";

describe("tech locks", () => {
  test("factory and nukes are locked until researched", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 20);
    player.addGold(100_000_000n);
    expect(player.isUnitLocked(UnitType.AtomBomb)).toBe(true);
    expect(player.canBuild(UnitType.Factory, game.ref(5, 5))).toBe(false);
    grantTechs(player, "railroad", "rocketry", "manhattan_project");
    expect(player.isUnitLocked(UnitType.AtomBomb)).toBe(false);
    expect(player.canBuild(UnitType.Factory, game.ref(5, 5))).not.toBe(false);
  });

  test("build_unit for a locked unit is rejected", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 20);
    player.addGold(10_000_000n);
    constructionExecution(game, player, 5, 5, UnitType.MissileSilo, 20);
    expect(player.units(UnitType.MissileSilo)).toHaveLength(0);
    expect(player.gold()).toBe(10_000_000n);
  });

  test("buildableUnits marks locked units", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 20);
    const buildables = player.buildableUnits(game.ref(5, 5));
    expect(buildables.find((b) => b.type === UnitType.Warship)?.locked).toBe(
      true,
    );
    expect(buildables.find((b) => b.type === UnitType.City)?.locked).toBe(
      false,
    );
  });

  test("nothing is locked outside domestic mode", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    const player = game.player(HUMAN.id);
    expect(player.isUnitLocked(UnitType.AtomBomb)).toBe(false);
    expect(player.isUnitUnavailable(UnitType.AtomBomb)).toBe(false);
    expect(player.isUnitUnavailable(UnitType.ResearchInstitute)).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/UnitLocks.test.ts --run`
Expected: FAIL — `player.isUnitLocked is not a function`

- [ ] **Step 3: 타입 추가**

`packages/engine-api/src/game/GameTypes.ts`의 `BuildableUnit` 인터페이스에서 `ghostRailPaths: TileRef[][];` 뒤에 추가:

```ts
  /** Domestic mode: the unit needs a tech this player hasn't researched. */
  locked?: boolean;
```

`packages/engine/src/game/Game.ts`의 `Player` 인터페이스에서 `domestic(): PlayerDomestic | null;` 뒤에 추가:

```ts
  /** Domestic mode: `type` needs a tech this player hasn't researched. */
  isUnitLocked(type: UnitType): boolean;
  /** Disabled for the game or locked for this player. */
  isUnitUnavailable(type: UnitType): boolean;
```

- [ ] **Step 4: PlayerImpl 구현**

`packages/engine/src/game/PlayerImpl.ts`:
- import 추가: `import { isLockedByTech } from "@openfront/engine-lib/domestic/Locks";`
- `domestic()` 메서드 뒤에 추가:

```ts
  isUnitLocked(type: UnitType): boolean {
    return isLockedByTech(this._domestic, type);
  }

  isUnitUnavailable(type: UnitType): boolean {
    return this.mg.config().isUnitDisabled(type) || this.isUnitLocked(type);
  }
```

- `canBuildUnitType`의 첫 검사를

```ts
    if (this.mg.config().isUnitDisabled(unitType)) {
      return false;
    }
```

  다음으로 바꾼다:

```ts
    if (this.isUnitUnavailable(unitType)) {
      return false;
    }
```

- `buildableUnits`의 `result[i] = { ... }` 객체에 `ghostRailPaths: ...` 뒤에 `locked: this.isUnitLocked(u),`를 추가한다.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest tests/domestic --run && npm run typecheck`
Expected: 모두 PASS

- [ ] **Step 6: 커밋**

```bash
npx prettier --write packages/engine-api/src/game/GameTypes.ts packages/engine/src/game tests/domestic
git add -A packages tests/domestic
git commit -m "feat(domestic): lock units behind their techs"
```

---

### Task 9: 경제 기술 효과(도시 세수, 건설비, 무역, 방어 기지)

**Files:**
- Modify: `packages/engine/src/configuration/EngineConfig.ts` (`goldAdditionRate`, `costWrapper`, MIRV 비용, `attackLogic`, `AttackLogicInput`)
- Modify: `packages/engine/src/domestic/DomesticEconomy.ts` (무역·스폰·방어 기지 도우미)
- Modify: `packages/engine/src/execution/TradeShipExecution.ts`
- Modify: `packages/engine/src/game/TrainStation.ts`
- Modify: `packages/engine/src/execution/PortExecution.ts`
- Modify: `packages/engine/src/execution/AttackExecution.ts`
- Test: `tests/domestic/TechEffects.test.ts`

**Interfaces:**
- Consumes: `Config.domesticOf`(Task 6), `applyPct`, `capCombinedPct`, `CITY_TAX_PER_LEVEL_PER_TICK`
- Produces:
  - `domesticTradeGold(base: Gold, recipient: Player, partner: Player, kind: "tradeShip" | "train"): Gold`
  - `domesticTradeShipSpawnRate(rate: number, portOwner: Player): number`
  - `domesticDefensePostScale(defender: Player): number`
  - `AttackLogicInput.defender.defensePostScale?: number`(1 = 원작)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/TechEffects.test.ts`:

```ts
import {
  PlayerInfo,
  PlayerType,
  TerrainType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { AttackLogicInput } from "@openfront/engine/configuration/EngineConfig";
import {
  domesticDefensePostScale,
  domesticTradeGold,
  domesticTradeShipSpawnRate,
} from "@openfront/engine/domestic/DomesticEconomy";
import { setup } from "../util/Setup";
import { conquerSquare, domesticGame, grantTechs, HUMAN } from "./util";

const OTHER = new PlayerInfo("other", PlayerType.Human, null, "other_id");
const THIRD = new PlayerInfo("third", PlayerType.Human, null, "third_id");

describe("economy tech effects", () => {
  test("city tax: +15 gold per tick per city level, +50% with currency", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 20);
    player.addGold(1_000_000n);
    player.buildUnit(UnitType.City, game.ref(5, 5), {});
    expect(game.config().goldAdditionRate(player)).toBe(115n);
    grantTechs(player, "currency");
    expect(game.config().goldAdditionRate(player)).toBe(122n);
  });

  test("vanilla gold rate ignores cities", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 20);
    player.addGold(1_000_000n);
    player.buildUnit(UnitType.City, game.ref(5, 5), {});
    expect(game.config().goldAdditionRate(player)).toBe(100n);
  });

  test("globalization: base gold income +30%", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 10);
    grantTechs(player, "globalization");
    expect(game.config().goldAdditionRate(player)).toBe(130n);
  });

  test("navigation: port cost -25%", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    const portCost = () => game.unitInfo(UnitType.Port).cost(game, player);
    expect(portCost()).toBe(125_000n);
    grantTechs(player, "navigation");
    expect(portCost()).toBe(93_750n);
  });

  test("industrialization: structures -15%, nukes unaffected", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    grantTechs(player, "industrialization");
    expect(game.unitInfo(UnitType.City).cost(game, player)).toBe(106_250n);
    expect(game.unitInfo(UnitType.AtomBomb).cost(game, player)).toBe(
      750_000n,
    );
  });

  test("trade payouts are modified per recipient", async () => {
    const game = await domesticGame({}, [HUMAN, OTHER, THIRD]);
    const a = game.player(HUMAN.id);
    const b = game.player(OTHER.id);
    const c = game.player(THIRD.id);
    conquerSquare(game, a, 0, 0, 5);
    conquerSquare(game, b, 50, 50, 5);
    conquerSquare(game, c, 90, 90, 5);
    grantTechs(a, "navigation", "global_trade");
    expect(domesticTradeGold(1000n, a, b, "tradeShip")).toBe(1400n);
    expect(domesticTradeGold(1000n, b, a, "tradeShip")).toBe(1000n);
    expect(domesticTradeGold(1000n, a, a, "train")).toBe(1000n);
    a.createAllianceRequest(b)?.accept();
    expect(a.isAlliedWith(b)).toBe(true);
    expect(domesticTradeGold(1000n, a, b, "train")).toBe(1500n);
    expect(domesticTradeGold(1000n, a, c, "train")).toBe(1000n);
  });

  test("global trade: trade ships spawn 1.5x as often", async () => {
    const game = await domesticGame({}, [HUMAN, OTHER]);
    const a = game.player(HUMAN.id);
    const b = game.player(OTHER.id);
    grantTechs(a, "global_trade");
    expect(domesticTradeShipSpawnRate(100, a)).toBe(66);
    expect(domesticTradeShipSpawnRate(100, b)).toBe(100);
  });

  test("fortification scales the defense-post bonus by +50%", async () => {
    const game = await domesticGame();
    const config = game.config();
    const input = (scale: number | undefined): AttackLogicInput => ({
      terrain: TerrainType.Plains,
      attackTroops: 10_000,
      attacker: { type: PlayerType.Human, numTiles: 1000 },
      defender: {
        type: PlayerType.Human,
        numTiles: 1000,
        troops: 10_000,
        isTraitor: false,
        isDisconnectedTeammate: false,
        defensePostScale: scale,
      },
      defenderHasDefensePost: true,
      falloutRatio: null,
      borderSize: 10,
    });
    const base = config.attackLogic(input(undefined));
    expect(config.attackLogic(input(1))).toEqual(base);
    const bonus = config.defensePostDefenseBonus();
    const fortified = config.attackLogic(input(1.5));
    expect(
      fortified.attackerTroopLoss / base.attackerTroopLoss,
    ).toBeCloseTo((1 + (bonus - 1) * 1.5) / bonus, 6);

    const player = game.player(HUMAN.id);
    expect(domesticDefensePostScale(player)).toBe(1);
    grantTechs(player, "fortification");
    expect(domesticDefensePostScale(player)).toBe(1.5);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/TechEffects.test.ts --run`
Expected: FAIL — `domesticTradeGold` is not exported

- [ ] **Step 3: DomesticEconomy에 도우미 추가**

`packages/engine/src/domestic/DomesticEconomy.ts` import 수정: `@openfront/engine-api/game/GameTypes`에서 `Gold`도 가져오고, `@openfront/engine-lib/domestic/Modifiers`에서 `capCombinedPct`도 가져온다. 파일 끝에 추가:

```ts
/**
 * A trade ship or train payout as `recipient` receives it (spec §7.2):
 * trade, the kind's own stat and allGold always apply; foreignTrade when
 * the partner is someone else; alliedTrade when the partner is an ally.
 * Ships and trains pay the same base amount to both sides, so each side
 * calls this separately.
 */
export function domesticTradeGold(
  base: Gold,
  recipient: Player,
  partner: Player,
  kind: "tradeShip" | "train",
): Gold {
  const d = recipient.domestic();
  if (d === null) return base;
  let pct = d.pct("trade") + d.pct(kind) + d.pct("allGold");
  if (partner !== recipient) {
    pct += d.pct("foreignTrade");
    if (recipient.isAlliedWith(partner)) pct += d.pct("alliedTrade");
  }
  pct = capCombinedPct(pct);
  return pct === 0 ? base : BigInt(Math.round(applyPct(Number(base), pct)));
}

/** tradeShipSpawnRate is "1 in N"; tradeShipSpawn +50% divides N by 1.5. */
export function domesticTradeShipSpawnRate(
  rate: number,
  portOwner: Player,
): number {
  const d = portOwner.domestic();
  if (d === null) return rate;
  const pct = d.pct("tradeShipSpawn");
  return pct === 0 ? rate : Math.max(1, Math.floor(rate / (1 + pct / 100)));
}

/** How strongly the defender's defense posts apply (1 = vanilla). */
export function domesticDefensePostScale(defender: Player): number {
  const d = defender.domestic();
  return d === null ? 1 : 1 + d.pct("defensePost") / 100;
}
```

- [ ] **Step 4: EngineConfig 수정**

`packages/engine/src/configuration/EngineConfig.ts`:
- import 추가:

```ts
import { StatKey } from "@openfront/engine-api/domestic/DomesticTypes";
import { Structures } from "@openfront/engine-api/game/GameTypes";
import { CITY_TAX_PER_LEVEL_PER_TICK } from "@openfront/engine-lib/domestic/Balance";
import {
  applyPct,
  capCombinedPct,
} from "@openfront/engine-lib/domestic/Modifiers";
```

  (`Structures`는 기존 `@openfront/engine-api/game/GameTypes` import 목록에 넣는다. `CITY_TAX_PER_LEVEL_PER_TICK`는 Task 3에서 만든 Balance import 목록에 넣는다.)

- `AttackLogicInput.defender` 객체 타입의 `isDisconnectedTeammate: boolean;` 뒤에 추가:

```ts
    /** Domestic mode: defense-post effect scale (1 = vanilla). */
    defensePostScale?: number;
```

- 파일 상단 상수 영역(`// attackLogic tunables` 위)에 추가:

```ts
/** Domestic mode: the unit-specific build-cost stat (spec §7.2). */
const DOMESTIC_COST_STAT: Partial<Record<UnitType, StatKey>> = {
  [UnitType.Port]: "portCost",
  [UnitType.MissileSilo]: "siloSamCost",
  [UnitType.SAMLauncher]: "siloSamCost",
  [UnitType.AtomBomb]: "nukeCost",
  [UnitType.HydrogenBomb]: "nukeCost",
  [UnitType.MIRV]: "nukeCost",
  [UnitType.DefensePost]: "defensePostCost",
};
```

- `attackLogic`의 방어 기지 블록을

```ts
    if (defender !== null && input.defenderHasDefensePost) {
      mag *= this.defensePostDefenseBonus();
      tileCost *= this.defensePostSpeedBonus();
    }
```

  다음으로 바꾼다:

```ts
    if (defender !== null && input.defenderHasDefensePost) {
      // scale 1 reproduces the vanilla multipliers exactly.
      const scale = defender.defensePostScale ?? 1;
      mag *= 1 + (this.defensePostDefenseBonus() - 1) * scale;
      tileCost *= 1 + (this.defensePostSpeedBonus() - 1) * scale;
    }
```

- `unitCost`의 MIRV 분기 본문을 다음으로 바꾼다:

```ts
      case UnitType.MIRV:
        return (game: Game, player: Player) => {
          if (
            player.type() === PlayerType.Human &&
            this.hasInfiniteGoldFor(player)
          ) {
            return 0n;
          }
          return this.withDomesticCost(
            player,
            UnitType.MIRV,
            25_000_000 + game.mirvsLaunched() * 15_000_000,
          );
        };
```

- `costWrapper`의 마지막 `return BigInt(costFn(numUnits + extraUnits));`를 다음으로 바꾼다:

```ts
      return this.withDomesticCost(
        player,
        types[0],
        costFn(numUnits + extraUnits),
      );
```

- `costWrapper` 바로 뒤에 추가:

```ts
  /** Applies domestic build-cost modifiers (spec §7.2) to a base cost. */
  private withDomesticCost(
    player: Player,
    type: UnitType,
    base: number,
  ): bigint {
    const domestic = this.domesticOf(player);
    if (domestic === null) return BigInt(base);
    let pct = Structures.has(type) ? domestic.pct("buildCost") : 0;
    const stat = DOMESTIC_COST_STAT[type];
    if (stat !== undefined) pct += domestic.pct(stat);
    pct = capCombinedPct(pct);
    return pct === 0 ? BigInt(base) : BigInt(Math.round(applyPct(base, pct)));
  }
```

- `goldAdditionRate`를 다음으로 바꾼다:

```ts
  goldAdditionRate(player: PlayerLike): Gold {
    const multiplier = this.goldMultiplierFor(player);
    let baseRate: bigint;
    if (player.type() === PlayerType.Bot) {
      baseRate = 50n;
    } else {
      baseRate = 100n;
    }
    const domestic = this.domesticOf(player);
    if (domestic === null) {
      return BigInt(Math.floor(Number(baseRate) * multiplier));
    }
    let cityLevels = 0;
    for (const city of player.units(UnitType.City)) {
      if (!city.isUnderConstruction()) cityLevels += city.level();
    }
    const cityTax = applyPct(
      cityLevels * CITY_TAX_PER_LEVEL_PER_TICK,
      domestic.pct("cityTax"),
    );
    const income = applyPct(
      Number(baseRate) + cityTax,
      capCombinedPct(domestic.pct("goldIncome") + domestic.pct("allGold")),
    );
    return BigInt(Math.floor(income * multiplier));
  }
```

- [ ] **Step 5: 지급 지점 연결**

`packages/engine/src/execution/TradeShipExecution.ts`: `import { domesticTradeGold } from "../domestic/DomesticEconomy";`를 추가하고, `complete()`의 마지막 `else` 블록을 다음으로 바꾼다:

```ts
    } else {
      const srcOwner = this.srcPort.owner();
      const dstOwner = this._dstPort.owner();
      const srcGold = domesticTradeGold(gold, srcOwner, dstOwner, "tradeShip");
      const dstGold = domesticTradeGold(gold, dstOwner, srcOwner, "tradeShip");
      srcOwner.addGold(srcGold, this.srcPort.tile());
      dstOwner.addGold(dstGold, this._dstPort.tile());
      srcOwner.addTradeGold(srcGold);
      dstOwner.addTradeGold(dstGold);
      // Record stats
      this.mg.stats().boatArriveTrade(srcOwner, dstOwner, gold);
    }
```

`packages/engine/src/game/TrainStation.ts`: `import { domesticTradeGold } from "../domestic/DomesticEconomy";`를 추가하고, `TradeStationStopHandler.onStop`의 지급 부분(`// Share revenue ...`부터 메서드 끝까지)을 다음으로 바꾼다:

```ts
    // Share revenue with the station owner if it's not the current player
    if (trainOwner !== stationOwner) {
      const stationGold = domesticTradeGold(
        gold,
        stationOwner,
        trainOwner,
        "train",
      );
      stationOwner.addGold(stationGold, station.tile());
      stationOwner.addTrainGold(stationGold);
      mg.stats().trainExternalTrade(stationOwner, gold);
    }
    const ownerGold = domesticTradeGold(gold, trainOwner, stationOwner, "train");
    trainOwner.addGold(ownerGold, station.tile());
    trainOwner.addTrainGold(ownerGold);
    mg.stats().trainSelfTrade(trainOwner, gold);
```

`packages/engine/src/execution/PortExecution.ts`: `import { domesticTradeShipSpawnRate } from "../domestic/DomesticEconomy";`를 추가하고 `shouldSpawnTradeShip`의

```ts
      const spawnRate = this.mg
        .config()
        .tradeShipSpawnRate(this.tradeShipSpawnRejections, numTradeShips);
```

를 다음으로 바꾼다:

```ts
      const spawnRate = domesticTradeShipSpawnRate(
        this.mg
          .config()
          .tradeShipSpawnRate(this.tradeShipSpawnRejections, numTradeShips),
        this.port!.owner(),
      );
```

`packages/engine/src/execution/AttackExecution.ts`: `import { domesticDefensePostScale } from "../domestic/DomesticEconomy";`를 추가하고, `attackLogicInput`의 defender 객체 `isDisconnectedTeammate: ...,` 뒤에 추가:

```ts
              defensePostScale: domesticDefensePostScale(defender),
```

- [ ] **Step 6: 통과 확인(바닐라 골든 테스트 포함)**

Run: `npx vitest tests/domestic tests/AttackLogicGolden.test.ts tests/AttackScenarios.test.ts tests/TradeTrainGolden.test.ts tests/TradeTrainScenarios.test.ts tests/economy tests/PortExecution.test.ts --run && npm run typecheck`
Expected: 모두 PASS. 골든 스냅샷이 바뀌면 안 된다(바뀌면 모드 꺼짐 경로가 원작과 달라진 것이니 수정한다).

- [ ] **Step 7: 커밋**

```bash
npx prettier --write packages/engine/src tests/domestic
git add -A packages tests/domestic
git commit -m "feat(domestic): economic tech effects on income, costs, trade and defense posts"
```

---

### Task 10: AI 국가

**Files:**
- Create: `packages/engine/src/execution/nation/NationDomesticBehavior.ts`
- Modify: `packages/engine/src/execution/NationExecution.ts`
- Modify: `packages/engine/src/execution/nation/NationStructureBehavior.ts`
- Modify(일괄 치환): `NationWarshipBehavior.ts`, `NationMIRVBehavior.ts`, `NationNukeBehavior.ts`, `NationStructureBehavior.ts`, `packages/engine/src/execution/utils/AiAttackBehavior.ts`, `packages/engine/src/execution/NationExecution.ts`
- Test: `tests/domestic/NationDomestic.test.ts`

**Interfaces:**
- Consumes: `ResearchExecution`, `SetRecruitTargetExecution`(Task 7), `researchBlock`, `TECHS`, `Player.isUnitUnavailable`, `Player.isUnitLocked`(Task 8)
- Produces: `nationDomesticTick(mg: Game, player: Player): void`, `BALANCED_RESEARCH_ORDER: readonly TechId[]`, `NATION_PEACE_RECRUIT_TARGET_PCT = 70`, `NATION_WAR_RECRUIT_TARGET_PCT = 100`

> 참고: spec §9.2는 AI의 평시 징병 상한을 50%로 적었다. 하지만 AI 공격은 병력이 최대치의 50~60%(`triggerRatio`)에 닿아야 시작된다. 50%면 AI가 평시에 공격을 시작하지 못한다. 그래서 70%로 둔다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/NationDomestic.test.ts`:

```ts
import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import {
  NATION_PEACE_RECRUIT_TARGET_PCT,
  nationDomesticTick,
} from "@openfront/engine/execution/nation/NationDomesticBehavior";
import { NationStructureBehavior } from "@openfront/engine/execution/nation/NationStructureBehavior";
import { executeTicks } from "../util/utils";
import { conquerSquare, domesticGame, HUMAN } from "./util";

const NATION = new PlayerInfo("nation", PlayerType.Nation, null, "nation_id");

describe("nation domestic behavior", () => {
  test("starts the first affordable tech and sets the peace recruit target", async () => {
    const game = await domesticGame();
    const nation = game.addPlayer(NATION);
    conquerSquare(game, nation, 30, 30, 10);
    nation.domestic()!.addYield(100_000, 0);
    nationDomesticTick(game, nation);
    executeTicks(game, 1);
    expect(nation.domestic()!.currentResearch()?.tech).toBe("currency");
    expect(nation.domestic()!.recruitTargetPct()).toBe(
      NATION_PEACE_RECRUIT_TARGET_PCT,
    );
  });

  test("waits instead of skipping ahead when the next tech is unaffordable", async () => {
    const game = await domesticGame();
    const nation = game.addPlayer(NATION);
    conquerSquare(game, nation, 30, 30, 10);
    nation.domestic()!.addYield(50_000, 0);
    nationDomesticTick(game, nation);
    executeTicks(game, 1);
    expect(nation.domestic()!.currentResearch()).toBeNull();
  });

  test("recruits at 100% while attacked", async () => {
    const game = await domesticGame();
    const human = game.player(HUMAN.id);
    const nation = game.addPlayer(NATION);
    conquerSquare(game, human, 0, 0, 10);
    conquerSquare(game, nation, 10, 0, 10);
    nationDomesticTick(game, nation);
    executeTicks(game, 1);
    expect(nation.domestic()!.recruitTargetPct()).toBe(70);

    human.setTroops(100_000);
    game.addExecution(new AttackExecution(50_000, human, nation.id(), null));
    executeTicks(game, 3);
    expect(nation.incomingAttacks().length).toBeGreaterThan(0);
    nationDomesticTick(game, nation);
    executeTicks(game, 1);
    expect(nation.domestic()!.recruitTargetPct()).toBe(100);
  });

  test("a nation keeps researching over three minutes", async () => {
    const game = await domesticGame();
    const nation = game.addPlayer(NATION);
    conquerSquare(game, nation, 0, 0, 40); // 16% of the land
    game.addExecution(new DomesticExecution());
    for (let t = 0; t < 1800; t += 50) {
      nationDomesticTick(game, nation);
      executeTicks(game, 50);
    }
    expect(nation.domestic()!.researchedTechs().size).toBeGreaterThanOrEqual(2);
  });

  test("nations build research institutes or admin offices", async () => {
    const game = await domesticGame();
    const nation = game.addPlayer(NATION);
    conquerSquare(game, nation, 0, 0, 40);
    nation.addGold(50_000_000n);
    const behavior = new NationStructureBehavior(
      new PseudoRandom(42),
      game,
      nation,
    );
    for (let i = 0; i < 40; i++) {
      behavior.handleStructures();
      executeTicks(game, 100);
    }
    const built =
      nation.units(UnitType.ResearchInstitute).length +
      nation.units(UnitType.AdminOffice).length;
    expect(built).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/NationDomestic.test.ts --run`
Expected: FAIL — `Cannot find module '.../NationDomesticBehavior'`

- [ ] **Step 3: NationDomesticBehavior 작성**

`packages/engine/src/execution/nation/NationDomesticBehavior.ts`:

```ts
import { TechId } from "@openfront/engine-api/domestic/DomesticTypes";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import { researchBlock } from "@openfront/engine-lib/domestic/Research";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";
import { ResearchExecution } from "../../domestic/ResearchExecution";
import { SetRecruitTargetExecution } from "../../domestic/SetRecruitTargetExecution";
import { Game, Player } from "../../game/Game";

/**
 * Phase 1: every nation researches in one balanced order (personalities
 * come in phase 2). It covers every tech, so long games keep progressing.
 */
export const BALANCED_RESEARCH_ORDER: readonly TechId[] = [
  "currency",
  "academia",
  "navigation",
  "bureaucracy",
  "fortification",
  "railroad",
  "conscription",
  "scientific_method",
  "steel_ships",
  "banking",
  "printing_press",
  "rocketry",
  "manhattan_project",
  "industrialization",
  "radar",
  "computers",
  "global_trade",
  "globalization",
  "thermonuclear",
  "mirv",
  "space_program",
];

/**
 * Nations start attacks at 50-60% of max troops (AiAttackBehavior's
 * triggerRatio), so the peacetime target must stay above that or they
 * would never attack. Spec §9.2 says 50%; 70% keeps nations functional.
 */
export const NATION_PEACE_RECRUIT_TARGET_PCT = 70;
export const NATION_WAR_RECRUIT_TARGET_PCT = 100;

/** Recruit target and research for one nation; called on its action tick. */
export function nationDomesticTick(mg: Game, player: Player): void {
  const d = player.domestic();
  if (d === null) return;

  const atWar =
    player.incomingAttacks().length > 0 ||
    player.outgoingAttacks().some((a) => a.target().isPlayer());
  const target = atWar
    ? NATION_WAR_RECRUIT_TARGET_PCT
    : NATION_PEACE_RECRUIT_TARGET_PCT;
  if (d.recruitTargetPct() !== target) {
    mg.addExecution(new SetRecruitTargetExecution(player, target));
  }

  if (d.currentResearch() !== null) return;
  for (const tech of BALANCED_RESEARCH_ORDER) {
    if (researchBlock(d.researchedTechs(), false, tech) !== null) continue;
    // Wait for the next tech in order rather than skipping ahead.
    if (d.scienceMilliAvailable() >= TECHS[tech].cost * MILLI) {
      mg.addExecution(new ResearchExecution(player, tech, false));
    }
    return;
  }
}
```

- [ ] **Step 4: AI의 유닛 사용 가능 검사를 플레이어별로 바꾸기**

다음 명령으로 AI 파일의 `isUnitDisabled` 호출을 `this.player.isUnitUnavailable`로 바꾼다. 내정 모드가 꺼져 있으면 두 값은 같다.

```bash
sed -i -E 's/(this\.game\.config\(\)|this\.mg\.config\(\)|\bgameConfig|\bconfig)\.isUnitDisabled\(/this.player.isUnitUnavailable(/g' \
  packages/engine/src/execution/nation/NationWarshipBehavior.ts \
  packages/engine/src/execution/nation/NationMIRVBehavior.ts \
  packages/engine/src/execution/nation/NationNukeBehavior.ts \
  packages/engine/src/execution/nation/NationStructureBehavior.ts \
  packages/engine/src/execution/utils/AiAttackBehavior.ts \
  packages/engine/src/execution/NationExecution.ts
grep -n "isUnitDisabled" packages/engine/src/execution/nation/*.ts packages/engine/src/execution/utils/AiAttackBehavior.ts packages/engine/src/execution/NationExecution.ts
```

Expected: 마지막 grep 출력 없음

그다음 `npm run typecheck && npx eslint packages/engine/src/execution`를 실행한다. 치환 때문에 쓰이지 않게 된 `const config = this.game.config();` 같은 선언이 오류로 나오면, 그 줄만 지운다.

- [ ] **Step 5: NationStructureBehavior에 새 건물 추가**

`packages/engine/src/execution/nation/NationStructureBehavior.ts`:
- `getStructureRatios` 위에 상수 추가:

```ts
/** Domestic mode: research institutes and admin offices per city (each). */
const DOMESTIC_BUILDING_RATIO_PER_CITY = 0.5;
```

- `getStructureRatios`의 반환 객체에 `[UnitType.MissileSilo]: {...},` 뒤로 추가(모드가 꺼지면 두 건물이 비활성이라 쓰이지 않는다):

```ts
    [UnitType.ResearchInstitute]: {
      ratioPerCity: DOMESTIC_BUILDING_RATIO_PER_CITY,
      perceivedCostIncreasePerOwned: 1,
    },
    [UnitType.AdminOffice]: {
      ratioPerCity: DOMESTIC_BUILDING_RATIO_PER_CITY,
      perceivedCostIncreasePerOwned: 1,
    },
```

- `doHandleStructures`의 `buildOrder`를 다음으로 바꾼다:

```ts
    const buildOrder: UnitType[] = [
      UnitType.Port,
      UnitType.Factory,
      UnitType.ResearchInstitute,
      UnitType.AdminOffice,
      UnitType.SAMLauncher,
      UnitType.MissileSilo,
    ];
```

- `structureSpawnTileValue`의 `case UnitType.City:`를 다음으로 바꾼다:

```ts
      case UnitType.City:
      case UnitType.ResearchInstitute:
      case UnitType.AdminOffice:
        return this.cityValue();
```

- `getSaveUpTarget`의 첫 분기(치환 후 `if (this.player.isUnitUnavailable(UnitType.MissileSilo)) {`)를 다음으로 바꾼다:

```ts
    if (this.player.isUnitUnavailable(UnitType.MissileSilo)) {
      // Domestic mode before Radar: there is nothing worth saving for yet.
      if (this.player.isUnitLocked(UnitType.SAMLauncher)) {
        return 0n;
      }
      return this.cost(UnitType.SAMLauncher);
    }
```

- [ ] **Step 6: NationExecution에서 호출**

`packages/engine/src/execution/NationExecution.ts`: `import { nationDomesticTick } from "./nation/NationDomesticBehavior";`를 추가하고, 공격 틱 블록의 `this.structureBehavior.handleStructures();` 다음 줄(`this.warshipBehavior.maybeSpawnWarship();` 앞)에 추가:

```ts
    nationDomesticTick(this.mg, this.player);
```

- [ ] **Step 7: 통과 확인(기존 AI 테스트 포함)**

Run: `npx vitest tests/domestic --run && npx vitest Nation AiAttackBehavior --run && npm run typecheck`
Expected: 모두 PASS(기존 Nation*·AiAttackBehavior 테스트는 모드 꺼짐이라 변화 없음)

- [ ] **Step 8: 커밋**

```bash
npx prettier --write packages/engine/src/execution tests/domestic
git add -A packages tests/domestic
git commit -m "feat(domestic): nations research, manage recruitment and build domestic buildings"
```

---

### Task 11: 번역(en, ko)과 CLAUDE.md 다국어 규칙

**Files:**
- Modify: `resources/lang/en.json`, `resources/lang/ko.json`(jq로 병합)
- Modify: `CLAUDE.md`("UI Text / i18n" 절)
- Test: `tests/domestic/I18n.test.ts`

**Interfaces:**
- Produces(이후 Task가 쓰는 키): `unit_type.research_institute`, `unit_type.admin_office`, `build_menu.desc.research_institute`, `build_menu.desc.admin_office`, `game_settings.domestic_mode`, `events_display.research_complete`(`{tech}`), `domestic.*`(아래 조각 전체), `domestic.tech.<TechId>.name|desc`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/I18n.test.ts`:

```ts
import { TECH_IDS } from "@openfront/engine-api/domestic/DomesticTypes";
import fs from "fs";
import path from "path";

function load(lang: string): unknown {
  return JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "..", "resources", "lang", `${lang}.json`),
      "utf8",
    ),
  );
}

function get(obj: unknown, dotted: string): unknown {
  return dotted
    .split(".")
    .reduce<unknown>(
      (o, k) =>
        o !== null && typeof o === "object"
          ? (o as Record<string, unknown>)[k]
          : undefined,
      obj,
    );
}

const KEYS = [
  "unit_type.research_institute",
  "unit_type.admin_office",
  "build_menu.desc.research_institute",
  "build_menu.desc.admin_office",
  "game_settings.domestic_mode",
  "events_display.research_complete",
  "domestic.panel_title",
  "domestic.recruit_target",
  "domestic.locked_requires",
];

describe("domestic translations", () => {
  test.each(["en", "ko"])("%s has every domestic key", (lang) => {
    const json = load(lang);
    for (const key of KEYS) {
      expect(typeof get(json, key), key).toBe("string");
    }
    for (const id of TECH_IDS) {
      expect(typeof get(json, `domestic.tech.${id}.name`), id).toBe("string");
      expect(typeof get(json, `domestic.tech.${id}.desc`), id).toBe("string");
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/I18n.test.ts --run`
Expected: FAIL — `unit_type.research_institute: expected 'undefined' to be 'string'`

- [ ] **Step 3: 영어 조각 작성**

```bash
mkdir -p .i18n-domestic
cat > .i18n-domestic/en.json <<'EOF'
{
  "build_menu": {
    "desc": {
      "admin_office": "Produces political power. Upkeep 50 gold/s per level.",
      "research_institute": "Produces science. Upkeep 50 gold/s per level."
    }
  },
  "domestic": {
    "blocked": {
      "busy": "Another research is in progress",
      "era": "Needs 2 techs from the previous era",
      "prereq": "Needs {tech}"
    },
    "branch": {
      "economy": "Economy",
      "learning": "Learning",
      "military": "Military"
    },
    "cost": "{cost} science · {seconds}s",
    "era": "Era {era}",
    "locked_requires": "Requires {tech}",
    "open_panel": "Domestic",
    "panel_title": "Domestic Affairs",
    "pay_with_gold": "Pay {gold} gold",
    "per_sec": "+{value}/s",
    "political": "Political Power",
    "recruit_target": "Recruit up to {pct}%",
    "research": "Research",
    "research_progress": "Researching {tech}: {seconds}s left",
    "researched": "Researched",
    "researching": "Researching",
    "science": "Science",
    "tab_tech": "Technology",
    "tech": {
      "academia": { "desc": "Research institute output +40%", "name": "Academia" },
      "banking": { "desc": "Stored gold earns 2% per minute (max 1,500/s)", "name": "Banking" },
      "bureaucracy": { "desc": "Admin office output +40%", "name": "Bureaucracy" },
      "computers": { "desc": "Science +30%, political power +15%", "name": "Computers" },
      "conscription": { "desc": "Troop growth +25%, recruitment cost -30%", "name": "Conscription" },
      "currency": { "desc": "City tax +50%", "name": "Currency" },
      "fortification": { "desc": "Defense post effect +50%, defense post cost -30%", "name": "Fortification" },
      "global_trade": { "desc": "Trade ships spawn +50%, allied trade income +50%", "name": "Global Trade" },
      "globalization": { "desc": "All gold income +30%", "name": "Globalization" },
      "industrialization": { "desc": "Train income +50%, structure cost -15%", "name": "Industrialization" },
      "manhattan_project": { "desc": "Unlocks atom bombs", "name": "Manhattan Project" },
      "mirv": { "desc": "Unlocks MIRVs", "name": "MIRV" },
      "navigation": { "desc": "Trade ship income +40%, port cost -25%", "name": "Navigation" },
      "printing_press": { "desc": "Political power +25%, law cost -15%", "name": "Printing Press" },
      "radar": { "desc": "Unlocks SAM launchers", "name": "Radar" },
      "railroad": { "desc": "Unlocks factories", "name": "Railroad" },
      "rocketry": { "desc": "Unlocks missile silos", "name": "Rocketry" },
      "scientific_method": { "desc": "Research time -30%, science +15%", "name": "Scientific Method" },
      "space_program": { "desc": "Enables the space race (science victory, coming later)", "name": "Space Program" },
      "steel_ships": { "desc": "Unlocks warships", "name": "Steel Ships" },
      "thermonuclear": { "desc": "Unlocks hydrogen bombs", "name": "Thermonuclear Weapons" }
    }
  },
  "events_display": {
    "research_complete": "Research complete: {tech}"
  },
  "game_settings": {
    "domestic_mode": "Domestic Mode"
  },
  "unit_type": {
    "admin_office": "Admin Office",
    "research_institute": "Research Institute"
  }
}
EOF
```

- [ ] **Step 4: 한국어 조각 작성**

```bash
cat > .i18n-domestic/ko.json <<'EOF'
{
  "build_menu": {
    "desc": {
      "admin_office": "정치력을 생산합니다. 레벨당 초당 금 50 유지비.",
      "research_institute": "과학력을 생산합니다. 레벨당 초당 금 50 유지비."
    }
  },
  "domestic": {
    "blocked": {
      "busy": "다른 연구가 진행 중입니다",
      "era": "이전 시대 기술 2개가 필요합니다",
      "prereq": "{tech} 필요"
    },
    "branch": {
      "economy": "경제",
      "learning": "학문",
      "military": "군사"
    },
    "cost": "과학력 {cost} · {seconds}초",
    "era": "{era}시대",
    "locked_requires": "{tech} 연구 필요",
    "open_panel": "국정",
    "panel_title": "국정",
    "pay_with_gold": "금 {gold}으로 연구",
    "per_sec": "+{value}/초",
    "political": "정치력",
    "recruit_target": "징병 상한 {pct}%",
    "research": "연구",
    "research_progress": "{tech} 연구 중: {seconds}초 남음",
    "researched": "연구 완료",
    "researching": "연구 중",
    "science": "과학력",
    "tab_tech": "기술",
    "tech": {
      "academia": { "desc": "연구소 생산 +40%", "name": "학술 기관" },
      "banking": { "desc": "보유 금에 분당 2% 이자 (최대 초당 1,500)", "name": "은행업" },
      "bureaucracy": { "desc": "행정청 생산 +40%", "name": "관료제" },
      "computers": { "desc": "과학력 +30%, 정치력 +15%", "name": "컴퓨터" },
      "conscription": { "desc": "병력 회복 +25%, 징병비 -30%", "name": "징병제" },
      "currency": { "desc": "도시 세수 +50%", "name": "화폐 주조" },
      "fortification": { "desc": "방어 기지 효과 +50%, 방어 기지 건설비 -30%", "name": "요새 축성" },
      "global_trade": { "desc": "무역선 출현 +50%, 동맹과의 무역 수익 +50%", "name": "국제 무역" },
      "globalization": { "desc": "모든 금 수입 +30%", "name": "세계화" },
      "industrialization": { "desc": "기차 수익 +50%, 모든 건설비 -15%", "name": "산업화" },
      "manhattan_project": { "desc": "원자폭탄 해금", "name": "맨해튼 프로젝트" },
      "mirv": { "desc": "MIRV 해금", "name": "다탄두 미사일" },
      "navigation": { "desc": "무역선 수익 +40%, 항구 건설비 -25%", "name": "항해술" },
      "printing_press": { "desc": "정치력 +25%, 법 선포 비용 -15%", "name": "인쇄술" },
      "radar": { "desc": "SAM 해금", "name": "레이더" },
      "railroad": { "desc": "공장 해금", "name": "철도" },
      "rocketry": { "desc": "미사일 기지 해금", "name": "로켓 공학" },
      "scientific_method": { "desc": "연구 시간 -30%, 과학력 +15%", "name": "과학적 방법" },
      "space_program": { "desc": "우주 계획 착수 가능 (과학 승리, 이후 단계)", "name": "우주 개발" },
      "steel_ships": { "desc": "전함 해금", "name": "강철 함선" },
      "thermonuclear": { "desc": "수소폭탄 해금", "name": "열핵 무기" }
    }
  },
  "events_display": {
    "research_complete": "연구 완료: {tech}"
  },
  "game_settings": {
    "domestic_mode": "내정 모드"
  },
  "unit_type": {
    "admin_office": "행정청",
    "research_institute": "연구소"
  }
}
EOF
```

- [ ] **Step 5: 병합**

en.json은 키 정렬을 유지해야 하므로 `jq -S`로 병합하고, ko.json은 순서를 건드리지 않고 병합한다. 두 파일 모두 `jq` 왕복 시 바이트가 같게 유지되는 것을 확인했다.

```bash
jq -S --slurpfile frag .i18n-domestic/en.json '. * $frag[0]' resources/lang/en.json > .i18n-domestic/en.out && mv .i18n-domestic/en.out resources/lang/en.json
jq --slurpfile frag .i18n-domestic/ko.json '. * $frag[0]' resources/lang/ko.json > .i18n-domestic/ko.out && mv .i18n-domestic/ko.out resources/lang/ko.json
rm -rf .i18n-domestic
npx prettier --write resources/lang/en.json resources/lang/ko.json
git diff --stat resources/lang
```

Expected: en.json, ko.json에 추가만 있고 기존 줄 삭제는 없다.

- [ ] **Step 6: CLAUDE.md 규칙 수정**

`CLAUDE.md`의 "## UI Text / i18n" 절 본문

```
All user-visible text must go through `translateText()` and have a corresponding entry added to `resources/lang/en.json`. Translations are managed via Crowdin. DO NOT modify any other translation files.
```

를 다음으로 바꾼다:

```
All user-visible text must go through `translateText()` and have a corresponding entry added to both `resources/lang/en.json` and `resources/lang/ko.json` (this fork plays in Korean and does not use Crowdin). DO NOT modify any other translation files.
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest tests/domestic/I18n.test.ts tests/EnJsonSorted.test.ts tests/TranslationSystem.test.ts --run`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add resources/lang/en.json resources/lang/ko.json CLAUDE.md tests/domestic/I18n.test.ts
git commit -m "feat(domestic): English and Korean strings for domestic mode"
```

---

### Task 12: 클라이언트 연결(명령 이벤트, 빌드 메뉴 잠금, 지도 아이콘, 이벤트 문구)

**Files:**
- Modify: `src/client/Transport.ts`
- Create: `resources/images/ResearchInstituteIconWhite.svg`, `resources/images/AdminOfficeIconWhite.svg`
- Modify: `src/client/hud/layers/BuildMenu.ts`
- Modify: `src/client/hud/layers/UnitDisplay.ts`
- Modify: `src/client/render/types/UnitType.ts`, `src/client/render/types/index.ts`
- Modify: `src/client/render/gl/passes/StructurePass.ts`, `src/client/render/gl/passes/StructureLevelPass.ts`
- Modify: `src/client/hud/layers/EventsDisplay.ts`
- Test: `tests/client/DomesticClient.test.ts`

**Interfaces:**
- Consumes: `DomesticClientView`(Task 4), `requiredTech`(Task 2), 번역 키(Task 11)
- Produces:
  - `class ResearchTechIntentEvent { constructor(tech: TechId, payWithGold: boolean) }`
  - `class SetRecruitTargetIntentEvent { constructor(percent: number) }`
  - `UT_RESEARCH_INSTITUTE`, `UT_ADMIN_OFFICE`, `STRUCTURE_ICON_ALIAS: Readonly<Record<string, string>>`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/DomesticClient.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  ALL_UNIT_TYPES,
  STRUCTURE_ICON_ALIAS,
  STRUCTURE_TYPES,
  UT_ADMIN_OFFICE,
  UT_CITY,
  UT_DEFENSE_POST,
  UT_RESEARCH_INSTITUTE,
} from "../../src/client/render/types/UnitType";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";

describe("DomesticClientView", () => {
  test("derives modifiers and techs from the wire data", () => {
    const view = new DomesticClientView({
      science: 0,
      political: 0,
      cumulativeScience: 0,
      cumulativePolitical: 0,
      sciencePerSec: 0,
      politicalPerSec: 0,
      techs: ["computers", "conscription"],
      research: null,
      recruitTargetPct: 60,
    });
    expect(view.pct("science")).toBe(30);
    expect(view.pct("troopRegen")).toBe(25);
    expect(view.hasTech("computers")).toBe(true);
    expect(view.hasTech("radar")).toBe(false);
    expect(view.recruitTargetPct()).toBe(60);
  });
});

describe("domestic structures in the renderer", () => {
  test("render strings match the engine's unit types", () => {
    expect(UT_RESEARCH_INSTITUTE).toBe(UnitType.ResearchInstitute);
    expect(UT_ADMIN_OFFICE).toBe(UnitType.AdminOffice);
  });

  test("they are structures drawn with a borrowed atlas icon", () => {
    expect(STRUCTURE_TYPES.has(UT_RESEARCH_INSTITUTE)).toBe(true);
    expect(STRUCTURE_TYPES.has(UT_ADMIN_OFFICE)).toBe(true);
    expect(STRUCTURE_ICON_ALIAS[UT_RESEARCH_INSTITUTE]).toBe(UT_CITY);
    expect(STRUCTURE_ICON_ALIAS[UT_ADMIN_OFFICE]).toBe(UT_DEFENSE_POST);
    expect(ALL_UNIT_TYPES).toContain(UT_RESEARCH_INSTITUTE);
    expect(ALL_UNIT_TYPES).toContain(UT_ADMIN_OFFICE);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/DomesticClient.test.ts --run`
Expected: FAIL — `UT_RESEARCH_INSTITUTE` is not exported

- [ ] **Step 3: 렌더러 유닛 타입**

`src/client/render/types/UnitType.ts`:
- `export const UT_MISSILE_SILO = "Missile Silo" as const;` 뒤에 추가:

```ts
// Domestic mode structures
export const UT_RESEARCH_INSTITUTE = "Research Institute" as const;
export const UT_ADMIN_OFFICE = "Admin Office" as const;
```

- `STRUCTURE_TYPES`의 `UT_MISSILE_SILO,` 뒤에 `UT_RESEARCH_INSTITUTE,`와 `UT_ADMIN_OFFICE,`를 추가한다.
- `ALL_UNIT_TYPES` 배열 끝 `UT_TRAIN,` 뒤에 `UT_RESEARCH_INSTITUTE,`와 `UT_ADMIN_OFFICE,`를 추가한다.
- 파일 끝에 추가:

```ts
/**
 * Domestic-mode structures have no atlas column of their own yet; they are
 * drawn with an existing structure's icon until the atlas gains real ones.
 */
export const STRUCTURE_ICON_ALIAS: Readonly<Record<string, string>> = {
  [UT_RESEARCH_INSTITUTE]: UT_CITY,
  [UT_ADMIN_OFFICE]: UT_DEFENSE_POST,
};
```

`src/client/render/types/index.ts`의 `./UnitType` export 목록에 `STRUCTURE_ICON_ALIAS`, `UT_ADMIN_OFFICE`, `UT_RESEARCH_INSTITUTE`를 알파벳 순서 위치에 추가한다.

- [ ] **Step 4: 구조물 패스에서 별칭 사용**

`src/client/render/gl/passes/StructurePass.ts`: `../../types` import 목록에 `STRUCTURE_ICON_ALIAS`를 추가하고, 생성자의 매핑 루프를 다음으로 바꾼다:

```ts
    // Build unitType string → atlas column mapping
    for (let i = 0; i < header.unitTypes.length; i++) {
      const type = header.unitTypes[i];
      const col = STRUCTURE_ORDER.indexOf(
        (STRUCTURE_ICON_ALIAS[type] ?? type) as (typeof STRUCTURE_ORDER)[number],
      );
      if (col >= 0) {
        this.typeToAtlasCol.set(type, col);
      }
    }
```

`src/client/render/gl/passes/StructureLevelPass.ts`도 import에 `STRUCTURE_ICON_ALIAS`를 추가하고 같은 루프를 다음으로 바꾼다:

```ts
    // Build unitType string → atlas column mapping
    for (let i = 0; i < header.unitTypes.length; i++) {
      const type = header.unitTypes[i];
      const col = STRUCTURE_ORDER.indexOf(
        (STRUCTURE_ICON_ALIAS[type] ?? type) as (typeof STRUCTURE_ORDER)[number],
      );
      if (col >= 0) this.typeToAtlasCol.set(type, col);
    }
```

- [ ] **Step 5: 명령 이벤트**

`src/client/Transport.ts`:
- import 추가: `import { TechId } from "@openfront/engine-api/domestic/DomesticTypes";`
- `BuildUnitIntentEvent` 클래스 뒤에 추가:

```ts
export class ResearchTechIntentEvent implements GameEvent {
  constructor(
    public readonly tech: TechId,
    public readonly payWithGold: boolean,
  ) {}
}

export class SetRecruitTargetIntentEvent implements GameEvent {
  constructor(public readonly percent: number) {}
}
```

- 구독 블록의 `this.subscribe(SendUpgradeStructureIntentEvent, ...)` 다음에 추가:

```ts
    this.subscribe(ResearchTechIntentEvent, (e) =>
      this.onResearchTechIntent(e),
    );
    this.subscribe(SetRecruitTargetIntentEvent, (e) =>
      this.onSetRecruitTargetIntent(e),
    );
```

- `onSendUpgradeStructureIntent` 메서드 뒤에 추가:

```ts
  private onResearchTechIntent(event: ResearchTechIntentEvent) {
    this.sendIntent({
      type: "research_tech",
      tech: event.tech,
      payWithGold: event.payWithGold,
    });
  }

  private onSetRecruitTargetIntent(event: SetRecruitTargetIntentEvent) {
    this.sendIntent({
      type: "set_recruit_target",
      percent: event.percent,
    });
  }
```

- [ ] **Step 6: 빌드 메뉴 아이콘**

`resources/images/ResearchInstituteIconWhite.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff"><path d="M9 2h6v2h-1v5.2l5.6 9.7A2 2 0 0 1 17.9 22H6.1a2 2 0 0 1-1.7-3.1L10 9.2V4H9V2zm3 9.1L8.4 17h7.2L12 11.1z"/></svg>
```

`resources/images/AdminOfficeIconWhite.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff"><path d="M12 2 2 7v2h20V7L12 2zM4 11v7h3v-7H4zm6.5 0v7h3v-7h-3zM17 11v7h3v-7h-3zM2 20v2h20v-2H2z"/></svg>
```

- [ ] **Step 7: 빌드 메뉴 항목과 잠금 표시**

`src/client/hud/layers/BuildMenu.ts`:
- import 추가: `import { requiredTech } from "@openfront/engine-lib/domestic/Locks";`
- 아이콘 상수 목록 끝에 추가:

```ts
const researchInstituteIcon = assetUrl(
  "images/ResearchInstituteIconWhite.svg",
);
const adminOfficeIcon = assetUrl("images/AdminOfficeIconWhite.svg");
```

- `buildTable`의 Factory 항목 뒤에 추가:

```ts
    {
      unitType: UnitType.ResearchInstitute,
      icon: researchInstituteIcon,
      description: "build_menu.desc.research_institute",
      key: "unit_type.research_institute",
      countable: true,
    },
    {
      unitType: UnitType.AdminOffice,
      icon: adminOfficeIcon,
      description: "build_menu.desc.admin_office",
      key: "unit_type.admin_office",
      countable: true,
    },
```

- `render()`의 버튼 `title=${!enabled ? translateText("build_menu.not_enough_money") : ""}`를 `title=${this.disabledReason(buildableUnit, enabled)}`로 바꾼다.
- 같은 버튼의 이름 부분 `${item.key && translateText(item.key)}`를 `${item.key && translateText(item.key)}${buildableUnit.locked ? " 🔒" : ""}`로 바꾼다.
- `sendBuildOrUpgrade` 메서드 뒤에 추가:

```ts
  private disabledReason(
    buildableUnit: BuildableUnit,
    enabled: boolean,
  ): string {
    if (enabled) return "";
    if (buildableUnit.locked) {
      const tech = requiredTech(buildableUnit.type);
      return translateText("domestic.locked_requires", {
        tech:
          tech === null ? "" : translateText(`domestic.tech.${tech}.name`),
      });
    }
    return translateText("build_menu.not_enough_money");
  }
```

- [ ] **Step 8: 단축바에서 잠긴 유닛 비활성화**

`src/client/hud/layers/UnitDisplay.ts`의 `canBuild`에서 `if (this.game?.config().isUnitDisabled(item)) return false;` 다음 줄에 추가:

```ts
    if (this.playerBuildables?.find((bu) => bu.type === item)?.locked) {
      return false;
    }
```

- [ ] **Step 9: 연구 완료 메시지의 기술 이름 번역**

`src/client/hud/layers/EventsDisplay.ts`의 `resolveParams`에서 `unit` 번역 `if` 블록 뒤에 추가:

```ts
    if (
      event.message === "events_display.research_complete" &&
      typeof params.tech === "string"
    ) {
      params = {
        ...params,
        tech: translateText(`domestic.tech.${params.tech}.name`),
      };
    }
```

- [ ] **Step 10: 통과 확인**

Run: `npx vitest tests/client --run && npm run typecheck`
Expected: 모두 PASS

- [ ] **Step 11: 커밋**

```bash
npx prettier --write src/client resources/images/ResearchInstituteIconWhite.svg resources/images/AdminOfficeIconWhite.svg tests/client/DomesticClient.test.ts
git add -A src/client resources/images tests/client
git commit -m "feat(domestic): client intents, build menu locks and domestic structure icons"
```

---

### Task 13: 국정 HUD와 국정 패널(기술 탭)

**Files:**
- Create: `src/client/hud/domestic/DomesticEvents.ts`
- Create: `src/client/hud/domestic/DomesticHud.ts`
- Create: `src/client/hud/domestic/DomesticPanel.ts`
- Modify: `index.html`
- Modify: `src/client/hud/GameRenderer.ts`

**Interfaces:**
- Consumes: `PlayerView.domesticData()`, `PlayerView.domestic()`(Task 4), `ResearchTechIntentEvent`, `SetRecruitTargetIntentEvent`(Task 12), `TECHS`, `researchBlock`, `shortfallGold`, Balance 상수, 번역 키(Task 11)
- Produces: `<domestic-hud>`, `<domestic-panel>`, `ToggleDomesticPanelEvent`

> 1단계 범위 밖: 패널 단축키와 단축바(1~0)의 연구소·행정청 칸은 넣지 않는다. 패널은 HUD 버튼으로 열고, 두 건물은 빌드 메뉴와 원형 메뉴로 짓는다.

- [ ] **Step 1: 패널 토글 이벤트**

`src/client/hud/domestic/DomesticEvents.ts`:

```ts
import { GameEvent } from "@openfront/shared/EventBus";

/** Opens or closes the domestic panel. */
export class ToggleDomesticPanelEvent implements GameEvent {}
```

- [ ] **Step 2: HUD 작성**

`src/client/hud/domestic/DomesticHud.ts`:

```ts
import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  RECRUIT_TARGET_MAX_PCT,
  RECRUIT_TARGET_MIN_PCT,
} from "@openfront/engine-lib/domestic/Balance";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SetRecruitTargetIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { GameView } from "../../view";
import { ToggleDomesticPanelEvent } from "./DomesticEvents";

/** Science, political power, the recruit-target slider and the panel button. */
@customElement("domestic-hud")
export class DomesticHud extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;

  @state() private data: DomesticData | null = null;
  /** Slider value while the intent round-trips. */
  @state() private pendingTarget: number | null = null;

  createRenderRoot() {
    return this;
  }

  tick() {
    const me = this.game?.myPlayer();
    const next =
      me && me.isAlive() && !this.game.inSpawnPhase()
        ? me.domesticData()
        : null;
    if (next === this.data) return;
    this.data = next;
    if (next !== null && this.pendingTarget === next.recruitTargetPct) {
      this.pendingTarget = null;
    }
  }

  private onTargetInput(e: Event) {
    this.pendingTarget = Number((e.target as HTMLInputElement).value);
  }

  private onTargetChange(e: Event) {
    const pct = Number((e.target as HTMLInputElement).value);
    this.pendingTarget = pct;
    this.eventBus.emit(new SetRecruitTargetIntentEvent(pct));
  }

  render() {
    const d = this.data;
    if (d === null) return null;
    const target = this.pendingTarget ?? d.recruitTargetPct;
    return html`
      <div
        class="flex flex-wrap items-center gap-2 px-2 py-1 border-t border-white/10 text-xs text-white"
      >
        <span title=${translateText("domestic.science")}>
          🔬 ${d.science}
          <span class="text-green-400"
            >${translateText("domestic.per_sec", {
              value: d.sciencePerSec.toFixed(1),
            })}</span
          >
        </span>
        <span title=${translateText("domestic.political")}>
          🏛️ ${d.political}
          <span class="text-green-400"
            >${translateText("domestic.per_sec", {
              value: d.politicalPerSec.toFixed(1),
            })}</span
          >
        </span>
        <label class="flex items-center gap-1 flex-1 min-w-[10rem]">
          <span class="whitespace-nowrap"
            >${translateText("domestic.recruit_target", { pct: target })}</span
          >
          <input
            type="range"
            class="flex-1"
            min=${RECRUIT_TARGET_MIN_PCT}
            max=${RECRUIT_TARGET_MAX_PCT}
            step="5"
            .value=${String(target)}
            @input=${this.onTargetInput}
            @change=${this.onTargetChange}
          />
        </label>
        <button
          class="px-2 py-0.5 rounded-sm bg-slate-600 hover:bg-slate-500"
          @click=${() => this.eventBus.emit(new ToggleDomesticPanelEvent())}
        >
          ${translateText("domestic.open_panel")}
        </button>
      </div>
    `;
  }
}
```

- [ ] **Step 3: 패널 작성**

`src/client/hud/domestic/DomesticPanel.ts`:

```ts
import {
  DomesticData,
  TECH_IDS,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import {
  ResearchBlock,
  researchBlock,
  shortfallGold,
} from "@openfront/engine-lib/domestic/Research";
import { Branch, Era, TECHS } from "@openfront/engine-lib/domestic/Techs";
import { renderNumber } from "@openfront/engine-lib/Format";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { ResearchTechIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { GameView } from "../../view";
import { PlayerView } from "../../view/PlayerView";
import { ToggleDomesticPanelEvent } from "./DomesticEvents";

const ERAS: readonly Era[] = [1, 2, 3, 4];
const BRANCHES: readonly Branch[] = ["economy", "military", "learning"];

/** The domestic panel. Phase 1 has the technology tab only. */
@customElement("domestic-panel")
export class DomesticPanel extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;

  @state() private open = false;
  @state() private data: DomesticData | null = null;

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(ToggleDomesticPanelEvent, () => {
      this.open = !this.open;
    });
  }

  tick() {
    this.data = this.game?.myPlayer()?.domesticData() ?? null;
  }

  private research(tech: TechId, payWithGold: boolean) {
    this.eventBus.emit(new ResearchTechIntentEvent(tech, payWithGold));
  }

  render() {
    const me = this.game?.myPlayer();
    if (!this.open || this.data === null || !me) return null;
    const d = this.data;
    const researched = new Set<TechId>(d.techs);
    return html`
      <div
        class="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50"
        @click=${(e: MouseEvent) => {
          if (e.target === e.currentTarget) this.open = false;
        }}
      >
        <div
          class="bg-gray-900 text-white rounded-lg p-4 max-w-[95vw] max-h-[90vh] overflow-auto shadow-xl"
        >
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-bold">
              ${translateText("domestic.panel_title")} ·
              ${translateText("domestic.tab_tech")}
            </h2>
            <button class="px-2" @click=${() => (this.open = false)}>✕</button>
          </div>
          ${this.renderResearch(d)}
          <div
            class="grid gap-2"
            style="grid-template-columns: auto repeat(3, minmax(11rem, 1fr));"
          >
            <div></div>
            ${BRANCHES.map(
              (b) =>
                html`<div class="font-bold text-center">
                  ${translateText(`domestic.branch.${b}`)}
                </div>`,
            )}
            ${ERAS.map(
              (era) => html`
                <div class="font-bold self-center">
                  ${translateText("domestic.era", { era })}
                </div>
                ${BRANCHES.map(
                  (b) =>
                    html`<div class="flex flex-col gap-1">
                      ${TECH_IDS.filter(
                        (id) => TECHS[id].era === era && TECHS[id].branch === b,
                      ).map((id) => this.renderTech(id, d, researched, me))}
                    </div>`,
                )}
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  private renderResearch(d: DomesticData) {
    if (d.research === null) return null;
    const done = 1 - d.research.ticksLeft / d.research.totalTicks;
    return html`
      <div class="mb-3">
        <div class="text-sm">
          ${translateText("domestic.research_progress", {
            tech: translateText(`domestic.tech.${d.research.tech}.name`),
            seconds: Math.ceil(d.research.ticksLeft / 10),
          })}
        </div>
        <div class="h-2 bg-gray-700 rounded-sm">
          <div
            class="h-2 bg-sky-500 rounded-sm"
            style="width: ${Math.round(done * 100)}%"
          ></div>
        </div>
      </div>
    `;
  }

  private renderTech(
    id: TechId,
    d: DomesticData,
    researched: ReadonlySet<TechId>,
    me: PlayerView,
  ) {
    const def = TECHS[id];
    let status: TemplateResult | string;
    let border = "border-gray-600";
    if (researched.has(id)) {
      status = translateText("domestic.researched");
      border = "border-green-500";
    } else if (d.research?.tech === id) {
      status = translateText("domestic.researching");
      border = "border-sky-500";
    } else {
      const block = researchBlock(researched, d.research !== null, id);
      if (block !== null) {
        status = this.blockText(block, id, researched);
      } else if (d.science >= def.cost) {
        status = html`<button
          class="px-2 py-0.5 rounded-sm bg-sky-700 hover:bg-sky-600"
          @click=${() => this.research(id, false)}
        >
          ${translateText("domestic.research")}
        </button>`;
      } else {
        const gold = shortfallGold(
          (def.cost - d.science) * MILLI,
          me.domestic()?.pct("goldPaymentCost") ?? 0,
        );
        status = html`<button
          class="px-2 py-0.5 rounded-sm bg-amber-700 hover:bg-amber-600 disabled:opacity-40"
          ?disabled=${me.gold() < gold}
          @click=${() => this.research(id, true)}
        >
          ${translateText("domestic.pay_with_gold", {
            gold: renderNumber(gold),
          })}
        </button>`;
      }
    }
    return html`
      <div class="border ${border} rounded-sm p-2 text-xs flex flex-col gap-1">
        <div class="font-bold text-sm">
          ${translateText(`domestic.tech.${id}.name`)}
        </div>
        <div class="text-gray-300">
          ${translateText(`domestic.tech.${id}.desc`)}
        </div>
        <div class="text-gray-400">
          ${translateText("domestic.cost", {
            cost: def.cost,
            seconds: def.seconds,
          })}
        </div>
        <div>${status}</div>
      </div>
    `;
  }

  private blockText(
    block: ResearchBlock,
    id: TechId,
    researched: ReadonlySet<TechId>,
  ): string {
    switch (block) {
      case "busy":
        return translateText("domestic.blocked.busy");
      case "era":
        return translateText("domestic.blocked.era");
      case "prereq": {
        const missing = TECHS[id].prereqs.find((p) => !researched.has(p));
        return translateText("domestic.blocked.prereq", {
          tech:
            missing === undefined
              ? ""
              : translateText(`domestic.tech.${missing}.name`),
        });
      }
      case "researched":
        return translateText("domestic.researched");
    }
  }
}
```

- [ ] **Step 4: 화면에 배치**

`index.html`:
- `<unit-display class="hidden lg:block w-full"></unit-display>` 다음 줄에 `<domestic-hud class="block w-full"></domestic-hud>`를 추가한다.
- `<build-menu></build-menu>` 다음 줄에 `<domestic-panel></domestic-panel>`를 추가한다.

`src/client/hud/GameRenderer.ts`:
- import 추가:

```ts
import { DomesticHud } from "./domestic/DomesticHud";
import { DomesticPanel } from "./domestic/DomesticPanel";
```

- `unitDisplay` 설정 블록(`unitDisplay.uiState = uiState;`) 뒤에 추가:

```ts
  const domesticHud = document.querySelector("domestic-hud") as DomesticHud;
  if (!(domesticHud instanceof DomesticHud)) {
    console.error("domestic hud not found");
  }
  domesticHud.game = game;
  domesticHud.eventBus = eventBus;

  const domesticPanel = document.querySelector(
    "domestic-panel",
  ) as DomesticPanel;
  if (!(domesticPanel instanceof DomesticPanel)) {
    console.error("domestic panel not found");
  }
  domesticPanel.game = game;
  domesticPanel.eventBus = eventBus;
```

- `layers` 배열의 `controlPanel,` 뒤에 `domesticHud,`와 `domesticPanel,`를 추가한다.

- [ ] **Step 5: 확인**

Run: `npm run typecheck && npx eslint src/client/hud/domestic src/client/hud/GameRenderer.ts && npx vitest tests/client --run`
Expected: 오류 없음, 테스트 PASS

- [ ] **Step 6: 커밋**

```bash
npx prettier --write src/client/hud/domestic src/client/hud/GameRenderer.ts index.html
git add -A src/client/hud index.html
git commit -m "feat(domestic): domestic HUD and technology panel"
```

---

### Task 14: 로비 설정 토글

**Files:**
- Modify: `src/client/HostLobbyModal.ts`
- Modify: `src/client/SinglePlayerModal.ts`

**Interfaces:**
- Consumes: `GameConfig.domesticMode`(Task 3), `game_settings.domestic_mode` 키(Task 11)

- [ ] **Step 1: 호스트 로비**

`src/client/HostLobbyModal.ts`:
1. `@state() private waterNukes: boolean = false;` 뒤에 `@state() private domesticMode: boolean = false;`를 추가한다.
2. 토글 목록에서

```ts
                  {
                    labelKey: "game_settings.water_nukes",
                    checked: this.waterNukes,
                  },
```

   뒤에 추가:

```ts
                  {
                    labelKey: "game_settings.domestic_mode",
                    checked: this.domesticMode,
                  },
```

3. 토글 처리 switch에서

```ts
      case "game_settings.water_nukes":
        this.waterNukes = checked;
        this.putGameConfig();
        break;
```

   뒤에 추가:

```ts
      case "game_settings.domestic_mode":
        this.domesticMode = checked;
        this.putGameConfig();
        break;
```

4. 초기화 코드의 `    this.waterNukes = false;` 뒤에 `    this.domesticMode = false;`를 추가한다.
5. `putGameConfig`의 `waterNukes: this.waterNukes ? true : null,` 뒤에 `domesticMode: this.domesticMode,`를 추가한다.

- [ ] **Step 2: 싱글플레이**

`src/client/SinglePlayerModal.ts`:
1. `DEFAULT_OPTIONS`의 `waterNukes: false,` 뒤에 `domesticMode: false,`를 추가한다.
2. `@state() private waterNukes: boolean = DEFAULT_OPTIONS.waterNukes;` 뒤에 `@state() private domesticMode: boolean = DEFAULT_OPTIONS.domesticMode;`를 추가한다.
3. 토글 목록의 water_nukes 항목 뒤에 1번 단계의 2번과 같은 `game_settings.domestic_mode` 항목을 추가한다.
4. 변경 여부 검사의 `this.waterNukes !== DEFAULT_OPTIONS.waterNukes ||` 뒤에 `this.domesticMode !== DEFAULT_OPTIONS.domesticMode ||`를 추가한다.
5. 초기화 코드의 `this.waterNukes = DEFAULT_OPTIONS.waterNukes;` 뒤에 `this.domesticMode = DEFAULT_OPTIONS.domesticMode;`를 추가한다.
6. 토글 처리 switch의

```ts
      case "game_settings.water_nukes":
        this.waterNukes = checked;
        break;
```

   뒤에 추가:

```ts
      case "game_settings.domestic_mode":
        this.domesticMode = checked;
        break;
```

7. 게임 시작 설정의 `...(this.waterNukes ? { waterNukes: true } : {}),` 뒤에 `...(this.domesticMode ? { domesticMode: true } : {}),`를 추가한다.

- [ ] **Step 3: 확인**

Run: `npm run typecheck && npx vitest tests/client tests/GameModeSelectorGating.test.ts --run`
Expected: 오류 없음, PASS

- [ ] **Step 4: 커밋**

```bash
npx prettier --write src/client/HostLobbyModal.ts src/client/SinglePlayerModal.ts
git add src/client/HostLobbyModal.ts src/client/SinglePlayerModal.ts
git commit -m "feat(domestic): domestic mode toggle in host lobby and single player"
```

---

### Task 15: 전체 검증과 실제 실행 확인

**Files:** 없음(문제가 나오면 해당 Task 파일 수정)

- [ ] **Step 1: 전체 테스트, 타입, 린트**

Run: `npm test 2>&1 | tail -15 && npm run typecheck && npm run lint`
Expected: 모든 테스트 PASS, typecheck·lint 오류 없음. 바닐라 테스트가 하나라도 깨지면 내정 모드가 꺼진 경로가 원작과 달라진 것이다. 해당 Task로 돌아가 고친다.

- [ ] **Step 2: 실제 게임 실행 확인**

`run-openfront` 스킬로 개발 서버를 띄우고 싱글플레이를 시작한다. 설정에서 "내정 모드"를 켜고 다음을 확인한다:
1. 하단 HUD에 과학력·정치력과 초당 생산량이 보이고 매초 늘어난다.
2. "국정" 버튼으로 패널이 열리고, 4시대 × 3갈래 기술 격자가 보인다.
3. 과학력이 100이 되면 "화폐 주조"를 연구할 수 있고, 진행 막대가 줄고, 완료 메시지가 이벤트 창에 뜬다.
4. 빌드 메뉴에 연구소·행정청이 있고, 공장·전함·미사일 기지·SAM·핵에는 🔒와 "…연구 필요" 툴팁이 붙는다.
5. 징병 상한 슬라이더를 50%로 내리면 병력이 서서히 줄어 50% 근처에서 멈춘다.
6. 내정 모드를 끈 판에서는 HUD가 보이지 않고 빌드 메뉴에 연구소·행정청이 없다.

결과(스크린샷 포함)를 기록한다. 문제가 있으면 해당 Task로 돌아가 고친 뒤 이 Task를 다시 한다.

- [ ] **Step 3: 마무리 커밋(수정이 있었다면)**

```bash
git status --short
git add -A
git commit -m "fix(domestic): issues found in full verification"
```

수정이 없었다면 이 단계는 건너뛴다.
