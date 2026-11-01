# 1936 세계대전 연구 개편 설계안 — HOI4식 연구 칸, 기술 확장, 연구 트리 화면

- 작성일: 2026-10-31
- 기준 코드: `/home/eser/dev/OpenFrontIO`의 `atlas-home` 브랜치, `6f858b384`. 읽기만 했고, 고치거나 빌드하거나 실행한 것은 없다.
- 결정 기록: `/home/eser/dev/OpenFrontIO/.superpowers/hoi/decisions.md`, `speed-rules.md`.
- 별도 레인의 "취소해도 진행 보존"(`OpenFrontIO-ww6-resprog`, `ce.savedResearch`)은 이미 들어간 것으로 보고 다시 설계하지 않는다. 화면과 대기열이 그 값을 읽기만 한다.
- 경로 줄임말: `engine-api` = `packages/engine-api/src/ww1936/`, `engine-lib` = `packages/engine-lib/src/ww1936/`, `engine` = `packages/engine/src/ww1936/`, `hud` = `src/client/hud/ww1936/`.
- HOI4 쪽 설명은 작성자가 아는 HOI4를 바탕으로 한다. 판본마다 다른 수치는 적지 않았고, 확실하지 않은 줄에는 "(확인 필요)"를 붙였다.
- 사람을 가리킬 때는 "플레이어", "소유자" 같은 중립어를 쓴다.

---

## 1. 요약

| 항목 | 지금 | 제안 |
|---|---|---|
| 연구 칸 | 메이저 3, 그 밖 2. 공장 50·100개에서 +1씩. 중점 효과로 최대 +2, 합계 상한 6 | 공장 자동 규칙을 없앤다. 시작 칸 표(메이저 3, 미국·소련 4, 그 밖 2)를 두고, 중점 2개와 결정 1개로 늘린다. 상한 6은 그대로 둔다 |
| 기술 수 | 정의 146개, 그중 쓰이는 것 126개(7개 갈래) | 쓰이는 기술 234개(새로 108개), 탭 10개(보병, 지원, 기갑, 포병, 해군, 공군, 공학, 산업, 교리, 특수 프로젝트) |
| 장비 세대 | 장비마다 1~3세대, 세대별 재고 | 세대는 그대로 둔다. 새 기술은 세대 사이의 "개량"(능력치), 설계 모듈, 차대·기체, 산업·공학 기술이다 |
| 기술 비용 | 120 + 15 × (연도 − 1936)일, 모두 같은 배수 | 같은 식에 기술별 비용 배수(‰)와 전체 손잡이 하나를 더한다 |
| 1945년까지 완료율(메이저) | 트리의 약 80~95%(추정) | 약 45~60%. HOI4처럼 고르게 만든다 |
| 화면 | 갈래 탭과 카드 목록 | 연도 축(1936~1945) 트리 캔버스, 왼쪽 탭 막대, 옆 시트, 두 번 탭해서 시작 |
| AI | 갈래 묶음 목록 + 도메인 몫 | 점수식 고르기(역할 가중치 + 필요 + 보너스 + 시드 흔들기). 사람의 자동 연구도 같은 함수를 쓴다 |

권하는 순서는 다음과 같다. 기준 측정 → 연구 칸 → 데이터 모델과 AI 골격 → 화면과 기술 콘텐츠를 나란히 → 대기열과 따라잡기 보너스. 1인 작업일로 32~46일이고, 레인으로 나누면 달력으로 약 4~4.5주다(§5).

---

## 2. 현재 상태 (코드로 확인)

### 2.1 연구 칸
- **공식.** `engine-lib/EconomyRules.ts` `researchSlotCount(major, factories)`는 `min(WW_MAX_SLOTS, (major ? 3 : 2) + (factories ≥ 50) + (factories ≥ 100))`이다.
- **합계.** `engine/economy/WwEconomy.ts` `refreshTotals`에서 `t.slotCount = min(WW_MAX_SLOTS, researchSlotCount(ce.major, civ + mil) + extraResearchSlots)`로 날마다 다시 계산한다.
  - 여기서 `civ`, `mil`은 통제하는 주의 **실효 공장**이다. 통제 비율(`regionShares` 또는 점령 몫)을 곱하고 폭격으로 부서진 건물을 뺀다(`effectiveBuildings`).
  - 그래서 폭격이나 점령으로 공장이 50개 아래로 내려가면 칸이 줄어든다.
- **상한.** `engine-api/EconomyTypes.ts` `WW_MAX_SLOTS = 6`이다. 주석은 "공장으로 최대 5, 여섯째는 효과로만"이라고 적었다.
- **효과로 더하는 칸(요청서에 없던 상한).** `engine/politics/EffectsEcon.ts` `WW_MAX_EXTRA_RESEARCH_SLOTS = 2`(통제자 결정 R5)다. `research_slot` 효과는 `extraResearchSlots`를 0~2 사이로 더하고 뺀다. DSL은 한 번에 −1~+1만 허용한다(`engine-api/PoliticsDsl.ts`).
- **칸이 줄 때.** `engine/economy/ResearchRun.ts` `stepResearch`는 칸 수보다 뒤에 있는 칸을 진행을 지닌 채 멈춘다. 화면에는 회색 "멈춤"으로 보인다(`hud/EconomyModel.ts` `researchSlots`의 `paused`).
- **칸을 주는 중점은 9개다**(`engine-lib/content/focus/`).

  | 트리 | 중점 | 위치 | 선행·조건 |
  |---|---|---|---|
  | 독일 | `deu_kwi` | x14 y0 | 없음 |
  | 영국 | `gbr_scientific_committee` | x13 y0 | 없음 (고문 후보도 줌) |
  | 소련 | `sun_academy` | x15 y0 | 없음 |
  | 프랑스 | `fra_research_centre` | x14 y0 | 없음 |
  | 이탈리아 | `ita_research_council` | x12 y0 | 없음 (고문 후보도 줌) |
  | 일본 | `jpn_science_mobilisation` | x13 y2 | 없음 |
  | 미국 | `usa_defense_research` | x11 y0 | 1940-06-01 이후 또는 전쟁 중 |
  | 일반 | `gen_rs_1` | x6 y1 | `gen_ind_survey` |
  | 일반 | `gen_rs_2` | x5 y3 | `gen_rs_1`과 `gen_ind_civ_2` (+ 국민정신 연구소 +3%) |

  - 메이저 7개국은 자기 나라 트리만 쓴다(`content/countries.ts`의 `tree`). 그래서 중점 칸은 **메이저 +1, 마이너 +2**다.
  - 지역 팩 11개는 일반 트리를 물려받고, 어느 팩도 `gen_rs_*`를 빼지 않는다(`content/packs.ts`).
  - **결정이나 국민정신으로 칸을 주는 곳은 없다.**
- **1936년 첫날 칸 수**(`resources/maps/world1936/scenario.json`의 주별 `civ + mil` 합).
  - 미국 85개, 소련 62개라서 4칸이다.
  - 독일 48, 영국 40, 프랑스 30, 일본 24, 이탈리아 21이라서 3칸이다.
  - 마이너는 가장 큰 체코슬로바키아가 12개라서 모두 2칸이다.
- **그 뒤의 곡선은 옛 측정만 있다.** P1 밸런스 보고(`.superpowers/sdd/2026-10-20-ww1936-p1/task-9-report.md`)의 1939-09 공장 수는 다음과 같다. P1 시점 값이라 지금 코드에서는 다시 재야 한다.

  | 나라 | 공장 | 공장 규칙의 칸 |
  |---|---|---|
  | 독일 | 73 | 4 |
  | 영국 | 68 | 4 |
  | 프랑스 | 44 | 3 |
  | 이탈리아 | 37 | 3 |
  | 미국 | 163 | 5 |
  | 소련 | 89 | 4 |

  - 1941-06에는 소련 110개, 미국 247개다.
  - 재는 도구는 이미 있다: `scripts/ww1936/econ-sim.ts`가 나라별 `slotCount`를 CSV로 쓴다.

### 2.2 기술
- **정의 146개, 쓰이는 것 126개.** `engine-api/EconomyTypes.ts` `WW_TECH_IDS`에 146개가 있다. 그중 옛 교리 기술 20개는 `engine-lib/WwTechs.ts` `RETIRED_DOCTRINE_TECHS`라서 효과가 비고 연구할 수 없다(`researchBlockOf`가 `no_tech`).
- **갈래는 실제로 7개다.** `TECH_BRANCHES`에는 8개가 있지만 `doctrine` 갈래에는 은퇴한 기술만 있다. 화면의 교리 탭은 "교리는 옮겨졌다"는 문장만 보인다(`hud/WwResearchPanel.ts` `renderCards`).

  | 갈래 | 쓰이는 기술 |
  |---|---|
  | 보병 | 14 |
  | 포병 | 8 |
  | 기갑 | 18 |
  | 공군 | 26 |
  | 산업 | 16 |
  | 전자 | 11 |
  | 해군 | 33 |

  - 연도별로는 1936년 32개, 1937년 6, 1938년 17, 1939년 14, 1940년 26, 1941년 8, 1942년 9, 1943년 3, 1944년 11개다.
- **날수.**
  - 기본 날수는 `techDays(year) = 120 + 15 × (year − 1936)`이다. 쓰이는 126개를 모두 더하면 20,955일이다.
  - 하루 진행은 `researchProgress = 1000 × (100 + 속도%) ÷ (100 + 앞섬%)` 밀리일이다(`EconomyRules.ts`).
  - 앞섬 벌칙은 `aheadPct`로, 그 해 1월 1일까지 남은 날에 비례해 1년당 +100%다.
  - 늦은 기술 보너스는 없다.
- **선행 조건.**
  - 선행은 AND만 된다(`prereqs`가 모두 있어야 한다).
  - 배타는 도메인마다 교리 학파 하나뿐이었고, 지금은 그 기술이 모두 은퇴했다. 그래서 **지금은 배타 선택인 기술이 없다.**
- **효과의 두 가지 길.**
  - 하나는 `WwTechDef.effects`의 능력치 키다. `techTotals`가 더하고 `Stats.ts` `techStats`가 `WwStats`로 옮긴다.
  - 다른 하나는 기술 id를 직접 읽는 곳이다. `WwTechs.ts`와 콘텐츠 밖에서 id 121개를 문자열로 읽는다.

    | 파일 | 읽는 횟수 |
    |---|---|
    | `engine/economy/AiEconomy.ts` | 112 |
    | `engine-lib/EconomyStart.ts` | 85 |
    | `engine-lib/DesignRules.ts` | 54 |
    | `engine-lib/Equipment.ts` | 47 |
    | `engine-lib/Battalions.ts` | 28 |
    | `ShipStats.ts`, `InvasionRules.ts`, `ProjectRules.ts`, `IntelRules.ts` 등 | 나머지 |

- **연구 속도.** 엔진은 `researchSpeedPct(ce.stats, 갈래)`(전체 `researchPct` + 갈래 `rs*Pct`) + 무역법 + 칸 보너스 + 진영 공동 연구를 더한다(`ResearchRun.ts` `stepResearch`).
- **연구 보너스.**
  - `research_bonus` 효과는 기술 id나 갈래를 키로 갖고, 최대 5개다(`WW_MAX_RESEARCH_BONUSES`).
  - 연구를 시작할 때 맞는 첫 보너스를 칸에 붙이고 한 번 쓴다(`takeResearchBonus`).
  - 콘텐츠에 99줄 있다. 결정 `gen_tech_exchange`(진영 지도자가 앞선 갈래 +100% 한 번, 50 정치력, 365일 쿨타임)와 정보 작전 `op_steal_blueprints`(상대만 가진 가장 이른 기술 +100% 한 번, `engine/depth/Operations.ts`)도 이 효과를 쓴다.
- **진영 공동 연구.**
  - 같은 기술을 가진 다른 회원 1개국마다 +10%, 최대 +30%다(`engine-lib/MechRules.ts` `sharedResearchBonusPct`).
  - 진영 규칙 `fr_shared_research`가 켜져 있어야 한다. 지도자가 50 정치력을 내고, 바꾸면 180일 잠긴다(`engine/depth/FactionRules.ts`). AI 지도자는 켠다(`AiMech.ts`).
