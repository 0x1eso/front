# 확장 전쟁 (5단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로비 옵션 하나(`warfareExpansion`, 기본 꺼짐)로 해안 포대, 해안 포격, 공항(공수 투입·폭격·화물 항공로), 군함 조정, SAM의 항공기 요격을 켜고, 일반 모드와 내정 모드 모두에서 AI·화면·번역·밸런스 시뮬레이션까지 갖춘다.

**Architecture:** 수치와 순수 규칙(사거리, 연사 간격, 비용 상수, 경로)은 `packages/engine-lib/src/warfare/Warfare.ts`에 두고 엔진과 화면이 같이 쓴다. 엔진은 새 `UnitType` 6개를 맨 뒤에 추가하고, 새 실행(Execution) 6개를 `packages/engine/src/warfare/`에 둔다. 원작 경로는 `Config.warfareExpansion()`이 거짓이면 새 코드가 아무것도 읽거나 굴리지 않게 짜서, 옵션을 끄면 시뮬레이션이 비트 단위로 같다(`tests/VanillaDigest.test.ts`). 내정 모드와의 연결은 기존 장치(기술 `unlocks`, `Structures`의 건설비·건설 시간, `nukeCost`, `domesticTradeGold`, `AttackExecution`의 전투 보정·"공격 중" 조건)를 그대로 타게 해서 별도 분기를 거의 만들지 않는다.

**Tech Stack:** TypeScript 6, Vitest 4, zod + zbin, Lit + Tailwind 4, WebGL2, jq, tsx, Python 3 + Pillow(아틀라스 그림), rsvg-convert + ImageMagick(아이콘 아틀라스)

**Spec:** `docs/superpowers/specs/2026-10-15-domestic-system-design.md` §14b "별도 트랙: 확장 전쟁 (5단계)"(커밋 `843dc8a20` 기준: 공항 300만 → 600만 → 900만 상한). 이 계획은 §14b 전체와, 주인이 확정한 아래 "결정 사항" 1~4번을 구현한다. 내정 모드 쪽 규칙(§4 기술, §5 법, §7 보정값, §10.5 연결 지점)은 이미 구현된 것을 그대로 쓴다.

---

## 시작 전에 (환경)

- 작업 위치는 git worktree `/home/eser/dev/OpenFrontIO-war`(브랜치 `warfare`)다. 시작 커밋은 `843dc8a20`이다. 내정 모드 1~3단계, 태블릿 UI, 포크 정비가 모두 들어 있다.
- **`/home/eser/dev/OpenFrontIO`에는 손대지 않는다.** 그 checkout에서 실제 서버가 돌고 있고, 포트 3000~3002와 9000을 쓴다. 이 계획의 어떤 명령도 그 포트를 열거나 그 서버에 요청하지 않는다(브라우저 확인은 Task 18의 별도 포트 9300을 쓴다).
- 의존성이 없으면 `npm ci --ignore-scripts --engine-strict=false`로 설치한다(`npm install` 금지).
- 단일 테스트 실행: `npx vitest tests/warfare/<File>.test.ts --run`
- 커밋 전에 바꾼 파일에 `npx prettier --write <files>`를 실행한다.
- `tests/core/snapshot/FullGameSnapshot.test.ts`는 변형마다 월드 맵 1,500틱을 돌려서 느리다(변형 하나에 1~3분). Task 2~8에서는 `-t "free for all"`로 FFA 변형만 돌린다.

## 결정 사항 (spec이 정하지 않았거나 주인이 확정한 것)

1. **(주인 확정) 옵션 하나:** `GameConfig.warfareExpansion?: boolean`(기본 꺼짐) 하나가 전부를 켠다. 꺼져 있으면 새 유닛 6종은 `Config.isUnitDisabled`로 막히고, 군함·SAM 수치도 원작 그대로다.
2. **(주인 확정) 해안 포대는 무역선을 쏘지 않는다.** 대상은 우호(동맹·팀)가 아닌 수송선과 군함뿐이다. 수송선을 먼저, 그다음 가까운 순서로 쏜다.
3. **(주인 확정) 군함 조정은 둘뿐:** 옵션을 켜면 군함 포탄 피해 −40%(×0.6, 정수 내림), 연사 간격 +50%(20틱 → 30틱). 목표 우선순위와 그 밖의 군함 동작은 그대로다.
4. **(주인 확정) 공항:** 비용 `min(9,000,000, (n+1) × 3,000,000)`(n은 보유 공항 레벨 합과 지은 횟수 중 작은 값, 업그레이드 포함: 300만 → 600만 → 900만). 건설 60초. 범위 `150 + 30 × (레벨 − 1)`칸(유클리드). 출격 횟수는 레벨당 1회, 쓰면 300틱(30초) 뒤 다시 찬다(미사일 기지 슬롯과 같은 대기열 방식). 공수 투입과 폭격이 같은 횟수를 나눠 쓴다. 업그레이드로 늘어난 칸은 미사일 기지처럼 대기 상태로 시작한다.
5. **(주인 확정) 폭격:** 비용 75만(원자폭탄과 같고, 내정 모드의 `nukeCost` 보정도 같이 받는다), 범위 안쪽 8·바깥 18. 낙진 없음(땅은 주인 없는 땅이 될 뿐 낙진·물이 되지 않는다, `waterNukes`여도 마찬가지). 나머지는 원자폭탄 규칙 그대로다: 바깥 반경까지 땅을 잃고(안쪽은 전부, 바깥 고리는 50%), 병력은 `nukeDeathFactor(AtomBomb)`로 죽고, 반경 안의 유닛(핵·SAM 미사일·폭격기·포격 표식 제외)은 파괴되며, 동맹은 `listNukeBreakAlliance`(8/18)로 깨진다. 내 땅과 우호국 땅은 겨냥할 수 없다. 공항 범위 안에서 출격 횟수가 남은 가장 가까운 공항에서 뜬다.
6. **(주인 확정) SAM:** 옵션을 켜면 수송기와 폭격기도 요격한다(핵과 같은 궤적 기반 조준). 폭격기는 요격당할 때마다 50%로 피한다. 판정은 `bomberEvades(tick, unitId)` = `new PseudoRandom(tick * 31 + unitId).chance(2)`(시드 고정 PRNG). 피하면 미사일만 사라지고 `targetedBySAM` 표시를 지워서 재장전된 SAM이 다시 노릴 수 있다. 화물기는 요격 대상이 아니다.
7. **(주인 확정) 공수 투입:** 새 명령 `paradrop {troops, dst}`. 비용 금 10만(`TransportPlane`의 유닛 비용, 내정 보정 없음) + 병력(화면이 `공격 비율 × 병력`을 보낸다). 대상은 땅이면서 내 땅·우호국 땅이 아니어야 하고(`canAttackPlayer`), 출격 횟수가 남은 공항 범위 안이어야 한다. 착지하면 그 칸에서 반경 2칸 안의, 대상(또는 주인 없는) 땅을 차지하고 그 칸들 전부에서 `AttackExecution`을 시작한다. 비행 중 그 칸이 내 땅·우호국 땅이 되면 병력은 돌아온다. 격추되면 병력을 잃는다.
8. **(주인 확정) 화물 항공로:** 자동 무역, 격추 대상 아님. 다 지은 공항마다 300틱마다 레벨 수만큼 화물기를 보낸다. 상대는 다른 주인의 공항 중 둘 다 `canTrade`(금수 조치, 고립주의)이고 거리 ≤ 두 공항 범위 중 작은 값인 곳에서 시드 PRNG로 고른다. 도착하면 양쪽 각각 `cargoGold(거리) = 20,000 + 100 × 거리`(× 금 배율)를 `domesticTradeGold(…, "cargo")`로 보정해 받는다(무역 `trade`·`allGold`·외국 무역·동맹 무역 보정, 화물기 전용 보정 없음). 무역 수익(`addTradeGold`)으로 센다. 비행 중 목적지 공항이 사라지거나 주인이 같아지거나 무역이 막히면 화물기는 돈 없이 사라진다.
9. **해안 포대 수치(spec에 없음):** 비용 `min(1,000,000, (n+1) × 250,000)`, 건설 10초, 업그레이드 가능, 사거리 40칸(spec). 쏘는 간격 `max(10, floor(30 / 레벨))`틱(1레벨 3초, 2레벨 1.5초, 3레벨 이상 1초). 포탄은 기존 `ShellExecution`(피해 200~300, 군함 최대 체력 1000이라 4~5발, 수송선은 체력이 없어 한 발). 짓는 자리는 항구 규칙(`portSpawn`: 탭한 곳 근처의 내 해안 칸)을 그대로 쓴다. 체력은 없고 핵·폭격(반경 안 유닛 파괴)과 해안 포격(착탄 3칸 안)에 파괴된다.
10. **해안 포격 세부(spec에 없음):** 핵처럼 `build_unit {unit: "Coastal Barrage"}`로 쏜다. 조준점에서 200칸(유클리드) 안의, 장전된 가장 가까운 미사일 기지가 슬롯 1개를 쓴다. 비용 30만(+내정 `nukeCost` 보정). 포탄 8발은 5틱 간격(4초)으로 기지에서 일직선으로 6칸/틱씩 날아간다. **첫 발은 조준점에**, 나머지 7발은 시드 PRNG로 반경 12칸 안 지도 위 칸에 떨어진다(조준한 포대는 확실히 맞도록). 착탄마다 3칸 안의 우호국이 아닌 해안 포대를 파괴한다. 조준점에 `CoastalBarrage` 표식 유닛을 두고, 마지막 착탄 때 `reachedTarget`을 켠다. 그때부터 200틱 동안 반경 12칸 안에서 쏜 사람과 우호국이 아닌 방어자의 방어 기지 효과가 꺼지고, 그 칸을 공격하는 쪽의 손실이 ×0.6이 된다. 그 뒤 표식이 사라진다. 표식은 핵과 폭격에 지워지지 않는다. SAM이 요격하지 않는다. 포탄 그림은 기존 `Shell`을 그대로 쓴다.
11. **비행:** 수송기·폭격기·화물기는 `straightFlightPath`(일직선, 3칸/틱)로 난다. 수송기·폭격기의 궤적은 모든 칸이 요격 가능(`targetable: true`)이다. 위치는 핵처럼 motion plan으로 화면에 보낸다. 착지·폭발 칸에 그 비행기를 노리는 SAM 미사일이 있으면 핵과 같이 한 틱 기다린다.
12. **내정 모드 연결(주인 확정 7항목):** (1) 해금: 해안 포격 ← `rocketry`, 해안 포대 ← `fortification`, 공항·폭격기·수송기 ← `industrialization`(새 기술 없음). 잠긴 유닛은 단축바·건설 메뉴·원형 메뉴에 기존 자물쇠와 기술 이름으로 보인다. (2) 해안 포대·공항은 `Structures`라 `buildCost`(인프라 투자, 산업화, 공산주의) 보정을 받고, 해안 포격·폭격은 `DOMESTIC_COST_STAT`의 `nukeCost`(핵 억지력)를 받는다. (3) 두 건물의 건설 시간은 `domesticConstructionTicks`(공기 단축 등)를 받는다. (4) 화물 항공로는 `domesticTradeGold`와 `canTrade`(고립주의·금수)를 따른다. (5) 공수 투입은 `AttackExecution`이라 전투 보정과 "공격 중" 조건(전쟁 피로, 평화 배당, 세계 정부 선포 정지)에 들어가고, 해안 포격과 폭격은 들어가지 않는다(핵과 같음). (6) 폭격은 승리 프로젝트 건물을 파괴할 수 있고, 두 건물은 핵·폭격에 파괴된다. (7) AI 성향: 정복가는 공항·폭격·포격을 더, 신앙 수호자는 해안 포대를 더 쓰고, 프로젝트를 위해 금을 모으는 동안(`nationHoldsStructuresForProject`)은 아무것도 짓거나 쏘지 않는다. 옵션을 켜도 내정 모드가 꺼져 있으면 내정 연결 코드는 하나도 돌지 않고(전부 `player.domestic()`이 null), 옵션을 꺼도 내정 모드는 그대로다.
13. **AI:** `NationWarfareBehavior`(별도 PRNG, 옵션을 켰을 때만 만든다)가 국가의 행동 틱마다 한 번 돈다. 쉬움: 위협받는 해안에 포대만. 보통 이상: 금이 남으면 공항, 출격 가능하면 바다 건너(국경을 맞대지 않은) 적의 가장 큰 건물에 폭격 또는 공수 투입. 어려움 이상: 자기 수송선이 해안 포대 사거리 안으로 상륙하러 가면 그 포대에 해안 포격. 작은 봇은 쓰지 않는다(`NationExecution`만 가진다).
14. **화면:** 단축바는 행정청 뒤에 해안 포대·공항, 다탄두 미사일 뒤에 해안 포격·폭격(단축키 없음). 건설 메뉴 표에 같은 넷. 공수 투입은 원형 메뉴의 공격 하위 메뉴(핵·폭격 옆) 항목. 미리보기는 기존 두 번 탭 확인 흐름에 반경(포대 40, 공항 범위, 포격 12, 폭격 18)과 직선 궤적(폭격: SAM 위협 표시, 포격: 위협 없음)을 더한다. 사거리 원(`WarfareRingPass`)은 해안 포대·공항·포격·폭격을 고르거나 카드를 열었을 때 보이고, 포격 구역은 항상 보인다. 알림은 기존 `MessageType`을 재사용한다(새 enum 값 없음). 로비의 "유닛 끄기" 목록과 단축키는 바꾸지 않는다.
15. **밸런스 시뮬레이션:** `scripts/warfare-sim.ts`는 AI 국가만으로 세계 지도를 옵션 끔/켬으로 같은 시드에 돌려 아시아 출발 국가의 승률·생존·땅 비율과 게임 시간, 새 유닛 사용 횟수를 출력한다. 결과는 기록만 하고 수치는 바꾸지 않는다.

## Global Constraints

- **옵션 끔 = 원작과 비트 단위로 같음:** `warfareExpansion`이 없거나 거짓이면 시뮬레이션 결과가 지금과 같아야 한다. `tests/VanillaDigest.test.ts`의 두 고정값(`c330352312204618`, `cc52cbbfd8b1a3bc`), `tests/core/snapshot/FullGameSnapshot.test.ts`의 기존 변형, `tests/NationGoldPerMinute.test.ts` 스냅샷이 그대로 통과해야 한다. 원작 경로에서 새 코드는 PRNG를 굴리지 않고(`NationExecution`의 공용 PRNG, `ScriptedGame`의 PRNG 포함) 새 키를 스냅샷에 쓰지 않는다.
- **결정성:** `packages/engine*`에서 `Math.random`, `Date.now`, `new Date`, `Math.pow/exp/log/sin/atan2…`, 2가 아닌 지수의 `**`를 쓰지 않는다(`Math.sqrt`, `Math.round`, `Math.floor`, `Math.ceil`은 허용). 난수는 `PseudoRandom`(시드 고정)만 쓴다. 폭격기 50% 회피도 `PseudoRandom`이다.
- **zbin·와이어는 뒤에만 추가:** 새 `UnitType` 값, 새 인텐트(`paradrop`), 새 `GameConfig` 필드는 각 목록의 맨 뒤에 추가한다. `warfareExpansion`은 optional이다. 새 `MessageType` 값은 만들지 않는다.
- **스냅샷:** 새 Execution은 모두 `packages/engine/src/snapshot/ExecutionRegistry.ts`에 등록하고 `snapshot`/`restoreSnapshot`을 갖는다. `restoreSnapshot`은 프로토타입만 있는 객체를 채우므로 모든 필드를 직접 대입한다(필드 초기화식에 기대지 않는다). 새 스냅샷 키는 optional이고 값이 없으면 쓰지 않는다. `FullGameSnapshot.test.ts`에는 `WARFARE_ONLY_TYPES`/`WARFARE_UNSCRIPTED_TYPES`를 두고 `warfare` 변형을 더한다(Task 10).
- **패키지 경계(`tests/LayerBoundaries.test.ts`):** `engine-api`는 zod/zbin/resources만, `engine-lib`는 여기에 `engine-api`, `engine`은 여기에 `engine-lib`. `src/client`는 `engine`을 import하지 않는다. 홈 화면 청크와 `LazyModals` 규칙(CLAUDE.md)을 지킨다(이 계획은 홈 화면에서 게임 클라이언트를 정적으로 import하지 않는다).
- **화면 문구:** 모두 `translateText()`를 거치고 키는 `resources/lang/en.json`(키 정렬 필수)과 `resources/lang/ko.json` 둘 다 추가한다. 다른 언어 파일은 건드리지 않는다.
- **태블릿 우선 UI:** 누르는 요소는 44px 이상, 호버로만 보이는 정보 없음, 지도에 놓거나 쏘는 것은 `BuildPreviewController`의 두 번 탭 확인(조준 → 확인 → 350ms → 아이콘 탭)을 그대로 쓰고 반경·궤적·SAM 위협을 미리 보여 준다.
- **지도 그림:** 건물 아이콘은 `resources/atlases/icon-atlas.png`의 9·10번째 칸(0부터 8·9열, 원래 8칸은 바이트 그대로)에, 원본 SVG는 `resources/atlases/src/`에 같은 흰 실루엣 방식으로 둔다. 이동 유닛 그림은 `resources/atlases/unit-atlas.png` 뒤에 13px 회색조 칸으로 붙인다(수송기, 폭격기, 화물기). 포격 포탄은 기존 `Shell` 그림을 쓴다.
- **엔진 변경에는 테스트가 따른다**(CLAUDE.md). 내정 모드와 함께 켠 게임(`domesticMode: true, warfareExpansion: true`)의 테스트를 각 기능 Task에 둔다.

## Review Focus

1. **옵션을 명시적으로 끈 로비(`warfareExpansion: false`):** 필드가 없는 원작과 결과가 같아야 한다. 테스트: Task 1 `tests/VanillaDigest.test.ts` "FFA with the warfare option explicitly off".
2. **비행 중에 착지 칸의 주인이 바뀜(내 땅이 되거나 동맹이 됨):** 공수 병력은 공격 없이 돌아와야 하고, 아무 땅도 빼앗지 않아야 한다. 테스트: Task 6 "an ally's landing zone sends the troops home".
3. **비행 중 무역이 막힘(금수 조치, 공항 점령):** 화물기는 돈 없이 사라지고 오류가 없어야 한다. 테스트: Task 8 "an embargo mid-flight drops the cargo unpaid"·"a captured destination airport gets no flight".
4. **지도 가장자리 조준:** 반경 12칸이 지도 밖으로 나가도 모든 포탄이 지도 안 칸에 떨어져야 한다. 테스트: Task 4 "aimed at a corner, every shell lands on the map".
5. **SAM 사거리 안으로 들어온 폭격기:** 요격이 맞으면 아무것도 터지지 않고(땅·병력 그대로), 피하면 미사일만 사라지고 목표에서 터져야 하며, SAM이 쏘는 중에 저장/복원해도 같게 흘러야 한다(목표 칸에 미사일이 오는 중이면 폭격기는 한 틱 기다린다). 테스트: Task 7 "a SAM shoots down a bomber that doesn't evade: no crater"·"an evading bomber gets through and detonates"·"survives a snapshot mid-flight under SAM fire".

## 병렬 실행 그룹

- **Task 1**이 모두의 선행 조건이다.
- **엔진 Task 2→3→4→5→6→7→8은 차례로** 한다. `ConstructionExecution.ts`, `ExecutionRegistry.ts`, `PlayerImpl.ts`, `FullGameSnapshot.test.ts`를 함께 고친다.
- Task 8 뒤에는 서로 겹치는 파일이 없는 네 갈래를 **병렬**로 할 수 있다:
  - 갈래 A: Task 9(AI, `nation/`과 `NationExecution.ts`) → Task 10(스냅샷 변형, `ScriptedGame.ts`) → Task 17(시뮬레이션, `scripts/`)
  - 갈래 B: Task 11(번역, `resources/lang/*`만)
  - 갈래 C: Task 12(로비 모달과 요약)
  - 갈래 D: Task 13(HUD·아이콘 SVG·`CREDITS.md`) → Task 15(아틀라스·렌더 타입·`UnitPass`·셰이더, 역시 `CREDITS.md`) → Task 14(미리보기, `Renderer.ts`) → Task 16(사거리 원, `Renderer.ts`). Task 14와 16은 Task 15의 `UT_*` 상수를 쓰고 둘 다 `Renderer.ts`를 고친다.
- **Task 18**(전체 검증)은 맨 마지막이다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `packages/engine-api/src/game/GameTypes.ts` (수정) | `UnitType` 6개 추가, `Structures`/`BuildableAttacks`/`PlayerBuildable` |
| `packages/engine-api/src/Schemas.ts` (수정) | `GameConfig.warfareExpansion`, `ParadropIntent` |
| `packages/engine-lib/src/warfare/Warfare.ts` (새) | 확장 전쟁 수치와 순수 규칙(엔진·화면 공용) |
| `packages/engine-lib/src/configuration/Config.ts` (수정) | `warfareExpansion()`, `isUnitDisabled`, `unitInfo` |
| `packages/engine-lib/src/domestic/Techs.ts` (수정) | 해금 3개 기술에 새 유닛 |
| `packages/engine/src/configuration/EngineConfig.ts` (수정) | 비용, `nukeCost` 보정, 군함 조정, 화물 금 |
| `packages/engine/src/game/Game.ts`, `PlayerImpl.ts`, `UnitImpl.ts` (수정) | 유닛 매개변수, 배치 규칙, 공항 출격 칸 |
| `packages/engine/src/warfare/FlightPath.ts` (새) | 일직선 비행 경로 |
| `packages/engine/src/warfare/BarrageZone.ts` (새) | 포격 구역 판정 |
| `packages/engine/src/warfare/Interception.ts` (새) | 폭격기 회피 판정 |
| `packages/engine/src/warfare/CoastalBatteryExecution.ts` (새) | 포대 자동 포격 |
| `packages/engine/src/warfare/CoastalBarrageExecution.ts` (새) | 포격 8발, 포대 파괴, 구역 |
| `packages/engine/src/warfare/AirportExecution.ts` (새) | 출격 칸 재장전, 화물기 출발 |
| `packages/engine/src/warfare/ParadropExecution.ts` (새) | 수송기 비행과 착지 |
| `packages/engine/src/warfare/BombingExecution.ts` (새) | 폭격기 비행과 폭발 |
| `packages/engine/src/warfare/CargoPlaneExecution.ts` (새) | 화물기 비행과 지급 |
| `packages/engine/src/execution/*` (수정) | `ConstructionExecution`, `ShellExecution`, `AttackExecution`, `NukeExecution`, `SAMLauncherExecution`, `SAMMissileExecution`, `ExecutionManager`, `NationExecution` |
| `packages/engine/src/domestic/DomesticEconomy.ts` (수정) | `domesticTradeGold`의 `"cargo"` |
| `packages/engine/src/execution/nation/NationWarfareBehavior.ts` (새) | AI |
| `packages/engine/src/snapshot/ExecutionRegistry.ts` (수정) | 등록 |
| `src/server/ConfigPatch.ts` (수정) | 호스트가 바꿀 수 있는 로비 키 |
| `src/client/HostLobbyModal.ts`, `SinglePlayerModal.ts`, `utilities/LobbySettingsSummary.ts` (수정) | 로비 토글과 요약 |
| `src/client/hud/...`, `src/client/Transport.ts`, `src/client/controllers/BuildPreviewController.ts` (수정) | 단축바, 건설 메뉴, 원형 메뉴, 명령, 미리보기 |
| `src/client/render/...` (수정·새) | 아이콘·유닛 그림, `WarfareRingPass`, `FlightTrajectory` |
| `resources/atlases/*`, `resources/images/*IconWhite.svg` (수정·새) | 그림 |
| `resources/lang/en.json`, `ko.json` (수정) | 문구 |
| `scripts/warfare-sim.ts` (새) | 밸런스 시뮬레이션 |
| `tests/warfare/*.test.ts`, `tests/warfare/util.ts` (새), 기존 테스트 일부 (수정) | 테스트 |

---
### Task 1: 옵션, 새 유닛 종류, 비용, 배치 규칙, 내정 해금

**Files:**
- Modify: `packages/engine-api/src/game/GameTypes.ts` (`UnitType`, `Structures`, `BuildableAttacks`, `PlayerBuildable`)
- Modify: `packages/engine-api/src/Schemas.ts` (`GameConfigSchema.warfareExpansion`)
- Create: `packages/engine-lib/src/warfare/Warfare.ts`
- Modify: `packages/engine-lib/src/configuration/Config.ts`
- Modify: `packages/engine-lib/src/domestic/Techs.ts`
- Modify: `packages/engine/src/configuration/EngineConfig.ts` (`unitCost`, `DOMESTIC_COST_STAT`)
- Modify: `packages/engine/src/game/Game.ts` (`UnitParamsMap`)
- Modify: `packages/engine/src/game/PlayerImpl.ts` (`canSpawnUnitType`, 새 배치 함수)
- Modify: `packages/engine/src/execution/ConstructionExecution.ts` (`isStructure`)
- Modify: `src/server/ConfigPatch.ts` (`COPIED_KEYS`)
- Create: `tests/warfare/util.ts`
- Test: `tests/warfare/WarfareOption.test.ts`
- Modify (test): `tests/VanillaDigest.test.ts`, `tests/server/ConfigPatch.test.ts`, `tests/zbin/wire.test.ts`, `tests/domestic/Techs.test.ts`

**Interfaces:**
- Consumes: 내정 `grantTechs`, `grantLaws`, `conquerRect`(`tests/domestic/util.ts`), `setup`(`tests/util/Setup.ts`)
- Produces:
  - `UnitType.CoastalBattery = "Coastal Battery"`, `Airport = "Airport"`, `CoastalBarrage = "Coastal Barrage"`, `Bomber = "Bomber"`, `TransportPlane = "Transport Plane"`, `CargoPlane = "Cargo Plane"`
  - `GameConfig.warfareExpansion?: boolean`, `Config.warfareExpansion(): boolean`
  - `packages/engine-lib/src/warfare/Warfare.ts`: `WARFARE_ONLY_UNITS`, `COASTAL_BATTERY_RANGE`(40), `COASTAL_BATTERY_COST_STEP`, `COASTAL_BATTERY_COST_MAX`, `COASTAL_BATTERY_BUILD_TICKS`, `coastalBatteryFireInterval(level: number): number`, `WARSHIP_SHELL_DAMAGE_PCT`(60), `WARSHIP_SHELL_RATE_PCT`(150), `BARRAGE_COST`, `BARRAGE_SILO_RANGE`(200), `BARRAGE_SHELLS`(8), `BARRAGE_SHELL_SPACING_TICKS`(5), `BARRAGE_RADIUS`(12), `BARRAGE_BATTERY_KILL_RADIUS`(3), `BARRAGE_SUPPRESSION_TICKS`(200), `BARRAGE_ATTACKER_LOSS_FACTOR`(0.6), `BARRAGE_SHELL_SPEED`(6), `AIRPORT_COST_STEP`, `AIRPORT_COST_MAX`, `AIRPORT_BUILD_TICKS`(600), `airportRange(level: number): number`, `AIRPORT_SORTIE_COOLDOWN_TICKS`(300), `PLANE_SPEED`(3), `PARADROP_GOLD`, `PARADROP_RADIUS`(2), `BOMB_COST`, `BOMB_INNER`(8), `BOMB_OUTER`(18), `BOMBER_EVADE_ODDS`(2), `CARGO_INTERVAL_TICKS`(300), `cargoGold(distance: number): number`
  - `PlayerImpl.barrageSpawn(tile): TileRef | false`, `airportSortieSpawn(tile): TileRef | false`, `bomberSpawn(tile): TileRef | false`, `paradropSpawn(tile): TileRef | false` (모두 `canBuild`가 부른다)
  - `UnitParamsMap`: `CoastalBarrage {targetTile}`, `Bomber {targetTile, trajectory}`, `TransportPlane {troops, targetTile, trajectory}`, `CargoPlane {targetUnit}`, 두 건물은 `{}`
  - 테스트 유틸 `tests/warfare/util.ts`: `RED`, `BLUE`, `NATION`, `own(game, id, x0, y0, w, h): Player`, `warfareGame(map, config?, humans?): Promise<Game>`

- [ ] **Step 1: 테스트 유틸 작성**

`tests/warfare/util.ts`:

```ts
import {
  PlayerID,
  PlayerInfo,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { Game, Player } from "@openfront/engine/game/Game";
import { conquerRect } from "../domestic/util";
import { setup } from "../util/Setup";

export const RED = new PlayerInfo("red", PlayerType.Human, null, "red_id");
export const BLUE = new PlayerInfo("blue", PlayerType.Human, null, "blue_id");
export const NATION = new PlayerInfo(
  "nation",
  PlayerType.Nation,
  null,
  "nation_id",
);

/**
 * A test map game with expanded warfare on. Maps (tests/testdata/maps):
 * "plains" 100x100 land, "big_plains" 200x200 land, "half_land_half_ocean"
 * 16x16 with land at x 0-7 and sea at x 8-15 (shore tiles at x = 7).
 */
export async function warfareGame(
  map: string,
  config: Partial<GameConfig> = {},
  humans: PlayerInfo[] = [RED, BLUE],
): Promise<Game> {
  return setup(map, { warfareExpansion: true, ...config }, humans);
}

/** The player `id`, owning the given rectangle. */
export function own(
  game: Game,
  id: PlayerID,
  x0: number,
  y0: number,
  width: number,
  height: number,
): Player {
  const player = game.player(id);
  conquerRect(game, player, x0, y0, width, height);
  return player;
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/warfare/WarfareOption.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  airportRange,
  cargoGold,
  coastalBatteryFireInterval,
  WARFARE_ONLY_UNITS,
} from "@openfront/engine-lib/warfare/Warfare";
import { Game, Player } from "@openfront/engine/game/Game";
import { grantLaws, grantTechs } from "../domestic/util";
import { setup } from "../util/Setup";
import { BLUE, own, RED, warfareGame } from "./util";

const cost = (game: Game, player: Player, type: UnitType): bigint =>
  game.unitInfo(type).cost(game, player);

describe("the warfareExpansion option", () => {
  test("off by default: all six units are disabled and none can be built", async () => {
    const game = await setup("plains", {}, [RED, BLUE]);
    const red = own(game, RED.id, 0, 0, 30, 30);
    own(game, BLUE.id, 60, 0, 30, 30);
    red.addGold(100_000_000n);
    red.buildUnit(UnitType.MissileSilo, game.ref(5, 5), {});
    red.buildUnit(UnitType.Airport, game.ref(20, 20), {});

    expect(game.config().warfareExpansion()).toBe(false);
    expect(WARFARE_ONLY_UNITS.size).toBe(6);
    for (const type of WARFARE_ONLY_UNITS) {
      expect(game.config().isUnitDisabled(type), type).toBe(true);
      expect(red.canBuild(type, game.ref(70, 10)), type).toBe(false);
    }
  });

  test("on: the six units are enabled", async () => {
    const game = await warfareGame("plains");
    expect(game.config().warfareExpansion()).toBe(true);
    for (const type of WARFARE_ONLY_UNITS) {
      expect(game.config().isUnitDisabled(type), type).toBe(false);
    }
  });

  test("unit costs: battery 250K steps to 1M, airport 3M → 6M → 9M counting upgrades", async () => {
    const game = await warfareGame("plains");
    const red = own(game, RED.id, 0, 0, 60, 60);
    red.addGold(1_000_000_000n);

    expect(cost(game, red, UnitType.CoastalBarrage)).toBe(300_000n);
    expect(cost(game, red, UnitType.Bomber)).toBe(750_000n);
    expect(cost(game, red, UnitType.TransportPlane)).toBe(100_000n);
    expect(cost(game, red, UnitType.CargoPlane)).toBe(0n);
    expect(cost(game, red, UnitType.CoastalBattery)).toBe(250_000n);
    expect(cost(game, red, UnitType.Airport)).toBe(3_000_000n);

    const airport = red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    expect(cost(game, red, UnitType.Airport)).toBe(6_000_000n);
    red.upgradeUnit(airport);
    expect(cost(game, red, UnitType.Airport)).toBe(9_000_000n);
    red.buildUnit(UnitType.Airport, game.ref(40, 40), {});
    expect(cost(game, red, UnitType.Airport)).toBe(9_000_000n);

    for (let i = 0; i < 4; i++) {
      red.buildUnit(UnitType.CoastalBattery, game.ref(5 + 12 * i, 55), {});
    }
    expect(cost(game, red, UnitType.CoastalBattery)).toBe(1_000_000n);
  });

  test("rules shared with the client", () => {
    expect(airportRange(1)).toBe(150);
    expect(airportRange(2)).toBe(180);
    expect(airportRange(4)).toBe(240);
    expect(coastalBatteryFireInterval(1)).toBe(30);
    expect(coastalBatteryFireInterval(2)).toBe(15);
    expect(coastalBatteryFireInterval(3)).toBe(10);
    expect(coastalBatteryFireInterval(7)).toBe(10);
    expect(cargoGold(60)).toBe(26_000);
  });
});

describe("where warfare units can go", () => {
  test("a coastal battery only on the owner's shore", async () => {
    const game = await warfareGame("half_land_half_ocean");
    const red = own(game, RED.id, 0, 0, 8, 8);
    own(game, BLUE.id, 0, 8, 8, 8);
    red.addGold(10_000_000n);
    expect(red.canBuild(UnitType.CoastalBattery, game.ref(7, 3))).toBe(
      game.ref(7, 3),
    );
    expect(red.canBuild(UnitType.CoastalBattery, game.ref(2, 3))).toBe(false);
    expect(red.canBuild(UnitType.CoastalBattery, game.ref(7, 12))).toBe(false);
  });

  test("a barrage needs a loaded silo within 200 tiles and an enemy target", async () => {
    const game = await warfareGame("big_plains");
    const red = own(game, RED.id, 0, 0, 30, 30);
    const blue = own(game, BLUE.id, 100, 100, 100, 100);
    red.addGold(10_000_000n);
    const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});

    expect(red.canBuild(UnitType.CoastalBarrage, game.ref(150, 150))).toBe(
      silo.tile(),
    );
    // 254 tiles away
    expect(red.canBuild(UnitType.CoastalBarrage, game.ref(190, 190))).toBe(
      false,
    );
    // own land
    expect(red.canBuild(UnitType.CoastalBarrage, game.ref(20, 20))).toBe(false);
    red.createAllianceRequest(blue)?.accept();
    expect(red.canBuild(UnitType.CoastalBarrage, game.ref(150, 150))).toBe(
      false,
    );
  });

  test("bombing and paradrops need a free sortie from an airport in range", async () => {
    const game = await warfareGame("big_plains");
    const red = own(game, RED.id, 0, 0, 30, 30);
    own(game, BLUE.id, 100, 100, 100, 100);
    red.addGold(100_000_000n);
    const airport = red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    const near = game.ref(110, 110); // 141 tiles
    const far = game.ref(150, 150); // 198 tiles

    expect(red.canBuild(UnitType.Bomber, near)).toBe(airport.tile());
    expect(red.canBuild(UnitType.TransportPlane, near)).toBe(airport.tile());
    expect(red.canBuild(UnitType.Bomber, far)).toBe(false);
    expect(red.canBuild(UnitType.TransportPlane, game.ref(20, 20))).toBe(false);

    red.upgradeUnit(airport);
    red.upgradeUnit(airport); // level 3: 210 tiles, the new sorties reload first
    airport.reloadMissile();
    airport.reloadMissile();
    expect(red.canBuild(UnitType.Bomber, far)).toBe(airport.tile());

    airport.launch();
    airport.launch();
    airport.launch();
    expect(airport.isInCooldown()).toBe(true);
    expect(red.canBuild(UnitType.Bomber, near)).toBe(false);
  });
});

describe("expanded warfare in domestic mode", () => {
  test("each unit waits for its tech", async () => {
    const game = await warfareGame("half_land_half_ocean", {
      domesticMode: true,
    });
    const red = own(game, RED.id, 0, 0, 8, 16);
    red.addGold(100_000_000n);
    const locked = (t: UnitType) => red.isUnitLocked(t);

    for (const type of [
      UnitType.CoastalBattery,
      UnitType.CoastalBarrage,
      UnitType.Airport,
      UnitType.Bomber,
      UnitType.TransportPlane,
    ]) {
      expect(locked(type), type).toBe(true);
    }
    expect(locked(UnitType.CargoPlane)).toBe(false);
    expect(red.canBuild(UnitType.CoastalBattery, game.ref(7, 3))).toBe(false);
    expect(
      red.buildableUnits(null).find((b) => b.type === UnitType.Airport)
        ?.locked,
    ).toBe(true);

    grantTechs(red, "fortification");
    expect(locked(UnitType.CoastalBattery)).toBe(false);
    expect(red.canBuild(UnitType.CoastalBattery, game.ref(7, 3))).toBe(
      game.ref(7, 3),
    );
    grantTechs(red, "industrialization");
    expect(locked(UnitType.Airport)).toBe(false);
    expect(locked(UnitType.Bomber)).toBe(false);
    expect(locked(UnitType.TransportPlane)).toBe(false);
    expect(locked(UnitType.CoastalBarrage)).toBe(true);
    grantTechs(red, "rocketry");
    expect(locked(UnitType.CoastalBarrage)).toBe(false);
  });

  test("structure and strike cost modifiers apply as for buildings and nukes", async () => {
    const game = await warfareGame("plains", { domesticMode: true });
    const red = own(game, RED.id, 0, 0, 30, 30);
    grantLaws(red, { construction: "A", nuclear: "A" });

    expect(cost(game, red, UnitType.Airport)).toBe(2_250_000n);
    expect(cost(game, red, UnitType.CoastalBattery)).toBe(187_500n);
    expect(cost(game, red, UnitType.CoastalBarrage)).toBe(240_000n);
    expect(cost(game, red, UnitType.Bomber)).toBe(600_000n);
    expect(cost(game, red, UnitType.TransportPlane)).toBe(100_000n);
  });

  test("with the option off, domestic mode is as before", async () => {
    const game = await setup("plains", { domesticMode: true }, [RED]);
    const red = own(game, RED.id, 0, 0, 30, 30);
    grantTechs(red, "rocketry", "fortification", "industrialization");
    expect(red.isUnitLocked(UnitType.MissileSilo)).toBe(false);
    for (const type of WARFARE_ONLY_UNITS) {
      expect(game.config().isUnitDisabled(type), type).toBe(true);
    }
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest tests/warfare/WarfareOption.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine-lib/warfare/Warfare'`

