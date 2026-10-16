# 전략 무기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로비 옵션 하나(`strategicWeapons`, 기본 꺼짐)로 핵 제조·비축, 일반 미사일, 궤도 포격 위성(요격 포함)을 켜고, 원작·내정 모드·확장 전쟁 어느 조합에서도 AI·화면·번역까지 갖춘다.

**Architecture:** 수치와 순수 규칙(제조 시간, 공장 라인 고르기, 표적 고르기, 요격 확률, 포격 반경)은 `packages/engine-lib/src/strategic/Strategic.ts`에 두고 엔진과 화면이 같이 쓴다. 나라별 상태(비축량, 제조 라인, 위성)는 `PlayerStrategic`(옵션을 켰을 때만 만든다)에 두고 `PlayerUpdate.strategic`으로 모두에게 보낸다. 게임 전체 시계 `StrategicExecution` 하나가 매 틱 제조 완료·라인 상실·위성 단계를 처리하고, 명령은 한 번만 도는 Execution(`produce_nuke`, `satellite_target`, `intercept_satellite`)과 기존 `build_unit`(일반 미사일, 위성 준비)으로 들어온다. 옵션이 꺼지면 `player.strategic()`이 null이고 `isUnitDisabled`가 새 유닛을 막으므로 새 코드는 아무것도 읽거나 굴리지 않는다(`tests/VanillaDigest.test.ts`).

**Tech Stack:** TypeScript 6, Vitest 4, zod + zbin, Lit + Tailwind 4, WebGL2, jq, Python 3 + Pillow(유닛 그림 칸)

**Spec:** `docs/superpowers/specs/2026-10-16-strategic-weapons-design.md` (커밋 `758c9f5ff`: 일반 미사일 50만, 원자폭탄도 4%로 위성 요격). spec에서 *(내 판단)*으로 표시한 항목은 모두 확정 사항이며 그대로 구현한다. spec이 설계자에게 맡긴 것(§10)은 아래 "결정 사항"이 정한다.

---

## 시작 전에 (환경)

- 작업 위치는 git worktree `/home/eser/dev/OpenFrontIO-strat`(브랜치 `strategic-weapons`, 시작 커밋 `758c9f5ff`)다. 내정 모드, 확장 전쟁, 태블릿 UI가 모두 들어 있다.
- **`/home/eser/dev/OpenFrontIO`에는 손대지 않는다.** 그 checkout에서 실제 서버가 3000~3002와 9000 포트로 돌고 있다. 이 계획의 어떤 명령도 그 포트를 열거나 그 서버에 요청하지 않는다(화면 확인은 Task 14의 포트 9300).
- 의존성이 없으면 `npm ci --ignore-scripts --engine-strict=false`로 설치한다(`npm install` 금지).
- 단일 테스트: `npx vitest tests/strategic/<File>.test.ts --run`
- 커밋 전에 바꾼 파일에 `npx prettier --write <files>`를 실행한다.
- `tests/core/snapshot/FullGameSnapshot.test.ts`는 변형마다 월드 맵 1,500틱을 돌려서 느리다. Task 2~5에서는 `-t "free for all"`로 FFA 변형만 돌린다.
- 병렬 갈래(아래 "병렬 실행 그룹")는 Task 1을 커밋한 뒤 갈래마다 `git worktree add ../OpenFrontIO-strat-<갈래> -b strategic-<갈래> strategic-weapons`로 따로 만들고, 끝나면 `strategic-weapons`에서 `git merge --no-ff strategic-<갈래>`로 합친다. 각 갈래는 자기 Task의 **Files**에 적힌 파일만 고치므로 합칠 때 충돌이 없다.

## 결정 사항 (spec이 설계자에게 맡겼거나 spec 밖의 것)

1. **옵션:** `GameConfig.strategicWeapons?: boolean`(기본 꺼짐) 하나가 전부를 켠다. `warfareExpansion`과 독립이다. 꺼져 있으면 `UnitType.ConventionalMissile`·`UnitType.Satellite`는 `Config.isUnitDisabled`로 막히고, 어떤 플레이어도 `PlayerStrategic`을 갖지 않는다.
2. **나라별 상태:** `PlayerStrategic`(옵션을 켰을 때 모든 플레이어 종류에 만든다)이 비축량(원자·수소·다탄두), 제조 라인 목록, 위성 상태를 가진다. 플레이어 스냅샷에 optional 키 `strategic`으로 저장하고, `PlayerUpdate.strategic`(캐시된 `StrategicData`, 바뀔 때만 새 객체)으로 모든 클라이언트에 보낸다. 비축량은 공개 정보다.
3. **발사:** `unitInfo(핵).cost`는 지금 가격(제조 가격) 그대로다. 옵션을 켜면 원자폭탄·수소폭탄·다탄두는 `canBuild`가 금 대신 **보유량 ≥ 1**을 요구하고, `PlayerImpl.buildUnit`이 돈을 받지 않고 보유량에서 1을 뺀다. 다탄두 탄두(`MIRVWarhead`)는 비축 대상이 아니다. 발사대 고르기·재장전은 그대로다.
4. **제조:** 새 명령 `produce_nuke {nukeType}`. 공장은 엔진이 고른다: 빈 라인이 가장 많은 다 지은 공장, 같으면 id가 작은 쪽(`factoryWithFreeLine`). 라인 수 = 공장 레벨. 시작할 때 `unitInfo(핵).cost`(내정 `nukeCost`·무한 금 포함)를 낸다. 시간은 원자 200틱, 수소 400틱, 다탄두 600틱. 잠기거나 꺼진 핵은 제조할 수 없다. 제조에는 발사대가 필요 없다. 다탄두는 제조를 **시작할 때** `recordMirvLaunch()`를 부르고(취소돼도 센다) 쏠 때는 부르지 않는다. 태블릿에서 지도를 탭할 필요가 없도록 단축바 핵 카드의 "제조" 버튼 한 번으로 보낸다.
5. **제조 상실:** `StrategicExecution`이 매 틱 공장이 없어졌거나 주인이 바뀐 라인을 지운다. 일반 미사일은 맞히는 순간 그 공장의 라인을 지운 뒤 레벨을 깎는다. 어느 경우든 돈은 돌려주지 않고, 모두에게 `events_display.nuke_production_lost`를 알린다.
6. **일반 미사일:** `UnitType.ConventionalMissile`, `build_unit`으로 쏜다. 표적은 조준한 칸에서 10칸(유클리드) 안의, 자기·동맹·팀원(연결 끊긴 쪽 포함, `isFriendly(owner, true)`)이 아닌 건물(`Structures`, 짓는 중 포함) 중 가장 가까운 것(같으면 id가 작은 것, `pickNearestWithin`). 핵처럼 가장 가까운(맨해튼) 장전된 발사대에서 거리 제한 없이 핵의 포물선으로 날아가고(속도 12, TestConfig는 4), 궤적의 요격 가능 구간도 핵과 같다. SAM의 목표 목록에 더해진다(옵션 켬일 때만). 맞으면 그 건물이 `decreaseLevel(쏜 나라)`로 레벨 1을 잃고(레벨 1이면 파괴), 공장이면 제조 라인이 모두 사라진다. 비행 중 그 건물이 쏜 나라나 우호국 것이 되면 아무 일도 없다. 폭발·낙진·동맹 파기·"공격 중" 판정이 없고, 비행 중에는 핵 폭발에 지워지지 않는다(핵 미사일과 같다). 비용 50만(+`nukeCost`).
7. **위성 준비:** `UnitType.Satellite`는 지도 유닛을 만들지 않는 유닛 종류다(단축바·두 번 탭 흐름·자물쇠·가격을 그대로 쓰려고 둔다). `build_unit Satellite`의 조준점에서 15칸 안의 자기 장전된 발사대(가장 가까운 것)에서 준비를 시작한다. 비용 2,500만(+`nukeCost`), 준비 900틱. 내정 모드는 `space_program` 기술이 연다(`Techs.ts`의 `unlocks`). 준비하는 동안 `UnitImpl.isInCooldown()`이 그 발사대 칸 하나를 찬 것으로 본다. 발사대가 없어지거나 주인이 바뀌면 실패하고(`phase: "none"`, 다시 시도 가능), 궤도에 오른 뒤에는 다시 준비할 수 없다.
8. **목표 지정:** 새 명령 `satellite_target {target}`. 궤도에서 기다리는 시간은 제한이 없다. 목표는 살아 있는 다른 나라 중 동맹·팀원이 아닌 곳(부족 포함, 시작 보호 시간에는 불가). 지정하면 600틱 뒤 포격이고, 목표의 쏜 나라에 대한 관계가 −100이 된다.
9. **요격:** 새 명령 `intercept_satellite {attacker, nukeType}`(`nukeType`은 수소폭탄·원자폭탄만, 스키마가 다탄두를 막는다). 쏜 나라를 뺀 누구나, 비축 1발과 어디든 장전된 발사대 하나(유닛 순서상 첫 번째, 칸 하나 사용)로 `strikeTick` 전까지 쏠 수 있다. 요격탄은 30틱 날아간 뒤 판정한다: `new PseudoRandom(tick*7919 + 위성주인 smallID*104729 + 쏜나라 smallID*131 + 같은틱순번).chance(odds)`, odds는 수소 5(20%), 원자 25(4%). **포격은 날아가는 요격탄이 모두 판정될 때까지 기다린다** — 마지막 틱에 쏜 요격탄도 포격 전에 판정된다(spec §6.3의 공정성). 한 발이라도 맞으면 위성은 격추되어 다시 만들 수 없고(`phase: "spent"`), 아직 날아가는 요격탄은 그대로 버려진다. 명중·빗나감은 모두에게 알린다.
10. **포격:** `strikeTick` 이후 날아가는 요격탄이 없으면 떨어진다. 그때 목표가 죽었거나 우호국이 되었으면 취소되고 위성은 궤도로 돌아간다(쏜 나라에게만 알림). 쏜 나라가 죽어도 지정된 포격은 떨어진다. 효과(`orbitalStrike`): 목표의 모든 건물(`Structures`, 확장 전쟁·내정 건물 포함)을 쏜 나라가 파괴, 병력 `floor(70%)` 감소, 각 건물 자리 반경 3칸 원 + 흩어진 크레이터(반경 `clamp(floor(√땅/6), 3, 10)`, 시드 PRNG로 목표 땅 중 무작위 중심)가 땅의 30% 이상을 더 덮을 때까지 — 모두 **목표 땅만** — 주인을 없애고 바다로 바꾼다(`waterNukes`가 꺼져 있어도, `queueWaterConversion(tile, true)`). 지도 층 파괴를 위해 `queueNukeImpact`도 부른다. SAM은 막지 못하고 비축량은 그대로다. 화면 연출용으로 `GameUpdateType.OrbitalStrike {attackerID, targetID, impacts}`를 보낸다(크레이터 중심, 그다음 건물 자리 — 화면은 앞의 16곳에만 빛줄기를 그린다).
11. **알림:** 새 `MessageType`은 만들지 않는다. 키와 종류는 Task 8 표 그대로다. 문구에 들어가는 다른 나라 이름은 `targetID`(smallID)도 같이 보내 클라이언트가 익명 이름 설정으로 다시 고친다.
12. **AI(`NationStrategicBehavior`, 별도 PRNG, 옵션 켬일 때만 만든다, 국가의 공격 틱마다):** 위성 포격의 목표가 되었으면 모든 난이도에서 빈 발사대 칸만큼 수소폭탄부터, 다음 원자폭탄으로 요격한다. 승리 프로젝트를 위해 금을 모으는 동안(`nationHoldsStructuresForProject`)은 그 밖의 것을 하지 않는다. 발사대가 있고 빈 라인이 있으면 제조한다: 다탄두(보유+제조 0, 금 ≥ 다탄두+수소), 수소폭탄(보유+제조 < 2, 금 ≥ 수소×2), 원자폭탄(보유+제조 < 3, 금 ≥ 원자+100만). 쉬움은 3번에 1번만 제조한다. 어려움 이상은 우호국이 아닌 나라가 제조 중인 공장에 일반 미사일을 쏘고(공장마다 150틱에 한 발, 틱마다 한 발), 금이 위성값+1,500만 이상이면 첫 장전된 발사대에서 위성을 준비하고, 궤도에 오르면 부족이 아닌 우호국 아닌 나라 중 땅이 가장 큰 곳을 목표로 고른다. `NationNukeBehavior`는 옵션을 켜면 금 대신 보유량으로 쏠 종류를 고르고(수소 먼저), 다탄두 저축과 불가능 난이도의 SAM 소진 일제 사격을 하지 않는다. `NationMIRVBehavior`는 금 대신 다탄두 보유량을 본다.
13. **화면:** 단축바는 다탄두 뒤에 일반 미사일·위성(단축키 없음). 원자·수소·다탄두 버튼에 보유량 배지(`data-stock`). 핵 카드에 보유·제조 중 수, 제조 가격, "제조" 버튼(한 번 탭, 지도 조작이 아니므로), 못 할 때의 이유. 건설 메뉴(`BuildMenu`)와 원형 메뉴는 일반 미사일만 더한다(위성은 단축바 전용). 옵션을 켜면 핵 묶음 발사(x2/x5)는 끈다. 위쪽 띠(`<satellite-band>`)는 화면 위 가운데, 카운트다운마다 한 줄(누가 누구를, 남은 초, 진행 막대, 날아가는 요격탄 수, 수소·원자 요격 버튼 — 두 번 탭으로 발사)과 위성 주인이 궤도에서 기다릴 때 "목표 나라 고르기" 줄. 목표 고르기는 모달(`<satellite-target-picker>`, 44px 줄, 두 번 탭으로 확정, 사람·국가만). 순위표에 "핵" 칸(합계, 숨길 수 없음, 옵션 켬일 때만). 일반 미사일·위성 조준 미리보기는 기존 두 번 탭 흐름 그대로이고, 맞힐 건물·고른 발사대에 반경 4 원을 그린다(일반 미사일은 핵 포물선과 SAM 위협도 보인다). 옵션을 켜면 핵 조준의 금 표시는 숨기고 보유량으로 "살 수 있음"을 정한다.
14. **연출:** 공장(가장 많이 진행된 제조)·준비 중인 발사대의 진행은 기존 건물 진행 막대 자리(아이콘 아래, 승리 프로젝트와 같은 방식)에 그린다. 일반 미사일은 13px 유닛 그림 15번째 칸, 맞으면 유닛 폭발 그림. 위성 포격은 착탄점마다(포격 하나에 최대 16곳) 1.2초짜리 가는 세로 빛줄기와 원자폭탄 크기 절반의 충격파·핵 폭발 그림. 화면 전체 연출·흔들림·컷신은 없다. 리플레이에는 빛줄기가 없다(땅·건물 변화는 있다).
15. **와이어·스냅샷:** 새 `UnitType` 2개, 인텐트 3개, `GameConfig.strategicWeapons`, `GameUpdateType.OrbitalStrike`는 각 목록 맨 뒤에 붙인다. 새 Execution 5개(`Strategic`, `NukeProduction`, `ConventionalMissile`, `SatelliteTarget`, `SatelliteIntercept`)를 `ExecutionRegistry`에 등록한다. 국가 실행 스냅샷의 새 행동은 optional 키 `strategic`이다.

## Global Constraints

- **옵션 끔 = 지금과 비트 단위로 같음(원작·내정 모드·확장 전쟁 모두):** `strategicWeapons`가 없거나 거짓이면 시뮬레이션이 지금과 같아야 한다. `tests/VanillaDigest.test.ts`의 기존 고정값(`c330352312204618`, `cc52cbbfd8b1a3bc`)과 Task 1이 더하는 명시적 끔 고정값(원작 `c330352312204618`, 내정 `11efe429c80c6e2f`, 확장 전쟁 `312bd4a7c2d2b669`, 둘 다 `795891cc9da8b91f` — `758c9f5ff`에서 잰 값), `FullGameSnapshot.test.ts`의 기존 변형, `tests/NationGoldPerMinute.test.ts` 스냅샷이 그대로 통과해야 한다. 꺼진 게임에서 새 코드는 PRNG를 만들거나 굴리지 않고(국가 공용 PRNG, `ScriptedGame` PRNG 포함) 스냅샷에 새 키를 쓰지 않는다.
- **조합:** 옵션은 `warfareExpansion`과 독립이고 원작·내정 모드·확장 전쟁 어느 조합과도 켤 수 있다. 엔진 Task마다 내정 모드 또는 확장 전쟁과 같이 켠 테스트를 둔다.
- **결정성:** `packages/engine*`에서 `Math.random`, `Date.now`, `new Date`, `Math.pow/exp/log/sin/cos/atan2…`, 2가 아닌 지수의 `**`를 쓰지 않는다(`Math.sqrt/floor/ceil/round/min/max/abs`는 허용). 난수는 시드 고정 `PseudoRandom`만 쓴다. 요격 확률(수소 20%, 원자 4%)과 포격 크레이터도 `PseudoRandom`이다.
- **zbin·와이어는 뒤에만 추가:** 새 `UnitType` 값, 새 인텐트, 새 `GameConfig` 필드, 새 `GameUpdateType`은 각 목록의 맨 뒤에 붙인다. `strategicWeapons`는 optional이다. 새 `MessageType` 값은 만들지 않는다.
- **스냅샷:** 새 Execution은 모두 `packages/engine/src/snapshot/ExecutionRegistry.ts`에 이름순으로 등록하고 `snapshot`/`restoreSnapshot`을 갖는다. `restoreSnapshot`은 프로토타입만 있는 객체를 채우므로 모든 필드를 직접 대입한다. 새 스냅샷 키는 optional이고 값이 없으면 쓰지 않는다.
- **패키지 경계(`tests/LayerBoundaries.test.ts`):** `engine-api`는 zod/zbin/resources만, `engine-lib`는 여기에 `engine-api`, `engine`은 여기에 `engine-lib`. `src/client`는 `engine`을 import하지 않는다. 홈 화면 청크·`LazyModals` 규칙을 지킨다(이 계획의 화면 코드는 모두 게임 클라이언트 쪽이다).
- **화면 문구:** 모두 `translateText()`를 거치고 키는 `resources/lang/en.json`(키 정렬 필수)과 `resources/lang/ko.json` 둘 다에 넣는다. 다른 언어 파일은 건드리지 않는다. 알림 문구는 정확히 "(나라이름) 핵무기 개발 중"(`events_display.nuke_production_started` ko = `"{name} 핵무기 개발 중"`).
- **태블릿 우선 UI:** 누르는 요소는 44px 이상(`min-h-11`/`size-11`/`w-11`), 호버로만 보이는 정보 없음(`title` 금지), 지도에 놓거나 쏘는 것은 `BuildPreviewController`의 두 번 탭 확인(조준 → 확인 → 350ms → 아이콘 탭)을 **바꾸지 않고** 그대로 쓴다.
- **연출은 적당히:** 화면 전체를 덮는 연출, 화면 흔들림, 긴 컷신은 없다. 위쪽 띠 하나, 진행 막대, 가는 빛줄기, 기존 핵 폭발 정도만 쓴다.
- **그림:** 새 아이콘(일반 미사일, 위성, 요격)은 `resources/images/*IconWhite.svg`에 기존과 같은 흰 실루엣(24×24 viewBox, `fill="#ffffff"`)으로 둔다. 이동 유닛 그림은 `resources/atlases/unit-atlas.png` 뒤에 13px 회색조 칸으로 붙인다(원래 12칸은 바이트 그대로).
- **엔진 변경에는 테스트가 따른다**(CLAUDE.md). 밸런스 시뮬레이션은 하지 않는다(주인 지시).

## Review Focus

1. **카운트다운 마지막 틱에 쏜 요격탄:** 포격은 그 요격탄이 판정될 때까지 기다려야 하고, 맞으면 포격 없이 위성만 사라져야 한다. 테스트: Task 5 `tests/strategic/SatelliteIntercept.test.ts` "an interceptor fired the tick before the strike is still judged before it lands".
2. **카운트다운 중 목표가 동맹이 되거나 망함:** 포격은 떨어지지 않고 위성은 궤도로 돌아가 다시 고를 수 있어야 한다. 테스트: Task 5 `tests/strategic/OrbitalStrike.test.ts` "a target that turns friendly is spared and the satellite returns to orbit"·"a target eliminated before the strike leaves the satellite in orbit".
3. **포격이 다른 나라와 붙은 땅이나 지도 모서리에 떨어짐:** 목표 땅만 바다가 되고 이웃 땅은 그대로여야 하며 오류가 없어야 한다. 테스트: Task 5 "only the target's land turns to sea, even on a border and in a corner".
4. **제조 라인 두 개가 도는 레벨 2 공장이 일반 미사일을 맞음:** 두 발 모두 사라지고(환불 없음) 레벨 1(라인 1개)로 다시 제조할 수 있어야 한다. 테스트: Task 3 "a hit factory loses both nukes in production and one line".
5. **옵션을 명시적으로 끈 내정·확장 전쟁 게임(`strategicWeapons: false`):** 옵션이 없는 게임과 결과가 같아야 한다. 테스트: Task 1 `tests/VanillaDigest.test.ts`의 명시적 끔 4개.

## 병렬 실행 그룹

- **Task 1**(기반)이 모두의 선행 조건이다. 다른 갈래가 쓰는 타입·키·이름은 Task 1과 Task 8의 **Interfaces**가 정한다.
- **갈래 E (엔진, 차례로): Task 2 → 3 → 4 → 5.** 넷 다 `ExecutionRegistry.ts`, `ExecutionManager.ts`, `ConstructionExecution.ts`, `strategic/` 파일, `FullGameSnapshot.test.ts`의 목록을 고치고, 뒤 Task가 앞 Task의 Execution을 쓴다.
- **갈래 A (AI, 차례로): Task 6 → 7.** 갈래 E가 끝난 뒤에 한다. AI가 갈래 E의 Execution 다섯을 모두 쓰고, Task 7은 `FullGameSnapshot.test.ts`·`ScriptedGame.ts`를 고친다.
- **갈래 T: Task 8(번역).** `resources/lang/*`만 고치므로 Task 1과도 동시에 할 수 있다.
- **갈래 L: Task 9(로비).** Task 1 뒤.
- **갈래 H (화면, 차례로): Task 10 → 11.** Task 11이 Task 10의 `Transport` 이벤트와 아이콘을 쓴다.
- **갈래 R: Task 12(지도 그림).** Task 1 뒤.
- **갈래 P: Task 13(조준 미리보기).** Task 1 뒤.
- Task 1 뒤에는 E, T, L, H, R, P 여섯 갈래를 서로 다른 worktree에서 동시에 할 수 있다(고치는 파일이 겹치지 않는다). A는 E 다음.
- **Task 14**(전체 검증)는 모든 갈래를 합친 뒤 마지막이다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `packages/engine-api/src/strategic/StrategicTypes.ts` (새) | `STOCKPILED_NUKES`, `INTERCEPTOR_NUKES`, `StrategicData`, `SatelliteData` 등 공유 모양 |
| `packages/engine-api/src/game/GameTypes.ts` (수정) | `UnitType` 2개, `BuildableAttacks` |
| `packages/engine-api/src/Schemas.ts` (수정) | `GameConfig.strategicWeapons`, 인텐트 3개 |
| `packages/engine-api/src/game/GameUpdates.ts` (수정) | `PlayerUpdate.strategic`, `GameUpdateType.OrbitalStrike` |
| `packages/engine-lib/src/strategic/Strategic.ts` (새) | 수치와 순수 규칙(엔진·화면 공용) |
| `packages/engine-lib/src/configuration/Config.ts`, `domestic/Techs.ts` (수정) | `strategicWeapons()`, `isUnitDisabled`, `unitInfo`, `space_program` 해금 |
| `packages/engine/src/configuration/EngineConfig.ts` (수정) | 가격, `nukeCost` 보정, 미사일 속도 |
| `packages/engine/src/strategic/PlayerStrategic.ts` (새) | 나라별 비축량·라인·위성 상태와 스냅샷 |
| `packages/engine/src/strategic/Production.ts` (새) | 다 지은 공장 목록, 제조 처리, 상실 알림 |
| `packages/engine/src/strategic/StrategicExecution.ts` (새) | 게임 전체 시계 |
| `packages/engine/src/strategic/NukeProductionExecution.ts` (새) | `produce_nuke` |
| `packages/engine/src/strategic/ConventionalMissileExecution.ts` (새) | 일반 미사일 비행과 명중 |
| `packages/engine/src/strategic/Satellite.ts` (새) | 위성 준비 시작, 단계 처리, 카운트다운 판정 |
| `packages/engine/src/strategic/SatelliteOrders.ts` (새) | `satellite_target`, `intercept_satellite` |
| `packages/engine/src/strategic/Interception.ts` (새) | 요격 명중 판정(시드 PRNG) |
| `packages/engine/src/strategic/OrbitalStrike.ts` (새) | 포격 효과 |
| `packages/engine/src/game/*` (수정) | `Game.ts`, `GameImpl.ts`, `PlayerImpl.ts`, `UnitImpl.ts`, `GameUpdateUtils.ts` |
| `packages/engine/src/execution/*` (수정) | `ConstructionExecution`, `ExecutionManager`, `NukeExecution`, `MIRVExecution`, `SAMLauncherExecution`, `SAMMissileExecution`, `NationExecution` |
| `packages/engine/src/execution/nation/NationStrategicBehavior.ts` (새), `NationNukeBehavior.ts`, `NationMIRVBehavior.ts` (수정) | AI |
| `packages/engine/src/GameRunner.ts`, `snapshot/ExecutionRegistry.ts` (수정) | 시계 추가, 등록 |
| `src/server/ConfigPatch.ts` (수정) | 호스트가 바꿀 수 있는 키 |
| `src/client/view/PlayerView.ts` (수정) | `strategicData()` |
| `src/client/SinglePlayerModal.ts`, `HostLobbyModal.ts`, `utilities/LobbySettingsSummary.ts` (수정) | 로비 토글과 요약 |
| `src/client/hud/HotbarIcons.ts`, `hud/layers/UnitDisplay.ts`, `BuildMenu.ts`, `RadialMenuElements.ts`, `EventsDisplay.ts`, `src/client/Transport.ts` (수정) | 단축바, 건설·원형 메뉴, 알림, 명령 이벤트 |
| `src/client/hud/layers/SatelliteBand.ts`, `SatelliteTargetPicker.ts` (새), `hud/GameRenderer.ts`, `index.html` (수정) | 위쪽 띠와 목표 고르기 |
| `src/client/StatsConstants.ts`, `hud/layers/lib/StatsColumns.ts`, `components/StatsTable.ts`, `hud/layers/GameLeftSidebar.ts` (수정) | 순위표 "핵" 칸 |
| `src/client/render/...`, `src/client/WebGLFrameBuilder.ts` (수정·새) | 진행 막대, 미사일 그림, 빛줄기·폭발 |
| `src/client/controllers/StrategicPreview.ts` (새), `BuildPreviewController.ts` (수정) | 조준 미리보기 |
| `resources/images/*IconWhite.svg` (새), `resources/atlases/*` (수정), `CREDITS.md` | 그림 |
| `resources/lang/en.json`, `ko.json` (수정) | 문구 |
| `tests/strategic/*.test.ts`, `tests/strategic/util.ts` (새), 기존 테스트 일부 (수정) | 테스트 |

---
### Task 1: 옵션, 새 유닛·인텐트·갱신 종류, 공용 규칙, 나라별 비축 상태

**Files:**
- Create: `packages/engine-api/src/strategic/StrategicTypes.ts`
- Modify: `packages/engine-api/src/game/GameTypes.ts` (`UnitType`, `BuildableAttacks`)
- Modify: `packages/engine-api/src/Schemas.ts` (`GameConfigSchema.strategicWeapons`, 인텐트 3개)
- Modify: `packages/engine-api/src/game/GameUpdates.ts` (`GameUpdateType.OrbitalStrike`, `OrbitalStrikeUpdate`, `PlayerUpdate.strategic`)
- Create: `packages/engine-lib/src/strategic/Strategic.ts`
- Modify: `packages/engine-lib/src/configuration/Config.ts`, `packages/engine-lib/src/domestic/Techs.ts`
- Modify: `packages/engine/src/configuration/EngineConfig.ts` (`DOMESTIC_COST_STAT`, `unitCost`)
- Create: `packages/engine/src/strategic/PlayerStrategic.ts`
- Modify: `packages/engine/src/game/Game.ts`, `PlayerImpl.ts`, `UnitImpl.ts` (`isInCooldown`), `GameUpdateUtils.ts`
- Modify: `src/client/view/PlayerView.ts`, `src/server/ConfigPatch.ts`
- Create: `tests/strategic/util.ts`
- Test: `tests/strategic/StrategicOption.test.ts`
- Modify (test): `tests/VanillaDigest.test.ts`, `tests/server/ConfigPatch.test.ts`, `tests/zbin/wire.test.ts`, `tests/domestic/Techs.test.ts`, `tests/util/Snapshot.ts` (`DERIVED_FIELDS`)

**Interfaces:**
- Consumes: `own`, `RED`, `BLUE`, `NATION`(`tests/warfare/util.ts`), `grantTechs`, `grantLaws`(`tests/domestic/util.ts`), `setup`, `expectSnapshotRoundTrip`
- Produces (다른 모든 Task가 쓴다):
  - `UnitType.ConventionalMissile = "Conventional Missile"`, `UnitType.Satellite = "Satellite"`(맨 뒤), 둘 다 `BuildableAttacks`(→ `BuildMenus`, `PlayerBuildable`)에 들어간다
  - `GameConfig.strategicWeapons?: boolean`, `Config.strategicWeapons(): boolean`
  - 인텐트 `{ type: "produce_nuke"; nukeType: StockpiledNuke }`, `{ type: "satellite_target"; target: PlayerID }`, `{ type: "intercept_satellite"; attacker: PlayerID; nukeType: InterceptorNuke }` (타입 `ProduceNukeIntent`, `SatelliteTargetIntent`, `InterceptSatelliteIntent`)
  - `packages/engine-api/src/strategic/StrategicTypes.ts`: `STOCKPILED_NUKES`(원자, 수소, 다탄두), `StockpiledNuke`, `INTERCEPTOR_NUKES`(수소, 원자), `InterceptorNuke`, `NukeJobData {factoryId, type, startTick, endTick}`, `InterceptorData {by, type, resolveTick}`, `SatelliteData`(`none`/`preparing {siloId, startTick, readyTick}`/`orbit`/`targeted {target, strikeTick, interceptors}`/`spent`), `StrategicData {stock, jobs, satellite}`
  - `PlayerUpdate.strategic?: StrategicData`; `GameUpdateType.OrbitalStrike`, `OrbitalStrikeUpdate { attackerID: number; targetID: number; impacts: TileRef[] }`
  - `packages/engine-lib/src/strategic/Strategic.ts`: `STRATEGIC_ONLY_UNITS`, `isStockpiledNuke(type)`, `NUKE_PRODUCTION_TICKS`, `LineFactory`, `factoryWithFreeLine(factories, jobs): number | null`, `stockTotal(data): number`, `CONVENTIONAL_MISSILE_COST`(500,000), `CONVENTIONAL_MISSILE_SPEED`(12), `MISSILE_TARGET_RADIUS`(10), `PickCandidate`, `pickNearestWithin(x, y, radius, candidates)`, `SATELLITE_COST`(25,000,000), `SATELLITE_PREP_TICKS`(900), `SATELLITE_SILO_PICK_RADIUS`(15), `SATELLITE_STRIKE_DELAY_TICKS`(600), `INTERCEPTOR_FLIGHT_TICKS`(30), `INTERCEPT_ODDS`, `interceptHitPct(type)`, `STRIKE_TROOP_LOSS_PCT`(70), `STRIKE_STRUCTURE_RADIUS`(3), `STRIKE_SCATTER_PCT`(30), `strikeCraterRadius(tiles)`, `strikeSecondsLeft(strikeTick, now)`
  - `PlayerStrategic`(`packages/engine/src/strategic/PlayerStrategic.ts`): `stock(type)`, `addStock(type)`, `takeStock(type): boolean`, `jobs()`, `startJob(job)`, `dropJobs(lost): number`, `cancelJobsAt(factoryId): number`, `finishJobs(now): NukeJobData[]`, `satellite()`, `setSatellite(s)`, `addInterceptor(i)`, `holdsSiloSlot(siloId)`, `toData()`, `snapshot()`, `static restore(s)`, `StrategicStateSchema`
  - `Player.strategic(): PlayerStrategic | null`, `Player.missileTarget(tile): Unit | null`; `PlayerImpl.conventionalMissileSpawn(tile)`, `PlayerImpl.satelliteSpawn(tile)`(둘 다 `canBuild`가 부른다)
  - `UnitParamsMap[ConventionalMissile] = { targetTile; trajectory; targetUnit }`, `UnitParamsMap[Satellite] = Record<string, never>`
  - 클라이언트 `PlayerView.strategicData(): StrategicData | null`
  - 테스트 유틸 `tests/strategic/util.ts`: `strategicGame(map, config?, humans?)`, `GREEN`, 그리고 `RED`, `BLUE`, `NATION`, `own` 재수출

- [ ] **Step 1: 끈 옵션의 고정값 테스트 추가(지금도 통과해야 한다)**

`tests/VanillaDigest.test.ts`의 `describe` 안 끝에 추가:

```ts
  test("FFA with the strategic option explicitly off", async () => {
    expect(await digest({ strategicWeapons: false })).toBe("c330352312204618");
  }, 60_000);

  // Domestic mode and expanded warfare, pinned on 758c9f5ff (before strategic
  // weapons): turning the strategic option off must leave both unchanged.
  test("domestic mode with the strategic option explicitly off", async () => {
    expect(
      await digest({ domesticMode: true, strategicWeapons: false }),
    ).toBe("11efe429c80c6e2f");
  }, 60_000);

  test("expanded warfare with the strategic option explicitly off", async () => {
    expect(
      await digest({ warfareExpansion: true, strategicWeapons: false }),
    ).toBe("312bd4a7c2d2b669");
  }, 60_000);

  test("domestic mode and expanded warfare with the strategic option explicitly off", async () => {
    expect(
      await digest({
        domesticMode: true,
        warfareExpansion: true,
        strategicWeapons: false,
      }),
    ).toBe("795891cc9da8b91f");
  }, 60_000);
```

Run: `npx vitest tests/VanillaDigest.test.ts --run`
Expected: 7 tests PASS(아직 엔진이 모르는 키라 무시되므로 지금도 같다. 이 테스트들은 이후 모든 Task의 지킴이다).

- [ ] **Step 2: 테스트 유틸 작성**

`tests/strategic/util.ts`:

```ts
import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { Game } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { BLUE, RED } from "../warfare/util";

export { BLUE, NATION, own, RED } from "../warfare/util";

/** A third human, for "anyone may intercept". */
export const GREEN = new PlayerInfo(
  "green",
  PlayerType.Human,
  null,
  "green_id",
);

/**
 * A test map game with strategic weapons on. Maps (tests/testdata/maps):
 * "plains" 100x100 land, "big_plains" 200x200 land.
 */
export async function strategicGame(
  map: string,
  config: Partial<GameConfig> = {},
  humans: PlayerInfo[] = [RED, BLUE],
): Promise<Game> {
  return setup(map, { strategicWeapons: true, ...config }, humans);
}
```

- [ ] **Step 3: 실패하는 테스트 작성**