- **난이도.** 쉬움 AI는 연구 −15%, 어려움 AI는 +10%이고, 사람에게는 붙지 않는다(`engine-lib/AiDifficulty.ts` `WW_AI_HANDICAP`, `WwPolitics.ts`에서 AI에게만 더함).
- **연구 속도를 주는 콘텐츠.**
  - 고문: 과학 +5%(+전자 +10%), 기갑 +15%, 항공 +15%.
  - 국민정신: 독일 +10%, 영국 +10%, 소련 +10%, 프랑스 +5%, 일반 +3% 등.
  - 연속 중점 `cf_research` +5%, 세력 균형(일본 육·해군).

### 2.3 장비 세대·설계·특수 프로젝트·교리
- **장비 세대.** `engine-lib/Equipment.ts` `EQUIPMENT[type].techs`가 세대마다 여는 기술이다.
  - 세대 수는 `engine-api/EconomyTypes.ts` `EQUIPMENT_GENS`에 있다. 보병 장비 3, 지원 2, 포 3, 대전차 2, 대공 2, 차량 1, 경전차 2, 중형전차 3, 항공기 대부분 3, 폭격기 2다.
  - 재고는 `(종류, 세대)`마다 한 칸이고, 그 순서가 `EQUIP_KEYS`다(지금 79개).
  - **스냅숏은 재고 배열을 그대로 복사한다**(`WwEconomy.ts` restore의 `ce.stock = [...c.stock]`, 덧붙임 없음). 그래서 기존 종류 사이에 세대를 끼우면 옛 저장의 재고가 어긋난다.
- **설계국**(`engine-lib/DesignRules.ts`).
  - 전차: 차대 8종(`TANK_BASE_DEFS` light_1~heavy_3)과 모듈(`TANK_MODULE_DEFS`, 모듈마다 `tech`)이 있다.
  - 함선: 함급×세대 바탕과 모듈(어뢰, 소나, 사격 통제, 레이더, 장갑 갑판, 기뢰, 스노클, 초대형 함체)이 있다.
  - 항공기: 기체 10종(small·medium·large 1~3, `jet_1`은 `sp_jet_engine` 프로젝트가 연다)과 모듈이 있다.
  - 설계는 바탕과 모듈을 **문자열 id**로 저장한다(`engine-api/DepthTypes.ts` `DesignDef`). 그래서 모듈과 차대를 덧붙여도 옛 저장이 안전하다.
- **특수 프로젝트 6개**(`engine-lib/ProjectRules.ts` `PROJECT_DEFS`).

  | 프로젝트 | 기술 조건 | 기본 날수 |
  |---|---|---|
  | `sp_atomic` | `nuclear_physics` | 1,900 |
  | `sp_flying_bomb` | `rocketry_1` | 500 |
  | `sp_ballistic` | 비행 폭탄 다음 | 700 |
  | `sp_jet_engine` | `fighter_2` | 650 |
  | `sp_cavity_magnetron` | `radar_1` | 450 |
  | `sp_proximity_fuze` | `anti_air_2` + `electronics_1` | 500 |

  - 시설은 기술로 열린다(`BUILDING_TECH`: 원자력 연구소 `nuclear_physics`, 로켓 시험장 `rocketry_1`, 종합 실험소 `electronics_1`).
  - 과학자 보너스는 15 × (숙련 − 1) + 맞춤 25%다.
- **교리.** HOI4 숙련 방식이다(`engine-lib/DoctrineRules.ts`, `engine-api/DepthTypes.ts`).
  - 대교리 10개, 트랙 9개, 세부 교리 21개가 있다.
  - 숙련 단계는 100/300/600/1,000/1,500이고, 하루 0.3, 최대 1.2다.
  - 연구 칸을 쓰지 않는다. 화면은 따로 있다(`hud/WwDoctrinePanel.ts`, `WwDepthOpenEvent("doctrine")`로 연다).

### 2.4 AI와 자동 연구
- **우선순위 목록.** `engine/economy/AiEconomy.ts` `aiResearchOrder`가 만든다.
  - 땅 목록은 성향별·나라별 묶음 순서(`PERSONALITY_ORDER`, `COUNTRY_ORDER`, `TAIL`)를 따른다.
  - 바다·하늘 목록은 나라별 우선 목록(`SEA_FOCUS`, `AIR_FOCUS`) 다음에 id 순서다.
  - 셋을 `AI_RESEARCH_MIX`(예: 영국 50/30/20) 비율로 섞는다.
- **땅·바다·하늘 구분이 id 순서에 기댄다.** `aiTechDomain`은 `WW_TECH_IDS`에서 `rail_1`(`LAST_LAND_TECH`)보다 앞이면 모두 땅으로 본다. 뒤에 덧붙인 기술은 갈래로 가른다.
- **고르기**(`planResearch`).
  - 앞섬 50% 이하를 먼저 고르고, 없으면 75% 이하(`AI_MAX_AHEAD_PCT`, `AI_FALLBACK_AHEAD_PCT`), 그다음 몫 제한 없이 고른다.
  - 사람의 자동 연구(`fillSlots`, w6-res)만 끝까지 "가장 덜 앞선 것"으로 모든 칸을 채운다.
  - 주기는 10일마다 한 번 전체 계획이고, 그 사이에는 빈 칸이 생긴 날에 반응한다.
- **넘겨받기.** 사람이 `research`나 `cancel_research` 명령을 내면 자동 연구가 꺼진다(`engine/Automation.ts` `AUTO_ORDER_DOMAIN`).

### 2.5 화면
- **연구 서랍**(`hud/WwResearchPanel.ts`).
  - 전체 화면 패널이다(`hud/WwPanelMode.ts`, 도크 위, `--ww-dock-h`는 compact 40px).
  - 위에 칸 줄이 있다. 칸마다 고리, %, 남은 날수, 앞섬 배지가 있고, 두 번 탭(3초, `TWO_TAP_MS`)하면 취소한다.
  - 빈 칸 안내 줄, 탭 9개(`TECH_BRANCHES` + 프로젝트), 카드 목록이 있다.
  - 높이 500px 이하(`COMPACT_MAX_HEIGHT`)면 탭이 제목 자리로 올라간다.
- **중점 트리 캔버스**(`hud/FocusCanvas.ts`, `FocusLayout.ts`). 연구 트리에서 다시 쓸 수 있다.
  - 한 손가락으로 끌고, 두 손가락으로 0.6~1.25배 확대하며, 두 번 탭하면 1배로 돌아온다.
  - 칸 104×68, 카드 96×60이다. 선은 AND/OR/배타다.
  - 아래 40%에 상세가 나온다.
- **화면의 ETA가 엔진과 다르다.** `hud/EconomyModel.ts` `researchSpeedPct`는 기술의 `researchPct`와 무역법만 더한다. 국민정신·고문·연속 중점·갈래 속도·칸 보너스·진영 공동 연구가 빠져서, 카드의 "남은 날수"가 엔진과 다를 수 있다.

### 2.6 저장과 호환
- **스냅숏.** 레코드마다 버전이 붙는다(`engine-lib/snapshot/SnapshotType.ts`). 게임은 `GameSnapshot` 버전 1(`engine/game/GameImpl.ts`)이고, 세계대전 상태는 선택 필드로 늘려 왔다(`engine/WorldWar.ts`).
  - 기술 id는 문자열로 저장하고, `z.enum(WW_TECH_IDS)`로 검사한다(`WwEconomy.ts` `CountrySchema`). 그래서 **덧붙이기는 안전하고, 이름을 바꾸거나 지우면 옛 저장이 깨진다.**
  - `WwStats` 배열은 복원할 때 모자라는 키를 0으로 채운다(`WwPolitics.ts` `x.stats[i] ?? 0`).
- **명령.** zbin이 `z.enum`을 순서 번호로 쓰므로 덧붙이기만 된다(`packages/zbin/README.md`). 순서를 고정하는 테스트도 있다(`tests/ww1936/NavyTypes.test.ts`, `EndgameTypes.test.ts`, `DepthTypes.test.ts`의 `after(WW_TECH_IDS, …)`).
- **저장 위치.** 혼자 하기 저장은 IndexedDB `saved-games`에 최대 20개다(`src/client/LocalSavedGames.ts`).
- **리플레이는 빌드에 묶여 있다.** git 커밋이 정확히 같아야 열린다(`src/client/JoinLobbyModal.ts` `checkArchivedGame`, `src/client/replay/ReplayRecord.ts`). 그래서 리플레이는 마이그레이션 대상이 아니다.

### 2.7 지나가다 찾은 것
- **읽는 곳이 없는 능력치 키 두 개.**
  - `armorRelPp`는 세부 교리 `arm_inf_support` 3단계 보상(`engine-lib/DoctrineRules.ts` 192행)인데, 규칙 코드 어디서도 읽지 않는다.
  - `energyPct`도 규칙 코드에서 읽지 않는다.
  - 새 기술이 이 키를 쓰려면 읽는 곳을 먼저 만들어야 한다. 교리 보상 쪽은 그 자체로 고칠 거리다.
- **진행 보존과 칸 보너스.** resprog의 진행 보존은 진행만 남기고 칸에 붙은 `bonusPct`는 잃는다. 대기열(§4 아이디어 1)과 화면에서 "보너스는 다시 시작하면 새로 붙는다"고 보이면 된다. 다시 설계하지는 않는다.

---

## 3. 제안

### 3.1 (2) 연구 칸을 HOI4식으로

#### 제안
공장 수로 칸이 자동으로 느는 규칙을 없앤다. 나라마다 1936년 시작 칸을 정하고, 칸은 중점·결정(필요하면 국민정신)으로만 는다. 모두 지금의 `research_slot` 효과 하나로 들어오므로 엔진 경로가 하나다.

HOI4도 나라마다 시작 칸을 두고(대체로 2~3칸), 일반 트리의 연구 칸 중점 둘과 나라 트리 중점·국민정신으로 늘린다. 나라별 정확한 값은 판본마다 달라 따라 하지 않는다(확인 필요).

#### 규칙과 수치
- **칸 수** = `min(6, 시작 칸 + 효과 칸 + 옛 저장 칸)`
  - 시작 칸: 메이저 3, 미국·소련 4, 그 밖 2. 지금 1936년 첫날의 값과 같다(§2.1).
  - 효과 칸: 0~4. `WW_MAX_EXTRA_RESEARCH_SLOTS`를 2에서 4로 올린다.
  - 옛 저장 칸: 0~2. 마이그레이션 때만 생긴다.
- **상한은 6으로 둔다(`WW_MAX_SLOTS` 그대로).**
  - 명령 `cancel_research.slot`이 `zb.uint({max: WW_MAX_SLOTS − 1})`이라서, 상한을 바꾸면 zbin 바이트 배치가 바뀐다.
  - 가로 폰의 칸 줄도 6칸이 한계다(§3.3).
  - 7칸은 덜 고르게 만들어서, HOI4다운 "무엇을 포기할까"가 흐려진다.
- **공장은 칸을 만들지 않는다.** 폭격이나 점령으로 칸이 줄지도 않는다. 공장은 아래 결정의 조건으로만 남는다.
- **칸을 주는 곳**(모두 1회, +1).

  | 원천 | 누가 | 조건 | 비고 |
  |---|---|---|---|
  | 기존 나라 트리 중점 | 메이저 7 | §2.1 표 그대로 | 미국은 1940-06 또는 전쟁 |
  | 둘째 나라 트리 중점 | 메이저 7 | 첫째 연구 중점 다음 | 아래 표 |
  | `gen_rs_1`, `gen_rs_2` | 일반·팩 트리의 마이너 | 지금 그대로 | 2칸 |
  | 새 결정 `gen_science_mobilisation` "전시 과학 동원" | 모든 나라 | 공장(민간+군수) 10개 이상, 그리고 (전쟁 180일 이상 또는 세계 긴장도 50% 이상) | 100 정치력, 한 번만 |

