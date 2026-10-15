# 내정 모드 3단계 (승리) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 내정 모드의 승리 4종을 완성한다. 범위는 승리 프로젝트 2종(우주 계획, 세계 정부 선포), 설정 가능한 정복 %, 30분 타이머와 점수 판정, 승리 사유 표시, 실시간 점수 순위표, 지도 강조와 진행 막대, 국정 패널 승리 탭, AI의 프로젝트 시도와 견제, 밸런스 시뮬레이션 스크립트다.

**Architecture:** 승리 규칙(프로젝트 정의, 착수 조건, 점수 공식, 타이머·정복 % 해석)은 `packages/engine-lib/src/domestic/`의 순수 함수로 두고 엔진과 화면이 같이 쓴다. 엔진은 `PlayerDomestic`에 진행 중 프로젝트를 저장하고, `DomesticExecution`이 매초 진행·실패를 처리하며, `WinCheckExecution`은 내정 모드일 때 `checkDomesticWin`으로 승자를 정해 `setWinner(..., reason)`을 부른다. 화면은 `PlayerUpdate.domestic.project`와 공용 점수 함수로 순위표, 지도, 승리 탭을 그린다. 원작 경로(내정 모드 꺼짐)는 한 줄도 바뀌지 않게 모든 연결 코드를 내정 모드 검사 뒤에 둔다.

**Tech Stack:** TypeScript 6, Vitest 4, zod + zbin, Lit + Tailwind 4, WebGL2, jq, tsx

**Spec:** `docs/superpowers/specs/2026-10-15-domestic-system-design.md` (이 계획은 §8 전체, §9.3~§9.4, §10의 승리 관련 부분(§10.2 정복 %·타이머, §10.4 `start_victory_project`, §10.5 승리, §10.7 승리 탭·알림·지도·순위표·승리 화면), §11.1의 승리 수치, §12.1의 승리·AI 항목, §12.3, §13의 3단계를 구현한다. §14 포크 정비는 범위 밖이다.)

**선행 계획:** `docs/superpowers/plans/2026-10-15-domestic-phase1.md`(1단계, 이 계획이 쓰는 인터페이스의 기준)와 `docs/superpowers/plans/2026-10-15-domestic-phase2.md`(2단계, 법·정부·성향). 2단계에서 쓰는 이름과 2단계가 먼저 손댄 공유 파일은 아래 "2단계 의존 항목"에 모았다. 이 계획의 수정 지점은 2단계 계획의 코드가 이미 들어간 상태를 기준으로 쓰였다.

---

## 시작 전에 (환경)

- 1단계와 2단계가 모두 `domestic-system` 브랜치에 커밋된 상태에서 시작한다.
- 프로젝트는 Node 24를 요구한다(`package.json` engines). 이 PC의 Node 26에서도 테스트와 타입 검사가 통과한다. 의존성이 없으면 `npm ci --ignore-scripts --engine-strict=false`로 설치한다.
- 단일 테스트 실행: `npx vitest tests/domestic/<File>.test.ts --run`
- 커밋 전에 바꾼 파일에 `npx prettier --write <files>`를 실행한다.
- **2단계 확인:** 시작하기 전에 다음을 실행해서 아래 "2단계 의존 항목"의 이름이 모두 있는지 확인한다. 2단계 구현이 계획과 달라진 이름(리뷰 수정 등)이 있으면 `git log -p -- <파일>`로 확인하고 이 계획에서 그 이름만 바꿔 쓴다. 동작(표의 설명)은 그대로 둔다.

```bash
grep -n "governmentTier()\|refreshGovernmentTier\|spendPoliticalMilli\|proclaimedLaws()\|activeConditions()\|private government:" packages/engine/src/domestic/PlayerDomestic.ts
grep -n "export function activeConditions" packages/engine/src/domestic/DomesticEconomy.ts
grep -n "governmentTier: number\|conditions: Condition\[\]" packages/engine-api/src/domestic/DomesticTypes.ts
grep -n "export type Personality\|export function nationDomesticPlan" packages/engine/src/execution/nation/NationPersonality.ts
grep -n "type DomesticTab\|const TABS\|private renderTab" src/client/hud/domestic/DomesticPanel.ts
grep -n "GOVERNMENT_TIER_REACHED" packages/engine-api/src/game/GameTypes.ts
grep -n '"ProclaimLaw"' tests/core/snapshot/FullGameSnapshot.test.ts
```

## 2단계 의존 항목 (Phase 2 dependencies)

3단계 코드는 2단계에서 아래 이름만 쓴다.

| 이름 | 2단계 정의 | 3단계에서의 쓰임·주의 |
|---|---|---|
| 정부 단계 | `PlayerDomestic.governmentTier(): number`(0..3), `DomesticData.governmentTier: number` | 저장된 값이다. 2단계 `processDomesticSecond`가 `addYield` 뒤에 `refreshGovernmentTier()`를 불러 **매초 처리 때** 올린다. `addYield`만으로는 오르지 않으므로 테스트 도우미 `reachGovernmentTier3`(Task 4)는 `PlayerDomestic.refreshGovernmentTier(): number \| null`을 직접 부른다. Task 4·6·12·14 |
| 정치력 지출 | `PlayerDomestic.spendPoliticalMilli(amount: number): void` | 음수거나 보유량보다 많으면 throw, 누적량은 그대로다. Task 4 |
| 공격 중 | `PlayerDomestic.activeConditions(): ReadonlySet<Condition>`와 `setConditions(c)`, `activeConditions(player: Player, maxTroops: number): Set<Condition>`(`packages/engine/src/domestic/DomesticEconomy.ts`) | `processDomesticSecond`가 매초 맨 처음 `d.setConditions(activeConditions(player, maxTroops))`로 그 초의 조건을 정해 둔다. `"attacking"`은 다른 플레이어를 노리는, 후퇴 중이 아닌 공격이 있다는 뜻이다(빈 땅 확장·상륙 전 수송선 제외). Task 3이 `d.activeConditions().has("attacking")`을 읽는다. `processVictoryProjectSecond`만 직접 부르는 테스트는 `activeConditions`로 조건을 먼저 채운다 |
| 국가 성향 | `type Personality = "conqueror" \| "merchant" \| "scholar" \| "zealot"`, `nationDomesticPlan(playerId: PlayerID): NationDomesticPlan`(`.personality`) (`packages/engine/src/execution/nation/NationPersonality.ts`) | 플레이어 ID 해시로 정해지고 null이 없다. 신앙 수호자의 id는 `zealot`이다. Task 6·14 |
| 선포한 법 | `PlayerDomestic.proclaimedLaws(): ReadonlyMap<LawId, LawOption>` | Task 14가 개수만 센다 |
| 국정 패널 탭 | `src/client/hud/domestic/DomesticPanel.ts`의 `type DomesticTab = "tech" \| "laws" \| "government"`, `const TABS: readonly DomesticTab[]`, `private renderTab(d: DomesticData, view: DomesticClientView, me: PlayerView): TemplateResult`(switch). 탭 버튼 이름은 ``translateText(`domestic.tab_${tab}`)`` | Task 12가 `"victory"` 탭을 더한다 |

2단계가 먼저 바꾸는 공유 파일(3단계는 그 뒤에 붙인다): `MessageType`·`MESSAGE_TYPE_CATEGORIES` 끝의 `GOVERNMENT_TIER_REACHED`, `Schemas.ts`의 DomesticTypes import·`ProclaimLawIntent`·`ChooseGovernmentIntent`, `ExecutionManager`의 `case "choose_government"`, `PlayerDomestic.ts`(전체 교체, 법·정부·조건 필드), `Transport.ts`의 `ChooseGovernmentIntentEvent`, `DomesticPanel.ts`의 탭 구조, `FullGameSnapshot.test.ts` `neverStored`의 `"ChooseGovernment"`·`"ProclaimLaw"`, `wire.test.ts` `SAMPLE_INTENTS`의 `choose_government`, `tests/domestic/util.ts`의 import·`grantLaws`·`grantGovernment`, `BarPass.computeStructureProgress`의 건설 진행 블록(3단계는 그 앞의 삭제 블록 뒤에 넣으므로 겹치지 않는다), `en.json`·`ko.json`의 `domestic.law`·`domestic.gov`·`domestic.tab_laws|government`(3단계 키와 겹치지 않는다). 2단계는 `GameConfigSchema`, `ConfigPatch`, `WinCheckExecution`, `NationExecution`(1단계 `nationDomesticTick` 호출 유지), `GameUpdates`의 `DomesticData` import, `EventsDisplay`, `AiAttackBehavior`, `NationNukeBehavior`, `DomesticExecution`은 바꾸지 않는다.

## 결정 사항 (spec이 정하지 않아 이 계획이 정한 것)

1. **프로젝트 진행·완료·실패:** 프로젝트 종류 id는 승리 사유와 같은 `"science"`(우주 계획)와 `"political"`(세계 정부 선포)다. `DomesticExecution`이 매초 10틱씩 줄이고, 남은 틱이 0이면 "완료"다. 승자 선언은 `WinCheckExecution`의 다음 검사(1초 안)가 한다. 한 번의 검사 안에서는 완료된 프로젝트 → 정복 → 시간 종료 점수 순서로 보고, 같은 초에 둘이 완료되면 `players()` 순서가 앞선 쪽이 이긴다. 실패는 건물이 사라졌거나(파괴·삭제) 주인이 바뀐 경우뿐이다(레벨은 다시 보지 않고, 완료된 프로젝트는 건물을 다시 확인하지 않는다). 정치 프로젝트의 정지는 그 초의 `"attacking"` 조건을 본다. 2단계 `processDomesticSecond`가 매초 맨 처음 판정해 `PlayerDomestic.activeConditions()`에 둔 값이고, `DomesticExecution`이 `processDomesticSecond` 바로 뒤에 프로젝트를 처리하므로 같은 초의 판정이다(민주주의의 전쟁 피로와 같은 기준). 착수 비용의 정치력은 금으로 대신 낼 수 없다(spec §3.1의 부족분 결제는 연구·법에만 적힌다).
2. **착수 자격:** 과학은 `space_program` 연구 완료, 정치는 `governmentTier() >= 3`(3단계에는 고를 정부가 없으므로 선택은 필요 없다). 착수 건물은 본인 소유, 완공, 종류 일치(연구소/행정청), 레벨 3 이상이어야 한다. 한 사람이 동시에 하나만(완료된 것 포함) 가진다.
3. **설정:** `GameConfig.conquestPercent`는 `nullable().optional()`, 30~100이며 내정 모드에서만 적용된다(원작은 80 유지). 100이면 정복 승리가 사실상 꺼진다. 내정 모드의 `maxTimerValue`는 `undefined`든 `null`(호스트 로비의 "타이머 끔")이든 30분으로 본다. 내정 모드에서는 `overtime` 설정을 무시한다.
4. **점수와 시간 종료:** 점수 합계는 살아 있는 플레이어(`mg.players()`)만 센다. 봇과 내정 상태가 없는 플레이어는 0점이고 합계에서 빠진다. 엔진은 정확한 밀리포인트로, 화면은 업데이트로 받은 정수 포인트로 계산한다(화면 값은 표시용). 시간 종료 시 점수 1위가 이기고, 동점이면 땅이 많은 쪽, 그래도 같으면 `players()` 순서다. 팀전은 팀원 점수 합으로 비교하고 봇 팀은 승자 후보가 아니다. 팀전에서 프로젝트를 완료하면 그 팀이 이긴다.
5. **AI:** 어려움·불가능의 학자(`scholar`, 과학)와 신앙 수호자(`zealot`, 정치)만 프로젝트를 시도한다. 성향은 2단계 `nationDomesticPlan(player.id()).personality`로 읽는다. 가장 레벨이 높은 자기 건물을 한 번에 한 레벨씩 3까지 올리고, 자격과 레벨 3 건물이 갖춰지면 착수할 때까지 새 건물을 짓지 않는다(방어 기지는 예외). `nationVictoryTick`은 `nationDomesticTick`보다 먼저 불러서 법 선포보다 착수가 먼저 정치력을 쓰게 한다. 견제는 내정 모드의 어려움·불가능만 한다. 공격 전략 맨 앞에 "프로젝트 주인 공격"을 두고(동맹·팀원 제외, 닿는지는 기존 `canReach`로 판단), 핵은 일반 목표보다 먼저 프로젝트 건물 타일을 노린다.
6. **화면과 도구:** 순위표 점수 열은 내정 모드에서만 보이고, 메뉴에서 숨길 수 없으며, 땅 열 앞에 둬서 기본 정렬이 점수가 된다. 지도는 프로젝트 건물에 금색 고리(반경 10타일, range-circle 셰이더 재사용)를 그리고, 기존 구조물 진행 막대로 진행률을 보인다. 착수·실패·완료 알림은 새 `MessageType.VICTORY_PROJECT`(분류 ATTACK, 경고색)로 모두에게 보낸다. 로비에서 내정 모드를 켜면 타이머가 꺼져 있거나 비어 있을 때 30분을 넣고 연장전을 끄며, 내정 모드인 동안 연장전 카드를 숨기고 정복 % 카드를 보인다. 시뮬레이션은 기본 world 맵, 어려움, 시드 3개, 30분이며, 시간 목표는 ±3분, 개수 목표(기술·법)는 범위 그대로 판정한다.

## Global Constraints

- 엔진 결정성: `packages/engine*`에서 `Math.random`, `Date.now`, `new Date`를 쓰지 않는다. `Math.pow/exp/log/sin...`과 2가 아닌 지수의 `**`도 쓰지 않는다. 점수는 나눗셈과 덧셈만 쓰고 정해진 순서로 더한다.
- 패키지 경계(`tests/LayerBoundaries.test.ts`): `engine-api`는 zod/zbin/resources만, `engine-lib`는 여기에 `engine-api`, `engine`은 여기에 `engine-lib`까지 import한다. `src/client`는 `engine`을 import하지 않는다. `scripts/`는 경계 검사 대상이 아니다.
- 내정 모드 꺼짐이면 동작이 원작과 같아야 한다. 원작 승리 업데이트에는 `reason` 키가 아예 없어야 한다. 기존 테스트는 수정 없이 전부 통과해야 한다(예외: Task 2의 `tests/server/ConfigPatch.test.ts`에 키 하나 추가, Task 4의 `tests/core/snapshot/FullGameSnapshot.test.ts` `neverStored`에 이름 하나 추가와 `tests/zbin/wire.test.ts` `SAMPLE_INTENTS`에 샘플 인텐트 하나 추가).
- 원작 AI의 호출 순서와 난수 사용을 바꾸지 않는다. 새 전략·핵 분기는 내정 모드 검사가 거짓이면 아무것도 읽거나 굴리지 않는다.
- 수치는 spec §11.1을 따르고 모두 `packages/engine-lib/src/domestic/Balance.ts`에 둔다(우주 계획 금 5,000,000·4분·연구소 레벨 3 이상, 세계 정부 선포 금 3,000,000 + 정치력 1,000·4분·행정청 레벨 3 이상, 진행 중 프로젝트 점수 최대 +10, 정복 기준 70%). `engine-api/Schemas.ts`는 engine-lib를 import할 수 없으므로 정복 % 범위(30~100)만 리터럴로 적고 주석으로 Balance를 가리킨다.
- enum 값(`MessageType`), 인텐트 스키마, `GameConfigSchema` 필드는 맨 뒤(1·2단계 항목 뒤)에 추가한다.
- 새 스냅샷 필드는 optional로 만든다. 새 Execution은 `ExecutionRegistry`에 등록하고, 내정 모드에서만 생기므로 `FullGameSnapshot.test.ts`의 `neverStored`에 이름을 넣는다.
- 화면 문구는 `translateText()`를 거친다. 키는 `resources/lang/en.json`(키 정렬 필수)과 `resources/lang/ko.json` 둘 다 추가한다.

## Review Focus

1. **진행 중 건물을 빼앗기거나 파괴당함:** 프로젝트는 그 초에 실패하고, 모두에게 알리고, 돈은 돌려주지 않는다. 다른 건물에서 다시 시작하면 비용을 또 낸다. 테스트는 Task 3 "fails without refund when the host is captured"·"fails when the host is destroyed", Task 4 "a failed project keeps its cost; restarting elsewhere pays again"이다.
2. **세계 정부 선포 중 공격과 방어:** 주인이 다른 나라를 공격하는 동안에만 멈추고, 공격받는 동안에는 계속 간다. 우주 계획은 공격 중에도 간다. 테스트는 Task 3 "the political project pauses while its owner attacks"·"defending doesn't pause it"·"the space program keeps going while attacking"이다.
3. **원작 회귀:** 원작 게임은 80%에서 이기고, 승리 업데이트에 `reason`이 없고, 타이머와 연장전이 그대로다. 테스트는 Task 2 "vanilla timers are unchanged"·"vanilla ignores conquestPercent"·"overtime is forced off in domestic mode"(원작 쪽 검사 포함), Task 5 "vanilla wins carry no reason"·"vanilla still needs 80%"다.
4. **시간 종료의 동점과 팀전:** 땅 1위가 아니라 점수 1위가 이기고, 동점이면 땅이 많은 쪽, 팀전은 팀 합산이다. 테스트는 Task 5 "at the time limit the score leader wins, not the land leader"·"score ties go to the side with more land"·"team games compare summed scores"다.
5. **프로젝트 도중 저장/복원(재접속):** 진행 중 프로젝트가 복원 후에도 같고 이후 틱도 같게 흘러야 한다. 테스트는 Task 3 "DomesticExecution runs it and it survives a snapshot"이다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `packages/engine-api/src/domestic/DomesticTypes.ts` (수정) | `VICTORY_PROJECT_KINDS`, `VictoryProjectProgress`, `WIN_REASONS`, `DomesticData.project` |
| `packages/engine-lib/src/domestic/Balance.ts` (수정) | 승리 수치 |
| `packages/engine-lib/src/domestic/Victory.ts` (새) | 프로젝트 정의, 자격, 착수 차단 이유, 타이머·정복 % 해석 |
| `packages/engine-lib/src/domestic/Score.ts` (새) | 점수 공식(엔진·화면 공용) |
| `packages/engine/src/domestic/PlayerDomestic.ts` (수정) | 진행 중 프로젝트 상태, 스냅샷, 업데이트 |
| `packages/engine/src/domestic/VictoryProjects.ts` (새) | 매초 진행·실패·완료, 프로젝트 건물 조회, 알림 |
| `packages/engine/src/domestic/VictoryProjectExecution.ts` (새) | `start_victory_project` 명령 |
| `packages/engine/src/domestic/DomesticWinCheck.ts` (새) | 내정 모드 승자 판정 |
| `packages/engine/src/execution/nation/NationVictoryBehavior.ts` (새) | AI 프로젝트 시도, 저축 판정 |
| `src/client/view/DomesticScores.ts` (새) | 화면 쪽 실시간 점수(틱당 한 번 계산) |
| `src/client/render/frame/derive/VictoryProjects.ts` (새) | 프로젝트 건물 id → 진행률 |
| `src/client/render/gl/passes/VictoryProjectPass.ts` (새) | 프로젝트 건물 금색 고리 |
| `src/client/hud/domestic/VictoryTab.ts` (새) | 국정 패널 승리 탭 |
| `scripts/domestic-sim.ts`, `scripts/domestic-sim-report.ts` (새) | 밸런스 시뮬레이션과 보고 도우미 |
| `tests/domestic/*.test.ts`, `tests/client/*.test.ts` (새), `tests/domestic/util.ts` (수정) | 테스트 |
| 기존 파일 수정 | 각 Task의 Files 목록 참고 |

---

### Task 1: 승리 타입, 수치, 프로젝트 규칙, 점수 공식

**Files:**
- Modify: `packages/engine-api/src/domestic/DomesticTypes.ts`
- Modify: `packages/engine-lib/src/domestic/Balance.ts`
- Create: `packages/engine-lib/src/domestic/Victory.ts`
- Create: `packages/engine-lib/src/domestic/Score.ts`
- Test: `tests/domestic/VictoryRules.test.ts`

**Interfaces:**
- Consumes: 1단계 `MILLI`, `DomesticData`
- Produces:
  - `VICTORY_PROJECT_KINDS = ["science", "political"]`, `type VictoryProjectKind`
  - `interface VictoryProjectProgress { kind: VictoryProjectKind; hostUnitId: number; ticksLeft: number; totalTicks: number; paused: boolean }`
  - `WIN_REASONS = ["conquest", "science", "political", "score"]`, `type WinReason`
  - `DomesticData.project?: VictoryProjectProgress`
  - Balance: `DOMESTIC_CONQUEST_PERCENT`, `CONQUEST_PERCENT_MIN`, `CONQUEST_PERCENT_MAX`, `DOMESTIC_TIMER_MINUTES`, `SCIENCE_PROJECT_GOLD`, `POLITICAL_PROJECT_GOLD`, `POLITICAL_PROJECT_POLITICAL`, `VICTORY_PROJECT_SECONDS`, `PROJECT_HOST_MIN_LEVEL`, `PROJECT_GOVERNMENT_TIER`, `SCORE_PER_CATEGORY`, `PROJECT_SCORE_MAX`
  - `interface VictoryProjectDef { kind; hostType: UnitType.ResearchInstitute | UnitType.AdminOffice; goldCost: bigint; politicalCostMilli: number; ticks: number; pausesWhileAttacking: boolean }`
  - `VICTORY_PROJECTS: Readonly<Record<VictoryProjectKind, VictoryProjectDef>>`
  - `projectQualified(kind: VictoryProjectKind, hasSpaceProgram: boolean, governmentTier: number): boolean`
  - `type ProjectBlock = "busy" | "requirement" | "host" | "gold" | "political"`
  - `interface ProjectAttempt { busy: boolean; qualified: boolean; hostLevel: number | null; gold: bigint; politicalMilli: number }`
  - `victoryProjectBlock(kind: VictoryProjectKind, a: ProjectAttempt): ProjectBlock | null`
  - `interface ScoreInput { scored: boolean; tiles: number; science: number; political: number; gold: number; projectProgress: number }`
  - `interface ScoreBreakdown { land: number; science: number; political: number; economy: number; project: number; total: number }`
  - `projectProgress(p: VictoryProjectProgress | null | undefined): number`
  - `domesticScores(inputs: readonly ScoreInput[]): ScoreBreakdown[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/VictoryRules.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  domesticScores,
  projectProgress,
  ScoreInput,
} from "@openfront/engine-lib/domestic/Score";
import {
  ProjectAttempt,
  projectQualified,
  VICTORY_PROJECTS,
  victoryProjectBlock,
} from "@openfront/engine-lib/domestic/Victory";

const READY: ProjectAttempt = {
  busy: false,
  qualified: true,
  hostLevel: 3,
  gold: 5_000_000n,
  politicalMilli: 0,
};

describe("victory projects", () => {
  test("costs, hosts and durations follow spec §8.1", () => {
    expect(VICTORY_PROJECTS.science.hostType).toBe(UnitType.ResearchInstitute);
    expect(VICTORY_PROJECTS.science.goldCost).toBe(5_000_000n);
    expect(VICTORY_PROJECTS.science.politicalCostMilli).toBe(0);
    expect(VICTORY_PROJECTS.science.ticks).toBe(2400);
    expect(VICTORY_PROJECTS.science.pausesWhileAttacking).toBe(false);
    expect(VICTORY_PROJECTS.political.hostType).toBe(UnitType.AdminOffice);
    expect(VICTORY_PROJECTS.political.goldCost).toBe(3_000_000n);
    expect(VICTORY_PROJECTS.political.politicalCostMilli).toBe(1_000_000);
    expect(VICTORY_PROJECTS.political.ticks).toBe(2400);
    expect(VICTORY_PROJECTS.political.pausesWhileAttacking).toBe(true);
  });

  test("qualification: the space program tech, or government tier 3", () => {
    expect(projectQualified("science", true, 0)).toBe(true);
    expect(projectQualified("science", false, 3)).toBe(false);
    expect(projectQualified("political", false, 3)).toBe(true);
    expect(projectQualified("political", true, 2)).toBe(false);
  });

  test("blocks are reported in order", () => {
    expect(victoryProjectBlock("science", READY)).toBeNull();
    expect(
      victoryProjectBlock("science", { ...READY, busy: true, qualified: false }),
    ).toBe("busy");
    expect(
      victoryProjectBlock("science", {
        ...READY,
        qualified: false,
        hostLevel: null,
      }),
    ).toBe("requirement");
    expect(victoryProjectBlock("science", { ...READY, hostLevel: null })).toBe(
      "host",
    );
    expect(victoryProjectBlock("science", { ...READY, hostLevel: 2 })).toBe(
      "host",
    );
    expect(
      victoryProjectBlock("science", { ...READY, gold: 4_999_999n }),
    ).toBe("gold");
    expect(
      victoryProjectBlock("political", {
        ...READY,
        gold: 3_000_000n,
        politicalMilli: 999_999,
      }),
    ).toBe("political");
    expect(
      victoryProjectBlock("political", {
        ...READY,
        gold: 3_000_000n,
        politicalMilli: 1_000_000,
      }),
    ).toBeNull();
  });
});

function input(over: Partial<ScoreInput>): ScoreInput {
  return {
    scored: true,
    tiles: 0,
    science: 0,
    political: 0,
    gold: 0,
    projectProgress: 0,
    ...over,
  };
}

describe("domestic score", () => {
  test("each category is my share of the total times 25", () => {
    const [a, b] = domesticScores([
      input({ tiles: 300, science: 100, political: 0, gold: 1000 }),
      input({ tiles: 100, science: 300, political: 50, gold: 1000 }),
    ]);
    expect(a.land).toBe(18.75);
    expect(a.science).toBe(6.25);
    expect(a.political).toBe(0);
    expect(a.economy).toBe(12.5);
    expect(a.total).toBe(37.5);
    expect(b.total).toBe(62.5);
  });

  test("bots score nothing and don't count toward the totals", () => {
    const [human, bot] = domesticScores([
      input({ tiles: 100, science: 10, political: 10, gold: 10 }),
      input({ scored: false, tiles: 900 }),
    ]);
    expect(human.total).toBe(100);
    expect(bot.total).toBe(0);
  });

  test("an empty category gives nobody points", () => {
    const [a] = domesticScores([input({ tiles: 10 })]);
    expect(a.total).toBe(25);
  });

  test("a running project adds up to 10 points by progress", () => {
    const [a] = domesticScores([input({ tiles: 10, projectProgress: 0.5 })]);
    expect(a.project).toBe(5);
    expect(a.total).toBe(30);
    expect(projectProgress(null)).toBe(0);
    expect(projectProgress(undefined)).toBe(0);
    expect(
      projectProgress({
        kind: "science",
        hostUnitId: 1,
        ticksLeft: 600,
        totalTicks: 2400,
        paused: false,
      }),
    ).toBe(0.75);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/VictoryRules.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine-lib/domestic/Score'`