`tests/strategic/StrategicOption.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  GameUpdateType,
  PlayerUpdate,
} from "@openfront/engine-api/game/GameUpdates";
import { IntentSchema } from "@openfront/engine-api/Schemas";
import {
  factoryWithFreeLine,
  interceptHitPct,
  isStockpiledNuke,
  pickNearestWithin,
  STRATEGIC_ONLY_UNITS,
  stockTotal,
  strikeCraterRadius,
  strikeSecondsLeft,
} from "@openfront/engine-lib/strategic/Strategic";
import { Game, Player } from "@openfront/engine/game/Game";
import { grantLaws, grantTechs } from "../domestic/util";
import { setup } from "../util/Setup";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { BLUE, own, RED, strategicGame } from "./util";

const cost = (game: Game, player: Player, type: UnitType): bigint =>
  game.unitInfo(type).cost(game, player);

/** Runs one tick and returns `id`'s PlayerUpdate from it. */
function playerUpdate(game: Game, id: string): PlayerUpdate {
  const pu = game
    .executeNextTick()
    [GameUpdateType.Player].find((u) => u.id === id);
  expect(pu).toBeDefined();
  return pu!;
}

// plains: red holds x 0-29, blue x 60-99.
async function sides(on: boolean, config = {}) {
  const game = on
    ? await strategicGame("plains", config)
    : await setup("plains", config, [RED, BLUE]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 60, 0, 40, 100);
  red.addGold(100_000_000n);
  return { game, red, blue };
}

describe("the strategicWeapons option", () => {
  test("off by default: no strategic state, both new units disabled, nukes paid at launch", async () => {
    const { game, red } = await sides(false);
    const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});

    expect(game.config().strategicWeapons()).toBe(false);
    expect(red.strategic()).toBeNull();
    for (const type of STRATEGIC_ONLY_UNITS) {
      expect(game.config().isUnitDisabled(type), type).toBe(true);
    }
    expect("strategic" in playerUpdate(game, RED.id)).toBe(false);
    expect(red.canBuild(UnitType.AtomBomb, game.ref(80, 50))).toBe(
      silo.tile(),
    );
    const gold = red.gold();
    red.buildUnit(UnitType.AtomBomb, silo.tile(), {
      targetTile: game.ref(80, 50),
      trajectory: [],
    });
    expect(red.gold()).toBe(gold - 750_000n);
  });

  test("on: launching takes a nuke from the stockpile instead of gold", async () => {
    const { game, red } = await sides(true);
    const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    const target = game.ref(80, 50);
    const s = red.strategic()!;

    expect(game.config().strategicWeapons()).toBe(true);
    for (const type of STRATEGIC_ONLY_UNITS) {
      expect(game.config().isUnitDisabled(type), type).toBe(false);
    }
    // The price stays the production price; a launch needs stock, not gold.
    expect(cost(game, red, UnitType.AtomBomb)).toBe(750_000n);
    expect(red.canBuild(UnitType.AtomBomb, target)).toBe(false);
    s.addStock(UnitType.AtomBomb);
    expect(red.canBuild(UnitType.AtomBomb, target)).toBe(silo.tile());
    const gold = red.gold();
    red.buildUnit(UnitType.AtomBomb, silo.tile(), {
      targetTile: target,
      trajectory: [],
    });
    expect(red.gold()).toBe(gold);
    expect(s.stock(UnitType.AtomBomb)).toBe(0);
    expect(red.canBuild(UnitType.AtomBomb, target)).toBe(false);
  });

  test("prices: missile 500K, satellite 25M, nukes as before", async () => {
    const { game, red } = await sides(true);
    expect(cost(game, red, UnitType.ConventionalMissile)).toBe(500_000n);
    expect(cost(game, red, UnitType.Satellite)).toBe(25_000_000n);
    expect(cost(game, red, UnitType.HydrogenBomb)).toBe(5_000_000n);
    expect(cost(game, red, UnitType.MIRV)).toBe(25_000_000n);
  });

  test("every client gets each player's strategic data, resent when it changes", async () => {
    const { game, red } = await sides(true);
    const first = playerUpdate(game, RED.id).strategic!;
    expect(first.stock[UnitType.AtomBomb]).toBe(0);
    expect(first.satellite).toEqual({ phase: "none" });
    red.strategic()!.addStock(UnitType.HydrogenBomb);
    const next = playerUpdate(game, RED.id).strategic!;
    expect(next.stock[UnitType.HydrogenBomb]).toBe(1);
    expect(next).not.toBe(first);
  });

  test("a satellite being prepared holds one slot of its silo", async () => {
    const { game, red } = await sides(true);
    const small = red.buildUnit(UnitType.MissileSilo, game.ref(5, 5), {});
    const big = red.buildUnit(UnitType.MissileSilo, game.ref(20, 20), {});
    red.upgradeUnit(big);
    big.reloadMissile(); // the upgraded tube starts reloading
    const s = red.strategic()!;

    s.setSatellite({
      phase: "preparing",
      siloId: small.id(),
      startTick: 0,
      readyTick: 900,
    });
    expect(small.isInCooldown()).toBe(true);
    s.setSatellite({
      phase: "preparing",
      siloId: big.id(),
      startTick: 0,
      readyTick: 900,
    });
    expect(small.isInCooldown()).toBe(false);
    expect(big.isInCooldown()).toBe(false);
    big.launch();
    expect(big.isInCooldown()).toBe(true);
  });

  test("survives a snapshot with stock, a line and a satellite counting down", async () => {
    const { game, red, blue } = await sides(true);
    const s = red.strategic()!;
    s.addStock(UnitType.MIRV);
    s.startJob({
      factoryId: 99,
      type: UnitType.HydrogenBomb,
      startTick: 0,
      endTick: 400,
    });
    s.setSatellite({
      phase: "targeted",
      target: blue.smallID(),
      strikeTick: 600,
      interceptors: [
        { by: blue.smallID(), type: UnitType.AtomBomb, resolveTick: 30 },
      ],
    });
    await expectSnapshotRoundTrip(game, "plains", 5);
  });

  test("the intents carry only the nukes they may", () => {
    const ok = (intent: object) =>
      IntentSchema.safeParse(intent).success;
    expect(ok({ type: "produce_nuke", nukeType: UnitType.MIRV })).toBe(true);
    expect(ok({ type: "produce_nuke", nukeType: UnitType.MIRVWarhead })).toBe(
      false,
    );
    const intercept = { type: "intercept_satellite", attacker: "abcdefgh" };
    expect(ok({ ...intercept, nukeType: UnitType.AtomBomb })).toBe(true);
    expect(ok({ ...intercept, nukeType: UnitType.MIRV })).toBe(false);
  });
});

describe("where strategic weapons can go", () => {
  test("a conventional missile needs a loaded silo and an enemy building near the aim", async () => {
    const { game, red, blue } = await sides(true);
    blue.addGold(10_000_000n);
    blue.buildUnit(UnitType.City, game.ref(80, 50), {});
    red.buildUnit(UnitType.City, game.ref(20, 50), {});
    const aim = game.ref(82, 52);

    expect(red.canBuild(UnitType.ConventionalMissile, aim)).toBe(false);
    const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    expect(red.canBuild(UnitType.ConventionalMissile, aim)).toBe(silo.tile());
    expect(red.missileTarget(aim)?.tile()).toBe(game.ref(80, 50));
    // 15 tiles from the city: outside the 10-tile pick.
    expect(red.canBuild(UnitType.ConventionalMissile, game.ref(95, 50))).toBe(
      false,
    );
    // Its own city.
    expect(red.canBuild(UnitType.ConventionalMissile, game.ref(21, 50))).toBe(
      false,
    );
    red.createAllianceRequest(blue)?.accept();
    expect(red.canBuild(UnitType.ConventionalMissile, aim)).toBe(false);
  });

  test("the satellite goes to the player's ready silo nearest the aim, one at a time", async () => {
    const { game, red } = await sides(true);
    const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    expect(red.canBuild(UnitType.Satellite, game.ref(12, 14))).toBe(
      silo.tile(),
    );
    // 25 tiles away: outside the 15-tile pick.
    expect(red.canBuild(UnitType.Satellite, game.ref(28, 28))).toBe(false);
    red.strategic()!.setSatellite({ phase: "orbit" });
    expect(red.canBuild(UnitType.Satellite, game.ref(12, 14))).toBe(false);
  });
});

describe("strategic weapons in domestic mode", () => {
  test("the space program unlocks the satellite; the nuclear law discounts everything", async () => {
    const { game, red } = await sides(true, { domesticMode: true });
    expect(red.isUnitLocked(UnitType.Satellite)).toBe(true);
    expect(red.isUnitLocked(UnitType.ConventionalMissile)).toBe(false);
    grantTechs(red, "space_program");
    expect(red.isUnitLocked(UnitType.Satellite)).toBe(false);
    grantLaws(red, { nuclear: "A" });
    expect(cost(game, red, UnitType.ConventionalMissile)).toBe(400_000n);
    expect(cost(game, red, UnitType.Satellite)).toBe(20_000_000n);
    expect(cost(game, red, UnitType.AtomBomb)).toBe(600_000n);
  });
});

describe("rules shared with the client", () => {
  test("factory lines, picks, odds, craters and the countdown", () => {
    expect(isStockpiledNuke(UnitType.MIRV)).toBe(true);
    expect(isStockpiledNuke(UnitType.MIRVWarhead)).toBe(false);
    // One free line each: the lower id wins.
    expect(
      factoryWithFreeLine(
        [
          { id: 7, level: 1 },
          { id: 3, level: 2 },
        ],
        [{ factoryId: 3 }],
      ),
    ).toBe(3);
    expect(factoryWithFreeLine([{ id: 7, level: 1 }], [{ factoryId: 7 }])).toBe(
      null,
    );
    expect(
      factoryWithFreeLine(
        [
          { id: 7, level: 1 },
          { id: 9, level: 3 },
        ],
        [],
      ),
    ).toBe(9);
    expect(
      pickNearestWithin(0, 0, 10, [
        { id: 2, x: 6, y: 0 },
        { id: 1, x: 0, y: 6 },
        { id: 0, x: 11, y: 0 },
      ])?.id,
    ).toBe(1);
    expect(pickNearestWithin(0, 0, 5, [{ id: 2, x: 6, y: 0 }])).toBeNull();
    expect(interceptHitPct(UnitType.HydrogenBomb)).toBe(20);
    expect(interceptHitPct(UnitType.AtomBomb)).toBe(4);
    expect(strikeCraterRadius(100)).toBe(3);
    expect(strikeCraterRadius(1600)).toBe(6);
    expect(strikeCraterRadius(7000)).toBe(10);
    expect(strikeSecondsLeft(700, 100)).toBe(60);
    expect(strikeSecondsLeft(700, 695)).toBe(1);
    expect(strikeSecondsLeft(700, 800)).toBe(0);
    expect(stockTotal(null)).toBe(0);
    expect(
      stockTotal({
        stock: {
          [UnitType.AtomBomb]: 2,
          [UnitType.HydrogenBomb]: 1,
          [UnitType.MIRV]: 1,
        },
        jobs: [],
        satellite: { phase: "none" },
      }),
    ).toBe(4);
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `npx vitest tests/strategic/StrategicOption.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine-lib/strategic/Strategic'`

- [ ] **Step 5: 공유 모양(engine-api)**

`packages/engine-api/src/strategic/StrategicTypes.ts`:

```ts
import { UnitType } from "../game/GameTypes";

/**
 * Strategic weapons (GameConfig.strategicWeapons, spec
 * docs/superpowers/specs/2026-10-16-strategic-weapons-design.md): the
 * shapes the engine, the wire and the client share.
 */

/** Nukes made in factories and kept in a stockpile (spec §4). */
export const STOCKPILED_NUKES = [
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRV,
] as const;
export type StockpiledNuke = (typeof STOCKPILED_NUKES)[number];

/** Stockpiled nukes that can be fired at a satellite, hydrogen first (spec §6.3). */
export const INTERCEPTOR_NUKES = [
  UnitType.HydrogenBomb,
  UnitType.AtomBomb,
] as const;
export type InterceptorNuke = (typeof INTERCEPTOR_NUKES)[number];

/** One nuke being made on one factory line. */
export interface NukeJobData {
  factoryId: number;
  type: StockpiledNuke;
  startTick: number;
  endTick: number;
}

/** A nuke fired at a satellite, judged at resolveTick. */
export interface InterceptorData {
  /** The firing player's smallID. */
  by: number;
  type: InterceptorNuke;
  resolveTick: number;
}

/** A nation's one satellite (spec §6). "spent": struck or shot down, never again. */
export type SatelliteData =
  | { phase: "none" }
  | { phase: "preparing"; siloId: number; startTick: number; readyTick: number }
  | { phase: "orbit" }
  | {
      phase: "targeted";
      /** The target's smallID. */
      target: number;
      strikeTick: number;
      interceptors: InterceptorData[];
    }
  | { phase: "spent" };

/** Strategic state as sent worker -> main thread on PlayerUpdate. Never mutated. */
export interface StrategicData {
  stock: Readonly<Record<StockpiledNuke, number>>;
  jobs: readonly NukeJobData[];
  satellite: SatelliteData;
}
```

`packages/engine-api/src/game/GameTypes.ts`의 `enum UnitType`에서 `CargoPlane = "Cargo Plane",` 뒤(닫는 `}` 앞)에 추가:

```ts
  // Strategic weapons (GameConfig.strategicWeapons). Appended like the
  // warfare units: the wire and snapshots encode UnitType by position.
  ConventionalMissile = "Conventional Missile",
  /** No map unit: the build intent at a silo starts the satellite's preparation. */
  Satellite = "Satellite",
```

같은 파일의 `BuildableAttacks`에서 `UnitType.Bomber,` 뒤에 `UnitType.ConventionalMissile,`와 `UnitType.Satellite,`를 추가한다.

- [ ] **Step 6: 로비 설정과 인텐트**

`packages/engine-api/src/Schemas.ts`:
- import 목록 끝에 추가:

```ts
import {
  INTERCEPTOR_NUKES,
  STOCKPILED_NUKES,
} from "./strategic/StrategicTypes";
```

- `GameConfigSchema`의 `warfareExpansion: z.boolean().optional(),` 뒤에 추가:

```ts
  // Strategic weapons (this fork): nukes made in factories and stockpiled,
  // the conventional missile and the orbital satellite. Off by default;
  // independent of warfareExpansion. See
  // docs/superpowers/specs/2026-10-16-strategic-weapons-design.md.
  strategicWeapons: z.boolean().optional(),
```

- `ParadropIntentSchema` 블록 뒤에 추가:

```ts
// Strategic weapons: start one nuke on a free factory line (the engine
// picks the factory).
export const ProduceNukeIntentSchema = z.object({
  type: z.literal("produce_nuke"),
  nukeType: z.enum(STOCKPILED_NUKES),
});

// Strategic weapons: aim the sender's satellite in orbit at a nation.
export const SatelliteTargetIntentSchema = z.object({
  type: z.literal("satellite_target"),
  target: MappedID,
});

// Strategic weapons: fire a stockpiled hydrogen or atom bomb at
// `attacker`'s satellite while its strike counts down.
export const InterceptSatelliteIntentSchema = z.object({
  type: z.literal("intercept_satellite"),
  attacker: MappedID,
  nukeType: z.enum(INTERCEPTOR_NUKES),
});
```

- `IntentSchema`의 목록에서 `ParadropIntentSchema,` 뒤에 `ProduceNukeIntentSchema,`, `SatelliteTargetIntentSchema,`, `InterceptSatelliteIntentSchema,`를 차례로 추가한다.
- `Intent` 유니언의 `| ParadropIntent;`를 `| ParadropIntent`로 바꾸고 그 뒤에 `| ProduceNukeIntent | SatelliteTargetIntent | InterceptSatelliteIntent;`를 붙인다.
- `export type ParadropIntent = …;` 뒤에 추가:

```ts
export type ProduceNukeIntent = z.infer<typeof ProduceNukeIntentSchema>;
export type SatelliteTargetIntent = z.infer<typeof SatelliteTargetIntentSchema>;
export type InterceptSatelliteIntent = z.infer<
  typeof InterceptSatelliteIntentSchema
>;
```

- [ ] **Step 7: 갱신 종류와 플레이어 갱신**

`packages/engine-api/src/game/GameUpdates.ts`:
- import에 `import type { StrategicData } from "../strategic/StrategicTypes";`를 추가한다.
- `enum GameUpdateType`의 `DonateEvent,` 뒤에 `OrbitalStrike,`를 추가하고, `GameUpdate` 유니언의 `| DonateEventUpdate;`를 `| DonateEventUpdate | OrbitalStrikeUpdate;`로 바꾼다.
- `GamePausedUpdate` 인터페이스 뒤에 추가:

```ts
/**
 * Strategic weapons: an orbital strike landed. `impacts` are the crater
 * centers, then the struck building sites (render beams; the land and
 * buildings already changed through the usual updates).
 */
export interface OrbitalStrikeUpdate {
  type: GameUpdateType.OrbitalStrike;
  attackerID: number;
  targetID: number;
  impacts: TileRef[];
}
```

- `PlayerUpdate`의 `domestic?: DomesticData;` 뒤에 추가하고, 위 문서 주석의 "Exception: `domestic` …" 문장을 "Exceptions: `domestic` and `strategic` are not part of the renderer's PlayerState; they are applied in PlayerView.applyUpdate() instead."로 바꾼다:

```ts
  /** Strategic weapons only: stockpile, factory lines, satellite. */
  strategic?: StrategicData;
```

- [ ] **Step 8: 수치와 공용 규칙(engine-lib)**

`packages/engine-lib/src/strategic/Strategic.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  InterceptorNuke,
  STOCKPILED_NUKES,
  StockpiledNuke,
  StrategicData,
} from "@openfront/engine-api/strategic/StrategicTypes";

/**
 * Strategic weapons (GameConfig.strategicWeapons): the numbers and the pure
 * rules the engine and the client share.
 */

/** Units that exist only with the option on (Config.isUnitDisabled). */
export const STRATEGIC_ONLY_UNITS: ReadonlySet<UnitType> = new Set([
  UnitType.ConventionalMissile,
  UnitType.Satellite,
]);

const STOCKPILED: ReadonlySet<UnitType> = new Set(STOCKPILED_NUKES);

/** Atom bombs, hydrogen bombs and MIRVs: made in factories, fired from the stockpile. */
export function isStockpiledNuke(type: UnitType): type is StockpiledNuke {
  return STOCKPILED.has(type);
}

// --- Nuke production (spec §4) ---
/** Ticks one factory line takes per nuke: 20 s, 40 s, 60 s. */
export const NUKE_PRODUCTION_TICKS: Readonly<Record<StockpiledNuke, number>> =
  {
    [UnitType.AtomBomb]: 20 * 10,
    [UnitType.HydrogenBomb]: 40 * 10,
    [UnitType.MIRV]: 60 * 10,
  };

/** A finished factory: one production line per level. */
export interface LineFactory {
  id: number;
  level: number;
}

/**
 * The factory a new nuke goes to: the one with the most free lines (level
 * minus the jobs running there), the lowest id on ties; null when every
 * line is busy.
 */
export function factoryWithFreeLine(
  factories: readonly LineFactory[],
  jobs: readonly { factoryId: number }[],
): number | null {
  let best: LineFactory | null = null;
  let bestFree = 0;
  for (const f of factories) {
    const free = f.level - jobs.filter((j) => j.factoryId === f.id).length;
    if (free <= 0) continue;
    if (best === null || free > bestFree || (free === bestFree && f.id < best.id)) {
      best = f;
      bestFree = free;
    }
  }
  return best?.id ?? null;
}

/** Every stockpiled nuke a player holds (the leaderboard's "Nukes"). */
export function stockTotal(data: StrategicData | null): number {
  if (data === null) return 0;
  return STOCKPILED_NUKES.reduce((sum, t) => sum + data.stock[t], 0);
}

// --- Conventional missile (spec §5) ---
export const CONVENTIONAL_MISSILE_COST = 500_000;
/** Tiles per tick (an atom bomb flies 10). */
export const CONVENTIONAL_MISSILE_SPEED = 12;
/** The missile hits the enemy structure nearest the aimed tile within this many tiles. */
export const MISSILE_TARGET_RADIUS = 10;

/** A map point with a stable id, for pickNearestWithin. */
export interface PickCandidate {
  id: number;
  x: number;
  y: number;
}

/** The candidate nearest (x, y) within `radius` tiles (euclidean), the lowest id on ties; null if none. */
export function pickNearestWithin<T extends PickCandidate>(
  x: number,
  y: number,
  radius: number,
  candidates: readonly T[],
): T | null {
  const r2 = radius * radius;
  let best: T | null = null;
  let bestD2 = r2;
  for (const c of candidates) {
    const d2 = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y);
    if (d2 > r2) continue;
    if (best === null || d2 < bestD2 || (d2 === bestD2 && c.id < best.id)) {
      best = c;
      bestD2 = d2;
    }
  }
  return best;
}

// --- Orbital satellite (spec §6) ---
export const SATELLITE_COST = 25_000_000;
/** 90 s at a silo before the satellite reaches orbit. */
export const SATELLITE_PREP_TICKS = 90 * 10;
/** The satellite button picks the player's ready silo nearest the aim within this many tiles. */
export const SATELLITE_SILO_PICK_RADIUS = 15;
/** The strike lands 60 s after the target is chosen. */
export const SATELLITE_STRIKE_DELAY_TICKS = 60 * 10;
/** An interceptor is judged 3 s after launch; a due strike waits for every interceptor still flying. */
export const INTERCEPTOR_FLIGHT_TICKS = 3 * 10;
/** 1 in N per interceptor: hydrogen 20%, atom 4% (spec §6.3). */
export const INTERCEPT_ODDS: Readonly<Record<InterceptorNuke, number>> = {
  [UnitType.HydrogenBomb]: 5,
  [UnitType.AtomBomb]: 25,
};

/** One interceptor's hit chance in percent (the band's buttons). */
export function interceptHitPct(type: InterceptorNuke): number {
  return 100 / INTERCEPT_ODDS[type];
}

/** Share of the target's troops the strike kills. */
export const STRIKE_TROOP_LOSS_PCT = 70;
/** Tiles around each destroyed building that turn to sea. */
export const STRIKE_STRUCTURE_RADIUS = 3;
/** Share of the target's land the scattered fire turns to sea, beyond the building sites. */
export const STRIKE_SCATTER_PCT = 30;

/** Radius of each scattered crater: wider for bigger nations, 3 to 10 tiles. */
export function strikeCraterRadius(territoryTiles: number): number {
  return Math.max(3, Math.min(10, Math.floor(Math.sqrt(territoryTiles) / 6)));
}

/** Whole seconds left before a targeted satellite fires (0 once due). */
export function strikeSecondsLeft(strikeTick: number, now: number): number {
  return Math.max(0, Math.ceil((strikeTick - now) / 10));
}
```

- [ ] **Step 9: Config와 기술 해금**

`packages/engine-lib/src/configuration/Config.ts`:
- import 목록 끝에 `import { STRATEGIC_ONLY_UNITS } from "../strategic/Strategic";`를 추가한다.
- `warfareExpansion(): boolean { … }` 메서드 뒤에 추가:

```ts
  /** Strategic weapons: nuke stockpiles, the conventional missile, the satellite. */
  strategicWeapons(): boolean {
    return this._gameConfig.strategicWeapons ?? false;
  }
```

- `isUnitDisabled`의 `WARFARE_ONLY_UNITS` 검사 뒤에 추가:

```ts
    if (STRATEGIC_ONLY_UNITS.has(unitType) && !this.strategicWeapons()) {
      return true;
    }
```

- `unitInfo`의 `info = {};` 묶음에서 `case UnitType.CargoPlane:` 뒤에 `case UnitType.ConventionalMissile:`와 `case UnitType.Satellite:`를 더한다.

`packages/engine-lib/src/domestic/Techs.ts`의 `space_program`에 해금을 더한다(옵션이 꺼지면 `isUnitDisabled`가 먼저 막는다):

```ts
  // Qualifies for the science victory project (Victory.ts projectQualified).
  space_program: tech("space_program", 4, "learning", {
    prereqs: ["computers"],
    cost: SPACE_PROGRAM_COST,
    // Strategic weapons only: the orbital satellite.
    unlocks: [UnitType.Satellite],
  }),
```

`tests/domestic/Techs.test.ts`의 "each locked unit is unlocked by exactly one tech" 기대 목록에 `UnitType.Satellite,`를 더한다(`UnitType.CoastalBarrage,` 뒤).

- [ ] **Step 10: EngineConfig — 가격과 내정 보정**

`packages/engine/src/configuration/EngineConfig.ts`:
- import에 `import { CONVENTIONAL_MISSILE_COST, SATELLITE_COST } from "@openfront/engine-lib/strategic/Strategic";`를 추가한다.
- `DOMESTIC_COST_STAT`의 `[UnitType.Bomber]: "nukeCost",` 뒤에 추가:

```ts
  // Strategic weapons: priced like nukes (the nuclear deterrence law).
  [UnitType.ConventionalMissile]: "nukeCost",
  [UnitType.Satellite]: "nukeCost",
```

- `unitCost`의 `case UnitType.TransportPlane:` 블록 뒤(`case UnitType.TransportShip:` 묶음 앞)에 추가:

```ts
      case UnitType.ConventionalMissile:
        return this.costWrapper(
          () => CONVENTIONAL_MISSILE_COST,
          UnitType.ConventionalMissile,
        );
      case UnitType.Satellite:
        return this.costWrapper(() => SATELLITE_COST, UnitType.Satellite);
```

- [ ] **Step 11: 나라별 상태**

`packages/engine/src/strategic/PlayerStrategic.ts`:

```ts
import {
  INTERCEPTOR_NUKES,
  InterceptorData,
  NukeJobData,
  SatelliteData,
  STOCKPILED_NUKES,
  StockpiledNuke,
  StrategicData,
} from "@openfront/engine-api/strategic/StrategicTypes";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";

const SatelliteStateSchema = z.object({
  phase: z.enum(["none", "preparing", "orbit", "targeted", "spent"]),
  siloId: zInt().optional(),
  startTick: zInt().optional(),
  readyTick: zInt().optional(),
  target: zInt().optional(),
  strikeTick: zInt().optional(),
  interceptors: z
    .array(
      z.object({
        by: zInt(),
        type: z.enum(INTERCEPTOR_NUKES),
        resolveTick: zInt(),
      }),
    )
    .optional(),
});
type SatelliteState = z.infer<typeof SatelliteStateSchema>;

export const StrategicStateSchema = z.object({
  /** In STOCKPILED_NUKES order: atom, hydrogen, MIRV. */
  stock: z.array(zInt()),
  jobs: z.array(
    z.object({
      factoryId: zInt(),
      type: z.enum(STOCKPILED_NUKES),
      startTick: zInt(),
      endTick: zInt(),
    }),
  ),
  satellite: SatelliteStateSchema,
});
export type StrategicState = z.infer<typeof StrategicStateSchema>;

const slot = (type: StockpiledNuke): number => STOCKPILED_NUKES.indexOf(type);

/**
 * A player's strategic weapons (spec §4, §6): the stockpile, the nukes on
 * factory lines and the one satellite. Exists only with the option on.
 * Nothing here ticks: StrategicExecution and the orders drive it.
 */
export class PlayerStrategic {
  private stockCounts: number[] = STOCKPILED_NUKES.map(() => 0);
  private _jobs: NukeJobData[] = [];
  private _satellite: SatelliteData = { phase: "none" };
  /** toData() result until the next change. */
  private strategicDataCache: StrategicData | null = null;

  stock(type: StockpiledNuke): number {
    return this.stockCounts[slot(type)];
  }

  addStock(type: StockpiledNuke): void {
    this.stockCounts[slot(type)]++;
    this.changed();
  }

  /** Takes one from the stockpile; false (and nothing taken) when there is none. */
  takeStock(type: StockpiledNuke): boolean {
    const i = slot(type);
    if (this.stockCounts[i] === 0) return false;
    this.stockCounts[i]--;
    this.changed();
    return true;
  }

  jobs(): readonly NukeJobData[] {
    return this._jobs;
  }

  startJob(job: NukeJobData): void {
    this._jobs.push({ ...job });
    this.changed();
  }

  /** Removes the jobs `lost` picks; returns how many went. */
  dropJobs(lost: (job: NukeJobData) => boolean): number {
    const before = this._jobs.length;
    this._jobs = this._jobs.filter((j) => !lost(j));
    if (this._jobs.length !== before) this.changed();
    return before - this._jobs.length;
  }

  /** Removes every job on `factoryId`; returns how many went. */
  cancelJobsAt(factoryId: number): number {
    return this.dropJobs((j) => j.factoryId === factoryId);
  }

  /** Moves every job done by `now` into the stockpile; returns them in start order. */
  finishJobs(now: number): NukeJobData[] {
    const done = this._jobs.filter((j) => j.endTick <= now);
    if (done.length === 0) return done;
    this._jobs = this._jobs.filter((j) => j.endTick > now);
    for (const j of done) this.stockCounts[slot(j.type)]++;
    this.changed();
    return done;
  }

  satellite(): SatelliteData {
    return this._satellite;
  }

  setSatellite(s: SatelliteData): void {
    this._satellite = s;
    this.changed();
  }

  /** A targeted satellite gains an interceptor in flight; ignored otherwise. */
  addInterceptor(i: InterceptorData): void {
    const s = this._satellite;
    if (s.phase !== "targeted") return;
    this._satellite = { ...s, interceptors: [...s.interceptors, { ...i }] };
    this.changed();
  }

  /** A satellite being prepared holds one slot of its silo (spec §6.1). */
  holdsSiloSlot(siloId: number): boolean {
    const s = this._satellite;
    return s.phase === "preparing" && s.siloId === siloId;
  }

  toData(): StrategicData {
    this.strategicDataCache ??= {
      stock: Object.fromEntries(
        STOCKPILED_NUKES.map((t, i) => [t, this.stockCounts[i]]),
      ) as Record<StockpiledNuke, number>,
      jobs: this._jobs.map((j) => ({ ...j })),
      satellite: satelliteData(satelliteState(this._satellite)),
    };
    return this.strategicDataCache;
  }

  snapshot(): StrategicState {
    return {
      stock: [...this.stockCounts],
      jobs: this._jobs.map((j) => ({
        factoryId: j.factoryId,
        type: j.type,
        startTick: j.startTick,
        endTick: j.endTick,
      })),
      satellite: satelliteState(this._satellite),
    };
  }

  static restore(s: StrategicState): PlayerStrategic {
    const p = new PlayerStrategic();
    p.stockCounts = [...s.stock];
    p._jobs = s.jobs.map((j) => ({ ...j }));
    p._satellite = satelliteData(s.satellite);
    return p;
  }

  private changed(): void {
    this.strategicDataCache = null;
  }
}

/** Field by field, in schema order: key order is part of the snapshot bytes. */
function satelliteState(s: SatelliteData): SatelliteState {
  switch (s.phase) {
    case "none":
    case "orbit":
    case "spent":
      return { phase: s.phase };
    case "preparing":
      return {
        phase: s.phase,
        siloId: s.siloId,
        startTick: s.startTick,
        readyTick: s.readyTick,
      };
    case "targeted":
      return {
        phase: s.phase,
        target: s.target,
        strikeTick: s.strikeTick,
        interceptors: s.interceptors.map((i) => ({
          by: i.by,
          type: i.type,
          resolveTick: i.resolveTick,
        })),
      };
  }
}

function satelliteData(s: SatelliteState): SatelliteData {
  switch (s.phase) {
    case "none":
    case "orbit":
    case "spent":
      return { phase: s.phase };
    case "preparing":
      return {
        phase: s.phase,
        siloId: s.siloId!,
        startTick: s.startTick!,
        readyTick: s.readyTick!,
      };
    case "targeted":
      return {
        phase: s.phase,
        target: s.target!,
        strikeTick: s.strikeTick!,
        interceptors: (s.interceptors ?? []).map((i) => ({ ...i })),
      };
  }
}
```

`tests/util/Snapshot.ts`의 `DERIVED_FIELDS`에서 `"domesticDataCache",` 뒤에 추가:

```ts
  // PlayerStrategic
  "strategicDataCache",
```

- [ ] **Step 12: 게임 연결 — Player, 배치 규칙, 발사대 칸, 갱신 비교**

`packages/engine/src/game/Game.ts`:
- `import type { PlayerDomestic } from "../domestic/PlayerDomestic";` 뒤에 `import type { PlayerStrategic } from "../strategic/PlayerStrategic";`를 추가한다.
- `UnitParamsMap`의 `[UnitType.CargoPlane]: {…};` 뒤에 추가:

```ts

  /** Flies to the structure it was aimed at (ConventionalMissileExecution). */
  [UnitType.ConventionalMissile]: {
    targetTile: TileRef;
    trajectory: TrajectoryTile[];
    targetUnit: Unit;
  };

  /** Never built: the build intent at a silo starts the satellite's preparation. */
  [UnitType.Satellite]: Record<string, never>;
```

- `Player` 인터페이스의 `isUnitUnavailable(type: UnitType): boolean;` 뒤에 추가:

```ts
  /** Strategic weapons state; null with the option off. */
  strategic(): PlayerStrategic | null;
  /** Strategic weapons: the enemy structure a conventional missile aimed at `tile` hits, or null. */
  missileTarget(tile: TileRef): Unit | null;
```

`packages/engine/src/game/PlayerImpl.ts`:
- import에 추가:

```ts
import {
  isStockpiledNuke,
  MISSILE_TARGET_RADIUS,
  pickNearestWithin,
  SATELLITE_SILO_PICK_RADIUS,
} from "@openfront/engine-lib/strategic/Strategic";
import {
  PlayerStrategic,
  StrategicStateSchema,
} from "../strategic/PlayerStrategic";
```

- 필드 `private _domestic: PlayerDomestic | null = null;` 뒤에 `/** Strategic weapons state; null with the option off. */ private _strategic: PlayerStrategic | null = null;`를 추가하고, 생성자에서 `this._domestic = …;` 뒤에 추가:

```ts
    this._strategic = mg.config().strategicWeapons()
      ? new PlayerStrategic()
      : null;
```

- `toUpdate`의 반환 객체 끝 `...(this._domestic === null ? {} : { domestic: this._domestic.toData() }),` 뒤에 `...(this._strategic === null ? {} : { strategic: this._strategic.toData() }),`를 추가한다.
- `domestic()` 메서드 뒤에 `strategic(): PlayerStrategic | null { return this._strategic; }`를 추가한다.
- `canBuildUnitType`에서 `if (this.isUnitUnavailable(unitType)) { return false; }` 바로 뒤에 추가:

```ts
    // Strategic weapons: nukes come out of the stockpile; their gold was
    // paid at the factory (spec §4).
    if (this._strategic !== null && isStockpiledNuke(unitType)) {
      return this._strategic.stock(unitType) > 0 && this.isAlive();
    }
```

- `buildUnit`의 `const cost = this.mg.unitInfo(type).cost(this.mg, this);`를 다음으로 바꾼다:

```ts
    let cost = this.mg.unitInfo(type).cost(this.mg, this);
    if (this._strategic !== null && isStockpiledNuke(type)) {
      // Strategic weapons: a launch takes one from the stockpile, no gold.
      this._strategic.takeStock(type);
      cost = 0n;
    }
```

- `canSpawnUnitType`의 `default:` 앞에 추가:

```ts
      case UnitType.ConventionalMissile:
        return this.conventionalMissileSpawn(targetTile);
      case UnitType.Satellite:
        return this.satelliteSpawn(targetTile);
```

- `paradropSpawn` 메서드 뒤에 추가:

```ts
  /** Strategic weapons: the enemy structure a conventional missile aimed at `tile` hits (spec §5), or null. */
  missileTarget(tile: TileRef): Unit | null {
    const mg = this.mg;
    if (mg.isSpawnImmunityActive()) return null;
    // Disconnected allies and teammates stay protected, as from a nuke.
    const candidates = mg
      .nearbyUnits(tile, MISSILE_TARGET_RADIUS, Structures.types, undefined, true)
      .filter(
        ({ unit }) =>
          unit.owner() !== this && !this.isFriendly(unit.owner(), true),
      )
      .map(({ unit }) => ({
        id: unit.id(),
        x: mg.x(unit.tile()),
        y: mg.y(unit.tile()),
        unit,
      }));
    return (
      pickNearestWithin(mg.x(tile), mg.y(tile), MISSILE_TARGET_RADIUS, candidates)
        ?.unit ?? null
    );
  }

  /** Strategic weapons: a conventional missile flies from the nearest loaded silo, as a nuke does. */
  conventionalMissileSpawn(tile: TileRef): TileRef | false {
    if (this.missileTarget(tile) === null) return false;
    const mg = this.mg;
    const silo = findClosestBy(
      this.units(UnitType.MissileSilo),
      (s) => mg.manhattanDist(s.tile(), tile),
      (s) => s.isActive() && !s.isInCooldown() && !s.isUnderConstruction(),
    );
    return silo?.tile() ?? false;
  }

  /** Strategic weapons: the satellite is prepared at the ready silo nearest the aim (spec §6.1). */
  satelliteSpawn(tile: TileRef): TileRef | false {
    if (this._strategic?.satellite().phase !== "none") return false;
    const mg = this.mg;
    const silos = this.units(UnitType.MissileSilo)
      .filter(
        (s) => s.isActive() && !s.isUnderConstruction() && !s.isInCooldown(),
      )
      .map((s) => ({ id: s.id(), x: mg.x(s.tile()), y: mg.y(s.tile()), unit: s }));
    return (
      pickNearestWithin(mg.x(tile), mg.y(tile), SATELLITE_SILO_PICK_RADIUS, silos)
        ?.unit.tile() ?? false
    );
  }
```

- 스냅샷: `snapshot()` 반환 객체 끝의 `domestic` 스프레드 뒤에 `...(this._strategic === null ? {} : { strategic: this._strategic.snapshot() }),`를, `restoreSnapshot` 끝에 `this._strategic = s.strategic ? PlayerStrategic.restore(s.strategic) : null;`를, `PlayerSnapshot` 스키마의 `domestic: DomesticStateSchema.nullable().optional(),` 뒤에 `strategic: StrategicStateSchema.nullable().optional(),`를 추가한다.

`packages/engine/src/game/UnitImpl.ts`의 `isInCooldown`을 다음으로 바꾼다:

```ts
  isInCooldown(): boolean {
    // Strategic weapons: a silo preparing its owner's satellite lends it one
    // slot (spec §6.1). Null outside the mode, so this is the vanilla check.
    if (this._owner.strategic()?.holdsSiloSlot(this._id) === true) {
      return this._missileTimerQueue.length + 1 >= this._level;
    }
    return this._missileTimerQueue.length === this._level;
  }
```

`packages/engine/src/game/GameUpdateUtils.ts`의 `diffPlayerUpdate`: 빠른 경로의 `prev.domestic === next.domestic &&` 뒤에 `prev.strategic === next.strategic &&`를, `setIfDifferent("domestic", …);` 뒤에 다음을 추가한다:

```ts
  // PlayerStrategic caches its StrategicData the same way.
  setIfDifferent("strategic", prev.strategic === next.strategic);
```

- [ ] **Step 13: 클라이언트 뷰, 로비 키, 와이어 샘플**

`src/client/view/PlayerView.ts`:
- import에 `import type { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";`를 추가한다.
- 필드 `private _domestic: DomesticClientView | null = null;` 뒤에 `private _strategic: StrategicData | null = null;`를 추가하고, 생성자의 `this._domestic = …;` 뒤에 `this._strategic = data.strategic ?? null;`를, `applyUpdate`의 `domestic` 처리 뒤에 다음을 추가한다:

```ts
    if (pu.strategic !== undefined) {
      this._strategic = pu.strategic;
    }
```

- `domesticData()` 뒤에 추가:

```ts
  /** Strategic weapons: the last state the worker sent; null with the option off. */
  strategicData(): StrategicData | null {
    return this._strategic;
  }
```

`src/server/ConfigPatch.ts`의 `COPIED_KEYS`에서 `"warfareExpansion",` 뒤에 `"strategicWeapons",`를 추가한다. `tests/server/ConfigPatch.test.ts`의 `EDITABLE`에서 `warfareExpansion: true,` 뒤에 `strategicWeapons: true,`를 추가한다.