- **둘째 나라 트리 중점.** 있는 중점에 효과를 더하는 것이 싸고, 없는 세 나라만 새로 만든다.

  | 나라 | 중점 | 방법 |
  |---|---|---|
  | 독일 | `deu_tech_mobilization` (x14 y2) | `research_slot +1`을 더한다 |
  | 영국 | `gbr_university_research` (x13 y1) | 더한다 |
  | 소련 | `sun_design_bureaus` (x15 y1) | 더한다 |
  | 미국 | `usa_radiation_lab` (x11 y1) | 더한다 |
  | 일본 | `jpn_radio_weapons` (x13 y3) | 더한다. 일반 과학 내용만이고 민감성 문제가 없다 |
  | 프랑스 | 새 `fra_science_council` (x15 y1, 선행 `fra_research_centre`) | 새로 만든다(70일) |
  | 이탈리아 | 새 `ita_university_labs` (x13 y1, 선행 `ita_research_council`) | 새로 만든다(70일) |

- **도달 칸.**

  | 나라 | 계산 | 결과 |
  |---|---|---|
  | 메이저 | 3 + 2 + 1 | 6 |
  | 미국·소련 | 4 + 2 + 1 = 7 | 상한 6 (원천 둘이면 이미 6) |
  | 마이너 | 2 + 2 + 1 | 5 |

- **결정이 날짜가 아니라 상황을 보는 이유.** "역사는 맛" 원칙을 따른다. 판마다 칸이 느는 때가 달라진다.

#### 균형이 어떻게 바뀌나 (추정, §2.1의 옛 측정 기준)

| 시기 | 지금 규칙(추정) | 제안 |
|---|---|---|
| 1936 첫날 | 메이저 3, 미·소 4, 마이너 2 | 같다 |
| 1939 가을 | 독·영 4+중점 1 = 5, 프·이·일 3+1 = 4, 미 5, 소 4+1 = 5, 마이너 2~4 | 메이저 3+(1~2) = 4~5, 미 4~5, 소 5~6, 마이너 2~4 |
| 1942 | 독 5~6, 미·소 6, 영 5, 이·프·일 4 | 살아 있는 메이저는 모두 6(전쟁 180일 결정), 마이너 4~5 |

- **이득을 보는 나라.** 이탈리아·프랑스·일본은 후반에 +1~2칸이다. 마이너도 후반에 +1칸이다.
- **비슷한 나라.** 독일·영국·소련.
- **잃는 나라.** 미국은 참전 전 1939년 무렵 −1칸이다(공장 160개대의 +2가 사라진다). 비동맹 미국에게는 그럴듯하다.
- **세계 전체 연구량**은 대략 +8~10%다. §3.2에서 트리가 거의 두 배가 되므로 고르는 재미는 오히려 커진다.
- **확정하려면 재야 한다.** 첫 작업으로 `scripts/ww1936/econ-sim.ts`를 지금 코드에서 돌려 나라별 칸 곡선을 뽑는다.

#### 데이터와 코드
- **`engine-lib/EconomyStart.ts`.** `START_RESEARCH_SLOTS: Partial<Record<CountryTag, number>> = { USA: 4, SUN: 4 }`와 `startResearchSlots(tag)`(기본 메이저 3, 마이너 2)를 둔다.
  - 잠든 나라(비시, 만주 등 P5 슬롯)는 깨어날 때 마이너 2다.
- **`engine-lib/EconomyRules.ts`.** `researchSlotCount(start, extra, legacy)` = `min(WW_MAX_SLOTS, start + extra + legacy)`로 바꾼다. 공장 인자를 지운다.
- **`engine/economy/WwEconomy.ts`.** `refreshTotals`가 새 함수를 쓴다. `WwCountryDetail`에 `slotSources: {start, focusOrDecision, legacy}`를 더한다(화면의 칸 내역).
- **`engine/politics/EffectsEcon.ts`.** `WW_MAX_EXTRA_RESEARCH_SLOTS = 4`.
- **콘텐츠.**
  - 중점 효과 5줄을 더하고, 새 중점 2개, 새 결정 1개를 만든다(`content/decisions/generic.ts`, 조건은 이미 있는 `factories_ge`, `war_days_ge`, `wt_ge`).
  - 문구는 `ww1936.focus.*`, `ww1936.decision.*` 키를 en/ko에 더한다.

#### 화면
- 칸 줄 맨 앞에 "🔬 4/5" 칩을 둔다. 탭하면 내역이 뜬다: "기본 3 · 중점 1 · 결정 0". 다음 원천도 보인다: "다음 칸: 중점 ‹대학 연구›" 또는 "결정 ‹전시 과학 동원›(전쟁 120/180일)". 탭하면 그 중점이나 결정 화면으로 간다.
- 빈 칸 안내 줄(`ww1936.econ.pick_prompt`)은 그대로 둔다.

#### AI와 자동화
- **AI 중점 가중치.** 연구 칸 중점은 `ai.base` 10에서 20으로 올린다. 메이저가 1938년 전에 첫 칸 중점을 고르도록 한다.
- **AI 결정 가중치.** 새 결정은 `ai.base` 40에, 칸이 6 미만일 때만 고른다.
- **자동 연구 스위치는 결정을 쓰지 않는다**(자동화는 정치력을 쓰지 않는다는 규칙, `Automation.ts` 머리 주석).
  - 대신 결정이 열리면 연구 화면의 칸 칩에 노란 점을 찍고, 한 번 탭으로 결정 카드를 연다.
  - 해야만 하는 잔일이 아니라, 원하면 하는 한 번의 선택이다.

#### 마이그레이션
- **옛 저장의 칸.** 옛 저장을 새 규칙으로 계산하면 공장 칸(+1~2)이 사라져서, 뒤쪽 칸이 "멈춤"으로 바뀐다. 이를 막는다.
  - 경제 국가 상태에 선택 필드 `slotRule: 2`를 쓴다(새 빌드는 늘 쓴다).
  - 복원할 때 이 필드가 없으면 옛 저장이다. `legacy = clamp(저장된 totals.slotCount − (시작 칸 + extraResearchSlots), 0, 2)`를 `legacySlots`(선택 필드)로 남긴다.
  - 복원은 결정적이고, 저장은 혼자 하기 전용이라 동기화 문제가 없다.
- **효과 칸 상한.** 2에서 4로 올리는 것은 값의 범위만 넓히므로 따로 할 일이 없다.
- **해시.** `slotRule`, `legacySlots`를 경제 해시에 넣는다.

#### 테스트
- `tests/ww1936/EconomyRules.test.ts`
  - 시작 칸 표: 독 3, 미 4, 소 4, 폴 2, 잠든 나라 2.
  - 상한 6.
  - 공장 0개와 300개에서 칸이 같다.
- `tests/ww1936/EconEffects.test.ts`: `research_slot`이 0~4다(R5 갱신).
- **새 테스트.**
  - 폭격과 점령이 칸을 줄이지 않는다.
  - 메이저 트리마다 칸 중점이 정확히 2개, 일반 트리 2개다.
  - 결정의 조건(공장 10, 전쟁 180일 / 긴장도 50%)이 맞고, 한 번만 된다.
- **스냅숏.** 옛 레코드 픽스처(`slotRule` 없음, 공장 칸 5)를 복원하면 `legacySlots = 1`이고 칸이 그대로다. 왕복이 같다.
- **AI 균형 띠.** 모든 AI 판(테스트 지도)에서 살아 있는 메이저가 1942년 말까지 6칸이다. 실제 지도 확인은 econ-sim으로 한다.
- **다이제스트.** `WW1936_DIGEST`, `WW1936_EASY_DIGEST`를 다시 고정한다(세 번 돌려 같은 값). `VanillaDigest`는 그대로여야 한다.

#### 작업량
S~M, 1인 3~4일이다.

| 일 | 일수 |
|---|---|
| 기준 측정 | 0.5 |
| 엔진과 콘텐츠 | 1.5 |
| 화면 칩 | 0.5 |
| 테스트와 다시 고정 | 1 |
| 균형 확인 | 0.5 |

---

### 3.2 (3) 기술을 HOI4 규모로

#### 제안
- 쓰이는 기술을 126개에서 234개로 늘린다(새로 108개, 그중 배타 3개는 둘 중 하나만 연구된다).
- HOI4처럼 탭을 나누고 연도 축 위에 놓는다.
- **장비 세대는 늘리지 않는다.**
  - HOI4도 세대(I·II·III) 사이를 "개량" 기술로 채운다.
  - 우리 재고는 `EQUIP_KEYS` 순서에 묶여 있어서, 세대를 끼우면 옛 저장 마이그레이션이 크다(§2.3).
  - 그래서 새 기술은 네 가지다: 장비 계열 능력치 "개량", 설계 모듈·차대·기체, 지원 중대 강화, 산업·공학 기술.
- 새 장비 종류(기계화 보병, 로켓 포)는 끝에 덧붙이면 가능하지만, 새 대대·라인·AI가 따라와서 선택 단계(3b)로 미룬다.

#### 탭과 갈래

| 탭 | 갈래 id | 지금 → 제안 | 비고 |
|---|---|---|---|
| 보병 | `infantry` | 14 → 21 | 지원 중대 6개를 지원 탭으로 옮김 |
| 지원 | `support`(새로 덧붙임) | 0 → 17 | 기존 6개 + 새 11개 |
| 기갑 | `armour` | 18 → 28 | |
| 포병 | `artillery` | 8 → 19 | |
| 해군 | `naval` | 33 → 49 | |
| 공군 | `air` | 26 → 41 | |
| 공학 | `electronics`(화면 이름만 "공학") | 11 → 22 | 신호 중대를 지원 탭으로 옮김 |
| 산업 | `industry` | 16 → 37 | 배타 줄 2개 중 하나만 |
| 교리 | `doctrine` | 0 (숙련) | 숙련 요약과 교리 화면 열기 |
| 특수 프로젝트 | (탭만) | 6 | 지금의 프로젝트 탭 그대로 |

- **지원 탭으로 옮기는 기술.** `engineer_company`, `recon_company`, `field_hospital`, `logistics_company`, `military_police`(보병에서), `signal_company`(전자에서).
- **교리 탭.** 교리는 연구 칸을 쓰지 않는 숙련이라 트리에 넣지 않는다(§3.3 그림 F). 탭은 육·해·공 대교리와 트랙 레벨을 요약하고, "교리 화면 열기"로 `WwDoctrinePanel`을 연다. HOI4 최신판도 교리를 연구 칸 밖의 숙련으로 돌린다.

#### 규칙과 수치
- **기술 정의에 더하는 필드**(`engine-lib/WwTechs.ts` `WwTechDef`).

  | 필드 | 뜻 | 기본 |
  |---|---|---|
  | `costPm` | 비용 배수(‰). 개량 750, 보통 1000, 큰 것 1250 | 1000 |
  | `prereqAny?: WwTechId[][]` | OR 묶음(바깥은 AND, 안은 OR. 중점의 AND of OR와 같은 꼴) | 없음 |
  | `exclusive?: { group: string; line: number }` | 같은 group의 다른 줄을 연구했거나 연구 중이면 막힘 | 없음 |
  | `project?: SpecialProject` | 그 프로젝트가 끝나야 연구 가능 | 없음 |
  | `role` | AI용 꼬리표: `gen`(세대), `imp`(개량), `module`, `chassis`, `unit`, `eco`, `post`(1945) | 필수 |

- **효과 타입을 넓힌다.** `effects: Partial<TechEffects>`를 `Partial<WwStats>`로 넓힌다. `techTotals`는 `WW_STAT_KEYS`를 돈다. `techStats`가 이미 `Partial<WwStats>`로 더하므로 길이 하나다.
- **비용.** `techCostMilli(id) = techDays(year) × costPm × WW_RESEARCH_COST_PM ÷ 1000`. 전체 손잡이 `WW_RESEARCH_COST_PM`는 1000에서 시작한다.
  - 엔진(`stepResearch`), 화면(ETA), resprog(`totalMilli`)가 모두 이 함수 하나를 쓴다.
