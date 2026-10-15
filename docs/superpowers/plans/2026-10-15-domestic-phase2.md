# 내정 모드 2단계 (법과 정부) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 내정 모드 2단계를 구현한다. 범위는 법률서(11개 항목, 영구 양자택일, 45초 대기, 늘어나는 비용), 누적 정치력에 따른 정부 단계와 정부 7종, 모든 법·정부 효과(특수 효과, 조건부 보정, 전투·건설 시간·SAM 사거리 보정 포함), 국정 패널의 법률서·정부 탭, AI 성향 4종이다.

**Architecture:** 법·정부 데이터와 규칙(비용, 선포 가능 여부, 정부 단계, 선택 가능 여부, 보정값·플래그 합치기)은 `packages/engine-lib/src/domestic/`의 `Laws.ts`, `Governments.ts`, `Policies.ts`에 둔다. 엔진과 화면이 같은 함수를 쓴다. 플레이어별 상태(선포한 법, 대기 종료 틱, 정부 단계, 현재 정부, 이번 초의 조건)는 1단계의 `PlayerDomestic`에 더한다. 효과는 1단계 연결 지점(`DomesticView.pct()`를 읽는 곳)과 새 연결 지점(전투 계산 입력, 건설 시간, SAM 사거리, `canTrade`, 매초 내정 처리)으로 적용한다. 모드를 끄면 원작과 비트 단위로 같아야 한다.

**Tech Stack:** TypeScript 6, Vitest 4, zod + zbin, Lit + Tailwind 4, jq

**Spec:** `docs/superpowers/specs/2026-10-15-domestic-system-design.md` (§5, §6, §7, §9.1–9.2, §10.4, §10.7, §10.9의 2단계 부분). 기반 계획: `docs/superpowers/plans/2026-10-15-domestic-phase1.md`

---

## Decisions (spec이 정하지 않아 이 계획에서 정한 것)

1. 법 선포는 즉시 효과가 난다. 선포에 걸리는 시간은 없다.
2. 45초 대기는 **법 선포만** 막는다. 정부 선택은 대기 중에도 할 수 있고, 고르면 대기가 그 시점부터 다시 45초로 시작된다.
3. 정부 선택에는 비용이 없다.
4. 고를 수 있는 정부 단계는 `min(도달 단계, 2)`다. 건너뛴 1단계 정부는 고를 수 없다. 3단계에 도달해도 2단계 정부를 아직 안 골랐으면 고를 수 있다.
5. 단계는 누적 정치력이 기준치 **이상**이면 오른다. 판정은 매초 내정 처리 때 하고, 오르면 그 플레이어에게 이벤트 메시지를 한 번 보낸다.
6. 법 비용은 `round(100 × 1.5^k)`를 먼저 구하고, `lawCost` 보정을 정수 계산(`base × (100 + pct) / 100`)으로 적용해 다시 반올림한다. 부족분 금 결제는 연구와 같은 규칙이다.
7. 조건부 보정(공격 중/아님/병력 절반 이하)은 매초 내정 처리 시작 때 판정해서 다음 1초 동안 쓴다. 금 수입·병력 회복도 이 값을 쓴다. 후퇴 중인 공격은 공격으로 치지 않는다.
8. 연구 보조금은 금 300이 다 있을 때만 300을 내고, 과학력 0.5를 생산 기본값(영토+연구소)에 더한다. 그래서 `science` 보정과 AI 난이도 배율을 받는다. 봉건제 정치력(완성된 도시 레벨 × 0.2)도 같은 방식이다.
9. 십일조는 매초 내정 처리 때 지급한다. `goldIncome`+`allGold` 보정과 로비 금 배율(`goldMultiplier`)을 받는다(호스트 치트 금 배율은 받지 않음).
10. SAM 사거리 보정 결과는 `maxSamRange()`(150)를 넘지 않는다(엔진의 요격 계산 가지치기가 이 값을 상한으로 쓴다). 업그레이드 중 보간의 시작값은 보정 전 사거리로 저장한다. 화면의 SAM 사거리 원은 2단계에서 보정을 반영하지 않는다.
11. 건설 시간은 `buildTime`(+도시는 `cityBuildTime`) 합을 −60%로 제한하고 최소 1틱이다. 내정 모드에서만 유닛 업데이트에 실제 건설 시간을 실어 보낸다. 리플레이의 진행 막대는 유닛 종류의 기본 시간을 쓴다.
12. 전투: `attackLoss`·`attackSpeed`는 공격자, `defenseLoss`는 방어자의 보정이다. 대상이 빈 땅이면 `expansionSpeed`만 쓴다. 손실 보정은 손실에 곱하고, 속도 보정은 타일당 틱 비용을 나눈다. 보정 계수는 틱마다 한 번 계산한다.
13. 고립주의는 양방향이다. 고립주의 국가와는 누구도(동맹 포함) 무역할 수 없다.
14. AI 성향은 플레이어 ID 해시를 시드로 한 별도 PRNG로 정한다. 공유 PRNG를 쓰지 않으므로 기존 AI 난수 흐름이 바뀌지 않고, 언제든 다시 계산할 수 있어 스냅샷이 필요 없다.
15. "조금씩 섞는다"는 우선순위 목록을 앞에서부터 한 번 훑으며 이웃 둘을 1/3 확률로 맞바꾸는 것이다.
16. AI 기술 선택: (우선순위 + 나머지 균형 순서)에서 지금 연구할 수 있는 첫 기술을 고르고, 과학력이 모자라면 기다린다. 우선 기술이 시대 조건에 막히면 나머지 순서의 기술을 먼저 연구한다.
17. AI 법 선택: 우선순위 다음에는 항목마다 정해 둔 기본 선택지(고립주의 제외)를 쓴다. 조건이 안 맞는 법(맨해튼 없는 핵)은 건너뛰고, 정치력이 모자라거나 대기 중이면 기다린다. AI는 금 결제를 쓰지 않는다. 같은 점검에서 정부를 골랐으면 법은 다음 점검으로 미룬다.
18. 성향별 연구소/행정청 비율(도시당): 정복가 0.5/0.25, 상인 0.35/0.35, 학자 1.0/0.25, 신앙 수호자 0.25/1.0. 성향 표의 "목표" 열은 3단계(승리) 범위다.
19. 국교 지정의 `unlocksTheocracy`는 플래그가 아니라 신정 정의의 `requiresLaw`로 표현한다.
20. 국정 패널의 탭은 1단계 패널 안에 직접 만든 탭 버튼으로 한다(1단계 패널이 `BaseModal`을 쓰지 않기 때문).
21. 인텐트 필드 이름은 1단계(`tech`)처럼 spec의 `lawId`/`govId` 대신 `law`, `option`, `payWithGold`, `government`로 한다.

## 시작 전에 (환경)

- 1단계 15개 Task가 모두 끝나고 커밋된 상태에서 시작한다. `npx vitest tests/domestic --run`이 통과해야 한다.
- 이 계획의 교체·수정 지점은 **1단계 계획의 코드**를 기준으로 쓰였다. 1단계 구현 중 계획과 달라진 부분(리뷰 수정 등)이 있으면 `git log -p -- <파일>`로 확인하고, 이 계획의 교체 코드에 그 변경을 옮긴다.
- 프로젝트는 Node 24를 요구한다. 이 PC의 Node 26에서도 테스트·타입 검사가 통과했다(1단계 계획 참고).
- 작업 브랜치: `domestic-system`
- 단일 테스트 실행: `npx vitest tests/domestic/<File>.test.ts --run`
- 커밋 전에 바꾼 파일에 `npx prettier --write <files>`를 실행한다(import 정렬과 안 쓰는 import 제거도 함께 된다).
- `TestConfig`(`tests/util/TestConfig.ts`)는 `attackLogic`을 고정값으로, `samRange(level)`을 20으로 바꿔 둔다. 전투 공식 자체를 시험할 때는 `new EngineConfig({} as GameConfig, false)`를 쓴다.

## Global Constraints

- 엔진 결정성: `packages/engine*`에서 `Math.random`, `Date.now`, `new Date`를 쓰지 않는다. `Math.pow/exp/log/sin...`과 2가 아닌 지수의 `**`도 쓰지 않는다. `Math.sqrt`, `Math.round`, `Math.floor`, `Math.ceil`, `Math.min`, `Math.max`는 허용된다. 거듭제곱은 반복 곱셈으로 한다.
- 패키지 경계(`tests/LayerBoundaries.test.ts`): `engine-api`는 zod/zbin/resources만, `engine-lib`는 여기에 `engine-api`, `engine`은 여기에 `engine-lib`까지 import할 수 있다. `src/client`는 `engine`을 import하지 않는다. 화면은 `PlayerView.domestic()`과 engine-lib 함수로만 계산한다.
- 내정 모드 꺼짐이면 동작이 원작과 같아야 한다. 기존 골든 테스트(`tests/AttackLogicGolden.test.ts` 등)는 수정 없이 통과해야 한다(예외: Task 4의 `tests/core/snapshot/FullGameSnapshot.test.ts` `neverStored`에 이름 2개 추가와 `tests/zbin/wire.test.ts` 샘플 인텐트 2개 추가, Task 2·9·10에서 1단계 테스트 3개 수정·확장).
- 봇(`PlayerType.Bot`)은 내정 상태가 없다(`domestic()`이 `null`). 법·정부 명령은 아무 효과가 없다.
- 수치는 spec §5, §6, §11을 따른다. 법·정부 효과는 `Laws.ts`·`Governments.ts`, 나머지 수치는 `Balance.ts`, AI 수치는 `NationPersonality.ts`에 둔다.
- 모든 보정값 pct는 정수다. 보정값 상한은 1단계 `capPct`/`capCombinedPct`를 따른다(전투 손실 감소 −50%, 기타 감소 −60%, 증가 +200%).
- enum 값(`MessageType`), 인텐트 스키마는 맨 뒤에 추가한다(zbin은 선언 순서로 인코딩한다).
- 스냅샷 호환: 새 스냅샷 필드는 optional로 만든다. 새 Execution은 `ExecutionRegistry`에 등록한다.
- 화면 문구는 `translateText()`를 거친다. 키는 `resources/lang/en.json`(키 정렬 필수)과 `resources/lang/ko.json` 둘 다 추가한다. 다른 번역 파일은 건드리지 않는다.
- 3단계 범위(승리 조건, 점수, 승리 프로젝트, AI 견제)는 넣지 않는다.

## Review Focus

1. **UI를 우회한 법 선포:** 이미 선포한 항목의 다른 선택지, 대기 중 선포, 맨해튼 프로젝트 없이 핵 항목을 `proclaim_law`로 보내면 엔진이 거부하고 정치력을 쓰지 않아야 한다. 테스트는 Task 4 "the other option of a proclaimed law is closed forever"·"the cooldown blocks the next law for 45 seconds"·"the nuclear law needs the Manhattan Project"다.
2. **정부 단계를 건너뜀:** 1단계 정부를 안 고르고 2단계에 닿으면 1단계 정부는 막히고, 2단계 정부를 안 고르고 3단계에 닿아도 2단계 정부는 고를 수 있어야 한다. 테스트는 Task 1 "skipped tier-1 governments stay closed; tier 3 still offers tier 2", Task 4 "tier 3 still lets a player adopt a tier-2 government"다.
3. **감소 보정이 겹침:** 공기 단축 + 도시 계획 + 공산주의처럼 건설 시간 감소가 −100% 넘게 쌓여도 −60%에서 멈추고 0틱이 되지 않아야 한다. 테스트는 Task 1 "stacked cuts are capped at -60%", Task 6 "stacked build-time cuts stop at -60%"다.
4. **금이 바닥난 상태의 특수 효과:** 연구 보조금은 금 300이 안 되면 아무것도 하지 않고, 공산주의 연구소는 금 0에서도 돌아야 하며, 어떤 경우에도 금이 음수가 되면 안 된다. 테스트는 Task 3 "research subsidy needs the full 300 gold"·"communism runs institutes without upkeep"다.
5. **법 대기·조건이 걸린 채 재접속(스냅샷):** 선포한 법, 정부, 대기 종료 틱, 이번 초의 조건, 대기 중인 명령이 복원 후에도 같고 이후 틱도 같게 흘러야 한다. 테스트는 Task 2 "snapshot round trip keeps laws, government, cooldown and conditions", Task 4 "laws, government and pending orders survive a snapshot"이다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `packages/engine-api/src/domestic/DomesticTypes.ts` (수정) | `LawId`, `LawOption`, `GovernmentId`, `PolicyFlag`, `DomesticData` 새 필드 |
| `packages/engine-lib/src/domestic/Balance.ts` (수정) | 법 비용·대기, 정부 기준치, 보조금·봉건제·십일조 수치 |
| `packages/engine-lib/src/domestic/Laws.ts` (새) | 법 11개 데이터, 비용, 선포 가능 여부 |
| `packages/engine-lib/src/domestic/Governments.ts` (새) | 정부 7개 데이터, 단계 계산, 선택 가능 여부 |
| `packages/engine-lib/src/domestic/Policies.ts` (새) | 법 + 정부의 보정값과 플래그 합치기 |
| `packages/engine/src/domestic/PlayerDomestic.ts` (수정) | 법·정부·조건 상태, `toData`, 스냅샷 |
| `packages/engine/src/domestic/DomesticEconomy.ts` (수정) | 조건 판정, 특수 효과, 단계 알림, `payPoints`, 전투·건설 시간 보정 |
| `packages/engine/src/domestic/ProclaimLawExecution.ts` (새) | `proclaim_law` 명령 |
| `packages/engine/src/domestic/ChooseGovernmentExecution.ts` (새) | `choose_government` 명령 |
| `packages/engine/src/execution/nation/NationPersonality.ts` (새) | AI 성향 표와 국가별 계획 |
| `packages/engine/src/execution/nation/NationDomesticBehavior.ts` (교체) | 성향별 연구·법·정부 선택 |
| `src/client/view/DomesticClientView.ts` (교체) | 화면 쪽 `DomesticView`(법·정부·조건 반영) |
| `src/client/render/gl/utils/ConstructionProgress.ts` (새) | 건설 진행률 계산 |
| `src/client/hud/domestic/LawsTab.ts` (새) | 법률서 탭 |
| `src/client/hud/domestic/GovernmentTab.ts` (새) | 정부 탭 |
| `tests/domestic/*.test.ts`, `tests/client/*.test.ts` (새) | 테스트 |
| 기존 파일 수정 | 각 Task의 Files 목록 참고 |

---

### Task 1: 법·정부 데이터와 규칙

**Files:**
- Modify: `packages/engine-api/src/domestic/DomesticTypes.ts`
- Modify: `packages/engine-lib/src/domestic/Balance.ts`
- Create: `packages/engine-lib/src/domestic/Laws.ts`
- Create: `packages/engine-lib/src/domestic/Governments.ts`
- Create: `packages/engine-lib/src/domestic/Policies.ts`
- Test: `tests/domestic/Policies.test.ts`

**Interfaces:**
- Consumes: 1단계의 `Modifier`, `TechId`, `Condition`, `ModifierTotals`, `MILLI`
- Produces:
  - `LAW_IDS`, `LawId`, `LAW_OPTIONS`, `LawOption = "A" | "B"`, `GOVERNMENT_IDS`, `GovernmentId`, `POLICY_FLAGS`, `PolicyFlag`
  - Balance: `LAW_BASE_COST`, `LAW_COST_GROWTH`, `LAW_COOLDOWN_TICKS = 450`, `GOVERNMENT_TIER_THRESHOLDS = [300, 1500, 3500]`, `RESEARCH_SUBSIDY_GOLD_PER_SEC = 300n`, `RESEARCH_SUBSIDY_SCIENCE_PER_SEC = 0.5`, `FEUDAL_POLITICAL_PER_CITY_LEVEL = 0.2`, `TITHE_GOLD_PER_SQRT_PCT = 100`
  - `LAWS: Record<LawId, LawDef>`, `LawDef { id; requires: TechId | null; A: LawOptionDef; B: LawOptionDef }`, `LawOptionDef { modifiers; flags }`
  - `lawBaseCost(proclaimed: number): number`, `lawCost(proclaimed: number, lawCostPct: number): number`
  - `type LawBlock = "proclaimed" | "requires" | "cooldown"`, `lawBlock(law, proclaimed: LawOption | undefined, techs: ReadonlySet<TechId>, cooldownUntilTick: number, nowTick: number): LawBlock | null`
  - `lawMapOf(laws: Partial<Record<LawId, LawOption>>): Map<LawId, LawOption>`
  - `GOVERNMENTS: Record<GovernmentId, GovernmentDef>`, `GovernmentDef { id; tier: 0|1|2; modifiers; flags; requiresLaw: {law, option} | null }`, `GOVERNMENTS_BY_TIER`, `MAX_GOVERNMENT_TIER = 2`
  - `governmentTier(cumulativePoliticalMilli: number): number` (0..3)
  - `type GovernmentBlock = "tierNotReached" | "tierPassed" | "chosen" | "requires"`, `governmentBlock(tier: number, current: GovernmentId, laws: ReadonlyMap<LawId, LawOption>, government: GovernmentId): GovernmentBlock | null`
  - `policyModifiers(laws: ReadonlyMap<LawId, LawOption>, government: GovernmentId): Modifier[]`, `policyFlags(laws, government): Set<PolicyFlag>`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/Policies.test.ts`:

```ts
import {
  Condition,
  GOVERNMENT_IDS,
  LAW_IDS,
  LawId,
  LawOption,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  GOVERNMENTS,
  GOVERNMENTS_BY_TIER,
  governmentBlock,
  governmentTier,
} from "@openfront/engine-lib/domestic/Governments";
import {
  LAWS,
  lawBaseCost,
  lawBlock,
  lawCost,
  lawMapOf,
} from "@openfront/engine-lib/domestic/Laws";
import { ModifierTotals } from "@openfront/engine-lib/domestic/Modifiers";
import {
  policyFlags,
  policyModifiers,
} from "@openfront/engine-lib/domestic/Policies";

function lawsOf(
  ...entries: [LawId, LawOption][]
): ReadonlyMap<LawId, LawOption> {
  return new Map(entries);
}

function when(...conditions: Condition[]): ReadonlySet<Condition> {
  return new Set(conditions);
}

const NO_LAWS = lawsOf();
const NO_TECHS: ReadonlySet<TechId> = new Set();

describe("law data", () => {
  test("every law id has a definition with a matching id", () => {
    expect(Object.keys(LAWS).sort()).toEqual([...LAW_IDS].sort());
    for (const id of LAW_IDS) {
      expect(LAWS[id].id).toBe(id);
    }
  });

  test("only the nuclear law needs a tech: the Manhattan Project", () => {
    expect(LAW_IDS.filter((id) => LAWS[id].requires !== null)).toEqual([
      "nuclear",
    ]);
    expect(LAWS.nuclear.requires).toBe("manhattan_project");
  });

  test("cost is round(100 × 1.5^k)", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(lawBaseCost)).toEqual([
      100, 150, 225, 338, 506, 759, 1139,
    ]);
  });

  test("lawCost applies the lawCost percent and rounds half up", () => {
    expect(lawCost(0, 0)).toBe(100);
    expect(lawCost(0, -15)).toBe(85);
    expect(lawCost(1, -15)).toBe(128);
    expect(lawCost(2, -15)).toBe(191);
  });

  test("lawBlock: proclaimed, then a missing tech, then the cooldown", () => {
    expect(lawBlock("trade", "A", NO_TECHS, 0, 0)).toBe("proclaimed");
    expect(lawBlock("nuclear", undefined, NO_TECHS, 0, 0)).toBe("requires");
    expect(
      lawBlock(
        "nuclear",
        undefined,
        new Set<TechId>(["manhattan_project"]),
        0,
        0,
      ),
    ).toBeNull();
    expect(lawBlock("trade", undefined, NO_TECHS, 450, 449)).toBe("cooldown");
    expect(lawBlock("trade", undefined, NO_TECHS, 450, 450)).toBeNull();
  });

  test("lawMapOf keeps LAW_IDS order", () => {
    expect([...lawMapOf({ religion: "B", trade: "A" })]).toEqual([
      ["trade", "A"],
      ["religion", "B"],
    ]);
  });
});

describe("government data", () => {
  test("chiefdom at tier 0, three governments at tiers 1 and 2", () => {
    expect(Object.keys(GOVERNMENTS).sort()).toEqual(
      [...GOVERNMENT_IDS].sort(),
    );
    expect(GOVERNMENTS_BY_TIER).toEqual([
      ["chiefdom"],
      ["monarchy", "republic", "theocracy"],
      ["democracy", "fascism", "communism"],
    ]);
    GOVERNMENTS_BY_TIER.forEach((ids, tier) => {
      for (const id of ids) {
        expect(GOVERNMENTS[id].tier).toBe(tier);
      }
    });
  });

  test("tiers start at 300 / 1,500 / 3,500 cumulative political power", () => {
    expect(governmentTier(299_999)).toBe(0);
    expect(governmentTier(300_000)).toBe(1);
    expect(governmentTier(1_499_999)).toBe(1);
    expect(governmentTier(1_500_000)).toBe(2);
    expect(governmentTier(3_499_999)).toBe(2);
    expect(governmentTier(3_500_000)).toBe(3);
  });

  test("a tier's governments open once it is reached", () => {
    expect(governmentBlock(0, "chiefdom", NO_LAWS, "monarchy")).toBe(
      "tierNotReached",
    );
    expect(governmentBlock(1, "chiefdom", NO_LAWS, "monarchy")).toBeNull();
    expect(governmentBlock(1, "chiefdom", NO_LAWS, "democracy")).toBe(
      "tierNotReached",
    );
  });

  test("a chosen government is locked until the next tier", () => {
    expect(governmentBlock(1, "monarchy", NO_LAWS, "republic")).toBe(
      "chosen",
    );
    expect(governmentBlock(1, "monarchy", NO_LAWS, "monarchy")).toBe(
      "chosen",
    );
    expect(governmentBlock(2, "monarchy", NO_LAWS, "democracy")).toBeNull();
  });

  test("skipped tier-1 governments stay closed; tier 3 still offers tier 2", () => {
    expect(governmentBlock(2, "chiefdom", NO_LAWS, "republic")).toBe(
      "tierPassed",
    );
    expect(governmentBlock(3, "monarchy", NO_LAWS, "fascism")).toBeNull();
    expect(governmentBlock(3, "fascism", NO_LAWS, "democracy")).toBe(
      "chosen",
    );
    expect(governmentBlock(3, "fascism", NO_LAWS, "chiefdom")).toBe(
      "tierPassed",
    );
  });

  test("theocracy needs state religion", () => {
    expect(governmentBlock(1, "chiefdom", NO_LAWS, "theocracy")).toBe(
      "requires",
    );
    expect(
      governmentBlock(1, "chiefdom", lawsOf(["religion", "B"]), "theocracy"),
    ).toBe("requires");
    expect(
      governmentBlock(1, "chiefdom", lawsOf(["religion", "A"]), "theocracy"),
    ).toBeNull();
  });
});