`tests/zbin/wire.test.ts`:
- `CONFIG`의 `warfareExpansion: true,` 뒤에 `strategicWeapons: true,`를, `delete VANILLA_CONFIG.warfareExpansion;` 뒤에 `delete VANILLA_CONFIG.strategicWeapons;`를 추가한다.
- `SAMPLE_INTENTS`의 `paradrop` 줄 뒤에 추가(`UnitType` import가 없으면 `@openfront/engine-api/game/GameTypes`에서 가져온다):

```ts
  { type: "produce_nuke", clientID: P1, nukeType: UnitType.MIRV },
  { type: "satellite_target", clientID: P2, target: P1 },
  {
    type: "intercept_satellite",
    clientID: P1,
    attacker: P2,
    nukeType: UnitType.AtomBomb,
  },
```

- [ ] **Step 14: 통과 확인**

Run: `npx vitest tests/strategic tests/domestic/Techs.test.ts tests/domestic/UnitLocks.test.ts tests/server/ConfigPatch.test.ts tests/zbin tests/VanillaDigest.test.ts tests/client/view --run && npm run typecheck`
Expected: 모두 PASS(StrategicOption 12 tests, VanillaDigest 7 tests 포함), typecheck 오류 없음. typecheck가 `UnitType`의 다른 완전 분기(assertNever)를 가리키면 그 분기의 `CargoPlane`과 같은 묶음에 두 값을 더한다.

- [ ] **Step 15: 커밋**

```bash
npx prettier --write packages/engine-api/src packages/engine-lib/src/strategic packages/engine-lib/src/configuration/Config.ts packages/engine-lib/src/domestic/Techs.ts packages/engine/src/configuration/EngineConfig.ts packages/engine/src/strategic packages/engine/src/game src/client/view/PlayerView.ts src/server/ConfigPatch.ts tests/strategic tests/VanillaDigest.test.ts tests/server/ConfigPatch.test.ts tests/zbin/wire.test.ts tests/domestic/Techs.test.ts tests/util/Snapshot.ts
git add packages src/client/view/PlayerView.ts src/server/ConfigPatch.ts tests
git commit -m "feat(strategic): strategicWeapons option, unit types, intents, stockpile state and placement rules"
```

---
### Task 2: 핵 제조와 비축(제조 명령, 게임 시계, 발사, 다탄두 가격)

**Files:**
- Create: `packages/engine/src/strategic/Production.ts`, `NukeProductionExecution.ts`, `StrategicExecution.ts`
- Modify: `packages/engine/src/GameRunner.ts` (`init`), `packages/engine/src/execution/ExecutionManager.ts` (`produce_nuke`), `packages/engine/src/execution/MIRVExecution.ts` (가격 횟수), `packages/engine/src/snapshot/ExecutionRegistry.ts`
- Modify (test): `tests/strategic/util.ts` (시계 추가), `tests/core/snapshot/FullGameSnapshot.test.ts` (`STRATEGIC_ONLY_TYPES`)
- Test: `tests/strategic/NukeProduction.test.ts`

**Interfaces:**
- Consumes: Task 1 `PlayerStrategic`, `factoryWithFreeLine`, `NUKE_PRODUCTION_TICKS`, `StockpiledNuke`, `strategicGame`, `own`
- Produces:
  - `finishedFactories(player: Player): LineFactory[]`, `announceProductionLost(mg: Game, player: Player): void`, `processProduction(mg, player, s: PlayerStrategic, now: number): void` (`Production.ts`)
  - `new NukeProductionExecution(player: Player, nukeType: StockpiledNuke)`, 스냅샷 이름 `"NukeProduction"`
  - `new StrategicExecution()`(게임마다 하나, 옵션 켬일 때 `GameRunner.init`이 더한다), 스냅샷 이름 `"Strategic"`. Task 4가 `tick`에 `processSatellite`를 더한다.
  - `tests/strategic/util.ts`의 `strategicGame`이 `StrategicExecution`도 더한다
  - `FullGameSnapshot.test.ts`의 `const STRATEGIC_ONLY_TYPES: string[]`(이후 Task가 이름을 덧붙인다)

- [ ] **Step 1: 테스트 유틸이 시계를 더하게 하기**

`tests/strategic/util.ts`: `import { StrategicExecution } from "@openfront/engine/strategic/StrategicExecution";`를 추가하고 `strategicGame`의 본문을 바꾼다:

```ts
  const game = await setup(map, { strategicWeapons: true, ...config }, humans);
  // GameRunner adds the strategic clock to every game with the option on.
  game.addExecution(new StrategicExecution());
  return game;
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/strategic/NukeProduction.test.ts`:

```ts
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  DisplayMessageUpdate,
  GameUpdateType,
} from "@openfront/engine-api/game/GameUpdates";
import { StockpiledNuke } from "@openfront/engine-api/strategic/StrategicTypes";
import { MirvExecution } from "@openfront/engine/execution/MIRVExecution";
import { NukeExecution } from "@openfront/engine/execution/NukeExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { NukeProductionExecution } from "@openfront/engine/strategic/NukeProductionExecution";
import { grantLaws, grantTechs } from "../domestic/util";
import { setup } from "../util/Setup";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, strategicGame } from "./util";

// plains: red holds x 0-29 with a factory at (10, 30) and a silo at
// (10, 10); blue holds x 60-99. No PlayerExecution runs, so gold only
// moves when something is bought.
async function arsenal(config: Parameters<typeof strategicGame>[1] = {}) {
  const game = await strategicGame("plains", config);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 60, 0, 40, 100);
  red.addGold(100_000_000n);
  const factory = red.buildUnit(UnitType.Factory, game.ref(10, 30), {});
  const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
  return { game, red, blue, factory, silo };
}

function produce(game: Game, player: Player, type: StockpiledNuke): void {
  game.addExecution(new NukeProductionExecution(player, type));
}

/** Runs one tick and returns its display messages. */
function tickMessages(game: Game): DisplayMessageUpdate[] {
  return game.executeNextTick()[GameUpdateType.DisplayEvent];
}

const stock = (p: Player, t: StockpiledNuke) => p.strategic()!.stock(t);
const jobs = (p: Player) => p.strategic()!.jobs();

describe("nuke production", () => {
  test("an atom bomb costs 750K at the start and joins the stockpile 20 s later", async () => {
    const { game, red } = await arsenal();
    const gold = red.gold();
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    expect(red.gold()).toBe(gold - 750_000n);
    expect(jobs(red)).toHaveLength(1);
    executeTicks(game, 199);
    expect(stock(red, UnitType.AtomBomb)).toBe(0);
    executeTicks(game, 1);
    expect(stock(red, UnitType.AtomBomb)).toBe(1);
    expect(jobs(red)).toHaveLength(0);
  });

  test("everyone hears '(name) 핵무기 개발 중'", async () => {
    const { game, red, factory } = await arsenal();
    produce(game, red, UnitType.HydrogenBomb);
    const msg = tickMessages(game).find(
      (m) => m.message === "events_display.nuke_production_started",
    );
    expect(msg?.playerID).toBeNull();
    expect(msg?.params).toEqual({ name: "red" });
    expect(msg?.messageType).toBe(MessageType.NUKE_INBOUND);
    expect(msg?.unitID).toBe(factory.id());
  });

  test("hydrogen bombs take 40 s and MIRVs 60 s", async () => {
    const { game, red, factory } = await arsenal();
    red.upgradeUnit(factory); // two lines
    produce(game, red, UnitType.HydrogenBomb);
    produce(game, red, UnitType.MIRV);
    executeTicks(game, 400);
    expect(stock(red, UnitType.HydrogenBomb)).toBe(0);
    executeTicks(game, 1);
    expect(stock(red, UnitType.HydrogenBomb)).toBe(1);
    executeTicks(game, 199);
    expect(stock(red, UnitType.MIRV)).toBe(0);
    executeTicks(game, 1);
    expect(stock(red, UnitType.MIRV)).toBe(1);
  });

  test("one line per factory level: a busy factory takes no order and no gold", async () => {
    const { game, red, factory } = await arsenal();
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    const gold = red.gold();
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    expect(jobs(red)).toHaveLength(1);
    expect(red.gold()).toBe(gold);

    red.upgradeUnit(factory);
    const before = red.gold();
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    expect(jobs(red)).toHaveLength(2);
    expect(red.gold()).toBe(before - 750_000n);
  });

  test("orders spread over factories with free lines", async () => {
    const { game, red, factory } = await arsenal();
    const second = red.buildUnit(UnitType.Factory, game.ref(20, 60), {});
    produce(game, red, UnitType.AtomBomb);
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    expect(jobs(red).map((j) => j.factoryId)).toEqual([
      factory.id(),
      second.id(),
    ]);
  });

  test("launching takes one from the stockpile and no gold", async () => {
    const { game, red } = await arsenal();
    red.strategic()!.addStock(UnitType.AtomBomb);
    const gold = red.gold();
    game.addExecution(
      new NukeExecution(UnitType.AtomBomb, red, game.ref(80, 50), null),
      new NukeExecution(UnitType.AtomBomb, red, game.ref(80, 60), null),
    );
    executeTicks(game, 2);
    expect(red.units(UnitType.AtomBomb)).toHaveLength(1);
    expect(stock(red, UnitType.AtomBomb)).toBe(0);
    expect(red.gold()).toBe(gold);
  });

  test("a MIRV launches from stock without raising the price", async () => {
    const { game, red } = await arsenal();
    red.strategic()!.addStock(UnitType.MIRV);
    game.addExecution(new MirvExecution(red, game.ref(80, 50)));
    executeTicks(game, 2);
    expect(red.units(UnitType.MIRV)).toHaveLength(1);
    expect(stock(red, UnitType.MIRV)).toBe(0);
    expect(game.mirvsLaunched()).toBe(0);
  });

  test("the MIRV price rises when production starts, even if it is lost", async () => {
    const { game, red, factory } = await arsenal();
    produce(game, red, UnitType.MIRV);
    executeTicks(game, 1);
    expect(game.mirvsLaunched()).toBe(1);
    expect(game.unitInfo(UnitType.MIRV).cost(game, red)).toBe(40_000_000n);
    factory.delete();
    executeTicks(game, 1);
    expect(jobs(red)).toHaveLength(0);
    expect(game.mirvsLaunched()).toBe(1);
  });

  test("a destroyed factory loses every nuke in production, with no refund, and everyone hears it", async () => {
    const { game, red, factory } = await arsenal();
    red.upgradeUnit(factory);
    produce(game, red, UnitType.AtomBomb);
    produce(game, red, UnitType.HydrogenBomb);
    executeTicks(game, 1);
    const gold = red.gold();
    factory.delete();
    const msgs = tickMessages(game);
    expect(jobs(red)).toHaveLength(0);
    expect(red.gold()).toBe(gold);
    const lost = msgs.find(
      (m) => m.message === "events_display.nuke_production_lost",
    );
    expect(lost?.playerID).toBeNull();
    expect(lost?.params).toEqual({ name: "red" });
    executeTicks(game, 500);
    expect(stock(red, UnitType.AtomBomb)).toBe(0);
    expect(stock(red, UnitType.HydrogenBomb)).toBe(0);
  });

  test("a captured factory loses them too", async () => {
    const { game, red, blue, factory } = await arsenal();
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    blue.captureUnit(factory);
    executeTicks(game, 1);
    expect(jobs(red)).toHaveLength(0);
    expect(jobs(blue)).toHaveLength(0);
  });

  test("the stockpile never shrinks when factories and silos fall", async () => {
    const { game, red, factory, silo } = await arsenal();
    red.strategic()!.addStock(UnitType.HydrogenBomb);
    red.strategic()!.addStock(UnitType.AtomBomb);
    factory.delete();
    silo.delete();
    executeTicks(game, 2);
    expect(stock(red, UnitType.HydrogenBomb)).toBe(1);
    expect(stock(red, UnitType.AtomBomb)).toBe(1);
  });

  test("with the option off nothing is produced", async () => {
    const game = await setup("plains", {}, [RED, BLUE]);
    const red = own(game, RED.id, 0, 0, 30, 100);
    red.addGold(10_000_000n);
    red.buildUnit(UnitType.Factory, game.ref(10, 30), {});
    const gold = red.gold();
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    expect(red.gold()).toBe(gold);
    expect(red.strategic()).toBeNull();
  });

  test("survives a snapshot with an order pending and a line running", async () => {
    const { game, red, factory } = await arsenal();
    red.upgradeUnit(factory);
    produce(game, red, UnitType.HydrogenBomb);
    executeTicks(game, 1);
    produce(game, red, UnitType.AtomBomb); // pending until the next tick
    await expectSnapshotRoundTrip(game, "plains", 30);
  });
});

describe("nuke production with the other modes", () => {
  test("domestic: a locked nuke can't be made; the nuclear law discounts it", async () => {
    const { game, red } = await arsenal({ domesticMode: true });
    produce(game, red, UnitType.AtomBomb); // no manhattan_project yet
    executeTicks(game, 1);
    expect(jobs(red)).toHaveLength(0);
    grantTechs(red, "manhattan_project");
    grantLaws(red, { nuclear: "A" });
    const gold = red.gold();
    produce(game, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    expect(red.gold()).toBe(gold - 600_000n);
  });

  test("expanded warfare: barrages still fire at once for gold, outside the stockpile", async () => {
    const { game, red, silo } = await arsenal({ warfareExpansion: true });
    expect(red.canBuild(UnitType.CoastalBarrage, game.ref(80, 50))).toBe(
      silo.tile(),
    );
    expect(game.unitInfo(UnitType.CoastalBarrage).cost(game, red)).toBe(
      300_000n,
    );
    expect(red.strategic()!.stock(UnitType.AtomBomb)).toBe(0);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest tests/strategic/NukeProduction.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine/strategic/StrategicExecution'`

- [ ] **Step 4: 제조 처리 함수**

`packages/engine/src/strategic/Production.ts`:

```ts
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { StockpiledNuke } from "@openfront/engine-api/strategic/StrategicTypes";
import { LineFactory } from "@openfront/engine-lib/strategic/Strategic";
import type { Game, Player } from "../game/Game";
import type { PlayerStrategic } from "./PlayerStrategic";

const NUKE_KEYS: Readonly<Record<StockpiledNuke, string>> = {
  [UnitType.AtomBomb]: "unit_type.atom_bomb",
  [UnitType.HydrogenBomb]: "unit_type.hydrogen_bomb",
  [UnitType.MIRV]: "unit_type.mirv",
};

/** The player's finished factories: one production line per level. */
export function finishedFactories(player: Player): LineFactory[] {
  return player
    .units(UnitType.Factory)
    .filter((f) => f.isActive() && !f.isUnderConstruction())
    .map((f) => ({ id: f.id(), level: f.level() }));
}

/** Everyone hears that `player`'s nuclear program was stopped (spec §4). */
export function announceProductionLost(mg: Game, player: Player): void {
  mg.displayMessage(
    "events_display.nuke_production_lost",
    MessageType.UNIT_DESTROYED,
    null,
    undefined,
    { name: player.displayName() },
    undefined,
    player.id(),
  );
}

/**
 * One tick of a player's factory lines (spec §4): lines whose factory is
 * gone or has a new owner are lost, unpaid back; finished nukes join the
 * stockpile.
 */
export function processProduction(
  mg: Game,
  player: Player,
  s: PlayerStrategic,
  now: number,
): void {
  const lost = s.dropJobs((job) => {
    const factory = mg.unit(job.factoryId);
    return (
      factory === undefined || !factory.isActive() || factory.owner() !== player
    );
  });
  if (lost > 0) announceProductionLost(mg, player);
  for (const job of s.finishJobs(now)) {
    mg.displayMessage(
      "events_display.nuke_production_done",
      MessageType.RESEARCH_COMPLETE,
      player.id(),
      undefined,
      { unit: NUKE_KEYS[job.type] },
      job.factoryId,
    );
  }
}
```

- [ ] **Step 5: 제조 명령**

`packages/engine/src/strategic/NukeProductionExecution.ts`:

```ts
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  STOCKPILED_NUKES,
  StockpiledNuke,
} from "@openfront/engine-api/strategic/StrategicTypes";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  factoryWithFreeLine,
  NUKE_PRODUCTION_TICKS,
} from "@openfront/engine-lib/strategic/Strategic";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { finishedFactories } from "./Production";

/**
 * produce_nuke (spec §4): pays the nuke's price and starts it on the
 * factory with the most free lines. A MIRV raises the next MIRV's price
 * now, not at launch. Everyone hears "(name) 핵무기 개발 중".
 */
export class NukeProductionExecution implements Execution {
  constructor(
    private player: Player,
    private nukeType: StockpiledNuke,
  ) {}

  init(mg: Game, _ticks: number): void {
    const s = this.player.strategic();
    if (s === null || !this.player.isAlive()) return;
    if (this.player.isUnitUnavailable(this.nukeType)) return;
    const factoryId = factoryWithFreeLine(
      finishedFactories(this.player),
      s.jobs(),
    );
    if (factoryId === null) return;
    const cost = mg.unitInfo(this.nukeType).cost(mg, this.player);
    if (this.player.gold() < cost) return;
    this.player.removeGold(cost);
    if (this.nukeType === UnitType.MIRV) mg.recordMirvLaunch();
    const now = mg.ticks();
    s.startJob({
      factoryId,
      type: this.nukeType,
      startTick: now,
      endTick: now + NUKE_PRODUCTION_TICKS[this.nukeType],
    });
    mg.displayMessage(
      "events_display.nuke_production_started",
      MessageType.NUKE_INBOUND,
      null,
      undefined,
      { name: this.player.displayName() },
      factoryId,
      this.player.id(),
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
    return NukeProductionExecutionSnapshot.write({
      player: w.player(this.player),
      nukeType: this.nukeType,
    });
  }

  restoreSnapshot(s: NukeProductionState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.nukeType = s.nukeType;
  }
}

const NukeProductionStateSchema = z.object({
  player: zPlayerRef(),
  nukeType: z.enum(STOCKPILED_NUKES),
});
type NukeProductionState = z.infer<typeof NukeProductionStateSchema>;

export const NukeProductionExecutionSnapshot = execSnapshotType({
  name: "NukeProduction",
  version: 1,
  schema: NukeProductionStateSchema,
  cls: () => NukeProductionExecution,
});
```

- [ ] **Step 6: 게임 시계**

`packages/engine/src/strategic/StrategicExecution.ts`:

```ts
import { z } from "zod";
import { Execution, Game } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { processProduction } from "./Production";

/**
 * The strategic weapons clock (spec §4, §6): every tick it finishes nukes
 * on factory lines, drops lines whose factory fell and runs every
 * satellite. One per game, added by GameRunner when the option is on; all
 * state lives on the players (PlayerStrategic).
 */
export class StrategicExecution implements Execution {
  private active = true;
  private mg: Game;

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(_ticks: number): void {
    const now = this.mg.ticks();
    for (const player of this.mg.allPlayers()) {
      const s = player.strategic();
      if (s === null) continue;
      processProduction(this.mg, player, s, now);
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(_w: SnapshotWriter): ExecRecord {
    return StrategicExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
    });
  }

  restoreSnapshot(s: StrategicState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
  }
}

const StrategicStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
});
type StrategicState = z.infer<typeof StrategicStateSchema>;

export const StrategicExecutionSnapshot = execSnapshotType({
  name: "Strategic",
  version: 1,
  schema: StrategicStateSchema,
  cls: () => StrategicExecution,
});
```

- [ ] **Step 7: 연결 — 게임 시작, 명령, 다탄두, 등록**

`packages/engine/src/GameRunner.ts`: `import { StrategicExecution } from "./strategic/StrategicExecution";`를 추가하고, `init()`의 `DomesticExecution` 블록 뒤(`WinCheckExecution` 앞)에 추가:

```ts
    // Strategic weapons only: factory lines and satellites run on one clock.
    if (this.game.config().strategicWeapons()) {
      this.game.addExecution(new StrategicExecution());
    }
```

`packages/engine/src/execution/ExecutionManager.ts`: `import { NukeProductionExecution } from "../strategic/NukeProductionExecution";`를 추가하고 `case "paradrop":` 뒤에:

```ts
      case "produce_nuke":
        return new NukeProductionExecution(player, intent.nukeType);
```

`packages/engine/src/execution/MIRVExecution.ts`의 `tick`에서 `this.mg.recordMirvLaunch();`를 다음으로 바꾼다:

```ts
      // Strategic weapons count MIRVs when production starts (spec §4).
      if (!this.mg.config().strategicWeapons()) this.mg.recordMirvLaunch();
```

`packages/engine/src/snapshot/ExecutionRegistry.ts`: `NukeProductionExecutionSnapshot`(`../strategic/NukeProductionExecution`)과 `StrategicExecutionSnapshot`(`../strategic/StrategicExecution`)을 import하고 `EXECUTION_SNAPSHOT_TYPES`에 이름순으로 넣는다(`NoOpExecutionSnapshot,` 뒤에 `NukeExecutionSnapshot,` 다음 `NukeProductionExecutionSnapshot,`; `SpawnTimerExecutionSnapshot,` 뒤에 `StrategicExecutionSnapshot,`).

`tests/core/snapshot/FullGameSnapshot.test.ts`: `DOMESTIC_UNSCRIPTED_TYPES` 선언 뒤에 추가하고, FFA 기대 목록의 필터에 `&& !STRATEGIC_ONLY_TYPES.includes(name)`를 더한다:

```ts
// Execution types that only a strategic-weapons game creates. The
// "strategic" variants (Task 7) play them.
const STRATEGIC_ONLY_TYPES = ["NukeProduction", "Strategic"];
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest tests/strategic tests/nukes --run && npx vitest tests/core/snapshot/FullGameSnapshot.test.ts -t "free for all" --run`
Expected: NukeProduction 15 tests와 기존 핵 테스트 PASS, FullGameSnapshot FFA 4 tests PASS

- [ ] **Step 9: 커밋**

```bash
npx prettier --write packages/engine/src/strategic packages/engine/src/GameRunner.ts packages/engine/src/execution/ExecutionManager.ts packages/engine/src/execution/MIRVExecution.ts packages/engine/src/snapshot/ExecutionRegistry.ts tests/strategic tests/core/snapshot/FullGameSnapshot.test.ts
git add packages/engine/src tests/strategic tests/core/snapshot/FullGameSnapshot.test.ts
git commit -m "feat(strategic): nukes are made on factory lines and fired from the stockpile"
```

---
### Task 3: 일반 미사일

**Files:**
- Create: `packages/engine/src/strategic/ConventionalMissileExecution.ts`
- Modify: `packages/engine/src/configuration/EngineConfig.ts` (`nukeSpeed`)
- Modify: `packages/engine/src/execution/ConstructionExecution.ts` (`completeConstruction`)
- Modify: `packages/engine/src/execution/SAMLauncherExecution.ts` (`samTargetTypes`), `SAMMissileExecution.ts` (`INTERCEPTABLE`, 번역 키, 통계)
- Modify: `packages/engine/src/execution/NukeExecution.ts` (폭발이 지우지 않는 유닛)
- Modify: `packages/engine/src/snapshot/ExecutionRegistry.ts`
- Modify (test): `tests/core/snapshot/FullGameSnapshot.test.ts` (`STRATEGIC_ONLY_TYPES`에 `"ConventionalMissile"`)
- Test: `tests/strategic/ConventionalMissile.test.ts`

**Interfaces:**
- Consumes: Task 1 `Player.missileTarget`, `conventionalMissileSpawn`, `CONVENTIONAL_MISSILE_SPEED`, `UnitParamsMap[ConventionalMissile]`; Task 2 `announceProductionLost`, `NukeProductionExecution`, `strategicGame`
- Produces: `new ConventionalMissileExecution(player: Player, aim: TileRef)`(`ConstructionExecution`이 `build_unit ConventionalMissile`로 만든다), 스냅샷 이름 `"ConventionalMissile"`. 미사일 유닛은 `targetTile`·`targetUnit`·핵과 같은 `nukeState`(궤적)를 가지고, 맞으면 `reachedTarget`을 켜고 지워진다(화면 폭발 그림의 근거).

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/strategic/ConventionalMissile.test.ts`:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { activeConditions } from "@openfront/engine/domestic/DomesticEconomy";
import { VictoryProjectExecution } from "@openfront/engine/domestic/VictoryProjectExecution";
import { processVictoryProjectSecond } from "@openfront/engine/domestic/VictoryProjects";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { SAMLauncherExecution } from "@openfront/engine/execution/SAMLauncherExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { NukeProductionExecution } from "@openfront/engine/strategic/NukeProductionExecution";
import { buildLevel, grantTechs } from "../domestic/util";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, strategicGame } from "./util";

/** ConstructionExecution, then the missile's init, then its launch. */
const LAUNCH = 3;
/** Long enough for the missile to cross the plains at the test speed. */
const FLIGHT = 80;

// plains: red holds x 0-29 with a silo at (10, 10); blue holds x 60-99.
async function range(config: Parameters<typeof strategicGame>[1] = {}) {
  const game = await strategicGame("plains", { instantBuild: true, ...config });
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 60, 0, 40, 100);
  red.addGold(10_000_000n);
  blue.addGold(10_000_000n);
  red.addTroops(10_000);
  blue.addTroops(10_000);
  const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
  return { game, red, blue, silo };
}

function fire(game: Game, player: Player, aim: TileRef): void {
  game.addExecution(
    new ConstructionExecution(player, UnitType.ConventionalMissile, aim),
  );
}

function samAt(game: Game, owner: Player, x: number, y: number): Unit {
  const sam = owner.buildUnit(UnitType.SAMLauncher, game.ref(x, y), {});
  game.addExecution(new SAMLauncherExecution(owner, null, sam));
  return sam;
}

describe("conventional missile", () => {
  test("costs 500K and a silo slot, then takes one level off the enemy building and nothing else", async () => {
    const { game, red, blue, silo } = await range();
    const factory = blue.buildUnit(UnitType.Factory, game.ref(80, 50), {});
    blue.upgradeUnit(factory);
    const gold = red.gold();
    const tiles = blue.numTilesOwned();
    const troops = blue.troops();
    fire(game, red, game.ref(82, 51));
    executeTicks(game, LAUNCH);
    expect(red.gold()).toBe(gold - 500_000n);
    expect(silo.isInCooldown()).toBe(true);
    expect(red.units(UnitType.ConventionalMissile)).toHaveLength(1);
    executeTicks(game, FLIGHT);
    expect(factory.isActive()).toBe(true);
    expect(factory.level()).toBe(1);
    expect(blue.numTilesOwned()).toBe(tiles);
    expect(blue.troops()).toBe(troops);
    expect(red.units(UnitType.ConventionalMissile)).toHaveLength(0);
  });

  test("a level-1 building is destroyed", async () => {
    const { game, red, blue } = await range();
    const city = blue.buildUnit(UnitType.City, game.ref(80, 50), {});
    fire(game, red, city.tile());
    executeTicks(game, LAUNCH + FLIGHT);
    expect(city.isActive()).toBe(false);
  });

  test("a hit factory loses both nukes in production and one line", async () => {
    const { game, red, blue } = await range();
    const factory = blue.buildUnit(UnitType.Factory, game.ref(80, 50), {});
    blue.upgradeUnit(factory);
    game.addExecution(
      new NukeProductionExecution(blue, UnitType.AtomBomb),
      new NukeProductionExecution(blue, UnitType.HydrogenBomb),
    );
    executeTicks(game, 1);
    expect(blue.strategic()!.jobs()).toHaveLength(2);
    const gold = blue.gold();

    fire(game, red, factory.tile());
    executeTicks(game, LAUNCH + FLIGHT);
    expect(factory.level()).toBe(1);
    expect(blue.strategic()!.jobs()).toHaveLength(0);
    expect(blue.gold()).toBe(gold);

    // One line left: one new order fits, a second doesn't.
    game.addExecution(
      new NukeProductionExecution(blue, UnitType.AtomBomb),
      new NukeProductionExecution(blue, UnitType.AtomBomb),
    );
    executeTicks(game, 1);
    expect(blue.strategic()!.jobs()).toHaveLength(1);
  });

  test("an ally's building can't be picked, even once it disconnects", async () => {
    const { game, red, blue } = await range();
    blue.buildUnit(UnitType.City, game.ref(80, 50), {});
    red.createAllianceRequest(blue)?.accept();
    expect(red.canBuild(UnitType.ConventionalMissile, game.ref(80, 50))).toBe(
      false,
    );
    blue.markDisconnected(true);
    expect(red.canBuild(UnitType.ConventionalMissile, game.ref(80, 50))).toBe(
      false,
    );
  });

  test("a building that turns friendly mid-flight is spared", async () => {
    const { game, red, blue } = await range();
    const city = blue.buildUnit(UnitType.City, game.ref(80, 50), {});
    fire(game, red, city.tile());
    executeTicks(game, LAUNCH + 2);
    red.createAllianceRequest(blue)?.accept();
    executeTicks(game, FLIGHT);
    expect(city.isActive()).toBe(true);
  });

  test("a SAM shoots it down like a nuke", async () => {
    const { game, red, blue } = await range();
    const factory = blue.buildUnit(UnitType.Factory, game.ref(80, 50), {});
    blue.upgradeUnit(factory);
    samAt(game, blue, 78, 50);
    fire(game, red, factory.tile());
    executeTicks(game, LAUNCH + FLIGHT);
    expect(factory.level()).toBe(2);
    expect(red.units(UnitType.ConventionalMissile)).toHaveLength(0);
  });

  test("survives a snapshot mid-flight", async () => {
    const { game, red, blue } = await range();
    const city = blue.buildUnit(UnitType.City, game.ref(80, 50), {});
    fire(game, red, city.tile());
    executeTicks(game, LAUNCH + 2);
    await expectSnapshotRoundTrip(game, "plains", 40);
  });
});

describe("conventional missile with the other modes", () => {
  test("expanded warfare: SAMs shoot it as well as the planes", async () => {
    const { game, red, blue } = await range({ warfareExpansion: true });
    const city = blue.buildUnit(UnitType.City, game.ref(80, 50), {});
    samAt(game, blue, 78, 50);
    fire(game, red, city.tile());
    executeTicks(game, LAUNCH + FLIGHT);
    expect(city.isActive()).toBe(true);
  });

  test("domestic: a victory-project host loses a level but keeps its project; no 'attacking'", async () => {
    const { game, red, blue } = await range({ domesticMode: true });
    const host = buildLevel(game, blue, UnitType.ResearchInstitute, 80, 12, 3);
    grantTechs(blue, "space_program");
    game.addExecution(new VictoryProjectExecution(blue, "science", host.id()));
    executeTicks(game, 1);
    expect(blue.domestic()!.victoryProject()?.hostUnitId).toBe(host.id());

    fire(game, red, host.tile());
    executeTicks(game, LAUNCH + FLIGHT);
    expect(host.level()).toBe(2);
    expect(activeConditions(red, 1_000_000).has("attacking")).toBe(false);
    processVictoryProjectSecond(game, blue, blue.domestic()!);
    expect(blue.domestic()!.victoryProject()?.hostUnitId).toBe(host.id());
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/strategic/ConventionalMissile.test.ts --run`
Expected: FAIL — `expected 0 to have a length of 1`(아직 미사일 실행이 없어 `ConstructionExecution`이 "cannot be constructed"로 끝난다)

- [ ] **Step 3: 미사일 실행 작성**

`packages/engine/src/strategic/ConventionalMissileExecution.ts`:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  MessageType,
  TrajectoryTile,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  zInt,
  zNum,
  zPlayerRef,
  zRef,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, isUnit, Player, Unit } from "../game/Game";
import { UniversalPathFinding } from "../pathfinding/PathFinder";
import { ParabolaUniversalPathFinder } from "../pathfinding/PathFinder.Parabola";
import { PathStatus } from "../pathfinding/types";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import {
  ParabolaSchema,
  parabolaState,
  restoreParabola,
} from "../snapshot/PathfinderSnapshots";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { announceProductionLost } from "./Production";

/**
 * A conventional missile (spec §5): from the nearest loaded silo to the
 * enemy structure nearest the aimed tile, on a nuke's arc, so SAMs shoot
 * it like a nuke. On impact the structure loses one level (a level-1 one
 * is destroyed) and a factory loses every nuke in production. No blast,
 * no fallout, no alliance break. A structure that has turned friendly or
 * the shooter's own by then is spared.
 */
export class ConventionalMissileExecution implements Execution {
  private active = true;
  private mg: Game;
  private pathFinder: ParabolaUniversalPathFinder;
  private missile: Unit | null = null;
  private target: Unit | null = null;
  private src: TileRef | null = null;
  /** The target's tile, set at launch. */
  private dst: TileRef = 0;
  private speed = 0;
  private waitTicks = 0;

  constructor(
    private player: Player,
    private aim: TileRef,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
    this.speed = mg.config().nukeSpeed(UnitType.ConventionalMissile);
    this.pathFinder = UniversalPathFinding.Parabola(mg, {
      increment: this.speed,
      directionUp: true,
    });
  }

  tick(ticks: number): void {
    if (this.missile === null) {
      this.launch(ticks);
      return;
    }
    // Intercepted by a SAM.
    if (!this.missile.isActive()) {
      this.active = false;
      return;
    }
    if (this.waitTicks > 0) {
      this.missile.updateNukeState({ waitTicks: --this.waitTicks });
      return;
    }
    const result = this.pathFinder.next(this.src!, this.dst, this.speed);
    if (result.status === PathStatus.COMPLETE) {
      this.missile.move(result.node);
      // As NukeExecution: a SAM missile about to hit it decides first.
      if (!this.samMissileClose()) this.strike();
    } else if (result.status === PathStatus.NEXT) {
      this.missile.setTargetable(this.isTargetable(this.missile.tile()));
      this.missile.move(result.node);
      this.missile.setTrajectoryIndex(this.pathFinder.currentIndex());
    }
  }

  private launch(ticks: number): void {
    const spawn = this.player.canBuild(UnitType.ConventionalMissile, this.aim);
    const target =
      spawn === false ? null : this.player.missileTarget(this.aim);
    if (spawn === false || target === null) {
      this.active = false;
      return;
    }
    this.src = spawn;
    this.target = target;
    this.dst = target.tile();
    const silo = this.player
      .units(UnitType.MissileSilo)
      .find((s) => s.tile() === spawn);
    if (silo !== undefined) {
      // Same stagger as NukeExecution for launches from one silo in a tick.
      let lastDep = 0;
      for (const launchTick of silo.missileTimerQueue()) {
        lastDep = Math.max(launchTick + 1, lastDep + 1);
      }
      if (lastDep > this.mg.ticks()) {
        this.waitTicks += lastDep - this.mg.ticks();
      }
    }
    this.missile = this.player.buildUnit(UnitType.ConventionalMissile, spawn, {
      targetTile: this.dst,
      trajectory: this.trajectory(),
      targetUnit: target,
    });
    this.missile.updateNukeState({ waitTicks: this.waitTicks });
    this.recordMotionPlan(ticks);
    this.mg.displayIncomingUnit(
      this.missile.id(),
      "events_display.conventional_missile_inbound",
      MessageType.NUKE_INBOUND,
      target.owner().id(),
    );
    silo?.launch();
  }

  private strike(): void {
    const missile = this.missile!;
    const target = this.target!;
    this.active = false;
    missile.setReachedTarget();
    missile.delete(false);
    if (!target.isActive()) return;
    const owner = target.owner();
    if (owner === this.player || this.player.isFriendly(owner, true)) return;
    if ((owner.strategic()?.cancelJobsAt(target.id()) ?? 0) > 0) {
      announceProductionLost(this.mg, owner);
    }
    target.decreaseLevel(this.player);
    this.mg.displayMessage(
      "events_display.conventional_missile_hit",
      MessageType.NUKE_DETONATED,
      owner.id(),
      undefined,
      { name: this.player.displayName() },
      undefined,
      this.player.id(),
    );
  }

  private samMissileClose(): boolean {
    const missile = this.missile!;
    return (
      this.mg.nearbyUnits(
        this.dst,
        this.mg.config().defaultSamMissileSpeed(),
        UnitType.SAMMissile,
        ({ unit }) =>
          isUnit(unit) &&
          unit.owner() !== missile.owner() &&
          unit.targetUnit()?.id() === missile.id(),
      ).length > 0
    );
  }

  private trajectory(): TrajectoryTile[] {
    return (this.pathFinder.findPath(this.src!, this.dst) ?? []).map(
      (tile) => ({ tile, targetable: this.isTargetable(tile) }),
    );
  }

  /** Like a nuke: SAMs can reach it near its silo and near its target. */
  private isTargetable(tile: TileRef): boolean {
    const r2 = this.mg.config().defaultNukeTargetableRange() ** 2;
    return (
      this.mg.euclideanDistSquared(tile, this.dst) < r2 ||
      this.mg.euclideanDistSquared(this.src!, tile) < r2
    );
  }

  /** As NukeExecution.recordMotionPlan: the client derives the position each tick. */
  private recordMotionPlan(ticks: number): void {
    const pathFinder = UniversalPathFinding.Parabola(this.mg, {
      increment: this.speed,
      directionUp: true,
    });
    const path: TileRef[] = [this.src!];
    let result = pathFinder.next(this.src!, this.dst, this.speed);
    while (result.status === PathStatus.NEXT) {
      path.push(result.node);
      result = pathFinder.next(this.src!, this.dst, this.speed);
    }
    this.mg.recordMotionPlan({
      kind: "grid",
      unitId: this.missile!.id(),
      planId: 1,
      startTick: ticks + this.waitTicks + 1,
      ticksPerStep: 1,
      path,
    });
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return ConventionalMissileExecutionSnapshot.write({
      active: this.active,
      // mg and the pathfinder are both set by init.
      pathFinder: this.mg === undefined ? null : parabolaState(this.pathFinder),
      player: w.player(this.player),
      aim: this.aim,
      missile: w.unitOrNull(this.missile),
      target: w.unitOrNull(this.target),
      src: this.src,
      dst: this.dst,
      speed: this.speed,
      waitTicks: this.waitTicks,
    });
  }