- **막는 이유 2개를 덧붙인다**(`WW_ORDER_BLOCKS` 끝). `exclusive`, `no_project`. `researchBlockOf`의 입력에 `projects` 비트(이미 `DesignCtx.projects`와 같은 꼴)를 더한다.
- **새 능력치 키 3개를 덧붙인다**(`WW_STAT_KEYS` 끝, 복원은 0으로 채워진다).
  - `rsSupportPct`: 지원 갈래 속도. `RS_STAT_OF_BRANCH`에 더한다.
  - `infHardPct`: 보병 대대의 경성 공격. `TemplateStats`가 읽는다.
  - `casualtyReturnPp`: 사상자 인력 귀환 %p. `engine/economy/Manpower.ts`가 읽는다.
- **읽는 곳을 새로 만드는 키 2개.**
  - `energyPct`: `EnergyRules` 공급 배율.
  - `armorRelPp`: 전차 설계 신뢰도. 세부 교리 보상도 함께 살아난다(§2.7).
- **완료율 목표**(45분 판, 1945-08까지).

  | 나라 | 칸 평균 | 속도 | 연구 가능한 일수 | 새 트리의 몫 | 옛 트리라면 |
  |---|---|---|---|---|---|
  | 메이저 | 4.3~4.8 | +12~18% | 약 17,000~19,900일 | 44~52% | 81~95% |
  | 마이너 | 3.3 | +5% | 약 12,200일 | 32% | 58% |

  - 새 트리 전체는 배타 한 줄을 빼고 38,434일이다(기존 20,955 + 새 17,479).
  - 시작 기술(메이저 약 20~30개)을 더하면 메이저 완료율은 약 50~60%다. HOI4에서 1945년까지 트리의 절반 안팎을 여는 감각과 비슷하다(확인 필요).
  - 균형 손잡이는 `WW_RESEARCH_COST_PM` 하나다(목표 띠에 못 들면 900~1100 사이로 옮긴다).
- **무제한 모드.**
  - 시뮬레이션은 같은 날수로 돌고 실제 시간만 4배다(`engine-lib/Pace.ts`). 그래서 1945년까지의 완료율은 45분 판과 같다.
  - 1945년 이후에도 남은 약 45%와 1945년 기술 6개가 메이저 6칸을 약 7년 동안 채운다.
  - 트리를 다 끝낸 나라를 위한 전환은 아이디어 11(§4)이다.
- **앞섬 벌칙과 AI.** 지금 그대로 둔다. 1945년 기술을 1943년에 시작하면 +200%다. 그래서 45분 판에서는 거의 열리지 않고, 무제한 판의 몫이 된다.

#### 기술 목록
- 표기: ★는 새 기술, 비용은 ‰다.
- 기존 기술의 id·연도·선행은 바꾸지 않는다(갈래만 지원으로 옮기는 6개를 빼고).
- 효과는 모두 이미 있는 `WwStats` 키다. "새 키"와 "새 읽기"는 위 규칙의 5개다.

**보병** (기존 9: `inf_eq_1~3`, `support_eq_1~2`, `motorized_1`, `mountaineers`, `marines`, `paratroopers`)

| id | 이름 | 연도 | 선행 | 효과 | 비용 | 연결 |
|---|---|---|---|---|---|---|
| ★`inf_imp_1` | 개량 소총 | 1937 | inf_eq_1 | infAttackPct +3 | 750 | 보병 장비 1→2세대 사이 |
| ★`inf_imp_2` | 반자동 소총 | 1940 | inf_eq_2, inf_imp_1 | infAttackPct +5 | 750 | 2→3세대 사이 |
| ★`inf_imp_3` | 돌격 소총 | 1944 | inf_eq_3, inf_imp_2 | infAttackPct +5, infDefensePct +3 | 1000 | 3세대 뒤 |
| ★`inf_at_1` | 보병 대전차 화기 | 1941 | inf_eq_2, anti_tank_1 | infHardPct +15 (새 키) | 1000 | |
| ★`inf_at_2` | 휴대용 로켓 대전차 화기 | 1943 | inf_at_1, rocketry_1 | infHardPct +15 | 1000 | 공학 로켓과 이어짐 |
| ★`support_imp_1` | 개량 지원 화기 | 1938 | support_eq_1 | supportCompanyPct +5 | 750 | 지원 장비 1→2세대 사이 |
| ★`motorized_2` | 개량 트럭 | 1939 | motorized_1 | motSpeedPct +10 | 750 | 차량 장비는 1세대뿐: 개량으로 채움 |
| ★`motorized_3` | 반궤도 차량 | 1942 | motorized_2 | motOrg +3, motSpeedPct +5 | 1000 | |
| ★`marines_2` | 상륙 돌격 장비 | 1940 | marines | invasionPrepPct −10 | 750 | |
| ★`para_2` | 공수 장비 | 1941 | paratroopers, transport_plane_1 | paradropPrepPct −25 | 750 | |
| ★`winter_gear_1` | 동계 장비 | 1938 | inf_eq_1 | winterPenaltyPct +25 | 750 | `CombatRules`가 읽음 |
| ★`desert_gear_1` | 열대·사막 장비 | 1939 | inf_eq_1 | desertAttackPct +10 | 750 | `CombatRules`가 읽음 |
| (3b) `mechanized_1` | 기계화 보병 | 1941 | motorized_2, light_tank_2 | 새 장비 `mechanized` + 대대 | 1250 | 선택 단계 |

**지원** (기존 6: `engineer_company`, `recon_company`, `field_hospital`, `logistics_company`, `signal_company`, `military_police`)

| id | 이름 | 연도 | 선행 | 효과 | 비용 |
|---|---|---|---|---|---|
| ★`reinforce_1` | 보충 체계 | 1938 | support_eq_1 | reinforcePct +10 | 750 |
| ★`engineer_2` | 개량 공병 장비 | 1939 | engineer_company | entrenchSpeedPct +10, riverPenaltyCutPct +10 | 750 |
| ★`engineer_3` | 돌격 공병 | 1942 | engineer_2 | fortPenaltyCutPct +10 | 750 |
| ★`recon_2` | 장갑 정찰 | 1939 | recon_company | reconPct +10 | 750 |
| ★`recon_3` | 무선 정찰 | 1942 | recon_2, radio_1 | reconPct +10 | 750 |
| ★`field_maintenance` | 야전 정비 | 1939 | support_eq_1 | capturePct +5, armorRelPp +3 (새 읽기) | 750 |
| ★`logistics_2` | 보급 차량화 | 1940 | logistics_company, motorized_1 | supplyUsePct −5 | 750 |
| ★`mp_2` | 점령지 치안 | 1940 | military_police | garrisonNeedPct −10 | 750 |
| ★`hospital_2` | 야전 수혈·후송 | 1941 | field_hospital | casualtyReturnPp +10 (새 키) | 750 |
| ★`signal_2` | 야전 무선망 | 1941 | signal_company, radio_1 | planSpeedPct +10 | 750 |
| ★`logistics_3` | 보급 표준화 | 1943 | logistics_2 | supplyUsePct −5 | 750 |

**기갑** (기존 18: 경·중형·중전차 세대 8, 전차포 2, 주조 장갑, 디젤, 토션바, 무선, 경사 장갑, 겹친 바퀴, 수륙 양용, 화염 전차)

| id | 이름 | 연도 | 선행 | 효과 | 비용 | 연결 |
|---|---|---|---|---|---|---|
| ★`tank_reliability_1` | 전차 정비성 | 1939 | light_tank_2 | armorRelPp +5 (새 읽기) | 750 | |
| ★`armor_plate_2` | 표면 경화 장갑 | 1940 | cast_armor | armorArmorPct +5 | 750 | |
| ★`tank_engine_2` | 개량 전차 엔진 | 1940 | diesel_engine | 설계 모듈 `engine_2` | 1000 | 전차 설계국 |
| ★`armor_coordination` | 전차·보병 협동 | 1941 | tank_radio | armorBrkPct +5 | 750 | |
| ★`tank_reliability_2` | 표준 부품 | 1942 | tank_reliability_1 | armorRelPp +5 | 750 | |
| ★`armor_plate_3` | 균질 압연 장갑 | 1943 | armor_plate_2, sloped_armor | armorArmorPct +5 | 750 | |
| ★`tank_engine_3` | 고출력 전차 엔진 | 1943 | tank_engine_2 | 설계 모듈 `engine_3` | 1000 | 전차 설계국 |
| ★`tank_gun_4` | 고속 장포신 전차포 | 1944 | tank_gun_3 | 설계 모듈 `gun_hv` | 1000 | 전차 설계국 |
| ★`super_heavy_tank` | 초중전차 차대 | 1944 | heavy_tank_3 | 차대 `super_heavy_1` | 1250 | `TANK_BASE_DEFS`에 덧붙임 |
| ★`modern_tank_1` | 주력 전차 차대 | 1945 | medium_tank_3, tank_gun_4 | 차대 `modern_1` | 1250 | 무제한 대상(`post`) |

**포병** (기존 8: `artillery_1~3`, `anti_tank_1~2`, `anti_air_1~2`, `railway_gun_1`)

| id | 이름 | 연도 | 선행 | 효과 | 비용 | 연결 |
|---|---|---|---|---|---|---|
| ★`art_imp_1` | 개량 야포 | 1937 | artillery_1 | artillerySoftPct +5 | 750 | 포 1→2세대 사이 |
| ★`art_towing` | 차량 견인 포 | 1938 | artillery_1, motorized_1 | artSpeedPct +10 | 750 | |
| ★`at_imp_1` | 개량 대전차포 | 1938 | anti_tank_1 | atPiercePct +10 | 750 | |
| ★`aa_imp_1` | 개량 대공포 | 1938 | anti_air_1 | aaPct +10 | 750 | |
| ★`art_imp_2` | 사격 표준화 | 1940 | artillery_2, art_imp_1 | artillerySoftPct +5 | 750 | |
| ★`fire_direction` | 포병 사격 지휘 | 1941 | artillery_2, signal_company | artillerySoftPct +5 | 1000 | 지원 탭과 이어짐 |
| ★`at_imp_2` | 대구경 대전차포 | 1941 | anti_tank_2, at_imp_1 | atPiercePct +10, atHardPct +5 | 750 | |
| ★`aa_imp_2` | 대공 사격 통제 | 1941 | anti_air_2, aa_imp_1 | aaPct +10 | 750 | |
| ★`art_imp_3` | 개량 야포 III | 1943 | artillery_3, art_imp_2 | artillerySoftPct +5 | 750 | |
| ★`at_imp_3` | 고속 철갑탄 | 1944 | at_imp_2 | atHardPct +10 | 750 | |
| ★`aa_imp_3` | 근접 신관 탄약 | 1944 | aa_imp_2, 프로젝트 `sp_proximity_fuze` | aaPct +15 | 750 | 특수 프로젝트 |
| (3b) `rocket_artillery_1` | 로켓 포 | 1940 | artillery_2, rocketry_1 | 새 장비·대대 | 1250 | 선택 단계 |

**해군** (기존 33: 함급 세대 19, 소나 2, 사격 통제, 어뢰, 레이더 2, 상륙정 2, 양용포, 장갑 갑판, 기뢰, 스노클, 초대형 전함, 부유 항구)