- [ ] **Step 4: 유닛 종류와 묶음 추가**

`packages/engine-api/src/game/GameTypes.ts`의 `enum UnitType`에서 `AdminOffice = "Admin Office",` 줄 바로 뒤(닫는 `}` 앞)에 추가:

```ts
  // Expanded warfare (GameConfig.warfareExpansion, spec §14b). Always
  // appended: the wire and snapshots encode UnitType by position.
  CoastalBattery = "Coastal Battery",
  Airport = "Airport",
  CoastalBarrage = "Coastal Barrage",
  Bomber = "Bomber",
  TransportPlane = "Transport Plane",
  CargoPlane = "Cargo Plane",
```

같은 파일에서 세 묶음을 바꾼다. `BuildableAttacks`:

```ts
export const BuildableAttacks = unitTypeGroup([
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRV,
  UnitType.Warship,
  UnitType.CoastalBarrage,
  UnitType.Bomber,
] as const);
```

`Structures`(`UnitType.AdminOffice,` 뒤에 두 줄):

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
  UnitType.CoastalBattery,
  UnitType.Airport,
] as const);
```

`PlayerBuildable`:

```ts
export const PlayerBuildable = unitTypeGroup([
  ...BuildMenus.types,
  UnitType.TransportShip,
  UnitType.TransportPlane,
] as const);
```

- [ ] **Step 5: 로비 설정 필드**

`packages/engine-api/src/Schemas.ts`의 `GameConfigSchema`에서 `conquestPercent: zb ... .optional(),` 블록 바로 뒤(닫는 `});` 앞)에 추가:

```ts
  // Expanded warfare (this fork, spec §14b): coastal battery, coastal
  // barrage, airport (paradrop, bombing, cargo routes), warship tuning and
  // SAMs that hit planes. Off by default; works with and without domestic
  // mode.
  warfareExpansion: z.boolean().optional(),
```

`src/server/ConfigPatch.ts`의 `COPIED_KEYS`에서 `"domesticMode",` 뒤에 `"warfareExpansion",`를 추가한다.

- [ ] **Step 6: 수치와 공용 규칙**

`packages/engine-lib/src/warfare/Warfare.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";

/**
 * Expanded warfare (GameConfig.warfareExpansion, spec §14b): starting
 * values and the pure rules the engine and the client share.
 */

/** Units that exist only with the option on (Config.isUnitDisabled). */
export const WARFARE_ONLY_UNITS: ReadonlySet<UnitType> = new Set([
  UnitType.CoastalBattery,
  UnitType.Airport,
  UnitType.CoastalBarrage,
  UnitType.Bomber,
  UnitType.TransportPlane,
  UnitType.CargoPlane,
]);

// --- Coastal battery ---
/** Tiles from the battery within which it shells enemy boats and warships. */
export const COASTAL_BATTERY_RANGE = 40;
export const COASTAL_BATTERY_COST_STEP = 250_000;
export const COASTAL_BATTERY_COST_MAX = 1_000_000;
export const COASTAL_BATTERY_BUILD_TICKS = 10 * 10;

/** Ticks between shots: 3 s at level 1, faster per level, never under 1 s. */
export function coastalBatteryFireInterval(level: number): number {
  return Math.max(10, Math.floor(30 / Math.max(1, level)));
}

// --- Warships (option on only) ---
/** Percent of its rolled damage a warship's shell deals (−40%). */
export const WARSHIP_SHELL_DAMAGE_PCT = 60;
/** Percent of the vanilla time between a warship's shots (+50%). */
export const WARSHIP_SHELL_RATE_PCT = 150;

// --- Coastal barrage ---
export const BARRAGE_COST = 300_000;
/** Most tiles between the firing silo and the aimed tile. */
export const BARRAGE_SILO_RANGE = 200;
export const BARRAGE_SHELLS = 8;
/** 8 shells 5 ticks apart: the salvo lasts 4 seconds. */
export const BARRAGE_SHELL_SPACING_TICKS = 5;
export const BARRAGE_RADIUS = 12;
/** Coastal batteries this close to a shell's impact are destroyed. */
export const BARRAGE_BATTERY_KILL_RADIUS = 3;
/** After the last shell the zone keeps defenses down this long (20 s). */
export const BARRAGE_SUPPRESSION_TICKS = 20 * 10;
/** Attacker losses on a suppressed tile (−40%). */
export const BARRAGE_ATTACKER_LOSS_FACTOR = 0.6;
/** Tiles a barrage shell flies per tick. */
export const BARRAGE_SHELL_SPEED = 6;

// --- Airport ---
export const AIRPORT_COST_STEP = 3_000_000;
export const AIRPORT_COST_MAX = 9_000_000;
export const AIRPORT_BUILD_TICKS = 60 * 10;
export const AIRPORT_BASE_RANGE = 150;
export const AIRPORT_RANGE_PER_LEVEL = 30;

/** How far an airport's planes reach (euclidean tiles). */
export function airportRange(level: number): number {
  return AIRPORT_BASE_RANGE + AIRPORT_RANGE_PER_LEVEL * (Math.max(1, level) - 1);
}

/** A used sortie comes back after 30 s; an airport has one per level. */
export const AIRPORT_SORTIE_COOLDOWN_TICKS = 30 * 10;
/** Tiles a plane flies per tick. */
export const PLANE_SPEED = 3;

// --- Paradrop ---
export const PARADROP_GOLD = 100_000;
/** The landing takes the target's land this close to the drop tile. */
export const PARADROP_RADIUS = 2;

// --- Bombing ---
export const BOMB_COST = 750_000;
export const BOMB_INNER = 8;
export const BOMB_OUTER = 18;
/** 1 in N: a bomber evades each SAM interception with 50%. */
export const BOMBER_EVADE_ODDS = 2;

// --- Cargo air routes ---
/** Each finished airport sends `level` cargo flights this often. */
export const CARGO_INTERVAL_TICKS = 30 * 10;

/** Gold one cargo flight pays each side, before multipliers and domestic modifiers. */
export function cargoGold(distance: number): number {
  return 20_000 + 100 * distance;
}
```

- [ ] **Step 7: Config — 옵션, 막기, 유닛 정보**

`packages/engine-lib/src/configuration/Config.ts`:
- import 목록 끝에 추가:

```ts
import {
  AIRPORT_BUILD_TICKS,
  COASTAL_BATTERY_BUILD_TICKS,
  WARFARE_ONLY_UNITS,
} from "../warfare/Warfare";
```

- `domesticMode(): boolean { ... }` 메서드 바로 뒤에 추가:

```ts
  /** Expanded warfare (spec §14b): coastal battery, barrage, airport. */
  warfareExpansion(): boolean {
    return this._gameConfig.warfareExpansion ?? false;
  }
```

- `isUnitDisabled`를 다음으로 바꾼다:

```ts
  isUnitDisabled(unitType: UnitType): boolean {
    if (DOMESTIC_ONLY_UNITS.has(unitType) && !this.domesticMode()) {
      return true;
    }
    if (WARFARE_ONLY_UNITS.has(unitType) && !this.warfareExpansion()) {
      return true;
    }
    return this._gameConfig.disabledUnits?.includes(unitType) ?? false;
  }
```

- `unitInfo`의 switch에서 `case UnitType.ResearchInstitute:` 블록 뒤, `case UnitType.TransportShip:` 앞에 추가:

```ts
      case UnitType.CoastalBattery:
        info = {
          constructionDuration: this.instantBuild()
            ? 0
            : COASTAL_BATTERY_BUILD_TICKS,
          upgradable: true,
        };
        break;
      case UnitType.Airport:
        info = {
          constructionDuration: this.instantBuild() ? 0 : AIRPORT_BUILD_TICKS,
          upgradable: true,
        };
        break;
```

- 같은 switch의 `info = {};` 묶음(`case UnitType.Train:` 바로 뒤)에 네 줄을 더한다:

```ts
      case UnitType.Train:
      case UnitType.CoastalBarrage:
      case UnitType.Bomber:
      case UnitType.TransportPlane:
      case UnitType.CargoPlane:
        info = {};
        break;
```

- [ ] **Step 8: EngineConfig — 비용과 내정 보정**

`packages/engine/src/configuration/EngineConfig.ts`:
- import 목록에 추가:

```ts
import {
  AIRPORT_COST_MAX,
  AIRPORT_COST_STEP,
  BARRAGE_COST,
  BOMB_COST,
  COASTAL_BATTERY_COST_MAX,
  COASTAL_BATTERY_COST_STEP,
  PARADROP_GOLD,
} from "@openfront/engine-lib/warfare/Warfare";
```

- `DOMESTIC_COST_STAT`에 두 줄을 더한다(핵 억지력의 `nukeCost`를 핵처럼 받는다):

```ts
const DOMESTIC_COST_STAT: Partial<Record<UnitType, StatKey>> = {
  [UnitType.Port]: "portCost",
  [UnitType.MissileSilo]: "siloSamCost",
  [UnitType.SAMLauncher]: "siloSamCost",
  [UnitType.AtomBomb]: "nukeCost",
  [UnitType.HydrogenBomb]: "nukeCost",
  [UnitType.MIRV]: "nukeCost",
  [UnitType.DefensePost]: "defensePostCost",
  // Expanded warfare: strategic strikes are priced like nukes.
  [UnitType.CoastalBarrage]: "nukeCost",
  [UnitType.Bomber]: "nukeCost",
};
```

- `unitCost`의 switch에서 `case UnitType.ResearchInstitute:` 블록 뒤, `case UnitType.TransportShip:` 앞에 추가:

```ts
      case UnitType.CoastalBattery:
        return this.costWrapper(
          (numUnits: number) =>
            Math.min(
              COASTAL_BATTERY_COST_MAX,
              (numUnits + 1) * COASTAL_BATTERY_COST_STEP,
            ),
          UnitType.CoastalBattery,
        );
      case UnitType.Airport:
        return this.costWrapper(
          (numUnits: number) =>
            Math.min(AIRPORT_COST_MAX, (numUnits + 1) * AIRPORT_COST_STEP),
          UnitType.Airport,
        );
      case UnitType.CoastalBarrage:
        return this.costWrapper(() => BARRAGE_COST, UnitType.CoastalBarrage);
      case UnitType.Bomber:
        return this.costWrapper(() => BOMB_COST, UnitType.Bomber);
      case UnitType.TransportPlane:
        return this.costWrapper(() => PARADROP_GOLD, UnitType.TransportPlane);
```

- 같은 switch의 `return () => 0n;` 묶음에 `case UnitType.CargoPlane:`을 `case UnitType.Train:` 뒤에 더한다.

- [ ] **Step 9: 유닛 매개변수와 배치 규칙**

`packages/engine/src/game/Game.ts`의 `UnitParamsMap`에서 `[UnitType.AdminOffice]: Record<string, never>;` 뒤에 추가:

```ts

  [UnitType.CoastalBattery]: Record<string, never>;

  [UnitType.Airport]: Record<string, never>;

  /** The zone marker at the aimed tile (CoastalBarrageExecution). */
  [UnitType.CoastalBarrage]: {
    targetTile: TileRef;
  };

  [UnitType.Bomber]: {
    targetTile: TileRef;
    trajectory: TrajectoryTile[];
  };

  [UnitType.TransportPlane]: {
    troops: number;
    targetTile: TileRef;
    trajectory: TrajectoryTile[];
  };

  /** Flies to the destination airport (targetUnit). */
  [UnitType.CargoPlane]: {
    targetUnit: Unit;
  };
```

`packages/engine/src/game/PlayerImpl.ts`:
- import 목록에 `import { airportRange, BARRAGE_SILO_RANGE } from "@openfront/engine-lib/warfare/Warfare";`를 추가한다(`findClosestBy`는 이미 `@openfront/engine-lib/Util`에서 가져온다).
- `canSpawnUnitType`의 switch에서 `case UnitType.AdminOffice:` 줄과 `return this.landBasedStructureSpawn(targetTile, validTiles);` 사이에 `case UnitType.Airport:`를 넣고, `default:` 앞에 추가:

```ts
      case UnitType.CoastalBattery:
        return this.portSpawn(targetTile, validTiles);
      case UnitType.CoastalBarrage:
        return this.barrageSpawn(targetTile);
      case UnitType.Bomber:
        return this.bomberSpawn(targetTile);
      case UnitType.TransportPlane:
        return this.paradropSpawn(targetTile);
      case UnitType.CargoPlane:
        return targetTile;
```

- `warshipSpawn` 메서드 바로 뒤에 추가:

```ts
  /** Expanded warfare: a strike may not hit the striker's own or a friendly nation's land. */
  private isStrikeTarget(tile: TileRef): boolean {
    const mg = this.mg;
    if (mg.isSpawnImmunityActive() || mg.isImpassable(tile)) return false;
    const owner = mg.owner(tile);
    return !(owner.isPlayer() && (owner === this || this.isFriendly(owner)));
  }

  /** Coastal barrage: the nearest loaded silo within BARRAGE_SILO_RANGE. */
  barrageSpawn(tile: TileRef): TileRef | false {
    if (!this.isStrikeTarget(tile)) return false;
    const mg = this.mg;
    const range2 = BARRAGE_SILO_RANGE * BARRAGE_SILO_RANGE;
    const silo = findClosestBy(
      this.units(UnitType.MissileSilo),
      (s) => mg.euclideanDistSquared(s.tile(), tile),
      (s) =>
        s.isActive() &&
        !s.isInCooldown() &&
        !s.isUnderConstruction() &&
        mg.euclideanDistSquared(s.tile(), tile) <= range2,
    );
    return silo?.tile() ?? false;
  }

  /** Paradrops and bombing: the nearest airport with a free sortie in range. */
  airportSortieSpawn(tile: TileRef): TileRef | false {
    const mg = this.mg;
    const airport = findClosestBy(
      this.units(UnitType.Airport),
      (a) => mg.euclideanDistSquared(a.tile(), tile),
      (a) => {
        const range = airportRange(a.level());
        return (
          a.isActive() &&
          !a.isInCooldown() &&
          !a.isUnderConstruction() &&
          mg.euclideanDistSquared(a.tile(), tile) <= range * range
        );
      },
    );
    return airport?.tile() ?? false;
  }

  bomberSpawn(tile: TileRef): TileRef | false {
    if (!this.isStrikeTarget(tile)) return false;
    return this.airportSortieSpawn(tile);
  }

  /** Paradrop: enemy or unclaimed land the player may attack. */
  paradropSpawn(tile: TileRef): TileRef | false {
    const mg = this.mg;
    if (!mg.isLand(tile) || mg.isImpassable(tile)) return false;
    const owner = mg.owner(tile);
    if (owner === this) return false;
    if (owner.isPlayer() && !this.canAttackPlayer(owner)) return false;
    return this.airportSortieSpawn(tile);
  }
```

`packages/engine/src/execution/ConstructionExecution.ts`의 `isStructure`에서 `case UnitType.AdminOffice:` 뒤에 `case UnitType.CoastalBattery:`와 `case UnitType.Airport:`를 더한다(건물 실행은 Task 2와 Task 5가 `completeConstruction`에 넣는다).

- [ ] **Step 10: 내정 모드 해금**

`packages/engine-lib/src/domestic/Techs.ts`에서 세 기술의 `unlocks`를 바꾼다(옵션이 꺼지면 이 유닛들은 `isUnitDisabled`가 먼저 막는다):

```ts
  fortification: tech("fortification", 1, "military", {
    modifiers: [
      { stat: "defensePost", pct: 50 },
      { stat: "defensePostCost", pct: -30 },
    ],
    // Expanded warfare only (disabled otherwise).
    unlocks: [UnitType.CoastalBattery],
  }),
```

```ts
  industrialization: tech("industrialization", 3, "economy", {
    modifiers: [
      { stat: "train", pct: 50 },
      { stat: "buildCost", pct: -15 },
    ],
    // Expanded warfare only: the airport and what flies from it.
    unlocks: [UnitType.Airport, UnitType.Bomber, UnitType.TransportPlane],
  }),
```

```ts
  rocketry: tech("rocketry", 3, "military", {
    // The coastal barrage exists only with expanded warfare.
    unlocks: [UnitType.MissileSilo, UnitType.CoastalBarrage],
  }),
```

`tests/domestic/Techs.test.ts`의 "each locked unit is unlocked by exactly one tech" 기대 목록에 다섯 개를 더한다:

```ts
    expect(unlocked).toEqual(
      [
        UnitType.AtomBomb,
        UnitType.Factory,
        UnitType.HydrogenBomb,
        UnitType.MIRV,
        UnitType.MissileSilo,
        UnitType.SAMLauncher,
        UnitType.Warship,
        UnitType.CoastalBattery,
        UnitType.Airport,
        UnitType.Bomber,
        UnitType.TransportPlane,
        UnitType.CoastalBarrage,
      ].sort(),
    );
```

- [ ] **Step 11: 원작 고정값, 로비 키, 와이어 샘플**

`tests/VanillaDigest.test.ts`의 `describe` 안 끝에 추가:

```ts
  test("FFA with the warfare option explicitly off", async () => {
    expect(await digest({ warfareExpansion: false })).toBe("c330352312204618");
  }, 60_000);
```

`tests/server/ConfigPatch.test.ts`의 `EDITABLE`에서 `domesticMode: true,` 뒤에 `warfareExpansion: true,`를 추가한다.

`tests/zbin/wire.test.ts`의 `CONFIG`에서 `conquestPercent: 100,` 뒤에 `warfareExpansion: true,`를 추가하고, `delete VANILLA_CONFIG.conquestPercent;` 뒤에 `delete VANILLA_CONFIG.warfareExpansion;`를 추가한다.

- [ ] **Step 12: 통과 확인**

Run: `npx vitest tests/warfare tests/domestic/Techs.test.ts tests/domestic/UnitLocks.test.ts tests/server/ConfigPatch.test.ts tests/zbin tests/VanillaDigest.test.ts --run && npm run typecheck`
Expected: 모두 PASS(VanillaDigest 3 tests 포함), typecheck 오류 없음

- [ ] **Step 13: 커밋**

```bash
npx prettier --write packages/engine-api/src/game/GameTypes.ts packages/engine-api/src/Schemas.ts packages/engine-lib/src/warfare packages/engine-lib/src/configuration/Config.ts packages/engine-lib/src/domestic/Techs.ts packages/engine/src/configuration/EngineConfig.ts packages/engine/src/game/Game.ts packages/engine/src/game/PlayerImpl.ts packages/engine/src/execution/ConstructionExecution.ts src/server/ConfigPatch.ts tests/warfare tests/VanillaDigest.test.ts tests/server/ConfigPatch.test.ts tests/zbin/wire.test.ts tests/domestic/Techs.test.ts
git add packages src/server/ConfigPatch.ts tests/warfare tests/VanillaDigest.test.ts tests/server/ConfigPatch.test.ts tests/zbin/wire.test.ts tests/domestic/Techs.test.ts
git commit -m "feat(warfare): warfareExpansion option, unit types, costs and placement rules"
```

---
### Task 2: 해안 포대

**Files:**
- Create: `packages/engine/src/warfare/CoastalBatteryExecution.ts`
- Modify: `packages/engine/src/execution/ConstructionExecution.ts` (`completeConstruction`)
- Modify: `packages/engine/src/snapshot/ExecutionRegistry.ts`
- Modify (test): `tests/core/snapshot/FullGameSnapshot.test.ts` (`WARFARE_ONLY_TYPES`)
- Test: `tests/warfare/CoastalBattery.test.ts`

**Interfaces:**
- Consumes: Task 1 `COASTAL_BATTERY_RANGE`, `coastalBatteryFireInterval`, `warfareGame`, `own`, `RED`, `BLUE`; 기존 `ShellExecution(spawn, owner, ownerUnit, target)`
- Produces:
  - `new CoastalBatteryExecution(battery: Unit)`, 스냅샷 이름 `"CoastalBattery"`
  - `tests/core/snapshot/FullGameSnapshot.test.ts`의 `const WARFARE_ONLY_TYPES: string[]`(이후 Task가 이름을 덧붙인다)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/warfare/CoastalBattery.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { activeConditions } from "@openfront/engine/domestic/DomesticEconomy";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { NukeExecution } from "@openfront/engine/execution/NukeExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { grantLaws, grantTechs } from "../domestic/util";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, warfareGame } from "./util";

// half_land_half_ocean: land x 0-7, sea x 8-15. Red holds the north half
// of the coast, blue the south half.
async function coast(
  config: Parameters<typeof warfareGame>[1] = {},
): Promise<{ game: Game; red: Player; blue: Player }> {
  const game = await warfareGame("half_land_half_ocean", {
    instantBuild: true,
    ...config,
  });
  const red = own(game, RED.id, 0, 0, 8, 8);
  const blue = own(game, BLUE.id, 0, 8, 8, 8);
  red.addGold(10_000_000n);
  blue.addGold(10_000_000n);
  return { game, red, blue };
}

function buildBattery(game: Game, player: Player, x: number, y: number): Unit {
  game.addExecution(
    new ConstructionExecution(player, UnitType.CoastalBattery, game.ref(x, y)),
  );
  executeTicks(game, 3);
  const battery = player.units(UnitType.CoastalBattery)[0];
  expect(battery).toBeDefined();
  return battery;
}

const shellsFired = (p: Player) => p.unitsConstructed(UnitType.Shell);

describe("coastal battery", () => {
  test("is built on its owner's shore through the build intent", async () => {
    const { game, red } = await coast();
    const battery = buildBattery(game, red, 7, 3);
    expect(battery.tile()).toBe(game.ref(7, 3));
    expect(battery.isUnderConstruction()).toBe(false);
  });

  test("sinks an enemy transport ship with one shell", async () => {
    const { game, red, blue } = await coast();
    buildBattery(game, red, 7, 3);
    const boat = blue.buildUnit(UnitType.TransportShip, game.ref(11, 3), {
      troops: 500,
      targetTile: game.ref(7, 3),
    });
    executeTicks(game, 10);
    expect(boat.isActive()).toBe(false);
    expect(shellsFired(red)).toBe(1);
  });

  test("needs several shells for a warship", async () => {
    const { game, red, blue } = await coast();
    buildBattery(game, red, 7, 3);
    const ship = blue.buildUnit(UnitType.Warship, game.ref(12, 4), {
      patrolTile: game.ref(12, 4),
    });
    executeTicks(game, 25);
    expect(ship.isActive()).toBe(true);
    expect(ship.health()).toBeLessThan(1000);
    executeTicks(game, 400);
    expect(ship.isActive()).toBe(false);
  });

  test("never shoots trade ships", async () => {
    const { game, red, blue } = await coast();
    buildBattery(game, red, 7, 3);
    const port = blue.buildUnit(UnitType.Port, game.ref(7, 12), {});
    const trader = blue.buildUnit(UnitType.TradeShip, game.ref(11, 3), {
      targetUnit: port,
    });
    executeTicks(game, 60);
    expect(trader.isActive()).toBe(true);
    expect(shellsFired(red)).toBe(0);
  });

  test("leaves allied ships alone", async () => {
    const { game, red, blue } = await coast();
    buildBattery(game, red, 7, 3);
    red.createAllianceRequest(blue)?.accept();
    const boat = blue.buildUnit(UnitType.TransportShip, game.ref(11, 3), {
      troops: 500,
      targetTile: game.ref(7, 12),
    });
    executeTicks(game, 30);
    expect(boat.isActive()).toBe(true);
    expect(shellsFired(red)).toBe(0);
  });

  test("fires faster after an upgrade", async () => {
    const shots = async (level: number): Promise<number> => {
      const { game, red, blue } = await coast();
      const battery = buildBattery(game, red, 7, 3);
      for (let l = 1; l < level; l++) red.upgradeUnit(battery);
      blue.buildUnit(UnitType.Warship, game.ref(12, 4), {
        patrolTile: game.ref(12, 4),
      });
      executeTicks(game, 40);
      return shellsFired(red);
    };
    expect(await shots(1)).toBe(2); // every 30 ticks
    expect(await shots(2)).toBe(3); // every 15 ticks
  });

  test("a nuke destroys it like any structure", async () => {
    const { game, red, blue } = await coast();
    const battery = buildBattery(game, red, 7, 3);
    blue.buildUnit(UnitType.MissileSilo, game.ref(2, 12), {});
    game.addExecution(
      new NukeExecution(UnitType.AtomBomb, blue, battery.tile(), null),
    );
    executeTicks(game, 30);
    expect(battery.isActive()).toBe(false);
  });

  test("survives a snapshot mid-fight", async () => {
    const { game, red, blue } = await coast();
    buildBattery(game, red, 7, 3);
    blue.buildUnit(UnitType.Warship, game.ref(12, 4), {
      patrolTile: game.ref(12, 4),
    });
    executeTicks(game, 5);
    await expectSnapshotRoundTrip(game, "half_land_half_ocean", 40);
  });
});

describe("coastal battery in domestic mode", () => {
  test("fortification unlocks it and the build-time laws apply", async () => {
    const { game, red } = await coast({
      domesticMode: true,
      instantBuild: false,
    });
    grantTechs(red, "fortification");
    grantLaws(red, { construction: "B" }); // build time -50%
    game.addExecution(
      new ConstructionExecution(
        red,
        UnitType.CoastalBattery,
        game.ref(7, 3),
      ),
    );
    executeTicks(game, 3);
    const battery = red.units(UnitType.CoastalBattery)[0];
    expect(battery.isUnderConstruction()).toBe(true);
    expect(battery.constructionTicks()).toBe(50);
    executeTicks(game, 55);
    expect(battery.isUnderConstruction()).toBe(false);
  });

  test("shooting a boat doesn't count as attacking", async () => {
    const { game, red, blue } = await coast({ domesticMode: true });
    grantTechs(red, "fortification");
    buildBattery(game, red, 7, 3);
    blue.buildUnit(UnitType.TransportShip, game.ref(11, 3), {
      troops: 500,
      targetTile: game.ref(7, 3),
    });
    executeTicks(game, 3);
    expect(activeConditions(red, 1_000_000).has("attacking")).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/warfare/CoastalBattery.test.ts --run`
Expected: FAIL — "sinks an enemy transport ship with one shell" 등에서 `expected true to be false`(포대가 쏘지 않는다), 건설 테스트만 PASS

- [ ] **Step 3: 포대 실행 작성**

`packages/engine/src/warfare/CoastalBatteryExecution.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { zInt, zRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  COASTAL_BATTERY_RANGE,
  coastalBatteryFireInterval,
} from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { ShellExecution } from "../execution/ShellExecution";
import { Execution, Game, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/** What a coastal battery shoots: never trade ships (spec §14b). */
const BATTERY_TARGETS: readonly UnitType[] = [
  UnitType.TransportShip,
  UnitType.Warship,
];

/**
 * A coastal battery (spec §14b): shells non-friendly transport ships and
 * warships within COASTAL_BATTERY_RANGE, transports first, then the
 * nearest. A transport has no health and sinks to one shell, so it is shot
 * at once; a warship takes several. Faster per level.
 */
export class CoastalBatteryExecution implements Execution {
  private mg: Game;
  private active = true;
  /** Tick of the last shot; far back so a new battery fires at once. */
  private lastShot = -1_000_000;
  /** One-shot targets already fired at. */
  private shotAt = new Set<Unit>();

  constructor(private battery: Unit) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(_ticks: number): void {
    if (!this.battery.isActive()) {
      this.active = false;
      return;
    }
    if (this.battery.isUnderConstruction()) return;
    for (const unit of this.shotAt) {
      if (!unit.isActive()) this.shotAt.delete(unit);
    }
    const now = this.mg.ticks();
    if (now - this.lastShot < coastalBatteryFireInterval(this.battery.level())) {
      return;
    }
    const owner = this.battery.owner();
    const targets = this.mg
      .nearbyUnits(this.battery.tile(), COASTAL_BATTERY_RANGE, BATTERY_TARGETS)
      .filter(
        ({ unit }) =>
          unit.owner() !== owner &&
          !owner.isFriendly(unit.owner()) &&
          !this.shotAt.has(unit),
      );
    if (targets.length === 0) return;
    targets.sort((a, b) => {
      const aRank = a.unit.type() === UnitType.TransportShip ? 0 : 1;
      const bRank = b.unit.type() === UnitType.TransportShip ? 0 : 1;
      return (
        aRank - bRank ||
        a.distSquared - b.distSquared ||
        a.unit.id() - b.unit.id()
      );
    });
    const target = targets[0].unit;
    this.lastShot = now;
    this.mg.addExecution(
      new ShellExecution(this.battery.tile(), owner, this.battery, target),
    );
    if (!target.hasHealth()) this.shotAt.add(target);
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return CoastalBatteryExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      battery: w.unit(this.battery),
      lastShot: this.lastShot,
      shotAt: [...this.shotAt].map((u) => w.unit(u)),
    });
  }

  restoreSnapshot(s: CoastalBatteryState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.battery = r.unit(s.battery);
    this.lastShot = s.lastShot;
    this.shotAt = new Set(s.shotAt.map((i) => r.unit(i)));
  }
}

const CoastalBatteryStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  battery: zRef(),
  lastShot: zInt(),
  shotAt: z.array(zRef()),
});
type CoastalBatteryState = z.infer<typeof CoastalBatteryStateSchema>;

export const CoastalBatteryExecutionSnapshot = execSnapshotType({
  name: "CoastalBattery",
  version: 1,
  schema: CoastalBatteryStateSchema,
  cls: () => CoastalBatteryExecution,
});
```

- [ ] **Step 4: 건설 완료와 등록**

`packages/engine/src/execution/ConstructionExecution.ts`: `import { CoastalBatteryExecution } from "../warfare/CoastalBatteryExecution";`를 추가하고, `completeConstruction`의 switch에서 `case UnitType.ResearchInstitute:` 블록(`break;`까지) 뒤에 추가:

```ts
      case UnitType.CoastalBattery:
        this.mg.addExecution(new CoastalBatteryExecution(this.structure!));
        break;
```

`packages/engine/src/snapshot/ExecutionRegistry.ts`: `import { CoastalBatteryExecutionSnapshot } from "../warfare/CoastalBatteryExecution";`를 추가하고, `EXECUTION_SNAPSHOT_TYPES`의 `CityExecutionSnapshot,` 뒤에 `CoastalBatteryExecutionSnapshot,`를 넣는다(이름순).

`tests/core/snapshot/FullGameSnapshot.test.ts`: FFA 변형은 등록된 모든 실행이 원작 게임에 나와야 통과한다. `DOMESTIC_UNSCRIPTED_TYPES` 선언 바로 뒤에 추가:

```ts
// Execution types that only an expanded-warfare game creates. The "warfare"
// variant (added with its scripted intents) plays them.
const WARFARE_ONLY_TYPES = ["CoastalBattery"];
```

그리고 FFA 기대 목록의 필터를 바꾼다:

```ts
        expected = EXECUTION_SNAPSHOT_TYPES.map((t) => t.name).filter(
          (name) =>
            name !== "Pause" &&
            !DOMESTIC_ONLY_TYPES.includes(name) &&
            !WARFARE_ONLY_TYPES.includes(name),
        );
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest tests/warfare/CoastalBattery.test.ts --run && npx vitest tests/core/snapshot/FullGameSnapshot.test.ts -t "free for all" --run`
Expected: CoastalBattery 10 tests PASS, FullGameSnapshot FFA 4 tests PASS

- [ ] **Step 6: 커밋**

```bash
npx prettier --write packages/engine/src/warfare packages/engine/src/execution/ConstructionExecution.ts packages/engine/src/snapshot/ExecutionRegistry.ts tests/warfare tests/core/snapshot/FullGameSnapshot.test.ts
git add packages/engine/src tests/warfare tests/core/snapshot/FullGameSnapshot.test.ts
git commit -m "feat(warfare): coastal battery shells enemy boats and warships"
```

---

### Task 3: 군함 조정 (옵션 켬일 때만)

**Files:**
- Modify: `packages/engine/src/configuration/EngineConfig.ts` (`warshipShellAttackRate`, `warshipShellDamagePct`)
- Modify: `packages/engine/src/execution/ShellExecution.ts` (`effectOnTarget`)
- Test: `tests/warfare/WarshipTuning.test.ts`

**Interfaces:**
- Consumes: Task 1 `WARSHIP_SHELL_DAMAGE_PCT`, `WARSHIP_SHELL_RATE_PCT`
- Produces: `EngineConfig.warshipShellDamagePct(): number`(꺼짐 100, 켬 60), `warshipShellAttackRate()`(꺼짐 20, 켬 30)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/warfare/WarshipTuning.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { ShellExecution } from "@openfront/engine/execution/ShellExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { BLUE, own, RED, warfareGame } from "./util";

/** The damage a fresh shell fired by `from` would deal (same roll per tick). */
function shellDamage(game: Game, owner: Player, from: Unit, at: Unit): number {
  const shell = new ShellExecution(from.tile(), owner, from, at);
  shell.init(game, game.ticks());
  return shell.getEffectOnTargetForTesting();
}

async function ships(warfare: boolean) {
  const game = warfare
    ? await warfareGame("half_land_half_ocean")
    : await setup("half_land_half_ocean", {}, [RED, BLUE]);
  const red = own(game, RED.id, 0, 0, 8, 8);
  const blue = own(game, BLUE.id, 0, 8, 8, 8);
  const ship = red.buildUnit(UnitType.Warship, game.ref(10, 3), {
    patrolTile: game.ref(10, 3),
  });
  const target = blue.buildUnit(UnitType.Warship, game.ref(12, 3), {
    patrolTile: game.ref(12, 3),
  });
  const battery = red.buildUnit(UnitType.CoastalBattery, game.ref(7, 3), {});
  return { game, red, ship, target, battery };
}