- [ ] **Step 3: 타입 추가**

`packages/engine-api/src/domestic/DomesticTypes.ts`의 `DomesticData` 인터페이스 맨 끝(2단계의 마지막 필드 `conditions: Condition[];` 뒤, 닫는 `}` 앞)에 추가:

```ts
  /** The running (or just completed) victory project; absent when none. */
  project?: VictoryProjectProgress;
```

같은 파일 끝에 추가:

```ts
/** Domestic victory projects (spec §8): the science and the political one. */
export const VICTORY_PROJECT_KINDS = ["science", "political"] as const;
export type VictoryProjectKind = (typeof VICTORY_PROJECT_KINDS)[number];

/** A running victory project, as stored and as sent to clients. */
export interface VictoryProjectProgress {
  kind: VictoryProjectKind;
  /** The research institute / admin office the project runs in. */
  hostUnitId: number;
  /** 0 once the project is complete. */
  ticksLeft: number;
  totalTicks: number;
  /** Political project only: held back last second because its owner was attacking. */
  paused: boolean;
}

/** How a domestic-mode game was won (WinUpdate.reason). */
export const WIN_REASONS = [
  "conquest",
  "science",
  "political",
  "score",
] as const;
export type WinReason = (typeof WIN_REASONS)[number];
```

- [ ] **Step 4: 수치 추가**

`packages/engine-lib/src/domestic/Balance.ts` 끝에 추가:

```ts
// Victory (spec §8, §11.1).
/** Land share (percent) that wins by conquest in domestic mode; vanilla keeps 80. */
export const DOMESTIC_CONQUEST_PERCENT = 70;
/** Lobby bounds for GameConfig.conquestPercent (100 = no conquest victory). */
export const CONQUEST_PERCENT_MIN = 30;
export const CONQUEST_PERCENT_MAX = 100;
/** Game length when the lobby leaves maxTimerValue unset. */
export const DOMESTIC_TIMER_MINUTES = 30;
export const SCIENCE_PROJECT_GOLD = 5_000_000n;
export const POLITICAL_PROJECT_GOLD = 3_000_000n;
/** Whole points. */
export const POLITICAL_PROJECT_POLITICAL = 1000;
export const VICTORY_PROJECT_SECONDS = 4 * 60;
export const PROJECT_HOST_MIN_LEVEL = 3;
export const PROJECT_GOVERNMENT_TIER = 3;
/** Land, science, political power and gold are worth this much each. */
export const SCORE_PER_CATEGORY = 25;
/** A running project adds up to this much, by progress. */
export const PROJECT_SCORE_MAX = 10;
```

- [ ] **Step 5: 프로젝트 규칙 작성**

`packages/engine-lib/src/domestic/Victory.ts`:

```ts
import { VictoryProjectKind } from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  MILLI,
  POLITICAL_PROJECT_GOLD,
  POLITICAL_PROJECT_POLITICAL,
  PROJECT_GOVERNMENT_TIER,
  PROJECT_HOST_MIN_LEVEL,
  SCIENCE_PROJECT_GOLD,
  VICTORY_PROJECT_SECONDS,
} from "./Balance";

export interface VictoryProjectDef {
  kind: VictoryProjectKind;
  /** The building the project runs in (level PROJECT_HOST_MIN_LEVEL or more). */
  hostType: UnitType.ResearchInstitute | UnitType.AdminOffice;
  goldCost: bigint;
  politicalCostMilli: number;
  ticks: number;
  /** Progress stops while the owner is attacking another nation. */
  pausesWhileAttacking: boolean;
}

// Spec §8.1.
export const VICTORY_PROJECTS: Readonly<
  Record<VictoryProjectKind, VictoryProjectDef>
> = {
  science: {
    kind: "science",
    hostType: UnitType.ResearchInstitute,
    goldCost: SCIENCE_PROJECT_GOLD,
    politicalCostMilli: 0,
    ticks: VICTORY_PROJECT_SECONDS * 10,
    pausesWhileAttacking: false,
  },
  political: {
    kind: "political",
    hostType: UnitType.AdminOffice,
    goldCost: POLITICAL_PROJECT_GOLD,
    politicalCostMilli: POLITICAL_PROJECT_POLITICAL * MILLI,
    ticks: VICTORY_PROJECT_SECONDS * 10,
    pausesWhileAttacking: true,
  },
};

/** Whether a player has unlocked `kind`: the space program tech, or government tier 3. */
export function projectQualified(
  kind: VictoryProjectKind,
  hasSpaceProgram: boolean,
  governmentTier: number,
): boolean {
  return kind === "science"
    ? hasSpaceProgram
    : governmentTier >= PROJECT_GOVERNMENT_TIER;
}

export type ProjectBlock = "busy" | "requirement" | "host" | "gold" | "political";

/** What a start attempt looks like to the rules, from either side. */
export interface ProjectAttempt {
  /** The player already has a project (one at a time). */
  busy: boolean;
  qualified: boolean;
  /** The chosen host's level if it is the player's own finished building of the right type; null otherwise. */
  hostLevel: number | null;
  gold: bigint;
  politicalMilli: number;
}

/** Why `kind` can't start now, or null when it can. Checked in this order. */
export function victoryProjectBlock(
  kind: VictoryProjectKind,
  a: ProjectAttempt,
): ProjectBlock | null {
  if (a.busy) return "busy";
  if (!a.qualified) return "requirement";
  if (a.hostLevel === null || a.hostLevel < PROJECT_HOST_MIN_LEVEL) {
    return "host";
  }
  const def = VICTORY_PROJECTS[kind];
  if (a.gold < def.goldCost) return "gold";
  if (a.politicalMilli < def.politicalCostMilli) return "political";
  return null;
}
```

- [ ] **Step 6: 점수 공식 작성**

`packages/engine-lib/src/domestic/Score.ts`:

```ts
import { VictoryProjectProgress } from "@openfront/engine-api/domestic/DomesticTypes";
import { PROJECT_SCORE_MAX, SCORE_PER_CATEGORY } from "./Balance";

/** One player's raw numbers. Any consistent unit works: only shares count. */
export interface ScoreInput {
  /** Bots (and players without domestic state) score nothing and stay out of the totals. */
  scored: boolean;
  tiles: number;
  /** Cumulative science produced. */
  science: number;
  /** Cumulative political power produced. */
  political: number;
  /** Cumulative gold earned (Player.goldEarned). */
  gold: number;
  /** 0..1 progress of the player's running victory project; 0 when none. */
  projectProgress: number;
}

export interface ScoreBreakdown {
  land: number;
  science: number;
  political: number;
  economy: number;
  project: number;
  total: number;
}

const ZERO: ScoreBreakdown = {
  land: 0,
  science: 0,
  political: 0,
  economy: 0,
  project: 0,
  total: 0,
};

/** How far a project is, 0..1; 0 for none. */
export function projectProgress(
  p: VictoryProjectProgress | null | undefined,
): number {
  if (p === null || p === undefined || p.totalTicks <= 0) return 0;
  return Math.min(1, Math.max(0, (p.totalTicks - p.ticksLeft) / p.totalTicks));
}

/**
 * Spec §8.2: each of land, science, political power and gold earned is
 * worth (mine / everyone's) x 25 points, and a running victory project adds
 * up to 10 by progress. Shared by the engine (the 30-minute judgement) and
 * the client (the live leaderboard), so both rank players the same way.
 */
export function domesticScores(inputs: readonly ScoreInput[]): ScoreBreakdown[] {
  let tiles = 0;
  let science = 0;
  let political = 0;
  let gold = 0;
  for (const i of inputs) {
    if (!i.scored) continue;
    tiles += i.tiles;
    science += i.science;
    political += i.political;
    gold += i.gold;
  }
  const share = (value: number, total: number) =>
    total > 0 ? (value / total) * SCORE_PER_CATEGORY : 0;
  return inputs.map((i) => {
    if (!i.scored) return ZERO;
    const land = share(i.tiles, tiles);
    const sci = share(i.science, science);
    const pol = share(i.political, political);
    const economy = share(i.gold, gold);
    const project =
      PROJECT_SCORE_MAX * Math.min(1, Math.max(0, i.projectProgress));
    return {
      land,
      science: sci,
      political: pol,
      economy,
      project,
      total: land + sci + pol + economy + project,
    };
  });
}
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest tests/domestic/VictoryRules.test.ts --run && npm run typecheck`
Expected: PASS (7 tests), typecheck 오류 없음

- [ ] **Step 8: 커밋**

```bash
npx prettier --write packages/engine-api/src/domestic packages/engine-lib/src/domestic tests/domestic/VictoryRules.test.ts
git add packages/engine-api/src/domestic packages/engine-lib/src/domestic tests/domestic/VictoryRules.test.ts
git commit -m "feat(domestic): victory project rules, balance values and the shared score formula"
```

---

### Task 2: 정복 %, 30분 타이머, 연장전 끄기

**Files:**
- Modify: `packages/engine-api/src/Schemas.ts` (`GameConfigSchema` 끝에 `conquestPercent`)
- Modify: `packages/engine-lib/src/domestic/Victory.ts` (`effectiveMaxTimerMinutes`, `domesticConquestPercent`)
- Modify: `packages/engine-lib/src/configuration/Config.ts` (`conquestPercent`, `maxTimerMinutes`, `overtimeConfig`, `percentageTilesOwnedToWin`)
- Modify: `src/server/ConfigPatch.ts` (`NULLABLE_KEYS`)
- Modify: `tests/server/ConfigPatch.test.ts` (`NULLABLE`에 키 추가)
- Modify: `src/client/hud/layers/GameRightSidebar.ts` (타이머 읽기 3곳)
- Test: `tests/domestic/DomesticConfig.test.ts`

**Interfaces:**
- Consumes: Task 1의 `DOMESTIC_CONQUEST_PERCENT`, `DOMESTIC_TIMER_MINUTES`
- Produces:
  - `GameConfig.conquestPercent?: number | null`
  - `effectiveMaxTimerMinutes(gc: Pick<GameConfig, "maxTimerValue" | "domesticMode">): number | null`
  - `domesticConquestPercent(gc: Pick<GameConfig, "conquestPercent">): number`
  - `Config.conquestPercent(): number`, `Config.maxTimerMinutes(): number | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/DomesticConfig.test.ts`:

```ts
import { effectiveMaxTimerMinutes } from "@openfront/engine-lib/domestic/Victory";
import { setup } from "../util/Setup";
import { domesticGame, HUMAN } from "./util";

describe("domestic game config", () => {
  test("domestic games last 30 minutes unless the lobby set a timer", async () => {
    expect((await domesticGame()).config().maxTimerMinutes()).toBe(30);
    expect(
      (await domesticGame({ maxTimerValue: null })).config().maxTimerMinutes(),
    ).toBe(30);
    expect(
      (await domesticGame({ maxTimerValue: 45 })).config().maxTimerMinutes(),
    ).toBe(45);
  });

  test("vanilla timers are unchanged", async () => {
    expect(
      (await setup("plains", {}, [HUMAN])).config().maxTimerMinutes(),
    ).toBeNull();
    expect(
      (await setup("plains", { maxTimerValue: 20 }, [HUMAN]))
        .config()
        .maxTimerMinutes(),
    ).toBe(20);
  });

  test("conquest needs 70% of the land by default, or the lobby's value", async () => {
    const config = (await domesticGame()).config();
    expect(config.conquestPercent()).toBe(70);
    expect(config.percentageTilesOwnedToWin(0)).toBe(70);
    expect(
      (await domesticGame({ conquestPercent: 55 }))
        .config()
        .percentageTilesOwnedToWin(0),
    ).toBe(55);
  });

  test("vanilla ignores conquestPercent and keeps 80", async () => {
    const config = (
      await setup("plains", { conquestPercent: 55 }, [HUMAN])
    ).config();
    expect(config.conquestPercent()).toBe(80);
    expect(config.percentageTilesOwnedToWin(0)).toBe(80);
  });

  test("overtime is forced off in domestic mode", async () => {
    const overtime = { enabled: true, startMinutes: 1 };
    const domestic = (await domesticGame({ overtime })).config();
    expect(domestic.overtimeConfig().enabled).toBe(false);
    expect(domestic.percentageTilesOwnedToWin(30 * 60)).toBe(70);
    const vanilla = (await setup("plains", { overtime }, [HUMAN])).config();
    expect(vanilla.overtimeConfig().enabled).toBe(true);
    expect(vanilla.percentageTilesOwnedToWin(30 * 60)).toBeLessThan(80);
  });

  test("the client reads the same timer from a bare GameConfig", () => {
    expect(
      effectiveMaxTimerMinutes({ maxTimerValue: undefined, domesticMode: true }),
    ).toBe(30);
    expect(effectiveMaxTimerMinutes({ maxTimerValue: undefined })).toBeNull();
    expect(
      effectiveMaxTimerMinutes({ maxTimerValue: 10, domesticMode: true }),
    ).toBe(10);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/DomesticConfig.test.ts --run`
Expected: FAIL — `effectiveMaxTimerMinutes is not a function` 또는 `config.maxTimerMinutes is not a function`

- [ ] **Step 3: 설정 스키마 필드 추가**

`packages/engine-api/src/Schemas.ts`의 `GameConfigSchema` 마지막 필드인 1단계의 `domesticMode: z.boolean().optional(),`(2단계는 이 스키마에 필드를 더하지 않는다) 바로 뒤에 추가:

```ts
  // Domestic mode: land share (percent) that wins by conquest. Unset means
  // 70; ignored outside domestic mode (vanilla keeps 80). 100 turns conquest
  // victory off. Bounds mirror CONQUEST_PERCENT_MIN/MAX in engine-lib's
  // domestic/Balance.ts (engine-api can't import engine-lib).
  conquestPercent: zb.uint({ min: 30, max: 100 }).nullable().optional(),
```

- [ ] **Step 4: 타이머·정복 % 해석 함수**

`packages/engine-lib/src/domestic/Victory.ts`:
- import 추가: `import { GameConfig } from "@openfront/engine-api/Schemas";`
- `./Balance` import 목록에 `DOMESTIC_CONQUEST_PERCENT`, `DOMESTIC_TIMER_MINUTES`를 추가한다.
- 파일 끝에 추가:

```ts
/**
 * Game length in minutes; null when there is no timer. Domestic games
 * always end on a timer (spec §8.3): 30 minutes unless the lobby set one,
 * including the host lobby's "timer off" (null).
 */
export function effectiveMaxTimerMinutes(
  gc: Pick<GameConfig, "maxTimerValue" | "domesticMode">,
): number | null {
  const set = gc.maxTimerValue ?? null;
  if (set !== null) return set;
  return gc.domesticMode === true ? DOMESTIC_TIMER_MINUTES : null;
}

/** Conquest threshold of a domestic game (percent of non-fallout land). */
export function domesticConquestPercent(
  gc: Pick<GameConfig, "conquestPercent">,
): number {
  return gc.conquestPercent ?? DOMESTIC_CONQUEST_PERCENT;
}
```

- [ ] **Step 5: Config 수정**

`packages/engine-lib/src/configuration/Config.ts`:
- import 추가:

```ts
import {
  domesticConquestPercent,
  effectiveMaxTimerMinutes,
} from "../domestic/Victory";
```

- `overtimeConfig()`의 `enabled: c?.enabled ?? d.enabled,` 줄을 다음으로 바꾼다:

```ts
      // Domestic mode always ends on its timer: no overtime (spec §8.3).
      enabled: !this.domesticMode() && (c?.enabled ?? d.enabled),
```

- `domesticMode()` 메서드 바로 뒤에 추가:

```ts
  /** Land share (percent) that wins by conquest, before any overtime drop. */
  conquestPercent(): number {
    return this.domesticMode()
      ? domesticConquestPercent(this._gameConfig)
      : PERCENT_TILES_OWNED_TO_WIN;
  }

  /** Game length in minutes; null when the game has no timer. */
  maxTimerMinutes(): number | null {
    return effectiveMaxTimerMinutes(this._gameConfig);
  }
```

- `percentageTilesOwnedToWin`의 `const base = PERCENT_TILES_OWNED_TO_WIN;`을 `const base = this.conquestPercent();`로 바꾼다.

- [ ] **Step 6: 서버 설정 패치 허용 목록**

`src/server/ConfigPatch.ts`의 `NULLABLE_KEYS`에서 `"waterNukes",` 뒤에 `"conquestPercent",`를 추가한다(null이면 기본 70으로 되돌린다).

`tests/server/ConfigPatch.test.ts`의 `NULLABLE`에서 `waterNukes: true,` 뒤에 `conquestPercent: 60,`을 추가한다.

- [ ] **Step 7: 화면 타이머가 같은 규칙을 쓰게 하기**

`src/client/hud/layers/GameRightSidebar.ts`의 타이머 읽기 세 곳(`const maxTimerValue = this.game.config().gameConfig().maxTimerValue;`)을 한 번에 바꾸고 import를 추가한다. 테스트의 가짜 `gameConfig()`는 `domesticMode`가 없어서 결과가 원작과 같다.

```bash
sed -i 's/this\.game\.config()\.gameConfig()\.maxTimerValue;/effectiveMaxTimerMinutes(this.game.config().gameConfig());/' src/client/hud/layers/GameRightSidebar.ts
grep -c "effectiveMaxTimerMinutes(this.game.config().gameConfig())" src/client/hud/layers/GameRightSidebar.ts
```

Expected: `3`

같은 파일의 import 목록에 추가:

```ts
import { effectiveMaxTimerMinutes } from "@openfront/engine-lib/domestic/Victory";
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest tests/domestic/DomesticConfig.test.ts tests/server/ConfigPatch.test.ts tests/GameRightSidebar.test.ts tests/client/GameRightSidebar.fullscreen.test.ts tests/core/executions/WinCheckExecution.test.ts --run && npm run typecheck`
Expected: 모두 PASS(DomesticConfig 6 tests), typecheck 오류 없음

- [ ] **Step 9: 커밋**

```bash
npx prettier --write packages/engine-api/src/Schemas.ts packages/engine-lib/src src/server/ConfigPatch.ts tests/server/ConfigPatch.test.ts src/client/hud/layers/GameRightSidebar.ts tests/domestic/DomesticConfig.test.ts
git add packages/engine-api/src/Schemas.ts packages/engine-lib/src src/server/ConfigPatch.ts tests/server/ConfigPatch.test.ts src/client/hud/layers/GameRightSidebar.ts tests/domestic/DomesticConfig.test.ts
git commit -m "feat(domestic): configurable conquest percent, 30-minute timer, no overtime"
```

---

### Task 3: 진행 중 프로젝트 상태와 매초 진행·실패

**Files:**
- Modify: `packages/engine/src/domestic/PlayerDomestic.ts`
- Create: `packages/engine/src/domestic/VictoryProjects.ts`
- Modify: `packages/engine/src/domestic/DomesticExecution.ts`
- Modify: `packages/engine-api/src/game/GameTypes.ts` (`MessageType.VICTORY_PROJECT`, 분류)
- Modify: `src/client/Utils.ts` (메시지 색)
- Modify: `tests/domestic/util.ts` (`conquerRect`, `buildLevel`)
- Test: `tests/domestic/VictoryProjectProgress.test.ts`

**Interfaces:**
- Consumes: Task 1의 `VictoryProjectProgress`, `VICTORY_PROJECT_KINDS`, `VICTORY_PROJECTS`; 1단계 `DOMESTIC_INTERVAL_TICKS`; 2단계 `PlayerDomestic.activeConditions()`(그 초의 조건), 테스트에서 `activeConditions(player, maxTroops)`와 `PlayerDomestic.setConditions`
- Produces:
  - `PlayerDomestic.victoryProject(): VictoryProjectProgress | null`
  - `PlayerDomestic.beginVictoryProject(kind: VictoryProjectKind, hostUnitId: number, ticks: number): void`
  - `PlayerDomestic.advanceVictoryProject(ticks: number, paused: boolean): void`
  - `PlayerDomestic.clearVictoryProject(): void`
  - `hasActiveVictoryProject(player: Player): boolean`
  - `victoryProjectHosts(mg: Game): Unit[]`
  - `processVictoryProjectSecond(mg: Game, player: Player, d: PlayerDomestic): void`
  - `announceVictoryProject(mg: Game, player: Player, message: string, kind: VictoryProjectKind, unitId?: number): void`
  - `MessageType.VICTORY_PROJECT`(메시지 키 `events_display.victory_project_started|failed|complete`, 파라미터 `{ name: string; project: VictoryProjectKind }`)
  - 테스트 유틸 `conquerRect(game, player, x0, y0, width, height): void`, `buildLevel(game, player, type: UnitType.ResearchInstitute | UnitType.AdminOffice, x, y, level): Unit`

- [ ] **Step 1: 테스트 유틸 추가**

`tests/domestic/util.ts`:
- `@openfront/engine-api/game/GameTypes` import 목록에 `UnitType`을 추가한다.
- `@openfront/engine/game/Game` import 목록에 `Unit`을 추가한다.
- 파일 끝에 추가:

```ts
export function conquerRect(
  game: Game,
  player: Player,
  x0: number,
  y0: number,
  width: number,
  height: number,
): void {
  for (let x = x0; x < x0 + width; x++) {
    for (let y = y0; y < y0 + height; y++) {
      player.conquer(game.ref(x, y));
    }
  }
}

/** A finished research institute / admin office at `level` (build it before adding gold: building costs gold). */
export function buildLevel(
  game: Game,
  player: Player,
  type: UnitType.ResearchInstitute | UnitType.AdminOffice,
  x: number,
  y: number,
  level: number,
): Unit {
  const unit = player.buildUnit(type, game.ref(x, y), {});
  for (let l = 1; l < level; l++) unit.increaseLevel();
  return unit;
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/domestic/VictoryProjectProgress.test.ts`:

```ts
import {
  MessageType,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { vi } from "vitest";
import { activeConditions } from "@openfront/engine/domestic/DomesticEconomy";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import {
  hasActiveVictoryProject,
  processVictoryProjectSecond,
  victoryProjectHosts,
} from "@openfront/engine/domestic/VictoryProjects";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { buildLevel, conquerRect, domesticGame, HUMAN } from "./util";

const RIVAL = new PlayerInfo("rival", PlayerType.Human, null, "rival_id");

/** a holds the left half of the plains, b the right half. */
async function twoPlayers(): Promise<{ game: Game; a: Player; b: Player }> {
  const game = await domesticGame({}, [HUMAN, RIVAL]);
  const a = game.player(HUMAN.id);
  const b = game.player(RIVAL.id);
  conquerRect(game, a, 0, 0, 50, 100);
  conquerRect(game, b, 50, 0, 50, 100);
  return { game, a, b };
}

/**
 * One second of the project. DomesticExecution runs processDomesticSecond
 * first, which sets this second's conditions; here only that step is
 * repeated, so gold and troops stay as the test left them.
 */
function second(game: Game, player: Player): void {
  const d = player.domestic()!;
  d.setConditions(activeConditions(player, game.config().maxTroops(player)));
  processVictoryProjectSecond(game, player, d);
}

describe("victory project progress", () => {
  test("advances a second at a time and announces completion", async () => {
    const { game, a } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.ResearchInstitute, 5, 50, 3);
    const d = a.domestic()!;
    d.beginVictoryProject("science", host.id(), 20);
    const spy = vi.spyOn(game, "displayMessage");

    second(game, a);
    expect(d.victoryProject()?.ticksLeft).toBe(10);
    expect(hasActiveVictoryProject(a)).toBe(true);
    expect(victoryProjectHosts(game)).toEqual([host]);

    second(game, a);
    expect(d.victoryProject()?.ticksLeft).toBe(0);
    expect(hasActiveVictoryProject(a)).toBe(false);
    expect(victoryProjectHosts(game)).toEqual([]);
    expect(spy).toHaveBeenCalledWith(
      "events_display.victory_project_complete",
      MessageType.VICTORY_PROJECT,
      null,
      undefined,
      { name: a.displayName(), project: "science" },
      host.id(),
      a.id(),
    );

    second(game, a);
    expect(d.victoryProject()?.ticksLeft).toBe(0);
  });

  test("fails without refund when the host is captured", async () => {
    const { game, a, b } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.ResearchInstitute, 5, 50, 3);
    a.domestic()!.beginVictoryProject("science", host.id(), 2400);
    const gold = a.gold();
    const spy = vi.spyOn(game, "displayMessage");

    b.captureUnit(host);
    second(game, a);

    expect(a.domestic()!.victoryProject()).toBeNull();
    expect(a.gold()).toBe(gold);
    expect(spy).toHaveBeenCalledWith(
      "events_display.victory_project_failed",
      MessageType.VICTORY_PROJECT,
      null,
      undefined,
      { name: a.displayName(), project: "science" },
      undefined,
      a.id(),
    );
  });

  test("fails when the host is destroyed", async () => {
    const { game, a } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.AdminOffice, 5, 50, 3);
    a.domestic()!.beginVictoryProject("political", host.id(), 2400);
    host.delete();
    second(game, a);
    expect(a.domestic()!.victoryProject()).toBeNull();
  });

  test("the political project pauses while its owner attacks another nation", async () => {
    const { game, a, b } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.AdminOffice, 5, 50, 3);
    const d = a.domestic()!;
    d.beginVictoryProject("political", host.id(), 2400);
    a.setTroops(100_000);
    game.addExecution(new AttackExecution(50_000, a, b.id(), null));
    executeTicks(game, 3);
    expect(a.outgoingAttacks().length).toBeGreaterThan(0);

    second(game, a);
    expect(d.victoryProject()).toMatchObject({ ticksLeft: 2400, paused: true });
  });

  test("defending doesn't pause it", async () => {
    const { game, a, b } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.AdminOffice, 5, 50, 3);
    const d = a.domestic()!;
    d.beginVictoryProject("political", host.id(), 2400);
    b.setTroops(100_000);
    game.addExecution(new AttackExecution(50_000, b, a.id(), null));
    executeTicks(game, 3);
    expect(a.incomingAttacks().length).toBeGreaterThan(0);
    expect(a.outgoingAttacks()).toHaveLength(0);
    expect(host.owner()).toBe(a);

    second(game, a);
    expect(d.victoryProject()).toMatchObject({ ticksLeft: 2390, paused: false });
  });

  test("the space program keeps going while attacking", async () => {
    const { game, a, b } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.ResearchInstitute, 5, 50, 3);
    const d = a.domestic()!;
    d.beginVictoryProject("science", host.id(), 2400);
    a.setTroops(100_000);
    game.addExecution(new AttackExecution(50_000, a, b.id(), null));
    executeTicks(game, 3);
    expect(a.outgoingAttacks().length).toBeGreaterThan(0);

    second(game, a);
    expect(d.victoryProject()).toMatchObject({ ticksLeft: 2390, paused: false });
  });

  test("DomesticExecution runs it and it survives a snapshot", async () => {
    const { game, a } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.ResearchInstitute, 5, 50, 3);
    a.domestic()!.beginVictoryProject("science", host.id(), 2400);
    game.addExecution(new DomesticExecution());
    executeTicks(game, 1); // init
    executeTicks(game, 20);
    expect(a.domestic()!.victoryProject()?.ticksLeft).toBe(2380);

    const restored = await expectSnapshotRoundTrip(game, "plains", 30);
    expect(
      restored.player(HUMAN.id).domestic()!.victoryProject()?.kind,
    ).toBe("science");
  });

  test("the project rides the player update", async () => {
    const { a } = await twoPlayers();
    const d = a.domestic()!;
    expect(d.toData().project).toBeUndefined();
    d.beginVictoryProject("science", 42, 2400);
    expect(d.toData().project).toEqual({
      kind: "science",
      hostUnitId: 42,
      ticksLeft: 2400,
      totalTicks: 2400,
      paused: false,
    });
    d.clearVictoryProject();
    expect(d.toData().project).toBeUndefined();
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest tests/domestic/VictoryProjectProgress.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine/domestic/VictoryProjects'`

- [ ] **Step 4: 메시지 타입 추가**

`packages/engine-api/src/game/GameTypes.ts`의 `MessageType` enum 맨 끝(2단계의 `GOVERNMENT_TIER_REACHED,` 뒤)에 `VICTORY_PROJECT,`를 추가한다. `MESSAGE_TYPE_CATEGORIES`의 맨 끝 항목(2단계의 `[MessageType.GOVERNMENT_TIER_REACHED]: MessageCategory.TRADE,`) 뒤에 추가:

```ts
  [MessageType.VICTORY_PROJECT]: MessageCategory.ATTACK,
```

`src/client/Utils.ts`의 `getMessageTypeClasses`에서 `case MessageType.RENEW_ALLIANCE:` 바로 뒤에 `case MessageType.VICTORY_PROJECT:`를 추가한다(경고색 그룹).

- [ ] **Step 5: PlayerDomestic에 프로젝트 상태 추가**

`packages/engine/src/domestic/PlayerDomestic.ts`(2단계 Task 2가 전체를 바꾼 파일):
- `@openfront/engine-api/domestic/DomesticTypes` import 목록(2단계의 `CONDITIONS` … `TechId`)에 `VICTORY_PROJECT_KINDS`, `VictoryProjectKind`, `VictoryProjectProgress`를 추가한다.
- `DomesticStateSchema`의 마지막 필드(2단계의 `conditions: z.array(z.enum(CONDITIONS)).optional(),`) 뒤에 추가:

```ts
  // Phase 3; absent in older snapshots and while no project runs.
  project: z
    .object({
      kind: z.enum(VICTORY_PROJECT_KINDS),
      hostUnitId: zInt(),
      ticksLeft: zInt(),
      totalTicks: zInt(),
      paused: z.boolean(),
    })
    .nullable()
    .optional(),
```

- 필드 추가(2단계의 `private government: GovernmentId = "chiefdom";` 뒤):

```ts
  private project: VictoryProjectProgress | null = null;
```

- 메서드 추가(`currentResearch()` 메서드 바로 뒤):

```ts
  victoryProject(): VictoryProjectProgress | null {
    return this.project;
  }

  beginVictoryProject(
    kind: VictoryProjectKind,
    hostUnitId: number,
    ticks: number,
  ): void {
    this.project = {
      kind,
      hostUnitId,
      ticksLeft: ticks,
      totalTicks: ticks,
      paused: false,
    };
    this.changed();
  }

  /** One processed second of the project; a paused second doesn't count. */
  advanceVictoryProject(ticks: number, paused: boolean): void {
    const p = this.project;
    if (p === null) return;
    this.project = {
      ...p,
      ticksLeft: paused ? p.ticksLeft : Math.max(0, p.ticksLeft - ticks),
      paused,
    };
    this.changed();
  }

  clearVictoryProject(): void {
    if (this.project === null) return;
    this.project = null;
    this.changed();
  }
```

- `toData()`(`this.domesticDataCache ??= { ... }`)와 `snapshot()`의 반환 객체는 둘 다 2단계의 `conditions: [...this.conditions],`로 끝난다. 두 곳 모두 그 줄 뒤에 다음 줄을 추가한다. 프로젝트가 없으면 키를 넣지 않는다:

```ts
      ...(this.project === null ? {} : { project: { ...this.project } }),
```

- `restore()`의 2단계 줄 `d.conditions = new Set(s.conditions ?? []);` 뒤(`d.rebuild();` 앞)에 추가:

```ts
    d.project = s.project ? { ...s.project } : null;
```

- [ ] **Step 6: 매초 진행 작성**

`packages/engine/src/domestic/VictoryProjects.ts`:

```ts
import { VictoryProjectKind } from "@openfront/engine-api/domestic/DomesticTypes";
import { MessageType } from "@openfront/engine-api/game/GameTypes";
import { DOMESTIC_INTERVAL_TICKS } from "@openfront/engine-lib/domestic/Balance";
import { VICTORY_PROJECTS } from "@openfront/engine-lib/domestic/Victory";
import type { Game, Player, Unit } from "../game/Game";
import type { PlayerDomestic } from "./PlayerDomestic";

/** True while `player` runs a victory project that hasn't completed. */
export function hasActiveVictoryProject(player: Player): boolean {
  const p = player.domestic()?.victoryProject() ?? null;
  return p !== null && p.ticksLeft > 0;
}

/** The buildings hosting a running victory project, in players() order. */
export function victoryProjectHosts(mg: Game): Unit[] {
  const hosts: Unit[] = [];
  for (const player of mg.players()) {
    const p = player.domestic()?.victoryProject() ?? null;
    if (p === null || p.ticksLeft === 0) continue;
    const host = mg.unit(p.hostUnitId);
    if (host !== undefined && host.isActive() && host.owner() === player) {
      hosts.push(host);
    }
  }
  return hosts;
}

/** A victory-project message for every player, naming `player`. */
export function announceVictoryProject(
  mg: Game,
  player: Player,
  message: string,
  kind: VictoryProjectKind,
  unitId?: number,
): void {
  mg.displayMessage(
    message,
    MessageType.VICTORY_PROJECT,
    null,
    undefined,
    { name: player.displayName(), project: kind },
    unitId,
    player.id(),
  );
}

/**
 * One second of a player's victory project (spec §8.1): it fails for good
 * when its building is gone or has a new owner, the political project holds
 * while its owner attacks another nation, and everyone hears when it fails
 * or completes. A complete project stays at 0 ticks until WinCheckExecution
 * declares the winner. Runs right after processDomesticSecond, so `d`'s
 * conditions are this second's.
 */
export function processVictoryProjectSecond(
  mg: Game,
  player: Player,
  d: PlayerDomestic,
): void {
  const project = d.victoryProject();
  if (project === null || project.ticksLeft === 0) return;
  const host = mg.unit(project.hostUnitId);
  if (host === undefined || !host.isActive() || host.owner() !== player) {
    d.clearVictoryProject();
    announceVictoryProject(
      mg,
      player,
      "events_display.victory_project_failed",
      project.kind,
    );
    return;
  }
  // The "attacking" condition processDomesticSecond set for this second
  // (spec §7.1): another player is the target and the attack isn't retreating.
  const paused =
    VICTORY_PROJECTS[project.kind].pausesWhileAttacking &&
    d.activeConditions().has("attacking");
  d.advanceVictoryProject(DOMESTIC_INTERVAL_TICKS, paused);
  if (d.victoryProject()?.ticksLeft === 0) {
    announceVictoryProject(
      mg,
      player,
      "events_display.victory_project_complete",
      project.kind,
      host.id(),
    );
  }
}
```

- [ ] **Step 7: DomesticExecution에서 호출**

`packages/engine/src/domestic/DomesticExecution.ts`: `import { processVictoryProjectSecond } from "./VictoryProjects";`를 추가하고, `tick`의 `processDomesticSecond(this.mg, player, d);` 바로 뒤에 추가:

```ts
        processVictoryProjectSecond(this.mg, player, d);
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest tests/domestic tests/MessageTypeClasses.test.ts tests/core/snapshot --run && npm run typecheck`
Expected: 모두 PASS(VictoryProjectProgress 8 tests), typecheck 오류 없음

- [ ] **Step 9: 커밋**

```bash
npx prettier --write packages/engine/src/domestic packages/engine-api/src/game/GameTypes.ts src/client/Utils.ts tests/domestic
git add -A packages/engine/src/domestic packages/engine-api/src/game/GameTypes.ts src/client/Utils.ts tests/domestic
git commit -m "feat(domestic): victory project state, per-second progress and failure"
```

---

### Task 4: `start_victory_project` 명령

**Files:**
- Modify: `packages/engine-api/src/Schemas.ts` (인텐트 1개)
- Create: `packages/engine/src/domestic/VictoryProjectExecution.ts`
- Modify: `packages/engine/src/execution/ExecutionManager.ts`
- Modify: `packages/engine/src/snapshot/ExecutionRegistry.ts`
- Modify: `tests/core/snapshot/FullGameSnapshot.test.ts` (`neverStored`)
- Modify: `tests/zbin/wire.test.ts` (`SAMPLE_INTENTS`)
- Modify: `tests/domestic/util.ts` (`reachGovernmentTier3`)
- Test: `tests/domestic/VictoryProjectExecution.test.ts`

**Interfaces:**
- Consumes: Task 1의 `VICTORY_PROJECTS`, `projectQualified`, `victoryProjectBlock`; Task 3의 `beginVictoryProject`, `announceVictoryProject`, `processVictoryProjectSecond`; 2단계 `governmentTier()`, `refreshGovernmentTier()`(테스트 도우미만), `spendPoliticalMilli()`
- Produces:
  - 인텐트 `{ type: "start_victory_project"; kind: VictoryProjectKind; unitId: number }`, 타입 `StartVictoryProjectIntent`
  - `new VictoryProjectExecution(player: Player, kind: VictoryProjectKind, unitId: number)`
  - 테스트 유틸 `reachGovernmentTier3(player: Player): void`

> `src/server/IntentAuthorization.ts`는 고치지 않는다. 새 명령은 기본 경로를 타고, 실행은 보낸 사람(`clientID`로 찾은 플레이어)에게만 적용된다.

- [ ] **Step 1: 테스트 유틸 추가**

`tests/domestic/util.ts` 끝에 추가:

```ts
/**
 * Government tier 3 (spec §6.1): 3,500 cumulative political power. Phase 2
 * raises the stored tier in the per-second processing (refreshGovernmentTier
 * after addYield), so the helper takes that step itself instead of waiting
 * for a domestic second.
 */
export function reachGovernmentTier3(player: Player): void {
  const d = player.domestic();
  if (d === null) throw new Error("player has no domestic state");
  d.addYield(0, 3_500_000);
  d.refreshGovernmentTier();
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/domestic/VictoryProjectExecution.test.ts`:

```ts
import { VictoryProjectKind } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  MessageType,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { IntentSchema } from "@openfront/engine-api/Schemas";
import { vi } from "vitest";
import { VictoryProjectExecution } from "@openfront/engine/domestic/VictoryProjectExecution";
import { processVictoryProjectSecond } from "@openfront/engine/domestic/VictoryProjects";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { executeTicks } from "../util/utils";
import {
  buildLevel,
  conquerRect,
  domesticGame,
  grantTechs,
  HUMAN,
  reachGovernmentTier3,
} from "./util";

const RIVAL = new PlayerInfo("rival", PlayerType.Human, null, "rival_id");

async function twoPlayers(): Promise<{ game: Game; a: Player; b: Player }> {
  const game = await domesticGame({}, [HUMAN, RIVAL]);
  const a = game.player(HUMAN.id);
  const b = game.player(RIVAL.id);
  conquerRect(game, a, 0, 0, 50, 100);
  conquerRect(game, b, 50, 0, 50, 100);
  return { game, a, b };
}

function start(
  game: Game,
  player: Player,
  kind: VictoryProjectKind,
  unitId: number,
): void {
  game.addExecution(new VictoryProjectExecution(player, kind, unitId));
  executeTicks(game, 1);
}

describe("start_victory_project", () => {
  test("the space program costs 5M gold and is announced to everyone", async () => {
    const { game, a } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.ResearchInstitute, 5, 50, 3);
    grantTechs(a, "space_program");
    a.addGold(5_000_001n);
    const spy = vi.spyOn(game, "displayMessage");

    start(game, a, "science", host.id());

    expect(a.domestic()!.victoryProject()).toEqual({
      kind: "science",
      hostUnitId: host.id(),
      ticksLeft: 2400,
      totalTicks: 2400,
      paused: false,
    });
    expect(a.gold()).toBe(1n);
    expect(spy).toHaveBeenCalledWith(
      "events_display.victory_project_started",
      MessageType.VICTORY_PROJECT,
      null,
      undefined,
      { name: a.displayName(), project: "science" },
      host.id(),
      a.id(),
    );
  });

  test("world government costs 3M gold and 1,000 political power, never cumulative", async () => {
    const { game, a } = await twoPlayers();
    const host = buildLevel(game, a, UnitType.AdminOffice, 5, 50, 3);
    reachGovernmentTier3(a);
    a.addGold(3_000_000n);

    start(game, a, "political", host.id());

    const d = a.domestic()!;
    expect(d.victoryProject()?.kind).toBe("political");
    expect(a.gold()).toBe(0n);
    expect(d.politicalMilliAvailable()).toBe(2_500_000);
    expect(d.cumulativePoliticalMilli()).toBe(3_500_000);
  });

  test("refuses without the requirement, its own level 3 host or the gold", async () => {
    const { game, a, b } = await twoPlayers();
    const lv2 = buildLevel(game, a, UnitType.ResearchInstitute, 5, 20, 2);
    const lv3 = buildLevel(game, a, UnitType.ResearchInstitute, 5, 50, 3);
    const office = buildLevel(game, a, UnitType.AdminOffice, 5, 80, 3);
    const rivals = buildLevel(game, b, UnitType.ResearchInstitute, 80, 50, 3);
    a.addGold(5_000_000n);
    const refused = (kind: VictoryProjectKind, unitId: number, gold: bigint) => {
      start(game, a, kind, unitId);
      expect(a.domestic()!.victoryProject()).toBeNull();
      expect(a.gold()).toBe(gold);
    };

    refused("science", lv3.id(), 5_000_000n); // no space program yet
    grantTechs(a, "space_program");
    refused("science", lv2.id(), 5_000_000n); // level 2
    refused("science", office.id(), 5_000_000n); // wrong kind of building
    refused("science", rivals.id(), 5_000_000n); // someone else's
    refused("science", 999_999, 5_000_000n); // no such unit
    refused("political", office.id(), 5_000_000n); // not at tier 3
    a.removeGold(1n);
    refused("science", lv3.id(), 4_999_999n); // 1 gold short
  });

  test("one project at a time", async () => {
    const { game, a } = await twoPlayers();
    const lab = buildLevel(game, a, UnitType.ResearchInstitute, 5, 20, 3);
    const office = buildLevel(game, a, UnitType.AdminOffice, 5, 80, 3);
    grantTechs(a, "space_program");
    reachGovernmentTier3(a);
    a.addGold(8_000_000n);
    start(game, a, "science", lab.id());
    start(game, a, "political", office.id());
    expect(a.domestic()!.victoryProject()?.kind).toBe("science");
    expect(a.gold()).toBe(3_000_000n);
  });

  test("a failed project keeps its cost; restarting elsewhere pays again", async () => {
    const { game, a, b } = await twoPlayers();
    const first = buildLevel(game, a, UnitType.ResearchInstitute, 5, 20, 3);
    const second = buildLevel(game, a, UnitType.ResearchInstitute, 5, 80, 3);
    grantTechs(a, "space_program");
    a.addGold(10_000_000n);
    start(game, a, "science", first.id());

    b.captureUnit(first);
    processVictoryProjectSecond(game, a, a.domestic()!);
    expect(a.domestic()!.victoryProject()).toBeNull();
    expect(a.gold()).toBe(5_000_000n);

    start(game, a, "science", second.id());
    expect(a.domestic()!.victoryProject()?.hostUnitId).toBe(second.id());
    expect(a.gold()).toBe(0n);
  });

  test("does nothing outside domestic mode", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    const a = game.player(HUMAN.id);
    a.addGold(10_000_000n);
    start(game, a, "science", 1);
    expect(a.domestic()).toBeNull();
    expect(a.gold()).toBe(10_000_000n);
  });

  test("intents validate", () => {
    expect(
      IntentSchema.safeParse({
        type: "start_victory_project",
        kind: "science",
        unitId: 12,
      }).success,
    ).toBe(true);
    expect(
      IntentSchema.safeParse({
        type: "start_victory_project",
        kind: "magic",
        unitId: 12,
      }).success,
    ).toBe(false);
    expect(
      IntentSchema.safeParse({
        type: "start_victory_project",
        kind: "political",
        unitId: -1,
      }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest tests/domestic/VictoryProjectExecution.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine/domestic/VictoryProjectExecution'`

- [ ] **Step 4: 인텐트 스키마 추가**

`packages/engine-api/src/Schemas.ts`:
- `./domestic/DomesticTypes` import 목록(2단계의 `GOVERNMENT_IDS`, `LAW_IDS`, `LAW_OPTIONS`, `TECH_IDS`)에 `VICTORY_PROJECT_KINDS`를 추가한다.
- `Intent` 유니언 끝의 2단계 `| ChooseGovernmentIntent;`를 다음으로 바꾼다:

```ts
  | ChooseGovernmentIntent
  | StartVictoryProjectIntent;
```

- 2단계의 `export type ChooseGovernmentIntent = z.infer<...>;` 선언 바로 뒤에 추가:

```ts
export type StartVictoryProjectIntent = z.infer<
  typeof StartVictoryProjectIntentSchema
>;
```

- 2단계의 `ChooseGovernmentIntentSchema` 정의 바로 뒤에 추가:

```ts
// Domestic mode: start a victory project (spec §8.1) in one of the sender's
// own level 3+ research institutes / admin offices.
export const StartVictoryProjectIntentSchema = z.object({
  type: z.literal("start_victory_project"),
  kind: z.enum(VICTORY_PROJECT_KINDS),
  unitId: zb.uint(),
});
```