| id | 이름 | 연도 | 선행 | 효과 | 비용 | 연결 |
|---|---|---|---|---|---|---|
| ★`naval_aa_1` | 함정 대공 화기 | 1938 | anti_air_1 | 함선 모듈 `aa_2` | 750 | 함선 설계국 |
| ★`damage_control_1` | 손상 통제 | 1938 | — | navalDamageTakenPct −5 | 750 | |
| ★`naval_engine_2` | 개량 함정 기관 | 1939 | — | navalSpeedPct +5 | 750 | |
| ★`convoy_escort_1` | 호송 전술 | 1939 | dd_2 | convoyEscortPct +10 | 750 | |
| ★`torpedo_2` | 개량 어뢰 | 1940 | torpedo_1 | torpedoPct +10 | 750 | |
| ★`depth_charge_2` | 개량 폭뢰 | 1940 | sonar_1 | depthChargePct +15 | 750 | |
| ★`mine_warfare_2` | 자기 기뢰·소해 | 1940 | mine_warfare_1 | 기뢰 규칙이 id로 읽음 | 750 | 기뢰 함대 |
| ★`transport_ship_2` | 개량 수송선 | 1940 | — | convoyLossPct −10 | 750 | |
| ★`fire_control_2` | 레이더 사격 통제 | 1941 | fire_control_1, naval_radar_1 | 함선 모듈 `fc_2` | 1000 | 함선 설계국 |
| ★`naval_aa_2` | 함정 대공 사격 통제 | 1941 | naval_aa_1, dual_purpose_guns | 함선 모듈 `aa_3` | 750 | 함선 설계국 |
| ★`damage_control_2` | 응급 수리 | 1941 | damage_control_1 | navalDamageTakenPct −5, repairPct +10 | 750 | |
| ★`naval_engine_3` | 고압 증기 기관 | 1942 | naval_engine_2 | navalSpeedPct +5 | 750 | |
| ★`hedgehog` | 전방 투사 대잠 무기 | 1942 | depth_charge_2, sonar_2 | depthChargePct +15 | 750 | |
| ★`convoy_escort_2` | 호송 지원군 | 1942 | convoy_escort_1, sonar_2 | convoyEscortPct +10 | 750 | |
| ★`carrier_deck_2` | 비행갑판 확장 | 1942 | cv_3, armored_deck | carrierDeckPct +10 | 1000 | |
| ★`torpedo_3` | 음향 유도 어뢰 | 1943 | torpedo_2, sonar_2 | torpedoPct +10, subTorpedoPct +10 | 1000 | |

**공군** (기존 26: 기종 세대 18, 수송기, 함재기 운용, 기관포 2, 방탄 연료 탱크, 낙하 탱크, 폭격 조준기, 로켓, 기상 레이더)

| id | 이름 | 연도 | 선행 | 효과 | 비용 | 연결 |
|---|---|---|---|---|---|---|
| ★`aero_engine_2` | 개량 항공 엔진 | 1939 | fighter_1 | airAgilityPct +5 | 750 | |
| ★`air_armor_1` | 조종석 장갑 | 1939 | self_sealing_tanks | airLossCutPct +5 | 750 | |
| ★`naval_strike_1` | 공중 어뢰 | 1939 | naval_bomber_1 | navalStrikePct +10 | 750 | |
| ★`long_range_1` | 장거리 비행 | 1940 | drop_tanks | airRangePct +10 | 750 | |
| ★`transport_plane_2` | 대형 수송기 | 1941 | transport_plane_1 | paradropPrepPct −15 | 750 | |
| ★`air_ground_control` | 지상 요격 관제 | 1941 | radar_1, signal_company | interceptShareBp +500 | 1000 | |
| ★`carrier_aviation_2` | 함재기 운용 II | 1941 | carrier_aviation | sortieEffPct +10 | 750 | |
| ★`aero_engine_3` | 과급 엔진 | 1942 | aero_engine_2 | airAgilityPct +5 | 750 | |
| ★`bomb_sight_2` | 자동 폭격 조준기 | 1942 | bomb_sight_1 | stratBombPct +10 | 750 | |
| ★`naval_strike_2` | 개량 공중 어뢰 | 1942 | naval_strike_1 | navalStrikePct +10 | 750 | |
| ★`aero_engine_4` | 고출력 피스톤 엔진 | 1944 | aero_engine_3 | airAgilityPct +5 | 750 | |
| ★`air_rockets_2` | 대지 로켓 II | 1944 | air_rockets_1 | casPct +10 | 750 | |
| ★`air_radar_2` | 야간 요격 레이더 | 1944 | air_radar_1, radar_2 | 비행기 모듈 `radar_2` | 1000 | 항공기 설계국 |
| ★`jet_airframe_2` | 후퇴익 제트 기체 | 1945 | aero_engine_4, 프로젝트 `sp_jet_engine` | 기체 `jet_2` | 1250 | 특수 프로젝트, `post` |
| ★`jet_bomber_1` | 제트 폭격기 기체 | 1945 | strat_bomber_2, 프로젝트 `sp_jet_engine` | 기체 `jet_medium_1` | 1250 | 특수 프로젝트, `post` |

**공학** (갈래 id `electronics`, 기존 10: 전자 공학, 계산 2, 레이더 2, 암호 3, 핵물리, 로켓)

| id | 이름 | 연도 | 선행 | 효과 | 비용 | 연결 |
|---|---|---|---|---|---|---|
| ★`radio_1` | 무선 통신 | 1937 | electronics_1 | planSpeedPct +5 | 750 | 지원·공군과 이어짐 |
| ★`encryption_1` | 암호화 | 1938 | electronics_1 | encryptPct +10 | 750 | 정보 |
| ★`radio_2` | 개량 무선 | 1940 | radio_1 | planMaxBp +500 | 750 | |
| ★`encryption_2` | 기계 암호 | 1941 | encryption_1 | encryptPct +10 | 750 | |
| ★`rocketry_2` | 액체 연료 로켓 | 1942 | rocketry_1 | projectSpeedPct +10 | 1000 | 특수 프로젝트 |
| ★`operations_research` | 작전 연구 | 1942 | computing_2 | supplyUsePct −3, convoyLossPct −5 | 1000 | |
| ★`radar_3` | 센티미터파 레이더 | 1943 | radar_2, 프로젝트 `sp_cavity_magnetron` | airDetectPct +10, navalDetectPct +10 | 1000 | 특수 프로젝트 |
| ★`computing_3` | 전자식 계산기 | 1943 | computing_2 | researchPct +5 | 1000 | |
| ★`electronic_warfare` | 전파 교란 | 1943 | radar_2 | nightBombBp +500, airDetectPct +5 | 1000 | |
| ★`cryptography_4` | 기계 해독 | 1944 | cryptography_3, computing_2 | decryptPct +10 | 1000 | 정보 |
| ★`computing_4` | 저장 프로그램 계산기 | 1945 | computing_3 | researchPct +3 | 1250 | `post` |
| ★`nuclear_reactor` | 원자로 | 1945 | nuclear_physics | energyPct +10 (새 읽기) | 1250 | `post`. 무기 아님 |

**산업** (기존 16: 건설 3, 공작 기계 4, 생산 2, 채굴 2, 유연 라인, 요새, 철도, 합성 석유 2)

| id | 이름 | 연도 | 선행 | 효과 | 비용 | 연결 |
|---|---|---|---|---|---|---|
| ★`concentrated_1` | 집중 산업 | 1937 | tools_1 | outputPct +5 | 1000 | 배타 `industry_org` 줄 0 |
| ★`dispersed_1` | 분산 산업 | 1937 | tools_1 | effCapBp +300, bombDamageTakenPct −10 | 1000 | 배타 `industry_org` 줄 1 |
| ★`fuel_storage_1` | 연료 저장 | 1938 | — | fuelCapPct +10 | 750 | |
| ★`fuel_refining_1` | 정유 기술 | 1938 | excavation_1 | fuelPct +10 | 750 | |
| ★`energy_grid_1` | 송전망 | 1938 | — | energyPct +10 (새 읽기) | 750 | 석탄·에너지 |
| ★`dockyard_1` | 조선 공정 | 1938 | — | dockOutputPct +10 | 750 | |
| ★`fortification_2` | 요새 공학 | 1939 | fortification_1 | fortConstructionPct +33 | 750 | |
| ★`synthetic_rubber_1` | 합성 고무 | 1939 | synthetic_oil_1 | 정유소가 고무 +1 (규칙이 id로 읽음) | 1000 | 자원 |
| ★`concentrated_2` | 집중 산업 II | 1940 | concentrated_1, tools_2 | outputPct +5 | 1000 | 줄 0 |
| ★`dispersed_2` | 분산 산업 II | 1940 | dispersed_1, tools_2 | effCapBp +300, bombDamageTakenPct −10 | 1000 | 줄 1 |
| ★`rail_2` | 개량 철도 | 1940 | rail_1 | railConstructionPct +33, railSpeedPct +20 | 750 | |
| ★`fuel_refining_2` | 고옥탄 정유 | 1941 | fuel_refining_1 | fuelPct +10 | 750 | |
| ★`energy_grid_2` | 광역 송전망 | 1941 | energy_grid_1 | energyPct +10 | 750 | |
| ★`dockyard_2` | 블록 건조 | 1941 | dockyard_1 | dockOutputPct +10 | 750 | |
| ★`construction_4` | 건설 기술 IV | 1942 | construction_3 | constructionPct +10, slotPct +20 | 1000 | |
| ★`excavation_3` | 채굴 III | 1942 | excavation_2 | extractionPct +10 | 1000 | |
| ★`fortification_3` | 강화 요새 | 1942 | fortification_2 | fortDefPerLevelBp +100 | 750 | |
| ★`concentrated_3` | 집중 산업 III | 1943 | concentrated_2, tools_3 | outputPct +5 | 1000 | 줄 0 |
| ★`dispersed_3` | 분산 산업 III | 1943 | dispersed_2, tools_3 | effCapBp +300, bombDamageTakenPct −10 | 1000 | 줄 1 |
| ★`tools_5` | 공작 기계 V | 1944 | tools_4 | effCapBp +500 | 1000 | 효율 상한 95% |
| ★`construction_5` | 건설 기술 V | 1945 | construction_4 | constructionPct +10 | 1000 | `post` |

- 집중·분산은 HOI4의 배타 쌍이다. 우리는 공장 폭격(`BuildingDamage`)이 있어서 분산 산업이 실제로 의미가 있다.
- **배타는 이 한 쌍만 둔다.** 교리의 배타는 교리 탭(숙련)이 이미 맡는다.

**합계.** 기존 126 + 새 108 = 234개다(+ 3b 선택 2개).

| 연도 | 새 기술 수 |
|---|---|
| 1937 | 5 |
| 1938 | 13 |
| 1939 | 13 |
| 1940 | 16 |
| 1941 | 18 |
| 1942 | 16 |
| 1943 | 11 |
| 1944 | 10 |
| 1945 | 6 |

#### 장비 세대·설계·프로젝트와 맞물림
- **장비 세대.** `Equipment.ts` `techs`와 `EQUIPMENT_GENS`를 바꾸지 않는다. 세대 기술은 `role: "gen"`이다. "개량"(`imp`)은 같은 계열의 능력치 키로 세대와 함께 쌓인다.

  | 계열 | 키 |
  |---|---|
  | 보병 | infAttackPct, infDefensePct, infHardPct |
  | 포 | artillerySoftPct, artSpeedPct |
  | 대전차 | atPiercePct, atHardPct |
  | 대공 | aaPct |
  | 차량 | motSpeedPct, motOrg |
  | 전차 | armorArmorPct, armorRelPp, armorBrkPct |
  | 항공기 | airAgilityPct, airLossCutPct 등 |

- **설계국.** 모두 `DesignRules.ts` 표 끝에 덧붙인다. 문자열 id라 옛 설계가 안전하다.

  | 설계국 | 새 모듈 | 새 차대·기체 |
  |---|---|---|
  | 전차 | `engine_2`, `engine_3`, `gun_hv` | `super_heavy_1`, `modern_1` |
  | 함선 | `aa_2`, `aa_3`, `fc_2` | — |
  | 항공기 | `radar_2` | `jet_2`, `jet_medium_1` |

  - AI 설계 프리셋(`aiDesignPresets`)에 새 모듈을 쓰는 프리셋을 2~3개 더한다.
- **특수 프로젝트.** 프로젝트 정의는 바꾸지 않는다. 프로젝트가 끝나면 열리는 후속 기술 4개를 둔다.

  | 프로젝트 | 후속 기술 |
  |---|---|
  | `sp_proximity_fuze` | `aa_imp_3` |
  | `sp_cavity_magnetron` | `radar_3` |
  | `sp_jet_engine` | `jet_airframe_2`, `jet_bomber_1` |

  - `rocketry_2`는 프로젝트 속도를 올린다(`projectSpeedPct`. 원자탄도 빨라진다는 점을 균형에서 본다).
- **대대·중대.** 새 대대는 없다(3b 제외). 지원 중대 강화는 능력치 키로만 한다.