describe("warships with expanded warfare", () => {
  test("vanilla: 20 ticks between shots and full damage", async () => {
    const { game, red, ship, target } = await ships(false);
    expect(game.config().warshipShellAttackRate()).toBe(20);
    expect(game.config().warshipShellDamagePct()).toBe(100);
    const dmg = shellDamage(game, red, ship, target);
    expect(dmg).toBeGreaterThanOrEqual(200);
    expect(dmg).toBeLessThanOrEqual(300);
  });

  test("on: 30 ticks between shots and 60% damage, priorities untouched", async () => {
    const { game, red, ship, target } = await ships(true);
    expect(game.config().warshipShellAttackRate()).toBe(30);
    expect(game.config().warshipShellDamagePct()).toBe(60);
    const dmg = shellDamage(game, red, ship, target);
    expect(dmg).toBeGreaterThanOrEqual(120);
    expect(dmg).toBeLessThanOrEqual(180);
  });

  test("the same roll is cut to 60%, rounded down", async () => {
    const vanilla = await ships(false);
    const warfare = await ships(true);
    const a = shellDamage(vanilla.game, vanilla.red, vanilla.ship, vanilla.target);
    const b = shellDamage(warfare.game, warfare.red, warfare.ship, warfare.target);
    expect(b).toBe(Math.floor((a * 60) / 100));
  });

  test("coastal battery shells keep full damage", async () => {
    const { game, red, battery, target } = await ships(true);
    const dmg = shellDamage(game, red, battery, target);
    expect(dmg).toBeGreaterThanOrEqual(200);
    expect(dmg).toBeLessThanOrEqual(300);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/warfare/WarshipTuning.test.ts --run`
Expected: FAIL — `game.config().warshipShellDamagePct is not a function`

- [ ] **Step 3: 구현**

`packages/engine/src/configuration/EngineConfig.ts`: Task 1의 warfare import 목록에 `WARSHIP_SHELL_DAMAGE_PCT`, `WARSHIP_SHELL_RATE_PCT`를 더하고, `warshipShellAttackRate()`를 다음으로 바꾼 뒤 바로 아래에 새 메서드를 둔다:

```ts
  warshipShellAttackRate(): number {
    // Expanded warfare: +50% between shots (20 -> 30 ticks).
    return this.warfareExpansion() ? (20 * WARSHIP_SHELL_RATE_PCT) / 100 : 20;
  }

  /** Percent of its rolled damage a warship's shell deals (expanded warfare: 60). */
  warshipShellDamagePct(): number {
    return this.warfareExpansion() ? WARSHIP_SHELL_DAMAGE_PCT : 100;
  }
```

`packages/engine/src/execution/ShellExecution.ts`의 `effectOnTarget()` 마지막 줄 `return Math.round((baseDamage / 250) * damageMultiplier);`를 다음으로 바꾼다(원작은 같은 값을 그대로 돌려준다):

```ts
    const damage = Math.round((baseDamage / 250) * damageMultiplier);
    if (this.ownerUnit.type() !== UnitType.Warship) return damage;
    const pct = this.mg.config().warshipShellDamagePct();
    return pct === 100 ? damage : Math.floor((damage * pct) / 100);
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest tests/warfare/WarshipTuning.test.ts tests/Warship.test.ts tests/ShellRandom.test.ts tests/VanillaDigest.test.ts --run`
Expected: 모두 PASS

- [ ] **Step 5: 커밋**

```bash
npx prettier --write packages/engine/src/configuration/EngineConfig.ts packages/engine/src/execution/ShellExecution.ts tests/warfare/WarshipTuning.test.ts
git add packages/engine/src/configuration/EngineConfig.ts packages/engine/src/execution/ShellExecution.ts tests/warfare/WarshipTuning.test.ts
git commit -m "feat(warfare): warships hit 40% softer and 50% slower with the option on"
```

---
### Task 4: 해안 포격 (포탄 8발, 포대 파괴, 방어 약화 구역)

**Files:**
- Create: `packages/engine/src/warfare/FlightPath.ts`
- Create: `packages/engine/src/warfare/BarrageZone.ts`
- Create: `packages/engine/src/warfare/CoastalBarrageExecution.ts`
- Modify: `packages/engine/src/execution/ConstructionExecution.ts` (`completeConstruction`)
- Modify: `packages/engine/src/execution/AttackExecution.ts` (`attackLogicInput`)
- Modify: `packages/engine/src/execution/NukeExecution.ts` (`detonate`의 제외 목록)
- Modify: `packages/engine/src/snapshot/ExecutionRegistry.ts`
- Modify (test): `tests/core/snapshot/FullGameSnapshot.test.ts` (`WARFARE_ONLY_TYPES`)
- Test: `tests/warfare/FlightPath.test.ts`, `tests/warfare/CoastalBarrage.test.ts`

**Interfaces:**
- Consumes: Task 1 `BARRAGE_*`, `PlayerImpl.barrageSpawn`(`canBuild`), `warfareGame`, `own`
- Produces:
  - `straightFlightPath(map: GameMap, from: TileRef, to: TileRef, speed: number): TileRef[]` — `[from, …, to]`, 한 칸이 한 틱
  - `barrageSuppresses(mg: Game, tile: TileRef, defender: Player): boolean`
  - `barrageImpacts(map: GameMap, dst: TileRef, random: PseudoRandom): TileRef[]` — 첫 칸은 `dst`
  - `new CoastalBarrageExecution(player: Player, dst: TileRef)`, 스냅샷 이름 `"CoastalBarrage"`
  - 표식 유닛 `UnitType.CoastalBarrage`: 조준점에 있고, 구역이 켜지면 `reachedTarget()`이 참(화면 Task 16이 그린다)
  - 알림 키 `events_display.barrage_inbound`(`{name}`, `MessageType.NUKE_INBOUND`)

- [ ] **Step 1: 실패하는 테스트 작성 — 비행 경로**

`tests/warfare/FlightPath.test.ts`:

```ts
import { straightFlightPath } from "@openfront/engine/warfare/FlightPath";
import { setup } from "../util/Setup";

describe("straightFlightPath", () => {
  test("one entry per tick, at most `speed` tiles apart, ending on the target", async () => {
    const game = await setup("plains");
    const path = straightFlightPath(game, game.ref(0, 0), game.ref(30, 40), 3);
    expect(path[0]).toBe(game.ref(0, 0));
    expect(path[path.length - 1]).toBe(game.ref(30, 40));
    expect(path).toHaveLength(18); // ceil(50 / 3) steps
    for (let i = 1; i < path.length; i++) {
      expect(game.euclideanDistSquared(path[i - 1], path[i])).toBeLessThanOrEqual(
        4 * 4,
      );
    }
  });

  test("a straight line along an axis", async () => {
    const game = await setup("plains");
    const path = straightFlightPath(game, game.ref(10, 5), game.ref(40, 5), 3);
    expect(path.map((t) => game.x(t))).toEqual([
      10, 13, 16, 19, 22, 25, 28, 31, 34, 37, 40,
    ]);
    expect(path.every((t) => game.y(t) === 5)).toBe(true);
  });

  test("a flight to its own tile still takes one step", async () => {
    const game = await setup("plains");
    const t = game.ref(7, 7);
    expect(straightFlightPath(game, t, t, 3)).toEqual([t, t]);
  });
});
```

- [ ] **Step 2: 실패하는 테스트 작성 — 해안 포격**

`tests/warfare/CoastalBarrage.test.ts`:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  BARRAGE_RADIUS,
  BARRAGE_SHELLS,
} from "@openfront/engine-lib/warfare/Warfare";
import { AttackLogicInput } from "@openfront/engine/configuration/EngineConfig";
import { activeConditions } from "@openfront/engine/domestic/DomesticEconomy";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { NukeExecution } from "@openfront/engine/execution/NukeExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { barrageSuppresses } from "@openfront/engine/warfare/BarrageZone";
import { barrageImpacts } from "@openfront/engine/warfare/CoastalBarrageExecution";
import { vi } from "vitest";
import { grantLaws, grantTechs } from "../domestic/util";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, warfareGame } from "./util";

// plains: red holds rows 0-49, blue rows 50-99; red's silo at (50, 10).
async function front(config: Parameters<typeof warfareGame>[1] = {}) {
  const game = await warfareGame("plains", { instantBuild: true, ...config });
  const red = own(game, RED.id, 0, 0, 100, 50);
  const blue = own(game, BLUE.id, 0, 50, 100, 50);
  red.addGold(10_000_000n);
  red.addTroops(500_000);
  blue.addTroops(500_000);
  const silo = red.buildUnit(UnitType.MissileSilo, game.ref(50, 10), {});
  return { game, red, blue, silo };
}

function fire(game: Game, player: Player, tile: TileRef): void {
  game.addExecution(
    new ConstructionExecution(player, UnitType.CoastalBarrage, tile),
  );
}

/**
 * Attack-logic inputs of an attack launched from `from` for a few ticks.
 * The attack is called off afterwards so the next probe sees only its own.
 */
function probe(
  game: Game,
  red: Player,
  blue: Player,
  from: TileRef,
): AttackLogicInput[] {
  const spy = vi.spyOn(game.config(), "attackLogic");
  game.addExecution(new AttackExecution(20_000, red, blue.id(), from, true));
  executeTicks(game, 4);
  const inputs = spy.mock.calls.map(([input]) => input);
  spy.mockRestore();
  for (const attack of red.outgoingAttacks()) attack.delete();
  return inputs;
}

const marker = (game: Game): Unit | undefined =>
  game.units(UnitType.CoastalBarrage)[0];

describe("coastal barrage", () => {
  test("costs 300K and a silo slot, then lands 8 shells 5 ticks apart", async () => {
    const { game, red, blue, silo } = await front();
    const battery = blue.buildUnit(
      UnitType.CoastalBattery,
      game.ref(70, 60),
      {},
    );
    const gold = red.gold();
    fire(game, red, battery.tile());
    executeTicks(game, 3);
    expect(red.gold()).toBe(gold - 300_000n);
    expect(silo.isInCooldown()).toBe(true);
    expect(marker(game)?.tile()).toBe(battery.tile());

    executeTicks(game, 20);
    expect(red.unitsConstructed(UnitType.Shell)).toBe(4);
    executeTicks(game, 40);
    expect(red.unitsConstructed(UnitType.Shell)).toBe(BARRAGE_SHELLS);
    expect(battery.isActive()).toBe(false);
    expect(marker(game)?.reachedTarget()).toBe(true);
  });

  test("destroys only coastal batteries: no land, troops, cities or fallout", async () => {
    const { game, red, blue } = await front();
    const city = blue.buildUnit(UnitType.City, game.ref(72, 62), {});
    const tiles = blue.numTilesOwned();
    const troops = blue.troops();
    fire(game, red, game.ref(70, 60));
    executeTicks(game, 63);
    expect(city.isActive()).toBe(true);
    expect(blue.numTilesOwned()).toBe(tiles);
    expect(blue.troops()).toBe(troops);
    expect(game.numTilesWithFallout()).toBe(0);
  });

  test("spares an allied nation's battery near the impact", async () => {
    const game = await warfareGame("plains", { instantBuild: true });
    const red = own(game, RED.id, 0, 0, 100, 50);
    const blue = own(game, BLUE.id, 0, 50, 50, 50);
    red.addGold(10_000_000n);
    red.buildUnit(UnitType.MissileSilo, game.ref(50, 10), {});
    // The aimed tile is unclaimed; blue (an ally) has a battery next to it.
    red.createAllianceRequest(blue)?.accept();
    const allied = blue.buildUnit(UnitType.CoastalBattery, game.ref(49, 60), {});
    fire(game, red, game.ref(51, 60));
    executeTicks(game, 63);
    expect(allied.isActive()).toBe(true);
  });

  test("defense posts are off and attackers lose 40% less in the zone for 20 s", async () => {
    const { game, red, blue } = await front();
    blue.buildUnit(UnitType.DefensePost, game.ref(30, 52), {});
    blue.buildUnit(UnitType.DefensePost, game.ref(70, 52), {});

    const before = probe(game, red, blue, game.ref(30, 49));
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((i) => i.defenderHasDefensePost)).toBe(true);
    expect(before.every((i) => i.attacker.lossScale === 1)).toBe(true);

    fire(game, red, game.ref(70, 55));
    executeTicks(game, 63);
    expect(barrageSuppresses(game, game.ref(70, 50), blue)).toBe(true);
    expect(barrageSuppresses(game, game.ref(30, 50), blue)).toBe(false);
    const during = probe(game, red, blue, game.ref(70, 49));
    expect(during.length).toBeGreaterThan(0);
    expect(during.every((i) => !i.defenderHasDefensePost)).toBe(true);
    expect(during.every((i) => i.attacker.lossScale === 0.6)).toBe(true);

    executeTicks(game, 200);
    expect(marker(game)).toBeUndefined();
    expect(barrageSuppresses(game, game.ref(60, 50), blue)).toBe(false);
    const after = probe(game, red, blue, game.ref(60, 49));
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((i) => i.defenderHasDefensePost)).toBe(true);
    expect(after.every((i) => i.attacker.lossScale === 1)).toBe(true);
  });

  test("a zone never helps against its shooter", async () => {
    const { game, red, blue } = await front();
    fire(game, red, game.ref(70, 55));
    executeTicks(game, 63);
    expect(barrageSuppresses(game, game.ref(70, 45), red)).toBe(false);
    expect(barrageSuppresses(game, game.ref(70, 55), blue)).toBe(true);
  });

  test("aimed at a corner, every shell lands on the map", async () => {
    const game = await warfareGame("plains");
    const corner = game.ref(0, 0);
    const impacts = barrageImpacts(game, corner, new PseudoRandom(7));
    expect(impacts).toHaveLength(BARRAGE_SHELLS);
    expect(impacts[0]).toBe(corner);
    for (const t of impacts) {
      expect(game.isValidRef(t)).toBe(true);
      expect(game.euclideanDistSquared(t, corner)).toBeLessThanOrEqual(
        BARRAGE_RADIUS * BARRAGE_RADIUS,
      );
    }
  });

  test("its zone marker survives a nuke", async () => {
    const { game, red, blue } = await front();
    fire(game, red, game.ref(70, 55));
    executeTicks(game, 63);
    red.buildUnit(UnitType.MissileSilo, game.ref(20, 10), {});
    game.addExecution(
      new NukeExecution(UnitType.AtomBomb, red, game.ref(70, 55), null),
    );
    executeTicks(game, 30);
    expect(marker(game)?.isActive()).toBe(true);
    expect(blue.isAlive()).toBe(true);
  });

  test("own land can't be shelled", async () => {
    const { game, red } = await front();
    const gold = red.gold();
    fire(game, red, game.ref(40, 40));
    executeTicks(game, 5);
    expect(marker(game)).toBeUndefined();
    expect(red.gold()).toBe(gold);
  });

  test("survives a snapshot mid-salvo", async () => {
    const { game, red, blue } = await front();
    blue.buildUnit(UnitType.CoastalBattery, game.ref(72, 60), {});
    fire(game, red, game.ref(70, 60));
    executeTicks(game, 12);
    await expectSnapshotRoundTrip(game, "plains", 60);
  });
});

describe("coastal barrage in domestic mode", () => {
  test("rocketry unlocks it; nuclear deterrence cuts its price; it isn't an attack", async () => {
    const { game, red } = await front({ domesticMode: true });
    grantTechs(red, "rocketry");
    grantLaws(red, { nuclear: "A" });
    const gold = red.gold();
    fire(game, red, game.ref(70, 60));
    executeTicks(game, 10);
    expect(red.gold()).toBe(gold - 240_000n);
    expect(activeConditions(red, 1_000_000).has("attacking")).toBe(false);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest tests/warfare/FlightPath.test.ts tests/warfare/CoastalBarrage.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine/warfare/FlightPath'`

- [ ] **Step 4: 비행 경로와 구역 판정**

`packages/engine/src/warfare/FlightPath.ts`:

```ts
import { GameMap, TileRef } from "@openfront/engine-api/game/GameMap";

/**
 * A straight flight from `from` to `to`, one entry per tick at `speed`
 * tiles a tick: [from, …, to]. Only exact arithmetic and Math.round, so
 * every client gets the same tiles. Planes and barrage shells fly it.
 */
export function straightFlightPath(
  map: GameMap,
  from: TileRef,
  to: TileRef,
  speed: number,
): TileRef[] {
  const x0 = map.x(from);
  const y0 = map.y(from);
  const dx = map.x(to) - x0;
  const dy = map.y(to) - y0;
  const steps = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / speed));
  const path: TileRef[] = [from];
  for (let i = 1; i <= steps; i++) {
    path.push(
      map.ref(
        x0 + Math.round((dx * i) / steps),
        y0 + Math.round((dy * i) / steps),
      ),
    );
  }
  return path;
}
```

`packages/engine/src/warfare/BarrageZone.ts`:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { BARRAGE_RADIUS } from "@openfront/engine-lib/warfare/Warfare";
import { Game, Player } from "../game/Game";

/**
 * True when a finished coastal barrage's zone covers `tile` (spec §14b):
 * the defender's defense posts are off there and attackers lose 40% fewer
 * troops. A zone never helps against its shooter or the shooter's friends.
 */
export function barrageSuppresses(
  mg: Game,
  tile: TileRef,
  defender: Player,
): boolean {
  if (mg.unitCount(UnitType.CoastalBarrage) === 0) return false;
  return mg.anyUnitNearby(
    tile,
    BARRAGE_RADIUS,
    [UnitType.CoastalBarrage],
    (zone) =>
      zone.reachedTarget() &&
      zone.owner() !== defender &&
      !defender.isFriendly(zone.owner()),
  );
}
```

- [ ] **Step 5: 해안 포격 실행 작성**

`packages/engine/src/warfare/CoastalBarrageExecution.ts`:

```ts
import { GameMap, TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  zInt,
  zPlayerRef,
  zRef,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  BARRAGE_BATTERY_KILL_RADIUS,
  BARRAGE_RADIUS,
  BARRAGE_SHELL_SPACING_TICKS,
  BARRAGE_SHELL_SPEED,
  BARRAGE_SHELLS,
  BARRAGE_SUPPRESSION_TICKS,
} from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { Execution, Game, Player, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { straightFlightPath } from "./FlightPath";

const NOT_LAUNCHED = -1;
const LANDED = -2;

/**
 * Where a salvo's shells land: the aimed tile first (so an aimed battery
 * is always hit), then random map tiles within BARRAGE_RADIUS of it.
 */
export function barrageImpacts(
  map: GameMap,
  dst: TileRef,
  random: PseudoRandom,
): TileRef[] {
  const impacts = [dst];
  const cx = map.x(dst);
  const cy = map.y(dst);
  const r = BARRAGE_RADIUS;
  while (impacts.length < BARRAGE_SHELLS) {
    let tile = dst;
    for (let tries = 0; tries < 20; tries++) {
      const dx = random.nextInt(-r, r + 1);
      const dy = random.nextInt(-r, r + 1);
      if (dx * dx + dy * dy > r * r) continue;
      if (!map.isValidCoord(cx + dx, cy + dy)) continue;
      tile = map.ref(cx + dx, cy + dy);
      break;
    }
    impacts.push(tile);
  }
  return impacts;
}

/**
 * A coastal barrage (spec §14b): fired from the nearest loaded silo within
 * BARRAGE_SILO_RANGE (one silo slot). Its 8 shells leave 5 ticks apart and
 * fly straight to their impacts; each impact destroys non-friendly coastal
 * batteries within BARRAGE_BATTERY_KILL_RADIUS. A marker unit at the aimed
 * tile holds the zone: after the last impact it is `reachedTarget` for
 * BARRAGE_SUPPRESSION_TICKS (BarrageZone.barrageSuppresses), then removed.
 * Nothing else is harmed.
 */
export class CoastalBarrageExecution implements Execution {
  private mg: Game;
  private active = true;
  private marker: Unit | null = null;
  private silo: TileRef = 0;
  private launchTick = 0;
  private impacts: TileRef[] = [];
  /** Not stored: rebuilt from silo and impacts. */
  private paths: TileRef[][] = [];
  private shells: (Unit | null)[] = [];
  /** Path index per shell, or NOT_LAUNCHED / LANDED. */
  private steps: number[] = [];
  private zoneEndsAt = -1;

  constructor(
    private player: Player,
    private dst: TileRef,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(_ticks: number): void {
    if (this.marker === null) {
      this.launch();
      return;
    }
    if (!this.marker.isActive()) {
      this.end();
      return;
    }
    const now = this.mg.ticks();
    if (this.zoneEndsAt >= 0) {
      if (now >= this.zoneEndsAt) this.end();
      return;
    }
    this.flyShells(now);
    if (this.steps.every((s) => s === LANDED)) {
      this.marker.setReachedTarget();
      this.marker.touch();
      this.zoneEndsAt = now + BARRAGE_SUPPRESSION_TICKS;
    }
  }

  private launch(): void {
    const mg = this.mg;
    if (!mg.isValidRef(this.dst)) {
      this.active = false;
      return;
    }
    const spawn = this.player.canBuild(UnitType.CoastalBarrage, this.dst);
    if (spawn === false) {
      console.warn(`cannot fire a coastal barrage at ${this.dst}`);
      this.active = false;
      return;
    }
    this.player
      .units(UnitType.MissileSilo)
      .find((s) => s.tile() === spawn)
      ?.launch();
    this.silo = spawn;
    this.launchTick = mg.ticks();
    this.marker = this.player.buildUnit(UnitType.CoastalBarrage, this.dst, {
      targetTile: this.dst,
    });
    this.impacts = barrageImpacts(
      mg,
      this.dst,
      new PseudoRandom(mg.ticks() + this.dst),
    );
    this.paths = this.flightPaths(mg);
    this.shells = this.impacts.map(() => null);
    this.steps = this.impacts.map(() => NOT_LAUNCHED);
    const target = mg.owner(this.dst);
    if (target.isPlayer()) {
      mg.displayIncomingUnit(
        this.marker.id(),
        "events_display.barrage_inbound",
        MessageType.NUKE_INBOUND,
        target.id(),
      );
    }
  }

  private flightPaths(map: GameMap): TileRef[][] {
    return this.impacts.map((t) =>
      straightFlightPath(map, this.silo, t, BARRAGE_SHELL_SPEED),
    );
  }

  private flyShells(now: number): void {
    for (let i = 0; i < this.impacts.length; i++) {
      const step = this.steps[i];
      if (step === LANDED) continue;
      if (step === NOT_LAUNCHED) {
        if (now >= this.launchTick + 1 + i * BARRAGE_SHELL_SPACING_TICKS) {
          this.shells[i] = this.player.buildUnit(
            UnitType.Shell,
            this.silo,
            {},
          );
          this.steps[i] = 0;
        }
        continue;
      }
      const shell = this.shells[i]!;
      if (!shell.isActive()) {
        // Caught in a blast on the way: it never lands.
        this.shells[i] = null;
        this.steps[i] = LANDED;
        continue;
      }
      const path = this.paths[i];
      const next = Math.min(path.length - 1, step + 1);
      this.steps[i] = next;
      shell.move(path[next]);
      if (next === path.length - 1) {
        this.impact(this.impacts[i]);
        shell.setReachedTarget();
        shell.delete(false);
        this.shells[i] = null;
        this.steps[i] = LANDED;
      }
    }
  }

  private impact(tile: TileRef): void {
    const hits = this.mg.nearbyUnits(
      tile,
      BARRAGE_BATTERY_KILL_RADIUS,
      UnitType.CoastalBattery,
      undefined,
      true,
    );
    for (const { unit } of hits) {
      const owner = unit.owner();
      if (owner === this.player || this.player.isFriendly(owner)) continue;
      if (unit.isActive()) unit.delete(true, this.player);
    }
  }

  private end(): void {
    for (const shell of this.shells) {
      if (shell !== null && shell.isActive()) shell.delete(false);
    }
    if (this.marker !== null && this.marker.isActive()) {
      this.marker.delete(false);
    }
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return CoastalBarrageExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      player: w.player(this.player),
      dst: this.dst,
      marker: w.unitOrNull(this.marker),
      silo: this.silo,
      launchTick: this.launchTick,
      impacts: [...this.impacts],
      shells: this.shells.map((s) => w.unitOrNull(s)),
      steps: [...this.steps],
      zoneEndsAt: this.zoneEndsAt,
    });
  }

  restoreSnapshot(s: CoastalBarrageState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.player = r.player(s.player);
    this.dst = s.dst;
    this.marker = r.unitOrNull(s.marker);
    this.silo = s.silo;
    this.launchTick = s.launchTick;
    this.impacts = [...s.impacts];
    this.paths = this.flightPaths(r.game);
    this.shells = s.shells.map((i) => r.unitOrNull(i));
    this.steps = [...s.steps];
    this.zoneEndsAt = s.zoneEndsAt;
  }
}

const CoastalBarrageStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  player: zPlayerRef(),
  // Validated on launch, so a pending execution may hold any number.
  dst: zInt(),
  marker: zRef().nullable(),
  silo: zTile(),
  launchTick: zInt(),
  impacts: z.array(zTile()),
  shells: z.array(zRef().nullable()),
  steps: z.array(zInt()),
  zoneEndsAt: zInt(),
});
type CoastalBarrageState = z.infer<typeof CoastalBarrageStateSchema>;

export const CoastalBarrageExecutionSnapshot = execSnapshotType({
  name: "CoastalBarrage",
  version: 1,
  schema: CoastalBarrageStateSchema,
  cls: () => CoastalBarrageExecution,
});
```

- [ ] **Step 6: 연결 — 건설, 전투, 핵, 등록**

`packages/engine/src/execution/ConstructionExecution.ts`: `import { CoastalBarrageExecution } from "../warfare/CoastalBarrageExecution";`를 추가하고, `completeConstruction`의 `case UnitType.MIRV:` 블록 뒤에 추가:

```ts
      case UnitType.CoastalBarrage:
        this.mg.addExecution(new CoastalBarrageExecution(player, this.tile));
        break;
```

`packages/engine/src/execution/AttackExecution.ts`:
- import 추가: `import { barrageSuppresses } from "../warfare/BarrageZone";`, `import { BARRAGE_ATTACKER_LOSS_FACTOR } from "@openfront/engine-lib/warfare/Warfare";`
- `attackLogicInput`에서 `const defenderHasDefensePost = ...;` 문장을 다음으로 바꾼다(옵션이 꺼지면 `suppressed`는 항상 거짓이고 다른 값은 그대로다):

```ts
    // Expanded warfare: a finished coastal barrage's zone turns the
    // defender's posts off and cuts the attacker's losses (spec §14b).
    const suppressed =
      defender !== null &&
      this.mg.config().warfareExpansion() &&
      barrageSuppresses(this.mg, tile, defender);
    const defenderHasDefensePost =
      !suppressed &&
      defender !== null &&
      this.mg.hasUnitNearby(
        tile,
        this.mg.config().defensePostRange(),
        UnitType.DefensePost,
        defender.id(),
      );
```

- 같은 함수의 `attacker` 객체에서 `lossScale: combat.attackerLoss,`를 다음으로 바꾼다:

```ts
        lossScale: suppressed
          ? combat.attackerLoss * BARRAGE_ATTACKER_LOSS_FACTOR
          : combat.attackerLoss,
```

`packages/engine/src/execution/NukeExecution.ts`의 `detonate()`에서 유닛 제외 조건(`type === UnitType.SAMMissile`가 있는 `if`)에 한 줄을 더한다:

```ts
      if (
        type === UnitType.AtomBomb ||
        type === UnitType.HydrogenBomb ||
        type === UnitType.MIRVWarhead ||
        type === UnitType.MIRV ||
        type === UnitType.SAMMissile ||
        // Expanded warfare: a barrage zone outlives blasts in it.
        type === UnitType.CoastalBarrage
      ) {
        continue;
      }
```

`packages/engine/src/snapshot/ExecutionRegistry.ts`: `import { CoastalBarrageExecutionSnapshot } from "../warfare/CoastalBarrageExecution";`를 추가하고 목록의 `CityExecutionSnapshot,` 뒤에 `CoastalBarrageExecutionSnapshot,`를 넣는다(`CoastalBatteryExecutionSnapshot,` 앞).

`tests/core/snapshot/FullGameSnapshot.test.ts`: `const WARFARE_ONLY_TYPES = ["CoastalBattery"];`를 `const WARFARE_ONLY_TYPES = ["CoastalBarrage", "CoastalBattery"];`로 바꾼다.

- [ ] **Step 7: 통과 확인**

Run: `npx vitest tests/warfare tests/Attack.test.ts tests/AttackLogicGolden.test.ts tests/VanillaDigest.test.ts --run && npx vitest tests/core/snapshot/FullGameSnapshot.test.ts -t "free for all" --run`
Expected: 모두 PASS

- [ ] **Step 8: 커밋**

```bash
npx prettier --write packages/engine/src/warfare packages/engine/src/execution/ConstructionExecution.ts packages/engine/src/execution/AttackExecution.ts packages/engine/src/execution/NukeExecution.ts packages/engine/src/snapshot/ExecutionRegistry.ts tests/warfare tests/core/snapshot/FullGameSnapshot.test.ts
git add packages/engine/src tests/warfare tests/core/snapshot/FullGameSnapshot.test.ts
git commit -m "feat(warfare): coastal barrage salvo, battery kills and suppression zone"
```

---
### Task 5: 공항과 출격 횟수

**Files:**
- Create: `packages/engine/src/warfare/AirportExecution.ts`
- Modify: `packages/engine/src/game/UnitImpl.ts` (`increaseLevel`, `decreaseLevel`)
- Modify: `packages/engine/src/execution/ConstructionExecution.ts` (`completeConstruction`)
- Modify: `packages/engine/src/snapshot/ExecutionRegistry.ts`
- Modify (test): `tests/core/snapshot/FullGameSnapshot.test.ts` (`WARFARE_ONLY_TYPES`)
- Test: `tests/warfare/Airport.test.ts`

**Interfaces:**
- Consumes: Task 1 `AIRPORT_SORTIE_COOLDOWN_TICKS`, `airportRange`, `PlayerImpl.airportSortieSpawn`
- Produces:
  - `new AirportExecution(airport: Unit)`, 스냅샷 이름 `"Airport"`(Task 8이 화물 출발을 더해 파일을 바꾼다)
  - 출격 = `airport.launch()`(대기열에 넣기), 빈 칸 판정 = `airport.isInCooldown()`(대기열 길이 = 레벨), 재장전은 `AirportExecution`이 300틱 뒤 `reloadMissile()`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/warfare/Airport.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { grantLaws, grantTechs } from "../domestic/util";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, warfareGame } from "./util";

// big_plains (200x200): red holds the north-west corner, blue the rest of
// the south-east; red builds at (10, 10).
async function base(config: Parameters<typeof warfareGame>[1] = {}) {
  const game = await warfareGame("big_plains", {
    instantBuild: true,
    ...config,
  });
  const red = own(game, RED.id, 0, 0, 40, 40);
  const blue = own(game, BLUE.id, 100, 100, 100, 100);
  red.addGold(100_000_000n);
  return { game, red, blue };
}

function buildAirport(game: Game, red: Player): Unit {
  game.addExecution(
    new ConstructionExecution(red, UnitType.Airport, game.ref(10, 10)),
  );
  executeTicks(game, 3);
  const airport = red.units(UnitType.Airport)[0];
  expect(airport).toBeDefined();
  return airport;
}

const target = (game: Game) => game.ref(110, 110); // 141 tiles from (10, 10)

describe("airport", () => {
  test("takes 60 s to build", async () => {
    const { game, red } = await base({ instantBuild: false });
    game.addExecution(
      new ConstructionExecution(red, UnitType.Airport, game.ref(10, 10)),
    );
    executeTicks(game, 3);
    const airport = red.units(UnitType.Airport)[0];
    expect(airport.isUnderConstruction()).toBe(true);
    executeTicks(game, 590);
    expect(airport.isUnderConstruction()).toBe(true);
    executeTicks(game, 15);
    expect(airport.isUnderConstruction()).toBe(false);
  });

  test("a level 1 airport has one sortie, back 30 s after it is used", async () => {
    const { game, red } = await base();
    const airport = buildAirport(game, red);
    expect(red.canBuild(UnitType.Bomber, target(game))).toBe(airport.tile());
    airport.launch();
    expect(red.canBuild(UnitType.Bomber, target(game))).toBe(false);
    expect(red.canBuild(UnitType.TransportPlane, target(game))).toBe(false);
    executeTicks(game, 299);
    expect(red.canBuild(UnitType.Bomber, target(game))).toBe(false);
    executeTicks(game, 2);
    expect(red.canBuild(UnitType.Bomber, target(game))).toBe(airport.tile());
  });

  test("an upgrade adds a sortie (reloading first) and 30 tiles of range", async () => {
    const { game, red } = await base();
    const airport = buildAirport(game, red);
    const far = game.ref(130, 130); // 170 tiles
    expect(red.canBuild(UnitType.Bomber, far)).toBe(false);

    red.upgradeUnit(airport);
    expect(airport.level()).toBe(2);
    expect(airport.missileTimerQueue()).toHaveLength(1);
    expect(airport.isInCooldown()).toBe(false);
    expect(red.canBuild(UnitType.Bomber, far)).toBe(airport.tile());

    airport.launch();
    expect(airport.isInCooldown()).toBe(true);
    executeTicks(game, 302);
    expect(airport.missileTimerQueue()).toHaveLength(0);
  });

  test("survives a snapshot while a sortie reloads", async () => {
    const { game, red } = await base();
    const airport = buildAirport(game, red);
    airport.launch();
    executeTicks(game, 10);
    await expectSnapshotRoundTrip(game, "big_plains", 20);
  });
});

describe("airport in domestic mode", () => {
  test("industrialization unlocks it; structure cost and build time modifiers apply", async () => {
    const { game, red } = await base({
      domesticMode: true,
      instantBuild: false,
    });
    expect(red.canBuild(UnitType.Airport, game.ref(10, 10))).toBe(false);
    grantTechs(red, "industrialization"); // all structures -15%
    grantLaws(red, { construction: "B" }); // build time -50%
    expect(game.unitInfo(UnitType.Airport).cost(game, red)).toBe(2_550_000n);
    game.addExecution(
      new ConstructionExecution(red, UnitType.Airport, game.ref(10, 10)),
    );
    executeTicks(game, 3);
    const airport = red.units(UnitType.Airport)[0];
    expect(airport.constructionTicks()).toBe(300);
    executeTicks(game, 305);
    expect(airport.isUnderConstruction()).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/warfare/Airport.test.ts --run`
Expected: FAIL — "a level 1 airport has one sortie…"가 마지막 기대에서 `expected false to be …`(재장전하는 실행이 없다), 업그레이드 테스트는 `missileTimerQueue` 길이 0

- [ ] **Step 3: 공항 실행과 업그레이드 칸**

`packages/engine/src/warfare/AirportExecution.ts`:

```ts
import { zRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { AIRPORT_SORTIE_COOLDOWN_TICKS } from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { Execution, Game, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/**
 * An airport (spec §14b). Sorties work like a silo's missiles: one per
 * level, a used one (launch()) waits in the unit's timer queue and comes
 * back AIRPORT_SORTIE_COOLDOWN_TICKS later. Paradrops and bombing share them.
 */
export class AirportExecution implements Execution {
  private mg: Game;
  private active = true;

  constructor(private airport: Unit) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(_ticks: number): void {
    if (!this.airport.isActive()) {
      this.active = false;
      return;
    }
    if (this.airport.isUnderConstruction()) return;
    const now = this.mg.ticks();
    const queue = this.airport.missileTimerQueue();
    while (
      queue.length > 0 &&
      now - queue[0] >= AIRPORT_SORTIE_COOLDOWN_TICKS
    ) {
      this.airport.reloadMissile();
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return AirportExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      airport: w.unit(this.airport),
    });
  }

  restoreSnapshot(s: AirportState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.airport = r.unit(s.airport);
  }
}

const AirportStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  airport: zRef(),
});
type AirportState = z.infer<typeof AirportStateSchema>;

export const AirportExecutionSnapshot = execSnapshotType({
  name: "Airport",
  version: 1,
  schema: AirportStateSchema,
  cls: () => AirportExecution,
});
```

`packages/engine/src/game/UnitImpl.ts`: `increaseLevel()`와 `decreaseLevel()`에 있는 `[UnitType.MissileSilo, UnitType.SAMLauncher].includes(this.type())` 두 곳을 모두 다음으로 바꾼다(공항의 새 칸도 미사일 기지처럼 대기 상태로 시작한다):

```ts
[UnitType.MissileSilo, UnitType.SAMLauncher, UnitType.Airport].includes(
  this.type(),
)
```

`packages/engine/src/execution/ConstructionExecution.ts`: `import { AirportExecution } from "../warfare/AirportExecution";`를 추가하고, `completeConstruction`의 `case UnitType.CoastalBattery:` 블록 뒤에 추가:

```ts
      case UnitType.Airport:
        this.mg.addExecution(new AirportExecution(this.structure!));
        break;
```

`packages/engine/src/snapshot/ExecutionRegistry.ts`: `import { AirportExecutionSnapshot } from "../warfare/AirportExecution";`를 추가하고 목록 맨 앞 `AllianceExtensionExecutionSnapshot,` 앞에 `AirportExecutionSnapshot,`를 넣는다(이름순).

`tests/core/snapshot/FullGameSnapshot.test.ts`: `WARFARE_ONLY_TYPES`를 `["Airport", "CoastalBarrage", "CoastalBattery"]`로 바꾼다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest tests/warfare tests/MissileSilo.test.ts --run && npx vitest tests/core/snapshot/FullGameSnapshot.test.ts -t "free for all" --run`
Expected: 모두 PASS

- [ ] **Step 5: 커밋**

```bash
npx prettier --write packages/engine/src/warfare packages/engine/src/game/UnitImpl.ts packages/engine/src/execution/ConstructionExecution.ts packages/engine/src/snapshot/ExecutionRegistry.ts tests/warfare tests/core/snapshot/FullGameSnapshot.test.ts
git add packages/engine/src tests/warfare tests/core/snapshot/FullGameSnapshot.test.ts
git commit -m "feat(warfare): airport with per-level sorties that reload in 30 s"
```

---
### Task 6: 공수 투입 (`paradrop` 명령, 수송기, 착지 공격)

**Files:**
- Modify: `packages/engine-api/src/Schemas.ts` (`ParadropIntentSchema`)
- Modify: `packages/engine/src/execution/ExecutionManager.ts`
- Modify: `packages/engine/src/execution/AttackExecution.ts` (`sourceRadius`)
- Create: `packages/engine/src/warfare/Interception.ts`
- Create: `packages/engine/src/warfare/ParadropExecution.ts`
- Modify: `packages/engine/src/snapshot/ExecutionRegistry.ts`
- Modify (test): `tests/core/snapshot/FullGameSnapshot.test.ts`, `tests/zbin/wire.test.ts` (`SAMPLE_INTENTS`)
- Test: `tests/warfare/Paradrop.test.ts`

**Interfaces:**
- Consumes: Task 1 `PARADROP_RADIUS`, `PLANE_SPEED`, `PlayerImpl.paradropSpawn`; Task 4 `straightFlightPath`; Task 5 `AirportExecution`
- Produces:
  - 인텐트 `{ type: "paradrop"; troops: number; dst: number }`, 타입 `ParadropIntent`
  - `new ParadropExecution(player: Player, troops: number, dst: TileRef)`, 스냅샷 이름 `"Paradrop"`
  - `new AttackExecution(startTroops, owner, targetID, sourceTile, removeTroops, sourceRadius = 0)` — `sourceRadius > 0`이면 `sourceTile` 반경 안의 자기 땅 전부에서 공격 전선이 시작된다
  - `samMissileClosingIn(mg: Game, unit: Unit, tile: TileRef): boolean`(Task 7도 쓴다)
  - 알림 키 `events_display.paradrop_inbound`(`{name}`, `{troops}`, `NAVAL_INVASION_INBOUND`), `events_display.no_airport_available`(`ATTACK_FAILED`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/warfare/Paradrop.test.ts`:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { IntentSchema } from "@openfront/engine-api/Schemas";
import { AttackLogicInput } from "@openfront/engine/configuration/EngineConfig";
import { activeConditions } from "@openfront/engine/domestic/DomesticEconomy";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { ParadropExecution } from "@openfront/engine/warfare/ParadropExecution";
import { vi } from "vitest";
import { grantLaws, grantTechs } from "../domestic/util";
import { setup } from "../util/Setup";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, warfareGame } from "./util";

// plains: red holds x 0-29 with an airport at (10, 10), blue holds x 60-99.
// The drop at (70, 10) is 60 tiles away: 20 steps at 3 tiles a tick.
async function airfield(config: Parameters<typeof warfareGame>[1] = {}) {
  const game = await warfareGame("plains", config);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 60, 0, 40, 100);
  red.addGold(10_000_000n);
  red.addTroops(100_000);
  blue.addTroops(100_000);
  const airport = red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
  return { game, red, blue, airport };
}