  restoreSnapshot(s: ConventionalMissileState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.pathFinder !== null) {
      this.mg = r.game;
      this.pathFinder = restoreParabola(r.game, s.pathFinder);
    }
    this.player = r.player(s.player);
    this.aim = s.aim;
    this.missile = r.unitOrNull(s.missile);
    this.target = r.unitOrNull(s.target);
    this.src = s.src;
    this.dst = s.dst;
    this.speed = s.speed;
    this.waitTicks = s.waitTicks;
  }
}

const ConventionalMissileStateSchema = z.object({
  active: z.boolean(),
  pathFinder: ParabolaSchema.nullable(),
  player: zPlayerRef(),
  // Validated by ConstructionExecution.init before the missile exists.
  aim: zInt(),
  missile: zRef().nullable(),
  target: zRef().nullable(),
  src: zTile().nullable(),
  dst: zInt(),
  speed: zNum(),
  waitTicks: zInt(),
});
type ConventionalMissileState = z.infer<typeof ConventionalMissileStateSchema>;

export const ConventionalMissileExecutionSnapshot = execSnapshotType({
  name: "ConventionalMissile",
  version: 1,
  schema: ConventionalMissileStateSchema,
  cls: () => ConventionalMissileExecution,
});
```

- [ ] **Step 4: 연결 — 속도, 건설, SAM, 핵 폭발, 등록**

`packages/engine/src/configuration/EngineConfig.ts`: import에 `CONVENTIONAL_MISSILE_SPEED`를 더하고, `nukeSpeed`의 switch에서 `case UnitType.MIRVWarhead: return 22;` 뒤에 추가:

```ts
      case UnitType.ConventionalMissile:
        return CONVENTIONAL_MISSILE_SPEED;
```

`packages/engine/src/execution/ConstructionExecution.ts`: `import { ConventionalMissileExecution } from "../strategic/ConventionalMissileExecution";`를 추가하고 `completeConstruction`의 `case UnitType.Bomber:` 블록 뒤에:

```ts
      case UnitType.ConventionalMissile:
        this.mg.addExecution(
          new ConventionalMissileExecution(player, this.tile),
        );
        break;
```

`packages/engine/src/execution/SAMLauncherExecution.ts`의 목표 목록을 바꾼다(옵션이 꺼지면 원래 두 목록 그대로):

```ts
/** Strategic weapons: SAMs also shoot conventional missiles (spec §5). */
const STRATEGIC_TARGETS: readonly UnitType[] = [
  ...NUKE_TARGETS,
  UnitType.ConventionalMissile,
];
const WARFARE_STRATEGIC_TARGETS: readonly UnitType[] = [
  ...WARFARE_TARGETS,
  UnitType.ConventionalMissile,
];

function samTargetTypes(mg: Game): readonly UnitType[] {
  const config = mg.config();
  if (config.strategicWeapons()) {
    return config.warfareExpansion()
      ? WARFARE_STRATEGIC_TARGETS
      : STRATEGIC_TARGETS;
  }
  return config.warfareExpansion() ? WARFARE_TARGETS : NUKE_TARGETS;
}
```

`packages/engine/src/execution/SAMMissileExecution.ts`:
- `INTERCEPTED_UNIT_TRANSLATION_KEYS`에 `[UnitType.ConventionalMissile]: "unit_type.conventional_missile",`를, `INTERCEPTABLE`에 `UnitType.ConventionalMissile,`를 더한다.
- 명중 처리의 `} else {` / `// Record stats` / `this.mg.stats().bombIntercept(…)` 묶음을 다음으로 바꾼다(통계의 핵 종류에 미사일은 없다):

```ts
        } else if (type !== UnitType.ConventionalMissile) {
          // Record stats
          this.mg.stats().bombIntercept(this._owner, type as NukeType, 1);
        }
```

`packages/engine/src/execution/NukeExecution.ts`의 `detonate`에서 폭발이 건너뛰는 유닛 조건 `type === UnitType.CoastalBarrage` 뒤에 추가한다(비행 중인 미사일은 폭발에 지워지지 않는다; 옵션이 꺼지면 이런 유닛이 없다):

```ts
        type === UnitType.CoastalBarrage ||
        // Strategic weapons: a missile in flight, like a nuke.
        type === UnitType.ConventionalMissile
```

`packages/engine/src/snapshot/ExecutionRegistry.ts`에 `ConventionalMissileExecutionSnapshot`(`../strategic/ConventionalMissileExecution`)을 import해 `ConstructionExecutionSnapshot,` 앞에 넣는다(이름순). `tests/core/snapshot/FullGameSnapshot.test.ts`의 `STRATEGIC_ONLY_TYPES`를 `["ConventionalMissile", "NukeProduction", "Strategic"]`로 바꾼다.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest tests/strategic tests/nukes tests/warfare/Interception.test.ts tests/warfare/Bombing.test.ts --run && npx vitest tests/core/snapshot/FullGameSnapshot.test.ts -t "free for all" --run`
Expected: ConventionalMissile 9 tests와 나머지 PASS, FullGameSnapshot FFA 4 tests PASS

- [ ] **Step 6: 커밋**

```bash
npx prettier --write packages/engine/src/strategic packages/engine/src/configuration/EngineConfig.ts packages/engine/src/execution/ConstructionExecution.ts packages/engine/src/execution/SAMLauncherExecution.ts packages/engine/src/execution/SAMMissileExecution.ts packages/engine/src/execution/NukeExecution.ts packages/engine/src/snapshot/ExecutionRegistry.ts tests/strategic tests/core/snapshot/FullGameSnapshot.test.ts
git add packages/engine/src tests/strategic tests/core/snapshot/FullGameSnapshot.test.ts
git commit -m "feat(strategic): conventional missile takes a level off an enemy building"
```

---
### Task 4: 위성 준비와 목표 지정

**Files:**
- Create: `packages/engine/src/strategic/Satellite.ts`, `packages/engine/src/strategic/SatelliteOrders.ts`
- Modify: `packages/engine/src/strategic/StrategicExecution.ts` (`processSatellite`)
- Modify: `packages/engine/src/execution/ConstructionExecution.ts` (`case UnitType.Satellite`), `ExecutionManager.ts` (`satellite_target`), `packages/engine/src/snapshot/ExecutionRegistry.ts`
- Modify (test): `tests/core/snapshot/FullGameSnapshot.test.ts` (`STRATEGIC_ONLY_TYPES`에 `"SatelliteTarget"`)
- Test: `tests/strategic/SatellitePrep.test.ts`

**Interfaces:**
- Consumes: Task 1 `satelliteSpawn`, `holdsSiloSlot`, `SATELLITE_PREP_TICKS`, `SATELLITE_STRIKE_DELAY_TICKS`; Task 2 `StrategicExecution`, `strategicGame`
- Produces (`Satellite.ts`): `announceSatellite(mg, key, type: MessageType, player, params?, unitId?)`(모두에게, `name` = 그 나라), `startSatellitePrep(mg: Game, player: Player, tile: TileRef): void`, `canTargetWithSatellite(mg, player, target): boolean`, `processSatellite(mg, player, s: PlayerStrategic, now): void`(Task 5가 카운트다운 판정을 더한다); `new SatelliteTargetExecution(player: Player, targetID: PlayerID)`(`SatelliteOrders.ts`), 스냅샷 이름 `"SatelliteTarget"`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/strategic/SatellitePrep.test.ts`:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  DisplayMessageUpdate,
  GameUpdateType,
} from "@openfront/engine-api/game/GameUpdates";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { SatelliteTargetExecution } from "@openfront/engine/strategic/SatelliteOrders";
import { grantLaws, grantTechs } from "../domestic/util";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, strategicGame } from "./util";

// plains: red holds x 0-29 with a silo at (10, 10); blue holds x 60-99.
async function launchpad(config: Parameters<typeof strategicGame>[1] = {}) {
  const game = await strategicGame("plains", { instantBuild: true, ...config });
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 60, 0, 40, 100);
  red.addGold(100_000_000n);
  blue.addGold(10_000_000n);
  const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
  return { game, red, blue, silo };
}

/** build_unit Satellite: ConstructionExecution starts it on its first tick. */
function prepare(game: Game, player: Player, tile: TileRef): void {
  game.addExecution(new ConstructionExecution(player, UnitType.Satellite, tile));
}

function tickMessages(game: Game): DisplayMessageUpdate[] {
  return game.executeNextTick()[GameUpdateType.DisplayEvent];
}

const sat = (p: Player) => p.strategic()!.satellite();

describe("satellite preparation", () => {
  test("90 s at the player's silo for 25M, in front of everyone, then orbit", async () => {
    const { game, red, silo } = await launchpad();
    const gold = red.gold();
    prepare(game, red, game.ref(12, 12));
    executeTicks(game, 1);
    const started = tickMessages(game);
    expect(sat(red)).toMatchObject({ phase: "preparing", siloId: silo.id() });
    expect(red.gold()).toBe(gold - 25_000_000n);
    const msg = started.find(
      (m) => m.message === "events_display.satellite_preparing",
    );
    expect(msg?.playerID).toBeNull();
    expect(msg?.unitID).toBe(silo.id());

    executeTicks(game, 899);
    expect(sat(red).phase).toBe("preparing");
    const done = tickMessages(game);
    expect(sat(red)).toEqual({ phase: "orbit" });
    expect(
      done.some((m) => m.message === "events_display.satellite_in_orbit"),
    ).toBe(true);
  });

  test("a level-1 silo fires nothing else meanwhile; a level-2 silo keeps a slot", async () => {
    const { game, red, silo } = await launchpad();
    red.strategic()!.addStock(UnitType.AtomBomb);
    const target = game.ref(80, 50);
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    expect(red.canBuild(UnitType.AtomBomb, target)).toBe(false);
    red.upgradeUnit(silo);
    silo.reloadMissile();
    expect(red.canBuild(UnitType.AtomBomb, target)).toBe(silo.tile());
  });

  test("destroying the silo fails it: the gold is gone, a new try is allowed", async () => {
    const { game, red, silo } = await launchpad();
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    const gold = red.gold();
    silo.delete();
    const msgs = tickMessages(game);
    expect(sat(red)).toEqual({ phase: "none" });
    expect(red.gold()).toBe(gold);
    expect(
      msgs.some((m) => m.message === "events_display.satellite_prep_failed"),
    ).toBe(true);
    const again = red.buildUnit(UnitType.MissileSilo, game.ref(20, 20), {});
    expect(red.canBuild(UnitType.Satellite, again.tile())).toBe(again.tile());
  });

  test("capturing the silo fails it too", async () => {
    const { game, red, blue, silo } = await launchpad();
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    blue.captureUnit(silo);
    executeTicks(game, 1);
    expect(sat(red)).toEqual({ phase: "none" });
  });

  test("a conventional missile doesn't slow it; only destroying the silo stops it", async () => {
    const { game, red, blue, silo } = await launchpad();
    red.upgradeUnit(silo);
    silo.reloadMissile();
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    const before = sat(red);
    blue.buildUnit(UnitType.MissileSilo, game.ref(80, 50), {});
    game.addExecution(
      new ConstructionExecution(blue, UnitType.ConventionalMissile, silo.tile()),
    );
    executeTicks(game, 90);
    expect(silo.level()).toBe(1);
    expect(sat(red)).toEqual(before);
  });

  test("one at a time, and never again once in orbit", async () => {
    const { game, red, silo } = await launchpad();
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    const second = red.buildUnit(UnitType.MissileSilo, game.ref(20, 20), {});
    expect(red.canBuild(UnitType.Satellite, second.tile())).toBe(false);
    red.strategic()!.setSatellite({ phase: "spent" });
    expect(red.canBuild(UnitType.Satellite, second.tile())).toBe(false);
  });

  test("survives a snapshot mid-preparation", async () => {
    const { game, red, silo } = await launchpad();
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    await expectSnapshotRoundTrip(game, "plains", 30);
  });
});

describe("aiming the satellite", () => {
  test("a nation is struck 60 s later, and everyone hears who aims at whom", async () => {
    const { game, red, blue } = await launchpad();
    red.strategic()!.setSatellite({ phase: "orbit" });
    game.addExecution(new SatelliteTargetExecution(red, blue.id()));
    const msgs = tickMessages(game);
    const now = game.ticks() - 1;
    expect(sat(red)).toEqual({
      phase: "targeted",
      target: blue.smallID(),
      strikeTick: now + 600,
      interceptors: [],
    });
    const msg = msgs.find(
      (m) => m.message === "events_display.satellite_targeted",
    );
    expect(msg?.playerID).toBeNull();
    expect(msg?.params).toEqual({
      name: "red",
      target: "blue",
      targetID: blue.smallID(),
    });
  });

  test("not before orbit, not itself, not an ally", async () => {
    const { game, red, blue } = await launchpad();
    game.addExecution(new SatelliteTargetExecution(red, blue.id()));
    executeTicks(game, 1);
    expect(sat(red)).toEqual({ phase: "none" });

    red.strategic()!.setSatellite({ phase: "orbit" });
    game.addExecution(new SatelliteTargetExecution(red, red.id()));
    executeTicks(game, 1);
    expect(sat(red)).toEqual({ phase: "orbit" });

    red.createAllianceRequest(blue)?.accept();
    game.addExecution(new SatelliteTargetExecution(red, blue.id()));
    executeTicks(game, 1);
    expect(sat(red)).toEqual({ phase: "orbit" });
  });

  test("survives a snapshot while the strike counts down", async () => {
    const { game, red, blue } = await launchpad();
    red.strategic()!.setSatellite({ phase: "orbit" });
    game.addExecution(new SatelliteTargetExecution(red, blue.id()));
    executeTicks(game, 1);
    await expectSnapshotRoundTrip(game, "plains", 20);
  });
});