describe("policy modifiers and flags", () => {
  test("laws and the government add up per stat", () => {
    const totals = new ModifierTotals(
      policyModifiers(lawsOf(["trade", "A"], ["service", "B"]), "republic"),
    );
    expect(totals.pct("trade")).toBe(65);
    expect(totals.pct("attackLoss")).toBe(-15);
    expect(totals.pct("cityBuildTime")).toBe(-50);
  });

  test("democracy: peace dividend and war weariness", () => {
    const totals = new ModifierTotals(policyModifiers(NO_LAWS, "democracy"));
    expect(totals.pct("political")).toBe(0);
    expect(totals.pct("political", when("notAttacking"))).toBe(30);
    expect(totals.pct("political", when("attacking"))).toBe(-50);
    expect(totals.pct("goldIncome")).toBe(30);
  });

  test("fascism: war economy", () => {
    const totals = new ModifierTotals(policyModifiers(NO_LAWS, "fascism"));
    expect(totals.pct("goldIncome", when("attacking"))).toBe(30);
    expect(totals.pct("goldIncome", when("notAttacking"))).toBe(-10);
  });

  test("total mobilization only while troops are at most half", () => {
    const totals = new ModifierTotals(
      policyModifiers(lawsOf(["mobilization", "A"]), "chiefdom"),
    );
    expect(totals.pct("troopRegen")).toBe(0);
    expect(totals.pct("troopRegen", when("troopsAtMostHalf"))).toBe(100);
  });

  test("special effects are flags", () => {
    expect([...policyFlags(lawsOf(["diplomacy", "B"]), "chiefdom")]).toEqual(
      ["noForeignTrade"],
    );
    expect([...policyFlags(lawsOf(["learning", "A"]), "communism")]).toEqual([
      "researchSubsidy",
      "noProductionUpkeep",
    ]);
    expect(policyFlags(NO_LAWS, "monarchy").has("feudal")).toBe(true);
    expect(policyFlags(NO_LAWS, "theocracy").has("tithe")).toBe(true);
  });

  test("stacked cuts are capped at -60%", () => {
    const totals = new ModifierTotals(
      policyModifiers(lawsOf(["construction", "B"]), "communism"),
    );
    expect(totals.pct("buildTime")).toBe(-60);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/Policies.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine-lib/domestic/Governments'`

- [ ] **Step 3: 타입 추가**

`packages/engine-api/src/domestic/DomesticTypes.ts`의 `export type Condition = (typeof CONDITIONS)[number];` 바로 뒤(`export interface Modifier` 앞)에 추가:

```ts

/** Book of Laws categories (spec §5.2), in the spec's order. */
export const LAW_IDS = [
  "trade",
  "taxation",
  "construction",
  "learning",
  "service",
  "doctrine",
  "mobilization",
  "nuclear",
  "diplomacy",
  "opinion",
  "religion",
] as const;
export type LawId = (typeof LAW_IDS)[number];

/** A law's two options, as in the spec table (A / B). */
export const LAW_OPTIONS = ["A", "B"] as const;
export type LawOption = (typeof LAW_OPTIONS)[number];

/** Spec §6: tier 0, three tier-1 and three tier-2 governments. */
export const GOVERNMENT_IDS = [
  "chiefdom",
  "monarchy",
  "republic",
  "theocracy",
  "democracy",
  "fascism",
  "communism",
] as const;
export type GovernmentId = (typeof GOVERNMENT_IDS)[number];

/** Effects that aren't a stat percent (the flag table of spec §7.2). */
export const POLICY_FLAGS = [
  "noForeignTrade",
  "noProductionUpkeep",
  "researchSubsidy",
  "feudal",
  "tithe",
] as const;
export type PolicyFlag = (typeof POLICY_FLAGS)[number];
```

- [ ] **Step 4: 수치 추가**

`packages/engine-lib/src/domestic/Balance.ts`의 `export const TECHS_REQUIRED_FROM_PREVIOUS_ERA = 2;` 바로 뒤에 추가:

```ts

/** Book of Laws (spec §5): law k costs round(LAW_BASE_COST × LAW_COST_GROWTH^k). */
export const LAW_BASE_COST = 100;
export const LAW_COST_GROWTH = 1.5;
/** After a law or a government choice, no law for 45 s. */
export const LAW_COOLDOWN_TICKS = 45 * 10;
/** Cumulative political power (whole points) for government tiers 1, 2, 3. */
export const GOVERNMENT_TIER_THRESHOLDS = [300, 1500, 3500] as const;

/** Research subsidies: this much gold a second becomes this much science. */
export const RESEARCH_SUBSIDY_GOLD_PER_SEC = 300n;
export const RESEARCH_SUBSIDY_SCIENCE_PER_SEC = 0.5;
/** Feudalism (monarchy): political power a second per finished city level. */
export const FEUDAL_POLITICAL_PER_CITY_LEVEL = 0.2;
/** Tithe (theocracy): gold a second per sqrt(land share %). */
export const TITHE_GOLD_PER_SQRT_PCT = 100;
```

- [ ] **Step 5: 법 데이터 작성**

`packages/engine-lib/src/domestic/Laws.ts`:

```ts
import {
  LAW_IDS,
  LawId,
  LawOption,
  Modifier,
  PolicyFlag,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { LAW_BASE_COST, LAW_COST_GROWTH } from "./Balance";

export interface LawOptionDef {
  modifiers: readonly Modifier[];
  flags: readonly PolicyFlag[];
}

export interface LawDef {
  id: LawId;
  /** Tech needed before either option can be proclaimed. */
  requires: TechId | null;
  A: LawOptionDef;
  B: LawOptionDef;
}

function optionDef(
  modifiers: readonly Modifier[],
  flags: readonly PolicyFlag[] = [],
): LawOptionDef {
  return { modifiers, flags };
}

function lawDef(
  id: LawId,
  A: LawOptionDef,
  B: LawOptionDef,
  requires: TechId | null = null,
): LawDef {
  return { id, requires, A, B };
}

// Spec §5.2.
export const LAWS: Readonly<Record<LawId, LawDef>> = {
  trade: lawDef(
    "trade",
    optionDef([{ stat: "trade", pct: 40 }]),
    optionDef([
      { stat: "cityTax", pct: 60 },
      { stat: "foreignTrade", pct: -30 },
    ]),
  ),
  taxation: lawDef(
    "taxation",
    optionDef([
      { stat: "goldIncome", pct: 30 },
      { stat: "troopRegen", pct: -15 },
    ]),
    optionDef([
      { stat: "cityTax", pct: 40 },
      { stat: "cityBuildTime", pct: -50 },
    ]),
  ),
  construction: lawDef(
    "construction",
    optionDef([{ stat: "buildCost", pct: -25 }]),
    optionDef([{ stat: "buildTime", pct: -50 }]),
  ),
  learning: lawDef(
    "learning",
    optionDef([], ["researchSubsidy"]),
    optionDef([{ stat: "adminOutput", pct: 40 }]),
  ),
  service: lawDef(
    "service",
    optionDef([
      { stat: "maxTroops", pct: 25 },
      { stat: "goldIncome", pct: -10 },
    ]),
    optionDef([
      { stat: "troopUpkeep", pct: -50 },
      { stat: "attackLoss", pct: -15 },
    ]),
  ),
  doctrine: lawDef(
    "doctrine",
    optionDef([
      { stat: "defensePost", pct: 40 },
      { stat: "defenseLoss", pct: -15 },
    ]),
    optionDef([
      { stat: "attackSpeed", pct: 30 },
      { stat: "defenseLoss", pct: 10 },
    ]),
  ),
  mobilization: lawDef(
    "mobilization",
    optionDef([{ stat: "troopRegen", pct: 100, when: "troopsAtMostHalf" }]),
    // upkeepFreeBand adds percentage points: 40% -> 60%.
    optionDef([{ stat: "upkeepFreeBand", pct: 20 }]),
  ),
  nuclear: lawDef(
    "nuclear",
    optionDef([
      { stat: "siloSamCost", pct: -30 },
      { stat: "nukeCost", pct: -20 },
    ]),
    optionDef([{ stat: "samRange", pct: 30 }]),
    "manhattan_project",
  ),
  diplomacy: lawDef(
    "diplomacy",
    optionDef([{ stat: "alliedTrade", pct: 50 }]),
    optionDef(
      [
        { stat: "political", pct: 40 },
        { stat: "defenseLoss", pct: -10 },
      ],
      ["noForeignTrade"],
    ),
  ),
  opinion: lawDef(
    "opinion",
    optionDef([{ stat: "political", pct: 25 }]),
    optionDef([{ stat: "science", pct: 20 }]),
  ),
  religion: lawDef(
    "religion",
    // State religion also allows theocracy (GOVERNMENTS.theocracy.requiresLaw).
    optionDef([
      { stat: "political", pct: 15 },
      { stat: "troopRegen", pct: 15 },
      { stat: "science", pct: -10 },
    ]),
    optionDef([
      { stat: "science", pct: 15 },
      { stat: "foreignTrade", pct: 20 },
      { stat: "expansionSpeed", pct: 20 },
    ]),
  ),
};

/** round(100 × 1.5^k): the next law's cost after `proclaimed` laws, before lawCost. */
export function lawBaseCost(proclaimed: number): number {
  let cost = LAW_BASE_COST;
  for (let i = 0; i < proclaimed; i++) {
    cost *= LAW_COST_GROWTH;
  }
  return Math.round(cost);
}

/**
 * Political power (whole points) the next law costs after the lawCost
 * modifier. Integer math keeps x.5 results exact, so they round up.
 */
export function lawCost(proclaimed: number, lawCostPct: number): number {
  return Math.round((lawBaseCost(proclaimed) * (100 + lawCostPct)) / 100);
}

export type LawBlock = "proclaimed" | "requires" | "cooldown";

/** Why `law` can't be proclaimed now (cost aside), or null when it can. */
export function lawBlock(
  law: LawId,
  proclaimed: LawOption | undefined,
  techs: ReadonlySet<TechId>,
  cooldownUntilTick: number,
  nowTick: number,
): LawBlock | null {
  if (proclaimed !== undefined) return "proclaimed";
  const requires = LAWS[law].requires;
  if (requires !== null && !techs.has(requires)) return "requires";
  if (nowTick < cooldownUntilTick) return "cooldown";
  return null;
}

/** A DomesticData laws record as a map in LAW_IDS order. */
export function lawMapOf(
  laws: Partial<Record<LawId, LawOption>>,
): Map<LawId, LawOption> {
  const out = new Map<LawId, LawOption>();
  for (const id of LAW_IDS) {
    const chosen = laws[id];
    if (chosen !== undefined) out.set(id, chosen);
  }
  return out;
}
```

- [ ] **Step 6: 정부 데이터 작성**

`packages/engine-lib/src/domestic/Governments.ts`:

```ts
import {
  GovernmentId,
  LawId,
  LawOption,
  Modifier,
  PolicyFlag,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { GOVERNMENT_TIER_THRESHOLDS, MILLI } from "./Balance";

/** The highest tier that offers governments; tier 3 adds none. */
export const MAX_GOVERNMENT_TIER = 2;

export interface GovernmentDef {
  id: GovernmentId;
  tier: 0 | 1 | 2;
  modifiers: readonly Modifier[];
  flags: readonly PolicyFlag[];
  /** A proclaimed law option this government needs first. */
  requiresLaw: { law: LawId; option: LawOption } | null;
}

function governmentDef(
  id: GovernmentId,
  tier: 0 | 1 | 2,
  extra: Partial<
    Pick<GovernmentDef, "modifiers" | "flags" | "requiresLaw">
  > = {},
): GovernmentDef {
  return {
    id,
    tier,
    modifiers: extra.modifiers ?? [],
    flags: extra.flags ?? [],
    requiresLaw: extra.requiresLaw ?? null,
  };
}

// Spec §6.2, §6.3.
export const GOVERNMENTS: Readonly<Record<GovernmentId, GovernmentDef>> = {
  chiefdom: governmentDef("chiefdom", 0),
  monarchy: governmentDef("monarchy", 1, {
    modifiers: [
      { stat: "maxTroops", pct: 20 },
      { stat: "upkeepFreeBand", pct: 20 },
      { stat: "science", pct: -15 },
    ],
    flags: ["feudal"],
  }),
  republic: governmentDef("republic", 1, {
    modifiers: [
      { stat: "goldIncome", pct: 20 },
      { stat: "trade", pct: 25 },
      // Public works.
      { stat: "cityBuildTime", pct: -50 },
      { stat: "recruitCost", pct: 25 },
    ],
  }),
  theocracy: governmentDef("theocracy", 1, {
    modifiers: [
      { stat: "political", pct: 30 },
      { stat: "defenseLoss", pct: -20 },
      { stat: "science", pct: -15 },
    ],
    flags: ["tithe"],
    requiresLaw: { law: "religion", option: "A" },
  }),
  democracy: governmentDef("democracy", 2, {
    modifiers: [
      { stat: "goldIncome", pct: 30 },
      { stat: "science", pct: 30 },
      { stat: "goldPaymentCost", pct: -50 },
      // Peace dividend and war weariness.
      { stat: "political", pct: 30, when: "notAttacking" },
      { stat: "political", pct: -50, when: "attacking" },
    ],
  }),
  fascism: governmentDef("fascism", 2, {
    modifiers: [
      { stat: "troopRegen", pct: 30 },
      { stat: "attackLoss", pct: -25 },
      { stat: "recruitCost", pct: -50 },
      // War economy.
      { stat: "goldIncome", pct: 30, when: "attacking" },
      { stat: "science", pct: -20 },
      { stat: "goldIncome", pct: -10, when: "notAttacking" },
    ],
  }),
  communism: governmentDef("communism", 2, {
    modifiers: [
      { stat: "buildCost", pct: -30 },
      { stat: "buildTime", pct: -50 },
      // Five-year plan.
      { stat: "instituteOutput", pct: 50 },
      { stat: "adminOutput", pct: 50 },
      { stat: "trade", pct: -30 },
    ],
    flags: ["noProductionUpkeep"],
  }),
};

export const GOVERNMENTS_BY_TIER: readonly (readonly GovernmentId[])[] = [
  ["chiefdom"],
  ["monarchy", "republic", "theocracy"],
  ["democracy", "fascism", "communism"],
];

/** Highest tier (0..3) whose threshold the cumulative political power reached. */
export function governmentTier(cumulativePoliticalMilli: number): number {
  let tier = 0;
  for (const threshold of GOVERNMENT_TIER_THRESHOLDS) {
    if (cumulativePoliticalMilli >= threshold * MILLI) tier++;
  }
  return tier;
}

export type GovernmentBlock =
  | "tierNotReached"
  | "tierPassed"
  | "chosen"
  | "requires";

/**
 * Why `government` can't be adopted now, or null when it can. Governments
 * open at tier min(reached, 2), so a skipped tier stays closed while tier 3
 * still offers tier 2. The current government's tier counts as chosen until
 * the next one opens (spec §6.1).
 */
export function governmentBlock(
  tier: number,
  current: GovernmentId,
  laws: ReadonlyMap<LawId, LawOption>,
  government: GovernmentId,
): GovernmentBlock | null {
  const def = GOVERNMENTS[government];
  const open = Math.min(tier, MAX_GOVERNMENT_TIER);
  if (def.tier > open) return "tierNotReached";
  if (def.tier < open || def.tier === 0) return "tierPassed";
  if (GOVERNMENTS[current].tier >= def.tier) return "chosen";
  const req = def.requiresLaw;
  if (req !== null && laws.get(req.law) !== req.option) return "requires";
  return null;
}
```

- [ ] **Step 7: 보정값·플래그 합치기 작성**

`packages/engine-lib/src/domestic/Policies.ts`:

```ts
import {
  GovernmentId,
  LawId,
  LawOption,
  Modifier,
  PolicyFlag,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { GOVERNMENTS } from "./Governments";
import { LAWS } from "./Laws";

/** Modifiers of the proclaimed laws and the current government. */
export function policyModifiers(
  laws: ReadonlyMap<LawId, LawOption>,
  government: GovernmentId,
): Modifier[] {
  const out: Modifier[] = [];
  for (const [law, chosen] of laws) {
    out.push(...LAWS[law][chosen].modifiers);
  }
  out.push(...GOVERNMENTS[government].modifiers);
  return out;
}

/** Special effects (spec §7.2's flags) of the laws and the government. */
export function policyFlags(
  laws: ReadonlyMap<LawId, LawOption>,
  government: GovernmentId,
): Set<PolicyFlag> {
  const out = new Set<PolicyFlag>();
  for (const [law, chosen] of laws) {
    for (const flag of LAWS[law][chosen].flags) out.add(flag);
  }
  for (const flag of GOVERNMENTS[government].flags) out.add(flag);
  return out;
}
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest tests/domestic/Policies.test.ts --run && npm run typecheck`
Expected: PASS (18 tests), typecheck 오류 없음

- [ ] **Step 9: 커밋**

```bash
npx prettier --write packages/engine-api/src/domestic packages/engine-lib/src/domestic tests/domestic/Policies.test.ts
git add packages/engine-api/src/domestic packages/engine-lib/src/domestic tests/domestic/Policies.test.ts
git commit -m "feat(domestic): add law and government data, costs and rules"
```

---

### Task 2: 플레이어의 법·정부·조건 상태와 화면 쪽 뷰

**Files:**
- Modify: `packages/engine-api/src/domestic/DomesticTypes.ts` (`DomesticData` 필드)
- Modify(전체 교체): `packages/engine/src/domestic/PlayerDomestic.ts`
- Modify(전체 교체): `src/client/view/DomesticClientView.ts`
- Modify: `tests/domestic/util.ts` (`grantLaws`, `grantGovernment`)
- Modify: `tests/client/DomesticClient.test.ts` (1단계 테스트의 `DomesticData` 리터럴, 새 테스트)
- Test: `tests/domestic/PlayerPolicies.test.ts`

**Interfaces:**
- Consumes: Task 1의 `policyModifiers`, `policyFlags`, `governmentTier`, `lawMapOf`, `LAW_COOLDOWN_TICKS`; 1단계 `PlayerDomestic`
- Produces:
  - `DomesticData`에 `laws: Partial<Record<LawId, LawOption>>`, `lawCooldownUntilTick: number`, `governmentTier: number`, `government: GovernmentId`, `conditions: Condition[]`
  - `PlayerDomestic`: `pct(stat)`(현재 조건 반영), `hasFlag(flag: PolicyFlag): boolean`, `activeConditions(): ReadonlySet<Condition>`, `setConditions(c: ReadonlySet<Condition>): void`, `proclaimedLaws(): ReadonlyMap<LawId, LawOption>`, `lawCooldownUntilTick(): number`, `proclaimLaw(law, option, nowTick): void`, `spendPoliticalMilli(amount: number): void`, `governmentTier(): number`, `currentGovernment(): GovernmentId`, `refreshGovernmentTier(): number | null`, `chooseGovernment(government, nowTick): void`
  - `DomesticClientView`: `pct`(조건 반영), `researchedTechs(): ReadonlySet<TechId>`, `laws(): ReadonlyMap<LawId, LawOption>`
  - 테스트 유틸 `grantLaws(player: Player, laws: Partial<Record<LawId, LawOption>>): void`, `grantGovernment(player: Player, government: GovernmentId): void` (둘 다 비용·조건·대기 무시)

- [ ] **Step 1: 테스트 유틸 추가**

`tests/domestic/util.ts`의 import 목록을 다음처럼 바꾼다(첫 두 줄):

```ts
import {
  GovernmentId,
  LawId,
  LawOption,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
```

`import { DOMESTIC_INTERVAL_TICKS } from "@openfront/engine-lib/domestic/Balance";`를 다음으로 바꾼다:

```ts
import {
  DOMESTIC_INTERVAL_TICKS,
  LAW_COOLDOWN_TICKS,
} from "@openfront/engine-lib/domestic/Balance";
```

파일 끝에 추가:

```ts
/** Proclaims laws directly, skipping costs, conditions and the cooldown. */
export function grantLaws(
  player: Player,
  laws: Partial<Record<LawId, LawOption>>,
): void {
  const d = player.domestic();
  if (d === null) throw new Error("player has no domestic state");
  for (const [law, option] of Object.entries(laws) as [LawId, LawOption][]) {
    // A cooldown that ends at tick 0 leaves the next proclamation open.
    d.proclaimLaw(law, option, -LAW_COOLDOWN_TICKS);
  }
}

/** Adopts a government directly, skipping tier rules and the cooldown. */
export function grantGovernment(
  player: Player,
  government: GovernmentId,
): void {
  const d = player.domestic();
  if (d === null) throw new Error("player has no domestic state");
  d.chooseGovernment(government, -LAW_COOLDOWN_TICKS);
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/domestic/PlayerPolicies.test.ts`:

```ts
import { Condition } from "@openfront/engine-api/domestic/DomesticTypes";
import { LAW_COOLDOWN_TICKS } from "@openfront/engine-lib/domestic/Balance";
import { PlayerDomestic } from "@openfront/engine/domestic/PlayerDomestic";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { conquerSquare, domesticGame, HUMAN } from "./util";

function when(...conditions: Condition[]): ReadonlySet<Condition> {
  return new Set(conditions);
}

describe("PlayerDomestic laws and government", () => {
  test("a proclaimed law applies its modifiers and starts the cooldown", () => {
    const d = new PlayerDomestic();
    d.proclaimLaw("trade", "A", 100);
    expect(d.proclaimedLaws().get("trade")).toBe("A");
    expect(d.pct("trade")).toBe(40);
    expect(d.lawCooldownUntilTick()).toBe(100 + LAW_COOLDOWN_TICKS);
  });

  test("conditional modifiers follow the active conditions", () => {
    const d = new PlayerDomestic();
    d.chooseGovernment("democracy", 0);
    expect(d.pct("political")).toBe(0);
    d.setConditions(when("notAttacking"));
    expect(d.pct("political")).toBe(30);
    d.setConditions(when("attacking"));
    expect(d.pct("political")).toBe(-50);
  });

  test("setting the same conditions keeps the cached data", () => {
    const d = new PlayerDomestic();
    d.setConditions(when("notAttacking"));
    const a = d.toData();
    d.setConditions(when("notAttacking"));
    expect(d.toData()).toBe(a);
    d.setConditions(when("attacking"));
    expect(d.toData()).not.toBe(a);
    expect(d.toData().conditions).toEqual(["attacking"]);
  });

  test("the tier rises with cumulative political power, once per tier", () => {
    const d = new PlayerDomestic();
    d.addYield(0, 299_999);
    expect(d.refreshGovernmentTier()).toBeNull();
    d.addYield(0, 1);
    expect(d.refreshGovernmentTier()).toBe(1);
    expect(d.refreshGovernmentTier()).toBeNull();
    d.spendPoliticalMilli(300_000);
    d.addYield(0, 3_200_000);
    expect(d.refreshGovernmentTier()).toBe(3);
    expect(d.governmentTier()).toBe(3);
    expect(d.cumulativePoliticalMilli()).toBe(3_500_000);
  });

  test("a new government replaces the old one's effects", () => {
    const d = new PlayerDomestic();
    d.chooseGovernment("monarchy", 0);
    expect(d.pct("maxTroops")).toBe(20);
    expect(d.hasFlag("feudal")).toBe(true);
    d.chooseGovernment("communism", 0);
    expect(d.pct("maxTroops")).toBe(0);
    expect(d.hasFlag("feudal")).toBe(false);
    expect(d.hasFlag("noProductionUpkeep")).toBe(true);
  });

  test("toData carries laws, cooldown, tier, government and conditions", () => {
    const d = new PlayerDomestic();
    d.addYield(0, 300_000);
    d.refreshGovernmentTier();
    d.proclaimLaw("religion", "A", 10);
    d.chooseGovernment("theocracy", 20);
    d.setConditions(when("notAttacking", "troopsAtMostHalf"));
    expect(d.toData()).toMatchObject({
      laws: { religion: "A" },
      lawCooldownUntilTick: 20 + LAW_COOLDOWN_TICKS,
      governmentTier: 1,
      government: "theocracy",
      conditions: ["notAttacking", "troopsAtMostHalf"],
    });
  });

  test("spending more political power than available throws", () => {
    const d = new PlayerDomestic();
    d.addYield(0, 500);
    expect(() => d.spendPoliticalMilli(501)).toThrow();
  });

  test("a snapshot written before laws existed restores with defaults", () => {
    const d = PlayerDomestic.restore({
      scienceMilli: 1000,
      politicalMilli: 2000,
      cumScienceMilli: 1000,
      cumPoliticalMilli: 2000,
      lastScienceMilli: 0,
      lastPoliticalMilli: 0,
      techs: ["currency"],
      research: null,
      recruitTargetPct: 100,
    });
    expect(d.proclaimedLaws().size).toBe(0);
    expect(d.currentGovernment()).toBe("chiefdom");
    expect(d.governmentTier()).toBe(0);
    expect(d.lawCooldownUntilTick()).toBe(0);
    expect(d.activeConditions().size).toBe(0);
    expect(d.hasTech("currency")).toBe(true);
  });

  test("snapshot round trip keeps laws, government, cooldown and conditions", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 10);
    const d = player.domestic()!;
    d.addYield(0, 400_000);
    d.refreshGovernmentTier();
    d.proclaimLaw("religion", "A", game.ticks());
    d.chooseGovernment("theocracy", game.ticks());
    d.setConditions(when("attacking", "troopsAtMostHalf"));

    const restored = await expectSnapshotRoundTrip(game, "plains", 5);
    const rd = restored.player(HUMAN.id).domestic()!;
    expect(rd.proclaimedLaws().get("religion")).toBe("A");
    expect(rd.currentGovernment()).toBe("theocracy");
    expect(rd.governmentTier()).toBe(1);
    expect(rd.lawCooldownUntilTick()).toBe(d.lawCooldownUntilTick());
    expect([...rd.activeConditions()]).toEqual([
      "attacking",
      "troopsAtMostHalf",
    ]);
    expect(rd.pct("political")).toBe(45);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest tests/domestic/PlayerPolicies.test.ts --run`
Expected: FAIL — `d.proclaimLaw is not a function`

- [ ] **Step 4: DomesticData 필드 추가**

`packages/engine-api/src/domestic/DomesticTypes.ts`의 `DomesticData` 인터페이스에서 `recruitTargetPct: number;` 뒤에 추가:

```ts
  /** Proclaimed laws (spec §5): category -> chosen option. */
  laws: Partial<Record<LawId, LawOption>>;
  /** No law can be proclaimed before this tick. */
  lawCooldownUntilTick: number;
  /** Highest government tier reached, 0..3. */
  governmentTier: number;
  government: GovernmentId;
  /** Conditions in force since the last processed second. */
  conditions: Condition[];
```

- [ ] **Step 5: PlayerDomestic 교체**

`packages/engine/src/domestic/PlayerDomestic.ts` 전체를 다음으로 바꾼다(1단계 내용에 법·정부·조건을 더한 것이다):

```ts
import {
  CONDITIONS,
  Condition,
  DomesticData,
  DomesticView,
  GOVERNMENT_IDS,
  GovernmentId,
  LAW_IDS,
  LAW_OPTIONS,
  LawId,
  LawOption,
  PolicyFlag,
  ResearchProgress,
  StatKey,
  TECH_IDS,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  LAW_COOLDOWN_TICKS,
  MILLI,
  RECRUIT_TARGET_DEFAULT_PCT,
  RECRUIT_TARGET_MAX_PCT,
  RECRUIT_TARGET_MIN_PCT,
} from "@openfront/engine-lib/domestic/Balance";
import { governmentTier } from "@openfront/engine-lib/domestic/Governments";
import {
  ModifierTotals,
  techModifiers,
} from "@openfront/engine-lib/domestic/Modifiers";
import {
  policyFlags,
  policyModifiers,
} from "@openfront/engine-lib/domestic/Policies";
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
  // Laws and government (phase 2). Optional so earlier snapshots still load.
  laws: z
    .array(z.object({ law: z.enum(LAW_IDS), option: z.enum(LAW_OPTIONS) }))
    .optional(),
  lawCooldownUntilTick: zInt().optional(),
  governmentTier: zInt().optional(),
  government: z.enum(GOVERNMENT_IDS).optional(),
  conditions: z.array(z.enum(CONDITIONS)).optional(),
});
export type DomesticState = z.infer<typeof DomesticStateSchema>;

/**
 * A player's domestic-mode state: science and political power (integer
 * milli-points, so accrual stays exact), researched techs, the current
 * research, the recruit target, proclaimed laws, the government and the
 * conditions that conditional modifiers test. Only non-bot players in a
 * domestic-mode game have one.
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
  /** Proclaimed laws, in proclamation order. */
  private laws = new Map<LawId, LawOption>();
  private lawCooldownUntil = 0;
  private tier = 0;
  private government: GovernmentId = "chiefdom";
  /** Set once per processed second (DomesticEconomy.activeConditions). */
  private conditions: ReadonlySet<Condition> = new Set<Condition>();
  private totals = new ModifierTotals([]);
  private flags: ReadonlySet<PolicyFlag> = new Set<PolicyFlag>();
  /** toData() result until the next change. */
  private domesticDataCache: DomesticData | null = null;

  pct(stat: StatKey): number {
    return this.totals.pct(stat, this.conditions);
  }

  hasTech(tech: TechId): boolean {
    return this.techs.has(tech);
  }

  researchedTechs(): ReadonlySet<TechId> {
    return this.techs;
  }

  hasFlag(flag: PolicyFlag): boolean {
    return this.flags.has(flag);
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

  /** Spending never lowers the cumulative total (spec §5.1). */
  spendPoliticalMilli(amount: number): void {
    if (amount < 0 || amount > this.politicalMilli) {
      throw new Error(
        `cannot spend ${amount} political milli-points, have ${this.politicalMilli}`,
      );
    }
    this.politicalMilli -= amount;
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
    this.rebuild();
    this.changed();
    return r.tech;
  }

  activeConditions(): ReadonlySet<Condition> {
    return this.conditions;
  }

  /** Conditional modifiers follow `conditions` until the next call. */
  setConditions(conditions: ReadonlySet<Condition>): void {
    if (
      conditions.size === this.conditions.size &&
      [...conditions].every((c) => this.conditions.has(c))
    ) {
      return;
    }
    this.conditions = new Set(conditions);
    this.changed();
  }

  proclaimedLaws(): ReadonlyMap<LawId, LawOption> {
    return this.laws;
  }

  lawCooldownUntilTick(): number {
    return this.lawCooldownUntil;
  }

  /** Records a law forever and starts the cooldown. Callers validate first. */
  proclaimLaw(law: LawId, option: LawOption, nowTick: number): void {
    this.laws.set(law, option);
    this.lawCooldownUntil = nowTick + LAW_COOLDOWN_TICKS;
    this.rebuild();
    this.changed();
  }

  governmentTier(): number {
    return this.tier;
  }

  currentGovernment(): GovernmentId {
    return this.government;
  }

  /** Raises the tier to what cumulative political power reached; the new tier if it rose. */
  refreshGovernmentTier(): number | null {
    const tier = governmentTier(this.cumPoliticalMilli);
    if (tier <= this.tier) return null;
    this.tier = tier;
    this.changed();
    return tier;
  }

  /**
   * Replaces the government (its effects swap at once, spec §6.1) and
   * restarts the law cooldown. Callers validate first.
   */
  chooseGovernment(government: GovernmentId, nowTick: number): void {
    this.government = government;
    this.lawCooldownUntil = nowTick + LAW_COOLDOWN_TICKS;
    this.rebuild();
    this.changed();
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
      laws: Object.fromEntries(this.laws) as Partial<
        Record<LawId, LawOption>
      >,
      lawCooldownUntilTick: this.lawCooldownUntil,
      governmentTier: this.tier,
      government: this.government,
      conditions: [...this.conditions],
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
      laws: [...this.laws].map(([law, option]) => ({ law, option })),
      lawCooldownUntilTick: this.lawCooldownUntil,
      governmentTier: this.tier,
      government: this.government,
      conditions: [...this.conditions],
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
    d.laws = new Map((s.laws ?? []).map((l) => [l.law, l.option] as const));
    d.lawCooldownUntil = s.lawCooldownUntilTick ?? 0;
    d.tier = s.governmentTier ?? 0;
    d.government = s.government ?? "chiefdom";
    d.conditions = new Set(s.conditions ?? []);
    d.rebuild();
    return d;
  }

  /** Recomputes the modifier totals and flags from techs, laws and government. */
  private rebuild(): void {
    this.totals = new ModifierTotals([
      ...techModifiers(this.techs),
      ...policyModifiers(this.laws, this.government),
    ]);
    this.flags = policyFlags(this.laws, this.government);
  }

  private changed(): void {
    this.domesticDataCache = null;
  }
}
```

- [ ] **Step 6: DomesticClientView 교체**

`src/client/view/DomesticClientView.ts` 전체를 다음으로 바꾼다:

```ts
import {
  Condition,
  DomesticData,
  DomesticView,
  LawId,
  LawOption,
  StatKey,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { lawMapOf } from "@openfront/engine-lib/domestic/Laws";
import {
  ModifierTotals,
  techModifiers,
} from "@openfront/engine-lib/domestic/Modifiers";
import { policyModifiers } from "@openfront/engine-lib/domestic/Policies";

/** Client-side DomesticView over the last DomesticData the worker sent. */
export class DomesticClientView implements DomesticView {
  private readonly techSet: ReadonlySet<TechId>;
  private readonly lawMap: ReadonlyMap<LawId, LawOption>;
  private readonly conditionSet: ReadonlySet<Condition>;
  private readonly totals: ModifierTotals;

  constructor(public readonly data: DomesticData) {
    this.techSet = new Set(data.techs);
    this.lawMap = lawMapOf(data.laws);
    this.conditionSet = new Set(data.conditions);
    this.totals = new ModifierTotals([
      ...techModifiers(data.techs),
      ...policyModifiers(this.lawMap, data.government),
    ]);
  }

  pct(stat: StatKey): number {
    return this.totals.pct(stat, this.conditionSet);
  }

  hasTech(tech: TechId): boolean {
    return this.techSet.has(tech);
  }

  researchedTechs(): ReadonlySet<TechId> {
    return this.techSet;
  }

  laws(): ReadonlyMap<LawId, LawOption> {
    return this.lawMap;
  }

  recruitTargetPct(): number {
    return this.data.recruitTargetPct;
  }
}
```

- [ ] **Step 7: 1단계 화면 테스트 갱신**

`tests/client/DomesticClient.test.ts`의 `new DomesticClientView({ ... })` 리터럴에서 `recruitTargetPct: 60,` 뒤에 추가:

```ts
      laws: {},
      lawCooldownUntilTick: 0,
      governmentTier: 0,
      government: "chiefdom",
      conditions: [],
```

같은 파일의 `describe("DomesticClientView", () => {` 블록 안, 기존 테스트 뒤에 추가:

```ts
  test("applies laws, the government and the active conditions", () => {
    const view = new DomesticClientView({
      science: 0,
      political: 0,
      cumulativeScience: 0,
      cumulativePolitical: 0,
      sciencePerSec: 0,
      politicalPerSec: 0,
      techs: [],
      research: null,
      recruitTargetPct: 100,
      laws: { trade: "A" },
      lawCooldownUntilTick: 0,
      governmentTier: 2,
      government: "democracy",
      conditions: ["attacking"],
    });
    expect(view.pct("trade")).toBe(40);
    expect(view.pct("political")).toBe(-50);
    expect(view.pct("goldIncome")).toBe(30);
    expect(view.laws().get("trade")).toBe("A");
  });
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest tests/domestic tests/client/DomesticClient.test.ts tests/core/snapshot --run && npm run typecheck`
Expected: 모두 PASS(1단계 domestic 테스트 포함), typecheck 오류 없음

- [ ] **Step 9: 커밋**

```bash
npx prettier --write packages/engine-api/src/domestic packages/engine/src/domestic/PlayerDomestic.ts src/client/view/DomesticClientView.ts tests/domestic tests/client/DomesticClient.test.ts
git add -A packages/engine-api/src/domestic packages/engine/src/domestic src/client/view tests/domestic tests/client/DomesticClient.test.ts
git commit -m "feat(domestic): per-player laws, government and condition state"
```

---

### Task 3: 매초 처리에 조건, 특수 효과, 정부 단계 알림 추가

**Files:**
- Modify: `packages/engine/src/domestic/DomesticEconomy.ts`
- Modify: `packages/engine-api/src/game/GameTypes.ts` (`MessageType.GOVERNMENT_TIER_REACHED`)
- Modify: `src/client/Utils.ts` (메시지 색)
- Test: `tests/domestic/PolicyEconomy.test.ts`

**Interfaces:**
- Consumes: Task 2의 `PlayerDomestic`(`setConditions`, `hasFlag`, `refreshGovernmentTier`), Task 1 Balance 상수, 1단계 `processDomesticSecond`·`finishedLevels`·`applyPct`·`capCombinedPct`
- Produces:
  - `activeConditions(player: Player, maxTroops: number): Set<Condition>`
  - `processDomesticSecond`가 조건 갱신, 연구 보조금, 봉건제, 십일조, 공산주의 운영비 면제, 단계 알림을 처리
  - `MessageType.GOVERNMENT_TIER_REACHED`(메시지 키 `events_display.government_tier_reached`, 파라미터 `{ tier: number }`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/PolicyEconomy.test.ts`:

```ts
import { Condition } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  MessageType,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { vi } from "vitest";
import {
  activeConditions,
  processDomesticSecond,
} from "@openfront/engine/domestic/DomesticEconomy";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { executeTicks } from "../util/utils";
import {
  conquerSquare,
  domesticGame,
  grantGovernment,
  grantLaws,
  HUMAN,
} from "./util";

const OTHER = new PlayerInfo("other", PlayerType.Human, null, "other_id");

async function readyPlayer(): Promise<{ game: Game; player: Player }> {
  const game = await domesticGame();
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 10); // 1% of the land
  return { game, player };
}

/** A at (0,0) 10x10 next to B at (10,0) 20x20, so A can attack B. */
async function neighbours(): Promise<{ game: Game; a: Player; b: Player }> {
  const game = await domesticGame({}, [HUMAN, OTHER]);
  const a = game.player(HUMAN.id);
  const b = game.player(OTHER.id);
  conquerSquare(game, a, 0, 0, 10);
  conquerSquare(game, b, 10, 0, 20);
  a.setTroops(50_000);
  return { game, a, b };
}

function second(game: Game, player: Player): void {
  processDomesticSecond(game, player, player.domestic()!);
}

describe("conditions", () => {
  test("not attacking, and troops at most half of max", async () => {
    const { game, player } = await readyPlayer();
    const max = game.config().maxTroops(player);
    player.setTroops(Math.floor(max / 2));
    expect([...activeConditions(player, max)]).toEqual([
      "notAttacking",
      "troopsAtMostHalf",
    ]);
    player.setTroops(max);
    expect([...activeConditions(player, max)]).toEqual(["notAttacking"]);
  });

  test("attacking another nation counts; unclaimed land and retreats don't", async () => {
    const { game, a, b } = await neighbours();
    const max = game.config().maxTroops(a);

    game.addExecution(
      new AttackExecution(1000, a, game.terraNullius().id(), null),
    );
    executeTicks(game, 1);
    expect(a.outgoingAttacks()).toHaveLength(1);
    expect(activeConditions(a, max).has("notAttacking")).toBe(true);

    game.addExecution(new AttackExecution(1000, a, b.id(), null));
    executeTicks(game, 1);
    expect(activeConditions(a, max).has("attacking")).toBe(true);

    for (const attack of a.outgoingAttacks()) attack.orderRetreat();
    expect(activeConditions(a, max).has("attacking")).toBe(false);
  });

  test("democracy: +30% political power in peace, -50% while attacking", async () => {
    const { game, a, b } = await neighbours();
    grantGovernment(a, "democracy");
    second(game, a);
    expect(a.domestic()!.pct("political")).toBe(30);
    game.addExecution(new AttackExecution(1000, a, b.id(), null));
    executeTicks(game, 1);
    second(game, a);
    expect(a.domestic()!.pct("political")).toBe(-50);
    expect(a.domestic()!.toData().conditions).toContain("attacking");
  });

  test("conditions flow into gold income (fascism's war economy)", async () => {
    const { game, player } = await readyPlayer();
    grantGovernment(player, "fascism");
    const d = player.domestic()!;
    d.setConditions(new Set<Condition>(["attacking"]));
    expect(game.config().goldAdditionRate(player)).toBe(130n);
    d.setConditions(new Set<Condition>(["notAttacking"]));
    expect(game.config().goldAdditionRate(player)).toBe(90n);
  });

  test("total mobilization doubles troop growth at or below half", async () => {
    const { game, player } = await readyPlayer();
    player.setTroops(30_000);
    const base = game.config().troopIncreaseRate(player);
    grantLaws(player, { mobilization: "A" });
    expect(game.config().troopIncreaseRate(player)).toBeCloseTo(base, 6);
    player
      .domestic()!
      .setConditions(new Set<Condition>(["notAttacking", "troopsAtMostHalf"]));
    expect(game.config().troopIncreaseRate(player)).toBeCloseTo(base * 2, 6);
  });
});

describe("special effects", () => {
  test("research subsidy turns 300 gold into 0.5 science a second", async () => {
    const { game, player } = await readyPlayer();
    grantLaws(player, { learning: "A" });
    player.addGold(1000n);
    second(game, player);
    expect(player.gold()).toBe(700n);
    expect(player.domestic()!.scienceMilliAvailable()).toBe(1000);
  });

  test("research subsidy needs the full 300 gold", async () => {
    const { game, player } = await readyPlayer();
    grantLaws(player, { learning: "A" });
    player.addGold(299n);
    second(game, player);
    expect(player.gold()).toBe(299n);
    expect(player.domestic()!.scienceMilliAvailable()).toBe(500);
  });

  test("feudalism: +0.2 political power per city level (monarchy)", async () => {
    const { game, player } = await readyPlayer();
    player.addGold(1_000_000n);
    player.buildUnit(UnitType.City, game.ref(5, 5), {});
    grantGovernment(player, "monarchy");
    second(game, player);
    expect(player.domestic()!.politicalMilliAvailable()).toBe(700);
    expect(player.domestic()!.scienceMilliAvailable()).toBe(425);
  });

  test("tithe: 100 × sqrt(land share %) gold a second (theocracy)", async () => {
    const { game, player } = await readyPlayer();
    grantGovernment(player, "theocracy");
    second(game, player);
    expect(player.gold()).toBe(100n);
    expect(player.domestic()!.politicalMilliAvailable()).toBe(650);
  });

  test("communism runs institutes without upkeep", async () => {
    const { game, player } = await readyPlayer();
    player.addGold(100_000n);
    player.buildUnit(UnitType.ResearchInstitute, game.ref(5, 5), {});
    expect(player.gold()).toBe(0n);
    grantGovernment(player, "communism");
    second(game, player);
    expect(player.domestic()!.scienceMilliAvailable()).toBe(2000);
    expect(player.gold()).toBe(0n);
  });
});

describe("government tiers", () => {
  test("reaching a tier is announced once", async () => {
    const { game, player } = await readyPlayer();
    const spy = vi.spyOn(game, "displayMessage");
    const d = player.domestic()!;
    d.addYield(0, 299_600);
    second(game, player);
    expect(d.governmentTier()).toBe(1);
    expect(spy).toHaveBeenCalledWith(
      "events_display.government_tier_reached",
      MessageType.GOVERNMENT_TIER_REACHED,
      player.id(),
      undefined,
      { tier: 1 },
    );
    second(game, player);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/PolicyEconomy.test.ts --run`
Expected: FAIL — `activeConditions` is not exported

- [ ] **Step 3: 메시지 타입 추가**

`packages/engine-api/src/game/GameTypes.ts`의 `MessageType` enum에서 `RESEARCH_COMPLETE,` 뒤에 `GOVERNMENT_TIER_REACHED,`를 추가한다. `MESSAGE_TYPE_CATEGORIES`의 `[MessageType.RESEARCH_COMPLETE]: MessageCategory.TRADE,` 뒤에 추가:

```ts
  [MessageType.GOVERNMENT_TIER_REACHED]: MessageCategory.TRADE,
```

`src/client/Utils.ts`의 `getMessageTypeClasses`에서 `case MessageType.RESEARCH_COMPLETE:` 바로 뒤에 `case MessageType.GOVERNMENT_TIER_REACHED:`를 추가한다(초록색 "success" 그룹).

- [ ] **Step 4: DomesticEconomy import 수정**

`packages/engine/src/domestic/DomesticEconomy.ts`:
- 맨 위에 추가: `import type { Condition } from "@openfront/engine-api/domestic/DomesticTypes";`
- `@openfront/engine-lib/domestic/Balance` import 목록에 `FEUDAL_POLITICAL_PER_CITY_LEVEL`, `RESEARCH_SUBSIDY_GOLD_PER_SEC`, `RESEARCH_SUBSIDY_SCIENCE_PER_SEC`, `TITHE_GOLD_PER_SQRT_PCT`를 추가한다.

- [ ] **Step 5: 땅 비율 도우미로 교체**

같은 파일의 `function territoryYield(mg: Game, player: Player): number { ... }` 함수 전체를 다음으로 바꾼다:

```ts
/** Owned land as a percent of the map's land. */
function landSharePct(mg: Game, player: Player): number {
  const land = mg.numLandTiles();
  return land <= 0 ? 0 : (player.numTilesOwned() * 100) / land;
}
```

- [ ] **Step 6: 새 도우미 추가**

같은 파일의 `function hasInterest(d: PlayerDomestic): boolean { ... }` 함수 바로 뒤에 추가:

```ts
/**
 * The conditions conditional modifiers test this second (spec §7.1). An
 * attack counts while it targets another player and isn't retreating; a
 * boat at sea has no attack yet (AttackExecution starts on landing).
 */
export function activeConditions(
  player: Player,
  maxTroops: number,
): Set<Condition> {
  const out = new Set<Condition>();
  const attacking = player
    .outgoingAttacks()
    .some((a) => a.target().isPlayer() && !a.retreating());
  out.add(attacking ? "attacking" : "notAttacking");
  if (player.troops() * 2 <= maxTroops) {
    out.add("troopsAtMostHalf");
  }
  return out;
}

/** Research subsidies take all 300 gold or nothing. */
function payResearchSubsidy(player: Player): boolean {
  if (player.gold() < RESEARCH_SUBSIDY_GOLD_PER_SEC) return false;
  player.removeGold(RESEARCH_SUBSIDY_GOLD_PER_SEC);
  return true;
}

/**
 * Theocracy's tithe (spec §6.2): 100 × sqrt(land share %) gold a second.
 * It is part of goldIncome (spec §7.2), so goldIncome and allGold apply, and
 * the lobby's gold multiplier like the rest of the base income.
 */
function payTithe(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
  sharePct: number,
): void {
  const pct = capCombinedPct(d.pct("goldIncome") + d.pct("allGold"));
  const gold = Math.floor(
    applyPct(TITHE_GOLD_PER_SQRT_PCT * Math.sqrt(sharePct), pct) *
      mg.config().goldMultiplier(),
  );
  if (gold > 0) player.addGold(BigInt(gold));
}
```

- [ ] **Step 7: processDomesticSecond 교체**

같은 파일의 `processDomesticSecond` 함수 전체(위의 doc 주석 포함)를 다음으로 바꾼다. 유지비 줄부터 끝까지는 1단계와 같다:

```ts
/**
 * One second of a player's domestic economy (spec §3, §5, §6): this
 * second's conditions, building upkeep and output (with research subsidies
 * and feudalism), the government tier, the tithe, troop upkeep and
 * desertion, demobilization down to the recruit target, banking interest,
 * then research progress. The order is fixed so every client runs it
 * identically.
 */
export function processDomesticSecond(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
): void {
  const maxTroops = mg.config().maxTroops(player);
  d.setConditions(activeConditions(player, maxTroops));

  const instituteLevels = finishedLevels(player, UnitType.ResearchInstitute);
  const officeLevels = finishedLevels(player, UnitType.AdminOffice);
  // Communism: institutes and offices run without upkeep.
  const freeUpkeep = d.hasFlag("noProductionUpkeep");
  const institutesRun =
    freeUpkeep || payBuildingUpkeep(player, instituteLevels);
  const officesRun = freeUpkeep || payBuildingUpkeep(player, officeLevels);

  const sharePct = landSharePct(mg, player);
  const territory = TERRITORY_YIELD_PER_SQRT_PCT * Math.sqrt(sharePct);
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
  const subsidy =
    d.hasFlag("researchSubsidy") && payResearchSubsidy(player)
      ? RESEARCH_SUBSIDY_SCIENCE_PER_SEC
      : 0;
  const feudal = d.hasFlag("feudal")
    ? finishedLevels(player, UnitType.City) * FEUDAL_POLITICAL_PER_CITY_LEVEL
    : 0;
  const science =
    applyPct(territory + instituteOutput + subsidy, d.pct("science")) * mult;
  const political =
    applyPct(territory + officeOutput + feudal, d.pct("political")) * mult;
  d.addYield(Math.round(science * MILLI), Math.round(political * MILLI));

  const tier = d.refreshGovernmentTier();
  if (tier !== null) {
    mg.displayMessage(
      "events_display.government_tier_reached",
      MessageType.GOVERNMENT_TIER_REACHED,
      player.id(),
      undefined,
      { tier },
    );
  }
  if (d.hasFlag("tithe")) {
    payTithe(mg, player, d, sharePct);
  }

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

- [ ] **Step 8: 통과 확인**

Run: `npx vitest tests/domestic tests/MessageTypeClasses.test.ts --run && npm run typecheck`
Expected: 모두 PASS(1단계 `DomesticEconomy.test.ts` 포함 — 특수 효과가 없으면 값이 1단계와 같다), typecheck 오류 없음

- [ ] **Step 9: 커밋**

```bash
npx prettier --write packages/engine/src/domestic/DomesticEconomy.ts packages/engine-api/src/game/GameTypes.ts src/client/Utils.ts tests/domestic/PolicyEconomy.test.ts
git add packages/engine/src/domestic/DomesticEconomy.ts packages/engine-api/src/game/GameTypes.ts src/client/Utils.ts tests/domestic/PolicyEconomy.test.ts
git commit -m "feat(domestic): conditions, policy special effects and tier announcements"
```

---

### Task 4: 법 선포·정부 선택 명령

**Files:**
- Modify: `packages/engine-api/src/Schemas.ts` (인텐트 2개)
- Modify: `packages/engine/src/domestic/DomesticEconomy.ts` (`payPoints`)
- Modify: `packages/engine/src/domestic/ResearchExecution.ts` (`payPoints` 사용)
- Create: `packages/engine/src/domestic/ProclaimLawExecution.ts`
- Create: `packages/engine/src/domestic/ChooseGovernmentExecution.ts`
- Modify: `packages/engine/src/execution/ExecutionManager.ts`
- Modify: `packages/engine/src/snapshot/ExecutionRegistry.ts`
- Modify: `tests/core/snapshot/FullGameSnapshot.test.ts` (`neverStored`)
- Modify: `tests/zbin/wire.test.ts` (`SAMPLE_INTENTS`)
- Test: `tests/domestic/LawsAndGovernment.test.ts`

**Interfaces:**
- Consumes: Task 1의 `lawBlock`, `lawCost`, `governmentBlock`; Task 2의 `PlayerDomestic`; 1단계 `shortfallGold`, `MILLI`
- Produces:
  - 인텐트 `{ type: "proclaim_law"; law: LawId; option: LawOption; payWithGold?: boolean }`, `{ type: "choose_government"; government: GovernmentId }`, 타입 `ProclaimLawIntent`, `ChooseGovernmentIntent`
  - `payPoints(player: Player, d: PlayerDomestic, resource: "science" | "political", costMilli: number, payWithGold: boolean): boolean`
  - `new ProclaimLawExecution(player: Player, law: LawId, option: LawOption, payWithGold: boolean)`
  - `new ChooseGovernmentExecution(player: Player, government: GovernmentId)`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/LawsAndGovernment.test.ts`:

```ts
import {
  GovernmentId,
  LawId,
  LawOption,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { IntentSchema } from "@openfront/engine-api/Schemas";
import { LAW_COOLDOWN_TICKS } from "@openfront/engine-lib/domestic/Balance";
import { ChooseGovernmentExecution } from "@openfront/engine/domestic/ChooseGovernmentExecution";
import { ProclaimLawExecution } from "@openfront/engine/domestic/ProclaimLawExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import {
  conquerSquare,
  domesticGame,
  grantGovernment,
  grantLaws,
  grantTechs,
  HUMAN,
} from "./util";

async function readyPlayer(): Promise<{ game: Game; player: Player }> {
  const game = await domesticGame();
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 10);
  return { game, player };
}

function proclaim(
  game: Game,
  player: Player,
  law: LawId,
  option: LawOption,
  payWithGold = false,
): void {
  game.addExecution(new ProclaimLawExecution(player, law, option, payWithGold));
  executeTicks(game, 1);
}

function choose(game: Game, player: Player, government: GovernmentId): void {
  game.addExecution(new ChooseGovernmentExecution(player, government));
  executeTicks(game, 1);
}

describe("ProclaimLawExecution", () => {
  test("spends political power, keeps the cumulative total, applies the law", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 250_000);
    const t0 = game.ticks();
    proclaim(game, player, "trade", "A");
    expect(d.proclaimedLaws().get("trade")).toBe("A");
    expect(d.politicalMilliAvailable()).toBe(150_000);
    expect(d.cumulativePoliticalMilli()).toBe(250_000);
    expect(d.pct("trade")).toBe(40);
    expect(d.lawCooldownUntilTick()).toBe(t0 + LAW_COOLDOWN_TICKS);
  });

  test("each law costs more: the second costs 150", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 249_000);
    proclaim(game, player, "trade", "A");
    executeTicks(game, LAW_COOLDOWN_TICKS);
    proclaim(game, player, "opinion", "A");
    expect(d.proclaimedLaws().has("opinion")).toBe(false);
    d.addYield(0, 1_000);
    proclaim(game, player, "opinion", "A");
    expect(d.proclaimedLaws().get("opinion")).toBe("A");
    expect(d.politicalMilliAvailable()).toBe(0);
  });

  test("the cooldown blocks the next law for 45 seconds", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 1_000_000);
    proclaim(game, player, "trade", "A"); // at tick t0
    executeTicks(game, LAW_COOLDOWN_TICKS - 2);
    proclaim(game, player, "opinion", "A"); // at t0 + 449
    expect(d.proclaimedLaws().has("opinion")).toBe(false);
    proclaim(game, player, "opinion", "A"); // at t0 + 450
    expect(d.proclaimedLaws().get("opinion")).toBe("A");
  });

  test("the other option of a proclaimed law is closed forever", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 1_000_000);
    proclaim(game, player, "trade", "A");
    executeTicks(game, LAW_COOLDOWN_TICKS);
    const before = d.politicalMilliAvailable();
    proclaim(game, player, "trade", "B");
    expect(d.proclaimedLaws().get("trade")).toBe("A");
    expect(d.politicalMilliAvailable()).toBe(before);
  });

  test("the nuclear law needs the Manhattan Project", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 1_000_000);
    proclaim(game, player, "nuclear", "B");
    expect(d.proclaimedLaws().has("nuclear")).toBe(false);
    expect(d.politicalMilliAvailable()).toBe(1_000_000);
    grantTechs(player, "rocketry", "manhattan_project");
    proclaim(game, player, "nuclear", "B");
    expect(d.proclaimedLaws().get("nuclear")).toBe("B");
  });

  test("a shortfall needs payWithGold and enough gold", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 40_000);
    proclaim(game, player, "trade", "A");
    expect(d.proclaimedLaws().size).toBe(0);
    player.addGold(59_999n);
    proclaim(game, player, "trade", "A", true);
    expect(d.proclaimedLaws().size).toBe(0);
    player.addGold(1n);
    proclaim(game, player, "trade", "A", true);
    expect(d.proclaimedLaws().get("trade")).toBe("A");
    expect(player.gold()).toBe(0n);
    expect(d.politicalMilliAvailable()).toBe(0);
  });

  test("democracy halves the gold price of a shortfall", async () => {
    const { game, player } = await readyPlayer();
    grantGovernment(player, "democracy");
    const d = player.domestic()!;
    d.addYield(0, 40_000);
    player.addGold(30_000n);
    proclaim(game, player, "trade", "A", true);
    expect(d.proclaimedLaws().get("trade")).toBe("A");
    expect(player.gold()).toBe(0n);
  });

  test("printing press makes laws 15% cheaper", async () => {
    const { game, player } = await readyPlayer();
    grantTechs(player, "printing_press");
    const d = player.domestic()!;
    d.addYield(0, 85_000);
    proclaim(game, player, "trade", "A");
    expect(d.proclaimedLaws().get("trade")).toBe("A");
    expect(d.politicalMilliAvailable()).toBe(0);
  });
});