function drop(game: Game, player: Player, troops: number, dst: TileRef) {
  game.addExecution(new ParadropExecution(player, troops, dst));
}

const plane = (p: Player): Unit | undefined =>
  p.units(UnitType.TransportPlane)[0];

describe("paradrop", () => {
  test("costs 100K, a sortie and the troops; lands, takes a radius-2 zone and attacks from it", async () => {
    const { game, red, blue, airport } = await airfield();
    const gold = red.gold();
    const troops = red.troops();
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 2);
    expect(red.gold()).toBe(gold - 100_000n);
    expect(red.troops()).toBe(troops - 30_000);
    expect(airport.isInCooldown()).toBe(true);
    const flying = plane(red)!;
    expect(flying.troops()).toBe(30_000);

    executeTicks(game, 21);
    expect(flying.isActive()).toBe(false);
    for (const [x, y] of [
      [70, 10],
      [72, 10],
      [68, 10],
      [70, 12],
      [71, 11],
    ]) {
      expect(game.owner(game.ref(x, y)), `${x},${y}`).toBe(red);
    }
    const attack = red.outgoingAttacks().find((a) => a.target() === blue);
    expect(attack?.sourceTile()).toBe(game.ref(70, 10));
  });

  test("an ally's landing zone sends the troops home", async () => {
    const { game, red, blue } = await airfield();
    const troops = red.troops();
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 6);
    red.createAllianceRequest(blue)?.accept();
    executeTicks(game, 20);
    expect(plane(red)).toBeUndefined();
    expect(red.troops()).toBe(troops);
    expect(game.owner(game.ref(70, 10))).toBe(blue);
    expect(red.outgoingAttacks()).toHaveLength(0);
  });

  test("lands home: the troops come back", async () => {
    const { game, red } = await airfield();
    const troops = red.troops();
    const target = game.ref(40, 10); // unclaimed when launched
    drop(game, red, 30_000, target);
    executeTicks(game, 3);
    red.conquer(target);
    executeTicks(game, 20);
    expect(red.troops()).toBe(troops);
  });

  test("without a free sortie nothing flies and the player is told", async () => {
    const { game, red, airport } = await airfield();
    airport.launch();
    const spy = vi.spyOn(game, "displayMessage");
    const gold = red.gold();
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 3);
    expect(plane(red)).toBeUndefined();
    expect(red.gold()).toBe(gold);
    expect(spy).toHaveBeenCalledWith(
      "events_display.no_airport_available",
      MessageType.ATTACK_FAILED,
      red.id(),
    );
  });

  test("the target is warned like a naval invasion", async () => {
    const { game, red, blue } = await airfield();
    const spy = vi.spyOn(game, "displayIncomingUnit");
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 2);
    expect(spy).toHaveBeenCalledWith(
      plane(red)!.id(),
      "events_display.paradrop_inbound",
      MessageType.NAVAL_INVASION_INBOUND,
      blue.id(),
    );
  });

  test("survives a snapshot mid-flight and after landing", async () => {
    const { game, red } = await airfield();
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 8);
    await expectSnapshotRoundTrip(game, "plains", 30);
  });

  test("does nothing with the option off", async () => {
    const game = await setup("plains", {}, [RED, BLUE]);
    const red = own(game, RED.id, 0, 0, 30, 100);
    own(game, BLUE.id, 60, 0, 40, 100);
    red.addGold(10_000_000n);
    red.addTroops(100_000);
    red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    const troops = red.troops();
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 25);
    expect(plane(red)).toBeUndefined();
    expect(red.troops()).toBe(troops);
  });

  test("the intent validates", () => {
    expect(
      IntentSchema.safeParse({ type: "paradrop", troops: 1500.5, dst: 77 })
        .success,
    ).toBe(true);
    expect(
      IntentSchema.safeParse({ type: "paradrop", troops: -1, dst: 77 })
        .success,
    ).toBe(false);
  });
});

describe("paradrop in domestic mode", () => {
  test("is an attack: combat modifiers apply and it counts as attacking", async () => {
    const { game, red } = await airfield({ domesticMode: true });
    grantTechs(red, "industrialization");
    grantLaws(red, { service: "B" }); // attack losses -15%
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 21);
    const spy = vi.spyOn(game.config(), "attackLogic");
    executeTicks(game, 4);
    const inputs: AttackLogicInput[] = spy.mock.calls.map(([i]) => i);
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((i) => i.attacker.lossScale === 0.85)).toBe(true);
    expect(activeConditions(red, 1_000_000).has("attacking")).toBe(true);
  });

  test("industrialization unlocks it", async () => {
    const { game, red } = await airfield({ domesticMode: true });
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 3);
    expect(plane(red)).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/warfare/Paradrop.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine/warfare/ParadropExecution'`

- [ ] **Step 3: 인텐트 스키마**

`packages/engine-api/src/Schemas.ts`:
- `Intent` 유니언 끝의 `| StartVictoryProjectIntent;`를 다음으로 바꾼다:

```ts
  | StartVictoryProjectIntent
  | ParadropIntent;
```

- `export type StartVictoryProjectIntent = …;` 선언 바로 뒤에 `export type ParadropIntent = z.infer<typeof ParadropIntentSchema>;`를 추가한다.
- `StartVictoryProjectIntentSchema` 정의 바로 뒤에 추가:

```ts
// Expanded warfare: fly `troops` from the nearest airport with a free
// sortie and drop them on `dst` (spec §14b).
export const ParadropIntentSchema = z.object({
  type: z.literal("paradrop"),
  // Fractional like a boat's troops (attackRatio * troops).
  troops: zb.float({ min: 0 }),
  dst: zb.uint(),
});
```

- `IntentSchema` 목록 끝의 `StartVictoryProjectIntentSchema,` 뒤에 `ParadropIntentSchema,`를 추가한다.

`tests/zbin/wire.test.ts`의 `SAMPLE_INTENTS` 끝(`];` 앞)에 추가:

```ts
  { type: "paradrop", clientID: P2, troops: 12345.5, dst: 4242 },
```

- [ ] **Step 4: 착지 반경에서 시작하는 공격**

`packages/engine/src/execution/AttackExecution.ts`:
- 생성자 매개변수 `private removeTroops: boolean = true,` 뒤에 추가:

```ts
    /**
     * Paradrops: the front starts around every own tile within this radius
     * of sourceTile (the landing zone), not just sourceTile. 0 = vanilla.
     */
    private sourceRadius: number = 0,
```

- `init`의

```ts
    if (this.sourceTile !== null) {
      this.addNeighbors(this.sourceTile);
    } else {
```

를 다음으로 바꾼다:

```ts
    if (this.sourceTile !== null && this.sourceRadius > 0) {
      for (const t of this.map.circleSearch(
        this.sourceTile,
        this.sourceRadius,
      )) {
        if (this.map.ownerID(t) === this.ownerSmallID) this.addNeighbors(t);
      }
    } else if (this.sourceTile !== null) {
      this.addNeighbors(this.sourceTile);
    } else {
```

- `snapshot()`의 `removeTroops: this.removeTroops,` 뒤에 추가(원작 스냅샷에는 키가 없다):

```ts
      ...(this.sourceRadius > 0 ? { sourceRadius: this.sourceRadius } : {}),
```

- `restoreSnapshot()` 끝에 `this.sourceRadius = s.sourceRadius ?? 0;`를 추가한다.
- `AttackExecutionStateSchema`의 `removeTroops: z.boolean(),` 뒤에 `sourceRadius: zInt().optional(),`를 추가한다.

- [ ] **Step 5: 요격 대기 판정과 공수 실행**

`packages/engine/src/warfare/Interception.ts`:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { Game, isUnit, Unit } from "../game/Game";

/**
 * A SAM missile chasing `unit` is about to reach `tile`. A plane waits a
 * tick at its target for it, as NukeExecution does for nukes: the SAM side
 * decides whether the interception lands.
 */
export function samMissileClosingIn(
  mg: Game,
  unit: Unit,
  tile: TileRef,
): boolean {
  return (
    mg.nearbyUnits(
      tile,
      mg.config().defaultSamMissileSpeed(),
      UnitType.SAMMissile,
      ({ unit: missile }) =>
        isUnit(missile) &&
        missile.owner() !== unit.owner() &&
        missile.targetUnit()?.id() === unit.id(),
    ).length > 0
  );
}
```

`packages/engine/src/warfare/ParadropExecution.ts`:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  zInt,
  zNum,
  zPlayerRef,
  zRef,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  PARADROP_RADIUS,
  PLANE_SPEED,
} from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { AttackExecution } from "../execution/AttackExecution";
import { Execution, Game, Player, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { straightFlightPath } from "./FlightPath";
import { samMissileClosingIn } from "./Interception";

/**
 * A paradrop (spec §14b): a transport plane takes off from the nearest
 * airport with a free sortie and flies straight to `dst` (SAMs can shoot it
 * down; its troops are lost). On landing it takes the target's land within
 * PARADROP_RADIUS and attacks from all of it. If the zone has become the
 * player's own or a friend's, the troops come home instead.
 */
export class ParadropExecution implements Execution {
  private mg: Game;
  private active = true;
  private plane: Unit | null = null;
  private path: TileRef[] = [];
  private step = 0;

  constructor(
    private player: Player,
    private troops: number,
    private dst: TileRef,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (this.plane === null) {
      this.launch(ticks);
      return;
    }
    if (!this.plane.isActive()) {
      this.active = false;
      return;
    }
    const last = this.path.length - 1;
    if (this.step < last) {
      this.step++;
      this.plane.move(this.path[this.step]);
      this.plane.setTrajectoryIndex(this.step);
      if (this.step < last) return;
    }
    if (samMissileClosingIn(this.mg, this.plane, this.dst)) return;
    this.land();
  }

  private launch(ticks: number): void {
    const mg = this.mg;
    if (!mg.isValidRef(this.dst)) {
      this.active = false;
      return;
    }
    const spawn = this.player.canBuild(UnitType.TransportPlane, this.dst);
    if (spawn === false) {
      if (!mg.config().isUnitDisabled(UnitType.TransportPlane)) {
        mg.displayMessage(
          "events_display.no_airport_available",
          MessageType.ATTACK_FAILED,
          this.player.id(),
        );
      }
      this.active = false;
      return;
    }
    const troops = Math.floor(Math.min(this.troops, this.player.troops()));
    if (troops < 1) {
      this.active = false;
      return;
    }
    this.player
      .units(UnitType.Airport)
      .find((a) => a.tile() === spawn)
      ?.launch();
    this.path = straightFlightPath(mg, spawn, this.dst, PLANE_SPEED);
    this.plane = this.player.buildUnit(UnitType.TransportPlane, spawn, {
      troops,
      targetTile: this.dst,
      trajectory: this.path.map((tile) => ({ tile, targetable: true })),
    });
    mg.recordMotionPlan({
      kind: "grid",
      unitId: this.plane.id(),
      planId: 1,
      startTick: ticks + 1,
      ticksPerStep: 1,
      path: this.path,
    });
    const target = mg.owner(this.dst);
    if (target.isPlayer()) {
      mg.displayIncomingUnit(
        this.plane.id(),
        "events_display.paradrop_inbound",
        MessageType.NAVAL_INVASION_INBOUND,
        target.id(),
      );
    }
  }

  private land(): void {
    const mg = this.mg;
    const plane = this.plane!;
    const troops = plane.troops();
    plane.setReachedTarget();
    plane.delete(false);
    this.active = false;

    const owner = mg.owner(this.dst);
    if (
      !mg.isLand(this.dst) ||
      owner === this.player ||
      (owner.isPlayer() && this.player.isFriendly(owner))
    ) {
      this.player.addTroops(troops);
      return;
    }
    for (const t of mg.circleSearch(this.dst, PARADROP_RADIUS)) {
      if (!mg.isLand(t) || mg.isImpassable(t)) continue;
      if (mg.owner(t) === owner) this.player.conquer(t);
    }
    mg.addExecution(
      new AttackExecution(
        troops,
        this.player,
        owner.id(),
        this.dst,
        false,
        PARADROP_RADIUS,
      ),
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return ParadropExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      player: w.player(this.player),
      troops: this.troops,
      dst: this.dst,
      plane: w.unitOrNull(this.plane),
      path: [...this.path],
      step: this.step,
    });
  }

  restoreSnapshot(s: ParadropState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.player = r.player(s.player);
    this.troops = s.troops;
    this.dst = s.dst;
    this.plane = r.unitOrNull(s.plane);
    this.path = [...s.path];
    this.step = s.step;
  }
}

const ParadropStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  player: zPlayerRef(),
  troops: zNum(),
  // Validated on launch, so a pending execution may hold any number.
  dst: zInt(),
  plane: zRef().nullable(),
  path: z.array(zTile()),
  step: zInt(),
});
type ParadropState = z.infer<typeof ParadropStateSchema>;

export const ParadropExecutionSnapshot = execSnapshotType({
  name: "Paradrop",
  version: 1,
  schema: ParadropStateSchema,
  cls: () => ParadropExecution,
});
```

- [ ] **Step 6: 명령 연결과 등록**

`packages/engine/src/execution/ExecutionManager.ts`: `import { ParadropExecution } from "../warfare/ParadropExecution";`를 추가하고, `createExec` switch의 `case "start_victory_project":` 줄(`return new VictoryProjectExecution(…);`) 뒤에 추가:

```ts
      case "paradrop":
        return new ParadropExecution(player, intent.troops, intent.dst);
```

`packages/engine/src/snapshot/ExecutionRegistry.ts`: `import { ParadropExecutionSnapshot } from "../warfare/ParadropExecution";`를 추가하고 목록의 `NukeExecutionSnapshot,` 뒤에 `ParadropExecutionSnapshot,`를 넣는다.

`tests/core/snapshot/FullGameSnapshot.test.ts`: `WARFARE_ONLY_TYPES`를 `["Airport", "CoastalBarrage", "CoastalBattery", "Paradrop"]`로 바꾼다.

`src/server/IntentAuthorization.ts`는 고치지 않는다. 새 명령은 기본 경로를 타고 보낸 사람에게만 적용된다.

- [ ] **Step 7: 통과 확인**

Run: `npx vitest tests/warfare tests/zbin tests/Attack.test.ts tests/AttackScenarios.test.ts tests/VanillaDigest.test.ts --run && npx vitest tests/core/snapshot/FullGameSnapshot.test.ts -t "free for all" --run && npm run typecheck`
Expected: 모두 PASS, typecheck 오류 없음(`Transport.ts`는 Task 13에서 이 인텐트를 보낸다)

- [ ] **Step 8: 커밋**

```bash
npx prettier --write packages/engine-api/src/Schemas.ts packages/engine/src/warfare packages/engine/src/execution/AttackExecution.ts packages/engine/src/execution/ExecutionManager.ts packages/engine/src/snapshot/ExecutionRegistry.ts tests/warfare tests/zbin/wire.test.ts tests/core/snapshot/FullGameSnapshot.test.ts
git add packages tests/warfare tests/zbin/wire.test.ts tests/core/snapshot/FullGameSnapshot.test.ts
git commit -m "feat(warfare): paradrop intent, transport planes and landing attacks"
```

---
### Task 7: 폭격과 SAM의 항공기 요격(폭격기 50% 회피)

**Files:**
- Modify: `packages/engine/src/warfare/Interception.ts` (`bomberEvades`)
- Create: `packages/engine/src/warfare/BombingExecution.ts`
- Modify: `packages/engine/src/execution/ConstructionExecution.ts` (`completeConstruction`)
- Modify: `packages/engine/src/execution/SAMLauncherExecution.ts` (목표 종류, 빈 하늘 확인)
- Modify: `packages/engine/src/execution/SAMMissileExecution.ts` (항공기, 회피, 알림)
- Modify: `packages/engine/src/snapshot/ExecutionRegistry.ts`
- Modify (test): `tests/core/snapshot/FullGameSnapshot.test.ts`
- Test: `tests/warfare/Interception.test.ts`, `tests/warfare/Bombing.test.ts`

**Interfaces:**
- Consumes: Task 1 `BOMB_INNER`, `BOMB_OUTER`, `BOMBER_EVADE_ODDS`, `PLANE_SPEED`, `PlayerImpl.bomberSpawn`; Task 4 `straightFlightPath`; Task 6 `samMissileClosingIn`, `ParadropExecution`
- Produces:
  - `bomberEvades(tick: number, bomberId: number): boolean`
  - `new BombingExecution(player: Player, dst: TileRef)`, 스냅샷 이름 `"Bombing"`
  - 알림 키 `events_display.bomber_inbound`(`NUKE_INBOUND`), `events_display.bombing_detonated`(`{name}`, `NUKE_DETONATED`), `events_display.bomber_evaded`(`SAM_MISS`), `events_display.plane_shot_down`(`{unit}`, `UNIT_DESTROYED`); `missile_intercepted`의 `{unit}`에 `unit_type.transport_plane`·`unit_type.bomber`

- [ ] **Step 1: 실패하는 테스트 작성 — 회피 확률**

`tests/warfare/Interception.test.ts`:

```ts
import { bomberEvades } from "@openfront/engine/warfare/Interception";

describe("bomber evasion", () => {
  test("about half the interceptions, the same on every client", () => {
    let evaded = 0;
    for (let tick = 0; tick < 1000; tick++) {
      if (bomberEvades(tick, 42)) evaded++;
    }
    expect(evaded).toBeGreaterThan(400);
    expect(evaded).toBeLessThan(600);
    for (let tick = 0; tick < 50; tick++) {
      expect(bomberEvades(tick, 7)).toBe(bomberEvades(tick, 7));
    }
  });
});
```

- [ ] **Step 2: 실패하는 테스트 작성 — 폭격**

`tests/warfare/Bombing.test.ts`:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { activeConditions } from "@openfront/engine/domestic/DomesticEconomy";
import { VictoryProjectExecution } from "@openfront/engine/domestic/VictoryProjectExecution";
import { processVictoryProjectSecond } from "@openfront/engine/domestic/VictoryProjects";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { SAMLauncherExecution } from "@openfront/engine/execution/SAMLauncherExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { ParadropExecution } from "@openfront/engine/warfare/ParadropExecution";
import { vi } from "vitest";
import { buildLevel, grantTechs } from "../domestic/util";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, warfareGame } from "./util";

// Whether a bomber evades is a seeded 50% roll (Interception.test.ts);
// here each test picks the outcome.
const control = vi.hoisted(() => ({ evade: false }));
vi.mock("@openfront/engine/warfare/Interception", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@openfront/engine/warfare/Interception")
  >()),
  bomberEvades: () => control.evade,
}));

// plains: red holds x 0-29 with an airport at (10, 10), blue holds x 60-99.
async function airfield(config: Parameters<typeof warfareGame>[1] = {}) {
  const game = await warfareGame("plains", { instantBuild: true, ...config });
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 60, 0, 40, 100);
  red.addGold(10_000_000n);
  red.addTroops(100_000);
  blue.addTroops(100_000);
  const airport = red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
  return { game, red, blue, airport };
}

function bomb(game: Game, player: Player, dst: TileRef): void {
  game.addExecution(new ConstructionExecution(player, UnitType.Bomber, dst));
}

function samAt(game: Game, owner: Player, x: number, y: number): Unit {
  const sam = owner.buildUnit(UnitType.SAMLauncher, game.ref(x, y), {});
  game.addExecution(new SAMLauncherExecution(owner, null, sam));
  return sam;
}

const bomber = (p: Player): Unit | undefined => p.units(UnitType.Bomber)[0];

describe("bombing", () => {
  beforeEach(() => {
    control.evade = false;
  });

  test("costs 750K and a sortie, then leaves an 18-tile crater without fallout", async () => {
    const { game, red, blue, airport } = await airfield();
    const city = blue.buildUnit(UnitType.City, game.ref(72, 12), {});
    const blueAirport = blue.buildUnit(UnitType.Airport, game.ref(66, 8), {});
    const tiles = blue.numTilesOwned();
    const troops = blue.troops();
    const gold = red.gold();
    bomb(game, red, game.ref(70, 10));
    executeTicks(game, 3);
    expect(red.gold()).toBe(gold - 750_000n);
    expect(airport.isInCooldown()).toBe(true);
    expect(bomber(red)).toBeDefined();

    executeTicks(game, 22);
    expect(bomber(red)).toBeUndefined();
    expect(city.isActive()).toBe(false);
    expect(blueAirport.isActive()).toBe(false);
    expect(game.hasOwner(game.ref(70, 10))).toBe(false);
    expect(game.isLand(game.ref(70, 10))).toBe(true);
    // All of the inner disc (radius 8: about 200 tiles) is lost.
    expect(blue.numTilesOwned()).toBeLessThan(tiles - 190);
    expect(blue.troops()).toBeLessThan(troops);
    expect(game.numTilesWithFallout()).toBe(0);
  });

  test("a SAM shoots down a bomber that doesn't evade: no crater", async () => {
    const { game, red, blue } = await airfield();
    samAt(game, blue, 64, 12);
    const spy = vi.spyOn(game, "displayMessage");
    const tiles = blue.numTilesOwned();
    bomb(game, red, game.ref(70, 10));
    executeTicks(game, 40);
    expect(bomber(red)).toBeUndefined();
    expect(blue.numTilesOwned()).toBe(tiles);
    expect(spy).toHaveBeenCalledWith(
      "events_display.missile_intercepted",
      MessageType.SAM_HIT,
      blue.id(),
      undefined,
      { unit: "unit_type.bomber" },
    );
    expect(spy).toHaveBeenCalledWith(
      "events_display.plane_shot_down",
      MessageType.UNIT_DESTROYED,
      red.id(),
      undefined,
      { unit: "unit_type.bomber" },
    );
  });

  test("an evading bomber gets through and detonates", async () => {
    control.evade = true;
    const { game, red, blue } = await airfield();
    samAt(game, blue, 64, 12);
    const city = blue.buildUnit(UnitType.City, game.ref(72, 12), {});
    const spy = vi.spyOn(game, "displayMessage");
    bomb(game, red, game.ref(70, 10));
    executeTicks(game, 40);
    expect(spy).toHaveBeenCalledWith(
      "events_display.bomber_evaded",
      MessageType.SAM_MISS,
      blue.id(),
    );
    expect(city.isActive()).toBe(false);
    expect(game.hasOwner(game.ref(70, 10))).toBe(false);
  });

  test("SAMs also shoot down transport planes; their troops are lost", async () => {
    const { game, red, blue } = await airfield();
    samAt(game, blue, 64, 12);
    const troops = red.troops();
    game.addExecution(new ParadropExecution(red, 30_000, game.ref(70, 10)));
    executeTicks(game, 40);
    expect(red.units(UnitType.TransportPlane)).toHaveLength(0);
    expect(red.troops()).toBe(troops - 30_000);
    expect(game.owner(game.ref(70, 10))).toBe(blue);
  });

  test("can't bomb own or allied land", async () => {
    const { game, red, blue } = await airfield();
    red.createAllianceRequest(blue)?.accept();
    const gold = red.gold();
    bomb(game, red, game.ref(70, 10));
    bomb(game, red, game.ref(20, 10));
    executeTicks(game, 5);
    expect(bomber(red)).toBeUndefined();
    expect(red.gold()).toBe(gold);
  });

  test("survives a snapshot mid-flight under SAM fire", async () => {
    const { game, red, blue } = await airfield();
    samAt(game, blue, 64, 12);
    bomb(game, red, game.ref(70, 10));
    executeTicks(game, 8);
    await expectSnapshotRoundTrip(game, "plains", 30);
  });
});

describe("bombing in domestic mode", () => {
  test("destroys a victory-project host, which fails the project; it isn't an attack", async () => {
    const { game, red, blue } = await airfield({ domesticMode: true });
    grantTechs(red, "industrialization");
    const host = buildLevel(
      game,
      blue,
      UnitType.ResearchInstitute,
      70,
      12,
      3,
    );
    grantTechs(blue, "space_program");
    blue.addGold(5_000_000n);
    game.addExecution(new VictoryProjectExecution(blue, "science", host.id()));
    executeTicks(game, 1);
    expect(blue.domestic()!.victoryProject()?.hostUnitId).toBe(host.id());

    bomb(game, red, game.ref(70, 10));
    executeTicks(game, 25);
    expect(host.isActive()).toBe(false);
    expect(activeConditions(red, 1_000_000).has("attacking")).toBe(false);
    processVictoryProjectSecond(game, blue, blue.domestic()!);
    expect(blue.domestic()!.victoryProject()).toBeNull();
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest tests/warfare/Interception.test.ts tests/warfare/Bombing.test.ts --run`
Expected: FAIL — `bomberEvades`가 없다(`does not provide an export named 'bomberEvades'`)

- [ ] **Step 4: 회피 판정**

`packages/engine/src/warfare/Interception.ts`의 import에 `import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";`, `import { BOMBER_EVADE_ODDS } from "@openfront/engine-lib/warfare/Warfare";`를 더하고 파일 끝에 추가:

```ts
/**
 * Whether a bomber dodges the SAM missile reaching it now (50%, spec §14b).
 * Seeded by the tick and the bomber, so every client rolls the same.
 */
export function bomberEvades(tick: number, bomberId: number): boolean {
  return new PseudoRandom(tick * 31 + bomberId).chance(BOMBER_EVADE_ODDS);
}
```

- [ ] **Step 5: 폭격 실행 작성**

`packages/engine/src/warfare/BombingExecution.ts`:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  MessageType,
  Structures,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { listNukeBreakAlliance } from "@openfront/engine-lib/execution/NukeAlliance";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  zInt,
  zPlayerRef,
  zRef,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  BOMB_INNER,
  BOMB_OUTER,
  PLANE_SPEED,
} from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { Execution, Game, Player, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { straightFlightPath } from "./FlightPath";
import { samMissileClosingIn } from "./Interception";

/** Units a bomb never destroys: missiles in flight, bombers, barrage zones. */
const BLAST_PROOF: ReadonlySet<UnitType> = new Set([
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRVWarhead,
  UnitType.MIRV,
  UnitType.SAMMissile,
  UnitType.Bomber,
  UnitType.CoastalBarrage,
]);

/** How far past the blast structures are redrawn (NukeExecution's sprite radius). */
const SPRITE_RADIUS = 16;

/**
 * Bombing (spec §14b): a bomber flies straight from the nearest airport
 * with a free sortie (SAMs may shoot it; it evades each interception with
 * 50%) and drops a small atom bomb: inner BOMB_INNER, outer BOMB_OUTER,
 * atom-bomb troop deaths and unit destruction, alliances broken like a
 * nuke's, and no fallout or water: the land just becomes unclaimed.
 */
export class BombingExecution implements Execution {
  private mg: Game;
  private active = true;
  private bomber: Unit | null = null;
  private path: TileRef[] = [];
  private step = 0;

  constructor(
    private player: Player,
    private dst: TileRef,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (this.bomber === null) {
      this.launch(ticks);
      return;
    }
    if (!this.bomber.isActive()) {
      this.active = false;
      return;
    }
    const last = this.path.length - 1;
    if (this.step < last) {
      this.step++;
      this.bomber.move(this.path[this.step]);
      this.bomber.setTrajectoryIndex(this.step);
      if (this.step < last) return;
    }
    if (samMissileClosingIn(this.mg, this.bomber, this.dst)) return;
    this.detonate();
  }

  private launch(ticks: number): void {
    const mg = this.mg;
    if (!mg.isValidRef(this.dst)) {
      this.active = false;
      return;
    }
    const spawn = this.player.canBuild(UnitType.Bomber, this.dst);
    if (spawn === false) {
      if (!mg.config().isUnitDisabled(UnitType.Bomber)) {
        mg.displayMessage(
          "events_display.no_airport_available",
          MessageType.ATTACK_FAILED,
          this.player.id(),
        );
      }
      this.active = false;
      return;
    }
    this.player
      .units(UnitType.Airport)
      .find((a) => a.tile() === spawn)
      ?.launch();
    this.path = straightFlightPath(mg, spawn, this.dst, PLANE_SPEED);
    this.bomber = this.player.buildUnit(UnitType.Bomber, spawn, {
      targetTile: this.dst,
      trajectory: this.path.map((tile) => ({ tile, targetable: true })),
    });
    mg.recordMotionPlan({
      kind: "grid",
      unitId: this.bomber.id(),
      planId: 1,
      startTick: ticks + 1,
      ticksPerStep: 1,
      path: this.path,
    });
    this.breakAlliances();
    const target = mg.owner(this.dst);
    if (target.isPlayer()) {
      mg.displayIncomingUnit(
        this.bomber.id(),
        "events_display.bomber_inbound",
        MessageType.NUKE_INBOUND,
        target.id(),
      );
    }
  }

  /** As NukeExecution.maybeBreakAlliances, for the bomb's smaller blast. */
  private breakAlliances(): void {
    const mg = this.mg;
    const hit = listNukeBreakAlliance({
      game: mg,
      targetTile: this.dst,
      magnitude: { inner: BOMB_INNER, outer: BOMB_OUTER },
      threshold: mg.config().nukeAllianceBreakThreshold(),
    });
    for (const smallID of hit) {
      const other = mg.playerBySmallID(smallID);
      if (!other.isPlayer() || other === this.player) continue;
      const alliance = this.player.allianceWith(other);
      if (alliance !== null) this.player.breakAlliance(alliance);
      other.updateRelation(this.player, -100);
    }
  }

  private detonate(): void {
    const mg = this.mg;
    const config = mg.config();
    const bomber = this.bomber!;
    const rand = new PseudoRandom(mg.ticks());
    const inner2 = BOMB_INNER * BOMB_INNER;
    const outer2 = BOMB_OUTER * BOMB_OUTER;
    const tiles = mg.bfs(this.dst, (_, n: TileRef) => {
      const d2 = mg.euclideanDistSquared(this.dst, n);
      return (
        d2 <= outer2 && (d2 <= inner2 || rand.chance(2)) && !mg.isImpassable(n)
      );
    });

    const lostTiles = new Map<Player, number>();
    for (const tile of tiles) {
      const owner = mg.owner(tile);
      if (owner.isPlayer()) {
        owner.relinquish(tile);
        lostTiles.set(owner, (lostTiles.get(owner) ?? 0) + 1);
      }
      // No fallout and no water: only the crater picture.
      mg.queueNukeImpact(tile);
    }

    for (const [victim, lost] of lostTiles) {
      const tilesBefore = victim.numTilesOwned() + lost;
      const maxTroops = config.maxTroops(victim);
      const attacks = victim.outgoingAttacks();
      const boats = victim.units(UnitType.TransportShip);
      for (let i = 0; i < lost; i++) {
        const left = tilesBefore - i;
        const deaths = (troops: number) =>
          config.nukeDeathFactor(UnitType.AtomBomb, troops, left, maxTroops);
        victim.removeTroops(deaths(victim.troops()));
        for (const attack of attacks) {
          attack.setTroops(attack.troops() - deaths(attack.troops()));
        }
        for (const boat of boats) {
          boat.setTroops(boat.troops() - deaths(boat.troops()));
        }
      }
    }

    for (const unit of mg.units()) {
      if (BLAST_PROOF.has(unit.type()) || !unit.isActive()) continue;
      if (mg.euclideanDistSquared(this.dst, unit.tile()) < outer2) {
        const friendly = this.player.isFriendly(unit.owner(), true);
        unit.delete(true, friendly ? undefined : this.player);
      }
    }

    const redraw = (BOMB_OUTER + SPRITE_RADIUS) * (BOMB_OUTER + SPRITE_RADIUS);
    for (const unit of mg.units()) {
      if (
        Structures.has(unit.type()) &&
        mg.euclideanDistSquared(this.dst, unit.tile()) < redraw
      ) {
        unit.touch();
      }
    }

    bomber.setReachedTarget();
    bomber.delete(false);
    this.active = false;
    for (const [victim] of lostTiles) {
      mg.displayMessage(
        "events_display.bombing_detonated",
        MessageType.NUKE_DETONATED,
        victim.id(),
        undefined,
        { name: this.player.displayName() },
        undefined,
        this.player.id(),
      );
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return BombingExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      player: w.player(this.player),
      dst: this.dst,
      bomber: w.unitOrNull(this.bomber),
      path: [...this.path],
      step: this.step,
    });
  }

  restoreSnapshot(s: BombingState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.player = r.player(s.player);
    this.dst = s.dst;
    this.bomber = r.unitOrNull(s.bomber);
    this.path = [...s.path];
    this.step = s.step;
  }
}

const BombingStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  player: zPlayerRef(),
  // Validated on launch, so a pending execution may hold any number.
  dst: zInt(),
  bomber: zRef().nullable(),
  path: z.array(zTile()),
  step: zInt(),
});
type BombingState = z.infer<typeof BombingStateSchema>;

export const BombingExecutionSnapshot = execSnapshotType({
  name: "Bombing",
  version: 1,
  schema: BombingStateSchema,
  cls: () => BombingExecution,
});
```

`packages/engine/src/execution/ConstructionExecution.ts`: `import { BombingExecution } from "../warfare/BombingExecution";`를 추가하고, `completeConstruction`의 `case UnitType.CoastalBarrage:` 블록 뒤에 추가:

```ts
      case UnitType.Bomber:
        this.mg.addExecution(new BombingExecution(player, this.tile));
        break;
```

- [ ] **Step 6: SAM이 항공기를 노리고, 폭격기는 피한다**

`packages/engine/src/execution/SAMLauncherExecution.ts`:
- 파일 위(`type Target = …` 앞)에 추가:

```ts
const NUKE_TARGETS: readonly UnitType[] = [
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRVWarhead,
];
/** Expanded warfare: SAMs also shoot transport planes and bombers (spec §14b). */
const WARFARE_TARGETS: readonly UnitType[] = [
  ...NUKE_TARGETS,
  UnitType.TransportPlane,
  UnitType.Bomber,
];

function samTargetTypes(mg: Game): readonly UnitType[] {
  return mg.config().warfareExpansion() ? WARFARE_TARGETS : NUKE_TARGETS;
}
```

- `getValidTargets`의 `nearbyUnits` 셋째 인자 `[UnitType.AtomBomb, UnitType.HydrogenBomb, UnitType.MIRVWarhead],`를 `samTargetTypes(this.mg),`로 바꾼다.
- `SAMLauncherExecution.tick`의 빈 하늘 확인

```ts
    if (
      this.mg.unitCount(UnitType.AtomBomb) === 0 &&
      this.mg.unitCount(UnitType.HydrogenBomb) === 0 &&
      this.mg.unitCount(UnitType.MIRVWarhead) === 0
    ) {
      return;
    }
```

를 다음으로 바꾼다(원작은 같은 세 개를 같은 순서로 본다):

```ts
    if (samTargetTypes(this.mg).every((t) => this.mg.unitCount(t) === 0)) {
      return;
    }
```

`packages/engine/src/execution/SAMMissileExecution.ts`:
- import에 `import { bomberEvades } from "../warfare/Interception";`를 더한다.
- `INTERCEPTED_UNIT_TRANSLATION_KEYS`에 두 줄을 더하고, 그 아래에 요격 대상 목록을 둔다:

```ts
const INTERCEPTED_UNIT_TRANSLATION_KEYS: Partial<Record<UnitType, string>> = {
  [UnitType.AtomBomb]: "unit_type.atom_bomb",
  [UnitType.HydrogenBomb]: "unit_type.hydrogen_bomb",
  [UnitType.MIRVWarhead]: "unit_type.mirv",
  [UnitType.TransportPlane]: "unit_type.transport_plane",
  [UnitType.Bomber]: "unit_type.bomber",
};

/** The MIRV carrier itself can't be intercepted, only its warheads. Planes exist only with expanded warfare. */
const INTERCEPTABLE: readonly UnitType[] = [
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRVWarhead,
  UnitType.TransportPlane,
  UnitType.Bomber,
];
```

- `tick`의 `const nukesWhitelist = [ … ];` 선언(바로 위 주석 포함)을 지우고, 조건의 `!nukesWhitelist.includes(this.target.type())`를 `!INTERCEPTABLE.includes(this.target.type())`로 바꾼다.
- `if (result.status === PathStatus.COMPLETE) { … return; }` 블록 전체를 다음으로 바꾼다(원작 경로의 호출 순서는 그대로다):

```ts
      if (result.status === PathStatus.COMPLETE) {
        const type = this.target.type();
        if (
          type === UnitType.Bomber &&
          bomberEvades(this.mg.ticks(), this.target.id())
        ) {
          // Dodged: the missile is spent, and SAMs may try again.
          this.target.setTargetedBySAM(false);
          this.mg.displayMessage(
            "events_display.bomber_evaded",
            MessageType.SAM_MISS,
            this._owner.id(),
          );
          this.active = false;
          this.SAMMissile.delete(false);
          return;
        }
        this.mg.displayMessage(
          "events_display.missile_intercepted",
          MessageType.SAM_HIT,
          this._owner.id(),
          undefined,
          {
            unit: INTERCEPTED_UNIT_TRANSLATION_KEYS[type] ?? type,
          },
        );
        this.active = false;
        this.target.delete(true, this._owner);
        this.SAMMissile.delete(false);

        if (type === UnitType.TransportPlane || type === UnitType.Bomber) {
          this.mg.displayMessage(
            "events_display.plane_shot_down",
            MessageType.UNIT_DESTROYED,
            this.target.owner().id(),
            undefined,
            { unit: INTERCEPTED_UNIT_TRANSLATION_KEYS[type] ?? type },
          );
        } else {
          // Record stats
          this.mg.stats().bombIntercept(this._owner, type as NukeType, 1);
        }
        return;
      }
```

- [ ] **Step 7: 등록**

`packages/engine/src/snapshot/ExecutionRegistry.ts`: `import { BombingExecutionSnapshot } from "../warfare/BombingExecution";`를 추가하고 목록의 `BoatRetreatExecutionSnapshot,` 뒤에 `BombingExecutionSnapshot,`를 넣는다.

`tests/core/snapshot/FullGameSnapshot.test.ts`: `WARFARE_ONLY_TYPES`를 `["Airport", "Bombing", "CoastalBarrage", "CoastalBattery", "Paradrop"]`로 바꾼다.

- [ ] **Step 8: 통과 확인**

Run: `npx vitest tests/warfare tests/core/executions/SAMLauncherExecution.test.ts tests/core/snapshot/StructureExecutions.test.ts tests/NationNukeSamOverwhelm.test.ts tests/AftergameSingleplayer.test.ts tests/VanillaDigest.test.ts --run && npx vitest tests/core/snapshot/FullGameSnapshot.test.ts -t "free for all" --run`
Expected: 모두 PASS

- [ ] **Step 9: 커밋**

```bash
npx prettier --write packages/engine/src/warfare packages/engine/src/execution/ConstructionExecution.ts packages/engine/src/execution/SAMLauncherExecution.ts packages/engine/src/execution/SAMMissileExecution.ts packages/engine/src/snapshot/ExecutionRegistry.ts tests/warfare tests/core/snapshot/FullGameSnapshot.test.ts
git add packages/engine/src tests/warfare tests/core/snapshot/FullGameSnapshot.test.ts
git commit -m "feat(warfare): bombing from airports; SAMs shoot planes, bombers evade half"
```

---
### Task 8: 화물 항공로

**Files:**
- Create: `packages/engine/src/warfare/CargoPlaneExecution.ts`
- Modify: `packages/engine/src/warfare/AirportExecution.ts` (화물 출발 추가, 파일 전체 교체)
- Modify: `packages/engine/src/domestic/DomesticEconomy.ts` (`domesticTradeGold`의 `"cargo"`)
- Modify: `packages/engine/src/configuration/EngineConfig.ts` (`cargoPlaneGold`)
- Modify: `packages/engine/src/snapshot/ExecutionRegistry.ts`
- Modify (test): `tests/core/snapshot/FullGameSnapshot.test.ts`
- Test: `tests/warfare/CargoRoutes.test.ts`

**Interfaces:**
- Consumes: Task 1 `cargoGold`, `airportRange`, `CARGO_INTERVAL_TICKS`, `PLANE_SPEED`; Task 4 `straightFlightPath`; Task 5 `AirportExecution`
- Produces:
  - `cargoPartners(mg: Game, airport: Unit): Unit[]`
  - `new CargoPlaneExecution(owner: Player, src: Unit, dst: Unit)`, 스냅샷 이름 `"CargoPlane"`
  - `EngineConfig.cargoPlaneGold(distance: number, player: PlayerLike): Gold`
  - `domesticTradeGold(base, recipient, partner, kind: "tradeShip" | "train" | "cargo")`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/warfare/CargoRoutes.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { SAMLauncherExecution } from "@openfront/engine/execution/SAMLauncherExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { grantLaws, grantTechs } from "../domestic/util";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, warfareGame } from "./util";

// plains: red's airport at (10, 10), blue's at (70, 10): 60 tiles apart, so
// a flight pays 20,000 + 100 x 60 = 26,000 to each side. Each airport sends
// one flight 300 ticks after it opens, so each side gets 52,000 per round.
async function route(
  config: Parameters<typeof warfareGame>[1] = {},
  map = "plains",
  blueAt: [number, number] = [70, 10],
) {
  const game = await warfareGame(map, { instantBuild: true, ...config });
  const red = own(game, RED.id, 0, 0, 30, 30);
  const blue = own(game, BLUE.id, blueAt[0] - 10, blueAt[1] - 10, 20, 20);
  red.addGold(10_000_000n);
  blue.addGold(10_000_000n);
  if (config.domesticMode) {
    grantTechs(red, "industrialization");
    grantTechs(blue, "industrialization");
  }
  game.addExecution(
    new ConstructionExecution(red, UnitType.Airport, game.ref(10, 10)),
    new ConstructionExecution(blue, UnitType.Airport, game.ref(...blueAt)),
  );
  executeTicks(game, 3);
  const redAirport = red.units(UnitType.Airport)[0];
  const blueAirport = blue.units(UnitType.Airport)[0];
  expect(redAirport).toBeDefined();
  expect(blueAirport).toBeDefined();
  return { game, red, blue, redAirport, blueAirport };
}

function earned(game: Game, players: Player[], ticks: number): bigint[] {
  const before = players.map((p) => p.gold());
  executeTicks(game, ticks);
  return players.map((p, i) => p.gold() - before[i]);
}

const planes = (game: Game): Unit[] => game.units(UnitType.CargoPlane);

describe("cargo air routes", () => {
  test("two airports in each other's range trade both ways", async () => {
    const { game, red, blue } = await route();
    const trade = red.tradeGold();
    expect(earned(game, [red, blue], 330)).toEqual([52_000n, 52_000n]);
    expect(red.tradeGold() - trade).toBe(52_000n);
  });

  test("an embargo stops the flights", async () => {
    const { game, red, blue } = await route();
    red.addEmbargo(blue, false);
    expect(earned(game, [red, blue], 330)).toEqual([0n, 0n]);
  });

  test("an embargo mid-flight drops the cargo unpaid", async () => {
    const { game, red, blue } = await route();
    executeTicks(game, 305);
    expect(planes(game).length).toBe(2);
    red.addEmbargo(blue, false);
    expect(earned(game, [red, blue], 30)).toEqual([0n, 0n]);
    expect(planes(game)).toHaveLength(0);
  });

  test("a captured destination airport gets no flight", async () => {
    const { game, red, blue, blueAirport } = await route();
    executeTicks(game, 305);
    red.captureUnit(blueAirport);
    expect(earned(game, [red, blue], 30)).toEqual([0n, 0n]);
  });

  test("both airports must reach each other", async () => {
    const { game, red, blue, redAirport } = await route(
      {},
      "big_plains",
      [170, 170],
    ); // 226 tiles apart
    red.addGold(100_000_000n);
    red.upgradeUnit(redAirport);
    red.upgradeUnit(redAirport);
    red.upgradeUnit(redAirport); // level 4 reaches 240, blue's level 1 only 150
    expect(earned(game, [red, blue], 330)).toEqual([0n, 0n]);
  });

  test("SAMs never shoot cargo planes", async () => {
    const { game, red, blue } = await route();
    const sam = blue.buildUnit(UnitType.SAMLauncher, game.ref(64, 12), {});
    game.addExecution(new SAMLauncherExecution(blue, null, sam));
    expect(earned(game, [red, blue], 330)).toEqual([52_000n, 52_000n]);
  });

  test("survives a snapshot mid-flight", async () => {
    const { game } = await route();
    executeTicks(game, 310);
    await expectSnapshotRoundTrip(game, "plains", 30);
  });
});

describe("cargo air routes in domestic mode", () => {
  test("isolationism stops foreign cargo", async () => {
    const { game, red, blue } = await route({ domesticMode: true });
    grantLaws(red, { diplomacy: "B" });
    expect(earned(game, [red, blue], 330)).toEqual([0n, 0n]);
  });

  test("trade modifiers raise each side's own pay", async () => {
    const { game, red, blue } = await route({ domesticMode: true });
    grantLaws(red, { trade: "A" }); // trade +40%
    expect(earned(game, [red, blue], 330)).toEqual([72_800n, 52_000n]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/warfare/CargoRoutes.test.ts --run`
Expected: FAIL — "two airports in each other's range trade both ways"에서 `[0n, 0n]`(화물기가 없다)

- [ ] **Step 3: 무역 보정과 화물 금**

`packages/engine/src/domestic/DomesticEconomy.ts`의 `domesticTradeGold`를 다음으로 바꾼다:

```ts
export function domesticTradeGold(
  base: Gold,
  recipient: Player,
  partner: Player,
  kind: "tradeShip" | "train" | "cargo",
): Gold {
  const d = recipient.domestic();
  if (d === null) return base;
  // Cargo flights (expanded warfare) have no stat of their own.
  let pct =
    d.pct("trade") + (kind === "cargo" ? 0 : d.pct(kind)) + d.pct("allGold");
  if (partner !== recipient) {
    pct += d.pct("foreignTrade");
    if (recipient.isAlliedWith(partner)) pct += d.pct("alliedTrade");
  }
  pct = capCombinedPct(pct);
  return pct === 0 ? base : BigInt(Math.round(applyPct(Number(base), pct)));
}
```

`packages/engine/src/configuration/EngineConfig.ts`: warfare import에 `cargoGold`를 더하고, `tradeShipGold` 메서드 바로 뒤에 추가:

```ts
  /** Expanded warfare: gold a cargo flight pays each side before domestic modifiers. */
  cargoPlaneGold(distance: number, player: PlayerLike): Gold {
    return BigInt(
      Math.floor(cargoGold(distance) * this.goldMultiplierFor(player)),
    );
  }
```

- [ ] **Step 4: 화물기 실행 작성**

`packages/engine/src/warfare/CargoPlaneExecution.ts`:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  zInt,
  zPlayerRef,
  zRef,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  airportRange,
  PLANE_SPEED,
} from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { domesticTradeGold } from "../domestic/DomesticEconomy";
import { Execution, Game, Player, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { straightFlightPath } from "./FlightPath";

/**
 * The airports `airport` can fly cargo to (spec §14b): another owner's,
 * finished, both sides allowed to trade (embargoes, isolationism), and each
 * within the other's range.
 */
export function cargoPartners(mg: Game, airport: Unit): Unit[] {
  const owner = airport.owner();
  const range = airportRange(airport.level());
  return mg.units(UnitType.Airport).filter((other) => {
    if (other === airport || !other.isActive()) return false;
    if (other.isUnderConstruction()) return false;
    const partner = other.owner();
    if (partner === owner || !owner.canTrade(partner)) return false;
    const reach = Math.min(range, airportRange(other.level()));
    return (
      mg.euclideanDistSquared(airport.tile(), other.tile()) <= reach * reach
    );
  });
}

/**
 * A cargo flight (spec §14b): flies straight between two airports and pays
 * both owners on arrival, like a trade ship (domestic trade modifiers per
 * side). SAMs never target it. If trade stops on the way (embargo, the
 * destination lost or taken over) it vanishes unpaid.
 */
export class CargoPlaneExecution implements Execution {
  private mg: Game;
  private active = true;
  private plane: Unit | null = null;
  private path: TileRef[] = [];
  private step = 0;

  constructor(
    private owner: Player,
    private src: Unit,
    private dst: Unit,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (this.plane === null) {
      this.launch(ticks);
      return;
    }
    if (!this.plane.isActive()) {
      this.active = false;
      return;
    }
    if (!this.stillTrading()) {
      this.plane.delete(false);
      this.active = false;
      return;
    }
    this.step++;
    this.plane.move(this.path[this.step]);
    if (this.step >= this.path.length - 1) this.deliver();
  }

  private stillTrading(): boolean {
    const from = this.src.owner();
    const to = this.dst.owner();
    return this.dst.isActive() && from !== to && from.canTrade(to);
  }

  private launch(ticks: number): void {
    if (!this.src.isActive() || !this.stillTrading()) {
      this.active = false;
      return;
    }
    this.path = straightFlightPath(
      this.mg,
      this.src.tile(),
      this.dst.tile(),
      PLANE_SPEED,
    );
    this.plane = this.owner.buildUnit(UnitType.CargoPlane, this.src.tile(), {
      targetUnit: this.dst,
    });
    this.mg.recordMotionPlan({
      kind: "grid",
      unitId: this.plane.id(),
      planId: 1,
      startTick: ticks + 1,
      ticksPerStep: 1,
      path: this.path,
    });
  }

  private deliver(): void {
    const mg = this.mg;
    const plane = this.plane!;
    plane.setReachedTarget();
    plane.delete(false);
    this.active = false;
    const from = this.src.owner();
    const to = this.dst.owner();
    const distance = Math.round(
      Math.sqrt(mg.euclideanDistSquared(this.src.tile(), this.dst.tile())),
    );
    const gold = mg.config().cargoPlaneGold(distance, from);
    const fromGold = domesticTradeGold(gold, from, to, "cargo");
    const toGold = domesticTradeGold(gold, to, from, "cargo");
    from.addGold(fromGold, this.src.tile());
    to.addGold(toGold, this.dst.tile());
    from.addTradeGold(fromGold);
    to.addTradeGold(toGold);
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return CargoPlaneExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      owner: w.player(this.owner),
      src: w.unit(this.src),
      dst: w.unit(this.dst),
      plane: w.unitOrNull(this.plane),
      path: [...this.path],
      step: this.step,
    });
  }

  restoreSnapshot(s: CargoPlaneState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.owner = r.player(s.owner);
    this.src = r.unit(s.src);
    this.dst = r.unit(s.dst);
    this.plane = r.unitOrNull(s.plane);
    this.path = [...s.path];
    this.step = s.step;
  }
}

const CargoPlaneStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  owner: zPlayerRef(),
  src: zRef(),
  dst: zRef(),
  plane: zRef().nullable(),
  path: z.array(zTile()),
  step: zInt(),
});
type CargoPlaneState = z.infer<typeof CargoPlaneStateSchema>;

export const CargoPlaneExecutionSnapshot = execSnapshotType({
  name: "CargoPlane",
  version: 1,
  schema: CargoPlaneStateSchema,
  cls: () => CargoPlaneExecution,
});
```

- [ ] **Step 5: 공항이 화물기를 보낸다**

`packages/engine/src/warfare/AirportExecution.ts` 전체를 다음으로 바꾼다:

```ts
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  zInt,
  zRandom,
  zRef,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  AIRPORT_SORTIE_COOLDOWN_TICKS,
  CARGO_INTERVAL_TICKS,
} from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { Execution, Game, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { CargoPlaneExecution, cargoPartners } from "./CargoPlaneExecution";

/**
 * An airport (spec §14b). Sorties work like a silo's missiles: one per
 * level, a used one (launch()) waits in the unit's timer queue and comes
 * back AIRPORT_SORTIE_COOLDOWN_TICKS later. Paradrops and bombing share
 * them. Every CARGO_INTERVAL_TICKS it also sends `level` cargo flights to
 * random trading partners (cargoPartners).
 */
export class AirportExecution implements Execution {
  private mg: Game;
  private active = true;
  private random: PseudoRandom;
  private nextCargoTick = 0;

  constructor(private airport: Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.random = new PseudoRandom(ticks + this.airport.id());
    this.nextCargoTick = ticks + CARGO_INTERVAL_TICKS;
  }

  tick(_ticks: number): void {
    if (!this.airport.isActive()) {
      this.active = false;
      return;
    }
    if (this.airport.isUnderConstruction()) return;
    const now = this.mg.ticks();
    const queue = this.airport.missileTimerQueue();
    while (
      queue.length > 0 &&
      now - queue[0] >= AIRPORT_SORTIE_COOLDOWN_TICKS
    ) {
      this.airport.reloadMissile();
    }

    if (now < this.nextCargoTick) return;
    this.nextCargoTick = now + CARGO_INTERVAL_TICKS;
    const partners = cargoPartners(this.mg, this.airport);
    if (partners.length === 0) return;
    for (let i = 0; i < this.airport.level(); i++) {
      this.mg.addExecution(
        new CargoPlaneExecution(
          this.airport.owner(),
          this.airport,
          this.random.randElement(partners),
        ),
      );
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return AirportExecutionSnapshot.write({
      active: this.active,
      airport: w.unit(this.airport),
      // Set by init.
      init:
        this.mg === undefined
          ? null
          : { random: w.random(this.random), nextCargoTick: this.nextCargoTick },
    });
  }

  restoreSnapshot(s: AirportState, r: SnapshotReader): void {
    this.active = s.active;
    this.airport = r.unit(s.airport);
    if (s.init !== null) {
      this.mg = r.game;
      this.random = r.random(s.init.random);
      this.nextCargoTick = s.init.nextCargoTick;
    }
  }
}

const AirportStateSchema = z.object({
  active: z.boolean(),
  airport: zRef(),
  init: z
    .object({ random: zRandom(), nextCargoTick: zInt() })
    .nullable(),
});
type AirportState = z.infer<typeof AirportStateSchema>;

export const AirportExecutionSnapshot = execSnapshotType({
  name: "Airport",
  version: 1,
  schema: AirportStateSchema,
  cls: () => AirportExecution,
});
```

(스키마가 Task 5와 달라지지만 이 브랜치 안에서만 쓰였으므로 버전은 1로 둔다.)

`packages/engine/src/snapshot/ExecutionRegistry.ts`: `import { CargoPlaneExecutionSnapshot } from "../warfare/CargoPlaneExecution";`를 추가하고 목록의 `BreakAllianceExecutionSnapshot,` 뒤에 `CargoPlaneExecutionSnapshot,`를 넣는다.

`tests/core/snapshot/FullGameSnapshot.test.ts`: `WARFARE_ONLY_TYPES`를 다음으로 바꾼다:

```ts
const WARFARE_ONLY_TYPES = [
  "Airport",
  "Bombing",
  "CargoPlane",
  "CoastalBarrage",
  "CoastalBattery",
  "Paradrop",
];
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/warfare tests/domestic tests/economy tests/LiveTradeRevenue.test.ts tests/NationGoldPerMinute.test.ts --run && npx vitest tests/core/snapshot/FullGameSnapshot.test.ts -t "free for all" --run && npm run typecheck`
Expected: 모두 PASS(내정 무역 테스트와 `NationGoldPerMinute` 스냅샷이 그대로), typecheck 오류 없음

- [ ] **Step 7: 커밋**

```bash
npx prettier --write packages/engine/src/warfare packages/engine/src/domestic/DomesticEconomy.ts packages/engine/src/configuration/EngineConfig.ts packages/engine/src/snapshot/ExecutionRegistry.ts tests/warfare tests/core/snapshot/FullGameSnapshot.test.ts
git add packages/engine/src tests/warfare tests/core/snapshot/FullGameSnapshot.test.ts
git commit -m "feat(warfare): cargo air routes between trading airports"
```

---
### Task 9: AI 국가 — 해안 포대, 상륙 전 포격, 공항, 출격

**Files:**
- Create: `packages/engine/src/execution/nation/NationWarfareBehavior.ts`
- Modify: `packages/engine/src/execution/NationExecution.ts` (만들기, 호출, 스냅샷)
- Test: `tests/warfare/NationWarfare.test.ts`

**Interfaces:**
- Consumes: Task 1~8 전부(`canBuild` 규칙, `ConstructionExecution`의 새 유닛, `BombingExecution`, `ParadropExecution`); 내정 `nationDomesticPlan(id).personality`, `nationHoldsStructuresForProject(mg, player, kind)`, `nationProjectKindFor(mg, player)`
- Produces:
  - `interface WarfareStyle { maxBatteries: number; proactiveBatteries: boolean; maxAirports: number; reserve: bigint; sortieOdds: number; prefersBombing: boolean }`
  - `warfareStyle(player: Player): WarfareStyle`
  - `new NationWarfareBehavior(random: PseudoRandom, game: Game, player: Player)` — `tick(projectKind: VictoryProjectKind | null): void`, `maybeBuildCoastalBattery(style): boolean`, `maybeBuildAirport(style): boolean`, `maybeBarrageLandings(): boolean`, `maybeSortie(style): boolean`, `snapshot(w): Versioned`, `restoreSnapshot(raw, r, player): void`
  - `NationExecution` 스냅샷의 `behaviors.warfare`(옵션을 켰을 때만)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/warfare/NationWarfare.test.ts`:

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
import {
  NationWarfareBehavior,
  warfareStyle,
} from "@openfront/engine/execution/nation/NationWarfareBehavior";
import { Game, Player } from "@openfront/engine/game/Game";
import { buildLevel, conquerRect, grantTechs } from "../domestic/util";
import { executeTicks } from "../util/utils";
import { NATION, own, RED, warfareGame } from "./util";

/** A nation player whose id hashes to `personality` (NationPersonality). */
function nationWith(personality: Personality): PlayerInfo {
  for (let i = 0; i < 1000; i++) {
    const id = `nation_${i}`;
    if (nationDomesticPlan(id).personality === personality) {
      return new PlayerInfo(id, PlayerType.Nation, null, id);
    }
  }
  throw new Error(`no ${personality} id below 1000`);
}

function nationIn(
  game: Game,
  info: PlayerInfo,
  x0: number,
  y0: number,
  w: number,
  h: number,
): Player {
  const nation = game.addPlayer(info);
  conquerRect(game, nation, x0, y0, w, h);
  return nation;
}

const behavior = (game: Game, nation: Player) =>
  new NationWarfareBehavior(new PseudoRandom(1), game, nation);

describe("nation warfare style", () => {
  test("domestic personalities lean on what suits them", async () => {
    const game = await warfareGame("plains", { domesticMode: true }, [RED]);
    const conqueror = nationIn(game, nationWith("conqueror"), 0, 0, 5, 5);
    const zealot = nationIn(game, nationWith("zealot"), 10, 0, 5, 5);
    const merchant = nationIn(game, nationWith("merchant"), 20, 0, 5, 5);
    expect(warfareStyle(conqueror).prefersBombing).toBe(true);
    expect(warfareStyle(conqueror).maxAirports).toBe(2);
    expect(warfareStyle(zealot).proactiveBatteries).toBe(true);
    expect(warfareStyle(zealot).maxBatteries).toBeGreaterThan(
      warfareStyle(merchant).maxBatteries,
    );
  });

  test("outside domestic mode every nation plays the same", async () => {
    const game = await warfareGame("plains", {}, [RED]);
    const a = nationIn(game, nationWith("conqueror"), 0, 0, 5, 5);
    const b = nationIn(game, nationWith("zealot"), 10, 0, 5, 5);
    expect(warfareStyle(a)).toEqual(warfareStyle(b));
  });
});

describe("nation coastal batteries", () => {
  async function coast(difficulty = Difficulty.Medium) {
    const game = await warfareGame(
      "half_land_half_ocean",
      { instantBuild: true, difficulty },
      [RED],
    );
    const nation = nationIn(game, NATION, 0, 0, 8, 8);
    const red = own(game, RED.id, 0, 8, 8, 8);
    nation.addGold(10_000_000n);
    red.addGold(10_000_000n);
    return { game, nation, red };
  }

  test("builds one where an enemy boat is about to land", async () => {
    const { game, nation, red } = await coast(Difficulty.Easy);
    red.buildUnit(UnitType.TransportShip, game.ref(11, 3), {
      troops: 500,
      targetTile: game.ref(7, 3),
    });
    behavior(game, nation).tick(null);
    executeTicks(game, 3);
    expect(nation.units(UnitType.CoastalBattery)).toHaveLength(1);
  });

  test("a quiet coast gets none", async () => {
    const { game, nation } = await coast(Difficulty.Easy);
    behavior(game, nation).tick(null);
    executeTicks(game, 3);
    expect(nation.units(UnitType.CoastalBattery)).toHaveLength(0);
  });

  test("Hard: shells a defended coast before its own boat lands, once per zone", async () => {
    const { game, nation, red } = await coast(Difficulty.Hard);
    nation.buildUnit(UnitType.MissileSilo, game.ref(2, 2), {});
    red.buildUnit(UnitType.CoastalBattery, game.ref(7, 12), {});
    nation.buildUnit(UnitType.TransportShip, game.ref(11, 13), {
      troops: 1000,
      targetTile: game.ref(7, 13),
    });
    const ai = behavior(game, nation);
    expect(ai.maybeBarrageLandings()).toBe(true);
    executeTicks(game, 3);
    expect(game.units(UnitType.CoastalBarrage)).toHaveLength(1);
    nation.buildUnit(UnitType.MissileSilo, game.ref(2, 5), {});
    expect(ai.maybeBarrageLandings()).toBe(false);
  });

  test("Medium nations don't shell before landing", async () => {
    const { game, nation, red } = await coast(Difficulty.Medium);
    nation.buildUnit(UnitType.MissileSilo, game.ref(2, 2), {});
    red.buildUnit(UnitType.CoastalBattery, game.ref(7, 12), {});
    nation.buildUnit(UnitType.TransportShip, game.ref(11, 13), {
      troops: 1000,
      targetTile: game.ref(7, 13),
    });
    behavior(game, nation).tick(null);
    executeTicks(game, 3);
    expect(game.units(UnitType.CoastalBarrage)).toHaveLength(0);
  });
});

describe("nation airports", () => {
  test("a rich nation builds one; Easy nations never do", async () => {
    for (const [difficulty, expected] of [
      [Difficulty.Medium, 1],
      [Difficulty.Easy, 0],
    ] as const) {
      const game = await warfareGame(
        "plains",
        { instantBuild: true, difficulty },
        [RED],
      );
      const nation = nationIn(game, NATION, 0, 0, 40, 40);
      nation.addGold(10_000_000n);
      behavior(game, nation).tick(null);
      executeTicks(game, 3);
      expect(nation.units(UnitType.Airport), difficulty).toHaveLength(expected);
    }
  });

  test("builds nothing while saving for its victory project", async () => {
    const run = async (projectKind: "science" | null): Promise<number> => {
      const game = await warfareGame(
        "plains",
        { instantBuild: true, difficulty: Difficulty.Hard, domesticMode: true },
        [RED],
      );
      const nation = nationIn(game, nationWith("scholar"), 0, 0, 40, 40);
      buildLevel(game, nation, UnitType.ResearchInstitute, 30, 30, 3);
      grantTechs(nation, "space_program", "industrialization");
      // Earned: 5M is within reach, so a scholar saves for it.
      nation.addGold(4_900_000n);
      behavior(game, nation).tick(projectKind);
      executeTicks(game, 3);
      return nation.units(UnitType.Airport).length;
    };
    expect(await run(null)).toBe(1);
    expect(await run("science")).toBe(0);
  });
});

describe("nation sorties", () => {
  async function airfield(domesticMode: boolean, nationInfo: PlayerInfo) {
    const game = await warfareGame(
      "plains",
      { instantBuild: true, domesticMode },
      [RED],
    );
    const nation = nationIn(game, nationInfo, 0, 0, 30, 30);
    const red = own(game, RED.id, 60, 0, 30, 30);
    if (domesticMode) grantTechs(nation, "industrialization");
    nation.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    const city = red.buildUnit(UnitType.City, game.ref(70, 10), {});
    city.increaseLevel();
    red.buildUnit(UnitType.DefensePost, game.ref(65, 20), {});
    return { game, nation, red, city };
  }

  test("a conqueror bombs the biggest structure across the gap", async () => {
    const { game, nation, city } = await airfield(
      true,
      nationWith("conqueror"),
    );
    nation.addGold(10_000_000n);
    const style = { ...warfareStyle(nation), sortieOdds: 1 };
    expect(behavior(game, nation).maybeSortie(style)).toBe(true);
    executeTicks(game, 3);
    const bombers = nation.units(UnitType.Bomber);
    expect(bombers).toHaveLength(1);
    expect(bombers[0].targetTile()).toBe(city.tile());
  });

  test("short of gold for a bomb, a big army paradrops instead", async () => {
    const { game, nation, red, city } = await airfield(false, NATION);
    nation.addGold(300_000n);
    nation.addTroops(400_000);
    red.addTroops(50_000);
    const style = { ...warfareStyle(nation), sortieOdds: 1 };
    expect(behavior(game, nation).maybeSortie(style)).toBe(true);
    executeTicks(game, 2);
    const planes = nation.units(UnitType.TransportPlane);
    expect(planes).toHaveLength(1);
    expect(planes[0].targetTile()).toBe(city.tile());
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/warfare/NationWarfare.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine/execution/nation/NationWarfareBehavior'`

- [ ] **Step 3: AI 행동 작성**

`packages/engine/src/execution/nation/NationWarfareBehavior.ts`:

```ts
import { VictoryProjectKind } from "@openfront/engine-api/domestic/DomesticTypes";
import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  Difficulty,
  PlayerType,
  Structures,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  readVersioned,
  snapshotType,
  Versioned,
  zInt,
  zRandom,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  airportRange,
  BARRAGE_SUPPRESSION_TICKS,
  COASTAL_BATTERY_RANGE,
} from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { Game, Player, Unit } from "../../game/Game";
import type {
  SnapshotReader,
  SnapshotWriter,
} from "../../snapshot/SnapshotContext";
import { BombingExecution } from "../../warfare/BombingExecution";
import { ParadropExecution } from "../../warfare/ParadropExecution";
import { ConstructionExecution } from "../ConstructionExecution";
import { nationDomesticPlan } from "./NationPersonality";
import { randTerritoryTileArray } from "./NationUtils";
import { nationHoldsStructuresForProject } from "./NationVictoryBehavior";

/** How a nation uses expanded warfare (spec §14b; personalities §9.1). */
export interface WarfareStyle {
  /** Most coastal batteries it keeps. */
  maxBatteries: number;
  /** Also builds batteries on a quiet coast when gold allows. */
  proactiveBatteries: boolean;
  /** Most airports it builds. */
  maxAirports: number;
  /** Gold kept back beyond an airport's, battery's or bomb's price. */
  reserve: bigint;
  /** 1 in N chance per action tick to fly a ready sortie. */
  sortieOdds: number;
  /** Bombs rather than paradrops when it can do both. */
  prefersBombing: boolean;
}

const DEFAULT_STYLE: WarfareStyle = {
  maxBatteries: 4,
  proactiveBatteries: false,
  maxAirports: 1,
  reserve: 2_000_000n,
  sortieOdds: 3,
  prefersBombing: false,
};

/**
 * In domestic mode conquerors lean on airports, bombing and barrages and
 * zealots on coastal batteries; everyone else, and every nation outside
 * domestic mode, plays the default.
 */
export function warfareStyle(player: Player): WarfareStyle {
  if (player.domestic() === null) return DEFAULT_STYLE;
  switch (nationDomesticPlan(player.id()).personality) {
    case "conqueror":
      return {
        maxBatteries: 3,
        proactiveBatteries: false,
        maxAirports: 2,
        reserve: 1_000_000n,
        sortieOdds: 2,
        prefersBombing: true,
      };
    case "zealot":
      return {
        maxBatteries: 8,
        proactiveBatteries: true,
        maxAirports: 1,
        reserve: 4_000_000n,
        sortieOdds: 4,
        prefersBombing: false,
      };
    default:
      return DEFAULT_STYLE;
  }
}

/**
 * A nation's expanded-warfare play (spec §14b), once per action tick:
 * coastal batteries where enemy boats land (all difficulties), then on
 * Medium and up an airport when rich and sorties at the biggest structure
 * across the water; on Hard and up a barrage at any battery covering one
 * of its own landings. Built only when the option is on, on its own PRNG.
 */
export class NationWarfareBehavior {
  /** When each aimed battery tile was last shelled. */
  private lastBarrage = new Map<TileRef, number>();

  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
  ) {}

  tick(projectKind: VictoryProjectKind | null): void {
    if (!this.player.isAlive()) return;
    // Saving for a victory project: build and fire nothing (spec §9.3).
    if (
      nationHoldsStructuresForProject(this.game, this.player, projectKind)
    ) {
      return;
    }
    const style = warfareStyle(this.player);
    const difficulty = this.game.config().gameConfig().difficulty;
    this.maybeBuildCoastalBattery(style);
    if (difficulty === Difficulty.Easy) return;
    if (difficulty === Difficulty.Hard || difficulty === Difficulty.Impossible) {
      this.maybeBarrageLandings();
    }
    this.maybeBuildAirport(style);
    this.maybeSortie(style);
  }

  maybeBuildCoastalBattery(style: WarfareStyle): boolean {
    if (this.player.units(UnitType.CoastalBattery).length >= style.maxBatteries) {
      return false;
    }
    const tile =
      this.threatenedShore() ??
      (style.proactiveBatteries ? this.quietShore(style) : null);
    if (tile === null) return false;
    const covered = (COASTAL_BATTERY_RANGE / 2) ** 2;
    if (
      this.player
        .units(UnitType.CoastalBattery)
        .some((b) => this.game.euclideanDistSquared(b.tile(), tile) <= covered)
    ) {
      return false;
    }
    if (this.player.canBuild(UnitType.CoastalBattery, tile) === false) {
      return false;
    }
    this.game.addExecution(
      new ConstructionExecution(this.player, UnitType.CoastalBattery, tile),
    );
    return true;
  }

  maybeBuildAirport(style: WarfareStyle): boolean {
    if (this.player.units(UnitType.Airport).length >= style.maxAirports) {
      return false;
    }
    const cost = this.game
      .unitInfo(UnitType.Airport)
      .cost(this.game, this.player);
    if (this.player.gold() < cost + style.reserve) return false;
    // On the coast when it can, so its planes reach across the water.
    const tile = this.randomShoreTile() ?? this.randomOwnTile();
    if (tile === null) return false;
    if (this.player.canBuild(UnitType.Airport, tile) === false) return false;
    this.game.addExecution(
      new ConstructionExecution(this.player, UnitType.Airport, tile),
    );
    return true;
  }

  maybeBarrageLandings(): boolean {
    const now = this.game.ticks();
    for (const [tile, at] of this.lastBarrage) {
      if (now - at >= BARRAGE_SUPPRESSION_TICKS) this.lastBarrage.delete(tile);
    }
    for (const boat of this.player.units(UnitType.TransportShip)) {
      if (boat.transportShipState().isRetreating) continue;
      const dst = boat.targetTile();
      if (dst === undefined) continue;
      const battery = this.game
        .nearbyUnits(dst, COASTAL_BATTERY_RANGE, UnitType.CoastalBattery)
        .filter(
          ({ unit }) =>
            unit.owner() !== this.player &&
            !this.player.isFriendly(unit.owner()),
        )
        .sort(
          (a, b) => a.distSquared - b.distSquared || a.unit.id() - b.unit.id(),
        )[0]?.unit;
      if (battery === undefined || this.lastBarrage.has(battery.tile())) {
        continue;
      }
      if (
        this.player.canBuild(UnitType.CoastalBarrage, battery.tile()) === false
      ) {
        continue;
      }
      this.game.addExecution(
        new ConstructionExecution(
          this.player,
          UnitType.CoastalBarrage,
          battery.tile(),
        ),
      );
      this.lastBarrage.set(battery.tile(), now);
      return true;
    }
    return false;
  }

  maybeSortie(style: WarfareStyle): boolean {
    const airport = this.player
      .units(UnitType.Airport)
      .find(
        (a) => a.isActive() && !a.isUnderConstruction() && !a.isInCooldown(),
      );
    if (airport === undefined || !this.random.chance(style.sortieOdds)) {
      return false;
    }
    const target = this.strikeTarget(airport);
    if (target === null) return false;
    const tile = target.tile();
    const bombCost = this.game
      .unitInfo(UnitType.Bomber)
      .cost(this.game, this.player);
    const canBomb =
      this.player.gold() >= bombCost + style.reserve &&
      this.player.canBuild(UnitType.Bomber, tile) !== false;
    const troops = Math.floor(this.player.troops() / 4);
    const canDrop =
      troops > target.owner().troops() / 10 &&
      this.player.canBuild(UnitType.TransportPlane, tile) !== false;
    if (canBomb && (style.prefersBombing || !canDrop)) {
      this.game.addExecution(new BombingExecution(this.player, tile));
      return true;
    }
    if (canDrop) {
      this.game.addExecution(new ParadropExecution(this.player, troops, tile));
      return true;
    }
    return false;
  }

  /** The biggest non-friendly structure in range across the water (no shared border). */
  private strikeTarget(airport: Unit): Unit | null {
    const candidates = this.game
      .nearbyUnits(airport.tile(), airportRange(airport.level()), Structures.types)
      .filter(({ unit }) => {
        const owner = unit.owner();
        return (
          owner !== this.player &&
          owner.type() !== PlayerType.Bot &&
          !this.player.isFriendly(owner) &&
          !this.player.sharesBorderWith(owner)
        );
      })
      .sort(
        (a, b) =>
          b.unit.level() - a.unit.level() ||
          a.distSquared - b.distSquared ||
          a.unit.id() - b.unit.id(),
      );
    return candidates[0]?.unit ?? null;
  }

  /** Where an enemy transport ship is heading on this nation's land. */
  private threatenedShore(): TileRef | null {
    for (const boat of this.game.units(UnitType.TransportShip)) {
      const owner = boat.owner();
      if (owner === this.player || this.player.isFriendly(owner)) continue;
      const dst = boat.targetTile();
      if (dst !== undefined && this.game.owner(dst) === this.player) {
        return dst;
      }
    }
    return null;
  }

  /** Zealots: a random own shore tile while gold is plentiful. */
  private quietShore(style: WarfareStyle): TileRef | null {
    const cost = this.game
      .unitInfo(UnitType.CoastalBattery)
      .cost(this.game, this.player);
    if (this.player.gold() < cost + style.reserve) return null;
    return this.randomShoreTile();
  }

  private randomShoreTile(): TileRef | null {
    const shore: TileRef[] = [];
    this.player.borderTiles().forEach((t) => {
      if (this.game.isShore(t)) shore.push(t);
    });
    if (shore.length === 0) return null;
    return shore[this.random.nextInt(0, shore.length)];
  }

  private randomOwnTile(): TileRef | null {
    return (
      randTerritoryTileArray(this.random, this.game, this.player, 1)[0] ?? null
    );
  }

  snapshot(w: SnapshotWriter): Versioned {
    return w.versioned(NationWarfareBehaviorSnapshot, {
      random: w.random(this.random),
      lastBarrage: [...this.lastBarrage],
    });
  }

  /** Fills a prototype-only shell; only assigns. */
  restoreSnapshot(raw: unknown, r: SnapshotReader, player: Player): void {
    const s = readVersioned(NationWarfareBehaviorSnapshot, raw);
    this.random = r.random(s.random);
    this.game = r.game;
    this.player = player;
    this.lastBarrage = new Map(s.lastBarrage);
  }
}

export const NationWarfareBehaviorSnapshot = snapshotType({
  name: "NationWarfareBehavior",
  version: 1,
  schema: z.object({
    random: zRandom(),
    lastBarrage: z.array(z.tuple([zTile(), zInt()])),
  }),
});
```

- [ ] **Step 4: 국가 실행에 연결**

`packages/engine/src/execution/NationExecution.ts`:
- import 추가: `import { NationWarfareBehavior } from "./nation/NationWarfareBehavior";`
- 필드 `private structureBehavior!: NationStructureBehavior;` 뒤에 추가:

```ts
  /** Expanded warfare only (undefined otherwise). */
  private warfareBehavior: NationWarfareBehavior | undefined;
```

- `initializeBehaviors()`의 `this.behaviorsInitialized = true;` 바로 앞에 추가:

```ts
    // Expanded warfare only, on its own PRNG: the shared one must roll
    // exactly as in a vanilla game.
    this.warfareBehavior = this.mg.config().warfareExpansion()
      ? new NationWarfareBehavior(
          new PseudoRandom(simpleHash(this.player.id()) + 4099),
          this.mg,
          this.player,
        )
      : undefined;
```

- `tick()`의 마지막 줄 `this.nukeBehavior.maybeSendNuke();` 뒤에 추가:

```ts
    this.warfareBehavior?.tick(nationProjectKindFor(this.mg, this.player));
```

- `snapshot()`의 `behaviors` 객체에서 `structure: this.structureBehavior.snapshot(w),` 뒤에 추가(원작 스냅샷에는 키가 없다):

```ts
            ...(this.warfareBehavior !== undefined
              ? { warfare: this.warfareBehavior.snapshot(w) }
              : {}),
```

- `restoreSnapshot()`의 마지막 `this.structureBehavior = structure;` 뒤에 추가:

```ts
    if (b.warfare !== undefined) {
      const warfare = shell(NationWarfareBehavior);
      warfare.restoreSnapshot(b.warfare, r, player);
      this.warfareBehavior = warfare;
    } else {
      this.warfareBehavior = undefined;
    }
```

- `NationStateSchema`의 `behaviors` 객체에서 `structure: VersionedSchema,` 뒤에 `warfare: VersionedSchema.optional(),`를 추가한다.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest tests/warfare tests/domestic/NationVictory.test.ts tests/domestic/NationProjectSaving.test.ts tests/NationStructureBehavior.test.ts tests/VanillaDigest.test.ts tests/NationGoldPerMinute.test.ts --run && npx vitest tests/core/snapshot/FullGameSnapshot.test.ts -t "free for all" --run`
Expected: 모두 PASS(원작 고정값과 금 스냅샷이 그대로)

- [ ] **Step 6: 커밋**

```bash
npx prettier --write packages/engine/src/execution/nation/NationWarfareBehavior.ts packages/engine/src/execution/NationExecution.ts tests/warfare/NationWarfare.test.ts
git add packages/engine/src/execution tests/warfare/NationWarfare.test.ts
git commit -m "feat(warfare): nations build batteries and airports, shell landings, fly sorties"
```

---
### Task 10: 확장 전쟁 스냅샷 변형(스크립트 게임)

**Files:**
- Modify: `tests/util/ScriptedGame.ts` (옵션을 켠 게임에서만 확장 전쟁 명령)
- Modify: `tests/core/snapshot/FullGameSnapshot.test.ts` (`warfare`, `domestic warfare` 변형과 `WARFARE_UNSCRIPTED_TYPES`)

**Interfaces:**
- Consumes: Task 1~9 전부, `Config.warfareExpansion()`
- Produces: 스크립트 게임의 `warfareIntent`(옵션 켬일 때만 PRNG를 굴린다), `WARFARE_UNSCRIPTED_TYPES`

- [ ] **Step 1: 실패하는 변형 추가**

`tests/core/snapshot/FullGameSnapshot.test.ts`:
- `WARFARE_ONLY_TYPES` 선언 바로 뒤에 추가:

```ts
// Warfare types the 1500-tick scripted game isn't sure to reach: strikes
// and paradrops need a target within reach of a silo or airport, cargo two
// owners' airports within each other's range, batteries a shore border.
// tests/warfare/*.test.ts cover their snapshots.
const WARFARE_UNSCRIPTED_TYPES = [
  "Bombing",
  "CargoPlane",
  "CoastalBarrage",
  "CoastalBattery",
  "Paradrop",
];
```

- `VARIANTS` 끝에 두 변형을 더한다:

```ts
  // Expanded warfare: coastal batteries, barrages, airports and their
  // flights, and the nations' warfare behavior.
  ["warfare", { warfareExpansion: true }],
  // Both options together.
  ["domestic warfare", { domesticMode: true, warfareExpansion: true }],
```

- "the game exercised every execution type" 테스트의 `} else if (overrides.domesticMode === true) {` 블록 뒤에(`} else { return; }` 앞) 추가:

```ts
      } else if (overrides.warfareExpansion === true) {
        expected = WARFARE_ONLY_TYPES.filter(
          (name) => !WARFARE_UNSCRIPTED_TYPES.includes(name),
        );
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/core/snapshot/FullGameSnapshot.test.ts -t "full game snapshots: warfare" --run`
Expected: FAIL — "the game exercised every execution type"에서 `expected [ 'Airport' ] to deeply equal []`(스크립트 사람들이 공항을 짓지 않는다). 스냅샷 테스트 셋은 PASS(국가 AI가 옵션을 켠 채로 돈다).

- [ ] **Step 3: 스크립트 명령 추가**

`tests/util/ScriptedGame.ts`의 `playIntent`에서 `const own = (types: UnitType[]) => p.units(types);` 줄 바로 뒤에 추가:

```ts
  // Expanded warfare games only: their own share of the intents. A vanilla
  // game never gets here, so its PRNG stream (and VanillaDigest) is unchanged.
  if (game.config().warfareExpansion() && rand.chance(4)) {
    const intent = warfareIntent(game, p, rand, other);
    if (intent !== null) return intent;
  }
```

같은 파일의 `nearbyWater` 함수 앞에 추가:

```ts
/** One expanded-warfare intent: a battery, an airport, a strike or a paradrop. */
function warfareIntent(
  game: Game,
  p: Player,
  rand: PseudoRandom,
  other: Player | null,
): Intent | null {
  switch (rand.nextInt(0, 5)) {
    case 0: {
      const tile = pick(
        rand,
        [...p.borderTiles()].filter((t) => game.isShore(t)),
      );
      if (tile === null || p.canBuild(UnitType.CoastalBattery, tile) === false) {
        return null;
      }
      return { type: "build_unit", unit: UnitType.CoastalBattery, tile };
    }
    case 1: {
      const tile = randomOwnedTile(rand, p);
      if (tile === null || p.canBuild(UnitType.Airport, tile) === false) {
        return null;
      }
      return { type: "build_unit", unit: UnitType.Airport, tile };
    }
    case 2:
    case 3: {
      if (other === null) return null;
      const unit = rand.chance(2) ? UnitType.CoastalBarrage : UnitType.Bomber;
      const tile = randomOwnedTile(rand, other);
      if (tile === null || p.canBuild(unit, tile) === false) return null;
      return { type: "build_unit", unit, tile };
    }
    case 4: {
      if (other === null) return null;
      const tile = randomOwnedTile(rand, other);
      if (
        tile === null ||
        p.canBuild(UnitType.TransportPlane, tile) === false
      ) {
        return null;
      }
      return { type: "paradrop", troops: p.troops() / 5, dst: tile };
    }
  }
  return null;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest tests/core/snapshot/FullGameSnapshot.test.ts tests/VanillaDigest.test.ts --run`
Expected: 6개 변형 모두 PASS(새 두 변형 포함), VanillaDigest 3 tests PASS(옵션이 꺼진 스크립트 게임은 그대로다). 오래 걸린다(변형당 1~3분).

- [ ] **Step 5: 커밋**

```bash
npx prettier --write tests/util/ScriptedGame.ts tests/core/snapshot/FullGameSnapshot.test.ts
git add tests/util/ScriptedGame.ts tests/core/snapshot/FullGameSnapshot.test.ts
git commit -m "test(warfare): full-game snapshot variants with expanded warfare"
```

---

### Task 11: 번역 (en, ko)

**Files:**
- Modify: `resources/lang/en.json`, `resources/lang/ko.json` (jq로 병합)
- Test: `tests/warfare/WarfareI18n.test.ts`

**Interfaces:**
- Produces(엔진과 화면 Task가 쓰는 키): `game_settings.warfare_expansion`; `unit_type.coastal_battery|airport|coastal_barrage|bomber|transport_plane|cargo_plane`; `build_menu.desc.coastal_battery|airport|coastal_barrage|bomber`; `events_display.barrage_inbound|paradrop_inbound|bomber_inbound|bombing_detonated|bomber_evaded|plane_shot_down|no_airport_available`; `radial_menu.paradrop_title|paradrop_description`; `touch_ui.needs_airport`; `domestic.tech.rocketry|fortification|industrialization.desc` 갱신

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/warfare/WarfareI18n.test.ts`:

```ts
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
  "game_settings.warfare_expansion",
  "unit_type.coastal_battery",
  "unit_type.airport",
  "unit_type.coastal_barrage",
  "unit_type.bomber",
  "unit_type.transport_plane",
  "unit_type.cargo_plane",
  "build_menu.desc.coastal_battery",
  "build_menu.desc.airport",
  "build_menu.desc.coastal_barrage",
  "build_menu.desc.bomber",
  "events_display.barrage_inbound",
  "events_display.paradrop_inbound",
  "events_display.bomber_inbound",
  "events_display.bombing_detonated",
  "events_display.bomber_evaded",
  "events_display.plane_shot_down",
  "events_display.no_airport_available",
  "radial_menu.paradrop_title",
  "radial_menu.paradrop_description",
  "touch_ui.needs_airport",
];

describe("expanded warfare translations", () => {
  test.each(["en", "ko"])("%s has every warfare key", (lang) => {
    const json = load(lang);
    for (const key of KEYS) {
      expect(typeof get(json, key), key).toBe("string");
    }
  });

  test.each(["en", "ko"])("%s keeps the event placeholders", (lang) => {
    const json = load(lang);
    expect(get(json, "events_display.paradrop_inbound")).toMatch(/\{name\}/);
    expect(get(json, "events_display.paradrop_inbound")).toMatch(/\{troops\}/);
    expect(get(json, "events_display.bombing_detonated")).toMatch(/\{name\}/);
    expect(get(json, "events_display.plane_shot_down")).toMatch(/\{unit\}/);
  });

  test("the unlocking techs mention their warfare units", () => {
    const en = load("en");
    expect(get(en, "domestic.tech.rocketry.desc")).toMatch(/barrage/i);
    expect(get(en, "domestic.tech.fortification.desc")).toMatch(/battery/i);
    expect(get(en, "domestic.tech.industrialization.desc")).toMatch(/airport/i);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/warfare/WarfareI18n.test.ts --run`
Expected: FAIL — `game_settings.warfare_expansion: expected 'undefined' to be 'string'`

- [ ] **Step 3: 영어 조각 작성**

```bash
mkdir -p .i18n-warfare
cat > .i18n-warfare/en.json <<'EOF'
{
  "build_menu": {
    "desc": {
      "airport": "Paradrops and bombing in range; cargo flights to trading airports",
      "bomber": "Small bomb from an airport, dodges half of SAM hits",
      "coastal_barrage": "Silo salvo: destroys coastal batteries, weakens defenses for 20s",
      "coastal_battery": "Shells enemy boats and warships near your coast"
    }
  },
  "domestic": {
    "tech": {
      "fortification": {
        "desc": "Defense post effect +50%, defense post cost -30%; unlocks the coastal battery (Expanded Warfare)"
      },
      "industrialization": {
        "desc": "Train income +50%, structure cost -15%; unlocks the airport (Expanded Warfare)"
      },
      "rocketry": {
        "desc": "Unlocks missile silos and the coastal barrage (Expanded Warfare)"
      }
    }
  },
  "events_display": {
    "barrage_inbound": "{name} - coastal barrage inbound",
    "bomber_evaded": "A bomber evaded your SAM",
    "bomber_inbound": "{name} - bomber inbound",
    "bombing_detonated": "{name} - bombs hit your land",
    "no_airport_available": "No airport can reach that target",
    "paradrop_inbound": "Paratroopers incoming from {name} ({troops})",
    "plane_shot_down": "Your {unit} was shot down"
  },
  "game_settings": {
    "warfare_expansion": "Expanded Warfare"
  },
  "radial_menu": {
    "paradrop_description": "Fly troops (attack ratio) from an airport and drop them here",
    "paradrop_title": "Paradrop"
  },
  "touch_ui": {
    "needs_airport": "Build an airport first"
  },
  "unit_type": {
    "airport": "Airport",
    "bomber": "Bomber",
    "cargo_plane": "Cargo Plane",
    "coastal_barrage": "Coastal Barrage",
    "coastal_battery": "Coastal Battery",
    "transport_plane": "Transport Plane"
  }
}
EOF
```

- [ ] **Step 4: 한국어 조각 작성**

```bash
cat > .i18n-warfare/ko.json <<'EOF'
{
  "build_menu": {
    "desc": {
      "airport": "범위 안 공수 투입·폭격, 무역 상대 공항과 화물 항공로",
      "bomber": "공항에서 출격하는 소형 폭탄, SAM 요격을 절반은 피함",
      "coastal_barrage": "사일로 일제 포격: 해안 포대 파괴, 20초간 방어 약화",
      "coastal_battery": "해안 근처의 적 수송선과 군함을 포격합니다"
    }
  },
  "domestic": {
    "tech": {
      "fortification": {
        "desc": "방어 기지 효과 +50%, 방어 기지 건설비 -30%, 해안 포대 해금(확장 전쟁)"
      },
      "industrialization": {
        "desc": "기차 수익 +50%, 모든 건설비 -15%, 공항 해금(확장 전쟁)"
      },
      "rocketry": {
        "desc": "미사일 기지 해금, 해안 포격 해금(확장 전쟁)"
      }
    }
  },
  "events_display": {
    "barrage_inbound": "{name} - 해안 포격이 날아옵니다",
    "bomber_evaded": "폭격기가 SAM을 피했습니다",
    "bomber_inbound": "{name} - 폭격기가 날아옵니다",
    "bombing_detonated": "{name} - 폭격을 맞았습니다",
    "no_airport_available": "그곳에 보낼 수 있는 공항이 없습니다",
    "paradrop_inbound": "{name}의 공수부대가 내려옵니다 ({troops})",
    "plane_shot_down": "{unit}이(가) 격추되었습니다"
  },
  "game_settings": {
    "warfare_expansion": "확장 전쟁"
  },
  "radial_menu": {
    "paradrop_description": "공항에서 병력(공격 비율)을 실어 이곳에 내립니다",
    "paradrop_title": "공수 투입"
  },
  "touch_ui": {
    "needs_airport": "공항을 먼저 지으세요"
  },
  "unit_type": {
    "airport": "공항",
    "bomber": "폭격기",
    "cargo_plane": "화물기",
    "coastal_barrage": "해안 포격",
    "coastal_battery": "해안 포대",
    "transport_plane": "수송기"
  }
}
EOF
```

- [ ] **Step 5: 병합**

en.json은 키 정렬을 유지해야 하므로 `jq -S`로 병합하고, ko.json은 순서를 건드리지 않고 병합한다(내정 모드 계획과 같은 방법).

```bash
jq -S --slurpfile frag .i18n-warfare/en.json '. * $frag[0]' resources/lang/en.json > .i18n-warfare/en.out && mv .i18n-warfare/en.out resources/lang/en.json
jq --slurpfile frag .i18n-warfare/ko.json '. * $frag[0]' resources/lang/ko.json > .i18n-warfare/ko.out && mv .i18n-warfare/ko.out resources/lang/ko.json
rm -rf .i18n-warfare
npx prettier --write resources/lang/en.json resources/lang/ko.json
git diff --stat resources/lang
```

Expected: en.json, ko.json에 추가와 기술 설명 세 줄 변경만 있다.

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/warfare/WarfareI18n.test.ts tests/domestic/I18n.test.ts tests/EnJsonSorted.test.ts --run`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add resources/lang/en.json resources/lang/ko.json tests/warfare/WarfareI18n.test.ts
git commit -m "feat(warfare): English and Korean strings for expanded warfare"
```

---
### Task 12: 로비 토글과 설정 요약

**Files:**
- Modify: `src/client/SinglePlayerModal.ts`
- Modify: `src/client/HostLobbyModal.ts`
- Modify: `src/client/utilities/LobbySettingsSummary.ts`
- Test: `tests/client/WarfareLobby.test.ts`

**Interfaces:**
- Consumes: Task 1 `GameConfig.warfareExpansion`, Task 11 `game_settings.warfare_expansion`
- Produces: 두 모달의 `warfareExpansion` 상태와 토글(`labelKey: "game_settings.warfare_expansion"`), 혼자 하기 시작 설정의 `warfareExpansion: true`, 호스트 `update_game_config`의 `warfareExpansion`, 참가 화면 요약 항목

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/WarfareLobby.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { testGameConfig } from "../util/Wire";

vi.mock("../../src/client/Cosmetics", () => ({
  getPlayerCosmetics: vi.fn(async () => ({})),
}));
vi.mock("../../src/client/CrazyGamesSDK", () => ({
  crazyGamesSDK: {
    isOnCrazyGames: vi.fn(() => false),
    requestMidgameAd: vi.fn(async () => {}),
  },
}));
vi.mock("../../src/client/TerrainMapFileLoader", () => ({
  terrainMapFileLoader: { getMapData: vi.fn() },
}));
vi.mock("../../src/client/DesktopPresence", () => ({
  desktopPresence: {
    isAvailable: vi.fn(() => false),
    openInviteDialog: vi.fn(async () => true),
    set: vi.fn(),
    consumePendingInvite: vi.fn(async () => null),
    subscribeInvites: vi.fn(() => () => undefined),
  },
}));

import { HostLobbyModal } from "../../src/client/HostLobbyModal";
import "../../src/client/SinglePlayerModal";
import { notableLobbySettings } from "../../src/client/utilities/LobbySettingsSummary";

const toggle = (checked: boolean) =>
  new CustomEvent("option-toggle-changed", {
    detail: { labelKey: "game_settings.warfare_expansion", checked },
  });

describe("expanded warfare in the lobby", () => {
  it("solo: off by default, on when toggled", async () => {
    const modal = document.createElement("single-player-modal") as any;
    const configs: any[] = [];
    modal.addEventListener("join-lobby", (e: Event) =>
      configs.push((e as CustomEvent).detail.gameStartInfo.config),
    );
    await modal.startGame();
    expect(configs[0].warfareExpansion).toBeUndefined();

    modal.handleConfigOptionToggleChanged(toggle(true));
    expect(modal.warfareExpansion).toBe(true);
    await modal.startGame();
    expect(configs[1].warfareExpansion).toBe(true);
  });

  it("host: the toggle updates the lobby", () => {
    const modal = new HostLobbyModal() as any;
    const putGameConfig = vi.fn();
    modal.putGameConfig = putGameConfig;
    modal.handleConfigOptionToggleChanged(toggle(true));
    expect(modal.warfareExpansion).toBe(true);
    expect(putGameConfig).toHaveBeenCalledOnce();
  });

  it("the lobby summary lists it only when on", () => {
    const label = (c: ReturnType<typeof testGameConfig>) =>
      notableLobbySettings(c, null).map((i) => i.label);
    // No language selector in jsdom: translateText returns the key.
    expect(label(testGameConfig({ warfareExpansion: true }))).toContain(
      "game_settings.warfare_expansion",
    );
    expect(label(testGameConfig())).not.toContain(
      "game_settings.warfare_expansion",
    );
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/WarfareLobby.test.ts --run`
Expected: FAIL — `expected undefined to be true`(모달에 상태가 없다)

- [ ] **Step 3: 혼자 하기 모달**

`src/client/SinglePlayerModal.ts`:
- `DEFAULT_OPTIONS`의 `domesticMode: false,` 뒤에 `warfareExpansion: false,`를 추가한다.
- `@state() private domesticMode: boolean = DEFAULT_OPTIONS.domesticMode;` 뒤에 추가:

```ts
  @state() private warfareExpansion: boolean =
    DEFAULT_OPTIONS.warfareExpansion;
```

- `toggles` 목록에서 `labelKey: "game_settings.domestic_mode"` 항목 뒤에 추가:

```ts
                  {
                    labelKey: "game_settings.warfare_expansion",
                    checked: this.warfareExpansion,
                  },
```

- 바뀜 확인의 `this.domesticMode !== DEFAULT_OPTIONS.domesticMode ||` 뒤에 `this.warfareExpansion !== DEFAULT_OPTIONS.warfareExpansion ||`를 추가한다.
- 초기화의 `this.domesticMode = DEFAULT_OPTIONS.domesticMode;` 뒤에 `this.warfareExpansion = DEFAULT_OPTIONS.warfareExpansion;`를 추가한다.
- `handleConfigOptionToggleChanged`의 `case "game_settings.domestic_mode":` 블록(`break;`까지) 뒤에 추가:

```ts
      case "game_settings.warfare_expansion":
        this.warfareExpansion = checked;
        break;
```

- `startGame`의 설정에서 `...(this.domesticMode ? { domesticMode: true } : {}),` 뒤에 추가:

```ts
                ...(this.warfareExpansion ? { warfareExpansion: true } : {}),
```

- [ ] **Step 4: 방 만들기 모달**

`src/client/HostLobbyModal.ts`:
- `@state() private domesticMode: boolean = false;` 뒤에 `@state() private warfareExpansion: boolean = false;`를 추가한다.
- `toggles` 목록에서 `labelKey: "game_settings.domestic_mode"` 항목 뒤에 추가:

```ts
                  {
                    labelKey: "game_settings.warfare_expansion",
                    checked: this.warfareExpansion,
                  },
```

- 초기화의 `this.domesticMode = false;` 뒤에 `this.warfareExpansion = false;`를 추가한다.
- `handleConfigOptionToggleChanged`의 `case "game_settings.domestic_mode":` 블록(`this.putGameConfig(); break;`까지) 뒤에 추가:

```ts
      case "game_settings.warfare_expansion":
        this.warfareExpansion = checked;
        this.putGameConfig();
        break;
```

- `putGameConfig`의 `domesticMode: this.domesticMode,` 뒤에 `warfareExpansion: this.warfareExpansion,`를 추가한다.

- [ ] **Step 5: 참가 화면 요약**

`src/client/utilities/LobbySettingsSummary.ts`의 `if (c.waterNukes)` 블록 뒤에 추가:

```ts
  if (c.warfareExpansion)
    items.push({
      label: translateText("game_settings.warfare_expansion"),
      value: enabled,
    });
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/client/WarfareLobby.test.ts tests/client/SinglePlayerModalStart.test.ts tests/client/HostLobbyModal.test.ts tests/client/HostLobbyModalTeamCount.test.ts tests/LayerBoundaries.test.ts --run && npm run typecheck`
Expected: 모두 PASS, typecheck 오류 없음

- [ ] **Step 7: 커밋**

```bash
npx prettier --write src/client/SinglePlayerModal.ts src/client/HostLobbyModal.ts src/client/utilities/LobbySettingsSummary.ts tests/client/WarfareLobby.test.ts
git add src/client/SinglePlayerModal.ts src/client/HostLobbyModal.ts src/client/utilities/LobbySettingsSummary.ts tests/client/WarfareLobby.test.ts
git commit -m "feat(warfare): Expanded Warfare toggle in solo and host lobbies"
```

---
### Task 13: 단축바, 건설 메뉴, 원형 메뉴(공수 투입), 명령 이벤트

**Files:**
- Create: `resources/images/CoastalBatteryIconWhite.svg`, `resources/images/AirportIconWhite.svg`, `resources/images/BomberIconWhite.svg`, `resources/images/ParadropIconWhite.svg`
- Modify: `CREDITS.md`
- Modify: `src/client/hud/HotbarIcons.ts`
- Modify: `src/client/hud/layers/UnitDisplay.ts`
- Modify: `src/client/hud/layers/BuildMenu.ts` (`buildTable`)
- Modify: `src/client/hud/layers/RadialMenuElements.ts` (공격 하위 메뉴의 공수 투입)
- Modify: `src/client/hud/layers/PlayerActionHandler.ts` (`handleParadrop`)
- Modify: `src/client/Transport.ts` (`SendParadropIntentEvent`)
- Modify (test): `tests/client/UnitDisplayHotbar.test.ts`
- Test: `tests/client/WarfareRadial.test.ts`

**Interfaces:**
- Consumes: Task 1 `WARFARE_ONLY_UNITS`, `PlayerBuildable`의 `TransportPlane`(원형 메뉴의 `playerActions.buildableUnits`에 들어 있다), Task 6 `paradrop` 인텐트, Task 11 문구 키
- Produces:
  - `HotbarIcons`의 `coastalBatteryIcon`, `airportIcon`, `coastalBarrageIcon`(기존 `ExplosionIconWhite.svg`), `bomberIcon`, `paradropIcon`
  - 단축바 키 `coastal_battery`, `airport`, `coastal_barrage`, `bomber`(`data-hotbar`)
  - `class SendParadropIntentEvent { dst: TileRef; troops: number }`, `PlayerActionHandler.handleParadrop(player: PlayerView, targetTile: TileRef): void`
  - 원형 메뉴 항목 id `attack_paradrop`

- [ ] **Step 1: 실패하는 테스트 작성 — 단축바**

`tests/client/UnitDisplayHotbar.test.ts`:
- import에 `import { WARFARE_ONLY_UNITS } from "@openfront/engine-lib/warfare/Warfare";`를 더한다.
- `mount`의 `opts` 타입을 `{ domestic?: boolean; warfare?: boolean; ports?: number }`로 바꾸고, `config` 모의 객체의 `isUnitDisabled`를 다음으로 바꾼다:

```ts
      isUnitDisabled: (t: UnitType) =>
        (!opts.domestic && DOMESTIC_ONLY.has(t)) ||
        (!opts.warfare && WARFARE_ONLY_UNITS.has(t)),
```

- `describe("unit-display build bar", …)` 안 끝에 추가:

```ts
  it("lists the warfare units only with expanded warfare, wrapping a long bar", async () => {
    const plain = await mount([]);
    expect(plain.el.querySelector('[data-hotbar="airport"]')).toBeNull();
    document.body.innerHTML = "";

    const { el } = await mount([], { domestic: true, warfare: true });
    for (const key of ["coastal_battery", "airport", "coastal_barrage", "bomber"]) {
      expect(el.querySelector(`[data-hotbar="${key}"]`), key).not.toBeNull();
    }
    // 16 buttons don't fit the 600px column on one row.
    const row = el.querySelector('[data-hotbar="airport"]')!.parentElement!;
    expect(row.classList.contains("flex-wrap")).toBe(true);
  });

  it("the bomber card asks for an airport, the barrage card for a silo", async () => {
    const { el } = await mount(
      [buildable(UnitType.Bomber), buildable(UnitType.CoastalBarrage)],
      { warfare: true },
    );
    await tap(el, "bomber");
    expect(card(el)?.textContent).toContain("[touch_ui.needs_airport]");
    await tap(el, "coastal_barrage");
    expect(card(el)?.textContent).toContain("[touch_ui.needs_silo]");
  });

  it("a locked airport names industrialization", async () => {
    const { el } = await mount([buildable(UnitType.Airport, true)], {
      domestic: true,
      warfare: true,
    });
    expect(
      button(el, "airport").querySelector("[data-locked-tech]")!.textContent,
    ).toContain("[domestic.tech.industrialization.name]");
  });
```

- [ ] **Step 2: 실패하는 테스트 작성 — 원형 메뉴와 명령**

`tests/client/WarfareRadial.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: vi.fn((key: string) => key),
}));
vi.mock("../../src/client/hud/layers/BuildMenu", () => ({
  flattenedBuildTable: [],
}));
vi.mock("nanoid", () => ({
  customAlphabet: vi.fn(() => vi.fn(() => "mock-id")),
}));
vi.mock("dompurify", () => ({
  __esModule: true,
  default: { sanitize: vi.fn((str: string) => str) },
}));

import { PlayerActionHandler } from "../../src/client/hud/layers/PlayerActionHandler";
import {
  attackMenuElement,
  MenuElementParams,
} from "../../src/client/hud/layers/RadialMenuElements";
import { SendParadropIntentEvent } from "../../src/client/Transport";

function params(
  plane: { canBuild: number | false; locked?: boolean } | null,
  disabled = false,
): MenuElementParams {
  return {
    game: {
      inSpawnPhase: () => false,
      config: () => ({ isUnitDisabled: () => disabled }),
    },
    playerActions: {
      buildableUnits:
        plane === null
          ? []
          : [
              {
                type: UnitType.TransportPlane,
                canBuild: plane.canBuild,
                canUpgrade: false,
                cost: 100_000n,
                overlappingRailroads: [],
                ghostRailPaths: [],
                locked: plane.locked ?? false,
              },
            ],
    },
    myPlayer: { troops: () => 1000 },
    selected: null,
    tile: 77,
    playerActionHandler: { handleParadrop: vi.fn() },
    closeMenu: vi.fn(),
  } as unknown as MenuElementParams;
}

const paradrop = (p: MenuElementParams) =>
  attackMenuElement.subMenu!(p).find((e) => e.id === "attack_paradrop");

describe("paradrop in the radial attack menu", () => {
  it("is absent with the option off", () => {
    expect(paradrop(params({ canBuild: 5 }, true))).toBeUndefined();
    expect(paradrop(params(null))).toBeUndefined();
  });

  it("drops on the tapped tile when an airport reaches it", () => {
    const p = params({ canBuild: 5 });
    const item = paradrop(p)!;
    expect(item.disabled(p)).toBe(false);
    item.action!(p);
    expect(p.playerActionHandler.handleParadrop).toHaveBeenCalledWith(
      p.myPlayer,
      77,
    );
    expect(p.closeMenu).toHaveBeenCalled();
  });

  it("is greyed out with no airport in reach and shows a lock when locked", () => {
    const p = params({ canBuild: false, locked: true });
    const item = paradrop(p)!;
    expect(item.disabled(p)).toBe(true);
    expect(item.badge).toContain("domestic.tech.industrialization.name");
  });

  it("sends the attack ratio of the troops", () => {
    const emit = vi.fn();
    const handler = new PlayerActionHandler({ emit } as never, {
      attackRatio: 0.25,
    } as never);
    handler.handleParadrop({ troops: () => 1000 } as never, 77);
    expect(emit).toHaveBeenCalledWith(new SendParadropIntentEvent(77, 250));
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest tests/client/UnitDisplayHotbar.test.ts tests/client/WarfareRadial.test.ts --run`
Expected: FAIL — 새 단축바 테스트(`airport` 버튼 없음)와 `SendParadropIntentEvent`가 없다는 오류

- [ ] **Step 4: 아이콘 그림**

`resources/images/AirportIconWhite.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff"><path d="M11 3.5a1 1 0 0 1 2 0V9l9 5.5V17l-9-3v5l2.5 2V23L12 22l-3.5 1v-2l2.5-2v-5l-9 3v-2.5L11 9z"/></svg>
```

`resources/images/CoastalBatteryIconWhite.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff"><path d="M10.6 10.2 18.9 4.6l1.5 2.2-7.7 5.2A4.5 4.5 0 0 1 14.5 15H20v2.4H4V15h1.5a4.5 4.5 0 0 1 5.1-4.8zM2 19.8c2 0 2-1.4 4-1.4s2 1.4 4 1.4 2-1.4 4-1.4 2 1.4 4 1.4 2-1.4 4-1.4v1.6c-2 0-2 1.6-4 1.6s-2-1.6-4-1.6-2 1.6-4 1.6-2-1.6-4-1.6-2 1.6-4 1.6z"/></svg>
```

`resources/images/BomberIconWhite.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff"><path d="M12 2c.8 0 1.3 1 1.3 2.5V9L22 16v2.2l-8.7-3.4V19l2.7 2v1.5L12 21.4l-4 1.1V21l2.7-2v-4.2L2 18.2V16l8.7-7V4.5C10.7 3 11.2 2 12 2z"/></svg>
```

`resources/images/ParadropIconWhite.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff"><path d="M12 2C6.5 2 2.3 5.8 2 10.5h20C21.7 5.8 17.5 2 12 2zM3.2 11.5l7.3 6.3.9-1-6.2-5.3H3.2zm17.6 0h-2l-6.2 5.3.9 1 7.3-6.3zM11.4 11.5v5.3h1.2v-5.3h-1.2zM10 17.5h4v2.2l1.5 2.3h-1.6L12 19.8 10.1 22H8.5l1.5-2.3z"/></svg>
```

`CREDITS.md`의 "This fork" 목록에서 `AdminOfficeIconWhite.svg` 줄 뒤에 추가:

```markdown
- `resources/images/CoastalBatteryIconWhite.svg`, `resources/images/AirportIconWhite.svg`, `resources/images/BomberIconWhite.svg`, `resources/images/ParadropIconWhite.svg` (expanded warfare build menu icons): drawn for this fork, CC BY-SA 4.0.
```

`src/client/hud/HotbarIcons.ts`의 `adminOfficeIcon` 줄 뒤에 추가:

```ts
export const coastalBatteryIcon = assetUrl(
  "images/CoastalBatteryIconWhite.svg",
);
export const airportIcon = assetUrl("images/AirportIconWhite.svg");
export const coastalBarrageIcon = assetUrl("images/ExplosionIconWhite.svg");
export const bomberIcon = assetUrl("images/BomberIconWhite.svg");
export const paradropIcon = assetUrl("images/ParadropIconWhite.svg");
```

- [ ] **Step 5: 단축바**

`src/client/hud/layers/UnitDisplay.ts`:
- `../HotbarIcons` import 목록에 `airportIcon`, `bomberIcon`, `coastalBarrageIcon`, `coastalBatteryIcon`을 더한다.
- `HOTBAR`에서 `type: UnitType.AdminOffice` 항목 뒤에 추가:

```ts
  {
    type: UnitType.CoastalBattery,
    icon: coastalBatteryIcon,
    key: "coastal_battery",
    keybind: "",
    countable: true,
  },
  {
    type: UnitType.Airport,
    icon: airportIcon,
    key: "airport",
    keybind: "",
    countable: true,
  },
```

- `HOTBAR`의 마지막 `type: UnitType.MIRV` 항목 뒤(닫는 `];` 앞)에 추가:

```ts
  {
    type: UnitType.CoastalBarrage,
    icon: coastalBarrageIcon,
    key: "coastal_barrage",
    keybind: "",
    countable: false,
  },
  {
    type: UnitType.Bomber,
    icon: bomberIcon,
    key: "bomber",
    keybind: "",
    countable: false,
  },
```

- `highlightTypes`의 `case UnitType.Warship:` 앞에 추가:

```ts
    case UnitType.CoastalBarrage:
      return [UnitType.MissileSilo, UnitType.CoastalBattery];
    case UnitType.Bomber:
      return [UnitType.Airport, UnitType.SAMLauncher];
```

- `cannotBuildReason`의 사일로 확인을 다음 두 블록으로 바꾼다:

```ts
    if (
      (NUKES.has(type) || type === UnitType.CoastalBarrage) &&
      (player?.units(UnitType.MissileSilo).length ?? 0) === 0
    ) {
      return translateText("touch_ui.needs_silo");
    }
    if (
      type === UnitType.Bomber &&
      (player?.units(UnitType.Airport).length ?? 0) === 0
    ) {
      return translateText("touch_ui.needs_airport");
    }
```

- `render()`의 `<div class="flex justify-center gap-1">`를 `<div class="flex flex-wrap justify-center gap-1">`로 바꾼다(두 옵션을 다 켜면 16칸이라 가운데 600px 열에 한 줄로 들어가지 않는다. 12칸 이하는 그대로 한 줄이다).

- [ ] **Step 6: 건설 메뉴 표**

`src/client/hud/layers/BuildMenu.ts`:
- 아이콘 상수 목록(`adminOfficeIcon` 뒤)에 추가:

```ts
const coastalBatteryIcon = assetUrl("images/CoastalBatteryIconWhite.svg");
const airportIcon = assetUrl("images/AirportIconWhite.svg");
const coastalBarrageIcon = assetUrl("images/ExplosionIconWhite.svg");
const bomberIcon = assetUrl("images/BomberIconWhite.svg");
```

- `buildTable`의 첫 줄 끝(`unitType: UnitType.AdminOffice` 항목 뒤)에 추가(옵션이 꺼지면 `isUnitDisabled`로 빠진다):

```ts
    {
      unitType: UnitType.CoastalBattery,
      icon: coastalBatteryIcon,
      description: "build_menu.desc.coastal_battery",
      key: "unit_type.coastal_battery",
      countable: true,
    },
    {
      unitType: UnitType.Airport,
      icon: airportIcon,
      description: "build_menu.desc.airport",
      key: "unit_type.airport",
      countable: true,
    },
    {
      unitType: UnitType.CoastalBarrage,
      icon: coastalBarrageIcon,
      description: "build_menu.desc.coastal_barrage",
      key: "unit_type.coastal_barrage",
      countable: false,
    },
    {
      unitType: UnitType.Bomber,
      icon: bomberIcon,
      description: "build_menu.desc.bomber",
      key: "unit_type.bomber",
      countable: false,
    },
```

(원형 메뉴의 공격 하위 메뉴는 `BuildableAttacks`라서 해안 포격과 폭격을 핵 옆에 저절로 보여 주고, 내 땅의 건설 하위 메뉴는 `Structures`라서 해안 포대와 공항을 보여 준다.)

- [ ] **Step 7: 공수 투입 명령과 원형 메뉴 항목**

`src/client/Transport.ts`:
- `SendBoatAttackIntentEvent` 클래스 뒤에 추가:

```ts
export class SendParadropIntentEvent implements GameEvent {
  constructor(
    public readonly dst: TileRef,
    public readonly troops: number,
  ) {}
}
```

- `this.subscribe(SendBoatAttackIntentEvent, …);` 뒤에 추가:

```ts
    this.subscribe(SendParadropIntentEvent, (e) =>
      this.onSendParadropIntent(e),
    );
```

- `onSendBoatAttackIntent` 메서드 뒤에 추가:

```ts
  private onSendParadropIntent(event: SendParadropIntentEvent) {
    if (!this.isSendableTroops("paradrop", event.troops)) return;
    this.sendIntent({
      type: "paradrop",
      troops: event.troops,
      dst: event.dst,
    });
  }
```

`src/client/hud/layers/PlayerActionHandler.ts`: Transport import에 `SendParadropIntentEvent`를 더하고 `handleBoatAttack` 뒤에 추가:

```ts
  handleParadrop(player: PlayerView, targetTile: TileRef) {
    this.eventBus.emit(
      new SendParadropIntentEvent(
        targetTile,
        this.uiState.attackRatio * player.troops(),
      ),
    );
  }
```

`src/client/hud/layers/RadialMenuElements.ts`:
- 아이콘 상수 목록(`const xIcon = …` 뒤)에 `const paradropIcon = assetUrl("images/ParadropIconWhite.svg");`를 추가한다.
- `attackMenuElement` 정의 바로 앞에 추가:

```ts
/**
 * Expanded warfare: drop troops (attack ratio) on the tapped tile from an
 * airport in range (spec §14b). The menu itself is the confirmation: tap
 * the tile, then this item. Null when the option is off.
 */
function createParadropElement(params: MenuElementParams): MenuElement | null {
  const plane = params.playerActions.buildableUnits.find(
    (u) => u.type === UnitType.TransportPlane,
  );
  if (
    plane === undefined ||
    params.game.config().isUnitDisabled(UnitType.TransportPlane)
  ) {
    return null;
  }
  return {
    id: "attack_paradrop",
    name: "paradrop",
    disabled: () => plane.canBuild === false,
    icon: paradropIcon,
    color: plane.canBuild === false ? COLORS.disabled : COLORS.attack,
    badge: plane.locked ? lockedBadge(UnitType.TransportPlane) : undefined,
    tooltipItems: [
      { text: translateText("radial_menu.paradrop_title"), className: "title" },
      {
        text: translateText("radial_menu.paradrop_description"),
        className: "description",
      },
      ...(plane.locked
        ? [
            {
              text: lockedReason(UnitType.TransportPlane),
              className: "locked",
            },
          ]
        : []),
      {
        text: `${renderNumber(plane.cost)} ${translateText("player_panel.gold")}`,
        className: "cost",
      },
    ],
    action: (p: MenuElementParams) => {
      p.playerActionHandler.handleParadrop(p.myPlayer, p.tile);
      p.closeMenu();
    },
  };
}
```

- `attackMenuElement`의 `subMenu`를 다음으로 바꾼다:

```ts
  subMenu: (params: MenuElementParams) => {
    if (params === undefined) return [];
    const paradrop = createParadropElement(params);
    return [
      ...createMenuElements(params, "attack", "attack"),
      ...(paradrop === null ? [] : [paradrop]),
    ];
  },
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest tests/client/UnitDisplayHotbar.test.ts tests/client/WarfareRadial.test.ts tests/client/graphics/RadialMenuElements.test.ts tests/radialMenuElements.test.ts tests/client/HudLayout.test.ts tests/ForkAssets.test.ts tests/LayerBoundaries.test.ts --run && npm run typecheck`
Expected: 모두 PASS, typecheck 오류 없음

- [ ] **Step 9: 커밋**

```bash
npx prettier --write src/client/hud src/client/Transport.ts tests/client/UnitDisplayHotbar.test.ts tests/client/WarfareRadial.test.ts CREDITS.md
git add resources/images CREDITS.md src/client/hud src/client/Transport.ts tests/client/UnitDisplayHotbar.test.ts tests/client/WarfareRadial.test.ts
git commit -m "feat(warfare): build bar, build menu and radial paradrop for expanded warfare"
```

---
### Task 14: 지도에 놓기 전 미리보기 — 반경, 직선 궤적, SAM 위협

**Files:**
- Create: `src/client/render/gl/utils/FlightTrajectory.ts`
- Create: `src/client/controllers/WarfarePreview.ts`
- Modify: `src/client/controllers/BuildPreviewController.ts`
- Modify: `src/client/render/gl/Renderer.ts` (`SAM_RADIUS_GHOST_TYPES`, `SAM_RADIUS_HIGHLIGHT_TYPES`)
- Test: `tests/client/FlightTrajectory.test.ts`, `tests/client/WarfarePreview.test.ts`

**Interfaces:**
- Consumes: Task 1 `COASTAL_BATTERY_RANGE`, `airportRange`, `BARRAGE_RADIUS`, `BARRAGE_SILO_RANGE`, `BOMB_OUTER`; 기존 `NukeTrajectoryData`, `SAMInfo`, 두 번 탭 확인 흐름(바꾸지 않는다)
- Produces:
  - `buildFlightTrajectory(srcX, srcY, dstX, dstY, sams: readonly SAMInfo[]): NukeTrajectoryData` — 직선 Bezier, 비행 내내 요격 가능(`tUntargetableStart/End = -1`), 처음 SAM 원에 들어가는 `t`
  - `firstSamEntry(srcX, srcY, dstX, dstY, sams): number`(0..1, 없으면 1)
  - `warfareGhostRadius(type: UnitType, level: number): number`
  - `flightSource(units: readonly FlightSourceUnit[], type: UnitType.Bomber | UnitType.CoastalBarrage, tile: TileRef, dist2: (a: TileRef, b: TileRef) => number): TileRef | null` — 엔진의 `airportSortieSpawn`/`barrageSpawn`과 같은 고르기

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/FlightTrajectory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildFlightTrajectory,
  firstSamEntry,
} from "../../src/client/render/gl/utils/FlightTrajectory";

describe("straight flight preview", () => {
  it("puts the control points on the line and has no untargetable stretch", () => {
    const t = buildFlightTrajectory(0, 0, 90, 30, []);
    expect([t.p0x, t.p0y, t.p3x, t.p3y]).toEqual([0, 0, 90, 30]);
    expect([t.p1x, t.p1y]).toEqual([30, 10]);
    expect([t.p2x, t.p2y]).toEqual([60, 20]);
    expect(t.tUntargetableStart).toBe(-1);
    expect(t.tUntargetableEnd).toBe(-1);
    expect(t.tSamIntercept).toBe(1);
  });

  it("marks where the line first enters a SAM's range", () => {
    expect(firstSamEntry(0, 0, 100, 0, [{ x: 50, y: 0, r: 10 }])).toBeCloseTo(
      0.4,
    );
    expect(
      buildFlightTrajectory(0, 0, 100, 0, [{ x: 50, y: 0, r: 10 }])
        .tSamIntercept,
    ).toBeCloseTo(0.4);
  });

  it("ignores SAMs the line passes by, and is 0 when it starts inside one", () => {
    expect(firstSamEntry(0, 0, 100, 0, [{ x: 50, y: 30, r: 10 }])).toBe(1);
    expect(firstSamEntry(0, 0, 100, 0, [{ x: 2, y: 0, r: 10 }])).toBe(0);
    expect(
      firstSamEntry(0, 0, 100, 0, [
        { x: 80, y: 0, r: 5 },
        { x: 30, y: 0, r: 5 },
      ]),
    ).toBeCloseTo(0.25);
  });
});
```

`tests/client/WarfarePreview.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { describe, expect, it } from "vitest";
import {
  flightSource,
  warfareGhostRadius,
} from "../../src/client/controllers/WarfarePreview";

const W = 1000;
const dist2 = (a: number, b: number) => {
  const dx = (a % W) - (b % W);
  const dy = Math.floor(a / W) - Math.floor(b / W);
  return dx * dx + dy * dy;
};
const ref = (x: number, y: number) => y * W + x;

function unit(x: number, y: number, opts: Partial<{ level: number; busy: boolean }> = {}) {
  return {
    tile: () => ref(x, y),
    level: () => opts.level ?? 1,
    isActive: () => true,
    isInCooldown: () => opts.busy ?? false,
    isUnderConstruction: () => false,
  };
}

describe("warfare ghost previews", () => {
  it("draws each unit's ring", () => {
    expect(warfareGhostRadius(UnitType.CoastalBattery, 1)).toBe(40);
    expect(warfareGhostRadius(UnitType.Airport, 1)).toBe(150);
    expect(warfareGhostRadius(UnitType.Airport, 3)).toBe(210);
    expect(warfareGhostRadius(UnitType.CoastalBarrage, 1)).toBe(12);
    expect(warfareGhostRadius(UnitType.Bomber, 1)).toBe(18);
    expect(warfareGhostRadius(UnitType.City, 1)).toBe(0);
  });

  it("a bomber leaves from the nearest airport with a free sortie in range", () => {
    const near = unit(100, 0, { busy: true });
    const far = unit(0, 0);
    const target = ref(140, 0);
    expect(flightSource([near, far], UnitType.Bomber, target, dist2)).toBe(
      far.tile(),
    );
    expect(flightSource([near], UnitType.Bomber, target, dist2)).toBeNull();
    expect(
      flightSource([unit(0, 0)], UnitType.Bomber, ref(170, 0), dist2),
    ).toBeNull();
    expect(
      flightSource([unit(0, 0, { level: 2 })], UnitType.Bomber, ref(170, 0), dist2),
    ).toBe(ref(0, 0));
  });

  it("a barrage leaves from the nearest loaded silo within 200 tiles", () => {
    const silos = [unit(0, 0), unit(150, 0)];
    expect(
      flightSource(silos, UnitType.CoastalBarrage, ref(190, 0), dist2),
    ).toBe(ref(150, 0));
    expect(
      flightSource([unit(0, 0)], UnitType.CoastalBarrage, ref(250, 0), dist2),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/FlightTrajectory.test.ts tests/client/WarfarePreview.test.ts --run`
Expected: FAIL — `Cannot find module '…/FlightTrajectory'`

- [ ] **Step 3: 직선 궤적과 미리보기 규칙**

`src/client/render/gl/utils/FlightTrajectory.ts`:

```ts
import type { NukeTrajectoryData } from "../../types";
import type { SAMInfo } from "./NukeTrajectory";

/**
 * Expanded warfare: where (0..1 along the line) a straight flight first
 * enters a SAM's range; 1 when it never does, 0 when it starts inside one.
 */
export function firstSamEntry(
  srcX: number,
  srcY: number,
  dstX: number,
  dstY: number,
  sams: readonly SAMInfo[],
): number {
  const dx = dstX - srcX;
  const dy = dstY - srcY;
  const a = dx * dx + dy * dy;
  let first = 1;
  for (const sam of sams) {
    const fx = srcX - sam.x;
    const fy = srcY - sam.y;
    const c = fx * fx + fy * fy - sam.r * sam.r;
    if (c <= 0) return 0;
    if (a === 0) continue;
    const b = 2 * (fx * dx + fy * dy);
    const disc = b * b - 4 * a * c;
    if (disc < 0) continue;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t >= 0 && t < first) first = t;
  }
  return first;
}

/**
 * A plane's or a barrage's straight flight for the trajectory overlay: a
 * cubic Bezier with its control points on the line. Planes can be shot at
 * all the way, so there is no untargetable stretch.
 */
export function buildFlightTrajectory(
  srcX: number,
  srcY: number,
  dstX: number,
  dstY: number,
  sams: readonly SAMInfo[],
): NukeTrajectoryData {
  const dx = dstX - srcX;
  const dy = dstY - srcY;
  return {
    p0x: srcX,
    p0y: srcY,
    p1x: srcX + dx / 3,
    p1y: srcY + dy / 3,
    p2x: srcX + (2 * dx) / 3,
    p2y: srcY + (2 * dy) / 3,
    p3x: dstX,
    p3y: dstY,
    tUntargetableStart: -1,
    tUntargetableEnd: -1,
    tSamIntercept: firstSamEntry(srcX, srcY, dstX, dstY, sams),
  };
}
```

`src/client/controllers/WarfarePreview.ts`:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  airportRange,
  BARRAGE_RADIUS,
  BARRAGE_SILO_RANGE,
  BOMB_OUTER,
  COASTAL_BATTERY_RANGE,
} from "@openfront/engine-lib/warfare/Warfare";

/** Expanded warfare ghost rings: battery reach, airport range, barrage and bomb radius. */
export function warfareGhostRadius(type: UnitType, level: number): number {
  switch (type) {
    case UnitType.CoastalBattery:
      return COASTAL_BATTERY_RANGE;
    case UnitType.Airport:
      return airportRange(level);
    case UnitType.CoastalBarrage:
      return BARRAGE_RADIUS;
    case UnitType.Bomber:
      return BOMB_OUTER;
    default:
      return 0;
  }
}

export interface FlightSourceUnit {
  tile(): TileRef;
  level(): number;
  isActive(): boolean;
  isInCooldown(): boolean;
  isUnderConstruction(): boolean;
}

/**
 * Where a bomber (airport) or barrage (silo) would take off for `tile`: the
 * nearest ready one in reach, first wins a tie, the same pick as the
 * engine's airportSortieSpawn / barrageSpawn. Null when none reaches.
 */
export function flightSource(
  units: readonly FlightSourceUnit[],
  type: UnitType.Bomber | UnitType.CoastalBarrage,
  tile: TileRef,
  dist2: (a: TileRef, b: TileRef) => number,
): TileRef | null {
  let best: FlightSourceUnit | null = null;
  let bestDist = Infinity;
  for (const u of units) {
    if (!u.isActive() || u.isInCooldown() || u.isUnderConstruction()) continue;
    const reach =
      type === UnitType.Bomber ? airportRange(u.level()) : BARRAGE_SILO_RANGE;
    const d = dist2(u.tile(), tile);
    if (d > reach * reach || d >= bestDist) continue;
    best = u;
    bestDist = d;
  }
  return best?.tile() ?? null;
}
```

- [ ] **Step 4: 미리보기 컨트롤러에 연결**

`src/client/controllers/BuildPreviewController.ts`:
- import 추가:

```ts
import { buildFlightTrajectory } from "../render/gl/utils/FlightTrajectory";
import { flightSource, warfareGhostRadius } from "./WarfarePreview";
```

- `nukeTrajectoryStatic` 타입의 `sams: SAMInfo[];` 뒤에 추가:

```ts
    /** A bomber or barrage: a straight line instead of the nuke's arc. */
    straight: boolean;
```

- `cursorLoop`의 `const data = buildNukeTrajectory( … );` 문장을 다음으로 바꾼다:

```ts
          const data = traj.straight
            ? buildFlightTrajectory(
                traj.srcX,
                traj.srcY,
                w.x - 0.5,
                w.y - 0.5,
                traj.sams,
              )
            : buildNukeTrajectory(
                traj.srcX,
                traj.srcY,
                w.x - 0.5,
                w.y - 0.5,
                this.game.height(),
                traj.directionUp,
                traj.sams,
              );
```

- `updateNukeTrajectoryPreview`에서 `const type = this.ghostUnit.buildableUnit.type;` 바로 뒤에 추가:

```ts
    if (type === UnitType.Bomber || type === UnitType.CoastalBarrage) {
      this.updateFlightPreview(type, tileRef);
      return;
    }
```

- 같은 함수 끝의 `this.nukeTrajectoryStatic = { srcX, srcY, directionUp, sams };`에 `straight: false,`를 더한다:

```ts
    this.nukeTrajectoryStatic = {
      srcX,
      srcY,
      directionUp,
      sams,
      straight: false,
    };
```

- `clearNukeTrajectory()` 메서드 바로 뒤에 추가:

```ts
  /**
   * Expanded warfare: a bomber flies straight from the airport the engine
   * would use, and non-friendly SAMs threaten it; a barrage flies straight
   * from the silo it would use, and nothing intercepts it.
   */
  private updateFlightPreview(
    type: UnitType.Bomber | UnitType.CoastalBarrage,
    tileRef: TileRef,
  ): void {
    const myPlayer = this.game.myPlayer();
    if (!myPlayer) {
      this.clearNukeTrajectory();
      return;
    }
    const src = flightSource(
      myPlayer.units(
        type === UnitType.Bomber ? UnitType.Airport : UnitType.MissileSilo,
      ),
      type,
      tileRef,
      (a, b) => this.game.euclideanDistSquared(a, b),
    );
    if (src === null) {
      this.clearNukeTrajectory();
      return;
    }
    const sams: SAMInfo[] = [];
    if (type === UnitType.Bomber) {
      const config = this.game.config();
      for (const s of this.game.units(UnitType.SAMLauncher)) {
        if (!s.isActive()) continue;
        const owner = s.owner();
        if (owner === myPlayer || myPlayer.isFriendly(owner)) continue;
        sams.push({
          x: this.game.x(s.tile()),
          y: this.game.y(s.tile()),
          r: config.samRangeOf(owner, config.samRange(s.level())),
        });
      }
    }
    this.nukeTrajectoryStatic = {
      srcX: this.game.x(src),
      srcY: this.game.y(src),
      directionUp: false,
      sams,
      straight: true,
    };
  }
```

- `buildGhostPreviewData`의 `switch (u.type)`에서 `case UnitType.DefensePost:` 블록 뒤에 추가:

```ts
      case UnitType.CoastalBattery:
      case UnitType.Airport:
      case UnitType.CoastalBarrage:
      case UnitType.Bomber:
        rangeRadius = warfareGhostRadius(
          u.type,
          u.canUpgrade !== false
            ? (this.game.unit(u.canUpgrade)?.level() ?? 0) + 1
            : 1,
        );
        break;
```

`src/client/render/gl/Renderer.ts`: `SAM_RADIUS_GHOST_TYPES`와 `SAM_RADIUS_HIGHLIGHT_TYPES` 두 집합 모두에 `"Bomber",`를 더한다(폭격기를 고르면 적 SAM 사거리가 보인다).

- [ ] **Step 5: 통과 확인**

Run: `npx vitest tests/client/FlightTrajectory.test.ts tests/client/WarfarePreview.test.ts tests/client/controllers/BuildPreviewController.test.ts tests/client/InputHandlerTouch.test.ts --run && npm run typecheck`
Expected: 모두 PASS, typecheck 오류 없음

- [ ] **Step 6: 커밋**

```bash
npx prettier --write src/client/render/gl/utils/FlightTrajectory.ts src/client/controllers/WarfarePreview.ts src/client/controllers/BuildPreviewController.ts src/client/render/gl/Renderer.ts tests/client/FlightTrajectory.test.ts tests/client/WarfarePreview.test.ts
git add src/client tests/client/FlightTrajectory.test.ts tests/client/WarfarePreview.test.ts
git commit -m "feat(warfare): ghost rings and straight flight previews with SAM threat"
```

---
### Task 15: 지도 아이콘(해안 포대, 공항)과 이동 유닛 그림(수송기, 폭격기, 화물기)

**Files:**
- Create: `resources/atlases/src/coastal-battery.svg`, `resources/atlases/src/airport.svg`, `resources/atlases/src/unit-sprites.py`
- Modify: `resources/atlases/icon-atlas.png` (9·10번째 칸 추가, 640×64), `resources/atlases/unit-atlas.png` (13~15번째 칸 추가, 195×13)
- Modify: `CREDITS.md`
- Modify: `src/client/render/types/UnitType.ts`, `src/client/render/types/index.ts`
- Modify: `src/client/render/gl/passes/UnitPass.ts` (`UNIT_ORDER`, `MISSILE_TYPES`)
- Modify: `src/client/render/gl/shaders/structure/structure.frag.glsl` (`shapeSDF`)
- Modify: `src/client/render/gl/render-settings.json` (`structure.shapes`)
- Modify: `src/client/render/gl/passes/fx-pass/FxSettings.ts` (폭격 폭발)
- Modify: `src/client/render/gl/passes/BarPass.ts` (공항 출격 재장전 막대)
- Modify (test): `tests/client/render/gl/StructureAtlas.test.ts`

**Interfaces:**
- Consumes: Task 1 `AIRPORT_SORTIE_COOLDOWN_TICKS`, 유닛 문자열 값
- Produces:
  - `UT_COASTAL_BATTERY`, `UT_AIRPORT`, `UT_COASTAL_BARRAGE`, `UT_BOMBER`, `UT_TRANSPORT_PLANE`, `UT_CARGO_PLANE`(`src/client/render/types`에서 export)
  - `STRUCTURE_ATLAS_ORDER`의 8열 해안 포대, 9열 공항; `UNIT_ORDER`(이제 export)의 12열 수송기, 13열 폭격기, 14열 화물기
  - 해안 포격의 포탄은 기존 `Shell` 그림, 표식(`Coastal Barrage`)은 유닛 그림이 없다(Task 16이 원으로 그린다)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/render/gl/StructureAtlas.test.ts`:
- import에 `UNIT_ORDER`(`../../../../src/client/render/gl/passes/UnitPass`)와 `UT_AIRPORT`, `UT_COASTAL_BATTERY`, `UT_TRANSPORT_PLANE`, `UT_BOMBER`, `UT_CARGO_PLANE`(`../../../../src/client/render/types`)를 더한다.
- `ORIGINAL_CELLS_SHA256` 선언 뒤에 추가:

```ts
/** The eight cells before the warfare structures (all of the 512x64 atlas then). */
const PRE_WARFARE_CELLS = 8;
const PRE_WARFARE_SHA256 =
  "621440ab35f073480851808450ed8a09cf38981e4f5ef9cd7f2b8ad54b66dfe6";
const UNIT_CELL = 13;
/** sha256 of the original 156x13 unit atlas's RGBA pixels (12 cells). */
const ORIGINAL_UNIT_CELLS = 12;
const ORIGINAL_UNIT_SHA256 =
  "ffd5f3525193fadd27a3511aca9da1577f67c81e95a6d0a252f7c20f947bc9eb";
```

- `columns` 함수가 칸 크기를 받게 바꾼다:

```ts
/** RGBA bytes of atlas columns [first, first + count), row-major. */
function columns(
  png: DecodedPng,
  first: number,
  count: number,
  cell = CELL,
): Uint8Array {
  if ((first + count) * cell > png.width) {
    throw new Error(`atlas has no column ${first + count - 1}`);
  }
  const w = count * cell * 4;
  const out = new Uint8Array(png.height * w);
  for (let y = 0; y < png.height; y++) {
    const start = (y * png.width + first * cell) * 4;
    out.set(png.rgba.subarray(start, start + w), y * w);
  }
  return out;
}
```

- `describe("icon-atlas.png")`에서 크기 테스트의 이름과 기대를 `(640×64)`, `expect(png.width).toBe(640);`으로 바꾸고, "keeps the original six cells byte-identical" 뒤에 추가:

```ts
  it("keeps the eight cells from before the warfare structures", () => {
    const hash = createHash("sha256")
      .update(columns(png, 0, PRE_WARFARE_CELLS))
      .digest("hex");
    expect(hash).toBe(PRE_WARFARE_SHA256);
  });
```

- "draws a white glyph on transparency in each new cell…" 테스트의 `for (const col of [6, 7]) {`를 `for (const col of [6, 7, 8, 9]) {`로 바꾼다.
- `describe("StructurePass atlas columns")`의 첫 테스트를 다음으로 바꾼다:

```ts
  it("draws the fork's structures from their own columns (6 to 9)", () => {
    const { gl, uploads } = fakeGL();
    const pass = new StructurePass(gl, header, {}, {}, createRenderSettings());
    pass.updateStructures(
      unitsOf([
        UT_CITY,
        UT_DEFENSE_POST,
        UT_RESEARCH_INSTITUTE,
        UT_ADMIN_OFFICE,
        UT_COASTAL_BATTERY,
        UT_AIRPORT,
        UT_WARSHIP, // not a structure: skipped
      ]),
    );
    expect(uploadedColumns(uploads, 6, 6)).toEqual([0, 3, 6, 7, 8, 9]);
  });
```

- 파일 끝에 추가:

```ts
describe("unit-atlas.png", () => {
  const png = decodePng(readFileSync("resources/atlases/unit-atlas.png"));

  it("has one 13px column per UnitPass atlas column", () => {
    expect(png.height).toBe(UNIT_CELL);
    expect(png.width).toBe(UNIT_ORDER.length * UNIT_CELL);
    expect(UNIT_ORDER.indexOf(UT_TRANSPORT_PLANE)).toBe(12);
    expect(UNIT_ORDER.indexOf(UT_BOMBER)).toBe(13);
    expect(UNIT_ORDER.indexOf(UT_CARGO_PLANE)).toBe(14);
  });

  it("keeps the twelve original cells byte-identical", () => {
    const hash = createHash("sha256")
      .update(columns(png, 0, ORIGINAL_UNIT_CELLS, UNIT_CELL))
      .digest("hex");
    expect(hash).toBe(ORIGINAL_UNIT_SHA256);
  });

  it("draws each plane in opaque grayscale, each unlike the others", () => {
    const cells = [12, 13, 14].map((c) => columns(png, c, 1, UNIT_CELL));
    for (const cell of cells) {
      let opaque = 0;
      for (let p = 0; p < cell.length; p += 4) {
        const alpha = cell[p + 3];
        expect([0, 255]).toContain(alpha);
        if (alpha === 0) continue;
        opaque++;
        expect(cell[p]).toBe(cell[p + 1]);
        expect(cell[p + 1]).toBe(cell[p + 2]);
      }
      expect(opaque).toBeGreaterThan(10);
    }
    expect(Buffer.from(cells[0]).equals(Buffer.from(cells[1]))).toBe(false);
    expect(Buffer.from(cells[1]).equals(Buffer.from(cells[2]))).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/render/gl/StructureAtlas.test.ts --run`
Expected: FAIL — `UNIT_ORDER`가 export되지 않았고(`undefined`), 아이콘 아틀라스 폭이 512

- [ ] **Step 3: 건물 아이콘 원본과 아틀라스**

`resources/atlases/src/coastal-battery.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="-4 -4 32 32" fill="#ffffff">
  <!--
    Coastal Battery map icon: icon-atlas.png cell 9 (atlas column 8).
    Drawn for this fork; licensed CC BY-SA 4.0 like the rest of resources/.

    A gun turret on a quay over waves; the same silhouette as
    resources/images/CoastalBatteryIconWhite.svg (24-unit grid), drawn the
    way the original atlas cells are: 2x scale with 4 units (8px) of padding
    in a 64x64 cell, solid white on transparent. See airport.svg for the
    command that rebuilds icon-atlas.png.
  -->
  <path d="M10.6 10.2 18.9 4.6l1.5 2.2-7.7 5.2A4.5 4.5 0 0 1 14.5 15H20v2.4H4V15h1.5a4.5 4.5 0 0 1 5.1-4.8zM2 19.8c2 0 2-1.4 4-1.4s2 1.4 4 1.4 2-1.4 4-1.4 2 1.4 4 1.4 2-1.4 4-1.4v1.6c-2 0-2 1.6-4 1.6s-2-1.6-4-1.6-2 1.6-4 1.6-2-1.6-4-1.6-2 1.6-4 1.6z"/>
</svg>
```

`resources/atlases/src/airport.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="-4 -4 32 32" fill="#ffffff">
  <!--
    Airport map icon: icon-atlas.png cell 10 (atlas column 9).
    Drawn for this fork; licensed CC BY-SA 4.0 like the rest of resources/.

    The airliner silhouette of resources/images/AirportIconWhite.svg
    (24-unit grid), at 2x with 8px padding in a 64x64 cell, solid white on
    transparent, like the original cells.

    Rebuild the atlas from the repo root (keeps the first eight cells as-is):
      rsvg-convert -w 64 -h 64 resources/atlases/src/coastal-battery.svg -o /tmp/cb.png
      rsvg-convert -w 64 -h 64 resources/atlases/src/airport.svg -o /tmp/ap.png
      magick resources/atlases/icon-atlas.png -crop 512x64+0+0 +repage /tmp/cb.png /tmp/ap.png \
        +append +repage -strip PNG32:resources/atlases/icon-atlas.png
  -->
  <path d="M11 3.5a1 1 0 0 1 2 0V9l9 5.5V17l-9-3v5l2.5 2V23L12 22l-3.5 1v-2l2.5-2v-5l-9 3v-2.5L11 9z"/>
</svg>
```

아틀라스 다시 만들기(저장소 루트에서):

```bash
rsvg-convert -w 64 -h 64 resources/atlases/src/coastal-battery.svg -o /tmp/cb.png
rsvg-convert -w 64 -h 64 resources/atlases/src/airport.svg -o /tmp/ap.png
magick resources/atlases/icon-atlas.png -crop 512x64+0+0 +repage /tmp/cb.png /tmp/ap.png \
  +append +repage -strip PNG32:resources/atlases/icon-atlas.png
file resources/atlases/icon-atlas.png
```

Expected: `PNG image data, 640 x 64, 8-bit/color RGBA, non-interlaced`

- [ ] **Step 4: 이동 유닛 그림**

`resources/atlases/src/unit-sprites.py`:

```python
"""Append the expanded-warfare plane sprites to unit-atlas.png.

Columns 12-14 (13x13 px each): Transport Plane, Bomber, Cargo Plane (the
order of UNIT_ORDER in src/client/render/gl/passes/UnitPass.ts). Barrage
shells reuse the Shell cell. Drawn for this fork; licensed CC BY-SA 4.0
like the rest of resources/. Grayscale like the original cells (the shader
tints them by owner):
  . transparent, a 70, b 100, c 130, d 180, e 255.
The first twelve cells (156 px) are kept byte for byte, so the script can
be re-run. From the repo root:
  python3 -I resources/atlases/src/unit-sprites.py resources/atlases/unit-atlas.png
"""

import sys

from PIL import Image

CELL = 13
ORIGINAL_COLUMNS = 12
SHADES = {"a": 70, "b": 100, "c": 130, "d": 180, "e": 255}

TRANSPORT_PLANE = [
    "......d......",
    ".....ddd.....",
    ".....dad.....",
    ".....dad.....",
    "ddddddadddddd",
    "dccccdadccccd",
    "ddddddadddddd",
    ".....dad.....",
    ".....dad.....",
    ".....dad.....",
    "...ddddddd...",
    "...dcccccd...",
    "...ddddddd...",
]

BOMBER = [
    "......c......",
    ".....cac.....",
    ".....cac.....",
    "....ccacc....",
    "...cccaccc...",
    "..ccccacccc..",
    ".cccccaccccc.",
    "ccccc.a.ccccc",
    "cc...cac...cc",
    ".....cac.....",
    "....ccacc....",
    "...cc.a.cc...",
    ".............",
]

CARGO_PLANE = [
    ".............",
    "......e......",
    ".....ded.....",
    ".....ded.....",
    "..ddddedddd..",
    ".....ded.....",
    ".....ded.....",
    ".....ded.....",
    "....ddedd....",
    ".............",
    ".............",
    ".............",
    ".............",
]

SPRITES = [TRANSPORT_PLANE, BOMBER, CARGO_PLANE]


def cell(rows):
    assert len(rows) == CELL, "a sprite has 13 rows"
    img = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        assert len(row) == CELL, f"row {y} has 13 columns: {row!r}"
        assert row == row[::-1], f"row {y} is left-right symmetric: {row!r}"
        for x, ch in enumerate(row):
            if ch != ".":
                v = SHADES[ch]
                img.putpixel((x, y), (v, v, v, 255))
    return img


def main(path):
    atlas = Image.open(path).convert("RGBA")
    width = (ORIGINAL_COLUMNS + len(SPRITES)) * CELL
    out = Image.new("RGBA", (width, CELL), (0, 0, 0, 0))
    out.paste(atlas.crop((0, 0, ORIGINAL_COLUMNS * CELL, CELL)), (0, 0))
    for i, rows in enumerate(SPRITES):
        out.paste(cell(rows), ((ORIGINAL_COLUMNS + i) * CELL, 0))
    out.save(path, optimize=True)


if __name__ == "__main__":
    main(sys.argv[1])
```

```bash
python3 -I resources/atlases/src/unit-sprites.py resources/atlases/unit-atlas.png
file resources/atlases/unit-atlas.png
```

Expected: `PNG image data, 195 x 13, 8-bit/color RGBA, non-interlaced`(Pillow가 없으면 `python3 -m pip install --user pillow` 후 다시 실행)

`CREDITS.md`: "This fork" 목록의 `icon-atlas.png` 줄을 다음으로 바꾸고 그 아래에 한 줄을 더한다:

```markdown
- `resources/atlases/icon-atlas.png`: upstream's structure icon atlas (CC BY-SA 4.0, "OpenFront"), modified by this fork: cells 7 and 8 (domestic structures) and 9 and 10 (coastal battery, airport, from `resources/atlases/src/coastal-battery.svg` and `airport.svg`, drawn for this fork) are appended; the first six cells are unchanged. The modified atlas is CC BY-SA 4.0.
- `resources/atlases/unit-atlas.png`: upstream's unit sprite atlas (CC BY-SA 4.0, "OpenFront"), modified by this fork: three plane sprites drawn for this fork (`resources/atlases/src/unit-sprites.py`) are appended; the first twelve cells are unchanged. The modified atlas is CC BY-SA 4.0.
```

- [ ] **Step 5: 렌더 타입과 패스**

`src/client/render/types/UnitType.ts`:
- `UT_ADMIN_OFFICE` 선언 뒤에 추가:

```ts

// Expanded warfare
export const UT_COASTAL_BATTERY = "Coastal Battery" as const;
export const UT_AIRPORT = "Airport" as const;
export const UT_COASTAL_BARRAGE = "Coastal Barrage" as const;
export const UT_BOMBER = "Bomber" as const;
export const UT_TRANSPORT_PLANE = "Transport Plane" as const;
export const UT_CARGO_PLANE = "Cargo Plane" as const;
```

- `STRUCTURE_TYPES`의 `UT_ADMIN_OFFICE,` 뒤에 `UT_COASTAL_BATTERY,`, `UT_AIRPORT,`를 더한다.
- `SMOOTHED_NUKE_TYPES`의 주석을 `/** Nuke types and planes whose rendered position … */`로 고치고 `UT_MIRV_WARHEAD,` 뒤에 `UT_TRANSPORT_PLANE,`, `UT_BOMBER,`, `UT_CARGO_PLANE,`를 더한다.
- `ALL_UNIT_TYPES`의 `UT_ADMIN_OFFICE,` 뒤에 여섯 개를 enum 순서대로 더한다:

```ts
  UT_COASTAL_BATTERY,
  UT_AIRPORT,
  UT_COASTAL_BARRAGE,
  UT_BOMBER,
  UT_TRANSPORT_PLANE,
  UT_CARGO_PLANE,
```

- `STRUCTURE_ATLAS_ORDER`의 `UT_ADMIN_OFFICE,` 뒤에 `UT_COASTAL_BATTERY,`, `UT_AIRPORT,`를 더한다.

`src/client/render/types/index.ts`의 `./UnitType` export 목록에 여섯 상수를 더한다(이름순: `UT_AIRPORT`, `UT_BOMBER`, `UT_CARGO_PLANE`, `UT_COASTAL_BARRAGE`, `UT_COASTAL_BATTERY`, `UT_TRANSPORT_PLANE`).

`src/client/render/gl/passes/UnitPass.ts`:
- `../../types` import에 `UT_BOMBER`, `UT_CARGO_PLANE`, `UT_TRANSPORT_PLANE`를 더한다.
- `const UNIT_ORDER = [`를 `export const UNIT_ORDER = [`로 바꾸고, `"TrainCarriageLoaded",` 뒤에 추가:

```ts
  // Expanded warfare (unit-atlas.png columns 12-14)
  UT_TRANSPORT_PLANE,
  UT_BOMBER,
  UT_CARGO_PLANE,
```

- 인스턴스 설명 주석의 `(atlas column 0–11)`을 `(atlas column 0–14)`로 고친다.
- `MISSILE_TYPES`의 `UT_MIRV_WARHEAD,` 뒤에 비행기 셋을 더한다(건물 위에 그린다):

```ts
  UT_TRANSPORT_PLANE,
  UT_BOMBER,
  UT_CARGO_PLANE,
```

`src/client/render/gl/shaders/structure/structure.frag.glsl`의 `shapeSDF`에서 주석과 마지막 줄을 바꾼다:

```glsl
// Per-structure-type shape SDF.
// Atlas indices (STRUCTURE_ATLAS_ORDER): 0=City, 1=Port, 2=Factory,
// 3=DefensePost, 4=SAM, 5=Silo, 6=ResearchInstitute, 7=AdminOffice,
// 8=CoastalBattery, 9=Airport
```

```glsl
  if (vAtlasIdx < 6.5)
    return sdPolygon(p, R, 4.0, PI * 0.25);   // Research Institute → diamond (vertex up)
  if (vAtlasIdx < 7.5)
    return sdPolygon(p, R, 5.0, -PI * 0.5);   // Admin Office → pentagon (vertex down)
  if (vAtlasIdx < 8.5)
    return sdPolygon(p, R, 3.0, -PI * 0.5);   // Coastal Battery → triangle (vertex down)
  return sdPolygon(p, R, 7.0, PI * 0.5);      // Airport → heptagon (vertex up)
```

`src/client/render/gl/render-settings.json`의 `"Admin Office"` 블록을 다음으로 바꾼다:

```json
      "Admin Office": {
        "scale": 1.2,
        "iconFill": 0.8
      },
      "Coastal Battery": {
        "scale": 1.45,
        "iconFill": 0.8
      },
      "Airport": {
        "scale": 1.3,
        "iconFill": 0.85
      }
```

`src/client/render/gl/passes/fx-pass/FxSettings.ts`: import에 `UT_BOMBER`를 더하고 `nukeExplosionRadius`의 `case UT_MIRV_WARHEAD:` 앞에 `case UT_BOMBER:`를 더한다(폭격은 다탄두 탄두와 같은 크기의 폭발 그림, 요격되면 SAM 폭발 그림).

`src/client/render/gl/passes/BarPass.ts`:
- import를 `import { UT_AIRPORT, UT_MISSILE_SILO, UT_SAM_LAUNCHER } from "../../types";`로 바꾸고 `import { AIRPORT_SORTIE_COOLDOWN_TICKS } from "@openfront/engine-lib/warfare/Warfare";`를 더한다.
- `// Missile readiness (Silo / SAM)` 조건에 공항을 더한다:

```ts
    // Missile readiness (Silo / SAM) and airport sorties
    if (
      unit.unitType === UT_MISSILE_SILO ||
      unit.unitType === UT_SAM_LAUNCHER ||
      unit.unitType === UT_AIRPORT
    ) {
```

- `missileReadiness`의 `const cooldown = …;`을 다음으로 바꾼다:

```ts
    const cooldown =
      unit.unitType === UT_SAM_LAUNCHER
        ? this.config.SAMCooldown()
        : unit.unitType === UT_AIRPORT
          ? AIRPORT_SORTIE_COOLDOWN_TICKS
          : this.config.SiloCooldown();
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/client/render tests/client/graphics tests/ForkAssets.test.ts --run && npm run typecheck`
Expected: 모두 PASS(StructureAtlas의 새 칸·비행기 칸 테스트 포함), typecheck 오류 없음

- [ ] **Step 7: 커밋**

```bash
npx prettier --write src/client/render tests/client/render/gl/StructureAtlas.test.ts CREDITS.md
git add resources/atlases CREDITS.md src/client/render tests/client/render/gl/StructureAtlas.test.ts
git commit -m "feat(warfare): map icons for coastal battery and airport, plane sprites"
```

---
### Task 16: 사거리 원과 포격 구역

**Files:**
- Create: `src/client/render/gl/passes/WarfareRingPass.ts`
- Modify: `src/client/render/gl/Renderer.ts`
- Test: `tests/client/render/gl/WarfareRingPass.test.ts`

**Interfaces:**
- Consumes: Task 1 `COASTAL_BATTERY_RANGE`, `airportRange`, `BARRAGE_RADIUS`; Task 15 `UT_COASTAL_BATTERY`, `UT_AIRPORT`, `UT_COASTAL_BARRAGE`; 기존 range-circle 셰이더(`uCamera`, `uCenter`, `uRadius`, `uColor`)
- Produces:
  - `interface Ring { x: number; y: number; radius: number; color: readonly [number, number, number] }`
  - `structureRings(units, mapW, localPlayerID, allies): Ring[]`, `zoneRings(units, mapW): Ring[]`
  - `class WarfareRingPass` — `setVisible(v)`, `setLocalPlayer(id)`, `setAllies(set)`, `updateStructures(units)`, `updateUnits(units)`, `draw(camera)`, `dispose()`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/render/gl/WarfareRingPass.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  structureRings,
  WarfareRingPass,
  zoneRings,
} from "../../../../src/client/render/gl/passes/WarfareRingPass";
import type { UnitState } from "../../../../src/client/render/types";
import {
  UT_AIRPORT,
  UT_CITY,
  UT_COASTAL_BARRAGE,
  UT_COASTAL_BATTERY,
} from "../../../../src/client/render/types";

const MAP_W = 100;

function unit(
  id: number,
  unitType: string,
  ownerID: number,
  pos: number,
  extra: Partial<UnitState> = {},
): UnitState {
  return {
    id,
    unitType,
    ownerID,
    lastOwnerID: null,
    pos,
    lastPos: pos,
    isActive: true,
    reachedTarget: false,
    retreating: false,
    targetable: true,
    waitTicks: 0,
    markedForDeletion: false,
    health: null,
    underConstruction: false,
    targetUnitId: null,
    targetTile: null,
    troops: 0,
    missileTimerQueue: [],
    level: 1,
    veterancy: 0,
    hasTrainStation: false,
    trainType: null,
    loaded: null,
    constructionStartTick: null,
    samUpgradeStartTick: null,
    samUpgradeStartRange: null,
    samUpgradeTargetLevel: null,
    samUpgradeDuration: null,
    ...extra,
  };
}

function units(...list: UnitState[]): Map<number, UnitState> {
  return new Map(list.map((u) => [u.id, u]));
}

/** A GL stand-in that counts draw calls. */
function countingGL() {
  const counts = { draws: 0 };
  const gl = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop)) return 0;
        if (prop === "drawArrays") return () => counts.draws++;
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
  return { gl, counts };
}

describe("warfare rings", () => {
  it("rings a battery's reach and an airport's range, coloured by owner", () => {
    const rings = structureRings(
      units(
        unit(1, UT_COASTAL_BATTERY, 1, 5 * MAP_W + 7),
        unit(2, UT_AIRPORT, 2, 10, { level: 2 }),
        unit(3, UT_CITY, 1, 20),
        unit(4, UT_AIRPORT, 3, 30, { underConstruction: true }),
      ),
      MAP_W,
      1,
      new Set([2]),
    );
    expect(rings.map((r) => [r.x, r.y, r.radius])).toEqual([
      [7, 5, 40],
      [10, 0, 180],
    ]);
    expect(rings[0].color).not.toEqual(rings[1].color);
  });

  it("rings every barrage zone", () => {
    expect(
      zoneRings(units(unit(9, UT_COASTAL_BARRAGE, 4, 2 * MAP_W + 3)), MAP_W),
    ).toEqual([
      expect.objectContaining({ x: 3, y: 2, radius: 12 }),
    ]);
  });

  it("draws zones always and structure rings only while shown", () => {
    const { gl, counts } = countingGL();
    const pass = new WarfareRingPass(gl, MAP_W);
    pass.updateStructures(units(unit(1, UT_COASTAL_BATTERY, 1, 7)));
    pass.updateUnits(units(unit(9, UT_COASTAL_BARRAGE, 4, 3)));
    pass.draw(new Float32Array(9));
    expect(counts.draws).toBe(1);
    pass.setVisible(true);
    pass.draw(new Float32Array(9));
    expect(counts.draws).toBe(3);
    pass.dispose();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/render/gl/WarfareRingPass.test.ts --run`
Expected: FAIL — `Cannot find module '…/WarfareRingPass'`

- [ ] **Step 3: 패스 작성**

`src/client/render/gl/passes/WarfareRingPass.ts`:

```ts
/**
 * WarfareRingPass — expanded warfare rings (spec §14b): each coastal
 * battery's reach and each airport's range (shown, like SAM rings, while a
 * warfare unit is being placed or its card is open), and every coastal
 * barrage zone (always shown). Reuses the range-circle shaders.
 */

import {
  airportRange,
  BARRAGE_RADIUS,
  COASTAL_BATTERY_RANGE,
} from "@openfront/engine-lib/warfare/Warfare";
import type { UnitState } from "../../types";
import {
  UT_AIRPORT,
  UT_COASTAL_BARRAGE,
  UT_COASTAL_BATTERY,
} from "../../types";
import { createProgram } from "../utils/GlUtils";

import fragSrc from "../shaders/range-circle/range-circle.frag.glsl?raw";
import vertSrc from "../shaders/range-circle/range-circle.vert.glsl?raw";

export interface Ring {
  x: number;
  y: number;
  radius: number;
  color: readonly [number, number, number];
}

const SELF = [0.3, 0.85, 0.45] as const;
const ALLY = [0.95, 0.85, 0.3] as const;
const ENEMY = [0.95, 0.35, 0.3] as const;
const ZONE = [1.0, 0.55, 0.1] as const;

/** Rings of finished coastal batteries and airports. */
export function structureRings(
  units: Map<number, UnitState>,
  mapW: number,
  localPlayerID: number,
  allies: ReadonlySet<number>,
): Ring[] {
  const rings: Ring[] = [];
  for (const u of units.values()) {
    if (!u.isActive || u.underConstruction) continue;
    let radius: number;
    if (u.unitType === UT_COASTAL_BATTERY) {
      radius = COASTAL_BATTERY_RANGE;
    } else if (u.unitType === UT_AIRPORT) {
      radius = airportRange(u.level);
    } else {
      continue;
    }
    const x = u.pos % mapW;
    rings.push({
      x,
      y: (u.pos - x) / mapW,
      radius,
      color:
        u.ownerID === localPlayerID
          ? SELF
          : allies.has(u.ownerID)
            ? ALLY
            : ENEMY,
    });
  }
  return rings;
}

/** Barrage zones: the aimed tile of every salvo in flight or holding its zone. */
export function zoneRings(units: Map<number, UnitState>, mapW: number): Ring[] {
  const rings: Ring[] = [];
  for (const u of units.values()) {
    if (!u.isActive || u.unitType !== UT_COASTAL_BARRAGE) continue;
    const x = u.pos % mapW;
    rings.push({ x, y: (u.pos - x) / mapW, radius: BARRAGE_RADIUS, color: ZONE });
  }
  return rings;
}

export class WarfareRingPass {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;

  private uCamera: WebGLUniformLocation;
  private uCenter: WebGLUniformLocation;
  private uRadius: WebGLUniformLocation;
  private uColor: WebGLUniformLocation;

  private visible = false;
  private localPlayerID = 0;
  private allies: ReadonlySet<number> = new Set();
  private lastStructures: Map<number, UnitState> | null = null;
  private structures: Ring[] = [];
  private zones: Ring[] = [];

  constructor(
    gl: WebGL2RenderingContext,
    private mapW: number,
  ) {
    this.gl = gl;
    this.program = createProgram(gl, vertSrc, fragSrc, "WarfareRingPass");
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uCenter = gl.getUniformLocation(this.program, "uCenter")!;
    this.uRadius = gl.getUniformLocation(this.program, "uRadius")!;
    this.uColor = gl.getUniformLocation(this.program, "uColor")!;

    // Unit quad [0,1]
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    this.quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
  }

  setLocalPlayer(id: number): void {
    this.localPlayerID = id;
    this.rebuild();
  }

  setAllies(allies: ReadonlySet<number>): void {
    this.allies = allies;
    this.rebuild();
  }

  updateStructures(units: Map<number, UnitState>): void {
    this.lastStructures = units;
    this.rebuild();
  }

  updateUnits(units: Map<number, UnitState>): void {
    this.zones = zoneRings(units, this.mapW);
  }

  private rebuild(): void {
    this.structures =
      this.lastStructures === null
        ? []
        : structureRings(
            this.lastStructures,
            this.mapW,
            this.localPlayerID,
            this.allies,
          );
  }

  draw(cameraMatrix: Float32Array): void {
    const rings = this.visible ? [...this.structures, ...this.zones] : this.zones;
    if (rings.length === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.bindVertexArray(this.vao);
    for (const ring of rings) {
      gl.uniform2f(this.uCenter, ring.x, ring.y);
      gl.uniform1f(this.uRadius, ring.radius);
      gl.uniform3f(this.uColor, ring.color[0], ring.color[1], ring.color[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.quadBuf);
  }
}
```

- [ ] **Step 4: 렌더러에 연결**

`src/client/render/gl/Renderer.ts`:
- import 추가: `import { WarfareRingPass } from "./passes/WarfareRingPass";`
- `SAM_RADIUS_HIGHLIGHT_TYPES` 선언 뒤에 추가:

```ts
/** Ghost types that show coastal battery and airport rings (expanded warfare). */
const WARFARE_RING_GHOST_TYPES = new Set([
  "Coastal Battery",
  "Airport",
  "Coastal Barrage",
  "Bomber",
]);

/** Open build-bar cards that show them (highlightTypes in UnitDisplay). */
const WARFARE_RING_HIGHLIGHT_TYPES = new Set(["Coastal Battery", "Airport"]);
```

- 필드 `private victoryProjectPass: VictoryProjectPass;` 뒤에 `private warfareRingPass: WarfareRingPass;`를, `private samHighlightVisible = false;` 뒤에 `private warfareGhostVisible = false;`와 `private warfareHighlightVisible = false;`를 추가한다.
- 생성자의 `this.victoryProjectPass = new VictoryProjectPass(gl);` 뒤에 `this.warfareRingPass = new WarfareRingPass(gl, mapW);`를 추가한다.
- `updateGhostPreview`에서 `this.samRadiusPass.setVisible(this.samGhostVisible || this.samHighlightVisible);` 뒤에 추가:

```ts
    this.warfareGhostVisible =
      data !== null && WARFARE_RING_GHOST_TYPES.has(data.ghostType);
    this.warfareRingPass.setVisible(
      this.warfareGhostVisible || this.warfareHighlightVisible,
    );
```

- `setHighlightStructureTypes`에서 `this.samRadiusPass.setVisible(this.samGhostVisible || this.samHighlightVisible);` 뒤에 추가:

```ts
    this.warfareHighlightVisible =
      unitTypes !== null &&
      unitTypes.some((t) => WARFARE_RING_HIGHLIGHT_TYPES.has(t));
    this.warfareRingPass.setVisible(
      this.warfareGhostVisible || this.warfareHighlightVisible,
    );
```

- `setLocalPlayerID`의 `this.samRadiusPass.setLocalPlayer(id);` 뒤에 `this.warfareRingPass.setLocalPlayer(id);`를 추가한다.
- `updateNames`의 `this.samRadiusPass.setAllies(friendly);` 뒤에 `this.warfareRingPass.setAllies(friendly);`를 추가한다.
- `updateUnits`의 `this.samRadiusPass.setTick(gameTick);` 뒤에 `this.warfareRingPass.updateUnits(units);`를 추가한다.
- `updateStructures`의 `this.samRadiusPass.updateStructures(units);` 뒤에 `this.warfareRingPass.updateStructures(units);`를 추가한다.
- 그리기 순서에서 `this.victoryProjectPass.draw(cam);` 뒤에 `this.warfareRingPass.draw(cam);`를 추가한다.
- 정리(`dispose`)의 `this.victoryProjectPass.dispose();` 뒤에 `this.warfareRingPass.dispose();`를 추가한다.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest tests/client/render tests/client/graphics/GameRendererCreate.test.ts --run && npm run typecheck && npm run lint`
Expected: 모두 PASS, typecheck·lint 오류 없음

- [ ] **Step 6: 커밋**

```bash
npx prettier --write src/client/render/gl/passes/WarfareRingPass.ts src/client/render/gl/Renderer.ts tests/client/render/gl/WarfareRingPass.test.ts
git add src/client/render tests/client/render/gl/WarfareRingPass.test.ts
git commit -m "feat(warfare): battery and airport range rings, barrage zones on the map"
```

---
### Task 17: 밸런스 시뮬레이션(옵션 끔/켬, 아시아 출발 국가)

**Files:**
- Create: `scripts/warfare-sim-report.ts`
- Create: `scripts/warfare-sim.ts`
- Modify: `docs/superpowers/specs/2026-10-15-domestic-system-design.md` (§14b "수치 검증"에 결과 기록)
- Test: `tests/warfare/WarfareSimReport.test.ts`

**Interfaces:**
- Consumes: 엔진 전체(Task 1~9), `scripts/domestic-sim-report.ts`의 `formatTable`, `mean`
- Produces:
  - `ASIA_NATIONS: ReadonlySet<string>`, `WARFARE_SIM_TYPES: readonly UnitType[]`
  - `interface RunRecord { seed: number; warfare: boolean; winner: string | null; minutes: number; asiaLand: number; built: Record<string, number> }`
  - `summarizeRuns(runs: readonly RunRecord[]): { label: string; off: string; on: string }[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/warfare/WarfareSimReport.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  RunRecord,
  summarizeRuns,
} from "../../scripts/warfare-sim-report";

function run(
  warfare: boolean,
  winner: string | null,
  minutes: number,
  asiaLand: number,
  built: Record<string, number> = {},
): RunRecord {
  return { seed: 1, warfare, winner, minutes, asiaLand, built };
}

describe("warfare sim report", () => {
  test("compares off and on side by side", () => {
    const rows = summarizeRuns([
      run(false, "China", 20, 0.5),
      run(false, "Brazil", 24, 0.2),
      run(true, "Japan", 28, 0.3, { [UnitType.Airport]: 4 }),
      run(true, null, 30, 0.25),
    ]);
    const get = (label: string) => rows.find((r) => r.label === label)!;
    expect(get("Asia-start wins")).toEqual({
      label: "Asia-start wins",
      off: "1/2",
      on: "1/2",
    });
    expect(get("games won")).toMatchObject({ off: "2/2", on: "1/2" });
    expect(get("game minutes (mean)")).toMatchObject({
      off: "22.0",
      on: "29.0",
    });
    expect(get("Asia-start land at end (mean)")).toMatchObject({
      off: "35.0%",
      on: "27.5%",
    });
    expect(get("Airport built per game")).toMatchObject({
      off: "0.0",
      on: "2.0",
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/warfare/WarfareSimReport.test.ts --run`
Expected: FAIL — `Cannot find module '../../scripts/warfare-sim-report'`

- [ ] **Step 3: 보고 도우미 작성**

`scripts/warfare-sim-report.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { mean } from "./domestic-sim-report";

/** World-map nations that start in Asia (names from resources/maps/world/manifest.json). */
export const ASIA_NATIONS: ReadonlySet<string> = new Set([
  "Russia",
  "Siberia",
  "Mongolia",
  "China",
  "India",
  "Kazakhstan",
  "Iran",
  "Saudi Arabia",
  "Oman",
  "Pakistan",
  "Bhutan",
  "Sri Lanka",
  "Thailand",
  "Philippines",
  "Taiwan",
  "Japan",
  "Indonesia",
]);

/** The units the report counts. */
export const WARFARE_SIM_TYPES: readonly UnitType[] = [
  UnitType.CoastalBattery,
  UnitType.Airport,
  UnitType.CoastalBarrage,
  UnitType.Bomber,
  UnitType.TransportPlane,
  UnitType.CargoPlane,
];

/** One simulated game. */
export interface RunRecord {
  seed: number;
  warfare: boolean;
  /** The winning nation's name; null when the run hit its time limit. */
  winner: string | null;
  /** Game minutes until the win, or the whole run. */
  minutes: number;
  /** Share of the land (0..1) the Asia-start nations held at the end. */
  asiaLand: number;
  /** Units built over the game, by unit type. */
  built: Record<string, number>;
}

export interface SummaryRow {
  label: string;
  off: string;
  on: string;
}

const pct = (v: number | null) => (v === null ? "-" : `${(v * 100).toFixed(1)}%`);
const num = (v: number | null) => (v === null ? "-" : v.toFixed(1));

/** The same measures with the option off and on (spec §14b, "수치 검증"). */
export function summarizeRuns(runs: readonly RunRecord[]): SummaryRow[] {
  const side = (warfare: boolean) => runs.filter((r) => r.warfare === warfare);
  const row = (
    label: string,
    measure: (rs: readonly RunRecord[]) => string,
  ): SummaryRow => ({ label, off: measure(side(false)), on: measure(side(true)) });
  return [
    row("games", (rs) => String(rs.length)),
    row(
      "Asia-start wins",
      (rs) =>
        `${rs.filter((r) => r.winner !== null && ASIA_NATIONS.has(r.winner)).length}/${rs.length}`,
    ),
    row(
      "games won",
      (rs) => `${rs.filter((r) => r.winner !== null).length}/${rs.length}`,
    ),
    row("game minutes (mean)", (rs) => num(mean(rs.map((r) => r.minutes)))),
    row("Asia-start land at end (mean)", (rs) =>
      pct(mean(rs.map((r) => r.asiaLand))),
    ),
    ...WARFARE_SIM_TYPES.map((type) =>
      row(`${type} built per game`, (rs) =>
        num(mean(rs.map((r) => r.built[type] ?? 0))),
      ),
    ),
  ];
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest tests/warfare/WarfareSimReport.test.ts --run`
Expected: PASS

- [ ] **Step 5: 시뮬레이션 스크립트 작성**

`scripts/warfare-sim.ts`:

```ts
/**
 * Expanded warfare balance check (spec §14b, "수치 검증").
 *
 * Plays nations-only games on the world map with warfareExpansion off and
 * on, the same seeds both ways, and prints who won (and whether the winner
 * started in Asia), how long the game took, how much land the Asia-start
 * nations held at the end, and how often each warfare unit was built. It
 * only reports: tune packages/engine-lib/src/warfare/Warfare.ts by hand.
 * Not part of the test suite.
 *
 *   npx tsx scripts/warfare-sim.ts [--seeds 3] [--minutes 30]
 *                                  [--difficulty Hard] [--domestic]
 */
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig, GameStartInfo } from "@openfront/engine-api/Schemas";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { simpleHash } from "@openfront/engine-lib/Util";
import { EngineConfig } from "@openfront/engine/configuration/EngineConfig";
import { Executor } from "@openfront/engine/execution/ExecutionManager";
import { Game } from "@openfront/engine/game/Game";
import { createGame } from "@openfront/engine/game/GameImpl";
import { createNationsForGame } from "@openfront/engine/game/NationCreation";
import { GameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../tests/perf/fullgame/NodeGameMapLoader";
import { formatTable } from "./domestic-sim-report";
import {
  ASIA_NATIONS,
  RunRecord,
  summarizeRuns,
  WARFARE_SIM_TYPES,
} from "./warfare-sim-report";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_SPAWN_TURNS = 1000;
const TICKS_PER_MINUTE = 600;

interface Options {
  seeds: number;
  minutes: number;
  difficulty: Difficulty;
  domestic: boolean;
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
    seeds: 3,
    minutes: 30,
    difficulty: Difficulty.Hard,
    domestic: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${arg}`);
      return v;
    };
    switch (arg) {
      case "--seeds":
        opts.seeds = parseInt(next(), 10);
        break;
      case "--minutes":
        opts.minutes = parseInt(next(), 10);
        break;
      case "--difficulty":
        opts.difficulty = resolveDifficulty(next());
        break;
      case "--domestic":
        opts.domestic = true;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

function asiaLandShare(game: Game): number {
  let tiles = 0;
  for (const p of game.players()) {
    if (p.type() === PlayerType.Nation && ASIA_NATIONS.has(p.name())) {
      tiles += p.numTilesOwned();
    }
  }
  return tiles / game.totalLandTiles();
}

async function runGame(
  opts: Options,
  seed: number,
  warfare: boolean,
): Promise<RunRecord> {
  const gameConfig: GameConfig = {
    gameMap: GameMapType.World,
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
    ...(opts.domestic ? { domesticMode: true } : {}),
    ...(warfare ? { warfareExpansion: true } : {}),
  };
  const gameStart: GameStartInfo = {
    gameID: `warfare-sim-${seed}`,
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
  const result: { error: string | null } = { error: null };
  const runner = new GameRunner(
    game,
    new Executor(game, gameStart.gameID, undefined),
    (gu) => {
      if ("errMsg" in gu) result.error = `${gu.errMsg}\n${gu.stack ?? ""}`;
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
  const start = game.ticks();
  while (
    game.ticks() - start < opts.minutes * TICKS_PER_MINUTE &&
    game.getWinner() === null
  ) {
    step();
  }

  const built: Record<string, number> = {};
  for (const type of WARFARE_SIM_TYPES) {
    built[type] = game
      .allPlayers()
      .reduce((n, p) => n + p.unitsConstructed(type), 0);
  }
  const winner = game.getWinner();
  return {
    seed,
    warfare,
    winner: winner === null || typeof winner === "string" ? null : winner.name(),
    minutes: (game.ticks() - start) / TICKS_PER_MINUTE,
    asiaLand: asiaLandShare(game),
    built,
  };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  console.debug = () => {}; // silence per-tick debug logging
  const runs: RunRecord[] = [];
  for (let seed = 1; seed <= opts.seeds; seed++) {
    for (const warfare of [false, true]) {
      console.log(
        `\n=== seed ${seed}/${opts.seeds}: world, ${opts.difficulty}, warfare ${warfare ? "on" : "off"}${opts.domestic ? ", domestic" : ""}, ${opts.minutes} min ===`,
      );
      const run = await runGame(opts, seed, warfare);
      runs.push(run);
      const asian = run.winner !== null && ASIA_NATIONS.has(run.winner);
      console.log(
        `winner: ${run.winner ?? "none"}${asian ? " (Asia)" : ""} at ${run.minutes.toFixed(1)} min; Asia-start land ${(run.asiaLand * 100).toFixed(1)}%`,
      );
      console.log(
        WARFARE_SIM_TYPES.map((t) => `${t}: ${run.built[t]}`).join(", "),
      );
    }
  }
  console.log(`\n=== warfare off vs on, ${opts.seeds} seed(s) ===`);
  console.log(
    formatTable(
      ["measure", "off", "on"],
      summarizeRuns(runs).map((r) => [r.label, r.off, r.on]),
    ),
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 6: 짧게 돌려 보기**

Run: `npx tsx scripts/warfare-sim.ts --seeds 1 --minutes 3`
Expected: 오류 없이 두 판(off, on)과 비교 표가 나온다. 3분 안에는 공항이 없을 수 있다(0이어도 된다).

- [ ] **Step 7: 커밋**

```bash
npx prettier --write scripts/warfare-sim.ts scripts/warfare-sim-report.ts tests/warfare/WarfareSimReport.test.ts
git add scripts/warfare-sim.ts scripts/warfare-sim-report.ts tests/warfare/WarfareSimReport.test.ts
git commit -m "feat(warfare): world-map balance simulation, option off vs on"
```

- [ ] **Step 8: 전체 시뮬레이션과 기록(수치는 바꾸지 않는다)**

Run: `npx tsx scripts/warfare-sim.ts --seeds 3 --minutes 30 | tee /tmp/warfare-sim.txt` 그리고 `npx tsx scripts/warfare-sim.ts --seeds 3 --minutes 30 --domestic | tee /tmp/warfare-sim-domestic.txt`
Expected: 두 실행 모두 끝까지 오류 없이 돈다(한 판에 몇 분, 전부 30~60분 걸릴 수 있다).

`docs/superpowers/specs/2026-10-15-domestic-system-design.md` §14b의 "수치 검증" 항목 바로 뒤에 결과를 한 단락으로 적는다(형식은 §11.2의 "2026-10-15 조정 뒤 시뮬레이션" 단락과 같다). 예:

```markdown
  - 2026-10-16 첫 시뮬레이션(월드 맵, 어려움, AI만, 3시드, 30분; 일반 모드 / 내정 모드): 아시아 출발 국가 승리 끔 a/3 → 켬 b/3, 평균 게임 시간 끔 c분 → 켬 d분, 끝날 때 아시아 출발 국가 땅 끔 e% → 켬 f%. 한 판에 지은 수(켬): 해안 포대 g, 공항 h, 포격 i, 폭격 j, 공수 k, 화물기 l. 수치는 바꾸지 않았다. 사람이 하는 판에서 다시 확인한다.
```

`a`~`l`은 출력 표의 실제 값으로 채운다. 그다음 커밋:

```bash
git add docs/superpowers/specs/2026-10-15-domestic-system-design.md
git commit -m "docs(warfare): first balance simulation results"
```

---

### Task 18: 전체 검증과 실제 화면 확인

**Files:** 없음(문제가 나오면 해당 Task의 파일을 고친다). 확인용 파일 `/tmp/warfare-check/vite.warfare.config.ts`와 저장소 루트의 `warfare-check.mjs`는 커밋하지 않는다(`warfare-check.mjs`는 Playwright를 찾으려면 저장소 안에 있어야 한다).

- [ ] **Step 1: 전체 테스트, 타입, 린트, 결정성 검사**

```bash
npm test 2>&1 | tail -15
npm run typecheck
npm run lint
grep -rnE "Math\.(random|pow|exp|log|sin|cos|tan|atan2)|Date\.now|new Date" packages/engine/src/warfare packages/engine-lib/src/warfare packages/engine/src/execution/nation/NationWarfareBehavior.ts
git diff 843dc8a20 --stat
```

Expected: 모든 테스트 PASS(`tests/VanillaDigest.test.ts` 3 tests, `tests/NationGoldPerMinute.test.ts` 스냅샷, `tests/core/snapshot/FullGameSnapshot.test.ts` 6개 변형 포함), typecheck·lint 오류 없음, `grep` 출력 없음.

- [ ] **Step 2: 별도 포트(9300)의 Vite 클라이언트로 실제 화면 확인(자동)**

실제 서버가 3000~3002와 9000을 쓰고 있다. 이 확인은 **그 포트를 열지도, 그 서버에 요청하지도 않는다.** 혼자 하기 게임은 브라우저 안에서 돌므로 Vite 클라이언트만 있으면 된다.

```bash
ss -ltn | grep -E ':(9300|9301) ' && echo "port busy: pick another and change BASE below" || echo free
mkdir -p /tmp/warfare-check
cat > /tmp/warfare-check/vite.warfare.config.ts <<'EOF'
// The worktree's dev config on port 9300, with every route to ports
// 3000-3002 (the owner's running server) pointed at a closed port and the
// create-game middleware (which POSTs straight to 3001+) dropped.
import type { UserConfig } from "vite";
import base from "/home/eser/dev/OpenFrontIO-war/vite.config.ts";

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
    port: 9300,
    strictPort: true,
    open: false,
    hmr: { port: 9301 },
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
(cd /home/eser/dev/OpenFrontIO-war && SKIP_BROWSER_OPEN=true npx vite --config /tmp/warfare-check/vite.warfare.config.ts > /tmp/warfare-check/vite.log 2>&1 &)
timeout 120 bash -c 'until curl -sf http://localhost:9300 >/dev/null; do sleep 1; done' && echo up
```

`run-openfront` 스킬의 Playwright 준비(`bash .claude/skills/run-openfront/setup.sh`, 이미 했으면 생략)를 마친 뒤 저장소 루트에 `warfare-check.mjs`를 만든다:

```js
// Expanded warfare smoke check against the Vite client on :9300 only.
// Nothing may reach the owner's server on 3000-3002 or 9000.
import fs from "node:fs";
import { launch } from "./.claude/skills/run-openfront/driver.mjs";
import {
  clickWorld,
  spawn,
  waitForGameReady,
  waitForSpawnPhaseEnd,
} from "./.claude/skills/run-openfront/game.mjs";

const BASE = "http://localhost:9300";
const OUT = "/tmp/warfare-check/shots";
const RAF = 2500;
const viewport = { width: 1180, height: 820 };
fs.mkdirSync(OUT, { recursive: true });

const { browser } = await launch({ viewport, rafIntervalMs: RAF });
const context = await browser.newContext({ viewport, locale: "ko-KR" });
await context.addInitScript(() => localStorage.setItem("lang", "ko"));
await context.addInitScript((interval) => {
  let last = 0;
  window.requestAnimationFrame = (cb) => {
    const now = performance.now();
    const wait = Math.max(0, interval - (now - last));
    return setTimeout(() => {
      last = performance.now();
      cb(last);
    }, wait);
  };
  window.cancelAnimationFrame = (id) => clearTimeout(id);
}, RAF);
await context.addInitScript(() => {
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    if (type === "webgl2" && attrs) {
      attrs = { ...attrs, failIfMajorPerformanceCaveat: false };
    }
    return getContext.call(this, type, attrs);
  };
});
await context.route(/^https?:\/\/(localhost|127\.0\.0\.1):(300[0-2]|9000)\b/, (r) =>
  r.abort(),
);
await context.route("**/selfhost-api/**", (r) =>
  r.fulfill({ status: 404, contentType: "application/json", body: "{}" }),
);
await context.route("**/api/**", (r) =>
  r.fulfill({ status: 404, contentType: "application/json", body: "{}" }),
);
await context.routeWebSocket(/\/(lobbies|w\d+)(\/|\?|$)/, () => {});

const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
await page.goto(BASE, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(3000);
await page.locator("button:visible", { hasText: /혼자 하기/ }).first().click();
await page.waitForTimeout(1500);
const modalText = await page.evaluate(
  () => document.querySelector("single-player-modal")?.textContent ?? "",
);
await page.screenshot({ path: `${OUT}/1-solo-modal.png` });
await page.evaluate(() => {
  const modal = document.querySelector("single-player-modal");
  modal.warfareExpansion = true;
  modal.instantBuild = true;
  modal.infiniteGold = true;
  modal.bots = 20;
});
await page.waitForTimeout(300);
await page
  .locator('o-button[translationKey="game_settings.start"] button:visible')
  .first()
  .click();
await waitForGameReady(page);
const home = await spawn(page);
await waitForSpawnPhaseEnd(page);
await page.waitForTimeout(4000 + RAF);

const bar = await page.evaluate(() => {
  const keys = ["coastal_battery", "airport", "coastal_barrage", "bomber"];
  return {
    present: keys.filter(
      (k) => document.querySelector(`[data-hotbar="${k}"]`) !== null,
    ),
    small: [...document.querySelectorAll("[data-hotbar]")]
      .map((b) => b.getBoundingClientRect())
      .filter((r) => r.width < 44 || r.height < 44).length,
    horizontalScroll:
      document.documentElement.scrollWidth > window.innerWidth,
  };
});
await page.screenshot({ path: `${OUT}/2-hud.png` });

// Airport on the spawn tile with the mouse: card, build mode, click.
await page.locator('[data-hotbar="airport"]').click();
await page.waitForTimeout(500 + RAF);
await page.locator('[data-hotbar="airport"]').click();
await page.waitForTimeout(500 + RAF);
await clickWorld(page, home.x, home.y);
await page.waitForTimeout(3000 + RAF);
await page.screenshot({ path: `${OUT}/3-airport.png` });
const airports = await page.evaluate(
  () =>
    document.querySelector("build-menu").game.myPlayer().units("Airport")
      .length,
);

const report = {
  toggleShown: modalText.includes("확장 전쟁"),
  bar,
  airports,
  errors,
};
console.log(JSON.stringify(report, null, 2));
await browser.close();
const ok =
  report.toggleShown &&
  bar.present.length === 4 &&
  bar.small === 0 &&
  !bar.horizontalScroll &&
  airports >= 1;
process.exit(ok ? 0 : 1);
```

Run: `node warfare-check.mjs`
Expected: JSON에 `toggleShown: true`, `bar.present` 4개, `bar.small: 0`, `horizontalScroll: false`, `airports: 1` 이상, 종료 코드 0. 스크린샷 `/tmp/warfare-check/shots/*.png` 3장을 열어 확인한다: 혼자 하기 설정에 "확장 전쟁" 토글이 있다, 단축바에 해안 포대·공항(건물 칸)과 해안 포격·폭격기(핵 옆)가 보인다, 지도에 공항 아이콘(칠각형 틀 안의 비행기)이 보인다.

정리:

```bash
pkill -f "vite --config /tmp/warfare-check/vite.warfare.config.ts"
rm warfare-check.mjs
ss -ltn | grep -E ':(9300|9301) ' || echo "9300 closed"
git status --short
```

Expected: `git status`가 깨끗하다(`warfare-check.mjs`가 지워졌다). 이 호스트에서 Playwright가 동작하지 않으면 이 Step은 건너뛰고 어느 쪽인지 기록한 뒤, 아래 Step 3을 주인에게 넘긴다.

- [ ] **Step 3: 주인이 실제 태블릿으로 확인할 목록**

자동 확인은 터치, 상대 국가, 여러 사람을 흉내 내지 않는다. 주인이 자기 서버(평소처럼 실행)에서 방을 만들어 확인한다:
1. 방 만들기와 혼자 하기의 설정에 "확장 전쟁" 토글이 있고, 참가 화면 설정 요약에 "확장 전쟁: 켜짐"이 보인다. 끈 판에서는 새 유닛이 단축바·건설 메뉴·원형 메뉴 어디에도 없다.
2. 해안 포대: 단축바 두 번 탭 → 해안을 탭(조준, 반경 40 원) → 아이콘 다시 탭으로 지어진다. 적 수송선이 오면 한 발에 가라앉고, 무역선은 쏘지 않는다.
3. 해안 포격: 핵 옆 칸 → 적 해안을 조준하면 사일로에서 그 칸까지 직선과 반경 12 원이 보이고, 확정하면 포탄 8발이 4초 동안 떨어지며 조준한 해안 포대가 사라진다. 그 뒤 20초 동안 그곳에 주황 원이 남고, 그 사이 상륙·공격이 방어 기지 효과 없이 덜 잃는다.
4. 공항(60초 건설) → 원형 메뉴(바다 건너 적 땅 탭 → 공격 → 공수 투입)로 수송기가 날아가 착지 지점 주변을 차지하고 공격한다. 적 SAM이 있으면 격추되고 "수송기이(가) 격추되었습니다" 알림이 뜬다.
5. 폭격: 폭격기 칸 → 적 건물을 조준하면 공항에서 직선 궤적과 반경 18 원, 적 SAM 사거리 원이 보이고, 궤적이 SAM 원에 들어가는 지점부터 색이 바뀐다. 폭격 뒤 낙진(초록 얼룩)이 없다.
6. 상대 공항이 서로 범위 안이면 30초마다 화물기가 오가고 금이 늘어난다. 금수 조치를 하면 멈춘다.
7. 내정 모드와 함께 켠 판: 해안 포대는 요새 축성, 해안 포격은 로켓 공학, 공항·폭격·공수 투입은 산업화 전에는 자물쇠와 기술 이름이 보인다.
8. 단축바가 16칸(두 옵션 모두)일 때 두 줄로 접히고, 모든 버튼이 손가락으로 누르기 쉽다.

- [ ] **Step 4: 마무리 커밋(수정이 있었다면)**

```bash
git status --short
git add -A
git commit -m "fix(warfare): issues found in expanded warfare verification"
```

수정이 없었다면 이 단계는 건너뛴다.