#### AI와 자동 연구
- **점수식으로 바꾼다.** `aiResearchOrder`의 고정 목록을 점수식 고르기로 바꾼다. 정수만 쓰고, 같은 점수는 `WW_TECH_IDS` 순서로 정한다. 모든 항은 판 상태에서 나오므로 새 상태가 없다.

  ```
  점수(t) = 역할 가중치[성향 또는 나라][role(t)]        0..100
          + 필요                                          0..40
              그 장비의 라인이 있으면 세대·개량 +20
              그 설계 종류의 설계가 있으면 모듈 +10
              해안이 없으면 해군 제외
              항공기를 만들지 않으면 공군 제외
              특수부대가 없으면 그 기술 제외
          + 보너스: 맞는 research_bonus +25, 진영 공동 연구 몫 ÷ 2
          + 따라잡기: 연도보다 늦은 해 수 × 5 (최대 +15)
          − 앞섬 ÷ 2
          + 시드 흔들기 wwRoll(seed, P_RESEARCH, tag, 기술 번호) % 11   0..10
  ```

- **땅·바다·하늘.**
  - 기존 `AI_RESEARCH_MIX`와 `aiResearchCaps`를 그대로 쓴다.
  - 땅·바다·하늘 구분은 id 순서(`LAST_LAND_TECH`) 대신 갈래로 정한다: 해군은 바다, 공군과 레이더는 하늘, 그 밖은 땅.
- **성향.** `COUNTRY_ORDER`, `PERSONALITY_ORDER`, `SEA_FOCUS`, `AIR_FOCUS`의 뜻은 역할 가중치 표와 나라별 "먼저 볼 기술" 덧점(+30)으로 옮긴다. 예를 들어 독일은 기갑·공군 `gen`/`module`, 영국은 레이더·호송, 소련은 보병·포 `imp`다.
- **배타 선택.** 판마다 시드로 한 번 정한다(상태 없음, 같은 시드면 같다). 역사는 맛이고, 판마다 다르다.

  | 나라 | 집중 | 분산 |
  |---|---|---|
  | 침략형 | 70% | 30% |
  | 미국 | 80% | 20% |
  | 영국 | 40% | 60% |
  | 소련 | 30% | 70% |
  | 마이너 | 50% | 50% |

- **앞섬 문턱과 비용.**
  - 50/75% 문턱은 그대로 둔다.
  - 한 번 고를 때 234개를 훑어도 국가 79개 × 하루 몇 번이라 가볍다.
  - 정적인 부분(역할 가중치, 흔들기)은 나라마다 판 시작에 캐시한다. `EconomyPerf` 예산 테스트로 지킨다.
- **사람의 자동 연구.**
  - 같은 함수를 사람 나라에 쓰고, `fillSlots`의 "끝까지 채움"을 유지한다.
  - 역할 가중치는 그 나라의 라인과 군 구성에서 나온다(사람에게는 성향이 없다).
  - 선택으로 자동 연구 성향 프리셋 5개(균형/육군/해군/공군/산업)를 둘 수 있다. 상태 1바이트이고, 결정 3에 묶지 않은 S 작업이다.
- **새 기술 108개를 쓰는 콘텐츠.**
  - `research_bonus` 갈래에 `support`를 쓰는 중점 몇 개를 고친다(지금 `infantry` 보너스 7개 중 지원 중대 성격인 것).
  - 일반 결정 `gen_tech_exchange`의 앞선 갈래 검사에 지원과 공학을 더한다.

#### 마이그레이션
- **id는 덧붙이기만 한다.** 새 108개를 `WW_TECH_IDS` 끝에, `support`를 `TECH_BRANCHES` 끝에, 새 키 3개를 `WW_STAT_KEYS` 끝에, 막는 이유 2개를 `WW_ORDER_BLOCKS` 끝에 둔다. 기존 id의 이름과 순서는 그대로다.
  - 순서 고정 테스트(`DepthTypes.test.ts` `after(military_police)`의 길이 33 등)는 새 끝을 반영해 고친다. "앞부분은 그대로"라는 검사는 남긴다.
- **스냅숏.**
  - 기술 id는 문자열이라 옛 저장이 그대로 읽힌다.
  - 능력치 배열은 0으로 채워진다.
  - 재고 배열은 바뀌지 않는다(세대를 늘리지 않으므로).
  - 3b에서 새 장비 종류를 덧붙이면 복원에서 `stock`을 `EQUIP_KEY_COUNT`까지 0으로 채우는 한 줄과 테스트를 더한다. 라인의 `key`는 순서 번호인데, 덧붙이기라 옛 번호가 유효하다.
- **갈래 이동**(보병·전자 → 지원) 6개는 정의 안의 값이라 저장에 남지 않는다. 진행 중인 칸의 보너스는 칸에 붙어 있어 그대로다.
- **진행 중인 판에서 비용 배수가 바뀐 기술.** 저장된 진행(밀리일)이 새 총량보다 크면 다음 날 끝난다. resprog의 `savedResearch`도 같은 단위라 그대로 맞는다.
- **옛 저장의 중반 판.** 새 기술이 한꺼번에 "늦은 기술"로 열린다. 공짜로 주지는 않는다. 따라잡기 보너스(§4 아이디어 2)를 함께 넣으면 몇 년 안에 자연스럽게 메워진다.
- **리플레이는 빌드에 묶여 있어 손댈 것이 없다**(§2.6).

#### 테스트
- **정의 검사**(새 `tests/ww1936/TechTree.test.ts`).
  - 연도가 1936~1945다.
  - 선행이 모두 있고, 연도가 같거나 앞서고, 고리가 없다.
  - `prereqAny` 묶음이 비어 있지 않다.
  - 배타 group이 서로 대칭이고, 줄마다 1개 이상 있다.
  - `project`는 `SPECIAL_PROJECTS`의 값이다.
  - 효과 키가 `WW_STAT_KEYS`이고 **규칙 코드에 읽는 곳이 있다.** 읽는 키 목록을 상수로 두고 맞춘다. `armorRelPp`, `energyPct`가 여기서 걸린다.
  - en/ko 이름이 있다.
  - 화면 배치 칸이 있다(클라이언트 테스트).
- **막기.**
  - 배타 한 줄을 시작하면 다른 줄이 `exclusive`다.
  - 프로젝트 전에는 `no_project`이고, 끝난 뒤에는 열린다.
  - `prereqAny`가 둘 중 하나로 풀린다.
- **비용.**
  - `techCostMilli`가 엔진, 화면 ETA, resprog `totalMilli`에서 같다.
  - 화면 ETA가 엔진 속도(국민정신·갈래·보너스·공동 연구 포함)와 같다(§2.5의 차이 수정).
- **장비·설계.**
  - `EQUIP_KEYS`가 바뀌지 않는다(3b 전).
  - 새 모듈과 차대가 기술 없이 막히고 기술로 열린다.
  - AI 프리셋이 유효하다.
- **AI.**
  - 같은 시드면 같은 목록이고, 다른 시드면 배타 선택이 갈리는 판이 있다.
  - 해안 없는 나라는 해군을 고르지 않는다.
  - 자동 연구가 모든 칸을 채운다(`Automation.test.ts` 확장).
- **페이스 띠.** 실제 지도의 econ-sim 또는 새 `research-sim`으로 1945-08에 메이저 45~65%, 마이너 25~45% 완료를 확인한다. 테스트 지도용 빠른 판은 CI에 넣는다.
- **스냅숏과 결정성.**
  - 왕복이 같다.
  - 옛 픽스처가 열린다.
  - `WW1936_DIGEST`, `WW1936_EASY_DIGEST`를 다시 고정한다. `VanillaDigest`는 그대로다.
  - `EnJsonSorted`, `TranslationSystem`, `LayerBoundaries`.
- **성능.** `EconomyPerf`(고르기 비용).

#### 작업량
L, 1인 16~22일이다.

| 일 | 일수 |
|---|---|
| 데이터 모델(필드, 막기, 비용 함수, 효과 타입 넓히기, 지원 갈래, 새 키) | 2~3 |
| 기술 108개 정의 + en/ko 이름(약 220줄) + 효과 문구 | 4~5 |
| 읽는 곳(새 키 3, `energyPct`, `armorRelPp`, 합성 고무, 기뢰 2) + 설계 모듈 6·차대 2·기체 2 + AI 프리셋 | 4~5 |
| AI 점수식 + 배타 + 자동 연구 | 2~3 |
| 균형 판 돌리기(econ, land, sea-air sim) | 2~3 |
| 테스트·다시 고정 | 2~3 |

- 3b(기계화, 로켓 포)는 따로 4~6일이다.
- 탭 단위로 레인을 나눌 수 있다(땅 4탭 / 바다·하늘 / 공학·산업).

---

### 3.3 (4) HOI4 같은 연구 트리 화면

#### 제안
- 지금의 "탭 + 카드 목록"을 **연도 축 트리 캔버스**로 바꾼다.
- HOI4 화면은 연도를 위에서 아래로 늘어놓는다. 우리는 가로 폰과 태블릿이 기준이라 **연도를 왼쪽에서 오른쪽(1936 → 1945)**으로 놓는다.
- 중점 트리 캔버스(`hud/FocusCanvas.ts`, `FocusLayout.ts`)를 일반 "트리 캔버스"로 뽑아 두 화면이 함께 쓴다. 손가락 동작, 다시 그리는 규칙, 선 종류가 이미 검증되어 있다.

#### 규칙과 수치
- **틀.** 지금처럼 전체 화면 패널(`WwPanelMode`)이고, 도크(40/44px) 위에 놓인다. 지도 흐름이 시작되면 비켜난다.
- **배치**(배율 1).

  | 항목 | 값 |
  |---|---|
  | 연도 칸 너비 | 132px |
  | 노드 | 120×52px |
  | 줄 높이 | 60px |
  | 같은 해·같은 줄에 둘 | 반 칸(66px) 어긋냄 |
  | 연도 머리줄 | 18px, 캔버스 위에 고정 |

  - 10년이면 1,320px다. 0.6배로 줄이면 792px라서, 가로 폰(844px − 왼쪽 탭 막대 44px = 800px)에 1936~1945가 한 화면에 들어간다.
  - 1945 기술(`post`)은 무제한 판에서만 "1945+" 칸을 보이고, 45분 판에서는 접는다(반투명 띠, 탭하면 펼침).
- **줄(lane).** 탭마다 5~8개다. 예를 들어 보병은 보병 장비 / 개량 화기 / 대전차 / 지원 장비 / 차량 / 특수부대 / 기후 장비다.
  - 배치 표는 **클라이언트 데이터**(`hud/ResearchLayout.ts`: id → 탭, 연도 칸(반 칸 허용), 줄)다.
  - 엔진 정의는 연도와 갈래만 안다. 연도 칸은 정의의 연도와 같아야 한다(테스트).
- **compact 높이 예산**(844×390).

  | 부분 | 높이 |
  |---|---|
  | 화면 | 390 |
  | 도크 | − 40 |
  | 머리줄 | − 40 |
  | 캔버스 | 310 (연도 머리 18 + 줄 약 4.8개, 0.75배면 6.5개) |

  - 탭은 높이를 아끼려고 **왼쪽 세로 막대**(44px, 아이콘 + 두 글자, 세로로 스크롤)에 둔다.
- **손가락 동작.**
  - 중점 캔버스와 같은 동작: 한 손가락으로 끌고, 두 손가락으로 0.6~1.4배, 두 번 탭하면 1배와 "연도 전체 맞춤"을 오간다.
  - 연도 머리를 탭하면 그 해로 간다. 📍 단추는 오늘 날짜 칸으로 간다.
  - 탭마다 보던 위치를 기억한다(클라이언트만).
  - 데스크톱은 휠로 끌고, Ctrl+휠로 확대한다.
- **노드 모양**(색은 지금 `CARD_LOOK`을 잇는다).

  | 상태 | 모양 |
  |---|---|
  | 완료 | 초록 |
  | 진행 중 | 파랑 + 고리 |
  | 시작 가능 | 노랑 테두리 |
  | 저장된 진행 | 노랑 + 아래 막대와 "⏸ 37%" (resprog `savedResearch`) |
  | 대기 | 파란 점선 + 번호 |
  | 선행 부족 | 회색 60% + 🔒 |
  | 배타로 잠김 | 회색 50% + 빨간 사선 |
  | 프로젝트 필요 | 보라 🧪 |

  - 오른쪽 위 배지: 앞섬 "+45%"(호박색).
  - 아래 배지: 보너스 "⚡+100%"(research_bonus), "🤝+20%"(진영 공동 연구).
  - 0.8배 아래에서는 이름 한 줄과 아이콘만 그린다.