- `IntentSchema` 목록 끝의 2단계 `ChooseGovernmentIntentSchema,` 뒤에 `StartVictoryProjectIntentSchema,`를 추가한다.

- [ ] **Step 5: VictoryProjectExecution 작성**

`packages/engine/src/domestic/VictoryProjectExecution.ts`:

```ts
import {
  VICTORY_PROJECT_KINDS,
  VictoryProjectKind,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  projectQualified,
  VICTORY_PROJECTS,
  victoryProjectBlock,
} from "@openfront/engine-lib/domestic/Victory";
import { zInt, zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { announceVictoryProject } from "./VictoryProjects";

/** start_victory_project: pays for a victory project and starts it (spec §8.1). */
export class VictoryProjectExecution implements Execution {
  constructor(
    private player: Player,
    private kind: VictoryProjectKind,
    private unitId: number,
  ) {}

  init(mg: Game, _ticks: number): void {
    const d = this.player.domestic();
    if (d === null || !this.player.isAlive()) return;
    const def = VICTORY_PROJECTS[this.kind];
    const host = mg.unit(this.unitId);
    const hostLevel =
      host !== undefined &&
      host.isActive() &&
      host.owner() === this.player &&
      host.type() === def.hostType &&
      !host.isUnderConstruction()
        ? host.level()
        : null;
    const block = victoryProjectBlock(this.kind, {
      busy: d.victoryProject() !== null,
      qualified: projectQualified(
        this.kind,
        d.hasTech("space_program"),
        d.governmentTier(),
      ),
      hostLevel,
      gold: this.player.gold(),
      politicalMilli: d.politicalMilliAvailable(),
    });
    if (block !== null) return;

    this.player.removeGold(def.goldCost);
    if (def.politicalCostMilli > 0) {
      d.spendPoliticalMilli(def.politicalCostMilli);
    }
    d.beginVictoryProject(this.kind, this.unitId, def.ticks);
    announceVictoryProject(
      mg,
      this.player,
      "events_display.victory_project_started",
      this.kind,
      this.unitId,
    );
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return VictoryProjectExecutionSnapshot.write({
      player: w.player(this.player),
      kind: this.kind,
      unitId: this.unitId,
    });
  }

  restoreSnapshot(s: VictoryProjectState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.kind = s.kind;
    this.unitId = s.unitId;
  }
}

const VictoryProjectStateSchema = z.object({
  player: zPlayerRef(),
  kind: z.enum(VICTORY_PROJECT_KINDS),
  unitId: zInt(),
});
type VictoryProjectState = z.infer<typeof VictoryProjectStateSchema>;

export const VictoryProjectExecutionSnapshot = execSnapshotType({
  name: "VictoryProject",
  version: 1,
  schema: VictoryProjectStateSchema,
  cls: () => VictoryProjectExecution,
});
```

- [ ] **Step 6: 명령 연결과 등록**

`packages/engine/src/execution/ExecutionManager.ts`: `import { VictoryProjectExecution } from "../domestic/VictoryProjectExecution";`를 추가하고, `createExec` switch에서 2단계의 `case "choose_government":` 줄(`return new ChooseGovernmentExecution(player, intent.government);`) 바로 뒤에 추가:

```ts
      case "start_victory_project":
        return new VictoryProjectExecution(player, intent.kind, intent.unitId);
```

`packages/engine/src/snapshot/ExecutionRegistry.ts`: import 목록에 `import { VictoryProjectExecutionSnapshot } from "../domestic/VictoryProjectExecution";`를 추가하고, `EXECUTION_SNAPSHOT_TYPES`의 `UpgradeStructureExecutionSnapshot,` 뒤에 `VictoryProjectExecutionSnapshot,`를 추가한다(이름순).

`tests/core/snapshot/FullGameSnapshot.test.ts`의 "the game exercised every execution type" 테스트는 등록된 모든 실행이 원작 스크립트 게임에 나타나야 통과한다. 새 명령은 내정 모드에서만 오므로 `const neverStored = new Set([` 목록의 2단계 항목 `"ProclaimLaw",` 바로 뒤에 추가한다:

```ts
        "VictoryProject",
```

`tests/zbin/wire.test.ts`의 `SAMPLE_INTENTS` 배열 끝(2단계의 `{ type: "choose_government", clientID: P2, government: "communism" },` 뒤, `];` 앞)에 추가해서 새 인텐트가 바이너리 왕복 테스트를 거치게 한다:

```ts
  {
    type: "start_victory_project",
    clientID: P1,
    kind: "political",
    unitId: 88,
  },
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest tests/domestic tests/zbin tests/server tests/core/snapshot --run && npm run typecheck`
Expected: 모두 PASS(VictoryProjectExecution 7 tests, FullGameSnapshot의 "every execution type" 포함), typecheck 오류 없음

- [ ] **Step 8: 커밋**

```bash
npx prettier --write packages/engine-api/src/Schemas.ts packages/engine/src/domestic packages/engine/src/execution/ExecutionManager.ts packages/engine/src/snapshot/ExecutionRegistry.ts tests/core/snapshot/FullGameSnapshot.test.ts tests/zbin/wire.test.ts tests/domestic
git add -A packages tests/core/snapshot/FullGameSnapshot.test.ts tests/zbin/wire.test.ts tests/domestic
git commit -m "feat(domestic): start_victory_project intent"
```

---

### Task 5: 승리 판정과 승리 사유

**Files:**
- Modify: `packages/engine-api/src/game/GameUpdates.ts` (`WinUpdate.reason`)
- Modify: `packages/engine/src/game/Game.ts` (`setWinner` 시그니처)
- Modify: `packages/engine/src/game/GameImpl.ts` (`setWinner`)
- Create: `packages/engine/src/domestic/DomesticWinCheck.ts`
- Modify: `packages/engine/src/execution/WinCheckExecution.ts`
- Test: `tests/domestic/DomesticWinCheck.test.ts`

**Interfaces:**
- Consumes: Task 1의 `domesticScores`, `projectProgress`, `WinReason`; Task 2의 `Config.maxTimerMinutes()`, `percentageTilesOwnedToWin`; Task 3의 `victoryProject()`
- Produces:
  - `WinUpdate.reason?: WinReason`
  - `Game.setWinner(winner: Player | Team | null, allPlayersStats: AllPlayersStats, reason?: WinReason): void`
  - `interface DomesticWin { winner: Player | Team; reason: WinReason }`
  - `checkDomesticWin(mg: Game): DomesticWin | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/DomesticWinCheck.test.ts`:

```ts
import {
  GameMode,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  GameUpdateType,
  WinUpdate,
} from "@openfront/engine-api/game/GameUpdates";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { WinCheckExecution } from "@openfront/engine/execution/WinCheckExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { buildLevel, conquerRect, domesticGame } from "./util";

const ALICE = new PlayerInfo(
  "alice",
  PlayerType.Human,
  "client_alice",
  "alice_id",
);
const BOB = new PlayerInfo("bob", PlayerType.Human, "client_bob", "bob_id");
const FOUR = [1, 2, 3, 4].map(
  (n) =>
    new PlayerInfo(`player${n}`, PlayerType.Human, `client${n}`, `p${n}_id`),
);

function pair(game: Game): [Player, Player] {
  return [game.player(ALICE.id), game.player(BOB.id)];
}

function startWinCheck(game: Game): void {
  game.addExecution(new WinCheckExecution());
}

function tickWins(game: Game, ticks: number): WinUpdate[] {
  const wins: WinUpdate[] = [];
  for (let i = 0; i < ticks; i++) {
    wins.push(...game.executeNextTick()[GameUpdateType.Win]);
  }
  return wins;
}

describe("domestic victory", () => {
  test("a completed project wins, with its reason", async () => {
    const game = await domesticGame({}, [ALICE, BOB]);
    const [alice, bob] = pair(game);
    conquerRect(game, alice, 0, 0, 30, 100);
    conquerRect(game, bob, 30, 0, 60, 100);
    const host = buildLevel(game, alice, UnitType.ResearchInstitute, 5, 50, 3);
    alice.domestic()!.beginVictoryProject("science", host.id(), 20);
    game.addExecution(new DomesticExecution());
    startWinCheck(game);

    const wins = tickWins(game, 50);

    expect(wins).toHaveLength(1);
    expect(wins[0].winner).toEqual(["player", "client_alice"]);
    expect(wins[0].reason).toBe("science");
    expect(game.getWinner()).toBe(alice);
  });

  test("in team games a project wins for the team", async () => {
    const game = await domesticGame(
      { gameMode: GameMode.Team, playerTeams: 2 },
      FOUR,
    );
    const players = FOUR.map((i) => game.player(i.id));
    players.forEach((p, i) => conquerRect(game, p, i * 20, 0, 20, 100));
    const host = buildLevel(game, players[0], UnitType.AdminOffice, 5, 50, 3);
    players[0].domestic()!.beginVictoryProject("political", host.id(), 10);
    game.addExecution(new DomesticExecution());
    startWinCheck(game);

    const wins = tickWins(game, 40);

    expect(wins).toHaveLength(1);
    expect(wins[0].reason).toBe("political");
    expect(game.getWinner()).toBe(players[0].team());
  });

  test("conquest needs more than 70% of the land", async () => {
    const game = await domesticGame({}, [ALICE, BOB]);
    const [alice, bob] = pair(game);
    conquerRect(game, alice, 0, 0, 70, 100);
    conquerRect(game, bob, 70, 0, 30, 100);
    startWinCheck(game);
    expect(tickWins(game, 20)).toHaveLength(0);

    alice.conquer(game.ref(70, 0));
    const wins = tickWins(game, 20);

    expect(wins).toHaveLength(1);
    expect(wins[0].reason).toBe("conquest");
    expect(game.getWinner()).toBe(alice);
  });

  test("the lobby's conquestPercent applies", async () => {
    const game = await domesticGame({ conquestPercent: 60 }, [ALICE, BOB]);
    const [alice, bob] = pair(game);
    conquerRect(game, alice, 0, 0, 61, 100);
    conquerRect(game, bob, 61, 0, 39, 100);
    startWinCheck(game);

    const wins = tickWins(game, 20);

    expect(wins[0].reason).toBe("conquest");
    expect(game.getWinner()).toBe(alice);
  });

  test("at the time limit the score leader wins, not the land leader", async () => {
    const game = await domesticGame({ maxTimerValue: 1 }, [ALICE, BOB]);
    const [alice, bob] = pair(game);
    conquerRect(game, alice, 0, 0, 60, 100);
    conquerRect(game, bob, 60, 0, 10, 100);
    bob.domestic()!.addYield(1_000_000, 1_000_000);
    startWinCheck(game);

    expect(tickWins(game, 590)).toHaveLength(0);
    const wins = tickWins(game, 30);

    expect(wins).toHaveLength(1);
    expect(wins[0].reason).toBe("score");
    expect(game.getWinner()).toBe(bob);
  });

  test("score ties go to the side with more land", async () => {
    // alice: 40% land, 60% science; bob: 60% land, 40% science -> 25 : 25.
    const game = await domesticGame({ maxTimerValue: 1 }, [ALICE, BOB]);
    const [alice, bob] = pair(game);
    conquerRect(game, alice, 0, 0, 40, 100);
    conquerRect(game, bob, 40, 0, 60, 100);
    alice.domestic()!.addYield(600_000, 0);
    bob.domestic()!.addYield(400_000, 0);
    startWinCheck(game);

    const wins = tickWins(game, 620);

    expect(wins[0].reason).toBe("score");
    expect(game.getWinner()).toBe(bob);
  });

  test("team games compare summed scores", async () => {
    const game = await domesticGame(
      { gameMode: GameMode.Team, playerTeams: 2, maxTimerValue: 1 },
      FOUR,
    );
    const players = FOUR.map((i) => game.player(i.id));
    const red = players.filter((p) => p.team() === players[0].team());
    const blue = players.filter((p) => p.team() !== players[0].team());
    expect(red).toHaveLength(2);
    expect(blue).toHaveLength(2);
    // Red holds most of the land; blue produced all the science and politics.
    conquerRect(game, red[0], 0, 0, 30, 100);
    conquerRect(game, red[1], 30, 0, 30, 100);
    conquerRect(game, blue[0], 60, 0, 10, 100);
    conquerRect(game, blue[1], 70, 0, 10, 100);
    blue[0].domestic()!.addYield(500_000, 500_000);
    blue[1].domestic()!.addYield(500_000, 500_000);
    startWinCheck(game);

    const wins = tickWins(game, 620);

    expect(wins[0].reason).toBe("score");
    expect(game.getWinner()).toBe(blue[0].team());
  });

  test("vanilla wins carry no reason", async () => {
    const game = await setup("plains", {}, [ALICE, BOB]);
    const [alice, bob] = pair(game);
    conquerRect(game, alice, 0, 0, 81, 100);
    conquerRect(game, bob, 81, 0, 19, 100);
    startWinCheck(game);

    const wins = tickWins(game, 20);

    expect(wins).toHaveLength(1);
    expect("reason" in wins[0]).toBe(false);
    expect(game.getWinner()).toBe(alice);
  });

  test("vanilla still needs 80%", async () => {
    const game = await setup("plains", {}, [ALICE, BOB]);
    const [alice, bob] = pair(game);
    conquerRect(game, alice, 0, 0, 75, 100);
    conquerRect(game, bob, 75, 0, 25, 100);
    startWinCheck(game);
    expect(tickWins(game, 20)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/DomesticWinCheck.test.ts --run`
Expected: FAIL — 첫 테스트에서 `wins`가 비어 있음(내정 모드 판정이 아직 없음)

- [ ] **Step 3: 승리 업데이트와 setWinner**

`packages/engine-api/src/game/GameUpdates.ts`:
- `import type { DomesticData } from "../domestic/DomesticTypes";`를 `import type { DomesticData, WinReason } from "../domestic/DomesticTypes";`로 바꾼다(2단계는 이 파일의 `UnitUpdate`에 `constructionTicks`만 더하고 이 import는 그대로 둔다).
- `WinUpdate`의 `winner: Winner;` 뒤에 추가:

```ts
  /** Domestic mode: how the game was won. Absent in vanilla games. */
  reason?: WinReason;
```

`packages/engine/src/game/Game.ts`:
- import 추가: `import type { WinReason } from "@openfront/engine-api/domestic/DomesticTypes";`
- `setWinner` 선언을 다음으로 바꾼다:

```ts
  setWinner(
    winner: Player | Team | null,
    allPlayersStats: AllPlayersStats,
    reason?: WinReason,
  ): void;
```

`packages/engine/src/game/GameImpl.ts`:
- import 추가: `import type { WinReason } from "@openfront/engine-api/domestic/DomesticTypes";`
- `setWinner(` 메서드의 매개변수 목록 `allPlayersStats: AllPlayersStats,` 뒤에 `reason?: WinReason,`을 추가한다.
- 같은 메서드의 `this.addUpdate({ type: GameUpdateType.Win, ... })` 객체에서 `allPlayersStats,` 뒤에 추가한다. 원작에서는 키가 생기지 않는다:

```ts
      ...(reason === undefined ? {} : { reason }),
```

- [ ] **Step 4: 내정 모드 승자 판정 작성**

`packages/engine/src/domestic/DomesticWinCheck.ts`:

```ts
import { WinReason } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  ColoredTeams,
  GameMode,
  Team,
} from "@openfront/engine-api/game/GameTypes";
import {
  domesticScores,
  projectProgress,
  ScoreInput,
} from "@openfront/engine-lib/domestic/Score";
import type { Game, Player } from "../game/Game";

export interface DomesticWin {
  winner: Player | Team;
  reason: WinReason;
}

interface Side {
  winner: Player | Team;
  tiles: number;
  score: number;
}

const UNSCORED: ScoreInput = {
  scored: false,
  tiles: 0,
  science: 0,
  political: 0,
  gold: 0,
  projectProgress: 0,
};

/** Exact engine inputs: milli-points and gold earned. Bots have no domestic state. */
function scoreInput(p: Player): ScoreInput {
  const d = p.domestic();
  if (d === null) return UNSCORED;
  return {
    scored: true,
    tiles: p.numTilesOwned(),
    science: d.cumulativeScienceMilli(),
    political: d.cumulativePoliticalMilli(),
    gold: Number(p.goldEarned()),
    projectProgress: projectProgress(d.victoryProject()),
  };
}

/** One side per player (FFA) or per team, in players() order. The bot team never wins. */
function sides(players: readonly Player[], teams: boolean): Side[] {
  const scores = domesticScores(players.map(scoreInput));
  if (!teams) {
    return players.map((p, i) => ({
      winner: p,
      tiles: p.numTilesOwned(),
      score: scores[i].total,
    }));
  }
  const byTeam = new Map<Team, Side>();
  players.forEach((p, i) => {
    const team = p.team();
    if (team === null || team === ColoredTeams.Bot) return;
    const side = byTeam.get(team) ?? { winner: team, tiles: 0, score: 0 };
    side.tiles += p.numTilesOwned();
    side.score += scores[i].total;
    byTeam.set(team, side);
  });
  return [...byTeam.values()];
}

/**
 * Domestic-mode victory (spec §8), checked in this order: a completed
 * victory project (its owner, or its owner's team), conquest of more than
 * conquestPercent of the land, then at the time limit the highest score
 * (ties: more land, then the earlier side).
 */
export function checkDomesticWin(mg: Game): DomesticWin | null {
  const players = mg.players();
  if (players.length === 0) return null;
  const teams = mg.config().gameConfig().gameMode === GameMode.Team;

  for (const p of players) {
    const project = p.domestic()?.victoryProject() ?? null;
    if (project === null || project.ticksLeft > 0) continue;
    const team = p.team();
    return {
      winner: teams && team !== null ? team : p,
      reason: project.kind,
    };
  }

  const all = sides(players, teams);
  if (all.length === 0) return null;

  const elapsed = mg.elapsedGameSeconds();
  const land = mg.numLandTiles() - mg.numTilesWithFallout();
  const required = mg.config().percentageTilesOwnedToWin(elapsed);
  const byLand = [...all].sort((a, b) => b.tiles - a.tiles);
  // Cross-multiplied like the vanilla check: exact integer math.
  if (byLand[0].tiles * 100 > land * required) {
    return { winner: byLand[0].winner, reason: "conquest" };
  }

  // Never null in domestic mode (30 by default) and at most 120 minutes, so
  // the vanilla 170-minute hard limit can't come first.
  const limit = mg.config().maxTimerMinutes();
  if (limit !== null && elapsed >= limit * 60) {
    const byScore = [...all].sort(
      (a, b) => b.score - a.score || b.tiles - a.tiles,
    );
    return { winner: byScore[0].winner, reason: "score" };
  }
  return null;
}
```

- [ ] **Step 5: WinCheckExecution 연결**

`packages/engine/src/execution/WinCheckExecution.ts`: `import { checkDomesticWin } from "../domestic/DomesticWinCheck";`를 추가하고, `tick`의

```ts
    if (this.checkRankedTeamCancelled()) {
      return;
    }
```

바로 뒤에 추가한다. `config().domesticMode()`가 아니라 `gameConfig().domesticMode`를 읽는 이유: 기존 테스트가 `config()`를 `gameConfig`만 있는 가짜로 바꾸기 때문이다.

```ts
    // Domestic mode (this fork) has its own victory rules (spec §8).
    if (this.mg.config().gameConfig().domesticMode === true) {
      const win = checkDomesticWin(this.mg);
      if (win !== null) {
        this.mg.setWinner(win.winner, this.mg.stats().stats(), win.reason);
        const name =
          typeof win.winner === "string" ? win.winner : win.winner.name();
        console.log(`${name} has won the game (${win.reason})`);
        this.active = false;
      }
      return;
    }
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/domestic tests/core/executions/WinCheckExecution.test.ts tests/Ranked2v2Cancel.test.ts tests/core/WinnerReplay.test.ts --run && npm run typecheck`
Expected: 모두 PASS(DomesticWinCheck 9 tests), typecheck 오류 없음

- [ ] **Step 7: 커밋**

```bash
npx prettier --write packages/engine-api/src/game/GameUpdates.ts packages/engine/src/game/Game.ts packages/engine/src/game/GameImpl.ts packages/engine/src/domestic packages/engine/src/execution/WinCheckExecution.ts tests/domestic
git add -A packages tests/domestic
git commit -m "feat(domestic): project, conquest and score victories with a win reason"
```

---

### Task 6: AI 국가의 승리 프로젝트

**Files:**
- Create: `packages/engine/src/execution/nation/NationVictoryBehavior.ts`
- Modify: `packages/engine/src/execution/NationExecution.ts`
- Modify: `packages/engine/src/execution/nation/NationStructureBehavior.ts`
- Test: `tests/domestic/NationVictory.test.ts`, `tests/domestic/NationProjectSaving.test.ts`

**Interfaces:**
- Consumes: Task 1의 `VICTORY_PROJECTS`, `projectQualified`, `victoryProjectBlock`, `PROJECT_HOST_MIN_LEVEL`; Task 4의 `VictoryProjectExecution`; 2단계 `Personality`, `nationDomesticPlan`(`packages/engine/src/execution/nation/NationPersonality.ts`), `governmentTier()`
- Produces:
  - `nationProjectKind(difficulty: Difficulty, personality: Personality): VictoryProjectKind | null`
  - `nationProjectKindFor(mg: Game, player: Player): VictoryProjectKind | null`
  - `bestProjectHost(player: Player, kind: VictoryProjectKind): Unit | null`
  - `nationIsSavingForProject(player: Player, kind: VictoryProjectKind | null): boolean`
  - `nationVictoryTick(mg: Game, player: Player, kind: VictoryProjectKind | null): void`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/NationVictory.test.ts`:

```ts
import {
  Difficulty,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  nationIsSavingForProject,
  nationProjectKind,
  nationVictoryTick,
} from "@openfront/engine/execution/nation/NationVictoryBehavior";
import { Game, Player } from "@openfront/engine/game/Game";
import { executeTicks } from "../util/utils";
import {
  buildLevel,
  conquerRect,
  domesticGame,
  grantTechs,
  reachGovernmentTier3,
} from "./util";

const NATION = new PlayerInfo("nation", PlayerType.Nation, null, "nation_id");

async function hardNation(): Promise<{ game: Game; nation: Player }> {
  const game = await domesticGame({ difficulty: Difficulty.Hard });
  const nation = game.addPlayer(NATION);
  conquerRect(game, nation, 0, 0, 40, 40);
  return { game, nation };
}