describe("ChooseGovernmentExecution", () => {
  test("needs the tier and locks the choice until the next tier", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    choose(game, player, "monarchy");
    expect(d.currentGovernment()).toBe("chiefdom");

    d.addYield(0, 300_000);
    d.refreshGovernmentTier();
    choose(game, player, "monarchy");
    expect(d.currentGovernment()).toBe("monarchy");
    expect(d.pct("maxTroops")).toBe(20);
    choose(game, player, "republic");
    expect(d.currentGovernment()).toBe("monarchy");

    d.addYield(0, 1_200_000);
    d.refreshGovernmentTier();
    choose(game, player, "democracy");
    expect(d.currentGovernment()).toBe("democracy");
    expect(d.pct("maxTroops")).toBe(0);
    expect(d.pct("goldIncome")).toBe(30);
  });

  test("theocracy needs state religion", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 300_000);
    d.refreshGovernmentTier();
    choose(game, player, "theocracy");
    expect(d.currentGovernment()).toBe("chiefdom");
    grantLaws(player, { religion: "A" });
    choose(game, player, "theocracy");
    expect(d.currentGovernment()).toBe("theocracy");
    expect(d.hasFlag("tithe")).toBe(true);
  });

  test("choosing a government ignores the law cooldown but restarts it", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 400_000);
    d.refreshGovernmentTier();
    proclaim(game, player, "trade", "A");
    const t1 = game.ticks();
    choose(game, player, "republic");
    expect(d.currentGovernment()).toBe("republic");
    expect(d.lawCooldownUntilTick()).toBe(t1 + LAW_COOLDOWN_TICKS);
  });

  test("tier 3 still lets a player adopt a tier-2 government", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 3_500_000);
    d.refreshGovernmentTier();
    choose(game, player, "republic");
    expect(d.currentGovernment()).toBe("chiefdom");
    choose(game, player, "fascism");
    expect(d.currentGovernment()).toBe("fascism");
  });
});