- **선.** AND 선행은 실선 꺾은선(앞 노드 오른쪽 → 뒤 노드 왼쪽), OR 선행은 점선, 배타는 두 노드를 잇는 빨간 "⇄ 하나만" 괄호다.
  - 다른 탭의 선행은 노드 왼쪽의 작은 꼬리표다(예: "↖ 공학: 무선 통신 ✓"). 탭하면 그 탭의 그 노드로 간다.
- **오늘 선.** 오늘 날짜 위치(예: 1939.6)에 세로 점선을 긋는다. 그 오른쪽은 연한 호박색 바탕이다(앞섬 벌칙 구역).
- **두 번 탭해서 시작.**
  1. 노드를 탭하면 고른 상태가 되고, 노드 옆에 행동 알약이 뜬다. 옆 시트도 열린다.
  2. 알약을 탭하면 명령을 보낸다.
  - 빈 칸이 있으면 "▶ 시작"이다. 엔진은 첫 빈 칸을 쓴다(`startResearch`).
  - 빈 칸이 없고 대기열(§4 아이디어 1)이 있으면 "＋ 대기 (칸 2 다음)"이다. 가장 먼저 끝나는 칸 뒤에 붙인다.
  - 대기열 없이 칸이 차 있으면 "칸 없음"으로 흐리게 보이고, 칸 줄이 깜빡인다.
  - 시작은 되돌릴 수 있으므로(취소해도 진행 보존) 확인 없이 바로 보낸다.
  - 취소는 지금처럼 칸 칩을 두 번 탭(3초)한다.
- **옆 시트**(노드를 고르면).
  - 가로 폰은 오른쪽 280px이다. 캔버스가 고른 노드를 시트 밖으로 끌어 보인다.
  - 태블릿(가로 ≥ 900px이고 높이 > 500px)은 오른쪽 320px에 늘 붙어 있다.
  - 내용: 이름, 연도, 기본 날수, 오늘 속도의 ETA, 앞섬, 적용될 보너스(⚡ 어디서 왔는지, 🤝 몇 개국), 저장된 진행, 효과 줄, 여는 것(장비 세대, 설계 모듈·차대, 대대, 건물, 프로젝트), 선행(✓/✗, 탭하면 이동), 배타 설명, [시작]/[대기]/[취소].
  - 호버로만 보이는 정보는 없다.
- **칸 줄(머리줄)**: [🔬 4/5] [칸 칩 × N] … [자동 ●] [✕].
  - 칸 칩은 compact 72px이다. 고리와 %, 6글자 이름, 남은 날수 또는 앞섬 배지가 들어간다.
  - 자동 연구가 고른 칸은 "A" 표시를 단다.
  - 6칸이면 72 × 6 + 칸 수 칩 56 + 자동 72 + ✕ 36 ≈ 600px로 844px 안에 들어간다.
- **교리 탭.** 육·해·공 카드 3장이다. 대교리 이름, 트랙 3개의 레벨 막대, 숙련 하루 증가가 있고, [교리 화면 열기]는 `WwDepthOpenEvent("doctrine", {tab})`다.
- **특수 프로젝트 탭.** 지금의 `renderProjectsTab` 그대로다. 프로젝트 카드에 "끝나면 열리는 기술"을 한 줄 더한다.
- **화면 읽기 프로그램.** 캔버스 옆에 숨은 목록(노드 이름과 상태)을 두고, 같은 두 번 탭 흐름을 단추로 준다.

#### 그림

**A. 가로 폰 844×390 (compact), 보병 탭**

```
┌────────────────────────────────────────────────────────────────────────────────┐
│🔬4/5 │◔반자동소총 │◑개량어뢰  │◕레이더2   │ ＋ 비어있음│        [자동 ○] [✕]  │ 머리 40
│      │ 12일      │ 40일     │ +35%      │           │                         │
├──────┼─────────────────────────────────────────────────────────────────────────┤
│🔫 보병│ 1936    1937    1938    1939 ┊  1940     1941     1942  ▸1945+   │ 18
│🧰 지원│ ┌─────┐ ┌─────┐            ┊ ┌──────┐          ┌──────┐          │
│🛡 기갑│ │✓보병1│─│✓개량 │────────────┊─│◔반자동│          │보병3  │+45%     │
│💥 포병│ └─────┘ │ 소총 │            ┊ │1940   │          │1942   │          │
│⚓ 해군│         └─────┘   ┌─────┐  ┊ └──────┘   ┌──────┐└──────┘          │
│✈ 공군│ ┌─────┐           │✓보병2│──┊────────────│대전차 │🔒                 │
│📡 공학│ │✓지원1│─┐         └─────┘  ┊            │화기 ↖포│                   │
│🏭 산업│ └─────┘ └─┌─────┐          ┊            └──────┘                   │
│🎓 교리│           │개량지원│ ⏸37%    ┊                                         │
│🧪 계획│           └─────┘          ┊ 오늘           [📍오늘]  [−] [+]     │
└──────┴─────────────────────────────────────────────────────────────────────────┘
  (아래는 기존 도크 40px)
```

**B. 노드를 고른 뒤 (가로 폰, 오른쪽 시트 280px)**

```
┌────────────────────────────────────────────────────┬───────────────────────────┐
│🔬4/5 │◔반자동… │◑개량어… │◕레이더2│＋비어있음 [A○][✕]│ 대전차 화기 (보병 대전차)  │
├──────┼─────────────────────────────────────────────┤ 1941 · 기본 210일          │
│🔫 보병│   1940        1941        1942              │ 오늘 속도로 241일  +45%    │
│🧰 지원│ ┌──────┐   ╔══════╗                         │ ⚡ +100% (중점 ‹보병 개혁›) │
│🛡 기갑│ │◔반자동│   ║대전차 ║◀ 고름                    │ 🤝 +10% (진영 1개국 보유)   │
│💥 포병│ └──────┘   ║화기   ║ ┌────────────┐          │ 효과: 보병 경성 공격 +15%   │
│⚓ 해군│            ╚══════╝ │ ▶ 시작 (칸 4)│ ← 2번째 탭│ 선행: ✓ 보병 장비 2        │
│✈ 공군│                     └────────────┘          │       ✓ 대전차포 1 (포병)   │
│ …    │                                             │ ──────────────────────    │
│      │                                             │ [ ▶ 시작 ]   [ ＋ 대기 ]    │
└──────┴─────────────────────────────────────────────┴───────────────────────────┘
```

**C. 태블릿 1024×768**

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ 🔬 연구   칸 5/6  [기본 3 · 중점 2 · 결정 0]                        [자동 연구 ○] [✕] │
│ ◔ 반자동 소총 12일 │ ◑ 개량 어뢰 40일 │ ◕ 레이더 2 +35% │ ◔ 집중 산업 II │ ＋ 비어 있음     │
├────┬──────────────────────────────────────────────────────────┬──────────────────────┤
│ 보병│ 1936  1937  1938  1939 ┊ 1940  1941  1942  1943  1944     │ (오른쪽 시트 320px:  │
│ 지원│  …                     ┊                                  │  고른 노드의 상세,    │
│ 기갑│  … 8줄이 1배로 다 보임    ┊ 오늘                             │  고르지 않으면 이 탭  │
│ 포병│                        ┊                                  │  요약: 완료 9/21,     │
│ …  │                        ┊                                  │  진행 1, 보너스 2)    │
└────┴──────────────────────────────────────────────────────────┴──────────────────────┘
```

**D. 노드 상태**

```
 완료        진행 중       시작 가능      저장된 진행     대기          선행 부족     배타 잠김     프로젝트 필요
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌┄┄┄┄┄┄┄┐ ┌───────┐ ┌───────┐ ┌───────┐
│✓ 개량  │ │◔ 반자동│ │ 보병 3 │ │ 개량  │ ┆ 개량 ②┆ │🔒 돌격 │ │╲ 분산 │ │🧪 센티 │
│ 소총   │ │1940 12일│ │1942+45%│ │ 어뢰  │ ┆ 야포  ┆ │ 소총  │ │ 산업 ╲│ │ 파레이더│
│ 1937  │ │ ▓▓▓░░ │ │⚡+100% │ │⏸ 37% ▓░│ ┆칸2 다음┆ │ 1944  │ │ 1937  │ │ 1943  │
└───────┘ └───────┘ └───────┘ └───────┘ └┄┄┄┄┄┄┄┘ └───────┘ └───────┘ └───────┘
  초록       파랑+고리    노랑 테두리   노랑+막대     파란 점선    회색 60%     빨간 사선    보라
```

**E. 배타 선택 (산업 탭)**

```
        1937                1940                1943
     ┌──────────┐        ┌──────────┐        ┌──────────┐
  ┌──│ 집중 산업 │────────│ 집중 산업 II│────────│ 집중 산업 III│   출력 +5%씩
  │  └──────────┘        └──────────┘        └──────────┘
 ⇄ 하나만 (먼저 시작한 줄이 남고, 다른 줄은 빨간 사선)
  │  ┌──────────┐        ┌──────────┐        ┌──────────┐
  └──│ 분산 산업 │────────│ 분산 산업 II│────────│ 분산 산업 III│   효율 상한 +3%p, 폭격 피해 −10%씩
     └──────────┘        └──────────┘        └──────────┘
```

**F. 교리 탭**

```
┌ 육군 교리 ───────────────┐ ┌ 해군 교리 ───────────────┐ ┌ 공군 교리 ───────────────┐
│ 대교리: 기동전             │ │ 대교리: 함대 보전          │ │ 대교리: 전장 지원          │
│ 보병  ■■□□□ 2  (+0.4/일)  │ │ 수상  ■□□□□ 1            │ │ 전투기 ■■■□□ 3           │
│ 기갑  ■■■□□ 3            │ │ 호위  □□□□□ 0            │ │ 폭격기 ■□□□□ 1           │
│ 지원  ■□□□□ 1            │ │ 항모  ■□□□□ 1            │ │ 해상  □□□□□ 0            │
│ 완성까지 레벨 합 6/6 ✓     │ │ 2/6                     │ │ 4/6                     │
│ [ 교리 화면 열기 ]         │ │ [ 교리 화면 열기 ]         │ │ [ 교리 화면 열기 ]         │
└──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
  교리는 연구 칸을 쓰지 않고, 싸우고 임무를 돌면 숙련이 쌓인다.
