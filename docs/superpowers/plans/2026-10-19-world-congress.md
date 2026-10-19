# 세계 의회 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로비 옵션 하나(`congress`, 내정 모드 + FFA에서만 동작, 로비에서 내정 모드를 켜면 기본 켬)로 3분마다 열리는 비밀 투표 정기 회기, 영향력, 결의 14종과 프로젝트 안건 2종(엔진 강제), 소집해야 열리는 드문 비상, 의회 비준이 필요한 정치 승리, AI 투표·소집·행동, 화면(다이얼, 카드, 띠, 서랍, 순위표), 번역까지 넣는다. 옵션이 꺼진 모든 게임은 비트 단위로 지금과 같다.

**Architecture:** 게임 전체 상태는 `GameImpl`이 가진 `Congress` 하나(회기·투표함·현행 결의·비상·장부의 나라 쌍·기록)에, 나라별 상태(영향력, 침략 장부 고리 버퍼, 내 투표)는 `PlayerCongress`에 두고, 둘 다 스냅샷 선택 키와 업데이트(`GameUpdateType.Congress`, `PlayerUpdate.congress`)로 나간다. 게임 시계 `CongressExecution` 하나가 회기를 열고 닫고 매초 영향력·비상·효과를 돌린다. 결의의 효과는 엔진 곳곳의 짧은 연결 코드가 `congress/Effects.ts`·`Conflict.ts`·`WorldGovernment.ts`의 읽기 함수를 부르는 방식이고, 내정 보정값 효과는 `PlayerDomestic.setCongressModifiers`로 내정 합산에 그대로 들어가 화면도 같은 숫자를 본다. 기반 Task가 모든 공유 타입·명령·업데이트·상태 클래스·연결 지점과 **최종 시그니처를 가진 빈 함수(스텁)** 를 먼저 만들어서, 이후 갈래는 각자 자기 파일만 채운다.

**Tech Stack:** TypeScript 6, Vitest 4, zod + zbin, Lit + Tailwind 4, WebGL2, jq

**Spec:** `docs/superpowers/specs/2026-10-19-world-congress-design.md` (이 계획과 같은 커밋). spec에서 *(내 판단)*으로 표시한 항목은 모두 확정 사항이며 그대로 구현한다. spec에 없는 구현 결정은 아래 "결정 사항"이 정한다.

---

## 시작 전에 (환경)

- 작업 위치는 git worktree `/home/eser/dev/OpenFrontIO-wc`(브랜치 `world-congress`, 시작 커밋 `c15d18e17`)다. 내정 모드, 확장 전쟁, 전략 무기, 태블릿 UI가 모두 들어 있다.
- **`/home/eser/dev/OpenFrontIO`에는 손대지 않는다.** 그 checkout에서 실제 서버가 3000~3002와 9000 포트로 돌고 있다. 이 계획의 어떤 명령도 그 포트를 열거나 그 서버에 요청하지 않는다(화면 확인은 Task 15의 포트 9400).
- `git stash`, `git reset --hard`, `git checkout -- .`, `git clean`은 쓰지 않는다. 권한 시스템이 git 명령을 막으면 우회하지 말고 보고한다.
- 의존성이 없으면 `npm ci --ignore-scripts --engine-strict=false`로 설치한다(`npm install` 금지).
- 단일 테스트: `npx vitest tests/congress/<File>.test.ts --run`
- 커밋 전에 바꾼 파일에 `npx prettier --write <files>`를 실행한다. 커밋 메시지는 항상 다음 줄로 끝낸다:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
- 병렬 갈래(아래 "병렬 실행 그룹")는 앞 그룹을 `world-congress`에 합친 뒤 갈래마다 `git worktree add ../OpenFrontIO-wc-<갈래> -b wc-<갈래> world-congress`로 따로 만들고, 끝나면 `world-congress`에서 `git merge --no-ff wc-<갈래>`로 합친 다음 `git worktree remove ../OpenFrontIO-wc-<갈래>`로 지운다. 각 갈래는 자기 Task의 **Files**에 적힌 파일만 고치므로 합칠 때 충돌이 없다.
- 새 worktree에는 `node_modules`가 없다. 갈래 worktree에서 `npm ci --ignore-scripts --engine-strict=false`를 한 번 실행한다.

## 결정 사항 (spec 밖의 구현 결정)

1. **상태 위치:** 게임 전체 상태는 `packages/engine/src/congress/Congress.ts`의 `Congress`(GameImpl이 생성자에서 `config.congress()`일 때만 만든다), 나라별 상태는 `PlayerCongress.ts`의 `PlayerCongress`(의회가 켜진 게임의 봇이 아닌 플레이어). `game.congress()`, `player.congress()`가 null이면 의회가 없는 게임이다.
2. **투표함:** 표의 원본은 각 나라의 `PlayerCongress`(맡긴 영향력 `costMilli` 포함)에 있고, 회기 항목은 투표 수(`voters`)만 센다. 집계는 `mg.allPlayers()` 순서로 표를 모은다(죽은 나라의 표도 센다). 비밀 투표: `CongressData`에는 투표 수와 합계만, `PlayerCongressData.ballots`에는 그 나라의 표만 있고, 화면은 내 것만 그린다.
3. **결의 표현:** 채택된 결의와 비상 결과는 모두 `ActiveResolution { resolution, option, targets, param, sinceTick, expires, source }` 목록 하나에 들어간다. `expires`는 `"next_tally"`(다음 정기 집계에서 끝), `"project_end"`(세계 유산 A), 틱 숫자(휴전·결전 120초, 비상 뒤 휴전 60초, 핵 비상 성공 금지 5분). 비상 결과의 인코딩:
   - 침략 비상 성공 → `{sanction, A, [대상], null, next_tally, emergency}`
   - 핵 비상 성공 → `{arms_embargo, A, [대상], null, now+3000, emergency}`
   - 패권 비상 실패 → `{emergency, B, [대상], "hegemony", next_tally, emergency}` (효과: 금 수입 +10%)
   - 비상 뒤 휴전 → 회원마다 `{truce, A, [대상, 회원], null, now+600, emergency}`
   - 세계 정부 승인은 한 번에 끝나는 효과라 목록에 넣지 않고 `Congress.verdict(owner)`에 판정을 둔다.
4. **효과 읽기 함수:** 엔진 연결 지점은 모두 `congress/Effects.ts`(보정값, 무역·기부, 건설·구매 금지, 비용·시간, 연구), `congress/Conflict.ts`(휴전, 전투 배율, 세계 유산 보호), `congress/WorldGovernment.ts`(승인 효과, 비준 대기, AI 견제)의 함수를 부른다. 결의별 숫자와 금지 목록은 순수 함수로 `packages/engine-lib/src/congress/ResolutionEffects.ts`에 두어 화면도 같은 함수를 쓴다.
5. **스텁:** Task 1이 갈래 파일(`Ledger.ts`, `Influence.ts`, `Sessions.ts`, `Effects.ts`, `Conflict.ts`, `WorldGovernment.ts`, `Emergencies.ts`, `engine-lib/congress/ResolutionEffects.ts`)을 최종 시그니처와 중립 값(아무것도 안 함, `false`, `0`, 입력 그대로)으로 만들고 연결 지점을 모두 꽂는다. 스텁 상태에서 의회를 켠 게임은 회기가 열리지 않고 효과도 없다. 갈래는 자기 스텁 파일의 본문만 채운다.
6. **보정값 주입:** `PlayerDomestic.setCongressModifiers(mods)`(값이 같으면 아무것도 안 함)가 내정 합산(`domesticModifiers(techs, laws, government, congress)`)에 더하고, `DomesticData.congressModifiers`(값이 있을 때만)로 화면의 `DomesticClientView`도 같은 합을 만든다. 의회 시계가 매초 `refreshCongressEffects`에서 넣는다(채택 뒤 최대 1초 늦음).
7. **조건 `aggressing`:** `CONDITIONS` 맨 뒤에 더한다. `activeConditions(player, maxTroops, aggressing)`의 세 번째 인자로 들어오고, 의회가 켜진 게임에서만 `isAggressing`으로 계산한다.
8. **세계 유산 보호 건물의 칸:** 보호 건물은 지워지지 않을 뿐 아니라 그 건물이 선 칸도 핵·융단 폭격·위성 포격에 주인을 잃지 않는다(건물이 주인 없는 칸에 남는 일을 막는다). 위성 포격은 보호 건물 주변 반경 3칸(건물 자리 크레이터 크기)을 바다로 만들지 않는다.
9. **시계 순서(매 틱):** 열린 회기가 마감 틱이면 집계 → 정기면 `dropTallyResolutions` 뒤 결과마다 `onRegularResult`, 긴급이면 `onEmergencyVote` → 열린 회기가 없고 승자가 없고 예정 틱이 지났으면 `openRegularSession` 뒤 다음 예정 = 이전 예정 + 1,800 → 매초(`tick % 10 === 0`) `expireResolutions`, `prunePairs`, `accrueInfluence`, `processEmergencySecond`, `refreshCongressEffects`, `refreshRanking` → 데이터가 바뀌었으면 `CongressUpdate`. 시계는 GameRunner가 `DomesticExecution`, `StrategicExecution` 다음, `WinCheckExecution` 앞에 넣으므로 같은 초의 내정 처리 뒤에 돈다.
10. **PRNG:** `CongressExecution(seed)`가 `new PseudoRandom(seed)`를 가지고, GameRunner는 `simpleHash(gameID) + 7919`를 넘긴다. 테스트 유틸은 1. 안보 칸의 전 세계 안건, 경제 칸 종류, E1 대상, E6 대상에만 굴린다(같은 순서).
11. **AI 표:** AI는 `nationCongressTick`(국가 Execution의 매 틱, 상태·PRNG 없음)이 정확히 `openTick + 10 + (smallID×7 mod 70)` 틱에 항목마다 `CongressVoteExecution`을 한 번 넣는다. 소집은 `tick % 10 === smallID % 10`인 틱에만 검사한다.
12. **메시지:** 새 `MessageType.CONGRESS`(맨 뒤, 분류 ALLIANCE, 색 warn) 하나를 쓴다. 문구의 나라 이름은 `name`(+`focusPlayerID`)과 `targetID`(smallID)로 보내 화면이 익명 설정으로 다시 고친다. 키와 매개변수는 Task 9 표 그대로다.
13. **와이어·스냅샷:** 새 인텐트 2개(`congress_vote`, `convene_emergency`), `GameConfig.congress`, `GameUpdateType.Congress`, `MessageType.CONGRESS`, 조건 `aggressing`은 각 목록의 맨 뒤에 붙인다. 새 Execution 3개(`Congress`, `CongressVote`, `ConveneEmergency`)를 `ExecutionRegistry`에 이름순으로 등록한다. 스냅샷 새 키(`GameSnapshot.congress`, `PlayerSnapshot.congress`, `DomesticState.congressModifiers`)는 선택 키이고 값이 없으면 쓰지 않는다. 버전은 올리지 않는다(선택 키만 더하는 이전 Task들과 같다).
14. **해시:** 의회가 켜진 게임만 `GameImpl.hash()`에 `Congress.hash()`(데이터 요약의 `simpleHash`)를, `PlayerImpl.hash()`에 `PlayerCongress` 스냅샷 요약을 더한다.

## Global Constraints

- **옵션 끔 = 지금과 비트 단위로 같음:** `congress`가 없거나 거짓인 게임, 내정 모드 없이 `congress: true`인 게임, 팀전은 의회 상태·시계·PRNG·업데이트·스냅샷 키·조건을 하나도 만들지 않는다. `tests/VanillaDigest.test.ts`의 기존 고정값(`c330352312204618`, `cc52cbbfd8b1a3bc`, `a7dac00d9005a3ad`, `7ab01036826a4a06`, `dddf7fe292970133`, `091085284bca29e0`)과 Task 1이 더하는 고정값이 그대로 통과해야 한다. 기존 FullGameSnapshot 변형, `tests/NationGoldPerMinute.test.ts` 스냅샷도 그대로다.
- **결정성:** `packages/engine*`에서 `Math.random`, `Date.now`, `new Date`, `Math.pow/exp/log/sin/cos/atan2…`, 2가 아닌 지수의 `**`를 쓰지 않는다(`Math.sqrt/floor/ceil/round/min/max/abs`는 허용). 무작위는 결정 사항 10의 PRNG만. 영향력은 정수 밀리포인트.
- **와이어는 뒤에만 추가:** 결정 사항 13. 스키마 한계는 `engine-api/congress/CongressTypes.ts`의 `MAX_EXTRA_VOTES`(5), `MAX_AGENDA_ITEMS`(3).
- **스냅샷:** 새 Execution은 `snapshot`/`restoreSnapshot`을 갖고 레지스트리에 등록한다. `restoreSnapshot`/`restoreState`는 모든 필드를 직접 대입하고 다른 객체의 메서드를 부르지 않는다. 캐시 필드(`congressDataCache`, `lastSentCongressData`, `congressPlayerDataCache`)는 `tests/util/Snapshot.ts`의 `DERIVED_FIELDS`에 넣는다.
- **패키지 경계(`tests/LayerBoundaries.test.ts`):** `engine-api`는 zod/zbin/resources만, `engine-lib`는 여기에 `engine-api`, `engine`은 여기에 `engine-lib`. `src/client`는 `engine`을 import하지 않는다. 화면 코드는 모두 게임 클라이언트 쪽이다(홈 화면 청크 규칙 위반 없음).
- **비밀 투표:** 어떤 화면도 누가 무엇을 찍었는지, 다른 나라의 영향력을 그리지 않는다. 투표 중 카드에는 투표 수만, 마감 뒤에는 합계만.
- **화면 문구:** 모두 `translateText()`를 거치고 키는 `resources/lang/en.json`(키 정렬 필수)과 `resources/lang/ko.json` 둘 다에 넣는다. 다른 언어 파일은 건드리지 않는다.
- **화면 크기와 조작:** §14d 원작 크기(다이얼 `size-11`, 버튼 글자 `text-xs`~`text-sm`). 전체 화면을 덮는 창, 화면 흔들림 없음. 호버로만 보이는 정보 없음(`title` 금지). 투표와 소집은 한 번 탭(spec §9.2, §12). 카드와 띠는 지도 가운데와 공격 비율 슬라이더를 가리지 않는다.
- **엔진 변경에는 테스트가 따른다**(CLAUDE.md). 테스트는 `tests/util/Setup.ts`의 실제 게임으로 하고 목(mock)을 쓰지 않는다(화면 테스트의 가짜 GameView는 예외).
- **파일 소유:** 각 Task는 자기 **Files**의 파일만 고친다. 다른 갈래 파일이 필요하면 그 Task의 **Interfaces**에 적힌 이름만 쓴다.

## Review Focus

1. **마감 직전·직후의 표:** 마감 틱 전에 처리된 추가 표는 세고, 지난 회기 번호로 온 표는 버리며 영향력도 빠지지 않아야 한다. 테스트: Task 1 `tests/congress/BallotBox.test.ts` "a ballot for a closed or earlier session is refused and costs nothing".
2. **휴전이 걸리는 순간 진행 중인 공격과 바다 위 수송선:** 공격은 손실 없이 병력을 돌려받고, 수송선은 돌아가 25% 손실 없이 병력을 돌려받으며, 막힌 새 공격은 금수·관계 변화를 남기지 않아야 한다. 테스트: Task 5 `tests/congress/Truce.test.ts` "a truce pulls running attacks back whole", "a boat at sea turns back and lands home whole", "a blocked attack leaves no embargo or grudge".
3. **비상 도중 대상이 죽거나 회원이 대상과 동맹을 맺음:** 대상이 죽으면 성공으로 끝나고, 동맹이 된 회원은 더 공격할 수 없을 뿐 오류가 없어야 한다. 테스트: Task 6 `tests/congress/Emergencies.test.ts` "the target dying ends the emergency as a success", "a member that allies with the target stays a member and nothing breaks".
4. **비준 대기 중의 세계 정부:** 승인 없이 100%가 되면 이기지 않고 기다리며, 그동안 행정청을 잃으면 실패하고, 기다리는 프로젝트에 승인이 채택되면 그 초에 이긴다. 테스트: Task 5 `tests/congress/WorldGovernment.test.ts` "a proclamation that completes unratified waits instead of winning", "losing the office while waiting fails the project", "approval of a waiting proclamation wins at the next win check".
5. **의회를 명시적으로 끄거나 내정 없이·팀전에서 켠 게임:** 지금과 비트 단위로 같아야 한다. 테스트: Task 1 `tests/VanillaDigest.test.ts` 새 고정값 3개와 `tests/congress/CongressOption.test.ts` "off outside domestic FFA".

## 병렬 실행 그룹

- **그룹 0 — Task 1(기반):** 모든 갈래의 선행 조건. 다른 갈래가 쓰는 타입·이름·시그니처는 Task 1의 **Interfaces**가 정한다. 혼자 한다.
- **그룹 1 (Task 1을 합친 뒤 동시에, worktree 6개):**
  - 갈래 A (엔진 회기, 차례로): **Task 2 → Task 3** (`congress/Ledger.ts`, `Influence.ts`, `Sessions.ts`)
  - 갈래 B (엔진 효과, 차례로): **Task 4 → Task 5** (`congress/Effects.ts`, `Conflict.ts`, `WorldGovernment.ts`, `engine-lib/congress/ResolutionEffects.ts`, 그리고 효과 연결 지점이 있는 기존 엔진 파일들)
  - 갈래 C (비상): **Task 6** (`congress/Emergencies.ts`, `MIRVExecution.ts`, `StrikeWaves.ts`)
  - 갈래 T (번역): **Task 9** (`resources/lang/*`)
  - 갈래 L (로비): **Task 10**
  - 갈래 E1 (화면, 차례로): **Task 11 → Task 12** (화면 모델, 다이얼, 서랍, 카드, 띠). 엔진은 스텁이어도 된다: 화면 테스트는 가짜 데이터로 한다.
- **그룹 2 (그룹 1을 모두 합친 뒤 동시에):**
  - 갈래 D (AI, 차례로): **Task 7 → Task 8** — 회기(A), 효과(B), 비상(C)의 실제 동작을 쓴다.
  - 갈래 E2 (화면): **Task 13** — 순위표 칸, 금지 문구, 연구 할인, 이벤트 문구, 지도 맥박. 화면 모델(E1)과 `ResolutionEffects`의 실제 금지 규칙(B)을 쓴다.
- **그룹 3 — Task 14(스냅샷 변형과 스크립트):** AI 표(D)까지 합친 뒤.
- **그룹 4 — Task 15(전체 검증):** 모두 합친 뒤 마지막.

| 기존 파일 | 고치는 Task |
|---|---|
| `engine-api/*`, `engine-lib/configuration/Config.ts`, `engine-lib/domestic/Policies.ts`, `engine/domestic/PlayerDomestic.ts`, `engine/game/{Game,GameImpl,PlayerImpl,GameUpdateUtils}.ts`, `engine/execution/{ExecutionManager,NukeExecution}.ts`(핵 점수 한 줄), `engine/snapshot/ExecutionRegistry.ts`, `engine/GameRunner.ts`, `src/server/ConfigPatch.ts`, `src/client/{view/PlayerView,view/GameView,view/DomesticClientView,Transport,Utils}.ts` | 1 |
| `engine/configuration/EngineConfig.ts`, `engine/execution/ConstructionExecution.ts`, `engine/strategic/NukeProductionExecution.ts`, `engine/domestic/{DomesticEconomy,ResearchExecution}.ts` | 4 |
| `engine/execution/{AttackExecution,TransportShipExecution,NukeExecution}.ts`(보호), `engine/strategic/{Satellite,OrbitalStrike,ConventionalMissileExecution}.ts`, `engine/warfare/BombingExecution.ts`, `engine/domestic/{VictoryProjects,DomesticWinCheck}.ts` | 5 |
| `engine/execution/MIRVExecution.ts`, `engine/strategic/StrikeWaves.ts` | 6 |
| `engine/execution/NationExecution.ts` | 7 |
| `engine/execution/utils/AiAttackBehavior.ts`, `engine/execution/nation/NationDomesticBehavior.ts` | 8 |
| `resources/lang/en.json`, `ko.json` | 9 |
| `src/client/{SinglePlayerModal,HostLobbyModal}.ts`, `src/client/utilities/LobbySettingsSummary.ts` | 10 |
| `src/client/hud/domestic/{Dial,DomesticDials,DomesticEvents}.ts`, `tests/client/{DomesticDials,DomesticDrawer}.test.ts` | 11 |
| `src/client/hud/domestic/DomesticPanel.ts` | 11, 13(`researchContext` 한 줄, 그룹 2라 겹치지 않는다) |
| `index.html`, `src/client/hud/GameRenderer.ts`, `tests/client/HudLayout.test.ts`, `tests/client/graphics/GameRendererCreate.test.ts` | 12 |
| `src/client/{StatsConstants,WebGLFrameBuilder}.ts`, `src/client/components/StatsTable.ts`, `src/client/hud/layers/{lib/StatsColumns,GameLeftSidebar,UnitDisplay,BuildMenu,RadialMenuElements,EventsDisplay}.ts`, `src/client/hud/domestic/{DomesticStatus,ResearchScreen}.ts`, `src/client/render/gl/{MapRenderer,Renderer}.ts`, `src/client/render/gl/passes/StrategicFxPass.ts`, `tests/client/UnitDisplayHotbar.test.ts`, `tests/client/graphics/layers/BuildMenuReasons.test.ts`, `tests/client/render/gl/StrategicFxPass.test.ts` | 13 |
| `tests/core/snapshot/FullGameSnapshot.test.ts` | 1(의회 전용 목록), 14(변형) |
| `tests/VanillaDigest.test.ts` | 1(끈 고정값), 14(켬 고정값) |
| `tests/util/ScriptedGame.ts` | 14 |
| `scripts/domestic-sim.ts` | 15 |

새 파일은 만든 Task가 가진다. `tests/client/CongressFixture.ts`는 Task 11이 만들고 Task 12가 가짜 게임을 더한다(같은 갈래).

---

## File Structure

| 파일 | 책임 |
|---|---|
| `packages/engine-api/src/congress/CongressTypes.ts` (새) | id 목록, 결의 메타(분류, 대상 종류, 유리한 쪽), 데이터 모양(`CongressData`, `PlayerCongressData` …), 스키마 한계, 건설 협정·무역 협정 매개값 |
| `packages/engine-api/src/{Schemas,game/GameUpdates,game/GameTypes,domestic/DomesticTypes}.ts` (수정) | 옵션, 인텐트 2개, 업데이트, 메시지 종류, `BuildableUnit.banned`, 조건 `aggressing`, `DomesticData.congressModifiers` |
| `packages/engine-lib/src/congress/CongressBalance.ts` (새) | spec §15의 모든 수치, 추가 표 비용, 장부 칸, 핵 점수, 군사 법 목록 |
| `packages/engine-lib/src/congress/Ring.ts` (새) | 10초 칸 고리 버퍼(순수, 스냅샷 그대로) |
| `packages/engine-lib/src/congress/Voting.ts` (새) | 투표·소집 가능 판정, 집계(엔진과 화면 공용) |
| `packages/engine-lib/src/congress/ResolutionEffects.ts` (새, Task 4가 채움) | 결의별 보정값, 금지, 비용·시간 배율(엔진과 화면 공용) |
| `packages/engine-lib/src/{configuration/Config,domestic/Policies}.ts` (수정) | `congress()`, 보정값 합산에 의회 목록 |
| `packages/engine/src/congress/Congress.ts` (새) | 게임 상태, 투표함, 결의 목록, 비상·쌍·기록 저장, 데이터·스냅샷·해시 |
| `packages/engine/src/congress/PlayerCongress.ts` (새) | 영향력, 장부 고리 버퍼, 최근 나를 친 나라, 내 표 |
| `packages/engine/src/congress/Metrics.ts` (새) | 침략·피해·전쟁 쌍·땅 지표 |
| `packages/engine/src/congress/{CongressExecution,CongressVoteExecution,ConveneEmergencyExecution}.ts` (새) | 시계, 투표 명령, 소집 명령 |
| `packages/engine/src/congress/Ledger.ts`, `Influence.ts` (새, Task 2) | 장부 기록, 먼저 공격 중, 영향력 쌓기 |
| `packages/engine/src/congress/Sessions.ts` (새, Task 3) | 의석, 안건 고르기, 정기 결과 적용, 메시지 |
| `packages/engine/src/congress/Effects.ts` (새, Task 4) | 보정값 주입, 무역·기부·금지·비용·시간·연구 |
| `packages/engine/src/congress/Conflict.ts`, `WorldGovernment.ts` (새, Task 5) | 휴전, 전투 배율, 세계 유산 보호, 세계 정부 승인과 비준 |
| `packages/engine/src/congress/Emergencies.ts` (새, Task 6) | 소집 가능, 소집, 투표 결과, 진행·끝, 핵 점수, 멸망 |
| `packages/engine/src/execution/nation/NationCongressBehavior.ts` (새, Task 7) | AI 투표·소집, AI 행동 도우미 |
| `packages/engine/src/{game,execution,domestic,strategic,warfare}/*` (수정) | 연결 코드(위 표) |
| `src/client/hud/congress/CongressModel.ts` (새, Task 11) | 화면 모델(다이얼, 카드, 칩, 남은 시간, 제목·근거 문구, 소집 가능 판정, 순위표 표시) |
| `src/client/hud/congress/CongressScreen.ts` (새, Task 11) | 서랍의 의회 화면 |
| `src/client/hud/congress/CongressCards.ts` (새, Task 12) | `<congress-cards>` 투표 카드, 결과 도장, 결의 칩 |
| `src/client/hud/congress/CongressBand.ts` (새, Task 12) | `<congress-band>` 위쪽 띠: 결과 배너·소리, 소집 버튼, 긴급 투표, 진행 중인 비상 |
| `src/client/hud/congress/BanLabels.ts` (새, Task 13) | 금지 문구, 핵 제조 금지 판정 |
| `src/client/*` (수정) | 다이얼, 서랍, 로비, 순위표, 잠금, 연구 비용, 이벤트, 지도 맥박 |
| `resources/lang/en.json`, `ko.json` (수정) | 문구 |
| `tests/congress/*.test.ts`, `tests/congress/util.ts` (새), `tests/client/Congress*.test.ts` (새), 기존 테스트 일부 (수정) | 테스트 |

---
### Task 1: 기반 — 옵션, 타입·명령·업데이트, 상태 클래스, 시계, 스텁, 연결 지점

**Files:**
- Create: `packages/engine-api/src/congress/CongressTypes.ts`
- Modify: `packages/engine-api/src/Schemas.ts` (`GameConfigSchema.congress`, 인텐트 2개), `packages/engine-api/src/game/GameUpdates.ts` (`GameUpdateType.Congress`, `CongressUpdate`, `PlayerUpdate.congress`), `packages/engine-api/src/game/GameTypes.ts` (`MessageType.CONGRESS`, 분류, `BuildableUnit.banned`), `packages/engine-api/src/domestic/DomesticTypes.ts` (조건 `aggressing`, `DomesticData.congressModifiers`)
- Create: `packages/engine-lib/src/congress/CongressBalance.ts`, `Ring.ts`, `Voting.ts`, `ResolutionEffects.ts`(스텁)
- Modify: `packages/engine-lib/src/configuration/Config.ts` (`congress()`), `packages/engine-lib/src/domestic/Policies.ts` (`domesticModifiers`의 네 번째 인자)
- Create: `packages/engine/src/congress/Congress.ts`, `PlayerCongress.ts`, `Metrics.ts`, `CongressExecution.ts`, `CongressVoteExecution.ts`, `ConveneEmergencyExecution.ts`
- Create (스텁): `packages/engine/src/congress/Ledger.ts`, `Influence.ts`, `Sessions.ts`, `Effects.ts`, `Conflict.ts`, `WorldGovernment.ts`, `Emergencies.ts`
- Modify: `packages/engine/src/domestic/PlayerDomestic.ts`, `packages/engine/src/game/Game.ts`, `GameImpl.ts`, `PlayerImpl.ts`, `GameUpdateUtils.ts`, `packages/engine/src/execution/NukeExecution.ts`(핵 점수 한 줄), `ExecutionManager.ts`, `packages/engine/src/snapshot/ExecutionRegistry.ts`, `packages/engine/src/GameRunner.ts`
- Modify: `src/server/ConfigPatch.ts`, `src/client/view/PlayerView.ts`, `src/client/view/GameView.ts`, `src/client/view/DomesticClientView.ts`, `src/client/Transport.ts`, `src/client/Utils.ts`
- Create: `tests/congress/util.ts`
- Test: `tests/congress/CongressOption.test.ts`, `tests/congress/BallotBox.test.ts`, `tests/congress/Voting.test.ts`
- Modify (test): `tests/VanillaDigest.test.ts`, `tests/zbin/wire.test.ts`, `tests/server/ConfigPatch.test.ts`, `tests/util/Snapshot.ts` (`DERIVED_FIELDS`), `tests/core/snapshot/FullGameSnapshot.test.ts` (의회 전용 Execution 목록)

**Interfaces:**
- Consumes: `setup`(`tests/util/Setup.ts`), `own`, `RED`, `BLUE`, `NATION`(`tests/warfare/util.ts`), `expectSnapshotRoundTrip`(`tests/util/Snapshot.ts`), `domesticModifiers`, `ModifierTotals`, `MILLI`
- Produces (다른 모든 Task가 쓴다, 이름 그대로):
  - `engine-api/congress/CongressTypes.ts`: `RESOLUTION_IDS`/`ResolutionId`, `BALLOT_OPTIONS`/`BallotOption`, `RESOLUTION_META`(`category`, `target`, `favorable`), `EMERGENCY_KINDS`/`EmergencyKind`, `SESSION_KINDS`/`SessionKind`, `AGENDA_REASONS`/`AgendaReason`, `INFLUENCE_STATUSES`/`InfluenceStatus`, `ResolutionExpiry`, `MAX_EXTRA_VOTES`(5), `MAX_AGENDA_ITEMS`(3), `BUILDING_PACT_UNITS`(`{key, type}` 10개), `TRADE_PACT_KINDS`/`TradePactKind`, 데이터 `AgendaItemData`, `SessionData`, `ResultData`, `ActiveResolutionData`, `EmergencyData`, `AvailableEmergencyData`, `RankEntry`, `WorldGovVerdictData`, `CongressData`, `BallotData`, `PlayerCongressData`
  - `GameConfig.congress?: boolean`, `Config.congress(): boolean`(= 내정 모드 && `congress === true` && FFA)
  - 인텐트 `{ type: "congress_vote"; session: number; item: number; option: BallotOption; extra: number }`(`CongressVoteIntent`), `{ type: "convene_emergency"; kind: EmergencyKind; target: PlayerID }`(`ConveneEmergencyIntent`)
  - `GameUpdateType.Congress`, `CongressUpdate { type; data: CongressData }`, `PlayerUpdate.congress?: PlayerCongressData`, `MessageType.CONGRESS`, `BuildableUnit.banned?: boolean`, 조건 `"aggressing"`, `DomesticData.congressModifiers?: Modifier[]`
  - `engine-lib/congress/CongressBalance.ts`: Step 6의 상수 전부, `extraVoteCost(extra)`, `extraVoteCostMilli(from, to)`, `ledgerBucket(tick)`, `round1(x)`, `NukeWeapon`, `nukeScore(weapon)`, `MILITARY_LAWS`
  - `engine-lib/congress/Ring.ts`: `Ring`, `RingSchema`, `newRing(size)`, `ringAdd(r, bucket, n)`, `ringSum(r, bucket, window)`
  - `engine-lib/congress/Voting.ts`: `BallotBlock`, `ballotBlock(a)`, `TallyBallot`, `Tally`, `tallyVotes(ballots)`, `ConveneBlock`, `ConveneAttempt`, `conveneBlock(a)`, `conveneWindowOpen(now, sessionOpen, emergencyActive, nextSessionTick)`
  - `engine-lib/congress/ResolutionEffects.ts`: `ResolutionLike`, `ModifierFacts`, `buildingPactType(param)`(실제 구현), 스텁 `resolutionModifiers(r, facts): Modifier[]`, `resolutionBans(active, smallID, type): boolean`, `resolutionBuildCostPct(active, type): number`, `resolutionBuildTimePct(active, type): number`, `resolutionNukeTimePct(active, smallID): number`
  - `domesticModifiers(techs, laws, government, congress: readonly Modifier[] = [])`
  - `PlayerDomestic`: `setCongressModifiers(mods)`, `congressModifiers()`, `scienceMilliPerSecond()`, `politicalMilliPerSecond()`, `grantPoints(scienceMilli, politicalMilli)`, `shiftVictoryProject(deltaTicks)`
  - `engine/congress/Congress.ts`: 타입 `AgendaItem`, `AgendaItemInit`, `Session`, `ItemResult`, `ActiveResolution`, `PairConflict`, `EmergencyState`, `AvailableEmergency`, `WorldGovVerdict`, `pairKey(a, b)`, `CongressStateSchema`, 클래스 `Congress`의 메서드(Step 7 코드 그대로)
  - `engine/congress/PlayerCongress.ts`: `StoredBallot`, `PlayerCongressStateSchema`, 클래스 `PlayerCongress`(Step 7 코드 그대로)
  - `engine/congress/Metrics.ts`: `aggressionPct(mg, player, now?)`, `victimPct(mg, player, now?)`, `pairPct(mg, pair, now?)`, `landSharePct(mg, player)`, `isLedgerPlayer(p)`
  - 스텁(갈래가 채움, 시그니처 고정): Step 8 코드 그대로
  - `CongressExecution(seed)`, `CongressVoteExecution(player, sessionId, item, option, extra)`, `ConveneEmergencyExecution(player, kind, targetID)`
  - `Game.congress(): Congress | null`, `Player.congress(): PlayerCongress | null`, `Player.isTruceWith(other): boolean`, `Player.isCongressBanned(type): boolean`
  - 클라이언트 `GameView.congressData(): CongressData | null`, `PlayerView.congressData(): PlayerCongressData | null`, `SendCongressVoteIntentEvent(session, item, option, extra)`, `SendConveneEmergencyIntentEvent(kind, target)`
  - 테스트 유틸 `tests/congress/util.ts`: `congressGame(config?, players?, map?, nations?)`, `congressOf(game)`, `seatAll(game)`, `item(resolution, targets?, param?, reason?)`, `giveInfluence(player, points)`, `influence(player)`, `enact(game, r)`, `runTicks(game, n)`, `nationInfo(name)`, `botInfo(name)`, `GREEN`, 그리고 `RED`, `BLUE`, `NATION`, `own` 재수출

- [ ] **Step 1: 끈 옵션의 고정값 테스트 추가(지금도 통과해야 한다)**

`tests/VanillaDigest.test.ts`의 `describe` 안 맨 끝(`"strategic weapons on"` 테스트 뒤)에 추가:

```ts
  // World congress (spec §3.2): explicitly off, without domestic mode, or in a
  // domestic game, the option changes nothing. Pins taken from the tests above.
  test("domestic mode with the congress option explicitly off", async () => {
    expect(
      await digest({
        domesticMode: true,
        strategicWeapons: false,
        congress: false,
      }),
    ).toBe("a7dac00d9005a3ad");
  }, 60_000);

  test("the congress option without domestic mode changes nothing", async () => {
    expect(await digest({ congress: true })).toBe("c330352312204618");
  }, 60_000);

  test("domestic mode and expanded warfare with the congress option explicitly off", async () => {
    expect(
      await digest({
        domesticMode: true,
        warfareExpansion: true,
        strategicWeapons: false,
        congress: false,
      }),
    ).toBe("dddf7fe292970133");
  }, 60_000);
```

Run: `npx vitest tests/VanillaDigest.test.ts --run`
Expected: 11 tests PASS(엔진이 아직 모르는 키라 무시된다. 이후 모든 Task의 지킴이다).

- [ ] **Step 2: 테스트 유틸 작성**

`tests/congress/util.ts`:

```ts
import {
  AgendaReason,
  ResolutionId,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  Nation,
  PlayerInfo,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import type {
  ActiveResolution,
  AgendaItemInit,
  Congress,
} from "@openfront/engine/congress/Congress";
import { CongressExecution } from "@openfront/engine/congress/CongressExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { BLUE, RED } from "../warfare/util";

export { BLUE, NATION, own, RED } from "../warfare/util";

export const GREEN = new PlayerInfo(
  "green",
  PlayerType.Human,
  null,
  "green_id",
);

/** A nation-type player without AI: the game adds it like a human. */
export function nationInfo(name: string): PlayerInfo {
  return new PlayerInfo(name, PlayerType.Nation, null, `${name}_id`);
}

export function botInfo(name: string): PlayerInfo {
  return new PlayerInfo(name, PlayerType.Bot, null, `${name}_id`);
}

/**
 * A test map game with domestic mode and the congress on and the congress
 * clock running (GameRunner adds it to real games). Maps
 * (tests/testdata/maps): "plains" 100x100 land (10,000 land tiles),
 * "big_plains" 200x200 land.
 */
export async function congressGame(
  config: Partial<GameConfig> = {},
  players: PlayerInfo[] = [RED, BLUE],
  map = "plains",
  nations: Nation[] = [],
): Promise<Game> {
  const game = await setup(
    map,
    { domesticMode: true, congress: true, ...config },
    players,
    undefined,
    undefined,
    undefined,
    nations,
  );
  game.addExecution(new CongressExecution(1));
  return game;
}

export function congressOf(game: Game): Congress {
  const c = game.congress();
  if (c === null) throw new Error("this game has no congress");
  return c;
}

/** Seats every alive player with a congress state, as a regular session would. */
export function seatAll(game: Game): void {
  congressOf(game).setSeats(
    game
      .players()
      .filter((p) => p.congress() !== null)
      .map((p) => p.smallID()),
  );
}

export function item(
  resolution: ResolutionId,
  targets: number[] = [],
  param: string | null = null,
  reason: AgendaReason = "global",
): AgendaItemInit {
  return { resolution, targets, param, reason, reasonValue: 0 };
}

export function giveInfluence(player: Player, points: number): void {
  const pc = player.congress();
  if (pc === null) throw new Error("player has no congress state");
  pc.grant(points * MILLI);
}

/** Whole influence points. */
export function influence(player: Player): number {
  return Math.floor((player.congress()?.influenceMilli() ?? 0) / MILLI);
}

/** A resolution in force from now, as an adopted session item adds it. */
export function enact(
  game: Game,
  r: Partial<ActiveResolution> & Pick<ActiveResolution, "resolution">,
): void {
  congressOf(game).addResolution({
    option: "A",
    targets: [],
    param: null,
    sinceTick: game.ticks(),
    expires: "next_tally",
    source: "session",
    ...r,
  });
}

export function runTicks(game: Game, n: number): void {
  for (let i = 0; i < n; i++) game.executeNextTick();
}
```

- [ ] **Step 3: 실패하는 테스트 작성**

`tests/congress/Voting.test.ts`:

```ts
import {
  extraVoteCost,
  extraVoteCostMilli,
} from "@openfront/engine-lib/congress/CongressBalance";
import {
  newRing,
  ringAdd,
  ringSum,
} from "@openfront/engine-lib/congress/Ring";
import {
  ballotBlock,
  conveneBlock,
  conveneWindowOpen,
  tallyVotes,
} from "@openfront/engine-lib/congress/Voting";

describe("the ledger ring", () => {
  test("adds per bucket and sums a sliding window", () => {
    const r = newRing(18);
    ringAdd(r, 0, 5);
    ringAdd(r, 1, 3);
    ringAdd(r, 17, 2);
    expect(ringSum(r, 17, 18)).toBe(10);
    // Bucket 0 is out of an 18-bucket window ending at 18.
    expect(ringSum(r, 18, 18)).toBe(5);
    ringAdd(r, 18, 1);
    expect(ringSum(r, 18, 18)).toBe(6);
    expect(ringSum(r, 18, 2)).toBe(3);
    ringAdd(r, 100, 4);
    expect(ringSum(r, 100, 18)).toBe(4);
  });

  test("ignores a write older than the window", () => {
    const r = newRing(4);
    ringAdd(r, 10, 1);
    ringAdd(r, 6, 9);
    expect(ringSum(r, 10, 4)).toBe(1);
  });
});

describe("voting rules", () => {
  test("the k-th extra vote costs 10·k", () => {
    expect([0, 1, 2, 3, 4, 5].map(extraVoteCost)).toEqual([
      0, 10, 30, 60, 100, 150,
    ]);
    expect(extraVoteCostMilli(2, 4)).toBe(70_000);
  });

  test("more votes win; a tie, or nothing, adopts nothing", () => {
    expect(
      tallyVotes([
        { option: "A", extra: 1 },
        { option: "B", extra: 0 },
      ]),
    ).toEqual({ a: 2, b: 1, adopted: "A" });
    expect(
      tallyVotes([
        { option: "A", extra: 0 },
        { option: "B", extra: 0 },
      ]),
    ).toEqual({ a: 1, b: 1, adopted: null });
    expect(tallyVotes([])).toEqual({ a: 0, b: 0, adopted: null });
  });

  test("ballots are checked in order", () => {
    const ok = {
      open: true,
      itemExists: true,
      eligible: true,
      bOnly: false,
      existing: null,
      option: "A" as const,
      extra: 2,
      influenceMilli: 30_000,
    };
    expect(ballotBlock(ok)).toBeNull();
    expect(ballotBlock({ ...ok, open: false })).toBe("closed");
    expect(ballotBlock({ ...ok, itemExists: false })).toBe("item");
    expect(ballotBlock({ ...ok, eligible: false })).toBe("seat");
    expect(ballotBlock({ ...ok, bOnly: true })).toBe("b_only");
    expect(
      ballotBlock({ ...ok, existing: { option: "B", extra: 0 } }),
    ).toBe("side");
    expect(
      ballotBlock({ ...ok, existing: { option: "A", extra: 2 } }),
    ).toBe("lower");
    expect(ballotBlock({ ...ok, influenceMilli: 29_999 })).toBe("influence");
    // A raise from +1 to +2 costs 20.
    expect(
      ballotBlock({
        ...ok,
        existing: { option: "A", extra: 1 },
        influenceMilli: 20_000,
      }),
    ).toBeNull();
  });

  test("convening needs the window, a seat, no tie to the target and 50 influence", () => {
    const ok = {
      available: true,
      windowOpen: true,
      seated: true,
      isTarget: false,
      friendlyToTarget: false,
      sanctioned: false,
      influenceMilli: 50_000,
    };
    expect(conveneBlock(ok)).toBeNull();
    expect(conveneBlock({ ...ok, available: false })).toBe("unavailable");
    expect(conveneBlock({ ...ok, windowOpen: false })).toBe("window");
    expect(conveneBlock({ ...ok, isTarget: true })).toBe("target");
    expect(conveneBlock({ ...ok, seated: false })).toBe("seat");
    expect(conveneBlock({ ...ok, friendlyToTarget: true })).toBe("friendly");
    expect(conveneBlock({ ...ok, sanctioned: true })).toBe("sanctioned");
    expect(conveneBlock({ ...ok, influenceMilli: 49_999 })).toBe("influence");
  });

  test("no convening while a session votes, during an emergency, or 30 s before a session", () => {
    expect(conveneWindowOpen(1000, false, false, 1400)).toBe(true);
    expect(conveneWindowOpen(1100, false, false, 1400)).toBe(false);
    expect(conveneWindowOpen(1000, true, false, 2000)).toBe(false);
    expect(conveneWindowOpen(1000, false, true, 2000)).toBe(false);
    expect(conveneWindowOpen(1000, false, false, null)).toBe(true);
  });
});
```

`tests/congress/BallotBox.test.ts`:

```ts
import { Game, Player } from "@openfront/engine/game/Game";
import {
  BLUE,
  congressGame,
  congressOf,
  giveInfluence,
  GREEN,
  influence,
  item,
  own,
  RED,
  runTicks,
} from "./util";

async function three(): Promise<{
  game: Game;
  red: Player;
  blue: Player;
  green: Player;
}> {
  const game = await congressGame({}, [RED, BLUE, GREEN]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 35, 0, 30, 100);
  const green = own(game, GREEN.id, 70, 0, 30, 100);
  game.executeNextTick(); // the congress clock starts
  return { game, red, blue, green };
}

describe("the ballot box", () => {
  test("a seat or one of the item's targets may vote; nobody else", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    c.setSeats([red.smallID(), blue.smallID()]);
    const s = c.openSession(
      "regular",
      [item("sanction", [green.smallID()]), item("research_fund")],
      game.ticks(),
    );
    expect(c.castBallot(red, s.id, 0, "A", 0)).toBeNull();
    expect(c.castBallot(green, s.id, 0, "B", 0)).toBeNull();
    expect(c.castBallot(green, s.id, 1, "A", 0)).toBe("seat");
    expect(c.castBallot(red, s.id, 2, "A", 0)).toBe("item");
    expect(c.session()!.items.map((i) => i.voters)).toEqual([2, 0]);
  });

  test("extra votes cost 10, 30, 60, 100, 150 in all and only go up", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    c.setSeats([red.smallID(), blue.smallID()]);
    giveInfluence(red, 200);
    const s = c.openSession("regular", [item("war_tax")], game.ticks());
    expect(c.castBallot(red, s.id, 0, "A", 1)).toBeNull();
    expect(influence(red)).toBe(190);
    expect(c.castBallot(red, s.id, 0, "A", 3)).toBeNull();
    expect(influence(red)).toBe(140);
    expect(c.castBallot(red, s.id, 0, "A", 2)).toBe("lower");
    expect(influence(red)).toBe(140);
    expect(c.castBallot(red, s.id, 0, "A", 5)).toBeNull();
    expect(influence(red)).toBe(50);
    expect(red.congress()!.ballot(s.id, 0)).toEqual({
      sessionId: s.id,
      item: 0,
      option: "A",
      extra: 5,
      costMilli: 150_000,
    });
    expect(c.session()!.items[0].voters).toBe(1);
  });

  test("a side can't change, and a raise needs the influence", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    c.setSeats([red.smallID(), blue.smallID()]);
    giveInfluence(red, 20);
    const s = c.openSession("regular", [item("war_tax")], game.ticks());
    expect(c.castBallot(red, s.id, 0, "A", 0)).toBeNull();
    expect(c.castBallot(red, s.id, 0, "B", 1)).toBe("side");
    expect(c.castBallot(red, s.id, 0, "A", 2)).toBe("influence");
    expect(influence(red)).toBe(20);
  });

  test("a ballot for a closed or earlier session is refused and costs nothing", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    c.setSeats([red.smallID(), blue.smallID()]);
    giveInfluence(red, 100);
    const s1 = c.openSession("regular", [item("war_tax")], game.ticks());
    expect(c.castBallot(red, s1.id, 0, "A", 1)).toBeNull();
    c.closeSession();
    expect(influence(red)).toBe(90); // A won 2 : 0, so the 10 is spent
    expect(c.castBallot(red, s1.id, 0, "A", 2)).toBe("closed");
    const s2 = c.openSession("regular", [item("war_tax")], game.ticks());
    expect(c.castBallot(red, s1.id, 0, "A", 1)).toBe("closed");
    expect(influence(red)).toBe(90);
    expect(c.castBallot(red, s2.id, 0, "A", 0)).toBeNull();
  });

  test("a raise processed before the close tick counts; at the close tick it doesn't", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    c.setSeats([red.smallID(), blue.smallID()]);
    giveInfluence(red, 100);
    const s = c.openSession("regular", [item("war_tax")], game.ticks());
    runTicks(game, s.closeTick - 1 - game.ticks());
    expect(c.castBallot(red, s.id, 0, "A", 1)).toBeNull();
    game.executeNextTick();
    expect(c.castBallot(red, s.id, 0, "A", 2)).toBe("closed");
    game.executeNextTick(); // the clock tallies at closeTick
    expect(c.session()).toBeNull();
    expect(c.history().at(-1)).toMatchObject({
      sessionId: s.id,
      a: 2,
      b: 0,
      adopted: "A",
    });
  });

  test("the tally: more votes win, a tie adopts nothing, losers and ties get their influence back", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    c.setSeats([red.smallID(), blue.smallID(), green.smallID()]);
    for (const p of [red, blue, green]) giveInfluence(p, 100);
    const s = c.openSession(
      "regular",
      [item("research_fund"), item("war_tax"), item("arms_treaty")],
      game.ticks(),
    );
    c.castBallot(red, s.id, 0, "A", 1);
    c.castBallot(blue, s.id, 0, "B", 0);
    c.castBallot(red, s.id, 1, "A", 0);
    c.castBallot(blue, s.id, 1, "B", 2);
    c.castBallot(red, s.id, 2, "A", 1);
    c.castBallot(blue, s.id, 2, "B", 1);
    const results = c.closeSession();
    expect(results.map((r) => [r.a, r.b, r.adopted])).toEqual([
      [2, 1, "A"],
      [1, 3, "B"],
      [2, 2, null],
    ]);
    expect(results[0].aVoters).toEqual([red.smallID()]);
    expect(results[0].bVoters).toEqual([blue.smallID()]);
    // red won item 0 (10 spent) and tied item 2 (10 back).
    expect(influence(red)).toBe(90);
    // blue won item 1 (30 spent) and tied item 2 (10 back).
    expect(influence(blue)).toBe(70);
    expect(influence(green)).toBe(100);
    expect(c.history().map((h) => h.adopted)).toEqual(["A", "B", null]);
    expect(red.congress()!.ballotsFor(s.id)).toEqual([]);
  });

  test("emergency items: the target and its allies may only oppose", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    c.setSeats([red.smallID(), blue.smallID(), green.smallID()]);
    green.createAllianceRequest(blue)?.accept();
    const s = c.openSession(
      "emergency",
      [item("emergency", [blue.smallID()], "nuclear", "convened")],
      game.ticks(),
    );
    expect(s.closeTick - s.openTick).toBe(200);
    expect(c.castBallot(blue, s.id, 0, "A", 0)).toBe("b_only");
    expect(c.castBallot(green, s.id, 0, "A", 0)).toBe("b_only");
    expect(c.castBallot(green, s.id, 0, "B", 0)).toBeNull();
    expect(c.castBallot(red, s.id, 0, "A", 0)).toBeNull();
  });
});
```

`tests/congress/CongressOption.test.ts`:

```ts
import { GameMode, UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { IntentSchema } from "@openfront/engine-api/Schemas";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";
import { setup } from "../util/Setup";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import {
  BLUE,
  botInfo,
  congressGame,
  congressOf,
  enact,
  giveInfluence,
  GREEN,
  item,
  own,
  RED,
  seatAll,
} from "./util";

describe("the congress option", () => {
  test.each([
    ["vanilla", {}],
    ["congress without domestic mode", { congress: true }],
    ["domestic mode only", { domesticMode: true }],
    [
      "domestic mode with the congress explicitly off",
      { domesticMode: true, congress: false },
    ],
    [
      "a domestic team game",
      {
        domesticMode: true,
        congress: true,
        gameMode: GameMode.Team,
        playerTeams: 2,
      },
    ],
  ])("off outside domestic FFA: %s", async (_, config) => {
    const game = await setup("plains", config, [RED, BLUE]);
    expect(game.config().congress()).toBe(false);
    expect(game.congress()).toBeNull();
    for (const p of game.allPlayers()) expect(p.congress()).toBeNull();
    const updates = game.executeNextTick();
    expect(updates[GameUpdateType.Congress]).toEqual([]);
    for (const pu of updates[GameUpdateType.Player]) {
      expect("congress" in pu).toBe(false);
    }
  });

  test("on with domestic mode in FFA: a congress and a state for every human and nation, none for bots", async () => {
    const game = await congressGame({}, [RED, BLUE, botInfo("bot")]);
    expect(game.config().congress()).toBe(true);
    expect(game.congress()).not.toBeNull();
    expect(game.player(RED.id).congress()).not.toBeNull();
    expect(game.player("bot_id").congress()).toBeNull();
  });

  test("the clock schedules the first session 3 minutes after it starts", async () => {
    const game = await congressGame();
    game.executeNextTick();
    expect(congressOf(game).nextSessionTick()).toBe(1800);
  });

  test("clients get the congress on its first tick, then only when it changes", async () => {
    const game = await congressGame();
    game.executeNextTick(); // the clock is initialized
    const first = game.executeNextTick()[GameUpdateType.Congress];
    expect(first).toHaveLength(1);
    expect(first[0].data.nextSessionTick).toBe(1800);
    expect(game.executeNextTick()[GameUpdateType.Congress]).toEqual([]);
    congressOf(game).setSeats([game.player(RED.id).smallID()]);
    const next = game.executeNextTick()[GameUpdateType.Congress];
    expect(next).toHaveLength(1);
    expect(next[0].data.seats).toEqual([game.player(RED.id).smallID()]);
  });

  test("players' congress data rides PlayerUpdate and is resent when it changes", async () => {
    const game = await congressGame();
    const red = game.player(RED.id);
    const pu = () =>
      game
        .executeNextTick()
        [GameUpdateType.Player].find((u) => u.id === RED.id);
    expect(pu()!.congress).toEqual({
      influence: 0,
      influencePerSec: 0,
      status: "peaceful",
      ballots: [],
    });
    giveInfluence(red, 42);
    expect(pu()!.congress!.influence).toBe(42);
  });

  test("congress modifiers add to the domestic totals, on the engine and on the client", async () => {
    const game = await congressGame();
    const red = own(game, RED.id, 0, 0, 30, 100);
    const d = red.domestic()!;
    const before = game.config().maxTroops(red);
    d.setCongressModifiers([{ stat: "maxTroops", pct: -15 }]);
    expect(d.pct("maxTroops")).toBe(-15);
    expect(game.config().maxTroops(red)).toBeCloseTo(before * 0.85);
    expect(new DomesticClientView(d.toData()).pct("maxTroops")).toBe(-15);
    const data = d.toData();
    d.setCongressModifiers([{ stat: "maxTroops", pct: -15 }]);
    expect(d.toData()).toBe(data);
    d.setCongressModifiers([]);
    expect(d.toData().congressModifiers).toBeUndefined();
  });

  test("survives a snapshot with a session, ballots, resolutions, an emergency and a war pair", async () => {
    const game = await congressGame({}, [RED, BLUE, GREEN]);
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 35, 0, 30, 100);
    own(game, GREEN.id, 70, 0, 30, 100);
    blue.buildUnit(UnitType.MissileSilo, game.ref(50, 50), {});
    game.executeNextTick();
    const c = congressOf(game);
    seatAll(game);
    giveInfluence(red, 100);
    const s = c.openSession(
      "regular",
      [
        item("sanction", [blue.smallID()], null, "aggressor"),
        item("research_fund"),
      ],
      game.ticks(),
    );
    expect(c.castBallot(red, s.id, 0, "A", 2)).toBeNull();
    enact(game, {
      resolution: "truce",
      targets: [red.smallID(), blue.smallID()],
      expires: game.ticks() + 1200,
    });
    c.touchPair(red.smallID(), blue.smallID(), game.ticks());
    red.congress()!.recordTaken(game.ticks(), 25);
    red.congress()!.recordHitBy(blue.smallID(), game.ticks());
    c.setEmergency({
      kind: "nuclear",
      target: blue.smallID(),
      startTick: game.ticks(),
      endTick: game.ticks() + 1800,
      goalKind: "silos",
      goal: 1,
      progress: 0,
      members: [red.smallID()],
      opposed: [],
      contributions: new Map([[red.smallID(), 3]]),
      goalSilos: blue.units(UnitType.MissileSilo),
      countedSilos: [],
    });
    c.setVerdict(blue.smallID(), { host: 7, ratified: true });
    red.domestic()!.setCongressModifiers([{ stat: "allGold", pct: -20 }]);
    await expectSnapshotRoundTrip(game, "plains", 10);
  });

  test("the intents carry only what they may", () => {
    const ok = (i: object) => IntentSchema.safeParse(i).success;
    const vote = {
      type: "congress_vote",
      session: 3,
      item: 2,
      option: "A",
      extra: 5,
    };
    expect(ok(vote)).toBe(true);
    expect(ok({ ...vote, extra: 6 })).toBe(false);
    expect(ok({ ...vote, item: 3 })).toBe(false);
    expect(ok({ ...vote, option: "C" })).toBe(false);
    const convene = {
      type: "convene_emergency",
      kind: "nuclear",
      target: "abcdefgh",
    };
    expect(ok(convene)).toBe(true);
    expect(ok({ ...convene, kind: "heritage" })).toBe(false);
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `npx vitest tests/congress --run`
Expected: FAIL — `Cannot find module '@openfront/engine-lib/congress/CongressBalance'` 등(아직 없는 모듈)

- [ ] **Step 5: engine-api — 타입, 옵션, 명령, 업데이트**

`packages/engine-api/src/congress/CongressTypes.ts`:

```ts
import type { TechId } from "../domestic/DomesticTypes";
import { UnitType } from "../game/GameTypes";

// World congress (docs/superpowers/specs/2026-10-19-world-congress-design.md):
// the shared vocabulary only — ids, data shapes and the limits the wire
// schemas check. Numbers and rules live in engine-lib/congress.

/** Spec §8: fourteen resolutions, the two project cards and the emergency vote. */
export const RESOLUTION_IDS = [
  "sanction",
  "truce",
  "protectorate",
  "war_tax",
  "arms_treaty",
  "arms_embargo",
  "non_proliferation",
  "hegemony_check",
  "trade_pact",
  "building_pact",
  "research_fund",
  "tech_pact",
  "government_resolution",
  "law_review",
  "world_government",
  "world_heritage",
  "emergency",
] as const;
export type ResolutionId = (typeof RESOLUTION_IDS)[number];

export const BALLOT_OPTIONS = ["A", "B"] as const;
export type BallotOption = (typeof BALLOT_OPTIONS)[number];

export type ResolutionCategory = "security" | "economy" | "project" | "emergency";
/** Who an item names: one player, the two of a war pair, a parameter (unit, trade kind, government, law) or nobody. */
export type ResolutionTargetKind = "player" | "pair" | "param" | "global";

export interface ResolutionMeta {
  category: ResolutionCategory;
  target: ResolutionTargetKind;
  /** The option that is good for the named player(s); null when neither side is. */
  favorable: BallotOption | null;
}

export const RESOLUTION_META: Readonly<Record<ResolutionId, ResolutionMeta>> =
  {
    sanction: { category: "security", target: "player", favorable: "B" },
    truce: { category: "security", target: "pair", favorable: null },
    protectorate: { category: "security", target: "player", favorable: "A" },
    war_tax: { category: "security", target: "global", favorable: null },
    arms_treaty: { category: "security", target: "global", favorable: null },
    arms_embargo: { category: "security", target: "player", favorable: "B" },
    non_proliferation: {
      category: "security",
      target: "global",
      favorable: null,
    },
    hegemony_check: { category: "security", target: "player", favorable: "B" },
    trade_pact: { category: "economy", target: "param", favorable: null },
    building_pact: { category: "economy", target: "param", favorable: null },
    research_fund: { category: "economy", target: "global", favorable: null },
    tech_pact: { category: "economy", target: "global", favorable: null },
    government_resolution: {
      category: "economy",
      target: "param",
      favorable: null,
    },
    law_review: { category: "economy", target: "param", favorable: null },
    world_government: {
      category: "project",
      target: "player",
      favorable: "A",
    },
    world_heritage: { category: "project", target: "player", favorable: "A" },
    emergency: { category: "emergency", target: "player", favorable: "B" },
  };

/** Spec §9. */
export const EMERGENCY_KINDS = ["aggression", "nuclear", "hegemony"] as const;
export type EmergencyKind = (typeof EMERGENCY_KINDS)[number];

export const SESSION_KINDS = ["regular", "emergency"] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

/** Why an item is on the agenda (spec §7); the card shows it as one line. */
export const AGENDA_REASONS = [
  "victim",
  "aggressor",
  "war_pair",
  "runaway",
  "global",
  "most_built",
  "aggressor_government",
  "common_government",
  "aggressor_law",
  "project",
  "convened",
] as const;
export type AgendaReason = (typeof AGENDA_REASONS)[number];

/** Spec §5.1: why influence did (or didn't) grow last second. */
export const INFLUENCE_STATUSES = [
  "peaceful",
  "aggressing",
  "sanctioned",
  "target",
  "capped",
] as const;
export type InfluenceStatus = (typeof INFLUENCE_STATUSES)[number];

/** Until the next regular tally, until the victory project ends, or until a tick. */
export type ResolutionExpiry = "next_tally" | "project_end" | number;

/** Spec §6.3: at most five extra votes on one item. */
export const MAX_EXTRA_VOTES = 5;
/** Security, economy and the project card (spec §7). */
export const MAX_AGENDA_ITEMS = 3;

/**
 * building_pact parameters (spec §7.2), in tie-break order. The key is also
 * the unit's translation key (unit_type.<key>).
 */
export const BUILDING_PACT_UNITS: readonly {
  readonly key: string;
  readonly type: UnitType;
}[] = [
  { key: "city", type: UnitType.City },
  { key: "port", type: UnitType.Port },
  { key: "factory", type: UnitType.Factory },
  { key: "research_institute", type: UnitType.ResearchInstitute },
  { key: "admin_office", type: UnitType.AdminOffice },
  { key: "defense_post", type: UnitType.DefensePost },
  { key: "missile_silo", type: UnitType.MissileSilo },
  { key: "sam_launcher", type: UnitType.SAMLauncher },
  { key: "airport", type: UnitType.Airport },
  { key: "coastal_battery", type: UnitType.CoastalBattery },
];

/** trade_pact parameters: the domestic stat each one scales. */
export const TRADE_PACT_KINDS = ["tradeShip", "train"] as const;
export type TradePactKind = (typeof TRADE_PACT_KINDS)[number];

// Parameter formats (AgendaItemData.param, ActiveResolutionData.param):
//   trade_pact             a TradePactKind
//   building_pact          a BUILDING_PACT_UNITS key
//   government_resolution  a GovernmentId
//   law_review             "<LawId>:<LawOption>", e.g. "doctrine:B"
//   world_government, world_heritage   the host unit id, as a string
//   emergency              an EmergencyKind (also the hegemony-failure bonus)

export interface AgendaItemData {
  resolution: ResolutionId;
  /** smallIDs: one player, a pair (lower first), or none. */
  targets: number[];
  param: string | null;
  reason: AgendaReason;
  /** The reason's number: a percent (one decimal), a ratio, a count, or the convener's smallID. */
  reasonValue: number;
  /** Ballots cast so far. The sides stay secret (spec §6.5). */
  voters: number;
}

export interface SessionData {
  id: number;
  kind: SessionKind;
  openTick: number;
  closeTick: number;
  items: AgendaItemData[];
}

/** A tallied item: totals only, never who voted what. */
export interface ResultData {
  sessionId: number;
  kind: SessionKind;
  tick: number;
  resolution: ResolutionId;
  targets: number[];
  param: string | null;
  a: number;
  b: number;
  /** null: a tie, nothing adopted. */
  adopted: BallotOption | null;
}

export interface ActiveResolutionData {
  resolution: ResolutionId;
  option: BallotOption;
  targets: number[];
  param: string | null;
  sinceTick: number;
  expires: ResolutionExpiry;
}

export interface EmergencyData {
  kind: EmergencyKind;
  target: number;
  startTick: number;
  endTick: number;
  /** "land": tiles to take; "silos": missile silos to destroy or capture. */
  goalKind: "land" | "silos";
  goal: number;
  progress: number;
  members: number[];
  /** The highest contribution so far; null while nobody has one. */
  hero: number | null;
}

export interface AvailableEmergencyData {
  kind: EmergencyKind;
  target: number;
  /** The tick it became available; nations wait a while after it (spec §11.3). */
  sinceTick: number;
}

export interface RankEntry {
  /** smallID. */
  id: number;
  /** Percent, one decimal. */
  pct: number;
}

export interface WorldGovVerdictData {
  owner: number;
  host: number;
  ratified: boolean;
}

/** The congress as sent worker -> main thread (GameUpdateType.Congress). Never mutated. */
export interface CongressData {
  nextSessionTick: number;
  session: SessionData | null;
  /** smallIDs, ascending. */
  seats: number[];
  active: ActiveResolutionData[];
  emergency: EmergencyData | null;
  available: AvailableEmergencyData[];
  /** No emergency can be listed before this tick. */
  cooldownUntilTick: number;
  emergenciesLeft: number;
  /** Newest last; at most HISTORY_LENGTH. */
  history: ResultData[];
  /** tech_pact A: techs that cost 30% less now. */
  discountedTechs: TechId[];
  aggressors: RankEntry[];
  victims: RankEntry[];
  verdicts: WorldGovVerdictData[];
}

export interface BallotData {
  sessionId: number;
  item: number;
  option: BallotOption;
  extra: number;
}

/** One player's congress state on PlayerUpdate.congress. The UI shows only its own player's. */
export interface PlayerCongressData {
  /** Whole points. */
  influence: number;
  influencePerSec: number;
  status: InfluenceStatus;
  ballots: BallotData[];
}
```

`packages/engine-api/src/Schemas.ts`:
- import 추가: `import { BALLOT_OPTIONS, EMERGENCY_KINDS, MAX_AGENDA_ITEMS, MAX_EXTRA_VOTES } from "./congress/CongressTypes";`
- `Intent` union의 `| QueueResearchIntent;`를 `| QueueResearchIntent\n  | CongressVoteIntent\n  | ConveneEmergencyIntent;`로 바꾼다.
- `export type QueueResearchIntent = …;` 뒤에:

```ts
export type CongressVoteIntent = z.infer<typeof CongressVoteIntentSchema>;
export type ConveneEmergencyIntent = z.infer<
  typeof ConveneEmergencyIntentSchema
>;
```

- `GameConfigSchema`의 `strategicWeapons: z.boolean().optional(),` 뒤(객체 맨 끝)에:

```ts
  // World congress (this fork): three-minute secret-ballot sessions,
  // influence, resolutions and emergencies. Only with domestic mode in FFA;
  // the lobby turns it on with domestic mode. See
  // docs/superpowers/specs/2026-10-19-world-congress-design.md.
  congress: z.boolean().optional(),
```

- `QueueResearchIntentSchema` 정의 뒤에:

```ts
// World congress (spec §6.3): a ballot, or a raise of its extra votes, on
// one agenda item of the open session.
export const CongressVoteIntentSchema = z.object({
  type: z.literal("congress_vote"),
  session: zb.uint(),
  item: zb.uint({ max: MAX_AGENDA_ITEMS - 1 }),
  option: z.enum(BALLOT_OPTIONS),
  extra: zb.uint({ max: MAX_EXTRA_VOTES }),
});

// World congress (spec §9.2): convene an emergency session against `target`.
export const ConveneEmergencyIntentSchema = z.object({
  type: z.literal("convene_emergency"),
  kind: z.enum(EMERGENCY_KINDS),
  target: MappedID,
});
```

- `IntentSchema`의 `QueueResearchIntentSchema,` 뒤에 `CongressVoteIntentSchema,`와 `ConveneEmergencyIntentSchema,`(맨 뒤).

`packages/engine-api/src/game/GameUpdates.ts`:
- import 추가: `import type { CongressData, PlayerCongressData } from "../congress/CongressTypes";`
- `GameUpdateType`의 `BombDrop,` 뒤에 `Congress,`
- `GameUpdate` union 끝 `| BombDropUpdate;`를 `| BombDropUpdate\n  | CongressUpdate;`로.
- `PlayerUpdate`의 `strategic?: StrategicData;` 뒤에:

```ts
  /** World congress only; absent for bots and when the option is off. */
  congress?: PlayerCongressData;
```

- 파일 끝에:

```ts
/** World congress: the whole congress, sent when it changed (and on a game's first tick). */
export interface CongressUpdate {
  type: GameUpdateType.Congress;
  data: CongressData;
}
```

`packages/engine-api/src/game/GameTypes.ts`:
- `MessageType`의 `VICTORY_PROJECT,` 뒤에 `CONGRESS,`
- `MESSAGE_TYPE_CATEGORIES`의 `[MessageType.VICTORY_PROJECT]: MessageCategory.ATTACK,` 뒤에 `[MessageType.CONGRESS]: MessageCategory.ALLIANCE,`
- `BuildableUnit`의 `locked?: boolean;` 뒤에:

```ts
  /** World congress: a resolution in force forbids building or buying it now. */
  banned?: boolean;
```

`packages/engine-api/src/domestic/DomesticTypes.ts`:
- `CONDITIONS`를 다음으로:

```ts
export const CONDITIONS = [
  "attacking",
  "notAttacking",
  "troopsAtMostHalf",
  // World congress (spec §4.2): attacking a nation first. Only computed in
  // congress games, so other games' condition sets are unchanged.
  "aggressing",
] as const;
```

- `DomesticData`의 `donationGoldReceived?: number;` 뒤에:

```ts
  /** World congress: the modifiers resolutions give this player; absent when none. */
  congressModifiers?: Modifier[];
```

- [ ] **Step 6: engine-lib — 수치, 고리 버퍼, 투표 규칙, 효과 스텁, 옵션, 보정 합산**

`packages/engine-lib/src/congress/CongressBalance.ts`:

```ts
import { EmergencyKind } from "@openfront/engine-api/congress/CongressTypes";
import {
  LawId,
  LawOption,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { Difficulty, UnitType } from "@openfront/engine-api/game/GameTypes";
import { MILLI } from "../domestic/Balance";

export {
  MAX_AGENDA_ITEMS,
  MAX_EXTRA_VOTES,
} from "@openfront/engine-api/congress/CongressTypes";

// World congress tunables (spec §15). Ticks are 1/10 s.

// Sessions (spec §6).
export const SESSION_INTERVAL_TICKS = 1800;
/** The dial turns gold this long before a session opens. */
export const SESSION_NOTICE_TICKS = 200;
export const VOTING_TICKS = 300;
export const EMERGENCY_VOTING_TICKS = 200;
export const AI_SEATS = 6;
/** Influence points per extra vote step: the k-th extra vote costs k × this. */
export const EXTRA_VOTE_STEP = 10;
export const HISTORY_LENGTH = 8;

/** Whole points for `extra` extra votes in all: 10, 30, 60, 100, 150. */
export function extraVoteCost(extra: number): number {
  return (EXTRA_VOTE_STEP * extra * (extra + 1)) / 2;
}

/** Milli-points to raise a ballot from `from` to `to` extra votes. */
export function extraVoteCostMilli(from: number, to: number): number {
  return Math.max(0, extraVoteCost(to) - extraVoteCost(from)) * MILLI;
}

// Influence (spec §5), in milli-points a second.
export const INFLUENCE_CAP_MILLI = 300 * MILLI;
export const INFLUENCE_BASE_MILLI = 100;
export const INFLUENCE_PER_TIER_MILLI = 50;
/** Percent of last second's political output. */
export const INFLUENCE_POLITICAL_SHARE_PCT = 5;
export const INFLUENCE_PER_ALLY_MILLI = 50;
export const INFLUENCE_MAX_ALLIES = 3;
/** E5 support / condemnation, in percent of the rate. */
export const GOVERNMENT_SUPPORT_INFLUENCE_PCT = 125;
export const GOVERNMENT_CONDEMN_INFLUENCE_PCT = 0;

// The aggression ledger (spec §4).
export const LEDGER_BUCKET_TICKS = 100;
/** 180 s. */
export const LEDGER_BUCKETS = 18;
/** 120 s. */
export const WAR_PAIR_BUCKETS = 12;
/** A war pair with no capture for this long is over; the next one has a new initiator. */
export const CONFLICT_MEMORY_TICKS = 1800;

/** The ledger bucket (10 s) a tick falls in. */
export function ledgerBucket(tick: number): number {
  return Math.floor(tick / LEDGER_BUCKET_TICKS);
}

// Agenda (spec §7).
export const VICTIM_MIN_PCT = 15;
export const AGGRESSOR_MIN_PCT = 0.5;
/** An aggressor this strong gets a sanction again right after one. */
export const AGGRESSOR_REPEAT_PCT = 2;
export const WAR_PAIR_MIN_PCT = 0.3;
export const RUNAWAY_FACTOR = 1.5;
export const RANK_LENGTH = 5;
export const RANK_MIN_AGGRESSION_PCT = 0.1;
export const RANK_MIN_VICTIM_PCT = 1;

// Resolutions (spec §8).
export const TRUCE_TICKS = 1200;
export const DUEL_SPEED_PCT = 25;
export const DUEL_LOSS_PCT = -15;
export const PROTECTORATE_ATTACK_LOSS_PCT = 40;
export const PROTECTORATE_ATTACK_SPEED_PCT = -20;
export const PROTECTORATE_DEFENSE_LOSS_PCT = -20;
export const PARTITION_ATTACK_LOSS_PCT = -20;
export const HEGEMONY_CHECK_ATTACK_LOSS_PCT = -15;
export const CONDEMN_SPEED_PCT = 20;
export const CONDEMN_LOSS_PCT = -20;
export const TECH_PACT_DISCOUNT_PCT = -30;
export const TECH_PACT_MIN_HOLDERS = 2;
export const PATENT_SECONDS = 60;
export const WORLD_GOV_STEP_TICKS = 600;

// Emergencies (spec §9).
export const EMERGENCY_AGGRESSION_PCT = 5;
export const EMERGENCY_NUKE_SCORE = 3;
export const HEGEMONY_THRESHOLDS_PCT = [40, 55] as const;
export const ELIMINATION_MEMORY_TICKS = 1800;
export const EMERGENCY_GLOBAL_COOLDOWN_TICKS = 3000;
export const EMERGENCY_TARGET_COOLDOWN_TICKS = 6000;
export const EMERGENCY_MAX_PER_GAME = 3;
/** No convening this close before a regular session opens. */
export const EMERGENCY_SESSION_GUARD_TICKS = 300;
export const CONVENE_COST_MILLI = 50 * MILLI;
export const EMERGENCY_DURATION_TICKS: Readonly<Record<EmergencyKind, number>> =
  {
    aggression: 1500,
    nuclear: 1800,
    hegemony: 1800,
  };
export const AGGRESSION_GOAL_PCT = 15;
export const HEGEMONY_GOAL_PCT = 10;
export const NUCLEAR_NO_SILO_GOAL_PCT = 10;
export const LAND_GOAL_MIN_TILES = 300;
/** A goal silo a member destroys or captures counts this share of the world's land as contribution. */
export const SILO_CREDIT_WORLD_PCT = 0.2;
export const MEMBER_SPEED_PCT = 20;
export const MEMBER_LOSS_PCT = -20;
export const REWARD_SECONDS = 45;
export const REWARD_INFLUENCE_MILLI = 30 * MILLI;
export const HERO_MULT = 2;
export const SURVIVE_SECONDS = 60;
export const SURVIVE_INFLUENCE_MILLI = 60 * MILLI;
export const AFTERMATH_TRUCE_TICKS = 600;
export const NUCLEAR_SUCCESS_BAN_TICKS = 3000;
export const HEGEMONY_FAIL_GOLD_PCT = 10;

// Nations (spec §11).
export const AI_EXTRA_CAP: Readonly<Record<Difficulty, number>> = {
  [Difficulty.Easy]: 0,
  [Difficulty.Medium]: 1,
  [Difficulty.Hard]: 3,
  [Difficulty.Impossible]: 5,
};
/** Nations keep this share of their influence back. */
export const AI_RESERVE_PCT = 30;
export const AI_CONVENE_DELAY_TICKS = 200;
export const AI_CONVENE_MIN_INFLUENCE_MILLI = 80 * MILLI;
/** Nations vote this long after a session opens: 10 + (smallID × 7 mod 70). */
export function aiVoteDelayTicks(smallID: number): number {
  return 10 + ((smallID * 7) % 70);
}

/** Rounds to one decimal (percent shown on cards and rankings). */
export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** What scores toward the nuclear emergency (spec §4.2, §9.1). */
export type NukeWeapon =
  | UnitType.AtomBomb
  | UnitType.HydrogenBomb
  | UnitType.MIRV
  | UnitType.MIRVWarhead
  | "orbital";

/** Atom 1, hydrogen 2, MIRV 3 (once, at separation), orbital strike 3; warheads 0. */
export function nukeScore(weapon: NukeWeapon): number {
  switch (weapon) {
    case UnitType.AtomBomb:
      return 1;
    case UnitType.HydrogenBomb:
      return 2;
    case UnitType.MIRV:
    case "orbital":
      return 3;
    case UnitType.MIRVWarhead:
      return 0;
  }
}

/** E6's military laws (spec §7.2), in pick order. */
export const MILITARY_LAWS: readonly {
  readonly law: LawId;
  readonly option: LawOption;
}[] = [
  { law: "doctrine", option: "B" },
  { law: "service", option: "A" },
  { law: "mobilization", option: "A" },
  { law: "nuclear", option: "A" },
  { law: "service", option: "B" },
];
```

`packages/engine-lib/src/congress/Ring.ts`:

```ts
import { z } from "zod";
import { zInt } from "../snapshot/SnapshotType";

/**
 * Counts per ledger bucket over a sliding window (spec §4): `slots[b % size]`
 * holds bucket b for the `size` buckets ending at `head`. Plain data, so it
 * snapshots as it is.
 */
export interface Ring {
  head: number;
  slots: number[];
}

export const RingSchema = z.object({
  head: zInt(),
  slots: z.array(zInt()),
});

export function newRing(size: number): Ring {
  return { head: -1, slots: new Array<number>(size).fill(0) };
}

/** Adds `n` to `bucket`. Later buckets clear what they overwrite; a bucket older than the window is ignored. */
export function ringAdd(r: Ring, bucket: number, n: number): void {
  const size = r.slots.length;
  if (bucket > r.head) {
    const clear = Math.min(size, bucket - r.head);
    for (let i = 1; i <= clear; i++) r.slots[(r.head + i) % size] = 0;
    r.head = bucket;
  }
  if (bucket <= r.head - size) return;
  r.slots[bucket % size] += n;
}

/** The sum of the `window` buckets ending at `bucket` (which may be ahead of the last write). */
export function ringSum(r: Ring, bucket: number, window: number): number {
  const size = r.slots.length;
  let sum = 0;
  for (let b = bucket - Math.min(window, size) + 1; b <= bucket; b++) {
    if (b < 0 || b > r.head || b <= r.head - size) continue;
    sum += r.slots[b % size];
  }
  return sum;
}
```

`packages/engine-lib/src/congress/Voting.ts`:

```ts
import {
  BallotOption,
  MAX_EXTRA_VOTES,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  CONVENE_COST_MILLI,
  EMERGENCY_SESSION_GUARD_TICKS,
  extraVoteCostMilli,
} from "./CongressBalance";

export type BallotBlock =
  | "closed"
  | "item"
  | "seat"
  | "b_only"
  | "side"
  | "lower"
  | "influence";

export interface BallotAttempt {
  /** The session is open with this id, the close tick isn't reached, and the voter is alive with a congress state. */
  open: boolean;
  itemExists: boolean;
  /** A seat, or one of the item's targets. */
  eligible: boolean;
  /** Emergency votes: the target and its friends may only oppose. */
  bOnly: boolean;
  existing: { option: BallotOption; extra: number } | null;
  option: BallotOption;
  extra: number;
  influenceMilli: number;
}

/** Why a ballot (or a raise) is refused, or null when it counts (spec §6.3). Checked in this order. */
export function ballotBlock(a: BallotAttempt): BallotBlock | null {
  if (!a.open) return "closed";
  if (!a.itemExists) return "item";
  if (!a.eligible) return "seat";
  if (a.bOnly && a.option === "A") return "b_only";
  if (a.existing !== null && a.existing.option !== a.option) return "side";
  if (a.extra > MAX_EXTRA_VOTES) return "lower";
  if (a.existing !== null && a.extra <= a.existing.extra) return "lower";
  if (extraVoteCostMilli(a.existing?.extra ?? 0, a.extra) > a.influenceMilli) {
    return "influence";
  }
  return null;
}

export interface TallyBallot {
  option: BallotOption;
  extra: number;
}

export interface Tally {
  a: number;
  b: number;
  /** null: a tie (0 : 0 included) adopts nothing. */
  adopted: BallotOption | null;
}

/** Spec §6.4: one vote plus the extras per ballot; the larger side wins. */
export function tallyVotes(ballots: Iterable<TallyBallot>): Tally {
  let a = 0;
  let b = 0;
  for (const x of ballots) {
    if (x.option === "A") a += 1 + x.extra;
    else b += 1 + x.extra;
  }
  return { a, b, adopted: a > b ? "A" : b > a ? "B" : null };
}

export type ConveneBlock =
  | "unavailable"
  | "window"
  | "target"
  | "seat"
  | "friendly"
  | "sanctioned"
  | "influence";

export interface ConveneAttempt {
  /** (kind, target) is on the available list now. */
  available: boolean;
  /** conveneWindowOpen(...) now. */
  windowOpen: boolean;
  seated: boolean;
  isTarget: boolean;
  /** Allied with (or a teammate of) the target. */
  friendlyToTarget: boolean;
  sanctioned: boolean;
  influenceMilli: number;
}

/** Why `convene_emergency` is refused, or null when it opens the vote (spec §9.2). Checked in this order. */
export function conveneBlock(a: ConveneAttempt): ConveneBlock | null {
  if (!a.available) return "unavailable";
  if (!a.windowOpen) return "window";
  if (a.isTarget) return "target";
  if (!a.seated) return "seat";
  if (a.friendlyToTarget) return "friendly";
  if (a.sanctioned) return "sanctioned";
  if (a.influenceMilli < CONVENE_COST_MILLI) return "influence";
  return null;
}

/** Spec §9.1: no convening while a session votes, during an emergency, or 30 s before a regular session. */
export function conveneWindowOpen(
  now: number,
  sessionOpen: boolean,
  emergencyActive: boolean,
  nextSessionTick: number | null,
): boolean {
  return (
    !sessionOpen &&
    !emergencyActive &&
    (nextSessionTick === null ||
      now < nextSessionTick - EMERGENCY_SESSION_GUARD_TICKS)
  );
}
```

`packages/engine-lib/src/congress/ResolutionEffects.ts` (스텁, Task 4가 채운다):

```ts
import {
  BallotOption,
  BUILDING_PACT_UNITS,
  ResolutionId,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  GovernmentId,
  LawId,
  LawOption,
  Modifier,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";

/** What the effect rules read of a resolution in force (ActiveResolution and ActiveResolutionData both fit). */
export interface ResolutionLike {
  resolution: ResolutionId;
  option: BallotOption;
  targets: readonly number[];
  param: string | null;
}

/** What the modifier rules read of a player. */
export interface ModifierFacts {
  smallID: number;
  government: GovernmentId;
  laws: ReadonlyMap<LawId, LawOption>;
}

/** The unit a building_pact parameter names, or null. */
export function buildingPactType(param: string | null): UnitType | null {
  return BUILDING_PACT_UNITS.find((u) => u.key === param)?.type ?? null;
}

// Task 4 (spec §8) fills in the rules below; until then nothing applies.

/** The domestic modifiers `r` gives a player with `facts`. */
export function resolutionModifiers(
  _r: ResolutionLike,
  _facts: ModifierFacts,
): Modifier[] {
  return [];
}

/** E2 B, S6 A, S7 A: whether `type` may not be bought, built, upgraded or produced by `smallID`. */
export function resolutionBans(
  _active: readonly ResolutionLike[],
  _smallID: number,
  _type: UnitType,
): boolean {
  return false;
}

/** E2 A: build-cost percent for `type`. */
export function resolutionBuildCostPct(
  _active: readonly ResolutionLike[],
  _type: UnitType,
): number {
  return 0;
}

/** E2 A: build-time percent for `type`. */
export function resolutionBuildTimePct(
  _active: readonly ResolutionLike[],
  _type: UnitType,
): number {
  return 0;
}

/** S6 B, S7 B: nuke production time percent for `smallID`. */
export function resolutionNukeTimePct(
  _active: readonly ResolutionLike[],
  _smallID: number,
): number {
  return 0;
}
```

`packages/engine-lib/src/configuration/Config.ts`:
- `GameTypes` import 목록에 `GameMode,`를 더한다.
- `warfareExpansion()` 메서드 뒤에:

```ts
  /** World congress (spec §3.1): only with domestic mode, in FFA, with the option on. */
  congress(): boolean {
    return (
      this.domesticMode() &&
      this._gameConfig.congress === true &&
      this._gameConfig.gameMode === GameMode.FFA
    );
  }
```

`packages/engine-lib/src/domestic/Policies.ts`의 `domesticModifiers`를 다음으로(주석 끝에 한 줄 더함):

```ts
/**
 * All of a domestic player's modifiers (researched techs, proclaimed laws,
 * the government and, in congress games, the resolutions in force), summed
 * per stat and per condition. The engine (PlayerDomestic) and the client
 * (DomesticClientView) both build their totals here so they can't drift
 * apart; each passes the conditions in force to ModifierTotals.pct.
 */
export function domesticModifiers(
  techs: Iterable<TechId>,
  laws: ReadonlyMap<LawId, LawOption>,
  government: GovernmentId,
  congress: readonly Modifier[] = [],
): ModifierTotals {
  return new ModifierTotals([
    ...techModifiers(techs),
    ...policyModifiers(laws, government),
    ...congress,
  ]);
}
```

- [ ] **Step 7: engine — 상태 클래스와 지표**

`packages/engine/src/congress/Metrics.ts`:

```ts
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import {
  ledgerBucket,
  WAR_PAIR_BUCKETS,
} from "@openfront/engine-lib/congress/CongressBalance";
import { ringSum } from "@openfront/engine-lib/congress/Ring";
import type { Game, Player } from "../game/Game";
import type { PairConflict } from "./Congress";

/** Spec §2.7: only connected humans and nations count in the ledger and on the agenda. */
export function isLedgerPlayer(p: Player): boolean {
  return (
    (p.type() === PlayerType.Human || p.type() === PlayerType.Nation) &&
    !p.isDisconnected()
  );
}

/** Spec §4.2: tiles taken as aggression in the last 180 s, as a percent of the map's land. */
export function aggressionPct(
  mg: Game,
  player: Player,
  now: number = mg.ticks(),
): number {
  const pc = player.congress();
  const land = mg.numLandTiles();
  return pc === null || land <= 0 ? 0 : (pc.takenTiles(now) * 100) / land;
}

/** Spec §4.2: tiles lost in the last 180 s, as a percent of what the player held. */
export function victimPct(
  mg: Game,
  player: Player,
  now: number = mg.ticks(),
): number {
  const pc = player.congress();
  if (pc === null) return 0;
  const lost = pc.lostTiles(now);
  const total = player.numTilesOwned() + lost;
  return total <= 0 ? 0 : (lost * 100) / total;
}

/** Spec §4.2: tiles a pair took from each other in the last 120 s, as a percent of the map's land. */
export function pairPct(
  mg: Game,
  pair: PairConflict,
  now: number = mg.ticks(),
): number {
  const land = mg.numLandTiles();
  if (land <= 0) return 0;
  const b = ledgerBucket(now);
  const tiles =
    ringSum(pair.lowTook, b, WAR_PAIR_BUCKETS) +
    ringSum(pair.highTook, b, WAR_PAIR_BUCKETS);
  return (tiles * 100) / land;
}

/** Land share of the land without fallout (the conquest basis), percent. */
export function landSharePct(mg: Game, player: Player): number {
  const land = mg.totalLandTiles();
  return land <= 0 ? 0 : (player.numTilesOwned() * 100) / land;
}
```

`packages/engine/src/congress/PlayerCongress.ts`:

```ts
import {
  BALLOT_OPTIONS,
  BallotOption,
  INFLUENCE_STATUSES,
  InfluenceStatus,
  PlayerCongressData,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  CONFLICT_MEMORY_TICKS,
  INFLUENCE_CAP_MILLI,
  LEDGER_BUCKETS,
  ledgerBucket,
} from "@openfront/engine-lib/congress/CongressBalance";
import {
  newRing,
  Ring,
  ringAdd,
  RingSchema,
  ringSum,
} from "@openfront/engine-lib/congress/Ring";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";

/** One ballot, with the influence it holds in escrow until the tally. */
export interface StoredBallot {
  sessionId: number;
  item: number;
  option: BallotOption;
  extra: number;
  costMilli: number;
}

const BallotSchema = z.object({
  sessionId: zInt(),
  item: zInt(),
  option: z.enum(BALLOT_OPTIONS),
  extra: zInt(),
  costMilli: zInt(),
});

export const PlayerCongressStateSchema = z.object({
  influenceMilli: zInt(),
  lastInfluenceMilli: zInt(),
  status: z.enum(INFLUENCE_STATUSES),
  taken: RingSchema,
  lost: RingSchema,
  nukes: RingSchema,
  hitBy: z.array(z.tuple([zInt(), zInt()])),
  ballots: z.array(BallotSchema),
});
export type PlayerCongressState = z.infer<typeof PlayerCongressStateSchema>;

function copyRing(r: Ring): Ring {
  return { head: r.head, slots: [...r.slots] };
}

/**
 * A player's world-congress state (spec §4, §5, §6): influence in integer
 * milli-points, the aggression ledger's rings (tiles taken as aggression,
 * tiles lost, nuke score), who hit this player lately, and the ballots it
 * cast in the open session. Every human and nation of a congress game has
 * one; bots don't.
 */
export class PlayerCongress {
  private influence = 0;
  private lastInfluence = 0;
  private _status: InfluenceStatus = "peaceful";
  private taken: Ring = newRing(LEDGER_BUCKETS);
  private lost: Ring = newRing(LEDGER_BUCKETS);
  private nukes: Ring = newRing(LEDGER_BUCKETS);
  /** smallID -> last tick it took land from or nuked this player, oldest first. */
  private hitBy = new Map<number, number>();
  private ballots: StoredBallot[] = [];
  /** toData() result until the next change. */
  private congressPlayerDataCache: PlayerCongressData | null = null;

  influenceMilli(): number {
    return this.influence;
  }

  status(): InfluenceStatus {
    return this._status;
  }

  /** One second of accrual (spec §5.1): adds up to the cap and records the rate and the status. */
  accrue(milli: number, status: InfluenceStatus): void {
    const room = Math.max(0, INFLUENCE_CAP_MILLI - this.influence);
    const add = Math.max(0, Math.min(milli, room));
    const s: InfluenceStatus =
      status === "peaceful" && room === 0 ? "capped" : status;
    if (add === 0 && this.lastInfluence === 0 && s === this._status) return;
    this.influence += add;
    this.lastInfluence = add;
    this._status = s;
    this.changed();
  }

  /** Refunds and lump sums: no cap. */
  grant(milli: number): void {
    if (milli <= 0) return;
    this.influence += milli;
    this.changed();
  }

  spend(milli: number): void {
    if (milli < 0 || milli > this.influence) {
      throw new Error(
        `cannot spend ${milli} influence milli-points, have ${this.influence}`,
      );
    }
    if (milli === 0) return;
    this.influence -= milli;
    this.changed();
  }

  /** Hegemony emergency success (spec §9.5). */
  clearInfluence(): void {
    if (this.influence === 0) return;
    this.influence = 0;
    this.changed();
  }

  recordTaken(tick: number, n: number): void {
    ringAdd(this.taken, ledgerBucket(tick), n);
  }

  recordLost(tick: number, n: number): void {
    ringAdd(this.lost, ledgerBucket(tick), n);
  }

  recordNuke(tick: number, score: number): void {
    ringAdd(this.nukes, ledgerBucket(tick), score);
  }

  recordHitBy(smallID: number, tick: number): void {
    this.hitBy.delete(smallID);
    this.hitBy.set(smallID, tick);
    for (const [id, t] of this.hitBy) {
      if (t >= tick - CONFLICT_MEMORY_TICKS) break;
      this.hitBy.delete(id);
    }
  }

  /** Tiles taken as aggression in the 180 s ending at `tick`. */
  takenTiles(tick: number): number {
    return ringSum(this.taken, ledgerBucket(tick), LEDGER_BUCKETS);
  }

  lostTiles(tick: number): number {
    return ringSum(this.lost, ledgerBucket(tick), LEDGER_BUCKETS);
  }

  nukeScore(tick: number): number {
    return ringSum(this.nukes, ledgerBucket(tick), LEDGER_BUCKETS);
  }

  /** The last tick `smallID` took land from or nuked this player; null if not in the last 180 s of records. */
  lastHitTick(smallID: number): number | null {
    return this.hitBy.get(smallID) ?? null;
  }

  ballot(sessionId: number, item: number): StoredBallot | null {
    return (
      this.ballots.find((b) => b.sessionId === sessionId && b.item === item) ??
      null
    );
  }

  ballotsFor(sessionId: number): StoredBallot[] {
    return this.ballots.filter((b) => b.sessionId === sessionId);
  }

  setBallot(b: StoredBallot): void {
    const i = this.ballots.findIndex(
      (x) => x.sessionId === b.sessionId && x.item === b.item,
    );
    if (i === -1) this.ballots.push({ ...b });
    else this.ballots[i] = { ...b };
    this.changed();
  }

  clearBallots(sessionId: number): void {
    const keep = this.ballots.filter((b) => b.sessionId !== sessionId);
    if (keep.length === this.ballots.length) return;
    this.ballots = keep;
    this.changed();
  }

  toData(): PlayerCongressData {
    this.congressPlayerDataCache ??= {
      influence: Math.floor(this.influence / MILLI),
      influencePerSec: this.lastInfluence / MILLI,
      status: this._status,
      ballots: this.ballots.map(({ sessionId, item, option, extra }) => ({
        sessionId,
        item,
        option,
        extra,
      })),
    };
    return this.congressPlayerDataCache;
  }

  snapshot(): PlayerCongressState {
    return {
      influenceMilli: this.influence,
      lastInfluenceMilli: this.lastInfluence,
      status: this._status,
      taken: copyRing(this.taken),
      lost: copyRing(this.lost),
      nukes: copyRing(this.nukes),
      hitBy: [...this.hitBy],
      ballots: this.ballots.map((b) => ({ ...b })),
    };
  }

  static restore(s: PlayerCongressState): PlayerCongress {
    const p = new PlayerCongress();
    p.influence = s.influenceMilli;
    p.lastInfluence = s.lastInfluenceMilli;
    p._status = s.status;
    p.taken = copyRing(s.taken);
    p.lost = copyRing(s.lost);
    p.nukes = copyRing(s.nukes);
    p.hitBy = new Map(s.hitBy);
    p.ballots = s.ballots.map((b) => ({ ...b }));
    p.congressPlayerDataCache = null;
    return p;
  }

  private changed(): void {
    this.congressPlayerDataCache = null;
  }
}
```

`packages/engine/src/congress/Congress.ts`:

```ts
import {
  AGENDA_REASONS,
  AgendaItemData,
  AvailableEmergencyData,
  BALLOT_OPTIONS,
  BallotOption,
  BUILDING_PACT_UNITS,
  CongressData,
  EMERGENCY_KINDS,
  EmergencyKind,
  RankEntry,
  RESOLUTION_IDS,
  ResolutionExpiry,
  ResolutionId,
  ResultData,
  SESSION_KINDS,
  SessionKind,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  TECH_IDS,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import type { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  CONFLICT_MEMORY_TICKS,
  EMERGENCY_MAX_PER_GAME,
  EMERGENCY_VOTING_TICKS,
  extraVoteCostMilli,
  HISTORY_LENGTH,
  ledgerBucket,
  RANK_LENGTH,
  RANK_MIN_AGGRESSION_PCT,
  RANK_MIN_VICTIM_PCT,
  round1,
  VOTING_TICKS,
  WAR_PAIR_BUCKETS,
} from "@openfront/engine-lib/congress/CongressBalance";
import {
  newRing,
  Ring,
  ringAdd,
  RingSchema,
} from "@openfront/engine-lib/congress/Ring";
import {
  BallotBlock,
  ballotBlock,
} from "@openfront/engine-lib/congress/Voting";
import { zInt, zNum, zRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { simpleHash } from "@openfront/engine-lib/Util";
import { z } from "zod";
import type { Game, Player, Unit } from "../game/Game";
import type {
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { aggressionPct, victimPct } from "./Metrics";

/** An agenda item while its session votes. */
export type AgendaItem = AgendaItemData;
export type AgendaItemInit = Omit<AgendaItemData, "voters">;

export interface Session {
  id: number;
  kind: SessionKind;
  openTick: number;
  closeTick: number;
  items: AgendaItem[];
}

/** One tallied item (Congress.closeSession). Clients only see the totals; the voter lists make emergency members. */
export interface ItemResult {
  sessionId: number;
  kind: SessionKind;
  index: number;
  item: AgendaItem;
  a: number;
  b: number;
  adopted: BallotOption | null;
  /** smallIDs of the A / B voters, in allPlayers() order. */
  aVoters: number[];
  bVoters: number[];
}

/** An adopted resolution or an emergency outcome in force (plan decision 3). */
export interface ActiveResolution {
  resolution: ResolutionId;
  option: BallotOption;
  targets: number[];
  param: string | null;
  sinceTick: number;
  expires: ResolutionExpiry;
  source: "session" | "emergency";
}

/** A war between two players (spec §4.1); low < high are smallIDs. */
export interface PairConflict {
  low: number;
  high: number;
  /** Who took the first tile after 180 s without any between them. */
  initiator: number;
  lastTick: number;
  /** Tiles low took from high / high took from low, per ledger bucket (120 s window). */
  lowTook: Ring;
  highTook: Ring;
}

export interface EmergencyState {
  kind: EmergencyKind;
  target: number;
  startTick: number;
  endTick: number;
  goalKind: "land" | "silos";
  goal: number;
  progress: number;
  /** In joining order. */
  members: number[];
  /** Voted against: never members. */
  opposed: number[];
  /** smallID -> contribution, in first-contribution order. */
  contributions: Map<number, number>;
  /** Nuclear: the target's finished silos when it started. */
  goalSilos: Unit[];
  /** Ids of goal silos already counted. */
  countedSilos: number[];
}

export type AvailableEmergency = AvailableEmergencyData;

export interface WorldGovVerdict {
  host: number;
  ratified: boolean;
}

export function pairKey(a: number, b: number): number {
  return a < b ? a * 65536 + b : b * 65536 + a;
}

const ItemSchema = z.object({
  resolution: z.enum(RESOLUTION_IDS),
  targets: z.array(zInt()),
  param: z.string().nullable(),
  reason: z.enum(AGENDA_REASONS),
  reasonValue: zNum(),
  voters: zInt(),
});

const ExpirySchema = z.union([
  z.literal("next_tally"),
  z.literal("project_end"),
  zInt(),
]);

const RankSchema = z.array(z.object({ id: zInt(), pct: zNum() }));

export const CongressStateSchema = z.object({
  nextSessionTick: zInt().nullable(),
  nextSessionId: zInt(),
  session: z
    .object({
      id: zInt(),
      kind: z.enum(SESSION_KINDS),
      openTick: zInt(),
      closeTick: zInt(),
      items: z.array(ItemSchema),
    })
    .nullable(),
  seats: z.array(zInt()),
  active: z.array(
    z.object({
      resolution: z.enum(RESOLUTION_IDS),
      option: z.enum(BALLOT_OPTIONS),
      targets: z.array(zInt()),
      param: z.string().nullable(),
      sinceTick: zInt(),
      expires: ExpirySchema,
      source: z.enum(["session", "emergency"]),
    }),
  ),
  history: z.array(
    z.object({
      sessionId: zInt(),
      kind: z.enum(SESSION_KINDS),
      tick: zInt(),
      resolution: z.enum(RESOLUTION_IDS),
      targets: z.array(zInt()),
      param: z.string().nullable(),
      a: zInt(),
      b: zInt(),
      adopted: z.enum(BALLOT_OPTIONS).nullable(),
    }),
  ),
  emergency: z
    .object({
      kind: z.enum(EMERGENCY_KINDS),
      target: zInt(),
      startTick: zInt(),
      endTick: zInt(),
      goalKind: z.enum(["land", "silos"]),
      goal: zInt(),
      progress: zInt(),
      members: z.array(zInt()),
      opposed: z.array(zInt()),
      contributions: z.array(z.tuple([zInt(), zInt()])),
      goalSilos: z.array(zRef()),
      countedSilos: z.array(zInt()),
    })
    .nullable(),
  available: z.array(
    z.object({
      kind: z.enum(EMERGENCY_KINDS),
      target: zInt(),
      sinceTick: zInt(),
    }),
  ),
  cooldownUntil: zInt(),
  targetCooldowns: z.array(z.tuple([zInt(), zInt()])),
  emergenciesStarted: zInt(),
  hegemonyUsed: z.array(z.tuple([zInt(), zInt()])),
  eliminations: z.array(z.tuple([zInt(), zInt()])),
  pairs: z.array(
    z.object({
      low: zInt(),
      high: zInt(),
      initiator: zInt(),
      lastTick: zInt(),
      lowTook: RingSchema,
      highTook: RingSchema,
    }),
  ),
  lastSecurity: z.enum(RESOLUTION_IDS).nullable(),
  lastEconomy: z.enum(RESOLUTION_IDS).nullable(),
  lastBuildingKey: z.string().nullable(),
  built: z.array(z.tuple([z.string(), zInt()])),
  verdicts: z.array(z.tuple([zInt(), zInt(), z.boolean()])),
  discountedTechs: z.array(z.enum(TECH_IDS)),
  aggressors: RankSchema,
  victims: RankSchema,
});
export type CongressState = z.infer<typeof CongressStateSchema>;

function copyRing(r: Ring): Ring {
  return { head: r.head, slots: [...r.slots] };
}

/**
 * The world congress of one game (spec §6-§10): the schedule, the open
 * session and its ballot box, the seats, the resolutions in force, the
 * emergency, the war pairs of the aggression ledger, the result history and
 * what the agenda remembers. Rules live in the congress/*.ts modules; this
 * class stores and reports. Only congress games have one (GameImpl).
 */
export class Congress {
  private nextSession: number | null = null;
  private nextSessionId = 1;
  private _session: Session | null = null;
  private _seats: number[] = [];
  private _active: ActiveResolution[] = [];
  private _history: ResultData[] = [];
  private _emergency: EmergencyState | null = null;
  private _available: AvailableEmergency[] = [];
  private cooldownUntil = 0;
  private targetCooldowns = new Map<number, number>();
  private started = 0;
  /** smallID -> hegemony thresholds already used (0..2). */
  private hegemonyUsed = new Map<number, number>();
  /** Conqueror smallID -> last tick it eliminated a human. */
  private eliminations = new Map<number, number>();
  private _pairs = new Map<number, PairConflict>();
  private lastSecurity: ResolutionId | null = null;
  private lastEconomy: ResolutionId | null = null;
  private lastBuildingKey: string | null = null;
  /** building_pact key -> constructions started since the last regular session. */
  private built = new Map<string, number>();
  /** Owner smallID -> the latest world-government decision on its proclamation. */
  private verdicts = new Map<number, WorldGovVerdict>();
  private _discountedTechs: TechId[] = [];
  private aggressors: RankEntry[] = [];
  private victims: RankEntry[] = [];
  /** toData() result until the next change. */
  private congressDataCache: CongressData | null = null;
  /** The CongressData last handed to clients (none in a fresh or restored game: its first tick sends one). */
  private lastSentCongressData: CongressData | null = null;

  constructor(private mg: Game) {}

  // --- schedule and sessions (spec §6) ---

  nextSessionTick(): number | null {
    return this.nextSession;
  }

  scheduleNextSession(tick: number): void {
    this.nextSession = tick;
    this.changed();
  }

  session(): Session | null {
    return this._session;
  }

  /** Opens a voting session now (spec §6.1, §9.3). Only one session is open at a time. */
  openSession(
    kind: SessionKind,
    items: readonly AgendaItemInit[],
    now: number,
  ): Session {
    if (this._session !== null) {
      throw new Error("a congress session is already open");
    }
    const s: Session = {
      id: this.nextSessionId++,
      kind,
      openTick: now,
      closeTick:
        now + (kind === "regular" ? VOTING_TICKS : EMERGENCY_VOTING_TICKS),
      items: items.map((i) => ({ ...i, targets: [...i.targets], voters: 0 })),
    };
    this._session = s;
    this.changed();
    return s;
  }

  /** A seat, or one of the item's targets (spec §6.2). */
  canVote(player: Player, item: AgendaItem): boolean {
    return (
      this.isSeated(player.smallID()) || item.targets.includes(player.smallID())
    );
  }

  /** Emergency votes: the target and its friends may only oppose (spec §9.3). */
  bOnly(player: Player, item: AgendaItem): boolean {
    if (item.resolution !== "emergency") return false;
    if (item.targets.includes(player.smallID())) return true;
    const target = this.mg.playerBySmallID(item.targets[0]);
    return target.isPlayer() && player.isFriendly(target, true);
  }

  /**
   * A ballot, or a raise of its extra votes (spec §6.3). Spends the
   * difference in escrow and returns null; refuses (spending nothing) with
   * the reason otherwise.
   */
  castBallot(
    player: Player,
    sessionId: number,
    index: number,
    option: BallotOption,
    extra: number,
  ): BallotBlock | null {
    const s = this._session;
    const pc = player.congress();
    const item = s?.items[index];
    const existing = pc?.ballot(sessionId, index) ?? null;
    const block = ballotBlock({
      open:
        s !== null &&
        s.id === sessionId &&
        this.mg.ticks() < s.closeTick &&
        pc !== null &&
        player.isAlive(),
      itemExists: item !== undefined,
      eligible: item !== undefined && this.canVote(player, item),
      bOnly: item !== undefined && this.bOnly(player, item),
      existing,
      option,
      extra,
      influenceMilli: pc?.influenceMilli() ?? 0,
    });
    if (block !== null || pc === null || item === undefined) return block;
    const cost = extraVoteCostMilli(existing?.extra ?? 0, extra);
    pc.spend(cost);
    pc.setBallot({
      sessionId,
      item: index,
      option,
      extra,
      costMilli: (existing?.costMilli ?? 0) + cost,
    });
    if (existing === null) item.voters++;
    this.changed();
    return null;
  }

  /**
   * Tallies the open session (spec §6.4): the larger side wins, a tie adopts
   * nothing; the losing side and ties get their influence back. Records the
   * results in the history and clears the ballots.
   */
  closeSession(): ItemResult[] {
    const s = this._session;
    if (s === null) return [];
    const now = this.mg.ticks();
    const results: ItemResult[] = s.items.map((item, index) => ({
      sessionId: s.id,
      kind: s.kind,
      index,
      item,
      a: 0,
      b: 0,
      adopted: null,
      aVoters: [],
      bVoters: [],
    }));
    const players = this.mg.allPlayers();
    for (const p of players) {
      for (const b of p.congress()?.ballotsFor(s.id) ?? []) {
        const r = results[b.item];
        if (r === undefined) continue;
        if (b.option === "A") {
          r.a += 1 + b.extra;
          r.aVoters.push(p.smallID());
        } else {
          r.b += 1 + b.extra;
          r.bVoters.push(p.smallID());
        }
      }
    }
    for (const r of results) {
      r.adopted = r.a > r.b ? "A" : r.b > r.a ? "B" : null;
    }
    for (const p of players) {
      const pc = p.congress();
      if (pc === null) continue;
      for (const b of pc.ballotsFor(s.id)) {
        if (results[b.item]?.adopted !== b.option) pc.grant(b.costMilli);
      }
      pc.clearBallots(s.id);
    }
    for (const r of results) {
      this._history.push({
        sessionId: s.id,
        kind: s.kind,
        tick: now,
        resolution: r.item.resolution,
        targets: [...r.item.targets],
        param: r.item.param,
        a: r.a,
        b: r.b,
        adopted: r.adopted,
      });
    }
    if (this._history.length > HISTORY_LENGTH) {
      this._history = this._history.slice(-HISTORY_LENGTH);
    }
    this._session = null;
    this.changed();
    return results;
  }

  history(): readonly ResultData[] {
    return this._history;
  }

  // --- seats (spec §6.2) ---

  seats(): readonly number[] {
    return this._seats;
  }

  setSeats(ids: readonly number[]): void {
    this._seats = [...ids].sort((a, b) => a - b);
    this.changed();
  }

  isSeated(smallID: number): boolean {
    return this._seats.includes(smallID);
  }

  // --- resolutions in force (spec §8) ---

  active(): readonly ActiveResolution[] {
    return this._active;
  }

  addResolution(r: ActiveResolution): void {
    this._active.push({ ...r, targets: [...r.targets] });
    this.changed();
  }

  /** At a regular tally: what lasted until the next result ends (spec §8). */
  dropTallyResolutions(): void {
    const keep = this._active.filter((r) => r.expires !== "next_tally");
    if (keep.length === this._active.length) return;
    this._active = keep;
    this.changed();
  }

  /** Timed resolutions past their tick; project_end ones whose project is over. */
  expireResolutions(now: number): void {
    const keep = this._active.filter((r) => {
      if (typeof r.expires === "number") return r.expires > now;
      if (r.expires === "project_end") {
        return this.projectRunning(r.targets[0], Number(r.param));
      }
      return true;
    });
    if (keep.length === this._active.length) return;
    this._active = keep;
    this.changed();
  }

  private projectRunning(owner: number, host: number): boolean {
    const p = this.mg.playerBySmallID(owner);
    if (!p.isPlayer() || !p.isAlive()) return false;
    return p.domestic()?.victoryProject()?.hostUnitId === host;
  }

  /** S1 A, from a session or an aggression emergency. */
  isSanctioned(smallID: number): boolean {
    return this._active.some(
      (r) =>
        r.resolution === "sanction" &&
        r.option === "A" &&
        r.targets.includes(smallID),
    );
  }

  // --- the emergency (spec §9; the rules are in Emergencies.ts) ---

  emergency(): EmergencyState | null {
    return this._emergency;
  }

  setEmergency(e: EmergencyState | null): void {
    this._emergency = e;
    this.changed();
  }

  /** Mutates the running emergency in place (does nothing without one). */
  updateEmergency(fn: (e: EmergencyState) => void): void {
    if (this._emergency === null) return;
    fn(this._emergency);
    this.changed();
  }

  isEmergencyTarget(smallID: number): boolean {
    return this._emergency?.target === smallID;
  }

  isEmergencyMember(smallID: number): boolean {
    return this._emergency?.members.includes(smallID) ?? false;
  }

  /** The member with the highest contribution above 0 (ties: lower smallID). */
  emergencyHero(): number | null {
    const e = this._emergency;
    if (e === null) return null;
    let hero: number | null = null;
    let best = 0;
    for (const [id, n] of e.contributions) {
      if (n > best || (n === best && n > 0 && hero !== null && id < hero)) {
        hero = id;
        best = n;
      }
    }
    return hero;
  }

  available(): readonly AvailableEmergency[] {
    return this._available;
  }

  setAvailable(list: readonly AvailableEmergency[]): void {
    if (JSON.stringify(list) === JSON.stringify(this._available)) return;
    this._available = list.map((a) => ({ ...a }));
    this.changed();
  }

  globalCooldownUntil(): number {
    return this.cooldownUntil;
  }

  setGlobalCooldown(tick: number): void {
    this.cooldownUntil = tick;
    this.changed();
  }

  targetCooldownUntil(smallID: number): number {
    return this.targetCooldowns.get(smallID) ?? 0;
  }

  setTargetCooldown(smallID: number, tick: number): void {
    this.targetCooldowns.set(smallID, tick);
  }

  emergenciesStarted(): number {
    return this.started;
  }

  countEmergencyStarted(): void {
    this.started++;
    this.changed();
  }

  hegemonyLevelUsed(smallID: number): number {
    return this.hegemonyUsed.get(smallID) ?? 0;
  }

  useHegemonyLevel(smallID: number, level: number): void {
    this.hegemonyUsed.set(smallID, level);
  }

  lastElimination(smallID: number): number | null {
    return this.eliminations.get(smallID) ?? null;
  }

  noteElimination(smallID: number, tick: number): void {
    this.eliminations.set(smallID, tick);
  }

  // --- war pairs (spec §4.1; Ledger.ts writes them) ---

  pair(a: number, b: number): PairConflict | undefined {
    return this._pairs.get(pairKey(a, b));
  }

  pairs(): PairConflict[] {
    return [...this._pairs.values()];
  }

  /**
   * Records one tile `taker` took from `loser` now and returns the pair's
   * conflict. A pair quiet for longer than CONFLICT_MEMORY_TICKS starts a
   * new conflict with `taker` as the initiator.
   */
  touchPair(taker: number, loser: number, now: number): PairConflict {
    const key = pairKey(taker, loser);
    let p = this._pairs.get(key);
    if (p === undefined || now - p.lastTick > CONFLICT_MEMORY_TICKS) {
      this._pairs.delete(key);
      p = {
        low: Math.min(taker, loser),
        high: Math.max(taker, loser),
        initiator: taker,
        lastTick: now,
        lowTook: newRing(WAR_PAIR_BUCKETS),
        highTook: newRing(WAR_PAIR_BUCKETS),
      };
      this._pairs.set(key, p);
    }
    p.lastTick = now;
    ringAdd(taker === p.low ? p.lowTook : p.highTook, ledgerBucket(now), 1);
    return p;
  }

  prunePairs(now: number): void {
    for (const [key, p] of this._pairs) {
      if (now - p.lastTick > CONFLICT_MEMORY_TICKS) this._pairs.delete(key);
    }
  }

  // --- agenda memory (Sessions.ts) ---

  lastSecurityKind(): ResolutionId | null {
    return this.lastSecurity;
  }

  lastEconomyKind(): ResolutionId | null {
    return this.lastEconomy;
  }

  lastBuildingTarget(): string | null {
    return this.lastBuildingKey;
  }

  rememberAgenda(
    security: ResolutionId | null,
    economy: ResolutionId | null,
    buildingKey: string | null,
  ): void {
    this.lastSecurity = security;
    this.lastEconomy = economy;
    this.lastBuildingKey = buildingKey;
  }

  /** Called when any player starts building `type` (PlayerImpl.recordUnitConstructed). */
  noteBuilt(type: UnitType): void {
    const key = BUILDING_PACT_UNITS.find((u) => u.type === type)?.key;
    if (key === undefined) return;
    this.built.set(key, (this.built.get(key) ?? 0) + 1);
  }

  /** The counts since the last regular session; starts the next count. */
  takeBuiltCounts(): Map<string, number> {
    const counts = this.built;
    this.built = new Map();
    return counts;
  }

  // --- world government (WorldGovernment.ts) ---

  verdict(owner: number): WorldGovVerdict | undefined {
    return this.verdicts.get(owner);
  }

  setVerdict(owner: number, v: WorldGovVerdict): void {
    this.verdicts.set(owner, { ...v });
    this.changed();
  }

  // --- tech pact (Effects.ts) ---

  discountedTechs(): readonly TechId[] {
    return this._discountedTechs;
  }

  setDiscountedTechs(list: readonly TechId[]): void {
    if (
      list.length === this._discountedTechs.length &&
      list.every((t, i) => t === this._discountedTechs[i])
    ) {
      return;
    }
    this._discountedTechs = [...list];
    this.changed();
  }

  // --- the rankings of the congress screen (spec §4.2) ---

  refreshRanking(now: number): void {
    const aggressors: RankEntry[] = [];
    const victims: RankEntry[] = [];
    for (const p of this.mg.players()) {
      if (p.congress() === null) continue;
      const a = aggressionPct(this.mg, p, now);
      if (a >= RANK_MIN_AGGRESSION_PCT) {
        aggressors.push({ id: p.smallID(), pct: round1(a) });
      }
      const v = victimPct(this.mg, p, now);
      if (v >= RANK_MIN_VICTIM_PCT) {
        victims.push({ id: p.smallID(), pct: round1(v) });
      }
    }
    const order = (x: RankEntry, y: RankEntry) => y.pct - x.pct || x.id - y.id;
    const a = aggressors.sort(order).slice(0, RANK_LENGTH);
    const v = victims.sort(order).slice(0, RANK_LENGTH);
    if (
      JSON.stringify(a) === JSON.stringify(this.aggressors) &&
      JSON.stringify(v) === JSON.stringify(this.victims)
    ) {
      return;
    }
    this.aggressors = a;
    this.victims = v;
    this.changed();
  }

  // --- data, snapshot, hash ---

  toData(): CongressData {
    const e = this._emergency;
    this.congressDataCache ??= {
      nextSessionTick: this.nextSession ?? 0,
      session:
        this._session === null
          ? null
          : {
              id: this._session.id,
              kind: this._session.kind,
              openTick: this._session.openTick,
              closeTick: this._session.closeTick,
              items: this._session.items.map((i) => ({
                ...i,
                targets: [...i.targets],
              })),
            },
      seats: [...this._seats],
      active: this._active.map((r) => ({
        resolution: r.resolution,
        option: r.option,
        targets: [...r.targets],
        param: r.param,
        sinceTick: r.sinceTick,
        expires: r.expires,
      })),
      emergency:
        e === null
          ? null
          : {
              kind: e.kind,
              target: e.target,
              startTick: e.startTick,
              endTick: e.endTick,
              goalKind: e.goalKind,
              goal: e.goal,
              progress: e.progress,
              members: [...e.members],
              hero: this.emergencyHero(),
            },
      available: this._available.map((a) => ({ ...a })),
      cooldownUntilTick: this.cooldownUntil,
      emergenciesLeft: Math.max(0, EMERGENCY_MAX_PER_GAME - this.started),
      history: this._history.map((h) => ({ ...h, targets: [...h.targets] })),
      discountedTechs: [...this._discountedTechs],
      aggressors: this.aggressors.map((r) => ({ ...r })),
      victims: this.victims.map((r) => ({ ...r })),
      verdicts: [...this.verdicts].map(([owner, v]) => ({
        owner,
        host: v.host,
        ratified: v.ratified,
      })),
    };
    return this.congressDataCache;
  }

  /** The data to send this tick, or null when clients already have it. */
  takeUnsentData(): CongressData | null {
    const d = this.toData();
    if (d === this.lastSentCongressData) return null;
    this.lastSentCongressData = d;
    return d;
  }

  hash(): number {
    return simpleHash(JSON.stringify(this.toData()));
  }

  snapshot(w: SnapshotWriter): CongressState {
    const e = this._emergency;
    return {
      nextSessionTick: this.nextSession,
      nextSessionId: this.nextSessionId,
      session:
        this._session === null
          ? null
          : {
              ...this._session,
              items: this._session.items.map((i) => ({
                ...i,
                targets: [...i.targets],
              })),
            },
      seats: [...this._seats],
      active: this._active.map((r) => ({ ...r, targets: [...r.targets] })),
      history: this._history.map((h) => ({ ...h, targets: [...h.targets] })),
      emergency:
        e === null
          ? null
          : {
              kind: e.kind,
              target: e.target,
              startTick: e.startTick,
              endTick: e.endTick,
              goalKind: e.goalKind,
              goal: e.goal,
              progress: e.progress,
              members: [...e.members],
              opposed: [...e.opposed],
              contributions: [...e.contributions],
              goalSilos: e.goalSilos.map((u) => w.unit(u)),
              countedSilos: [...e.countedSilos],
            },
      available: this._available.map((a) => ({ ...a })),
      cooldownUntil: this.cooldownUntil,
      targetCooldowns: [...this.targetCooldowns],
      emergenciesStarted: this.started,
      hegemonyUsed: [...this.hegemonyUsed],
      eliminations: [...this.eliminations],
      pairs: [...this._pairs.values()].map((p) => ({
        ...p,
        lowTook: copyRing(p.lowTook),
        highTook: copyRing(p.highTook),
      })),
      lastSecurity: this.lastSecurity,
      lastEconomy: this.lastEconomy,
      lastBuildingKey: this.lastBuildingKey,
      built: [...this.built],
      verdicts: [...this.verdicts].map(
        ([owner, v]) => [owner, v.host, v.ratified] as [number, number, boolean],
      ),
      discountedTechs: [...this._discountedTechs],
      aggressors: this.aggressors.map((r) => ({ ...r })),
      victims: this.victims.map((r) => ({ ...r })),
    };
  }

  /** Fills this congress from a snapshot; `mg` already is the restored game. Assigns only. */
  restoreState(s: CongressState, r: SnapshotReader): void {
    this.nextSession = s.nextSessionTick;
    this.nextSessionId = s.nextSessionId;
    this._session =
      s.session === null
        ? null
        : {
            ...s.session,
            items: s.session.items.map((i) => ({
              ...i,
              targets: [...i.targets],
            })),
          };
    this._seats = [...s.seats];
    this._active = s.active.map((a) => ({ ...a, targets: [...a.targets] }));
    this._history = s.history.map((h) => ({ ...h, targets: [...h.targets] }));
    this._emergency =
      s.emergency === null
        ? null
        : {
            ...s.emergency,
            members: [...s.emergency.members],
            opposed: [...s.emergency.opposed],
            contributions: new Map(s.emergency.contributions),
            goalSilos: s.emergency.goalSilos.map((i) => r.unit(i)),
            countedSilos: [...s.emergency.countedSilos],
          };
    this._available = s.available.map((a) => ({ ...a }));
    this.cooldownUntil = s.cooldownUntil;
    this.targetCooldowns = new Map(s.targetCooldowns);
    this.started = s.emergenciesStarted;
    this.hegemonyUsed = new Map(s.hegemonyUsed);
    this.eliminations = new Map(s.eliminations);
    this._pairs = new Map(
      s.pairs.map((p) => [
        pairKey(p.low, p.high),
        {
          ...p,
          lowTook: copyRing(p.lowTook),
          highTook: copyRing(p.highTook),
        },
      ]),
    );
    this.lastSecurity = s.lastSecurity;
    this.lastEconomy = s.lastEconomy;
    this.lastBuildingKey = s.lastBuildingKey;
    this.built = new Map(s.built);
    this.verdicts = new Map(
      s.verdicts.map(([owner, host, ratified]) => [owner, { host, ratified }]),
    );
    this._discountedTechs = [...s.discountedTechs];
    this.aggressors = s.aggressors.map((x) => ({ ...x }));
    this.victims = s.victims.map((x) => ({ ...x }));
    this.congressDataCache = null;
    this.lastSentCongressData = null;
  }

  private changed(): void {
    this.congressDataCache = null;
  }
}
```

- [ ] **Step 8: engine — 갈래 스텁(시그니처 고정)**

`packages/engine/src/congress/Ledger.ts`:

```ts
import type { Game, Player } from "../game/Game";
import type { Congress } from "./Congress";

// Task 2 (spec §4) fills these in. Until then the ledger records nothing.

/** GameImpl.conquer: `next` took a tile from `prev` (both players). */
export function ledgerConquer(
  _mg: Game,
  _c: Congress,
  _prev: Player,
  _next: Player,
): void {}

/** Spec §4.2: attacking a connected human or nation first, right now. */
export function isAggressing(_mg: Game, _player: Player): boolean {
  return false;
}

/** Captures that are never aggression: an emergency member against the target, anyone against a condemned project's owner. */
export function aggressionExempt(
  _mg: Game,
  _c: Congress,
  _attacker: Player,
  _defender: Player,
): boolean {
  return false;
}
```

`packages/engine/src/congress/Influence.ts`:

```ts
import type { Game } from "../game/Game";
import type { Congress } from "./Congress";

// Task 2 (spec §5) fills this in. Until then nobody earns influence.

/** Once a second, after the domestic economy: every player's influence accrual. */
export function accrueInfluence(_mg: Game, _c: Congress): void {}
```

`packages/engine/src/congress/Sessions.ts`:

```ts
import type { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import type { Game } from "../game/Game";
import type { Congress, ItemResult } from "./Congress";

// Task 3 (spec §6.2, §7, §8) fills these in. Until then no session opens.

/** At the scheduled tick: seats, the agenda, and the session opens. */
export function openRegularSession(
  _mg: Game,
  _c: Congress,
  _random: PseudoRandom,
): void {}

/** After a regular tally: the adopted resolution goes in force and everyone hears. */
export function onRegularResult(
  _mg: Game,
  _c: Congress,
  _result: ItemResult,
): void {}
```

`packages/engine/src/congress/Effects.ts`:

```ts
import type {
  Modifier,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import type { UnitType } from "@openfront/engine-api/game/GameTypes";
import type { Game, Player } from "../game/Game";
import type { Congress } from "./Congress";

// Task 4 (spec §8) fills these in. Until then no resolution changes anything.

/** Once a second: every player's congress modifiers into its domestic totals; the tech-pact list. */
export function refreshCongressEffects(_mg: Game, _c: Congress): void {}

/** The modifiers the resolutions in force give `player` now. */
export function congressModifiers(
  _mg: Game,
  _c: Congress,
  _player: Player,
): Modifier[] {
  return [];
}

/** S1 A: a sanctioned side trades with nobody. */
export function tradeBlocked(_c: Congress, _a: Player, _b: Player): boolean {
  return false;
}

/** S1 A: a sanctioned player receives no gold or troops. */
export function donationBlocked(_c: Congress, _recipient: Player): boolean {
  return false;
}

/** E2 B, S6 A, S7 A and the nuclear-emergency ban (stock launches are never banned). */
export function congressBans(
  _c: Congress,
  _player: Player,
  _type: UnitType,
): boolean {
  return false;
}

/** E2 A: build-cost percent for `type`. */
export function buildCostPct(_c: Congress, _type: UnitType): number {
  return 0;
}

/** E2 A: build-time percent for `type`. */
export function buildTimePct(_c: Congress, _type: UnitType): number {
  return 0;
}

/** S6 B, S7 B: nuke production time percent for `player`. */
export function nukeProductionTimePct(_c: Congress, _player: Player): number {
  return 0;
}

/** E4 A: what `tech` costs now, in milli-points. */
export function researchCostMilli(
  _c: Congress | null,
  _tech: TechId,
  baseMilli: number,
): number {
  return baseMilli;
}

/** E4 A: research time percent for `tech` now. */
export function researchTimePct(_c: Congress | null, _tech: TechId): number {
  return 0;
}

/** E4 B: the patent when `player` completes `tech`. */
export function onResearchComplete(
  _mg: Game,
  _player: Player,
  _tech: TechId,
): void {}
```

`packages/engine/src/congress/Conflict.ts`:

```ts
import type { TileRef } from "@openfront/engine-api/game/GameMap";
import type { DomesticCombat } from "../domestic/DomesticEconomy";
import type { Game, Player, Unit } from "../game/Game";
import type { Congress } from "./Congress";

// Task 5 (spec §8, §9.4, §10.2) fills these in. Until then nothing applies.

/** S2 A truces (sessions and emergency aftermaths) and emergency members among themselves. */
export function isTruce(_c: Congress, _a: Player, _b: Player): boolean {
  return false;
}

/** `base` (the domestic combat scales) times the congress scales of this pair. */
export function withCongressCombat(
  base: Readonly<DomesticCombat>,
  _c: Congress | null,
  _attacker: Player,
  _defender: Player | null,
): Readonly<DomesticCombat> {
  return base;
}

/** World heritage A: the host can't be destroyed. */
export function isHeritageProtected(_mg: Game, _unit: Unit): boolean {
  return false;
}

const NO_TILES: ReadonlySet<TileRef> = new Set<TileRef>();

/** The tiles protected hosts stand on: blasts leave them owned. */
export function heritageHostTiles(_mg: Game): ReadonlySet<TileRef> {
  return NO_TILES;
}
```

`packages/engine/src/congress/WorldGovernment.ts`:

```ts
import type { Game, Player } from "../game/Game";
import type { Congress, ItemResult } from "./Congress";

// Task 5 (spec §10.1, §10.3) fills these in.

/** One-shot effects of an adopted item (world government: progress and verdict). */
export function applyAdoption(
  _mg: Game,
  _c: Congress,
  _result: ItemResult,
): void {}

/** A complete world-government proclamation that the congress hasn't ratified: no victory yet. */
export function awaitsRatification(_mg: Game, _player: Player): boolean {
  return false;
}

/** Spec §10.3: whether nations may single out `player`'s victory project (always without a congress). */
export function isProjectCondemned(_mg: Game, _player: Player): boolean {
  return true;
}
```

`packages/engine/src/congress/Emergencies.ts`:

```ts
import type { EmergencyKind } from "@openfront/engine-api/congress/CongressTypes";
import type { NukeWeapon } from "@openfront/engine-lib/congress/CongressBalance";
import type { ConveneBlock } from "@openfront/engine-lib/congress/Voting";
import type { Game, Player } from "../game/Game";
import type { Congress, ItemResult } from "./Congress";

// Task 6 (spec §9) fills these in. Until then nothing can be convened.

/** Once a second: the running emergency, then the available list. */
export function processEmergencySecond(_mg: Game, _c: Congress): void {}

/** After an emergency vote: it starts, or the cooldowns do. */
export function onEmergencyVote(
  _mg: Game,
  _c: Congress,
  _result: ItemResult,
): void {}

/** convene_emergency: pays and opens the vote; returns why not otherwise. */
export function conveneEmergency(
  _mg: Game,
  _convener: Player,
  _kind: EmergencyKind,
  _target: Player,
): ConveneBlock | null {
  return "unavailable";
}

/** GameImpl.conquer: late joiners and contributions against the target. */
export function emergencyConquer(
  _mg: Game,
  _c: Congress,
  _prev: Player,
  _next: Player,
): void {}

/** A nuke, MIRV or orbital strike hit: the shooter's score, the victims' losses. */
export function congressNukeHit(
  _mg: Game,
  _c: Congress,
  _shooter: Player,
  _impacted: ReadonlyMap<Player, number>,
  _weapon: NukeWeapon,
): void {}

/** GameImpl.conquerPlayer: a human's elimination makes its conqueror's emergency available. */
export function congressElimination(
  _mg: Game,
  _c: Congress,
  _conqueror: Player,
  _conquered: Player,
): void {}
```

- [ ] **Step 9: engine — 시계와 명령 Execution, 등록**

`packages/engine/src/congress/CongressExecution.ts`:

```ts
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { SESSION_INTERVAL_TICKS } from "@openfront/engine-lib/congress/CongressBalance";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { zRandom } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { refreshCongressEffects } from "./Effects";
import { onEmergencyVote, processEmergencySecond } from "./Emergencies";
import { accrueInfluence } from "./Influence";
import { onRegularResult, openRegularSession } from "./Sessions";

/**
 * The world congress clock (spec §6.1, plan decision 9): closes sessions at
 * their close tick, opens regular ones on schedule, and runs the second of
 * influence, emergencies and effects. One per game, added by GameRunner
 * when the option is on; the state lives in Congress and PlayerCongress.
 */
export class CongressExecution implements Execution {
  private mg: Game | undefined = undefined;
  private random: PseudoRandom;

  constructor(seed: number) {
    this.random = new PseudoRandom(seed);
  }

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    const c = mg.congress();
    if (c !== null && c.nextSessionTick() === null) {
      c.scheduleNextSession(ticks + SESSION_INTERVAL_TICKS);
    }
  }

  tick(_ticks: number): void {
    const mg = this.mg;
    const c = mg?.congress() ?? null;
    if (mg === undefined || c === null) return;
    const now = mg.ticks();
    const open = c.session();
    if (open !== null && now >= open.closeTick) {
      const results = c.closeSession();
      if (open.kind === "regular") {
        c.dropTallyResolutions();
        for (const r of results) onRegularResult(mg, c, r);
      } else {
        for (const r of results) onEmergencyVote(mg, c, r);
      }
    }
    const next = c.nextSessionTick();
    if (
      c.session() === null &&
      mg.getWinner() === null &&
      next !== null &&
      now >= next
    ) {
      openRegularSession(mg, c, this.random);
      c.scheduleNextSession(next + SESSION_INTERVAL_TICKS);
    }
    if (now % 10 === 0) {
      c.expireResolutions(now);
      c.prunePairs(now);
      accrueInfluence(mg, c);
      processEmergencySecond(mg, c);
      refreshCongressEffects(mg, c);
      c.refreshRanking(now);
    }
    const data = c.takeUnsentData();
    if (data !== null) mg.addUpdate({ type: GameUpdateType.Congress, data });
  }

  isActive(): boolean {
    return true;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return CongressExecutionSnapshot.write({
      initialized: this.mg !== undefined,
      random: w.random(this.random),
    });
  }

  restoreSnapshot(s: CongressExecState, r: SnapshotReader): void {
    this.mg = s.initialized ? r.game : undefined;
    this.random = r.random(s.random);
  }
}

const CongressExecStateSchema = z.object({
  initialized: z.boolean(),
  random: zRandom(),
});
type CongressExecState = z.infer<typeof CongressExecStateSchema>;

export const CongressExecutionSnapshot = execSnapshotType({
  name: "Congress",
  version: 1,
  schema: CongressExecStateSchema,
  cls: () => CongressExecution,
});
```

`packages/engine/src/congress/CongressVoteExecution.ts`:

```ts
import {
  BALLOT_OPTIONS,
  BallotOption,
} from "@openfront/engine-api/congress/CongressTypes";
import { zInt, zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/** congress_vote (spec §6.3): a ballot or a raise; Congress.castBallot checks it. */
export class CongressVoteExecution implements Execution {
  constructor(
    private player: Player,
    private sessionId: number,
    private item: number,
    private option: BallotOption,
    private extra: number,
  ) {}

  init(mg: Game, _ticks: number): void {
    mg.congress()?.castBallot(
      this.player,
      this.sessionId,
      this.item,
      this.option,
      this.extra,
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
    return CongressVoteExecutionSnapshot.write({
      player: w.player(this.player),
      sessionId: this.sessionId,
      item: this.item,
      option: this.option,
      extra: this.extra,
    });
  }

  restoreSnapshot(s: CongressVoteState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.sessionId = s.sessionId;
    this.item = s.item;
    this.option = s.option;
    this.extra = s.extra;
  }
}

const CongressVoteStateSchema = z.object({
  player: zPlayerRef(),
  sessionId: zInt(),
  item: zInt(),
  option: z.enum(BALLOT_OPTIONS),
  extra: zInt(),
});
type CongressVoteState = z.infer<typeof CongressVoteStateSchema>;

export const CongressVoteExecutionSnapshot = execSnapshotType({
  name: "CongressVote",
  version: 1,
  schema: CongressVoteStateSchema,
  cls: () => CongressVoteExecution,
});
```

`packages/engine/src/congress/ConveneEmergencyExecution.ts`:

```ts
import {
  EMERGENCY_KINDS,
  EmergencyKind,
} from "@openfront/engine-api/congress/CongressTypes";
import { PlayerID } from "@openfront/engine-api/game/GameTypes";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { conveneEmergency } from "./Emergencies";

/** convene_emergency (spec §9.2): Emergencies.conveneEmergency checks and opens the vote. */
export class ConveneEmergencyExecution implements Execution {
  constructor(
    private player: Player,
    private kind: EmergencyKind,
    private targetID: PlayerID,
  ) {}

  init(mg: Game, _ticks: number): void {
    if (!mg.hasPlayer(this.targetID)) return;
    conveneEmergency(mg, this.player, this.kind, mg.player(this.targetID));
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return ConveneEmergencyExecutionSnapshot.write({
      player: w.player(this.player),
      kind: this.kind,
      targetID: this.targetID,
    });
  }

  restoreSnapshot(s: ConveneEmergencyState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.kind = s.kind;
    this.targetID = s.targetID;
  }
}

const ConveneEmergencyStateSchema = z.object({
  player: zPlayerRef(),
  kind: z.enum(EMERGENCY_KINDS),
  targetID: z.string(),
});
type ConveneEmergencyState = z.infer<typeof ConveneEmergencyStateSchema>;

export const ConveneEmergencyExecutionSnapshot = execSnapshotType({
  name: "ConveneEmergency",
  version: 1,
  schema: ConveneEmergencyStateSchema,
  cls: () => ConveneEmergencyExecution,
});
```

`packages/engine/src/execution/ExecutionManager.ts`:
- import 추가: `import { CongressVoteExecution } from "../congress/CongressVoteExecution";`, `import { ConveneEmergencyExecution } from "../congress/ConveneEmergencyExecution";`
- `switch`의 `case "intercept_satellite": …` 블록 뒤(`default:` 앞)에:

```ts
      case "congress_vote":
        return new CongressVoteExecution(
          player,
          intent.session,
          intent.item,
          intent.option,
          intent.extra,
        );
      case "convene_emergency":
        return new ConveneEmergencyExecution(player, intent.kind, intent.target);
```

`packages/engine/src/snapshot/ExecutionRegistry.ts`:
- import 추가(알파벳 순 자리): `import { CongressExecutionSnapshot } from "../congress/CongressExecution";`, `import { CongressVoteExecutionSnapshot } from "../congress/CongressVoteExecution";`, `import { ConveneEmergencyExecutionSnapshot } from "../congress/ConveneEmergencyExecution";`
- 목록의 `CoastalBatteryExecutionSnapshot,` 뒤에 `CongressExecutionSnapshot,`, `CongressVoteExecutionSnapshot,`, `ConveneEmergencyExecutionSnapshot,`(이 순서로, `ConventionalMissileExecutionSnapshot` 앞).

`packages/engine/src/GameRunner.ts`:
- import 추가: `import { CongressExecution } from "./congress/CongressExecution";`
- `init()`의 전략 무기 블록(`this.game.addExecution(new StrategicExecution());`가 든 `if`) 뒤, `WinCheckExecution` 앞에:

```ts
    // World congress only: after the domestic second, before the win check,
    // on its own PRNG (plan decision 10).
    if (this.game.config().congress()) {
      this.game.addExecution(
        new CongressExecution(simpleHash(this.execManager.gameID()) + 7919),
      );
    }
```

- [ ] **Step 10: engine — 내정 상태, 게임·플레이어 연결**

`packages/engine/src/domestic/PlayerDomestic.ts`:
- import에 `Modifier`, `STAT_KEYS`를 `DomesticTypes`에서, `zNum`을 `SnapshotType`에서 더한다.
- `DomesticStateSchema`의 `donationGoldReceived: z.bigint().optional(),` 뒤에:

```ts
  // World congress: the modifiers resolutions give this player; absent when none.
  congressModifiers: z
    .array(
      z.object({
        stat: z.enum(STAT_KEYS),
        pct: zNum(),
        when: z.enum(CONDITIONS).optional(),
      }),
    )
    .optional(),
```

- 필드 `private donationGold: Gold = 0n;` 뒤에 `/** World congress: modifiers from the resolutions in force. */ private congressMods: Modifier[] = [];`
- 메서드 추가(`donationGoldReceived()` 앞):

```ts
  /** Last processed second's output (milli-points), for "N seconds of output" rewards. */
  scienceMilliPerSecond(): number {
    return this.lastScienceMilli;
  }

  politicalMilliPerSecond(): number {
    return this.lastPoliticalMilli;
  }

  /** Lump sums (congress rewards): stored and cumulative, not this second's rate. */
  grantPoints(scienceMilli: number, politicalMilli: number): void {
    if (scienceMilli <= 0 && politicalMilli <= 0) return;
    const s = Math.max(0, Math.round(scienceMilli));
    const p = Math.max(0, Math.round(politicalMilli));
    this.scienceMilli += s;
    this.politicalMilli += p;
    this.cumScienceMilli += s;
    this.cumPoliticalMilli += p;
    this.changed();
  }

  /** World government (spec §10.1): moves the running project by `deltaTicks` (negative: closer to done), within 0..total. */
  shiftVictoryProject(deltaTicks: number): void {
    const p = this.project;
    if (p === null) return;
    const ticksLeft = Math.min(
      p.totalTicks,
      Math.max(0, p.ticksLeft + deltaTicks),
    );
    if (ticksLeft === p.ticksLeft) return;
    this.project = { ...p, ticksLeft };
    this.changed();
  }

  congressModifiers(): readonly Modifier[] {
    return this.congressMods;
  }

  /** The congress's modifiers for this player (plan decision 6); the same list again changes nothing. */
  setCongressModifiers(mods: readonly Modifier[]): void {
    if (JSON.stringify(mods) === JSON.stringify(this.congressMods)) return;
    this.congressMods = mods.map((m) => ({ ...m }));
    this.rebuild();
    this.changed();
  }
```

- `toData()`의 `donationGoldReceived: Number(this.donationGold),` 뒤에:

```ts
      ...(this.congressMods.length === 0
        ? {}
        : { congressModifiers: this.congressMods.map((m) => ({ ...m })) }),
```

- `snapshot()`의 `donationGoldReceived` 줄 뒤에 같은 모양으로 `congressModifiers`를 더한다.
- `restore()`의 `d.donationGold = …;` 뒤에 `d.congressMods = (s.congressModifiers ?? []).map((m) => ({ ...m }));` (그 뒤의 `d.rebuild()`가 반영한다)
- `rebuild()`를 `this.totals = domesticModifiers(this.techs, this.laws, this.government, this.congressMods);`로.

`packages/engine/src/game/Game.ts`:
- import 추가: `import type { Congress } from "../congress/Congress";`, `import type { PlayerCongress } from "../congress/PlayerCongress";`
- `Player`의 `missileTarget(tile: TileRef): Unit | null;` 뒤에:

```ts
  /** World congress state; null when the option is off and for bots. */
  congress(): PlayerCongress | null;
  /** World congress: a truce (or emergency peace) forbids any hostility with `other` now. */
  isTruceWith(other: Player): boolean;
  /** World congress: a resolution forbids buying, building, upgrading or producing `type` now. */
  isCongressBanned(type: UnitType): boolean;
```

- `Game`의 `nations(): Nation[];` 앞에:

```ts
  /** World congress; null when the option is off. */
  congress(): Congress | null;
```

`packages/engine/src/game/GameImpl.ts`:
- import 추가: `import { Congress, CongressStateSchema } from "../congress/Congress";`, `import { congressElimination, emergencyConquer } from "../congress/Emergencies";`, `import { ledgerConquer } from "../congress/Ledger";`
- 필드 `private _nukeImpactQueue: TileRef[] = [];` 뒤에 `/** World congress; null when the option is off. */ private _congress: Congress | null;`
- 생성자에서 `this._sharedWaterCache = new SharedWaterCache(this);` 뒤에 `this._congress = _config.congress() ? new Congress(this) : null;`
- 메서드 추가(`nationMirvTargets()` 뒤): `congress(): Congress | null { return this._congress; }`
- `conquer(owner, tile)`의 마지막 줄 `this.recordTileUpdate(tile);` 뒤에:

```ts
    // World congress: emergency members first, then the aggression ledger
    // (spec §4.1, §9.4).
    if (this._congress !== null && previousOwner.isPlayer()) {
      emergencyConquer(this, this._congress, previousOwner, owner);
      ledgerConquer(this, this._congress, previousOwner, owner);
    }
```

- `conquerPlayer`의 마지막 `this.addUpdate({ type: GameUpdateType.ConquestEvent, … });` 뒤에:

```ts
    if (this._congress !== null) {
      congressElimination(this, this._congress, conqueror, conquered);
    }
```

- `private hash()`의 `return hash;` 앞에 `if (this._congress !== null) hash += this._congress.hash();`
- `snapshotState`의 반환 객체 끝(`stats: …,` 뒤)에 `...(this._congress === null ? {} : { congress: this._congress.snapshot(w) }),`
- `restoreState`의 끝(`StatsImpl` 복원 뒤)에:

```ts
    if (this._congress !== null && s.congress !== undefined) {
      this._congress.restoreState(s.congress, r);
    }
```

- `GameSnapshot` 스키마의 `stats: VersionedSchema,` 뒤에 `congress: CongressStateSchema.optional(),`

`packages/engine/src/game/PlayerImpl.ts`:
- import 추가: `import { isTruce } from "../congress/Conflict";`, `import { congressBans, donationBlocked, tradeBlocked } from "../congress/Effects";`, `import { PlayerCongress, PlayerCongressStateSchema } from "../congress/PlayerCongress";`
- 필드 `private _strategic: PlayerStrategic | null = null;` 뒤에 `/** World congress state; null with the option off and for bots. */ private _congress: PlayerCongress | null = null;`
- 생성자의 `this._strategic = …;` 뒤에:

```ts
    this._congress =
      mg.config().congress() && playerInfo.playerType !== PlayerType.Bot
        ? new PlayerCongress()
        : null;
```

- `toFullUpdate()` 반환 객체의 `strategic` 줄 뒤에 `...(this._congress === null ? {} : { congress: this._congress.toData() }),`
- `strategic()` 메서드 뒤에:

```ts
  congress(): PlayerCongress | null {
    return this._congress;
  }

  isTruceWith(other: Player): boolean {
    const c = this.mg.congress();
    return c !== null && other !== this && isTruce(c, this, other);
  }

  isCongressBanned(type: UnitType): boolean {
    const c = this.mg.congress();
    return c !== null && congressBans(c, this, type);
  }
```

- `recordUnitConstructed(type)`의 맨 끝에 `this.mg.congress()?.noteBuilt(type);`
- `canDonateGold`와 `canDonateTroops`의 첫 `if (recipient === this) { return false; }` 바로 뒤에 각각:

```ts
    // World congress: a sanctioned player receives nothing (spec §8.1 S1).
    const congress = this.mg.congress();
    if (congress !== null && donationBlocked(congress, recipient)) {
      return false;
    }
```

- `canTrade`의 `if (embargo || other.id() === this.id()) return false;` 뒤에:

```ts
    // World congress: sanctions stop all trade of the sanctioned side.
    const congress = this.mg.congress();
    if (congress !== null && tradeBlocked(congress, this, other)) return false;
```

- `canAttackPlayer`의 첫 줄에 `if (this.isTruceWith(player)) return false;`
- `nukeSpawn`의 `if (owner.isPlayer()) { if (this.isOnSameTeam(owner) && !gameOver) { return false; } }` 블록 안 `isOnSameTeam` 검사 뒤에 `if (this.isTruceWith(owner)) return false;`
- `isStrikeTarget`의 조건을 `if (owner.isPlayer() && (owner === this || this.isFriendly(owner, true) || this.isTruceWith(owner))) {`로.
- `missileTarget`의 filter를 `unit.owner() !== this && !this.isFriendly(unit.owner(), true) && !this.isTruceWith(unit.owner())`로.
- `canBuildUnitType`의 전략 무기 비축 `if` 블록 뒤에:

```ts
    // World congress: a resolution forbids it (stock launches above never are).
    if (this.isCongressBanned(unitType)) {
      return false;
    }
```

- `buildableUnits`의 결과 객체 `locked: this.isUnitLocked(u),` 뒤에:

```ts
        ...(mg.congress() === null
          ? {}
          : {
              banned:
                this.isCongressBanned(u) &&
                !(this._strategic !== null && isStockpiledNuke(u)),
            }),
```

- `hash()`의 `if (this._strategic !== null) { … }` 블록 뒤에:

```ts
    if (this._congress !== null) {
      digest =
        (Math.imul(digest, 31) + forkDigest(this._congress.snapshot())) | 0;
    }
```

- `snapshot()`의 `strategic` 줄 뒤에 `...(this._congress === null ? {} : { congress: this._congress.snapshot() }),`
- `restoreSnapshot()`의 `this._strategic = …;` 뒤에 `this._congress = s.congress ? PlayerCongress.restore(s.congress) : null;`
- `PlayerSnapshot` 스키마의 `strategic: StrategicStateSchema.nullable().optional(),` 뒤에 `congress: PlayerCongressStateSchema.nullable().optional(),`

`packages/engine/src/game/GameUpdateUtils.ts`:
- 빠른 경로의 `prev.strategic === next.strategic &&` 뒤에 `prev.congress === next.congress &&`
- `setIfDifferent("strategic", …);` 뒤에 `// PlayerCongress caches its data the same way.\n  setIfDifferent("congress", prev.congress === next.congress);`

`packages/engine/src/execution/NukeExecution.ts`:
- import 추가: `import { NukeWeapon } from "@openfront/engine-lib/congress/CongressBalance";`, `import { congressNukeHit } from "../congress/Emergencies";`
- `detonate()`의 첫 `for (const tile of toDestroy) { … }` 반복문 바로 뒤에:

```ts
    // World congress (spec §4.2, §9.1): the shooter's nuke score and the
    // victims' losses.
    const congress = mg.congress();
    if (congress !== null) {
      congressNukeHit(
        mg,
        congress,
        this.player,
        tilesPerPlayers,
        this.nuke.type() as NukeWeapon,
      );
    }
```

- [ ] **Step 11: 서버와 클라이언트 연결**

`src/server/ConfigPatch.ts`의 `COPIED_KEYS`에서 `"strategicWeapons",` 뒤에 `"congress",`

`src/client/view/DomesticClientView.ts`의 totals 줄을:

```ts
    // Same totals as the engine's PlayerDomestic (Decision 22), congress
    // resolutions included.
    this.totals = domesticModifiers(
      data.techs,
      this.lawMap,
      data.government,
      data.congressModifiers ?? [],
    );
```

`src/client/view/PlayerView.ts`:
- import 추가: `import type { PlayerCongressData } from "@openfront/engine-api/congress/CongressTypes";`
- 필드 `private _strategic: StrategicData | null = null;` 뒤에 `private _congress: PlayerCongressData | null = null;`
- 생성자의 `this._strategic = data.strategic ?? null;` 뒤에 `this._congress = data.congress ?? null;`
- `applyUpdate`의 `strategic` 블록 뒤에 `if (pu.congress !== undefined) { this._congress = pu.congress; }`
- `strategicData()` 뒤에:

```ts
  /** World congress: this player's last congress state; null with the option off. The UI only shows its own player's. */
  congressData(): PlayerCongressData | null {
    return this._congress;
  }
```

`src/client/view/GameView.ts`:
- import 추가: `import type { CongressData } from "@openfront/engine-api/congress/CongressTypes";`
- 필드(`private _myPlayer …` 근처)에 `private _congressData: CongressData | null = null;`
- `update(gu)`에서 `if (gu.updates[GameUpdateType.Win].length > 0) { … }` 뒤에:

```ts
    const congress = gu.updates[GameUpdateType.Congress];
    if (congress.length > 0) {
      this._congressData = congress[congress.length - 1].data;
    }
```

- 공개 메서드 추가(`updatesSinceLastTick()` 뒤):

```ts
  /** World congress: the last congress the worker sent; null with the option off. */
  public congressData(): CongressData | null {
    return this._congressData;
  }
```

`src/client/Transport.ts`:
- import 추가: `import type { BallotOption, EmergencyKind } from "@openfront/engine-api/congress/CongressTypes";`
- `SendInterceptSatelliteIntentEvent` 클래스 뒤에:

```ts
/** World congress: a ballot or a raise on one agenda item of the open session. */
export class SendCongressVoteIntentEvent implements GameEvent {
  constructor(
    public readonly session: number,
    public readonly item: number,
    public readonly option: BallotOption,
    public readonly extra: number,
  ) {}
}

/** World congress: convene an emergency session against `target`. */
export class SendConveneEmergencyIntentEvent implements GameEvent {
  constructor(
    public readonly kind: EmergencyKind,
    public readonly target: PlayerID,
  ) {}
}
```

- `SendInterceptSatelliteIntentEvent` 구독 뒤에:

```ts
    this.subscribe(SendCongressVoteIntentEvent, (e) =>
      this.sendIntent({
        type: "congress_vote",
        session: e.session,
        item: e.item,
        option: e.option,
        extra: e.extra,
      }),
    );
    this.subscribe(SendConveneEmergencyIntentEvent, (e) =>
      this.sendIntent({
        type: "convene_emergency",
        kind: e.kind,
        target: e.target,
      }),
    );
```

`src/client/Utils.ts`의 `getMessageTypeClasses`에서 `case MessageType.VICTORY_PROJECT:` 바로 아래에 `case MessageType.CONGRESS:`를 더한다(같은 warn 색).

- [ ] **Step 12: 기존 테스트 보강**

`tests/util/Snapshot.ts`의 `DERIVED_FIELDS`에서 `"strategicDataCache",` 뒤에:

```ts
  // Congress / PlayerCongress
  "congressDataCache",
  "lastSentCongressData",
  "congressPlayerDataCache",
```

`tests/zbin/wire.test.ts`의 `SAMPLE_INTENTS` 끝(`intercept_satellite` 항목 뒤)에:

```ts
  {
    type: "congress_vote",
    clientID: P1,
    session: 3,
    item: 2,
    option: "B",
    extra: 5,
  },
  { type: "convene_emergency", clientID: P2, kind: "nuclear", target: P1 },
```

`tests/server/ConfigPatch.test.ts`의 `EDITABLE`에서 `strategicWeapons: true,` 뒤에 `congress: true,`

`tests/core/snapshot/FullGameSnapshot.test.ts`: 새 Execution 3개가 레지스트리에 들어가므로 "free for all" 변형의 "every execution type" 검사에서 뺀다. `STRATEGIC_UNSCRIPTED_TYPES` 정의 뒤에:

```ts
// Execution types that only a world-congress game creates. The "congress"
// variant (Task 14) plays them.
const CONGRESS_ONLY_TYPES = ["Congress", "CongressVote", "ConveneEmergency"];
```

그리고 FFA 분기의 filter에 `&& !CONGRESS_ONLY_TYPES.includes(name)`을 더한다(`!STRATEGIC_ONLY_TYPES.includes(name)` 뒤).

- [ ] **Step 13: 통과 확인**

Run: `npx vitest tests/congress tests/VanillaDigest.test.ts tests/zbin tests/server/ConfigPatch.test.ts tests/LayerBoundaries.test.ts tests/MessageTypeClasses.test.ts tests/GameUpdateUtils.test.ts tests/PlayerUpdateDiff.test.ts tests/core/snapshot/CoreSnapshot.test.ts tests/domestic tests/strategic --run`
Expected: 모두 PASS

Run: `npx vitest tests/core/snapshot/FullGameSnapshot.test.ts -t "free for all" --run && npm run typecheck && npm run lint`
Expected: PASS, 오류 없음

- [ ] **Step 14: 커밋**

```bash
npx prettier --write packages/engine-api/src/congress packages/engine-api/src/Schemas.ts packages/engine-api/src/game/GameUpdates.ts packages/engine-api/src/game/GameTypes.ts packages/engine-api/src/domestic/DomesticTypes.ts packages/engine-lib/src/congress packages/engine-lib/src/configuration/Config.ts packages/engine-lib/src/domestic/Policies.ts packages/engine/src/congress packages/engine/src/domestic/PlayerDomestic.ts packages/engine/src/game/Game.ts packages/engine/src/game/GameImpl.ts packages/engine/src/game/PlayerImpl.ts packages/engine/src/game/GameUpdateUtils.ts packages/engine/src/execution/NukeExecution.ts packages/engine/src/execution/ExecutionManager.ts packages/engine/src/snapshot/ExecutionRegistry.ts packages/engine/src/GameRunner.ts src/server/ConfigPatch.ts src/client/view/PlayerView.ts src/client/view/GameView.ts src/client/view/DomesticClientView.ts src/client/Transport.ts src/client/Utils.ts tests/congress tests/VanillaDigest.test.ts tests/zbin/wire.test.ts tests/server/ConfigPatch.test.ts tests/util/Snapshot.ts tests/core/snapshot/FullGameSnapshot.test.ts
git add packages/engine-api/src/congress packages/engine-api/src/Schemas.ts packages/engine-api/src/game/GameUpdates.ts packages/engine-api/src/game/GameTypes.ts packages/engine-api/src/domestic/DomesticTypes.ts packages/engine-lib/src/congress packages/engine-lib/src/configuration/Config.ts packages/engine-lib/src/domestic/Policies.ts packages/engine/src/congress packages/engine/src/domestic/PlayerDomestic.ts packages/engine/src/game/Game.ts packages/engine/src/game/GameImpl.ts packages/engine/src/game/PlayerImpl.ts packages/engine/src/game/GameUpdateUtils.ts packages/engine/src/execution/NukeExecution.ts packages/engine/src/execution/ExecutionManager.ts packages/engine/src/snapshot/ExecutionRegistry.ts packages/engine/src/GameRunner.ts src/server/ConfigPatch.ts src/client/view/PlayerView.ts src/client/view/GameView.ts src/client/view/DomesticClientView.ts src/client/Transport.ts src/client/Utils.ts tests/congress tests/VanillaDigest.test.ts tests/zbin/wire.test.ts tests/server/ConfigPatch.test.ts tests/util/Snapshot.ts tests/core/snapshot/FullGameSnapshot.test.ts
git commit -m "feat(congress): option, shared types, intents, state, clock, stubs and hooks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 2: 침략 장부와 영향력

**Files:**
- Modify (스텁 채우기): `packages/engine/src/congress/Ledger.ts`, `packages/engine/src/congress/Influence.ts`
- Test: `tests/congress/Ledger.test.ts`, `tests/congress/Influence.test.ts`

**Interfaces:**
- Consumes: Task 1 `Congress.touchPair/pair/isEmergencyTarget/isEmergencyMember/active/isSanctioned`, `PlayerCongress.recordTaken/recordLost/recordHitBy/accrue`, `isLedgerPlayer`, `aggressionPct`, `victimPct`, `CONFLICT_MEMORY_TICKS`, 영향력 상수들, `PlayerDomestic.politicalMilliPerSecond()`, 테스트 유틸
- Produces: `ledgerConquer`, `isAggressing`, `aggressionExempt`(Task 1 시그니처 그대로, 실제 동작), `accrueInfluence(mg, c)`, 그리고 새로 `influenceStatus(mg, c, player): InfluenceStatus`, `influenceRateMilli(c, player): number`, `governmentInfluencePct(c, player): number`(Task 12 서랍이 같은 규칙을 화면에 쓰지 않으므로 엔진 전용)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/congress/Ledger.test.ts`:

```ts
import { Game, Player } from "@openfront/engine/game/Game";
import {
  aggressionExempt,
  isAggressing,
} from "@openfront/engine/congress/Ledger";
import {
  aggressionPct,
  pairPct,
  victimPct,
} from "@openfront/engine/congress/Metrics";
import {
  BLUE,
  botInfo,
  congressGame,
  congressOf,
  enact,
  GREEN,
  own,
  RED,
  runTicks,
} from "./util";

// plains: 10,000 land tiles. red holds x 0-29, blue x 30-59 (they border),
// green x 60-89, a bot x 90-99.
async function sides(): Promise<{
  game: Game;
  red: Player;
  blue: Player;
  green: Player;
  bot: Player;
}> {
  const game = await congressGame({}, [RED, BLUE, GREEN, botInfo("bot")]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  const green = own(game, GREEN.id, 60, 0, 30, 100);
  const bot = own(game, "bot_id", 90, 0, 10, 100);
  game.executeNextTick();
  return { game, red, blue, green, bot };
}

/** `taker` takes column x, rows 0..n-1. */
function take(game: Game, taker: Player, x: number, n: number): void {
  for (let y = 0; y < n; y++) taker.conquer(game.ref(x, y));
}

describe("the aggression ledger", () => {
  test("taking a nation's land is aggression for whoever strikes first", async () => {
    const { game, red, blue } = await sides();
    take(game, red, 30, 50);
    const now = game.ticks();
    expect(red.congress()!.takenTiles(now)).toBe(50);
    expect(aggressionPct(game, red)).toBeCloseTo(0.5);
    expect(blue.congress()!.lostTiles(now)).toBe(50);
    expect(victimPct(game, blue)).toBeCloseTo((50 * 100) / 3000);
    expect(blue.congress()!.lastHitTick(red.smallID())).toBe(now);
    const pair = congressOf(game).pair(red.smallID(), blue.smallID())!;
    expect(pair.initiator).toBe(red.smallID());
    expect(pairPct(game, pair)).toBeCloseTo(0.5);
  });

  test("the victim's counter-attack is self-defense; the aggressor stays the aggressor", async () => {
    const { game, red, blue } = await sides();
    take(game, red, 30, 50);
    take(game, blue, 29, 30);
    const now = game.ticks();
    expect(blue.congress()!.takenTiles(now)).toBe(0);
    expect(red.congress()!.lostTiles(now)).toBe(30);
    take(game, red, 31, 10);
    expect(red.congress()!.takenTiles(now)).toBe(60);
  });

  test("bots, unclaimed land and disconnected humans are not in the ledger", async () => {
    const { game, red, blue, green, bot } = await sides();
    take(game, green, 90, 20);
    expect(green.congress()!.takenTiles(game.ticks())).toBe(0);
    expect(
      congressOf(game).pair(green.smallID(), bot.smallID()),
    ).toBeUndefined();
    blue.markDisconnected(true);
    take(game, red, 30, 20);
    expect(red.congress()!.takenTiles(game.ticks())).toBe(0);
    expect(congressOf(game).pair(red.smallID(), blue.smallID())).toBeUndefined();
  });

  test("the window forgets after 180 s, and after 180 s of quiet the next strike starts a new conflict", async () => {
    const { game, red, blue } = await sides();
    take(game, red, 30, 10);
    runTicks(game, 1810);
    expect(aggressionPct(game, red)).toBe(0);
    take(game, blue, 29, 5);
    expect(
      congressOf(game).pair(red.smallID(), blue.smallID())!.initiator,
    ).toBe(blue.smallID());
    expect(blue.congress()!.takenTiles(game.ticks())).toBe(5);
  });

  test("an emergency member taking the target's land, and anyone taking a condemned owner's, is not aggression", async () => {
    const { game, red, blue, green } = await sides();
    const c = congressOf(game);
    c.setEmergency({
      kind: "aggression",
      target: blue.smallID(),
      startTick: game.ticks(),
      endTick: game.ticks() + 1500,
      goalKind: "land",
      goal: 450,
      progress: 0,
      members: [red.smallID()],
      opposed: [],
      contributions: new Map(),
      goalSilos: [],
      countedSilos: [],
    });
    expect(aggressionExempt(game, c, red, blue)).toBe(true);
    take(game, red, 30, 10);
    expect(red.congress()!.takenTiles(game.ticks())).toBe(0);
    expect(blue.congress()!.lostTiles(game.ticks())).toBe(10);
    c.setEmergency(null);
    enact(game, {
      resolution: "world_heritage",
      option: "B",
      targets: [green.smallID()],
      param: "1",
    });
    expect(aggressionExempt(game, c, blue, green)).toBe(true);
    take(game, blue, 60, 10);
    expect(blue.congress()!.takenTiles(game.ticks())).toBe(0);
  });

  test("attacking a nation first is aggressing; answering its first strike, hitting a bot or retreating isn't", async () => {
    const { game, red, blue, green, bot } = await sides();
    expect(isAggressing(game, red)).toBe(false);
    const attack = red.createAttack(blue, 100, null, new Set());
    expect(isAggressing(game, red)).toBe(true);
    attack.orderRetreat();
    expect(isAggressing(game, red)).toBe(false);
    green.createAttack(bot, 100, null, new Set());
    expect(isAggressing(game, green)).toBe(false);
    // Blue strikes first; red's attack on blue is then defense.
    take(game, blue, 29, 5);
    red.createAttack(blue, 100, null, new Set());
    expect(isAggressing(game, red)).toBe(false);
    blue.createAttack(red, 100, null, new Set());
    expect(isAggressing(game, blue)).toBe(true);
  });
});
```

`tests/congress/Influence.test.ts`:

```ts
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { accrueInfluence } from "@openfront/engine/congress/Influence";
import { Game, Player } from "@openfront/engine/game/Game";
import { grantGovernment } from "../domestic/util";
import {
  BLUE,
  congressGame,
  congressOf,
  enact,
  giveInfluence,
  GREEN,
  own,
  RED,
  runTicks,
} from "./util";

async function three(): Promise<{
  game: Game;
  red: Player;
  blue: Player;
  green: Player;
}> {
  const game = await congressGame({}, [RED, BLUE, GREEN]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  const green = own(game, GREEN.id, 60, 0, 30, 100);
  game.executeNextTick();
  return { game, red, blue, green };
}

describe("influence", () => {
  test("a peaceful nation earns 0.1 + 5% of its political output + 0.05 per ally a second", async () => {
    const { game, red, blue } = await three();
    red.domestic()!.addYield(0, 2000); // 2 political power last second
    red.createAllianceRequest(blue)?.accept();
    accrueInfluence(game, congressOf(game));
    expect(red.congress()!.influenceMilli()).toBe(100 + 100 + 50);
    expect(red.congress()!.toData()).toMatchObject({
      influencePerSec: 0.25,
      status: "peaceful",
    });
  });

  test("each government tier adds 0.05", async () => {
    const { game, red } = await three();
    const d = red.domestic()!;
    d.addYield(0, 800_000);
    d.refreshGovernmentTier();
    d.addYield(0, 0); // last second's output back to 0
    expect(d.governmentTier()).toBe(1);
    accrueInfluence(game, congressOf(game));
    expect(red.congress()!.influenceMilli()).toBe(150);
  });

  test("sanctioned nations, the emergency target and aggressors earn nothing", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    enact(game, { resolution: "sanction", targets: [red.smallID()] });
    c.setEmergency({
      kind: "aggression",
      target: blue.smallID(),
      startTick: game.ticks(),
      endTick: game.ticks() + 1500,
      goalKind: "land",
      goal: 450,
      progress: 0,
      members: [],
      opposed: [],
      contributions: new Map(),
      goalSilos: [],
      countedSilos: [],
    });
    green.createAttack(blue, 100, null, new Set());
    accrueInfluence(game, c);
    expect(red.congress()!.toData()).toMatchObject({
      influence: 0,
      status: "sanctioned",
    });
    expect(blue.congress()!.status()).toBe("target");
    expect(green.congress()!.status()).toBe("aggressing");
    expect(green.congress()!.influenceMilli()).toBe(0);
  });

  test("accrual stops at 300; refunds and rewards may pass it", async () => {
    const { game, red } = await three();
    const c = congressOf(game);
    red.congress()!.grant(299_950);
    accrueInfluence(game, c);
    expect(red.congress()!.influenceMilli()).toBe(300_000);
    expect(red.congress()!.status()).toBe("peaceful");
    accrueInfluence(game, c);
    expect(red.congress()!.influenceMilli()).toBe(300_000);
    expect(red.congress()!.status()).toBe("capped");
    giveInfluence(red, 10);
    expect(red.congress()!.influenceMilli()).toBe(310_000);
  });

  test("government resolutions: support ×1.25, condemnation ×0", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    grantGovernment(red, "monarchy");
    grantGovernment(blue, "republic");
    enact(game, { resolution: "government_resolution", param: "monarchy" });
    accrueInfluence(game, c);
    expect(red.congress()!.influenceMilli()).toBe(125);
    expect(blue.congress()!.influenceMilli()).toBe(100);
    enact(game, {
      resolution: "government_resolution",
      option: "B",
      param: "republic",
    });
    accrueInfluence(game, c);
    expect(blue.congress()!.influenceMilli()).toBe(100);
  });

  test("the clock pays once a second, with 5% of the political output", async () => {
    const { game, red } = await three();
    game.addExecution(new DomesticExecution());
    runTicks(game, 21);
    // Two congress seconds; the second one sees a domestic second's output.
    expect(red.congress()!.influenceMilli()).toBeGreaterThanOrEqual(2 * 100);
    expect(red.congress()!.toData().influencePerSec).toBeGreaterThan(0.1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/congress/Ledger.test.ts tests/congress/Influence.test.ts --run`
Expected: FAIL — 스텁이라 `takenTiles`가 0, `influenceMilli`가 0이다.

- [ ] **Step 3: 장부 구현**

`packages/engine/src/congress/Ledger.ts` 전체를 다음으로 바꾼다:

```ts
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { CONFLICT_MEMORY_TICKS } from "@openfront/engine-lib/congress/CongressBalance";
import type { Game, Player } from "../game/Game";
import type { Congress } from "./Congress";
import { isLedgerPlayer } from "./Metrics";

function isHumanOrNation(p: Player): boolean {
  return p.type() === PlayerType.Human || p.type() === PlayerType.Nation;
}

/**
 * Spec §4.1: `next` took one tile from `prev`. Between a connected human or
 * nation and another human or nation, the pair's conflict and the loser's
 * losses are recorded; the taker's aggression counts unless the loser
 * struck first in this conflict, or the capture is exempt.
 */
export function ledgerConquer(
  mg: Game,
  c: Congress,
  prev: Player,
  next: Player,
): void {
  if (!isLedgerPlayer(prev) || !isHumanOrNation(next)) return;
  const now = mg.ticks();
  const pair = c.touchPair(next.smallID(), prev.smallID(), now);
  const lost = prev.congress();
  if (lost !== null) {
    lost.recordLost(now, 1);
    lost.recordHitBy(next.smallID(), now);
  }
  if (pair.initiator !== next.smallID()) return;
  if (aggressionExempt(mg, c, next, prev)) return;
  next.congress()?.recordTaken(now, 1);
}

/**
 * Spec §4.2: an outgoing, non-retreating attack on a connected human or
 * nation that isn't defense (the target started this conflict) or exempt.
 * A boat at sea isn't an attack yet.
 */
export function isAggressing(mg: Game, player: Player): boolean {
  const c = mg.congress();
  if (c === null) return false;
  const now = mg.ticks();
  for (const attack of player.outgoingAttacks()) {
    if (attack.retreating()) continue;
    const target = attack.target();
    if (!target.isPlayer() || !isLedgerPlayer(target)) continue;
    const pair = c.pair(player.smallID(), target.smallID());
    const defending =
      pair !== undefined &&
      now - pair.lastTick <= CONFLICT_MEMORY_TICKS &&
      pair.initiator === target.smallID();
    if (defending || aggressionExempt(mg, c, player, target)) continue;
    return true;
  }
  return false;
}

/** Never aggression: an emergency member against the target (spec §9.4), anyone against a condemned project's owner (spec §10.2). */
export function aggressionExempt(
  _mg: Game,
  c: Congress,
  attacker: Player,
  defender: Player,
): boolean {
  if (
    c.isEmergencyTarget(defender.smallID()) &&
    c.isEmergencyMember(attacker.smallID())
  ) {
    return true;
  }
  return c
    .active()
    .some(
      (r) =>
        r.resolution === "world_heritage" &&
        r.option === "B" &&
        r.targets[0] === defender.smallID(),
    );
}
```

- [ ] **Step 4: 영향력 구현**

`packages/engine/src/congress/Influence.ts` 전체를 다음으로 바꾼다:

```ts
import { InfluenceStatus } from "@openfront/engine-api/congress/CongressTypes";
import {
  GOVERNMENT_CONDEMN_INFLUENCE_PCT,
  GOVERNMENT_SUPPORT_INFLUENCE_PCT,
  INFLUENCE_BASE_MILLI,
  INFLUENCE_MAX_ALLIES,
  INFLUENCE_PER_ALLY_MILLI,
  INFLUENCE_PER_TIER_MILLI,
  INFLUENCE_POLITICAL_SHARE_PCT,
} from "@openfront/engine-lib/congress/CongressBalance";
import type { Game, Player } from "../game/Game";
import type { Congress } from "./Congress";
import { isAggressing } from "./Ledger";

/** Once a second, after the domestic economy (spec §5.1): every alive player's accrual. */
export function accrueInfluence(mg: Game, c: Congress): void {
  for (const p of mg.players()) {
    const pc = p.congress();
    if (pc === null) continue;
    const status = influenceStatus(mg, c, p);
    pc.accrue(status === "peaceful" ? influenceRateMilli(c, p) : 0, status);
  }
}

/** Spec §5.1: sanctioned, emergency target, aggressing, or peaceful (PlayerCongress.accrue turns a full one into "capped"). */
export function influenceStatus(
  mg: Game,
  c: Congress,
  p: Player,
): InfluenceStatus {
  if (c.isSanctioned(p.smallID())) return "sanctioned";
  if (c.isEmergencyTarget(p.smallID())) return "target";
  if (isAggressing(mg, p)) return "aggressing";
  return "peaceful";
}

/** A peaceful second, in milli-points: 0.1 + 0.05 per tier + 5% of political output + 0.05 per ally (up to 3), times E5. */
export function influenceRateMilli(c: Congress, p: Player): number {
  const d = p.domestic();
  const tier = d?.governmentTier() ?? 0;
  const political = d?.politicalMilliPerSecond() ?? 0;
  const allies = Math.min(INFLUENCE_MAX_ALLIES, p.alliances().length);
  const base =
    INFLUENCE_BASE_MILLI +
    INFLUENCE_PER_TIER_MILLI * tier +
    Math.round((political * INFLUENCE_POLITICAL_SHARE_PCT) / 100) +
    INFLUENCE_PER_ALLY_MILLI * allies;
  return Math.round((base * governmentInfluencePct(c, p)) / 100);
}

/** E5 (spec §8.2): support ×1.25, condemnation ×0 for players of that government; 100 otherwise. */
export function governmentInfluencePct(c: Congress, p: Player): number {
  const government = p.domestic()?.currentGovernment();
  for (const r of c.active()) {
    if (r.resolution === "government_resolution" && r.param === government) {
      return r.option === "A"
        ? GOVERNMENT_SUPPORT_INFLUENCE_PCT
        : GOVERNMENT_CONDEMN_INFLUENCE_PCT;
    }
  }
  return 100;
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest tests/congress --run && npx vitest tests/VanillaDigest.test.ts --run && npm run typecheck`
Expected: 모두 PASS, typecheck 오류 없음

- [ ] **Step 6: 커밋**

```bash
npx prettier --write packages/engine/src/congress/Ledger.ts packages/engine/src/congress/Influence.ts tests/congress/Ledger.test.ts tests/congress/Influence.test.ts
git add packages/engine/src/congress/Ledger.ts packages/engine/src/congress/Influence.ts tests/congress/Ledger.test.ts tests/congress/Influence.test.ts
git commit -m "feat(congress): aggression ledger and influence accrual

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: 정기 회기 — 의석, 안건 고르기, 결과 적용

**Files:**
- Modify (스텁 채우기): `packages/engine/src/congress/Sessions.ts`
- Test: `tests/congress/Sessions.test.ts`

**Interfaces:**
- Consumes: Task 1 `Congress`(`setSeats`, `openSession`, `rememberAgenda`, `takeBuiltCounts`, `lastSecurityKind`, `lastEconomyKind`, `lastBuildingTarget`, `pairs`, `addResolution`), `aggressionPct`, `victimPct`, `pairPct`, `isLedgerPlayer`, 안건 상수, `MILITARY_LAWS`, `round1`, `TRUCE_TICKS`, `applyAdoption`(Task 5가 채우는 스텁), `domesticScores`, `domesticScoreInput`(`engine/domestic/DomesticWinCheck.ts`), `projectProgress`; Task 2 `ledgerConquer`(통합 테스트)
- Produces: `openRegularSession`, `onRegularResult`(Task 1 시그니처, 실제 동작), 그리고 `pickSeats(mg): number[]`, `securityCandidates(mg, c): SecurityCandidate[]`(`{ item: AgendaItemInit; repeatable: boolean }`), `pickSecurity(mg, c, random): AgendaItemInit`, `EconomyKind`, `availableEconomyKinds(mg, c, built): EconomyKind[]`, `economyItem(mg, c, kind, built, random): AgendaItemInit`, `projectItem(mg): AgendaItemInit | null`, `resolutionExpiry(resolution, option, now): ResolutionExpiry | null`
- 메시지(Task 9 키): `events_display.congress_adopted`, `congress_adopted_target`, `congress_adopted_pair`, `congress_tied`, `congress_tied_target`, `congress_tied_pair` — 매개변수 `resolution`(id), `option`("A"/"B", 채택일 때), `a`, `b`, `name`(첫 대상, `focusPlayerID`), `targetID`(둘째 대상 smallID)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/congress/Sessions.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { CongressVoteExecution } from "@openfront/engine/congress/CongressVoteExecution";
import {
  availableEconomyKinds,
  economyItem,
  pickSeats,
  pickSecurity,
  projectItem,
  securityCandidates,
} from "@openfront/engine/congress/Sessions";
import { Game, Player } from "@openfront/engine/game/Game";
import { grantGovernment, grantLaws, grantTechs } from "../domestic/util";
import {
  BLUE,
  botInfo,
  congressGame,
  congressOf,
  GREEN,
  item,
  nationInfo,
  own,
  RED,
  runTicks,
  seatAll,
} from "./util";

async function three(): Promise<{
  game: Game;
  red: Player;
  blue: Player;
  green: Player;
}> {
  const game = await congressGame({}, [RED, BLUE, GREEN]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  const green = own(game, GREEN.id, 60, 0, 30, 100);
  game.executeNextTick();
  return { game, red, blue, green };
}

describe("seats", () => {
  test("every alive human and the six nations with the highest score; no bots", async () => {
    const nations = [1, 2, 3, 4, 5, 6, 7].map((i) => nationInfo(`n${i}`));
    const game = await congressGame({}, [
      RED,
      BLUE,
      botInfo("bot"),
      ...nations,
    ]);
    let x = 0;
    const red = own(game, RED.id, x, 0, 5, 100);
    x += 5;
    const blue = own(game, BLUE.id, x, 0, 5, 100);
    x += 5;
    own(game, "bot_id", x, 0, 20, 100);
    x += 20;
    const ns = nations.map((info, i) => {
      const p = own(game, info.id, x, 0, i + 1, 100);
      x += i + 1;
      return p;
    });
    const expected = [red, blue, ...ns.slice(1)]
      .map((p) => p.smallID())
      .sort((a, b) => a - b);
    expect(pickSeats(game)).toEqual(expected);
  });
});

describe("the security card (spec §7.1)", () => {
  test("victim, then aggressor, then war pair, then runaway, in that order", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    const now = game.ticks();
    // red 3,000 tiles against 2,000 each: 1.5 times the runner-up.
    for (const t of Array.from(blue.tiles()).slice(0, 1000)) blue.relinquish(t);
    for (const t of Array.from(green.tiles()).slice(0, 1000)) {
      green.relinquish(t);
    }
    blue.congress()!.recordLost(now, 1500); // 1500 / (2000 + 1500) = 42.9%
    red.congress()!.recordTaken(now, 60); // 0.6% of the land
    for (let i = 0; i < 40; i++) c.touchPair(red.smallID(), green.smallID(), now);
    const kinds = securityCandidates(game, c).map((s) => s.item.resolution);
    expect(kinds).toEqual([
      "protectorate",
      "sanction",
      "truce",
      "hegemony_check",
    ]);
    expect(securityCandidates(game, c)[0].item).toEqual({
      resolution: "protectorate",
      targets: [blue.smallID()],
      param: null,
      reason: "victim",
      reasonValue: 42.9,
    });
    expect(pickSecurity(game, c, new PseudoRandom(1)).resolution).toBe(
      "protectorate",
    );
  });

  test("an armed aggressor gets an arms embargo instead of sanctions", async () => {
    const { game, red } = await three();
    red.congress()!.recordTaken(game.ticks(), 60);
    red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    const c = congressOf(game);
    expect(securityCandidates(game, c)[0].item).toMatchObject({
      resolution: "arms_embargo",
      targets: [red.smallID()],
      reason: "aggressor",
      reasonValue: 0.6,
    });
  });

  test("the last session's kind is skipped, unless the aggressor took 2% or more", async () => {
    const { game, red } = await three();
    const c = congressOf(game);
    red.congress()!.recordTaken(game.ticks(), 60);
    c.rememberAgenda("sanction", null, null);
    const next = pickSecurity(game, c, new PseudoRandom(1));
    expect(next.resolution).not.toBe("sanction");
    expect(next.reason).toBe("global");
    red.congress()!.recordTaken(game.ticks(), 200); // 2.6%
    expect(pickSecurity(game, c, new PseudoRandom(1)).resolution).toBe(
      "sanction",
    );
  });

  test("with nothing on the ledger, a rule for the whole world; non-proliferation once someone has the bomb", async () => {
    const { game, red } = await three();
    const c = congressOf(game);
    const pick = () => pickSecurity(game, c, new PseudoRandom(7)).resolution;
    expect(["war_tax", "arms_treaty"]).toContain(pick());
    grantTechs(red, "rocketry", "manhattan_project");
    const seen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      seen.add(pickSecurity(game, c, new PseudoRandom(seed)).resolution);
    }
    expect([...seen].sort()).toEqual([
      "arms_treaty",
      "non_proliferation",
      "war_tax",
    ]);
  });
});

describe("the economy card (spec §7.2)", () => {
  test("building pact: the structure most started since the last session, never the last one twice", async () => {
    const { game } = await three();
    const c = congressOf(game);
    for (let i = 0; i < 3; i++) c.noteBuilt(UnitType.City);
    c.noteBuilt(UnitType.Port);
    const built = c.takeBuiltCounts();
    expect(availableEconomyKinds(game, c, built)).toContain("building_pact");
    expect(
      economyItem(game, c, "building_pact", built, new PseudoRandom(1)),
    ).toMatchObject({ param: "city", reason: "most_built", reasonValue: 3 });
    c.rememberAgenda(null, "building_pact", "city");
    expect(
      economyItem(game, c, "building_pact", built, new PseudoRandom(1)).param,
    ).toBe("port");
    expect(availableEconomyKinds(game, c, new Map())).not.toContain(
      "building_pact",
    );
  });

  test("trade pact: trains only when someone has a factory", async () => {
    const { game } = await three();
    const c = congressOf(game);
    for (let seed = 0; seed < 10; seed++) {
      expect(
        economyItem(game, c, "trade_pact", new Map(), new PseudoRandom(seed))
          .param,
      ).toBe("tradeShip");
    }
  });

  test("government resolution: the top aggressor's government, else the most common one", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    grantGovernment(red, "monarchy");
    grantGovernment(blue, "republic");
    grantGovernment(green, "republic");
    expect(
      economyItem(game, c, "government_resolution", new Map(), new PseudoRandom(1)),
    ).toMatchObject({ param: "republic", reason: "common_government" });
    red.congress()!.recordTaken(game.ticks(), 60);
    expect(
      economyItem(game, c, "government_resolution", new Map(), new PseudoRandom(1)),
    ).toMatchObject({
      param: "monarchy",
      reason: "aggressor_government",
      reasonValue: red.smallID(),
    });
  });

  test("law review: a military law of the top aggressor; none without one", async () => {
    const { game, red } = await three();
    const c = congressOf(game);
    red.congress()!.recordTaken(game.ticks(), 60);
    expect(availableEconomyKinds(game, c, new Map())).not.toContain(
      "law_review",
    );
    grantLaws(red, { doctrine: "B" });
    expect(
      economyItem(game, c, "law_review", new Map(), new PseudoRandom(1)),
    ).toMatchObject({ param: "doctrine:B", reason: "aggressor_law" });
  });
});

describe("the project card (spec §7.3)", () => {
  test("the running victory project nearest to done: world government or world heritage", async () => {
    const { game, red, blue } = await three();
    expect(projectItem(game)).toBeNull();
    red.domestic()!.beginVictoryProject("political", 77, 2400);
    blue.domestic()!.beginVictoryProject("science", 88, 2400);
    blue.domestic()!.shiftVictoryProject(-1400);
    expect(projectItem(game)).toEqual({
      resolution: "world_heritage",
      targets: [blue.smallID()],
      param: "88",
      reason: "project",
      reasonValue: 58,
    });
    // A complete political proclamation waits for ratification first.
    red.domestic()!.shiftVictoryProject(-2400);
    expect(projectItem(game)).toMatchObject({
      resolution: "world_government",
      targets: [red.smallID()],
      param: "77",
    });
  });
});

describe("regular sessions on the clock", () => {
  test("the first session opens at 1,800 with two cards; the next one 1,800 ticks later", async () => {
    const { game } = await three();
    runTicks(game, 1800);
    const c = congressOf(game);
    const s = c.session()!;
    expect(s).toMatchObject({ kind: "regular", openTick: 1800, closeTick: 2100 });
    expect(s.items).toHaveLength(2);
    expect(c.nextSessionTick()).toBe(3600);
    expect(c.seats()).toHaveLength(3);
  });

  test("an aggressor is named, voted on, sanctioned at the tally, and the sanction ends at the next tally", async () => {
    const { game, red, blue } = await three();
    runTicks(game, 1700);
    for (let y = 0; y < 60; y++) red.conquer(game.ref(30, y));
    runTicks(game, 100);
    const c = congressOf(game);
    const s = c.session()!;
    expect(s.items[0]).toMatchObject({
      resolution: "sanction",
      targets: [red.smallID()],
      reason: "aggressor",
    });
    game.addExecution(new CongressVoteExecution(blue, s.id, 0, "A", 0));
    runTicks(game, s.closeTick - game.ticks());
    const updates = game.executeNextTick(); // the tally
    expect(c.isSanctioned(red.smallID())).toBe(true);
    const adopted = updates[GameUpdateType.DisplayEvent].find(
      (u) => u.message === "events_display.congress_adopted_target",
    )!;
    expect(adopted.params).toMatchObject({
      resolution: "sanction",
      option: "A",
      a: 1,
      b: 0,
      name: "red",
    });
    runTicks(game, 3600 + 300 - game.ticks() + 1);
    expect(c.isSanctioned(red.smallID())).toBe(false);
  });

  test("a truce lasts 120 s; world heritage A lasts the project; a tie adopts nothing", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    seatAll(game);
    blue.domestic()!.beginVictoryProject("science", 88, 2400);
    const s = c.openSession(
      "regular",
      [
        item("truce", [red.smallID(), blue.smallID()]),
        item("world_heritage", [blue.smallID()], "88", "project"),
        item("war_tax"),
      ],
      game.ticks(),
    );
    c.castBallot(red, s.id, 0, "A", 0);
    c.castBallot(blue, s.id, 1, "A", 0);
    c.castBallot(red, s.id, 2, "A", 0);
    c.castBallot(green, s.id, 2, "B", 0);
    runTicks(game, s.closeTick - game.ticks() + 1);
    const close = s.closeTick;
    expect(c.active().map((r) => [r.resolution, r.expires])).toEqual([
      ["truce", close + 1200],
      ["world_heritage", "project_end"],
    ]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/congress/Sessions.test.ts --run`
Expected: FAIL — `pickSeats is not a function`(스텁에 없음)

- [ ] **Step 3: 구현**

`packages/engine/src/congress/Sessions.ts` 전체를 다음으로 바꾼다:

```ts
import {
  BUILDING_PACT_UNITS,
  BallotOption,
  ResolutionExpiry,
  ResolutionId,
  TRADE_PACT_KINDS,
  TradePactKind,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  GOVERNMENT_IDS,
  GovernmentId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  MessageType,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { STOCKPILED_NUKES } from "@openfront/engine-api/strategic/StrategicTypes";
import {
  AGGRESSOR_MIN_PCT,
  AGGRESSOR_REPEAT_PCT,
  AI_SEATS,
  MILITARY_LAWS,
  round1,
  RUNAWAY_FACTOR,
  TRUCE_TICKS,
  VICTIM_MIN_PCT,
  WAR_PAIR_MIN_PCT,
} from "@openfront/engine-lib/congress/CongressBalance";
import { domesticScores, projectProgress } from "@openfront/engine-lib/domestic/Score";
import type { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { domesticScoreInput } from "../domestic/DomesticWinCheck";
import type { Game, Player } from "../game/Game";
import type { AgendaItemInit, Congress, ItemResult } from "./Congress";
import { aggressionPct, isLedgerPlayer, pairPct, victimPct } from "./Metrics";
import { applyAdoption } from "./WorldGovernment";

export interface SecurityCandidate {
  item: AgendaItemInit;
  /** May follow a session with the same kind (an aggressor at 2%+). */
  repeatable: boolean;
}

export type EconomyKind =
  | "trade_pact"
  | "building_pact"
  | "research_fund"
  | "tech_pact"
  | "government_resolution"
  | "law_review";

const ECONOMY_KINDS: readonly EconomyKind[] = [
  "trade_pact",
  "building_pact",
  "research_fund",
  "tech_pact",
  "government_resolution",
  "law_review",
];

/** At the scheduled tick (spec §6.1): seats, then the security, economy and project cards, then the vote opens. */
export function openRegularSession(
  mg: Game,
  c: Congress,
  random: PseudoRandom,
): void {
  c.setSeats(pickSeats(mg));
  const security = pickSecurity(mg, c, random);
  const economy = pickEconomy(mg, c, random);
  const project = projectItem(mg);
  c.rememberAgenda(
    security.resolution,
    economy.resolution,
    economy.resolution === "building_pact"
      ? economy.param
      : c.lastBuildingTarget(),
  );
  c.openSession(
    "regular",
    project === null ? [security, economy] : [security, economy, project],
    mg.ticks(),
  );
}

/** Spec §6.2: alive humans and the AI_SEATS nations with the highest domestic score (ties: lower smallID). */
export function pickSeats(mg: Game): number[] {
  const players = mg.players();
  const scores = domesticScores(players.map(domesticScoreInput));
  const humans = players
    .filter((p) => p.type() === PlayerType.Human)
    .map((p) => p.smallID());
  const nations = players
    .map((p, i) => ({ p, score: scores[i].total }))
    .filter((x) => x.p.type() === PlayerType.Nation)
    .sort((a, b) => b.score - a.score || a.p.smallID() - b.p.smallID())
    .slice(0, AI_SEATS)
    .map((x) => x.p.smallID());
  return [...humans, ...nations].sort((a, b) => a - b);
}

function agendaTargets(mg: Game): Player[] {
  return mg.players().filter(isLedgerPlayer);
}

/** The player with the largest value at or above `min` (ties: the first, i.e. lower smallID). */
function best(
  players: readonly Player[],
  value: (p: Player) => number,
  min: number,
): { player: Player; value: number } | null {
  let top: { player: Player; value: number } | null = null;
  for (const p of players) {
    const v = value(p);
    if (v >= min && (top === null || v > top.value)) top = { player: p, value: v };
  }
  return top;
}

function entry(
  resolution: ResolutionId,
  targets: number[],
  reason: AgendaItemInit["reason"],
  value: number,
  param: string | null = null,
): AgendaItemInit {
  return { resolution, targets, param, reason, reasonValue: round1(value) };
}

/** A finished missile silo, or a stockpiled nuke (strategic weapons). */
function isArmed(p: Player): boolean {
  return (
    p.units(UnitType.MissileSilo).some((u) => !u.isUnderConstruction()) ||
    STOCKPILED_NUKES.some((t) => (p.strategic()?.stock(t) ?? 0) > 0)
  );
}

/** Spec §7.1 steps 1-4, in priority order. */
export function securityCandidates(
  mg: Game,
  c: Congress,
): SecurityCandidate[] {
  const now = mg.ticks();
  const players = agendaTargets(mg);
  const out: SecurityCandidate[] = [];
  const victim = best(players, (p) => victimPct(mg, p, now), VICTIM_MIN_PCT);
  if (victim !== null) {
    out.push({
      item: entry(
        "protectorate",
        [victim.player.smallID()],
        "victim",
        victim.value,
      ),
      repeatable: false,
    });
  }
  const aggressor = best(
    players,
    (p) => aggressionPct(mg, p, now),
    AGGRESSOR_MIN_PCT,
  );
  if (aggressor !== null) {
    out.push({
      item: entry(
        isArmed(aggressor.player) ? "arms_embargo" : "sanction",
        [aggressor.player.smallID()],
        "aggressor",
        aggressor.value,
      ),
      repeatable: aggressor.value >= AGGRESSOR_REPEAT_PCT,
    });
  }
  let pair: { low: number; high: number; pct: number } | null = null;
  for (const p of c.pairs()) {
    const a = mg.playerBySmallID(p.low);
    const b = mg.playerBySmallID(p.high);
    if (!a.isPlayer() || !b.isPlayer() || !a.isAlive() || !b.isAlive()) {
      continue;
    }
    if (!isLedgerPlayer(a) || !isLedgerPlayer(b)) continue;
    const pct = pairPct(mg, p, now);
    if (pct >= WAR_PAIR_MIN_PCT && (pair === null || pct > pair.pct)) {
      pair = { low: p.low, high: p.high, pct };
    }
  }
  if (pair !== null) {
    out.push({
      item: entry("truce", [pair.low, pair.high], "war_pair", pair.pct),
      repeatable: false,
    });
  }
  const byLand = [...players].sort(
    (a, b) => b.numTilesOwned() - a.numTilesOwned() || a.smallID() - b.smallID(),
  );
  if (
    byLand.length >= 2 &&
    byLand[1].numTilesOwned() > 0 &&
    byLand[0].numTilesOwned() >= byLand[1].numTilesOwned() * RUNAWAY_FACTOR
  ) {
    out.push({
      item: entry(
        "hegemony_check",
        [byLand[0].smallID()],
        "runaway",
        byLand[0].numTilesOwned() / byLand[1].numTilesOwned(),
      ),
      repeatable: false,
    });
  }
  return out;
}

/** Spec §7.1: the first candidate not of the last session's kind (unless repeatable), else a world rule. */
export function pickSecurity(
  mg: Game,
  c: Congress,
  random: PseudoRandom,
): AgendaItemInit {
  const last = c.lastSecurityKind();
  for (const cand of securityCandidates(mg, c)) {
    if (cand.item.resolution !== last || cand.repeatable) return cand.item;
  }
  const globals: ResolutionId[] = ["war_tax", "arms_treaty"];
  if (
    mg.players().some((p) => p.domestic()?.hasTech("manhattan_project") === true)
  ) {
    globals.push("non_proliferation");
  }
  const pool = globals.filter((g) => g !== last);
  return entry(pool[random.nextInt(0, pool.length)], [], "global", 0);
}

function pickEconomy(
  mg: Game,
  c: Congress,
  random: PseudoRandom,
): AgendaItemInit {
  const built = c.takeBuiltCounts();
  const available = availableEconomyKinds(mg, c, built);
  const last = c.lastEconomyKind();
  let pool = available.filter((k) => k !== last);
  if (pool.length === 0) pool = available;
  const kind = pool[random.nextInt(0, pool.length)];
  return economyItem(mg, c, kind, built, random);
}

function mostBuilt(
  c: Congress,
  built: ReadonlyMap<string, number>,
): { key: string; count: number } | null {
  let top: { key: string; count: number } | null = null;
  for (const u of BUILDING_PACT_UNITS) {
    if (u.key === c.lastBuildingTarget()) continue;
    const count = built.get(u.key) ?? 0;
    if (count > 0 && (top === null || count > top.count)) {
      top = { key: u.key, count };
    }
  }
  return top;
}

function topAggressor(mg: Game): Player | null {
  return (
    best(agendaTargets(mg), (p) => aggressionPct(mg, p), AGGRESSOR_MIN_PCT)
      ?.player ?? null
  );
}

function targetGovernment(
  mg: Game,
): { government: GovernmentId; aggressor: Player | null } | null {
  const aggressor = topAggressor(mg);
  const own = aggressor?.domestic()?.currentGovernment();
  if (aggressor !== null && own !== undefined && own !== "chiefdom") {
    return { government: own, aggressor };
  }
  const counts = new Map<GovernmentId, number>();
  for (const p of agendaTargets(mg)) {
    const g = p.domestic()?.currentGovernment();
    if (g !== undefined && g !== "chiefdom") {
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  let top: GovernmentId | null = null;
  for (const g of GOVERNMENT_IDS) {
    if ((counts.get(g) ?? 0) > (top === null ? 0 : (counts.get(top) ?? 0))) {
      top = g;
    }
  }
  return top === null ? null : { government: top, aggressor: null };
}

function aggressorLaws(mg: Game): {
  aggressor: Player | null;
  laws: (typeof MILITARY_LAWS)[number][];
} {
  const aggressor = topAggressor(mg);
  const laws = aggressor?.domestic()?.proclaimedLaws();
  return {
    aggressor,
    laws:
      laws === undefined
        ? []
        : MILITARY_LAWS.filter((m) => laws.get(m.law) === m.option),
  };
}

/** Spec §7.2: the economy kinds that have something to name now. */
export function availableEconomyKinds(
  mg: Game,
  c: Congress,
  built: ReadonlyMap<string, number>,
): EconomyKind[] {
  return ECONOMY_KINDS.filter((k) => {
    switch (k) {
      case "building_pact":
        return mostBuilt(c, built) !== null;
      case "government_resolution":
        return targetGovernment(mg) !== null;
      case "law_review":
        return aggressorLaws(mg).laws.length > 0;
      default:
        return true;
    }
  });
}

/** Spec §7.2: the card of `kind` (which must be available). */
export function economyItem(
  mg: Game,
  c: Congress,
  kind: EconomyKind,
  built: ReadonlyMap<string, number>,
  random: PseudoRandom,
): AgendaItemInit {
  switch (kind) {
    case "trade_pact": {
      const factories = mg.units(UnitType.Factory).length > 0;
      const kinds: readonly TradePactKind[] = factories
        ? TRADE_PACT_KINDS
        : ["tradeShip"];
      const param =
        kinds.length > 1 ? kinds[random.nextInt(0, kinds.length)] : kinds[0];
      return entry("trade_pact", [], "global", 0, param);
    }
    case "building_pact": {
      const top = mostBuilt(c, built);
      return entry("building_pact", [], "most_built", top?.count ?? 0, top?.key ?? null);
    }
    case "research_fund":
    case "tech_pact":
      return entry(kind, [], "global", 0);
    case "government_resolution": {
      const t = targetGovernment(mg);
      return {
        resolution: "government_resolution",
        targets: [],
        param: t?.government ?? null,
        reason: t?.aggressor ? "aggressor_government" : "common_government",
        reasonValue: t?.aggressor?.smallID() ?? 0,
      };
    }
    case "law_review": {
      const { aggressor, laws } = aggressorLaws(mg);
      const pick =
        laws.length > 1 ? laws[random.nextInt(0, laws.length)] : laws[0];
      return {
        resolution: "law_review",
        targets: [],
        param: pick === undefined ? null : `${pick.law}:${pick.option}`,
        reason: "aggressor_law",
        reasonValue: aggressor?.smallID() ?? 0,
      };
    }
  }
}

/** Spec §7.3: the running (or waiting) victory project nearest to done (ties: lower smallID). */
export function projectItem(mg: Game): AgendaItemInit | null {
  let top: Player | null = null;
  let left = Infinity;
  for (const p of mg.players()) {
    const project = p.domestic()?.victoryProject() ?? null;
    if (project === null) continue;
    if (project.ticksLeft === 0 && project.kind !== "political") continue;
    if (project.ticksLeft < left) {
      top = p;
      left = project.ticksLeft;
    }
  }
  const project = top?.domestic()?.victoryProject() ?? null;
  if (top === null || project === null) return null;
  return {
    resolution:
      project.kind === "political" ? "world_government" : "world_heritage",
    targets: [top.smallID()],
    param: String(project.hostUnitId),
    reason: "project",
    reasonValue: Math.round(projectProgress(project) * 100),
  };
}

/** Spec §8: how long an adopted item lasts; null for the one-shot world-government card. */
export function resolutionExpiry(
  resolution: ResolutionId,
  option: BallotOption,
  now: number,
): ResolutionExpiry | null {
  if (resolution === "world_government") return null;
  if (resolution === "truce") return now + TRUCE_TICKS;
  if (resolution === "world_heritage" && option === "A") return "project_end";
  return "next_tally";
}

/** After a regular tally: the adopted item goes in force, its one-shot effects apply, everyone hears the totals. */
export function onRegularResult(
  mg: Game,
  c: Congress,
  r: ItemResult,
): void {
  const now = mg.ticks();
  if (r.adopted !== null) {
    const expires = resolutionExpiry(r.item.resolution, r.adopted, now);
    if (expires !== null) {
      c.addResolution({
        resolution: r.item.resolution,
        option: r.adopted,
        targets: [...r.item.targets],
        param: r.item.param,
        sinceTick: now,
        expires,
        source: "session",
      });
    }
    applyAdoption(mg, c, r);
  }
  announceResult(mg, r);
}

function announceResult(mg: Game, r: ItemResult): void {
  const [firstId, secondId] = r.item.targets;
  const first = firstId === undefined ? null : mg.playerBySmallID(firstId);
  const second = secondId === undefined ? null : mg.playerBySmallID(secondId);
  const shape = second?.isPlayer()
    ? "_pair"
    : first?.isPlayer()
      ? "_target"
      : "";
  const params: Record<string, string | number> = {
    resolution: r.item.resolution,
    a: r.a,
    b: r.b,
  };
  if (r.adopted !== null) params.option = r.adopted;
  if (first?.isPlayer()) params.name = first.displayName();
  if (second?.isPlayer()) params.targetID = second.smallID();
  mg.displayMessage(
    `events_display.congress_${r.adopted === null ? "tied" : "adopted"}${shape}`,
    MessageType.CONGRESS,
    null,
    undefined,
    params,
    undefined,
    first?.isPlayer() ? first.id() : undefined,
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest tests/congress --run && npx vitest tests/VanillaDigest.test.ts --run && npm run typecheck && npm run lint`
Expected: 모두 PASS, 오류 없음

- [ ] **Step 5: 커밋**

```bash
npx prettier --write packages/engine/src/congress/Sessions.ts tests/congress/Sessions.test.ts
git add packages/engine/src/congress/Sessions.ts tests/congress/Sessions.test.ts
git commit -m "feat(congress): regular sessions - seats, agenda, results

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: 결의 효과 I — 보정값, 무역·기부, 금지, 비용·시간, 연구

**Files:**
- Modify (스텁 채우기): `packages/engine-lib/src/congress/ResolutionEffects.ts`, `packages/engine/src/congress/Effects.ts`
- Modify: `packages/engine/src/configuration/EngineConfig.ts` (`withDomesticCost`), `packages/engine/src/execution/ConstructionExecution.ts`, `packages/engine/src/strategic/NukeProductionExecution.ts`, `packages/engine/src/domestic/DomesticEconomy.ts` (`activeConditions`, `processDomesticSecond`, `startQueuedResearch`, `domesticConstructionTicks`), `packages/engine/src/domestic/ResearchExecution.ts`
- Test: `tests/congress/ResolutionEffects.test.ts`, `tests/congress/Effects.test.ts`

**Interfaces:**
- Consumes: Task 1 `Congress.active/isSanctioned/discountedTechs/setDiscountedTechs`, `PlayerDomestic.setCongressModifiers/scienceMilliPerSecond/grantPoints`, `ResolutionLike`, `ModifierFacts`, `buildingPactType`, `TECH_PACT_DISCOUNT_PCT`, `TECH_PACT_MIN_HOLDERS`, `PATENT_SECONDS`, `HEGEMONY_FAIL_GOLD_PCT`, `isAggressing`(Task 2; 이 갈래 worktree에서는 스텁이라 테스트는 조건을 직접 넣는다)
- Produces: `resolutionModifiers`, `resolutionBans`, `resolutionBuildCostPct`, `resolutionBuildTimePct`, `resolutionNukeTimePct`(Task 1 시그니처, 실제 규칙; Task 13 화면도 쓴다), `Effects.ts`의 Task 1 시그니처 전부(실제 동작), 그리고 새로 `withTimePct(baseTicks, pct): number`(`Effects.ts`), `activeConditions(player, maxTroops, aggressing = false)`, `domesticConstructionTicks(base, player, type, extraPct = 0)`
- 메시지(Task 9 키): `events_display.congress_patent` `{ points }`(받는 나라에게만, `MessageType.CONGRESS`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/congress/ResolutionEffects.test.ts`:

```ts
import { ResolutionId } from "@openfront/engine-api/congress/CongressTypes";
import {
  LawId,
  LawOption,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  ModifierFacts,
  resolutionBans,
  resolutionBuildCostPct,
  resolutionBuildTimePct,
  resolutionModifiers,
  resolutionNukeTimePct,
} from "@openfront/engine-lib/congress/ResolutionEffects";

const ME = 1;
const facts: ModifierFacts = {
  smallID: ME,
  government: "monarchy",
  laws: new Map<LawId, LawOption>([["doctrine", "B"]]),
};
const r = (
  resolution: ResolutionId,
  option: "A" | "B",
  targets: number[] = [],
  param: string | null = null,
) => ({ resolution, option, targets, param });

describe("resolution modifiers (spec §8)", () => {
  test.each([
    ["sanction A on me", r("sanction", "A", [ME]), [{ stat: "allGold", pct: -20 }]],
    ["sanction A on another", r("sanction", "A", [2]), []],
    ["sanction B on me", r("sanction", "B", [ME]), [{ stat: "trade", pct: 30 }]],
    [
      "war tax A",
      r("war_tax", "A"),
      [
        { stat: "allGold", pct: -30, when: "aggressing" },
        { stat: "troopUpkeep", pct: 50, when: "aggressing" },
      ],
    ],
    ["war tax B", r("war_tax", "B"), [{ stat: "allGold", pct: 20, when: "aggressing" }]],
    [
      "arms treaty A",
      r("arms_treaty", "A"),
      [
        { stat: "maxTroops", pct: -15 },
        { stat: "goldIncome", pct: 15 },
      ],
    ],
    [
      "arms treaty B",
      r("arms_treaty", "B"),
      [
        { stat: "maxTroops", pct: 15 },
        { stat: "goldIncome", pct: -10 },
      ],
    ],
    ["military aid", r("arms_embargo", "B", [ME]), [{ stat: "siloSamCost", pct: -30 }]],
    ["arms embargo A", r("arms_embargo", "A", [ME]), []],
    ["development race", r("non_proliferation", "B"), [{ stat: "nukeCost", pct: -25 }]],
    [
      "hegemony check A",
      r("hegemony_check", "A", [ME]),
      [
        { stat: "science", pct: -20 },
        { stat: "political", pct: -20 },
      ],
    ],
    ["recognized leader", r("hegemony_check", "B", [ME]), [{ stat: "goldIncome", pct: 15 }]],
    ["trade pact A trains", r("trade_pact", "A", [], "train"), [{ stat: "train", pct: 50 }]],
    ["trade pact B ships", r("trade_pact", "B", [], "tradeShip"), [{ stat: "tradeShip", pct: -50 }]],
    [
      "research fund A",
      r("research_fund", "A"),
      [
        { stat: "science", pct: 20 },
        { stat: "political", pct: -10 },
      ],
    ],
    [
      "research fund B",
      r("research_fund", "B"),
      [
        { stat: "political", pct: 20 },
        { stat: "science", pct: -10 },
      ],
    ],
    ["support my government", r("government_resolution", "A", [], "monarchy"), [{ stat: "political", pct: 25 }]],
    ["condemn my government", r("government_resolution", "B", [], "monarchy"), [{ stat: "political", pct: -25 }]],
    ["another government", r("government_resolution", "A", [], "republic"), []],
    [
      "recommend my law",
      r("law_review", "A", [], "doctrine:B"),
      [
        { stat: "attackSpeed", pct: 15 },
        { stat: "defenseLoss", pct: 5 },
      ],
    ],
    [
      "suspend my law",
      r("law_review", "B", [], "doctrine:B"),
      [
        { stat: "attackSpeed", pct: -30 },
        { stat: "defenseLoss", pct: -10 },
      ],
    ],
    ["a law I don't have", r("law_review", "B", [], "service:A"), []],
    ["hegemony survived", r("emergency", "B", [ME], "hegemony"), [{ stat: "goldIncome", pct: 10 }]],
    ["a truce", r("truce", "A", [ME, 2]), []],
  ])("%s", (_, res, expected) => {
    expect(resolutionModifiers(res, facts)).toEqual(expected);
  });
});

describe("bans, costs and times (spec §8)", () => {
  test("a building ban names one structure for everyone", () => {
    const active = [r("building_pact", "B", [], "city")];
    expect(resolutionBans(active, ME, UnitType.City)).toBe(true);
    expect(resolutionBans(active, 2, UnitType.City)).toBe(true);
    expect(resolutionBans(active, ME, UnitType.Port)).toBe(false);
  });

  test("an arms embargo bans its target's strategic arms and silos only", () => {
    const active = [r("arms_embargo", "A", [ME])];
    for (const t of [
      UnitType.AtomBomb,
      UnitType.HydrogenBomb,
      UnitType.MIRV,
      UnitType.ConventionalMissile,
      UnitType.Satellite,
      UnitType.Bomber,
      UnitType.CoastalBarrage,
      UnitType.MissileSilo,
    ]) {
      expect(resolutionBans(active, ME, t), t).toBe(true);
    }
    expect(resolutionBans(active, ME, UnitType.SAMLauncher)).toBe(false);
    expect(resolutionBans(active, 2, UnitType.AtomBomb)).toBe(false);
  });

  test("non-proliferation bans the three nukes for everyone", () => {
    const active = [r("non_proliferation", "A")];
    expect(resolutionBans(active, 2, UnitType.MIRV)).toBe(true);
    expect(resolutionBans(active, 2, UnitType.ConventionalMissile)).toBe(false);
  });

  test("promotion: -40% cost and -50% time for the named structure", () => {
    const active = [r("building_pact", "A", [], "factory")];
    expect(resolutionBuildCostPct(active, UnitType.Factory)).toBe(-40);
    expect(resolutionBuildTimePct(active, UnitType.Factory)).toBe(-50);
    expect(resolutionBuildCostPct(active, UnitType.City)).toBe(0);
  });

  test("military aid and the development race halve nuke production, adding up", () => {
    expect(resolutionNukeTimePct([r("arms_embargo", "B", [ME])], ME)).toBe(-50);
    expect(resolutionNukeTimePct([r("arms_embargo", "B", [2])], ME)).toBe(0);
    expect(
      resolutionNukeTimePct(
        [r("arms_embargo", "B", [ME]), r("non_proliferation", "B")],
        ME,
      ),
    ).toBe(-100);
  });
});
```

`tests/congress/Effects.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import {
  nukeProductionTimePct,
  researchCostMilli,
} from "@openfront/engine/congress/Effects";
import {
  activeConditions,
  domesticConstructionTicks,
} from "@openfront/engine/domestic/DomesticEconomy";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { ResearchExecution } from "@openfront/engine/domestic/ResearchExecution";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { NukeProductionExecution } from "@openfront/engine/strategic/NukeProductionExecution";
import { grantGovernment, grantLaws, grantTechs } from "../domestic/util";
import {
  BLUE,
  congressGame,
  congressOf,
  enact,
  GREEN,
  own,
  RED,
  runTicks,
} from "./util";

async function three(config: Partial<GameConfig> = {}): Promise<{
  game: Game;
  red: Player;
  blue: Player;
  green: Player;
}> {
  const game = await congressGame(config, [RED, BLUE, GREEN]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  const green = own(game, GREEN.id, 60, 0, 30, 100);
  game.executeNextTick();
  return { game, red, blue, green };
}

describe("modifiers from the congress", () => {
  test("the clock puts them into the domestic totals once a second, and takes them out", async () => {
    const { game, red } = await three();
    const before = game.config().maxTroops(red);
    enact(game, { resolution: "arms_treaty" });
    runTicks(game, 10);
    expect(red.domestic()!.pct("maxTroops")).toBe(-15);
    expect(red.domestic()!.pct("goldIncome")).toBe(15);
    expect(game.config().maxTroops(red)).toBeCloseTo(before * 0.85);
    congressOf(game).dropTallyResolutions();
    runTicks(game, 10);
    expect(red.domestic()!.pct("maxTroops")).toBe(0);
    expect(red.domestic()!.toData().congressModifiers).toBeUndefined();
  });

  test("a war tax bites only while aggressing", async () => {
    const { game, red } = await three();
    enact(game, { resolution: "war_tax" });
    runTicks(game, 10);
    const d = red.domestic()!;
    const max = game.config().maxTroops(red);
    expect(activeConditions(red, max, false).has("aggressing")).toBe(false);
    d.setConditions(activeConditions(red, max, false));
    expect(d.pct("allGold")).toBe(0);
    d.setConditions(activeConditions(red, max, true));
    expect(d.pct("allGold")).toBe(-30);
    expect(d.pct("troopUpkeep")).toBe(50);
  });

  test("law review: every holder's law ×1.5 when recommended, off when suspended", async () => {
    const { game, red, blue, green } = await three();
    grantLaws(red, { doctrine: "B" });
    grantLaws(blue, { doctrine: "B" });
    enact(game, { resolution: "law_review", param: "doctrine:B" });
    runTicks(game, 10);
    expect(red.domestic()!.pct("attackSpeed")).toBe(45);
    expect(blue.domestic()!.pct("attackSpeed")).toBe(45);
    expect(green.domestic()!.pct("attackSpeed")).toBe(0);
    congressOf(game).dropTallyResolutions();
    enact(game, { resolution: "law_review", option: "B", param: "doctrine:B" });
    runTicks(game, 10);
    expect(red.domestic()!.pct("attackSpeed")).toBe(0);
  });

  test("research fund and government resolutions", async () => {
    const { game, red, blue } = await three();
    grantGovernment(red, "monarchy");
    enact(game, { resolution: "research_fund" });
    enact(game, {
      resolution: "government_resolution",
      option: "B",
      param: "monarchy",
    });
    runTicks(game, 10);
    // Blue keeps chiefdom (no modifiers); red's monarchy adds science -15.
    expect(blue.domestic()!.pct("science")).toBe(20);
    expect(blue.domestic()!.pct("political")).toBe(-10);
    expect(red.domestic()!.pct("science")).toBe(5);
    expect(red.domestic()!.pct("political")).toBe(-35);
  });
});

describe("enforced resolutions", () => {
  test("sanctions: no trade either way, no donations to the target", async () => {
    const { game, red, blue, green } = await three({
      donateGold: true,
      donateTroops: true,
    });
    red.createAllianceRequest(blue)?.accept();
    expect(red.canTrade(blue)).toBe(true);
    expect(blue.canDonateGold(red)).toBe(true);
    enact(game, { resolution: "sanction", targets: [red.smallID()] });
    expect(red.canTrade(blue)).toBe(false);
    expect(blue.canTrade(red)).toBe(false);
    expect(blue.canTrade(green)).toBe(true);
    expect(blue.canDonateGold(red)).toBe(false);
    expect(blue.canDonateTroops(red)).toBe(false);
    expect(red.canDonateGold(blue)).toBe(true);
  });

  test("a building ban locks that structure's new builds and upgrades for everyone", async () => {
    const { game, red, blue } = await three();
    red.addGold(10_000_000n);
    blue.addGold(10_000_000n);
    const city = red.buildUnit(UnitType.City, game.ref(5, 5), {});
    enact(game, { resolution: "building_pact", option: "B", param: "city" });
    expect(red.canBuild(UnitType.City, game.ref(20, 50))).toBe(false);
    expect(blue.canBuild(UnitType.City, game.ref(45, 50))).toBe(false);
    expect(red.canUpgradeUnit(city)).toBe(false);
    expect(red.canBuild(UnitType.DefensePost, game.ref(20, 50))).not.toBe(
      false,
    );
    const city2 = red
      .buildableUnits(game.ref(20, 50))
      .find((b) => b.type === UnitType.City)!;
    expect(city2.banned).toBe(true);
    expect(red.isCongressBanned(UnitType.City)).toBe(true);
  });

  test("an arms embargo bans its target's nukes and new silos; others buy freely", async () => {
    const { game, red, blue } = await three();
    for (const [p, x] of [
      [red, 10],
      [blue, 40],
    ] as const) {
      grantTechs(p, "rocketry", "manhattan_project");
      p.addGold(100_000_000n);
      p.buildUnit(UnitType.MissileSilo, game.ref(x, 10), {});
    }
    enact(game, { resolution: "arms_embargo", targets: [red.smallID()] });
    expect(red.canBuild(UnitType.AtomBomb, game.ref(45, 50))).toBe(false);
    expect(blue.canBuild(UnitType.AtomBomb, game.ref(15, 50))).not.toBe(false);
    expect(red.canBuild(UnitType.MissileSilo, game.ref(20, 80))).toBe(false);
    expect(red.canBuild(UnitType.DefensePost, game.ref(20, 80))).not.toBe(
      false,
    );
  });

  test("with strategic weapons the embargo stops production, never a launch from stock", async () => {
    const { game, red } = await three({ strategicWeapons: true });
    grantTechs(red, "railroad", "rocketry", "manhattan_project");
    red.addGold(100_000_000n);
    red.buildUnit(UnitType.Factory, game.ref(10, 30), {});
    red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    red.strategic()!.addStock(UnitType.AtomBomb);
    enact(game, { resolution: "arms_embargo", targets: [red.smallID()] });
    expect(red.canBuild(UnitType.AtomBomb, game.ref(45, 50))).not.toBe(false);
    const atom = red
      .buildableUnits(game.ref(45, 50))
      .find((b) => b.type === UnitType.AtomBomb)!;
    expect(atom.banned).toBe(false);
    game.addExecution(new NukeProductionExecution(red, UnitType.AtomBomb));
    runTicks(game, 1);
    expect(red.strategic()!.jobs()).toHaveLength(0);
  });

  test("non-proliferation stops new production and leaves a running line alone", async () => {
    const { game, red } = await three({ strategicWeapons: true });
    grantTechs(red, "railroad", "rocketry", "manhattan_project");
    red.addGold(100_000_000n);
    const factory = red.buildUnit(UnitType.Factory, game.ref(10, 30), {});
    factory.increaseLevel();
    game.addExecution(new NukeProductionExecution(red, UnitType.AtomBomb));
    runTicks(game, 1);
    expect(red.strategic()!.jobs()).toHaveLength(1);
    enact(game, { resolution: "non_proliferation" });
    game.addExecution(new NukeProductionExecution(red, UnitType.AtomBomb));
    runTicks(game, 1);
    expect(red.strategic()!.jobs()).toHaveLength(1);
  });

  test("military aid and the development race shorten nuke production (capped at -60%)", async () => {
    const { game, red } = await three({ strategicWeapons: true });
    grantTechs(red, "railroad", "rocketry", "manhattan_project");
    red.addGold(100_000_000n);
    const factory = red.buildUnit(UnitType.Factory, game.ref(10, 30), {});
    factory.increaseLevel();
    const c = congressOf(game);
    enact(game, { resolution: "arms_embargo", option: "B", targets: [red.smallID()] });
    expect(nukeProductionTimePct(c, red)).toBe(-50);
    game.addExecution(new NukeProductionExecution(red, UnitType.AtomBomb));
    runTicks(game, 1);
    const [first] = red.strategic()!.jobs();
    expect(first.endTick - first.startTick).toBe(100);
    enact(game, { resolution: "non_proliferation", option: "B" });
    game.addExecution(new NukeProductionExecution(red, UnitType.AtomBomb));
    runTicks(game, 1);
    const second = red.strategic()!.jobs()[1];
    expect(second.endTick - second.startTick).toBe(80);
  });

  test("promotion: a city costs 40% less and builds in half the time", async () => {
    const { game, red } = await three();
    const c = congressOf(game);
    const cost = () => game.unitInfo(UnitType.City).cost(game, red);
    const before = cost();
    enact(game, { resolution: "building_pact", param: "city" });
    expect(cost()).toBe(BigInt(Math.round(Number(before) * 0.6)));
    expect(
      domesticConstructionTicks(20, red, UnitType.City, -50),
    ).toBe(10);
    red.addGold(10_000_000n);
    game.addExecution(
      new ConstructionExecution(red, UnitType.City, game.ref(20, 20)),
    );
    runTicks(game, 2);
    expect(red.units(UnitType.City)[0].constructionTicks()).toBe(10);
    expect(c.active()).toHaveLength(1);
  });
});

describe("the tech pact", () => {
  test("A: a tech two players have costs and takes 30% less", async () => {
    const { game, red, blue, green } = await three();
    grantTechs(red, "currency");
    grantTechs(blue, "currency");
    enact(game, { resolution: "tech_pact" });
    runTicks(game, 10);
    const c = congressOf(game);
    expect(c.discountedTechs()).toEqual(["currency"]);
    expect(researchCostMilli(c, "currency", 150_000)).toBe(105_000);
    green.domestic()!.addYield(105_000, 0);
    game.addExecution(new ResearchExecution(green, "currency", false));
    runTicks(game, 1);
    expect(green.domestic()!.currentResearch()).toMatchObject({
      tech: "currency",
      totalTicks: 140,
    });
    expect(green.domestic()!.scienceMilliAvailable()).toBe(0);
  });

  test("B: the first to complete a tech nobody has gets 60 s of science", async () => {
    const { game, red, blue } = await three();
    enact(game, { resolution: "tech_pact", option: "B" });
    game.addExecution(new DomesticExecution());
    const d = red.domestic()!;
    d.beginResearch("academia", 10);
    runTicks(game, 11);
    expect(d.hasTech("academia")).toBe(true);
    expect(d.scienceMilliAvailable()).toBe(d.scienceMilliPerSecond() * 61);
    const b = blue.domestic()!;
    b.beginResearch("academia", 10);
    runTicks(game, 10);
    expect(b.hasTech("academia")).toBe(true);
    expect(b.scienceMilliAvailable()).toBe(b.scienceMilliPerSecond() * 2);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/congress/ResolutionEffects.test.ts tests/congress/Effects.test.ts --run`
Expected: FAIL — 스텁이 빈 목록과 `false`를 돌려준다.

- [ ] **Step 3: 순수 규칙 구현**

`packages/engine-lib/src/congress/ResolutionEffects.ts`의 스텁 다섯 개(`// Task 4 …` 주석부터 파일 끝까지)를 다음으로 바꾼다(위쪽 import에 `LawId`, `LawOption`은 이미 있고, `import { LAWS } from "../domestic/Laws";`와 `import { HEGEMONY_FAIL_GOLD_PCT } from "./CongressBalance";`를 더한다):

```ts
// Spec §8 numbers, in percent.
const SANCTION_GOLD_PCT = -20;
const ACQUIESCE_TRADE_PCT = 30;
const WAR_TAX_GOLD_PCT = -30;
const WAR_TAX_UPKEEP_PCT = 50;
const WAR_BOOM_GOLD_PCT = 20;
const DISARM_TROOPS_PCT = -15;
const DISARM_GOLD_PCT = 15;
const ARMS_RACE_TROOPS_PCT = 15;
const ARMS_RACE_GOLD_PCT = -10;
const MILITARY_AID_SILO_SAM_PCT = -30;
const DEVELOPMENT_RACE_NUKE_PCT = -25;
const HEGEMONY_CHECK_OUTPUT_PCT = -20;
const LEADER_GOLD_PCT = 15;
const TRADE_PACT_PCT = 50;
const FUND_BOOST_PCT = 20;
const FUND_CUT_PCT = -10;
const GOVERNMENT_POLITICAL_PCT = 25;
const LAW_RECOMMEND_SCALE = 0.5;
const LAW_SUSPEND_SCALE = -1;
const PROMOTION_COST_PCT = -40;
const PROMOTION_TIME_PCT = -50;
const NUKE_TIME_PCT = -50;

const NUKES: ReadonlySet<UnitType> = new Set([
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRV,
]);
/** S6 A: everything strategic the target may not buy, build or produce. */
const EMBARGOED: ReadonlySet<UnitType> = new Set([
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRV,
  UnitType.ConventionalMissile,
  UnitType.Satellite,
  UnitType.Bomber,
  UnitType.CoastalBarrage,
  UnitType.MissileSilo,
]);

/** The domestic modifiers `r` gives a player with `facts` (spec §8.1, §8.2, plan decision 3). */
export function resolutionModifiers(
  r: ResolutionLike,
  facts: ModifierFacts,
): Modifier[] {
  const mine = r.targets.includes(facts.smallID);
  const a = r.option === "A";
  switch (r.resolution) {
    case "sanction":
      if (!mine) return [];
      return a
        ? [{ stat: "allGold", pct: SANCTION_GOLD_PCT }]
        : [{ stat: "trade", pct: ACQUIESCE_TRADE_PCT }];
    case "war_tax":
      return a
        ? [
            { stat: "allGold", pct: WAR_TAX_GOLD_PCT, when: "aggressing" },
            { stat: "troopUpkeep", pct: WAR_TAX_UPKEEP_PCT, when: "aggressing" },
          ]
        : [{ stat: "allGold", pct: WAR_BOOM_GOLD_PCT, when: "aggressing" }];
    case "arms_treaty":
      return a
        ? [
            { stat: "maxTroops", pct: DISARM_TROOPS_PCT },
            { stat: "goldIncome", pct: DISARM_GOLD_PCT },
          ]
        : [
            { stat: "maxTroops", pct: ARMS_RACE_TROOPS_PCT },
            { stat: "goldIncome", pct: ARMS_RACE_GOLD_PCT },
          ];
    case "arms_embargo":
      return mine && !a
        ? [{ stat: "siloSamCost", pct: MILITARY_AID_SILO_SAM_PCT }]
        : [];
    case "non_proliferation":
      return a ? [] : [{ stat: "nukeCost", pct: DEVELOPMENT_RACE_NUKE_PCT }];
    case "hegemony_check":
      if (!mine) return [];
      return a
        ? [
            { stat: "science", pct: HEGEMONY_CHECK_OUTPUT_PCT },
            { stat: "political", pct: HEGEMONY_CHECK_OUTPUT_PCT },
          ]
        : [{ stat: "goldIncome", pct: LEADER_GOLD_PCT }];
    case "trade_pact": {
      const stat =
        r.param === "train" ? "train" : r.param === "tradeShip" ? "tradeShip" : null;
      if (stat === null) return [];
      return [{ stat, pct: a ? TRADE_PACT_PCT : -TRADE_PACT_PCT }];
    }
    case "research_fund":
      return a
        ? [
            { stat: "science", pct: FUND_BOOST_PCT },
            { stat: "political", pct: FUND_CUT_PCT },
          ]
        : [
            { stat: "political", pct: FUND_BOOST_PCT },
            { stat: "science", pct: FUND_CUT_PCT },
          ];
    case "government_resolution":
      if (r.param !== facts.government) return [];
      return [
        {
          stat: "political",
          pct: a ? GOVERNMENT_POLITICAL_PCT : -GOVERNMENT_POLITICAL_PCT,
        },
      ];
    case "law_review": {
      const [law, option] = (r.param ?? "").split(":") as [LawId, LawOption];
      if (facts.laws.get(law) !== option) return [];
      const def = LAWS[law]?.[option];
      if (def === undefined) return [];
      const scale = a ? LAW_RECOMMEND_SCALE : LAW_SUSPEND_SCALE;
      return def.modifiers.map((m) => ({ ...m, pct: m.pct * scale }));
    }
    case "emergency":
      return mine && !a && r.param === "hegemony"
        ? [{ stat: "goldIncome", pct: HEGEMONY_FAIL_GOLD_PCT }]
        : [];
    default:
      return [];
  }
}

/** E2 B, S6 A, S7 A: whether `type` may not be bought, built, upgraded or produced by `smallID`. */
export function resolutionBans(
  active: readonly ResolutionLike[],
  smallID: number,
  type: UnitType,
): boolean {
  for (const r of active) {
    if (r.option !== "A" && r.resolution !== "building_pact") continue;
    switch (r.resolution) {
      case "building_pact":
        if (r.option === "B" && buildingPactType(r.param) === type) return true;
        break;
      case "arms_embargo":
        if (r.targets.includes(smallID) && EMBARGOED.has(type)) return true;
        break;
      case "non_proliferation":
        if (NUKES.has(type)) return true;
        break;
    }
  }
  return false;
}

/** E2 A: build-cost percent for `type`. */
export function resolutionBuildCostPct(
  active: readonly ResolutionLike[],
  type: UnitType,
): number {
  return active.some(
    (r) =>
      r.resolution === "building_pact" &&
      r.option === "A" &&
      buildingPactType(r.param) === type,
  )
    ? PROMOTION_COST_PCT
    : 0;
}

/** E2 A: build-time percent for `type`. */
export function resolutionBuildTimePct(
  active: readonly ResolutionLike[],
  type: UnitType,
): number {
  return active.some(
    (r) =>
      r.resolution === "building_pact" &&
      r.option === "A" &&
      buildingPactType(r.param) === type,
  )
    ? PROMOTION_TIME_PCT
    : 0;
}

/** S6 B (its target) and S7 B (everyone): -50% each, added. */
export function resolutionNukeTimePct(
  active: readonly ResolutionLike[],
  smallID: number,
): number {
  let pct = 0;
  for (const r of active) {
    if (r.option !== "B") continue;
    if (r.resolution === "arms_embargo" && r.targets.includes(smallID)) {
      pct += NUKE_TIME_PCT;
    }
    if (r.resolution === "non_proliferation") pct += NUKE_TIME_PCT;
  }
  return pct;
}
```

- [ ] **Step 4: 엔진 효과 구현**

`packages/engine/src/congress/Effects.ts` 전체를 다음으로 바꾼다:

```ts
import { BallotOption } from "@openfront/engine-api/congress/CongressTypes";
import {
  Modifier,
  TECH_IDS,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  PATENT_SECONDS,
  TECH_PACT_DISCOUNT_PCT,
  TECH_PACT_MIN_HOLDERS,
} from "@openfront/engine-lib/congress/CongressBalance";
import {
  resolutionBans,
  resolutionBuildCostPct,
  resolutionBuildTimePct,
  resolutionModifiers,
  resolutionNukeTimePct,
} from "@openfront/engine-lib/congress/ResolutionEffects";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import { capCombinedPct } from "@openfront/engine-lib/domestic/Modifiers";
import type { Game, Player } from "../game/Game";
import type { Congress } from "./Congress";

/** Once a second: every player's congress modifiers into its domestic totals; the tech-pact list. */
export function refreshCongressEffects(mg: Game, c: Congress): void {
  for (const p of mg.players()) {
    p.domestic()?.setCongressModifiers(congressModifiers(mg, c, p));
  }
  c.setDiscountedTechs(techPact(c, "A") ? widelyKnownTechs(mg) : []);
}

/** The modifiers the resolutions in force give `player` now. */
export function congressModifiers(
  _mg: Game,
  c: Congress,
  player: Player,
): Modifier[] {
  const d = player.domestic();
  if (d === null) return [];
  const facts = {
    smallID: player.smallID(),
    government: d.currentGovernment(),
    laws: d.proclaimedLaws(),
  };
  return c.active().flatMap((r) => resolutionModifiers(r, facts));
}

/** S1 A: a sanctioned side trades with nobody. */
export function tradeBlocked(c: Congress, a: Player, b: Player): boolean {
  return c.isSanctioned(a.smallID()) || c.isSanctioned(b.smallID());
}

/** S1 A: a sanctioned player receives no gold or troops. */
export function donationBlocked(c: Congress, recipient: Player): boolean {
  return c.isSanctioned(recipient.smallID());
}

/** E2 B, S6 A, S7 A and the nuclear-emergency ban (PlayerImpl lets stock launches through first). */
export function congressBans(
  c: Congress,
  player: Player,
  type: UnitType,
): boolean {
  return resolutionBans(c.active(), player.smallID(), type);
}

export function buildCostPct(c: Congress, type: UnitType): number {
  return resolutionBuildCostPct(c.active(), type);
}

export function buildTimePct(c: Congress, type: UnitType): number {
  return resolutionBuildTimePct(c.active(), type);
}

export function nukeProductionTimePct(c: Congress, player: Player): number {
  return resolutionNukeTimePct(c.active(), player.smallID());
}

/** `baseTicks` under `pct` (capped like other combined cuts, at least one tick). */
export function withTimePct(baseTicks: number, pct: number): number {
  if (pct === 0) return baseTicks;
  return Math.max(
    1,
    Math.round((baseTicks * (100 + capCombinedPct(pct))) / 100),
  );
}

function techPact(c: Congress, option: BallotOption): boolean {
  return c
    .active()
    .some((r) => r.resolution === "tech_pact" && r.option === option);
}

/** Techs at least TECH_PACT_MIN_HOLDERS alive players have, in tech order. */
function widelyKnownTechs(mg: Game): TechId[] {
  const counts = new Map<TechId, number>();
  for (const p of mg.players()) {
    for (const t of p.domestic()?.researchedTechs() ?? []) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return TECH_IDS.filter((t) => (counts.get(t) ?? 0) >= TECH_PACT_MIN_HOLDERS);
}

/** E4 A: what `tech` costs now, in milli-points. */
export function researchCostMilli(
  c: Congress | null,
  tech: TechId,
  baseMilli: number,
): number {
  if (c === null || !c.discountedTechs().includes(tech)) return baseMilli;
  return Math.round((baseMilli * (100 + TECH_PACT_DISCOUNT_PCT)) / 100);
}

/** E4 A: research time percent for `tech` now. */
export function researchTimePct(c: Congress | null, tech: TechId): number {
  return c !== null && c.discountedTechs().includes(tech)
    ? TECH_PACT_DISCOUNT_PCT
    : 0;
}

/** E4 B: the first player to complete a tech nobody else has gets 60 s of its science. */
export function onResearchComplete(
  mg: Game,
  player: Player,
  tech: TechId,
): void {
  const c = mg.congress();
  if (c === null || !techPact(c, "B")) return;
  for (const p of mg.allPlayers()) {
    if (p !== player && p.domestic()?.hasTech(tech)) return;
  }
  const d = player.domestic();
  if (d === null) return;
  const science = d.scienceMilliPerSecond() * PATENT_SECONDS;
  d.grantPoints(science, 0);
  mg.displayMessage(
    "events_display.congress_patent",
    MessageType.CONGRESS,
    player.id(),
    undefined,
    { points: Math.floor(science / MILLI) },
  );
}
```

- [ ] **Step 5: 연결 지점**

`packages/engine/src/configuration/EngineConfig.ts`:
- import 추가: `import { buildCostPct } from "../congress/Effects";`
- `withDomesticCost`의 시그니처를 `private withDomesticCost(game: Game, player: Player, type: UnitType, base: number): bigint`로 바꾸고, `if (stat !== undefined) pct += domestic.pct(stat);` 뒤에:

```ts
    // World congress (spec §8.2 E2 A): a building pact's discount.
    const congress = game.congress();
    if (congress !== null) pct += buildCostPct(congress, type);
```

- 호출하는 세 곳에 `game`을 앞에 넘긴다: MIRV 닫힘 함수(`(game: Game, player: Player) =>`), 위성 닫힘 함수(`(_game: Game, player: Player)`의 `_game`을 `game`으로), `costWrapper`의 닫힘 함수(`(game: Game, player: Player, extraUnits …)`).

`packages/engine/src/domestic/DomesticEconomy.ts`:
- import 추가: `import { onResearchComplete, researchCostMilli, researchTimePct } from "../congress/Effects";`, `import { isAggressing } from "../congress/Ledger";`
- `activeConditions(player, maxTroops)`를 `activeConditions(player: Player, maxTroops: number, aggressing = false)`로 바꾸고 `holds`에 `aggressing,`를 더한다(주석: `// World congress only (spec §4.2); false everywhere else, so other games' sets are unchanged.`).
- `processDomesticSecond`의 첫 줄을:

```ts
  d.setConditions(
    activeConditions(
      player,
      maxTroops,
      mg.congress() !== null && isAggressing(mg, player),
    ),
  );
```

- 같은 함수의 `if (finished !== null) { mg.displayMessage("events_display.research_complete", …); }` 블록 안 끝에 `onResearchComplete(mg, player, finished);`
- `startQueuedResearch`에서 `payPoints(…, TECHS[tech].cost * MILLI, false)`를 `payPoints(mg, player, d, "science", researchCostMilli(mg.congress(), tech, TECHS[tech].cost * MILLI), false)`로, `researchTicks(tech, d.pct("researchTime"))`를 `researchTicks(tech, d.pct("researchTime") + researchTimePct(mg.congress(), tech))`로.
- `domesticConstructionTicks(base, player, type)`를 `domesticConstructionTicks(base: number, player: Player, type: UnitType, extraPct = 0)`로 바꾸고 `let pct = d.pct("buildTime");`를 `let pct = d.pct("buildTime") + extraPct;`로(주석: `// extraPct: the congress's building pact (spec §8.2 E2 A).`).

`packages/engine/src/domestic/ResearchExecution.ts`:
- import 추가: `import { researchCostMilli, researchTimePct } from "../congress/Effects";`
- `const costMilli = TECHS[this.tech].cost * MILLI;`를 `const costMilli = researchCostMilli(mg.congress(), this.tech, TECHS[this.tech].cost * MILLI);`로, `researchTicks(this.tech, d.pct("researchTime"))`를 `researchTicks(this.tech, d.pct("researchTime") + researchTimePct(mg.congress(), this.tech))`로.

`packages/engine/src/execution/ConstructionExecution.ts`:
- import 추가: `import { buildTimePct } from "../congress/Effects";`
- `const duration = domesticConstructionTicks(info.constructionDuration ?? 0, this.player, this.constructionType);`를:

```ts
      const congress = this.mg.congress();
      const duration = domesticConstructionTicks(
        info.constructionDuration ?? 0,
        this.player,
        this.constructionType,
        congress === null ? 0 : buildTimePct(congress, this.constructionType),
      );
```

`packages/engine/src/strategic/NukeProductionExecution.ts`:
- import 추가: `import { nukeProductionTimePct, withTimePct } from "../congress/Effects";`
- `if (this.player.isUnitUnavailable(this.nukeType)) return;`를 `if (this.player.isUnitUnavailable(this.nukeType) || this.player.isCongressBanned(this.nukeType)) return;`로.
- `endTick: now + NUKE_PRODUCTION_TICKS[this.nukeType],`를:

```ts
      // World congress (spec §8.1 S6 B, S7 B): faster production.
      endTick:
        now +
        (mg.congress() === null
          ? NUKE_PRODUCTION_TICKS[this.nukeType]
          : withTimePct(
              NUKE_PRODUCTION_TICKS[this.nukeType],
              nukeProductionTimePct(mg.congress()!, this.player),
            )),
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/congress tests/domestic tests/strategic tests/VanillaDigest.test.ts tests/EngineConfig.test.ts --run && npm run typecheck && npm run lint`
Expected: 모두 PASS, 오류 없음(내정·전략 무기 테스트는 의회가 없는 게임이라 그대로다)

- [ ] **Step 7: 커밋**

```bash
npx prettier --write packages/engine-lib/src/congress/ResolutionEffects.ts packages/engine/src/congress/Effects.ts packages/engine/src/configuration/EngineConfig.ts packages/engine/src/domestic/DomesticEconomy.ts packages/engine/src/domestic/ResearchExecution.ts packages/engine/src/execution/ConstructionExecution.ts packages/engine/src/strategic/NukeProductionExecution.ts tests/congress/ResolutionEffects.test.ts tests/congress/Effects.test.ts
git add packages/engine-lib/src/congress/ResolutionEffects.ts packages/engine/src/congress/Effects.ts packages/engine/src/configuration/EngineConfig.ts packages/engine/src/domestic/DomesticEconomy.ts packages/engine/src/domestic/ResearchExecution.ts packages/engine/src/execution/ConstructionExecution.ts packages/engine/src/strategic/NukeProductionExecution.ts tests/congress/ResolutionEffects.test.ts tests/congress/Effects.test.ts
git commit -m "feat(congress): resolution modifiers, trade and donation bans, build bans, costs and research

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: 결의 효과 II — 휴전, 전투 배율, 세계 유산 보호, 세계 정부 비준

**Files:**
- Modify (스텁 채우기): `packages/engine/src/congress/Conflict.ts`, `packages/engine/src/congress/WorldGovernment.ts`
- Modify: `packages/engine/src/execution/AttackExecution.ts`, `packages/engine/src/execution/TransportShipExecution.ts`, `packages/engine/src/execution/NukeExecution.ts`(보호), `packages/engine/src/strategic/Satellite.ts` (`canTargetWithSatellite`), `packages/engine/src/strategic/OrbitalStrike.ts` (`landStrikeWave`), `packages/engine/src/strategic/ConventionalMissileExecution.ts` (`strike`), `packages/engine/src/warfare/BombingExecution.ts` (`dropBomb`), `packages/engine/src/domestic/VictoryProjects.ts` (`processVictoryProjectSecond`), `packages/engine/src/domestic/DomesticWinCheck.ts` (`checkDomesticWin`)
- Test: `tests/congress/Truce.test.ts`, `tests/congress/Heritage.test.ts`, `tests/congress/WorldGovernment.test.ts`

**Interfaces:**
- Consumes: Task 1 `Congress.active/isEmergencyMember/isEmergencyTarget/verdict/setVerdict`, `ItemResult`, `PlayerDomestic.shiftVictoryProject`, 전투·보호 상수, `WORLD_GOV_STEP_TICKS`, `Player.isTruceWith`(Task 1이 `isTruce`로 연결), `domesticCombat`, `orbitalStrike`, 테스트 유틸, `buildLevel`, `reachGovernmentTier3`(`tests/domestic/util.ts`)
- Produces: `isTruce`, `withCongressCombat`, `isHeritageProtected`, `heritageHostTiles`, `applyAdoption`, `awaitsRatification`, `isProjectCondemned`(Task 1 시그니처, 실제 동작; Task 8 AI가 쓴다)
- 메시지(Task 9 키): `events_display.world_gov_awaiting` `{ name, project }`(`MessageType.VICTORY_PROJECT`, 모두에게, `announceVictoryProject`로)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/congress/Truce.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { CongressExecution } from "@openfront/engine/congress/CongressExecution";
import { withCongressCombat } from "@openfront/engine/congress/Conflict";
import {
  AttackLogicInput,
  AttackLogicResult,
} from "@openfront/engine/configuration/EngineConfig";
import { domesticCombat } from "@openfront/engine/domestic/DomesticEconomy";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { TransportShipExecution } from "@openfront/engine/execution/TransportShipExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { canTargetWithSatellite } from "@openfront/engine/strategic/Satellite";
import { grantTechs } from "../domestic/util";
import { setup } from "../util/Setup";
import { TestConfig } from "../util/TestConfig";
import {
  BLUE,
  congressGame,
  congressOf,
  enact,
  GREEN,
  own,
  RED,
  runTicks,
} from "./util";

async function three(config: Partial<GameConfig> = {}): Promise<{
  game: Game;
  red: Player;
  blue: Player;
  green: Player;
}> {
  const game = await congressGame(config, [RED, BLUE, GREEN]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  const green = own(game, GREEN.id, 60, 0, 30, 100);
  game.executeNextTick();
  return { game, red, blue, green };
}

function truce(game: Game, a: Player, b: Player): void {
  enact(game, {
    resolution: "truce",
    targets: [a.smallID(), b.smallID()],
    expires: game.ticks() + 1200,
  });
}

describe("the truce (spec §8.1 S2)", () => {
  test("forbids every hostile act between the two, and only between them", async () => {
    const { game, red, blue, green } = await three({
      strategicWeapons: true,
      warfareExpansion: true,
    });
    grantTechs(red, "rocketry", "manhattan_project");
    red.addGold(100_000_000n);
    blue.addGold(10_000_000n);
    green.addGold(10_000_000n);
    red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    red.strategic()!.addStock(UnitType.AtomBomb);
    blue.buildUnit(UnitType.City, game.ref(45, 50), {});
    const greenCity = green.buildUnit(UnitType.City, game.ref(75, 50), {});
    truce(game, red, blue);
    expect(red.isTruceWith(blue)).toBe(true);
    expect(blue.isTruceWith(red)).toBe(true);
    expect(red.isTruceWith(green)).toBe(false);
    expect(red.canAttackPlayer(blue)).toBe(false);
    expect(blue.canAttackPlayer(red)).toBe(false);
    expect(red.canAttackPlayer(green)).toBe(true);
    expect(red.canBuild(UnitType.AtomBomb, game.ref(45, 60))).toBe(false);
    expect(red.canBuild(UnitType.AtomBomb, game.ref(75, 60))).not.toBe(false);
    expect(red.missileTarget(game.ref(45, 50))).toBeNull();
    expect(red.missileTarget(game.ref(75, 50))?.id()).toBe(greenCity.id());
    expect(red.canBuild(UnitType.CoastalBarrage, game.ref(45, 60))).toBe(
      false,
    );
    expect(canTargetWithSatellite(game, red, blue)).toBe(false);
    expect(canTargetWithSatellite(game, red, green)).toBe(true);
  });

  test("a truce pulls running attacks back whole", async () => {
    const { game, red, blue } = await three();
    red.setTroops(10_000);
    game.addExecution(new AttackExecution(1000, red, blue.id(), null));
    runTicks(game, 2);
    const attack = red.outgoingAttacks()[0];
    expect(attack).toBeDefined();
    const inFlight = attack.troops();
    const home = red.troops();
    truce(game, red, blue);
    runTicks(game, 1);
    expect(red.outgoingAttacks()).toHaveLength(0);
    expect(Math.abs(red.troops() - (home + inFlight))).toBeLessThan(1);
  });

  test("a blocked attack leaves no embargo or grudge", async () => {
    const { game, red, blue } = await three();
    red.setTroops(10_000);
    truce(game, red, blue);
    const relation = blue.relation(red);
    game.addExecution(new AttackExecution(1000, red, blue.id(), null));
    runTicks(game, 1);
    expect(red.outgoingAttacks()).toHaveLength(0);
    expect(blue.hasEmbargoAgainst(red)).toBe(false);
    expect(blue.relation(red)).toBe(relation);
    expect(red.troops()).toBe(10_000);
  });

  test("a boat at sea turns back and lands home whole", async () => {
    // half_land_half_ocean: land x 0-7, sea x 8-15, shore at x = 7.
    const game = await congressGame({}, [RED, BLUE], "half_land_half_ocean");
    const red = own(game, RED.id, 0, 0, 8, 4);
    const blue = own(game, BLUE.id, 0, 12, 8, 4);
    game.executeNextTick();
    red.setTroops(10_000);
    game.addExecution(new TransportShipExecution(red, game.ref(7, 13), 1000));
    runTicks(game, 3);
    expect(red.units(UnitType.TransportShip)).toHaveLength(1);
    expect(red.troops()).toBe(9_000);
    truce(game, red, blue);
    for (let i = 0; i < 300; i++) {
      if (red.units(UnitType.TransportShip).length === 0) break;
      game.executeNextTick();
    }
    expect(red.units(UnitType.TransportShip)).toHaveLength(0);
    expect(red.troops()).toBe(10_000);
    expect(blue.numTilesOwned()).toBe(32);
  });

  test("emergency members can't fight each other; the target can be fought", async () => {
    const { game, red, blue, green } = await three();
    congressOf(game).setEmergency({
      kind: "aggression",
      target: green.smallID(),
      startTick: game.ticks(),
      endTick: game.ticks() + 1500,
      goalKind: "land",
      goal: 450,
      progress: 0,
      members: [red.smallID(), blue.smallID()],
      opposed: [],
      contributions: new Map(),
      goalSilos: [],
      countedSilos: [],
    });
    expect(red.isTruceWith(blue)).toBe(true);
    expect(red.canAttackPlayer(blue)).toBe(false);
    expect(red.isTruceWith(green)).toBe(false);
  });
});

describe("congress combat scales", () => {
  test("duel, protectorate, partition, hegemony check, emergency members and a condemned owner", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    const base = domesticCombat(red, blue);
    expect(withCongressCombat(base, c, red, blue)).toBe(base);
    expect(withCongressCombat(base, null, red, blue)).toBe(base);

    enact(game, {
      resolution: "truce",
      option: "B",
      targets: [red.smallID(), blue.smallID()],
      expires: game.ticks() + 1200,
    });
    let s = withCongressCombat(base, c, red, blue);
    expect(s.attackerSpeed).toBeCloseTo(1.25);
    expect(s.attackerLoss).toBeCloseTo(0.85);
    expect(withCongressCombat(base, c, red, green)).toBe(base);
    c.expireResolutions(game.ticks() + 2000);

    enact(game, { resolution: "protectorate", targets: [blue.smallID()] });
    s = withCongressCombat(base, c, red, blue);
    expect(s.attackerLoss).toBeCloseTo(1.4);
    expect(s.attackerSpeed).toBeCloseTo(0.8);
    expect(s.defenderLoss).toBeCloseTo(0.8);
    c.dropTallyResolutions();

    enact(game, {
      resolution: "protectorate",
      option: "B",
      targets: [blue.smallID()],
    });
    expect(withCongressCombat(base, c, red, blue).attackerLoss).toBeCloseTo(
      0.8,
    );
    c.dropTallyResolutions();

    enact(game, { resolution: "hegemony_check", targets: [blue.smallID()] });
    expect(withCongressCombat(base, c, red, blue).attackerLoss).toBeCloseTo(
      0.85,
    );
    c.dropTallyResolutions();

    enact(game, {
      resolution: "world_heritage",
      option: "B",
      targets: [blue.smallID()],
      param: "1",
    });
    s = withCongressCombat(base, c, red, blue);
    expect(s.attackerSpeed).toBeCloseTo(1.2);
    expect(s.attackerLoss).toBeCloseTo(0.8);
    c.dropTallyResolutions();

    c.setEmergency({
      kind: "aggression",
      target: blue.smallID(),
      startTick: game.ticks(),
      endTick: game.ticks() + 1500,
      goalKind: "land",
      goal: 450,
      progress: 0,
      members: [red.smallID()],
      opposed: [],
      contributions: new Map(),
      goalSilos: [],
      countedSilos: [],
    });
    s = withCongressCombat(base, c, red, blue);
    expect(s.attackerSpeed).toBeCloseTo(1.2);
    expect(s.attackerLoss).toBeCloseTo(0.8);
    expect(withCongressCombat(base, c, green, blue)).toBe(base);
  });

  test("attacks fight with them", async () => {
    class RecordingConfig extends TestConfig {
      readonly inputs: AttackLogicInput[] = [];
      override attackLogic(i: AttackLogicInput): AttackLogicResult {
        this.inputs.push(i);
        return super.attackLogic(i);
      }
    }
    const game = await setup(
      "plains",
      { domesticMode: true, congress: true },
      [RED, BLUE],
      undefined,
      RecordingConfig,
    );
    game.addExecution(new CongressExecution(1));
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 30, 0, 30, 100);
    game.executeNextTick();
    enact(game, { resolution: "protectorate", targets: [blue.smallID()] });
    red.setTroops(10_000);
    game.addExecution(new AttackExecution(1000, red, blue.id(), null));
    runTicks(game, 3);
    const input = (game.config() as RecordingConfig).inputs.at(-1)!;
    expect(input.attacker.lossScale).toBeCloseTo(1.4);
    expect(input.attacker.speedScale).toBeCloseTo(0.8);
    expect(input.defender!.lossScale).toBeCloseTo(0.8);
  });
});
```

`tests/congress/Heritage.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { isHeritageProtected } from "@openfront/engine/congress/Conflict";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { NukeExecution } from "@openfront/engine/execution/NukeExecution";
import { orbitalStrike } from "@openfront/engine/strategic/OrbitalStrike";
import { buildLevel, grantTechs } from "../domestic/util";
import { BLUE, congressGame, congressOf, enact, own, RED, runTicks } from "./util";

// red holds x 0-29 with a level-3 institute at (15, 50) running the space
// program under world heritage A; blue holds x 30-59.
async function protectedProject() {
  const game = await congressGame({ strategicWeapons: true }, [RED, BLUE]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  game.executeNextTick();
  const host = buildLevel(game, red, UnitType.ResearchInstitute, 15, 50, 3);
  red.domestic()!.beginVictoryProject("science", host.id(), 2400);
  enact(game, {
    resolution: "world_heritage",
    targets: [red.smallID()],
    param: String(host.id()),
    expires: "project_end",
  });
  return { game, red, blue, host };
}

describe("world heritage A (spec §10.2)", () => {
  test("protects exactly the named host of its owner", async () => {
    const { game, red, host } = await protectedProject();
    expect(isHeritageProtected(game, host)).toBe(true);
    red.addGold(10_000_000n);
    const city = red.buildUnit(UnitType.City, game.ref(5, 5), {});
    expect(isHeritageProtected(game, city)).toBe(false);
  });

  test("the host survives a nuke and keeps its tile", async () => {
    const { game, red, blue, host } = await protectedProject();
    grantTechs(blue, "rocketry", "manhattan_project");
    blue.addGold(100_000_000n);
    blue.buildUnit(UnitType.MissileSilo, game.ref(45, 10), {});
    blue.strategic()!.addStock(UnitType.AtomBomb);
    game.addExecution(
      new NukeExecution(UnitType.AtomBomb, blue, host.tile(), null),
    );
    runTicks(game, 100);
    expect(blue.strategic()!.stock(UnitType.AtomBomb)).toBe(0);
    expect(host.isActive()).toBe(true);
    expect(game.owner(host.tile())).toBe(red);
  });

  test("the host and its ground survive an orbital strike; the rest burns", async () => {
    const { game, red, blue, host } = await protectedProject();
    red.addGold(10_000_000n);
    const city = red.buildUnit(UnitType.City, game.ref(5, 5), {});
    orbitalStrike(game, blue, red);
    expect(city.isActive()).toBe(false);
    expect(host.isActive()).toBe(true);
    expect(game.owner(host.tile())).toBe(red);
  });

  test("capture still ends the project, and the protection with it", async () => {
    const { game, red, blue, host } = await protectedProject();
    game.addExecution(new DomesticExecution());
    blue.captureUnit(host);
    runTicks(game, 21);
    expect(red.domestic()!.victoryProject()).toBeNull();
    expect(congressOf(game).active()).toEqual([]);
  });
});
```

`tests/congress/WorldGovernment.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { ItemResult } from "@openfront/engine/congress/Congress";
import {
  applyAdoption,
  awaitsRatification,
  isProjectCondemned,
} from "@openfront/engine/congress/WorldGovernment";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { checkDomesticWin } from "@openfront/engine/domestic/DomesticWinCheck";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { buildLevel, reachGovernmentTier3 } from "../domestic/util";
import { setup } from "../util/Setup";
import { BLUE, congressGame, congressOf, enact, own, RED, runTicks } from "./util";

async function proclamation() {
  const game = await congressGame({}, [RED, BLUE]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  own(game, BLUE.id, 30, 0, 30, 100);
  game.executeNextTick();
  reachGovernmentTier3(red);
  const office = buildLevel(game, red, UnitType.AdminOffice, 15, 50, 3);
  const d = red.domestic()!;
  d.beginVictoryProject("political", office.id(), 2400);
  return { game, red, d, office, c: congressOf(game) };
}

function verdict(red: Player, office: Unit, adopted: "A" | "B"): ItemResult {
  return {
    sessionId: 1,
    kind: "regular",
    index: 2,
    item: {
      resolution: "world_government",
      targets: [red.smallID()],
      param: String(office.id()),
      reason: "project",
      reasonValue: 0,
      voters: 2,
    },
    a: adopted === "A" ? 2 : 1,
    b: adopted === "B" ? 2 : 1,
    adopted,
    aVoters: [],
    bVoters: [],
  };
}

function messagesOver(game: Game, ticks: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < ticks; i++) {
    for (const m of game.executeNextTick()[GameUpdateType.DisplayEvent]) {
      out.push(m.message);
    }
  }
  return out;
}

describe("world government approval (spec §10.1)", () => {
  test("approval moves the proclamation 60 s ahead and ratifies it; rejection moves it back", async () => {
    const { game, red, d, office, c } = await proclamation();
    applyAdoption(game, c, verdict(red, office, "A"));
    expect(d.victoryProject()!.ticksLeft).toBe(1800);
    expect(c.verdict(red.smallID())).toEqual({
      host: office.id(),
      ratified: true,
    });
    applyAdoption(game, c, verdict(red, office, "B"));
    applyAdoption(game, c, verdict(red, office, "B"));
    expect(d.victoryProject()!.ticksLeft).toBe(2400);
    expect(c.verdict(red.smallID())!.ratified).toBe(false);
  });

  test("a proclamation that completes unratified waits instead of winning", async () => {
    const { game, red, d } = await proclamation();
    d.shiftVictoryProject(-2400);
    expect(awaitsRatification(game, red)).toBe(true);
    expect(checkDomesticWin(game)).toBeNull();
  });

  test("approval of a waiting proclamation wins at the next win check", async () => {
    const { game, red, d, office, c } = await proclamation();
    d.shiftVictoryProject(-2400);
    applyAdoption(game, c, verdict(red, office, "A"));
    expect(awaitsRatification(game, red)).toBe(false);
    expect(checkDomesticWin(game)).toEqual({ winner: red, reason: "political" });
  });

  test("rejection of a waiting proclamation sends it back to 75%", async () => {
    const { game, red, d, office, c } = await proclamation();
    d.shiftVictoryProject(-2400);
    applyAdoption(game, c, verdict(red, office, "B"));
    expect(d.victoryProject()!.ticksLeft).toBe(600);
  });

  test("losing the office while waiting fails the project", async () => {
    const { game, d, office } = await proclamation();
    d.shiftVictoryProject(-2400);
    game.addExecution(new DomesticExecution());
    office.delete(true);
    runTicks(game, 11);
    expect(d.victoryProject()).toBeNull();
  });

  test("the completion message says it awaits ratification", async () => {
    const { game, d } = await proclamation();
    d.shiftVictoryProject(-2390);
    game.addExecution(new DomesticExecution());
    const messages = messagesOver(game, 12);
    expect(messages).toContain("events_display.world_gov_awaiting");
    expect(messages).not.toContain("events_display.victory_project_complete");
    expect(d.victoryProject()!.ticksLeft).toBe(0);
  });

  test("a ratified proclamation completes and wins as before", async () => {
    const { game, red, d, office, c } = await proclamation();
    applyAdoption(game, c, verdict(red, office, "A"));
    d.shiftVictoryProject(-1790);
    game.addExecution(new DomesticExecution());
    const messages = messagesOver(game, 12);
    expect(messages).toContain("events_display.victory_project_complete");
    expect(checkDomesticWin(game)).toEqual({ winner: red, reason: "political" });
  });
});

describe("which projects nations may single out (spec §10.3)", () => {
  test("only condemned ones in a congress game; all of them without one", async () => {
    const { game, red, office, c } = await proclamation();
    expect(isProjectCondemned(game, red)).toBe(false);
    applyAdoption(game, c, verdict(red, office, "B"));
    expect(isProjectCondemned(game, red)).toBe(true);

    const blue = game.player(BLUE.id);
    blue.domestic()!.beginVictoryProject("science", 99, 2400);
    expect(isProjectCondemned(game, blue)).toBe(false);
    enact(game, {
      resolution: "world_heritage",
      option: "B",
      targets: [blue.smallID()],
      param: "99",
    });
    expect(isProjectCondemned(game, blue)).toBe(true);

    const plain = await setup("plains", { domesticMode: true }, [RED]);
    expect(isProjectCondemned(plain, plain.player(RED.id))).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/congress/Truce.test.ts tests/congress/Heritage.test.ts tests/congress/WorldGovernment.test.ts --run`
Expected: FAIL — 스텁이라 휴전·보호·비준이 없다.

- [ ] **Step 3: 휴전·전투·보호 구현**

`packages/engine/src/congress/Conflict.ts` 전체를 다음으로 바꾼다:

```ts
import type { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  CONDEMN_LOSS_PCT,
  CONDEMN_SPEED_PCT,
  DUEL_LOSS_PCT,
  DUEL_SPEED_PCT,
  HEGEMONY_CHECK_ATTACK_LOSS_PCT,
  MEMBER_LOSS_PCT,
  MEMBER_SPEED_PCT,
  PARTITION_ATTACK_LOSS_PCT,
  PROTECTORATE_ATTACK_LOSS_PCT,
  PROTECTORATE_ATTACK_SPEED_PCT,
  PROTECTORATE_DEFENSE_LOSS_PCT,
} from "@openfront/engine-lib/congress/CongressBalance";
import type { DomesticCombat } from "../domestic/DomesticEconomy";
import type { Game, Player, Unit } from "../game/Game";
import type { Congress } from "./Congress";

const scale = (pct: number): number => 1 + pct / 100;

/** S2 A truces (sessions and emergency aftermaths), and emergency members among themselves (spec §8.1, §9.4). */
export function isTruce(c: Congress, a: Player, b: Player): boolean {
  const x = a.smallID();
  const y = b.smallID();
  for (const r of c.active()) {
    if (
      r.resolution === "truce" &&
      r.option === "A" &&
      r.targets.includes(x) &&
      r.targets.includes(y)
    ) {
      return true;
    }
  }
  return c.isEmergencyMember(x) && c.isEmergencyMember(y);
}

/**
 * `base` (the domestic combat scales) times the congress scales for
 * `attacker` against `defender` (spec §8.1, §9.4, §10.2). The same object
 * comes back when nothing applies.
 */
export function withCongressCombat(
  base: Readonly<DomesticCombat>,
  c: Congress | null,
  attacker: Player,
  defender: Player | null,
): Readonly<DomesticCombat> {
  if (c === null || defender === null) return base;
  const a = attacker.smallID();
  const d = defender.smallID();
  let loss = 1;
  let speed = 1;
  let defLoss = 1;
  for (const r of c.active()) {
    switch (r.resolution) {
      case "truce":
        if (r.option === "B" && r.targets.includes(a) && r.targets.includes(d)) {
          speed *= scale(DUEL_SPEED_PCT);
          loss *= scale(DUEL_LOSS_PCT);
        }
        break;
      case "protectorate":
        if (r.targets[0] !== d) break;
        if (r.option === "A") {
          loss *= scale(PROTECTORATE_ATTACK_LOSS_PCT);
          speed *= scale(PROTECTORATE_ATTACK_SPEED_PCT);
          defLoss *= scale(PROTECTORATE_DEFENSE_LOSS_PCT);
        } else {
          loss *= scale(PARTITION_ATTACK_LOSS_PCT);
        }
        break;
      case "hegemony_check":
        if (r.option === "A" && r.targets[0] === d) {
          loss *= scale(HEGEMONY_CHECK_ATTACK_LOSS_PCT);
        }
        break;
      case "world_heritage":
        if (r.option === "B" && r.targets[0] === d) {
          speed *= scale(CONDEMN_SPEED_PCT);
          loss *= scale(CONDEMN_LOSS_PCT);
        }
        break;
    }
  }
  if (c.isEmergencyTarget(d) && c.isEmergencyMember(a)) {
    speed *= scale(MEMBER_SPEED_PCT);
    loss *= scale(MEMBER_LOSS_PCT);
  }
  if (loss === 1 && speed === 1 && defLoss === 1) return base;
  return {
    attackerLoss: base.attackerLoss * loss,
    attackerSpeed: base.attackerSpeed * speed,
    defenderLoss: base.defenderLoss * defLoss,
  };
}

/** World heritage A (spec §10.2): its owner's named host can't be destroyed. */
export function isHeritageProtected(mg: Game, unit: Unit): boolean {
  const c = mg.congress();
  if (c === null) return false;
  const id = String(unit.id());
  const owner = unit.owner().smallID();
  return c
    .active()
    .some(
      (r) =>
        r.resolution === "world_heritage" &&
        r.option === "A" &&
        r.param === id &&
        r.targets[0] === owner,
    );
}

const NO_TILES: ReadonlySet<TileRef> = new Set<TileRef>();

/** The tiles protected hosts stand on: blasts leave them owned (plan decision 8). */
export function heritageHostTiles(mg: Game): ReadonlySet<TileRef> {
  const c = mg.congress();
  if (c === null) return NO_TILES;
  let tiles: Set<TileRef> | null = null;
  for (const r of c.active()) {
    if (r.resolution !== "world_heritage" || r.option !== "A") continue;
    const unit = mg.unit(Number(r.param));
    if (
      unit !== undefined &&
      unit.isActive() &&
      unit.owner().smallID() === r.targets[0]
    ) {
      tiles ??= new Set<TileRef>();
      tiles.add(unit.tile());
    }
  }
  return tiles ?? NO_TILES;
}
```

- [ ] **Step 4: 세계 정부 구현**

`packages/engine/src/congress/WorldGovernment.ts` 전체를 다음으로 바꾼다:

```ts
import { WORLD_GOV_STEP_TICKS } from "@openfront/engine-lib/congress/CongressBalance";
import type { Game, Player } from "../game/Game";
import type { Congress, ItemResult } from "./Congress";

/**
 * One-shot effects of an adopted item. World government (spec §10.1):
 * approval moves the proclamation 600 ticks ahead and ratifies it,
 * rejection moves it 600 back (never past the start) and unratifies it.
 */
export function applyAdoption(
  mg: Game,
  c: Congress,
  result: ItemResult,
): void {
  if (result.item.resolution !== "world_government") return;
  if (result.adopted === null) return;
  const owner = mg.playerBySmallID(result.item.targets[0]);
  if (!owner.isPlayer()) return;
  const d = owner.domestic();
  const project = d?.victoryProject() ?? null;
  const host = Number(result.item.param);
  if (
    d === null ||
    project === null ||
    project.kind !== "political" ||
    project.hostUnitId !== host
  ) {
    return;
  }
  const ratified = result.adopted === "A";
  d.shiftVictoryProject(
    ratified ? -WORLD_GOV_STEP_TICKS : WORLD_GOV_STEP_TICKS,
  );
  c.setVerdict(owner.smallID(), { host, ratified });
}

/** A complete proclamation whose latest decision isn't an approval of this host: it waits (spec §10.1 step 6). */
export function awaitsRatification(mg: Game, player: Player): boolean {
  const c = mg.congress();
  if (c === null) return false;
  const project = player.domestic()?.victoryProject() ?? null;
  if (project === null || project.kind !== "political") return false;
  if (project.ticksLeft > 0) return false;
  const v = c.verdict(player.smallID());
  return !(v !== undefined && v.host === project.hostUnitId && v.ratified);
}

/**
 * Spec §10.3: whether nations may single out `player`'s victory project —
 * always without a congress; with one, only a science project under world
 * heritage B, or a proclamation whose latest decision was a rejection.
 */
export function isProjectCondemned(mg: Game, player: Player): boolean {
  const c = mg.congress();
  if (c === null) return true;
  const project = player.domestic()?.victoryProject() ?? null;
  if (project === null) return false;
  if (project.kind === "science") {
    return c
      .active()
      .some(
        (r) =>
          r.resolution === "world_heritage" &&
          r.option === "B" &&
          r.targets[0] === player.smallID(),
      );
  }
  const v = c.verdict(player.smallID());
  return v !== undefined && v.host === project.hostUnitId && !v.ratified;
}
```

- [ ] **Step 5: 연결 지점**

`packages/engine/src/execution/AttackExecution.ts`:
- import 추가: `import { withCongressCombat } from "../congress/Conflict";`
- `init`의 우호 검사 블록(`// ALLIANCE CHECK …`) 바로 뒤에:

```ts
    // World congress (spec §8.1 S2): a truce blocks the attack before it
    // can leave an embargo or a grudge behind.
    if (this.target.isPlayer() && this._owner.isTruceWith(this.target)) {
      this.active = false;
      return;
    }
```

- `tick`의 `if (targetPlayer && this._owner.isFriendly(targetPlayer)) {`를 `if (targetPlayer && (this._owner.isFriendly(targetPlayer) || this._owner.isTruceWith(targetPlayer))) {`로(주석에 `// …or a congress truce began: back home, no losses.`).
- `const combat = domesticCombat(this._owner, targetPlayer);`를:

```ts
    const combat = withCongressCombat(
      domesticCombat(this._owner, targetPlayer),
      this.mg.congress(),
      this._owner,
      targetPlayer,
    );
```

`packages/engine/src/execution/TransportShipExecution.ts`:
- `tick`의 "Auto-retreat if destination was destroyed by nuke" 블록 바로 뒤에:

```ts
    // World congress (spec §8.1 S2): a truce turns the boat around.
    if (
      !this.boat.transportShipState().isRetreating &&
      this.target.isPlayer() &&
      this.attacker.isTruceWith(this.target)
    ) {
      this.boat.updateTransportShipState({ isRetreating: true });
      this.retreatDst = null;
    }
```

- `case PathStatus.COMPLETE:`의 `const deaths = this.boat.troops() * (malusForRetreat / 100);`를:

```ts
          // A boat a truce called back lands home whole.
          const malus =
            this.target.isPlayer() && this.attacker.isTruceWith(this.target)
              ? 0
              : malusForRetreat;
          const deaths = this.boat.troops() * (malus / 100);
```

`packages/engine/src/strategic/Satellite.ts`의 `canTargetWithSatellite` 반환식에 `!player.isTruceWith(target) &&`를 `!player.isFriendly(target, true) &&` 다음 줄로 더한다.

`packages/engine/src/execution/NukeExecution.ts`:
- import 추가: `import { heritageHostTiles, isHeritageProtected } from "../congress/Conflict";`
- `detonate()`에서 `const toDestroy = this.tilesToDestroy();` 뒤에 `const spared = heritageHostTiles(mg);`, 첫 반복문 `for (const tile of toDestroy) {`의 맨 앞에 `if (spared.has(tile)) continue;`
- 유닛 반복문의 `if (mg.euclideanDistSquared(dst, unit.tile()) < outer2) {` 블록 맨 앞에 `if (isHeritageProtected(mg, unit)) continue;`

`packages/engine/src/warfare/BombingExecution.ts`:
- import 추가: `import { heritageHostTiles, isHeritageProtected } from "../congress/Conflict";`
- `dropBomb`의 `const lostTiles = new Map<Player, number>();` 앞에 `const spared = heritageHostTiles(mg);`, `for (const tile of tiles) {` 맨 앞에 `if (spared.has(tile)) continue;`
- 유닛 반복문의 조건을 `if (BLAST_PROOF.has(unit.type()) || !unit.isActive() || isHeritageProtected(mg, unit)) continue;`로.

`packages/engine/src/strategic/OrbitalStrike.ts`의 `landStrikeWave`:
- import 추가: `import { isHeritageProtected } from "../congress/Conflict";`
- `let buildings = 0;` 앞에:

```ts
  // World heritage A (spec §10.2): the host and its site's crater stay.
  const spared = new Set<TileRef>();
  for (const unit of target.units(Structures.types)) {
    if (unit.isActive() && isHeritageProtected(mg, unit)) {
      addOwnedDisk(mg, target, unit.tile(), STRIKE_STRUCTURE_RADIUS, spared);
    }
  }
```

- 두 삭제 반복문의 조건에 `&& !isHeritageProtected(mg, unit)`를 더한다(`if (unit.tile() === tile && unit.isActive() && !isHeritageProtected(mg, unit))`, `if (unit.isActive() && !isHeritageProtected(mg, unit))`).
- 마지막 `for (const tile of sea) {` 맨 앞에 `if (spared.has(tile)) continue;`

`packages/engine/src/strategic/ConventionalMissileExecution.ts`의 `strike()`:
- import 추가: `import { isHeritageProtected } from "../congress/Conflict";`
- `if (owner === this.player || this.player.isFriendly(owner, true)) return;` 뒤에 `if (isHeritageProtected(this.mg, target)) return;`

`packages/engine/src/domestic/VictoryProjects.ts`:
- import 추가: `import { awaitsRatification } from "../congress/WorldGovernment";`
- `processVictoryProjectSecond`의 첫 두 줄(`const project = d.victoryProject(); if (project === null || project.ticksLeft === 0) return;`)을:

```ts
  const project = d.victoryProject();
  if (project === null) return;
  // World congress (spec §10.1): a complete, unratified proclamation waits;
  // it still fails if its office is lost meanwhile.
  const waiting = project.ticksLeft === 0 && awaitsRatification(mg, player);
  if (project.ticksLeft === 0 && !waiting) return;
```

- 호스트 상실 검사(`if (host === undefined || …) { … return; }`) 뒤에 `if (waiting) return;`
- 끝의 `if (d.victoryProject()?.ticksLeft === 0) { announceVictoryProject(mg, player, "events_display.victory_project_complete", project.kind, host.id()); }`에서 메시지를 `awaitsRatification(mg, player) ? "events_display.world_gov_awaiting" : "events_display.victory_project_complete"`로.

`packages/engine/src/domestic/DomesticWinCheck.ts`:
- import 추가: `import { awaitsRatification } from "../congress/WorldGovernment";`
- `checkDomesticWin`의 프로젝트 반복문에서 `if (project === null || project.ticksLeft > 0) continue;` 뒤에 `if (project.kind === "political" && awaitsRatification(mg, p)) continue;`

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/congress tests/domestic tests/strategic tests/warfare tests/Attack.test.ts tests/core/executions --run && npx vitest tests/VanillaDigest.test.ts --run && npm run typecheck && npm run lint`
Expected: 모두 PASS, 오류 없음

- [ ] **Step 7: 커밋**

```bash
npx prettier --write packages/engine/src/congress/Conflict.ts packages/engine/src/congress/WorldGovernment.ts packages/engine/src/execution/AttackExecution.ts packages/engine/src/execution/TransportShipExecution.ts packages/engine/src/execution/NukeExecution.ts packages/engine/src/strategic/Satellite.ts packages/engine/src/strategic/OrbitalStrike.ts packages/engine/src/strategic/ConventionalMissileExecution.ts packages/engine/src/warfare/BombingExecution.ts packages/engine/src/domestic/VictoryProjects.ts packages/engine/src/domestic/DomesticWinCheck.ts tests/congress/Truce.test.ts tests/congress/Heritage.test.ts tests/congress/WorldGovernment.test.ts
git add packages/engine/src/congress/Conflict.ts packages/engine/src/congress/WorldGovernment.ts packages/engine/src/execution/AttackExecution.ts packages/engine/src/execution/TransportShipExecution.ts packages/engine/src/execution/NukeExecution.ts packages/engine/src/strategic/Satellite.ts packages/engine/src/strategic/OrbitalStrike.ts packages/engine/src/strategic/ConventionalMissileExecution.ts packages/engine/src/warfare/BombingExecution.ts packages/engine/src/domestic/VictoryProjects.ts packages/engine/src/domestic/DomesticWinCheck.ts tests/congress/Truce.test.ts tests/congress/Heritage.test.ts tests/congress/WorldGovernment.test.ts
git commit -m "feat(congress): truces, congress combat scales, world heritage, world government ratification

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: 비상 — 소집 가능, 소집, 투표 결과, 진행과 끝, 핵 점수

**Files:**
- Modify (스텁 채우기): `packages/engine/src/congress/Emergencies.ts`
- Modify: `packages/engine/src/execution/MIRVExecution.ts` (`separate`), `packages/engine/src/strategic/StrikeWaves.ts` (`startOrbitalStrike`)
- Test: `tests/congress/Emergencies.test.ts`, `tests/congress/NukeScore.test.ts`

**Interfaces:**
- Consumes: Task 1 `Congress`(비상·소집 가능·대기·횟수·패권·멸망 저장, `openSession`, `castBallot`, `addResolution`, `updateEmergency`, `emergencyHero`, `seats`, `isSeated`, `isSanctioned`), `PlayerCongress.recordNuke/recordLost/recordHitBy/nukeScore/grant/clearInfluence/spend`, `PlayerDomestic.scienceMilliPerSecond/politicalMilliPerSecond/grantPoints`, `conveneBlock`, `conveneWindowOpen`, `aggressionPct`, `landSharePct`, `isLedgerPlayer`, 비상 상수, `nukeScore`, `NukeWeapon`, `ConveneEmergencyExecution`(Task 1)
- Produces: Task 1 스텁 6개의 실제 동작, 그리고 새로 `emergencyKindFor(mg, c, p): EmergencyKind | null`, `hegemonyLevel(mg, p): number`, `refreshAvailability(mg, c): void`, `startEmergency(mg, c, kind, target, supporters, opposed): void`, `finishEmergency(mg, c, success): void`
- 메시지(Task 9 키, 모두 `MessageType.CONGRESS`, 모두에게, `focusPlayerID` = 대상): `events_display.congress_emergency_available` `{kind, name}`, `congress_emergency_convened` `{kind, name, targetID(소집한 나라)}`, `congress_emergency_rejected` `{kind, name, a, b}`, `congress_emergency_started` `{kind, name, a, b}`, `congress_emergency_success` `{kind, name, targetID(영웅)}`, `congress_emergency_success_nohero` `{kind, name}`, `congress_emergency_failed` `{kind, name}`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/congress/Emergencies.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import {
  conveneEmergency,
  finishEmergency,
  onEmergencyVote,
  processEmergencySecond,
  startEmergency,
} from "@openfront/engine/congress/Emergencies";
import { Game, Player } from "@openfront/engine/game/Game";
import {
  BLUE,
  congressGame,
  congressOf,
  enact,
  giveInfluence,
  GREEN,
  influence,
  own,
  RED,
  runTicks,
  seatAll,
} from "./util";

// red x 0-29, blue x 30-59, green x 60-89 (3,000 tiles each of 10,000).
async function three(): Promise<{
  game: Game;
  red: Player;
  blue: Player;
  green: Player;
}> {
  const game = await congressGame({}, [RED, BLUE, GREEN]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  const green = own(game, GREEN.id, 60, 0, 30, 100);
  game.executeNextTick();
  seatAll(game);
  return { game, red, blue, green };
}

function messagesOver(game: Game, ticks: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < ticks; i++) {
    for (const m of game.executeNextTick()[GameUpdateType.DisplayEvent]) {
      out.push(m.message);
    }
  }
  return out;
}

describe("what can be convened (spec §9.1)", () => {
  test("5% aggression, a nuke score of 3 and 40% of the land; the worst kind per nation", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    const now = game.ticks();
    red.congress()!.recordTaken(now, 499);
    processEmergencySecond(game, c);
    expect(c.available()).toEqual([]);
    red.congress()!.recordTaken(now, 1);
    blue.congress()!.recordNuke(now, 3);
    blue.congress()!.recordTaken(now, 600);
    // Unclaimed x 90-99: 4,000 tiles are 40%, and nothing for the ledger.
    for (let x = 90; x < 100; x++) {
      for (let y = 0; y < 100; y++) green.conquer(game.ref(x, y));
    }
    processEmergencySecond(game, c);
    expect(c.available().map((a) => [a.kind, a.target])).toEqual([
      ["aggression", red.smallID()],
      ["nuclear", blue.smallID()],
      ["hegemony", green.smallID()],
    ]);
    expect(c.available()[0].sinceTick).toBe(now);
  });

  test("a human's elimination makes its conqueror's aggression emergency available for 180 s", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    game.conquerPlayer(red, blue);
    expect(c.lastElimination(red.smallID())).toBe(game.ticks());
    processEmergencySecond(game, c);
    expect(c.available()).toEqual([
      { kind: "aggression", target: red.smallID(), sinceTick: game.ticks() },
    ]);
    runTicks(game, 1810);
    expect(c.available()).toEqual([]);
  });

  test("nothing is listed without seats, during an emergency, in a cooldown or after three emergencies", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    red.congress()!.recordTaken(game.ticks(), 600);
    const listed = () => {
      processEmergencySecond(game, c);
      return c.available().length;
    };
    c.setSeats([]);
    expect(listed()).toBe(0);
    seatAll(game);
    expect(listed()).toBe(1);
    c.setGlobalCooldown(game.ticks() + 100);
    expect(listed()).toBe(0);
    c.setGlobalCooldown(0);
    c.setTargetCooldown(red.smallID(), game.ticks() + 100);
    expect(listed()).toBe(0);
    c.setTargetCooldown(red.smallID(), 0);
    for (let i = 0; i < 3; i++) c.countEmergencyStarted();
    expect(listed()).toBe(0);
    expect(c.toData().emergenciesLeft).toBe(0);
    void blue;
  });

  test("everyone hears once when an emergency becomes available", async () => {
    const { game, red } = await three();
    red.congress()!.recordTaken(game.ticks(), 600);
    const messages = messagesOver(game, 25);
    expect(
      messages.filter(
        (m) => m === "events_display.congress_emergency_available",
      ),
    ).toHaveLength(1);
  });
});

describe("convening (spec §9.2)", () => {
  async function available() {
    const s = await three();
    s.red.congress()!.recordTaken(s.game.ticks(), 600);
    processEmergencySecond(s.game, congressOf(s.game));
    return s;
  }

  test("a seated non-target with 50 influence opens a 20 s vote with its own yes", async () => {
    const { game, red, blue } = await available();
    const c = congressOf(game);
    giveInfluence(blue, 60);
    expect(conveneEmergency(game, blue, "aggression", red)).toBeNull();
    expect(influence(blue)).toBe(10);
    const s = c.session()!;
    expect(s).toMatchObject({
      kind: "emergency",
      closeTick: game.ticks() + 200,
    });
    expect(s.items[0]).toMatchObject({
      resolution: "emergency",
      targets: [red.smallID()],
      param: "aggression",
      reason: "convened",
      reasonValue: blue.smallID(),
      voters: 1,
    });
    expect(blue.congress()!.ballot(s.id, 0)).toMatchObject({
      option: "A",
      extra: 0,
    });
  });

  test("refusals: unavailable, the target, its ally, sanctioned, unseated, short of influence, outside the window", async () => {
    const { game, red, blue, green } = await available();
    const c = congressOf(game);
    for (const p of [red, blue, green]) giveInfluence(p, 100);
    expect(conveneEmergency(game, blue, "nuclear", red)).toBe("unavailable");
    expect(conveneEmergency(game, red, "aggression", red)).toBe("target");
    green.createAllianceRequest(red)?.accept();
    expect(conveneEmergency(game, green, "aggression", red)).toBe("friendly");
    enact(game, { resolution: "sanction", targets: [blue.smallID()] });
    expect(conveneEmergency(game, blue, "aggression", red)).toBe("sanctioned");
    c.dropTallyResolutions();
    c.setSeats([red.smallID(), green.smallID()]);
    expect(conveneEmergency(game, blue, "aggression", red)).toBe("seat");
    seatAll(game);
    blue.congress()!.spend(blue.congress()!.influenceMilli() - 49 * MILLI);
    expect(conveneEmergency(game, blue, "aggression", red)).toBe("influence");
    giveInfluence(blue, 10);
    c.scheduleNextSession(game.ticks() + 200);
    expect(conveneEmergency(game, blue, "aggression", red)).toBe("window");
    expect(c.session()).toBeNull();
  });
});

describe("the vote and the emergency (spec §9.3-§9.5)", () => {
  async function voted(adopted: "A" | "B") {
    const s = await three();
    const c = congressOf(s.game);
    const session = c.openSession(
      "emergency",
      [
        {
          resolution: "emergency",
          targets: [s.red.smallID()],
          param: "aggression",
          reason: "convened",
          reasonValue: s.blue.smallID(),
        },
      ],
      s.game.ticks(),
    );
    giveInfluence(s.blue, 50);
    giveInfluence(s.red, 50);
    // Passes 2 : 1, or fails 1 : 2.
    c.castBallot(s.blue, session.id, 0, "A", adopted === "A" ? 1 : 0);
    c.castBallot(s.red, session.id, 0, "B", adopted === "A" ? 0 : 1);
    const [result] = c.closeSession();
    onEmergencyVote(s.game, c, result);
    return { ...s, c };
  }

  test("a passed vote starts the emergency: goal 15% of the target's land, the yes voters as members", async () => {
    const { game, red, blue, c } = await voted("A");
    expect(c.emergency()).toMatchObject({
      kind: "aggression",
      target: red.smallID(),
      startTick: game.ticks(),
      endTick: game.ticks() + 1500,
      goalKind: "land",
      goal: 450,
      progress: 0,
      members: [blue.smallID()],
      opposed: [red.smallID()],
    });
    expect(c.emergenciesStarted()).toBe(1);
  });

  test("a failed vote starts the cooldowns instead", async () => {
    const { game, red, c } = await voted("B");
    expect(c.emergency()).toBeNull();
    expect(c.globalCooldownUntil()).toBe(game.ticks() + 3000);
    expect(c.targetCooldownUntil(red.smallID())).toBe(game.ticks() + 6000);
    expect(c.emergenciesStarted()).toBe(0);
  });

  test("late joiners become members; opponents and the target's friends don't", async () => {
    const { game, red, blue, green, c } = await voted("A");
    for (let y = 0; y < 5; y++) green.conquer(game.ref(29, y));
    expect(c.emergency()!.members).toEqual([blue.smallID(), green.smallID()]);
    expect(c.emergency()!.contributions.get(green.smallID())).toBe(5);
    expect(c.emergency()!.progress).toBe(5);
    void blue;
    void red;
  });

  test("success: rewards by contribution, the hero doubled, the target sanctioned, a truce after, cooldowns", async () => {
    const { game, red, blue, green, c } = await voted("A");
    for (const p of [blue, green]) p.domestic()!.addYield(2000, 1000);
    for (let y = 0; y < 100; y++) blue.conquer(game.ref(29, y));
    for (let y = 0; y < 100; y++) blue.conquer(game.ref(28, y));
    for (let y = 0; y < 100; y++) blue.conquer(game.ref(27, y));
    for (let y = 0; y < 100; y++) blue.conquer(game.ref(26, y));
    for (let y = 0; y < 60; y++) green.conquer(game.ref(25, y));
    expect(c.emergency()!.progress).toBe(460);
    const now = game.ticks();
    processEmergencySecond(game, c);
    expect(c.emergency()).toBeNull();
    // blue: 40 left after its +1 vote, then the hero's 60.
    expect(influence(blue)).toBe(100);
    expect(influence(green)).toBe(30);
    expect(blue.domestic()!.scienceMilliAvailable()).toBe(2000 + 2000 * 90);
    expect(green.domestic()!.politicalMilliAvailable()).toBe(1000 + 1000 * 45);
    expect(c.isSanctioned(red.smallID())).toBe(true);
    expect(
      c
        .active()
        .filter((r) => r.resolution === "truce")
        .map((r) => [r.targets, r.expires]),
    ).toEqual([
      [[red.smallID(), blue.smallID()], now + 600],
      [[red.smallID(), green.smallID()], now + 600],
    ]);
    expect(c.globalCooldownUntil()).toBe(now + 3000);
    expect(c.targetCooldownUntil(red.smallID())).toBe(now + 6000);
  });

  test("failure: the target survives with 60 influence and 60 s of output", async () => {
    const { game, red, c } = await voted("A");
    red.domestic()!.addYield(1000, 1000);
    finishEmergency(game, c, false);
    // 50 it never spent on its vote, and 60 for holding out.
    expect(influence(red)).toBe(110);
    expect(red.domestic()!.scienceMilliAvailable()).toBe(1000 + 60_000);
    expect(c.emergency()).toBeNull();
  });

  test("the nuclear emergency counts silos destroyed or captured, crediting members", async () => {
    const s = await three();
    const c = congressOf(s.game);
    const silos = [
      s.red.buildUnit(UnitType.MissileSilo, s.game.ref(5, 5), {}),
      s.red.buildUnit(UnitType.MissileSilo, s.game.ref(5, 50), {}),
      s.red.buildUnit(UnitType.MissileSilo, s.game.ref(5, 90), {}),
    ];
    startEmergency(s.game, c, "nuclear", s.red, [s.blue.smallID()], []);
    expect(c.emergency()).toMatchObject({ goalKind: "silos", goal: 2 });
    silos[0].delete(true, s.blue);
    processEmergencySecond(s.game, c);
    expect(c.emergency()!.progress).toBe(1);
    expect(c.emergency()!.contributions.get(s.blue.smallID())).toBe(20);
    s.blue.captureUnit(silos[1]);
    processEmergencySecond(s.game, c);
    expect(c.emergency()).toBeNull();
    expect(
      c.active().some((r) => r.resolution === "arms_embargo" && r.option === "A"),
    ).toBe(true);
  });

  test("the target dying ends the emergency as a success", async () => {
    const { game, red, c } = await voted("A");
    for (const t of Array.from(red.tiles())) red.relinquish(t);
    processEmergencySecond(game, c);
    expect(c.emergency()).toBeNull();
    expect(c.isSanctioned(red.smallID())).toBe(true);
  });

  test("a member that allies with the target stays a member and nothing breaks", async () => {
    const { game, red, blue, c } = await voted("A");
    blue.createAllianceRequest(red)?.accept();
    expect(blue.canAttackPlayer(red)).toBe(false);
    expect(() => runTicks(game, 30)).not.toThrow();
    expect(c.emergency()!.members).toEqual([blue.smallID()]);
  });

  test("the clock ends it at its deadline", async () => {
    const { game, red, c } = await voted("A");
    runTicks(game, 1510);
    expect(c.emergency()).toBeNull();
    expect(influence(red)).toBeGreaterThanOrEqual(60);
  });
});
```

`tests/congress/NukeScore.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { congressNukeHit } from "@openfront/engine/congress/Emergencies";
import { NukeExecution } from "@openfront/engine/execution/NukeExecution";
import { startOrbitalStrike } from "@openfront/engine/strategic/StrikeWaves";
import { grantTechs } from "../domestic/util";
import { BLUE, botInfo, congressGame, congressOf, own, RED, runTicks } from "./util";

describe("the nuke score (spec §4.2, §9.1)", () => {
  test("atom 1, hydrogen 2, MIRV 3, orbital 3, warheads 0; only against humans and nations", async () => {
    const game = await congressGame({}, [RED, BLUE, botInfo("bot")]);
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 30, 0, 30, 100);
    const bot = own(game, "bot_id", 60, 0, 30, 100);
    game.executeNextTick();
    const c = congressOf(game);
    const score = () => red.congress()!.nukeScore(game.ticks());
    congressNukeHit(game, c, red, new Map([[blue, 50]]), UnitType.AtomBomb);
    expect(score()).toBe(1);
    expect(blue.congress()!.lostTiles(game.ticks())).toBe(50);
    expect(blue.congress()!.lastHitTick(red.smallID())).toBe(game.ticks());
    congressNukeHit(game, c, red, new Map([[blue, 9]]), UnitType.MIRVWarhead);
    expect(score()).toBe(1);
    congressNukeHit(game, c, red, new Map([[blue, 0]]), UnitType.MIRV);
    expect(score()).toBe(4);
    congressNukeHit(game, c, red, new Map([[bot, 80]]), UnitType.HydrogenBomb);
    expect(score()).toBe(4);
    congressNukeHit(
      game,
      c,
      red,
      new Map([
        [bot, 10],
        [blue, 30],
      ]),
      UnitType.HydrogenBomb,
    );
    expect(score()).toBe(6);
  });

  test("a real atom bomb on a nation scores", async () => {
    const game = await congressGame({}, [RED, BLUE]);
    const red = own(game, RED.id, 0, 0, 30, 100);
    own(game, BLUE.id, 30, 0, 30, 100);
    game.executeNextTick();
    grantTechs(red, "rocketry", "manhattan_project");
    red.addGold(100_000_000n);
    red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    game.addExecution(
      new NukeExecution(UnitType.AtomBomb, red, game.ref(45, 50), null),
    );
    runTicks(game, 100);
    expect(red.congress()!.nukeScore(game.ticks())).toBe(1);
  });

  test("an orbital strike scores 3", async () => {
    const game = await congressGame({ strategicWeapons: true }, [RED, BLUE]);
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 30, 0, 30, 100);
    game.executeNextTick();
    startOrbitalStrike(game, red, red.strategic()!, blue, game.ticks());
    expect(red.congress()!.nukeScore(game.ticks())).toBe(3);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/congress/Emergencies.test.ts tests/congress/NukeScore.test.ts --run`
Expected: FAIL — 스텁이라 아무것도 소집할 수 없다.

- [ ] **Step 3: 구현**

`packages/engine/src/congress/Emergencies.ts` 전체를 다음으로 바꾼다:

```ts
import { EmergencyKind } from "@openfront/engine-api/congress/CongressTypes";
import {
  MessageType,
  PlayerType,
  TerraNullius,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  AFTERMATH_TRUCE_TICKS,
  AGGRESSION_GOAL_PCT,
  CONVENE_COST_MILLI,
  ELIMINATION_MEMORY_TICKS,
  EMERGENCY_AGGRESSION_PCT,
  EMERGENCY_DURATION_TICKS,
  EMERGENCY_GLOBAL_COOLDOWN_TICKS,
  EMERGENCY_MAX_PER_GAME,
  EMERGENCY_NUKE_SCORE,
  EMERGENCY_TARGET_COOLDOWN_TICKS,
  HEGEMONY_GOAL_PCT,
  HEGEMONY_THRESHOLDS_PCT,
  HERO_MULT,
  LAND_GOAL_MIN_TILES,
  NUCLEAR_NO_SILO_GOAL_PCT,
  NUCLEAR_SUCCESS_BAN_TICKS,
  NukeWeapon,
  nukeScore,
  REWARD_INFLUENCE_MILLI,
  REWARD_SECONDS,
  SILO_CREDIT_WORLD_PCT,
  SURVIVE_INFLUENCE_MILLI,
  SURVIVE_SECONDS,
} from "@openfront/engine-lib/congress/CongressBalance";
import {
  ConveneBlock,
  conveneBlock,
  conveneWindowOpen,
} from "@openfront/engine-lib/congress/Voting";
import type { Game, Player } from "../game/Game";
import type {
  AvailableEmergency,
  Congress,
  EmergencyState,
  ItemResult,
} from "./Congress";
import { aggressionPct, isLedgerPlayer, landSharePct } from "./Metrics";

/** How many hegemony thresholds (40%, 55%) `p`'s land share has passed. */
export function hegemonyLevel(mg: Game, p: Player): number {
  const share = landSharePct(mg, p);
  return HEGEMONY_THRESHOLDS_PCT.filter((t) => share >= t).length;
}

/** Spec §9.1: the worst kind `p` qualifies for now (nuclear > aggression > hegemony), or null. */
export function emergencyKindFor(
  mg: Game,
  c: Congress,
  p: Player,
): EmergencyKind | null {
  const pc = p.congress();
  if (pc === null) return null;
  const now = mg.ticks();
  if (pc.nukeScore(now) >= EMERGENCY_NUKE_SCORE) return "nuclear";
  const elim = c.lastElimination(p.smallID());
  if (
    aggressionPct(mg, p, now) >= EMERGENCY_AGGRESSION_PCT ||
    (elim !== null && now - elim <= ELIMINATION_MEMORY_TICKS)
  ) {
    return "aggression";
  }
  if (hegemonyLevel(mg, p) > c.hegemonyLevelUsed(p.smallID())) {
    return "hegemony";
  }
  return null;
}

/**
 * Spec §9.1: what can be convened now, one entry per target. Nothing while
 * an emergency runs or is voted on, without seats, in the global cooldown,
 * after EMERGENCY_MAX_PER_GAME, or once there is a winner. Everyone hears
 * when an entry appears.
 */
export function refreshAvailability(mg: Game, c: Congress): void {
  const now = mg.ticks();
  const open =
    mg.getWinner() === null &&
    c.seats().length > 0 &&
    c.emergency() === null &&
    c.session()?.kind !== "emergency" &&
    now >= c.globalCooldownUntil() &&
    c.emergenciesStarted() < EMERGENCY_MAX_PER_GAME;
  const prev = c.available();
  const next: AvailableEmergency[] = [];
  if (open) {
    for (const p of mg.players()) {
      if (!isLedgerPlayer(p) || now < c.targetCooldownUntil(p.smallID())) {
        continue;
      }
      const kind = emergencyKindFor(mg, c, p);
      if (kind === null) continue;
      const old = prev.find((a) => a.kind === kind && a.target === p.smallID());
      next.push({ kind, target: p.smallID(), sinceTick: old?.sinceTick ?? now });
      if (old === undefined) {
        announce(mg, "events_display.congress_emergency_available", kind, p);
      }
    }
  }
  c.setAvailable(next);
}

/** convene_emergency (spec §9.2): pays 50 influence and opens the 20 s vote with the convener's yes. */
export function conveneEmergency(
  mg: Game,
  convener: Player,
  kind: EmergencyKind,
  target: Player,
): ConveneBlock | null {
  const c = mg.congress();
  if (c === null) return "unavailable";
  const now = mg.ticks();
  const pc = convener.congress();
  const block = conveneBlock({
    available: c
      .available()
      .some((a) => a.kind === kind && a.target === target.smallID()),
    windowOpen: conveneWindowOpen(
      now,
      c.session() !== null,
      c.emergency() !== null,
      c.nextSessionTick(),
    ),
    seated: convener.isAlive() && c.isSeated(convener.smallID()),
    isTarget: convener === target,
    friendlyToTarget: convener.isFriendly(target, true),
    sanctioned: c.isSanctioned(convener.smallID()),
    influenceMilli: pc?.influenceMilli() ?? 0,
  });
  if (block !== null || pc === null) return block ?? "influence";
  pc.spend(CONVENE_COST_MILLI);
  const session = c.openSession(
    "emergency",
    [
      {
        resolution: "emergency",
        targets: [target.smallID()],
        param: kind,
        reason: "convened",
        reasonValue: convener.smallID(),
      },
    ],
    now,
  );
  c.castBallot(convener, session.id, 0, "A", 0);
  announce(mg, "events_display.congress_emergency_convened", kind, target, {
    targetID: convener.smallID(),
  });
  return null;
}

/** After an emergency vote (spec §9.3): it starts, or the cooldowns do. */
export function onEmergencyVote(
  mg: Game,
  c: Congress,
  r: ItemResult,
): void {
  const now = mg.ticks();
  const targetID = r.item.targets[0];
  const target = mg.playerBySmallID(targetID);
  const kind = r.item.param as EmergencyKind;
  if (r.adopted !== "A" || !target.isPlayer() || !target.isAlive()) {
    c.setGlobalCooldown(now + EMERGENCY_GLOBAL_COOLDOWN_TICKS);
    c.setTargetCooldown(targetID, now + EMERGENCY_TARGET_COOLDOWN_TICKS);
    announce(mg, "events_display.congress_emergency_rejected", kind, target, {
      a: r.a,
      b: r.b,
    });
    return;
  }
  startEmergency(mg, c, kind, target, r.aVoters, r.bVoters);
  announce(mg, "events_display.congress_emergency_started", kind, target, {
    a: r.a,
    b: r.b,
  });
}

/** Spec §9.4: goals fixed now; the yes voters (never the target or its friends) are the first members. */
export function startEmergency(
  mg: Game,
  c: Congress,
  kind: EmergencyKind,
  target: Player,
  supporters: readonly number[],
  opposed: readonly number[],
): void {
  const now = mg.ticks();
  const tiles = target.numTilesOwned();
  const landGoal = (pct: number) =>
    Math.max(LAND_GOAL_MIN_TILES, Math.ceil((tiles * pct) / 100));
  const silos =
    kind === "nuclear"
      ? target.units(UnitType.MissileSilo).filter((u) => !u.isUnderConstruction())
      : [];
  const goalKind = silos.length > 0 ? "silos" : "land";
  const goal =
    silos.length > 0
      ? Math.max(1, Math.ceil(silos.length / 2))
      : landGoal(
          kind === "aggression"
            ? AGGRESSION_GOAL_PCT
            : kind === "hegemony"
              ? HEGEMONY_GOAL_PCT
              : NUCLEAR_NO_SILO_GOAL_PCT,
        );
  const members = supporters.filter((id) => {
    if (id === target.smallID()) return false;
    const p = mg.playerBySmallID(id);
    return p.isPlayer() && !p.isFriendly(target, true);
  });
  c.setEmergency({
    kind,
    target: target.smallID(),
    startTick: now,
    endTick: now + EMERGENCY_DURATION_TICKS[kind],
    goalKind,
    goal,
    progress: 0,
    members,
    opposed: [...opposed],
    contributions: new Map(),
    goalSilos: silos,
    countedSilos: [],
  });
  c.countEmergencyStarted();
  if (kind === "hegemony") {
    c.useHegemonyLevel(target.smallID(), hegemonyLevel(mg, target));
  }
}

/** GameImpl.conquer: a tile of the target taken. Late joiners become members (spec §9.4). */
export function emergencyConquer(
  _mg: Game,
  c: Congress,
  prev: Player,
  next: Player,
): void {
  const e = c.emergency();
  if (e === null || prev.smallID() !== e.target) return;
  const id = next.smallID();
  if (!e.members.includes(id)) {
    if (
      e.opposed.includes(id) ||
      !isLedgerPlayer(next) ||
      next.isFriendly(prev, true)
    ) {
      return;
    }
    c.updateEmergency((x) => x.members.push(id));
  }
  c.updateEmergency((x) => {
    x.contributions.set(id, (x.contributions.get(id) ?? 0) + 1);
    if (x.goalKind === "land") x.progress++;
  });
}

function countSilos(mg: Game, c: Congress, e: EmergencyState): void {
  const credit = Math.ceil((mg.numLandTiles() * SILO_CREDIT_WORLD_PCT) / 100);
  for (const silo of e.goalSilos) {
    if (e.countedSilos.includes(silo.id())) continue;
    if (silo.isActive() && silo.owner().smallID() === e.target) continue;
    const by = silo.isActive() ? silo.owner() : silo.destroyer();
    c.updateEmergency((x) => {
      x.countedSilos.push(silo.id());
      x.progress++;
      if (by !== undefined && x.members.includes(by.smallID())) {
        x.contributions.set(
          by.smallID(),
          (x.contributions.get(by.smallID()) ?? 0) + credit,
        );
      }
    });
  }
}

/** Once a second: the running emergency's progress and end, then the available list. */
export function processEmergencySecond(mg: Game, c: Congress): void {
  const e = c.emergency();
  if (e !== null) {
    if (e.goalKind === "silos") countSilos(mg, c, e);
    const target = mg.playerBySmallID(e.target);
    if (!target.isPlayer() || !target.isAlive() || e.progress >= e.goal) {
      finishEmergency(mg, c, true);
    } else if (mg.ticks() >= e.endTick) {
      finishEmergency(mg, c, false);
    }
  }
  refreshAvailability(mg, c);
}

function rewardOutput(p: Player, seconds: number): void {
  const d = p.domestic();
  if (d === null) return;
  d.grantPoints(
    d.scienceMilliPerSecond() * seconds,
    d.politicalMilliPerSecond() * seconds,
  );
}

/** Spec §9.5: rewards or the target's reward, the aftermath truces and the cooldowns. */
export function finishEmergency(
  mg: Game,
  c: Congress,
  success: boolean,
): void {
  const e = c.emergency();
  if (e === null) return;
  const now = mg.ticks();
  const target = mg.playerBySmallID(e.target);
  const hero = c.emergencyHero();
  if (success) {
    for (const [id, n] of e.contributions) {
      if (n <= 0) continue;
      const p = mg.playerBySmallID(id);
      if (!p.isPlayer()) continue;
      const mult = id === hero ? HERO_MULT : 1;
      rewardOutput(p, REWARD_SECONDS * mult);
      p.congress()?.grant(REWARD_INFLUENCE_MILLI * mult);
    }
    if (target.isPlayer()) {
      if (e.kind === "aggression") {
        c.addResolution({
          resolution: "sanction",
          option: "A",
          targets: [e.target],
          param: null,
          sinceTick: now,
          expires: "next_tally",
          source: "emergency",
        });
      } else if (e.kind === "nuclear") {
        c.addResolution({
          resolution: "arms_embargo",
          option: "A",
          targets: [e.target],
          param: null,
          sinceTick: now,
          expires: now + NUCLEAR_SUCCESS_BAN_TICKS,
          source: "emergency",
        });
      } else {
        target.congress()?.clearInfluence();
      }
    }
  } else if (target.isPlayer()) {
    rewardOutput(target, SURVIVE_SECONDS);
    target.congress()?.grant(SURVIVE_INFLUENCE_MILLI);
    if (e.kind === "hegemony") {
      c.addResolution({
        resolution: "emergency",
        option: "B",
        targets: [e.target],
        param: "hegemony",
        sinceTick: now,
        expires: "next_tally",
        source: "emergency",
      });
    }
  }
  for (const m of e.members) {
    c.addResolution({
      resolution: "truce",
      option: "A",
      targets: [e.target, m],
      param: null,
      sinceTick: now,
      expires: now + AFTERMATH_TRUCE_TICKS,
      source: "emergency",
    });
  }
  c.setEmergency(null);
  c.setGlobalCooldown(now + EMERGENCY_GLOBAL_COOLDOWN_TICKS);
  c.setTargetCooldown(e.target, now + EMERGENCY_TARGET_COOLDOWN_TICKS);
  const heroPlayer = hero === null ? null : mg.playerBySmallID(hero);
  if (!success) {
    announce(mg, "events_display.congress_emergency_failed", e.kind, target);
  } else if (heroPlayer?.isPlayer() && hero !== null) {
    announce(mg, "events_display.congress_emergency_success", e.kind, target, {
      targetID: hero,
    });
  } else {
    announce(
      mg,
      "events_display.congress_emergency_success_nohero",
      e.kind,
      target,
    );
  }
}

/** A nuke, MIRV or orbital strike hit (spec §4.2): the victims' losses and who hit them; the shooter's score. */
export function congressNukeHit(
  mg: Game,
  _c: Congress,
  shooter: Player,
  impacted: ReadonlyMap<Player, number>,
  weapon: NukeWeapon,
): void {
  const now = mg.ticks();
  let victim: Player | null = null;
  let most = -1;
  for (const [p, tiles] of impacted) {
    if (p === shooter) continue;
    const pc = p.congress();
    if (pc !== null) {
      if (tiles > 0) pc.recordLost(now, tiles);
      pc.recordHitBy(shooter.smallID(), now);
    }
    if (tiles > most) {
      most = tiles;
      victim = p;
    }
  }
  const score = nukeScore(weapon);
  if (score === 0 || victim === null || !isLedgerPlayer(victim)) return;
  shooter.congress()?.recordNuke(now, score);
}

/** GameImpl.conquerPlayer: a human's elimination makes its conqueror's aggression emergency available (spec §9.1). */
export function congressElimination(
  mg: Game,
  c: Congress,
  conqueror: Player,
  conquered: Player,
): void {
  if (conquered.type() !== PlayerType.Human || !isLedgerPlayer(conqueror)) {
    return;
  }
  c.noteElimination(conqueror.smallID(), mg.ticks());
}

function announce(
  mg: Game,
  key: string,
  kind: EmergencyKind,
  target: Player | TerraNullius,
  extra: Record<string, string | number> = {},
): void {
  mg.displayMessage(
    key,
    MessageType.CONGRESS,
    null,
    undefined,
    {
      kind,
      ...(target.isPlayer() ? { name: target.displayName() } : {}),
      ...extra,
    },
    undefined,
    target.isPlayer() ? target.id() : undefined,
  );
}
```

- [ ] **Step 4: MIRV와 위성 포격 연결**

`packages/engine/src/execution/MIRVExecution.ts`:
- import 추가: `import { congressNukeHit } from "../congress/Emergencies";`
- `separate()`의 `this.nuke.delete(false);` 앞에:

```ts
    // World congress (spec §9.1): a MIRV scores once, at separation,
    // against its target's owner (its warheads score nothing).
    const congress = this.mg.congress();
    if (congress !== null && this.targetPlayer.isPlayer()) {
      congressNukeHit(
        this.mg,
        congress,
        this.player,
        new Map([[this.targetPlayer, 0]]),
        UnitType.MIRV,
      );
    }
```

`packages/engine/src/strategic/StrikeWaves.ts`:
- import 추가: `import { congressNukeHit } from "../congress/Emergencies";`
- `startOrbitalStrike`의 `processStrike(mg, attacker, s, now);` 뒤에:

```ts
  // World congress (spec §9.1): an orbital strike scores 3 toward the
  // nuclear emergency.
  const congress = mg.congress();
  if (congress !== null) {
    congressNukeHit(mg, congress, attacker, new Map([[target, 0]]), "orbital");
  }
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest tests/congress tests/strategic tests/NationMIRV.test.ts tests/MirvPrice.test.ts --run && npx vitest tests/VanillaDigest.test.ts --run && npm run typecheck && npm run lint`
Expected: 모두 PASS, 오류 없음

- [ ] **Step 6: 커밋**

```bash
npx prettier --write packages/engine/src/congress/Emergencies.ts packages/engine/src/execution/MIRVExecution.ts packages/engine/src/strategic/StrikeWaves.ts tests/congress/Emergencies.test.ts tests/congress/NukeScore.test.ts
git add packages/engine/src/congress/Emergencies.ts packages/engine/src/execution/MIRVExecution.ts packages/engine/src/strategic/StrikeWaves.ts tests/congress/Emergencies.test.ts tests/congress/NukeScore.test.ts
git commit -m "feat(congress): emergencies - availability, convening, votes, goals, rewards, nuke score

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: AI 국가 — 투표와 소집

**Files:**
- Create: `packages/engine/src/execution/nation/NationCongressBehavior.ts`
- Modify: `packages/engine/src/execution/NationExecution.ts` (`tick`에서 한 줄)
- Test: `tests/congress/NationCongress.test.ts`

**Interfaces:**
- Consumes: Task 1 `Congress`(`session`, `canVote`, `available`, `isSeated`, `isSanctioned`, `pair`, `emergency`, `nextSessionTick`), `PlayerCongress.ballot/influenceMilli/lastHitTick`, `CongressVoteExecution`, `ConveneEmergencyExecution`, `RESOLUTION_META`, `AI_EXTRA_CAP`, `AI_RESERVE_PCT`, `AI_CONVENE_DELAY_TICKS`, `AI_CONVENE_MIN_INFLUENCE_MILLI`, `aiVoteDelayTicks`, `CONFLICT_MEMORY_TICKS`, `extraVoteCostMilli`, `MAX_EXTRA_VOTES`, `WAR_PAIR_BUCKETS`, `ledgerBucket`, `ringSum`, `conveneBlock`, `conveneWindowOpen`, `buildingPactType`; Task 3(회기), Task 4·5(효과), Task 6(소집 검증)의 실제 동작; `nationDomesticPlan`, `findRunawayLeader`
- Produces: `NationVote { option; extra }`, `nationCongressTick(mg, player): void`, `nationBallot(mg, c, player, item): NationVote | null`, `affordableExtra(influenceMilli, wanted): number`, `wantsToConvene(mg, player, target, kind): boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/congress/NationCongress.test.ts`:

```ts
import {
  Cell,
  Difficulty,
  Nation,
  PlayerInfo,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { NationExecution } from "@openfront/engine/execution/NationExecution";
import {
  affordableExtra,
  nationBallot,
  nationCongressTick,
} from "@openfront/engine/execution/nation/NationCongressBehavior";
import {
  nationDomesticPlan,
  Personality,
} from "@openfront/engine/execution/nation/NationPersonality";
import { Game, Player } from "@openfront/engine/game/Game";
import { grantGovernment } from "../domestic/util";
import {
  BLUE,
  congressGame,
  congressOf,
  giveInfluence,
  item,
  own,
  RED,
  seatAll,
} from "./util";

/** A nation id whose personality is `p` (personality is a pure function of the id). */
function idWith(p: Personality): string {
  for (let i = 0; i < 500; i++) {
    const id = `nat${i}`;
    if (nationDomesticPlan(id).personality === p) return id;
  }
  throw new Error(`no ${p}`);
}

function nationOf(p: Personality): PlayerInfo {
  const id = idWith(p);
  return new PlayerInfo(id, PlayerType.Nation, null, id);
}

// red x 0-29, blue x 30-59, the nation x 60-89.
async function withNation(
  p: Personality,
  difficulty = Difficulty.Hard,
): Promise<{ game: Game; red: Player; blue: Player; nation: Player }> {
  const info = nationOf(p);
  const game = await congressGame({ difficulty }, [RED, BLUE, info]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  const nation = own(game, info.id, 60, 0, 30, 100);
  game.executeNextTick();
  seatAll(game);
  return { game, red, blue, nation };
}

const ballot = (game: Game, nation: Player, i: ReturnType<typeof item>) =>
  nationBallot(game, congressOf(game), nation, { ...i, voters: 0 });

describe("nation ballots (spec §11.1)", () => {
  test("extra votes: within the difficulty cap and 70% of the influence", () => {
    expect(affordableExtra(1_000_000, 5)).toBe(5);
    expect(affordableExtra(100_000, 5)).toBe(3); // 60 ≤ 70, 100 > 70
    expect(affordableExtra(0, 5)).toBe(0);
    expect(affordableExtra(1_000_000, 0)).toBe(0);
  });

  test("its own case: the favourable side with every extra vote it can afford", async () => {
    const { game, nation } = await withNation("merchant");
    giveInfluence(nation, 1000);
    expect(ballot(game, nation, item("sanction", [nation.smallID()]))).toEqual({
      option: "B",
      extra: 3,
    });
    expect(
      ballot(game, nation, item("protectorate", [nation.smallID()])),
    ).toEqual({ option: "A", extra: 3 });
  });

  test("a truce on itself: duel when winning, truce when losing", async () => {
    const { game, red, nation } = await withNation("conqueror");
    const c = congressOf(game);
    for (let i = 0; i < 5; i++) c.touchPair(nation.smallID(), red.smallID(), game.ticks());
    const truce = item("truce", [red.smallID(), nation.smallID()].sort((a, b) => a - b));
    expect(ballot(game, nation, truce)!.option).toBe("B");
    for (let i = 0; i < 9; i++) c.touchPair(red.smallID(), nation.smallID(), game.ticks());
    expect(ballot(game, nation, truce)!.option).toBe("A");
  });

  test("an ally gets the favourable side, an enemy the other, with half the cap", async () => {
    const { game, red, blue, nation } = await withNation("merchant");
    giveInfluence(nation, 1000);
    nation.createAllianceRequest(red)?.accept();
    expect(ballot(game, nation, item("sanction", [red.smallID()]))).toEqual({
      option: "B",
      extra: 2,
    });
    // blue took land from the nation lately.
    nation.congress()!.recordHitBy(blue.smallID(), game.ticks());
    expect(ballot(game, nation, item("sanction", [blue.smallID()]))).toEqual({
      option: "A",
      extra: 2,
    });
  });

  test("personalities on world rules; nothing spent", async () => {
    const conqueror = await withNation("conqueror");
    expect(ballot(conqueror.game, conqueror.nation, item("war_tax"))).toEqual({
      option: "B",
      extra: 0,
    });
    const merchant = await withNation("merchant");
    expect(ballot(merchant.game, merchant.nation, item("war_tax"))).toEqual({
      option: "A",
      extra: 0,
    });
    const zealot = await withNation("zealot");
    expect(ballot(zealot.game, zealot.nation, item("arms_treaty"))!.option).toBe(
      "B",
    );
    const scholar = await withNation("scholar");
    expect(
      ballot(scholar.game, scholar.nation, item("building_pact", [], "port")),
    ).toBeNull();
    expect(
      ballot(
        scholar.game,
        scholar.nation,
        item("building_pact", [], "research_institute"),
      ),
    ).toEqual({ option: "A", extra: 0 });
  });

  test("its own government and laws", async () => {
    const { game, nation } = await withNation("conqueror");
    grantGovernment(nation, "monarchy");
    expect(
      ballot(game, nation, item("government_resolution", [], "monarchy")),
    ).toEqual({ option: "A", extra: 0 });
  });

  test("emergency votes: the target opposes, a victim supports, Easy abstains", async () => {
    const { game, red, nation } = await withNation("merchant");
    giveInfluence(nation, 1000);
    const e = item("emergency", [red.smallID()], "aggression", "convened");
    nation.congress()!.recordHitBy(red.smallID(), game.ticks());
    expect(ballot(game, nation, e)).toEqual({ option: "A", extra: 2 });
    expect(
      ballot(game, nation, item("emergency", [nation.smallID()], "nuclear")),
    ).toEqual({ option: "B", extra: 3 });
    const easy = await withNation("conqueror", Difficulty.Easy);
    expect(
      ballot(
        easy.game,
        easy.nation,
        item("emergency", [easy.red.smallID()], "aggression", "convened"),
      ),
    ).toBeNull();
  });
});

describe("nations in the congress", () => {
  test("a seated nation votes at its own delay after the session opens", async () => {
    const { game, nation } = await withNation("merchant");
    const c = congressOf(game);
    const s = c.openSession("regular", [item("war_tax")], game.ticks());
    const delay = 10 + ((nation.smallID() * 7) % 70);
    for (let t = 0; t < delay; t++) {
      nationCongressTick(game, nation);
      game.executeNextTick();
    }
    expect(nation.congress()!.ballot(s.id, 0)).toBeNull();
    nationCongressTick(game, nation);
    game.executeNextTick();
    expect(nation.congress()!.ballot(s.id, 0)).toMatchObject({ option: "A" });
  });

  test("a nation convenes only after 20 s, with 80 influence, as a victim", async () => {
    const { game, red, nation } = await withNation("merchant", Difficulty.Medium);
    const c = congressOf(game);
    giveInfluence(nation, 79);
    red.congress()!.recordTaken(game.ticks(), 600);
    nation.congress()!.recordHitBy(red.smallID(), game.ticks());
    const run = (ticks: number) => {
      for (let t = 0; t < ticks; t++) {
        nationCongressTick(game, nation);
        game.executeNextTick();
      }
    };
    run(210);
    expect(c.available()).toHaveLength(1);
    expect(c.session()).toBeNull();
    giveInfluence(nation, 1);
    run(15);
    expect(c.session()?.kind).toBe("emergency");
    expect(c.session()!.items[0].reasonValue).toBe(nation.smallID());
  });

  test("an AI-only congress runs sessions for thousands of ticks without errors", async () => {
    const infos = (["conqueror", "merchant", "scholar", "zealot"] as const).map(
      nationOf,
    );
    const game = await congressGame({}, [RED, ...infos], "big_plains");
    own(game, RED.id, 0, 0, 40, 200);
    const execs = infos.map((info, i) => {
      own(game, info.id, 40 + i * 40, 0, 40, 200);
      const exec = new NationExecution(
        "game_x",
        new Nation(new Cell(60 + i * 40, 100), game.player(info.id).info()),
      );
      exec.init(game);
      return exec;
    });
    game.addExecution(new DomesticExecution());
    // Sessions open at 1,800 and 3,600 and are tallied at 2,100 and 3,900.
    expect(() => {
      for (let t = 0; t < 4000; t++) {
        for (const e of execs) e.tick(game.ticks());
        game.executeNextTick();
      }
    }).not.toThrow();
    const history = congressOf(game).history();
    expect(history.length).toBeGreaterThanOrEqual(4);
    expect(history.some((h) => h.a + h.b >= 2)).toBe(true);
  }, 120_000);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/congress/NationCongress.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine/execution/nation/NationCongressBehavior'`

- [ ] **Step 3: 구현**

`packages/engine/src/execution/nation/NationCongressBehavior.ts`:

```ts
import {
  BallotOption,
  EmergencyKind,
  RESOLUTION_META,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  Difficulty,
  Relation,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  AI_CONVENE_DELAY_TICKS,
  AI_CONVENE_MIN_INFLUENCE_MILLI,
  AI_EXTRA_CAP,
  AI_RESERVE_PCT,
  aiVoteDelayTicks,
  CONFLICT_MEMORY_TICKS,
  extraVoteCostMilli,
  ledgerBucket,
  MAX_EXTRA_VOTES,
  WAR_PAIR_BUCKETS,
} from "@openfront/engine-lib/congress/CongressBalance";
import { buildingPactType } from "@openfront/engine-lib/congress/ResolutionEffects";
import { ringSum } from "@openfront/engine-lib/congress/Ring";
import {
  conveneBlock,
  conveneWindowOpen,
} from "@openfront/engine-lib/congress/Voting";
import type { AgendaItem, Congress } from "../../congress/Congress";
import { CongressVoteExecution } from "../../congress/CongressVoteExecution";
import { ConveneEmergencyExecution } from "../../congress/ConveneEmergencyExecution";
import type { Game, Player } from "../../game/Game";
import { nationDomesticPlan, Personality } from "./NationPersonality";
import { findRunawayLeader } from "./NationUtils";

export interface NationVote {
  option: BallotOption;
  extra: number;
}

const MILITARY: ReadonlySet<UnitType> = new Set([
  UnitType.DefensePost,
  UnitType.MissileSilo,
  UnitType.SAMLauncher,
  UnitType.Airport,
  UnitType.CoastalBattery,
]);
const ECONOMIC: ReadonlySet<UnitType> = new Set([
  UnitType.City,
  UnitType.Port,
  UnitType.Factory,
]);

/**
 * A nation's part in the congress (spec §11), called every tick from
 * NationExecution: its ballots exactly aiVoteDelayTicks after a session
 * opens, and a convening check on its own tick of each second. No state,
 * no PRNG; nations never see the tally (secret ballot).
 */
export function nationCongressTick(mg: Game, player: Player): void {
  const c = mg.congress();
  const pc = player.congress();
  if (c === null || pc === null || !player.isAlive()) return;
  const now = mg.ticks();
  const s = c.session();
  if (
    s !== null &&
    now === s.openTick + aiVoteDelayTicks(player.smallID()) &&
    now < s.closeTick
  ) {
    s.items.forEach((item, index) => {
      if (pc.ballot(s.id, index) !== null || !c.canVote(player, item)) return;
      const vote = nationBallot(mg, c, player, item);
      if (vote === null) return;
      mg.addExecution(
        new CongressVoteExecution(player, s.id, index, vote.option, vote.extra),
      );
    });
  }
  if (now % 10 === player.smallID() % 10) maybeConvene(mg, c, player);
}

/** The most extra votes up to `wanted` whose cost stays within 70% of the influence. */
export function affordableExtra(influenceMilli: number, wanted: number): number {
  const budget = Math.floor((influenceMilli * (100 - AI_RESERVE_PCT)) / 100);
  let k = Math.min(wanted, MAX_EXTRA_VOTES);
  while (k > 0 && extraVoteCostMilli(0, k) > budget) k--;
  return k;
}

function other(o: BallotOption): BallotOption {
  return o === "A" ? "B" : "A";
}

function personality(player: Player): Personality {
  return nationDomesticPlan(player.id()).personality;
}

function isHard(mg: Game): boolean {
  const d = mg.config().gameConfig().difficulty;
  return d === Difficulty.Hard || d === Difficulty.Impossible;
}

/** Land or nukes between us in the last 180 s (spec §11.1 rule 3). */
function isEnemy(mg: Game, c: Congress, me: Player, them: Player): boolean {
  const now = mg.ticks();
  const pair = c.pair(me.smallID(), them.smallID());
  if (pair !== undefined && now - pair.lastTick <= CONFLICT_MEMORY_TICKS) {
    return true;
  }
  const hit = me.congress()?.lastHitTick(them.smallID()) ?? null;
  return hit !== null && now - hit <= CONFLICT_MEMORY_TICKS;
}

/** `them` took land from or nuked me in the last 180 s. */
function isVictimOf(mg: Game, me: Player, them: Player): boolean {
  const hit = me.congress()?.lastHitTick(them.smallID()) ?? null;
  return hit !== null && mg.ticks() - hit <= CONFLICT_MEMORY_TICKS;
}

/** Spec §11.1: the nation's ballot on `item`, or null to abstain. */
export function nationBallot(
  mg: Game,
  c: Congress,
  player: Player,
  item: AgendaItem,
): NationVote | null {
  const pc = player.congress();
  if (pc === null) return null;
  const cap = AI_EXTRA_CAP[mg.config().gameConfig().difficulty];
  const half = Math.ceil(cap / 2);
  const vote = (option: BallotOption | null, wanted: number) =>
    option === null
      ? null
      : { option, extra: affordableExtra(pc.influenceMilli(), wanted) };
  if (item.resolution === "emergency") {
    return emergencyVote(mg, player, item, cap, half, vote);
  }
  const me = player.smallID();
  const favorable = RESOLUTION_META[item.resolution].favorable;
  const targets = item.targets
    .map((id) => mg.playerBySmallID(id))
    .filter((p): p is Player => p.isPlayer());
  // 1. My own case.
  if (item.targets.includes(me)) {
    return vote(selfOption(mg, c, player, item, favorable), cap);
  }
  if (holdsParam(player, item)) return vote("A", 0);
  // 2. An ally's case.
  const ally = targets.find((t) => player.isAlliedWith(t));
  if (ally !== undefined) {
    return vote(item.resolution === "truce" ? "A" : favorable, half);
  }
  // 3. An enemy's case.
  if (
    favorable !== null &&
    targets.some((t) => isEnemy(mg, c, player, t))
  ) {
    return vote(other(favorable), half);
  }
  // 4. The runaway leader (Hard and up).
  if (
    favorable !== null &&
    isHard(mg) &&
    targets.length === 1 &&
    findRunawayLeader(mg) === targets[0] &&
    !player.isFriendly(targets[0])
  ) {
    return vote(other(favorable), 0);
  }
  // 5. Personality.
  return vote(personalityOption(mg, player, item, targets[0] ?? null), 0);
}

function selfOption(
  mg: Game,
  c: Congress,
  player: Player,
  item: AgendaItem,
  favorable: BallotOption | null,
): BallotOption | null {
  if (item.resolution !== "truce") return favorable;
  const otherId = item.targets.find((id) => id !== player.smallID());
  const pair =
    otherId === undefined ? undefined : c.pair(player.smallID(), otherId);
  if (pair === undefined) return "A";
  const b = ledgerBucket(mg.ticks());
  const mine = ringSum(
    player.smallID() === pair.low ? pair.lowTook : pair.highTook,
    b,
    WAR_PAIR_BUCKETS,
  );
  const theirs = ringSum(
    player.smallID() === pair.low ? pair.highTook : pair.lowTook,
    b,
    WAR_PAIR_BUCKETS,
  );
  return mine > theirs ? "B" : "A";
}

/** E5 / E6: my government, or a law I proclaimed, is the parameter. */
function holdsParam(player: Player, item: AgendaItem): boolean {
  const d = player.domestic();
  if (d === null) return false;
  if (item.resolution === "government_resolution") {
    return item.param === d.currentGovernment();
  }
  if (item.resolution === "law_review") {
    const [law, option] = (item.param ?? "").split(":");
    return [...d.proclaimedLaws()].some(([l, o]) => l === law && o === option);
  }
  return false;
}

function techCount(p: Player): number {
  return p.domestic()?.researchedTechs().size ?? 0;
}

function medianTechCount(mg: Game): number {
  const counts = mg
    .players()
    .filter((p) => p.domestic() !== null)
    .map(techCount)
    .sort((a, b) => a - b);
  return counts.length === 0 ? 0 : counts[Math.floor(counts.length / 2)];
}

/** Spec §11.1 rule 5 (the personality table). */
function personalityOption(
  mg: Game,
  player: Player,
  item: AgendaItem,
  target: Player | null,
): BallotOption | null {
  const p = personality(player);
  const relation = target === null ? Relation.Neutral : player.relation(target);
  switch (item.resolution) {
    case "sanction":
      if (p !== "conqueror") return "A";
      return target !== null &&
        target.numTilesOwned() * 2 >= player.numTilesOwned()
        ? "A"
        : "B";
    case "truce":
    case "protectorate":
    case "war_tax":
    case "arms_embargo":
    case "non_proliferation":
      return p === "conqueror" ? "B" : "A";
    case "arms_treaty":
      return p === "conqueror" || p === "zealot" ? "B" : "A";
    case "hegemony_check":
      return "A";
    case "trade_pact":
      if (p === "conqueror") return "B";
      if (
        p === "zealot" &&
        player.domestic()?.proclaimedLaws().get("diplomacy") === "B"
      ) {
        return "B";
      }
      return "A";
    case "building_pact": {
      const type = buildingPactType(item.param);
      if (type === null) return null;
      switch (p) {
        case "conqueror":
          return MILITARY.has(type) ? "A" : ECONOMIC.has(type) ? "B" : null;
        case "merchant":
          return ECONOMIC.has(type) ? "A" : null;
        case "scholar":
          return type === UnitType.ResearchInstitute ? "A" : null;
        case "zealot":
          return type === UnitType.AdminOffice || type === UnitType.DefensePost
            ? "A"
            : null;
      }
      return null;
    }
    case "research_fund":
      return p === "conqueror" || p === "zealot" ? "B" : "A";
    case "tech_pact":
      return techCount(player) < medianTechCount(mg) ? "A" : "B";
    case "government_resolution":
      if (p === "zealot") return "B";
      return p === "merchant" && item.param === "fascism" ? "B" : null;
    case "law_review":
      return p === "conqueror" ? null : "B";
    case "world_government":
      if (p === "merchant" || p === "zealot") {
        return relation >= Relation.Friendly
          ? "A"
          : relation === Relation.Neutral
            ? null
            : "B";
      }
      return "B";
    case "world_heritage":
      if (p === "conqueror" || p === "scholar") return "B";
      if (p === "merchant") return relation >= Relation.Friendly ? "A" : null;
      return "A";
    default:
      return null;
  }
}

/** Spec §11.2. */
function emergencyVote(
  mg: Game,
  player: Player,
  item: AgendaItem,
  cap: number,
  half: number,
  vote: (option: BallotOption | null, wanted: number) => NationVote | null,
): NationVote | null {
  const target = mg.playerBySmallID(item.targets[0]);
  if (!target.isPlayer()) return null;
  if (target === player) return vote("B", cap);
  if (player.isFriendly(target, true)) return vote("B", half);
  if (isVictimOf(mg, player, target)) return vote("A", half);
  if (mg.config().gameConfig().difficulty === Difficulty.Easy) return null;
  const hard = isHard(mg);
  const kind = item.param as EmergencyKind;
  let support = false;
  switch (personality(player)) {
    case "conqueror":
      support = player.sharesBorderWith(target);
      break;
    case "merchant":
      support = hard || player.sharesBorderWith(target);
      break;
    case "scholar":
      support = hard || findRunawayLeader(mg) === target;
      break;
    case "zealot":
      support = kind !== "hegemony" || hard;
      break;
  }
  return support ? vote("A", 0) : null;
}

/** Spec §11.3: who a nation convenes against, if anyone. */
export function wantsToConvene(
  mg: Game,
  player: Player,
  target: Player,
  kind: EmergencyKind,
): boolean {
  if (isVictimOf(mg, player, target)) return true;
  if (!isHard(mg)) return false;
  switch (personality(player)) {
    case "zealot":
      return kind === "nuclear";
    case "merchant":
    case "scholar":
      return kind === "hegemony" && findRunawayLeader(mg) === target;
    case "conqueror":
      return false;
  }
}

function maybeConvene(mg: Game, c: Congress, player: Player): void {
  if (mg.config().gameConfig().difficulty === Difficulty.Easy) return;
  const pc = player.congress();
  if (pc === null || pc.influenceMilli() < AI_CONVENE_MIN_INFLUENCE_MILLI) {
    return;
  }
  const now = mg.ticks();
  const windowOpen = conveneWindowOpen(
    now,
    c.session() !== null,
    c.emergency() !== null,
    c.nextSessionTick(),
  );
  for (const a of c.available()) {
    if (now - a.sinceTick < AI_CONVENE_DELAY_TICKS) continue;
    const target = mg.playerBySmallID(a.target);
    if (!target.isPlayer()) continue;
    const block = conveneBlock({
      available: true,
      windowOpen,
      seated: c.isSeated(player.smallID()),
      isTarget: target === player,
      friendlyToTarget: player.isFriendly(target, true),
      sanctioned: c.isSanctioned(player.smallID()),
      influenceMilli: pc.influenceMilli(),
    });
    if (block !== null) continue;
    if (!wantsToConvene(mg, player, target, a.kind)) continue;
    mg.addExecution(new ConveneEmergencyExecution(player, a.kind, target.id()));
    return;
  }
}
```

`packages/engine/src/execution/NationExecution.ts`:
- import 추가: `import { nationCongressTick } from "./nation/NationCongressBehavior";`
- `tick()`에서 `this.attackBehavior.followUpLandings();` 바로 앞에:

```ts
    // World congress (spec §11): ballots and convening on their own exact
    // ticks; stateless, no PRNG, nothing in a game without the congress.
    nationCongressTick(this.mg, this.player);
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest tests/congress/NationCongress.test.ts --run && npx vitest tests/congress tests/core/snapshot/NationExecutions.test.ts tests/NationGoldPerMinute.test.ts tests/domestic/NationDomestic.test.ts --run && npx vitest tests/VanillaDigest.test.ts --run && npm run typecheck && npm run lint`
Expected: 모두 PASS(내정 게임과 원작 국가는 의회가 없으므로 그대로다)

- [ ] **Step 5: 커밋**

```bash
npx prettier --write packages/engine/src/execution/nation/NationCongressBehavior.ts packages/engine/src/execution/NationExecution.ts tests/congress/NationCongress.test.ts
git add packages/engine/src/execution/nation/NationCongressBehavior.ts packages/engine/src/execution/NationExecution.ts tests/congress/NationCongress.test.ts
git commit -m "feat(congress): nations vote by stake and personality and convene as victims

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: AI 국가 — 결과에 따른 행동

**Files:**
- Modify: `packages/engine/src/execution/nation/NationCongressBehavior.ts` (도우미 3개 추가), `packages/engine/src/execution/utils/AiAttackBehavior.ts`, `packages/engine/src/execution/nation/NationDomesticBehavior.ts` (`updateRecruitTarget`)
- Test: `tests/congress/NationReactions.test.ts`

**Interfaces:**
- Consumes: Task 5 `isProjectCondemned`, `awaitsRatification`; Task 1 `Congress.active/emergency/isEmergencyTarget`; `Player.isTruceWith`
- Produces: `congressSparesTarget(mg, player, other): boolean`, `emergencyTargetFor(mg, player): Player | null`, `congressHoldsFire(mg, player): boolean`(`NationCongressBehavior.ts`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/congress/NationReactions.test.ts`:

```ts
import {
  Difficulty,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { NationAllianceBehavior } from "@openfront/engine/execution/nation/NationAllianceBehavior";
import {
  congressHoldsFire,
  congressSparesTarget,
  emergencyTargetFor,
} from "@openfront/engine/execution/nation/NationCongressBehavior";
import { nationDomesticTick } from "@openfront/engine/execution/nation/NationDomesticBehavior";
import { NationEmojiBehavior } from "@openfront/engine/execution/nation/NationEmojiBehavior";
import {
  nationDomesticPlan,
  Personality,
} from "@openfront/engine/execution/nation/NationPersonality";
import { AiAttackBehavior } from "@openfront/engine/execution/utils/AiAttackBehavior";
import { Game, Player } from "@openfront/engine/game/Game";
import { congressGame, congressOf, enact, runTicks } from "./util";

function idWith(p: Personality): string {
  for (let i = 0; i < 500; i++) {
    const id = `nat${i}`;
    if (nationDomesticPlan(id).personality === p) return id;
  }
  throw new Error(`no ${p}`);
}

/**
 * big_plains in three stripes, weak | attacker | rich, with no unowned land
 * (as tests/AiAttackBehavior.test.ts's juicy setup): Medium nations pick
 * the weakest, so `weak` is the target unless the congress says otherwise.
 */
async function stripes(p: Personality, difficulty = Difficulty.Medium) {
  const id = idWith(p);
  const game = await congressGame({ difficulty }, [
    new PlayerInfo(id, PlayerType.Nation, null, id),
    new PlayerInfo("weak", PlayerType.Human, null, "weak_id"),
    new PlayerInfo("rich", PlayerType.Human, null, "rich_id"),
  ], "big_plains");
  const attacker = game.player(id);
  const weak = game.player("weak_id");
  const rich = game.player("rich_id");
  for (let x = 0; x < game.map().width(); x++) {
    for (let y = 0; y < game.map().height(); y++) {
      const tile = game.ref(x, y);
      if (!game.map().isLand(tile)) continue;
      if (x < 40) weak.conquer(tile);
      else if (x < 60) attacker.conquer(tile);
      else rich.conquer(tile);
    }
  }
  game.executeNextTick();
  attacker.setTroops(5_000_000);
  weak.setTroops(Math.floor(game.config().maxTroops(weak) * 0.5));
  rich.setTroops(Math.floor(game.config().maxTroops(rich) * 0.9));
  const emoji = new NationEmojiBehavior(new PseudoRandom(42), game, attacker);
  const behavior = new AiAttackBehavior(
    new PseudoRandom(42),
    game,
    attacker,
    0,
    0,
    0.2,
    new NationAllianceBehavior(new PseudoRandom(42), game, attacker, emoji),
    emoji,
  );
  return { game, attacker, weak, rich, behavior };
}

function targetsAfterAttack(
  game: Game,
  attacker: Player,
  behavior: AiAttackBehavior,
): (Player | null)[] {
  const before = attacker.outgoingAttacks().length;
  behavior.maybeAttack();
  runTicks(game, 1);
  return attacker
    .outgoingAttacks()
    .slice(before)
    .map((a) => (a.target().isPlayer() ? (a.target() as Player) : null));
}

describe("nations follow the congress (spec §11.4)", () => {
  test("control: a Medium nation attacks the weakest neighbour", async () => {
    const { game, attacker, weak, behavior } = await stripes("merchant");
    expect(targetsAfterAttack(game, attacker, behavior)).toContain(weak);
  });

  test("a truce partner is never picked", async () => {
    const { game, attacker, weak, behavior } = await stripes("merchant");
    enact(game, {
      resolution: "truce",
      targets: [attacker.smallID(), weak.smallID()].sort((a, b) => a - b),
      expires: game.ticks() + 1200,
    });
    expect(congressSparesTarget(game, attacker, weak)).toBe(true);
    expect(targetsAfterAttack(game, attacker, behavior)).not.toContain(weak);
  });

  test("an emergency member hits the target first", async () => {
    const { game, attacker, rich, behavior } = await stripes("merchant");
    congressOf(game).setEmergency({
      kind: "aggression",
      target: rich.smallID(),
      startTick: game.ticks(),
      endTick: game.ticks() + 1500,
      goalKind: "land",
      goal: 300,
      progress: 0,
      members: [attacker.smallID()],
      opposed: [],
      contributions: new Map(),
      goalSilos: [],
      countedSilos: [],
    });
    expect(emergencyTargetFor(game, attacker)).toBe(rich);
    expect(targetsAfterAttack(game, attacker, behavior)).toEqual([rich]);
  });

  test("the emergency target starts nothing and recruits at 100%", async () => {
    const { game, attacker, rich, behavior } = await stripes("conqueror");
    congressOf(game).setEmergency({
      kind: "aggression",
      target: attacker.smallID(),
      startTick: game.ticks(),
      endTick: game.ticks() + 1500,
      goalKind: "land",
      goal: 300,
      progress: 0,
      members: [rich.smallID()],
      opposed: [],
      contributions: new Map(),
      goalSilos: [],
      countedSilos: [],
    });
    expect(congressHoldsFire(game, attacker)).toBe(true);
    expect(targetsAfterAttack(game, attacker, behavior)).toEqual([]);
    nationDomesticTick(game, attacker);
    runTicks(game, 1);
    expect(attacker.domestic()!.recruitTargetPct()).toBe(100);
  });

  test("a war tax keeps a merchant's troops home, not a conqueror's", async () => {
    const merchant = await stripes("merchant");
    enact(merchant.game, { resolution: "war_tax" });
    expect(congressHoldsFire(merchant.game, merchant.attacker)).toBe(true);
    expect(
      targetsAfterAttack(merchant.game, merchant.attacker, merchant.behavior),
    ).toEqual([]);
    const conqueror = await stripes("conqueror");
    enact(conqueror.game, { resolution: "war_tax" });
    expect(congressHoldsFire(conqueror.game, conqueror.attacker)).toBe(false);
  });

  test("a protectorate is attacked only with twice its troops", async () => {
    const { game, attacker, weak } = await stripes("merchant");
    enact(game, { resolution: "protectorate", targets: [weak.smallID()] });
    weak.setTroops(attacker.troops());
    expect(congressSparesTarget(game, attacker, weak)).toBe(true);
    weak.setTroops(Math.floor(attacker.troops() / 2));
    expect(congressSparesTarget(game, attacker, weak)).toBe(false);
  });

  test("Hard nations single out a project only when the congress condemned it", async () => {
    const { game, attacker, weak, rich, behavior } = await stripes(
      "merchant",
      Difficulty.Hard,
    );
    // The juicy target is rich (tests/AiAttackBehavior.test.ts's setup).
    for (const tile of Array.from(rich.tiles()).slice(0, 3)) {
      const city = rich.buildUnit(UnitType.City, tile, {});
      city.increaseLevel();
      city.increaseLevel();
    }
    rich.setTroops(Math.floor(game.config().maxTroops(rich) * 0.3));
    weak.domestic()!.beginVictoryProject("science", 99, 2400);
    const first = targetsAfterAttack(game, attacker, behavior);
    expect(first.length).toBeGreaterThan(0);
    for (const t of first) expect(t).toBe(rich);
    enact(game, {
      resolution: "world_heritage",
      option: "B",
      targets: [weak.smallID()],
      param: "99",
    });
    expect(targetsAfterAttack(game, attacker, behavior)).toContain(weak);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/congress/NationReactions.test.ts --run`
Expected: FAIL — `congressSparesTarget is not a function`

- [ ] **Step 3: 도우미 추가**

`packages/engine/src/execution/nation/NationCongressBehavior.ts` 끝에 더한다:

```ts
/** Spec §11.4: not an attack target now — a truce partner, or a protectorate we don't outnumber two to one. */
export function congressSparesTarget(
  mg: Game,
  player: Player,
  other: Player,
): boolean {
  const c = mg.congress();
  if (c === null) return false;
  if (player.isTruceWith(other)) return true;
  const protectorate = c
    .active()
    .some(
      (r) =>
        r.resolution === "protectorate" &&
        r.option === "A" &&
        r.targets[0] === other.smallID(),
    );
  return protectorate && player.troops() < other.troops() * 2;
}

/** The emergency target `player` (a member) should hit first; null otherwise. */
export function emergencyTargetFor(mg: Game, player: Player): Player | null {
  const e = mg.congress()?.emergency() ?? null;
  if (e === null || !e.members.includes(player.smallID())) return null;
  const target = mg.playerBySmallID(e.target);
  return target.isPlayer() && target.isAlive() ? target : null;
}

/** Spec §11.4: start no attack of our own — as the emergency target, or as a peaceful nation under a war tax. */
export function congressHoldsFire(mg: Game, player: Player): boolean {
  const c = mg.congress();
  if (c === null) return false;
  if (c.isEmergencyTarget(player.smallID())) return true;
  return (
    personality(player) !== "conqueror" &&
    c.active().some((r) => r.resolution === "war_tax" && r.option === "A")
  );
}
```

- [ ] **Step 4: 공격 행동 연결**

`packages/engine/src/execution/utils/AiAttackBehavior.ts`:
- import 추가: `import { awaitsRatification, isProjectCondemned } from "../../congress/WorldGovernment";`, `import { congressHoldsFire, congressSparesTarget, emergencyTargetFor } from "../nation/NationCongressBehavior";`
- `chooseAttack`의 `borderingEnemies` 필터를:

```ts
    const borderingEnemies = borderingPlayers.filter(
      (o) =>
        this.player?.isFriendly(o) === false &&
        !congressSparesTarget(this.game, this.player, o),
    );
```

- 같은 함수의 `const holdFire = this.holdsFireForProject();`를 `const holdFire = this.holdsFireForProject() || congressHoldsFire(this.game, this.player);`로.
- `attackBestTarget`의 맨 앞(`const { difficulty } = …` 뒤, `holdsFireForProject` 검사 앞)에:

```ts
    // World congress (spec §11.4): an emergency member hits the target first.
    const emergencyTarget = emergencyTargetFor(this.game, this.player);
    if (
      emergencyTarget !== null &&
      this.player.sharesBorderWith(emergencyTarget) &&
      this.sendAttack(emergencyTarget, true)
    ) {
      return;
    }
```

- `if (this.holdsFireForProject()) {`를 `if (this.holdsFireForProject() || congressHoldsFire(this.game, this.player)) {`로(주석에 `// World congress: so does the emergency target, and a peaceful nation under a war tax.`).
- `getAttackStrategies`의 `project` 전략의 `enemies.find((enemy) => hasActiveVictoryProject(enemy))`를:

```ts
          enemies.find(
            (enemy) =>
              (hasActiveVictoryProject(enemy) ||
                awaitsRatification(this.game, enemy)) &&
              // World congress (spec §10.3): only a condemned project.
              isProjectCondemned(this.game, enemy),
          ) ?? null,
```

`packages/engine/src/execution/nation/NationDomesticBehavior.ts`의 `updateRecruitTarget`에서 `atWar` 식 끝에 `|| (mg.congress()?.isEmergencyTarget(player.smallID()) ?? false)`를 더한다(주석: `// World congress: the emergency target braces for the coalition.`).

- [ ] **Step 5: 통과 확인**

Run: `npx vitest tests/congress tests/AiAttackBehavior.test.ts tests/AiAttackBehaviorNukedTerritory.test.ts tests/domestic tests/NationGoldPerMinute.test.ts tests/core/snapshot/NationExecutions.test.ts --run && npx vitest tests/VanillaDigest.test.ts --run && npm run typecheck && npm run lint`
Expected: 모두 PASS(의회가 없는 게임에서 `congressSparesTarget`·`congressHoldsFire`는 거짓, `isProjectCondemned`는 참, `awaitsRatification`은 거짓이라 원래 동작 그대로)

- [ ] **Step 6: 커밋**

```bash
npx prettier --write packages/engine/src/execution/nation/NationCongressBehavior.ts packages/engine/src/execution/utils/AiAttackBehavior.ts packages/engine/src/execution/nation/NationDomesticBehavior.ts tests/congress/NationReactions.test.ts
git add packages/engine/src/execution/nation/NationCongressBehavior.ts packages/engine/src/execution/utils/AiAttackBehavior.ts packages/engine/src/execution/nation/NationDomesticBehavior.ts tests/congress/NationReactions.test.ts
git commit -m "feat(congress): nations honour truces, join emergencies, brace as targets, spare unwatched projects

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: 번역 (en, ko)

**Files:**
- Modify: `resources/lang/en.json`, `resources/lang/ko.json` (jq로 병합)
- Test: `tests/congress/CongressI18n.test.ts`

**Interfaces:**
- Produces(엔진·화면 Task가 쓰는 키, 그대로 쓴다):

| 키 | 매개변수 | 쓰는 곳 |
|---|---|---|
| `game_settings.congress` | | 로비 토글·요약 (Task 10) |
| `domestic.screen.congress` | | 다이얼 이름, 서랍 제목 (Task 11) |
| `leaderboard.congress` | | 순위표 칸 (Task 13) |
| `events_display.congress_adopted`, `_target`, `_pair` | `resolution`(id→이름), `option`("A"/"B"→선택지 이름), `a`, `b`, `name`, `target`(←`targetID`) | Task 3 |
| `events_display.congress_tied`, `_target`, `_pair` | `resolution`, `a`, `b`, `name`, `target` | Task 3 |
| `events_display.congress_emergency_available`, `_convened`, `_rejected`, `_started`, `_success`, `_success_nohero`, `_failed` | `kind`(→비상 이름), `name`, `target`(←`targetID`), `a`, `b` | Task 6 |
| `events_display.congress_patent` | `points` | Task 4 |
| `events_display.world_gov_awaiting` | `name` | Task 5 |
| `congress.resolution.<id>.name/a/b/a_effect/b_effect` | | 17개 id 전부 (카드, 서랍, 칩, 이벤트) |
| `congress.emergency.<kind>` | | 비상 이름 |
| `congress.reason.<reason>` | `name`, `target`, `pct`, `ratio`, `count` | 카드 근거 한 줄 |
| `congress.param.tradeShip`, `congress.param.train` | | 무역 협정 대상 |
| `congress.dial.influence` | `value` | 다이얼 캡션 |
| `congress.card.*` | `seconds`, `voted`, `total`, `votes`, `cost`, `option`, `extra`, `a`, `b` | 카드 |
| `congress.toast.adopted`, `congress.toast.tied` | `title`, `option`, `a`, `b` | 결과 배너 |
| `congress.chip.until_project` | | 칩 |
| `congress.band.*` | `kind`, `name`, `goal`, `time`, `cost`, `seconds` | 위쪽 띠 |
| `congress.block.<block>` | `cost`(influence만) | 소집 못 하는 이유 |
| `congress.goal.land`, `congress.goal.silos` | `progress`, `goal` | 비상 목표 |
| `congress.screen.*` | `value`, `rate`, `time`, `seconds`, `count`, `name` | 서랍 |
| `congress.status.<status>` | | 영향력 상태 |
| `congress.banned`, `congress.banned_reason` | | 금지된 유닛 (Task 13) |
| `congress.discounted` | | 연구 화면 (Task 13) |

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/congress/CongressI18n.test.ts`:

```ts
import {
  AGENDA_REASONS,
  EMERGENCY_KINDS,
  INFLUENCE_STATUSES,
  RESOLUTION_IDS,
} from "@openfront/engine-api/congress/CongressTypes";
import fs from "fs";
import path from "path";

function load(lang: string): Record<string, unknown> {
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

function leaves(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix === "" ? k : `${prefix}.${k}`),
  );
}

const KEYS = [
  "game_settings.congress",
  "domestic.screen.congress",
  "leaderboard.congress",
  "events_display.congress_adopted",
  "events_display.congress_adopted_target",
  "events_display.congress_adopted_pair",
  "events_display.congress_tied",
  "events_display.congress_tied_target",
  "events_display.congress_tied_pair",
  "events_display.congress_emergency_available",
  "events_display.congress_emergency_convened",
  "events_display.congress_emergency_rejected",
  "events_display.congress_emergency_started",
  "events_display.congress_emergency_success",
  "events_display.congress_emergency_success_nohero",
  "events_display.congress_emergency_failed",
  "events_display.congress_patent",
  "events_display.world_gov_awaiting",
  "congress.dial.influence",
  "congress.toast.adopted",
  "congress.toast.tied",
  "congress.chip.until_project",
  "congress.banned",
  "congress.banned_reason",
  "congress.discounted",
  "congress.goal.land",
  "congress.goal.silos",
  "congress.param.tradeShip",
  "congress.param.train",
  ...[
    "adopted",
    "b_only",
    "bad",
    "collapsed",
    "extra",
    "good",
    "no_seat",
    "tied",
    "turnout",
    "your_vote",
  ].map((k) => `congress.card.${k}`),
  ...[
    "active",
    "available",
    "available_target",
    "convene",
    "member",
    "target",
    "voting",
  ].map((k) => `congress.band.${k}`),
  ...[
    "unavailable",
    "window",
    "target",
    "seat",
    "friendly",
    "sanctioned",
    "influence",
  ].map((k) => `congress.block.${k}`),
  ...[
    "active",
    "aggressors",
    "available",
    "cooldown",
    "emergencies_left",
    "emergency",
    "history",
    "influence",
    "next_session",
    "none",
    "rate",
    "victims",
    "voting_now",
    "world_gov",
    "world_gov_ratified",
    "world_gov_waiting",
  ].map((k) => `congress.screen.${k}`),
  ...RESOLUTION_IDS.flatMap((id) =>
    ["name", "a", "b", "a_effect", "b_effect"].map(
      (k) => `congress.resolution.${id}.${k}`,
    ),
  ),
  ...EMERGENCY_KINDS.map((k) => `congress.emergency.${k}`),
  ...AGENDA_REASONS.map((r) => `congress.reason.${r}`),
  ...INFLUENCE_STATUSES.map((s) => `congress.status.${s}`),
];

describe("world congress strings", () => {
  test.each(["en", "ko"])("%s has every key", (lang) => {
    const strings = load(lang);
    const missing = KEYS.filter((k) => typeof get(strings, k) !== "string");
    expect(missing).toEqual([]);
  });

  test("ko has exactly en's congress keys", () => {
    expect(leaves(get(load("ko"), "congress")).sort()).toEqual(
      leaves(get(load("en"), "congress")).sort(),
    );
  });

  test("the Korean names are the spec's", () => {
    const ko = load("ko");
    expect(get(ko, "game_settings.congress")).toBe("세계 의회");
    expect(get(ko, "congress.resolution.sanction.name")).toBe("경제 제재");
    expect(get(ko, "congress.resolution.world_government.a")).toBe("승인");
    expect(get(ko, "congress.emergency.nuclear")).toBe("핵 비상");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/congress/CongressI18n.test.ts --run`
Expected: FAIL — 키가 없다.

- [ ] **Step 3: 조각 파일 작성**

`.i18n-congress/en.json`:

```json
{
  "congress": {
    "banned": "🏛 Banned",
    "banned_reason": "A congress resolution forbids this now",
    "band": {
      "active": "🚨 {kind} vs {name} — {goal} · {time}",
      "available": "🚨 {name}: {kind} — an emergency session can be convened",
      "available_target": "🚨 Others can convene a {kind} against you",
      "convene": "Convene · 🗳{cost}",
      "member": "Joined",
      "target": "You are the target",
      "voting": "🚨 Emergency vote: {kind} vs {name} · {seconds}s"
    },
    "block": {
      "friendly": "Not against an ally",
      "influence": "Needs {cost} influence",
      "sanctioned": "Sanctioned nations can't convene",
      "seat": "Only seated nations can convene",
      "target": "You are the target",
      "unavailable": "Not available now",
      "window": "Not while a session votes or just before one"
    },
    "card": {
      "adopted": "Adopted {option} · {a} : {b}",
      "b_only": "You can only oppose",
      "bad": "Bad for you",
      "collapsed": "🏛 {seconds}s · {voted}/{total} voted",
      "extra": "+{votes} · {cost}",
      "good": "Good for you",
      "no_seat": "No seat on this item",
      "tied": "Tied, nothing adopted · {a} : {b}",
      "turnout": "Voted {voted}/{total}",
      "your_vote": "Your vote: {option} +{extra}"
    },
    "chip": {
      "until_project": "until done"
    },
    "dial": {
      "influence": "🗳 {value}"
    },
    "discounted": "Tech pact −30%",
    "emergency": {
      "aggression": "Aggression Emergency",
      "hegemony": "Hegemony Emergency",
      "nuclear": "Nuclear Emergency"
    },
    "goal": {
      "land": "Tiles {progress}/{goal}",
      "silos": "Silos {progress}/{goal}"
    },
    "param": {
      "train": "Trains",
      "tradeShip": "Trade ships"
    },
    "reason": {
      "aggressor": "Top aggressor, last 3 min: {name} ({pct}% of the world)",
      "aggressor_government": "The government of the top aggressor {name}",
      "aggressor_law": "A law of the top aggressor {name}",
      "common_government": "The most common government",
      "convened": "Convened by {name}",
      "global": "A rule for this era",
      "most_built": "Most started since the last session: {count}",
      "project": "{name}'s victory project ({pct}%)",
      "runaway": "{name} holds {ratio}× the runner-up's land",
      "victim": "Hardest hit, last 3 min: {name} lost {pct}%",
      "war_pair": "Biggest war, last 2 min: {name} ↔ {target} ({pct}%)"
    },
    "resolution": {
      "arms_embargo": {
        "a": "Embargo",
        "a_effect": "No new nukes, missiles, satellite, bombing, barrage or silos (stock still fires)",
        "b": "Military aid",
        "b_effect": "Silos and SAMs −30% cost, nukes made 50% faster",
        "name": "Arms Embargo"
      },
      "arms_treaty": {
        "a": "Disarm",
        "a_effect": "Everyone: max troops −15%, gold income +15%",
        "b": "Arms race",
        "b_effect": "Everyone: max troops +15%, gold income −10%",
        "name": "Arms Treaty"
      },
      "building_pact": {
        "a": "Promote",
        "a_effect": "−40% cost, −50% build time",
        "b": "Ban",
        "b_effect": "Nobody builds or upgrades it",
        "name": "Building Pact"
      },
      "emergency": {
        "a": "Yes, join",
        "a_effect": "Members: +20% speed and −20% losses against it",
        "b": "No",
        "b_effect": "No emergency",
        "name": "Emergency Declaration"
      },
      "government_resolution": {
        "a": "Support",
        "a_effect": "Its nations: political power +25%, influence ×1.25",
        "b": "Condemn",
        "b_effect": "Its nations: political power −25%, no influence",
        "name": "Government Resolution"
      },
      "hegemony_check": {
        "a": "Check",
        "a_effect": "Its science and political power −20%; attackers −15% losses",
        "b": "Recognize the leader",
        "b_effect": "Its gold income +15%",
        "name": "Hegemony Check"
      },
      "law_review": {
        "a": "Recommend",
        "a_effect": "Every holder: that law ×1.5",
        "b": "Suspend",
        "b_effect": "Every holder: that law off",
        "name": "Law Review"
      },
      "non_proliferation": {
        "a": "Non-proliferation",
        "a_effect": "Nobody makes or buys new nukes (stock stays)",
        "b": "Development race",
        "b_effect": "Nukes −25% cost, made 50% faster",
        "name": "Non-Proliferation Treaty"
      },
      "protectorate": {
        "a": "Protect",
        "a_effect": "Attackers +40% losses, −20% speed; it defends with −20% losses",
        "b": "Allow partition",
        "b_effect": "Attackers −20% losses",
        "name": "Protectorate"
      },
      "research_fund": {
        "a": "Science first",
        "a_effect": "Science +20%, political power −10%",
        "b": "Politics first",
        "b_effect": "Political power +20%, science −10%",
        "name": "Research Fund"
      },
      "sanction": {
        "a": "Sanction",
        "a_effect": "No trade, gold −20%, no donations, no influence",
        "b": "Look away",
        "b_effect": "Its trade +30%",
        "name": "Economic Sanctions"
      },
      "tech_pact": {
        "a": "Spread",
        "a_effect": "Techs two nations have: −30% cost and time",
        "b": "Patents",
        "b_effect": "First to finish a new tech: +60 s of science",
        "name": "Technology Pact"
      },
      "trade_pact": {
        "a": "Encourage",
        "a_effect": "That trade +50%",
        "b": "Regulate",
        "b_effect": "That trade −50%",
        "name": "Trade Pact"
      },
      "truce": {
        "a": "Truce",
        "a_effect": "120 s: no hostility between the two",
        "b": "Decisive battle",
        "b_effect": "120 s: attacks on each other +25% speed, −15% losses",
        "name": "Truce Resolution"
      },
      "war_tax": {
        "a": "War tax",
        "a_effect": "Aggressors: gold −30%, troop upkeep +50%",
        "b": "War boom",
        "b_effect": "Aggressors: gold +20%",
        "name": "War Tax"
      },
      "world_government": {
        "a": "Approve",
        "a_effect": "Proclamation 60 s ahead and ratified",
        "b": "Reject",
        "b_effect": "Proclamation 60 s back, not ratified",
        "name": "World Government Approval"
      },
      "world_heritage": {
        "a": "Protect",
        "a_effect": "Its institute can't be destroyed until done (capture still can)",
        "b": "Obstruct",
        "b_effect": "Attacks on it +20% speed, −20% losses, not aggression",
        "name": "World Heritage"
      }
    },
    "screen": {
      "active": "Resolutions in force",
      "aggressors": "Top aggressors (3 min)",
      "available": "Can be convened",
      "cooldown": "Next emergency possible in {time}",
      "emergencies_left": "Emergencies left this game: {count}",
      "emergency": "Emergency",
      "history": "Past results",
      "influence": "Influence {value}",
      "next_session": "Next session in {time}",
      "none": "None",
      "rate": "+{rate}/s",
      "victims": "Hardest hit (3 min)",
      "voting_now": "Voting now · {seconds}s left",
      "world_gov": "World government",
      "world_gov_ratified": "{name}: ratified",
      "world_gov_waiting": "{name}: awaiting ratification"
    },
    "status": {
      "aggressing": "At war · 0/s",
      "capped": "Full (300)",
      "peaceful": "At peace",
      "sanctioned": "Sanctioned · 0/s",
      "target": "Emergency target · 0/s"
    },
    "toast": {
      "adopted": "🏛 Adopted: {title} — {option} ({a} : {b})",
      "tied": "🏛 Tied, nothing adopted: {title} ({a} : {b})"
    }
  },
  "domestic": {
    "screen": {
      "congress": "World Congress"
    }
  },
  "events_display": {
    "congress_adopted": "🏛 Adopted: {resolution} — {option} ({a} : {b})",
    "congress_adopted_pair": "🏛 Adopted: {resolution} for {name} ↔ {target} — {option} ({a} : {b})",
    "congress_adopted_target": "🏛 Adopted: {resolution} for {name} — {option} ({a} : {b})",
    "congress_emergency_available": "🚨 {name}: {kind} — an emergency session can be convened",
    "congress_emergency_convened": "🚨 {target} convened an emergency session on {name} ({kind})",
    "congress_emergency_failed": "🚨 {name} held out against the {kind}",
    "congress_emergency_rejected": "🚨 The emergency on {name} was voted down ({a} : {b})",
    "congress_emergency_started": "🚨 {kind} declared against {name} ({a} : {b})",
    "congress_emergency_success": "🚨 The {kind} against {name} succeeded. Hero: {target}",
    "congress_emergency_success_nohero": "🚨 The {kind} against {name} succeeded",
    "congress_patent": "🏛 Patent: +{points} science for a first discovery",
    "congress_tied": "🏛 Tied, nothing adopted: {resolution} ({a} : {b})",
    "congress_tied_pair": "🏛 Tied, nothing adopted: {resolution} for {name} ↔ {target} ({a} : {b})",
    "congress_tied_target": "🏛 Tied, nothing adopted: {resolution} for {name} ({a} : {b})",
    "world_gov_awaiting": "{name}'s world government is proclaimed and awaits the congress's ratification"
  },
  "game_settings": {
    "congress": "World Congress"
  },
  "leaderboard": {
    "congress": "Congress"
  }
}
```

`.i18n-congress/ko.json`:

```json
{
  "congress": {
    "banned": "🏛 금지됨",
    "banned_reason": "의회 결의로 지금은 금지됩니다",
    "band": {
      "active": "🚨 {kind} vs {name} — {goal} · {time}",
      "available": "🚨 {name}: {kind} — 긴급 회의를 소집할 수 있습니다",
      "available_target": "🚨 다른 나라가 당신에 대한 {kind}를 소집할 수 있습니다",
      "convene": "소집 · 🗳{cost}",
      "member": "참전 중",
      "target": "당신이 대상입니다",
      "voting": "🚨 긴급 회의: {kind} vs {name} · {seconds}초"
    },
    "block": {
      "friendly": "동맹에게는 소집할 수 없습니다",
      "influence": "영향력 {cost}가 필요합니다",
      "sanctioned": "제재 중에는 소집할 수 없습니다",
      "seat": "의석이 있는 나라만 소집할 수 있습니다",
      "target": "당신이 대상입니다",
      "unavailable": "지금은 소집할 수 없습니다",
      "window": "회기 중이거나 곧 회기가 열립니다"
    },
    "card": {
      "adopted": "채택 {option} · {a} : {b}",
      "b_only": "반대만 할 수 있습니다",
      "bad": "내게 불리",
      "collapsed": "🏛 {seconds}초 · {voted}/{total} 투표함",
      "extra": "+{votes} · {cost}",
      "good": "내게 유리",
      "no_seat": "이 안건에 의석 없음",
      "tied": "동점 부결 · {a} : {b}",
      "turnout": "투표 {voted}/{total}",
      "your_vote": "내 표: {option} +{extra}"
    },
    "chip": {
      "until_project": "끝날 때까지"
    },
    "dial": {
      "influence": "🗳 {value}"
    },
    "discounted": "기술 협정 −30%",
    "emergency": {
      "aggression": "침략 비상",
      "hegemony": "패권 비상",
      "nuclear": "핵 비상"
    },
    "goal": {
      "land": "땅 {progress}/{goal}",
      "silos": "사일로 {progress}/{goal}"
    },
    "param": {
      "train": "기차",
      "tradeShip": "무역선"
    },
    "reason": {
      "aggressor": "최근 3분 침략 1위: {name} (세계 땅 {pct}%)",
      "aggressor_government": "침략 1위 {name}의 정부",
      "aggressor_law": "침략 1위 {name}의 법",
      "common_government": "가장 많은 나라의 정부",
      "convened": "소집: {name}",
      "global": "이번 시대의 규칙",
      "most_built": "지난 회기 이후 최다 착공: {count}",
      "project": "{name}의 승리 프로젝트 ({pct}%)",
      "runaway": "땅 1위 {name}: 2위의 {ratio}배",
      "victim": "최근 3분 피해 1위: {name} {pct}% 잃음",
      "war_pair": "최근 2분 최대 전쟁: {name} ↔ {target} ({pct}%)"
    },
    "resolution": {
      "arms_embargo": {
        "a": "금수",
        "a_effect": "새 핵·미사일·위성·폭격·해안 포격·발사대 금지 (비축은 발사 가능)",
        "b": "군사 원조",
        "b_effect": "발사대·SAM 건설비 −30%, 핵 제조 50% 빠름",
        "name": "무기 금수"
      },
      "arms_treaty": {
        "a": "군축",
        "a_effect": "모두 최대 병력 −15%, 금 수입 +15%",
        "b": "군비 경쟁",
        "b_effect": "모두 최대 병력 +15%, 금 수입 −10%",
        "name": "군비 조약"
      },
      "building_pact": {
        "a": "진흥",
        "a_effect": "건설비 −40%, 건설 시간 −50%",
        "b": "금지",
        "b_effect": "아무도 짓거나 레벨업할 수 없음",
        "name": "건설 협정"
      },
      "emergency": {
        "a": "찬성·참전",
        "a_effect": "회원: 대상 상대로 속도 +20%, 손실 −20%",
        "b": "반대",
        "b_effect": "비상 없음",
        "name": "비상 선포"
      },
      "government_resolution": {
        "a": "지지",
        "a_effect": "그 정부의 나라: 정치력 +25%, 영향력 ×1.25",
        "b": "규탄",
        "b_effect": "그 정부의 나라: 정치력 −25%, 영향력 0",
        "name": "정부 결의"
      },
      "hegemony_check": {
        "a": "견제",
        "a_effect": "과학력·정치력 −20%, 공격하는 나라 손실 −15%",
        "b": "지도국 인정",
        "b_effect": "금 수입 +15%",
        "name": "패권 견제"
      },
      "law_review": {
        "a": "권장",
        "a_effect": "그 법을 가진 나라: 효과 ×1.5",
        "b": "효력 정지",
        "b_effect": "그 법을 가진 나라: 효과 꺼짐",
        "name": "법 심사"
      },
      "non_proliferation": {
        "a": "비확산",
        "a_effect": "아무도 새 핵을 만들거나 살 수 없음 (비축 유지)",
        "b": "개발 경쟁",
        "b_effect": "핵 비용 −25%, 제조 50% 빠름",
        "name": "핵 비확산 조약"
      },
      "protectorate": {
        "a": "보호국",
        "a_effect": "공격하는 나라 손실 +40%, 속도 −20%, 방어 손실 −20%",
        "b": "분할 승인",
        "b_effect": "공격하는 나라 손실 −20%",
        "name": "보호국 지정"
      },
      "research_fund": {
        "a": "과학 우선",
        "a_effect": "과학력 +20%, 정치력 −10%",
        "b": "정치 우선",
        "b_effect": "정치력 +20%, 과학력 −10%",
        "name": "연구 기금"
      },
      "sanction": {
        "a": "제재",
        "a_effect": "무역 금지, 금 −20%, 기부 못 받음, 영향력 0",
        "b": "묵인",
        "b_effect": "무역 수익 +30%",
        "name": "경제 제재"
      },
      "tech_pact": {
        "a": "기술 확산",
        "a_effect": "2개국 이상 완료한 기술 비용·시간 −30%",
        "b": "선도국 특허",
        "b_effect": "새 기술을 처음 완료하면 과학력 60초분",
        "name": "기술 협정"
      },
      "trade_pact": {
        "a": "장려",
        "a_effect": "그 무역 수익 +50%",
        "b": "규제",
        "b_effect": "그 무역 수익 −50%",
        "name": "무역 협정"
      },
      "truce": {
        "a": "휴전",
        "a_effect": "120초 동안 서로 적대 행위 불가",
        "b": "결전",
        "b_effect": "120초 동안 서로 공격 속도 +25%, 손실 −15%",
        "name": "휴전 결의"
      },
      "war_tax": {
        "a": "전쟁세",
        "a_effect": "먼저 공격 중이면 금 −30%, 유지비 +50%",
        "b": "전시 특수",
        "b_effect": "먼저 공격 중이면 금 +20%",
        "name": "전쟁세"
      },
      "world_government": {
        "a": "승인",
        "a_effect": "선포 60초 앞당김, 비준",
        "b": "거부",
        "b_effect": "선포 60초 늦춤, 비준 안 됨",
        "name": "세계 정부 승인"
      },
      "world_heritage": {
        "a": "보호",
        "a_effect": "끝날 때까지 연구소 파괴 불가 (점령은 가능)",
        "b": "저지",
        "b_effect": "그 나라 공격 속도 +20%, 손실 −20%, 침략 아님",
        "name": "세계 유산"
      }
    },
    "screen": {
      "active": "현행 결의",
      "aggressors": "침략 순위 (3분)",
      "available": "소집 가능",
      "cooldown": "다음 비상까지 {time}",
      "emergencies_left": "이번 판 남은 비상: {count}",
      "emergency": "비상",
      "history": "지난 결과",
      "influence": "영향력 {value}",
      "next_session": "다음 회기까지 {time}",
      "none": "없음",
      "rate": "+{rate}/초",
      "victims": "피해 순위 (3분)",
      "voting_now": "투표 중 · {seconds}초 남음",
      "world_gov": "세계 정부",
      "world_gov_ratified": "{name}: 비준됨",
      "world_gov_waiting": "{name}: 비준 대기"
    },
    "status": {
      "aggressing": "전쟁 중 · 0/초",
      "capped": "상한 (300)",
      "peaceful": "평화 중",
      "sanctioned": "제재 중 · 0/초",
      "target": "비상 대상 · 0/초"
    },
    "toast": {
      "adopted": "🏛 채택: {title} — {option} ({a} : {b})",
      "tied": "🏛 동점 부결: {title} ({a} : {b})"
    }
  },
  "domestic": {
    "screen": {
      "congress": "세계 의회"
    }
  },
  "events_display": {
    "congress_adopted": "🏛 채택: {resolution} — {option} ({a} : {b})",
    "congress_adopted_pair": "🏛 채택: {name} ↔ {target} {resolution} — {option} ({a} : {b})",
    "congress_adopted_target": "🏛 채택: {name} {resolution} — {option} ({a} : {b})",
    "congress_emergency_available": "🚨 {name}: {kind} — 긴급 회의를 소집할 수 있습니다",
    "congress_emergency_convened": "🚨 {target}이(가) {name}에 대한 긴급 회의를 소집했습니다 ({kind})",
    "congress_emergency_failed": "🚨 {name}이(가) {kind}을(를) 버텨 냈습니다",
    "congress_emergency_rejected": "🚨 {name}에 대한 비상이 부결되었습니다 ({a} : {b})",
    "congress_emergency_started": "🚨 {name}에 대한 {kind} 선포 ({a} : {b})",
    "congress_emergency_success": "🚨 {name}에 대한 {kind} 성공! 영웅: {target}",
    "congress_emergency_success_nohero": "🚨 {name}에 대한 {kind} 성공",
    "congress_patent": "🏛 특허: 첫 발견으로 과학력 +{points}",
    "congress_tied": "🏛 동점 부결: {resolution} ({a} : {b})",
    "congress_tied_pair": "🏛 동점 부결: {name} ↔ {target} {resolution} ({a} : {b})",
    "congress_tied_target": "🏛 동점 부결: {name} {resolution} ({a} : {b})",
    "world_gov_awaiting": "{name}의 세계 정부 선포 완료 — 의회의 비준을 기다립니다"
  },
  "game_settings": {
    "congress": "세계 의회"
  },
  "leaderboard": {
    "congress": "의회"
  }
}
```

- [ ] **Step 4: 병합**

en.json은 키 정렬을 유지해야 하므로 `jq -S`로, ko.json은 순서를 건드리지 않고 병합한다(전략 무기 계획과 같은 방법).

```bash
jq -S --slurpfile frag .i18n-congress/en.json '. * $frag[0]' resources/lang/en.json > .i18n-congress/en.out && mv .i18n-congress/en.out resources/lang/en.json
jq --slurpfile frag .i18n-congress/ko.json '. * $frag[0]' resources/lang/ko.json > .i18n-congress/ko.out && mv .i18n-congress/ko.out resources/lang/ko.json
rm -rf .i18n-congress
npx prettier --write resources/lang/en.json resources/lang/ko.json
git diff --stat resources/lang
```

Expected: en.json, ko.json에 추가만 있다(기존 키 변경 없음).

- [ ] **Step 5: 통과 확인**

Run: `npx vitest tests/congress/CongressI18n.test.ts tests/domestic/I18n.test.ts tests/strategic/StrategicI18n.test.ts tests/warfare/WarfareI18n.test.ts tests/EnJsonSorted.test.ts --run`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add resources/lang/en.json resources/lang/ko.json tests/congress/CongressI18n.test.ts
git commit -m "feat(congress): English and Korean strings for the world congress

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 10: 로비 토글과 설정 요약

**Files:**
- Modify: `src/client/SinglePlayerModal.ts`, `src/client/HostLobbyModal.ts`, `src/client/utilities/LobbySettingsSummary.ts`
- Test: `tests/client/CongressLobby.test.ts`

**Interfaces:**
- Consumes: Task 1 `GameConfig.congress`, Task 9 `game_settings.congress`
- Produces: 두 모달의 `congress` 상태(내정 모드를 켜면 참, 끄면 거짓), 내정 모드이고 FFA일 때만 보이는 토글(`labelKey: "game_settings.congress"`), 혼자 하기 시작 설정의 `congress: true`(내정 모드 + FFA + 켬일 때만), 호스트 `update_game_config`의 `congress: domesticMode && congress`, 참가 화면 요약 항목

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/CongressLobby.test.ts`는 `tests/client/StrategicLobby.test.ts`의 `vi.mock` 네 개와 import를 그대로 쓰고, 본문을 다음으로 한다:

```ts
const toggle = (labelKey: string, checked: boolean) =>
  new CustomEvent("option-toggle-changed", {
    detail: { labelKey, checked },
  });

describe("the world congress in the lobby", () => {
  it("solo: comes on with domestic mode, can be turned off, and is FFA only", async () => {
    const modal = document.createElement("single-player-modal") as any;
    const configs: any[] = [];
    modal.addEventListener("join-lobby", (e: Event) =>
      configs.push((e as CustomEvent).detail.gameStartInfo.config),
    );
    await modal.startGame();
    expect(configs[0].congress).toBeUndefined();

    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.domestic_mode", true),
    );
    expect(modal.congress).toBe(true);
    await modal.startGame();
    expect(configs[1]).toMatchObject({ domesticMode: true, congress: true });

    modal.handleConfigOptionToggleChanged(toggle("game_settings.congress", false));
    await modal.startGame();
    expect(configs[2].congress).toBeUndefined();

    modal.handleConfigOptionToggleChanged(toggle("game_settings.congress", true));
    modal.gameMode = "Team";
    await modal.startGame();
    expect(configs[3].congress).toBeUndefined();

    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.domestic_mode", false),
    );
    expect(modal.congress).toBe(false);
  });

  it("host: domestic mode turns it on, the toggle updates the lobby", () => {
    const modal = new HostLobbyModal() as any;
    const putGameConfig = vi.fn();
    modal.putGameConfig = putGameConfig;
    modal.handleConfigOptionToggleChanged(
      toggle("game_settings.domestic_mode", true),
    );
    expect(modal.congress).toBe(true);
    modal.handleConfigOptionToggleChanged(toggle("game_settings.congress", false));
    expect(modal.congress).toBe(false);
    expect(putGameConfig).toHaveBeenCalledTimes(2);
  });

  it("the lobby summary lists it only when on with domestic mode", () => {
    const label = (c: ReturnType<typeof testGameConfig>) =>
      notableLobbySettings(c, null).map((i) => i.label);
    expect(
      label(testGameConfig({ domesticMode: true, congress: true })),
    ).toContain("game_settings.congress");
    expect(label(testGameConfig({ congress: true }))).not.toContain(
      "game_settings.congress",
    );
    expect(label(testGameConfig())).not.toContain("game_settings.congress");
  });
});
```

(`GameMode.Team`의 값은 `"Team"`이다. 두 모달은 이미 `GameMode`를 import한다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/CongressLobby.test.ts --run`
Expected: FAIL — `expected undefined to be true`(모달에 상태가 없다)

- [ ] **Step 3: 혼자 하기 모달**

`src/client/SinglePlayerModal.ts` — 전략 무기 줄마다 바로 뒤에 같은 모양으로 더한다:
- `DEFAULT_OPTIONS`의 `strategicWeapons: false,` 뒤에 `congress: false,`
- `@state() private strategicWeapons…;` 뒤에 `@state() private congress: boolean = DEFAULT_OPTIONS.congress;`
- `toggles` 목록의 `game_settings.domestic_mode` 항목 바로 뒤에:

```ts
                  // World congress (spec §3.1): only with domestic mode, FFA.
                  ...(this.domesticMode && this.gameMode === GameMode.FFA
                    ? [
                        {
                          labelKey: "game_settings.congress",
                          checked: this.congress,
                        },
                      ]
                    : []),
```

- 바뀜 확인의 `this.strategicWeapons !== DEFAULT_OPTIONS.strategicWeapons ||` 뒤에 `this.congress !== DEFAULT_OPTIONS.congress ||`
- 초기화의 `this.strategicWeapons = DEFAULT_OPTIONS.strategicWeapons;` 뒤에 `this.congress = DEFAULT_OPTIONS.congress;`
- `handleConfigOptionToggleChanged`의 `case "game_settings.domestic_mode":` 블록에서 `this.domesticMode = checked;` 뒤에 `this.congress = checked;`(켜면 같이 켜지고 끄면 같이 꺼진다), 그리고 `case "game_settings.strategic_weapons":` 블록 뒤에 `case "game_settings.congress": this.congress = checked; break;`
- `startGame` 설정의 `...(this.strategicWeapons ? { strategicWeapons: true } : {}),` 뒤에:

```ts
                ...(this.domesticMode &&
                this.congress &&
                this.gameMode === GameMode.FFA
                  ? { congress: true }
                  : {}),
```

- [ ] **Step 4: 방 만들기 모달**

`src/client/HostLobbyModal.ts` — 같은 방식으로:
- `@state() private strategicWeapons: boolean = false;` 뒤에 `@state() private congress: boolean = false;`
- `toggles`의 내정 모드 항목 뒤에 Step 3과 같은 조건부 항목
- 초기화의 `this.strategicWeapons = false;` 뒤에 `this.congress = false;`
- `handleConfigOptionToggleChanged`의 내정 모드 블록에서 `this.domesticMode = checked;` 뒤에 `this.congress = checked;`, 전략 무기 블록 뒤에 `case "game_settings.congress": this.congress = checked; this.putGameConfig(); break;`
- `putGameConfig`의 `strategicWeapons: this.strategicWeapons,` 뒤에 `congress: this.domesticMode && this.congress,`

- [ ] **Step 5: 참가 화면 요약**

`src/client/utilities/LobbySettingsSummary.ts`의 `if (c.strategicWeapons)` 블록 뒤에:

```ts
  if (c.domesticMode && c.congress)
    items.push({
      label: translateText("game_settings.congress"),
      value: enabled,
    });
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/client/CongressLobby.test.ts tests/client/StrategicLobby.test.ts tests/client/WarfareLobby.test.ts tests/client/DomesticLobby.test.ts tests/client/HostLobbyModal.test.ts tests/client/HostLobbyModalTeamCount.test.ts tests/LayerBoundaries.test.ts --run && npm run typecheck`
Expected: 모두 PASS, typecheck 오류 없음

- [ ] **Step 7: 커밋**

```bash
npx prettier --write src/client/SinglePlayerModal.ts src/client/HostLobbyModal.ts src/client/utilities/LobbySettingsSummary.ts tests/client/CongressLobby.test.ts
git add src/client/SinglePlayerModal.ts src/client/HostLobbyModal.ts src/client/utilities/LobbySettingsSummary.ts tests/client/CongressLobby.test.ts
git commit -m "feat(congress): World Congress toggle with domestic mode in solo and host lobbies

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 11: 화면 I — 화면 모델, 🏛 다이얼, 서랍의 의회 화면

**Files:**
- Create: `src/client/hud/congress/CongressModel.ts`, `src/client/hud/congress/CongressScreen.ts`
- Modify: `src/client/hud/domestic/Dial.ts` (색 `congress`), `src/client/hud/domestic/DomesticEvents.ts` (화면 `"congress"`), `src/client/hud/domestic/DomesticDials.ts`, `src/client/hud/domestic/DomesticPanel.ts`
- Modify (test): `tests/client/DomesticDials.test.ts` (가짜 config에 `congress: () => false`), `tests/client/DomesticDrawer.test.ts` (`content`에 `congress` 키)
- Test: `tests/client/CongressFixture.ts`(공용 자료), `tests/client/CongressModel.test.ts`, `tests/client/CongressDial.test.ts`, `tests/client/CongressScreen.test.ts`

**Interfaces:**
- Consumes: Task 1 `CongressData`, `PlayerCongressData`, `RESOLUTION_META`, `GameView.congressData()`, `PlayerView.congressData()`, `SendConveneEmergencyIntentEvent`, 수치(`SESSION_INTERVAL_TICKS`, `SESSION_NOTICE_TICKS`, `VOTING_TICKS`, `MAX_EXTRA_VOTES`, `extraVoteCost`, `CONVENE_COST_MILLI`), `conveneBlock`, `conveneWindowOpen`; Task 9 키(테스트는 `translateText`를 가짜로 바꾸므로 키 이름만 쓴다)
- Produces (Task 12·13이 쓴다): `src/client/hud/congress/CongressModel.ts`의 `Translate`, `CongressViewer`, `viewerOf(game)`, `nameOf(game, smallID)`, `ticksToSeconds`, `formatClock`, `CongressDialState`, `CongressDialModel`, `congressDial(data, viewer, now)`, `isTargeted(data, smallID)`, `isSanctioned(data, smallID)`, `conveneState(data, viewer, kind, target, now)`, `CONVENE_COST`(50), `remainingTicks(r, data, now)`, `ChipModel`, `resolutionChips(data, smallID, now, max?)`, `CardModel`, `cardModels(data, viewer)`, `ExtraChip`, `extraChips(myVote, influence)`, `resultKey`, `newResults(prev, next)`, `optionLabel`, `subjectText`, `titleText`, `reasonText`, `goalText`, `FLAG_ICONS`, `congressFlags(data, smallID)`, `flagIcons(mask)`; `renderCongressScreen(ctx)`와 `CongressScreenContext`; 다이얼 `data-dial="congress"`(상태 `data-state`: idle/soon/voting, 배지 `data-dial-badge`: `convene`/`target`/`vote`, 캡션 `data-congress-influence`); 서랍 화면 `data-screen="congress"`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/CongressFixture.ts` (테스트 파일이 아니라 공용 자료라 이름에 `.test`가 없다; 다른 테스트 파일을 import하면 그 파일의 테스트가 다시 등록되므로 공용 자료는 여기 둔다):

```ts
import { CongressData } from "@openfront/engine-api/congress/CongressTypes";

/** A congress with seats 1-3 and nothing going on; the next session at tick 1800. */
export const EMPTY: CongressData = {
  nextSessionTick: 1800,
  session: null,
  seats: [1, 2, 3],
  active: [],
  emergency: null,
  available: [],
  cooldownUntilTick: 0,
  emergenciesLeft: 3,
  history: [],
  discountedTechs: [],
  aggressors: [],
  victims: [],
  verdicts: [],
};
```

`tests/client/CongressModel.test.ts`:

```ts
import {
  CongressData,
  PlayerCongressData,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  cardModels,
  CongressViewer,
  congressDial,
  congressFlags,
  conveneState,
  extraChips,
  flagIcons,
  formatClock,
  newResults,
  reasonText,
  remainingTicks,
  resolutionChips,
  titleText,
} from "../../src/client/hud/congress/CongressModel";
import { EMPTY } from "./CongressFixture";

const ME: PlayerCongressData = {
  influence: 120,
  influencePerSec: 0.45,
  status: "peaceful",
  ballots: [],
};

function viewer(
  data: Partial<PlayerCongressData> = {},
  friends: number[] = [],
): CongressViewer {
  return {
    smallID: 1,
    alive: true,
    data: { ...ME, ...data },
    friendlyTo: (id) => friends.includes(id),
  };
}

const t = (key: string, p?: Record<string, string | number>) =>
  p === undefined ? `[${key}]` : `[${key}:${JSON.stringify(p)}]`;
const names: Record<number, string> = { 1: "me", 2: "jiho", 3: "seoyeon" };
const nameOf = (id: number) => names[id] ?? "?";

describe("the congress dial", () => {
  test("idle: fills toward the next session; soon: gold for the last 20 s", () => {
    expect(congressDial(EMPTY, viewer(), 900)).toMatchObject({
      state: "idle",
      progress: 0.5,
      secondsLeft: 90,
      influence: 120,
      earning: true,
    });
    expect(congressDial(EMPTY, viewer(), 1650).state).toBe("soon");
    expect(congressDial(EMPTY, viewer({ status: "aggressing" }), 0).earning).toBe(
      false,
    );
  });

  test("voting: time left and the items I haven't voted on", () => {
    const data: CongressData = {
      ...EMPTY,
      session: {
        id: 4,
        kind: "regular",
        openTick: 1800,
        closeTick: 2100,
        items: [
          {
            resolution: "sanction",
            targets: [2],
            param: null,
            reason: "aggressor",
            reasonValue: 2.1,
            voters: 3,
          },
          {
            resolution: "research_fund",
            targets: [],
            param: null,
            reason: "global",
            reasonValue: 0,
            voters: 1,
          },
        ],
      },
    };
    const v = viewer({
      ballots: [{ sessionId: 4, item: 0, option: "A", extra: 2 }],
    });
    expect(congressDial(data, v, 1950)).toMatchObject({
      state: "voting",
      progress: 0.5,
      secondsLeft: 15,
      unvoted: 1,
    });
  });

  test("badges: a harmful resolution on me, an emergency I can convene", () => {
    const sanctioned: CongressData = {
      ...EMPTY,
      active: [
        {
          resolution: "sanction",
          option: "A",
          targets: [1],
          param: null,
          sinceTick: 0,
          expires: "next_tally",
        },
      ],
    };
    expect(congressDial(sanctioned, viewer(), 0).targeted).toBe(true);
    const available: CongressData = {
      ...EMPTY,
      available: [{ kind: "nuclear", target: 2, sinceTick: 0 }],
    };
    expect(congressDial(available, viewer(), 0).canConvene).toBe(true);
    expect(congressDial(available, viewer({ influence: 49 }), 0).canConvene).toBe(
      false,
    );
  });
});

describe("convening from the client", () => {
  const data: CongressData = {
    ...EMPTY,
    available: [{ kind: "aggression", target: 2, sinceTick: 0 }],
  };
  test("mirrors the engine's checks", () => {
    expect(conveneState(data, viewer(), "aggression", 2, 0)).toBeNull();
    expect(conveneState(data, viewer(), "nuclear", 2, 0)).toBe("unavailable");
    expect(conveneState(data, viewer({}, [2]), "aggression", 2, 0)).toBe(
      "friendly",
    );
    expect(conveneState(data, viewer({ influence: 10 }), "aggression", 2, 0)).toBe(
      "influence",
    );
    expect(conveneState(data, viewer(), "aggression", 2, 1600)).toBe("window");
    expect(
      conveneState({ ...data, seats: [2, 3] }, viewer(), "aggression", 2, 0),
    ).toBe("seat");
  });
});

describe("resolutions in force", () => {
  const r = (expires: number | "next_tally" | "project_end", targets: number[] = []) => ({
    resolution: "war_tax" as const,
    option: "A" as const,
    targets,
    param: null,
    sinceTick: 0,
    expires,
  });
  test("time left: a tick, the next tally, or the project's end", () => {
    expect(remainingTicks(r(500), EMPTY, 200)).toBe(300);
    expect(remainingTicks(r("next_tally"), EMPTY, 200)).toBe(1900);
    expect(remainingTicks(r("project_end"), EMPTY, 200)).toBeNull();
    const voting: CongressData = {
      ...EMPTY,
      nextSessionTick: 3600,
      session: { id: 1, kind: "regular", openTick: 1800, closeTick: 2100, items: [] },
    };
    expect(remainingTicks(r("next_tally"), voting, 2000)).toBe(100);
  });

  test("chips: mine first, then world rules, then others; at most three", () => {
    const data: CongressData = {
      ...EMPTY,
      active: [r("next_tally", [2]), r("next_tally"), r(900, [1]), r("next_tally", [3])],
    };
    expect(
      resolutionChips(data, 1, 0).map((c) => [c.mine, c.targets]),
    ).toEqual([
      [true, [1]],
      [false, []],
      [false, [2]],
    ]);
  });
});

describe("vote cards", () => {
  const data: CongressData = {
    ...EMPTY,
    seats: [2, 3],
    session: {
      id: 9,
      kind: "emergency",
      openTick: 100,
      closeTick: 300,
      items: [
        {
          resolution: "emergency",
          targets: [1],
          param: "nuclear",
          reason: "convened",
          reasonValue: 2,
          voters: 1,
        },
      ],
    },
  };
  test("the target votes though unseated, may only oppose, and sees which side is good for it", () => {
    const [card] = cardModels(data, viewer());
    expect(card).toEqual({
      sessionId: 9,
      index: 0,
      kind: "emergency",
      item: data.session!.items[0],
      closeTick: 300,
      eligible: true,
      bOnly: true,
      myVote: null,
      favorable: "B",
      turnout: { voted: 1, total: 3 },
    });
  });

  test("extra-vote chips cost what the raise costs and switch off past my influence", () => {
    expect(extraChips(null, 500)).toEqual([]);
    expect(
      extraChips({ sessionId: 1, item: 0, option: "A", extra: 1 }, 50),
    ).toEqual([
      { extra: 2, cost: 20, affordable: true },
      { extra: 3, cost: 50, affordable: true },
      { extra: 4, cost: 90, affordable: false },
      { extra: 5, cost: 140, affordable: false },
    ]);
  });
});

describe("text", () => {
  test("titles name targets or parameters", () => {
    const item = (resolution: string, targets: number[], param: string | null) =>
      ({ resolution, targets, param }) as never;
    expect(titleText(item("sanction", [2], null), nameOf, t)).toBe(
      "[congress.resolution.sanction.name] · jiho",
    );
    expect(titleText(item("truce", [2, 3], null), nameOf, t)).toBe(
      "[congress.resolution.truce.name] · jiho ↔ seoyeon",
    );
    expect(titleText(item("building_pact", [], "factory"), nameOf, t)).toBe(
      "[congress.resolution.building_pact.name] · [unit_type.factory]",
    );
    expect(titleText(item("law_review", [], "doctrine:B"), nameOf, t)).toBe(
      "[congress.resolution.law_review.name] · [domestic.law.doctrine.B.name]",
    );
    expect(titleText(item("emergency", [2], "nuclear"), nameOf, t)).toBe(
      "[congress.emergency.nuclear] · jiho",
    );
  });

  test("reasons carry names and numbers", () => {
    expect(
      reasonText(
        {
          resolution: "sanction",
          targets: [2],
          param: null,
          reason: "aggressor",
          reasonValue: 2.1,
          voters: 0,
        },
        nameOf,
        t,
      ),
    ).toBe(
      '[congress.reason.aggressor:{"pct":2.1,"ratio":2.1,"count":2.1,"name":"jiho"}]',
    );
  });

  test("clock", () => {
    expect(formatClock(1340)).toBe("2:14");
    expect(formatClock(-5)).toBe("0:00");
  });
});

describe("results and flags", () => {
  test("new results are the ones not seen before; none on the first data", () => {
    const a = {
      sessionId: 1,
      kind: "regular" as const,
      tick: 2100,
      resolution: "war_tax" as const,
      targets: [],
      param: null,
      a: 3,
      b: 1,
      adopted: "A" as const,
    };
    const b = { ...a, sessionId: 2, tick: 3900 };
    expect(newResults(null, [a])).toEqual([]);
    expect(newResults([a], [a, b])).toEqual([b]);
  });

  test("leaderboard flags", () => {
    const data: CongressData = {
      ...EMPTY,
      active: [
        { resolution: "sanction", option: "A", targets: [2], param: null, sinceTick: 0, expires: "next_tally" },
        { resolution: "truce", option: "A", targets: [2, 3], param: null, sinceTick: 0, expires: 900 },
      ],
      emergency: {
        kind: "nuclear",
        target: 2,
        startTick: 0,
        endTick: 1800,
        goalKind: "silos",
        goal: 2,
        progress: 0,
        members: [3],
        hero: null,
      },
    };
    expect(flagIcons(congressFlags(data, 2))).toBe("⛔🕊🚨");
    expect(flagIcons(congressFlags(data, 3))).toBe("🕊⚔");
    expect(congressFlags(null, 2)).toBe(0);
  });
});

```

`tests/client/CongressDial.test.ts`:

```ts
import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, unknown>) =>
    params === undefined ? `[${key}]` : `[${key}:${JSON.stringify(params)}]`,
}));

import "../../src/client/hud/domestic/DomesticDials";
import type { DomesticDials } from "../../src/client/hud/domestic/DomesticDials";
import { OpenDomesticScreenEvent } from "../../src/client/hud/domestic/DomesticEvents";
import type { GameView } from "../../src/client/view";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";
import { EMPTY } from "./CongressFixture";

const DOMESTIC: DomesticData = {
  science: 0,
  political: 0,
  cumulativeScience: 0,
  cumulativePolitical: 0,
  sciencePerSec: 1,
  politicalPerSec: 1,
  techs: [],
  research: null,
  recruitTargetPct: 100,
  laws: {},
  lawCooldownUntilTick: 0,
  governmentTier: 0,
  government: "chiefdom",
  conditions: [],
};

async function mount(
  congress: Partial<typeof EMPTY> | null,
  influence = 120,
  ticks = 900,
): Promise<DomesticDials> {
  const el = document.createElement("domestic-dials") as DomesticDials;
  const me = {
    isAlive: () => true,
    smallID: () => 1,
    domestic: () => new DomesticClientView(DOMESTIC),
    domesticData: () => DOMESTIC,
    congressData: () => ({
      influence,
      influencePerSec: 0.4,
      status: "peaceful",
      ballots: [],
    }),
    gold: () => 0n,
    units: () => [],
    isFriendly: () => false,
  };
  el.game = {
    myPlayer: () => me,
    inSpawnPhase: () => false,
    ticks: () => ticks,
    congressData: () => (congress === null ? null : { ...EMPTY, ...congress }),
    playerBySmallID: () => ({ isPlayer: () => true, displayName: () => "x" }),
    config: () => ({
      hasInfiniteGold: () => false,
      congress: () => congress !== null,
    }),
  } as unknown as GameView;
  el.eventBus = new EventBus();
  document.body.appendChild(el);
  el.init();
  el.tick();
  await el.updateComplete;
  return el;
}

const dial = (el: HTMLElement) =>
  el.querySelector<HTMLButtonElement>('[data-dial="congress"]');

describe("the congress dial", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is absent without the congress", async () => {
    const el = await mount(null);
    expect(dial(el)).toBeNull();
    expect(el.querySelector('[data-dial="research"]')).not.toBeNull();
  });

  it("idles with my influence under it", async () => {
    const el = await mount({});
    expect(dial(el)!.dataset.state).toBe("idle");
    expect(el.querySelector("[data-congress-influence]")!.textContent).toContain(
      '[congress.dial.influence:{"value":120}]',
    );
  });

  it("glows while voting with the seconds left and a vote badge", async () => {
    const el = await mount(
      {
        session: {
          id: 1,
          kind: "regular",
          openTick: 800,
          closeTick: 1100,
          items: [
            {
              resolution: "war_tax",
              targets: [],
              param: null,
              reason: "global",
              reasonValue: 0,
              voters: 0,
            },
          ],
        },
      },
      120,
      900,
    );
    const d = dial(el)!;
    expect(d.dataset.state).toBe("voting");
    expect(d.textContent).toContain('[domestic.dial.seconds:{"seconds":20}]');
    expect(d.querySelector('[data-dial-badge="vote"]')).not.toBeNull();
  });

  it("shows a 🚨 badge when I can convene, and opens the congress screen", async () => {
    const el = await mount({
      available: [{ kind: "nuclear", target: 2, sinceTick: 0 }],
    });
    const d = dial(el)!;
    expect(d.querySelector('[data-dial-badge="convene"]')).not.toBeNull();
    const opened: string[] = [];
    el.eventBus.on(OpenDomesticScreenEvent, (e) => opened.push(e.screen));
    d.click();
    expect(opened).toEqual(["congress"]);
  });
});
```

`tests/client/CongressScreen.test.ts`:

```ts
import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import { renderCongressScreen } from "../../src/client/hud/congress/CongressScreen";
import { EMPTY } from "./CongressFixture";

const t = (key: string, p?: Record<string, string | number>) =>
  p === undefined ? `[${key}]` : `[${key}:${JSON.stringify(p)}]`;

function mount(data = EMPTY, influence = 120) {
  const el = document.createElement("div");
  const convene = vi.fn();
  render(
    renderCongressScreen({
      data,
      viewer: {
        smallID: 1,
        alive: true,
        data: { influence, influencePerSec: 0.45, status: "peaceful", ballots: [] },
        friendlyTo: () => false,
      },
      now: 900,
      nameOf: (id) => ["", "me", "jiho", "seoyeon"][id] ?? "?",
      t,
      convene,
    }),
    el,
  );
  return { el, convene };
}

describe("the congress screen", () => {
  it("shows my influence, its rate and status, and the next session", () => {
    const { el } = mount();
    expect(el.querySelector("[data-congress-influence]")!.textContent).toContain(
      '[congress.screen.influence:{"value":120}]',
    );
    expect(el.textContent).toContain("[congress.status.peaceful]");
    expect(el.querySelector("[data-congress-next]")!.textContent).toContain(
      '[congress.screen.next_session:{"time":"1:30"}]',
    );
  });

  it("lists resolutions in force with their time left", () => {
    const { el } = mount({
      ...EMPTY,
      active: [
        {
          resolution: "sanction",
          option: "A",
          targets: [2],
          param: null,
          sinceTick: 0,
          expires: "next_tally",
        },
      ],
    });
    const row = el.querySelector("[data-active-resolution]")!;
    expect(row.textContent).toContain("[congress.resolution.sanction.name] · jiho");
    expect(row.textContent).toContain("[congress.resolution.sanction.a]");
    // Until the next tally: 1800 + 300 - 900 ticks.
    expect(row.textContent).toContain("2:00");
  });

  it("convenes with one tap, and says why not when it can't", () => {
    const data = {
      ...EMPTY,
      available: [{ kind: "nuclear" as const, target: 2, sinceTick: 0 }],
    };
    const { el, convene } = mount(data);
    el.querySelector<HTMLButtonElement>('[data-convene="nuclear:2"]')!.click();
    expect(convene).toHaveBeenCalledWith("nuclear", 2);
    const poor = mount(data, 10);
    const button = poor.el.querySelector<HTMLButtonElement>(
      '[data-convene="nuclear:2"]',
    )!;
    expect(button.disabled).toBe(true);
    expect(poor.el.textContent).toContain(
      '[congress.block.influence:{"cost":50}]',
    );
  });

  it("shows totals in the history, never who voted what", () => {
    const { el } = mount({
      ...EMPTY,
      history: [
        {
          sessionId: 1,
          kind: "regular",
          tick: 2100,
          resolution: "sanction",
          targets: [2],
          param: null,
          a: 11,
          b: 9,
          adopted: "A",
        },
      ],
    });
    const history = el.querySelector("[data-congress-history]")!.textContent!;
    expect(history).toContain('"a":11');
    expect(history).toContain('"b":9');
    expect(history).not.toContain("seoyeon");
  });
});
```

`tests/client/DomesticDials.test.ts`의 가짜 `config: () => ({ hasInfiniteGold: () => false })`를 `config: () => ({ hasInfiniteGold: () => false, congress: () => false })`로 바꾼다. `tests/client/DomesticDrawer.test.ts`에서 `Record<DomesticScreen, string>`인 `content` 객체에 `congress: "[data-congress-screen]",`을 더한다(목록 `DOMESTIC_SCREENS`는 그대로 셋이라 반복은 바뀌지 않는다).

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/CongressModel.test.ts tests/client/CongressDial.test.ts tests/client/CongressScreen.test.ts --run`
Expected: FAIL — `Cannot find module '../../src/client/hud/congress/CongressModel'`

- [ ] **Step 3: 화면 모델 작성**

`src/client/hud/congress/CongressModel.ts`:

```ts
import {
  ActiveResolutionData,
  AgendaItemData,
  BallotData,
  BallotOption,
  CongressData,
  EmergencyData,
  EmergencyKind,
  PlayerCongressData,
  RESOLUTION_META,
  ResolutionId,
  ResultData,
  SessionKind,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  CONVENE_COST_MILLI,
  extraVoteCost,
  MAX_EXTRA_VOTES,
  SESSION_INTERVAL_TICKS,
  SESSION_NOTICE_TICKS,
  VOTING_TICKS,
} from "@openfront/engine-lib/congress/CongressBalance";
import {
  ConveneBlock,
  conveneBlock,
  conveneWindowOpen,
} from "@openfront/engine-lib/congress/Voting";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import type { GameView, PlayerView } from "../../view";

// World congress screens (spec §12): pure models over CongressData and the
// viewer's PlayerCongressData. Nothing here knows who voted what: the data
// only has turnout, totals and the viewer's own ballots (spec §6.5).

export type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** What the congress screens read of the viewer. */
export interface CongressViewer {
  smallID: number;
  alive: boolean;
  data: PlayerCongressData | null;
  /** Allied with (or a teammate of) the player with this smallID. */
  friendlyTo(smallID: number): boolean;
}

export function viewerOf(game: GameView | undefined): CongressViewer | null {
  const me = game?.myPlayer();
  if (!game || !me) return null;
  return {
    smallID: me.smallID(),
    alive: me.isAlive(),
    data: me.congressData(),
    friendlyTo: (id) => {
      const p = game.playerBySmallID(id);
      return p.isPlayer() && me.isFriendly(p as PlayerView);
    },
  };
}

export function nameOf(game: GameView, smallID: number): string {
  const p = game.playerBySmallID(smallID);
  return p.isPlayer() ? (p as PlayerView).displayName() : "";
}

/** Whole influence points convening costs. */
export const CONVENE_COST = CONVENE_COST_MILLI / MILLI;

export function ticksToSeconds(ticks: number): number {
  return Math.max(0, Math.ceil(ticks / 10));
}

/** "m:ss". */
export function formatClock(ticks: number): string {
  const s = ticksToSeconds(ticks);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function myBallot(
  viewer: CongressViewer,
  sessionId: number,
  index: number,
): BallotData | null {
  return (
    viewer.data?.ballots.find(
      (b) => b.sessionId === sessionId && b.item === index,
    ) ?? null
  );
}

function canVote(data: CongressData, item: AgendaItemData, id: number): boolean {
  return data.seats.includes(id) || item.targets.includes(id);
}

export function isSanctioned(data: CongressData, smallID: number): boolean {
  return data.active.some(
    (r) =>
      r.resolution === "sanction" &&
      r.option === "A" &&
      r.targets.includes(smallID),
  );
}

/** A harmful resolution names me, or I am the emergency's target. */
export function isTargeted(data: CongressData, smallID: number): boolean {
  if (data.emergency?.target === smallID) return true;
  return data.active.some((r) => {
    const good = RESOLUTION_META[r.resolution].favorable;
    return r.targets.includes(smallID) && good !== null && r.option !== good;
  });
}

/** Why the viewer can't convene (kind, target) now, or null when one tap would (as Emergencies.conveneEmergency checks). */
export function conveneState(
  data: CongressData,
  viewer: CongressViewer,
  kind: EmergencyKind,
  target: number,
  now: number,
): ConveneBlock | null {
  return conveneBlock({
    available: data.available.some(
      (a) => a.kind === kind && a.target === target,
    ),
    windowOpen: conveneWindowOpen(
      now,
      data.session !== null,
      data.emergency !== null,
      data.nextSessionTick,
    ),
    seated: viewer.alive && data.seats.includes(viewer.smallID),
    isTarget: viewer.smallID === target,
    friendlyToTarget: viewer.friendlyTo(target),
    sanctioned: isSanctioned(data, viewer.smallID),
    influenceMilli: (viewer.data?.influence ?? 0) * MILLI,
  });
}

export type CongressDialState = "idle" | "soon" | "voting";

export interface CongressDialModel {
  state: CongressDialState;
  /** idle: toward the next session; voting: the time left (0..1). */
  progress: number;
  secondsLeft: number;
  /** Items of the open session I may vote on and haven't. */
  unvoted: number;
  targeted: boolean;
  canConvene: boolean;
  influence: number;
  /** Influence grows (peaceful or at the cap's edge); grey caption otherwise. */
  earning: boolean;
}

export function congressDial(
  data: CongressData,
  viewer: CongressViewer,
  now: number,
): CongressDialModel {
  const s = data.session;
  let state: CongressDialState;
  let progress: number;
  let secondsLeft: number;
  if (s !== null) {
    state = "voting";
    const span = Math.max(1, s.closeTick - s.openTick);
    progress = Math.min(1, Math.max(0, (s.closeTick - now) / span));
    secondsLeft = ticksToSeconds(s.closeTick - now);
  } else {
    const left = data.nextSessionTick - now;
    state = left <= SESSION_NOTICE_TICKS ? "soon" : "idle";
    progress =
      state === "soon"
        ? 1
        : Math.min(1, Math.max(0, 1 - left / SESSION_INTERVAL_TICKS));
    secondsLeft = ticksToSeconds(left);
  }
  const unvoted =
    s === null
      ? 0
      : s.items.filter(
          (item, i) =>
            viewer.alive &&
            canVote(data, item, viewer.smallID) &&
            myBallot(viewer, s.id, i) === null,
        ).length;
  return {
    state,
    progress,
    secondsLeft,
    unvoted,
    targeted: isTargeted(data, viewer.smallID),
    canConvene: data.available.some(
      (a) => conveneState(data, viewer, a.kind, a.target, now) === null,
    ),
    influence: viewer.data?.influence ?? 0,
    earning:
      viewer.data === null ||
      viewer.data.status === "peaceful" ||
      viewer.data.status === "capped",
  };
}

/** Ticks a resolution has left; null until its victory project ends. */
export function remainingTicks(
  r: ActiveResolutionData,
  data: CongressData,
  now: number,
): number | null {
  if (typeof r.expires === "number") return Math.max(0, r.expires - now);
  if (r.expires === "project_end") return null;
  const s = data.session;
  const tally =
    s !== null && s.kind === "regular"
      ? s.closeTick
      : data.nextSessionTick + VOTING_TICKS;
  return Math.max(0, tally - now);
}

export interface ChipModel {
  resolution: ResolutionId;
  option: BallotOption;
  targets: number[];
  param: string | null;
  remaining: number | null;
  mine: boolean;
}

/** Up to `max` chips: resolutions naming me first, then world rules, then the rest. */
export function resolutionChips(
  data: CongressData,
  smallID: number,
  now: number,
  max = 3,
): ChipModel[] {
  const rank = (c: ChipModel) => (c.mine ? 0 : c.targets.length === 0 ? 1 : 2);
  return data.active
    .map((r) => ({
      resolution: r.resolution,
      option: r.option,
      targets: r.targets,
      param: r.param,
      remaining: remainingTicks(r, data, now),
      mine: r.targets.includes(smallID),
    }))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, max);
}

export interface CardModel {
  sessionId: number;
  index: number;
  kind: SessionKind;
  item: AgendaItemData;
  closeTick: number;
  eligible: boolean;
  bOnly: boolean;
  myVote: BallotData | null;
  /** When I am named: the side good for me. */
  favorable: BallotOption | null;
  /** Seats that voted / seats (plus targets) that may: the only live count (secret ballot). */
  turnout: { voted: number; total: number };
}

export function cardModels(
  data: CongressData,
  viewer: CongressViewer,
): CardModel[] {
  const s = data.session;
  if (s === null) return [];
  return s.items.map((item, index) => {
    const named = item.targets.includes(viewer.smallID);
    return {
      sessionId: s.id,
      index,
      kind: s.kind,
      item,
      closeTick: s.closeTick,
      eligible: viewer.alive && canVote(data, item, viewer.smallID),
      bOnly:
        item.resolution === "emergency" &&
        (named || viewer.friendlyTo(item.targets[0])),
      myVote: myBallot(viewer, s.id, index),
      favorable: named ? RESOLUTION_META[item.resolution].favorable : null,
      turnout: {
        voted: item.voters,
        total: new Set([...data.seats, ...item.targets]).size,
      },
    };
  });
}

export interface ExtraChip {
  extra: number;
  /** What this tap costs (the raise from the current extra votes). */
  cost: number;
  affordable: boolean;
}

export function extraChips(
  myVote: BallotData | null,
  influence: number,
): ExtraChip[] {
  if (myVote === null) return [];
  const out: ExtraChip[] = [];
  for (let k = myVote.extra + 1; k <= MAX_EXTRA_VOTES; k++) {
    const cost = extraVoteCost(k) - extraVoteCost(myVote.extra);
    out.push({ extra: k, cost, affordable: cost <= influence });
  }
  return out;
}

export function resultKey(r: ResultData): string {
  return `${r.sessionId}:${r.resolution}:${r.targets.join(",")}:${r.param ?? ""}`;
}

/** Results in `next` that `prev` didn't have; none when there is no `prev` yet. */
export function newResults(
  prev: readonly ResultData[] | null,
  next: readonly ResultData[],
): ResultData[] {
  if (prev === null) return [];
  const seen = new Set(prev.map(resultKey));
  return next.filter((r) => !seen.has(resultKey(r)));
}

export function optionLabel(
  resolution: ResolutionId,
  option: BallotOption,
  t: Translate,
): string {
  return t(`congress.resolution.${resolution}.${option.toLowerCase()}`);
}

type Named = Pick<AgendaItemData, "resolution" | "targets" | "param">;

/** Who or what an item names: players (a pair joined by ↔) or its parameter. */
export function subjectText(
  item: Named,
  name: (smallID: number) => string,
  t: Translate,
): string {
  if (item.targets.length > 0) return item.targets.map(name).join(" ↔ ");
  if (item.param === null) return "";
  switch (item.resolution) {
    case "trade_pact":
      return t(`congress.param.${item.param}`);
    case "building_pact":
      return t(`unit_type.${item.param}`);
    case "government_resolution":
      return t(`domestic.gov.${item.param}.name`);
    case "law_review": {
      const [law, option] = item.param.split(":");
      return t(`domestic.law.${law}.${option}.name`);
    }
    default:
      return "";
  }
}

export function titleText(
  item: Named,
  name: (smallID: number) => string,
  t: Translate,
): string {
  const head =
    item.resolution === "emergency" && item.param !== null
      ? t(`congress.emergency.${item.param}`)
      : t(`congress.resolution.${item.resolution}.name`);
  const subject = subjectText(item, name, t);
  return subject === "" ? head : `${head} · ${subject}`;
}

export function reasonText(
  item: AgendaItemData,
  name: (smallID: number) => string,
  t: Translate,
): string {
  const params: Record<string, string | number> = {
    pct: item.reasonValue,
    ratio: item.reasonValue,
    count: item.reasonValue,
  };
  const [first, second] = item.targets;
  if (
    item.reason === "aggressor_government" ||
    item.reason === "aggressor_law" ||
    item.reason === "convened"
  ) {
    params.name = name(item.reasonValue);
  } else if (first !== undefined) {
    params.name = name(first);
  }
  if (second !== undefined) params.target = name(second);
  return t(`congress.reason.${item.reason}`, params);
}

export function goalText(e: EmergencyData, t: Translate): string {
  return t(`congress.goal.${e.goalKind}`, {
    progress: e.progress,
    goal: e.goal,
  });
}

/** Leaderboard status icons (spec §12), as bits of one number. */
export const FLAG_ICONS: readonly (readonly [number, string])[] = [
  [1, "⛔"],
  [2, "🚫"],
  [4, "🛡"],
  [8, "🕊"],
  [16, "🚨"],
  [32, "⚔"],
  [64, "🏛"],
];

export function congressFlags(
  data: CongressData | null,
  smallID: number,
): number {
  if (data === null) return 0;
  let mask = 0;
  for (const r of data.active) {
    if (r.option !== "A" || !r.targets.includes(smallID)) continue;
    if (r.resolution === "sanction") mask |= 1;
    if (r.resolution === "arms_embargo") mask |= 2;
    if (r.resolution === "protectorate") mask |= 4;
    if (r.resolution === "truce") mask |= 8;
    if (r.resolution === "world_heritage") mask |= 64;
  }
  if (data.emergency?.target === smallID) mask |= 16;
  if (data.emergency?.members.includes(smallID)) mask |= 32;
  return mask;
}

export function flagIcons(mask: number): string {
  return FLAG_ICONS.filter(([bit]) => (mask & bit) !== 0)
    .map(([, icon]) => icon)
    .join("");
}
```

- [ ] **Step 4: 서랍의 의회 화면 작성**

`src/client/hud/congress/CongressScreen.ts`:

```ts
import {
  CongressData,
  EmergencyKind,
} from "@openfront/engine-api/congress/CongressTypes";
import { html, nothing, TemplateResult } from "lit";
import {
  CONVENE_COST,
  CongressViewer,
  conveneState,
  formatClock,
  goalText,
  optionLabel,
  remainingTicks,
  titleText,
  Translate,
} from "./CongressModel";

export interface CongressScreenContext {
  data: CongressData;
  viewer: CongressViewer;
  /** The drawer's clock (moves once a second). */
  now: number;
  nameOf(smallID: number): string;
  t: Translate;
  convene(kind: EmergencyKind, target: number): void;
}

const SECTION = "flex flex-col gap-1 rounded-lg bg-gray-800/80 p-2";
const HEAD = "text-sm font-bold text-gray-200";
const ROW = "flex items-center gap-2 text-sm";

/** The congress screen of the domestic drawer (spec §12): mine, the session, the rules in force, emergencies, rankings and results. */
export function renderCongressScreen(ctx: CongressScreenContext): TemplateResult {
  return html`<div data-congress-screen class="flex flex-col gap-3 pb-2">
    ${influence(ctx)} ${session(ctx)} ${active(ctx)} ${emergency(ctx)}
    ${worldGovernment(ctx)} ${ranking(ctx)} ${history(ctx)}
  </div>`;
}

function influence(ctx: CongressScreenContext): TemplateResult {
  const d = ctx.viewer.data;
  return html`<section data-congress-influence class=${SECTION}>
    <div class="flex items-baseline gap-2">
      <span class="text-lg font-bold text-amber-300"
        >${ctx.t("congress.screen.influence", { value: d?.influence ?? 0 })}</span
      >
      <span class="text-sm text-gray-300"
        >${ctx.t("congress.screen.rate", {
          rate: (d?.influencePerSec ?? 0).toFixed(2),
        })}</span
      >
    </div>
    <span class="text-sm text-gray-300"
      >${ctx.t(`congress.status.${d?.status ?? "peaceful"}`)}</span
    >
  </section>`;
}

function session(ctx: CongressScreenContext): TemplateResult {
  const s = ctx.data.session;
  return html`<section data-congress-next class=${SECTION}>
    <span class=${ROW}
      >${s === null
        ? ctx.t("congress.screen.next_session", {
            time: formatClock(ctx.data.nextSessionTick - ctx.now),
          })
        : ctx.t("congress.screen.voting_now", {
            seconds: Math.max(0, Math.ceil((s.closeTick - ctx.now) / 10)),
          })}</span
    >
  </section>`;
}

function active(ctx: CongressScreenContext): TemplateResult {
  const rows = ctx.data.active.map((r) => {
    const left = remainingTicks(r, ctx.data, ctx.now);
    return html`<div data-active-resolution class=${ROW}>
      <span class="flex-1"
        >${titleText(r, ctx.nameOf, ctx.t)} —
        ${optionLabel(r.resolution, r.option, ctx.t)}</span
      >
      <span class="tabular-nums text-gray-300"
        >${left === null
          ? ctx.t("congress.chip.until_project")
          : formatClock(left)}</span
      >
    </div>`;
  });
  return html`<section class=${SECTION}>
    <h3 class=${HEAD}>${ctx.t("congress.screen.active")}</h3>
    ${rows.length === 0
      ? html`<span class="text-sm text-gray-400"
          >${ctx.t("congress.screen.none")}</span
        >`
      : rows}
  </section>`;
}

function emergency(ctx: CongressScreenContext): TemplateResult {
  const e = ctx.data.emergency;
  const cooldown = ctx.data.cooldownUntilTick - ctx.now;
  return html`<section data-congress-emergency class=${SECTION}>
    <h3 class=${HEAD}>${ctx.t("congress.screen.emergency")}</h3>
    ${e === null
      ? nothing
      : html`<span class=${ROW}
          >${ctx.t("congress.band.active", {
            kind: ctx.t(`congress.emergency.${e.kind}`),
            name: ctx.nameOf(e.target),
            goal: goalText(e, ctx.t),
            time: formatClock(e.endTick - ctx.now),
          })}</span
        >`}
    ${ctx.data.available.length === 0
      ? nothing
      : html`<div data-congress-available class="flex flex-col gap-1">
          <span class="text-xs text-gray-400"
            >${ctx.t("congress.screen.available")}</span
          >
          ${ctx.data.available.map((a) => {
            const block = conveneState(
              ctx.data,
              ctx.viewer,
              a.kind,
              a.target,
              ctx.now,
            );
            return html`<div class=${ROW}>
              <span class="flex-1"
                >${ctx.t(`congress.emergency.${a.kind}`)} ·
                ${ctx.nameOf(a.target)}</span
              >
              <button
                type="button"
                data-convene=${`${a.kind}:${a.target}`}
                class="h-9 px-3 rounded-md text-sm font-semibold bg-red-700 hover:bg-red-600 disabled:opacity-40"
                ?disabled=${block !== null}
                @click=${() => ctx.convene(a.kind, a.target)}
              >
                ${ctx.t("congress.band.convene", { cost: CONVENE_COST })}
              </button>
            </div>
            ${block === null
              ? nothing
              : html`<span data-convene-reason class="text-xs text-amber-300"
                  >${ctx.t(`congress.block.${block}`, {
                    cost: CONVENE_COST,
                  })}</span
                >`}`;
          })}
        </div>`}
    ${cooldown > 0
      ? html`<span class="text-xs text-gray-400"
          >${ctx.t("congress.screen.cooldown", {
            time: formatClock(cooldown),
          })}</span
        >`
      : nothing}
    <span class="text-xs text-gray-400"
      >${ctx.t("congress.screen.emergencies_left", {
        count: ctx.data.emergenciesLeft,
      })}</span
    >
  </section>`;
}

function worldGovernment(ctx: CongressScreenContext): TemplateResult | typeof nothing {
  if (ctx.data.verdicts.length === 0) return nothing;
  return html`<section data-congress-worldgov class=${SECTION}>
    <h3 class=${HEAD}>${ctx.t("congress.screen.world_gov")}</h3>
    ${ctx.data.verdicts.map(
      (v) => html`<span class=${ROW}
        >${ctx.t(
          v.ratified
            ? "congress.screen.world_gov_ratified"
            : "congress.screen.world_gov_waiting",
          { name: ctx.nameOf(v.owner) },
        )}</span
      >`,
    )}
  </section>`;
}

function ranking(ctx: CongressScreenContext): TemplateResult {
  const list = (key: string, rows: CongressData["aggressors"]) =>
    html`<div class="flex flex-col gap-0.5">
      <span class="text-xs text-gray-400">${ctx.t(key)}</span>
      ${rows.length === 0
        ? html`<span class="text-sm text-gray-500"
            >${ctx.t("congress.screen.none")}</span
          >`
        : rows.map(
            (r) => html`<span class=${ROW}
              ><span class="flex-1">${ctx.nameOf(r.id)}</span
              ><span class="tabular-nums">${r.pct}%</span></span
            >`,
          )}
    </div>`;
  return html`<section data-congress-ranking class="${SECTION} grid grid-cols-2 gap-2">
    ${list("congress.screen.aggressors", ctx.data.aggressors)}
    ${list("congress.screen.victims", ctx.data.victims)}
  </section>`;
}

function history(ctx: CongressScreenContext): TemplateResult {
  const rows = [...ctx.data.history].reverse().map(
    (h) => html`<div class=${ROW}>
      <span class="flex-1">${titleText(h, ctx.nameOf, ctx.t)}</span>
      <span class="text-gray-300"
        >${h.adopted === null
          ? ctx.t("congress.card.tied", { a: h.a, b: h.b })
          : ctx.t("congress.card.adopted", {
              option: optionLabel(h.resolution, h.adopted, ctx.t),
              a: h.a,
              b: h.b,
            })}</span
      >
    </div>`,
  );
  return html`<section data-congress-history class=${SECTION}>
    <h3 class=${HEAD}>${ctx.t("congress.screen.history")}</h3>
    ${rows.length === 0
      ? html`<span class="text-sm text-gray-400"
          >${ctx.t("congress.screen.none")}</span
        >`
      : rows}
  </section>`;
}
```

- [ ] **Step 5: 다이얼과 서랍 연결**

`src/client/hud/domestic/Dial.ts`의 `DIAL_COLORS`에 `congress: { stroke: "#eab308", glow: "234 179 8" },`를 `victory` 뒤에 더한다.

`src/client/hud/domestic/DomesticEvents.ts`:

```ts
/** The drawer's screens, one per dial (spec §14d); "congress" only in congress games. */
export type DomesticScreen = "research" | "laws" | "victory" | "congress";
/** The three domestic screens every domestic game has. */
export const DOMESTIC_SCREENS: readonly DomesticScreen[] = [
  "research",
  "laws",
  "victory",
];
```

`src/client/hud/domestic/DomesticDials.ts`:
- import 추가: `import { congressDial, CongressDialModel, viewerOf } from "../congress/CongressModel";`
- `DialsModel`에 `congress: CongressDialModel | null;`
- `buildModel()`의 반환 객체에:

```ts
      congress: this.congressModel(),
```

- 메서드 추가:

```ts
  /** World congress (spec §12): the 🏛 dial's model; null without the congress. */
  private congressModel(): CongressDialModel | null {
    if (!this.game.config().congress()) return null;
    const data = this.game.congressData();
    const viewer = viewerOf(this.game);
    if (data === null || viewer === null) return null;
    return congressDial(data, viewer, this.game.ticks());
  }

  private congressSpec(m: CongressDialModel): DialSpec {
    const voting = m.state === "voting";
    const badge = (kind: string, text: string, colors: string, pos: string) =>
      html`<span
        data-dial-badge=${kind}
        class="absolute ${pos} size-4 flex items-center justify-center rounded-full ${colors} ring-1 ring-gray-900 text-[10px] font-black leading-none"
        >${text}</span
      >`;
    return {
      screen: "congress",
      state: m.state,
      svg: voting
        ? clockSvg(m.progress, "congress")
        : ringSvg(
            m.state === "soon" ? 1 : m.progress,
            m.state === "idle" ? "grey" : "congress",
          ),
      face: voting
        ? html`<span class="text-sm">🏛</span>
            <span data-dial-seconds class="text-[10px] font-bold tabular-nums"
              >${translateText("domestic.dial.seconds", {
                seconds: m.secondsLeft,
              })}</span
            >`
        : html`<span class="text-lg">🏛</span>`,
      glow:
        m.state === "soon" || (voting && m.unvoted > 0) ? "congress" : null,
      dim: m.state === "idle",
      badges: html`${m.canConvene
        ? badge("convene", "🚨", "bg-red-600", "-top-1 -left-1")
        : nothing}
      ${m.targeted
        ? badge("target", "!", "bg-red-500 text-white", "-top-1 -right-1")
        : voting && m.unvoted > 0
          ? badge("vote", "!", "bg-yellow-300 text-gray-900", "-top-1 -right-1")
          : nothing}`,
      caption: html`<span
        data-congress-influence
        class="text-[10px] leading-none font-semibold tabular-nums whitespace-nowrap ${m.earning
          ? "text-amber-300"
          : "text-gray-400"}"
        >${translateText("congress.dial.influence", { value: m.influence })}</span
      >`,
    };
  }
```

- `render()`에서 `if (m.victory !== null) dials.push(this.victorySpec(m.victory));` 뒤에 `if (m.congress !== null) dials.push(this.congressSpec(m.congress));`

`src/client/hud/domestic/DomesticPanel.ts`:
- import 추가: `import { renderCongressScreen } from "../congress/CongressScreen";`, `import { nameOf, viewerOf } from "../congress/CongressModel";`, 그리고 `Transport`에서 `SendConveneEmergencyIntentEvent`.
- `SCREEN_ICONS`에 `congress: "🏛",`
- `renderScreen`의 `switch`에:

```ts
      case "congress": {
        const data = this.game.congressData();
        const viewer = viewerOf(this.game);
        if (data === null || viewer === null) return html``;
        return renderCongressScreen({
          data,
          viewer,
          now: this.nowTick,
          nameOf: (id) => nameOf(this.game, id),
          t: translateText,
          convene: (kind, target) => {
            const p = this.game.playerBySmallID(target);
            if (p.isPlayer()) {
              this.eventBus.emit(
                new SendConveneEmergencyIntentEvent(kind, p.id()),
              );
            }
          },
        });
      }
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/client/CongressModel.test.ts tests/client/CongressDial.test.ts tests/client/CongressScreen.test.ts tests/client/DomesticDials.test.ts tests/client/DomesticDrawer.test.ts tests/client/DomesticPanel.test.ts tests/client/DomesticInfiniteGold.test.ts tests/LayerBoundaries.test.ts --run && npm run typecheck && npm run lint`
Expected: 모두 PASS, 오류 없음

- [ ] **Step 7: 커밋**

```bash
npx prettier --write src/client/hud/congress src/client/hud/domestic/Dial.ts src/client/hud/domestic/DomesticEvents.ts src/client/hud/domestic/DomesticDials.ts src/client/hud/domestic/DomesticPanel.ts tests/client/CongressFixture.ts tests/client/CongressModel.test.ts tests/client/CongressDial.test.ts tests/client/CongressScreen.test.ts tests/client/DomesticDials.test.ts tests/client/DomesticDrawer.test.ts
git add src/client/hud/congress src/client/hud/domestic/Dial.ts src/client/hud/domestic/DomesticEvents.ts src/client/hud/domestic/DomesticDials.ts src/client/hud/domestic/DomesticPanel.ts tests/client/CongressFixture.ts tests/client/CongressModel.test.ts tests/client/CongressDial.test.ts tests/client/CongressScreen.test.ts tests/client/DomesticDials.test.ts tests/client/DomesticDrawer.test.ts
git commit -m "feat(congress): congress dial and drawer screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 12: 화면 II — 투표 카드, 결의 칩, 위쪽 띠, 결과 배너

**Files:**
- Create: `src/client/hud/congress/CongressCards.ts`, `src/client/hud/congress/CongressBand.ts`
- Modify: `index.html`, `src/client/hud/GameRenderer.ts`, `tests/client/CongressFixture.ts`(Task 11이 만든 공용 자료에 가짜 게임 추가)
- Modify (test): `tests/client/HudLayout.test.ts`, `tests/client/graphics/GameRendererCreate.test.ts`
- Test: `tests/client/CongressCards.test.ts`, `tests/client/CongressBand.test.ts`

**Interfaces:**
- Consumes: Task 11 `CongressModel`의 `cardModels`, `extraChips`, `resolutionChips`, `newResults`, `titleText`, `reasonText`, `optionLabel`, `goalText`, `formatClock`, `conveneState`, `CONVENE_COST`, `viewerOf`, `nameOf`; Task 1 `SendCongressVoteIntentEvent`, `SendConveneEmergencyIntentEvent`, `GameView.congressData()`, `Config.congress()`; 기존 `PlaySoundEffectEvent("click-3")`, `OpenDomesticScreenEvent`
- Produces: `<congress-cards>`(`COLLAPSE_TICKS = 50`, `STAMP_TICKS = 30`), `<congress-band>`(`TOAST_TICKS = 30`); 표시 속성 `data-congress-card`, `data-vote`, `data-side`, `data-extra`, `data-turnout`, `data-congress-pill`, `data-congress-stamp`, `data-congress-chip`, `data-congress-band`, `data-congress-toast`, `data-available`, `data-available-target`, `data-convene`, `data-convene-reason`, `data-emergency-vote`, `data-emergency`, `data-emergency-role`

- [ ] **Step 1: 공용 가짜 게임 추가**

`tests/client/CongressFixture.ts` 끝에 더한다(import는 파일 위로):

```ts
import {
  BallotData,
  CongressData,
} from "@openfront/engine-api/congress/CongressTypes";
import type { GameView } from "../../src/client/view";

export interface FakeCongress {
  now: number;
  data: CongressData;
  ballots: BallotData[];
  influence: number;
  /** My smallID (default 1). */
  me?: number;
}

export const NAMES = ["", "me", "jiho", "seoyeon"];

/** Just the GameView the congress HUD reads; mutate `state` between ticks. */
export function fakeCongressGame(state: FakeCongress): GameView {
  const me = {
    smallID: () => state.me ?? 1,
    isAlive: () => true,
    congressData: () => ({
      influence: state.influence,
      influencePerSec: 0.4,
      status: "peaceful",
      ballots: state.ballots,
    }),
    isFriendly: () => false,
  };
  return {
    myPlayer: () => me,
    ticks: () => state.now,
    congressData: () => state.data,
    playerBySmallID: (id: number) => ({
      isPlayer: () => true,
      id: () => `p${id}`,
      displayName: () => NAMES[id] ?? "?",
    }),
    config: () => ({ congress: () => true }),
  } as unknown as GameView;
}
```

(`CongressData` import는 이미 있으니 `BallotData`만 그 줄에 더한다.)

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/client/CongressCards.test.ts`:

```ts
import { SessionData } from "@openfront/engine-api/congress/CongressTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, unknown>) =>
    params === undefined ? `[${key}]` : `[${key}:${JSON.stringify(params)}]`,
}));

import "../../src/client/hud/congress/CongressCards";
import {
  COLLAPSE_TICKS,
  CongressCards,
  STAMP_TICKS,
} from "../../src/client/hud/congress/CongressCards";
import { OpenDomesticScreenEvent } from "../../src/client/hud/domestic/DomesticEvents";
import { SendCongressVoteIntentEvent } from "../../src/client/Transport";
import { EMPTY, FakeCongress, fakeCongressGame } from "./CongressFixture";

const REGULAR: SessionData = {
  id: 7,
  kind: "regular",
  openTick: 1800,
  closeTick: 2100,
  items: [
    {
      resolution: "sanction",
      targets: [2],
      param: null,
      reason: "aggressor",
      reasonValue: 2.1,
      voters: 3,
    },
  ],
};

async function mount(state: FakeCongress) {
  const el = document.createElement("congress-cards") as CongressCards;
  el.game = fakeCongressGame(state);
  el.eventBus = new EventBus();
  const votes: SendCongressVoteIntentEvent[] = [];
  el.eventBus.on(SendCongressVoteIntentEvent, (e) => votes.push(e));
  document.body.appendChild(el);
  el.init();
  el.tick();
  await el.updateComplete;
  const step = async (now?: number) => {
    if (now !== undefined) state.now = now;
    el.tick();
    await el.updateComplete;
  };
  return { el, votes, step };
}

const q = (el: HTMLElement, sel: string) => el.querySelector<HTMLElement>(sel);

describe("vote cards", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("one tap votes; then the chips raise it, priced by the raise", async () => {
    const state: FakeCongress = {
      now: 1900,
      data: { ...EMPTY, session: REGULAR },
      ballots: [],
      influence: 50,
    };
    const { el, votes, step } = await mount(state);
    q(el, '[data-congress-card="0"] [data-vote="A"]')!.click();
    expect(votes.map((v) => [v.session, v.item, v.option, v.extra])).toEqual([
      [7, 0, "A", 0],
    ]);
    state.ballots = [{ sessionId: 7, item: 0, option: "A", extra: 0 }];
    await step();
    expect(
      q(el, '[data-vote="B"]')!.hasAttribute("disabled"),
    ).toBe(true);
    const chips = [...el.querySelectorAll<HTMLButtonElement>("[data-extra]")];
    expect(chips.map((c) => [c.dataset.extra, c.disabled])).toEqual([
      ["1", false],
      ["2", false],
      ["3", true],
      ["4", true],
      ["5", true],
    ]);
    expect(chips[1].textContent).toContain(
      '[congress.card.extra:{"votes":2,"cost":30}]',
    );
    chips[1].click();
    expect(votes.at(-1)).toMatchObject({ option: "A", extra: 2 });
  });

  it("shows the turnout, never the sides", async () => {
    const { el } = await mount({
      now: 1900,
      data: { ...EMPTY, session: REGULAR },
      ballots: [],
      influence: 50,
    });
    const card = q(el, "[data-congress-card]")!;
    expect(q(card, "[data-turnout]")!.textContent).toContain(
      '[congress.card.turnout:{"voted":3,"total":3}]',
    );
    expect(card.textContent).not.toMatch(/"a":|"b":/);
  });

  it("the target of an emergency can only oppose and sees which side is good for it", async () => {
    const { el } = await mount({
      now: 120,
      data: {
        ...EMPTY,
        seats: [2, 3],
        session: {
          id: 2,
          kind: "emergency",
          openTick: 100,
          closeTick: 300,
          items: [
            {
              resolution: "emergency",
              targets: [1],
              param: "nuclear",
              reason: "convened",
              reasonValue: 2,
              voters: 1,
            },
          ],
        },
      },
      ballots: [],
      influence: 100,
    });
    const a = q(el, '[data-vote="A"]')! as HTMLButtonElement;
    const b = q(el, '[data-vote="B"]')! as HTMLButtonElement;
    expect(a.disabled).toBe(true);
    expect(b.disabled).toBe(false);
    expect(a.dataset.side).toBe("bad");
    expect(b.dataset.side).toBe("good");
    expect(el.textContent).toContain("[congress.card.b_only]");
    expect(el.textContent).toContain("[congress.emergency.nuclear] · me");
  });

  it("folds into a pill 5 s after my last vote, and the pill opens it again", async () => {
    const state: FakeCongress = {
      now: 1900,
      data: { ...EMPTY, session: REGULAR },
      ballots: [{ sessionId: 7, item: 0, option: "B", extra: 0 }],
      influence: 50,
    };
    const { el, step } = await mount(state);
    await step(1900 + COLLAPSE_TICKS - 1);
    expect(q(el, "[data-congress-card]")).not.toBeNull();
    await step(1900 + COLLAPSE_TICKS);
    expect(q(el, "[data-congress-card]")).toBeNull();
    const pill = q(el, "[data-congress-pill]")!;
    expect(pill.textContent).toContain(
      '[congress.card.collapsed:{"seconds":15,"voted":1,"total":1}]',
    );
    pill.click();
    await step();
    expect(q(el, "[data-congress-card]")).not.toBeNull();
  });

  it("the dial opens folded cards too", async () => {
    const state: FakeCongress = {
      now: 1900,
      data: { ...EMPTY, session: REGULAR },
      ballots: [{ sessionId: 7, item: 0, option: "B", extra: 0 }],
      influence: 50,
    };
    const { el, step } = await mount(state);
    await step(1900 + COLLAPSE_TICKS);
    el.eventBus.emit(new OpenDomesticScreenEvent("congress"));
    await step();
    expect(q(el, "[data-congress-card]")).not.toBeNull();
  });

  it("stamps each result for 3 s once the session closes", async () => {
    const state: FakeCongress = {
      now: 2090,
      data: { ...EMPTY, session: REGULAR },
      ballots: [],
      influence: 50,
    };
    const { el, step } = await mount(state);
    state.data = {
      ...EMPTY,
      nextSessionTick: 3600,
      history: [
        {
          sessionId: 7,
          kind: "regular",
          tick: 2100,
          resolution: "sanction",
          targets: [2],
          param: null,
          a: 11,
          b: 9,
          adopted: "A",
        },
      ],
    };
    await step(2100);
    expect(q(el, "[data-congress-card]")).toBeNull();
    expect(q(el, "[data-congress-stamp]")!.textContent).toContain(
      '[congress.card.adopted:{"option":"[congress.resolution.sanction.a]","a":11,"b":9}]',
    );
    await step(2100 + STAMP_TICKS);
    expect(q(el, "[data-congress-stamp]")).toBeNull();
  });

  it("chips list resolutions in force and open the congress screen", async () => {
    const { el } = await mount({
      now: 100,
      data: {
        ...EMPTY,
        active: [
          {
            resolution: "war_tax",
            option: "A",
            targets: [],
            param: null,
            sinceTick: 0,
            expires: "next_tally",
          },
        ],
      },
      ballots: [],
      influence: 0,
    });
    const opened: string[] = [];
    el.eventBus.on(OpenDomesticScreenEvent, (e) => opened.push(e.screen));
    const chip = q(el, "[data-congress-chip]")!;
    expect(chip.textContent).toContain("[congress.resolution.war_tax.name]");
    expect(chip.textContent).toContain("3:20");
    chip.click();
    expect(opened).toEqual(["congress"]);
  });
});
```

`tests/client/CongressBand.test.ts`:

```ts
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, unknown>) =>
    params === undefined ? `[${key}]` : `[${key}:${JSON.stringify(params)}]`,
}));

import "../../src/client/hud/congress/CongressBand";
import {
  CongressBand,
  TOAST_TICKS,
} from "../../src/client/hud/congress/CongressBand";
import { PlaySoundEffectEvent } from "../../src/client/sound/Sounds";
import { SendConveneEmergencyIntentEvent } from "../../src/client/Transport";
import { EMPTY, FakeCongress, fakeCongressGame } from "./CongressFixture";

async function mount(state: FakeCongress) {
  const el = document.createElement("congress-band") as CongressBand;
  el.game = fakeCongressGame(state);
  el.eventBus = new EventBus();
  const sounds: string[] = [];
  const convened: SendConveneEmergencyIntentEvent[] = [];
  el.eventBus.on(PlaySoundEffectEvent, (e) => sounds.push(e.effect));
  el.eventBus.on(SendConveneEmergencyIntentEvent, (e) => convened.push(e));
  document.body.appendChild(el);
  el.tick();
  await el.updateComplete;
  const step = async (now?: number) => {
    if (now !== undefined) state.now = now;
    el.tick();
    await el.updateComplete;
  };
  return { el, sounds, convened, step };
}

const q = (el: HTMLElement, sel: string) => el.querySelector<HTMLElement>(sel);

const AVAILABLE = {
  ...EMPTY,
  available: [{ kind: "nuclear" as const, target: 2, sinceTick: 0 }],
};

describe("the congress band", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("draws nothing when nothing is going on", async () => {
    const { el } = await mount({ now: 0, data: EMPTY, ballots: [], influence: 0 });
    expect(q(el, "[data-congress-band]")).toBeNull();
  });

  it("toasts a session's results once, with the gavel, for 3 s", async () => {
    const state: FakeCongress = { now: 2000, data: EMPTY, ballots: [], influence: 0 };
    const { el, sounds, step } = await mount(state);
    state.data = {
      ...EMPTY,
      history: [
        {
          sessionId: 1,
          kind: "regular",
          tick: 2100,
          resolution: "war_tax",
          targets: [],
          param: null,
          a: 3,
          b: 1,
          adopted: "A",
        },
        {
          sessionId: 1,
          kind: "regular",
          tick: 2100,
          resolution: "trade_pact",
          targets: [],
          param: "train",
          a: 2,
          b: 2,
          adopted: null,
        },
      ],
    };
    await step(2100);
    const toast = q(el, "[data-congress-toast]")!;
    expect(toast.textContent).toContain(
      '[congress.toast.adopted:{"title":"[congress.resolution.war_tax.name]","option":"[congress.resolution.war_tax.a]","a":3,"b":1}]',
    );
    expect(toast.textContent).toContain(
      '[congress.toast.tied:{"title":"[congress.resolution.trade_pact.name] · [congress.param.train]","a":2,"b":2}]',
    );
    expect(sounds).toEqual(["click-3"]);
    await step(2101);
    expect(sounds).toEqual(["click-3"]);
    await step(2100 + TOAST_TICKS);
    expect(q(el, "[data-congress-toast]")).toBeNull();
  });

  it("a seated player convenes with one tap", async () => {
    const { el, convened } = await mount({
      now: 100,
      data: AVAILABLE,
      ballots: [],
      influence: 80,
    });
    expect(q(el, "[data-available]")!.textContent).toContain(
      '[congress.band.available:{"name":"jiho","kind":"[congress.emergency.nuclear]"}]',
    );
    q(el, '[data-convene="nuclear:2"]')!.click();
    expect(convened.map((e) => [e.kind, e.target])).toEqual([["nuclear", "p2"]]);
  });

  it("the button is off with the reason when I can't convene", async () => {
    const { el, convened } = await mount({
      now: 100,
      data: AVAILABLE,
      ballots: [],
      influence: 10,
    });
    const button = q(el, '[data-convene="nuclear:2"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(q(el, "[data-convene-reason]")!.textContent).toContain(
      '[congress.block.influence:{"cost":50}]',
    );
    button.click();
    expect(convened).toEqual([]);
  });

  it("the target is warned, without a button", async () => {
    const { el } = await mount({
      now: 100,
      data: AVAILABLE,
      ballots: [],
      influence: 300,
      me: 2,
    });
    expect(q(el, "[data-available-target]")!.textContent).toContain(
      '[congress.band.available_target:{"kind":"[congress.emergency.nuclear]"}]',
    );
    expect(q(el, "[data-convene]")).toBeNull();
  });

  it("an emergency shows its goal, time and my part", async () => {
    const { el } = await mount({
      now: 600,
      data: {
        ...EMPTY,
        emergency: {
          kind: "nuclear",
          target: 2,
          startTick: 0,
          endTick: 1540,
          goalKind: "silos",
          goal: 2,
          progress: 1,
          members: [1],
          hero: 1,
        },
      },
      ballots: [],
      influence: 0,
    });
    const row = q(el, "[data-emergency]")!;
    expect(row.dataset.emergencyRole).toBe("member");
    expect(row.textContent).toContain(
      '[congress.band.active:{"kind":"[congress.emergency.nuclear]","name":"jiho","goal":"[congress.goal.silos:{\\"progress\\":1,\\"goal\\":2}]","time":"1:34"}]',
    );
    expect(row.textContent).toContain("[congress.band.member]");
    expect(q(row, "[data-progress]")!.style.width).toBe("50%");
  });

  it("an emergency vote has its line while the card sits in the card slot", async () => {
    const { el } = await mount({
      now: 140,
      data: {
        ...EMPTY,
        session: {
          id: 3,
          kind: "emergency",
          openTick: 100,
          closeTick: 300,
          items: [
            {
              resolution: "emergency",
              targets: [2],
              param: "aggression",
              reason: "convened",
              reasonValue: 3,
              voters: 1,
            },
          ],
        },
      },
      ballots: [],
      influence: 0,
    });
    expect(q(el, "[data-emergency-vote]")!.textContent).toContain(
      '[congress.band.voting:{"kind":"[congress.emergency.aggression]","name":"jiho","seconds":16}]',
    );
  });

  it("sits below the satellite band", async () => {
    const sat = document.createElement("div");
    sat.setAttribute("data-satellite-band", "");
    sat.getBoundingClientRect = () => ({ bottom: 60 }) as DOMRect;
    document.body.appendChild(sat);
    const { el } = await mount({
      now: 100,
      data: AVAILABLE,
      ballots: [],
      influence: 80,
    });
    expect(q(el, "[data-congress-band]")!.style.top).toBe("64px");
  });
});
```

`tests/client/HudLayout.test.ts`의 `describe` 안 끝에 추가:

```ts
  it("puts the congress cards right above the HUD rows and the band among the overlays", () => {
    const rows = doc.querySelector("[data-bottom-hud-rows]")!;
    const cards = doc.querySelector("congress-cards")!;
    expect(cards).not.toBeNull();
    expect(cards.nextElementSibling).toBe(rows);
    expect(doc.querySelector("satellite-band")!.nextElementSibling!.tagName.toLowerCase()).toBe(
      "congress-band",
    );
  });
```

`tests/client/graphics/GameRendererCreate.test.ts`: `HUD_TAGS`의 `"satellite-target-picker",` 뒤에 `"congress-cards",`와 `"congress-band",`를 더하고, 첫 테스트의 dials 검사 뒤에:

```ts
    // World congress (spec §12): the cards and the band share the bus too.
    for (const tag of ["congress-cards", "congress-band"]) {
      const el = elements.get(tag) as unknown as {
        eventBus: EventBus;
        game: GameView;
      };
      expect(el.eventBus).toBe(eventBus);
      expect(el.game).toBe(game);
    }
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest tests/client/CongressCards.test.ts tests/client/CongressBand.test.ts tests/client/HudLayout.test.ts tests/client/graphics/GameRendererCreate.test.ts --run`
Expected: FAIL — `Cannot find module '../../src/client/hud/congress/CongressCards'`

- [ ] **Step 4: 투표 카드 작성**

`src/client/hud/congress/CongressCards.ts` — `<congress-cards>`(light DOM, `Controller`). 결정 사항:
- `init()`: `OpenDomesticScreenEvent`의 `screen === "congress"`이고 회기가 열려 있으면 그 회기를 펼친다(`expandedSession = session.id`). 알약 탭도 같다.
- `tick()`: `config().congress()`가 아니면 아무것도 안 한다. `newResults(seen, data.history)`마다 도장을 `now + STAMP_TICKS`까지 넣고(최대 3, 지난 것은 버림) `seen = data.history`. 열린 회기에서 내가 찍을 수 있는 카드를 모두 찍은 첫 틱을 `votedAt = { sessionId, tick }`로 기억한다(회기가 없으면 null). 그리고 `requestUpdate()`.
- 접힘: `expandedSession === session.id`면 펼침. 찍을 수 있는 카드가 하나도 없으면 바로 접힘. 아니면 `votedAt`의 회기가 지금 회기이고 `now - votedAt.tick >= COLLAPSE_TICKS`일 때 접힘.
- 그리는 순서(세로, 왼쪽 정렬, `flex flex-col items-start gap-1 pb-1`, 바깥은 `pointer-events-none`, 버튼·카드는 `pointer-events-auto`): 도장들 → 카드들(또는 알약) → 칩 줄(`flex flex-wrap gap-1`).
- 카드(`data-congress-card=${index}`, `w-[min(260px,calc(50vw-16px))] min-h-20`, `text-xs`, 노란 테두리, `bg-gray-900/92`): 첫 줄 `🏛 ${titleText}`(truncate)와 오른쪽 `formatClock(closeTick - now)`(`data-card-seconds`), 둘째 줄 `reasonText`(`data-card-reason`, 회색, truncate), 셋째 줄 A·B 버튼, 넷째 줄 왼쪽에 추가 표 칩 또는 안내, 오른쪽 `congress.card.turnout {voted, total}`(`data-turnout`).
- A·B 버튼(`data-vote`, `data-side` = `good`/`bad`/`none`): 꺼짐 = `!eligible` 또는 (`bOnly`이고 A) 또는 (이미 다른 쪽을 찍음). 고른 쪽은 노란 배경과 `✓`, 추가 표가 있으면 `+n`, `aria-label`에 `congress.card.your_vote {option, extra}`. 내용은 `${option} ${optionLabel}` 한 줄과 `congress.resolution.<id>.<a|b>_effect`(`text-[10px] line-clamp-2`), `favorable`이 있으면 `congress.card.good`/`bad` 한 줄(초록/빨강, 테두리도 같은 색).
- 넷째 줄 왼쪽: `!eligible`이면 `congress.card.no_seat`, 안 찍었고 `bOnly`면 `congress.card.b_only`, 찍었으면 `extraChips(myVote, influence)`마다 `data-extra=${extra}` 버튼(`h-6 px-1`, `congress.card.extra {votes: extra, cost}`, `!affordable`면 꺼짐).
- 탭: 기본 표는 `!eligible`·`myVote !== null`·(`bOnly`이고 A)이면 무시, 아니면 `SendCongressVoteIntentEvent(sessionId, index, option, 0)`. 칩은 `SendCongressVoteIntentEvent(sessionId, index, myVote.option, extra)`(올리기만).
- 알약(`data-congress-pill`, `h-8 px-3 rounded-full`): `congress.card.collapsed {seconds: ceil((closeTick - now)/10), voted: 찍은 카드 수, total: 찍을 수 있는 카드 수}`.
- 도장(`data-congress-stamp`, 카드와 같은 너비, 굵은 테두리): `🏛 ${titleText(result)}`와 `congress.card.adopted {option: optionLabel, a, b}` 또는 `congress.card.tied {a, b}`.
- 칩(`data-congress-chip`, `h-6 px-2 rounded-full text-[11px] whitespace-nowrap`, 나를 겨냥한 것은 호박색 테두리): `${titleText} · ${optionLabel} ${남은 시간}`(남은 시간은 `formatClock(remaining)`, null이면 `congress.chip.until_project`). 탭하면 `OpenDomesticScreenEvent("congress")`.

- [ ] **Step 5: 위쪽 띠 작성**

`src/client/hud/congress/CongressBand.ts` — `<congress-band>`(light DOM, `Controller`). 결정 사항:
- `tick()`: `newResults(seen, data.history)`가 있으면 그것들로 배너를 `now + TOAST_TICKS`까지 세우고 `PlaySoundEffectEvent("click-3")`를 **한 번** 낸다(한 회기의 결과는 같은 틱에 들어오므로 배너 하나·소리 하나). 기한이 지난 배너는 지운다. `requestUpdate()`.
- `render()`: 배너, 소집 가능 줄(살아 있는 내가 볼 때만, `data.available`마다), 긴급 회의 투표 줄(`session.kind === "emergency"`), 진행 중인 비상 줄. 하나도 없으면 아무것도 그리지 않는다. 바깥은 `data-congress-band`, `fixed left-1/2 -translate-x-1/2 z-[1002] w-[min(26rem,calc(100vw-32px))] flex flex-col gap-1 text-white text-sm pointer-events-none`, `style="top: ${top}px"`이고 `top`은 `[data-satellite-band]`가 있으면 그 `getBoundingClientRect().bottom + 4`(반올림), 없으면 8.
- 배너(`data-congress-toast`, 노란 테두리, 줄마다 결과 하나): `congress.toast.adopted {title: titleText, option: optionLabel, a, b}` 또는 `congress.toast.tied {title, a, b}`.
- 소집 가능 줄: 내가 대상이면 `data-available-target`(빨간 띠)에 `congress.band.available_target {kind}`만. 아니면 `data-available="${kind}:${target}"`에 `congress.band.available {name, kind}`와 버튼 `data-convene="${kind}:${target}"`(`h-8 px-3`, `congress.band.convene {cost: CONVENE_COST}`), `conveneState(...)`가 null이 아니면 버튼을 끄고 아래에 `data-convene-reason`으로 `congress.block.<block> {cost: CONVENE_COST}`. 탭하면 `conveneState`를 다시 보고 null일 때만 `SendConveneEmergencyIntentEvent(kind, 대상의 PlayerID)`.
- 긴급 회의 투표 줄(`data-emergency-vote`): `congress.band.voting {kind: congress.emergency.<param>, name: 대상, seconds: ceil((closeTick - now)/10)}`. 투표 카드는 `<congress-cards>`가 그린다.
- 진행 중인 비상 줄(`data-emergency`, `data-emergency-role` = `target`/`member`/`none`): `congress.band.active {kind, name, goal: goalText, time: formatClock(endTick - now)}`, 역할이 있으면 오른쪽에 `congress.band.target`/`congress.band.member`, 아래에 진행 막대(`data-progress`, 너비 `round(progress/goal×100)%`, 최대 100). 대상이면 빨간 배경(`bg-red-800/90 border-red-300`).
- `kind`는 모두 `translateText("congress.emergency.<kind>")`, 이름은 `nameOf`.

- [ ] **Step 6: 페이지와 렌더러에 넣기**

`index.html`:
- 아래 HUD 가운데 열에서 `<tutorial-panel class="hidden w-full"></tutorial-panel>` 바로 뒤(행 상자 `data-bottom-hud-rows` 바로 앞)에:

```html
        <!-- World congress: vote cards and resolution chips, right above the dials. -->
        <congress-cards class="block w-full pointer-events-none"></congress-cards>
```

- `<satellite-band></satellite-band>` 바로 뒤에 `<congress-band></congress-band>`

`src/client/hud/GameRenderer.ts`:
- import: `import { CongressBand } from "./congress/CongressBand";`, `import { CongressCards } from "./congress/CongressCards";`
- `satelliteBand` 연결 뒤에:

```ts
  // World congress (spec §12): vote cards above the dials, the band under the satellite band.
  const congressCards = document.querySelector("congress-cards");
  if (congressCards instanceof CongressCards) {
    congressCards.game = game;
    congressCards.eventBus = eventBus;
  } else {
    console.error("congress cards not found");
  }
  const congressBand = document.querySelector("congress-band");
  if (congressBand instanceof CongressBand) {
    congressBand.game = game;
    congressBand.eventBus = eventBus;
  } else {
    console.error("congress band not found");
  }
```

- `layers`의 `satelliteTargetPicker,` 뒤에:

```ts
    ...(congressCards instanceof CongressCards ? [congressCards] : []),
    ...(congressBand instanceof CongressBand ? [congressBand] : []),
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest tests/client --run && npx vitest tests/LayerBoundaries.test.ts --run && npm run typecheck && npm run lint`
Expected: 모두 PASS, 오류 없음

- [ ] **Step 8: 커밋**

```bash
npx prettier --write src/client/hud/congress index.html src/client/hud/GameRenderer.ts tests/client/CongressFixture.ts tests/client/CongressCards.test.ts tests/client/CongressBand.test.ts tests/client/HudLayout.test.ts tests/client/graphics/GameRendererCreate.test.ts
git add src/client/hud/congress index.html src/client/hud/GameRenderer.ts tests/client/CongressFixture.ts tests/client/CongressCards.test.ts tests/client/CongressBand.test.ts tests/client/HudLayout.test.ts tests/client/graphics/GameRendererCreate.test.ts
git commit -m "feat(congress): vote cards, resolution chips, emergency band and result banner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13: 화면 III — 순위표 🏛 칸, 금지 문구, 연구 할인, 이벤트 문구, 지도 맥박

**Files:**
- Create: `src/client/hud/congress/BanLabels.ts`
- Modify: `src/client/StatsConstants.ts`, `src/client/hud/layers/lib/StatsColumns.ts`, `src/client/components/StatsTable.ts`, `src/client/hud/layers/GameLeftSidebar.ts`
- Modify: `src/client/hud/layers/UnitDisplay.ts`, `src/client/hud/layers/BuildMenu.ts`, `src/client/hud/layers/RadialMenuElements.ts`
- Modify: `src/client/hud/domestic/DomesticStatus.ts`, `src/client/hud/domestic/ResearchScreen.ts`, `src/client/hud/domestic/DomesticPanel.ts`(Task 11 다음, `researchContext`만)
- Modify: `src/client/hud/layers/EventsDisplay.ts`
- Modify: `src/client/render/gl/passes/StrategicFxPass.ts`, `src/client/render/gl/Renderer.ts`, `src/client/render/gl/MapRenderer.ts`, `src/client/WebGLFrameBuilder.ts`
- Modify (test): `tests/client/UnitDisplayHotbar.test.ts`, `tests/client/graphics/layers/BuildMenuReasons.test.ts`, `tests/client/render/gl/StrategicFxPass.test.ts`
- Test: `tests/client/CongressColumn.test.ts`, `tests/client/CongressResearchDiscount.test.ts`, `tests/client/graphics/layers/EventsDisplayCongress.test.ts`

**Interfaces:**
- Consumes: Task 11 `congressFlags`, `flagIcons`, `tests/client/CongressFixture.ts`의 `EMPTY`; Task 4 `resolutionBans(active, smallID, type)`(실제 규칙); Task 1 `BuildableUnit.banned`, `CongressData.discountedTechs`, `TECH_PACT_DISCOUNT_PCT`, `GameView.congressData()`, `Config.congress()`; Task 9 키
- Produces: 칸 id `"congress"`(`COLUMN_IDS`에서 `"nukes"` 바로 뒤, `ColumnDef.congressOnly`), `StatsTable.congress`, `bannedBadge()`, `bannedReason()`, `productionBanned(data, smallID, type)`, `techNodeState(d, researched, id, cost?)`, `ResearchScreenContext.discounted?`, `StrategicFxPass.setCongressTargets(ids)`, `congressPulse(ms)`, `CONGRESS_PULSE_HZ = 0.5`, `Renderer.setCongressPulse(ids)`, `MapRenderer.setCongressPulse(ids)`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/CongressColumn.test.ts`:

```ts
import { CongressData } from "@openfront/engine-api/congress/CongressTypes";
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { columnById } from "../../src/client/hud/layers/lib/StatsColumns";
import { PlayerStats } from "../../src/client/hud/layers/PlayerStats";
import { UserSettings } from "../../src/client/UserSettings";
import type { GameView, PlayerView } from "../../src/client/view";
import { EMPTY } from "./CongressFixture";

function player(id: number, tiles = 100): PlayerView {
  return {
    id: () => `p${id}`,
    smallID: () => id,
    name: () => `p${id}`,
    displayName: () => `p${id}`,
    clanTag: () => null,
    type: () => PlayerType.Human,
    numTilesOwned: () => tiles,
    gold: () => 0n,
    tradeGold: () => 0,
    trainGold: () => 0,
    piracyGold: () => 0,
    goldEarned: () => 0,
    troops: () => 0,
    totalUnitLevels: () => 0,
    isAlive: () => true,
    isOnSameTeam: () => false,
    domesticData: () => null,
    strategicData: () => null,
  } as unknown as PlayerView;
}

function game(players: PlayerView[], data: CongressData | null): GameView {
  return {
    myPlayer: () => players[0],
    playerViews: () => players,
    config: () => ({ maxTroops: () => 100 }),
    ticks: () => 600,
    numLandTiles: () => 1000,
    numTilesWithFallout: () => 0,
    congressData: () => data,
  } as unknown as GameView;
}

const DATA: CongressData = {
  ...EMPTY,
  active: [
    {
      resolution: "sanction",
      option: "A",
      targets: [2],
      param: null,
      sinceTick: 0,
      expires: "next_tally",
    },
  ],
};

describe("congress column", () => {
  beforeEach(() => {
    localStorage.clear();
    (
      UserSettings as unknown as { cache: Map<string, string | null> }
    ).cache.clear();
  });

  it("shows each nation's congress flags, for everyone, and can't be hidden", () => {
    const column = columnById("congress");
    const g = game([player(1), player(2)], DATA);
    expect(column.value?.(player(2), g)).toBe(1);
    expect(column.value?.(player(1), g)).toBe(0);
    expect(column.cell({ position: 1, name: "p2", value: 1 }, g)).toBe("⛔");
    expect(column.cell({ position: 2, name: "p1", value: 0 }, g)).toBe("");
    expect(column.isHideable).toBe(false);
    expect(column.congressOnly).toBe(true);
  });

  it("player stats show it only in congress games, and still rank by land", async () => {
    for (const [on, template] of [
      [true, "34px 80px 100px auto auto auto auto 32px"],
      [false, "34px 80px 100px auto auto auto 32px"],
    ] as const) {
      const stats = new PlayerStats();
      stats.game = game([player(1, 500), player(2)], DATA);
      stats.visible = true;
      stats.congress = on;
      document.body.append(stats);
      stats.refresh();
      await stats.updateComplete;
      expect(
        stats.querySelector(".stats-table-content")?.getAttribute("style"),
      ).toContain(template);
      expect(stats.textContent!.includes("⛔")).toBe(on);
      expect((stats as unknown as { sortKey: string | null }).sortKey).toBe(
        "tiles",
      );
      stats.remove();
    }
  });
});
```

`tests/client/CongressResearchDiscount.test.ts`:

```ts
import { vi } from "vitest";

vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { render } from "lit";
import {
  renderResearchScreen,
  renderTechSheet,
  ResearchScreenContext,
} from "../../src/client/hud/domestic/ResearchScreen";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";

const D: DomesticData = {
  science: 120,
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

function draw(discounted: ResearchScreenContext["discounted"]) {
  const root = document.createElement("div");
  const ctx: ResearchScreenContext = {
    view: new DomesticClientView(D),
    gold: 0n,
    infiniteGold: false,
    selected: "currency",
    armed: null,
    select: () => {},
    arm: () => {},
    isUnitDisabled: (type) => type === UnitType.Satellite,
    research: vi.fn(),
    queue: vi.fn(),
    discounted,
  };
  render([renderResearchScreen(ctx), renderTechSheet(ctx)], root);
  return root;
}

const node = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-tech="${id}"]`)!;

describe("tech pact discount on the research screen", () => {
  test("a discounted tech shows 30% off and can start with that much science", () => {
    const root = draw(["currency"]);
    expect(node(root, "currency").querySelector("[data-node-cost]")!.textContent).toContain(
      'domestic.cost:{"cost":105,',
    );
    expect(
      node(root, "currency").querySelector("[data-node-discount]")!.textContent,
    ).toContain("congress.discounted");
    expect(
      root.querySelector('[data-sheet-action="start"]')!.textContent,
    ).toContain('domestic.tree.start:{"cost":105}');
    expect(node(root, "navigation").querySelector("[data-node-discount]")).toBeNull();
  });

  test("without the pact nothing changes", () => {
    const root = draw(undefined);
    expect(node(root, "currency").querySelector("[data-node-cost]")!.textContent).toContain(
      'domestic.cost:{"cost":150,',
    );
    expect(root.querySelector('[data-sheet-action="start"]')).toBeNull();
    expect(root.querySelector('[data-sheet-action="gold"]')).not.toBeNull();
  });
});
```

`tests/client/graphics/layers/EventsDisplayCongress.test.ts`는 `tests/client/graphics/layers/EventsDisplayStrategic.test.ts`의 `vi.mock` 다섯 개, import, `beforeEach`(가짜 game과 `names`), `description()` 도우미를 그대로 쓰고 본문을 다음으로 한다:

```ts
  it("names the resolution and the adopted option", () => {
    ed.onDisplayMessageEvent({
      type: GameUpdateType.DisplayEvent,
      message: "events_display.congress_adopted_target",
      messageType: 0,
      playerID: null,
      params: { resolution: "sanction", a: 11, b: 9, option: "A", name: "Real" },
      focusPlayerID: 2,
    } as never);
    expect(description()).toBe(
      "events_display.congress_adopted_target|resolution=T(congress.resolution.sanction.name),a=11,b=9,option=T(congress.resolution.sanction.a),name=Silent Falcon",
    );
  });

  it("names the emergency and both players", () => {
    ed.onDisplayMessageEvent({
      type: GameUpdateType.DisplayEvent,
      message: "events_display.congress_emergency_convened",
      messageType: 0,
      playerID: null,
      params: { kind: "nuclear", name: "Real", targetID: 3 },
      focusPlayerID: 2,
    } as never);
    expect(description()).toBe(
      "events_display.congress_emergency_convened|kind=T(congress.emergency.nuclear),name=Silent Falcon,targetID=3,target=Quiet Owl",
    );
  });
```

(`describe` 이름은 `"EventsDisplay world congress messages"`.)

`tests/client/UnitDisplayHotbar.test.ts`:
- 파일 위 import에 `import { CongressData } from "@openfront/engine-api/congress/CongressTypes";`와 `import { EMPTY } from "./CongressFixture";`
- `mount`의 `opts`에 `congress?: CongressData;`, 가짜 `player`에 `smallID: () => 1,`, 가짜 `el.game`에 `congressData: () => opts.congress ?? null,`
- `describe("unit-display build bar")` 안에 추가:

```ts
  it("a unit a resolution bans says so on the icon and the card, and never builds", async () => {
    const { el, uiState } = await mount([
      { ...buildable(UnitType.City), canBuild: false, banned: true },
    ]);
    expect(
      button(el, "city").querySelector("[data-banned]")!.textContent,
    ).toContain("[congress.banned]");
    await tap(el, "city");
    await tap(el, "city");
    expect(uiState.ghostStructure).toBeNull();
    expect(
      card(el)!.querySelector("[data-hotbar-reason]")!.textContent,
    ).toContain("[congress.banned_reason]");
  });

  it("an embargo stops new nukes at the factory while the stock still fires", async () => {
    const { el } = await mount([buildable(UnitType.AtomBomb)], {
      strategic: STRATEGIC(),
      silos: 1,
      factories: [{ id: 5, level: 1 }],
      congress: {
        ...EMPTY,
        active: [
          {
            resolution: "arms_embargo",
            option: "A",
            targets: [1],
            param: null,
            sinceTick: 0,
            expires: "next_tally",
          },
        ],
      },
    });
    await tap(el, "atom_bomb");
    expect(
      card(el)!.querySelector("[data-produce]")!.hasAttribute("disabled"),
    ).toBe(true);
    expect(
      card(el)!.querySelector("[data-produce-reason]")!.textContent,
    ).toContain("[congress.banned_reason]");
    expect(card(el)?.textContent).toContain("[touch_ui.tap_again_to_build]");
  });
```

`tests/client/graphics/layers/BuildMenuReasons.test.ts`의 첫 `describe` 안에 추가:

```ts
  it("a banned unit names the congress, not the gold", async () => {
    const menu = await openMenu(
      [{ ...unit(UnitType.City, false), banned: true } as BuildableUnit],
      1_000_000n,
    );
    expect(
      buttonFor(menu, UnitType.City).querySelector("[data-build-reason]")!
        .textContent,
    ).toContain("[congress.banned_reason]");
    menu.remove();
  });
```

`tests/client/render/gl/StrategicFxPass.test.ts`의 `describe` 안에 추가:

```ts
  test("an emergency target's border pulses slowly, at 0.5 Hz", () => {
    const { pass, advance } = setup();
    pass.setCongressTargets([7]);
    expect(pass.isIdle()).toBe(false);
    pass.updatePulses();
    expect(pass.pulseCount).toBe(1);
    expect(pass.pulseOwners[0]).toBe(7);
    expect(pass.pulseValues[0]).toBeCloseTo(0);
    advance(1000);
    pass.updatePulses();
    expect(pass.pulseValues[0]).toBeCloseTo(1);
    advance(1000);
    pass.updatePulses();
    expect(pass.pulseValues[0]).toBeCloseTo(0);
    pass.setCongressTargets([]);
    pass.updatePulses();
    expect(pass.pulseCount).toBe(0);
    expect(pass.isIdle()).toBe(true);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/CongressColumn.test.ts tests/client/CongressResearchDiscount.test.ts tests/client/graphics/layers/EventsDisplayCongress.test.ts tests/client/UnitDisplayHotbar.test.ts tests/client/graphics/layers/BuildMenuReasons.test.ts tests/client/render/gl/StrategicFxPass.test.ts --run`
Expected: FAIL — `columnById("congress")`가 undefined, `setCongressTargets is not a function` 등

- [ ] **Step 3: 순위표 칸**

- `src/client/StatsConstants.ts`의 `COLUMN_IDS`에서 `"nukes",` 뒤에:

```ts
  // World congress only: always shown there, never offered in the menu.
  "congress",
```

- `src/client/hud/layers/lib/StatsColumns.ts`:
  - `ColumnDef`의 `strategicOnly` 뒤에 `/** Only exists in world-congress games (StatsTable.congress). */ readonly congressOnly?: true;`
  - import: `import { congressFlags, flagIcons } from "../../congress/CongressModel";`
  - `nukes` 칸 정의 뒤에(값이 있어 정렬 가능한 칸은 `width: "auto"`여야 한다 — `tests/StatsColumns.test.ts`; 팀 표에도 정의되지만 의회는 FFA 전용이라 팀 표에 나오지 않는다):

```ts
  // World congress (spec §12): sanctions, embargoes, protectorates, truces,
  // emergencies and protected heritage, as icons. Influence stays private.
  defineColumn({
    id: "congress",
    labelKey: "leaderboard.congress",
    headerVisual: { kind: "text", text: "🏛" },
    isHideable: false,
    congressOnly: true,
    align: "center",
    value: (player, game) =>
      congressFlags(game.congressData(), player.smallID()),
    cell: (row) => flagIcons(row.value),
  }),
```

- `src/client/components/StatsTable.ts`: `strategicWeapons` 속성 뒤에 `/** World congress: show the congress-only columns (the 🏛 flags). */ @property({ type: Boolean }) congress = false;`, `visibleColumns`의 필터에 `(column.congressOnly !== true || this.congress) &&`, 기본 정렬 칸 찾기를 `orderable.find((column) => column.strategicOnly !== true && column.congressOnly !== true)`로.
- `src/client/hud/layers/GameLeftSidebar.ts`: `<player-stats>`에 `.congress=${this.game?.config().congress() === true}`

- [ ] **Step 4: 금지 문구**

`src/client/hud/congress/BanLabels.ts`:

```ts
import { CongressData } from "@openfront/engine-api/congress/CongressTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { resolutionBans } from "@openfront/engine-lib/congress/ResolutionEffects";
import { translateText } from "../../Utils";

/** "🏛 Banned": a banned unit's label on its button (hotbar, radial menu). */
export function bannedBadge(): string {
  return translateText("congress.banned");
}

/** Why a banned unit can't be built: a resolution in force. */
export function bannedReason(): string {
  return translateText("congress.banned_reason");
}

/** Strategic weapons: a resolution stops new production of `type` at my factories (firing from stock never is). */
export function productionBanned(
  data: CongressData | null,
  smallID: number,
  type: UnitType,
): boolean {
  return data !== null && resolutionBans(data.active, smallID, type);
}
```

- `src/client/hud/layers/UnitDisplay.ts`:
  - `private banned(type: UnitType): boolean`(`locked` 옆, `this.playerBuildables?.find((bu) => bu.type === type)?.banned === true`)
  - `cannotBuildReason`의 `if (this.locked(type)) return lockedReason(type);` 뒤에 `if (this.banned(type)) return bannedReason();`
  - `produceReason`의 `if (this.locked(type)) return lockedReason(type);` 뒤에:

```ts
    const me = this.game?.myPlayer();
    if (me && productionBanned(this.game.congressData(), me.smallID(), type)) {
      return bannedReason();
    }
```

  - `renderItem`에서 잠금 표시(`tech !== null ? … : count !== undefined ? …`)의 가운데에 금지 줄을 끼운다: `tech !== null ? (잠금) : this.banned(item.type) ? html\`<span data-banned class="w-full px-0.5 text-[8px] leading-none text-center text-amber-300 truncate">${bannedBadge()}</span>\` : count …`
- `src/client/hud/layers/BuildMenu.ts`: `disabledReason`의 잠금 줄 뒤에 `if (buildableUnit.banned) return bannedReason();`, 이름 뒤 표시를 `${buildableUnit.locked ? " 🔒" : buildableUnit.banned ? " 🏛" : ""}`로.
- `src/client/hud/layers/RadialMenuElements.ts`: `locked` 옆에 `const banned = params.playerActions.buildableUnits.some((bu) => bu.type === item.unitType && bu.banned === true);`, `badge: locked ? lockedBadge(item.unitType) : banned ? bannedBadge() : undefined`, `tooltipItems`의 잠금 항목 뒤에 `banned ? { text: bannedReason(), className: "locked" } : null`.

- [ ] **Step 5: 연구 할인**

- `src/client/hud/domestic/DomesticStatus.ts`: `techNodeState(d, researched, id, cost: number = TECHS[id].cost)` — 안의 `const cost = TECHS[id].cost;` 줄을 지우고 매개변수를 쓴다.
- `src/client/hud/domestic/ResearchScreen.ts`:
  - `ResearchScreenContext`에 `/** World congress, tech pact A: techs that cost 30% less now. */ discounted?: readonly TechId[];`
  - 도우미:

```ts
/** What `id` costs this player now: the tech pact takes 30% off (as Effects.researchCostMilli rounds). */
function techCost(ctx: ResearchScreenContext, id: TechId): number {
  const base = TECHS[id].cost;
  if (ctx.discounted?.includes(id) !== true) return base;
  return Math.round((base * (100 + TECH_PACT_DISCOUNT_PCT)) / 100);
}
```

  (`TECH_PACT_DISCOUNT_PCT`는 `@openfront/engine-lib/congress/CongressBalance`에서 import.)
  - `TECHS[id].cost`를 쓰는 세 곳(`costText`, 시트의 `domestic.tree.start`, `renderGoldButton`의 부족분)을 `techCost(ctx, id)`로, `techNodeState(...)`를 부르는 두 곳에 넷째 인자 `techCost(ctx, id)`를 넣는다.
  - 노드의 `data-node-cost` 줄 바로 뒤에, 할인 중이면 `<span data-node-discount class="text-[10px] font-bold text-amber-300">${translateText("congress.discounted")}</span>`.
- `src/client/hud/domestic/DomesticPanel.ts`의 `researchContext` 반환 객체에 `discounted: this.game.congressData()?.discountedTechs ?? [],`

- [ ] **Step 6: 이벤트 문구**

`src/client/hud/layers/EventsDisplay.ts`의 `resolveParams`에서 `victory_project_` 블록 뒤(이름 다시 고치기 앞)에:

```ts
    // World congress: ids in the params become names (Task 9 keys).
    if (event.message.startsWith("events_display.congress_")) {
      const id = params.resolution;
      if (typeof id === "string") {
        params = {
          ...params,
          resolution: translateText(`congress.resolution.${id}.name`),
        };
        if (params.option === "A" || params.option === "B") {
          params = {
            ...params,
            option: translateText(
              `congress.resolution.${id}.${params.option.toLowerCase()}`,
            ),
          };
        }
      }
      if (typeof params.kind === "string") {
        params = {
          ...params,
          kind: translateText(`congress.emergency.${params.kind}`),
        };
      }
    }
```

- [ ] **Step 7: 지도 맥박**

- `src/client/render/gl/passes/StrategicFxPass.ts`:

```ts
/** World congress: an emergency target's border pulses this slowly (spec §12). */
export const CONGRESS_PULSE_HZ = 0.5;

/** Border pulse 0..1 at `ms` on the frame clock, starting dark. */
export function congressPulse(ms: number): number {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * CONGRESS_PULSE_HZ * ms) / 1000);
}
```

  클래스에 `private congressTargets: readonly number[] = [];`와 `setCongressTargets(ownerIDs: readonly number[]): void`, `isIdle()`에 `&& this.congressTargets.length === 0`, `updatePulses()`의 카운트다운 반복 뒤(`this.pulseCount = n;` 앞)에: 대상마다 `n < MAX_PULSES`이고 이미 이번 프레임에 넣은 주인이 아니면 `pulseOwners[n] = id; pulseValues[n] = congressPulse(this.timeFn()); n++`.
- `src/client/render/gl/Renderer.ts`: `setStrategicFx` 뒤에 `/** World congress: emergency targets' borders pulse. */ setCongressPulse(ownerIDs: readonly number[]): void { this.strategicFxPass.setCongressTargets(ownerIDs); }`
- `src/client/render/gl/MapRenderer.ts`: 같은 자리에 `setCongressPulse(ownerIDs: readonly number[]): void { this.renderer?.setCongressPulse(ownerIDs); }`
- `src/client/WebGLFrameBuilder.ts`: 필드 `private congressPulseTarget = 0;`, `update()`의 `this.syncStrategic(gameView);` 뒤에 `this.syncCongress(gameView);`, 메서드:

```ts
  /** World congress (spec §12): the emergency target's border pulses slowly. */
  private syncCongress(gameView: GameView): void {
    if (!gameView.config().congress()) return;
    const target = gameView.congressData()?.emergency?.target ?? 0;
    if (target === this.congressPulseTarget) return;
    this.congressPulseTarget = target;
    this.view.setCongressPulse(target === 0 ? [] : [target]);
  }
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest tests/client tests/StatsColumns.test.ts tests/WebGLFrameBuilder.cosmetics.test.ts tests/WebGLFrameBuilder.explosionParams.test.ts tests/WebGLFrameBuilder.effectOverrides.test.ts tests/LayerBoundaries.test.ts --run && npm run typecheck && npm run lint`
Expected: 모두 PASS, 오류 없음

- [ ] **Step 9: 커밋**

```bash
FILES="src/client/hud/congress/BanLabels.ts src/client/StatsConstants.ts src/client/hud/layers/lib/StatsColumns.ts src/client/components/StatsTable.ts src/client/hud/layers/GameLeftSidebar.ts src/client/hud/layers/UnitDisplay.ts src/client/hud/layers/BuildMenu.ts src/client/hud/layers/RadialMenuElements.ts src/client/hud/domestic/DomesticStatus.ts src/client/hud/domestic/ResearchScreen.ts src/client/hud/domestic/DomesticPanel.ts src/client/hud/layers/EventsDisplay.ts src/client/render/gl/passes/StrategicFxPass.ts src/client/render/gl/Renderer.ts src/client/render/gl/MapRenderer.ts src/client/WebGLFrameBuilder.ts tests/client/CongressColumn.test.ts tests/client/CongressResearchDiscount.test.ts tests/client/graphics/layers/EventsDisplayCongress.test.ts tests/client/UnitDisplayHotbar.test.ts tests/client/graphics/layers/BuildMenuReasons.test.ts tests/client/render/gl/StrategicFxPass.test.ts"
npx prettier --write $FILES
git add $FILES
git commit -m "feat(congress): leaderboard flags, ban labels, tech pact cost, event names, emergency border pulse

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 14: 결정성 — 스냅샷 변형, 대본 인텐트, 켬 고정값

**Files:**
- Modify (test): `tests/util/ScriptedGame.ts`, `tests/core/snapshot/FullGameSnapshot.test.ts`, `tests/VanillaDigest.test.ts`

**Interfaces:**
- Consumes: 모든 갈래를 합친 엔진(Task 1~8), `Congress.session()`(`id`, `items`), `Congress.available()`(`kind`, `target`), `Congress.history()`, 인텐트 `congress_vote`·`convene_emergency`, Task 1의 `CONGRESS_ONLY_TYPES`
- Produces: FullGameSnapshot 변형 `"congress"`(2,600틱), VanillaDigest 고정값 `"domestic mode with the world congress"`

- [ ] **Step 1: 대본 사람의 의회 인텐트**

`tests/util/ScriptedGame.ts`의 `playIntent`에서 전략 무기 블록 바로 뒤에(의회가 없는 게임은 여기서 굴리지 않으므로 다른 변형과 VanillaDigest의 PRNG 흐름은 그대로다):

```ts
  // World congress games only, on the same terms: ballots (some with extra
  // votes, some refused for a seat, a side switch or an old session) and
  // convening whatever is available.
  if (game.config().congress() && rand.chance(3)) {
    const intent = congressIntent(game, rand);
    if (intent !== null) return intent;
  }
```

파일 끝(`nearbyWater` 앞)에:

```ts
/** One world-congress intent: a ballot on the open session, or convening an available emergency. */
function congressIntent(game: Game, rand: PseudoRandom): Intent | null {
  const c = game.congress();
  if (c === null) return null;
  const s = c.session();
  if (s !== null) {
    return {
      type: "congress_vote",
      session: s.id,
      item: rand.nextInt(0, s.items.length),
      option: rand.chance(2) ? "A" : "B",
      extra: rand.nextInt(0, 3),
    };
  }
  const a = pick(rand, c.available());
  if (a === null) return null;
  const target = game.playerBySmallID(a.target);
  if (!target.isPlayer()) return null;
  return { type: "convene_emergency", kind: a.kind, target: target.id() };
}
```

- [ ] **Step 2: FullGameSnapshot 의회 변형**

`tests/core/snapshot/FullGameSnapshot.test.ts`:
- `TICKS` 아래에:

```ts
// The congress variant runs past the first regular session (open at 1800,
// tally at 2100) and the first resolutions' effects.
const CONGRESS_TICKS = 2600;
```

- `CONGRESS_ONLY_TYPES` 정의(Task 1) 뒤에:

```ts
// Congress types the scripted game isn't sure to keep alive at a tick
// boundary: a ballot or a convening finishes inside its init. Emergencies
// also need a threshold crossed. tests/congress/*.test.ts cover their
// snapshots.
const CONGRESS_UNSCRIPTED_TYPES = ["CongressVote", "ConveneEmergency"];
```

- `Reference`에 `congressResults: number;`, `playReference(start: GameStartInfo, ticks: number)`로 바꾸고 반복 조건 `< TICKS`를 `< ticks`로, 반환 객체에 `congressResults: runner.game.congress()?.history().length ?? 0,`
- `VARIANTS`의 타입을 `[string, Partial<GameConfig>, number?][]`로, 끝에:

```ts
  // The world congress: sessions, the AI's and the scripted humans' ballots,
  // extra votes, resolutions in force and convening.
  ["congress", { domesticMode: true, congress: true }, CONGRESS_TICKS],
```

- `describe.each(VARIANTS)("full game snapshots: %s", (_, overrides, ticks = TICKS) => {`로, `playReference(start)`를 `playReference(start, ticks)`로, 두 번째 테스트의 `while (runner.game.ticks() < TICKS)`를 `< ticks`로.
- "every execution type" 테스트의 `if` 사슬에서 `overrides.domesticMode === true` 분기 **앞에**:

```ts
      } else if (overrides.congress === true) {
        // The first session was tallied.
        expect(reference.congressResults).toBeGreaterThan(0);
        expected = CONGRESS_ONLY_TYPES.filter(
          (name) => !CONGRESS_UNSCRIPTED_TYPES.includes(name),
        );
```

Run: `npx vitest tests/core/snapshot/FullGameSnapshot.test.ts -t "congress" --run`
Expected: 4 tests PASS. 실패하면 `diffSnapshots`가 가리키는 필드(대개 `restoreState`가 빠뜨린 필드나 `DERIVED_FIELDS`에 없는 캐시)를 그 필드를 가진 Task의 파일에서 고친다.

- [ ] **Step 3: 의회를 켠 게임의 고정값**

`tests/VanillaDigest.test.ts`의 `describe` 끝에:

```ts
  // World congress on (domestic FFA): pins the congress engine. A change here
  // means the congress's simulation changed: update only on purpose.
  test("domestic mode with the world congress", async () => {
    expect(await digest({ domesticMode: true, congress: true })).toBe(
      "0000000000000000",
    );
  }, 60_000);
```

Run: `npx vitest tests/VanillaDigest.test.ts -t "world congress" --run`
Expected: FAIL — `expected '<16자리 값>' to be '0000000000000000'`. 그 값을 `toBe`에 넣는다.

Run: `npx vitest tests/VanillaDigest.test.ts --run` 를 두 번
Expected: 두 번 모두 12 tests PASS(같은 값 = 결정적). 다른 고정값은 하나도 바뀌지 않았다.

- [ ] **Step 4: 커밋**

```bash
npx prettier --write tests/util/ScriptedGame.ts tests/core/snapshot/FullGameSnapshot.test.ts tests/VanillaDigest.test.ts
git add tests/util/ScriptedGame.ts tests/core/snapshot/FullGameSnapshot.test.ts tests/VanillaDigest.test.ts
git commit -m "test(congress): full-game snapshot variant, scripted ballots, congress digest pin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 15: 전체 검증, 시뮬레이션, 실제 화면 확인

**Files:**
- Modify: `scripts/domestic-sim.ts` (`--congress`)
- 확인용 파일 `/tmp/congress-check/vite.congress.config.ts`와 저장소 루트의 `congress-check.mjs`는 커밋하지 않는다(`congress-check.mjs`는 Playwright를 찾으려면 저장소 안에 있어야 한다).

**Interfaces:**
- Consumes: 모든 Task
- Produces: 주인에게 넘길 확인 결과(테스트, 시뮬레이션 숫자, 스크린샷)

- [ ] **Step 1: 전체 테스트, 타입, 린트, 결정성 검사**

```bash
npm test 2>&1 | tail -15
npm run typecheck
npm run lint
grep -rnE "Math\.(random|pow|exp|log|sin|cos|tan|atan2)|Date\.now|new Date" packages/engine/src/congress packages/engine-lib/src/congress packages/engine/src/execution/nation/NationCongressBehavior.ts
git diff c15d18e17 --stat
```

Expected: 모든 테스트 PASS(`tests/VanillaDigest.test.ts` 12 tests, `tests/NationGoldPerMinute.test.ts` 스냅샷, `tests/core/snapshot/FullGameSnapshot.test.ts` 9개 변형 포함), typecheck·lint 오류 없음, `grep` 출력 없음.

- [ ] **Step 2: 시뮬레이션에 `--congress`**

`scripts/domestic-sim.ts`:
- 머리 주석 사용법에 `[--congress]`, `Options`에 `congress: boolean`(기본 false), `parseArgs`에 `case "--congress": opts.congress = true; break;`, `gameConfig`에 `...(opts.congress ? { congress: true } : {}),`
- import `ResultData`(`@openfront/engine-api/congress/CongressTypes`), 그리고:

```ts
/** Every congress result as it is tallied (the history keeps only the last 8). */
function sampleCongress(game: Game, seen: Map<string, ResultData>): void {
  for (const r of game.congress()?.history() ?? []) {
    const key = `${r.sessionId}:${r.resolution}:${r.targets.join(",")}:${r.param ?? ""}`;
    if (!seen.has(key)) seen.set(key, r);
  }
}

interface CongressSummary {
  sessions: number;
  adopted: number;
  tied: number;
  emergenciesConvened: number;
  emergenciesDeclared: number;
  sanctionsAdopted: number;
  sanctionsTotal: number;
}

function summarizeCongress(results: readonly ResultData[]): CongressSummary {
  const regular = results.filter((r) => r.kind === "regular");
  const emergency = results.filter((r) => r.kind === "emergency");
  const sanctions = regular.filter((r) => r.resolution === "sanction");
  return {
    sessions: new Set(regular.map((r) => r.sessionId)).size,
    adopted: regular.filter((r) => r.adopted !== null).length,
    tied: regular.filter((r) => r.adopted === null).length,
    emergenciesConvened: emergency.length,
    emergenciesDeclared: emergency.filter((r) => r.adopted === "A").length,
    sanctionsAdopted: sanctions.filter((r) => r.adopted === "A").length,
    sanctionsTotal: sanctions.length,
  };
}
```

- `runSeed`: `const congress = new Map<string, ResultData>();`, 1초 표본(`if (game.ticks() % 10 === 0)`) 블록에 `sampleCongress(game, congress);`, 반환에 `congress: [...congress.values()]`
- `main`: `opts.congress`일 때 판마다 `formatTable(["sessions", "adopted", "tied", "emergencies", "declared", "sanctions A"], [[…summarizeCongress(results)의 값, sanctions는 "adopted/total"]])`를 찍고, 끝에 전체 합으로 `emergencies per game`(목표 0~2)와 `sanction adoption`(목표 50% 이상)을 `ok`/`miss`와 함께 찍는다.

Run(오래 걸리므로 백그라운드로): `npx tsx scripts/domestic-sim.ts --congress --map world --seeds 3 --minutes 30 --difficulty Hard > /tmp/congress-sim.txt 2>&1`
Expected: 오류 없이 끝나고, 판마다 정기 회기 9~10회, 비상 판당 0~2회, 제재 채택률 50% 이상. 목표를 벗어나도 수치를 바꾸지 않고 숫자를 주인 보고에 그대로 적는다(spec §16.3: 친구들과 한 판 뒤 조정).

```bash
npx prettier --write scripts/domestic-sim.ts
npx tsc --noEmit
git add scripts/domestic-sim.ts
git commit -m "chore(sim): --congress prints sessions, adoptions, emergencies and sanctions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: 별도 포트(9400)의 Vite 클라이언트로 실제 화면 확인(자동)**

실제 서버가 3000~3002와 9000을 쓰고 있다. 이 확인은 **그 포트를 열지도, 그 서버에 요청하지도 않는다.** 혼자 하기 게임은 브라우저 안에서 돌므로 Vite 클라이언트만 있으면 된다.

```bash
ss -ltn | grep -E ':(9400|9401) ' && echo "port busy: stop and ask" || echo free
mkdir -p /tmp/congress-check
cat > /tmp/congress-check/vite.congress.config.ts <<'EOF'
// The worktree's dev config on port 9400, with every route to ports
// 3000-3002 (the owner's running server) pointed at a closed port and the
// create-game middleware (which POSTs straight to 3001+) dropped.
import type { UserConfig } from "vite";
import base from "/home/eser/dev/OpenFrontIO-wc/vite.config.ts";

const DEAD = "localhost:39999";

export default (env: { mode: string; command: string }) => {
  const config = (base as (e: typeof env) => UserConfig)(env);
  config.plugins = (config.plugins ?? [])
    .flat()
    .filter(
      (p) =>
        !(p && typeof p === "object" && "name" in p) ||
        (p as { name: string }).name !== "random-worker-create-proxy",
    );
  config.server = {
    ...config.server,
    port: 9400,
    strictPort: true,
    open: false,
    hmr: { port: 9401 },
    proxy: {
      "/lobbies": { target: `ws://${DEAD}`, ws: true },
      "/w0": { target: `ws://${DEAD}`, ws: true },
      "/w1": { target: `ws://${DEAD}`, ws: true },
      "/api": { target: `http://${DEAD}` },
    },
  };
  return config;
};
EOF
(cd /home/eser/dev/OpenFrontIO-wc && SKIP_BROWSER_OPEN=true npx vite --config /tmp/congress-check/vite.congress.config.ts > /tmp/congress-check/vite.log 2>&1 &)
timeout 120 bash -c 'until curl -sf http://localhost:9400 >/dev/null; do sleep 1; done' && echo up
```

`run-openfront` 스킬의 Playwright 준비(`bash .claude/skills/run-openfront/setup.sh`, 이미 했으면 생략)를 마친 뒤 저장소 루트에 `congress-check.mjs`를 만든다. 앞부분(`launch`, 한국어 `ko-KR`와 `localStorage.lang = "ko"`, `requestAnimationFrame` 간격 2,500ms, `failIfMajorPerformanceCaveat` 끄기, 3000~3002·9000으로 가는 요청 차단, `/api`·`/selfhost-api` 404, 로비 웹소켓 무시, `pageerror` 수집, "혼자 하기" 열기)은 `docs/superpowers/plans/2026-10-16-strategic-weapons.md` Task 14 Step 2의 `strategic-check.mjs`와 같고(주소만 `http://localhost:9400`, 스크린샷 폴더 `/tmp/congress-check/shots`), 그 뒤는 다음이다:

```js
await page.evaluate(() => {
  const modal = document.querySelector("single-player-modal");
  modal.domesticMode = true;
  modal.congress = true;
  modal.infiniteGold = true;
  modal.bots = 10;
});
await page.waitForTimeout(500);
const modalText = await page.evaluate(
  () => document.querySelector("single-player-modal")?.textContent ?? "",
);
await page.screenshot({ path: `${OUT}/1-solo-modal.png` });
await page
  .locator('o-button[translationKey="game_settings.start"] button:visible')
  .first()
  .click();
await waitForGameReady(page);
await spawn(page);
await waitForSpawnPhaseEnd(page);
await page.waitForTimeout(4000 + RAF);

const dial = await page.evaluate(() => {
  const d = document.querySelector('[data-dial="congress"]');
  const r = d?.getBoundingClientRect();
  return {
    present: d !== null,
    state: d?.getAttribute("data-state") ?? "",
    caption:
      document.querySelector("[data-congress-influence]")?.textContent?.trim() ??
      "",
    size: r ? [Math.round(r.width), Math.round(r.height)] : [],
    horizontalScroll:
      document.documentElement.scrollWidth > window.innerWidth,
  };
});
await page.screenshot({ path: `${OUT}/2-hud.png` });

// The dial opens the congress screen in the drawer.
await page.locator('[data-dial="congress"]').click();
await page.waitForTimeout(1000 + RAF);
const screenShown =
  (await page.locator('[data-domestic-drawer][data-screen="congress"]').count()) === 1;
await page.screenshot({ path: `${OUT}/3-congress-screen.png` });
await page.locator('[data-dial="congress"]').click();
await page.waitForTimeout(500 + RAF);

// The first session opens 3 minutes after the start: wait for its cards.
const cardsShown = await page
  .waitForSelector("[data-congress-card]", { timeout: 240_000 })
  .then(() => true)
  .catch(() => false);
await page.screenshot({ path: `${OUT}/4-cards.png` });
let voted = false;
if (cardsShown) {
  await page.locator('[data-congress-card="0"] [data-vote]:not([disabled])').first().click();
  voted = await page
    .waitForSelector('[data-congress-card="0"] [data-vote][aria-pressed="true"]', {
      timeout: 10_000,
    })
    .then(() => true)
    .catch(() => false);
  await page.screenshot({ path: `${OUT}/5-voted.png` });
}
const toastShown = await page
  .waitForSelector("[data-congress-toast]", { timeout: 40_000 })
  .then(() => true)
  .catch(() => false);
await page.screenshot({ path: `${OUT}/6-result.png` });

const report = {
  toggleShown: modalText.includes("세계 의회"),
  dial,
  screenShown,
  cardsShown,
  voted,
  toastShown,
  errors,
};
console.log(JSON.stringify(report, null, 2));
await browser.close();
const ok =
  report.toggleShown &&
  dial.present &&
  dial.caption.includes("🗳") &&
  !dial.horizontalScroll &&
  screenShown &&
  cardsShown &&
  voted &&
  toastShown &&
  errors.length === 0;
process.exit(ok ? 0 : 1);
```

Run: `node congress-check.mjs`
Expected: JSON에 `toggleShown: true`, `dial.present: true`, `dial.caption`에 "🗳", `horizontalScroll: false`, `screenShown: true`, `cardsShown: true`, `voted: true`, `toastShown: true`, `errors: []`, 종료 코드 0(약 5분). 스크린샷 6장을 열어 확인한다: 혼자 하기 설정에 "세계 의회" 토글이 있다, 🏛 다이얼이 트로피 자리 뒤 국정 다이얼 줄 끝에 같은 크기로 있고 아래에 "🗳 n"이 있다, 서랍에 의회 화면(영향력, 다음 회기, 현행 결의, 비상, 순위, 지난 결과)이 지도를 다 덮지 않고 열린다, 카드가 다이얼 줄 바로 위 왼쪽에 있고 지도 가운데와 공격 비율 줄을 가리지 않는다, 고른 쪽에 ✓와 추가 표 칩이 보인다, 마감 뒤 화면 위에 결과 배너가 3초 보인다.

정리:

```bash
pkill -f "vite --config /tmp/congress-check/vite.congress.config.ts"
rm congress-check.mjs
ss -ltn | grep -E ':(9400|9401) ' || echo "9400 closed"
git status --short
```

Expected: `git status`가 깨끗하다. 이 호스트에서 Playwright가 동작하지 않으면 이 Step은 건너뛰고 그 사실을 기록한 뒤, 아래 Step 4를 주인에게 넘긴다.

- [ ] **Step 4: 주인이 실제 태블릿으로 확인할 목록**

자동 확인은 터치, 여러 사람, 비상을 흉내 내지 않는다. 주인이 자기 서버(평소처럼 실행)에서 친구와 방을 만들어 확인한다:
1. 방 만들기에서 내정 모드를 켜면 "세계 의회" 토글이 함께 켜지고(팀전에서는 보이지 않는다) 참가 화면 요약에 "세계 의회: 켜짐"이 보인다. 끈 판에는 🏛 다이얼, 순위표 🏛 칸, 카드, 띠가 없다.
2. 시작 3분 뒤 회기가 열리면 카드가 2~3장 뜨고, 한 번 탭으로 투표하고 "+1 10 · +2 30 …" 칩으로 추가 표를 올릴 수 있으며, 다 찍으면 5초 뒤 알약으로 접힌다. 다른 사람이 무엇을 찍었는지는 어디에도 보이지 않는다(투표 수만).
3. 30초 뒤 카드에 "채택 A · 11 : 9" 도장이 3초 남고, 화면 위 배너와 의사봉 소리가 한 번, 이벤트 기록에 한 줄이 남는다. 진 쪽 영향력은 돌아온다.
4. 제재가 채택되면 그 나라의 무역선·기차·화물기가 멈추고 순위표에 ⛔가 보이며, 금지된 건물은 단축바·건설 메뉴·원형 메뉴에 "🏛 금지됨"이 보인다. 휴전 결의가 채택되면 두 나라의 진행 중인 공격과 바다 위 수송선이 손실 없이 돌아온다.
5. 한 나라가 핵을 두 번 넘게 쓰면 위쪽 띠에 "🚨 … 긴급 회의를 소집할 수 있습니다 [소집 · 🗳50]"가 뜨고, 한 번 탭으로 소집하면 모두에게 20초 투표 카드가 뜬다. 대상은 B만 누를 수 있다. 통과하면 띠에 목표·남은 시간·막대가 보이고 대상 국경이 천천히 빨갛게 깜빡인다.
6. 세계 정부가 100%가 되었는데 승인되지 않았으면 이기지 않고 "비준 대기"로 기다리고, 승인이 채택되면 그 초에 이긴다.
7. 휴대폰 가로에서도 카드·띠·서랍의 버튼이 손가락으로 누르기 쉽고 화면이 옆으로 밀리지 않는다.

- [ ] **Step 5: 마무리 커밋(수정이 있었다면)**

Step 1~4에서 고친 파일이 있으면 그 파일만 `git add <파일>`로 올리고 `fix(congress): <무엇을>` 메시지(끝 줄은 Global Constraints의 Co-Authored-By)로 커밋한다.