describe("nation victory projects", () => {
  test("only Hard and Impossible scholars and zealots go for a project", () => {
    expect(nationProjectKind(Difficulty.Easy, "scholar")).toBeNull();
    expect(nationProjectKind(Difficulty.Medium, "zealot")).toBeNull();
    expect(nationProjectKind(Difficulty.Hard, "scholar")).toBe("science");
    expect(nationProjectKind(Difficulty.Impossible, "zealot")).toBe(
      "political",
    );
    expect(nationProjectKind(Difficulty.Impossible, "conqueror")).toBeNull();
    expect(nationProjectKind(Difficulty.Hard, "merchant")).toBeNull();
  });

  test("a ready scholar starts the space program", async () => {
    const { game, nation } = await hardNation();
    const host = buildLevel(game, nation, UnitType.ResearchInstitute, 10, 10, 3);
    grantTechs(nation, "space_program");
    nation.addGold(5_000_000n);

    nationVictoryTick(game, nation, "science");
    executeTicks(game, 1);

    expect(nation.domestic()!.victoryProject()?.hostUnitId).toBe(host.id());
    expect(nation.gold()).toBe(0n);
  });

  test("it raises its best host one level at a time first", async () => {
    const { game, nation } = await hardNation();
    const host = buildLevel(game, nation, UnitType.ResearchInstitute, 10, 10, 1);
    grantTechs(nation, "space_program");
    nation.addGold(2_000_000n);

    nationVictoryTick(game, nation, "science");
    executeTicks(game, 1);

    expect(host.level()).toBe(2);
    expect(nation.domestic()!.victoryProject()).toBeNull();
  });

  test("a zealot nation proclaims world government at tier 3", async () => {
    const { game, nation } = await hardNation();
    buildLevel(game, nation, UnitType.AdminOffice, 10, 10, 3);
    reachGovernmentTier3(nation);
    nation.addGold(3_000_000n);

    nationVictoryTick(game, nation, "political");
    executeTicks(game, 1);

    expect(nation.domestic()!.victoryProject()?.kind).toBe("political");
  });

  test("saves while qualified with a level 3 host, until the project starts", async () => {
    const { game, nation } = await hardNation();
    buildLevel(game, nation, UnitType.ResearchInstitute, 10, 10, 3);
    expect(nationIsSavingForProject(nation, "science")).toBe(false);
    grantTechs(nation, "space_program");
    expect(nationIsSavingForProject(nation, "science")).toBe(true);
    expect(nationIsSavingForProject(nation, null)).toBe(false);

    nationVictoryTick(game, nation, null);
    executeTicks(game, 1);
    expect(nation.domestic()!.victoryProject()).toBeNull();

    nation.addGold(5_000_000n);
    nationVictoryTick(game, nation, "science");
    executeTicks(game, 1);
    expect(nationIsSavingForProject(nation, "science")).toBe(false);
  });
});
```

`tests/domestic/NationProjectSaving.test.ts`:

```ts
import {
  Difficulty,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  nationDomesticPlan,
  Personality,
} from "@openfront/engine/execution/nation/NationPersonality";
import { NationStructureBehavior } from "@openfront/engine/execution/nation/NationStructureBehavior";
import { buildLevel, conquerRect, domesticGame, grantTechs } from "./util";

/**
 * A nation whose phase 2 personality is `personality`. Plans are fixed by
 * the player id, so the test picks an id instead of mocking the lookup.
 */
function nationWith(personality: Personality): PlayerInfo {
  for (let i = 0; i < 1000; i++) {
    const id = `nation_${i}`;
    if (nationDomesticPlan(id).personality === personality) {
      return new PlayerInfo("nation", PlayerType.Nation, null, id);
    }
  }
  throw new Error(`no ${personality} nation among the first 1000 ids`);
}

async function readyForTheSpaceProgram(personality: Personality) {
  const game = await domesticGame({ difficulty: Difficulty.Hard });
  const nation = game.addPlayer(nationWith(personality));
  conquerRect(game, nation, 0, 0, 60, 60);
  buildLevel(game, nation, UnitType.ResearchInstitute, 10, 10, 3);
  grantTechs(nation, "space_program");
  nation.addGold(1_000_000n);
  const behavior = new NationStructureBehavior(
    new PseudoRandom(7),
    game,
    nation,
  );
  return { nation, behavior };
}