```

#### 데이터
- `WwCountryDetail`에 선택 필드를 더한다. 스냅숏이 아니라 화면용 값이다.

  | 필드 | 내용 |
  |---|---|
  | `speedByBranch` | 갈래별 엔진 속도. 화면 ETA를 엔진과 맞춘다 |
  | `bonuses` | 지금 쥔 research_bonus 목록 |
  | `sharedPct` | 공동 연구 몫이 0보다 큰 기술만, 성긴 목록 |
  | `slotSources` | §3.1 |
  | `projectsDone` | 비트 |

- 선행 그래프와 막기 판단은 `engine-lib`의 순수 함수(`researchBlockOf` 확장, `techGraph`)를 엔진과 화면이 함께 쓴다. 클라이언트는 엔진을 가져오지 않는다.

#### AI와 자동화
- 화면이 AI에 주는 영향은 없다.
- 자동 연구 스위치는 머리줄에 둔다. 켜져 있으면 노드 알약이 "▶ 시작"이다. 누르면 지금처럼 넘겨받기 알림과 함께 자동이 꺼진다. 대기열을 넣으면 꺼지지 않는다(§4 아이디어 1, 결정 5).

#### 마이그레이션
없다. 클라이언트 전용이고, 엔진 쪽은 화면용 상세 필드만 는다. 지금의 카드 목록은 높이 300px 미만의 아주 작은 화면용 대체 보기로 남긴다(같은 모델을 쓴다).

#### 테스트
`tests/client/ww1936/`, jsdom, 캔버스는 중점 테스트처럼 가짜를 쓴다.
- **배치 순수 함수.** 모든 기술이 한 칸에 있고, 겹치지 않고, 연도 칸이 정의 연도와 같고, 줄 수 ≤ 8이다. 선 수는 선행 수와 같다. 다른 탭 꼬리표가 맞다.
- **상태 매핑.** 완료, 진행, 시작 가능, 저장된 진행, 대기, 선행, 배타, 프로젝트를 확인한다.
- **두 번 탭.** 노드 탭 → 알약 탭이면 `research` 명령이 1개 나간다. 칸이 없으면 알약이 막힘이다. 대기열이 있으면 `research_queue`다.
- **compact.** 844×390과 667×375(작은 폰)에서 머리줄 칩이 넘치지 않고, 옆 시트가 280px다. 1024×768에서는 시트가 붙는다.
- **ETA.** 화면 ETA가 엔진 `stepResearch`로 계산한 날수와 같다(국민정신, 갈래, 보너스, 공동 연구가 있는 픽스처).
- **교리 탭.** [교리 화면 열기]가 `WwDepthOpenEvent("doctrine")`를 낸다.
- **i18n.** 모든 새 키가 en/ko에 있고 en은 정렬되어 있다.
- **실제 기기 확인.** `run-openfront` 스킬로 가로 폰 크기에서 손으로 확인한다. 소유자 기기 확인을 권한다.

#### 작업량
M~L, 1인 8~11일이다.

| 일 | 일수 |
|---|---|
| 트리 캔버스 일반화(FocusCanvas에서 뽑기, 중점 화면 회귀 확인) | 2~3 |
| 배치 데이터 234개와 순수 배치 함수 | 2 |
| 패널(머리줄, 왼쪽 탭, 옆 시트, 교리·프로젝트 탭) | 2~3 |
| 상세 필드와 ETA 맞춤 | 1 |
| 테스트와 기기 확인 | 1~2 |

---

## 4. 더 넣을 만한 연구 아이디어 (추천 순)

| 순위 | 아이디어 | 내용 | 노력 | 가치 | 메모 |
|---|---|---|---|---|---|
| 1 | **칸별 대기열(1개)** | 칸마다 다음 기술 하나를 걸어 둔다. 끝나면 그 자리에서 시작한다. 명령 `research_queue {tech}`, `unqueue {slot}`을 덧붙인다 | S~M, 2~3일 | 높음 | 상태 `slot.next`(스냅숏·해시). 대기열 넣기는 자동 연구를 끄지 않는다. 자동 연구는 빈 칸·빈 대기열만 채운다. HOI4에는 기본 대기열이 없는 것으로 안다(확인 필요). 폰의 잔일을 가장 크게 줄인다 |
| 2 | **늦은 기술 따라잡기** | 연도보다 늦은 기술은 1년당 +25%, 최대 +50%(`behindPct`, 정수). 앞섬과 대칭 | S, 0.5~1일 | 높음 | 마이너, AI, 옛 저장의 새 기술을 메운다. HOI4 기본 규칙에는 없는 것으로 안다(확인 필요) |
| 3 | **연구 지원금(보너스 아이템 확장)** | `research_bonus`에 `aheadCutDays`(앞섬을 N일 덜 셈, HOI4식 "앞섬 줄이기")를 더한다. 쥔 보너스를 머리줄 칩으로 보이고, 자동 연구가 보너스 맞는 기술을 먼저 고른다 | S, 1~2일 | 중상 | 지금 보너스 5개는 보이지 않는다. 결정 "연구 지원금"(50 정치력, 고른 갈래 +50% 2회)을 더한다 |
| 4 | **연구 끝 카드** | 기술이 끝나면 "다음 추천 [시작]" 한 번 탭 카드(이벤트 카드 칸이 아닌 작은 토스트) | S, 1일 | 중 | 대기열이 비었을 때만 뜬다 |
| 5 | **노획 기술·설계도 사건** | 더 앞선 나라가 항복하거나 시설이 있는 주를 점령하면, 패자만 가진 기술 최대 2개에 +100% 한 번(시드로 고름) | S~M, 1~2일 | 중 | 한반도·대만 주에서는 절대 나오지 않는다(타격 금지 주에는 시설도 없다). 기존 `op_steal_blueprints`와 같은 효과를 쓴다 |
| 6 | **난이도 연동** | 어려움 AI는 1938-01에 `research_slot +1`. 쉬움 AI는 점수 상위 3개 중 시드로 고른다(덜 매끈한 선택) | S, 1일 | 중 | 사람에게는 붙지 않는다는 규칙을 지킨다. 다이제스트 다시 고정 |
| 7 | **진영 공동 연구를 보이고 AI가 쓰게 하기** | 노드의 🤝 배지(§3.3). 진영 밖 두 나라 사이의 "공동 연구 협정"(25 정치력씩, 둘 다 없는 기술 +10%, 365일) | S / M, 1 / 3일 | 중 | 협정은 외교 화면도 건드린다 |
| 8 | **종합 실험소의 연구 보너스** | `facility_science`가 있는 주마다 연구 +2%, 최대 3개 | S, 1일 | 중 | 지금 시설은 프로젝트에만 쓰인다. 건물 하나에 의미를 더한다 |
| 9 | **과학자 갈래 배치** | 프로젝트에 묶이지 않은 과학자를 갈래에 배치하면 +5 + 3 × 숙련% | M, 2~3일 | 중 | 과학자는 직함만 쓴다(민감성 규칙) |
| 10 | **전투 경험 보너스** | 그 장비로 싸운 날수가 쌓이면 다음 세대 +10~30% | M, 2~3일 | 중 | 판마다 연구 길이 달라진다 |
| 11 | **무제한 판 전후 전환** | 연구할 것이 없으면 빈 칸 하나에 하루 +0.1 정치력 또는 교리 숙련 +0.1 | S, 0.5일 | 하~중 | 무제한 판의 1950년 이후 |
| 12 | **특수 프로젝트 추가** | 예: 계산기 프로젝트(암호 해독 +), 합성 고무 대량 생산 | L, 4~6일 | 중 | P4·P6 균형을 다시 본다 |

추천 순서: 1과 2를 화면 단계에 함께 넣는다. 그다음 3·4, 5·6, 7·8, 9·10, 11, 12다.

---

## 5. 단계와 총 작업량

| 단계 | 내용 | 1인 작업일 | 앞선 단계 | 다이제스트 |
|---|---|---|---|---|
| R0 | 기준 측정: 지금 코드로 econ-sim을 돌려 나라별 칸, 기술 수, 연도별 완료 곡선을 뽑는다(새 테스트 하네스 포함) | 0.5~1 | — | 그대로 |
| R1 | (2) 연구 칸 | 3~4 | R0 | 다시 고정 |
| R2 | (3a) 데이터 모델, 막기, 비용 함수, 지원 갈래, 상세 필드, AI 점수식(기존 126개로 먼저) | 5~7 | R1 | 다시 고정 |
| R3 | (4) 트리 화면 + 아이디어 1(대기열)·2(따라잡기) | 10~14 | R2(상세 필드) | 대기열·따라잡기 때문에 다시 고정 |
| R4 | (3b) 기술 108개 콘텐츠, 읽는 곳, 설계 모듈, 균형 | 11~15 | R2. R3와 나란히 | 다시 고정 |
| R5 | 아이디어 3~6 | 3~5 | R3, R4 | 다시 고정 |
| (선택) | 3b 새 장비(기계화, 로켓 포) | 4~6 | R4 | 다시 고정 |

- **합계.** R0~R5가 1인 32~46일이고, 선택까지 넣으면 36~52일이다.
- **레인으로 나누면.**
  - R1 → R2는 순서대로(약 1.5주) 간다.
  - 그 뒤 R3(화면 레인)과 R4(콘텐츠 레인 2개: 땅 / 바다·하늘·공학·산업)를 나란히 돌린다(약 2주).
  - R5가 1주다.
  - 달력으로 **약 4~4.5주**다. R5를 뒤로 미루고 R3·R4를 세 레인으로 나누면 약 3주까지 줄일 수 있다.
- `speed-rules.md`대로 레인은 집중 테스트 + 타입 검사 + 린트만 돌리고, 묶어서 합칠 때 전체 테스트와 다이제스트 다시 고정을 한 번 한다.
- **각 단계에서 지킬 규칙.**

  | 규칙 | 지키는 법 |
  |---|---|
  | 결정성 | 정수 연산, 시드 굴림(`wwRoll`)만 쓴다. 대기열, 칸 원천, 옛 저장 칸을 스냅숏과 해시에 넣는다. `VanillaDigest`는 바뀌면 안 된다 |
  | 자동화 | 새 장치는 모두 "자동 연구"와 함께 돈다. 꼭 해야 하는 잔일은 없다(결정은 선택, 대기열은 잔일을 줄임) |
  | 역사는 맛 | 칸 결정은 상황 조건이고, 배타와 AI 선택은 시드로 흔든다. 정확한 날짜 맞춤은 없다 |
  | 민감성 | 기술 이름은 일반 명사다. 화학·생물 무기, 가미카제, 한반도·대만 관련 기술·사건·자료가 없다. 원자로는 에너지 기술이다. 과학자는 직함만 쓴다 |
  | 문구 | 모두 `translateText`를 쓰고, `resources/lang/en.json`과 `ko.json`에만 넣는다(`ww1936.tech.<id>`, `ww1936.branch.support`, 화면 키) |
  | 패키지 경계 | 규칙과 정의는 `engine-lib`(`WwTechs`, `EconomyRules`, `EconomyChecks`, `DesignRules`), id·enum은 `engine-api`(덧붙이기만), 상태와 AI는 `engine`(`WwEconomy`, `ResearchRun`, `AiEconomy`), 배치와 캔버스는 `src/client/hud/ww1936`. 클라이언트는 `engine`을 가져오지 않는다 |

---

## 6. 소유자가 정할 것 (5개)

1. **연구 칸 규칙.** 공장 자동 규칙을 없애고, 시작 칸 표(메이저 3, 미국·소련 4, 그 밖 2) + 나라 트리 중점 2 + 일반 결정 "전시 과학 동원" 1, 상한 6으로 갈까?
   - **추천: 예.** 1936년 첫날은 지금과 같고, 1942년쯤 살아 있는 메이저가 모두 6칸이 된다. 폭격으로 칸이 줄던 문제도 사라진다.
   - 다른 길: 상한 7(zbin 바이트 배치가 바뀌고 폰 칸 줄이 넘친다), 또는 공장 규칙을 결정 조건으로만 남기지 않고 그대로 두기.
2. **기술 규모와 완료율.** 234개로 늘려 1945년까지 메이저가 약 45~60%를 여는 HOI4식 "고르기"로 갈까?
   - **추천: 예.** 탭 단위로 나눠 넣는다(땅 4탭 먼저).
   - 다른 길: 약 180개(개량 기술만, 메이저 약 70%) — 작업량 약 60%, 고르는 맛도 약하다.
3. **장비 세대 정책.** 기존 세대를 그대로 두고, 그 사이를 "개량" 능력치 기술과 설계 모듈·차대로 채울까? 새 장비 종류(기계화 보병, 로켓 포)는 3b로 미룰까?
   - **추천: 예.** 재고 배열 마이그레이션 없이 HOI4의 세대 + 개량 구조를 얻는다.
4. **옛 저장.** 옛 혼자 하기 저장을 열 때, 공장으로 얻었던 칸을 "옛 저장 칸"(최대 2)으로 보존하고 새 기술은 그냥 열리게 할까?
   - **추천: 예**(따라잡기 보너스와 함께).
   - 다른 길: 이 개편 이전 저장은 열지 않는다(작업은 적지만 저장 20개를 잃는다).
5. **대기열과 자동 연구.** 칸마다 대기열 1개를 화면 단계(R3)에 함께 넣고, 대기열 넣기는 자동 연구를 끄지 않으며, 자동 연구는 빈 칸·빈 대기열만 채우게 할까?
   - **추천: 예.** "직접 고르면 자동이 꺼진다"는 지금 규칙은 칸에 바로 넣는 `research` 명령에만 남긴다.