describe("the satellite in domestic mode", () => {
  test("the space program unlocks it and the nuclear law discounts it", async () => {
    const { game, red, silo } = await launchpad({ domesticMode: true });
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    expect(sat(red)).toEqual({ phase: "none" });
    grantTechs(red, "space_program");
    grantLaws(red, { nuclear: "A" });
    const gold = red.gold();
    prepare(game, red, silo.tile());
    executeTicks(game, 2);
    expect(sat(red).phase).toBe("preparing");
    expect(red.gold()).toBe(gold - 20_000_000n);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/strategic/SatellitePrep.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine/strategic/SatelliteOrders'`

- [ ] **Step 3: 위성 함수**

`packages/engine/src/strategic/Satellite.ts`:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { SATELLITE_PREP_TICKS } from "@openfront/engine-lib/strategic/Strategic";
import type { Game, Player } from "../game/Game";
import type { PlayerStrategic } from "./PlayerStrategic";

/** A satellite message for every player, naming `player` (re-resolved through focusPlayerID). */
export function announceSatellite(
  mg: Game,
  key: string,
  type: MessageType,
  player: Player,
  params: Record<string, string | number> = {},
  unitId?: number,
): void {
  mg.displayMessage(
    key,
    type,
    null,
    undefined,
    { name: player.displayName(), ...params },
    unitId,
    player.id(),
  );
}

/** build_unit Satellite at a silo (spec §6.1): pays and starts the 90 s preparation there. */
export function startSatellitePrep(
  mg: Game,
  player: Player,
  tile: TileRef,
): void {
  const s = player.strategic();
  const spawn = player.canBuild(UnitType.Satellite, tile);
  if (s === null || spawn === false) return;
  const silo = player.units(UnitType.MissileSilo).find((u) => u.tile() === spawn);
  if (silo === undefined) return;
  player.removeGold(mg.unitInfo(UnitType.Satellite).cost(mg, player));
  const now = mg.ticks();
  s.setSatellite({
    phase: "preparing",
    siloId: silo.id(),
    startTick: now,
    readyTick: now + SATELLITE_PREP_TICKS,
  });
  announceSatellite(
    mg,
    "events_display.satellite_preparing",
    MessageType.NUKE_INBOUND,
    player,
    {},
    silo.id(),
  );
}

/** Whether `player` may aim its satellite at `target` (spec §6.2). */
export function canTargetWithSatellite(
  mg: Game,
  player: Player,
  target: Player,
): boolean {
  return (
    target !== player &&
    target.isAlive() &&
    !player.isFriendly(target, true) &&
    !mg.isSpawnImmunityActive()
  );
}

/**
 * One tick of a player's satellite (spec §6.1): a preparation fails when
 * its silo is gone or has a new owner (the gold is lost, a new try is
 * allowed) and reaches orbit when its time is up.
 */
export function processSatellite(
  mg: Game,
  player: Player,
  s: PlayerStrategic,
  now: number,
): void {
  const sat = s.satellite();
  if (sat.phase !== "preparing") return;
  const silo = mg.unit(sat.siloId);
  if (silo === undefined || !silo.isActive() || silo.owner() !== player) {
    s.setSatellite({ phase: "none" });
    announceSatellite(
      mg,
      "events_display.satellite_prep_failed",
      MessageType.UNIT_DESTROYED,
      player,
    );
  } else if (now >= sat.readyTick) {
    s.setSatellite({ phase: "orbit" });
    announceSatellite(
      mg,
      "events_display.satellite_in_orbit",
      MessageType.NUKE_INBOUND,
      player,
    );
  }
}
```

- [ ] **Step 4: 목표 지정 명령**

`packages/engine/src/strategic/SatelliteOrders.ts`:

```ts
import { MessageType, PlayerID } from "@openfront/engine-api/game/GameTypes";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { SATELLITE_STRIKE_DELAY_TICKS } from "@openfront/engine-lib/strategic/Strategic";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { announceSatellite, canTargetWithSatellite } from "./Satellite";

/**
 * satellite_target (spec §6.2): aims the sender's satellite in orbit at a
 * nation; the strike lands SATELLITE_STRIKE_DELAY_TICKS later unless an
 * interceptor downs it. Everyone hears "(A) → (B)".
 */
export class SatelliteTargetExecution implements Execution {
  constructor(
    private player: Player,
    private targetID: PlayerID,
  ) {}

  init(mg: Game, _ticks: number): void {
    const s = this.player.strategic();
    if (s === null || !this.player.isAlive()) return;
    if (s.satellite().phase !== "orbit" || !mg.hasPlayer(this.targetID)) return;
    const target = mg.player(this.targetID);
    if (!canTargetWithSatellite(mg, this.player, target)) return;
    s.setSatellite({
      phase: "targeted",
      target: target.smallID(),
      strikeTick: mg.ticks() + SATELLITE_STRIKE_DELAY_TICKS,
      interceptors: [],
    });
    target.updateRelation(this.player, -100);
    announceSatellite(
      mg,
      "events_display.satellite_targeted",
      MessageType.NUKE_INBOUND,
      this.player,
      { target: target.displayName(), targetID: target.smallID() },
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
    return SatelliteTargetExecutionSnapshot.write({
      player: w.player(this.player),
      targetID: this.targetID,
    });
  }

  restoreSnapshot(s: SatelliteTargetState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.targetID = s.targetID;
  }
}

const SatelliteTargetStateSchema = z.object({
  player: zPlayerRef(),
  // Validated in init: the target may not exist.
  targetID: z.string(),
});
type SatelliteTargetState = z.infer<typeof SatelliteTargetStateSchema>;

export const SatelliteTargetExecutionSnapshot = execSnapshotType({
  name: "SatelliteTarget",
  version: 1,
  schema: SatelliteTargetStateSchema,
  cls: () => SatelliteTargetExecution,
});
```

- [ ] **Step 5: 연결 — 시계, 건설, 명령, 등록**

`packages/engine/src/strategic/StrategicExecution.ts`: `import { processSatellite } from "./Satellite";`를 추가하고 `tick`의 `processProduction(this.mg, player, s, now);` 뒤에 `processSatellite(this.mg, player, s, now);`를 추가한다.

`packages/engine/src/execution/ConstructionExecution.ts`: `import { startSatellitePrep } from "../strategic/Satellite";`를 추가하고 `completeConstruction`의 `case UnitType.ConventionalMissile:` 블록 뒤에:

```ts
      case UnitType.Satellite:
        // No unit: the satellite is prepared at the chosen silo.
        startSatellitePrep(this.mg, player, this.tile);
        break;
```

`packages/engine/src/execution/ExecutionManager.ts`: `import { SatelliteTargetExecution } from "../strategic/SatelliteOrders";`를 추가하고 `case "produce_nuke":` 뒤에:

```ts
      case "satellite_target":
        return new SatelliteTargetExecution(player, intent.target);
```

`ExecutionRegistry.ts`에 `SatelliteTargetExecutionSnapshot`(`../strategic/SatelliteOrders`)을 이름순(`SAMMissileExecutionSnapshot,` 뒤)으로 넣는다. `FullGameSnapshot.test.ts`의 `STRATEGIC_ONLY_TYPES`를 `["ConventionalMissile", "NukeProduction", "SatelliteTarget", "Strategic"]`로 바꾼다.

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/strategic --run && npx vitest tests/core/snapshot/FullGameSnapshot.test.ts -t "free for all" --run`
Expected: SatellitePrep 11 tests와 나머지 strategic 테스트 PASS, FullGameSnapshot FFA 4 tests PASS

- [ ] **Step 7: 커밋**

```bash
npx prettier --write packages/engine/src/strategic packages/engine/src/execution/ConstructionExecution.ts packages/engine/src/execution/ExecutionManager.ts packages/engine/src/snapshot/ExecutionRegistry.ts tests/strategic tests/core/snapshot/FullGameSnapshot.test.ts
git add packages/engine/src tests/strategic tests/core/snapshot/FullGameSnapshot.test.ts
git commit -m "feat(strategic): satellite preparation at a silo and target selection"
```

---
### Task 5: 위성 요격과 포격

**Files:**
- Create: `packages/engine/src/strategic/Interception.ts`, `packages/engine/src/strategic/OrbitalStrike.ts`
- Modify: `packages/engine/src/strategic/Satellite.ts` (카운트다운 판정, `firstReadySilo`), `packages/engine/src/strategic/SatelliteOrders.ts` (`SatelliteInterceptExecution`)
- Modify: `packages/engine/src/game/Game.ts`, `GameImpl.ts` (`queueWaterConversion(tile, force?)`)
- Modify: `packages/engine/src/execution/ExecutionManager.ts` (`intercept_satellite`), `packages/engine/src/snapshot/ExecutionRegistry.ts`
- Modify (test): `tests/core/snapshot/FullGameSnapshot.test.ts` (`STRATEGIC_ONLY_TYPES`에 `"SatelliteIntercept"`)
- Test: `tests/strategic/InterceptOdds.test.ts`, `tests/strategic/SatelliteIntercept.test.ts`, `tests/strategic/OrbitalStrike.test.ts`

**Interfaces:**
- Consumes: Task 1 `INTERCEPT_ODDS`, `INTERCEPTOR_FLIGHT_TICKS`, `STRIKE_*`, `strikeCraterRadius`, `OrbitalStrikeUpdate`; Task 4 `processSatellite`, `announceSatellite`, `SatelliteTargetExecution`
- Produces:
  - `interceptorHits(tick: number, ownerSmallID: number, shot: InterceptorData, index: number): boolean` (`Interception.ts`, 테스트가 mock한다)
  - `orbitalStrike(mg: Game, attacker: Player, target: Player): TileRef[]` (`OrbitalStrike.ts`, 착탄점: 크레이터 중심, 그다음 건물 자리)
  - `firstReadySilo(player: Player): Unit | null` (`Satellite.ts`, Task 6이 쓴다)
  - `new SatelliteInterceptExecution(player: Player, attackerID: PlayerID, nukeType: InterceptorNuke)`, 스냅샷 이름 `"SatelliteIntercept"`
  - `Game.queueWaterConversion(tile: TileRef, force?: boolean)`: `force`면 `waterNukes`가 꺼져 있어도 바다로 바꾼다

- [ ] **Step 1: 실패하는 테스트 작성 — 확률**

`tests/strategic/InterceptOdds.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { InterceptorNuke } from "@openfront/engine-api/strategic/StrategicTypes";
import { interceptorHits } from "@openfront/engine/strategic/Interception";

const shot = (type: InterceptorNuke, tick: number) => ({
  by: 5,
  type,
  resolveTick: tick,
});

describe("interceptor odds", () => {
  test("hydrogen bombs hit 20% and atom bombs 4% of the time, the same on every client", () => {
    let hydrogen = 0;
    let atom = 0;
    for (let tick = 0; tick < 10_000; tick++) {
      if (interceptorHits(tick, 3, shot(UnitType.HydrogenBomb, tick), 0)) {
        hydrogen++;
      }
      if (interceptorHits(tick, 3, shot(UnitType.AtomBomb, tick), 0)) atom++;
    }
    expect(hydrogen).toBeGreaterThan(1850);
    expect(hydrogen).toBeLessThan(2150);
    expect(atom).toBeGreaterThan(330);
    expect(atom).toBeLessThan(470);
    const s = shot(UnitType.HydrogenBomb, 1234);
    expect(interceptorHits(1234, 3, s, 1)).toBe(interceptorHits(1234, 3, s, 1));
  });
});
```

- [ ] **Step 2: 실패하는 테스트 작성 — 요격**

`tests/strategic/SatelliteIntercept.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  DisplayMessageUpdate,
  GameUpdateType,
} from "@openfront/engine-api/game/GameUpdates";
import {
  InterceptorData,
  InterceptorNuke,
} from "@openfront/engine-api/strategic/StrategicTypes";
import { Game, Player } from "@openfront/engine/game/Game";
import {
  SatelliteInterceptExecution,
  SatelliteTargetExecution,
} from "@openfront/engine/strategic/SatelliteOrders";
import { vi } from "vitest";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, GREEN, own, RED, strategicGame } from "./util";

// Whether an interceptor hits is a seeded roll (InterceptOdds.test.ts);
// here each test picks the outcome and records what was judged.
const control = vi.hoisted(() => ({ hit: false, judged: [] as string[] }));
vi.mock("@openfront/engine/strategic/Interception", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@openfront/engine/strategic/Interception")
  >()),
  interceptorHits: (_t: number, _o: number, shot: InterceptorData) => {
    control.judged.push(shot.type);
    return control.hit;
  },
}));

// plains: red (the satellite's owner) holds x 0-29, green x 30-59 with a
// silo at (40, 50), blue (the target) x 60-99 with a city at (80, 50) and
// a silo at (90, 90).
async function countdown() {
  const game = await strategicGame("plains", { instantBuild: true }, [
    RED,
    BLUE,
    GREEN,
  ]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const green = own(game, GREEN.id, 30, 0, 30, 100);
  const blue = own(game, BLUE.id, 60, 0, 40, 100);
  const city = blue.buildUnit(UnitType.City, game.ref(80, 50), {});
  const greenSilo = green.buildUnit(UnitType.MissileSilo, game.ref(40, 50), {});
  const blueSilo = blue.buildUnit(UnitType.MissileSilo, game.ref(90, 90), {});
  red.strategic()!.setSatellite({ phase: "orbit" });
  game.addExecution(new SatelliteTargetExecution(red, blue.id()));
  executeTicks(game, 1);
  const strikeTick = (
    red.strategic()!.satellite() as { strikeTick: number }
  ).strikeTick;
  return { game, red, green, blue, city, greenSilo, blueSilo, strikeTick };
}

function intercept(
  game: Game,
  player: Player,
  attacker: Player,
  type: InterceptorNuke,
): void {
  game.addExecution(
    new SatelliteInterceptExecution(player, attacker.id(), type),
  );
}

function tickMessages(game: Game): DisplayMessageUpdate[] {
  return game.executeNextTick()[GameUpdateType.DisplayEvent];
}

const sat = (p: Player) => p.strategic()!.satellite();

describe("intercepting a satellite", () => {
  beforeEach(() => {
    control.hit = false;
    control.judged = [];
  });

  test("anyone may fire a stockpiled bomb from any silo; a hit downs the satellite for good", async () => {
    control.hit = true;
    const { game, red, green, city, greenSilo } = await countdown();
    green.strategic()!.addStock(UnitType.AtomBomb);
    intercept(game, green, red, UnitType.AtomBomb);
    executeTicks(game, 1);
    expect(green.strategic()!.stock(UnitType.AtomBomb)).toBe(0);
    expect(greenSilo.isInCooldown()).toBe(true);
    expect(sat(red)).toMatchObject({
      phase: "targeted",
      interceptors: [{ by: green.smallID(), type: UnitType.AtomBomb }],
    });
    executeTicks(game, 29);
    const msgs = tickMessages(game);
    expect(sat(red)).toEqual({ phase: "spent" });
    const hit = msgs.find(
      (m) => m.message === "events_display.satellite_intercept_hit",
    );
    expect(hit?.playerID).toBeNull();
    expect(hit?.params).toEqual({ name: "green", unit: "unit_type.atom_bomb" });
    executeTicks(game, 700);
    expect(city.isActive()).toBe(true);
  });

  test("a miss is announced and the strike still lands", async () => {
    const { game, red, blue, city } = await countdown();
    blue.strategic()!.addStock(UnitType.HydrogenBomb);
    intercept(game, blue, red, UnitType.HydrogenBomb);
    executeTicks(game, 30);
    const msgs = tickMessages(game);
    expect(
      msgs.some((m) => m.message === "events_display.satellite_intercept_miss"),
    ).toBe(true);
    expect(sat(red)).toMatchObject({ phase: "targeted", interceptors: [] });
    executeTicks(game, 600);
    expect(city.isActive()).toBe(false);
  });

  test("an interceptor fired the tick before the strike is still judged before it lands", async () => {
    control.hit = true;
    const { game, red, blue, city, strikeTick } = await countdown();
    blue.strategic()!.addStock(UnitType.HydrogenBomb);
    executeTicks(game, strikeTick - 1 - game.ticks());
    intercept(game, blue, red, UnitType.HydrogenBomb);
    executeTicks(game, 1); // fired at strikeTick - 1
    executeTicks(game, 10); // the clock has run out: the strike waits
    expect(sat(red).phase).toBe("targeted");
    expect(city.isActive()).toBe(true);
    executeTicks(game, 25);
    expect(sat(red)).toEqual({ phase: "spent" });
    expect(city.isActive()).toBe(true);
  });

  test("a late miss lets the strike land right after its judgement", async () => {
    const { game, red, blue, city, strikeTick } = await countdown();
    blue.strategic()!.addStock(UnitType.AtomBomb);
    executeTicks(game, strikeTick - 1 - game.ticks());
    intercept(game, blue, red, UnitType.AtomBomb);
    executeTicks(game, 11);
    expect(city.isActive()).toBe(true);
    executeTicks(game, 25);
    expect(city.isActive()).toBe(false);
    expect(sat(red)).toEqual({ phase: "spent" });
  });

  test("both kinds can go up; each is judged once", async () => {
    const { game, red, blue, blueSilo } = await countdown();
    blue.upgradeUnit(blueSilo);
    blueSilo.reloadMissile();
    blue.strategic()!.addStock(UnitType.HydrogenBomb);
    blue.strategic()!.addStock(UnitType.AtomBomb);
    intercept(game, blue, red, UnitType.HydrogenBomb);
    intercept(game, blue, red, UnitType.AtomBomb);
    executeTicks(game, 31);
    expect(control.judged).toEqual([
      UnitType.HydrogenBomb,
      UnitType.AtomBomb,
    ]);
  });

  test("no shot from the satellite's owner, without stock, without a ready silo, or after the clock", async () => {
    const { game, red, blue, blueSilo, strikeTick } = await countdown();
    red.strategic()!.addStock(UnitType.HydrogenBomb);
    red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    intercept(game, red, red, UnitType.HydrogenBomb);
    intercept(game, blue, red, UnitType.HydrogenBomb); // no stock
    executeTicks(game, 1);
    expect(sat(red)).toMatchObject({ interceptors: [] });
    expect(red.strategic()!.stock(UnitType.HydrogenBomb)).toBe(1);

    blue.strategic()!.addStock(UnitType.HydrogenBomb);
    blueSilo.launch(); // reloading
    intercept(game, blue, red, UnitType.HydrogenBomb);
    executeTicks(game, 1);
    expect(sat(red)).toMatchObject({ interceptors: [] });

    blueSilo.reloadMissile();
    executeTicks(game, strikeTick - game.ticks());
    intercept(game, blue, red, UnitType.HydrogenBomb); // at strikeTick
    executeTicks(game, 1);
    expect(blue.strategic()!.stock(UnitType.HydrogenBomb)).toBe(1);
  });

  test("survives a snapshot with an interceptor in flight", async () => {
    const { game, red, blue } = await countdown();
    blue.strategic()!.addStock(UnitType.HydrogenBomb);
    intercept(game, blue, red, UnitType.HydrogenBomb);
    executeTicks(game, 1);
    await expectSnapshotRoundTrip(game, "plains", 40);
  });
});
```

- [ ] **Step 3: 실패하는 테스트 작성 — 포격**

`tests/strategic/OrbitalStrike.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { VictoryProjectExecution } from "@openfront/engine/domestic/VictoryProjectExecution";
import { processVictoryProjectSecond } from "@openfront/engine/domestic/VictoryProjects";
import { SAMLauncherExecution } from "@openfront/engine/execution/SAMLauncherExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { orbitalStrike } from "@openfront/engine/strategic/OrbitalStrike";
import { SatelliteTargetExecution } from "@openfront/engine/strategic/SatelliteOrders";
import { buildLevel, grantTechs } from "../domestic/util";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, strategicGame } from "./util";

// plains: red holds x 0-29, blue (the target) x 30-99 — 7,000 tiles, so
// craters have the 10-tile maximum radius.
async function theater(config: Parameters<typeof strategicGame>[1] = {}) {
  const game = await strategicGame("plains", { instantBuild: true, ...config });
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 70, 100);
  blue.addGold(100_000_000n);
  blue.addTroops(100_000);
  return { game, red, blue };
}

/** Red's satellite in orbit aims at `target`; returns the strike tick. */
function aim(game: Game, red: Player, target: Player): number {
  red.strategic()!.setSatellite({ phase: "orbit" });
  game.addExecution(new SatelliteTargetExecution(red, target.id()));
  executeTicks(game, 1);
  return (red.strategic()!.satellite() as { strikeTick: number }).strikeTick;
}

const sat = (p: Player) => p.strategic()!.satellite();

describe("the orbital strike", () => {
  test("destroys every building of the target, warfare and domestic ones included", async () => {
    const { game, red, blue } = await theater({
      domesticMode: true,
      warfareExpansion: true,
    });
    const types = [
      UnitType.City,
      UnitType.Port,
      UnitType.Factory,
      UnitType.DefensePost,
      UnitType.SAMLauncher,
      UnitType.MissileSilo,
      UnitType.ResearchInstitute,
      UnitType.AdminOffice,
      UnitType.CoastalBattery,
      UnitType.Airport,
    ];
    const buildings = types.map((t, i) =>
      blue.buildUnit(t, game.ref(40 + 5 * i, 20 + (i % 3) * 25), {}),
    );
    const redCity = red.buildUnit(UnitType.City, game.ref(10, 50), {});
    orbitalStrike(game, red, blue);
    for (const b of buildings) expect(b.isActive(), b.type()).toBe(false);
    expect(redCity.isActive()).toBe(true);
  });

  test("kills 70% of the target's troops", async () => {
    const { game, red, blue } = await theater();
    const troops = blue.troops();
    orbitalStrike(game, red, blue);
    expect(blue.troops()).toBe(troops - Math.floor((troops * 70) / 100));
  });

  test("turns building sites and about 30% more of the land to sea, even without water nukes", async () => {
    const { game, red, blue } = await theater();
    const city = blue.buildUnit(UnitType.City, game.ref(70, 50), {});
    const before = blue.numTilesOwned();
    const land = [...blue.tiles()];
    orbitalStrike(game, red, blue);
    executeTicks(game, 1); // the water flush
    expect(game.config().waterNukes()).toBe(false);
    expect(game.isLand(city.tile())).toBe(false);
    const sea = land.filter((t) => !game.isLand(t));
    expect(sea.length).toBeGreaterThanOrEqual(Math.floor(before * 0.3));
    expect(sea.length).toBeLessThan(before * 0.4);
    expect(blue.numTilesOwned()).toBe(before - sea.length);
  });

  test("only the target's land turns to sea, even on a border and in a corner", async () => {
    const { game, red, blue } = await theater();
    blue.buildUnit(UnitType.City, game.ref(30, 0), {}); // next to red, map edge
    blue.buildUnit(UnitType.City, game.ref(99, 99), {}); // map corner
    const redLand = [...red.tiles()];
    orbitalStrike(game, red, blue);
    executeTicks(game, 1);
    expect(redLand.every((t) => game.isLand(t) && game.owner(t) === red)).toBe(
      true,
    );
    expect(game.isLand(game.ref(99, 99))).toBe(false);
  });

  test("the same strike falls the same way", async () => {
    const strike = async () => {
      const { game, red, blue } = await theater();
      blue.buildUnit(UnitType.City, game.ref(70, 50), {});
      const impacts = orbitalStrike(game, red, blue);
      return { impacts, left: [...blue.tiles()].sort((a, b) => a - b) };
    };
    expect(await strike()).toEqual(await strike());
  });

  test("lands 60 s after the target is chosen, past SAMs, once; the stockpile stays", async () => {
    const { game, red, blue } = await theater();
    const city = blue.buildUnit(UnitType.City, game.ref(70, 50), {});
    const sam = blue.buildUnit(UnitType.SAMLauncher, game.ref(72, 50), {});
    game.addExecution(new SAMLauncherExecution(blue, null, sam));
    blue.strategic()!.addStock(UnitType.HydrogenBomb);
    const strikeTick = aim(game, red, blue);
    executeTicks(game, strikeTick - game.ticks());
    expect(city.isActive()).toBe(true);

    const updates = game.executeNextTick();
    expect(city.isActive()).toBe(false);
    const strikes = updates[GameUpdateType.OrbitalStrike];
    expect(strikes).toHaveLength(1);
    expect(strikes[0]).toMatchObject({
      attackerID: red.smallID(),
      targetID: blue.smallID(),
    });
    expect(strikes[0].impacts).toContain(city.tile());
    expect(
      updates[GameUpdateType.DisplayEvent].some(
        (m) => m.message === "events_display.satellite_strike_landed",
      ),
    ).toBe(true);
    expect(sat(red)).toEqual({ phase: "spent" });
    expect(blue.strategic()!.stock(UnitType.HydrogenBomb)).toBe(1);
    executeTicks(game, 700);
    expect(game.executeNextTick()[GameUpdateType.OrbitalStrike]).toHaveLength(0);
  });

  test("a target that turns friendly is spared and the satellite returns to orbit", async () => {
    const { game, red, blue } = await theater();
    const city = blue.buildUnit(UnitType.City, game.ref(70, 50), {});
    aim(game, red, blue);
    red.createAllianceRequest(blue)?.accept();
    executeTicks(game, 600);
    expect(city.isActive()).toBe(true);
    expect(sat(red)).toEqual({ phase: "orbit" });
  });

  test("a target eliminated before the strike leaves the satellite in orbit", async () => {
    const { game, red, blue } = await theater();
    aim(game, red, blue);
    for (const t of [...blue.tiles()]) blue.relinquish(t);
    executeTicks(game, 600);
    expect(sat(red)).toEqual({ phase: "orbit" });
  });

  test("domestic: a victory project in a struck building fails", async () => {
    const { game, red, blue } = await theater({ domesticMode: true });
    const host = buildLevel(game, blue, UnitType.ResearchInstitute, 80, 12, 3);
    grantTechs(blue, "space_program");
    game.addExecution(new VictoryProjectExecution(blue, "science", host.id()));
    executeTicks(game, 1);
    expect(blue.domestic()!.victoryProject()?.hostUnitId).toBe(host.id());
    orbitalStrike(game, red, blue);
    expect(host.isActive()).toBe(false);
    processVictoryProjectSecond(game, blue, blue.domestic()!);
    expect(blue.domestic()!.victoryProject()).toBeNull();
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `npx vitest tests/strategic/InterceptOdds.test.ts tests/strategic/SatelliteIntercept.test.ts tests/strategic/OrbitalStrike.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine/strategic/Interception'`

- [ ] **Step 5: 요격 판정과 포격 효과**

`packages/engine/src/strategic/Interception.ts`:

```ts
import { InterceptorData } from "@openfront/engine-api/strategic/StrategicTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { INTERCEPT_ODDS } from "@openfront/engine-lib/strategic/Strategic";

/**
 * Whether one interceptor hits the satellite (spec §6.3: hydrogen 20%,
 * atom 4%). A fresh PRNG seeded by the tick, the satellite's owner, the
 * shooter and the shot's place among this tick's arrivals: nothing shared
 * rolls, and every client agrees.
 */
export function interceptorHits(
  tick: number,
  ownerSmallID: number,
  shot: InterceptorData,
  index: number,
): boolean {
  return new PseudoRandom(
    tick * 7919 + ownerSmallID * 104_729 + shot.by * 131 + index,
  ).chance(INTERCEPT_ODDS[shot.type]);
}
```

`packages/engine/src/strategic/OrbitalStrike.ts`:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { Structures } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  STRIKE_SCATTER_PCT,
  STRIKE_STRUCTURE_RADIUS,
  STRIKE_TROOP_LOSS_PCT,
  strikeCraterRadius,
} from "@openfront/engine-lib/strategic/Strategic";
import type { Game, Player } from "../game/Game";

/** Enough tries to cover 30% with overlapping craters on any nation. */
const MAX_CRATER_ATTEMPTS = 400;

/**
 * The orbital strike on `target` (spec §6.4): every building destroyed by
 * `attacker`, 70% of the troops killed, and land turned to sea at each
 * building site (STRIKE_STRUCTURE_RADIUS) plus scattered craters until
 * about STRIKE_SCATTER_PCT more of the land is gone — the target's land
 * only, even without water nukes. Seeded by the tick and both players, so
 * every client scatters alike. Returns the impact tiles: the crater
 * centers, then the building sites.
 */
export function orbitalStrike(
  mg: Game,
  attacker: Player,
  target: Player,
): TileRef[] {
  const sites: TileRef[] = [];
  const craters: TileRef[] = [];
  const sea = new Set<TileRef>();
  const structures = target.units(Structures.types);
  for (const unit of structures) {
    sites.push(unit.tile());
    addOwnedDisk(mg, target, unit.tile(), STRIKE_STRUCTURE_RADIUS, sea);
  }
  for (const unit of structures) {
    if (unit.isActive()) unit.delete(true, attacker);
  }

  const land = Array.from(target.tiles()).sort((a, b) => a - b);
  const goal = Math.floor((land.length * STRIKE_SCATTER_PCT) / 100);
  const radius = strikeCraterRadius(land.length);
  const rand = new PseudoRandom(
    mg.ticks() * 7919 + target.smallID() * 104_729 + attacker.smallID(),
  );
  let scattered = 0;
  for (
    let attempt = 0;
    scattered < goal && attempt < MAX_CRATER_ATTEMPTS;
    attempt++
  ) {
    const center = land[rand.nextInt(0, land.length)];
    if (sea.has(center)) continue;
    const before = sea.size;
    addOwnedDisk(mg, target, center, radius, sea);
    scattered += sea.size - before;
    craters.push(center);
  }

  target.removeTroops(
    Math.floor((target.troops() * STRIKE_TROOP_LOSS_PCT) / 100),
  );
  for (const tile of sea) {
    target.relinquish(tile);
    mg.queueWaterConversion(tile, true);
    mg.queueNukeImpact(tile);
  }
  return [...craters, ...sites];
}

/** Adds the owner's passable land within `r` tiles of `center` to `into`. */
function addOwnedDisk(
  mg: Game,
  owner: Player,
  center: TileRef,
  r: number,
  into: Set<TileRef>,
): void {
  const cx = mg.x(center);
  const cy = mg.y(center);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      if (!mg.isValidCoord(cx + dx, cy + dy)) continue;
      const tile = mg.ref(cx + dx, cy + dy);
      if (
        mg.owner(tile) === owner &&
        mg.isLand(tile) &&
        !mg.isImpassable(tile)
      ) {
        into.add(tile);
      }
    }
  }
}
```

`packages/engine/src/game/Game.ts`의 `queueWaterConversion(tile: TileRef): void;`를 다음으로 바꾼다:

```ts
  /**
   * Queue a land tile for conversion to water (batched every few ticks).
   * Tile must be unowned. Without `force` it only takes fallout unless
   * water nukes are on; the orbital strike forces it.
   */
  queueWaterConversion(tile: TileRef, force?: boolean): void;
```

`packages/engine/src/game/GameImpl.ts`의 `queueWaterConversion(tile: TileRef): void {`를 `queueWaterConversion(tile: TileRef, force = false): void {`로, 그 안의 `if (!this._config.waterNukes()) {`를 `if (!force && !this._config.waterNukes()) {`로 바꾼다.

- [ ] **Step 6: 카운트다운 판정과 요격 명령**

`packages/engine/src/strategic/Satellite.ts`:
- import를 넓힌다:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import {
  InterceptorNuke,
  SatelliteData,
} from "@openfront/engine-api/strategic/StrategicTypes";
import { SATELLITE_PREP_TICKS } from "@openfront/engine-lib/strategic/Strategic";
import type { Game, Player, Unit } from "../game/Game";
import { interceptorHits } from "./Interception";
import { orbitalStrike } from "./OrbitalStrike";
import type { PlayerStrategic } from "./PlayerStrategic";
```

- `canTargetWithSatellite` 뒤에 추가:

```ts
/** The player's first finished silo with a free slot, in unit order; null if none. */
export function firstReadySilo(player: Player): Unit | null {
  return (
    player
      .units(UnitType.MissileSilo)
      .find(
        (s) => s.isActive() && !s.isUnderConstruction() && !s.isInCooldown(),
      ) ?? null
  );
}

const INTERCEPTOR_KEYS: Readonly<Record<InterceptorNuke, string>> = {
  [UnitType.HydrogenBomb]: "unit_type.hydrogen_bomb",
  [UnitType.AtomBomb]: "unit_type.atom_bomb",
};

/**
 * One tick of a satellite counting down (spec §6.3-6.4): every interceptor
 * that has arrived is judged in launch order, and one hit downs the
 * satellite for good. Once the clock has run out and nothing is still
 * flying, the strike lands — or, if the target is dead or friendly by
 * then, the satellite goes back to orbit.
 */
function resolveCountdown(
  mg: Game,
  player: Player,
  s: PlayerStrategic,
  sat: Extract<SatelliteData, { phase: "targeted" }>,
  now: number,
): void {
  const due = sat.interceptors.filter((i) => i.resolveTick <= now);
  const flying = sat.interceptors.filter((i) => i.resolveTick > now);
  for (const [index, shot] of due.entries()) {
    const shooter = mg.playerBySmallID(shot.by);
    const params = {
      name: shooter.isPlayer() ? shooter.displayName() : "",
      unit: INTERCEPTOR_KEYS[shot.type],
    };
    const focus = shooter.isPlayer() ? shooter.id() : undefined;
    if (interceptorHits(now, player.smallID(), shot, index)) {
      s.setSatellite({ phase: "spent" });
      mg.displayMessage(
        "events_display.satellite_intercept_hit",
        MessageType.SAM_HIT,
        null,
        undefined,
        params,
        undefined,
        focus,
      );
      return;
    }
    mg.displayMessage(
      "events_display.satellite_intercept_miss",
      MessageType.SAM_MISS,
      null,
      undefined,
      params,
      undefined,
      focus,
    );
  }
  if (due.length > 0) s.setSatellite({ ...sat, interceptors: flying });
  if (now < sat.strikeTick || flying.length > 0) return;

  const target = mg.playerBySmallID(sat.target);
  if (
    !target.isPlayer() ||
    !target.isAlive() ||
    player.isFriendly(target, true)
  ) {
    s.setSatellite({ phase: "orbit" });
    mg.displayMessage(
      "events_display.satellite_strike_aborted",
      MessageType.ATTACK_CANCELLED,
      player.id(),
    );
    return;
  }
  s.setSatellite({ phase: "spent" });
  const impacts = orbitalStrike(mg, player, target);
  mg.addUpdate({
    type: GameUpdateType.OrbitalStrike,
    attackerID: player.smallID(),
    targetID: target.smallID(),
    impacts,
  });
  announceSatellite(
    mg,
    "events_display.satellite_strike_landed",
    MessageType.NUKE_DETONATED,
    player,
    { target: target.displayName(), targetID: target.smallID() },
  );
}
```

- `processSatellite`의 첫 두 줄을 다음으로 바꾸고, 문서 주석 끝에 "A targeted satellite counts down in resolveCountdown."를 더한다:

```ts
  const sat = s.satellite();
  if (sat.phase === "targeted") {
    resolveCountdown(mg, player, s, sat, now);
    return;
  }
  if (sat.phase !== "preparing") return;
```

`packages/engine/src/strategic/SatelliteOrders.ts`:
- import에 `InterceptorNuke`, `INTERCEPTOR_NUKES`(`@openfront/engine-api/strategic/StrategicTypes`), `INTERCEPTOR_FLIGHT_TICKS`(`@openfront/engine-lib/strategic/Strategic`), `firstReadySilo`(`./Satellite`)를 더한다.
- 파일 끝에 추가:

```ts
/**
 * intercept_satellite (spec §6.3): fires one stockpiled hydrogen or atom
 * bomb from any ready silo at `attackerID`'s satellite while its clock
 * runs. Anyone but the satellite's owner may; the shot is judged
 * INTERCEPTOR_FLIGHT_TICKS later and the strike waits for it.
 */
export class SatelliteInterceptExecution implements Execution {
  constructor(
    private player: Player,
    private attackerID: PlayerID,
    private nukeType: InterceptorNuke,
  ) {}

  init(mg: Game, _ticks: number): void {
    const s = this.player.strategic();
    if (s === null || !this.player.isAlive()) return;
    if (!mg.hasPlayer(this.attackerID)) return;
    const attacker = mg.player(this.attackerID);
    const sat = attacker.strategic()?.satellite();
    if (attacker === this.player || sat?.phase !== "targeted") return;
    if (mg.ticks() >= sat.strikeTick) return;
    const silo = firstReadySilo(this.player);
    if (silo === null || !s.takeStock(this.nukeType)) return;
    silo.launch();
    attacker.strategic()!.addInterceptor({
      by: this.player.smallID(),
      type: this.nukeType,
      resolveTick: mg.ticks() + INTERCEPTOR_FLIGHT_TICKS,
    });
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return SatelliteInterceptExecutionSnapshot.write({
      player: w.player(this.player),
      attackerID: this.attackerID,
      nukeType: this.nukeType,
    });
  }

  restoreSnapshot(s: SatelliteInterceptState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.attackerID = s.attackerID;
    this.nukeType = s.nukeType;
  }
}

const SatelliteInterceptStateSchema = z.object({
  player: zPlayerRef(),
  attackerID: z.string(),
  nukeType: z.enum(INTERCEPTOR_NUKES),
});
type SatelliteInterceptState = z.infer<typeof SatelliteInterceptStateSchema>;

export const SatelliteInterceptExecutionSnapshot = execSnapshotType({
  name: "SatelliteIntercept",
  version: 1,
  schema: SatelliteInterceptStateSchema,
  cls: () => SatelliteInterceptExecution,
});
```

- [ ] **Step 7: 연결 — 명령과 등록**

`packages/engine/src/execution/ExecutionManager.ts`의 import를 `import { SatelliteInterceptExecution, SatelliteTargetExecution } from "../strategic/SatelliteOrders";`로 넓히고 `case "satellite_target":` 뒤에:

```ts
      case "intercept_satellite":
        return new SatelliteInterceptExecution(
          player,
          intent.attacker,
          intent.nukeType,
        );
```

`ExecutionRegistry.ts`에 `SatelliteInterceptExecutionSnapshot`을 `SatelliteTargetExecutionSnapshot,` 앞에 넣는다(같은 모듈에서 import). `FullGameSnapshot.test.ts`의 `STRATEGIC_ONLY_TYPES`를 `["ConventionalMissile", "NukeProduction", "SatelliteIntercept", "SatelliteTarget", "Strategic"]`로 바꾼다.

- [ ] **Step 8: 통과 확인**

Run: `npx vitest tests/strategic tests/nukes tests/core/pathfinding/PathFinding.WaterNukes.test.ts --run && npx vitest tests/core/snapshot/FullGameSnapshot.test.ts -t "free for all" --run`
Expected: InterceptOdds 1, SatelliteIntercept 7, OrbitalStrike 9 tests와 나머지 PASS, FullGameSnapshot FFA 4 tests PASS

- [ ] **Step 9: 커밋**

```bash
npx prettier --write packages/engine/src/strategic packages/engine/src/game/Game.ts packages/engine/src/game/GameImpl.ts packages/engine/src/execution/ExecutionManager.ts packages/engine/src/snapshot/ExecutionRegistry.ts tests/strategic tests/core/snapshot/FullGameSnapshot.test.ts
git add packages/engine/src tests/strategic tests/core/snapshot/FullGameSnapshot.test.ts
git commit -m "feat(strategic): satellite interception and the orbital strike"
```

---
### Task 6: AI 국가

**Files:**
- Create: `packages/engine/src/execution/nation/NationStrategicBehavior.ts`
- Modify: `packages/engine/src/execution/NationExecution.ts` (행동 만들기·틱·스냅샷)
- Modify: `packages/engine/src/execution/nation/NationNukeBehavior.ts` (`nukeTypesToTry`, `isSavingForMirv`, `maybeDestroyEnemySam`)
- Modify: `packages/engine/src/execution/nation/NationMIRVBehavior.ts` (`considerMIRV`)
- Test: `tests/strategic/NationStrategic.test.ts`

**Interfaces:**
- Consumes: Task 2 `NukeProductionExecution`, `finishedFactories`; Task 3 `ConstructionExecution(…, ConventionalMissile, …)`; Task 4 `SatelliteTargetExecution`; Task 5 `SatelliteInterceptExecution`, `firstReadySilo`; `nationHoldsStructuresForProject`, `nationProjectKindFor`
- Produces: `new NationStrategicBehavior(random: PseudoRandom, game: Game, player: Player)`, `tick(projectKind: VictoryProjectKind | null): void`, `snapshot`/`restoreSnapshot(raw, r, player)`, 스냅샷 이름 `"NationStrategicBehavior"`; `stockpiledNukeTypes(player, s: PlayerStrategic, atomOnly: boolean): (AtomBomb | HydrogenBomb)[]`; 국가 실행 스냅샷 `behaviors.strategic`(optional)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/strategic/NationStrategic.test.ts`:

```ts
import { Difficulty, PlayerInfo, UnitType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { NationEmojiBehavior } from "@openfront/engine/execution/nation/NationEmojiBehavior";
import { NationMIRVBehavior } from "@openfront/engine/execution/nation/NationMIRVBehavior";
import {
  NationStrategicBehavior,
  stockpiledNukeTypes,
} from "@openfront/engine/execution/nation/NationStrategicBehavior";
import { Game, Player } from "@openfront/engine/game/Game";
import { conquerRect } from "../domestic/util";
import { executeTicks } from "../util/utils";
import { BLUE, NATION, own, RED, strategicGame } from "./util";

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
  new NationStrategicBehavior(new PseudoRandom(1), game, nation);

// plains: the nation holds x 0-29 with a factory at (10, 30) and a silo at
// (10, 10); red holds x 60-99 (the biggest), blue a 10x10 corner.
async function nationGame(
  difficulty = Difficulty.Hard,
  config: Parameters<typeof strategicGame>[1] = {},
) {
  const game = await strategicGame(
    "plains",
    { instantBuild: true, difficulty, ...config },
    [RED, BLUE],
  );
  const nation = nationIn(game, NATION, 0, 0, 30, 100);
  const red = own(game, RED.id, 60, 0, 40, 100);
  const blue = own(game, BLUE.id, 40, 90, 10, 10);
  nation.buildUnit(UnitType.Factory, game.ref(10, 30), {});
  const silo = nation.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
  return { game, nation, red, blue, silo };
}

const jobTypes = (p: Player) => p.strategic()!.jobs().map((j) => j.type);

describe("nation strategic weapons", () => {
  test("make hydrogen bombs when rich, atom bombs otherwise", async () => {
    const rich = await nationGame();
    rich.nation.addGold(11_000_000n);
    behavior(rich.game, rich.nation).tick(null);
    executeTicks(rich.game, 1);
    expect(jobTypes(rich.nation)).toEqual([UnitType.HydrogenBomb]);

    const poor = await nationGame();
    poor.nation.addGold(2_000_000n);
    behavior(poor.game, poor.nation).tick(null);
    executeTicks(poor.game, 1);
    expect(jobTypes(poor.nation)).toEqual([UnitType.AtomBomb]);
  });

  test("make nothing without a silo to fire from", async () => {
    const { game, nation, silo } = await nationGame();
    silo.delete();
    nation.addGold(11_000_000n);
    behavior(game, nation).tick(null);
    executeTicks(game, 1);
    expect(jobTypes(nation)).toEqual([]);
  });

  test("fire from the stockpile, hydrogen first", async () => {
    const { nation } = await nationGame();
    const s = nation.strategic()!;
    expect(stockpiledNukeTypes(nation, s, false)).toEqual([]);
    s.addStock(UnitType.AtomBomb);
    expect(stockpiledNukeTypes(nation, s, false)).toEqual([UnitType.AtomBomb]);
    s.addStock(UnitType.HydrogenBomb);
    expect(stockpiledNukeTypes(nation, s, false)).toEqual([
      UnitType.HydrogenBomb,
      UnitType.AtomBomb,
    ]);
    expect(stockpiledNukeTypes(nation, s, true)).toEqual([UnitType.AtomBomb]);
  });

  test("a MIRV needs one in stock, not gold", async () => {
    const { game, nation } = await nationGame();
    nation.addGold(100_000_000n);
    const random = new PseudoRandom(1);
    const mirv = new NationMIRVBehavior(
      random,
      game,
      nation,
      new NationEmojiBehavior(random, game, nation),
    );
    expect(mirv.considerMIRV()).toBe(false);
  });

  test("Hard: a conventional missile at a factory making nukes; Medium: none", async () => {
    for (const [difficulty, missiles] of [
      [Difficulty.Hard, 1],
      [Difficulty.Medium, 0],
    ] as const) {
      const { game, nation, red } = await nationGame(difficulty);
      nation.addGold(5_000_000n);
      red.addGold(10_000_000n);
      const factory = red.buildUnit(UnitType.Factory, game.ref(80, 50), {});
      red.strategic()!.startJob({
        factoryId: factory.id(),
        type: UnitType.AtomBomb,
        startTick: 0,
        endTick: 10_000,
      });
      behavior(game, nation).tick(null);
      executeTicks(game, 3);
      expect(nation.units(UnitType.ConventionalMissile), difficulty).toHaveLength(
        missiles,
      );
    }
  });

  test("Hard: prepares a satellite when very rich and aims it at the biggest other nation", async () => {
    const { game, nation, red } = await nationGame();
    nation.addGold(50_000_000n);
    const b = behavior(game, nation);
    b.tick(null);
    executeTicks(game, 2);
    expect(nation.strategic()!.satellite().phase).toBe("preparing");

    nation.strategic()!.setSatellite({ phase: "orbit" });
    b.tick(null);
    executeTicks(game, 1);
    expect(nation.strategic()!.satellite()).toMatchObject({
      phase: "targeted",
      target: red.smallID(),
    });
  });

  test("any difficulty: a targeted nation intercepts, hydrogen first, as its silos allow", async () => {
    const { game, nation, red } = await nationGame(Difficulty.Easy);
    const s = nation.strategic()!;
    s.addStock(UnitType.HydrogenBomb);
    s.addStock(UnitType.AtomBomb);
    s.addStock(UnitType.AtomBomb);
    red.strategic()!.setSatellite({
      phase: "targeted",
      target: nation.smallID(),
      strikeTick: game.ticks() + 600,
      interceptors: [],
    });
    behavior(game, nation).tick(null);
    executeTicks(game, 1);
    expect(red.strategic()!.satellite()).toMatchObject({
      interceptors: [{ type: UnitType.HydrogenBomb }],
    });
    expect(s.stock(UnitType.HydrogenBomb)).toBe(0);
    expect(s.stock(UnitType.AtomBomb)).toBe(2);
  });

  test("domestic: no satellite before the space program", async () => {
    const { game, nation } = await nationGame(Difficulty.Hard, {
      domesticMode: true,
    });
    nation.addGold(50_000_000n);
    behavior(game, nation).tick(null);
    executeTicks(game, 2);
    expect(nation.strategic()!.satellite().phase).toBe("none");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/strategic/NationStrategic.test.ts --run`
Expected: FAIL — `Cannot find module '@openfront/engine/execution/nation/NationStrategicBehavior'`

- [ ] **Step 3: 행동 작성**

`packages/engine/src/execution/nation/NationStrategicBehavior.ts`:

```ts
import { VictoryProjectKind } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  Difficulty,
  Gold,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  INTERCEPTOR_NUKES,
  StockpiledNuke,
} from "@openfront/engine-api/strategic/StrategicTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  readVersioned,
  snapshotType,
  Versioned,
  zInt,
  zRandom,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import { factoryWithFreeLine } from "@openfront/engine-lib/strategic/Strategic";
import { z } from "zod";
import { Game, Player } from "../../game/Game";
import type {
  SnapshotReader,
  SnapshotWriter,
} from "../../snapshot/SnapshotContext";
import { NukeProductionExecution } from "../../strategic/NukeProductionExecution";
import type { PlayerStrategic } from "../../strategic/PlayerStrategic";
import { finishedFactories } from "../../strategic/Production";
import { firstReadySilo } from "../../strategic/Satellite";
import {
  SatelliteInterceptExecution,
  SatelliteTargetExecution,
} from "../../strategic/SatelliteOrders";
import { ConstructionExecution } from "../ConstructionExecution";
import { nationHoldsStructuresForProject } from "./NationVictoryBehavior";

/** Gold kept back beyond an atom bomb's or a missile's price. */
const RESERVE = 1_000_000n;
/** Beyond the satellite's price: "very rich" (spec §8). */
const SATELLITE_RESERVE = 15_000_000n;
/** Bombs kept in stock, counting those on factory lines. */
const HYDROGEN_STOCK = 2;
const ATOM_STOCK = 3;
/** One missile per enemy factory this often. */
const MISSILE_RETRY_TICKS = 150;

type FiredNuke = UnitType.AtomBomb | UnitType.HydrogenBomb;

/**
 * What NationNukeBehavior may fire in a strategic game: whatever is in
 * stock and available, hydrogen first (only atom bombs while `atomOnly`).
 * Gold doesn't matter here: it was spent at the factory.
 */
export function stockpiledNukeTypes(
  player: Player,
  s: PlayerStrategic,
  atomOnly: boolean,
): FiredNuke[] {
  const types: FiredNuke[] = [];
  for (const type of [UnitType.HydrogenBomb, UnitType.AtomBomb] as const) {
    if (atomOnly && type === UnitType.HydrogenBomb) continue;
    if (s.stock(type) > 0 && !player.isUnitUnavailable(type)) types.push(type);
  }
  return types;
}

/**
 * A nation's strategic weapons (spec §8), once per action tick: intercept
 * a satellite aimed at it (every difficulty, hydrogen first); unless it is
 * saving for a victory project, keep a small stockpile made at its
 * factories; on Hard and up, fire conventional missiles at factories
 * making nukes and, when very rich, prepare a satellite and aim it at the
 * biggest other nation. Built only with the option on, on its own PRNG.
 */
export class NationStrategicBehavior {
  /** Enemy factory id -> tick a missile was last fired at it. */
  private lastMissileAt = new Map<number, number>();

  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
  ) {}

  tick(projectKind: VictoryProjectKind | null): void {
    const s = this.player.strategic();
    if (s === null || !this.player.isAlive()) return;
    this.intercept(s);
    if (nationHoldsStructuresForProject(this.game, this.player, projectKind)) {
      return;
    }
    this.produce(s);
    const { difficulty } = this.game.config().gameConfig();
    if (difficulty === Difficulty.Hard || difficulty === Difficulty.Impossible) {
      this.missileAtNukeFactories();
      this.satellite(s);
    }
  }

  /** Every free silo slot fires at a satellite aimed at us, hydrogen bombs first. */
  private intercept(s: PlayerStrategic): void {
    const now = this.game.ticks();
    const me = this.player.smallID();
    const attacker = this.game.allPlayers().find((p) => {
      const sat = p.strategic()?.satellite();
      return (
        sat?.phase === "targeted" && sat.target === me && now < sat.strikeTick
      );
    });
    if (attacker === undefined) return;
    let slots = this.freeSiloSlots(s);
    for (const type of INTERCEPTOR_NUKES) {
      for (let left = s.stock(type); left > 0 && slots > 0; left--, slots--) {
        this.game.addExecution(
          new SatelliteInterceptExecution(this.player, attacker.id(), type),
        );
      }
    }
  }

  private freeSiloSlots(s: PlayerStrategic): number {
    let free = 0;
    for (const silo of this.player.units(UnitType.MissileSilo)) {
      if (!silo.isActive() || silo.isUnderConstruction()) continue;
      const held = s.holdsSiloSlot(silo.id()) ? 1 : 0;
      free += Math.max(
        0,
        silo.level() - silo.missileTimerQueue().length - held,
      );
    }
    return free;
  }

  private produce(s: PlayerStrategic): void {
    if (this.player.units(UnitType.MissileSilo).length === 0) return;
    if (factoryWithFreeLine(finishedFactories(this.player), s.jobs()) === null) {
      return;
    }
    // Easy nations build slowly.
    const { difficulty } = this.game.config().gameConfig();
    if (difficulty === Difficulty.Easy && !this.random.chance(3)) return;
    const type = this.productionChoice(s);
    if (type !== null) {
      this.game.addExecution(new NukeProductionExecution(this.player, type));
    }
  }

  /** A MIRV when a hydrogen bomb is affordable too, else hydrogen bombs, else atom bombs, up to a small stock. */
  private productionChoice(s: PlayerStrategic): StockpiledNuke | null {
    const gold = this.player.gold();
    const held = (t: StockpiledNuke) =>
      s.stock(t) + s.jobs().filter((j) => j.type === t).length;
    const ok = (t: StockpiledNuke) => !this.player.isUnitUnavailable(t);
    const { MIRV, HydrogenBomb, AtomBomb } = UnitType;
    if (
      ok(MIRV) &&
      held(MIRV) === 0 &&
      gold >= this.cost(MIRV) + this.cost(HydrogenBomb)
    ) {
      return MIRV;
    }
    if (
      ok(HydrogenBomb) &&
      held(HydrogenBomb) < HYDROGEN_STOCK &&
      gold >= this.cost(HydrogenBomb) * 2n
    ) {
      return HydrogenBomb;
    }
    if (
      ok(AtomBomb) &&
      held(AtomBomb) < ATOM_STOCK &&
      gold >= this.cost(AtomBomb) + RESERVE
    ) {
      return AtomBomb;
    }
    return null;
  }

  /** One missile a tick at a non-friendly factory making nukes, each factory once per MISSILE_RETRY_TICKS. */
  private missileAtNukeFactories(): void {
    const now = this.game.ticks();
    for (const [id, at] of this.lastMissileAt) {
      if (now - at >= MISSILE_RETRY_TICKS) this.lastMissileAt.delete(id);
    }
    if (
      this.player.gold() <
      this.cost(UnitType.ConventionalMissile) + RESERVE
    ) {
      return;
    }
    for (const other of this.game.players()) {
      if (other === this.player || this.player.isFriendly(other, true)) {
        continue;
      }
      for (const job of other.strategic()?.jobs() ?? []) {
        if (this.lastMissileAt.has(job.factoryId)) continue;
        const factory = this.game.unit(job.factoryId);
        if (factory === undefined || !factory.isActive()) continue;
        const tile = factory.tile();
        if (this.player.canBuild(UnitType.ConventionalMissile, tile) === false) {
          continue;
        }
        this.game.addExecution(
          new ConstructionExecution(
            this.player,
            UnitType.ConventionalMissile,
            tile,
          ),
        );
        this.lastMissileAt.set(job.factoryId, now);
        return;
      }
    }
  }

  private satellite(s: PlayerStrategic): void {
    const sat = s.satellite();
    if (sat.phase === "orbit") {
      const target = this.biggestTarget();
      if (target !== null) {
        this.game.addExecution(
          new SatelliteTargetExecution(this.player, target.id()),
        );
      }
      return;
    }
    if (sat.phase !== "none") return;
    if (this.player.isUnitUnavailable(UnitType.Satellite)) return;
    if (this.player.gold() < this.cost(UnitType.Satellite) + SATELLITE_RESERVE) {
      return;
    }
    const silo = firstReadySilo(this.player);
    if (silo !== null) {
      this.game.addExecution(
        new ConstructionExecution(this.player, UnitType.Satellite, silo.tile()),
      );
    }
  }

  /** The biggest nation it may strike: the leader, or the runner-up when it leads itself; never tribes. */
  private biggestTarget(): Player | null {
    let best: Player | null = null;
    for (const p of this.game.players()) {
      if (p === this.player || p.type() === PlayerType.Bot) continue;
      if (this.player.isFriendly(p, true)) continue;
      if (best === null || p.numTilesOwned() > best.numTilesOwned()) best = p;
    }
    return best;
  }

  private cost(type: UnitType): Gold {
    return this.game.unitInfo(type).cost(this.game, this.player);
  }

  snapshot(w: SnapshotWriter): Versioned {
    return w.versioned(NationStrategicBehaviorSnapshot, {
      random: w.random(this.random),
      lastMissileAt: [...this.lastMissileAt],
    });
  }

  /** Fills a prototype-only shell; only assigns. */
  restoreSnapshot(raw: unknown, r: SnapshotReader, player: Player): void {
    const s = readVersioned(NationStrategicBehaviorSnapshot, raw);
    this.random = r.random(s.random);
    this.game = r.game;
    this.player = player;
    this.lastMissileAt = new Map(s.lastMissileAt);
  }
}

export const NationStrategicBehaviorSnapshot = snapshotType({
  name: "NationStrategicBehavior",
  version: 1,
  schema: z.object({
    random: zRandom(),
    lastMissileAt: z.array(z.tuple([zInt(), zInt()])),
  }),
});
```

- [ ] **Step 4: 국가 실행과 기존 행동 연결**

`packages/engine/src/execution/NationExecution.ts`:
- `import { NationStrategicBehavior } from "./nation/NationStrategicBehavior";`를 추가하고, 필드 `private warfareBehavior: …;` 뒤에 `/** Strategic weapons only (undefined otherwise). */ private strategicBehavior: NationStrategicBehavior | undefined;`를 추가한다.
- 공격 틱 본문의 `this.nukeBehavior.maybeSendNuke();` 바로 앞에 추가:

```ts
    // Strategic weapons only: intercept, produce, missiles and the
    // satellite, before the nuke behavior looks at the stockpile.
    this.strategicBehavior?.tick(nationProjectKindFor(this.mg, this.player));
```

- `initializeBehaviors`의 `this.warfareBehavior = …;` 뒤에 추가:

```ts
    // Strategic weapons only, on its own PRNG like the warfare behavior.
    this.strategicBehavior = this.mg.config().strategicWeapons()
      ? new NationStrategicBehavior(
          new PseudoRandom(simpleHash(this.player.id()) + 8209),
          this.mg,
          this.player,
        )
      : undefined;
```

- `snapshot`의 `warfare` 스프레드 뒤에 `...(this.strategicBehavior !== undefined ? { strategic: this.strategicBehavior.snapshot(w) } : {}),`를, 스키마 `behaviors`의 `warfare: VersionedSchema.optional(),` 뒤에 `strategic: VersionedSchema.optional(),`를 추가하고, `restoreSnapshot` 끝(`warfare` 복원 뒤)에 추가:

```ts
    if (b.strategic !== undefined) {
      const strategic = shell(NationStrategicBehavior);
      strategic.restoreSnapshot(b.strategic, r, player);
      this.strategicBehavior = strategic;
    } else {
      this.strategicBehavior = undefined;
    }
```

`packages/engine/src/execution/nation/NationNukeBehavior.ts`:
- `import { stockpiledNukeTypes } from "./NationStrategicBehavior";`를 추가한다.
- `nukeTypesToTry`의 맨 앞에 추가:

```ts
    // Strategic weapons: fire what is in stock (spec §8); gold went to the factory.
    const strategic = this.player.strategic();
    if (strategic !== null) {
      return stockpiledNukeTypes(this.player, strategic, atomOnly);
    }
```

- `isSavingForMirv`의 맨 앞에 `if (this.player.strategic() !== null) return false; // MIRVs are made at factories, not saved for`를, `maybeDestroyEnemySam`의 맨 앞(`isUnitUnavailable(AtomBomb)` 검사 앞)에 `if (this.player.strategic() !== null) return; // its salvo buys bombs with gold`를 추가한다.

`packages/engine/src/execution/nation/NationMIRVBehavior.ts`의 `considerMIRV`에서 `if (this.player.gold() < this.cost(UnitType.MIRV)) { return false; }`를 다음으로 바꾼다:

```ts
    // Strategic weapons: a MIRV comes from the stockpile, not from gold.
    const strategic = this.player.strategic();
    if (
      strategic !== null
        ? strategic.stock(UnitType.MIRV) === 0
        : this.player.gold() < this.cost(UnitType.MIRV)
    ) {
      return false;
    }
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest tests/strategic tests/NationMIRV.test.ts tests/NationMirvSams.test.ts tests/NationNukeTargeting.test.ts tests/NationNukeStrikes.test.ts tests/NationNukeSamOverwhelm.test.ts tests/NationCrownNukes.test.ts tests/core/snapshot/NationExecutions.test.ts tests/VanillaDigest.test.ts --run`
Expected: NationStrategic 8 tests와 기존 국가 테스트, VanillaDigest 7 tests PASS(옵션이 꺼지면 국가는 새 행동을 만들지 않는다)

- [ ] **Step 6: 커밋**

```bash
npx prettier --write packages/engine/src/execution/NationExecution.ts packages/engine/src/execution/nation tests/strategic
git add packages/engine/src/execution tests/strategic
git commit -m "feat(strategic): nations stockpile nukes, hit nuke factories, intercept and use the satellite"
```

---
### Task 7: 전략 무기 스냅샷 변형(스크립트 게임)

**Files:**
- Modify: `tests/util/ScriptedGame.ts` (`strategicIntent`)
- Modify: `tests/core/snapshot/FullGameSnapshot.test.ts` (변형 2개, 기대 실행 종류)

**Interfaces:**
- Consumes: Task 1~5의 인텐트와 실행 이름, Task 6의 국가 행동
- Produces: `FullGameSnapshot.test.ts`의 변형 `"strategic"`(`{ strategicWeapons: true }`)과 `"strategic with domestic and warfare"`(`{ domesticMode: true, warfareExpansion: true, strategicWeapons: true }`), `STRATEGIC_UNSCRIPTED_TYPES`

- [ ] **Step 1: 스크립트 사람의 전략 무기 명령**

`tests/util/ScriptedGame.ts`:
- import에 `Structures`(`@openfront/engine-api/game/GameTypes`)와 `INTERCEPTOR_NUKES`, `STOCKPILED_NUKES`(`@openfront/engine-api/strategic/StrategicTypes`)를 더한다.
- `playIntent`의 확장 전쟁 블록 바로 뒤에 추가:

```ts
  // Strategic weapons games only, on the same terms as the warfare block: a
  // game without the option never rolls here.
  if (game.config().strategicWeapons() && rand.chance(4)) {
    const intent = strategicIntent(game, p, rand, other);
    if (intent !== null) return intent;
  }
```

- `warfareIntent` 함수 뒤에 추가:

```ts
/** One strategic-weapons intent: production, a missile, the satellite, its target, an interceptor. */
function strategicIntent(
  game: Game,
  p: Player,
  rand: PseudoRandom,
  other: Player | null,
): Intent | null {
  const s = p.strategic();
  if (s === null) return null;
  switch (rand.nextInt(0, 5)) {
    case 0:
      return { type: "produce_nuke", nukeType: pick(rand, STOCKPILED_NUKES)! };
    case 1: {
      const target = other === null ? null : pick(rand, other.units(Structures.types));
      if (
        target === null ||
        p.canBuild(UnitType.ConventionalMissile, target.tile()) === false
      ) {
        return null;
      }
      return {
        type: "build_unit",
        unit: UnitType.ConventionalMissile,
        tile: target.tile(),
      };
    }
    case 2: {
      const silo = pick(rand, p.units(UnitType.MissileSilo));
      if (silo === null || p.canBuild(UnitType.Satellite, silo.tile()) === false) {
        return null;
      }
      return { type: "build_unit", unit: UnitType.Satellite, tile: silo.tile() };
    }
    case 3:
      if (other === null || s.satellite().phase !== "orbit") return null;
      return { type: "satellite_target", target: other.id() };
    case 4: {
      const attacker = game
        .allPlayers()
        .find((o) => o !== p && o.strategic()?.satellite().phase === "targeted");
      if (attacker === undefined) return null;
      return {
        type: "intercept_satellite",
        attacker: attacker.id(),
        nukeType: pick(rand, INTERCEPTOR_NUKES)!,
      };
    }
  }
  return null;
}
```

- [ ] **Step 2: 변형과 기대 종류**

`tests/core/snapshot/FullGameSnapshot.test.ts`:
- `STRATEGIC_ONLY_TYPES` 선언 뒤에 추가:

```ts
// Strategic types the 1500-tick scripted game isn't sure to reach: the
// three orders finish inside their init (only a spawn-phase queue could
// catch them), and a missile needs an enemy structure next to a loaded
// silo's reach. tests/strategic/*.test.ts cover their snapshots.
const STRATEGIC_UNSCRIPTED_TYPES = [
  "ConventionalMissile",
  "NukeProduction",
  "SatelliteIntercept",
  "SatelliteTarget",
];
```

- `VARIANTS` 끝에 추가:

```ts
  // Strategic weapons: production, missiles, the satellite and its
  // interceptors, and the nations' strategic behavior.
  ["strategic", { strategicWeapons: true }],
  // Every fork option together.
  [
    "strategic with domestic and warfare",
    { domesticMode: true, warfareExpansion: true, strategicWeapons: true },
  ],
```

- "the game exercised every execution type"의 분기에서 `} else if (overrides.domesticMode === true) {` 앞에 추가:

```ts
      } else if (
        overrides.strategicWeapons === true &&
        Object.keys(overrides).length === 1
      ) {
        expected = STRATEGIC_ONLY_TYPES.filter(
          (name) => !STRATEGIC_UNSCRIPTED_TYPES.includes(name),
        );
```

- [ ] **Step 3: 통과 확인**

Run: `npx vitest tests/core/snapshot/FullGameSnapshot.test.ts -t "strategic" --run && npx vitest tests/VanillaDigest.test.ts tests/NationGoldPerMinute.test.ts --run`
Expected: 두 strategic 변형의 4 tests씩 PASS(각 1~3분), VanillaDigest 7 tests와 NationGoldPerMinute 스냅샷 PASS. 바이트가 어긋나면 `diffSnapshots`가 가리키는 필드의 `snapshot`/`restoreSnapshot` 대입을 고친다.

- [ ] **Step 4: 커밋**

```bash
npx prettier --write tests/util/ScriptedGame.ts tests/core/snapshot/FullGameSnapshot.test.ts
git add tests/util/ScriptedGame.ts tests/core/snapshot/FullGameSnapshot.test.ts
git commit -m "test(strategic): full-game snapshot variants with strategic weapons"
```

---
### Task 8: 번역 (en, ko)

**Files:**
- Modify: `resources/lang/en.json`, `resources/lang/ko.json` (jq로 병합)
- Test: `tests/strategic/StrategicI18n.test.ts`

**Interfaces:**
- Produces(엔진·화면 Task가 쓰는 키, 그대로 쓴다):

| 키 | 매개변수 | 엔진 종류 / 받는 사람 |
|---|---|---|
| `game_settings.strategic_weapons` | | 로비 토글·요약 |
| `unit_type.conventional_missile`, `unit_type.satellite` | | |
| `build_menu.desc.conventional_missile`, `build_menu.desc.satellite` | | 단축바 카드·건설 메뉴 |
| `leaderboard.nukes` | | 순위표 칸 |
| `events_display.nuke_production_started` | `name` | `NUKE_INBOUND`, 모두 |
| `events_display.nuke_production_done` | `unit`(키) | `RESEARCH_COMPLETE`, 만든 나라 |
| `events_display.nuke_production_lost` | `name` | `UNIT_DESTROYED`, 모두 |
| `events_display.conventional_missile_inbound` | `name`(클라이언트가 채움) | 들어오는 유닛, 목표의 주인 |
| `events_display.conventional_missile_hit` | `name` | `NUKE_DETONATED`, 맞은 나라 |
| `events_display.satellite_preparing`, `satellite_prep_failed`, `satellite_in_orbit` | `name` | `NUKE_INBOUND`/`UNIT_DESTROYED`/`NUKE_INBOUND`, 모두 |
| `events_display.satellite_targeted`, `satellite_strike_landed` | `name`, `target`, `targetID` | `NUKE_INBOUND`/`NUKE_DETONATED`, 모두 |
| `events_display.satellite_intercept_hit`, `satellite_intercept_miss` | `name`, `unit`(키) | `SAM_HIT`/`SAM_MISS`, 모두 |
| `events_display.satellite_strike_aborted` | | `ATTACK_CANCELLED`, 위성 주인 |
| `strategic.stock`, `strategic.producing`, `strategic.interceptors_in_flight` | `count` | |
| `strategic.produce` | `seconds` | |
| `strategic.no_stock`, `needs_factory`, `no_free_line`, `satellite_busy`, `satellite_used`, `satellite_ready`, `choose_target`, `target_title`, `no_targets`, `tap_again_to_fire`, `tap_again_to_target` | | |
| `strategic.band` | `name`, `target` | 위쪽 띠 |
| `strategic.seconds_left` | `seconds` | |
| `strategic.intercept_with` | `unit`, `count`, `pct` | 요격 버튼 |

`domestic.tech.space_program.desc`는 위성을 언급하도록 바꾼다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/strategic/StrategicI18n.test.ts`:

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
  "game_settings.strategic_weapons",
  "unit_type.conventional_missile",
  "unit_type.satellite",
  "build_menu.desc.conventional_missile",
  "build_menu.desc.satellite",
  "leaderboard.nukes",
  "events_display.nuke_production_started",
  "events_display.nuke_production_done",
  "events_display.nuke_production_lost",
  "events_display.conventional_missile_inbound",
  "events_display.conventional_missile_hit",
  "events_display.satellite_preparing",
  "events_display.satellite_prep_failed",
  "events_display.satellite_in_orbit",
  "events_display.satellite_targeted",
  "events_display.satellite_intercept_hit",
  "events_display.satellite_intercept_miss",
  "events_display.satellite_strike_landed",
  "events_display.satellite_strike_aborted",
  "strategic.stock",
  "strategic.producing",
  "strategic.produce",
  "strategic.no_stock",
  "strategic.needs_factory",
  "strategic.no_free_line",
  "strategic.satellite_busy",
  "strategic.satellite_used",
  "strategic.satellite_ready",
  "strategic.choose_target",
  "strategic.target_title",
  "strategic.no_targets",
  "strategic.band",
  "strategic.seconds_left",
  "strategic.intercept_with",
  "strategic.interceptors_in_flight",
  "strategic.tap_again_to_fire",
  "strategic.tap_again_to_target",
];

describe("strategic weapons translations", () => {
  test.each(["en", "ko"])("%s has every strategic key", (lang) => {
    const json = load(lang);
    for (const key of KEYS) {
      expect(typeof get(json, key), key).toBe("string");
    }
  });

  test("the owner's exact Korean alert", () => {
    expect(get(load("ko"), "events_display.nuke_production_started")).toBe(
      "{name} 핵무기 개발 중",
    );
  });

  test.each(["en", "ko"])("%s keeps the placeholders", (lang) => {
    const json = load(lang);
    expect(get(json, "events_display.satellite_targeted")).toMatch(
      /\{name\}.*\{target\}/,
    );
    expect(get(json, "events_display.satellite_intercept_hit")).toMatch(
      /\{unit\}/,
    );
    expect(get(json, "strategic.band")).toMatch(/\{name\}.*\{target\}/);
    expect(get(json, "strategic.intercept_with")).toMatch(
      /\{unit\}.*\{count\}.*\{pct\}/,
    );
    expect(get(json, "strategic.produce")).toMatch(/\{seconds\}/);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/strategic/StrategicI18n.test.ts --run`
Expected: FAIL — `game_settings.strategic_weapons: expected 'undefined' to be 'string'`

- [ ] **Step 3: 영어·한국어 조각 작성**

```bash
mkdir -p .i18n-strategic
cat > .i18n-strategic/en.json <<'EOF'
{
  "build_menu": {
    "desc": {
      "conventional_missile": "From a silo: an enemy building loses a level; a factory loses its nukes in production",
      "satellite": "Once per game: 90 s at a silo, then strike a nation (all buildings, 70% of troops, land to sea)"
    }
  },
  "domestic": {
    "tech": {
      "space_program": {
        "desc": "Enables the Space Program (science victory); with Strategic Weapons, the orbital satellite"
      }
    }
  },
  "events_display": {
    "conventional_missile_hit": "{name}'s missile hit one of your buildings",
    "conventional_missile_inbound": "{name} - missile inbound",
    "nuke_production_done": "{unit} ready: added to your stockpile",
    "nuke_production_lost": "{name}'s nuclear program was stopped",
    "nuke_production_started": "{name} is developing a nuclear weapon",
    "satellite_in_orbit": "{name}'s satellite is in orbit",
    "satellite_intercept_hit": "{name}'s {unit} shot down the satellite!",
    "satellite_intercept_miss": "{name}'s {unit} missed the satellite",
    "satellite_prep_failed": "{name}'s satellite launch failed",
    "satellite_preparing": "{name} is preparing an orbital satellite",
    "satellite_strike_aborted": "Your orbital strike was called off: the target is gone or friendly",
    "satellite_strike_landed": "{name}'s orbital strike hit {target}",
    "satellite_targeted": "{name} → {target}: orbital strike in 60 seconds"
  },
  "game_settings": {
    "strategic_weapons": "Strategic Weapons"
  },
  "leaderboard": {
    "nukes": "Nukes"
  },
  "strategic": {
    "band": "{name} → {target} orbital strike",
    "choose_target": "Choose a target",
    "intercept_with": "{unit} ×{count} · {pct}%",
    "interceptors_in_flight": "Interceptors in flight: {count}",
    "needs_factory": "Build a factory first",
    "no_free_line": "Every factory line is busy",
    "no_stock": "None in stock: build one at a factory first",
    "no_targets": "No nation can be targeted",
    "produce": "Build ({seconds}s)",
    "producing": "In production: {count}",
    "satellite_busy": "Your satellite is being prepared",
    "satellite_ready": "Your satellite is in orbit",
    "satellite_used": "Your nation has already launched its satellite",
    "seconds_left": "{seconds}s",
    "stock": "In stock: {count}",
    "tap_again_to_fire": "Tap again to fire",
    "tap_again_to_target": "Tap again to confirm",
    "target_title": "Orbital strike target"
  },
  "unit_type": {
    "conventional_missile": "Conventional Missile",
    "satellite": "Orbital Satellite"
  }
}
EOF
cat > .i18n-strategic/ko.json <<'EOF'
{
  "build_menu": {
    "desc": {
      "conventional_missile": "발사대에서 쏴 적 건물의 레벨을 1 낮춥니다. 공장이면 만들던 핵이 사라집니다",
      "satellite": "한 게임에 한 번: 발사대에서 90초 준비 뒤 한 나라를 포격합니다(건물 전부, 병력 70%, 땅이 바다로)"
    }
  },
  "domestic": {
    "tech": {
      "space_program": {
        "desc": "우주 계획 착수 가능 (과학 승리), 전략 무기에서는 궤도 포격 위성"
      }
    }
  },
  "events_display": {
    "conventional_missile_hit": "{name}의 미사일이 건물을 맞혔습니다",
    "conventional_missile_inbound": "{name} - 미사일이 날아옵니다",
    "nuke_production_done": "{unit} 제조 완료: 보유량에 더해졌습니다",
    "nuke_production_lost": "{name}의 핵 개발이 저지되었습니다",
    "nuke_production_started": "{name} 핵무기 개발 중",
    "satellite_in_orbit": "{name}의 위성이 궤도에 올랐습니다",
    "satellite_intercept_hit": "{name}의 {unit}이(가) 위성을 격추했습니다!",
    "satellite_intercept_miss": "{name}의 {unit}이(가) 위성을 빗나갔습니다",
    "satellite_prep_failed": "{name}의 위성 준비가 실패했습니다",
    "satellite_preparing": "{name} 궤도 포격 위성 준비 중",
    "satellite_strike_aborted": "목표가 사라졌거나 우호국이 되어 위성 포격이 취소되었습니다",
    "satellite_strike_landed": "{name}의 위성 포격이 {target}에 떨어졌습니다",
    "satellite_targeted": "{name} → {target} 위성 포격 (60초 뒤)"
  },
  "game_settings": {
    "strategic_weapons": "전략 무기"
  },
  "leaderboard": {
    "nukes": "핵"
  },
  "strategic": {
    "band": "{name} → {target} 위성 포격",
    "choose_target": "목표 나라 고르기",
    "intercept_with": "{unit} {count}발 · {pct}%",
    "interceptors_in_flight": "요격탄 비행 중 {count}",
    "needs_factory": "공장을 먼저 지으세요",
    "no_free_line": "공장의 제조 라인이 모두 쓰이고 있습니다",
    "no_stock": "보유한 핵이 없습니다. 공장에서 먼저 제조하세요",
    "no_targets": "고를 수 있는 나라가 없습니다",
    "produce": "제조 ({seconds}초)",
    "producing": "제조 중 {count}발",
    "satellite_busy": "위성을 준비하고 있습니다",
    "satellite_ready": "위성이 궤도에 올랐습니다",
    "satellite_used": "이미 위성을 쏘아 올렸습니다",
    "seconds_left": "{seconds}초",
    "stock": "보유 {count}발",
    "tap_again_to_fire": "한 번 더 눌러 발사",
    "tap_again_to_target": "한 번 더 눌러 확정",
    "target_title": "위성 포격 목표"
  },
  "unit_type": {
    "conventional_missile": "일반 미사일",
    "satellite": "궤도 포격 위성"
  }
}
EOF
```

- [ ] **Step 4: 병합**

en.json은 키 정렬을 유지해야 하므로 `jq -S`로, ko.json은 순서를 건드리지 않고 병합한다(확장 전쟁 계획과 같은 방법).

```bash
jq -S --slurpfile frag .i18n-strategic/en.json '. * $frag[0]' resources/lang/en.json > .i18n-strategic/en.out && mv .i18n-strategic/en.out resources/lang/en.json
jq --slurpfile frag .i18n-strategic/ko.json '. * $frag[0]' resources/lang/ko.json > .i18n-strategic/ko.out && mv .i18n-strategic/ko.out resources/lang/ko.json
rm -rf .i18n-strategic
npx prettier --write resources/lang/en.json resources/lang/ko.json
git diff --stat resources/lang
```

Expected: en.json, ko.json에 추가와 `space_program.desc` 한 줄 변경만 있다.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest tests/strategic/StrategicI18n.test.ts tests/domestic/I18n.test.ts tests/warfare/WarfareI18n.test.ts tests/EnJsonSorted.test.ts --run`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add resources/lang/en.json resources/lang/ko.json tests/strategic/StrategicI18n.test.ts
git commit -m "feat(strategic): English and Korean strings for strategic weapons"
```

---
### Task 9: 로비 토글과 설정 요약

**Files:**
- Modify: `src/client/SinglePlayerModal.ts`, `src/client/HostLobbyModal.ts`, `src/client/utilities/LobbySettingsSummary.ts`
- Test: `tests/client/StrategicLobby.test.ts`

**Interfaces:**
- Consumes: Task 1 `GameConfig.strategicWeapons`, Task 8 `game_settings.strategic_weapons`
- Produces: 두 모달의 `strategicWeapons` 상태와 토글(`labelKey: "game_settings.strategic_weapons"`), 혼자 하기 시작 설정의 `strategicWeapons: true`, 호스트 `update_game_config`의 `strategicWeapons`, 참가 화면 요약 항목

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/StrategicLobby.test.ts`는 `tests/client/WarfareLobby.test.ts`를 그대로 복사해 다음만 바꾼다: `labelKey`를 `"game_settings.strategic_weapons"`로, 상태·설정 이름 `warfareExpansion`을 `strategicWeapons`로, `describe` 이름을 `"strategic weapons in the lobby"`로. 세 테스트(혼자 하기 기본 꺼짐과 켬, 호스트 토글이 `putGameConfig`를 부름, 요약은 켰을 때만)의 기대값은 같은 모양이다:

```ts
    expect(configs[0].strategicWeapons).toBeUndefined();
    modal.handleConfigOptionToggleChanged(toggle(true));
    expect(modal.strategicWeapons).toBe(true);
    await modal.startGame();
    expect(configs[1].strategicWeapons).toBe(true);
```

```ts
    expect(label(testGameConfig({ strategicWeapons: true }))).toContain(
      "game_settings.strategic_weapons",
    );
    expect(label(testGameConfig())).not.toContain(
      "game_settings.strategic_weapons",
    );
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/StrategicLobby.test.ts --run`
Expected: FAIL — `expected undefined to be true`(모달에 상태가 없다)

- [ ] **Step 3: 혼자 하기 모달**

`src/client/SinglePlayerModal.ts` — 확장 전쟁 줄마다 바로 뒤에 같은 모양으로 더한다:
- `DEFAULT_OPTIONS`의 `warfareExpansion: false,` 뒤에 `strategicWeapons: false,`
- `@state() private warfareExpansion…;` 뒤에 `@state() private strategicWeapons: boolean = DEFAULT_OPTIONS.strategicWeapons;`
- `toggles` 목록의 `game_settings.warfare_expansion` 항목 뒤에 `{ labelKey: "game_settings.strategic_weapons", checked: this.strategicWeapons },`
- 바뀜 확인의 `this.warfareExpansion !== DEFAULT_OPTIONS.warfareExpansion ||` 뒤에 `this.strategicWeapons !== DEFAULT_OPTIONS.strategicWeapons ||`
- 초기화의 `this.warfareExpansion = DEFAULT_OPTIONS.warfareExpansion;` 뒤에 `this.strategicWeapons = DEFAULT_OPTIONS.strategicWeapons;`
- `handleConfigOptionToggleChanged`의 `case "game_settings.warfare_expansion":` 블록 뒤에 `case "game_settings.strategic_weapons": this.strategicWeapons = checked; break;`
- `startGame` 설정의 `...(this.warfareExpansion ? { warfareExpansion: true } : {}),` 뒤에 `...(this.strategicWeapons ? { strategicWeapons: true } : {}),`

- [ ] **Step 4: 방 만들기 모달**

`src/client/HostLobbyModal.ts` — 같은 방식으로:
- `@state() private warfareExpansion: boolean = false;` 뒤에 `@state() private strategicWeapons: boolean = false;`
- `toggles`의 확장 전쟁 항목 뒤에 `{ labelKey: "game_settings.strategic_weapons", checked: this.strategicWeapons },`
- 초기화의 `this.warfareExpansion = false;` 뒤에 `this.strategicWeapons = false;`
- `handleConfigOptionToggleChanged`의 확장 전쟁 블록 뒤에 `case "game_settings.strategic_weapons": this.strategicWeapons = checked; this.putGameConfig(); break;`
- `putGameConfig`의 `warfareExpansion: this.warfareExpansion,` 뒤에 `strategicWeapons: this.strategicWeapons,`

- [ ] **Step 5: 참가 화면 요약**

`src/client/utilities/LobbySettingsSummary.ts`의 `if (c.warfareExpansion)` 블록 뒤에:

```ts
  if (c.strategicWeapons)
    items.push({
      label: translateText("game_settings.strategic_weapons"),
      value: enabled,
    });
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/client/StrategicLobby.test.ts tests/client/WarfareLobby.test.ts tests/client/DomesticLobby.test.ts tests/client/HostLobbyModal.test.ts tests/client/HostLobbyModalTeamCount.test.ts tests/LayerBoundaries.test.ts --run && npm run typecheck`
Expected: 모두 PASS, typecheck 오류 없음

- [ ] **Step 7: 커밋**

```bash
npx prettier --write src/client/SinglePlayerModal.ts src/client/HostLobbyModal.ts src/client/utilities/LobbySettingsSummary.ts tests/client/StrategicLobby.test.ts
git add src/client/SinglePlayerModal.ts src/client/HostLobbyModal.ts src/client/utilities/LobbySettingsSummary.ts tests/client/StrategicLobby.test.ts
git commit -m "feat(strategic): Strategic Weapons toggle in solo and host lobbies"
```

---
### Task 10: 단축바, 건설·원형 메뉴, 알림, 명령 이벤트

**Files:**
- Create: `resources/images/ConventionalMissileIconWhite.svg`, `resources/images/SatelliteIconWhite.svg`, `resources/images/InterceptIconWhite.svg`
- Modify: `CREDITS.md` (확장 전쟁 아이콘 줄 바로 뒤에 한 줄 추가; `unit-atlas.png` 줄은 Task 12가 고친다)
- Modify: `src/client/hud/HotbarIcons.ts`, `src/client/hud/layers/UnitDisplay.ts`, `src/client/hud/layers/BuildMenu.ts`, `src/client/hud/layers/RadialMenuElements.ts`, `src/client/hud/layers/EventsDisplay.ts`, `src/client/Transport.ts`
- Modify (test): `tests/client/UnitDisplayHotbar.test.ts`, `tests/client/graphics/layers/BuildMenuReasons.test.ts`, `tests/client/graphics/RadialMenuElements.test.ts`
- Test: `tests/client/graphics/layers/EventsDisplayStrategic.test.ts`

**Interfaces:**
- Consumes: Task 1 `PlayerView.strategicData()`, `isStockpiledNuke`, `factoryWithFreeLine`, `NUKE_PRODUCTION_TICKS`, `STRATEGIC_ONLY_UNITS`, 인텐트 3개; Task 8 키
- Produces:
  - `HotbarIcons`의 `conventionalMissileIcon`, `satelliteIcon`, `interceptIcon`
  - 단축바 키 `conventional_missile`, `satellite`(`data-hotbar`), 핵 버튼의 `data-stock` 배지, 핵 카드의 `data-produce` 버튼과 `data-produce-reason`; 건설 메뉴의 `data-build-stock`
  - `class SendProduceNukeIntentEvent { nukeType: StockpiledNuke }`, `class SendSatelliteTargetIntentEvent { target: PlayerID }`, `class SendInterceptSatelliteIntentEvent { attacker: PlayerID; nukeType: InterceptorNuke }`(`src/client/Transport.ts`, Task 11이 쓴다)

- [ ] **Step 1: 아이콘**

```bash
cat > resources/images/ConventionalMissileIconWhite.svg <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff"><g transform="rotate(45 12 12)"><path d="M12 1.5c1.2 1.3 1.8 3 1.8 4.8V16h-3.6V6.3c0-1.8.6-3.5 1.8-4.8z"/><path d="M10.2 12.5 7.5 16v2.2l2.7-1.4zM13.8 12.5l2.7 3.5v2.2l-2.7-1.4z"/><path d="M10.9 17h2.2l-.4 3.5h-1.4z"/></g></svg>
EOF
cat > resources/images/SatelliteIconWhite.svg <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff"><g transform="rotate(-35 12 12)"><rect x="9.5" y="8.5" width="5" height="7" rx="1"/><path d="M2 9.5h6.5v5H2zM15.5 9.5H22v5h-6.5z" fill-opacity="0.85"/><path d="M8.5 11.5h1v1h-1zM14.5 11.5h1v1h-1z"/><path d="M11.4 5.5h1.2v3h-1.2zM10 4.2a2 2 0 0 1 4 0z"/></g></svg>
EOF
cat > resources/images/InterceptIconWhite.svg <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2"><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><path d="M12 15V8m-3 3 3-3 3 3" stroke-linecap="round" stroke-linejoin="round"/></svg>
EOF
```

`CREDITS.md`의 확장 전쟁 아이콘 줄(`…ParadropIconWhite.svg` (expanded warfare build menu icons)…) 바로 뒤에 추가:

```md
- `resources/images/ConventionalMissileIconWhite.svg`, `resources/images/SatelliteIconWhite.svg`, `resources/images/InterceptIconWhite.svg` (strategic weapons icons): drawn for this fork, CC BY-SA 4.0.
```

`src/client/hud/HotbarIcons.ts`의 `paradropIcon` 줄 뒤에 추가:

```ts
export const conventionalMissileIcon = assetUrl(
  "images/ConventionalMissileIconWhite.svg",
);
export const satelliteIcon = assetUrl("images/SatelliteIconWhite.svg");
export const interceptIcon = assetUrl("images/InterceptIconWhite.svg");
```

- [ ] **Step 2: 실패하는 테스트 작성 — 단축바**

`tests/client/UnitDisplayHotbar.test.ts`:
- import에 `import { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";`, `import { STRATEGIC_ONLY_UNITS } from "@openfront/engine-lib/strategic/Strategic";`, `import { SendProduceNukeIntentEvent } from "../../src/client/Transport";`를 더한다.
- `mount`의 `opts` 타입을 `{ domestic?: boolean; warfare?: boolean; strategic?: StrategicData; ports?: number; silos?: number; factories?: { id: number; level: number }[] }`로 바꾸고, 모의 `player`와 `config`를 다음으로 바꾼다:

```ts
  const player = {
    buildables: vi.fn(() => Promise.resolve(buildables)),
    totalUnitLevels: () => 0,
    gold: () => 1_000_000n,
    strategicData: () => opts.strategic ?? null,
    units: (type: UnitType) => {
      switch (type) {
        case UnitType.Port:
          return Array.from({ length: opts.ports ?? 0 }, () => ({}));
        case UnitType.MissileSilo:
          return Array.from({ length: opts.silos ?? 0 }, () => ({}));
        case UnitType.Factory:
          return (opts.factories ?? []).map((f) => ({
            id: () => f.id,
            level: () => f.level,
            isUnderConstruction: () => false,
          }));
        default:
          return [];
      }
    },
    isAlive: () => true,
  };
  el.game = {
    config: () => ({
      isUnitDisabled: (t: UnitType) =>
        (!opts.domestic && DOMESTIC_ONLY.has(t)) ||
        (!opts.warfare && WARFARE_ONLY_UNITS.has(t)) ||
        (opts.strategic === undefined && STRATEGIC_ONLY_UNITS.has(t)),
    }),
    myPlayer: () => player,
    inSpawnPhase: () => false,
  } as unknown as UnitDisplay["game"];
```

- `describe("unit-display build bar", …)` 안 끝에 추가:

```ts
  const STRATEGIC = (over: Partial<StrategicData> = {}): StrategicData => ({
    stock: {
      [UnitType.AtomBomb]: 2,
      [UnitType.HydrogenBomb]: 0,
      [UnitType.MIRV]: 0,
    },
    jobs: [],
    satellite: { phase: "none" },
    ...over,
  });

  it("strategic weapons: missile and satellite buttons, stock badges on the nukes", async () => {
    const plain = await mount([]);
    expect(plain.el.querySelector('[data-hotbar="satellite"]')).toBeNull();
    expect(plain.el.querySelector("[data-stock]")).toBeNull();
    document.body.innerHTML = "";

    const { el } = await mount([], { strategic: STRATEGIC() });
    expect(
      el.querySelector('[data-hotbar="conventional_missile"]'),
    ).not.toBeNull();
    expect(el.querySelector('[data-hotbar="satellite"]')).not.toBeNull();
    const badge = (key: string) =>
      button(el, key).querySelector("[data-stock]")!.textContent!.trim();
    expect(badge("atom_bomb")).toBe("2");
    expect(badge("hydrogen_bomb")).toBe("0");
    expect(badge("mirv")).toBe("0");
  });

  it("a nuke card fires from the stockpile and builds with one tap", async () => {
    const { el, emitted } = await mount(
      [buildable(UnitType.AtomBomb), buildable(UnitType.HydrogenBomb)],
      { strategic: STRATEGIC(), silos: 1, factories: [{ id: 5, level: 1 }] },
    );
    await tap(el, "hydrogen_bomb");
    expect(card(el)?.textContent).toContain("[strategic.no_stock]");
    const produce = card(el)!.querySelector<HTMLButtonElement>(
      "[data-produce]",
    )!;
    expect(produce.disabled).toBe(false);
    expect(produce.textContent).toContain("[strategic.produce] seconds=40");
    produce.click();
    expect(emitted).toContainEqual(
      new SendProduceNukeIntentEvent(UnitType.HydrogenBomb),
    );

    await tap(el, "atom_bomb");
    expect(card(el)?.textContent).toContain("[strategic.stock] count=2");
    expect(card(el)?.textContent).toContain("[touch_ui.tap_again_to_build]");
  });

  it("says why it can't build, and when the satellite is spent", async () => {
    const { el } = await mount(
      [buildable(UnitType.AtomBomb), buildable(UnitType.Satellite)],
      {
        strategic: STRATEGIC({
          jobs: [
            {
              factoryId: 5,
              type: UnitType.AtomBomb,
              startTick: 0,
              endTick: 200,
            },
          ],
          satellite: { phase: "spent" },
        }),
        silos: 1,
        factories: [{ id: 5, level: 1 }],
      },
    );
    await tap(el, "atom_bomb");
    expect(
      card(el)!.querySelector("[data-produce]")!.hasAttribute("disabled"),
    ).toBe(true);
    expect(card(el)?.textContent).toContain("[strategic.no_free_line]");
    expect(card(el)?.textContent).toContain("[strategic.producing] count=1");
    await tap(el, "satellite");
    expect(card(el)?.textContent).toContain("[strategic.satellite_used]");
  });
```

- [ ] **Step 3: 실패하는 테스트 작성 — 건설 메뉴, 원형 메뉴, 알림**

`tests/client/graphics/layers/BuildMenuReasons.test.ts`: `import { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";`를 더하고 `openMenu`에 세 번째 매개변수 `strategic: StrategicData | null = null`을 받아 모의 `myPlayer`를 `() => ({ totalUnitLevels: () => 0, gold: () => gold, strategicData: () => strategic })`로 바꾼 뒤, 끝에 추가:

```ts
  it("strategic weapons: nukes show the stockpile, and an empty one is the reason", async () => {
    const menu = await openMenu(
      [unit(UnitType.AtomBomb, false), unit(UnitType.HydrogenBomb, 7)],
      1_000_000n,
      {
        stock: {
          [UnitType.AtomBomb]: 0,
          [UnitType.HydrogenBomb]: 1,
          [UnitType.MIRV]: 0,
        },
        jobs: [],
        satellite: { phase: "none" },
      },
    );
    const atom = buttonFor(menu, UnitType.AtomBomb);
    expect(atom.querySelector("[data-build-stock]")!.textContent).toContain(
      "[strategic.stock]",
    );
    expect(atom.querySelector("[data-build-reason]")!.textContent).toContain(
      "[strategic.no_stock]",
    );
    expect(
      buttonFor(menu, UnitType.HydrogenBomb).querySelector(
        "[data-build-reason]",
      ),
    ).toBeNull();
    menu.remove();
  });
```

`tests/client/graphics/RadialMenuElements.test.ts`: `beforeEach`의 `mockGame.config` 모의 객체에 `strategicWeapons: vi.fn(() => false),`를 더하고, "caps the nuke bulk amount at loaded silo tubes" 테스트 뒤에 추가:

```ts
    it("strategic weapons fire bombs one at a time: no bulk submenu", () => {
      mockParams.selected = {
        id: () => 2,
        isPlayer: vi.fn(() => true),
      } as unknown as PlayerView;
      const base = (mockGame.config as unknown as () => object)();
      (mockGame as any).config = vi.fn(() => ({
        ...base,
        strategicWeapons: () => true,
      }));
      (mockGame as any).myPlayer = vi.fn(() => ({
        gold: () => 1_000_000n,
        readyMissileCount: () => 5,
      }));
      const atomBombElement = attackMenuElement
        .subMenu!(mockParams)
        .find((item) => item.id === "attack_Atom Bomb");
      expect(atomBombElement!.subMenu!(mockParams)).toEqual([]);
    });
```

`tests/client/graphics/layers/EventsDisplayStrategic.test.ts`(목은 `EventsDisplayAnonymousNames.test.ts`와 같고, `translateText`만 다르다):

```ts
vi.mock("lit", () => ({
  html: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
  LitElement: class extends EventTarget {
    requestUpdate() {}
  },
}));
vi.mock("lit/decorators.js", () => ({
  customElement: () => (clazz: unknown) => clazz,
  state: () => () => {},
  property: () => () => {},
  query: () => () => {},
}));
vi.mock("lit/directive.js", () => ({}));
vi.mock("lit/directives/unsafe-html.js", () => ({
  unsafeHTML: (s: string) => s,
}));
vi.mock("../../../../src/client/Utils", () => ({
  // T(key) for a bare key; key|k=v,... with params.
  translateText: vi.fn(
    (key: string, params?: Record<string, string | number>) =>
      params === undefined
        ? `T(${key})`
        : `${key}|${Object.entries(params)
            .map(([k, v]) => `${k}=${v}`)
            .join(",")}`,
  ),
  getMessageTypeClasses: vi.fn(() => ""),
}));
vi.mock("@openfront/engine-lib/Format", () => ({
  renderNumber: vi.fn(),
  renderTroops: vi.fn(),
}));

import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventsDisplay } from "../../../../src/client/hud/layers/EventsDisplay";

describe("EventsDisplay strategic weapons messages", () => {
  let ed: EventsDisplay;
  const names: Record<number, string> = {
    1: "Me",
    2: "Silent Falcon",
    3: "Quiet Owl",
  };

  beforeEach(() => {
    ed = new EventsDisplay();
    (ed as unknown as { game: unknown }).game = {
      myPlayer: () => ({ smallID: () => 1, displayName: () => names[1] }),
      playerBySmallID: (id: number) =>
        names[id] === undefined
          ? { isPlayer: () => false }
          : {
              smallID: () => id,
              displayName: () => names[id],
              isPlayer: () => true,
            },
      unit: () => undefined,
      ticks: () => 0,
    };
  });

  const description = () =>
    (ed as unknown as { events: { description: string }[] }).events[0]
      .description;

  it("translates the interceptor's bomb", () => {
    ed.onDisplayMessageEvent({
      type: GameUpdateType.DisplayEvent,
      message: "events_display.satellite_intercept_hit",
      messageType: 0,
      playerID: null,
      params: { name: "RealName", unit: "unit_type.hydrogen_bomb" },
      focusPlayerID: 2,
    } as never);
    expect(description()).toBe(
      "events_display.satellite_intercept_hit|name=Silent Falcon,unit=T(unit_type.hydrogen_bomb)",
    );
  });

  it("re-resolves the target's name from targetID", () => {
    ed.onDisplayMessageEvent({
      type: GameUpdateType.DisplayEvent,
      message: "events_display.satellite_targeted",
      messageType: 0,
      playerID: null,
      params: { name: "RealName", target: "RealTarget", targetID: 3 },
      focusPlayerID: 2,
    } as never);
    expect(description()).toBe(
      "events_display.satellite_targeted|name=Silent Falcon,target=Quiet Owl,targetID=3",
    );
  });
});
```

- [ ] **Step 4: 실패 확인**

Run: `npx vitest tests/client/UnitDisplayHotbar.test.ts tests/client/graphics/layers/BuildMenuReasons.test.ts tests/client/graphics/RadialMenuElements.test.ts tests/client/graphics/layers/EventsDisplayStrategic.test.ts --run`
Expected: FAIL — `Transport`에 `SendProduceNukeIntentEvent`가 없다는 오류와, 새 테스트들의 `null`/`[]` 기대 실패

- [ ] **Step 5: 명령 이벤트**

`src/client/Transport.ts`:
- `@openfront/engine-api/game/GameTypes` import에 `PlayerID`가 없으면 더하고, `import { InterceptorNuke, StockpiledNuke } from "@openfront/engine-api/strategic/StrategicTypes";`를 추가한다.
- `SendParadropIntentEvent` 클래스 뒤에 추가:

```ts
/** Strategic weapons: start one nuke on a free factory line. */
export class SendProduceNukeIntentEvent implements GameEvent {
  constructor(public readonly nukeType: StockpiledNuke) {}
}

/** Strategic weapons: aim my satellite in orbit at `target`. */
export class SendSatelliteTargetIntentEvent implements GameEvent {
  constructor(public readonly target: PlayerID) {}
}

/** Strategic weapons: fire a stockpiled bomb at `attacker`'s satellite. */
export class SendInterceptSatelliteIntentEvent implements GameEvent {
  constructor(
    public readonly attacker: PlayerID,
    public readonly nukeType: InterceptorNuke,
  ) {}
}
```

- 생성자의 `this.subscribe(SendParadropIntentEvent, …);` 뒤에 추가:

```ts
    this.subscribe(SendProduceNukeIntentEvent, (e) =>
      this.sendIntent({ type: "produce_nuke", nukeType: e.nukeType }),
    );
    this.subscribe(SendSatelliteTargetIntentEvent, (e) =>
      this.sendIntent({ type: "satellite_target", target: e.target }),
    );
    this.subscribe(SendInterceptSatelliteIntentEvent, (e) =>
      this.sendIntent({
        type: "intercept_satellite",
        attacker: e.attacker,
        nukeType: e.nukeType,
      }),
    );
```

- [ ] **Step 6: 단축바**

`src/client/hud/layers/UnitDisplay.ts`:
- import에 추가: `StockpiledNuke`, `StrategicData`(`@openfront/engine-api/strategic/StrategicTypes`), `factoryWithFreeLine`, `isStockpiledNuke`, `NUKE_PRODUCTION_TICKS`(`@openfront/engine-lib/strategic/Strategic`), `SendProduceNukeIntentEvent`(`../../Transport`), 아이콘 `conventionalMissileIcon`, `satelliteIcon`.
- `HOTBAR`의 `mirv` 항목 뒤에 추가:

```ts
  {
    type: UnitType.ConventionalMissile,
    icon: conventionalMissileIcon,
    key: "conventional_missile",
    keybind: "",
    countable: false,
  },
  {
    type: UnitType.Satellite,
    icon: satelliteIcon,
    key: "satellite",
    keybind: "",
    countable: false,
  },
```

- `highlightTypes`의 `case UnitType.Bomber:` 블록 뒤에 추가:

```ts
    case UnitType.ConventionalMissile:
      return [UnitType.MissileSilo, UnitType.SAMLauncher];
    case UnitType.Satellite:
      return [UnitType.MissileSilo];
```

- `locked()` 메서드 뒤에 추가:

```ts
  /** Strategic weapons: my stockpile, lines and satellite; null with the option off. */
  private strategic(): StrategicData | null {
    return this.game?.myPlayer()?.strategicData() ?? null;
  }

  /** The stockpile behind a nuke's button, or null (not a nuke, or the option is off). */
  private stockOf(type: PlayerBuildableUnitType): number | null {
    const s = this.strategic();
    return s !== null && isStockpiledNuke(type) ? s.stock[type] : null;
  }

  /** Why a nuke can't be started at a factory now, or null if it can. */
  private produceReason(type: StockpiledNuke): string | null {
    if (this.locked(type)) return lockedReason(type);
    const player = this.game?.myPlayer();
    const s = this.strategic();
    if (!player || s === null) return null;
    const factories = player
      .units(UnitType.Factory)
      .filter((f) => !f.isUnderConstruction())
      .map((f) => ({ id: f.id(), level: f.level() }));
    if (factories.length === 0) return translateText("strategic.needs_factory");
    if (factoryWithFreeLine(factories, s.jobs) === null) {
      return translateText("strategic.no_free_line");
    }
    if (this.cost(type) > player.gold()) {
      return translateText("build_menu.not_enough_money");
    }
    return null;
  }

  private produce(type: StockpiledNuke): void {
    if (this.produceReason(type) !== null) return;
    this.eventBus?.emit(new SendProduceNukeIntentEvent(type));
  }
```

- `cannotBuildReason`의 금 검사와 발사대 검사를 다음으로 바꾸고(잠금 검사와 비행기·항구 검사는 그대로), 바로 뒤에 위성 검사를 더한다:

```ts
    const player = this.game?.myPlayer();
    const strategic = this.strategic();
    if (strategic !== null && isStockpiledNuke(type)) {
      // Strategic weapons: a nuke is fired from the stockpile, not bought.
      if (strategic.stock[type] === 0) {
        return translateText("strategic.no_stock");
      }
    } else if (this.cost(type) > (player?.gold() ?? 0n)) {
      return translateText("build_menu.not_enough_money");
    }
    if (
      (NUKES.has(type) ||
        type === UnitType.CoastalBarrage ||
        type === UnitType.ConventionalMissile ||
        type === UnitType.Satellite) &&
      (player?.units(UnitType.MissileSilo).length ?? 0) === 0
    ) {
      return translateText("touch_ui.needs_silo");
    }
    if (type === UnitType.Satellite && strategic !== null) {
      const phase = strategic.satellite.phase;
      if (phase === "preparing") {
        return translateText("strategic.satellite_busy");
      }
      if (phase !== "none") return translateText("strategic.satellite_used");
    }
```

- `renderItem`: 맨 앞에 `const stock = this.stockOf(item.type);`를 두고, `<img …/>` 바로 뒤(잠금·개수 표시 앞)에 배지를 넣는다:

```ts
        ${stock !== null
          ? html`<span
              data-stock
              class="absolute top-0.5 right-0.5 min-w-4 px-1 rounded-full bg-sky-600 text-[10px] leading-4 text-center tabular-nums"
              >${stock}</span
            >`
          : null}
```

- `renderInfoCard`: `const reason = …;` 뒤에 `const stock = this.stockOf(type);`를 두고, 금 아이콘과 가격 `<div class="flex items-center gap-1">…</div>` 묶음을 `${stock !== null ? this.renderProduction(type as StockpiledNuke, stock) : html`(그 묶음 그대로)`}`로 감싼다. 그리고 메서드를 추가한다:

```ts
  /** Strategic weapons: stock, lines in use, and the one-tap "Build" button (not a map action). */
  private renderProduction(type: StockpiledNuke, stock: number) {
    const producing =
      this.strategic()?.jobs.filter((j) => j.type === type).length ?? 0;
    const reason = this.produceReason(type);
    return html`
      <div data-strategic class="flex flex-col gap-2">
        <div class="font-semibold">
          ${translateText("strategic.stock", { count: stock })}${producing > 0
            ? ` · ${translateText("strategic.producing", { count: producing })}`
            : ""}
        </div>
        <div class="flex items-center gap-2">
          <img src=${goldCoinIcon} alt="" width="16" height="16" />
          <span class="text-yellow-300 font-bold"
            >${renderNumber(this.cost(type))}</span
          >
          <button
            type="button"
            data-produce
            class="ml-auto min-h-11 px-4 rounded-md font-semibold bg-sky-700 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed"
            ?disabled=${reason !== null}
            @click=${() => this.produce(type)}
          >
            ${translateText("strategic.produce", {
              seconds: NUKE_PRODUCTION_TICKS[type] / 10,
            })}
          </button>
        </div>
        ${reason !== null
          ? html`<div data-produce-reason class="text-amber-300">
              ${reason}
            </div>`
          : null}
      </div>
    `;
  }
```

- [ ] **Step 7: 건설 메뉴, 원형 메뉴, 알림**

`src/client/hud/layers/BuildMenu.ts`:
- `import { isStockpiledNuke } from "@openfront/engine-lib/strategic/Strategic";`를 더하고, 아이콘 상수들 뒤에 `const conventionalMissileIcon = assetUrl("images/ConventionalMissileIconWhite.svg");`를 둔다.
- `buildTable`의 `HydrogenBomb` 항목 뒤에 추가(위성은 단축바 전용이라 넣지 않는다):

```ts
    {
      unitType: UnitType.ConventionalMissile,
      icon: conventionalMissileIcon,
      description: "build_menu.desc.conventional_missile",
      key: "unit_type.conventional_missile",
      countable: false,
    },
```

- `cost()` 뒤에 추가:

```ts
  /** Strategic weapons: the stockpile behind a nuke's button; null otherwise. */
  private stockOf(type: UnitType): number | null {
    if (!isStockpiledNuke(type)) return null;
    const data = this.game?.myPlayer()?.strategicData() ?? null;
    return data === null ? null : data.stock[type];
  }
```

- `disabledReason`의 잠금 검사 뒤에 추가:

```ts
    const stock = this.stockOf(buildableUnit.type);
    if (stock !== null) {
      return stock === 0
        ? translateText("strategic.no_stock")
        : translateText("build_menu.cant_build_here");
    }
```

- `render`의 버튼마다 `const stock = this.stockOf(item.unitType);`를 두고, `<span class="build-cost" translate="no">…</span>`를 `${stock !== null ? html`<span class="build-cost" data-build-stock translate="no">${translateText("strategic.stock", { count: stock })}</span>` : html`(원래 span 그대로)`}`로 바꾼다.

`src/client/hud/layers/RadialMenuElements.ts`의 `isStackableNuke`를 다음으로 바꾼다:

```ts
          // Strategic weapons fire bombs one at a time from the stockpile.
          const isStackableNuke =
            item.unitType === UnitType.AtomBomb &&
            buildableUnit.canBuild !== false &&
            !params.game.config().strategicWeapons();
```

`src/client/hud/layers/EventsDisplay.ts`의 `resolveParams`: 첫 `if`의 메시지 조건에 `event.message === "events_display.nuke_production_done" ||`와 `event.message.startsWith("events_display.satellite_intercept_") ||`를 더하고, 그 `if` 블록 뒤에 추가:

```ts
    // Strategic weapons: a second player named by smallID (the satellite's
    // target), re-resolved like `name` below.
    if (typeof params.targetID === "number") {
      const target = this.game.playerBySmallID(params.targetID);
      if (target.isPlayer()) {
        params = { ...params, target: target.displayName() };
      }
    }
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest tests/client tests/radialMenuElements.test.ts --run && npm run typecheck`
Expected: 모두 PASS(UnitDisplayHotbar에 새 3 tests, BuildMenuReasons 새 1, RadialMenuElements 새 1, EventsDisplayStrategic 2), typecheck 오류 없음

- [ ] **Step 9: 커밋**

```bash
npx prettier --write src/client/hud src/client/Transport.ts tests/client CREDITS.md
git add resources/images CREDITS.md src/client/hud src/client/Transport.ts tests/client
git commit -m "feat(strategic): hotbar stock badges and production, missile and satellite buttons, intents"
```

---
### Task 11: 위쪽 카운트다운 띠, 목표 고르기, 순위표 "핵" 칸

**Files:**
- Create: `src/client/hud/layers/SatelliteBand.ts`, `src/client/hud/layers/SatelliteTargetPicker.ts`
- Modify: `src/client/hud/GameRenderer.ts`, `index.html`
- Modify: `src/client/StatsConstants.ts`, `src/client/hud/layers/lib/StatsColumns.ts`, `src/client/components/StatsTable.ts`, `src/client/hud/layers/GameLeftSidebar.ts`
- Modify (test): `tests/client/graphics/GameRendererCreate.test.ts` (`HUD_TAGS`)
- Test: `tests/client/SatelliteBand.test.ts`, `tests/client/NukeStockColumn.test.ts`

**Interfaces:**
- Consumes: Task 1 `PlayerView.strategicData()`, `interceptHitPct`, `strikeSecondsLeft`, `SATELLITE_STRIKE_DELAY_TICKS`, `stockTotal`, `INTERCEPTOR_NUKES`; Task 10 `SendSatelliteTargetIntentEvent`, `SendInterceptSatelliteIntentEvent`, `satelliteIcon`, `interceptIcon`, `atomBombIcon`; Task 8 키
- Produces: `<satellite-band>`(`SatelliteBand`, `Controller`: `game`, `eventBus`, `tick()`), `<satellite-target-picker>`(`SatelliteTargetPicker`, `Controller`: `init()`), `class OpenSatelliteTargetPickerEvent`; 순위표 칸 id `"nukes"`(`ColumnDef.strategicOnly`), `StatsTable.strategicWeapons`

- [ ] **Step 1: 실패하는 테스트 작성 — 띠와 목표 고르기**

`tests/client/SatelliteBand.test.ts`:

```ts
import { PlayerType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import { SatelliteBand } from "../../src/client/hud/layers/SatelliteBand";
import {
  OpenSatelliteTargetPickerEvent,
  SatelliteTargetPicker,
} from "../../src/client/hud/layers/SatelliteTargetPicker";
import {
  SendInterceptSatelliteIntentEvent,
  SendSatelliteTargetIntentEvent,
} from "../../src/client/Transport";
import type { PlayerView } from "../../src/client/view";

function data(over: Partial<StrategicData> = {}): StrategicData {
  return {
    stock: {
      [UnitType.AtomBomb]: 0,
      [UnitType.HydrogenBomb]: 0,
      [UnitType.MIRV]: 0,
    },
    jobs: [],
    satellite: { phase: "none" },
    ...over,
  };
}

interface Stub {
  id: string;
  smallID: number;
  data?: StrategicData | null;
  tiles?: number;
  silos?: number;
  type?: PlayerType;
  friends?: string[];
}

function view(s: Stub): PlayerView {
  return {
    id: () => s.id,
    smallID: () => s.smallID,
    displayName: () => s.id,
    isAlive: () => true,
    isPlayer: () => true,
    type: () => s.type ?? PlayerType.Human,
    numTilesOwned: () => s.tiles ?? 100,
    strategicData: () => s.data ?? null,
    isFriendly: (o: PlayerView) => (s.friends ?? []).includes(o.id()),
    territoryColor: () => ({ toHex: () => "#ffffff" }),
    units: (t: UnitType) =>
      t === UnitType.MissileSilo
        ? Array.from({ length: s.silos ?? 0 }, () => ({
            isActive: () => true,
            isUnderConstruction: () => false,
            isInCooldown: () => false,
          }))
        : [],
  } as unknown as PlayerView;
}

function bus() {
  const emitted: unknown[] = [];
  const handlers = new Map<unknown, () => void>();
  return {
    emitted,
    handlers,
    eventBus: {
      emit: (e: unknown) => emitted.push(e),
      on: (type: unknown, cb: () => void) => handlers.set(type, cb),
    },
  };
}

async function band(me: PlayerView, players: PlayerView[], now = 400) {
  const el = document.createElement("satellite-band") as SatelliteBand;
  expect(el).toBeInstanceOf(SatelliteBand);
  const b = bus();
  el.game = {
    config: () => ({ strategicWeapons: () => true }),
    ticks: () => now,
    myPlayer: () => me,
    playerViews: () => players,
    playerBySmallID: (id: number) =>
      players.find((p) => p.smallID() === id) ?? { isPlayer: () => false },
  } as unknown as SatelliteBand["game"];
  el.eventBus = b.eventBus as unknown as SatelliteBand["eventBus"];
  document.body.appendChild(el);
  el.tick();
  await el.updateComplete;
  return { el, ...b };
}

// Red's satellite strikes blue at tick 700; it is tick 400: 30 s left, 50%.
const red = () =>
  view({
    id: "red",
    smallID: 1,
    data: data({
      satellite: {
        phase: "targeted",
        target: 2,
        strikeTick: 700,
        interceptors: [{ by: 3, type: UnitType.AtomBomb, resolveTick: 420 }],
      },
    }),
  });
const blue = () => view({ id: "blue", smallID: 2, data: data() });

describe("satellite band", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows nothing without a strike or a satellite in orbit", async () => {
    const me = blue();
    const { el } = await band(me, [me]);
    expect(el.querySelector("[data-satellite-band]")).toBeNull();
  });

  it("shows everyone who strikes whom, the seconds left and the bar", async () => {
    const me = view({ id: "green", smallID: 3, data: data(), silos: 1 });
    const { el } = await band(me, [red(), blue(), me]);
    const row = el.querySelector("[data-countdown]")!;
    expect(row.textContent).toContain("[strategic.band] name=red,target=blue");
    expect(row.querySelector("[data-seconds]")!.textContent).toContain(
      "seconds=30",
    );
    expect(
      row.querySelector<HTMLElement>("[data-progress]")!.style.width,
    ).toBe("50%");
    expect(row.textContent).toContain(
      "[strategic.interceptors_in_flight] count=1",
    );
  });

  it("intercept buttons show each stock and odds; two taps fire", async () => {
    const me = view({
      id: "green",
      smallID: 3,
      silos: 1,
      data: data({
        stock: {
          [UnitType.AtomBomb]: 0,
          [UnitType.HydrogenBomb]: 2,
          [UnitType.MIRV]: 0,
        },
      }),
    });
    const { el, emitted } = await band(me, [red(), blue(), me]);
    const hydrogen = el.querySelector<HTMLButtonElement>(
      `[data-intercept="${UnitType.HydrogenBomb}"]`,
    )!;
    const atom = el.querySelector<HTMLButtonElement>(
      `[data-intercept="${UnitType.AtomBomb}"]`,
    )!;
    expect(hydrogen.textContent).toContain(
      "[strategic.intercept_with] unit=[unit_type.hydrogen_bomb],count=2,pct=20",
    );
    expect(atom.textContent).toContain("count=0,pct=4");
    expect(atom.disabled).toBe(true);
    expect(hydrogen.classList.contains("min-h-11")).toBe(true);

    hydrogen.click();
    await el.updateComplete;
    expect(emitted).toHaveLength(0);
    expect(hydrogen.textContent).toContain("[strategic.tap_again_to_fire]");
    hydrogen.click();
    expect(emitted).toContainEqual(
      new SendInterceptSatelliteIntentEvent("red", UnitType.HydrogenBomb),
    );
  });

  it("the attacker gets no intercept buttons; without a ready silo they're disabled", async () => {
    const attacker = red();
    const { el } = await band(attacker, [attacker, blue()]);
    expect(el.querySelector("[data-intercept]")).toBeNull();
    document.body.innerHTML = "";

    const me = view({
      id: "green",
      smallID: 3,
      silos: 0,
      data: data({
        stock: {
          [UnitType.AtomBomb]: 1,
          [UnitType.HydrogenBomb]: 1,
          [UnitType.MIRV]: 0,
        },
      }),
    });
    const second = await band(me, [red(), blue(), me]);
    for (const b of second.el.querySelectorAll<HTMLButtonElement>(
      "[data-intercept]",
    )) {
      expect(b.disabled).toBe(true);
    }
  });

  it("the satellite's owner opens the target picker while it waits in orbit", async () => {
    const me = view({
      id: "red",
      smallID: 1,
      data: data({ satellite: { phase: "orbit" } }),
    });
    const { el, emitted } = await band(me, [me, blue()]);
    el.querySelector<HTMLButtonElement>("[data-choose-target]")!.click();
    expect(emitted).toContainEqual(new OpenSatelliteTargetPickerEvent());
  });
});

describe("satellite target picker", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("lists the nations it may strike, biggest first; two taps aim and close", async () => {
    const me = view({ id: "red", smallID: 1, friends: ["green"] });
    const players = [
      me,
      view({ id: "blue", smallID: 2, tiles: 300 }),
      view({ id: "green", smallID: 3, tiles: 900 }), // an ally
      view({ id: "yellow", smallID: 4, tiles: 500 }),
      view({ id: "tribe", smallID: 5, tiles: 999, type: PlayerType.Bot }),
    ];
    const el = document.createElement(
      "satellite-target-picker",
    ) as SatelliteTargetPicker;
    const b = bus();
    el.game = {
      myPlayer: () => me,
      playerViews: () => players,
    } as unknown as SatelliteTargetPicker["game"];
    el.eventBus = b.eventBus as unknown as SatelliteTargetPicker["eventBus"];
    document.body.appendChild(el);
    el.init();
    b.handlers.get(OpenSatelliteTargetPickerEvent)!();
    await el.updateComplete;

    const rows = [...el.querySelectorAll<HTMLButtonElement>("[data-target]")];
    expect(rows.map((r) => r.dataset.target)).toEqual(["yellow", "blue"]);
    expect(rows.every((r) => r.classList.contains("min-h-11"))).toBe(true);
    rows[1].click();
    await el.updateComplete;
    expect(b.emitted).toHaveLength(0);
    el.querySelector<HTMLButtonElement>('[data-target="blue"]')!.click();
    await el.updateComplete;
    expect(b.emitted).toContainEqual(new SendSatelliteTargetIntentEvent("blue"));
    expect(el.querySelector("[data-target-picker]")).toBeNull();
  });
});
```

- [ ] **Step 2: 실패하는 테스트 작성 — 순위표**

`tests/client/NukeStockColumn.test.ts`(`tests/client/DomesticScoreColumn.test.ts`의 `player`/`game` 모의를 그대로 쓰고 `strategicData`만 더한다):

```ts
import { PlayerType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";
import { columnById } from "../../src/client/hud/layers/lib/StatsColumns";
import { PlayerStats } from "../../src/client/hud/layers/PlayerStats";
import { UserSettings } from "../../src/client/UserSettings";
import type { GameView, PlayerView } from "../../src/client/view";

function player(id: number, stock: StrategicData | null): PlayerView {
  return {
    id: () => `p${id}`,
    smallID: () => id,
    name: () => `p${id}`,
    displayName: () => `p${id}`,
    clanTag: () => null,
    type: () => PlayerType.Human,
    numTilesOwned: () => 100,
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
    strategicData: () => stock,
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

const STOCK: StrategicData = {
  stock: {
    [UnitType.AtomBomb]: 2,
    [UnitType.HydrogenBomb]: 1,
    [UnitType.MIRV]: 1,
  },
  jobs: [],
  satellite: { phase: "none" },
};

describe("nukes column", () => {
  beforeEach(() => {
    localStorage.clear();
    (
      UserSettings as unknown as { cache: Map<string, string | null> }
    ).cache.clear();
  });

  it("sums each player's stockpile, for everyone to see, and can't be hidden", () => {
    const a = player(1, STOCK);
    const column = columnById("nukes");
    expect(column.value?.(a, game([a]))).toBe(4);
    expect(column.value?.(player(2, null), game([a]))).toBe(0);
    expect(column.cell({ position: 1, name: "a", value: 4 }, game([a]))).toBe(
      "4",
    );
    expect(column.isHideable).toBe(false);
    expect(column.strategicOnly).toBe(true);
  });

  it("player stats show it only with strategic weapons", async () => {
    for (const [on, template] of [
      [true, "34px 80px 100px auto auto auto auto 32px"],
      [false, "34px 80px 100px auto auto auto 32px"],
    ] as const) {
      const stats = new PlayerStats();
      stats.game = game([player(1, STOCK)]);
      stats.visible = true;
      stats.strategicWeapons = on;
      document.body.append(stats);
      stats.refresh();
      await stats.updateComplete;
      // rank, clan, player | (nukes,) tiles, gold, maxtroops | picker
      expect(
        stats.querySelector(".stats-table-content")?.getAttribute("style"),
      ).toContain(template);
      stats.remove();
    }
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest tests/client/SatelliteBand.test.ts tests/client/NukeStockColumn.test.ts --run`
Expected: FAIL — `Cannot find module '../../src/client/hud/layers/SatelliteBand'`, `columnById("nukes")`가 `undefined`

- [ ] **Step 4: 목표 고르기**

`src/client/hud/layers/SatelliteTargetPicker.ts`:

```ts
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { EventBus, GameEvent } from "@openfront/shared/EventBus";
import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SendSatelliteTargetIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { GameView, PlayerView } from "../../view";

/** Opens the satellite's target picker (the band's "Choose a target"). */
export class OpenSatelliteTargetPickerEvent implements GameEvent {}

/**
 * Strategic weapons (spec §6.2, §7): pick the nation the satellite in orbit
 * strikes. One 44px row per nation it may strike, biggest first; the first
 * tap arms a row, the second aims and closes. Tribes are not offered.
 */
@customElement("satellite-target-picker")
export class SatelliteTargetPicker extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private open = false;
  /** Id of the row waiting for its second tap. */
  @state() private armed: string | null = null;

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(OpenSatelliteTargetPickerEvent, () => {
      this.open = true;
      this.armed = null;
    });
  }

  /** Alive nations that aren't me, my allies or my team, biggest first. */
  private choices(): PlayerView[] {
    const me = this.game.myPlayer();
    if (me === null) return [];
    return this.game
      .playerViews()
      .filter(
        (p) =>
          p !== me &&
          p.isAlive() &&
          p.type() !== PlayerType.Bot &&
          !me.isFriendly(p),
      )
      .sort((a, b) => b.numTilesOwned() - a.numTilesOwned());
  }

  private pick(p: PlayerView): void {
    if (this.armed !== p.id()) {
      this.armed = p.id();
      return;
    }
    this.eventBus.emit(new SendSatelliteTargetIntentEvent(p.id()));
    this.close();
  }

  private close(): void {
    this.open = false;
    this.armed = null;
  }

  render() {
    if (!this.open) return null;
    const choices = this.choices();
    return html`
      <div
        class="fixed inset-0 bg-black/40 flex items-center justify-center z-[10002]"
        @click=${(e: Event) => {
          if (e.target === e.currentTarget) this.close();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          data-target-picker
          class="bg-zinc-900/95 text-white p-3 rounded-xl w-[min(28rem,calc(100vw-32px))] max-h-[calc(100vh-60px)] overflow-y-auto"
        >
          <div class="flex items-center gap-2 mb-2">
            <div class="flex-1 text-base font-bold">
              ${translateText("strategic.target_title")}
            </div>
            <button
              type="button"
              class="size-11 flex items-center justify-center rounded-md text-xl hover:bg-white/10"
              aria-label=${translateText("common.close")}
              @click=${() => this.close()}
            >
              ✕
            </button>
          </div>
          ${choices.length === 0
            ? html`<div class="text-gray-300">
                ${translateText("strategic.no_targets")}
              </div>`
            : html`<div class="flex flex-col gap-1">
                ${choices.map(
                  (p) => html`
                    <button
                      type="button"
                      data-target=${p.id()}
                      class="min-h-11 px-3 rounded-md text-left border-l-4 bg-white/5 hover:bg-white/15 active:bg-white/25 ${this
                        .armed === p.id()
                        ? "ring-2 ring-white"
                        : ""}"
                      style="border-left-color: ${p.territoryColor().toHex()}"
                      @click=${() => this.pick(p)}
                    >
                      ${p.displayName()}
                      ${this.armed === p.id()
                        ? html`<span class="ml-2 text-xs text-sky-300"
                            >${translateText("strategic.tap_again_to_target")}</span
                          >`
                        : null}
                    </button>
                  `,
                )}
              </div>`}
        </div>
      </div>
    `;
  }
}
```

- [ ] **Step 5: 위쪽 띠**

`src/client/hud/layers/SatelliteBand.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  INTERCEPTOR_NUKES,
  InterceptorNuke,
} from "@openfront/engine-api/strategic/StrategicTypes";
import {
  interceptHitPct,
  SATELLITE_STRIKE_DELAY_TICKS,
  strikeSecondsLeft,
} from "@openfront/engine-lib/strategic/Strategic";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { SendInterceptSatelliteIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { GameView, PlayerView } from "../../view";
import { interceptIcon, satelliteIcon } from "../HotbarIcons";
import { OpenSatelliteTargetPickerEvent } from "./SatelliteTargetPicker";

const UNIT_KEYS: Readonly<Record<InterceptorNuke, string>> = {
  [UnitType.HydrogenBomb]: "unit_type.hydrogen_bomb",
  [UnitType.AtomBomb]: "unit_type.atom_bomb",
};

/** One satellite strike counting down. */
interface Countdown {
  attacker: PlayerView;
  target: PlayerView | null;
  strikeTick: number;
  inFlight: number;
}

/**
 * Strategic weapons (spec §6.2-6.3, §7): a slim band at the top of every
 * screen while a satellite strike counts down — who strikes whom, the
 * seconds left on a bar, interceptors in flight, and the intercept buttons
 * (each bomb's stock and odds; two taps fire). The satellite's owner also
 * gets a row that opens the target picker while it waits in orbit. Nothing
 * covers the map.
 */
@customElement("satellite-band")
export class SatelliteBand extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  /** "attackerId:type" of the intercept button waiting for its second tap. */
  private armed: string | null = null;

  createRenderRoot() {
    return this;
  }

  tick() {
    if (this.game?.config().strategicWeapons()) this.requestUpdate();
  }

  private countdowns(): Countdown[] {
    const rows: Countdown[] = [];
    for (const p of this.game.playerViews()) {
      const sat = p.strategicData()?.satellite;
      if (sat?.phase !== "targeted") continue;
      const target = this.game.playerBySmallID(sat.target);
      rows.push({
        attacker: p,
        target: target.isPlayer() ? target : null,
        strikeTick: sat.strikeTick,
        inFlight: sat.interceptors.length,
      });
    }
    return rows;
  }

  private hasReadySilo(me: PlayerView): boolean {
    return me
      .units(UnitType.MissileSilo)
      .some(
        (s) => s.isActive() && !s.isUnderConstruction() && !s.isInCooldown(),
      );
  }

  private onIntercept(attacker: PlayerView, type: InterceptorNuke): void {
    const key = `${attacker.id()}:${type}`;
    if (this.armed === key) {
      this.armed = null;
      this.eventBus.emit(
        new SendInterceptSatelliteIntentEvent(attacker.id(), type),
      );
    } else {
      this.armed = key;
    }
    this.requestUpdate();
  }

  render() {
    if (!this.game?.config().strategicWeapons()) return null;
    const me = this.game.myPlayer();
    const rows = this.countdowns();
    const inOrbit = me?.strategicData()?.satellite.phase === "orbit";
    if (rows.length === 0 && !inOrbit) return null;
    return html`
      <div
        data-satellite-band
        class="fixed top-2 left-1/2 -translate-x-1/2 z-[900] w-[min(30rem,calc(100vw-32px))] flex flex-col gap-1 text-white text-sm"
      >
        ${inOrbit ? this.renderOrbit() : null}
        ${rows.map((c) => this.renderCountdown(c, me))}
      </div>
    `;
  }

  private renderOrbit() {
    return html`
      <div
        data-orbit
        class="flex items-center gap-2 rounded-md bg-gray-900/85 border border-sky-500/60 px-3 py-1"
      >
        <img src=${satelliteIcon} alt="" class="size-5" />
        <span class="flex-1 font-semibold"
          >${translateText("strategic.satellite_ready")}</span
        >
        <button
          type="button"
          data-choose-target
          class="min-h-11 px-4 rounded-md font-semibold bg-sky-700 hover:bg-sky-600"
          @click=${() => this.eventBus.emit(new OpenSatelliteTargetPickerEvent())}
        >
          ${translateText("strategic.choose_target")}
        </button>
      </div>
    `;
  }

  private renderCountdown(c: Countdown, me: PlayerView | null) {
    const now = this.game.ticks();
    const left = Math.max(0, c.strikeTick - now);
    const elapsedPct = Math.min(
      100,
      Math.round((1 - left / SATELLITE_STRIKE_DELAY_TICKS) * 100),
    );
    const canShoot =
      me !== null && me.isAlive() && me !== c.attacker && left > 0;
    return html`
      <div
        data-countdown
        class="rounded-md bg-gray-900/85 border border-red-500/60 px-3 py-1.5"
      >
        <div class="flex items-center gap-2">
          <img src=${satelliteIcon} alt="" class="size-5" />
          <span class="flex-1 font-semibold truncate"
            >${translateText("strategic.band", {
              name: c.attacker.displayName(),
              target: c.target?.displayName() ?? "",
            })}</span
          >
          <span data-seconds class="tabular-nums font-bold"
            >${translateText("strategic.seconds_left", {
              seconds: strikeSecondsLeft(c.strikeTick, now),
            })}</span
          >
        </div>
        <div class="h-1.5 mt-1 bg-gray-700 rounded-sm">
          <div
            data-progress
            class="h-1.5 bg-red-500 rounded-sm"
            style="width: ${elapsedPct}%"
          ></div>
        </div>
        ${c.inFlight > 0
          ? html`<div class="mt-1 text-xs text-amber-300">
              ${translateText("strategic.interceptors_in_flight", {
                count: c.inFlight,
              })}
            </div>`
          : null}
        ${canShoot
          ? html`<div class="flex gap-2 mt-1">
              ${INTERCEPTOR_NUKES.map((type) =>
                this.renderInterceptButton(c.attacker, type, me!),
              )}
            </div>`
          : null}
      </div>
    `;
  }

  private renderInterceptButton(
    attacker: PlayerView,
    type: InterceptorNuke,
    me: PlayerView,
  ) {
    const count = me.strategicData()?.stock[type] ?? 0;
    const enabled = count > 0 && this.hasReadySilo(me);
    const armed = this.armed === `${attacker.id()}:${type}`;
    return html`
      <button
        type="button"
        data-intercept=${type}
        class="flex-1 min-h-11 px-2 flex items-center justify-center gap-1 rounded-md font-semibold bg-sky-700 hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed ${armed
          ? "ring-2 ring-white"
          : ""}"
        ?disabled=${!enabled}
        @click=${() => this.onIntercept(attacker, type)}
      >
        <img src=${interceptIcon} alt="" class="size-5" />
        ${armed
          ? translateText("strategic.tap_again_to_fire")
          : translateText("strategic.intercept_with", {
              unit: translateText(UNIT_KEYS[type]),
              count,
              pct: interceptHitPct(type),
            })}
      </button>
    `;
  }
}
```

- [ ] **Step 6: 화면에 등록**

`index.html`의 `<immunity-timer></immunity-timer>` 뒤에 `<satellite-band></satellite-band>`와 `<satellite-target-picker></satellite-target-picker>`를 넣는다.

`src/client/hud/GameRenderer.ts`: 두 클래스를 import하고, `immunityTimer` 연결 블록 뒤에 같은 모양으로 추가한 뒤 `layers` 배열의 `immunityTimer,` 뒤에 `satelliteBand, satelliteTargetPicker,`를 넣는다:

```ts
  const satelliteBand = document.querySelector(
    "satellite-band",
  ) as SatelliteBand;
  if (!(satelliteBand instanceof SatelliteBand)) {
    console.error("satellite band not found");
  }
  satelliteBand.game = game;
  satelliteBand.eventBus = eventBus;

  const satelliteTargetPicker = document.querySelector(
    "satellite-target-picker",
  ) as SatelliteTargetPicker;
  if (!(satelliteTargetPicker instanceof SatelliteTargetPicker)) {
    console.error("satellite target picker not found");
  }
  satelliteTargetPicker.game = game;
  satelliteTargetPicker.eventBus = eventBus;
```

`tests/client/graphics/GameRendererCreate.test.ts`의 `HUD_TAGS`에서 `"immunity-timer",` 뒤에 `"satellite-band",`와 `"satellite-target-picker",`를 넣는다.

- [ ] **Step 7: 순위표 칸**

`src/client/StatsConstants.ts`의 `COLUMN_IDS`에서 `"score",` 뒤에 추가:

```ts
  // Strategic weapons only: always shown there, never offered in the menu.
  "nukes",
```

`src/client/hud/layers/lib/StatsColumns.ts`:
- `ColumnDef`의 `domesticOnly?: true;` 뒤에 `/** Only exists with strategic weapons (StatsTable.strategicWeapons). */ readonly strategicOnly?: true;`를 더한다.
- import에 `stockTotal`(`@openfront/engine-lib/strategic/Strategic`)과 `atomBombIcon`(`../../HotbarIcons` import 목록)을 더한다.
- `COLUMN_DEFS`의 `score` 정의 뒤에 추가:

```ts
  // Strategic weapons: every nation's stockpile is public (spec §4). One
  // total fits the tablet sidebar; the per-type count is on each player's
  // own nuke buttons.
  defineColumn({
    id: "nukes",
    labelKey: "leaderboard.nukes",
    headerVisual: { kind: "icon", src: atomBombIcon },
    isHideable: false,
    strategicOnly: true,
    align: "center",
    value: (player) => stockTotal(player.strategicData()),
    cell: (row) => renderNumber(row.value),
  }),
```

`src/client/components/StatsTable.ts`: `domesticMode` 속성 뒤에 `/** Strategic weapons: show the strategic-only columns (the nukes column). */ @property({ type: Boolean }) strategicWeapons = false;`를 더하고, `visibleColumns`의 필터에 `(column.strategicOnly !== true || this.strategicWeapons) &&`를 더한다.

`src/client/hud/layers/GameLeftSidebar.ts`: `<player-stats>`와 `<team-stats>`의 `.domesticMode=…` 뒤에 각각 `.strategicWeapons=${this.game?.config().gameConfig().strategicWeapons === true}`를 더한다.

- [ ] **Step 8: 통과 확인**

Run: `npx vitest tests/client tests/StatsColumns.test.ts tests/ColumnPicker.test.ts tests/GameLeftSidebar.test.ts tests/PlayerStats.test.ts tests/TeamStats.test.ts --run && npm run typecheck`
Expected: 모두 PASS(SatelliteBand 6, NukeStockColumn 2 포함), typecheck 오류 없음

- [ ] **Step 9: 커밋**

```bash
npx prettier --write src/client/hud src/client/StatsConstants.ts src/client/components/StatsTable.ts index.html tests/client
git add src/client index.html tests/client
git commit -m "feat(strategic): satellite countdown band with interception, target picker, nukes leaderboard column"
```

---
### Task 12: 지도 그림 — 진행 막대, 미사일 그림, 빛줄기와 폭발

**Files:**
- Modify: `src/client/render/types/UnitType.ts`, `src/client/render/types/index.ts` (`UT_CONVENTIONAL_MISSILE`)
- Modify: `src/client/render/gl/passes/UnitPass.ts` (`UNIT_ORDER` 15번째 칸, `MISSILE_TYPES`)
- Modify: `resources/atlases/src/unit-sprites.py`, `resources/atlases/unit-atlas.png`, `CREDITS.md` (`unit-atlas.png` 줄만)
- Modify: `src/client/render/gl/passes/fx-pass/FxSpritePass.ts` (미사일 명중), `src/client/render/gl/passes/fx-pass/index.ts` (`spawnOrbitalImpacts`)
- Create: `src/client/render/gl/passes/OrbitalBeamPass.ts`, `src/client/render/gl/shaders/orbital-beam/orbital-beam.vert.glsl`, `orbital-beam.frag.glsl`
- Create: `src/client/render/frame/derive/StrategicProgress.ts`, `src/client/render/frame/derive/OrbitalStrikes.ts`
- Modify: `src/client/render/gl/passes/BarPass.ts`, `src/client/render/gl/Renderer.ts`, `src/client/render/gl/MapRenderer.ts`, `src/client/WebGLFrameBuilder.ts`
- Modify (test): `tests/client/render/gl/StructureAtlas.test.ts`
- Test: `tests/client/render/frame/derive/strategic.test.ts`, `tests/client/render/gl/OrbitalBeamPass.test.ts`

**Interfaces:**
- Consumes: Task 1 `PlayerView.strategicData()`, `GameUpdateType.OrbitalStrike`, `OrbitalStrikeUpdate`, `UnitType.ConventionalMissile`
- Produces: `UT_CONVENTIONAL_MISSILE`; `deriveStrategicProgress(players, now): Map<number, number>`; `MAX_ORBITAL_IMPACTS`(16), `orbitalImpactPoints(strikes, mapW): {x, y}[]`; `OrbitalBeamPass(gl)`의 `spawn(points)`, `draw(cam)`, `setTimeFn(fn)`, `dispose()`; `MapRenderer.setStrategicProgress(progress)`, `MapRenderer.applyOrbitalStrikes(points)`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/render/frame/derive/strategic.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";
import {
  MAX_ORBITAL_IMPACTS,
  orbitalImpactPoints,
} from "../../../../../src/client/render/frame/derive/OrbitalStrikes";
import { deriveStrategicProgress } from "../../../../../src/client/render/frame/derive/StrategicProgress";

const NONE = {
  [UnitType.AtomBomb]: 0,
  [UnitType.HydrogenBomb]: 0,
  [UnitType.MIRV]: 0,
};

const source = (alive: boolean, data: StrategicData | null) => ({
  isAlive: () => alive,
  strategicData: () => data,
});

describe("strategic map bars", () => {
  test("a factory shows its furthest-along nuke, a silo its satellite; the dead show nothing", () => {
    const out = deriveStrategicProgress(
      [
        source(true, {
          stock: NONE,
          jobs: [
            { factoryId: 5, type: UnitType.AtomBomb, startTick: 0, endTick: 200 },
            {
              factoryId: 5,
              type: UnitType.HydrogenBomb,
              startTick: 100,
              endTick: 500,
            },
          ],
          satellite: {
            phase: "preparing",
            siloId: 9,
            startTick: 0,
            readyTick: 900,
          },
        }),
        source(false, {
          stock: NONE,
          jobs: [
            { factoryId: 7, type: UnitType.AtomBomb, startTick: 0, endTick: 200 },
          ],
          satellite: { phase: "none" },
        }),
        source(true, null),
      ],
      100,
    );
    expect(out.get(5)).toBeCloseTo(0.5);
    expect(out.get(9)).toBeCloseTo(100 / 900);
    expect(out.has(7)).toBe(false);
  });

  test("orbital strike impacts become points, at most 16 a strike", () => {
    const impacts = Array.from({ length: 20 }, (_, i) => i * 101);
    const points = orbitalImpactPoints([{ impacts }], 100);
    expect(points).toHaveLength(MAX_ORBITAL_IMPACTS);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[1]).toEqual({ x: 1, y: 1 });
  });
});
```

`tests/client/render/gl/OrbitalBeamPass.test.ts`:

```ts
import { OrbitalBeamPass } from "../../../../src/client/render/gl/passes/OrbitalBeamPass";

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

describe("orbital beams", () => {
  test("one thin beam per impact, gone after 1.2 s", () => {
    const { gl, counts } = countingGL();
    const pass = new OrbitalBeamPass(gl);
    let now = 0;
    pass.setTimeFn(() => now);
    pass.spawn([
      { x: 1, y: 1 },
      { x: 5, y: 9 },
    ]);
    pass.draw(new Float32Array(9));
    expect(counts.draws).toBe(2);
    now = 1300;
    counts.draws = 0;
    pass.draw(new Float32Array(9));
    expect(counts.draws).toBe(0);
  });
});
```

`tests/client/render/gl/StructureAtlas.test.ts`: `UT_CONVENTIONAL_MISSILE`를 import 목록에 더하고 "has one 13px column per UnitPass atlas column"에 `expect(UNIT_ORDER.indexOf(UT_CONVENTIONAL_MISSILE)).toBe(15);`를 더한다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/render/frame/derive/strategic.test.ts tests/client/render/gl/OrbitalBeamPass.test.ts tests/client/render/gl/StructureAtlas.test.ts --run`
Expected: FAIL — 새 모듈을 찾을 수 없다, `UT_CONVENTIONAL_MISSILE`이 없다

- [ ] **Step 3: 진행 막대와 착탄점 계산**

`src/client/render/frame/derive/StrategicProgress.ts`:

```ts
import type { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";

/** What deriveStrategicProgress reads of a player (PlayerView satisfies it). */
export interface StrategicProgressSource {
  isAlive(): boolean;
  strategicData(): StrategicData | null;
}

function fraction(start: number, end: number, now: number): number {
  return Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
}

/**
 * Strategic weapons: unit id -> bar fill (0..1) for every alive player's
 * factories making nukes (the furthest-along nuke) and silo preparing a
 * satellite. Drawn in the structure progress-bar slot, like victory projects.
 */
export function deriveStrategicProgress(
  players: Iterable<StrategicProgressSource>,
  now: number,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of players) {
    if (!p.isAlive()) continue;
    const data = p.strategicData();
    if (data === null) continue;
    for (const job of data.jobs) {
      const f = fraction(job.startTick, job.endTick, now);
      out.set(job.factoryId, Math.max(out.get(job.factoryId) ?? 0, f));
    }
    const sat = data.satellite;
    if (sat.phase === "preparing") {
      out.set(sat.siloId, fraction(sat.startTick, sat.readyTick, now));
    }
  }
  return out;
}
```

`src/client/render/frame/derive/OrbitalStrikes.ts`:

```ts
/** Beams and blasts per strike: modest, never the whole screen (spec §6.5). */
export const MAX_ORBITAL_IMPACTS = 16;

/** Map points of this tick's orbital strike impacts, the first MAX_ORBITAL_IMPACTS of each strike. */
export function orbitalImpactPoints(
  strikes: readonly { impacts: readonly number[] }[],
  mapW: number,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (const strike of strikes) {
    for (const tile of strike.impacts.slice(0, MAX_ORBITAL_IMPACTS)) {
      const x = tile % mapW;
      points.push({ x, y: (tile - x) / mapW });
    }
  }
  return points;
}
```

- [ ] **Step 4: 빛줄기 패스와 셰이더**

`src/client/render/gl/shaders/orbital-beam/orbital-beam.vert.glsl`:

```glsl
#version 300 es
precision highp float;

// Unit quad [0,1]
layout(location = 0) in vec2 aPos;

uniform mat3 uCamera;
uniform vec2 uBase;     // impact tile (world tile coords)
uniform float uLength;  // beam length in tiles, up from the impact
uniform float uWidth;   // beam width in tiles

out vec2 vLocal;        // x: -1..1 across the beam, y: 0 at the impact .. 1 at the top

void main() {
  vLocal = vec2(aPos.x * 2.0 - 1.0, aPos.y);
  vec2 world = uBase + 0.5 + vec2(vLocal.x * uWidth * 0.5, -aPos.y * uLength);
  vec3 clip = uCamera * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
```

`src/client/render/gl/shaders/orbital-beam/orbital-beam.frag.glsl`:

```glsl
#version 300 es
precision highp float;

in vec2 vLocal;

uniform float uAge;  // 0 at the impact .. 1 when the beam is gone

out vec4 fragColor;

void main() {
  float core = 1.0 - smoothstep(0.0, 1.0, abs(vLocal.x));
  float alpha = core * (1.0 - vLocal.y) * (1.0 - uAge) * 0.85;
  if (alpha < 0.01) discard;
  fragColor = vec4(mix(vec3(0.75, 0.9, 1.0), vec3(1.0), core), alpha);
}
```

`src/client/render/gl/passes/OrbitalBeamPass.ts`:

```ts
/**
 * OrbitalBeamPass — strategic weapons (spec §6.5): a thin beam falling from
 * the sky onto each orbital strike impact, fading out in BEAM_MS. One quad
 * per beam; the blast itself comes from FxPass.spawnOrbitalImpacts.
 */

import { createProgram } from "../utils/GlUtils";

import fragSrc from "../shaders/orbital-beam/orbital-beam.frag.glsl?raw";
import vertSrc from "../shaders/orbital-beam/orbital-beam.vert.glsl?raw";

const BEAM_MS = 1200;
const BEAM_LENGTH_TILES = 60;
const BEAM_WIDTH_TILES = 1.5;

export class OrbitalBeamPass {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;
  private uCamera: WebGLUniformLocation;
  private uBase: WebGLUniformLocation;
  private uLength: WebGLUniformLocation;
  private uWidth: WebGLUniformLocation;
  private uAge: WebGLUniformLocation;
  private beams: { x: number; y: number; start: number }[] = [];
  private timeFn: () => number = () => performance.now();

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = createProgram(gl, vertSrc, fragSrc, "OrbitalBeamPass");
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uBase = gl.getUniformLocation(this.program, "uBase")!;
    this.uLength = gl.getUniformLocation(this.program, "uLength")!;
    this.uWidth = gl.getUniformLocation(this.program, "uWidth")!;
    this.uAge = gl.getUniformLocation(this.program, "uAge")!;
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

  setTimeFn(fn: () => number): void {
    this.timeFn = fn;
  }

  spawn(points: readonly { x: number; y: number }[]): void {
    const start = this.timeFn();
    for (const p of points) this.beams.push({ x: p.x, y: p.y, start });
  }

  draw(cameraMatrix: Float32Array): void {
    const now = this.timeFn();
    this.beams = this.beams.filter((b) => now - b.start < BEAM_MS);
    if (this.beams.length === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.uniform1f(this.uLength, BEAM_LENGTH_TILES);
    gl.uniform1f(this.uWidth, BEAM_WIDTH_TILES);
    gl.bindVertexArray(this.vao);
    for (const b of this.beams) {
      gl.uniform2f(this.uBase, b.x, b.y);
      gl.uniform1f(this.uAge, (now - b.start) / BEAM_MS);
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

- [ ] **Step 5: 미사일 그림, 명중·착탄 폭발, 막대 연결**

`src/client/render/types/UnitType.ts`: 확장 전쟁 상수들 뒤에 `// Strategic weapons` / `export const UT_CONVENTIONAL_MISSILE = "Conventional Missile" as const;`를 두고, `ALL_UNIT_TYPES` 끝과 `SMOOTHED_NUKE_TYPES`에 `UT_CONVENTIONAL_MISSILE`를 더한다(꼬리 자국 `TRAIL_TYPES`와 목표 원 `NUKE_MAGNITUDES`에는 넣지 않는다). `src/client/render/types/index.ts`에서 `UT_CONVENTIONAL_MISSILE`를 다시 내보낸다.

`src/client/render/gl/passes/UnitPass.ts`: import에 `UT_CONVENTIONAL_MISSILE`를 더하고, `UNIT_ORDER`의 `UT_CARGO_PLANE,` 뒤에 `// Strategic weapons (unit-atlas.png column 15)` / `UT_CONVENTIONAL_MISSILE,`를, `MISSILE_TYPES`에 `UT_CONVENTIONAL_MISSILE,`를 더한다.

`resources/atlases/src/unit-sprites.py`: 문서 문자열의 "Columns 12-14 (13x13 px each): Transport Plane, Bomber, Cargo Plane"을 "Columns 12-15 (13x13 px each): Transport Plane, Bomber, Cargo Plane, and the strategic weapons' Conventional Missile"로 바꾸고, `CARGO_PLANE` 뒤에 그림을 더해 `SPRITES`에 붙인 뒤 실행한다:

```python
CONVENTIONAL_MISSILE = [
    "......e......",
    ".....ded.....",
    ".....ddd.....",
    ".....dcd.....",
    ".....dcd.....",
    ".....dcd.....",
    ".....dcd.....",
    ".....dcd.....",
    "....ddcdd....",
    "...dd.c.dd...",
    "...d..c..d...",
    "......b......",
    ".............",
]

SPRITES = [TRANSPORT_PLANE, BOMBER, CARGO_PLANE, CONVENTIONAL_MISSILE]
```

```bash
python3 -I resources/atlases/src/unit-sprites.py resources/atlases/unit-atlas.png
```

`CREDITS.md`의 `unit-atlas.png` 줄에서 "three plane sprites drawn for this fork"를 "three plane sprites and a conventional missile sprite drawn for this fork"로 바꾼다.

`src/client/render/gl/passes/fx-pass/FxSpritePass.ts`: `../../../types` import에 `UT_CONVENTIONAL_MISSILE`를 더하고 `spawnFxForUnit`의 `UT_SHELL` 분기 앞에 추가:

```ts
    // Strategic weapons: a building hit, or a SAM's catch in flight.
    if (typeName === UT_CONVENTIONAL_MISSILE) {
      this.pushFx(
        x,
        y,
        unit.reachedTarget ? FX_UNIT_EXPLOSION : FX_SAM_EXPLOSION,
        now,
      );
      return;
    }
```

`src/client/render/gl/passes/fx-pass/index.ts`: `import { FX_NUKE, FxSpritePass } from "./FxSpritePass";`로 바꾸고 `applyConquestEvents` 뒤에 추가:

```ts
  /** Strategic weapons: an atom-bomb-like blast at each orbital strike impact (half an atom bomb's ring). */
  spawnOrbitalImpacts(points: readonly { x: number; y: number }[]): void {
    const now = this.timeFn();
    for (const p of points) {
      this.spritePass.pushFx(p.x, p.y, FX_NUKE, now);
      this.shockwavePass.pushNukeShockwave(
        p.x,
        p.y,
        this.settings.fx.nukeRadiusAtom / 2,
      );
    }
  }
```

`src/client/render/gl/passes/BarPass.ts`: `projectProgress` 필드 뒤에 `private strategicProgress: ReadonlyMap<number, number> = new Map();`를, `setVictoryProjects` 뒤에 setter를, `computeStructureProgress`의 승리 프로젝트 검사 뒤에 검사를 더한다(준비 중인 발사대는 재장전 막대 대신 이 막대를 보인다):

```ts
  /** Strategic weapons: factories making nukes and silos preparing a satellite. */
  setStrategicProgress(progress: ReadonlyMap<number, number>): void {
    this.strategicProgress = progress;
  }
```

```ts
    // Strategic weapons: nuke production, satellite preparation
    const strategic = this.strategicProgress.get(unit.id);
    if (strategic !== undefined) return strategic;
```

`src/client/render/gl/Renderer.ts`: `OrbitalBeamPass`를 import해 필드로 두고, `this.victoryProjectPass = new VictoryProjectPass(gl);` 뒤에 `this.orbitalBeamPass = new OrbitalBeamPass(gl);`, `dispose`에 `this.orbitalBeamPass.dispose();`, 그리기의 `if (pe.fx) { … }` 블록 안 `this.fxPass.draw(cam, zoom);` 뒤에 `this.orbitalBeamPass.draw(cam);`를 넣고, `setVictoryProjects` 뒤에 추가:

```ts
  /** Strategic weapons: production and preparation bars. */
  setStrategicProgress(progress: ReadonlyMap<number, number>): void {
    this.barPass.setStrategicProgress(progress);
  }

  /** Strategic weapons: beams and blasts at this tick's orbital strike impacts. */
  applyOrbitalStrikes(points: readonly { x: number; y: number }[]): void {
    if (points.length === 0) return;
    this.orbitalBeamPass.spawn(points);
    this.fxPass.spawnOrbitalImpacts(points);
  }
```

`src/client/render/gl/MapRenderer.ts`의 `setVictoryProjects` 뒤에 같은 이름으로 `this.renderer?.setStrategicProgress(progress)`와 `this.renderer?.applyOrbitalStrikes(points)`를 부르는 두 메서드를 더한다.

`src/client/WebGLFrameBuilder.ts`: `GameUpdateType`(`@openfront/engine-api/game/GameUpdates`), `deriveStrategicProgress`, `orbitalImpactPoints`를 import하고, `update()`의 `this.syncVictoryProjects(gameView);` 뒤에 `this.syncStrategic(gameView);`를 넣고 메서드를 더한다:

```ts
  /** Strategic weapons: production/preparation bars; beams and blasts for orbital strikes. */
  private syncStrategic(gameView: GameView): void {
    if (!gameView.config().strategicWeapons()) return;
    this.view.setStrategicProgress(
      deriveStrategicProgress(gameView.playerViews(), gameView.ticks()),
    );
    const strikes =
      gameView.updatesSinceLastTick()?.[GameUpdateType.OrbitalStrike] ?? [];
    if (strikes.length > 0) {
      this.view.applyOrbitalStrikes(
        orbitalImpactPoints(strikes, gameView.width()),
      );
    }
  }
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest tests/client/render tests/FxSettings.test.ts tests/WebGLFrameBuilder.explosionParams.test.ts --run && npm run typecheck`
Expected: 모두 PASS(새 3 tests와 아틀라스 열 검사 포함), typecheck 오류 없음

- [ ] **Step 7: 커밋**

```bash
npx prettier --write src/client/render src/client/WebGLFrameBuilder.ts tests/client/render CREDITS.md
git add src/client/render src/client/WebGLFrameBuilder.ts resources/atlases CREDITS.md tests/client/render
git commit -m "feat(strategic): production bars, missile sprite, orbital strike beams"
```

---
### Task 13: 조준 미리보기 — 맞힐 건물·고른 발사대, 비축 핵

**Files:**
- Create: `src/client/controllers/StrategicPreview.ts`
- Modify: `src/client/controllers/BuildPreviewController.ts` (`buildGhostPreviewData`, `updateNukeTrajectoryPreview`)
- Modify (test): `tests/client/controllers/BuildPreviewController.test.ts` (터치 하네스)
- Test: `tests/client/StrategicPreview.test.ts`

**Interfaces:**
- Consumes: Task 1 `pickNearestWithin`, `MISSILE_TARGET_RADIUS`, `SATELLITE_SILO_PICK_RADIUS`, `isStockpiledNuke`, `PlayerView.strategicData()`
- Produces: `TARGET_RING_RADIUS`(4), `missileTargetPreview(game, me, tile): UnitView | null`, `satelliteSiloPreview(game, me, tile): UnitView | null` — 엔진의 `PlayerImpl.missileTarget`·`satelliteSpawn`과 같은 규칙. 두 번 탭 흐름(`onBuildTap`, `confirmAim`, `GHOST_SEEN_MS`)은 바꾸지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/client/StrategicPreview.test.ts`:

```ts
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  missileTargetPreview,
  satelliteSiloPreview,
} from "../../src/client/controllers/StrategicPreview";
import type { PlayerView } from "../../src/client/view";

const W = 100;
const at = (x: number, y: number) => y * W + x;

function unit(id: number, tile: number, owner: unknown, ready = true) {
  return {
    id: () => id,
    tile: () => tile,
    owner: () => owner,
    isActive: () => true,
    isUnderConstruction: () => false,
    isInCooldown: () => !ready,
  };
}

describe("strategic aim previews (the engine's rules)", () => {
  const ally = { id: () => "ally" };
  const enemy = { id: () => "enemy" };
  const silos = [unit(1, at(10, 10), null), unit(2, at(12, 10), null, false)];
  const me = {
    id: () => "me",
    isFriendly: (o: { id(): string }) => o.id() === "ally",
    units: (t: UnitType) => (t === UnitType.MissileSilo ? silos : []),
  } as unknown as PlayerView;
  const structures = {
    [UnitType.City]: [unit(7, at(50, 50), enemy), unit(3, at(50, 54), enemy)],
    [UnitType.Port]: [unit(8, at(48, 50), ally)],
    [UnitType.Factory]: [unit(9, at(20, 20), me)],
  } as Record<string, unknown[]>;
  const game = {
    units: (t: UnitType) => structures[t] ?? [],
    x: (t: number) => t % W,
    y: (t: number) => Math.floor(t / W),
  };

  test("the missile hits the nearest enemy building within 10 tiles, never a friend's or mine", () => {
    expect(missileTargetPreview(game as never, me, at(49, 51))?.id()).toBe(7);
    // Tied at 2 tiles: the lower id.
    expect(missileTargetPreview(game as never, me, at(50, 52))?.id()).toBe(3);
    expect(missileTargetPreview(game as never, me, at(47, 50))?.id()).toBe(7);
    expect(missileTargetPreview(game as never, me, at(20, 20))).toBeNull();
    expect(missileTargetPreview(game as never, me, at(70, 70))).toBeNull();
  });

  test("the satellite takes my nearest ready silo within 15 tiles", () => {
    expect(satelliteSiloPreview(game as never, me, at(13, 11))?.id()).toBe(1);
    expect(satelliteSiloPreview(game as never, me, at(40, 40))).toBeNull();
  });
});
```

`tests/client/controllers/BuildPreviewController.test.ts`의 터치 하네스:
- import에 `import { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";`와 `import { TARGET_RING_RADIUS } from "../../../src/client/controllers/StrategicPreview";`를 더한다.
- `function makeTouchController(type: UnitType)`를 `function makeTouchController(type: UnitType, strategic: StrategicData | null = null)`로 바꾸고, 모의 `silo`에 `id: () => 5,`를, `enemySam`에 `id: () => 77,`를, `myPlayer`에 `isFriendly: () => false,`와 `strategicData: () => strategic,`를 더한다.
- `describe("BuildPreviewController touch build mode …")` 안 끝에 추가:

```ts
  const lastGhost = (t: ReturnType<typeof makeTouchController>) =>
    t.view.updateGhostPreview.mock.calls.at(-1)![0];

  it("a conventional missile rings the enemy building it would hit", async () => {
    const t = makeTouchController(UnitType.ConventionalMissile);
    t.tap(80, 80); // tile (8, 8), next to the enemy SAM at (9, 9)
    await t.reply(() => ({ canBuild: 0, canUpgrade: false }));
    expect(lastGhost(t)).toMatchObject({
      rangeRadius: TARGET_RING_RADIUS,
      radiusTileX: 9,
      radiusTileY: 9,
    });
  });

  it("the satellite rings the silo it would use", async () => {
    const t = makeTouchController(UnitType.Satellite);
    t.tap(10, 10); // tile (1, 1), next to my silo at tile 0
    await t.reply(() => ({ canBuild: 0, canUpgrade: false }));
    expect(lastGhost(t)).toMatchObject({
      rangeRadius: TARGET_RING_RADIUS,
      radiusTileX: 0,
      radiusTileY: 0,
    });
  });

  it("strategic weapons: a bomb costs no gold and needs one in stock", async () => {
    const empty: StrategicData = {
      stock: {
        [UnitType.AtomBomb]: 0,
        [UnitType.HydrogenBomb]: 0,
        [UnitType.MIRV]: 0,
      },
      jobs: [],
      satellite: { phase: "none" },
    };
    const t = makeTouchController(UnitType.AtomBomb, empty);
    t.tap(70, 80);
    await t.reply((tile) => ({ canBuild: tile ?? false, canUpgrade: false }));
    expect(lastGhost(t)).toMatchObject({
      cost: 0,
      showCost: false,
      canAfford: false,
    });
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest tests/client/StrategicPreview.test.ts tests/client/controllers/BuildPreviewController.test.ts --run`
Expected: FAIL — `Cannot find module '../../src/client/controllers/StrategicPreview'`

- [ ] **Step 3: 미리보기 규칙**

`src/client/controllers/StrategicPreview.ts`:

```ts
import { TileRef } from "@openfront/engine-api/game/GameMap";
import { Structures, UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  MISSILE_TARGET_RADIUS,
  pickNearestWithin,
  SATELLITE_SILO_PICK_RADIUS,
} from "@openfront/engine-lib/strategic/Strategic";
import type { GameView, PlayerView, UnitView } from "../view";

/** Ring drawn around the building a missile would hit or the silo a satellite would use. */
export const TARGET_RING_RADIUS = 4;

type PreviewGame = Pick<GameView, "units" | "x" | "y">;

/** The building a conventional missile aimed at `tile` hits (PlayerImpl.missileTarget's rule), or null. */
export function missileTargetPreview(
  game: PreviewGame,
  me: PlayerView,
  tile: TileRef,
): UnitView | null {
  const candidates: { id: number; x: number; y: number; unit: UnitView }[] =
    [];
  for (const type of Structures.types) {
    for (const unit of game.units(type)) {
      const owner = unit.owner();
      if (owner === me || me.isFriendly(owner)) continue;
      candidates.push({
        id: unit.id(),
        x: game.x(unit.tile()),
        y: game.y(unit.tile()),
        unit,
      });
    }
  }
  return (
    pickNearestWithin(
      game.x(tile),
      game.y(tile),
      MISSILE_TARGET_RADIUS,
      candidates,
    )?.unit ?? null
  );
}

/** My ready silo the satellite button aimed at `tile` uses (PlayerImpl.satelliteSpawn's rule), or null. */
export function satelliteSiloPreview(
  game: PreviewGame,
  me: PlayerView,
  tile: TileRef,
): UnitView | null {
  const silos = me
    .units(UnitType.MissileSilo)
    .filter(
      (s) => s.isActive() && !s.isUnderConstruction() && !s.isInCooldown(),
    )
    .map((s) => ({
      id: s.id(),
      x: game.x(s.tile()),
      y: game.y(s.tile()),
      unit: s,
    }));
  return (
    pickNearestWithin(
      game.x(tile),
      game.y(tile),
      SATELLITE_SILO_PICK_RADIUS,
      silos,
    )?.unit ?? null
  );
}
```

- [ ] **Step 4: 미리보기 연결**

`src/client/controllers/BuildPreviewController.ts`:
- import에 `isStockpiledNuke`(`@openfront/engine-lib/strategic/Strategic`)와 `missileTargetPreview`, `satelliteSiloPreview`, `TARGET_RING_RADIUS`(`./StrategicPreview`)를 더한다.
- `buildGhostPreviewData`: `let rangeRadius = 0;` 뒤에 `let ringTile: TileRef | null = null;`를 두고, switch의 `case UnitType.Bomber:` 묶음 뒤에 추가:

```ts
      case UnitType.ConventionalMissile:
      case UnitType.Satellite: {
        // Strategic weapons: ring the building the missile would hit, or
        // the silo the satellite would use.
        const ringed =
          u.type === UnitType.ConventionalMissile
            ? missileTargetPreview(this.game, myPlayer, tileRef)
            : satelliteSiloPreview(this.game, myPlayer, tileRef);
        if (ringed !== null) {
          rangeRadius = TARGET_RING_RADIUS;
          ringTile = ringed.tile();
        }
        break;
      }
```

- 업그레이드 대상으로 `radiusTileX/Y`를 옮기는 `if` 뒤에 추가:

```ts
    if (ringTile !== null) {
      radiusTileX = this.game.x(ringTile);
      radiusTileY = this.game.y(ringTile);
    }
```

- `const cost = bulkCost(u, multiplier);`와 `let canAfford = myPlayer.gold() >= cost;`를 다음으로 바꾸고, 반환 객체의 `showCost: this.userSettings.cursorCostLabel(),`를 `showCost: stock === null && this.userSettings.cursorCostLabel(),`로 바꾼다:

```ts
    // Strategic weapons: a bomb comes from the stockpile; no gold is spent.
    const stock = isStockpiledNuke(u.type)
      ? (myPlayer.strategicData()?.stock[u.type] ?? null)
      : null;
    const cost = stock !== null ? 0n : bulkCost(u, multiplier);
    let canAfford =
      stock !== null ? stock >= multiplier : myPlayer.gold() >= cost;
```

- `updateNukeTrajectoryPreview`: `if (type !== UnitType.AtomBomb && type !== UnitType.HydrogenBomb) {`를 `if (type !== UnitType.AtomBomb && type !== UnitType.HydrogenBomb && type !== UnitType.ConventionalMissile) {`로, `const directionUp = this.uiState.rocketDirectionUp;`를 `const directionUp = type === UnitType.ConventionalMissile ? true : this.uiState.rocketDirectionUp;`로(미사일은 늘 위로 휘어 난다), `betrayedIds`의 조건 `allyIds.size > 0`을 `allyIds.size > 0 && type !== UnitType.ConventionalMissile`로(미사일은 동맹을 깨지 않는다) 바꾼다.

- [ ] **Step 5: 통과 확인**

Run: `npx vitest tests/client/StrategicPreview.test.ts tests/client/controllers tests/client/WarfarePreview.test.ts tests/client/InputHandlerTouch.test.ts --run && npm run typecheck`
Expected: 모두 PASS(새 5 tests와 기존 두 번 탭 테스트), typecheck 오류 없음

- [ ] **Step 6: 커밋**

```bash
npx prettier --write src/client/controllers tests/client/StrategicPreview.test.ts tests/client/controllers/BuildPreviewController.test.ts
git add src/client/controllers tests/client/StrategicPreview.test.ts tests/client/controllers/BuildPreviewController.test.ts
git commit -m "feat(strategic): aim previews ring the missile's target and the satellite's silo"
```

---
### Task 14: 전체 검증과 실제 화면 확인

**Files:** 없음(문제가 나오면 해당 Task의 파일을 고친다). 확인용 파일 `/tmp/strategic-check/vite.strategic.config.ts`와 저장소 루트의 `strategic-check.mjs`는 커밋하지 않는다(`strategic-check.mjs`는 Playwright를 찾으려면 저장소 안에 있어야 한다).

- [ ] **Step 1: 전체 테스트, 타입, 린트, 결정성 검사**

```bash
npm test 2>&1 | tail -15
npm run typecheck
npm run lint
grep -rnE "Math\.(random|pow|exp|log|sin|cos|tan|atan2)|Date\.now|new Date" packages/engine/src/strategic packages/engine-lib/src/strategic packages/engine/src/execution/nation/NationStrategicBehavior.ts
git diff 758c9f5ff --stat
```

Expected: 모든 테스트 PASS(`tests/VanillaDigest.test.ts` 7 tests, `tests/NationGoldPerMinute.test.ts` 스냅샷, `tests/core/snapshot/FullGameSnapshot.test.ts` 8개 변형 포함), typecheck·lint 오류 없음, `grep` 출력 없음.

- [ ] **Step 2: 별도 포트(9300)의 Vite 클라이언트로 실제 화면 확인(자동)**

실제 서버가 3000~3002와 9000을 쓰고 있다. 이 확인은 **그 포트를 열지도, 그 서버에 요청하지도 않는다.** 혼자 하기 게임은 브라우저 안에서 돌므로 Vite 클라이언트만 있으면 된다.

```bash
ss -ltn | grep -E ':(9300|9301) ' && echo "port busy: stop and ask" || echo free
mkdir -p /tmp/strategic-check
cat > /tmp/strategic-check/vite.strategic.config.ts <<'EOF'
// The worktree's dev config on port 9300, with every route to ports
// 3000-3002 (the owner's running server) pointed at a closed port and the
// create-game middleware (which POSTs straight to 3001+) dropped.
import type { UserConfig } from "vite";
import base from "/home/eser/dev/OpenFrontIO-strat/vite.config.ts";

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
(cd /home/eser/dev/OpenFrontIO-strat && SKIP_BROWSER_OPEN=true npx vite --config /tmp/strategic-check/vite.strategic.config.ts > /tmp/strategic-check/vite.log 2>&1 &)
timeout 120 bash -c 'until curl -sf http://localhost:9300 >/dev/null; do sleep 1; done' && echo up
```

`run-openfront` 스킬의 Playwright 준비(`bash .claude/skills/run-openfront/setup.sh`, 이미 했으면 생략)를 마친 뒤 저장소 루트에 `strategic-check.mjs`를 만든다:

```js
// Strategic weapons smoke check against the Vite client on :9300 only.
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
const OUT = "/tmp/strategic-check/shots";
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
await context.route(
  /^https?:\/\/(localhost|127\.0\.0\.1):(300[0-2]|9000)\b/,
  (r) => r.abort(),
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
  modal.strategicWeapons = true;
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
  const keys = [
    "atom_bomb",
    "hydrogen_bomb",
    "mirv",
    "conventional_missile",
    "satellite",
  ];
  return {
    present: keys.filter(
      (k) => document.querySelector(`[data-hotbar="${k}"]`) !== null,
    ),
    badges: document.querySelectorAll("[data-hotbar] [data-stock]").length,
    small: [...document.querySelectorAll("[data-hotbar]")]
      .map((b) => b.getBoundingClientRect())
      .filter((r) => r.width < 44 || r.height < 44).length,
    horizontalScroll:
      document.documentElement.scrollWidth > window.innerWidth,
  };
});
await page.screenshot({ path: `${OUT}/2-hud.png` });

// A factory on the spawn tile with the mouse: card, build mode, click.
await page.locator('[data-hotbar="factory"]').click();
await page.waitForTimeout(500 + RAF);
await page.locator('[data-hotbar="factory"]').click();
await page.waitForTimeout(500 + RAF);
await clickWorld(page, home.x, home.y);
await page.waitForTimeout(3000 + RAF);

// The atom bomb card's "Build" button, then 20 s of production.
await page.locator('[data-hotbar="atom_bomb"]').click();
await page.waitForTimeout(500 + RAF);
await page.screenshot({ path: `${OUT}/3-atom-card.png` });
const produce = page.locator("[data-produce]");
const produceShown = (await produce.count()) === 1;
if (produceShown) await produce.click();
await page.waitForTimeout(26_000);
const atomStock = await page.evaluate(
  () =>
    document
      .querySelector('[data-hotbar="atom_bomb"] [data-stock]')
      ?.textContent?.trim() ?? "",
);
await page.screenshot({ path: `${OUT}/4-stock.png` });

const report = {
  toggleShown: modalText.includes("전략 무기"),
  bar,
  produceShown,
  atomStock,
  errors,
};
console.log(JSON.stringify(report, null, 2));
await browser.close();
const ok =
  report.toggleShown &&
  bar.present.length === 5 &&
  bar.badges === 3 &&
  bar.small === 0 &&
  !bar.horizontalScroll &&
  produceShown &&
  atomStock === "1" &&
  errors.length === 0;
process.exit(ok ? 0 : 1);
```

Run: `node strategic-check.mjs`
Expected: JSON에 `toggleShown: true`, `bar.present` 5개, `bar.badges: 3`, `bar.small: 0`, `horizontalScroll: false`, `produceShown: true`, `atomStock: "1"`, `errors: []`, 종료 코드 0. 스크린샷 `/tmp/strategic-check/shots/*.png` 4장을 열어 확인한다: 혼자 하기 설정에 "전략 무기" 토글이 있다, 단축바의 원자·수소·다탄두 버튼 오른쪽 위에 보유량 배지가 있고 다탄두 뒤에 일반 미사일·위성 버튼이 있다, 원자폭탄 카드에 "보유 0발"·가격·"제조 (20초)" 버튼이 있다, 제조가 끝난 뒤 배지가 1이다. 공장 아이콘 아래 진행 막대는 Step 3의 2번 항목에서 주인이 눈으로 확인한다.

정리:

```bash
pkill -f "vite --config /tmp/strategic-check/vite.strategic.config.ts"
rm strategic-check.mjs
ss -ltn | grep -E ':(9300|9301) ' || echo "9300 closed"
git status --short
```

Expected: `git status`가 깨끗하다(`strategic-check.mjs`가 지워졌다). 이 호스트에서 Playwright가 동작하지 않으면 이 Step은 건너뛰고 그 사실을 기록한 뒤, 아래 Step 3을 주인에게 넘긴다.

- [ ] **Step 3: 주인이 실제 태블릿으로 확인할 목록**

자동 확인은 터치, 상대 국가의 위성, 여러 사람을 흉내 내지 않는다. 주인이 자기 서버(평소처럼 실행)에서 방을 만들어 확인한다:
1. 방 만들기와 혼자 하기 설정에 "전략 무기" 토글이 있고 참가 화면 요약에 "전략 무기: 켜짐"이 보인다. 끈 판에서는 일반 미사일·위성 버튼, 보유량 배지, 순위표 "핵" 칸이 없고 핵은 지금처럼 바로 쏜다.
2. 핵 카드의 "제조"를 누르면 모두에게 "(나라이름) 핵무기 개발 중"이 뜨고, 공장 아이콘 아래 막대가 차오른 뒤 배지 숫자가 1 오른다. 순위표 "핵" 칸에 모든 나라의 보유량 합계가 보인다.
3. 일반 미사일: 핵 옆 칸 → 적 건물 근처를 조준하면 맞힐 건물에 흰 원과 발사대에서의 포물선·SAM 위협이 보이고, 확인 뒤 아이콘을 다시 탭하면 날아가 그 건물의 레벨이 1 내려간다. 제조 중인 공장을 맞히면 "핵 개발이 저지되었습니다"가 뜬다.
4. 위성: 위성 칸 → 자기 발사대 근처를 조준하면 그 발사대에 원이 보이고, 확정하면 발사대 아래에 90초 막대가 찬다. 궤도에 오르면 화면 위에 "위성이 궤도에 올랐습니다 [목표 나라 고르기]" 줄이 나오고, 고르기 창에서 나라를 두 번 탭하면 모든 화면 위쪽에 "(쏜 나라) → (목표) 위성 포격"과 60초 막대가 보인다.
5. 요격: 다른 나라로 수소·원자폭탄을 비축해 두고 띠의 "수소폭탄 N발 · 20%", "원자폭탄 N발 · 4%" 버튼을 두 번 탭하면 요격탄 수가 늘고 3초 뒤 명중·빗나감이 모두에게 뜬다. 마지막 1초에 쏜 요격탄도 판정이 난 뒤에 포격이 떨어진다.
6. 포격: 목표의 건물이 모두 사라지고 그 자리와 영토 곳곳이 바다가 되며(물 핵을 끈 판에서도), 가는 빛줄기와 핵 폭발 정도의 연출만 있고 화면을 덮거나 흔들리지 않는다.
7. 내정 모드와 함께 켠 판: 위성은 우주 개발 전에는 자물쇠와 기술 이름이 보이고, 핵 억지력 법이 제조·미사일·위성 가격을 낮춘다. 확장 전쟁과 함께 켠 판: 폭격·해안 포격은 지금처럼 금으로 바로 쏘고, 해안 포대·공항도 위성 포격에 사라진다.
8. 단축바가 18칸(세 옵션 모두)일 때 두 줄로 접히고, 띠와 고르기 창의 모든 버튼이 손가락으로 누르기 쉽다.

- [ ] **Step 4: 마무리 커밋(수정이 있었다면)**

```bash
git status --short
git add -A
git commit -m "fix(strategic): issues found in strategic weapons verification"
```

수정이 없었다면 이 단계는 건너뛴다.