describe("a nation saving for its victory project", () => {
  test("builds nothing while it saves", async () => {
    const { nation, behavior } = await readyForTheSpaceProgram("scholar");
    expect(behavior.handleStructures()).toBe(false);
    expect(nation.gold()).toBe(1_000_000n);
  });

  test("builds as usual when its personality goes for no project", async () => {
    const { behavior } = await readyForTheSpaceProgram("conqueror");
    expect(behavior.handleStructures()).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/NationVictory.test.ts tests/domestic/NationProjectSaving.test.ts --run`
Expected: FAIL — `Cannot find module '.../NationVictoryBehavior'`

- [ ] **Step 3: NationVictoryBehavior 작성**

`packages/engine/src/execution/nation/NationVictoryBehavior.ts`:

```ts
import { VictoryProjectKind } from "@openfront/engine-api/domestic/DomesticTypes";
import { Difficulty } from "@openfront/engine-api/game/GameTypes";
import { PROJECT_HOST_MIN_LEVEL } from "@openfront/engine-lib/domestic/Balance";
import {
  projectQualified,
  VICTORY_PROJECTS,
  victoryProjectBlock,
} from "@openfront/engine-lib/domestic/Victory";
import { VictoryProjectExecution } from "../../domestic/VictoryProjectExecution";
import { Game, Player, Unit } from "../../game/Game";
import { UpgradeStructureExecution } from "../UpgradeStructureExecution";
import { nationDomesticPlan, Personality } from "./NationPersonality";

/**
 * The victory project a nation goes for (spec §9.1, §9.3): scholars the
 * science one, zealots (the faithful) the political one, and only on Hard
 * and Impossible.
 */
export function nationProjectKind(
  difficulty: Difficulty,
  personality: Personality,
): VictoryProjectKind | null {
  if (difficulty !== Difficulty.Hard && difficulty !== Difficulty.Impossible) {
    return null;
  }
  switch (personality) {
    case "scholar":
      return "science";
    case "zealot":
      return "political";
    default:
      return null;
  }
}

/**
 * nationProjectKind for a live nation, by its phase 2 personality plan
 * (fixed by the player id); null right away outside domestic mode.
 */
export function nationProjectKindFor(
  mg: Game,
  player: Player,
): VictoryProjectKind | null {
  if (player.domestic() === null) return null;
  return nationProjectKind(
    mg.config().gameConfig().difficulty,
    nationDomesticPlan(player.id()).personality,
  );
}

/** The highest-level finished host building for `kind` (ties: the oldest). */
export function bestProjectHost(
  player: Player,
  kind: VictoryProjectKind,
): Unit | null {
  let best: Unit | null = null;
  for (const u of player.units(VICTORY_PROJECTS[kind].hostType)) {
    if (u.isUnderConstruction()) continue;
    if (best === null || u.level() > best.level()) best = u;
  }
  return best;
}

function qualified(player: Player, kind: VictoryProjectKind): boolean {
  const d = player.domestic();
  return (
    d !== null &&
    projectQualified(kind, d.hasTech("space_program"), d.governmentTier())
  );
}

/**
 * True while a nation going for `kind` has everything but the cost: it is
 * qualified, runs no project and owns a level 3+ host. NationStructureBehavior
 * builds nothing then, so the gold piles up for the project.
 */
export function nationIsSavingForProject(
  player: Player,
  kind: VictoryProjectKind | null,
): boolean {
  if (kind === null) return false;
  const d = player.domestic();
  if (d === null || d.victoryProject() !== null || !qualified(player, kind)) {
    return false;
  }
  const host = bestProjectHost(player, kind);
  return host !== null && host.level() >= PROJECT_HOST_MIN_LEVEL;
}

/**
 * One victory-project step for a nation going for `kind`, on its action
 * tick: raise its best host towards level 3 one level at a time, then start
 * the project once it can pay. Building the host in the first place is left
 * to NationStructureBehavior's domestic building ratios.
 */
export function nationVictoryTick(
  mg: Game,
  player: Player,
  kind: VictoryProjectKind | null,
): void {
  if (kind === null) return;
  const d = player.domestic();
  if (d === null || d.victoryProject() !== null || !qualified(player, kind)) {
    return;
  }
  const host = bestProjectHost(player, kind);
  if (host === null) return;
  if (host.level() < PROJECT_HOST_MIN_LEVEL) {
    if (player.canUpgradeUnit(host)) {
      mg.addExecution(new UpgradeStructureExecution(player, host.id(), 1));
    }
    return;
  }
  const block = victoryProjectBlock(kind, {
    busy: false,
    qualified: true,
    hostLevel: host.level(),
    gold: player.gold(),
    politicalMilli: d.politicalMilliAvailable(),
  });
  if (block === null) {
    mg.addExecution(new VictoryProjectExecution(player, kind, host.id()));
  }
}
```

- [ ] **Step 4: NationExecution에서 호출**

`packages/engine/src/execution/NationExecution.ts`: 다음 import를 추가한다.

```ts
import {
  nationProjectKindFor,
  nationVictoryTick,
} from "./nation/NationVictoryBehavior";
```

공격 틱 블록의 1단계 호출 `nationDomesticTick(this.mg, this.player);`(2단계도 그대로 둔다) **바로 앞**에 추가한다(법 선포보다 먼저 착수가 정치력을 쓰도록):

```ts
    nationVictoryTick(
      this.mg,
      this.player,
      nationProjectKindFor(this.mg, this.player),
    );
```

- [ ] **Step 5: 저축 중에는 짓지 않기**

`packages/engine/src/execution/nation/NationStructureBehavior.ts`(2단계가 `./NationPersonality` import와 `domesticRatios()`를 더한 파일): 다음 import를 추가한다.

```ts
import {
  nationIsSavingForProject,
  nationProjectKindFor,
} from "./NationVictoryBehavior";
```

`handleStructures()`에서 방어 기지 블록(`if (this.placementsCount > 0 && ...) { ... }`)이 끝난 바로 뒤, `if (this.isOnStructureCooldown()) {` 앞에 추가한다. 원작에서는 `player.domestic()`이 null이라 바로 false다:

```ts
    // Domestic mode: a Hard+ nation saving up for its victory project builds
    // nothing else until it can start it (spec §9.3).
    if (
      nationIsSavingForProject(
        this.player,
        nationProjectKindFor(this.game, this.player),
      )
    ) {
      return false;
    }
```

- [ ] **Step 6: 통과 확인(기존 AI 테스트 포함)**

Run: `npx vitest tests/domestic --run && npx vitest Nation AiAttackBehavior --run && npm run typecheck`
Expected: 모두 PASS(NationVictory 5 tests, NationProjectSaving 2 tests). 기존 Nation*·AiAttackBehavior 테스트는 모드 꺼짐이라 변화 없음

- [ ] **Step 7: 커밋**

```bash
npx prettier --write packages/engine/src/execution tests/domestic
git add -A packages tests/domestic
git commit -m "feat(domestic): Hard+ scholar and zealot nations pursue victory projects"
```

---

### Task 7: AI의 프로젝트 견제(공격과 핵)

**Files:**
- Modify: `packages/engine/src/execution/utils/AiAttackBehavior.ts`
- Modify: `packages/engine/src/execution/nation/NationNukeBehavior.ts`
- Test: `tests/domestic/NationProjectCounter.test.ts`

**Interfaces:**
- Consumes: Task 3의 `hasActiveVictoryProject`, `victoryProjectHosts`
- Produces: 어려움·불가능 공격 전략 목록 맨 앞의 `project` 전략(내정 모드만), `NationNukeBehavior.nukeVictoryProjectHost(): boolean`(private)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/NationProjectCounter.test.ts`:

```ts
import {
  Difficulty,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { vi } from "vitest";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { NationAllianceBehavior } from "@openfront/engine/execution/nation/NationAllianceBehavior";
import { NationEmojiBehavior } from "@openfront/engine/execution/nation/NationEmojiBehavior";
import { NationNukeBehavior } from "@openfront/engine/execution/nation/NationNukeBehavior";
import { AiAttackBehavior } from "@openfront/engine/execution/utils/AiAttackBehavior";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { buildLevel, conquerRect, grantTechs } from "./util";

const RUNNER = new PlayerInfo("runner", PlayerType.Human, null, "runner_id");
const NATION = new PlayerInfo("nation", PlayerType.Nation, null, "nation_id");
const WEAK = new PlayerInfo("weak", PlayerType.Human, null, "weak_id");

/** Full-height stripes, left to right: runner | nation | weak. */
async function stripes(difficulty: Difficulty) {
  const game = await setup(
    "plains",
    { difficulty, domesticMode: true },
    [RUNNER, NATION, WEAK],
  );
  const [runner, nation, weak] = [RUNNER, NATION, WEAK].map((i) =>
    game.player(i.id),
  );
  conquerRect(game, runner, 0, 0, 30, 100);
  conquerRect(game, nation, 30, 0, 30, 100);
  conquerRect(game, weak, 60, 0, 40, 100);
  const emoji = new NationEmojiBehavior(new PseudoRandom(42), game, nation);
  const alliance = new NationAllianceBehavior(
    new PseudoRandom(42),
    game,
    nation,
    emoji,
  );
  const attack = new AiAttackBehavior(
    new PseudoRandom(42),
    game,
    nation,
    0.5, // triggerRatio
    0.3, // reserveRatio
    0.2, // expandRatio
    alliance,
    emoji,
  );
  return { game, runner, nation, weak, emoji, attack };
}

/** The nation well above its trigger ratio, the runner a bit weaker, weak very weak. */
function setTroops(game: Game, nation: Player, runner: Player, weak: Player) {
  nation.setTroops(Math.floor(game.config().maxTroops(nation) * 0.7));
  runner.setTroops(Math.floor(nation.troops() * 0.8));
  weak.setTroops(1000);
}

function startProject(game: Game, runner: Player) {
  const host = buildLevel(game, runner, UnitType.ResearchInstitute, 5, 50, 3);
  runner.domestic()!.beginVictoryProject("science", host.id(), 2400);
  return host;
}

function attacksOn(spy: { mock: { calls: unknown[][] } }, target: Player) {
  return spy.mock.calls
    .map((c) => c[0])
    .filter(
      (e): e is AttackExecution =>
        e instanceof AttackExecution && e.targetID() === target.id(),
    );
}

describe("nations counter victory projects", () => {
  test.each([Difficulty.Hard, Difficulty.Impossible])(
    "%s: attacks the project owner first",
    async (difficulty) => {
      const { game, runner, nation, weak, attack } = await stripes(difficulty);
      setTroops(game, nation, runner, weak);
      startProject(game, runner);

      const spy = vi.spyOn(game, "addExecution");
      attack.maybeAttack();

      expect(attacksOn(spy, runner).length).toBeGreaterThan(0);
      expect(attacksOn(spy, weak)).toHaveLength(0);
    },
  );

  test("Hard: without a project it goes for the very weak neighbor", async () => {
    const { game, runner, nation, weak, attack } = await stripes(
      Difficulty.Hard,
    );
    setTroops(game, nation, runner, weak);

    const spy = vi.spyOn(game, "addExecution");
    attack.maybeAttack();

    expect(attacksOn(spy, weak).length).toBeGreaterThan(0);
    expect(attacksOn(spy, runner)).toHaveLength(0);
  });

  test("Medium nations don't single out the project owner", async () => {
    const { game, runner, nation, weak, attack } = await stripes(
      Difficulty.Medium,
    );
    setTroops(game, nation, runner, weak);
    startProject(game, runner);

    const spy = vi.spyOn(game, "addExecution");
    attack.maybeAttack();

    expect(attacksOn(spy, runner)).toHaveLength(0);
  });

  function nukeBehavior(
    game: Game,
    nation: Player,
    attack: AiAttackBehavior,
    emoji: NationEmojiBehavior,
  ) {
    nation.buildUnit(UnitType.MissileSilo, game.ref(45, 50), {});
    grantTechs(nation, "rocketry", "manhattan_project");
    nation.addGold(10_000_000n);
    return new NationNukeBehavior(
      new PseudoRandom(2),
      game,
      nation,
      attack,
      emoji,
    );
  }

  test("Hard: nukes the project building", async () => {
    const { game, runner, nation, attack, emoji } = await stripes(
      Difficulty.Hard,
    );
    const host = startProject(game, runner);

    nukeBehavior(game, nation, attack, emoji).maybeSendNuke();
    // First tick initializes the NukeExecution, the second launches the bomb
    game.executeNextTick();
    game.executeNextTick();

    const nukes = nation.units(UnitType.AtomBomb);
    expect(nukes).toHaveLength(1);
    expect(nukes[0].targetTile()).toBe(host.tile());
  });

  test("never nukes an ally's project building", async () => {
    const { game, runner, nation, attack, emoji } = await stripes(
      Difficulty.Hard,
    );
    const host = startProject(game, runner);
    nation.createAllianceRequest(runner)?.accept();
    expect(nation.isAlliedWith(runner)).toBe(true);

    nukeBehavior(game, nation, attack, emoji).maybeSendNuke();
    game.executeNextTick();
    game.executeNextTick();

    expect(
      nation
        .units(UnitType.AtomBomb)
        .filter((n) => n.targetTile() === host.tile()),
    ).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/NationProjectCounter.test.ts --run`
Expected: FAIL — "attacks the project owner first"에서 `weak`을 공격함, "nukes the project building"에서 핵이 0개이거나 다른 타일을 노림

- [ ] **Step 3: 공격 전략 추가**

`packages/engine/src/execution/utils/AiAttackBehavior.ts`:
- import 추가: `import { hasActiveVictoryProject } from "../../domestic/VictoryProjects";`
- `getAttackStrategies`에서 `const crown = (): boolean => { ... };` 정의 바로 뒤에 추가:

```ts
    // Domestic mode (spec §9.4): whoever runs a victory project we can reach
    // is the first target of Hard & Impossible nations. Off in vanilla, where
    // the strategy lists below stay exactly as they were.
    const project = (): boolean => {
      const owner = pick(
        (enemies) =>
          enemies.find((enemy) => hasActiveVictoryProject(enemy)) ?? null,
      );
      return owner !== null ? this.sendAttack(owner) : false;
    };
    const projectFirst = this.game.config().domesticMode() ? [project] : [];
```

- 같은 메서드 끝 switch의 Hard·Impossible 줄을 다음으로 바꾼다(`// prettier-ignore` 주석은 그대로 둔다):

```ts
      case Difficulty.Hard:
        // Strong veryWeak and juicy strats after the distracting hated strat, to make the nations weaker than impossible
        // prettier-ignore
        return [...projectFirst, bots, assist, betray, nuked, traitor, afk, hated, veryWeak, juicy, victim, crown, weakest, island, donate];
      case Difficulty.Impossible:
        // prettier-ignore
        return [...projectFirst, bots, veryWeak, betray, assist, victim, crown, traitor, juicy, afk, nuked, hated, weakest, island, donate];
```

- [ ] **Step 4: 핵 우선 목표 추가**

`packages/engine/src/execution/nation/NationNukeBehavior.ts`:
- import 추가: `import { victoryProjectHosts } from "../../domestic/VictoryProjects";` (`Difficulty`는 이미 import되어 있다)
- `maybeSendNuke()` 맨 위의 가용성 검사 블록(사일로가 없거나 핵을 쓸 수 없으면 `return;`하는 `if`) 바로 뒤에 추가:

```ts
    // Domestic mode (spec §9.4): Hard & Impossible nuke a victory project's
    // building before anything else.
    if (this.nukeVictoryProjectHost()) {
      return;
    }
```

- `nukeTypesToTry` 메서드 바로 앞에 추가:

```ts
  /** Nukes the first enemy victory-project building we can hit; true if a nuke was sent. */
  private nukeVictoryProjectHost(): boolean {
    const config = this.game.config();
    const { difficulty } = config.gameConfig();
    if (
      !config.domesticMode() ||
      (difficulty !== Difficulty.Hard && difficulty !== Difficulty.Impossible)
    ) {
      return false;
    }
    for (const host of victoryProjectHosts(this.game)) {
      const owner = host.owner();
      if (owner === this.player || this.player.isFriendly(owner, true)) {
        continue;
      }
      const tile = host.tile();
      for (const nukeType of this.nukeTypesToTry(false)) {
        if (this.isNukeAlreadyLandingNear(tile, nukeType)) continue;
        if (this.blastHitsFriendlyLand(tile, nukeType)) continue;
        if (this.player.canBuild(nukeType, tile) === false) continue;
        this.sendNuke(tile, nukeType, owner);
        return true;
      }
    }
    return false;
  }
```

- [ ] **Step 5: 통과 확인(기존 AI 테스트 포함)**

Run: `npx vitest tests/domestic --run && npx vitest Nation AiAttackBehavior --run && npm run typecheck`
Expected: 모두 PASS(NationProjectCounter 6 tests). 기존 AI 테스트는 바뀌지 않는다(원작에서 `projectFirst`는 빈 배열이고 핵 분기는 바로 false)

- [ ] **Step 6: 커밋**

```bash
npx prettier --write packages/engine/src/execution tests/domestic
git add -A packages tests/domestic
git commit -m "feat(domestic): Hard+ nations attack and nuke victory project hosts"
```

---

### Task 8: 번역(en, ko)

**Files:**
- Modify: `resources/lang/en.json`, `resources/lang/ko.json`(jq로 병합)
- Test: `tests/domestic/VictoryI18n.test.ts`

**Interfaces:**
- Produces(이후 Task가 쓰는 키): `domestic.project.<kind>.name|desc`, `domestic.tab_victory`, `domestic.victory.*`, `domestic.victory.blocked.<ProjectBlock>`, `domestic.win_reason.<WinReason>`, `events_display.victory_project_started|failed|complete`(`{name}`, `{project}`), `game_settings.conquest_percent`, `leaderboard.score`; 1단계 `domestic.tech.space_program.desc` 갱신

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/VictoryI18n.test.ts`:

```ts
import {
  VICTORY_PROJECT_KINDS,
  WIN_REASONS,
} from "@openfront/engine-api/domestic/DomesticTypes";
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
  "domestic.tab_victory",
  "domestic.victory.active",
  "domestic.victory.conquest",
  "domestic.victory.cost_political",
  "domestic.victory.cost_science",
  "domestic.victory.host_level",
  "domestic.victory.no_hosts",
  "domestic.victory.none_active",
  "domestic.victory.paused",
  "domestic.victory.progress",
  "domestic.victory.requirement_political",
  "domestic.victory.requirement_science",
  "domestic.victory.score",
  "domestic.victory.start",
  "domestic.victory.time_left",
  "events_display.victory_project_complete",
  "events_display.victory_project_failed",
  "events_display.victory_project_started",
  "game_settings.conquest_percent",
  "leaderboard.score",
];
const BLOCKS = ["busy", "requirement", "host", "gold", "political"];

describe("domestic victory translations", () => {
  test.each(["en", "ko"])("%s has every victory key", (lang) => {
    const json = load(lang);
    for (const key of KEYS) {
      expect(typeof get(json, key), key).toBe("string");
    }
    for (const kind of VICTORY_PROJECT_KINDS) {
      expect(typeof get(json, `domestic.project.${kind}.name`), kind).toBe(
        "string",
      );
      expect(typeof get(json, `domestic.project.${kind}.desc`), kind).toBe(
        "string",
      );
    }
    for (const reason of WIN_REASONS) {
      expect(typeof get(json, `domestic.win_reason.${reason}`), reason).toBe(
        "string",
      );
    }
    for (const block of BLOCKS) {
      expect(
        typeof get(json, `domestic.victory.blocked.${block}`),
        block,
      ).toBe("string");
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/VictoryI18n.test.ts --run`
Expected: FAIL — `domestic.tab_victory: expected 'undefined' to be 'string'`

- [ ] **Step 3: 영어 조각 작성**

```bash
mkdir -p .i18n-domestic
cat > .i18n-domestic/en.json <<'EOF'
{
  "domestic": {
    "project": {
      "political": {
        "desc": "Proclaim a world government from a level 3+ admin office. Pauses while you attack another nation.",
        "name": "World Government"
      },
      "science": {
        "desc": "Launch the space program from a level 3+ research institute.",
        "name": "Space Program"
      }
    },
    "tab_victory": "Victory",
    "tech": {
      "space_program": { "desc": "Enables the Space Program (science victory)" }
    },
    "victory": {
      "active": "Projects in progress",
      "blocked": {
        "busy": "Another project is in progress",
        "gold": "Not enough gold",
        "host": "Needs a level 3+ building",
        "political": "Not enough political power",
        "requirement": "Requirement not met"
      },
      "conquest": "Conquest: {pct} of the land (wins above {target}%)",
      "cost_political": "Costs {gold} gold and {political} political power · 4 min",
      "cost_science": "Costs {gold} gold · 4 min",
      "host_level": "{building} Lv. {level}",
      "no_hosts": "No level 3+ building yet",
      "none_active": "No projects in progress",
      "paused": "(paused: attacking)",
      "progress": "{name}: {project} {pct}%",
      "requirement_political": "Requires government tier 3",
      "requirement_science": "Requires the Space Program tech",
      "score": "Score: {score} (#{rank} of {count})",
      "start": "Start",
      "time_left": "Time left: {time}"
    },
    "win_reason": {
      "conquest": "Victory by conquest",
      "political": "Political victory: world government",
      "science": "Science victory: space program",
      "score": "Victory on score"
    }
  },
  "events_display": {
    "victory_project_complete": "{name} completed the {project}!",
    "victory_project_failed": "{name}'s {project} failed",
    "victory_project_started": "{name} started the {project}! Capture or destroy its building to stop it."
  },
  "game_settings": {
    "conquest_percent": "Conquest %"
  },
  "leaderboard": {
    "score": "Score"
  }
}
EOF
```

- [ ] **Step 4: 한국어 조각 작성**

```bash
cat > .i18n-domestic/ko.json <<'EOF'
{
  "domestic": {
    "project": {
      "political": {
        "desc": "레벨 3 이상 행정청에서 세계 정부를 선포합니다. 다른 나라를 공격하는 동안에는 멈춥니다.",
        "name": "세계 정부 선포"
      },
      "science": {
        "desc": "레벨 3 이상 연구소에서 우주 계획을 진행합니다.",
        "name": "우주 계획"
      }
    },
    "tab_victory": "승리",
    "tech": {
      "space_program": { "desc": "우주 계획 착수 가능 (과학 승리)" }
    },
    "victory": {
      "active": "진행 중인 프로젝트",
      "blocked": {
        "busy": "다른 프로젝트가 진행 중입니다",
        "gold": "금이 부족합니다",
        "host": "레벨 3 이상 건물이 필요합니다",
        "political": "정치력이 부족합니다",
        "requirement": "조건을 채우지 못했습니다"
      },
      "conquest": "정복: 땅 {pct} 점유 ({target}% 초과 시 승리)",
      "cost_political": "금 {gold} + 정치력 {political} · 4분",
      "cost_science": "금 {gold} · 4분",
      "host_level": "{building} Lv. {level}",
      "no_hosts": "레벨 3 이상 건물이 아직 없습니다",
      "none_active": "진행 중인 프로젝트가 없습니다",
      "paused": "(일시 정지: 공격 중)",
      "progress": "{name}: {project} {pct}%",
      "requirement_political": "정부 3단계 필요",
      "requirement_science": "우주 개발 기술 필요",
      "score": "점수: {score} ({count}명 중 {rank}위)",
      "start": "착수",
      "time_left": "남은 시간: {time}"
    },
    "win_reason": {
      "conquest": "정복 승리",
      "political": "정치 승리: 세계 정부 선포",
      "science": "과학 승리: 우주 계획",
      "score": "점수 승리"
    }
  },
  "events_display": {
    "victory_project_complete": "{name}이(가) {project}을(를) 완성했습니다!",
    "victory_project_failed": "{name}의 {project}이(가) 실패했습니다",
    "victory_project_started": "{name}이(가) {project}에 착수했습니다! 건물을 빼앗거나 파괴하면 막을 수 있습니다."
  },
  "game_settings": {
    "conquest_percent": "정복 기준 %"
  },
  "leaderboard": {
    "score": "점수"
  }
}
EOF
```

- [ ] **Step 5: 병합**

en.json은 키 정렬을 유지해야 하므로 `jq -S`로 병합하고, ko.json은 순서를 건드리지 않고 병합한다(1단계와 같은 방법).

```bash
jq -S --slurpfile frag .i18n-domestic/en.json '. * $frag[0]' resources/lang/en.json > .i18n-domestic/en.out && mv .i18n-domestic/en.out resources/lang/en.json
jq --slurpfile frag .i18n-domestic/ko.json '. * $frag[0]' resources/lang/ko.json > .i18n-domestic/ko.out && mv .i18n-domestic/ko.out resources/lang/ko.json
rm -rf .i18n-domestic
npx prettier --write resources/lang/en.json resources/lang/ko.json
git diff --stat resources/lang
```

Expected: en.json, ko.json에 추가와 `space_program.desc` 한 줄 변경만 있다.

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/domestic/VictoryI18n.test.ts tests/domestic/I18n.test.ts tests/EnJsonSorted.test.ts tests/TranslationSystem.test.ts --run`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add resources/lang/en.json resources/lang/ko.json tests/domestic/VictoryI18n.test.ts
git commit -m "feat(domestic): English and Korean strings for victory"
```

---

### Task 9: 명령 이벤트, 이벤트 문구, 승리 화면 사유

**Files:**
- Modify: `src/client/Transport.ts`
- Modify: `src/client/hud/layers/EventsDisplay.ts`
- Modify: `src/client/hud/layers/WinModal.ts`
- Test: `tests/client/DomesticWinModal.test.ts`

**Interfaces:**
- Consumes: Task 4의 인텐트, Task 5의 `WinUpdate.reason`, Task 8의 키
- Produces: `class StartVictoryProjectIntentEvent { constructor(kind: VictoryProjectKind, unitId: number) }`, 승리 화면의 `[data-win-reason]` 문단

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/DomesticWinModal.test.ts`:

```ts
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCosmetics } from "../../src/client/Cosmetics";
import "../../src/client/hud/layers/WinModal";
import type { WinModal } from "../../src/client/hud/layers/WinModal";
import type { GameView } from "../../src/client/view";

vi.mock("../../src/client/Utils", () => ({
  translateText: vi.fn((key: string) => key),
  getTranslatedPlayerTeamLabel: vi.fn((team: string | null) => team ?? ""),
  getGamesPlayed: vi.fn(() => 10),
  isInIframe: vi.fn(() => false),
  homeHref: vi.fn(() => "/"),
  TUTORIAL_VIDEO_URL: "https://example.com/tutorial",
}));

vi.mock("../../src/client/Api", () => ({
  getUserMe: vi.fn(async () => null),
}));

vi.mock("../../src/client/Cosmetics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Cosmetics")>()),
  fetchCosmetics: vi.fn(async () => null),
  resolveCosmetics: vi.fn(() => []),
}));

vi.mock("../../src/client/GamePortal", () => ({
  gamePortal: {
    happytime: vi.fn(),
    gameplayStop: vi.fn(),
  },
}));

function makeGame(reason: string | undefined): GameView {
  const winUpdate = {
    winner: ["team", "Blue"],
    allPlayersStats: {},
    ...(reason === undefined ? {} : { reason }),
  };
  return {
    myPlayer: () => ({
      isAlive: () => true,
      hasSpawned: () => true,
      team: () => "Blue",
      clientID: () => null,
    }),
    inSpawnPhase: () => false,
    updatesSinceLastTick: () => ({ [GameUpdateType.Win]: [winUpdate] }),
    playerByClientID: () => undefined,
    config: () => ({
      gameConfig: () => ({ rankedType: undefined }),
      isReplay: () => false,
    }),
  } as unknown as GameView;
}

describe("WinModal win reason", () => {
  let modal: WinModal | undefined;

  function open(game: GameView): WinModal {
    // A visible modal activates steam-wishlist, which observes its own size;
    // jsdom has no ResizeObserver.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.mocked(fetchCosmetics).mockReturnValueOnce(new Promise(() => {}));
    const m = document.createElement("win-modal") as WinModal;
    m.game = game;
    m.eventBus = new EventBus();
    document.body.appendChild(m);
    m.tick();
    return m;
  }

  afterEach(() => {
    modal?.remove();
    modal = undefined;
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows why the game was won", async () => {
    modal = open(makeGame("science"));
    await vi.waitFor(() =>
      expect(
        modal!.querySelector("[data-win-reason]")?.textContent?.trim(),
      ).toBe("domestic.win_reason.science"),
    );
  });

  it("shows no reason for vanilla wins", async () => {
    modal = open(makeGame(undefined));
    await vi.waitFor(() => expect(modal!.isVisible).toBe(true));
    await modal.updateComplete;
    expect(modal.querySelector("[data-win-reason]")).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/DomesticWinModal.test.ts --run`
Expected: FAIL — "shows why the game was won"이 시간 초과(`[data-win-reason]` 없음)

- [ ] **Step 3: 승리 화면에 사유 표시**

`src/client/hud/layers/WinModal.ts`:
- `private _title: string;` 뒤에 추가:

```ts
  /** Domestic mode: why the game was won; empty otherwise. */
  private _reason = "";
```

- `render()`의 제목 블록

```ts
        <h2 class="m-0 mb-4 text-[26px] text-center text-white shrink-0">
          ${this._title || ""}
        </h2>
```

바로 뒤에 추가:

```ts
        ${this._reason
          ? html`<p
              class="m-0 mb-3 text-center text-base text-amber-300 shrink-0"
              data-win-reason
            >
              ${this._reason}
            </p>`
          : ""}
```

- `tick()`의 `winUpdates.forEach((wu) => {` 바로 다음 줄(첫 문장)로 추가:

```ts
      this._reason =
        wu.reason === undefined
          ? ""
          : translateText(`domestic.win_reason.${wu.reason}`);
```

- [ ] **Step 4: 명령 이벤트**

`src/client/Transport.ts`:
- `@openfront/engine-api/domestic/DomesticTypes` import 목록(2단계의 `GovernmentId`, `LawId`, `LawOption`, `TechId`)에 `VictoryProjectKind`를 추가한다.
- 2단계 `ChooseGovernmentIntentEvent` 클래스 뒤에 추가:

```ts
export class StartVictoryProjectIntentEvent implements GameEvent {
  constructor(
    public readonly kind: VictoryProjectKind,
    public readonly unitId: number,
  ) {}
}
```

- 구독 블록의 2단계 `this.subscribe(ChooseGovernmentIntentEvent, ...)` 호출 뒤에 추가:

```ts
    this.subscribe(StartVictoryProjectIntentEvent, (e) =>
      this.onStartVictoryProjectIntent(e),
    );
```

- 2단계 `onChooseGovernmentIntent` 메서드 뒤에 추가:

```ts
  private onStartVictoryProjectIntent(event: StartVictoryProjectIntentEvent) {
    this.sendIntent({
      type: "start_victory_project",
      kind: event.kind,
      unitId: event.unitId,
    });
  }
```

- [ ] **Step 5: 이벤트 문구의 프로젝트 이름 번역**

`src/client/hud/layers/EventsDisplay.ts`의 `resolveParams`에서 1단계가 넣은 `events_display.research_complete` 블록 바로 뒤에 추가:

```ts
    if (
      event.message.startsWith("events_display.victory_project_") &&
      typeof params.project === "string"
    ) {
      params = {
        ...params,
        project: translateText(`domestic.project.${params.project}.name`),
      };
    }
```

(`name`은 엔진이 `focusPlayerID`를 함께 보내므로 아래의 기존 코드가 익명 이름 설정에 맞춰 다시 고친다.)

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/client/DomesticWinModal.test.ts tests/client/graphics/layers --run && npm run typecheck`
Expected: 모두 PASS(DomesticWinModal 2 tests), typecheck 오류 없음

- [ ] **Step 7: 커밋**

```bash
npx prettier --write src/client/Transport.ts src/client/hud/layers/EventsDisplay.ts src/client/hud/layers/WinModal.ts tests/client/DomesticWinModal.test.ts
git add src/client/Transport.ts src/client/hud/layers/EventsDisplay.ts src/client/hud/layers/WinModal.ts tests/client/DomesticWinModal.test.ts
git commit -m "feat(domestic): win reason on the win screen, project intent and messages"
```

---

### Task 10: 순위표 점수 열

**Files:**
- Create: `src/client/view/DomesticScores.ts`
- Modify: `src/client/StatsConstants.ts` (`COLUMN_IDS`)
- Modify: `src/client/hud/layers/lib/StatsColumns.ts` (`ColumnDef.domesticOnly`, 점수 열)
- Modify: `src/client/components/StatsTable.ts` (`domesticMode` 속성, `visibleColumns`)
- Modify: `src/client/hud/layers/GameLeftSidebar.ts`
- Test: `tests/client/DomesticScoreColumn.test.ts`

**Interfaces:**
- Consumes: Task 1의 `domesticScores`, `projectProgress`; 1단계 `PlayerView.domesticData()`
- Produces:
  - `scoreInputOf(player: PlayerView): ScoreInput | null`
  - `domesticScoreMap(game: GameView): ReadonlyMap<number, ScoreBreakdown>`(키는 smallID, 점수 대상만)
  - `domesticScoreOf(player: PlayerView, game: GameView): number`
  - `ColumnId`에 `"score"`, `ColumnDef.domesticOnly?: true`, `StatsTable.domesticMode: boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/DomesticScoreColumn.test.ts`:

```ts
import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { PlayerStats } from "../../src/client/hud/layers/PlayerStats";
import { columnById } from "../../src/client/hud/layers/lib/StatsColumns";
import { UserSettings } from "../../src/client/UserSettings";
import type { GameView, PlayerView } from "../../src/client/view";
import { domesticScoreMap } from "../../src/client/view/DomesticScores";

interface Stub {
  tiles: number;
  science?: number;
  political?: number;
  gold?: number;
  type?: PlayerType;
  domestic?: boolean;
}

function player(id: number, s: Stub): PlayerView {
  const data =
    s.domestic === false
      ? null
      : ({
          cumulativeScience: s.science ?? 0,
          cumulativePolitical: s.political ?? 0,
        } as DomesticData);
  return {
    id: () => `p${id}`,
    smallID: () => id,
    name: () => `p${id}`,
    displayName: () => `p${id}`,
    clanTag: () => null,
    type: () => s.type ?? PlayerType.Human,
    numTilesOwned: () => s.tiles,
    gold: () => 0n,
    tradeGold: () => 0,
    trainGold: () => 0,
    piracyGold: () => 0,
    goldEarned: () => s.gold ?? 0,
    troops: () => 0,
    totalUnitLevels: () => 0,
    isAlive: () => true,
    isOnSameTeam: () => false,
    domesticData: () => data,
  } as unknown as PlayerView;
}

function game(players: PlayerView[]): GameView {
  return {
    myPlayer: () => players[0],
    playerViews: () => players,
    config: () => ({ maxTroops: () => 100 }),
    ticks: () => 600,
    numLandTiles: () => 1000,
    numTilesWithFallout: () => 0,
  } as unknown as GameView;
}

const A = () => player(1, { tiles: 300, science: 100, gold: 1000 });
const B = () =>
  player(2, { tiles: 100, science: 300, political: 50, gold: 1000 });

describe("domestic score column", () => {
  beforeEach(() => {
    localStorage.clear();
    (
      UserSettings as unknown as { cache: Map<string, string | null> }
    ).cache.clear();
  });

  it("scores alive humans and nations with the engine's formula, never bots", () => {
    const bot = player(3, {
      tiles: 600,
      type: PlayerType.Bot,
      domestic: false,
    });
    const scores = domesticScoreMap(game([A(), B(), bot]));
    expect(scores.get(1)?.total).toBe(37.5);
    expect(scores.get(2)?.total).toBe(62.5);
    expect(scores.has(3)).toBe(false);
  });

  it("the score column reads the shared score and can't be hidden", () => {
    const a = A();
    const g = game([a, B()]);
    const column = columnById("score");
    expect(column.value?.(a, g)).toBe(37.5);
    expect(column.cell({ position: 1, name: "a", value: 37.5 }, g)).toBe(
      "37.5",
    );
    expect(column.isHideable).toBe(false);
    expect(column.domesticOnly).toBe(true);
  });

  it("player stats show the score only in domestic games", async () => {
    const stats = new PlayerStats();
    stats.game = game([A()]);
    stats.visible = true;
    stats.domesticMode = true;
    document.body.append(stats);
    stats.refresh();
    await stats.updateComplete;
    // rank, clan, player | score, tiles, gold, maxtroops | picker
    expect(
      stats.querySelector(".stats-table-content")?.getAttribute("style"),
    ).toContain("34px 80px 100px auto auto auto auto 32px");
    stats.remove();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/DomesticScoreColumn.test.ts --run`
Expected: FAIL — `Failed to load url ../../src/client/view/DomesticScores`

- [ ] **Step 3: 화면 쪽 점수 계산**

`src/client/view/DomesticScores.ts`:

```ts
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import {
  domesticScores,
  projectProgress,
  ScoreBreakdown,
  ScoreInput,
} from "@openfront/engine-lib/domestic/Score";
import type { GameView } from "./GameView";
import type { PlayerView } from "./PlayerView";

/** A player's score input from its last update; null for bots and outside domestic mode. */
export function scoreInputOf(player: PlayerView): ScoreInput | null {
  const d = player.domesticData();
  if (d === null || player.type() === PlayerType.Bot) return null;
  return {
    scored: true,
    tiles: player.numTilesOwned(),
    science: d.cumulativeScience,
    political: d.cumulativePolitical,
    gold: player.goldEarned(),
    projectProgress: projectProgress(d.project),
  };
}

const cache = new WeakMap<
  GameView,
  { tick: number; scores: ReadonlyMap<number, ScoreBreakdown> }
>();

/**
 * Live domestic scores (spec §8.2) of the alive, scored players by smallID,
 * computed once per tick with the engine's formula. Whole points stand in
 * for the engine's milli-points, so the last digit can differ from the
 * final judgement.
 */
export function domesticScoreMap(
  game: GameView,
): ReadonlyMap<number, ScoreBreakdown> {
  const tick = game.ticks();
  const hit = cache.get(game);
  if (hit !== undefined && hit.tick === tick) return hit.scores;
  const scored: { id: number; input: ScoreInput }[] = [];
  for (const p of game.playerViews()) {
    if (!p.isAlive()) continue;
    const input = scoreInputOf(p);
    if (input !== null) scored.push({ id: p.smallID(), input });
  }
  const breakdowns = domesticScores(scored.map((s) => s.input));
  const scores = new Map<number, ScoreBreakdown>();
  scored.forEach((s, i) => scores.set(s.id, breakdowns[i]));
  cache.set(game, { tick, scores });
  return scores;
}

/** A player's live score; 0 for bots and outside domestic mode. */
export function domesticScoreOf(player: PlayerView, game: GameView): number {
  return domesticScoreMap(game).get(player.smallID())?.total ?? 0;
}
```

- [ ] **Step 4: 열 id와 정의**

`src/client/StatsConstants.ts`의 `COLUMN_IDS`에서 `"team",` 뒤(`// Territory.` 주석 앞)에 추가한다. "team" 뒤에 둬서 기존 테스트의 `COLUMN_IDS.slice(5)` 계산이 그대로 맞고, 내정 모드에서는 점수가 첫 정렬 열이 된다:

```ts
  // Domestic mode only: always shown there, never offered in the menu.
  "score",
```

`src/client/hud/layers/lib/StatsColumns.ts`:
- import 추가: `import { domesticScoreOf } from "../../../view/DomesticScores";`
- `ColumnDef` 인터페이스의 `readonly isHideable: boolean;` 뒤에 추가:

```ts
  /** Only exists in domestic-mode games (StatsTable.domesticMode). */
  readonly domesticOnly?: true;
```

- `COLUMN_DEFS`에서 `id: "team"` 정의 블록 바로 뒤(`id: "tiles"` 블록 앞)에 추가:

```ts
  defineColumn({
    id: "score",
    labelKey: "leaderboard.score",
    headerVisual: { kind: "text", text: "leaderboard.score" },
    isHideable: false,
    domesticOnly: true,
    value: (player, game) => domesticScoreOf(player, game),
    cell: (row) => row.value.toFixed(1),
  }),
```

- [ ] **Step 5: 내정 모드에서만 보이기**

`src/client/components/StatsTable.ts`:
- `@property({ type: Boolean }) visible = false;` 뒤에 추가:

```ts
  /** Domestic mode: show the domestic-only columns (the live score). */
  @property({ type: Boolean }) domesticMode = false;
```

- `visibleColumns()`를 다음으로 바꾼다:

```ts
  private visibleColumns(): readonly ColumnDef[] {
    const selected = this.userSettings.statsColumns(this.tableKind);
    return columnsFor(this.tableKind).filter(
      (column) =>
        (column.domesticOnly !== true || this.domesticMode) &&
        (!column.isHideable || selected.includes(column.id)),
    );
  }
```

`src/client/hud/layers/GameLeftSidebar.ts`의 `<player-stats ...>`와 `<team-stats ...>` 둘 다 `.game=${this.game}` 다음 줄에 추가:

```ts
            .domesticMode=${this.game?.config().gameConfig().domesticMode ===
            true}
```

- [ ] **Step 6: 통과 확인(기존 순위표 테스트 포함)**

Run: `npx vitest tests/client/DomesticScoreColumn.test.ts tests/StatsColumns.test.ts tests/PlayerStats.test.ts tests/TeamStats.test.ts tests/ColumnPicker.test.ts tests/UserSettings.test.ts tests/GameLeftSidebar.test.ts --run && npm run typecheck`
Expected: 모두 PASS(DomesticScoreColumn 3 tests), typecheck 오류 없음

- [ ] **Step 7: 커밋**

```bash
npx prettier --write src/client/view/DomesticScores.ts src/client/StatsConstants.ts src/client/hud/layers/lib/StatsColumns.ts src/client/components/StatsTable.ts src/client/hud/layers/GameLeftSidebar.ts tests/client/DomesticScoreColumn.test.ts
git add src/client/view/DomesticScores.ts src/client/StatsConstants.ts src/client/hud/layers/lib/StatsColumns.ts src/client/components/StatsTable.ts src/client/hud/layers/GameLeftSidebar.ts tests/client/DomesticScoreColumn.test.ts
git commit -m "feat(domestic): live score column on the leaderboard"
```

---

### Task 11: 지도 강조와 진행 막대

**Files:**
- Create: `src/client/render/frame/derive/VictoryProjects.ts`
- Create: `src/client/render/gl/passes/VictoryProjectPass.ts`
- Modify: `src/client/render/gl/passes/BarPass.ts`
- Modify: `src/client/render/gl/Renderer.ts`
- Modify: `src/client/render/gl/MapRenderer.ts`
- Modify: `src/client/WebGLFrameBuilder.ts`
- Test: `tests/client/render/frame/derive/victory-projects.test.ts`

**Interfaces:**
- Consumes: Task 1의 `projectProgress`, Task 3의 `DomesticData.project`(업데이트로 옴)
- Produces:
  - `interface VictoryProjectSource { isAlive(): boolean; domesticData(): DomesticData | null }`
  - `deriveVictoryProjects(players: Iterable<VictoryProjectSource>): Map<number, number>`
  - `BarPass.setVictoryProjects(progress: ReadonlyMap<number, number>): void`
  - `class VictoryProjectPass { setHosts(hosts: readonly { x: number; y: number }[]): void; draw(cameraMatrix: Float32Array): void; dispose(): void }`
  - `GPURenderer.setVictoryProjects(progress)`, `MapRenderer.setVictoryProjects(progress)`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/render/frame/derive/victory-projects.test.ts`:

```ts
import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { describe, expect, it } from "vitest";
import { deriveVictoryProjects } from "../../../../../src/client/render/frame/derive/VictoryProjects";

const RUNNING = {
  kind: "science" as const,
  hostUnitId: 7,
  ticksLeft: 600,
  totalTicks: 2400,
  paused: false,
};

function source(alive: boolean, project?: DomesticData["project"]) {
  const data = (project === undefined ? {} : { project }) as DomesticData;
  return { isAlive: () => alive, domesticData: () => data };
}

describe("deriveVictoryProjects", () => {
  it("maps each running project's host to its progress", () => {
    const map = deriveVictoryProjects([
      source(true, RUNNING),
      source(true),
      { isAlive: () => true, domesticData: () => null },
    ]);
    expect([...map]).toEqual([[7, 0.75]]);
  });

  it("skips dead players", () => {
    expect(deriveVictoryProjects([source(false, RUNNING)]).size).toBe(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/render/frame/derive/victory-projects.test.ts --run`
Expected: FAIL — `Failed to load url .../derive/VictoryProjects`

- [ ] **Step 3: 파생 함수 작성**

`src/client/render/frame/derive/VictoryProjects.ts`:

```ts
import type { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { projectProgress } from "@openfront/engine-lib/domestic/Score";

/** What deriveVictoryProjects reads of a player (PlayerView satisfies it). */
export interface VictoryProjectSource {
  isAlive(): boolean;
  domesticData(): DomesticData | null;
}

/** Host unit id -> progress (0..1) of every victory project an alive player runs. */
export function deriveVictoryProjects(
  players: Iterable<VictoryProjectSource>,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of players) {
    if (!p.isAlive()) continue;
    const project = p.domesticData()?.project;
    if (project === undefined) continue;
    out.set(project.hostUnitId, projectProgress(project));
  }
  return out;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest tests/client/render/frame/derive/victory-projects.test.ts --run`
Expected: PASS (2 tests)

- [ ] **Step 5: 진행 막대**

`src/client/render/gl/passes/BarPass.ts`:
- 필드 추가(`private veterancyHealthBonus: number;` 뒤):

```ts
  /** Domestic mode: victory-project host unit id -> progress (0..1). */
  private projectProgress: ReadonlyMap<number, number> = new Map();
```

- `updateBars` 메서드 바로 앞에 추가:

```ts
  /** Domestic mode: hosts of running victory projects and their progress. */
  setVictoryProjects(progress: ReadonlyMap<number, number>): void {
    this.projectProgress = progress;
  }
```

- `computeStructureProgress`의 삭제 진행 블록(`if (unit.markedForDeletion !== false) { ... }`) 바로 뒤에 추가:

```ts
    // Domestic victory project: the bar fills as the project advances
    const project = this.projectProgress.get(unit.id);
    if (project !== undefined) return project;
```

- [ ] **Step 6: 금색 고리 패스**

`src/client/render/gl/passes/VictoryProjectPass.ts`:

```ts
/**
 * VictoryProjectPass — a gold ring around every building that hosts a
 * domestic-mode victory project, so every player can find the target.
 * Reuses the range-circle shaders: one quad per host.
 */

import { createProgram } from "../utils/GlUtils";

import fragSrc from "../shaders/range-circle/range-circle.frag.glsl?raw";
import vertSrc from "../shaders/range-circle/range-circle.vert.glsl?raw";

const RING_RADIUS_TILES = 10;
const RING_COLOR = [1.0, 0.84, 0.0] as const;

export class VictoryProjectPass {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;

  private uCamera: WebGLUniformLocation;
  private uCenter: WebGLUniformLocation;
  private uRadius: WebGLUniformLocation;
  private uColor: WebGLUniformLocation;

  private hosts: readonly { x: number; y: number }[] = [];

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = createProgram(gl, vertSrc, fragSrc, "VictoryProjectPass");

    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uCenter = gl.getUniformLocation(this.program, "uCenter")!;
    this.uRadius = gl.getUniformLocation(this.program, "uRadius")!;
    this.uColor = gl.getUniformLocation(this.program, "uColor")!;

    // Unit quad [0,1]
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  /** Tile coordinates of the buildings hosting a running project. */
  setHosts(hosts: readonly { x: number; y: number }[]): void {
    this.hosts = hosts;
  }

  draw(cameraMatrix: Float32Array): void {
    if (this.hosts.length === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.uniform1f(this.uRadius, RING_RADIUS_TILES);
    gl.uniform3f(this.uColor, RING_COLOR[0], RING_COLOR[1], RING_COLOR[2]);
    gl.bindVertexArray(this.vao);
    for (const host of this.hosts) {
      gl.uniform2f(this.uCenter, host.x, host.y);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
  }
}
```

- [ ] **Step 7: 렌더러 연결**

`src/client/render/gl/Renderer.ts`:
- import 추가: `import { VictoryProjectPass } from "./passes/VictoryProjectPass";`
- 필드 추가(`private rangeCirclePass: RangeCirclePass;` 뒤): `private victoryProjectPass: VictoryProjectPass;`
- 생성자의 `this.rangeCirclePass = new RangeCirclePass(gl);` 뒤에 `this.victoryProjectPass = new VictoryProjectPass(gl);`를 추가한다.
- 그리기 순서에서 `this.rangeCirclePass.draw(cam);` 뒤에 `this.victoryProjectPass.draw(cam);`를 추가한다.
- 정리 코드의 `this.rangeCirclePass.dispose();` 뒤에 `this.victoryProjectPass.dispose();`를 추가한다.
- `updateSmallPlayerGlow` 메서드 뒤에 추가:

```ts
  /** Domestic mode: progress bars and gold rings on victory-project hosts. */
  setVictoryProjects(progress: ReadonlyMap<number, number>): void {
    this.barPass.setVictoryProjects(progress);
    const hosts: { x: number; y: number }[] = [];
    for (const id of progress.keys()) {
      const unit = this.lastStructures.get(id);
      if (unit === undefined) continue;
      const x = unit.pos % this.mapW;
      hosts.push({ x, y: (unit.pos - x) / this.mapW });
    }
    this.victoryProjectPass.setHosts(hosts);
  }
```

`src/client/render/gl/MapRenderer.ts`의 `updateSmallPlayerGlow` 메서드 뒤에 추가:

```ts
  /** Domestic mode: host unit id -> victory-project progress (0..1). */
  setVictoryProjects(progress: ReadonlyMap<number, number>): void {
    this.renderer?.setVictoryProjects(progress);
  }
```

`src/client/WebGLFrameBuilder.ts`:
- import 추가(셰이더를 끌어오지 않는 순수 모듈이다): `import { deriveVictoryProjects } from "./render/frame/derive/VictoryProjects";`
- `update()`의 `this.syncSmallPlayerGlow(gameView);` 뒤에 `this.syncVictoryProjects(gameView);`를 추가한다.
- `syncSmallPlayerGlow` 메서드 뒤에 추가:

```ts
  /** Domestic mode: push victory-project hosts and their progress each tick. */
  private syncVictoryProjects(gameView: GameView): void {
    if (!gameView.config().domesticMode()) return;
    this.view.setVictoryProjects(deriveVictoryProjects(gameView.playerViews()));
  }
```

- [ ] **Step 8: 확인**

Run: `npx vitest tests/client/render tests/WebGLFrameBuilder.cosmetics.test.ts tests/WebGLFrameBuilder.effectOverrides.test.ts tests/WebGLFrameBuilder.explosionParams.test.ts --run && npm run typecheck && npx eslint src/client/render src/client/WebGLFrameBuilder.ts`
Expected: 모두 PASS, typecheck·eslint 오류 없음(GL 그리기는 Task 15에서 실제 실행으로 확인)

- [ ] **Step 9: 커밋**

```bash
npx prettier --write src/client/render src/client/WebGLFrameBuilder.ts tests/client/render/frame/derive/victory-projects.test.ts
git add -A src/client/render src/client/WebGLFrameBuilder.ts tests/client/render
git commit -m "feat(domestic): highlight victory project hosts with a ring and progress bar"
```

---

### Task 12: 국정 패널 승리 탭

**Files:**
- Create: `src/client/hud/domestic/VictoryTab.ts`
- Modify: `src/client/hud/domestic/DomesticPanel.ts` (2단계 탭 구조에 탭 추가)
- Test: `tests/client/DomesticVictoryTab.test.ts`

**Interfaces:**
- Consumes: Task 1의 `VICTORY_PROJECTS`, `projectQualified`, `victoryProjectBlock`, `projectProgress`; Task 2의 `Config.conquestPercent()`, `Config.maxTimerMinutes()`; Task 9의 `StartVictoryProjectIntentEvent`; Task 10의 `domesticScoreMap`; 2단계 `DomesticData.governmentTier`, 국정 패널의 `DomesticTab`·`TABS`·`renderTab`
- Produces:
  - `interface HostChoice { id: number; level: number }`
  - `projectHostChoices(units: readonly { id(): number; level(): number; isUnderConstruction(): boolean }[]): HostChoice[]`
  - `renderVictoryTab(game: GameView, me: PlayerView, d: DomesticData, onStart: (kind: VictoryProjectKind, unitId: number) => void): TemplateResult`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/DomesticVictoryTab.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { projectHostChoices } from "../../src/client/hud/domestic/VictoryTab";

function unit(id: number, level: number, underConstruction = false) {
  return {
    id: () => id,
    level: () => level,
    isUnderConstruction: () => underConstruction,
  };
}

describe("projectHostChoices", () => {
  it("lists finished level 3+ buildings, highest level first", () => {
    expect(
      projectHostChoices([
        unit(1, 3),
        unit(2, 2),
        unit(3, 5),
        unit(4, 4, true),
        unit(5, 3),
      ]),
    ).toEqual([
      { id: 3, level: 5 },
      { id: 1, level: 3 },
      { id: 5, level: 3 },
    ]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/DomesticVictoryTab.test.ts --run`
Expected: FAIL — `Failed to load url ../../src/client/hud/domestic/VictoryTab`

- [ ] **Step 3: 승리 탭 작성**

`src/client/hud/domestic/VictoryTab.ts`:

```ts
import {
  DomesticData,
  VICTORY_PROJECT_KINDS,
  VictoryProjectKind,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  MILLI,
  POLITICAL_PROJECT_POLITICAL,
  PROJECT_HOST_MIN_LEVEL,
} from "@openfront/engine-lib/domestic/Balance";
import { projectProgress } from "@openfront/engine-lib/domestic/Score";
import {
  projectQualified,
  VICTORY_PROJECTS,
  victoryProjectBlock,
} from "@openfront/engine-lib/domestic/Victory";
import { renderNumber } from "@openfront/engine-lib/Format";
import { html, TemplateResult } from "lit";
import { formatPercentage, renderDuration, translateText } from "../../Utils";
import type { GameView } from "../../view";
import { domesticScoreMap } from "../../view/DomesticScores";
import type { PlayerView } from "../../view/PlayerView";

export interface HostChoice {
  id: number;
  level: number;
}

/** Own finished buildings at level 3+, highest level first (ties: lower id). */
export function projectHostChoices(
  units: readonly {
    id(): number;
    level(): number;
    isUnderConstruction(): boolean;
  }[],
): HostChoice[] {
  return units
    .filter((u) => !u.isUnderConstruction() && u.level() >= PROJECT_HOST_MIN_LEVEL)
    .map((u) => ({ id: u.id(), level: u.level() }))
    .sort((a, b) => b.level - a.level || a.id - b.id);
}

const BUILDING_KEY: Readonly<Record<VictoryProjectKind, string>> = {
  science: "unit_type.research_institute",
  political: "unit_type.admin_office",
};

/** The domestic panel's victory tab (spec §10.7). */
export function renderVictoryTab(
  game: GameView,
  me: PlayerView,
  d: DomesticData,
  onStart: (kind: VictoryProjectKind, unitId: number) => void,
): TemplateResult {
  return html`
    <div class="flex flex-col gap-3 text-sm">
      ${renderConquest(game, me)}
      ${VICTORY_PROJECT_KINDS.map((kind) => renderProject(kind, me, d, onStart))}
      ${renderScore(game, me)} ${renderActive(game)}
    </div>
  `;
}

function renderConquest(game: GameView, me: PlayerView): TemplateResult {
  const land = game.numLandTiles() - game.numTilesWithFallout();
  const share = land > 0 ? me.numTilesOwned() / land : 0;
  return html`<div>
    ${translateText("domestic.victory.conquest", {
      pct: formatPercentage(share),
      target: game.config().conquestPercent(),
    })}
  </div>`;
}

function renderProject(
  kind: VictoryProjectKind,
  me: PlayerView,
  d: DomesticData,
  onStart: (kind: VictoryProjectKind, unitId: number) => void,
): TemplateResult {
  const def = VICTORY_PROJECTS[kind];
  const qualified = projectQualified(
    kind,
    d.techs.includes("space_program"),
    d.governmentTier,
  );
  const hosts = projectHostChoices(me.units(def.hostType));
  const cost =
    kind === "science"
      ? translateText("domestic.victory.cost_science", {
          gold: renderNumber(def.goldCost),
        })
      : translateText("domestic.victory.cost_political", {
          gold: renderNumber(def.goldCost),
          political: POLITICAL_PROJECT_POLITICAL,
        });
  return html`
    <div class="border border-gray-600 rounded-sm p-2 flex flex-col gap-1">
      <div class="font-bold">
        ${translateText(`domestic.project.${kind}.name`)}
      </div>
      <div class="text-gray-300">
        ${translateText(`domestic.project.${kind}.desc`)}
      </div>
      <div class="text-gray-400">${cost}</div>
      <div class=${qualified ? "text-green-400" : "text-gray-400"}>
        ${translateText(`domestic.victory.requirement_${kind}`)}
      </div>
      ${hosts.length === 0
        ? html`<div class="text-gray-400">
            ${translateText("domestic.victory.no_hosts")}
          </div>`
        : hosts.map((host) => {
            const block = victoryProjectBlock(kind, {
              busy: d.project !== undefined,
              qualified,
              hostLevel: host.level,
              gold: me.gold(),
              politicalMilli: d.political * MILLI,
            });
            return html`<div class="flex items-center gap-2">
              <span
                >${translateText("domestic.victory.host_level", {
                  building: translateText(BUILDING_KEY[kind]),
                  level: host.level,
                })}</span
              >
              <button
                class="px-2 py-0.5 rounded-sm bg-amber-700 hover:bg-amber-600 disabled:opacity-40"
                ?disabled=${block !== null}
                title=${block === null
                  ? ""
                  : translateText(`domestic.victory.blocked.${block}`)}
                @click=${() => onStart(kind, host.id)}
              >
                ${translateText("domestic.victory.start")}
              </button>
            </div>`;
          })}
    </div>
  `;
}

function renderScore(game: GameView, me: PlayerView): TemplateResult {
  const scores = domesticScoreMap(game);
  const ranked = [...scores.entries()].sort((a, b) => b[1].total - a[1].total);
  const rank = ranked.findIndex(([id]) => id === me.smallID()) + 1;
  const mine = scores.get(me.smallID())?.total ?? 0;
  const limit = game.config().maxTimerMinutes();
  const left =
    limit === null
      ? null
      : Math.max(0, limit * 60 - Math.floor(game.elapsedGameSeconds()));
  return html`<div>
    ${translateText("domestic.victory.score", {
      score: mine.toFixed(1),
      rank,
      count: ranked.length,
    })}
    ${left === null
      ? ""
      : html` ·
          ${translateText("domestic.victory.time_left", {
            time: renderDuration(left),
          })}`}
  </div>`;
}

function renderActive(game: GameView): TemplateResult {
  const rows = game.playerViews().flatMap((p) => {
    const project = p.isAlive() ? p.domesticData()?.project : undefined;
    return project === undefined ? [] : [{ p, project }];
  });
  return html`<div class="flex flex-col gap-1">
    <div class="font-bold">${translateText("domestic.victory.active")}</div>
    ${rows.length === 0
      ? html`<div class="text-gray-400">
          ${translateText("domestic.victory.none_active")}
        </div>`
      : rows.map(
          ({ p, project }) =>
            html`<div>
              ${translateText("domestic.victory.progress", {
                name: p.displayName(),
                project: translateText(`domestic.project.${project.kind}.name`),
                pct: Math.floor(projectProgress(project) * 100),
              })}
              ${project.paused ? translateText("domestic.victory.paused") : ""}
            </div>`,
        )}
  </div>`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest tests/client/DomesticVictoryTab.test.ts --run`
Expected: PASS (1 test)

- [ ] **Step 5: 국정 패널에 탭 추가**

`src/client/hud/domestic/DomesticPanel.ts`(2단계 Task 12가 만든 탭 구조):
- import 추가: `import { renderVictoryTab } from "./VictoryTab";`. 2단계의 `../../Transport` import 목록(`ChooseGovernmentIntentEvent`, `ProclaimLawIntentEvent`, `ResearchTechIntentEvent`)에 `StartVictoryProjectIntentEvent`를 추가한다.
- 2단계의 탭 선언

```ts
type DomesticTab = "tech" | "laws" | "government";
const TABS: readonly DomesticTab[] = ["tech", "laws", "government"];
```

  을 다음으로 바꾼다. 탭 버튼 이름은 2단계 `render()`가 ``translateText(`domestic.tab_${tab}`)``로 읽으므로 Task 8의 `domestic.tab_victory`가 쓰인다:

```ts
type DomesticTab = "tech" | "laws" | "government" | "victory";
const TABS: readonly DomesticTab[] = ["tech", "laws", "government", "victory"];
```

- 클래스 주석 `/** The domestic panel: technology, book of laws and government tabs. */`를 `/** The domestic panel: technology, book of laws, government and victory tabs. */`로 바꾼다.
- `renderTab(d, view, me)`의 switch에서 `case "government":` 블록(`return renderGovernmentTab({ ... });`) 뒤에 추가한다. switch에 `default`가 없으므로 이 case가 빠지면 typecheck가 실패한다:

```ts
      case "victory":
        return renderVictoryTab(this.game, me, d, (kind, unitId) =>
          this.eventBus.emit(new StartVictoryProjectIntentEvent(kind, unitId)),
        );
```

- [ ] **Step 6: 확인**

Run: `npm run typecheck && npx eslint src/client/hud/domestic && npx vitest tests/client --run`
Expected: 오류 없음, 테스트 PASS

- [ ] **Step 7: 커밋**

```bash
npx prettier --write src/client/hud/domestic tests/client/DomesticVictoryTab.test.ts
git add -A src/client/hud/domestic tests/client/DomesticVictoryTab.test.ts
git commit -m "feat(domestic): victory tab in the domestic panel"
```

---

### Task 13: 로비 설정(정복 %, 타이머 기본값, 연장전 끄기)

**Files:**
- Modify: `src/client/utilities/GameConfigHelpers.ts` (`domesticModeDefaults`)
- Modify: `src/client/HostLobbyModal.ts`
- Modify: `src/client/SinglePlayerModal.ts`
- Test: `tests/client/DomesticLobby.test.ts`

**Interfaces:**
- Consumes: Task 1의 `DOMESTIC_TIMER_MINUTES`, `DOMESTIC_CONQUEST_PERCENT`, `CONQUEST_PERCENT_MIN/MAX`; Task 2의 `GameConfig.conquestPercent`; 1단계 Task 14의 `domesticMode` 상태와 토글; Task 8의 `game_settings.conquest_percent`
- Produces: `domesticModeDefaults(maxTimer: boolean, maxTimerValue: number | undefined): { maxTimer: true; maxTimerValue: number; overtime: false }`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/DomesticLobby.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { domesticModeDefaults } from "../../src/client/utilities/GameConfigHelpers";

describe("turning domestic mode on in the lobby", () => {
  it("turns the timer on at 30 minutes when none is set", () => {
    const expected = { maxTimer: true, maxTimerValue: 30, overtime: false };
    expect(domesticModeDefaults(false, undefined)).toEqual(expected);
    expect(domesticModeDefaults(true, undefined)).toEqual(expected);
    // A value left behind by a switched-off timer doesn't count.
    expect(domesticModeDefaults(false, 45)).toEqual(expected);
  });

  it("keeps a timer the host already set", () => {
    expect(domesticModeDefaults(true, 45)).toEqual({
      maxTimer: true,
      maxTimerValue: 45,
      overtime: false,
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/DomesticLobby.test.ts --run`
Expected: FAIL — `domesticModeDefaults is not a function`

- [ ] **Step 3: 도우미 작성**

`src/client/utilities/GameConfigHelpers.ts`:
- import 추가: `import { DOMESTIC_TIMER_MINUTES } from "@openfront/engine-lib/domestic/Balance";`
- `toOptionalNumber` 함수 뒤에 추가:

```ts
/**
 * Turning domestic mode on (spec §8.3): the game gets a timer, 30 minutes
 * unless the host already set one, and overtime goes off.
 */
export function domesticModeDefaults(
  maxTimer: boolean,
  maxTimerValue: number | undefined,
): { maxTimer: true; maxTimerValue: number; overtime: false } {
  return {
    maxTimer: true,
    maxTimerValue:
      maxTimer && maxTimerValue !== undefined
        ? maxTimerValue
        : DOMESTIC_TIMER_MINUTES,
    overtime: false,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest tests/client/DomesticLobby.test.ts --run`
Expected: PASS (2 tests)

- [ ] **Step 5: 호스트 로비**

`src/client/HostLobbyModal.ts`:
1. import 추가:

```ts
import {
  CONQUEST_PERCENT_MAX,
  CONQUEST_PERCENT_MIN,
  DOMESTIC_CONQUEST_PERCENT,
} from "@openfront/engine-lib/domestic/Balance";
```

   `./utilities/GameConfigHelpers` import 목록에 `domesticModeDefaults`를 추가한다.
2. 1단계의 `@state() private domesticMode: boolean = false;` 뒤에 추가:

```ts
  @state() private conquestPercent: number | undefined = undefined;
```

3. 1단계의 토글 처리 case를

```ts
      case "game_settings.domestic_mode":
        this.domesticMode = checked;
        this.putGameConfig();
        break;
```

   다음으로 바꾼다:

```ts
      case "game_settings.domestic_mode":
        this.domesticMode = checked;
        if (checked) {
          const defaults = domesticModeDefaults(
            this.maxTimer,
            this.maxTimerValue,
          );
          this.maxTimer = defaults.maxTimer;
          this.maxTimerValue = defaults.maxTimerValue;
          this.overtime = defaults.overtime;
        }
        this.putGameConfig();
        break;
```

4. `inputCards` 배열에서 max timer 카드(`.labelKey=${"game_settings.max_timer"}`인 `toggle-input-card`) 바로 뒤에 추가:

```ts
      ...(this.domesticMode
        ? [
            html`<input-card
              .labelKey=${"game_settings.conquest_percent"}
              .inputId=${"conquest-percent-value"}
              .inputMin=${CONQUEST_PERCENT_MIN}
              .inputMax=${CONQUEST_PERCENT_MAX}
              .inputStep=${"1"}
              .inputValue=${this.conquestPercent}
              .inputAriaLabel=${translateText("game_settings.conquest_percent")}
              .inputPlaceholder=${String(DOMESTIC_CONQUEST_PERCENT)}
              .onChange=${this.handleConquestPercentChange}
              .onKeyDown=${this.handleConquestPercentKeyDown}
            ></input-card>`,
          ]
        : []),
```

5. 같은 배열의 연장전 카드를 내정 모드에서 숨긴다. 연장전 카드의 시작

```ts
      html`<toggle-input-card
        .labelKey=${"game_settings.overtime"}
```

   을

```ts
      ...(this.domesticMode
        ? []
        : [
      html`<toggle-input-card
        .labelKey=${"game_settings.overtime"}
```

   로 바꾸고, 그 카드의 끝

```ts
        .onKeyDown=${this.handleOvertimeMinutesKeyDown}
      ></toggle-input-card>`,
```

   을

```ts
        .onKeyDown=${this.handleOvertimeMinutesKeyDown}
      ></toggle-input-card>`,
          ]),
```

   로 바꾼다(들여쓰기는 prettier가 정리한다).
6. `handleStartDelayValueChanges` 메서드 뒤에 추가:

```ts
  private handleConquestPercentKeyDown = (e: KeyboardEvent) => {
    preventDisallowedKeys(e, ["-", "+", "e", "E", "."]);
  };

  private handleConquestPercentChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const value = parseBoundedIntegerFromInput(input, {
      min: CONQUEST_PERCENT_MIN,
      max: CONQUEST_PERCENT_MAX,
    });
    if (value === undefined) {
      this.conquestPercent = undefined;
      input.value = "";
    } else {
      this.conquestPercent = value;
    }
    this.putGameConfig();
  };
```

7. `putGameConfig`의 1단계 `domesticMode: this.domesticMode,` 뒤에 추가(null은 기본값 70으로 되돌림):

```ts
            conquestPercent: this.domesticMode
              ? (this.conquestPercent ?? null)
              : null,
```

8. 초기화 코드의 1단계 `this.domesticMode = false;` 뒤에 `this.conquestPercent = undefined;`를 추가한다.

- [ ] **Step 6: 싱글플레이**

`src/client/SinglePlayerModal.ts`:
1. import 추가: `import "./components/InputCard";`와

```ts
import {
  CONQUEST_PERCENT_MAX,
  CONQUEST_PERCENT_MIN,
  DOMESTIC_CONQUEST_PERCENT,
} from "@openfront/engine-lib/domestic/Balance";
```

   `./utilities/GameConfigHelpers` import 목록에 `domesticModeDefaults`를 추가한다(`parseBoundedIntegerFromInput`, `preventDisallowedKeys`가 없으면 함께 추가).
2. `DEFAULT_OPTIONS`의 1단계 `domesticMode: false,` 뒤에 `conquestPercent: undefined as number | undefined,`를 추가한다.
3. 1단계 `@state() private domesticMode ...` 뒤에 추가:

```ts
  @state() private conquestPercent: number | undefined =
    DEFAULT_OPTIONS.conquestPercent;
```

4. 1단계 토글 case를

```ts
      case "game_settings.domestic_mode":
        this.domesticMode = checked;
        break;
```

   다음으로 바꾼다:

```ts
      case "game_settings.domestic_mode":
        this.domesticMode = checked;
        if (checked) {
          const defaults = domesticModeDefaults(
            this.maxTimer,
            this.maxTimerValue,
          );
          this.maxTimer = defaults.maxTimer;
          this.maxTimerValue = defaults.maxTimerValue;
          this.overtime = defaults.overtime;
        }
        break;
```

5. `renderBody()`의 `inputCards`에서 max timer 카드(`.labelKey=${"game_settings.max_timer"}`) 바로 뒤에 추가:

```ts
      ...(this.domesticMode
        ? [
            html`<input-card
              .labelKey=${"game_settings.conquest_percent"}
              .inputId=${"conquest-percent-value"}
              .inputMin=${CONQUEST_PERCENT_MIN}
              .inputMax=${CONQUEST_PERCENT_MAX}
              .inputStep=${"1"}
              .inputValue=${this.conquestPercent}
              .inputAriaLabel=${translateText("game_settings.conquest_percent")}
              .inputPlaceholder=${String(DOMESTIC_CONQUEST_PERCENT)}
              .onChange=${this.handleConquestPercentChange}
              .onKeyDown=${this.handleConquestPercentKeyDown}
            ></input-card>`,
          ]
        : []),
```

   같은 배열에서 연장전 카드의 시작

```ts
      html`<toggle-input-card
        .labelKey=${"game_settings.overtime"}
```

   을

```ts
      ...(this.domesticMode
        ? []
        : [
      html`<toggle-input-card
        .labelKey=${"game_settings.overtime"}
```

   로 바꾸고, 그 카드의 끝

```ts
        .onKeyDown=${this.handleOvertimeMinutesKeyDown}
      ></toggle-input-card>`,
```

   을

```ts
        .onKeyDown=${this.handleOvertimeMinutesKeyDown}
      ></toggle-input-card>`,
          ]),
```

   로 바꾼다.
6. `hasOptionsChanged()`의 1단계 `this.domesticMode !== DEFAULT_OPTIONS.domesticMode ||` 뒤에 `this.conquestPercent !== DEFAULT_OPTIONS.conquestPercent ||`를 추가한다.
7. 초기화 코드의 1단계 `this.domesticMode = DEFAULT_OPTIONS.domesticMode;` 뒤에 `this.conquestPercent = DEFAULT_OPTIONS.conquestPercent;`를 추가한다.
8. 연장전 처리 메서드들 뒤에 추가(싱글플레이는 서버에 보내지 않으므로 `putGameConfig`가 없다):

```ts
  private handleConquestPercentKeyDown = (e: KeyboardEvent) => {
    preventDisallowedKeys(e, ["-", "+", "e", "E", "."]);
  };

  private handleConquestPercentChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const value = parseBoundedIntegerFromInput(input, {
      min: CONQUEST_PERCENT_MIN,
      max: CONQUEST_PERCENT_MAX,
    });
    if (value === undefined) {
      this.conquestPercent = undefined;
      input.value = "";
    } else {
      this.conquestPercent = value;
    }
  };
```

9. 게임 시작 설정의 1단계 `...(this.domesticMode ? { domesticMode: true } : {}),` 뒤에 추가:

```ts
                ...(this.domesticMode && this.conquestPercent !== undefined
                  ? { conquestPercent: this.conquestPercent }
                  : {}),
```

- [ ] **Step 7: 확인**

Run: `npm run typecheck && npx eslint src/client/HostLobbyModal.ts src/client/SinglePlayerModal.ts src/client/utilities/GameConfigHelpers.ts && npx vitest tests/client tests/GameModeSelectorGating.test.ts --run`
Expected: 오류 없음, PASS

- [ ] **Step 8: 커밋**

```bash
npx prettier --write src/client/utilities/GameConfigHelpers.ts src/client/HostLobbyModal.ts src/client/SinglePlayerModal.ts tests/client/DomesticLobby.test.ts
git add src/client/utilities/GameConfigHelpers.ts src/client/HostLobbyModal.ts src/client/SinglePlayerModal.ts tests/client/DomesticLobby.test.ts
git commit -m "feat(domestic): conquest percent, 30-minute timer and no overtime in the lobby"
```

---

### Task 14: 밸런스 시뮬레이션 스크립트

**Files:**
- Create: `scripts/domestic-sim-report.ts`
- Create: `scripts/domestic-sim.ts`
- Modify: `tsconfig.json` (`include`)
- Test: `tests/domestic/DomesticSimReport.test.ts`

**Interfaces:**
- Consumes: 엔진 전체(`GameRunner`, `createGame`, `createNationsForGame`), `tests/perf/fullgame/NodeGameMapLoader`, 2단계 `nationDomesticPlan(id).personality`, `governmentTier()`(매초 처리 때 오르므로 1초 간격 표본과 맞는다), `proclaimedLaws()`, Task 3의 `victoryProject()`
- Produces:
  - `interface NationRecord { personality: string; firstNuke: number | null; tier1: number | null; tier2: number | null; projectStart: number | null; projectDone: number | null; techs: number; laws: number }`(분 단위)
  - `type Verdict = "ok" | "below" | "above" | "never"`
  - `MILESTONE_TARGETS`, `mean`, `milestoneVerdict`, `summarize`, `formatTable`

> spec §12.3대로 이 스크립트는 테스트 스위트에서 돌리지 않는다. 보고 도우미(순수 함수)만 테스트한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/domestic/DomesticSimReport.test.ts`:

```ts
import {
  mean,
  milestoneVerdict,
  NationRecord,
  summarize,
} from "../../scripts/domestic-sim-report";

function record(
  personality: string,
  firstNuke: number | null,
  projectStart: number | null,
): NationRecord {
  return {
    personality,
    firstNuke,
    tier1: 5,
    tier2: 13,
    projectStart,
    projectDone: null,
    techs: 9,
    laws: 7,
  };
}

describe("domestic sim report", () => {
  test("verdicts allow the slack around the target range", () => {
    expect(milestoneVerdict(null, [18, 20], 3)).toBe("never");
    expect(milestoneVerdict(15, [18, 20], 3)).toBe("ok");
    expect(milestoneVerdict(14.9, [18, 20], 3)).toBe("below");
    expect(milestoneVerdict(23.1, [18, 20], 3)).toBe("above");
    expect(milestoneVerdict(11, [8, 10], 0)).toBe("above");
  });

  test("means ignore nations that never got there", () => {
    expect(mean([2, null, 4])).toBe(3);
    expect(mean([null])).toBeNull();
  });

  test("each milestone looks at the personalities it is about", () => {
    const rows = summarize([
      record("conqueror", 11, null),
      record("scholar", null, 19),
      record("merchant", 30, null),
    ]);
    const byLabel = new Map(rows.map((r) => [r.label, r]));
    expect(byLabel.get("first nuke (conqueror)")).toMatchObject({
      measured: 11,
      reached: 1,
      total: 1,
      verdict: "ok",
    });
    expect(byLabel.get("project start (scholar, zealot)")).toMatchObject({
      measured: 19,
      reached: 1,
      total: 1,
      verdict: "ok",
    });
    expect(byLabel.get("project done (scholar, zealot)")).toMatchObject({
      measured: null,
      verdict: "never",
    });
    expect(byLabel.get("techs per game")).toMatchObject({
      measured: 9,
      total: 3,
      verdict: "ok",
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/domestic/DomesticSimReport.test.ts --run`
Expected: FAIL — `Failed to load url ../../scripts/domestic-sim-report`

- [ ] **Step 3: 보고 도우미 작성**

`scripts/domestic-sim-report.ts`:

```ts
/** What the balance simulation records for one nation (times in game minutes). */
export interface NationRecord {
  personality: string;
  firstNuke: number | null;
  tier1: number | null;
  tier2: number | null;
  projectStart: number | null;
  projectDone: number | null;
  techs: number;
  laws: number;
}

export type Verdict = "ok" | "below" | "above" | "never";

export interface MilestoneTarget {
  label: string;
  /** Personalities the milestone is about; empty means every nation. */
  personalities: readonly string[];
  pick: (r: NationRecord) => number | null;
  target: readonly [number, number];
  /** How far outside the target range still passes (spec §1: ±3 minutes). */
  slack: number;
}

// Spec §11.2.
export const MILESTONE_TARGETS: readonly MilestoneTarget[] = [
  {
    label: "first nuke (conqueror)",
    personalities: ["conqueror"],
    pick: (r) => r.firstNuke,
    target: [10, 12],
    slack: 3,
  },
  {
    label: "government tier 1",
    personalities: [],
    pick: (r) => r.tier1,
    target: [4, 6],
    slack: 3,
  },
  {
    label: "government tier 2",
    personalities: [],
    pick: (r) => r.tier2,
    target: [12, 15],
    slack: 3,
  },
  {
    label: "project start (scholar, zealot)",
    personalities: ["scholar", "zealot"],
    pick: (r) => r.projectStart,
    target: [18, 20],
    slack: 3,
  },
  {
    label: "project done (scholar, zealot)",
    personalities: ["scholar", "zealot"],
    pick: (r) => r.projectDone,
    target: [22, 24],
    slack: 3,
  },
  {
    label: "techs per game",
    personalities: [],
    pick: (r) => r.techs,
    target: [8, 10],
    slack: 0,
  },
  {
    label: "laws per game",
    personalities: [],
    pick: (r) => r.laws,
    target: [6, 8],
    slack: 0,
  },
];

/** Average of the values that exist; null when none do. */
export function mean(values: readonly (number | null)[]): number | null {
  const seen = values.filter((v): v is number => v !== null);
  return seen.length === 0
    ? null
    : seen.reduce((a, b) => a + b, 0) / seen.length;
}

export function milestoneVerdict(
  value: number | null,
  target: readonly [number, number],
  slack: number,
): Verdict {
  if (value === null) return "never";
  if (value < target[0] - slack) return "below";
  if (value > target[1] + slack) return "above";
  return "ok";
}

export interface MilestoneRow {
  label: string;
  measured: number | null;
  /** Nations that reached the milestone / nations it is about. */
  reached: number;
  total: number;
  target: readonly [number, number];
  verdict: Verdict;
}

export function summarize(records: readonly NationRecord[]): MilestoneRow[] {
  return MILESTONE_TARGETS.map((m) => {
    const pool =
      m.personalities.length === 0
        ? records
        : records.filter((r) => m.personalities.includes(r.personality));
    const values = pool.map(m.pick);
    const measured = mean(values);
    return {
      label: m.label,
      measured,
      reached: values.filter((v) => v !== null).length,
      total: pool.length,
      target: m.target,
      verdict: milestoneVerdict(measured, m.target, m.slack),
    };
  });
}

export function formatTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const widths = headers.map((h, c) =>
    Math.max(h.length, ...rows.map((r) => r[c].length)),
  );
  const line = (cells: readonly string[]) =>
    cells.map((cell, c) => cell.padEnd(widths[c])).join("  ");
  return [line(headers), line(widths.map((w) => "-".repeat(w)))]
    .concat(rows.map(line))
    .join("\n");
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest tests/domestic/DomesticSimReport.test.ts --run`
Expected: PASS (3 tests)

- [ ] **Step 5: 시뮬레이션 스크립트 작성**

`scripts/domestic-sim.ts`:

```ts
/**
 * Domestic mode balance simulation (spec §12.3).
 *
 * Runs nations-only games with domestic mode on, one per seed, and prints
 * when each nation reached the spec §11.2 milestones, then compares the
 * averages with the targets (times may miss by up to 3 minutes). Not part
 * of the test suite: run it by hand after changing Balance.ts.
 *
 *   npx tsx scripts/domestic-sim.ts [--map world] [--seeds 3] [--minutes 30]
 *                                   [--difficulty Hard]
 */
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  GameUpdateType,
  WinUpdate,
} from "@openfront/engine-api/game/GameUpdates";
import { GameConfig, GameStartInfo } from "@openfront/engine-api/Schemas";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { simpleHash } from "@openfront/engine-lib/Util";
import { EngineConfig } from "@openfront/engine/configuration/EngineConfig";
import { Executor } from "@openfront/engine/execution/ExecutionManager";
import { nationDomesticPlan } from "@openfront/engine/execution/nation/NationPersonality";
import { Game } from "@openfront/engine/game/Game";
import { createGame } from "@openfront/engine/game/GameImpl";
import { createNationsForGame } from "@openfront/engine/game/NationCreation";
import { GameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../tests/perf/fullgame/NodeGameMapLoader";
import { formatTable, NationRecord, summarize } from "./domestic-sim-report";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_SPAWN_TURNS = 1000;
const TICKS_PER_MINUTE = 600;

interface Options {
  map: GameMapType;
  seeds: number;
  minutes: number;
  difficulty: Difficulty;
}

function resolveMap(name: string): GameMapType {
  const key = Object.keys(GameMapType).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  if (key === undefined) throw new Error(`unknown map "${name}"`);
  return GameMapType[key as keyof typeof GameMapType];
}

function resolveDifficulty(name: string): Difficulty {
  const found = Object.values(Difficulty).find(
    (d) => d.toLowerCase() === name.toLowerCase(),
  );
  if (found === undefined) throw new Error(`unknown difficulty "${name}"`);
  return found;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    map: GameMapType.World,
    seeds: 3,
    minutes: 30,
    difficulty: Difficulty.Hard,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${arg}`);
      return v;
    };
    switch (arg) {
      case "--map":
        opts.map = resolveMap(next());
        break;
      case "--seeds":
        opts.seeds = parseInt(next(), 10);
        break;
      case "--minutes":
        opts.minutes = parseInt(next(), 10);
        break;
      case "--difficulty":
        opts.difficulty = resolveDifficulty(next());
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

function newRecord(personality: string): NationRecord {
  return {
    personality,
    firstNuke: null,
    tier1: null,
    tier2: null,
    projectStart: null,
    projectDone: null,
    techs: 0,
    laws: 0,
  };
}

/** Records each nation's milestones as of now (called once per second). */
function sample(game: Game, records: Map<number, NationRecord>): void {
  const minute = game.elapsedGameSeconds() / 60;
  for (const p of game.players()) {
    if (p.type() !== PlayerType.Nation) continue;
    const d = p.domestic();
    if (d === null) continue;
    let r = records.get(p.smallID());
    if (r === undefined) {
      r = newRecord(nationDomesticPlan(p.id()).personality);
      records.set(p.smallID(), r);
    }
    const nukes =
      p.unitsConstructed(UnitType.AtomBomb) +
      p.unitsConstructed(UnitType.HydrogenBomb) +
      p.unitsConstructed(UnitType.MIRV);
    if (r.firstNuke === null && nukes > 0) r.firstNuke = minute;
    const tier = d.governmentTier();
    if (r.tier1 === null && tier >= 1) r.tier1 = minute;
    if (r.tier2 === null && tier >= 2) r.tier2 = minute;
    const project = d.victoryProject();
    if (r.projectStart === null && project !== null) r.projectStart = minute;
    if (r.projectDone === null && project?.ticksLeft === 0) {
      r.projectDone = minute;
    }
    r.techs = d.researchedTechs().size;
    r.laws = d.proclaimedLaws().size;
  }
}

async function runSeed(
  opts: Options,
  seed: number,
): Promise<{ records: NationRecord[]; win: string }> {
  const gameConfig: GameConfig = {
    gameMap: opts.map,
    gameMapSize: GameMapSize.Normal,
    gameMode: GameMode.FFA,
    gameType: GameType.Public,
    difficulty: opts.difficulty,
    nations: "default",
    donateGold: false,
    donateTroops: false,
    bots: 0,
    infiniteGold: false,
    infiniteTroops: false,
    instantBuild: false,
    randomSpawn: false,
    domesticMode: true,
  };
  const gameStart: GameStartInfo = {
    gameID: `domestic-sim-${seed}`,
    lobbyCreatedAt: 0,
    config: gameConfig,
    players: [],
  };
  const terrain = await loadTerrainMap(
    await loadMapFiles(
      new NodeGameMapLoader(path.join(ROOT, "resources/maps")),
      gameConfig.gameMap,
      gameConfig.gameMapSize,
    ),
  );
  const nations = createNationsForGame(
    gameStart,
    terrain.nations,
    terrain.additionalNations,
    0,
    new PseudoRandom(simpleHash(gameStart.gameID)),
  );
  const game = createGame(
    [],
    nations,
    terrain.gameMap,
    terrain.miniGameMap,
    new EngineConfig(gameConfig, false),
    terrain.teamGameSpawnAreas,
  );

  const result: { win: WinUpdate | null; error: string | null } = {
    win: null,
    error: null,
  };
  const runner = new GameRunner(
    game,
    new Executor(game, gameStart.gameID, undefined),
    (gu) => {
      if ("errMsg" in gu) {
        result.error = `${gu.errMsg}\n${gu.stack ?? ""}`;
        return;
      }
      result.win ??= gu.updates[GameUpdateType.Win][0] ?? null;
    },
  );
  runner.init();

  let turn = 0;
  const step = (): void => {
    runner.addTurn({ turnNumber: turn++, intents: [] });
    if (!runner.executeNextTick() || result.error !== null) {
      throw new Error(`game errored at tick ${game.ticks()}:\n${result.error}`);
    }
  };
  while (game.inSpawnPhase()) {
    if (turn >= MAX_SPAWN_TURNS) throw new Error("spawn phase did not end");
    step();
  }

  const records = new Map<number, NationRecord>();
  let win = "none";
  for (let i = 0; i < opts.minutes * TICKS_PER_MINUTE; i++) {
    step();
    if (game.ticks() % 10 === 0) sample(game, records);
    if (result.win !== null && win === "none") {
      const minute = (game.elapsedGameSeconds() / 60).toFixed(1);
      win = `${result.win.reason ?? "?"} at ${minute} min`;
    }
  }
  return { records: [...records.values()], win };
}

function fmt(v: number | null): string {
  return v === null ? "-" : v.toFixed(1);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  console.debug = () => {}; // silence per-tick debug logging
  const all: NationRecord[] = [];
  for (let seed = 1; seed <= opts.seeds; seed++) {
    console.log(
      `\n=== seed ${seed}/${opts.seeds}: ${opts.map}, ${opts.difficulty}, ${opts.minutes} min ===`,
    );
    const { records, win } = await runSeed(opts, seed);
    all.push(...records);
    console.log(`winner: ${win}`);
    console.log(
      formatTable(
        ["personality", "nuke", "tier1", "tier2", "start", "done", "techs", "laws"],
        records.map((r) => [
          r.personality,
          fmt(r.firstNuke),
          fmt(r.tier1),
          fmt(r.tier2),
          fmt(r.projectStart),
          fmt(r.projectDone),
          String(r.techs),
          String(r.laws),
        ]),
      ),
    );
  }

  console.log(`\n=== targets (spec §11.2), ${all.length} nations ===`);
  console.log(
    formatTable(
      ["milestone", "measured", "reached", "target", "verdict"],
      summarize(all).map((row) => [
        row.label,
        fmt(row.measured),
        `${row.reached}/${row.total}`,
        `${row.target[0]}-${row.target[1]}`,
        row.verdict,
      ]),
    ),
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 6: 타입 검사 대상에 넣기**

`tsconfig.json`의 `include` 배열에서 `"scripts/split-packages",` 뒤에 추가:

```json
    "scripts/domestic-sim.ts",
    "scripts/domestic-sim-report.ts",
```

- [ ] **Step 7: 확인(짧은 실행)**

Run: `npm run typecheck && npx eslint scripts/domestic-sim.ts scripts/domestic-sim-report.ts && npx tsx scripts/domestic-sim.ts --seeds 1 --minutes 1`
Expected: typecheck·eslint 오류 없음. 스크립트는 `=== seed 1/1: ...` 다음에 국가별 표와 `=== targets (spec §11.2), N nations ===` 표를 출력하고 0으로 끝난다(1분이라 대부분 `never`/`below`).

- [ ] **Step 8: 커밋**

```bash
npx prettier --write scripts/domestic-sim.ts scripts/domestic-sim-report.ts tsconfig.json tests/domestic/DomesticSimReport.test.ts
git add scripts/domestic-sim.ts scripts/domestic-sim-report.ts tsconfig.json tests/domestic/DomesticSimReport.test.ts
git commit -m "feat(domestic): balance simulation script with milestone report"
```

---

### Task 15: 전체 검증과 실제 실행 확인

**Files:** 없음(문제가 나오면 해당 Task 파일 수정)

- [ ] **Step 1: 전체 테스트, 타입, 린트**

Run: `npm test 2>&1 | tail -15 && npm run typecheck && npm run lint`
Expected: 모든 테스트 PASS, typecheck·lint 오류 없음. 원작 테스트가 하나라도 깨지면 내정 모드가 꺼진 경로가 원작과 달라진 것이다. 해당 Task로 돌아가 고친다.

- [ ] **Step 2: 실제 게임 실행 확인**

`run-openfront` 스킬로 개발 서버를 띄운다. 싱글플레이에서 "내정 모드"를 켜고(타이머는 비워 둔다) 다음을 확인한다:
1. 설정 화면에서 내정 모드를 켜면 최대 타이머가 30으로 켜지고, 연장전 카드가 사라지고, "정복 기준 %" 카드가 생긴다.
2. 게임 중 오른쪽 타이머가 30:00부터 줄어든다.
3. 순위표에 점수 열이 땅 열 앞에 있고 점수순으로 정렬된다. 내정 모드를 끈 판에는 점수 열이 없다.
4. 국정 패널의 승리 탭에 정복 %, 두 프로젝트의 비용·조건·착수 버튼(레벨 3 이상 건물이 없으면 안내 문구), 내 점수와 순위, 남은 시간, 진행 중인 프로젝트 목록이 보인다.
5. 최대 타이머를 1분으로 둔 판이 끝나면 승리 화면 제목 아래에 "점수 승리"가 보인다.
6. (선택) 호스트 로비에서 무한 금·즉시 건설로 연구소를 레벨 3까지 올리고 우주 개발을 연구한 뒤 우주 계획을 착수하면, 이벤트 창에 착수 알림이 뜨고 건물에 금색 고리와 진행 막대가 보인다.

결과(스크린샷 포함)를 기록한다. 문제가 있으면 해당 Task로 돌아가 고친 뒤 이 Task를 다시 한다.

- [ ] **Step 3: 밸런스 시뮬레이션 실행**

Run: `npx tsx scripts/domestic-sim.ts --seeds 3`
Expected: 끝까지 오류 없이 돈다. 출력의 targets 표를 기록한다. `below`/`above`/`never`인 항목은 `Balance.ts` 수치 조정 후보로 남긴다(이 계획에서는 수치를 바꾸지 않는다).

- [ ] **Step 4: 마무리 커밋(수정이 있었다면)**

```bash
git status --short
git add -A
git commit -m "fix(domestic): issues found in phase 3 verification"
```

수정이 없었다면 이 단계는 건너뛴다.