describe("laws and governments across snapshots and the wire", () => {
  test("laws, government and pending orders survive a snapshot", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 600_000);
    d.refreshGovernmentTier();
    proclaim(game, player, "religion", "A");
    // Still pending when the snapshot is taken.
    game.addExecution(new ChooseGovernmentExecution(player, "theocracy"));

    const restored = await expectSnapshotRoundTrip(game, "plains", 5);
    const rd = restored.player(HUMAN.id).domestic()!;
    expect(rd.proclaimedLaws().get("religion")).toBe("A");
    expect(rd.currentGovernment()).toBe("theocracy");
    expect(rd.lawCooldownUntilTick()).toBe(d.lawCooldownUntilTick());
  });

  test("intents validate", () => {
    expect(
      IntentSchema.safeParse({
        type: "proclaim_law",
        law: "trade",
        option: "B",
        payWithGold: true,
      }).success,
    ).toBe(true);
    expect(
      IntentSchema.safeParse({ type: "proclaim_law", law: "taxes", option: "A" })
        .success,
    ).toBe(false);
    expect(
      IntentSchema.safeParse({ type: "proclaim_law", law: "trade", option: "C" })
        .success,
    ).toBe(false);
    expect(
      IntentSchema.safeParse({ type: "choose_government", government: "fascism" })
        .success,
    ).toBe(true);
    expect(
      IntentSchema.safeParse({ type: "choose_government", government: "anarchy" })
        .success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/LawsAndGovernment.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine/domestic/ChooseGovernmentExecution'`

- [ ] **Step 3: 인텐트 스키마 추가**

`packages/engine-api/src/Schemas.ts`:
- `import { TECH_IDS } from "./domestic/DomesticTypes";`를 다음으로 바꾼다:

```ts
import {
  GOVERNMENT_IDS,
  LAW_IDS,
  LAW_OPTIONS,
  TECH_IDS,
} from "./domestic/DomesticTypes";
```

- `Intent` 유니언 끝의 `| SetRecruitTargetIntent;`를 다음으로 바꾼다:

```ts
  | SetRecruitTargetIntent
  | ProclaimLawIntent
  | ChooseGovernmentIntent;
```

- `export type SetRecruitTargetIntent = ...;` 선언 바로 뒤에 추가:

```ts
export type ProclaimLawIntent = z.infer<typeof ProclaimLawIntentSchema>;
export type ChooseGovernmentIntent = z.infer<
  typeof ChooseGovernmentIntentSchema
>;
```

- `SetRecruitTargetIntentSchema` 정의 바로 뒤에 추가:

```ts

// Domestic mode: proclaim one option of a law forever, paying a political
// shortfall with gold when payWithGold is set.
export const ProclaimLawIntentSchema = z.object({
  type: z.literal("proclaim_law"),
  law: z.enum(LAW_IDS),
  option: z.enum(LAW_OPTIONS),
  payWithGold: z.boolean().optional(),
});

// Domestic mode: adopt a government of the current tier.
export const ChooseGovernmentIntentSchema = z.object({
  type: z.literal("choose_government"),
  government: z.enum(GOVERNMENT_IDS),
});
```

- `IntentSchema` 목록 끝 `SetRecruitTargetIntentSchema,` 뒤에 추가:

```ts
  ProclaimLawIntentSchema,
  ChooseGovernmentIntentSchema,
```

- [ ] **Step 4: 포인트 결제 도우미**

`packages/engine/src/domestic/DomesticEconomy.ts`에 `import { shortfallGold } from "@openfront/engine-lib/domestic/Research";`를 추가하고, 파일 끝에 추가:

```ts
/**
 * Spends `costMilli` of science or political power. A shortfall is paid in
 * gold (spec §3.1) only when `payWithGold` is set and the player has it.
 * Returns false, spending nothing, when the player can't pay.
 */
export function payPoints(
  player: Player,
  d: PlayerDomestic,
  resource: "science" | "political",
  costMilli: number,
  payWithGold: boolean,
): boolean {
  const available =
    resource === "science"
      ? d.scienceMilliAvailable()
      : d.politicalMilliAvailable();
  const spend = (amount: number): void => {
    if (resource === "science") {
      d.spendScienceMilli(amount);
    } else {
      d.spendPoliticalMilli(amount);
    }
  };
  if (available >= costMilli) {
    spend(costMilli);
    return true;
  }
  if (!payWithGold) return false;
  const gold = shortfallGold(costMilli - available, d.pct("goldPaymentCost"));
  if (player.gold() < gold) return false;
  player.removeGold(gold);
  spend(available);
  return true;
}
```

- [ ] **Step 5: ResearchExecution이 같은 도우미를 쓰게 하기**

`packages/engine/src/domestic/ResearchExecution.ts`:
- `import { payPoints } from "./DomesticEconomy";`를 추가한다(`shortfallGold` import는 prettier가 지운다).
- `init`의 다음 부분을

```ts
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
```

  다음으로 바꾼다:

```ts
    const costMilli = TECHS[this.tech].cost * MILLI;
    if (!payPoints(this.player, d, "science", costMilli, this.payWithGold)) {
      return;
    }
```

- [ ] **Step 6: ProclaimLawExecution 작성**

`packages/engine/src/domestic/ProclaimLawExecution.ts`:

```ts
import {
  LAW_IDS,
  LAW_OPTIONS,
  LawId,
  LawOption,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import { lawBlock, lawCost } from "@openfront/engine-lib/domestic/Laws";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { payPoints } from "./DomesticEconomy";

/** proclaim_law: pays and proclaims one option of a law forever (spec §5.1). */
export class ProclaimLawExecution implements Execution {
  constructor(
    private player: Player,
    private law: LawId,
    private option: LawOption,
    private payWithGold: boolean,
  ) {}

  init(mg: Game, _ticks: number): void {
    const d = this.player.domestic();
    if (d === null || !this.player.isAlive()) return;
    const laws = d.proclaimedLaws();
    const block = lawBlock(
      this.law,
      laws.get(this.law),
      d.researchedTechs(),
      d.lawCooldownUntilTick(),
      mg.ticks(),
    );
    if (block !== null) return;
    const costMilli = lawCost(laws.size, d.pct("lawCost")) * MILLI;
    if (!payPoints(this.player, d, "political", costMilli, this.payWithGold)) {
      return;
    }
    d.proclaimLaw(this.law, this.option, mg.ticks());
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return ProclaimLawExecutionSnapshot.write({
      player: w.player(this.player),
      law: this.law,
      option: this.option,
      payWithGold: this.payWithGold,
    });
  }

  restoreSnapshot(s: ProclaimLawState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.law = s.law;
    this.option = s.option;
    this.payWithGold = s.payWithGold;
  }
}

const ProclaimLawStateSchema = z.object({
  player: zPlayerRef(),
  law: z.enum(LAW_IDS),
  option: z.enum(LAW_OPTIONS),
  payWithGold: z.boolean(),
});
type ProclaimLawState = z.infer<typeof ProclaimLawStateSchema>;

export const ProclaimLawExecutionSnapshot = execSnapshotType({
  name: "ProclaimLaw",
  version: 1,
  schema: ProclaimLawStateSchema,
  cls: () => ProclaimLawExecution,
});
```

- [ ] **Step 7: ChooseGovernmentExecution 작성**

`packages/engine/src/domestic/ChooseGovernmentExecution.ts`:

```ts
import {
  GOVERNMENT_IDS,
  GovernmentId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { governmentBlock } from "@openfront/engine-lib/domestic/Governments";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/**
 * choose_government: adopts a government of the current tier (spec §6.1).
 * Free, and allowed during the law cooldown; it restarts the cooldown.
 */
export class ChooseGovernmentExecution implements Execution {
  constructor(
    private player: Player,
    private government: GovernmentId,
  ) {}

  init(mg: Game, _ticks: number): void {
    const d = this.player.domestic();
    if (d === null || !this.player.isAlive()) return;
    const block = governmentBlock(
      d.governmentTier(),
      d.currentGovernment(),
      d.proclaimedLaws(),
      this.government,
    );
    if (block !== null) return;
    d.chooseGovernment(this.government, mg.ticks());
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return ChooseGovernmentExecutionSnapshot.write({
      player: w.player(this.player),
      government: this.government,
    });
  }

  restoreSnapshot(s: ChooseGovernmentState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.government = s.government;
  }
}

const ChooseGovernmentStateSchema = z.object({
  player: zPlayerRef(),
  government: z.enum(GOVERNMENT_IDS),
});
type ChooseGovernmentState = z.infer<typeof ChooseGovernmentStateSchema>;

export const ChooseGovernmentExecutionSnapshot = execSnapshotType({
  name: "ChooseGovernment",
  version: 1,
  schema: ChooseGovernmentStateSchema,
  cls: () => ChooseGovernmentExecution,
});
```

- [ ] **Step 8: 명령 연결과 등록**

`packages/engine/src/execution/ExecutionManager.ts`: import 추가

```ts
import { ChooseGovernmentExecution } from "../domestic/ChooseGovernmentExecution";
import { ProclaimLawExecution } from "../domestic/ProclaimLawExecution";
```

`createExec` switch의 `case "set_recruit_target":` 블록(`return new SetRecruitTargetExecution(player, intent.percent);`) 뒤에 추가:

```ts
      case "proclaim_law":
        return new ProclaimLawExecution(
          player,
          intent.law,
          intent.option,
          intent.payWithGold ?? false,
        );
      case "choose_government":
        return new ChooseGovernmentExecution(player, intent.government);
```

`packages/engine/src/snapshot/ExecutionRegistry.ts`: import에 `ChooseGovernmentExecutionSnapshot`(`../domestic/ChooseGovernmentExecution`)과 `ProclaimLawExecutionSnapshot`(`../domestic/ProclaimLawExecution`)을 추가하고, `EXECUTION_SNAPSHOT_TYPES`의 `CityExecutionSnapshot,` 바로 앞에 `ChooseGovernmentExecutionSnapshot,`, `PortExecutionSnapshot,` 바로 뒤에 `ProclaimLawExecutionSnapshot,`를 추가한다.

`tests/core/snapshot/FullGameSnapshot.test.ts`의 "the game exercised every execution type" 테스트는 등록된 모든 실행이 원작 스크립트 게임에 나타나야 통과한다. 두 명령은 내정 모드에서만 오므로 `const neverStored = new Set([` 목록(1단계가 이미 항목을 더했을 수 있다)에 다음 두 항목을 추가한다:

```ts
        // Domestic-mode intents: the scripted game is vanilla.
        "ChooseGovernment",
        "ProclaimLaw",
```

`tests/zbin/wire.test.ts`의 `SAMPLE_INTENTS` 배열 끝(`];` 바로 앞)에 추가해서 두 인텐트가 바이너리 왕복 테스트를 거치게 한다:

```ts
  {
    type: "proclaim_law",
    clientID: P1,
    law: "diplomacy",
    option: "B",
    payWithGold: true,
  },
  { type: "choose_government", clientID: P2, government: "communism" },
```

- [ ] **Step 9: 통과 확인**

Run: `npx vitest tests/domestic tests/zbin tests/server --run && npm run typecheck`
Expected: 모두 PASS(1단계 `ResearchExecution.test.ts` 포함)

- [ ] **Step 10: 커밋**

```bash
npx prettier --write packages/engine-api/src/Schemas.ts packages/engine/src/domestic packages/engine/src/execution/ExecutionManager.ts packages/engine/src/snapshot/ExecutionRegistry.ts tests/core/snapshot/FullGameSnapshot.test.ts tests/zbin/wire.test.ts tests/domestic/LawsAndGovernment.test.ts
git add -A packages tests/core/snapshot/FullGameSnapshot.test.ts tests/zbin/wire.test.ts tests/domestic
git commit -m "feat(domestic): proclaim_law and choose_government intents"
```

---

### Task 5: 전투 보정(공격·방어 손실, 공격·확장 속도)

**Files:**
- Modify: `packages/engine/src/configuration/EngineConfig.ts` (`AttackLogicInput`, `attackLogic`)
- Modify: `packages/engine/src/domestic/DomesticEconomy.ts` (`domesticCombat`)
- Modify: `packages/engine/src/execution/AttackExecution.ts`
- Test: `tests/domestic/CombatModifiers.test.ts`

**Interfaces:**
- Consumes: `PlayerDomestic.pct`(Task 2), 1단계 `AttackLogicInput.defender.defensePostScale`
- Produces:
  - `AttackLogicInput.attacker.lossScale?: number`, `AttackLogicInput.attacker.speedScale?: number`, `AttackLogicInput.defender.lossScale?: number` (모두 1 = 원작)
  - `interface DomesticCombat { attackerLoss: number; attackerSpeed: number; defenderLoss: number }`, `domesticCombat(attacker: Player, defender: Player | null): Readonly<DomesticCombat>`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/CombatModifiers.test.ts`:

```ts
import {
  PlayerInfo,
  PlayerType,
  TerrainType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import {
  AttackLogicInput,
  AttackLogicResult,
  EngineConfig,
} from "@openfront/engine/configuration/EngineConfig";
import { domesticCombat } from "@openfront/engine/domestic/DomesticEconomy";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { setup } from "../util/Setup";
import { TestConfig } from "../util/TestConfig";
import { executeTicks } from "../util/utils";
import { conquerSquare, grantGovernment, grantLaws, HUMAN } from "./util";

const OTHER = new PlayerInfo("other", PlayerType.Human, null, "other_id");
// The real formula; TestConfig stubs attackLogic out.
const formula = new EngineConfig({} as GameConfig, false);

const DEFENDER = {
  type: PlayerType.Human,
  numTiles: 1000,
  troops: 10_000,
  isTraitor: false,
  isDisconnectedTeammate: false,
};

function input(o: Partial<AttackLogicInput> = {}): AttackLogicInput {
  return {
    terrain: TerrainType.Plains,
    attackTroops: 10_000,
    attacker: { type: PlayerType.Human, numTiles: 1000 },
    defender: DEFENDER,
    defenderHasDefensePost: false,
    falloutRatio: null,
    borderSize: 10,
    ...o,
  };
}

/** Records every attackLogic input; the stubbed result stays the same. */
class RecordingConfig extends TestConfig {
  readonly inputs: AttackLogicInput[] = [];
  override attackLogic(i: AttackLogicInput): AttackLogicResult {
    this.inputs.push(i);
    return super.attackLogic(i);
  }
}

describe("attackLogic scales", () => {
  test("absent scales and scales of 1 are vanilla", () => {
    const base = formula.attackLogic(input());
    expect(
      formula.attackLogic(
        input({
          attacker: {
            type: PlayerType.Human,
            numTiles: 1000,
            lossScale: 1,
            speedScale: 1,
          },
          defender: { ...DEFENDER, lossScale: 1 },
        }),
      ),
    ).toEqual(base);
    const tn = formula.attackLogic(input({ defender: null }));
    expect(
      formula.attackLogic(
        input({
          defender: null,
          attacker: { type: PlayerType.Human, numTiles: 1000, speedScale: 1 },
        }),
      ),
    ).toEqual(tn);
  });

  test("loss scales multiply losses; the speed scale divides the tick share", () => {
    const base = formula.attackLogic(input());
    const r = formula.attackLogic(
      input({
        attacker: {
          type: PlayerType.Human,
          numTiles: 1000,
          lossScale: 0.85,
          speedScale: 1.3,
        },
        defender: { ...DEFENDER, lossScale: 1.1 },
      }),
    );
    expect(r.attackerTroopLoss).toBeCloseTo(base.attackerTroopLoss * 0.85, 9);
    expect(r.defenderTroopLoss).toBeCloseTo(base.defenderTroopLoss * 1.1, 9);
    expect(r.tickFraction).toBeCloseTo(base.tickFraction / 1.3, 9);
  });

  test("expansion uses only the speed scale", () => {
    const base = formula.attackLogic(input({ defender: null }));
    const r = formula.attackLogic(
      input({
        defender: null,
        attacker: {
          type: PlayerType.Human,
          numTiles: 1000,
          lossScale: 0.5,
          speedScale: 1.2,
        },
      }),
    );
    expect(r.attackerTroopLoss).toBe(base.attackerTroopLoss);
    expect(r.tickFraction).toBeCloseTo(base.tickFraction / 1.2, 9);
  });
});

describe("domesticCombat", () => {
  test("laws and governments set each side's scales", async () => {
    const game = await setup("plains", { domesticMode: true }, [HUMAN, OTHER]);
    const a = game.player(HUMAN.id);
    const b = game.player(OTHER.id);
    expect(domesticCombat(a, b)).toEqual({
      attackerLoss: 1,
      attackerSpeed: 1,
      defenderLoss: 1,
    });
    // Professional army (attackLoss -15) and blitzkrieg (attackSpeed +30).
    grantLaws(a, { service: "B", doctrine: "B" });
    // Theocracy: defenseLoss -20.
    grantGovernment(b, "theocracy");
    const c = domesticCombat(a, b);
    expect(c.attackerLoss).toBeCloseTo(0.85, 9);
    expect(c.attackerSpeed).toBeCloseTo(1.3, 9);
    expect(c.defenderLoss).toBeCloseTo(0.8, 9);
  });

  test("expanding into unclaimed land only uses expansionSpeed", async () => {
    const game = await setup("plains", { domesticMode: true }, [HUMAN]);
    const a = game.player(HUMAN.id);
    grantLaws(a, { service: "B", religion: "B" });
    const c = domesticCombat(a, null);
    expect(c.attackerLoss).toBe(1);
    expect(c.attackerSpeed).toBeCloseTo(1.2, 9);
    expect(c.defenderLoss).toBe(1);
  });

  test("players without domestic state stay at 1", async () => {
    const game = await setup("plains", {}, [HUMAN, OTHER]);
    const a = game.player(HUMAN.id);
    const b = game.player(OTHER.id);
    expect(domesticCombat(a, b)).toEqual({
      attackerLoss: 1,
      attackerSpeed: 1,
      defenderLoss: 1,
    });
    expect(domesticCombat(a, null)).toEqual({
      attackerLoss: 1,
      attackerSpeed: 1,
      defenderLoss: 1,
    });
  });
});

describe("AttackExecution passes the scales", () => {
  async function recordingGame() {
    const game = await setup(
      "plains",
      { domesticMode: true },
      [HUMAN, OTHER],
      undefined,
      RecordingConfig,
    );
    const a = game.player(HUMAN.id);
    const b = game.player(OTHER.id);
    conquerSquare(game, a, 0, 0, 10);
    conquerSquare(game, b, 10, 0, 20);
    a.setTroops(50_000);
    return { game, a, b, config: game.config() as RecordingConfig };
  }

  test("an attack on a player carries both sides' scales", async () => {
    const { game, a, b, config } = await recordingGame();
    grantLaws(a, { service: "B", doctrine: "B" });
    grantLaws(b, { doctrine: "A" }); // defenseLoss -15
    game.addExecution(new AttackExecution(1000, a, b.id(), null));
    executeTicks(game, 3);
    const last = config.inputs[config.inputs.length - 1];
    expect(last.attacker.lossScale).toBeCloseTo(0.85, 9);
    expect(last.attacker.speedScale).toBeCloseTo(1.3, 9);
    expect(last.defender?.lossScale).toBeCloseTo(0.85, 9);
  });

  test("expansion carries expansionSpeed", async () => {
    const { game, a, config } = await recordingGame();
    grantLaws(a, { religion: "B" });
    game.addExecution(
      new AttackExecution(1000, a, game.terraNullius().id(), null),
    );
    executeTicks(game, 3);
    const last = config.inputs[config.inputs.length - 1];
    expect(last.defender).toBeNull();
    expect(last.attacker.speedScale).toBeCloseTo(1.2, 9);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/CombatModifiers.test.ts --run`
Expected: FAIL — `domesticCombat` is not exported

- [ ] **Step 3: 전투 입력 타입과 공식 수정**

`packages/engine/src/configuration/EngineConfig.ts`:
- `AttackLogicInput`의 `attacker: { type: PlayerType; numTiles: number };`를 다음으로 바꾼다:

```ts
  attacker: {
    type: PlayerType;
    numTiles: number;
    /** Domestic mode: multiplies the attacker's losses (attackLoss); 1 = vanilla. */
    lossScale?: number;
    /** Domestic mode: attack or expansion speed (1.3 = 30% faster); 1 = vanilla. */
    speedScale?: number;
  };
```

- 같은 인터페이스 `defender` 안의 1단계 필드

```ts
    /** Domestic mode: defense-post effect scale (1 = vanilla). */
    defensePostScale?: number;
```

  뒤에 추가:

```ts
    /** Domestic mode: multiplies the defender's losses (defenseLoss); 1 = vanilla. */
    lossScale?: number;
```

- `attackLogic`의 빈 땅 분기에서

```ts
          within(
            (TERRA_NULLIUS_COST_SCALE * tileCost) / attackTroops,
            TERRA_NULLIUS_MIN_COST,
            TERRA_NULLIUS_MAX_COST,
          ) / tickBudget,
```

  를 다음으로 바꾼다(÷1은 정확해서 원작 값이 그대로다):

```ts
          within(
            (TERRA_NULLIUS_COST_SCALE * tileCost) / attackTroops,
            TERRA_NULLIUS_MIN_COST,
            TERRA_NULLIUS_MAX_COST,
          ) /
          tickBudget /
          (attacker.speedScale ?? 1),
```

- `attackLogic` 끝의 반환문

```ts
    return {
      attackerTroopLoss,
      defenderTroopLoss,
      tickFraction:
        (speedCost *
          tileCost *
          largeAttackerSpeedBonus *
          largeDefenderBonus *
          traitorCostMod) /
        input.borderSize,
    };
```

  를 다음으로 바꾼다(×1, ÷1은 정확하다):

```ts
    return {
      attackerTroopLoss: attackerTroopLoss * (attacker.lossScale ?? 1),
      defenderTroopLoss: defenderTroopLoss * (defender.lossScale ?? 1),
      tickFraction:
        (speedCost *
          tileCost *
          largeAttackerSpeedBonus *
          largeDefenderBonus *
          traitorCostMod) /
        input.borderSize /
        (attacker.speedScale ?? 1),
    };
```

- [ ] **Step 4: domesticCombat 작성**

`packages/engine/src/domestic/DomesticEconomy.ts`에 `import type { StatKey } from "@openfront/engine-api/domestic/DomesticTypes";`를 추가하고(`Condition` import와 합쳐도 된다), 파일 끝에 추가:

```ts
/** Combat scales from domestic modifiers (spec §7.2); 1 = vanilla. */
export interface DomesticCombat {
  /** Multiplies the attacker's troop loss per tile. */
  attackerLoss: number;
  /** Divides the tick share each tile costs (1.3 = 30% faster). */
  attackerSpeed: number;
  /** Multiplies the defender's troop loss per tile. */
  defenderLoss: number;
}

const NO_COMBAT_MODIFIERS: Readonly<DomesticCombat> = {
  attackerLoss: 1,
  attackerSpeed: 1,
  defenderLoss: 1,
};

function statScale(d: PlayerDomestic | null, stat: StatKey): number {
  return d === null ? 1 : 1 + d.pct(stat) / 100;
}

/**
 * attackLoss and attackSpeed come from the attacker, defenseLoss from the
 * defender. Expanding into unclaimed land (no defender) only uses
 * expansionSpeed.
 */
export function domesticCombat(
  attacker: Player,
  defender: Player | null,
): Readonly<DomesticCombat> {
  const a = attacker.domestic();
  const d = defender === null ? null : defender.domestic();
  if (a === null && d === null) return NO_COMBAT_MODIFIERS;
  if (defender === null) {
    return {
      attackerLoss: 1,
      attackerSpeed: statScale(a, "expansionSpeed"),
      defenderLoss: 1,
    };
  }
  return {
    attackerLoss: statScale(a, "attackLoss"),
    attackerSpeed: statScale(a, "attackSpeed"),
    defenderLoss: statScale(d, "defenseLoss"),
  };
}
```

- [ ] **Step 5: AttackExecution 연결**

`packages/engine/src/execution/AttackExecution.ts`:
- 1단계 import `import { domesticDefensePostScale } from "../domestic/DomesticEconomy";`를 다음으로 바꾼다:

```ts
import {
  DomesticCombat,
  domesticCombat,
  domesticDefensePostScale,
} from "../domestic/DomesticEconomy";
```

- `tick()`의 `const borderSize = this.attack.borderSize() + this.random.nextInt(0, 5);` 바로 뒤에 추가:

```ts
    // Domestic combat modifiers hold for the whole tick (1 = vanilla).
    const combat = domesticCombat(this._owner, targetPlayer);
```

- 같은 메서드의

```ts
        .attackLogic(
          this.attackLogicInput(troopCount, tileToConquer, borderSize),
        );
```

  를 다음으로 바꾼다:

```ts
        .attackLogic(
          this.attackLogicInput(troopCount, tileToConquer, borderSize, combat),
        );
```

- `attackLogicInput`의 시그니처

```ts
  private attackLogicInput(
    attackTroops: number,
    tile: TileRef,
    borderSize: number,
  ): AttackLogicInput {
```

  를 다음으로 바꾼다:

```ts
  private attackLogicInput(
    attackTroops: number,
    tile: TileRef,
    borderSize: number,
    combat: Readonly<DomesticCombat>,
  ): AttackLogicInput {
```

- 같은 메서드의 반환 객체에서

```ts
      attacker: {
        type: this._owner.type(),
        numTiles: this._owner.numTilesOwned(),
      },
```

  를 다음으로 바꾼다:

```ts
      attacker: {
        type: this._owner.type(),
        numTiles: this._owner.numTilesOwned(),
        lossScale: combat.attackerLoss,
        speedScale: combat.attackerSpeed,
      },
```

- defender 객체의 1단계 줄 `defensePostScale: domesticDefensePostScale(defender),` 뒤에 추가:

```ts
              lossScale: combat.defenderLoss,
```

- [ ] **Step 6: 통과 확인(원작 골든 테스트 포함)**

Run: `npx vitest tests/domestic tests/AttackLogicGolden.test.ts tests/AttackScenarios.test.ts tests/Attack.test.ts --run && npm run typecheck`
Expected: 모두 PASS. 골든 스냅샷이 바뀌면 안 된다(바뀌면 기본값 1 처리가 원작 값을 바꾼 것이니 고친다).

- [ ] **Step 7: 커밋**

```bash
npx prettier --write packages/engine/src/configuration/EngineConfig.ts packages/engine/src/domestic/DomesticEconomy.ts packages/engine/src/execution/AttackExecution.ts tests/domestic/CombatModifiers.test.ts
git add packages/engine/src/configuration/EngineConfig.ts packages/engine/src/domestic/DomesticEconomy.ts packages/engine/src/execution/AttackExecution.ts tests/domestic/CombatModifiers.test.ts
git commit -m "feat(domestic): combat loss and speed modifiers"
```

---

### Task 6: 건설 시간 보정(엔진)

**Files:**
- Modify: `packages/engine-api/src/game/GameUpdates.ts` (`UnitUpdate.constructionTicks`)
- Modify: `packages/engine/src/game/Game.ts` (`Unit` 인터페이스)
- Modify: `packages/engine/src/game/UnitImpl.ts`
- Modify: `packages/engine/src/domestic/DomesticEconomy.ts` (`domesticConstructionTicks`)
- Modify: `packages/engine/src/execution/ConstructionExecution.ts`
- Test: `tests/domestic/BuildTime.test.ts`

**Interfaces:**
- Consumes: `PlayerDomestic.pct`, 1단계 `capCombinedPct`
- Produces:
  - `domesticConstructionTicks(base: number, player: Player, type: UnitType): number`
  - `Unit.constructionTicks(): number | undefined`, `Unit.setConstructionTicks(ticks: number): void`
  - `UnitUpdate.constructionTicks?: number` (내정 모드에서 건설 중인 구조물만)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/BuildTime.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { domesticConstructionTicks } from "@openfront/engine/domestic/DomesticEconomy";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { Game } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import {
  conquerSquare,
  domesticGame,
  grantGovernment,
  grantLaws,
  HUMAN,
} from "./util";

/** Starts a city at (5,5) and runs the two ticks that place it. */
function startCity(game: Game): void {
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 20);
  player.addGold(1_000_000n);
  game.addExecution(
    new ConstructionExecution(player, UnitType.City, game.ref(5, 5)),
  );
  executeTicks(game, 2);
}

describe("build time modifiers", () => {
  test("rapid construction halves every build time; urban planning only cities", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    expect(domesticConstructionTicks(20, player, UnitType.City)).toBe(20);
    grantLaws(player, { construction: "B" });
    expect(domesticConstructionTicks(20, player, UnitType.City)).toBe(10);
    expect(domesticConstructionTicks(50, player, UnitType.Port)).toBe(25);
    grantLaws(player, { taxation: "B" });
    expect(domesticConstructionTicks(20, player, UnitType.City)).toBe(8);
    expect(domesticConstructionTicks(50, player, UnitType.Port)).toBe(25);
  });

  test("stacked build-time cuts stop at -60%", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    grantLaws(player, { construction: "B" });
    grantGovernment(player, "communism");
    expect(domesticConstructionTicks(50, player, UnitType.DefensePost)).toBe(
      20,
    );
  });

  test("instant build stays instant", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    grantLaws(player, { construction: "B" });
    expect(domesticConstructionTicks(0, player, UnitType.City)).toBe(0);
  });

  test("a structure finishes after its modified build time and says so", async () => {
    const game = await domesticGame();
    grantLaws(game.player(HUMAN.id), { construction: "B" });
    startCity(game);
    const city = game.player(HUMAN.id).units(UnitType.City)[0];
    expect(city.isUnderConstruction()).toBe(true);
    expect(city.constructionTicks()).toBe(10);
    expect(city.toUpdate().constructionTicks).toBe(10);
    executeTicks(game, 11);
    expect(city.isUnderConstruction()).toBe(false);
  });

  test("the build time survives a snapshot", async () => {
    const game = await domesticGame();
    grantLaws(game.player(HUMAN.id), { construction: "B" });
    startCity(game);
    const restored = await expectSnapshotRoundTrip(game, "plains", 11);
    const city = restored.player(HUMAN.id).units(UnitType.City)[0];
    expect(city.constructionTicks()).toBe(10);
    expect(city.isUnderConstruction()).toBe(false);
  });

  test("vanilla structures don't carry construction ticks", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    startCity(game);
    const city = game.player(HUMAN.id).units(UnitType.City)[0];
    expect(city.constructionTicks()).toBeUndefined();
    expect("constructionTicks" in city.toUpdate()).toBe(false);
    executeTicks(game, 11);
    expect(city.isUnderConstruction()).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/BuildTime.test.ts --run`
Expected: FAIL — `domesticConstructionTicks` is not exported

- [ ] **Step 3: 유닛 업데이트와 인터페이스**

`packages/engine-api/src/game/GameUpdates.ts`의 `UnitUpdate`에서 `underConstruction?: boolean;` 뒤에 추가:

```ts
  /** Domestic mode: this structure's real build time, for the progress bar. */
  constructionTicks?: number;
```

`packages/engine/src/game/Game.ts`의 `Unit` 인터페이스에서

```ts
  // Construction phase on structures
  isUnderConstruction(): boolean;
  setUnderConstruction(underConstruction: boolean): void;
```

뒤에 추가:

```ts
  /** Domestic mode: this structure's modified build time (spec §10.9). */
  constructionTicks(): number | undefined;
  setConstructionTicks(ticks: number): void;
```

- [ ] **Step 4: UnitImpl 수정**

`packages/engine/src/game/UnitImpl.ts`:
- 필드 `private _underConstruction: boolean = false;` 뒤에 추가:

```ts
  /** Domestic mode only: the real build time, sent to the client. */
  private _constructionTicks: number | undefined = undefined;
```

- `setUnderConstruction` 메서드 바로 뒤에 추가:

```ts
  constructionTicks(): number | undefined {
    return this._constructionTicks;
  }

  setConstructionTicks(ticks: number): void {
    this._constructionTicks = ticks;
  }
```

- `toUpdate()`의 마지막 `return update;` 바로 앞에 추가(원작 게임의 업데이트에는 키가 생기지 않는다):

```ts
    if (this._constructionTicks !== undefined) {
      update.constructionTicks = this._constructionTicks;
    }
```

- `snapshot`의 반환 객체 끝

```ts
            duration: this._samLauncherState.duration,
          }
        : null,
    };
```

  을 다음으로 바꾼다:

```ts
            duration: this._samLauncherState.duration,
          }
        : null,
      // Domestic mode only, so vanilla snapshots keep their bytes.
      ...(this._constructionTicks === undefined
        ? {}
        : { constructionTicks: this._constructionTicks }),
    };
```

- `restoreSnapshot` 끝

```ts
    this._samLauncherState = s.samLauncherState
      ? { ...s.samLauncherState }
      : undefined;
```

  뒤에 추가:

```ts
    this._constructionTicks = s.constructionTicks;
```

- `UnitSnapshot` 스키마의 `samLauncherState: z.object({...}).nullable(),` 뒤에 추가:

```ts
    constructionTicks: zInt().optional(),
```

- [ ] **Step 5: 건설 시간 계산**

`packages/engine/src/domestic/DomesticEconomy.ts` 파일 끝에 추가:

```ts
/**
 * A structure's build time under buildTime (and cityBuildTime for cities),
 * capped at -60% together and never below one tick. Instant builds (0)
 * stay instant.
 */
export function domesticConstructionTicks(
  base: number,
  player: Player,
  type: UnitType,
): number {
  const d = player.domestic();
  if (d === null || base <= 0) return base;
  let pct = d.pct("buildTime");
  if (type === UnitType.City) pct += d.pct("cityBuildTime");
  pct = capCombinedPct(pct);
  return pct === 0
    ? base
    : Math.max(1, Math.round((base * (100 + pct)) / 100));
}
```

- [ ] **Step 6: ConstructionExecution 연결**

`packages/engine/src/execution/ConstructionExecution.ts`: `import { domesticConstructionTicks } from "../domestic/DomesticEconomy";`를 추가하고

```ts
      const duration = info.constructionDuration ?? 0;
      if (duration > 0) {
        this.structure.setUnderConstruction(true);
        this.ticksUntilComplete = duration;
        return;
      }
```

를 다음으로 바꾼다:

```ts
      const duration = domesticConstructionTicks(
        info.constructionDuration ?? 0,
        this.player,
        this.constructionType,
      );
      if (duration > 0) {
        if (this.player.domestic() !== null) {
          // The client's progress bar reads the real build time.
          this.structure.setConstructionTicks(duration);
        }
        this.structure.setUnderConstruction(true);
        this.ticksUntilComplete = duration;
        return;
      }
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest tests/domestic tests/core/snapshot tests/core/executions --run && npm run typecheck`
Expected: 모두 PASS

- [ ] **Step 8: 커밋**

```bash
npx prettier --write packages/engine-api/src/game/GameUpdates.ts packages/engine/src/game/Game.ts packages/engine/src/game/UnitImpl.ts packages/engine/src/domestic/DomesticEconomy.ts packages/engine/src/execution/ConstructionExecution.ts tests/domestic/BuildTime.test.ts
git add packages/engine-api/src/game/GameUpdates.ts packages/engine/src/game/Game.ts packages/engine/src/game/UnitImpl.ts packages/engine/src/domestic/DomesticEconomy.ts packages/engine/src/execution/ConstructionExecution.ts tests/domestic/BuildTime.test.ts
git commit -m "feat(domestic): build time modifiers carried on unit updates"
```

---

### Task 7: 화면의 건설 진행 막대가 실제 건설 시간을 쓰게 하기

**Files:**
- Modify: `src/client/render/types/Renderer.ts` (`UnitState.constructionTicks`)
- Modify: `src/client/view/EntityState.ts`
- Modify: `src/client/replay/codec/EntitySchema.ts` (`UnitFields`)
- Create: `src/client/render/gl/utils/ConstructionProgress.ts`
- Modify: `src/client/render/gl/passes/BarPass.ts`
- Test: `tests/client/ConstructionProgress.test.ts`

**Interfaces:**
- Consumes: Task 6의 `UnitUpdate.constructionTicks`
- Produces: `UnitState.constructionTicks?: number`, `constructionProgress(unit: Pick<UnitState, "constructionStartTick" | "constructionTicks">, gameTick: number, defaultDuration: number): number`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/ConstructionProgress.test.ts`:

```ts
import { constructionProgress } from "../../src/client/render/gl/utils/ConstructionProgress";
import {
  applyUnitUpdateInPlace,
  unitStateFromUpdate,
} from "../../src/client/view/EntityState";
import { makeUnitUpdate } from "../util/viewStubs";

describe("construction progress", () => {
  test("uses the unit type's duration when the unit doesn't say", () => {
    expect(
      constructionProgress(
        { constructionStartTick: 100, constructionTicks: undefined },
        110,
        20,
      ),
    ).toBe(0.5);
  });

  test("uses the structure's own build time when sent (domestic mode)", () => {
    const unit = { constructionStartTick: 100, constructionTicks: 10 };
    expect(constructionProgress(unit, 105, 20)).toBe(0.5);
    expect(constructionProgress(unit, 120, 20)).toBe(1);
    expect(constructionProgress(unit, 90, 20)).toBe(0);
  });

  test("unit state carries constructionTicks from updates", () => {
    const state = unitStateFromUpdate(
      makeUnitUpdate({ underConstruction: true, constructionTicks: 25 }),
    );
    expect(state.constructionTicks).toBe(25);
    applyUnitUpdateInPlace(state, makeUnitUpdate({ underConstruction: false }));
    expect(state.constructionTicks).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/ConstructionProgress.test.ts --run`
Expected: FAIL — `Cannot find module '../../src/client/render/gl/utils/ConstructionProgress'`

- [ ] **Step 3: 렌더러 유닛 상태**

`src/client/render/types/Renderer.ts`의 `UnitState`에서 `constructionStartTick: number | null;` 뒤에 추가:

```ts
  /** Domestic mode: this structure's real build time; absent = the type's default. */
  constructionTicks?: number;
```

`src/client/view/EntityState.ts`:
- `unitStateFromUpdate`의 `constructionStartTick: null, // GameView fills in createdAt when underConstruction` 뒤에 `constructionTicks: u.constructionTicks,`를 추가한다.
- `applyUnitUpdateInPlace`의 `target.underConstruction = u.underConstruction ?? false;` 뒤에 `target.constructionTicks = u.constructionTicks;`를 추가한다.

`src/client/replay/codec/EntitySchema.ts`의

```ts
export type UnitFields = Omit<UnitState, "id" | "constructionStartTick">;
```

를 다음으로 바꾼다(리플레이는 이 값을 싣지 않고 기본 시간을 쓴다):

```ts
// constructionTicks is domestic-only; replays fall back to the type's duration.
export type UnitFields = Omit<
  UnitState,
  "id" | "constructionStartTick" | "constructionTicks"
>;
```

- [ ] **Step 4: 진행률 계산 작성**

`src/client/render/gl/utils/ConstructionProgress.ts`:

```ts
import type { UnitState } from "../../types";

/**
 * Build progress (0..1) of a structure under construction. Domestic mode
 * sends each structure's real build time; otherwise the unit type's
 * duration applies.
 */
export function constructionProgress(
  unit: Pick<UnitState, "constructionStartTick" | "constructionTicks">,
  gameTick: number,
  defaultDuration: number,
): number {
  const duration = unit.constructionTicks ?? defaultDuration;
  const start = unit.constructionStartTick ?? gameTick;
  return Math.min(1, Math.max(0, (gameTick - start) / duration));
}
```

- [ ] **Step 5: BarPass 연결**

`src/client/render/gl/passes/BarPass.ts`: `import { constructionProgress } from "../utils/ConstructionProgress";`를 추가하고, `computeStructureProgress`의

```ts
    // Construction progress
    if (unit.underConstruction && unit.constructionStartTick !== null) {
      const duration =
        this.config.unitInfo(unit.unitType as UnitType).constructionDuration ??
        50;
      const elapsed = gameTick - unit.constructionStartTick;
      return Math.min(1, Math.max(0, elapsed / duration));
    }
```

를 다음으로 바꾼다:

```ts
    // Construction progress (domestic mode sends the real build time)
    if (unit.underConstruction && unit.constructionStartTick !== null) {
      return constructionProgress(
        unit,
        gameTick,
        this.config.unitInfo(unit.unitType as UnitType).constructionDuration ??
          50,
      );
    }
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/client --run && npm run typecheck`
Expected: 모두 PASS(리플레이 `EntitySchema.test.ts` 포함)

- [ ] **Step 7: 커밋**

```bash
npx prettier --write src/client/render src/client/view/EntityState.ts src/client/replay/codec/EntitySchema.ts tests/client/ConstructionProgress.test.ts
git add src/client/render src/client/view/EntityState.ts src/client/replay/codec/EntitySchema.ts tests/client/ConstructionProgress.test.ts
git commit -m "feat(domestic): construction bar follows the real build time"
```

---

### Task 8: SAM 사거리(방공망)와 고립주의 무역 차단

**Files:**
- Modify: `packages/engine/src/configuration/EngineConfig.ts` (`dynamicSamRange`)
- Modify: `packages/engine/src/game/UnitImpl.ts` (`increaseLevel`)
- Modify: `packages/engine/src/game/PlayerImpl.ts` (`canTrade`)
- Test: `tests/domestic/SamAndIsolation.test.ts`

**Interfaces:**
- Consumes: `Config.domesticOf`(1단계), `PlayerDomestic.hasFlag`(Task 2)
- Produces: `EngineConfig.baseDynamicSamRange(sam: Unit, currentTick: number): number`(보정 전 사거리), `dynamicSamRange`가 소유자의 `samRange` 보정을 `maxSamRange()` 이하로 적용, `PlayerImpl.canTrade`가 고립주의를 양방향으로 막음

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/SamAndIsolation.test.ts`:

```ts
import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { Game } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { TestConfig } from "../util/TestConfig";
import { conquerSquare, domesticGame, grantLaws, HUMAN } from "./util";

const OTHER = new PlayerInfo("other", PlayerType.Human, null, "other_id");

class LongRangeConfig extends TestConfig {
  override samRange(_level: number): number {
    return 140;
  }
}

function buildSam(game: Game) {
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 20);
  player.addGold(10_000_000n);
  return player.buildUnit(UnitType.SAMLauncher, game.ref(5, 5), {});
}

describe("air defense network", () => {
  test("SAM range +30%", async () => {
    const game = await domesticGame();
    const sam = buildSam(game);
    expect(game.config().dynamicSamRange(sam, game.ticks())).toBe(20);
    grantLaws(game.player(HUMAN.id), { nuclear: "B" });
    expect(game.config().dynamicSamRange(sam, game.ticks())).toBeCloseTo(
      26,
      9,
    );
  });

  test("never beyond the maximum SAM range", async () => {
    const game = await setup(
      "plains",
      { domesticMode: true },
      [HUMAN],
      undefined,
      LongRangeConfig,
    );
    const sam = buildSam(game);
    grantLaws(game.player(HUMAN.id), { nuclear: "B" });
    expect(game.config().dynamicSamRange(sam, game.ticks())).toBe(
      game.config().maxSamRange(),
    );
  });

  test("an upgrade starts from the unmodified range", async () => {
    const game = await domesticGame();
    const sam = buildSam(game);
    grantLaws(game.player(HUMAN.id), { nuclear: "B" });
    sam.increaseLevel();
    expect(sam.samLauncherState()?.startRange).toBe(20);
    expect(game.config().dynamicSamRange(sam, game.ticks())).toBeCloseTo(
      26,
      9,
    );
  });
});

describe("isolationism", () => {
  test("no trade with anyone, both ways, allies included", async () => {
    const game = await domesticGame({}, [HUMAN, OTHER]);
    const a = game.player(HUMAN.id);
    const b = game.player(OTHER.id);
    conquerSquare(game, a, 0, 0, 10);
    conquerSquare(game, b, 50, 50, 10);
    expect(a.canTrade(b)).toBe(true);
    a.createAllianceRequest(b)?.accept();
    expect(a.isAlliedWith(b)).toBe(true);
    grantLaws(a, { diplomacy: "B" });
    expect(a.canTrade(b)).toBe(false);
    expect(b.canTrade(a)).toBe(false);
    expect(a.tradingPartners()).toEqual([]);
    expect(b.tradingPartners()).not.toContain(a);
  });

  test("trade outside domestic mode is unchanged", async () => {
    const game = await setup("plains", {}, [HUMAN, OTHER]);
    const a = game.player(HUMAN.id);
    const b = game.player(OTHER.id);
    conquerSquare(game, a, 0, 0, 10);
    conquerSquare(game, b, 50, 50, 10);
    expect(a.canTrade(b)).toBe(true);
    expect(a.canTrade(a)).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/SamAndIsolation.test.ts --run`
Expected: FAIL — "SAM range +30%"에서 `expected 20 to be close to 26`

- [ ] **Step 3: SAM 사거리 보정**

`packages/engine/src/configuration/EngineConfig.ts`의 `dynamicSamRange` 메서드 전체

```ts
  dynamicSamRange(sam: Unit, currentTick: number): number {
    const state = sam.samLauncherState();
    if (state === undefined || state.upgradeStartTick === undefined) {
      return this.samRange(sam.level());
    }
    const duration = state.duration ?? this.samUpgradeDuration();
    const elapsed = currentTick - state.upgradeStartTick;
    if (elapsed >= duration) {
      return this.samRange(state.targetLevel);
    }
    const targetRange = this.samRange(state.targetLevel);
    const diff = targetRange - state.startRange;
    return state.startRange + (diff * elapsed) / duration;
  }
```

를 다음으로 바꾼다:

```ts
  /**
   * The SAM's range with its owner's domestic samRange modifier, never past
   * maxSamRange() (the interception search prunes at that distance).
   */
  dynamicSamRange(sam: Unit, currentTick: number): number {
    const range = this.baseDynamicSamRange(sam, currentTick);
    const domestic = this.domesticOf(sam.owner());
    if (domestic === null) return range;
    const pct = domestic.pct("samRange");
    return pct === 0
      ? range
      : Math.min(this.maxSamRange(), applyPct(range, pct));
  }

  /** The SAM's range before domestic modifiers, interpolated while upgrading. */
  baseDynamicSamRange(sam: Unit, currentTick: number): number {
    const state = sam.samLauncherState();
    if (state === undefined || state.upgradeStartTick === undefined) {
      return this.samRange(sam.level());
    }
    const duration = state.duration ?? this.samUpgradeDuration();
    const elapsed = currentTick - state.upgradeStartTick;
    if (elapsed >= duration) {
      return this.samRange(state.targetLevel);
    }
    const targetRange = this.samRange(state.targetLevel);
    const diff = targetRange - state.startRange;
    return state.startRange + (diff * elapsed) / duration;
  }
```

`packages/engine/src/game/UnitImpl.ts`의 `increaseLevel`에서

```ts
      const currentRange = this.mg.config().dynamicSamRange(this, currentTick);
```

를 다음으로 바꾼다(보간 시작값에 보정이 두 번 걸리지 않게):

```ts
      const currentRange = this.mg
        .config()
        .baseDynamicSamRange(this, currentTick);
```

- [ ] **Step 4: 고립주의**

`packages/engine/src/game/PlayerImpl.ts`의 `canTrade`

```ts
  canTrade(other: Player): boolean {
    const embargo =
      other.hasEmbargoAgainst(this) || this.hasEmbargoAgainst(other);
    return !embargo && other.id() !== this.id();
  }
```

를 다음으로 바꾼다:

```ts
  canTrade(other: Player): boolean {
    const embargo =
      other.hasEmbargoAgainst(this) || this.hasEmbargoAgainst(other);
    if (embargo || other.id() === this.id()) return false;
    // Domestic mode: isolationism forbids trade with any other nation.
    return !(
      this._domestic?.hasFlag("noForeignTrade") ||
      other.domestic()?.hasFlag("noForeignTrade")
    );
  }
```

- [ ] **Step 5: 통과 확인(원작 SAM·무역 테스트 포함)**

Run: `npx vitest tests/domestic tests/core/executions/SAMLauncherExecution.test.ts tests/TradeTrainGolden.test.ts tests/TradeTrainScenarios.test.ts tests/PortExecution.test.ts --run && npm run typecheck`
Expected: 모두 PASS

- [ ] **Step 6: 커밋**

```bash
npx prettier --write packages/engine/src/configuration/EngineConfig.ts packages/engine/src/game/UnitImpl.ts packages/engine/src/game/PlayerImpl.ts tests/domestic/SamAndIsolation.test.ts
git add packages/engine/src/configuration/EngineConfig.ts packages/engine/src/game/UnitImpl.ts packages/engine/src/game/PlayerImpl.ts tests/domestic/SamAndIsolation.test.ts
git commit -m "feat(domestic): air defense SAM range and isolationism"
```

---

### Task 9: AI 성향(기술·법·정부·건물 비율)

**Files:**
- Create: `packages/engine/src/execution/nation/NationPersonality.ts`
- Modify(전체 교체): `packages/engine/src/execution/nation/NationDomesticBehavior.ts`
- Modify: `packages/engine/src/execution/nation/NationStructureBehavior.ts`
- Modify: `tests/domestic/NationDomestic.test.ts` (1단계 테스트 하나)
- Test: `tests/domestic/NationPersonality.test.ts`

**Interfaces:**
- Consumes: Task 4의 `ProclaimLawExecution`, `ChooseGovernmentExecution`; Task 1의 `lawBlock`, `lawCost`, `governmentBlock`, `GOVERNMENTS`, `MAX_GOVERNMENT_TIER`; 1단계 `ResearchExecution`, `SetRecruitTargetExecution`, `researchBlock`
- Produces:
  - `PERSONALITIES`, `Personality = "conqueror" | "merchant" | "scholar" | "zealot"`, `LawChoice { law: LawId; option: LawOption }`
  - `NationDomesticPlan { personality; techOrder: readonly TechId[]; lawOrder: readonly LawChoice[]; governments: readonly [GovernmentId, GovernmentId]; instituteRatio: number; officeRatio: number }`
  - `BALANCED_RESEARCH_ORDER`(1단계에서 옮김), `FALLBACK_LAW_ORDER`
  - `buildDomesticPlan(personality: Personality, random: PseudoRandom): NationDomesticPlan`, `nationDomesticPlan(playerId: PlayerID): NationDomesticPlan`
  - `nationDomesticTick(mg: Game, player: Player, plan?: NationDomesticPlan): void` (plan 생략 시 `nationDomesticPlan(player.id())`)

> 참고: `NationExecution`은 1단계의 `nationDomesticTick(this.mg, this.player);` 호출을 그대로 둔다. 계획은 플레이어 ID로 매번 같게 계산되므로 따로 저장하지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/NationPersonality.test.ts`:

```ts
import {
  LAW_IDS,
  TECH_IDS,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { LAW_COOLDOWN_TICKS } from "@openfront/engine-lib/domestic/Balance";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { nationDomesticTick } from "@openfront/engine/execution/nation/NationDomesticBehavior";
import {
  BALANCED_RESEARCH_ORDER,
  buildDomesticPlan,
  NationDomesticPlan,
  nationDomesticPlan,
  Personality,
  PERSONALITIES,
} from "@openfront/engine/execution/nation/NationPersonality";
import { Game, Player } from "@openfront/engine/game/Game";
import { executeTicks } from "../util/utils";
import { conquerSquare, domesticGame, grantLaws } from "./util";

const NATION = new PlayerInfo("nation", PlayerType.Nation, null, "nation_id");

const TEST_PLAN: NationDomesticPlan = {
  personality: "merchant",
  techOrder: BALANCED_RESEARCH_ORDER,
  lawOrder: [
    { law: "nuclear", option: "A" },
    { law: "opinion", option: "A" },
    { law: "trade", option: "A" },
  ],
  governments: ["republic", "democracy"],
  instituteRatio: 0.35,
  officeRatio: 0.35,
};

async function nationGame(): Promise<{ game: Game; nation: Player }> {
  const game = await domesticGame({}, []);
  const nation = game.addPlayer(NATION);
  conquerSquare(game, nation, 0, 0, 40); // 16% of the land
  return { game, nation };
}

function check(game: Game, nation: Player, plan: NationDomesticPlan): void {
  nationDomesticTick(game, nation, plan);
  executeTicks(game, 1);
}

describe("personality plans", () => {
  test("a plan is fixed by the player id; all four personalities occur", () => {
    expect(nationDomesticPlan("abc")).toEqual(nationDomesticPlan("abc"));
    const seen = new Set<Personality>();
    for (let i = 0; i < 200; i++) {
      seen.add(nationDomesticPlan(`nation_${i}`).personality);
    }
    expect([...seen].sort()).toEqual([...PERSONALITIES].sort());
  });

  test.each(PERSONALITIES)(
    "%s: every tech once and every law category once",
    (personality) => {
      const plan = buildDomesticPlan(personality, new PseudoRandom(3));
      expect([...plan.techOrder].sort()).toEqual([...TECH_IDS].sort());
      expect(plan.lawOrder.map((c) => c.law).sort()).toEqual(
        [...LAW_IDS].sort(),
      );
    },
  );

  test("priorities come first, lightly shuffled (scholar)", () => {
    const plan = buildDomesticPlan("scholar", new PseudoRandom(3));
    expect([...plan.techOrder.slice(0, 4)].sort()).toEqual(
      ["academia", "computers", "scientific_method", "space_program"].sort(),
    );
    expect(
      plan.lawOrder
        .slice(0, 3)
        .map((c) => `${c.law}:${c.option}`)
        .sort(),
    ).toEqual(["learning:A", "opinion:B", "religion:B"]);
  });

  test("governments, building ratios and isolationism follow the table", () => {
    const plans = Object.fromEntries(
      PERSONALITIES.map((p) => [p, buildDomesticPlan(p, new PseudoRandom(5))]),
    ) as Record<Personality, NationDomesticPlan>;
    expect(plans.conqueror.governments).toEqual(["monarchy", "fascism"]);
    expect(plans.merchant.governments).toEqual(["republic", "democracy"]);
    expect(plans.scholar.governments).toEqual(["republic", "communism"]);
    expect(plans.zealot.governments).toEqual(["theocracy", "democracy"]);
    expect(plans.scholar.instituteRatio).toBeGreaterThan(
      plans.scholar.officeRatio,
    );
    expect(plans.zealot.officeRatio).toBeGreaterThan(
      plans.zealot.instituteRatio,
    );
    for (const p of PERSONALITIES) {
      const isolationist = plans[p].lawOrder.some(
        (c) => c.law === "diplomacy" && c.option === "B",
      );
      expect(isolationist, p).toBe(p === "zealot");
    }
  });
});

describe("nationDomesticTick with a plan", () => {
  test("proclaims the first law it can, skipping laws it can't yet", async () => {
    const { game, nation } = await nationGame();
    nation.domestic()!.addYield(0, 100_000);
    check(game, nation, TEST_PLAN);
    expect(nation.domestic()!.proclaimedLaws().get("opinion")).toBe("A");
    expect(nation.domestic()!.proclaimedLaws().has("nuclear")).toBe(false);
  });

  test("waits out the cooldown instead of skipping laws", async () => {
    const { game, nation } = await nationGame();
    const d = nation.domestic()!;
    d.addYield(0, 100_000);
    check(game, nation, TEST_PLAN);
    d.addYield(0, 1_000_000);
    check(game, nation, TEST_PLAN);
    expect(d.proclaimedLaws().has("trade")).toBe(false);
    executeTicks(game, LAW_COOLDOWN_TICKS);
    check(game, nation, TEST_PLAN);
    expect(d.proclaimedLaws().get("trade")).toBe("A");
  });

  test("adopts its government before proclaiming a law", async () => {
    const { game, nation } = await nationGame();
    const d = nation.domestic()!;
    d.addYield(0, 300_000);
    d.refreshGovernmentTier();
    check(game, nation, TEST_PLAN);
    expect(d.currentGovernment()).toBe("republic");
    expect(d.proclaimedLaws().size).toBe(0);
  });

  test("theocracy falls back to monarchy without state religion", async () => {
    const plan: NationDomesticPlan = {
      ...TEST_PLAN,
      governments: ["theocracy", "democracy"],
    };
    const first = await nationGame();
    first.nation.domestic()!.addYield(0, 300_000);
    first.nation.domestic()!.refreshGovernmentTier();
    check(first.game, first.nation, plan);
    expect(first.nation.domestic()!.currentGovernment()).toBe("monarchy");

    const second = await nationGame();
    second.nation.domestic()!.addYield(0, 300_000);
    second.nation.domestic()!.refreshGovernmentTier();
    grantLaws(second.nation, { religion: "A" });
    check(second.game, second.nation, plan);
    expect(second.nation.domestic()!.currentGovernment()).toBe("theocracy");
  });

  test.each(PERSONALITIES)(
    "%s researches, legislates and governs over five minutes",
    async (personality) => {
      const { game, nation } = await nationGame();
      const plan = buildDomesticPlan(personality, new PseudoRandom(7));
      game.addExecution(new DomesticExecution());
      for (let t = 0; t < 3000; t += 50) {
        nationDomesticTick(game, nation, plan);
        executeTicks(game, 50);
      }
      const d = nation.domestic()!;
      expect(d.researchedTechs().size).toBeGreaterThanOrEqual(2);
      expect(d.proclaimedLaws().size).toBeGreaterThanOrEqual(2);
      expect(d.governmentTier()).toBeGreaterThanOrEqual(1);
      expect(d.currentGovernment()).not.toBe("chiefdom");
    },
  );
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/NationPersonality.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine/execution/nation/NationPersonality'`

- [ ] **Step 3: 성향 표 작성**

`packages/engine/src/execution/nation/NationPersonality.ts`:

```ts
import {
  GovernmentId,
  LawId,
  LawOption,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { PlayerID } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { simpleHash } from "@openfront/engine-lib/Util";

/** Spec §9.1. */
export const PERSONALITIES = [
  "conqueror",
  "merchant",
  "scholar",
  "zealot",
] as const;
export type Personality = (typeof PERSONALITIES)[number];

export interface LawChoice {
  law: LawId;
  option: LawOption;
}

/** What one nation researches, proclaims, adopts and builds. */
export interface NationDomesticPlan {
  personality: Personality;
  /** Priority techs (lightly shuffled), then the rest in balanced order. */
  techOrder: readonly TechId[];
  /** Priority laws (lightly shuffled), then FALLBACK_LAW_ORDER's others. */
  lawOrder: readonly LawChoice[];
  /** The government to adopt at tier 1 and at tier 2. */
  governments: readonly [GovernmentId, GovernmentId];
  /** Research institutes / admin offices wanted per city. */
  instituteRatio: number;
  officeRatio: number;
}

/** Every tech in a sensible order: what a nation researches after its priorities. */
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

/** One option per law, never isolationism: what a nation proclaims after its priorities. */
export const FALLBACK_LAW_ORDER: readonly LawChoice[] = [
  { law: "construction", option: "A" },
  { law: "opinion", option: "A" },
  { law: "taxation", option: "B" },
  { law: "learning", option: "B" },
  { law: "trade", option: "A" },
  { law: "mobilization", option: "B" },
  { law: "service", option: "B" },
  { law: "doctrine", option: "A" },
  { law: "religion", option: "B" },
  { law: "nuclear", option: "B" },
  { law: "diplomacy", option: "A" },
];

interface PersonalityDef {
  techs: readonly TechId[];
  laws: readonly LawChoice[];
  governments: readonly [GovernmentId, GovernmentId];
  instituteRatio: number;
  officeRatio: number;
}

// Spec §9.1. The ratios are this plan's choice (spec §9.2 leaves them open).
const PERSONALITY_DEFS: Readonly<Record<Personality, PersonalityDef>> = {
  conqueror: {
    techs: [
      "fortification",
      "conscription",
      "steel_ships",
      "rocketry",
      "manhattan_project",
      "thermonuclear",
    ],
    laws: [
      { law: "service", option: "A" },
      { law: "doctrine", option: "B" },
      { law: "mobilization", option: "A" },
      { law: "taxation", option: "A" },
      { law: "nuclear", option: "A" },
    ],
    governments: ["monarchy", "fascism"],
    instituteRatio: 0.5,
    officeRatio: 0.25,
  },
  merchant: {
    techs: [
      "currency",
      "navigation",
      "railroad",
      "banking",
      "global_trade",
      "industrialization",
      "globalization",
    ],
    laws: [
      { law: "trade", option: "A" },
      { law: "diplomacy", option: "A" },
      { law: "construction", option: "A" },
      { law: "religion", option: "B" },
    ],
    governments: ["republic", "democracy"],
    instituteRatio: 0.35,
    officeRatio: 0.35,
  },
  scholar: {
    techs: ["academia", "scientific_method", "computers", "space_program"],
    laws: [
      { law: "opinion", option: "B" },
      { law: "learning", option: "A" },
      { law: "religion", option: "B" },
    ],
    governments: ["republic", "communism"],
    instituteRatio: 1,
    officeRatio: 0.25,
  },
  zealot: {
    techs: ["bureaucracy", "printing_press", "radar"],
    laws: [
      { law: "religion", option: "A" },
      { law: "opinion", option: "A" },
      { law: "doctrine", option: "A" },
      { law: "diplomacy", option: "B" },
    ],
    governments: ["theocracy", "democracy"],
    instituteRatio: 0.25,
    officeRatio: 1,
  },
};

/** Odds (1 in N) that two neighbours in a priority list swap places. */
const JITTER_SWAP_ODDS = 3;

/** One pass of random neighbour swaps: same personality, slightly different order. */
function jitter<T>(list: readonly T[], random: PseudoRandom): T[] {
  const out = [...list];
  for (let i = 0; i + 1 < out.length; i++) {
    if (random.chance(JITTER_SWAP_ODDS)) {
      [out[i], out[i + 1]] = [out[i + 1], out[i]];
    }
  }
  return out;
}

export function buildDomesticPlan(
  personality: Personality,
  random: PseudoRandom,
): NationDomesticPlan {
  const def = PERSONALITY_DEFS[personality];
  const priorityLaws = new Set(def.laws.map((c) => c.law));
  return {
    personality,
    techOrder: [
      ...jitter(def.techs, random),
      ...BALANCED_RESEARCH_ORDER.filter((t) => !def.techs.includes(t)),
    ],
    lawOrder: [
      ...jitter(def.laws, random),
      ...FALLBACK_LAW_ORDER.filter((c) => !priorityLaws.has(c.law)),
    ],
    governments: def.governments,
    instituteRatio: def.instituteRatio,
    officeRatio: def.officeRatio,
  };
}

/**
 * The plan for one nation. Seeded from its id with a PRNG of its own, so
 * the nation's shared PRNG stream is untouched and the plan needs no
 * snapshot: it is the same every time it is computed.
 */
export function nationDomesticPlan(playerId: PlayerID): NationDomesticPlan {
  const random = new PseudoRandom(simpleHash(`domestic-plan:${playerId}`));
  return buildDomesticPlan(random.randElement([...PERSONALITIES]), random);
}
```

- [ ] **Step 4: NationDomesticBehavior 교체**

`packages/engine/src/execution/nation/NationDomesticBehavior.ts` 전체를 다음으로 바꾼다(1단계의 징병 상한 규칙은 그대로이고, `BALANCED_RESEARCH_ORDER`는 `NationPersonality.ts`로 옮겼다):

```ts
import { GovernmentId } from "@openfront/engine-api/domestic/DomesticTypes";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import {
  GOVERNMENTS,
  governmentBlock,
  MAX_GOVERNMENT_TIER,
} from "@openfront/engine-lib/domestic/Governments";
import { lawBlock, lawCost } from "@openfront/engine-lib/domestic/Laws";
import { researchBlock } from "@openfront/engine-lib/domestic/Research";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";
import { ChooseGovernmentExecution } from "../../domestic/ChooseGovernmentExecution";
import type { PlayerDomestic } from "../../domestic/PlayerDomestic";
import { ProclaimLawExecution } from "../../domestic/ProclaimLawExecution";
import { ResearchExecution } from "../../domestic/ResearchExecution";
import { SetRecruitTargetExecution } from "../../domestic/SetRecruitTargetExecution";
import { Game, Player } from "../../game/Game";
import { NationDomesticPlan, nationDomesticPlan } from "./NationPersonality";

/**
 * Nations start attacks at 50-60% of max troops (AiAttackBehavior's
 * triggerRatio), so the peacetime target must stay above that or they
 * would never attack. Spec §9.2 says 50%; 70% keeps nations functional.
 */
export const NATION_PEACE_RECRUIT_TARGET_PCT = 70;
export const NATION_WAR_RECRUIT_TARGET_PCT = 100;

/** Spec §9.1: a theocracy without state religion settles for monarchy. */
const THEOCRACY_FALLBACK: GovernmentId = "monarchy";

/**
 * Recruit target, research, government and laws for one nation; called on
 * its action tick. `plan` defaults to the nation's own personality plan.
 */
export function nationDomesticTick(
  mg: Game,
  player: Player,
  plan?: NationDomesticPlan,
): void {
  const d = player.domestic();
  if (d === null) return;
  const p = plan ?? nationDomesticPlan(player.id());
  updateRecruitTarget(mg, player, d);
  maybeResearch(mg, player, d, p);
  // Adopting a government restarts the law cooldown; laws wait a check.
  if (maybeChooseGovernment(mg, player, d, p)) return;
  maybeProclaimLaw(mg, player, d, p);
}

function updateRecruitTarget(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
): void {
  const atWar =
    player.incomingAttacks().length > 0 ||
    player.outgoingAttacks().some((a) => a.target().isPlayer());
  const target = atWar
    ? NATION_WAR_RECRUIT_TARGET_PCT
    : NATION_PEACE_RECRUIT_TARGET_PCT;
  if (d.recruitTargetPct() !== target) {
    mg.addExecution(new SetRecruitTargetExecution(player, target));
  }
}

function maybeResearch(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
  plan: NationDomesticPlan,
): void {
  if (d.currentResearch() !== null) return;
  for (const tech of plan.techOrder) {
    if (researchBlock(d.researchedTechs(), false, tech) !== null) continue;
    // Wait for this tech rather than skipping to a cheaper one.
    if (d.scienceMilliAvailable() >= TECHS[tech].cost * MILLI) {
      mg.addExecution(new ResearchExecution(player, tech, false));
    }
    return;
  }
}

/** True when it adopted a government this check. */
function maybeChooseGovernment(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
  plan: NationDomesticPlan,
): boolean {
  const open = Math.min(d.governmentTier(), MAX_GOVERNMENT_TIER);
  if (open === 0 || GOVERNMENTS[d.currentGovernment()].tier >= open) {
    return false;
  }
  const blockOf = (government: GovernmentId) =>
    governmentBlock(
      d.governmentTier(),
      d.currentGovernment(),
      d.proclaimedLaws(),
      government,
    );
  let pick = plan.governments[open - 1];
  if (blockOf(pick) === "requires") pick = THEOCRACY_FALLBACK;
  if (blockOf(pick) !== null) return false;
  mg.addExecution(new ChooseGovernmentExecution(player, pick));
  return true;
}

function maybeProclaimLaw(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
  plan: NationDomesticPlan,
): void {
  const laws = d.proclaimedLaws();
  for (const { law, option } of plan.lawOrder) {
    const block = lawBlock(
      law,
      laws.get(law),
      d.researchedTechs(),
      d.lawCooldownUntilTick(),
      mg.ticks(),
    );
    if (block === "proclaimed" || block === "requires") continue;
    if (block === "cooldown") return;
    // Nations never pay a shortfall with gold.
    if (
      d.politicalMilliAvailable() >=
      lawCost(laws.size, d.pct("lawCost")) * MILLI
    ) {
      mg.addExecution(new ProclaimLawExecution(player, law, option, false));
    }
    return;
  }
}
```

- [ ] **Step 5: 성향별 건물 비율**

`packages/engine/src/execution/nation/NationStructureBehavior.ts`:
- import 추가: `import { NationDomesticPlan, nationDomesticPlan } from "./NationPersonality";`
- 1단계 상수

```ts
/** Domestic mode: research institutes and admin offices per city (each). */
const DOMESTIC_BUILDING_RATIO_PER_CITY = 0.5;
```

  를 다음으로 바꾼다:

```ts
/** Domestic mode: research institutes and admin offices per city, by personality. */
type DomesticBuildingRatios = Pick<
  NationDomesticPlan,
  "instituteRatio" | "officeRatio"
>;
/** Outside domestic mode both buildings are disabled. */
const NO_DOMESTIC_BUILDINGS: DomesticBuildingRatios = {
  instituteRatio: 0,
  officeRatio: 0,
};
```

- `getStructureRatios`의 시그니처

```ts
function getStructureRatios(
  difficulty: Difficulty,
  gameMode: GameMode,
): Partial<Record<UnitType, StructureRatioConfig>> {
```

  를 다음으로 바꾼다:

```ts
function getStructureRatios(
  difficulty: Difficulty,
  gameMode: GameMode,
  domestic: DomesticBuildingRatios,
): Partial<Record<UnitType, StructureRatioConfig>> {
```

- 같은 함수의 1단계 항목

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

  를 다음으로 바꾼다:

```ts
    [UnitType.ResearchInstitute]: {
      ratioPerCity: domestic.instituteRatio,
      perceivedCostIncreasePerOwned: 1,
    },
    [UnitType.AdminOffice]: {
      ratioPerCity: domestic.officeRatio,
      perceivedCostIncreasePerOwned: 1,
    },
```

- 클래스 안의 `getStructureRatios(difficulty, gameMode)` 호출 두 곳(`levelsDue`와 지각 비용 계산)을 모두 `getStructureRatios(difficulty, gameMode, this.domesticRatios())`로 바꾼다.
- `private shouldBuildStructure(` 메서드 바로 위에 추가:

```ts
  private domesticRatios(): DomesticBuildingRatios {
    return this.game.config().domesticMode()
      ? nationDomesticPlan(this.player.id())
      : NO_DOMESTIC_BUILDINGS;
  }
```

- [ ] **Step 6: 1단계 AI 테스트 갱신**

`tests/domestic/NationDomestic.test.ts`의 첫 테스트는 1단계의 단일 연구 순서를 기대한다. 성향과 무관하게 하려고 계획을 직접 넘긴다.

- import 추가:

```ts
import {
  BALANCED_RESEARCH_ORDER,
  FALLBACK_LAW_ORDER,
  NationDomesticPlan,
} from "@openfront/engine/execution/nation/NationPersonality";
```

- `const NATION = new PlayerInfo(...);` 바로 뒤에 추가:

```ts
/** Phase 1's single research order, independent of the nation's personality. */
const BALANCED_PLAN: NationDomesticPlan = {
  personality: "merchant",
  techOrder: BALANCED_RESEARCH_ORDER,
  lawOrder: FALLBACK_LAW_ORDER,
  governments: ["republic", "democracy"],
  instituteRatio: 0.5,
  officeRatio: 0.5,
};
```

- 테스트 "starts the first affordable tech and sets the peace recruit target" 안의 `nationDomesticTick(game, nation);`를 `nationDomesticTick(game, nation, BALANCED_PLAN);`로 바꾼다(이 테스트 안의 한 줄만).

- [ ] **Step 7: 통과 확인(기존 AI 테스트 포함)**

Run: `npx vitest tests/domestic --run && npx vitest Nation AiAttackBehavior --run && npm run typecheck`
Expected: 모두 PASS(원작 Nation*·AiAttackBehavior 테스트는 모드 꺼짐이라 변화 없음)

- [ ] **Step 8: 커밋**

```bash
npx prettier --write packages/engine/src/execution/nation tests/domestic
git add -A packages/engine/src/execution/nation tests/domestic
git commit -m "feat(domestic): nation personalities pick techs, laws and governments"
```

---

### Task 10: 번역(en, ko)

**Files:**
- Modify: `resources/lang/en.json`, `resources/lang/ko.json`(jq로 병합)
- Modify: `tests/domestic/I18n.test.ts`

**Interfaces:**
- Produces(이후 Task가 쓰는 키): `domestic.tab_laws`, `domestic.tab_government`, `domestic.law_next_cost`(`{cost}`), `domestic.law_cooldown`(`{seconds}`), `domestic.proclaim`, `domestic.proclaim_with_gold`(`{gold}`), `domestic.proclaimed`, `domestic.rejected`, `domestic.gov_current`(`{name}`), `domestic.gov_tier`(`{tier}`), `domestic.gov_progress`(`{value}`, `{next}`, `{tier}`), `domestic.gov_max_tier`, `domestic.gov_adopt`, `domestic.gov_active`, `domestic.gov_locked`, `domestic.gov_needs_tier`(`{tier}`), `domestic.gov_passed`, `domestic.gov_requires_law`(`{law}`), `domestic.law.<LawId>.name`, `domestic.law.<LawId>.<A|B>.name|desc`, `domestic.gov.<GovernmentId>.name|desc`, `events_display.government_tier_reached`(`{tier}`)

- [ ] **Step 1: 실패하는 테스트로 바꾸기**

`tests/domestic/I18n.test.ts`:
- `import { TECH_IDS } from "@openfront/engine-api/domestic/DomesticTypes";`를 다음으로 바꾼다:

```ts
import {
  GOVERNMENT_IDS,
  LAW_IDS,
  LAW_OPTIONS,
  TECH_IDS,
} from "@openfront/engine-api/domestic/DomesticTypes";
```

- `KEYS` 배열의 마지막 항목 `"domestic.locked_requires",` 뒤에 추가:

```ts
  "domestic.tab_laws",
  "domestic.tab_government",
  "domestic.law_next_cost",
  "domestic.law_cooldown",
  "domestic.proclaim",
  "domestic.proclaim_with_gold",
  "domestic.proclaimed",
  "domestic.rejected",
  "domestic.gov_current",
  "domestic.gov_tier",
  "domestic.gov_progress",
  "domestic.gov_max_tier",
  "domestic.gov_adopt",
  "domestic.gov_active",
  "domestic.gov_locked",
  "domestic.gov_needs_tier",
  "domestic.gov_passed",
  "domestic.gov_requires_law",
  "events_display.government_tier_reached",
```

- `for (const id of TECH_IDS) { ... }` 반복문 바로 뒤(같은 테스트 안)에 추가:

```ts
    for (const id of LAW_IDS) {
      expect(typeof get(json, `domestic.law.${id}.name`), id).toBe("string");
      for (const option of LAW_OPTIONS) {
        const key = `domestic.law.${id}.${option}`;
        expect(typeof get(json, `${key}.name`), key).toBe("string");
        expect(typeof get(json, `${key}.desc`), key).toBe("string");
      }
    }
    for (const id of GOVERNMENT_IDS) {
      expect(typeof get(json, `domestic.gov.${id}.name`), id).toBe("string");
      expect(typeof get(json, `domestic.gov.${id}.desc`), id).toBe("string");
    }
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/I18n.test.ts --run`
Expected: FAIL — `domestic.tab_laws: expected 'undefined' to be 'string'`

- [ ] **Step 3: 영어 조각 작성**

```bash
mkdir -p .i18n-domestic
cat > .i18n-domestic/en.json <<'EOF'
{
  "domestic": {
    "gov": {
      "chiefdom": { "desc": "No effects.", "name": "Chieftainship" },
      "communism": { "desc": "Build costs -30%, build times -50%, no research institute or admin office upkeep. Five-Year Plan: research institute and admin office output +50%. Trade income -30%.", "name": "Communism" },
      "democracy": { "desc": "Gold income +30%, science +30%, gold payment cost -50%. Peace Dividend: political power +30% while not attacking. War Weariness: political power -50% while attacking.", "name": "Democracy" },
      "fascism": { "desc": "Troop growth +30%, troop losses when attacking -25%, recruitment cost -50%. War Economy: gold income +30% while attacking. Science -20%, gold income -10% while not attacking.", "name": "Fascism" },
      "monarchy": { "desc": "Max troops +20%, upkeep-free troops 40% → 60%. Feudalism: +0.2 political power/s per city level. Science -15%.", "name": "Monarchy" },
      "republic": { "desc": "Gold income +20%, trade income +25%. Public Works: city build time -50%. Recruitment cost +25%.", "name": "Republic" },
      "theocracy": { "desc": "Political power +30%, troop losses when defending -20%. Tithe: +100 × √(land share %) gold/s. Science -15%. Requires State Religion.", "name": "Theocracy" }
    },
    "gov_active": "Current government",
    "gov_adopt": "Adopt",
    "gov_current": "Government: {name}",
    "gov_locked": "Locked until the next tier",
    "gov_max_tier": "Every government tier reached",
    "gov_needs_tier": "Unlocks at tier {tier}",
    "gov_passed": "Tier passed",
    "gov_progress": "Cumulative political power {value} / {next} for tier {tier}",
    "gov_requires_law": "Requires {law}",
    "gov_tier": "Tier {tier}",
    "law": {
      "construction": {
        "A": { "desc": "All build costs -25%", "name": "Infrastructure Investment" },
        "B": { "desc": "All build times -50%", "name": "Rapid Construction" },
        "name": "Construction"
      },
      "diplomacy": {
        "A": { "desc": "Trade ship and train income with allies +50%", "name": "Allied Preference" },
        "B": { "desc": "No trade with other nations, political power +40%, troop losses when defending -10%", "name": "Isolationism" },
        "name": "Diplomacy"
      },
      "doctrine": {
        "A": { "desc": "Defense post effect +40%, troop losses when defending -15%", "name": "Defense First" },
        "B": { "desc": "Attack speed +30%, troop losses when defending +10%", "name": "Blitzkrieg" },
        "name": "Doctrine"
      },
      "learning": {
        "A": { "desc": "Turns 300 gold into 0.5 science every second (while you have the gold)", "name": "Research Subsidies" },
        "B": { "desc": "Admin office output +40%", "name": "Administrative Reform" },
        "name": "Learning"
      },
      "mobilization": {
        "A": { "desc": "Troop growth +100% while troops are at most half of max", "name": "Total Mobilization" },
        "B": { "desc": "Upkeep-free troops 40% → 60% of max", "name": "Reserves" },
        "name": "Mobilization"
      },
      "nuclear": {
        "A": { "desc": "Missile silo and SAM cost -30%, nuke cost -20%", "name": "Nuclear Deterrence" },
        "B": { "desc": "SAM range +30%", "name": "Air Defense Network" },
        "name": "Nuclear Policy"
      },
      "opinion": {
        "A": { "desc": "Political power +25%", "name": "Ministry of Propaganda" },
        "B": { "desc": "Science +20%", "name": "Academic Freedom" },
        "name": "Public Opinion"
      },
      "religion": {
        "A": { "desc": "Allows Theocracy, political power +15%, troop growth +15%, science -10%", "name": "State Religion" },
        "B": { "desc": "Science +15%, trade income with other nations +20%, expansion into unclaimed land +20% faster", "name": "Religious Tolerance" },
        "name": "Religion"
      },
      "service": {
        "A": { "desc": "Max troops +25%, gold income -10%", "name": "Levée en Masse" },
        "B": { "desc": "Troop upkeep -50%, troop losses when attacking -15%", "name": "Professional Army" },
        "name": "Military Service"
      },
      "taxation": {
        "A": { "desc": "Gold income +30%, troop growth -15%", "name": "Heavy Taxation" },
        "B": { "desc": "City tax +40%, city build time -50%", "name": "Urban Planning" },
        "name": "Taxation"
      },
      "trade": {
        "A": { "desc": "Trade ship and train income +40%", "name": "Free Trade" },
        "B": { "desc": "City tax +60%, trade income with other nations -30%", "name": "Protectionism" },
        "name": "Trade"
      }
    },
    "law_cooldown": "Next proclamation in {seconds}s",
    "law_next_cost": "Next law: {cost} political power",
    "proclaim": "Proclaim",
    "proclaim_with_gold": "Proclaim for {gold} gold",
    "proclaimed": "Proclaimed",
    "rejected": "Closed",
    "tab_government": "Government",
    "tab_laws": "Book of Laws"
  },
  "events_display": {
    "government_tier_reached": "Government tier {tier} reached: choose a new government in the Domestic panel"
  }
}
EOF
```

- [ ] **Step 4: 한국어 조각 작성**

```bash
cat > .i18n-domestic/ko.json <<'EOF'
{
  "domestic": {
    "gov": {
      "chiefdom": { "desc": "효과 없음", "name": "족장제" },
      "communism": { "desc": "모든 건설비 -30%, 모든 건설 시간 -50%, 연구소·행정청 운영비 없음. 5개년 계획: 연구소·행정청 생산 +50%. 무역 수익 -30%", "name": "공산주의" },
      "democracy": { "desc": "금 수입 +30%, 과학력 +30%, 부족분 금 결제 비용 -50%. 평화 배당: 공격하지 않는 동안 정치력 +30%. 전쟁 피로: 공격하는 동안 정치력 -50%", "name": "민주주의" },
      "fascism": { "desc": "병력 회복 +30%, 공격할 때 병력 손실 -25%, 징병비 -50%. 전시 경제: 공격하는 동안 금 수입 +30%. 과학력 -20%, 공격하지 않는 동안 금 수입 -10%", "name": "파시즘" },
      "monarchy": { "desc": "최대 병력 +20%, 유지비 무료 구간 40%→60%. 봉건제: 도시 레벨마다 정치력 0.2/초. 과학력 -15%", "name": "군주제" },
      "republic": { "desc": "금 수입 +20%, 무역 수익 +25%. 공공사업: 도시 건설 시간 -50%. 징병비 +25%", "name": "공화정" },
      "theocracy": { "desc": "정치력 +30%, 방어할 때 병력 손실 -20%. 십일조: 초당 금 100 × √(땅 비율 %). 과학력 -15%. 국교 지정 필요", "name": "신정" }
    },
    "gov_active": "현재 정부",
    "gov_adopt": "수립",
    "gov_current": "정부: {name}",
    "gov_locked": "다음 단계까지 바꿀 수 없음",
    "gov_max_tier": "모든 정부 단계 도달",
    "gov_needs_tier": "{tier}단계에 열림",
    "gov_passed": "지나간 단계",
    "gov_progress": "누적 정치력 {value} / {next} ({tier}단계)",
    "gov_requires_law": "{law} 필요",
    "gov_tier": "{tier}단계",
    "law": {
      "construction": {
        "A": { "desc": "모든 건설비 -25%", "name": "인프라 투자" },
        "B": { "desc": "모든 건설 시간 -50%", "name": "공기 단축" },
        "name": "건설"
      },
      "diplomacy": {
        "A": { "desc": "동맹과의 무역·기차 수익 +50%", "name": "동맹 우대" },
        "B": { "desc": "다른 나라와 무역 불가, 정치력 +40%, 방어할 때 병력 손실 -10%", "name": "고립주의" },
        "name": "외교"
      },
      "doctrine": {
        "A": { "desc": "방어 기지 효과 +40%, 방어할 때 병력 손실 -15%", "name": "방어 우선" },
        "B": { "desc": "공격 속도 +30%, 방어할 때 병력 손실 +10%", "name": "전격전" },
        "name": "교리"
      },
      "learning": {
        "A": { "desc": "매초 금 300을 과학력 0.5로 전환 (금이 있을 때만)", "name": "연구 보조금" },
        "B": { "desc": "행정청 생산 +40%", "name": "행정 개혁" },
        "name": "학문"
      },
      "mobilization": {
        "A": { "desc": "병력이 최대치의 절반 이하면 병력 회복 +100%", "name": "총동원령" },
        "B": { "desc": "유지비 무료 구간 40%→60%", "name": "예비군" },
        "name": "동원"
      },
      "nuclear": {
        "A": { "desc": "미사일 기지·SAM 건설비 -30%, 핵 비용 -20%", "name": "핵 억지력" },
        "B": { "desc": "SAM 사거리 +30%", "name": "방공망" },
        "name": "핵"
      },
      "opinion": {
        "A": { "desc": "정치력 +25%", "name": "선전부" },
        "B": { "desc": "과학력 +20%", "name": "학문의 자유" },
        "name": "여론"
      },
      "religion": {
        "A": { "desc": "신정 수립 가능, 정치력 +15%, 병력 회복 +15%, 과학력 -10%", "name": "국교 지정" },
        "B": { "desc": "과학력 +15%, 다른 나라와의 무역 수익 +20%, 빈 땅 확장 속도 +20%", "name": "종교 관용" },
        "name": "종교"
      },
      "service": {
        "A": { "desc": "최대 병력 +25%, 금 수입 -10%", "name": "국민개병" },
        "B": { "desc": "병력 유지비 -50%, 공격할 때 병력 손실 -15%", "name": "직업 군대" },
        "name": "병역"
      },
      "taxation": {
        "A": { "desc": "금 수입 +30%, 병력 회복 -15%", "name": "중과세" },
        "B": { "desc": "도시 세수 +40%, 도시 건설 시간 -50%", "name": "도시 계획" },
        "name": "조세"
      },
      "trade": {
        "A": { "desc": "무역선·기차 수익 +40%", "name": "자유무역" },
        "B": { "desc": "도시 세수 +60%, 다른 나라와의 무역 수익 -30%", "name": "보호무역" },
        "name": "무역"
      }
    },
    "law_cooldown": "{seconds}초 후 선포 가능",
    "law_next_cost": "다음 법: 정치력 {cost}",
    "proclaim": "선포",
    "proclaim_with_gold": "금 {gold}으로 선포",
    "proclaimed": "선포함",
    "rejected": "선택 불가",
    "tab_government": "정부",
    "tab_laws": "법률서"
  },
  "events_display": {
    "government_tier_reached": "정부 {tier}단계 도달: 국정 패널에서 새 정부를 고를 수 있습니다"
  }
}
EOF
```

- [ ] **Step 5: 병합**

1단계와 같은 방법이다. en.json은 `jq -S`로 정렬하며 병합하고, ko.json은 순서를 건드리지 않고 병합한다.

```bash
jq -S --slurpfile frag .i18n-domestic/en.json '. * $frag[0]' resources/lang/en.json > .i18n-domestic/en.out && mv .i18n-domestic/en.out resources/lang/en.json
jq --slurpfile frag .i18n-domestic/ko.json '. * $frag[0]' resources/lang/ko.json > .i18n-domestic/ko.out && mv .i18n-domestic/ko.out resources/lang/ko.json
rm -rf .i18n-domestic
npx prettier --write resources/lang/en.json resources/lang/ko.json
git diff --stat resources/lang
```

Expected: en.json, ko.json에 추가만 있고 기존 줄 삭제는 없다.

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/domestic/I18n.test.ts tests/EnJsonSorted.test.ts tests/TranslationSystem.test.ts --run`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add resources/lang/en.json resources/lang/ko.json tests/domestic/I18n.test.ts
git commit -m "feat(domestic): English and Korean strings for laws and governments"
```

---

### Task 11: 법률서 탭과 정부 탭

**Files:**
- Create: `src/client/hud/domestic/LawsTab.ts`
- Create: `src/client/hud/domestic/GovernmentTab.ts`
- Test: `tests/client/DomesticPolicyTabs.test.ts`

**Interfaces:**
- Consumes: Task 2의 `DomesticClientView`(`data`, `pct`, `laws()`, `researchedTechs()`), Task 1의 `LAWS`, `lawBlock`, `lawCost`, `GOVERNMENTS`, `GOVERNMENTS_BY_TIER`, `governmentBlock`, 1단계 `shortfallGold`, Task 10의 번역 키
- Produces:
  - `interface LawsTabContext { view: DomesticClientView; gold: bigint; nowTick: number; proclaim(law: LawId, option: LawOption, payWithGold: boolean): void }`, `renderLawsTab(ctx: LawsTabContext): TemplateResult`
  - `interface GovernmentTabContext { view: DomesticClientView; choose(government: GovernmentId): void }`, `renderGovernmentTab(ctx: GovernmentTabContext): TemplateResult`
  - DOM 표시: 법 항목 `[data-law]`, 선택지 `[data-option]`, 정부 카드 `[data-government]`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/DomesticPolicyTabs.test.ts`:

```ts
import { vi } from "vitest";

vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { render } from "lit";
import { renderGovernmentTab } from "../../src/client/hud/domestic/GovernmentTab";
import { renderLawsTab } from "../../src/client/hud/domestic/LawsTab";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";

const BASE: DomesticData = {
  science: 0,
  political: 0,
  cumulativeScience: 0,
  cumulativePolitical: 0,
  sciencePerSec: 0,
  politicalPerSec: 0,
  techs: [],
  research: null,
  recruitTargetPct: 100,
  laws: {},
  lawCooldownUntilTick: 0,
  governmentTier: 0,
  government: "chiefdom",
  conditions: [],
};

function mount(template: unknown): HTMLElement {
  const root = document.createElement("div");
  render(template, root);
  return root;
}

function optionCard(root: HTMLElement, law: string, option: string) {
  return root.querySelector(
    `[data-law="${law}"] [data-option="${option}"]`,
  ) as HTMLElement;
}

function optionButton(root: HTMLElement, law: string, option: string) {
  return optionCard(root, law, option).querySelector(
    "button",
  ) as HTMLButtonElement;
}

function govCard(root: HTMLElement, government: string) {
  return root.querySelector(
    `[data-government="${government}"]`,
  ) as HTMLElement;
}

describe("laws tab", () => {
  test("shows the next cost and the proclaimed and closed options", () => {
    const view = new DomesticClientView({
      ...BASE,
      political: 200,
      laws: { trade: "A" },
    });
    const root = mount(
      renderLawsTab({ view, gold: 0n, nowTick: 0, proclaim: vi.fn() }),
    );
    expect(root.textContent).toContain('domestic.law_next_cost:{"cost":150}');
    expect(optionCard(root, "trade", "A").textContent).toContain(
      "domestic.proclaimed",
    );
    expect(optionCard(root, "trade", "B").textContent).toContain(
      "domestic.rejected",
    );
    expect(optionCard(root, "trade", "A").querySelector("button")).toBeNull();
  });

  test("clicking an open option proclaims it", () => {
    const proclaim = vi.fn();
    const view = new DomesticClientView({ ...BASE, political: 200 });
    const root = mount(renderLawsTab({ view, gold: 0n, nowTick: 0, proclaim }));
    optionButton(root, "taxation", "B").click();
    expect(proclaim).toHaveBeenCalledWith("taxation", "B", false);
  });

  test("without enough political power the button pays the rest in gold", () => {
    const view = new DomesticClientView({ ...BASE, political: 40 });
    const poor = mount(
      renderLawsTab({ view, gold: 0n, nowTick: 0, proclaim: vi.fn() }),
    );
    expect(optionButton(poor, "trade", "A").textContent).toContain(
      "domestic.proclaim_with_gold",
    );
    expect(optionButton(poor, "trade", "A").disabled).toBe(true);

    const proclaim = vi.fn();
    const rich = mount(
      renderLawsTab({ view, gold: 60_000n, nowTick: 0, proclaim }),
    );
    expect(optionButton(rich, "trade", "A").disabled).toBe(false);
    optionButton(rich, "trade", "A").click();
    expect(proclaim).toHaveBeenCalledWith("trade", "A", true);
  });

  test("the cooldown and a missing tech disable the buttons", () => {
    const cooling = mount(
      renderLawsTab({
        view: new DomesticClientView({
          ...BASE,
          political: 1000,
          lawCooldownUntilTick: 500,
        }),
        gold: 0n,
        nowTick: 100,
        proclaim: vi.fn(),
      }),
    );
    expect(cooling.textContent).toContain(
      'domestic.law_cooldown:{"seconds":40}',
    );
    expect(optionButton(cooling, "trade", "A").disabled).toBe(true);

    const ready = mount(
      renderLawsTab({
        view: new DomesticClientView({ ...BASE, political: 1000 }),
        gold: 0n,
        nowTick: 0,
        proclaim: vi.fn(),
      }),
    );
    expect(optionButton(ready, "trade", "A").disabled).toBe(false);
    expect(optionButton(ready, "nuclear", "A").disabled).toBe(true);
    expect(
      ready.querySelector('[data-law="nuclear"]')!.textContent,
    ).toContain("domestic.locked_requires");
  });
});

describe("government tab", () => {
  test("tier 1: open governments, theocracy's requirement, tier 2 locked", () => {
    const choose = vi.fn();
    const view = new DomesticClientView({
      ...BASE,
      governmentTier: 1,
      cumulativePolitical: 400,
    });
    const root = mount(renderGovernmentTab({ view, choose }));
    expect(root.textContent).toContain(
      'domestic.gov_progress:{"value":400,"next":1500,"tier":2}',
    );
    expect(govCard(root, "monarchy").querySelector("button")).not.toBeNull();
    (govCard(root, "republic").querySelector("button") as HTMLElement).click();
    expect(choose).toHaveBeenCalledWith("republic");
    expect(govCard(root, "theocracy").querySelector("button")).toBeNull();
    expect(govCard(root, "theocracy").textContent).toContain(
      "domestic.gov_requires_law",
    );
    expect(govCard(root, "democracy").textContent).toContain(
      'domestic.gov_needs_tier:{"tier":2}',
    );
  });

  test("tier 2 under a monarchy: current, passed and open governments", () => {
    const view = new DomesticClientView({
      ...BASE,
      governmentTier: 2,
      government: "monarchy",
    });
    const root = mount(renderGovernmentTab({ view, choose: vi.fn() }));
    expect(govCard(root, "monarchy").textContent).toContain(
      "domestic.gov_active",
    );
    expect(govCard(root, "republic").textContent).toContain(
      "domestic.gov_passed",
    );
    expect(govCard(root, "fascism").querySelector("button")).not.toBeNull();
  });

  test("a chosen tier-2 government locks the others; tier 3 ends the bar", () => {
    const view = new DomesticClientView({
      ...BASE,
      governmentTier: 3,
      government: "democracy",
    });
    const root = mount(renderGovernmentTab({ view, choose: vi.fn() }));
    expect(govCard(root, "fascism").textContent).toContain(
      "domestic.gov_locked",
    );
    expect(root.textContent).toContain("domestic.gov_max_tier");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/DomesticPolicyTabs.test.ts --run`
Expected: FAIL — `Cannot find module '../../src/client/hud/domestic/GovernmentTab'`

- [ ] **Step 3: 법률서 탭 작성**

`src/client/hud/domestic/LawsTab.ts`:

```ts
import {
  LAW_IDS,
  LAW_OPTIONS,
  LawId,
  LawOption,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import {
  LawBlock,
  LAWS,
  lawBlock,
  lawCost,
} from "@openfront/engine-lib/domestic/Laws";
import { shortfallGold } from "@openfront/engine-lib/domestic/Research";
import { renderNumber } from "@openfront/engine-lib/Format";
import { html, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { DomesticClientView } from "../../view/DomesticClientView";

export interface LawsTabContext {
  view: DomesticClientView;
  gold: bigint;
  nowTick: number;
  proclaim(law: LawId, option: LawOption, payWithGold: boolean): void;
}

/** The Book of Laws (spec §10.7): eleven laws, two options each. */
export function renderLawsTab(ctx: LawsTabContext): TemplateResult {
  const d = ctx.view.data;
  const cost = lawCost(ctx.view.laws().size, ctx.view.pct("lawCost"));
  const cooldownTicks = Math.max(0, d.lawCooldownUntilTick - ctx.nowTick);
  return html`
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap gap-4 text-sm">
        <span>${translateText("domestic.law_next_cost", { cost })}</span>
        ${cooldownTicks > 0
          ? html`<span class="text-amber-400"
              >${translateText("domestic.law_cooldown", {
                seconds: Math.ceil(cooldownTicks / 10),
              })}</span
            >`
          : null}
      </div>
      ${LAW_IDS.map((law) => renderLaw(ctx, law, cost))}
    </div>
  `;
}

function renderLaw(
  ctx: LawsTabContext,
  law: LawId,
  cost: number,
): TemplateResult {
  const d = ctx.view.data;
  const chosen = ctx.view.laws().get(law);
  const block = lawBlock(
    law,
    chosen,
    ctx.view.researchedTechs(),
    d.lawCooldownUntilTick,
    ctx.nowTick,
  );
  const requires = LAWS[law].requires;
  return html`
    <div class="border border-gray-600 rounded-sm p-2" data-law=${law}>
      <div class="font-bold text-sm">
        ${translateText(`domestic.law.${law}.name`)}
        ${block === "requires" && requires !== null
          ? html`<span class="font-normal text-gray-400">
              ·
              ${translateText("domestic.locked_requires", {
                tech: translateText(`domestic.tech.${requires}.name`),
              })}</span
            >`
          : null}
      </div>
      <div class="grid grid-cols-2 gap-2 mt-1">
        ${LAW_OPTIONS.map((option) =>
          renderOption(ctx, law, option, chosen, block, cost),
        )}
      </div>
    </div>
  `;
}

function renderOption(
  ctx: LawsTabContext,
  law: LawId,
  option: LawOption,
  chosen: LawOption | undefined,
  block: LawBlock | null,
  cost: number,
): TemplateResult {
  const key = `domestic.law.${law}.${option}`;
  let status: TemplateResult | string;
  let border = "border-gray-600";
  if (chosen === option) {
    status = translateText("domestic.proclaimed");
    border = "border-green-500";
  } else if (chosen !== undefined) {
    status = translateText("domestic.rejected");
    border = "border-gray-700 opacity-40";
  } else {
    status = proclaimButton(ctx, law, option, block, cost);
  }
  return html`
    <div
      class="border ${border} rounded-sm p-2 text-xs flex flex-col gap-1"
      data-option=${option}
    >
      <div class="font-bold">${translateText(`${key}.name`)}</div>
      <div class="text-gray-300">${translateText(`${key}.desc`)}</div>
      <div>${status}</div>
    </div>
  `;
}

function proclaimButton(
  ctx: LawsTabContext,
  law: LawId,
  option: LawOption,
  block: LawBlock | null,
  cost: number,
): TemplateResult {
  const available = ctx.view.data.political;
  if (available >= cost) {
    return html`<button
      class="px-2 py-0.5 rounded-sm bg-sky-700 hover:bg-sky-600 disabled:opacity-40"
      ?disabled=${block !== null}
      @click=${() => ctx.proclaim(law, option, false)}
    >
      ${translateText("domestic.proclaim")}
    </button>`;
  }
  const gold = shortfallGold(
    (cost - available) * MILLI,
    ctx.view.pct("goldPaymentCost"),
  );
  return html`<button
    class="px-2 py-0.5 rounded-sm bg-amber-700 hover:bg-amber-600 disabled:opacity-40"
    ?disabled=${block !== null || ctx.gold < gold}
    @click=${() => ctx.proclaim(law, option, true)}
  >
    ${translateText("domestic.proclaim_with_gold", {
      gold: renderNumber(gold),
    })}
  </button>`;
}
```

- [ ] **Step 4: 정부 탭 작성**

`src/client/hud/domestic/GovernmentTab.ts`:

```ts
import {
  DomesticData,
  GovernmentId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { GOVERNMENT_TIER_THRESHOLDS } from "@openfront/engine-lib/domestic/Balance";
import {
  GovernmentBlock,
  GovernmentDef,
  GOVERNMENTS,
  GOVERNMENTS_BY_TIER,
  governmentBlock,
} from "@openfront/engine-lib/domestic/Governments";
import { html, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { DomesticClientView } from "../../view/DomesticClientView";

export interface GovernmentTabContext {
  view: DomesticClientView;
  choose(government: GovernmentId): void;
}

const CHOOSABLE_TIERS = [1, 2] as const;

/** The government tab (spec §10.7): current government, tier progress, choices. */
export function renderGovernmentTab(ctx: GovernmentTabContext): TemplateResult {
  const d = ctx.view.data;
  return html`
    <div class="flex flex-col gap-3">
      <div class="text-sm">
        ${translateText("domestic.gov_current", {
          name: translateText(`domestic.gov.${d.government}.name`),
        })}
        · ${translateText("domestic.gov_tier", { tier: d.governmentTier })}
      </div>
      ${renderTierProgress(d)}
      ${CHOOSABLE_TIERS.map(
        (tier) => html`
          <div class="font-bold">
            ${translateText("domestic.gov_tier", { tier })}
          </div>
          <div class="grid grid-cols-3 gap-2">
            ${GOVERNMENTS_BY_TIER[tier].map((g) => renderGovernment(ctx, g))}
          </div>
        `,
      )}
    </div>
  `;
}

function renderTierProgress(d: DomesticData): TemplateResult {
  if (d.governmentTier >= GOVERNMENT_TIER_THRESHOLDS.length) {
    return html`<div class="text-sm text-green-400">
      ${translateText("domestic.gov_max_tier")}
    </div>`;
  }
  const next = GOVERNMENT_TIER_THRESHOLDS[d.governmentTier];
  const done = Math.min(1, d.cumulativePolitical / next);
  return html`
    <div>
      <div class="text-xs text-gray-300">
        ${translateText("domestic.gov_progress", {
          value: d.cumulativePolitical,
          next,
          tier: d.governmentTier + 1,
        })}
      </div>
      <div class="h-2 bg-gray-700 rounded-sm">
        <div
          class="h-2 bg-violet-500 rounded-sm"
          style="width: ${Math.round(done * 100)}%"
        ></div>
      </div>
    </div>
  `;
}

function renderGovernment(
  ctx: GovernmentTabContext,
  government: GovernmentId,
): TemplateResult {
  const d = ctx.view.data;
  const def = GOVERNMENTS[government];
  let status: TemplateResult | string;
  let border = "border-gray-600";
  if (d.government === government) {
    status = translateText("domestic.gov_active");
    border = "border-green-500";
  } else {
    const block = governmentBlock(
      d.governmentTier,
      d.government,
      ctx.view.laws(),
      government,
    );
    status =
      block === null
        ? html`<button
            class="px-2 py-0.5 rounded-sm bg-violet-700 hover:bg-violet-600"
            @click=${() => ctx.choose(government)}
          >
            ${translateText("domestic.gov_adopt")}
          </button>`
        : blockText(block, def);
  }
  return html`
    <div
      class="border ${border} rounded-sm p-2 text-xs flex flex-col gap-1"
      data-government=${government}
    >
      <div class="font-bold text-sm">
        ${translateText(`domestic.gov.${government}.name`)}
      </div>
      <div class="text-gray-300">
        ${translateText(`domestic.gov.${government}.desc`)}
      </div>
      <div class="text-gray-400">${status}</div>
    </div>
  `;
}

function blockText(block: GovernmentBlock, def: GovernmentDef): string {
  switch (block) {
    case "tierNotReached":
      return translateText("domestic.gov_needs_tier", { tier: def.tier });
    case "tierPassed":
      return translateText("domestic.gov_passed");
    case "chosen":
      return translateText("domestic.gov_locked");
    case "requires": {
      const req = def.requiresLaw;
      return translateText("domestic.gov_requires_law", {
        law:
          req === null
            ? ""
            : translateText(`domestic.law.${req.law}.${req.option}.name`),
      });
    }
  }
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest tests/client/DomesticPolicyTabs.test.ts --run && npm run typecheck && npx eslint src/client/hud/domestic`
Expected: PASS (7 tests), 오류 없음

- [ ] **Step 6: 커밋**

```bash
npx prettier --write src/client/hud/domestic tests/client/DomesticPolicyTabs.test.ts
git add src/client/hud/domestic tests/client/DomesticPolicyTabs.test.ts
git commit -m "feat(domestic): book of laws and government tabs"
```

---

### Task 12: 국정 패널에 탭 연결과 명령 이벤트

**Files:**
- Modify: `src/client/Transport.ts`
- Modify: `src/client/hud/domestic/DomesticPanel.ts`

**Interfaces:**
- Consumes: Task 11의 `renderLawsTab`, `renderGovernmentTab`; 1단계 `DomesticPanel`, `ResearchTechIntentEvent`; `PlayerView.domestic()`
- Produces:
  - `class ProclaimLawIntentEvent { constructor(law: LawId, option: LawOption, payWithGold: boolean) }`
  - `class ChooseGovernmentIntentEvent { constructor(government: GovernmentId) }`
  - 국정 패널의 탭: 기술(`tech`), 법률서(`laws`), 정부(`government`)

- [ ] **Step 1: 명령 이벤트**

`src/client/Transport.ts`:
- 1단계 import `import { TechId } from "@openfront/engine-api/domestic/DomesticTypes";`를 다음으로 바꾼다:

```ts
import {
  GovernmentId,
  LawId,
  LawOption,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
```

- 1단계 클래스

```ts
export class SetRecruitTargetIntentEvent implements GameEvent {
  constructor(public readonly percent: number) {}
}
```

  뒤에 추가:

```ts

export class ProclaimLawIntentEvent implements GameEvent {
  constructor(
    public readonly law: LawId,
    public readonly option: LawOption,
    public readonly payWithGold: boolean,
  ) {}
}

export class ChooseGovernmentIntentEvent implements GameEvent {
  constructor(public readonly government: GovernmentId) {}
}
```

- 구독 블록의 1단계 코드

```ts
    this.subscribe(SetRecruitTargetIntentEvent, (e) =>
      this.onSetRecruitTargetIntent(e),
    );
```

  뒤에 추가:

```ts
    this.subscribe(ProclaimLawIntentEvent, (e) =>
      this.onProclaimLawIntent(e),
    );
    this.subscribe(ChooseGovernmentIntentEvent, (e) =>
      this.onChooseGovernmentIntent(e),
    );
```

- 1단계 메서드 `onSetRecruitTargetIntent` 뒤에 추가:

```ts
  private onProclaimLawIntent(event: ProclaimLawIntentEvent) {
    this.sendIntent({
      type: "proclaim_law",
      law: event.law,
      option: event.option,
      payWithGold: event.payWithGold,
    });
  }

  private onChooseGovernmentIntent(event: ChooseGovernmentIntentEvent) {
    this.sendIntent({
      type: "choose_government",
      government: event.government,
    });
  }
```

- [ ] **Step 2: 패널 import와 탭 상태**

`src/client/hud/domestic/DomesticPanel.ts`:
- 1단계 import `import { ResearchTechIntentEvent } from "../../Transport";`를 다음으로 바꾼다:

```ts
import {
  ChooseGovernmentIntentEvent,
  ProclaimLawIntentEvent,
  ResearchTechIntentEvent,
} from "../../Transport";
```

- import 추가:

```ts
import type { DomesticClientView } from "../../view/DomesticClientView";
import { renderGovernmentTab } from "./GovernmentTab";
import { renderLawsTab } from "./LawsTab";
```

- `const BRANCHES: readonly Branch[] = ["economy", "military", "learning"];` 뒤에 추가:

```ts

type DomesticTab = "tech" | "laws" | "government";
const TABS: readonly DomesticTab[] = ["tech", "laws", "government"];
```

- 클래스 주석 `/** The domestic panel. Phase 1 has the technology tab only. */`를 `/** The domestic panel: technology, book of laws and government tabs. */`로 바꾸고, 필드 `@state() private data: DomesticData | null = null;` 뒤에 추가:

```ts
  @state() private tab: DomesticTab = "tech";
```

- [ ] **Step 3: render를 탭 구조로 바꾸기**

같은 파일의 `render()` 메서드 전체를 다음 세 메서드로 바꾼다(기술 격자는 1단계 코드 그대로 `renderTechTab`으로 옮겼다):

```ts
  render() {
    const me = this.game?.myPlayer();
    const view = me?.domestic() ?? null;
    if (!this.open || this.data === null || !me || view === null) return null;
    const d = this.data;
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
          <div class="flex items-center justify-between gap-4 mb-3">
            <h2 class="text-lg font-bold">
              ${translateText("domestic.panel_title")}
            </h2>
            <div class="flex gap-1">
              ${TABS.map(
                (tab) =>
                  html`<button
                    class="px-3 py-1 rounded-sm ${this.tab === tab
                      ? "bg-sky-700"
                      : "bg-slate-700 hover:bg-slate-600"}"
                    @click=${() => (this.tab = tab)}
                  >
                    ${translateText(`domestic.tab_${tab}`)}
                  </button>`,
              )}
            </div>
            <button class="px-2" @click=${() => (this.open = false)}>✕</button>
          </div>
          ${this.renderTab(d, view, me)}
        </div>
      </div>
    `;
  }

  private renderTab(
    d: DomesticData,
    view: DomesticClientView,
    me: PlayerView,
  ): TemplateResult {
    switch (this.tab) {
      case "tech":
        return this.renderTechTab(d, me);
      case "laws":
        return renderLawsTab({
          view,
          gold: me.gold(),
          nowTick: this.game.ticks(),
          proclaim: (law, option, payWithGold) =>
            this.eventBus.emit(
              new ProclaimLawIntentEvent(law, option, payWithGold),
            ),
        });
      case "government":
        return renderGovernmentTab({
          view,
          choose: (government) =>
            this.eventBus.emit(new ChooseGovernmentIntentEvent(government)),
        });
    }
  }

  private renderTechTab(d: DomesticData, me: PlayerView): TemplateResult {
    const researched = new Set<TechId>(d.techs);
    return html`
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
    `;
  }
```

- [ ] **Step 4: 확인**

Run: `npm run typecheck && npx eslint src/client/hud/domestic src/client/Transport.ts && npx vitest tests/client --run`
Expected: 오류 없음, 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
npx prettier --write src/client/Transport.ts src/client/hud/domestic
git add src/client/Transport.ts src/client/hud/domestic
git commit -m "feat(domestic): laws and government tabs in the domestic panel"
```

---

### Task 13: 전체 검증과 실제 실행 확인

**Files:** 없음(문제가 나오면 해당 Task 파일 수정)

- [ ] **Step 1: 전체 테스트, 타입, 린트**

Run: `npm test 2>&1 | tail -15 && npm run typecheck && npm run lint`
Expected: 모든 테스트 PASS, typecheck·lint 오류 없음. 원작 테스트(특히 `tests/AttackLogicGolden.test.ts`, `tests/TradeTrainGolden.test.ts`, `tests/core/snapshot`)가 하나라도 깨지면 내정 모드가 꺼진 경로가 원작과 달라진 것이다. 해당 Task로 돌아가 고친다.

- [ ] **Step 2: 실제 게임 실행 확인**

`run-openfront` 스킬로 개발 서버를 띄우고 싱글플레이를 내정 모드로 시작한다(AI 국가 포함). 다음을 확인한다:
1. 국정 패널에 "기술 / 법률서 / 정부" 탭이 있고 탭 전환이 된다.
2. 정치력이 100이 되면 법률서에서 아무 법이나 선포할 수 있고, 다른 선택지는 회색 "선택 불가"가 되며, "N초 후 선포 가능" 대기가 45초부터 줄어든다. 다음 법 비용이 150으로 오른다.
3. 누적 정치력 300에서 이벤트 창에 "정부 1단계 도달" 메시지가 뜨고, 정부 탭에서 군주제·공화정을 고를 수 있다. 신정은 "국교 지정 필요"로 막혀 있다. 고른 뒤 같은 단계의 다른 정부는 "다음 단계까지 바꿀 수 없음"이다.
4. "공기 단축"을 선포한 뒤 도시를 지으면 진행 막대가 원래의 절반 시간에 끝난다.
5. "고립주의"를 선포하면 내 항구로 오는 무역선이 더 생기지 않는다.
6. 몇 분 뒤 실행 중인 게임 상태에서 AI 국가의 `domestic().proclaimedLaws()`와 `currentGovernment()`를 읽어, AI가 법을 선포하고 정부를 골랐는지 확인한다.
7. 내정 모드를 끈 판에서는 패널과 HUD가 보이지 않는다.

결과(스크린샷 포함)를 기록한다. 문제가 있으면 해당 Task로 돌아가 고친 뒤 이 Task를 다시 한다.

- [ ] **Step 3: 마무리 커밋(수정이 있었다면)**

```bash
git status --short
git add -A
git commit -m "fix(domestic): issues found in phase 2 verification"
```

수정이 없었다면 이 단계는 건너뛴다.
