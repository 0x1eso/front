# WW1936 7대 강대국 국가 중점(포커스) 트리 확장 설계안

작성: 2026-10-31 / 대상: DEU GBR FRA ITA JPN SUN USA / 방식: 문서만 (코드 변경 없음)
소유자 결정 반영: 민감성 규칙 폐지(일본 포함 역사 기반 콘텐츠 작성, 학살 미화는 제외하고 HOI4 수준의 전략 게임 서술), 역사는 풍미(역사 경로 + 대안 경로), 인간 플레이어 자동 선택 없음.

---

## 0. 현황 조사 요약 (설계 전제)

- 트리 파일: `packages/engine-lib/src/ww1936/content/focus/{deu,gbr,fra,ita,jpn,sun,usa}.ts`. 현재 49~53개(DEU 53, ITA 50, 나머지 48~49개). 각 파일 끝에 `*_BRANCHES`(BranchPoint: historical/alternatives/political)와 `*_PATH`(AI 역사 경로)가 있다.
- FocusDef 필드: `id, tree, x(0..19), y(0..14), days(35|70|105), branch, icon, prereq(OR의 AND), exclusive, available, bypass, cancelIf, effects, ai{base, mods[{if,factor}]}`. 그리드는 20x15=300칸이라 100개도 수용된다. 다만 현 트리는 x 0~8 정도만 쓰므로 새 가지는 x 9~19에 배치한다.
- `branch`는 7종 고정(politics, diplomacy, industry, research, army, air, navy). 새 "가지"는 enum을 늘리지 않고 기존 7종에 매핑하고, UI 묶음용 `group` 필드는 2절 UI 항목에서 다룬다(★).
- 사용 가능한 효과 종류(PoliticsDsl.ts): add_spirit, remove_spirit, swap_spirit, build, resource, fort, fire_event, pp, equipment, army_xp, navy_xp, set_flag/clear_flag, war_support(stability), stability, opinion, invite, popularity, research_bonus, research_slot, add_tech, design_grant, add_general/remove_general, add_advisor_candidate, unlock_decision, unlock_template, war_goal/remove_war_goal, declare_war, create_faction, leave_faction, switch_sides, separate_peace, make_subject, end_subject, release, annex, annex_occupied, occupation_zone, transfer_regions, transfer_ships, send_equipment, lend_lease, embargo, set_government, set_leader, set_law/law_step, civil_war, uprising, elections, ruling, tension, volunteers, reserve, convoys, manpower, fuel, energy, infra, move_buildings, reparations, cfocus_unlock, if, random_list, set_name, tag, news, intel/agency 계열.
- 조건: flag, date_ge, has_tech, has_doctrine, mastery_level, factories_ge, pp_ge, stability_ge, strength_ratio_ge, threat_ge, war_days_ge, borders_group, owns_group, occupied_by, opinion_ge, congress_above, bop_range, project_done/project_progress, has_atomic, fuel_ratio_below 등. 새 조건은 거의 필요 없다.
- AI(`engine/src/ww1936/politics/AiFocus.ts`, `aiPickFocus`): 역사적 AI가 켜져 있으면 `*_PATH`를 앞에서부터 따라가되 3칸 이상 앞서가지 않는다(WW_BEAT_MAX_SKIP_AHEAD). 경로를 벗어나면 `ai.base * mods`에 branchFactor(전쟁 중 육군 x2, 군수공장 10 미만이면 산업 x1.5, 침략형 성향 육군/외교 x1.5 등)를 곱해 가중 추첨한다. 분기점(BranchPoint)은 게임 시작 때 굴려서 일부 AI가 대안으로 이탈한다. 인간 플레이어는 이 로직과 무관하므로 "자동 선택 없음" 조건은 이미 충족된다.
- 연구 개편으로 각 강대국에 두 번째 research_slot 포커스가 이미 있다(`*_kwi` 등). 모두 유지하고 이름과 id는 건드리지 않는다.
- 페이스: 1936~1945-08은 약 3,500일이라 70일 기준 약 50개 완료. 100개 트리면 절반을 고르게 되며, 이것이 설계 의도다. 따라서 모든 신규 가지는 (a) 서로 시간을 두고 경쟁하고, (b) 한 가지 안에서도 상호배타 갈림길이 있어야 한다.

### 공통 설계 규칙

1. 신규 포커스 id는 `<tag>_<이름>` 소문자 snake. 아래 표는 접두사를 생략하고 `deu_`가 붙는다고 본다(예: `fall_gelb` = `deu_fall_gelb`).
2. 일수: 기본 70, 작은 외교/상징 35, 대형 프로젝트(제트기, 핵, 상륙 등) 105(타입이 이미 허용). 35일짜리를 가지당 1~3개 섞어 페이스 변화를 준다.
3. 갈림길(`exclusive`)은 국가당 2~4개의 큰 갈림길 + 가지 안 작은 갈림길. 정치 갈림길은 `*_BRANCHES`에 `political:true`로 등록, 역사=historical, 대안=alternatives. 새 갈림길은 모두 BranchPoint로 등록해야 AI가 시작 시 굴린다.
4. 효과 표기: `[효과 종류 약칭]`. 새 효과가 필요하면 `★`로 표시(국가당 최대 1~2개, 합계 6개 이내로 억제).
5. 각 신규 가지의 첫 포커스는 기존 포커스(또는 날짜/플래그 조건)에 prereq를 걸고, 마지막 포커스는 보상이 큰 "정점"으로 둔다.
6. 한국어 이름은 `resources/lang/ko.json`, 영어는 `en.json`에 `focus.<id>`와 `focus.<id>.desc` 두 항목씩 추가(CLAUDE.md 규칙: 다른 언어 파일 수정 금지).

---

## 1. 독일 (DEU) — 현재 53개 → 목표 약 103개 (신규 50)

기존 가지: 정치/외교(라인란트, 4개년계획, 로마-베를린, 오스트리아/수데텐 등), 군부 대안(army_misgivings → september_plan → transition → constitution), 산업, 연구, 육군, 공군, 해군(uboats vs battle_fleet), 동방/서방 갈림길(moscow_envoy vs polish_alignment).

### 새 가지 DEU-1. 전쟁 전략 (diplomacy/army, 9개) — 큰 갈림길 1

대전략을 3자택일로 정한다. 3개 중 1개만 가능.

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| war_council | 최고사령부 전략회의 | danzig_question | 35 | - | set_flag war_council, army_xp +, unlock_decision 전략안 |
| fall_gelb | 서방 우선: 낫질 작전 | war_council | 70 | barbarossa_first, med_strategy | war_goal FRA, equipment 전차, fort 아르덴 인접 확장, research_bonus 기갑 |
| barbarossa_first | 동방 우선: 생활권 | war_council | 70 | fall_gelb, med_strategy | war_goal SUN, resource 곡물/석유 요구, unlock_decision 동방 전쟁 준비 |
| med_strategy | 지중해 전략 | war_council + pact_of_steel | 70 | 위 둘 | invite ITA 군사협력, resource 북아프리카 거점, navy_xp |
| channel_assault | 해협 도하 계획(바다사자) | fall_gelb | 105 | - | unlock_template 상륙 사단, build 해안 항구, war_goal GBR |
| winter_equipment | 동계 장비 보급 | barbarossa_first | 35 | - | equipment 방한, add_spirit(전쟁 중 감소 완화) |
| generalplan_economy | 동방 경제구역 | barbarossa_first | 70 | - | resource +, occupation_zone 규칙 완화, tension +(전략 게임 수준의 경제 효과만) |
| africa_corps | 아프리카 군단 | med_strategy | 70 | - | add_general 롬멜, volunteers ITA 전선, army_xp |
| iberian_gambit | 이베리아 구상 | med_strategy | 70 | - | invite SPA, war_goal 지브롤터 지역, opinion SPA + |

### 새 가지 DEU-2. 점령지 행정 (politics, 8개) — 큰 갈림길 1

점령을 "어떻게 다스릴지" 3자택일. 점령지가 생겼을 때만 의미가 있어 `available: owns_group/occupied_by`로 잠근다.

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| occupation_office | 점령행정국 | war_council | 35 | - | set_flag, 점령지 저항 관리 unlock_decision |
| collab_states | 협력 정부 | occupation_office | 70 | reichskomm, extraction | make_subject (괴뢰), resistance -, stability |
| reichskomm | 제국판무관구 | occupation_office | 70 | collab_states, extraction | annex_occupied, resistance +, pp |
| extraction | 경제 징발 | occupation_office | 70 | collab_states, reichskomm | resource +, reparations, resistance + |
| garrison_policy | 점령 수비대 | 위 셋 중 하나(OR) | 70 | - | reserve, manpower -, resistance - |
| volunteer_legions | 외국인 의용군 | collab_states 또는 extraction | 70 | - | volunteers, manpower +, opinion 점령국 - |
| labour_service | 노무 동원 | reichskomm 또는 extraction | 70 | - | factories 가속 [build], stability - |
| new_order_europe | 유럽 신질서 구상 | collab_states | 70 | - | create_faction 확장(invite), 괴뢰 국가 opinion + |

### 새 가지 DEU-3. 총력전 경제 (industry, 8개) — 큰 갈림길 1 (슈페어 vs 괴링)

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| armaments_ministry | 군수부 신설(토트) | war_production | 35 | - | add_advisor_candidate 토트, build 공장 |
| speer_ministry | 슈페어의 합리화 | armaments_ministry | 70 | goering_empire | add_spirit 생산 합리화, equipment 효율 +, stability -  |
| goering_empire | 헤르만 괴링 제국 공장 | armaments_ministry | 70 | speer_ministry | pp +, resource 철강, add_spirit 부패(공장 건설 +, 장비 질 -) |
| total_mobilisation | 총동원 | speer_ministry | 70 | - | manpower +, set_law 전시경제, stability - |
| rail_repair | 철도 복구반 | 위 둘 중 하나 | 35 | - | infra, fuel |
| coal_to_liquid | 석탄액화 증설 | synthetic_fuel | 70 | - | fuel +, build 합성연료 |
| ball_bearing_defence | 베어링 공장 분산 | dispersal | 70 | - | move_buildings, add_spirit 폭격 피해 감소 |
| late_war_standardise | 규격화 | total_mobilisation 또는 goering_empire | 70 | - | equipment 생산비 -, research_bonus 생산 |

### 새 가지 DEU-4. 기갑·교리 심화 (army, 8개) — 작은 갈림길 1

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| panzer_school | 기갑 교육 학교 | panzer_arm | 70 | - | army_xp, research_bonus 기갑 교리 |
| blitz_doctrine | 전격전 교리 | panzer_school | 70 | static_defence | add_tech/doctrine mastery 기동전 |
| static_defence | 거점 방어 교리 | panzer_school | 70 | blitz_doctrine | doctrine 방어전, fort +  |
| heavy_tanks | 중전차 계획 | blitz_doctrine | 70 | standard_tank | design_grant 중전차, equipment 질 + |
| standard_tank | 표준 전차 대량생산 | blitz_doctrine | 70 | heavy_tanks | equipment 수량 +, 생산 효율 + |
| stormtroop_recon | 돌격공병 | static_defence 또는 blitz_doctrine | 35 | - | unlock_template 공병, army_xp |
| volksgrenadier | 국민척탄병 | total_mobilisation 또는 static_defence | 70 | - | manpower, unlock_template 저가 보병 |
| war_college_2 | 군사대학 개혁 | heavy_tanks 또는 standard_tank | 70 | - | add_general, army_xp |

### 새 가지 DEU-5. 제트·특수 프로젝트 (air/research, 9개) — 작은 갈림길 1

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| jet_programme | 제트기 계획(메서슈미트) | luftwaffe + kwi | 105 | - | design_grant 제트전투기, research_bonus 항공 |
| jet_priority | 제트 우선 | jet_programme | 70 | mass_fighters | add_tech 제트, equipment 소량 |
| mass_fighters | 전투기 양산 | jet_programme | 70 | jet_priority | equipment 전투기 +, stability |
| rocket_site | 로켓 연구소(페네뮌데) | kwi | 105 | - | research_slot 임시 아님 -> research_bonus 로켓, design_grant, ★project 시작 효과 |
| flying_bomb | 보복 병기 | rocket_site | 70 | - | unlock_decision 장거리 타격, equipment |
| uranverein | 우라늄 협회 | tech_mobilization | 105 | - | ★project 시작(핵 프로젝트) 또는 research_bonus 핵, resource 중수 |
| radar_net_2 | 카므후버 방어선 | luftwaffe | 70 | - | fort 대공, air 방어 효과 |
| night_fighter | 야간전투기 부대 | radar_net_2 | 35 | - | equipment, air 효과 |
| flak_arm | 대공포 확충 | radar_net_2 | 35 | - | fort, build 대공 |

### 새 가지 DEU-6. 저항·종전 (politics, 8개) — 대안 정치 경로

군부 대안 경로(army_misgivings 계열)와 별개로 "전쟁 중반" 이후 열린다. 조건은 `war_days_ge` 또는 stability 하락 + 패배 징후(`strength_ratio_ge`).

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| resistance_circle | 크라이사우 모임 | army_misgivings 또는 war_days_ge 800 | 35 | - | set_flag, add_advisor_candidate 괴르델러 |
| valkyrie | 발키리 작전 | resistance_circle | 70 | loyalty_oath | set_government (보수/군부), set_leader 벡 계열, 성공/실패 random_list |
| loyalty_oath | 충성 서약 강화 | resistance_circle | 70 | valkyrie | stability +, popularity fascist +, 쿠데타 확률 - |
| western_peace_feelers | 서방과의 타진 | valkyrie | 70 | - | separate_peace(서방), opinion GBR/USA + |
| eastern_stand | 동부 사수 | loyalty_oath | 70 | - | fort +, manpower, stability - |
| army_command_reform | 총참모부 재편 | valkyrie | 70 | - | army_xp, add_general |
| negotiated_end | 협상 종전 | western_peace_feelers | 70 | - | separate_peace, 재건 spirit |
| last_levy | 최후의 징집 | eastern_stand | 35 | - | manpower ++, stability --, war_support + |

### DEU 갈림길 정리(기존 포함 4~6개)

1. 오스트리아 합병 vs 군부 의구심(기존, 정치).
2. 모스크바 vs 폴란드 제휴(기존, 외교).
3. U-보트 vs 전함(기존, 해군).
4. 서방 우선 vs 동방 우선 vs 지중해(신규, 3자택일, `BranchPoint political:false`).
5. 슈페어 vs 괴링 / 점령 정책 3자택일 / 제트 vs 양산(신규).
정치 결과: 발키리 성공 시 `set_government`로 군부-보수 정부, 서방 단독강화 가능(separate_peace), 실패 시 fascist 안정 + 숙청 spirit.

### DEU AI 가중

- 역사 경로: `fall_gelb`(서방) 역사 선택, 제 2순위로 `barbarossa_first` 가 이어짐(역사 경로 PATH에 fall_gelb → ... → barbarossa 순서 삽입). 대안 이탈 AI는 `med_strategy`.
- 비역사 가중: `fall_gelb` base 20, 프랑스와 국경 접촉(`borders_group`)이면 x2, 소련 국경 접촉이면 `barbarossa_first` x2, 영국과 전쟁 중이고 지중해 거점 보유 시 `med_strategy` x2.
- 슈페어/괴링: 공장 30 이상이면 슈페어 x1.5, 그 이전엔 괴링 x1.5 -> 시간에 따라 AI가 대체로 전환. `valkyrie`는 stability < 40 and war_days_ge 1000 에서만 base 15, 기타 base 2.
- 점령지 정책: 역사 AI는 `reichskomm`(서방은 collab_states) 쪽 가중 x1.5.

---

## 2. 영국 (GBR) — 현재 49개 → 목표 약 99개 (신규 50)

기존: 정치 갈림길(appeasement / labour_partnership / imperial_conference 3자택일), 방위 백서, 그림자 공장, 레이더, 함대, 제국 방위 등.

### 새 가지 GBR-1. 제국과 영연방 (diplomacy/politics, 9개) — 갈림길 1

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| statute_commonwealth | 웨스트민스터 규정 이행 | imperial_conference 또는 dominion_call | 35 | - | opinion 자치령 +, set_flag |
| commonwealth_air | 영연방 항공훈련 확대 | air_training_plan | 70 | - | manpower 공군, volunteers |
| indian_question | 인도 문제 | one_empire | 70 | - | unlock_decision 인도 협상 |
| india_reform | 인도 자치 확대(크립스) | indian_question | 70 | india_hold | make_subject 완화/autonomy +, opinion IND +, stability |
| india_hold | 인도 통제 유지 | indian_question | 70 | india_reform | garrison, resistance -, opinion IND - |
| colonial_troops | 식민지 병력 동원 | 위 하나 | 70 | - | manpower +, 자치령 volunteers |
| burma_road | 버마 로드 보급 | china 관련 외교 | 35 | - | send_equipment CHN |
| suez_defence | 수에즈 방어선 | mediterranean | 70 | - | fort, resource 석유 |
| imperial_federation | 제국 연방 구상 | india_reform 또는 statute_commonwealth | 105 | - | tag 연방 정부 강화, 자치령 기여 +, 해체 위험 spirit |

### 새 가지 GBR-2. 전시 정치 경로 (politics, 8개) — 대안 경로(처칠 vs 연립 vs 노동당)

기존 3자택일 위에 얹힌다. 전쟁 시작 후 `war_days_ge`로 열림.

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| churchill_cabinet | 처칠 전시 내각 | war_cabinet | 35 | chamberlain_remain, peace_party | set_leader, war_support ++ |
| chamberlain_remain | 체임벌린 유임 | war_cabinet | 35 | churchill_cabinet, peace_party | stability +, war_support - |
| peace_party | 평화 협상파 | appeasement | 70 | 위 둘 | separate_peace 옵션 unlock_decision, ruling 유지 |
| coalition_domestic | 거국 내각 | churchill_cabinet | 70 | - | stability +, popularity 노동 +, election 유예 [elections] |
| beveridge | 베버리지 보고서 | coalition_domestic | 70 | - | add_spirit 복지, popularity social +, pp - |
| emergency_powers | 비상권한법 | churchill_cabinet | 35 | - | set_law 전시경제, war_support + |
| labour_landslide | 전후를 위한 선거(애틀리) | beveridge | 70 | - | elections, ruling 변경 가능(노동), tension - |
| imperial_war_cabinet | 제국 전시내각 | coalition_domestic | 70 | - | invite 자치령 정책 공유, opinion + |

### 새 가지 GBR-3. 해군·해운 (navy, 8개) — 작은 갈림길

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| asdic_escort | ASDIC 호위 체계 | convoy_system | 70 | - | navy_xp, research_bonus 대잠 |
| escort_carriers | 호위항모 | carriers | 70 | battleship_class | equipment, convoys + |
| battleship_class | 신형 전함(킹 조지 5세급) | home_fleet | 70 | escort_carriers | equipment 전함, navy_xp |
| merchant_building | 상선 대량건조 | clyde | 70 | - | build 조선소, convoys + |
| arctic_convoys | 북극 호송대 | soviet_agreement | 70 | - | lend_lease SUN, convoys |
| naval_bases_med | 지중해 함대 거점 | mediterranean | 70 | - | build, fort |
| combined_ops | 합동작전본부(마운트배튼) | commandos | 70 | - | unlock_template 상륙, army_xp |
| pacific_fleet | 동방함대 증파 | singapore | 70 | - | transfer_ships 극동, navy_xp |

### 새 가지 GBR-4. 폭격·항공·과학 (air/research, 9개) — 갈림길 1(전략폭격 vs 전술항공)

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| bletchley | 블레츨리 파크 | scientific_committee | 70 | - | intel_network, add_spirit 암호해독, research_bonus |
| tizard_mission | 티저드 사절단 | atlantic_bridge 또는 university_research | 35 | - | opinion USA +, research_bonus 레이더/제트 |
| area_bombing | 지역 폭격 | bomber_command | 70 | tactical_air | equipment 중폭, 효과 폭격 |
| tactical_air | 전술 항공군 | fighter_command | 70 | area_bombing | equipment 전술, 지상 지원 |
| jet_engine | 휘틀 제트엔진 | tizard_mission | 105 | - | design_grant 제트, research_bonus |
| radar_h2s | 항법 레이더 | radar_chain | 70 | - | research_bonus, air 효과 |
| tube_alloys | 튜브 앨로이즈(핵 계획) | university_research | 105 | - | ★project 시작 또는 research_bonus 핵, 미국 협력 flag |
| quebec_agreement | 퀘벡 협정 | tube_alloys + atlantic_bridge | 35 | - | opinion USA +, 핵 공동 flag |
| special_ops_exec | 특수작전집행부 | commandos | 70 | - | unlock_decision 점령지 저항 지원, resistance |

### 새 가지 GBR-5. 육군 개혁과 전구 (army, 8개) — 갈림길 1

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| army_command_2 | 육군 사령부 개편 | bef | 70 | - | add_general(몽고메리), army_xp |
| infantry_tank | 보병전차 우선 | armoured_division | 70 | cruiser_tank | equipment, 방어 doctrine |
| cruiser_tank | 순항전차 우선 | armoured_division | 70 | infantry_tank | equipment 기동 |
| desert_rats | 사막의 쥐 | desert_training | 70 | - | army_xp, 북아프리카 volunteers |
| burma_campaign | 버마 전역 훈련 | india_defence | 70 | - | army_xp 정글 |
| airborne_division | 공수사단 | commandos | 70 | - | unlock_template 공수 |
| mulberry | 멀버리 항구 | combined_ops | 105 | - | build 상륙 항구, 상륙 보너스 |
| second_front | 제2전선 준비 | mulberry + atlantic_bridge | 70 | - | war_goal 대륙 해방, army_xp |

### 새 가지 GBR-6. 전쟁 경제와 전후 (industry, 8개)

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| bevin_boys | 노동력 배치(베빈) | total_production | 35 | - | manpower 공장, stability - |
| women_service | 여성 노동 동원 | total_production | 70 | - | build 공장, manpower |
| rationing | 배급제 | emergency_powers 또는 total_production | 70 | - | resource, stability - |
| canada_lend | 캐나다 상호원조 | dominion_call | 70 | - | resource 철강, opinion CAN |
| destroyers_for_bases | 구축함-기지 협정 | atlantic_bridge | 35 | - | lend_lease 수령, transfer_ships |
| fuel_pipeline | 연료관(PLUTO) | mulberry 또는 total_production | 70 | - | fuel |
| lend_lease_acceptance | 무기대여 수령 | destroyers_for_bases | 70 | - | lend_lease, 장비 |
| postwar_planning | 전후 재건 계획 | beveridge 또는 total_production | 70 | - | stability, tension - |

### GBR 갈림길 총 4~6개

기존 3자택일(appeasement/labour/imperial) + 처칠 3자택일 + 인도 개혁 vs 통제 + 전략폭격 vs 전술항공 + 항모 vs 전함 + 보병전차 vs 순항전차. 정치 결과: 평화파 선택 + 패배 시 separate_peace, 노동당 승리 시 ruling 변경과 전후 복지.

### GBR AI 가중

- 역사 경로: appeasement → ... → churchill_cabinet(전쟁 개시 후) → ... 역사적 AI는 churchill_cabinet 가중 x3.
- 비역사: 독일과 전쟁 중이고 본토가 위협받으면(`threat_ge`) `peace_party` 가중 x0.5, 자원/자치령 없음 시 `india_hold` x2. 프랑스가 패배(점령)하면 `second_front` base 상승 x2.
- 폭격 vs 전술: 대륙 거점 없는 동안 `area_bombing` x1.5, 대륙 거점 보유 시 `tactical_air` x2.

---

## 3. 프랑스 (FRA) — 현재 49개 → 목표 약 99개 (신규 50)

기존: 인민전선/국민연합/강력행정부 3자택일, 마지노 확장 vs 기동 예비, 자유프랑스 가지(june_appeal 등) 등.

### 새 가지 FRA-1. 1940년의 갈림길 (politics/army, 9개) — 큰 갈림길

패전 시나리오와 항전 시나리오를 상황에 따라 선택한다. 조건: `war_days_ge`/`strength_ratio_ge` 와 `occupied_by`.

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| gamelin_plan | 가믈랭 계획(딜 작전) | mobile_reserve 또는 maginot_extension | 35 | - | set_flag, army_xp |
| weygand_reorg | 웨이강 재편 | gamelin_plan | 70 | - | add_general 웨이강, reserve |
| redoubt_breton | 브르타뉴 보루 | weygand_reorg | 70 | armistice_path | fort, resistance 대비 flag |
| armistice_path | 휴전 | weygand_reorg | 35 | redoubt_breton, north_africa_move | separate_peace (독일), set_government (비시 체제) [set_government 비시/권위주의] |
| north_africa_move | 북아프리카 이전 | weygand_reorg | 70 | armistice_path, redoubt_breton | transfer_regions 정부 이전(exile 계열: exile_host), add_spirit 정부 이전 |
| vichy_state | 프랑스 국가(비시) | armistice_path | 70 | - | ruling 권위주의, popularity, add_spirit |
| national_revolution | 국민혁명 | vichy_state | 70 | - | stability +, popularity fascist/authoritarian +, set_law |
| collaboration_policy | 대독 협력 | vichy_state | 70 | neutral_vichy | opinion DEU +, volunteers 독일 전선, resource 공출 |
| neutral_vichy | 중립 비시 | vichy_state | 70 | collaboration_policy | stability, opinion GBR/USA -, fleet scuttle 방지(scuttle_fleet 조건 대비 flag) |

(armistice_path 이하는 `available: occupied_by DEU 또는 war_days_ge`로 제한; AI 로드 시 역사에서 "패전" 분기 BranchPoint로 등록. 성공 방어(redoubt)는 대안.)

### 새 가지 FRA-2. 자유프랑스·저항·해방 (politics/diplomacy, 9개)

기존 june_appeal 등과 연결해 확장한다.

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| free_french_navy | 자유프랑스 해군 | free_french_forces | 70 | - | transfer_ships 합류, navy_xp |
| central_africa_rally | 중부 아프리카 합류 | rally_the_empire | 70 | - | resource, make_subject 완화 |
| levant_front | 레반트 전선 | levant_bases | 70 | - | army_xp, war_goal 비시 구역 |
| national_council | 국민위원회(물랭) | resistance_council | 70 | - | resistance, add_advisor_candidate 물랭 |
| maquis | 마키 | national_council | 70 | - | uprising 대비, resistance + (점령지) |
| giraud_de_gaulle | 지로-드골 협정 | liberation_government | 35 | - | stability +, opinion USA/GBR + |
| leclerc_division | 르클레르 사단 | free_french_forces | 70 | - | unlock_template, add_general 르클레르 |
| liberation_of_paris | 파리 해방 | leclerc_division + maquis | 105 | - | war_goal 본토, annex_occupied 정당화 |
| fourth_republic | 제4공화국 | liberation_government | 70 | - | ruling 민주, elections, stability |

### 새 가지 FRA-3. 정치 대안: 우익 연맹 vs 좌익 연립 (politics, 8개)

1936년 국내 정치 경로의 대안.

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| matignon | 마티뇽 협정 | popular_front | 35 | - | stability +, factories - (40시간제), popularity social + |
| forty_hours_relief | 40시간제 완화 | matignon | 70 | - | pp, factories +, popularity - |
| leagues_ban | 우익 동맹 해산 | popular_front | 70 | leagues_in_government | uprising 위험 -, popularity fascist - |
| front_commune | 공동전선 | matignon | 70 | strong_state_path | popularity communist +, invite SUN opinion |
| strong_state_path | 강한 국가 노선 | strong_executive | 70 | front_commune | ruling 권위주의 경향, stability + |
| popular_front_spain | 스페인 공화파 지원 | popular_front | 70 | non_intervention 채택 안 한 경우 | send_equipment, volunteers |
| constitution_reform | 헌법 개정 | strong_state_path | 70 | - | set_law, elections 연기 |
| industrial_unions | 노조-경영 협약 | forty_hours_relief | 70 | - | stability, factories |

### 새 가지 FRA-4. 군 개혁·전차·공군 (army/air, 8개) — 갈림길 1

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| char_b | 샤르 B1 중전차 | tank_programme | 70 | somua_light | equipment 중전차 |
| somua_light | 소뮈아 S35 기동전차 | tank_programme | 70 | char_b | equipment 기동 |
| radio_everywhere | 전차 무전기 보급 | char_b 또는 somua_light | 70 | - | research_bonus 기동, army_xp |
| anti_tank_guns | 대전차포 확충 | army_reorganisation | 35 | - | equipment, fort |
| fighter_dewoitine | 드와틴 D.520 | modern_fighters | 70 | - | equipment 전투기 |
| air_force_unified | 공군 지휘 통합 | air_force_plan | 70 | - | army_xp, add_spirit |
| paratrooper_fr | 낙하산 부대 | alpine_troops | 35 | - | unlock_template 공수 |
| rapid_mobilisation | 신속 동원 체계 | mobilisation_readiness | 70 | - | manpower, reserve |

### 새 가지 FRA-5. 식민지·지중해 (diplomacy/navy, 8개) — 갈림길 1

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| indochina_decolonise | 인도차이나 자치 | indochina_defence | 70 | indochina_hold | autonomy +, stability, opinion VNM/지역 + |
| indochina_hold | 인도차이나 방위 강화 | indochina_defence | 70 | indochina_decolonise | fort, garrison |
| algeria_settlers | 알제리 개발 | army_of_africa | 70 | - | resource, build |
| tunisia_front | 튀니지 방벽 | algeria_settlers | 70 | - | fort |
| med_squadron | 지중해 함대 | mers_el_kebir_base | 70 | - | navy_xp, ships |
| channel_flotilla | 영불해협 합동 | no_munich 또는 neutral_france 아님 | 70 | - | opinion GBR +, invite 군사협력 |
| polish_alliance_renew | 대폴란드 동맹 갱신 | eastern_alliances | 35 | - | opinion POL +, send_equipment |
| little_entente | 소협상 재건 | eastern_alliances | 70 | - | invite 소협상 국가, create_faction 옵션 |

### FRA 연구/산업 (research/industry, 8개 이상은 위에 포함) — 보충 4개

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| heavy_water_2 | 중수 비축(졸리오) | heavy_water | 70 | - | research_bonus 핵, resource |
| radar_france | 레이더 연구소 | research_centre | 70 | - | research_bonus |
| arsenal_dispersal_2 | 병기창 이전 | southwest_dispersal | 70 | - | move_buildings |
| colonial_rubber | 식민지 고무/보크사이트 | colonial_minerals | 35 | - | resource |

### FRA 갈림길 총 4~6개

기존 3자택일(popular_front/national_union/strong_executive) + 마지노 vs 기동 + 휴전 vs 보루 vs 이전 (3자택일) + 비시 협력 vs 중립 + 인도차이나 자치 vs 유지 + 중전차 vs 기동전차. 정치 결과: 비시 정부 수립 시 `set_government`(권위주의, 독일과 관계), 자유프랑스 경로는 `exile_host`와 resistance로 연결, 해방 시 제4공화국.

### FRA AI 가중

- 역사 경로: 1940년 시나리오에서 독일과 전쟁에 지고 `occupied_by DEU`가 되면 `armistice_path` base 40(역사 경로). 패전하지 않은 AI는 `redoubt_breton` x2.
- 해외 거점이 있고 `strength_ratio_ge` 낮음이면 `north_africa_move` x1.5. 영국과 우호도 높으면 이전 쪽, 낮으면 휴전 쪽으로 보정.
- 좌/우 경로: ruling이 좌파면 `matignon`/`front_commune` x2, 우파면 `leagues_*`/`strong_state_path` x2.

---

## 4. 이탈리아 (ITA) — 현재 50개 → 목표 약 100개 (신규 50)

기존: 에티오피아 후 제국 통합, 축 동맹 vs 스트레사 복원, 크라운 평의회/그랜드 카운슬/무장 중립, 마레 노스트룸, 해군(잠수함 vs 항모) 등.

### 새 가지 ITA-1. 지중해 전쟁 (navy/army, 9개) — 갈림길 1

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| malta_question | 몰타 문제 | sicilian_narrows | 35 | - | war_goal 몰타, set_flag |
| malta_assault | 몰타 공략 | malta_question | 105 | malta_siege | unlock_template 상륙, war_goal, army_xp |
| malta_siege | 몰타 봉쇄 | malta_question | 70 | malta_assault | navy_xp, convoys 차단 효과 |
| taranto_defence | 타란토 방어 | dodecanese_bases | 70 | - | fort, build 항만 |
| cape_matapan_prep | 대함 훈련 | battleship_programme | 70 | - | navy_xp |
| human_torpedo | 인간어뢰(X MAS) | submarine_arm | 35 | - | unlock_template 특수, navy_xp |
| suez_push | 수에즈 진격 | libyan_road + suez_question | 70 | - | war_goal 이집트 방면, equipment |
| tobruk_line | 토브룩 전선 | desert_doctrine | 70 | - | fort, army_xp |
| nile_ambition | 나일 진격 | suez_push | 70 | - | war_goal, resource 석유 |

### 새 가지 ITA-2. 파시즘의 향방 (politics, 9개) — 큰 갈림길(체제 유지 / 왕당 전환 / 사회공화)

기존 crown 가지의 확장. 패전 징후에서 열린다.

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| corporative_state | 협동조합 국가 | empire_consolidation | 70 | - | stability, add_spirit, popularity fascist |
| fascist_syndicates | 파시스트 노조 | corporative_state | 70 | - | pp, factories |
| grand_council_vote | 대평의회 투표(7월 25일) | crown_council 또는 war_days_ge 600 | 35 | - | set_flag, stability - |
| badoglio_govt | 바돌리오 정부 | grand_council_vote | 70 | salo_republic | set_leader 바돌리오, set_government (보수/군부) |
| salo_republic | 이탈리아 사회공화국 | grand_council_vote | 70 | badoglio_govt | civil_war 가능(독일 후원), set_name |
| armistice_cassibile | 카시빌레 휴전 | badoglio_govt | 35 | - | separate_peace 또는 switch_sides, ruling 변경 |
| co_belligerent | 공동 교전국 | armistice_cassibile | 70 | - | switch_sides, opinion GBR/USA + |
| partisan_war | 파르티잔 전쟁 | salo_republic 또는 co_belligerent | 70 | - | resistance, uprising |
| republic_referendum | 공화국 국민투표 | co_belligerent | 70 | - | elections, ruling 민주 |

### 새 가지 ITA-3. 에티오피아 이후 식민 경영과 발칸 (diplomacy, 8개) — 갈림길 1

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| aoi_roads | 동아프리카 도로망 | empire_consolidation | 70 | - | infra, resource |
| aoi_garrison | 동아프리카 수비대 | aoi_roads | 70 | aoi_autonomy | garrison, resistance - |
| aoi_autonomy | 현지 자치 | aoi_roads | 70 | aoi_garrison | autonomy +, stability |
| libya_colonisation | 리비아 이주 사업 | libyan_road | 70 | - | build, manpower |
| albania_union | 알바니아 합병 | albanian_question | 70 | albania_protectorate | annex, war_goal |
| albania_protectorate | 알바니아 보호국 | albanian_question | 35 | albania_union | make_subject |
| greece_ultimatum | 그리스 최후통첩 | balkan_sphere | 70 | - | war_goal GRE, tension |
| adriatic_zone | 아드리아 영향권 | balkan_sphere | 70 | - | opinion 발칸 +, invite |

### 새 가지 ITA-4. 육군·공군 현대화 (army/air, 9개) — 갈림길 1

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| bersaglieri | 베르사글리에리 | motorised_divisions | 35 | - | unlock_template |
| semovente | 자주포 우선 | armoured_divisions | 70 | m_series_tank | equipment 자주포 |
| m_series_tank | M형 전차 | armoured_divisions | 70 | semovente | equipment 전차 |
| artillery_arm | 포병 현대화 | army_reform | 70 | - | equipment, doctrine |
| folgore | 폴고레 공수사단 | alpini | 70 | - | unlock_template 공수 |
| macchi_series | 마키 C.202 | fighter_modernisation | 70 | - | equipment 전투기 |
| savoia_bombers | 사보이아 폭격기 | regia_aeronautica | 70 | - | equipment 폭격 |
| aerial_torpedo | 항공어뢰 전술 | torpedo_bombers | 70 | - | navy_xp, air 효과 |
| volunteer_corps | 해외 의용군단 | spain_expedition | 70 | - | volunteers, army_xp |

### 새 가지 ITA-5. 경제·자립 (industry/research, 8개) — 갈림길 1(자립 vs 독일 의존)

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| battle_for_grain | 곡물 전투 | autarky | 35 | - | resource 식량, stability |
| bonifica | 간척·개간 | battle_for_grain | 70 | - | build, manpower |
| german_coal | 독일 석탄 의존 | axis_war_economy | 70 | autarky_push | resource 석탄 +, opinion DEU +, 위험 spirit |
| autarky_push | 자급 강화 | autarky | 70 | german_coal | resource 국내, pp - |
| rationalise_fiat | 피아트 합리화 | motor_industry | 70 | - | equipment 효율, factories |
| ansaldo_yards | 안살도 조선소 | northern_arsenal | 70 | - | build 조선소 |
| marconi_radar | 마르코니 레이더 | research_council | 70 | - | research_bonus |
| fermi_group | 로마 물리학 그룹 | university_labs | 105 | - | research_bonus 핵, 이민 위험 flag(이후 USA 연구 보너스 이벤트 가능) |

### 새 가지 ITA-6. 외교 노선 (diplomacy, 7개) — 갈림길 1(독일 편 vs 중립 vs 연합국)

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| four_power_pact | 4국 협정 | stresa_revival | 70 | - | opinion GBR/FRA +, tension - |
| mediterranean_pact | 지중해 협정 | western_reconciliation | 70 | - | opinion, 무역 |
| vatican_concordat | 교황청 관계 | corporative_state | 35 | - | stability +, popularity |
| danube_diplomacy | 다뉴브 외교 | brenner_watch | 70 | - | opinion AUT/HUN + |
| axis_staff_talks | 축 참모협의 | steel_pact | 70 | allied_overtures | opinion DEU +, army_xp |
| allied_overtures | 연합국 접근 | western_reconciliation | 70 | axis_staff_talks | opinion GBR/FRA +, 축 이탈 준비 |
| balkan_spheres | 발칸 분할 협상 | axis_staff_talks | 70 | - | war_goal |

### ITA 갈림길 총 5~6개

기존(축 vs 스트레사, 그랜드 카운슬 vs 무장중립, 잠수함 vs 항모) + 몰타 공략 vs 봉쇄 + 바돌리오 vs 살로 + 알바니아 합병 vs 보호국 + 자립 vs 독일 의존 + 축 참모 vs 연합국 접근.

### ITA AI 가중

- 역사: steel_pact 후 `parallel_war` → 7월 25일(`grand_council_vote`) 전후에 `badoglio_govt` (역사). 패전이 가까운 AI는 `armistice_cassibile` 쪽 base 30. 독일이 근처에서 강하면 `salo_republic` 비중 높임(`strength_ratio_ge`로 판단).
- 대안 AI: 서방과 우호도가 높으면 `allied_overtures` x2.

---

## 5. 일본 (JPN) — 현재 49개 → 목표 약 99개 (신규 50)

기존: 군부 장관제 vs 정당 내각, 북진 vs 남진, 반공협정/삼국동맹, 괴뢰 정부(몽강·난징), 항모 vs 전함 등. 민감성 규칙 폐지에 따라 한자 문화권 식민 역사·점령은 HOI4 수준의 전략 서술로만 다룬다.

### 새 가지 JPN-1. 내부 정치 (politics, 9개) — 큰 갈림길 2개

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| kodoha_faction | 황도파 | after_february | 35 | control_faction | set_flag, popularity fascist +, stability - |
| control_faction | 통제파 | after_february | 35 | kodoha_faction | stability +, add_spirit 관료 통제 |
| taisei_yokusankai | 대정익찬회 | new_order | 70 | party_revival | set_law 일당화, ruling 강화, popularity |
| party_revival | 정당 정치 복원 | party_cabinet | 70 | taisei_yokusankai | elections, ruling 민주 경향 |
| tojo_cabinet | 도조 내각 | military_ministers | 35 | konoe_cabinet2 | set_leader, war_support + |
| konoe_cabinet2 | 고노에 내각 유지 | military_ministers | 35 | tojo_cabinet | stability, 협상 opinion USA + |
| imperial_conference | 어전회의 | tojo_cabinet 또는 konoe_cabinet2 | 35 | - | set_flag, unlock_decision 개전 결정 |
| surrender_faction | 종전파 | party_revival 또는 war_days_ge 1000 | 70 | last_stand | separate_peace 조건, set_leader 스즈키 |
| last_stand | 본토 결전 | tojo_cabinet | 70 | surrender_faction | manpower ++, stability --, war_support + |

### 새 가지 JPN-2. 대륙 정책 (diplomacy/army, 9개) — 갈림길 1(만주 집중 / 중국 확전 / 협상)

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| manchuria_development | 만주 5개년 계획 | manchukuo_industry | 70 | - | build, resource |
| kwantung_autonomy | 관동군 독자 노선 | kwantung_reinforcement | 70 | - | army_xp, stability - |
| china_incident | 노구교 사건 대응 | north_china_question | 35 | china_settlement 선택 시 불가 | war_goal CHN, 확전 flag |
| china_localise | 전쟁 국지화 | china_incident | 70 | china_escalate | tension -, stability |
| china_escalate | 전면전 확대 | china_incident | 70 | china_localise | war_goal 확대, army_xp, equipment 소모 |
| nanjing_gov | 난징 정부 지원 | china_escalate | 70 | - | make_subject (괴뢰), resistance |
| pacification_policy | 점령지 안정화 | china_escalate | 70 | - | resistance -, garrison |
| north_defence_pact | 북방 방위 | far_east 계열(soviet_neutrality_talks 아닌 경우) | 70 | - | fort, army_xp |
| neutrality_pact | 일소 중립조약 이행 | soviet_neutrality_talks | 35 | - | tension SUN -, opinion SUN + |

### 새 가지 JPN-3. 남진과 대동아 (diplomacy/navy, 9개) — 갈림길 1(공세 / 외교 / 석유 협상)

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| southern_resources | 남방 자원 지대 | strike_south | 70 | - | resource 석유/고무, war_goal |
| oil_negotiation | 석유 금수 협상 | indochina_bases 또는 konoe_cabinet2 | 70 | pearl_harbor_plan | opinion USA +, embargo 완화 |
| pearl_harbor_plan | 진주만 계획 | hawaii_operation 선행 | 105 | oil_negotiation | declare_war USA 옵션, equipment |
| malaya_campaign | 말레이 작전 | southern_resources | 70 | - | war_goal GBR 영역, army_xp |
| philippines_op | 필리핀 침공 | pearl_harbor_plan | 70 | - | war_goal PHI/USA, army_xp |
| east_indies | 네덜란드령 동인도 | southern_resources | 70 | - | war_goal NED, resource |
| coprosperity_sphere | 대동아공영권 | malaya_campaign 또는 east_indies | 70 | - | create_faction/invite 아시아 국가, make_subject 괴뢰 |
| independence_burma | 아시아 독립 지원 | coprosperity_sphere | 70 | - | make_subject 완화, opinion + (전략상의 현지 정부) |
| resource_convoys | 자원 수송대 | southern_resources | 70 | - | convoys, resource |

### 새 가지 JPN-4. 군사 교리 (army/air/navy, 12개) — 갈림길 2

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| spirit_over_matter | 정신력 교리 | army_modernisation | 70 | firepower_doctrine | add_spirit, manpower, army_xp |
| firepower_doctrine | 화력 우선 교리 | army_modernisation | 70 | spirit_over_matter | equipment, doctrine |
| banzai_defence | 도서 거점 방어 | garrison_units | 70 | - | fort 섬, army_xp |
| amphibious_arm | 상륙전 교리 | naval_landing_force | 70 | - | unlock_template, army_xp |
| zero_fighter | 제로센 | naval_air_arm | 70 | - | equipment, 항공 우위 |
| night_battle | 야간 해전 교리 | outer_perimeter | 70 | - | navy_xp |
| long_lance | 산소어뢰 | submarine_fleet | 70 | - | research_bonus 해군 |
| carrier_decisive | 결전 함대 | carrier_strike_force | 70 | - | navy_xp, equipment |
| yamato_class | 야마토급 | battleship_priority | 105 | - | equipment 전함 |
| kamikaze_corps | 특공 부대 | last_stand 또는 war_days_ge 1200 | 70 | - | manpower, 함선 타격, stability - (서술은 전술 수준, 미화하지 않음) |
| army_air_reform | 육군 항공대 재편 | army_air_service | 70 | - | equipment |
| jet_attempt | 제트 개발 시도 | science_mobilisation | 105 | - | design_grant 제트, research_bonus |

### 새 가지 JPN-5. 경제·과학 (industry/research, 8개)

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| zaibatsu_coop | 재벌 협력 | heavy_industry | 70 | state_control | pp, factories |
| state_control | 국가 통제 경제 | heavy_industry | 70 | zaibatsu_coop | set_law, stability - |
| rare_materials | 희소자원 확보 | synthetic_oil | 70 | - | resource |
| merchant_marine | 상선단 건조 | shipbuilding | 70 | - | convoys, build |
| nuclear_nishina | 니시나 핵연구 | science_mobilisation | 105 | - | research_bonus 핵, ★project 시작(또는 flag) |
| radar_jpn | 레이더 개발 | radio_weapons | 70 | - | research_bonus |
| tech_exchange_axis | 축 기술 교류 | tripartite | 70 | - | research_bonus, opinion DEU + |
| fuel_rationing | 연료 배급 | fuel_reserve | 35 | - | fuel, stability - |

### JPN 갈림길 총 5~7개

기존(군부 vs 정당, 북진 vs 남진, 항모 vs 전함, 난징·몽강 지원 등) + 황도파 vs 통제파 + 대정익찬회 vs 정당 복원 + 도조 vs 고노에 + 국지화 vs 확대 + 석유 협상 vs 진주만 + 본토 결전 vs 종전파 + 정신력 vs 화력.
정치 결과: 정당 복원 시 `ruling` 민주 경향으로 서방 접근(leave_axis 연결), 종전파 승리 시 separate_peace 조건.

### JPN AI 가중

- 역사 경로: 군부 장관제 → 통제파 → 중일 확대 → 남진 → 진주만. 역사적 AI는 `china_escalate`, `pearl_harbor_plan` 에 x2.
- 대안: 미국 금수(자원 부족, `fuel_ratio_below`)가 심하면 `oil_negotiation` x1.5, 전쟁이 장기화(`war_days_ge`)되면 `surrender_faction` base 상승 x(1+ 일수/500), 단 본토 위협이 높으면 `last_stand` x2.

---

## 6. 소련 (SUN) — 현재 49개 → 목표 약 99개 (신규 50)

기존: 대숙청 vs 군 개혁파, 독일 조약 vs 서방 동맹, 5개년 계획 연쇄, 심층전, 전차 공장, 동원 등.

### 새 가지 SUN-1. 당 내부 노선 (politics, 9개) — 큰 갈림길(스탈린 노선 / 집단지도 / 대안)

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| socialism_one_country | 일국사회주의 강화 | new_constitution | 35 | permanent_revolution | stability +, opinion 서방 - |
| permanent_revolution | 세계혁명 노선 | new_constitution | 70 | socialism_one_country | popularity communist +, comintern 확대, tension + |
| show_trials | 모스크바 재판 | great_purge | 35 | - | stability -, army_xp - |
| nkvd_control | 내무인민위원부 장악 | great_purge | 70 | party_collective | pp, resistance 국내 - |
| party_collective | 당 집단 지도 강화 | collective_leadership | 70 | nkvd_control | stability +, 군 기반 |
| rehabilitation | 재복권 | purge_ends | 70 | - | army_xp +, add_general 복귀 |
| bukharin_nep | 신경제 노선(NEP 재도입) | moderate_economy | 70 | forced_industrialise | pp 소비재, factories -, stability + |
| forced_industrialise | 급속 공업화 | second_fyp | 70 | bukharin_nep | factories +, stability - |
| zhdanov_cultural | 문화 통제 | nkvd_control 또는 socialism_one_country | 35 | - | popularity, research_bonus - |

### 새 가지 SUN-2. 외교·세력권 (diplomacy, 9개) — 갈림길 1(독소 협정 / 서방 / 고립)

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| baltic_bases | 발트 기지 요구 | spheres | 70 | - | war_goal 발트, opinion - |
| poland_partition | 폴란드 분할 | german_treaty | 70 | - | war_goal POL, transfer_regions |
| bessarabia_demand | 베사라비아 요구 | german_treaty | 35 | - | war_goal ROM, tension |
| finland_winter | 겨울 전쟁 준비 | finland_demands | 70 | finland_treaty | war_goal FIN, army_xp |
| finland_treaty | 핀란드 우호조약 | finland_demands | 35 | finland_winter | opinion FIN +, tension - |
| tehran_conference | 테헤란 회담 | allied_cooperation | 35 | - | opinion GBR/USA +, lend_lease |
| lend_lease_soviet | 무기대여 수령 | allied_cooperation | 70 | - | lend_lease, 장비 |
| cominform_bloc | 동유럽 영향권 | tehran_conference | 70 | - | make_subject, invite 공산 국가 |
| yalta_terms | 알타 합의 | tehran_conference | 70 | - | war_goal JPN 참전 조건, tension |

### 새 가지 SUN-3. 대조국전쟁과 동원 (army, 10개) — 갈림길 1

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| scorched_earth | 초토화 전술 | stalin_line | 70 | defence_in_depth | resource 파괴 flag, move_buildings, stability - |
| defence_in_depth | 종심 방어 | stalin_line | 70 | scorched_earth | fort +, army_xp |
| partisan_movement | 빨치산 | scorched_earth 또는 defence_in_depth | 70 | - | resistance (점령지), uprising |
| stavka_control | 스타프카 통제 | commander_rebuild | 70 | - | add_general 주코프, army_xp |
| commissar_orders | 정치위원 제도 | great_purge 경유 | 35 | commissar_abolish | stability -, war_support |
| commissar_abolish | 정치위원 폐지 | commander_rebuild | 35 | commissar_orders | army_xp +, stability |
| shock_armies | 충격군 | guards | 70 | - | unlock_template, army_xp |
| tank_armies | 전차군 | mech_corps | 70 | - | unlock_template 전차, equipment |
| rocket_artillery | 카튜샤 | design_bureaus | 70 | - | equipment 로켓포 |
| operation_bagration | 작전 바그라티온 | tank_armies + shock_armies | 105 | - | war_goal 해방, army_xp ++ |

### 새 가지 SUN-4. 전시 산업과 이전 (industry, 8개)

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| evacuate_east | 공장 동쪽 이전 | evacuation | 70 | - | move_buildings, 일시 pp - |
| tankograd | 탱코그라드 | tank_works + ural_base | 70 | - | build 전차 공장, equipment |
| siberian_oil | 시베리아 석유 | baku | 70 | - | resource 석유, fuel |
| arctic_ports | 북극 항구(무르만스크) | allied_cooperation | 70 | - | convoys, lend_lease |
| gulag_labour | 수용소 노동 | forced_industrialise 또는 nkvd_control | 70 | - | factories +, stability --, 경제 spirit (HOI식 경제 서술) |
| kolkhoz_grain | 집단농장 곡물 | moderate_economy | 70 | - | resource 식량 |
| war_economy_plan | 전시경제 계획 | mass_mobilisation | 70 | - | factories, pp |
| rail_gauge | 철도 확충 | railways | 70 | - | infra |

### 새 가지 SUN-5. 공군·해군·과학 (air/navy/research, 9개)

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| il2_sturmovik | Il-2 슈투르모비크 | ground_attack | 70 | - | equipment |
| yak_fighters | 야크/라보치킨 전투기 | red_air_force | 70 | - | equipment |
| long_range_aviation | 장거리 폭격 | red_air_force | 70 | - | equipment 중폭 |
| coastal_defence | 연안 방어 | ocean_fleet 아님 | 35 | ocean_fleet 우선 시 선택 | fort 해안, ships |
| baltic_fleet_arm | 발트 함대 재건 | ocean_fleet | 70 | - | navy_xp |
| northern_fleet | 북방 함대 | arctic_ports | 70 | - | navy_xp, convoys |
| atomic_project | 소련 핵계획(쿠르차토프) | academy | 105 | - | ★project 시작 또는 research_bonus 핵, has_atomic 연동 |
| espionage_rings | 원자 정보망 | atomic_project + espionage | 35 | - | intel_network, research_bonus |
| jet_design | 미그 설계국 | design_bureaus | 105 | - | design_grant 제트 |

### SUN 갈림길 총 5~8개

기존(숙청 vs 개혁, 독일 조약 vs 서방) + 일국 vs 세계혁명 + NKVD vs 당 집단 + NEP 재도입 vs 급속 공업화 + 핀란드 전쟁 vs 우호조약 + 초토화 vs 종심방어 + 정치위원 유지 vs 폐지.
정치 결과: 세계혁명 노선은 `popularity communist`와 Comintern 확대, 서방과 tension 증가. 집단지도/NEP 경로는 stability와 소비재 중심 경제 + 서방 opinion 상승.

### SUN AI 가중

- 역사: 대숙청 → 독일 조약 → 핀란드 전쟁 → 바그라티온. 역사적 AI는 `german_treaty`, `finland_winter` 선택 x2.
- 대안: 독일과 국경 접촉하고 `strength_ratio_ge` 낮음이면 `western_alliance` x2, 전쟁 중 점령지 발생 시 `scorched_earth` x1.5(자원 지대 상실 임박 시), 공장 40 이상이면 `defence_in_depth` x1.5.

---

## 7. 미국 (USA) — 현재 48개 → 목표 약 98개 (신규 50)

기존: 뉴딜, 고립주의 vs 국제주의(america_first vs internationalism), 유럽 우선 vs 태평양 우선, 무기대여, 해군 확장 등.

### 새 가지 USA-1. 국내 정치와 선거 (politics, 9개) — 갈림길 2

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| court_packing | 대법원 개편안 | second_new_deal | 70 | court_accept | stability ±, set_law |
| court_accept | 대법원 수용 | second_new_deal | 35 | court_packing | stability + |
| third_term | 3선 출마 | preparedness | 35 | washington_precedent | elections, set_leader FDR 유지 |
| washington_precedent | 선례 존중(윌키 승계) | preparedness | 35 | third_term | set_leader 윌키, ruling 변경 가능 |
| wallace_progressive | 월리스 진보 노선 | second_new_deal | 70 | southern_democrats | popularity social +, pp - |
| southern_democrats | 남부 민주당 연합 | second_new_deal | 70 | wallace_progressive | stability +, 보수 popularity |
| fair_employment | 공정고용위원회 | social_security | 70 | - | stability, manpower |
| home_front | 전시 홈프런트 | arsenal_of_democracy | 70 | - | stability +, war_support |
| long_populism | 롱 포퓰리즘(대안) | recession_response | 70 | second_new_deal 선택 시 불가 | ★대안 경로(휴이 롱 암살 안 된 시나리오): popularity fascist/populist +, set_law — 또는 기존 효과로 popularity만 |

(long_populism은 "역사 대안"으로서 기존 효과 `popularity`, `set_government`로 구현 가능, ★ 없음.)

### 새 가지 USA-2. 외교와 전쟁 개입 (diplomacy, 9개) — 갈림길 1

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| neutrality_acts | 중립법 강화 | america_first | 35 | repeal_neutrality | stability, opinion DEU/JPN +, tension - |
| repeal_neutrality | 중립법 폐기 | internationalism | 70 | neutrality_acts | war_goal 옵션 unlock, 무기수출 허용 |
| atlantic_charter | 대서양 헌장 | lend_lease_bill | 35 | - | opinion GBR/SUN +, invite 연합 |
| quarantine_speech | 격리 연설 | internationalism | 35 | - | tension, opinion |
| china_embargo | 대일 금수 | china_aid | 70 | japan_oil_trade | embargo JPN, tension + |
| japan_oil_trade | 대일 석유 무역 유지 | neutral_trade | 70 | china_embargo | opinion JPN +, resource |
| manhattan_diplomacy | 맨해튼 외교(영국 협력) | lend_lease_bill | 70 | - | opinion GBR +, 핵 협력 flag |
| united_nations | 국제연합 구상 | atlantic_charter | 70 | - | create_faction, opinion + |
| bretton_woods | 브레턴우즈 체제 | united_nations | 70 | - | pp, opinion, tension - |

### 새 가지 USA-3. 총력전 산업 (industry, 8개) — 갈림길 1

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| liberty_ships | 리버티 선박 | standard_freighters | 70 | - | convoys, build 조선소 |
| willow_run | 윌로 런 공장 | detroit_arsenal | 70 | - | build 대형 공장, equipment 항공기 |
| kaiser_yards | 카이저 조선소 | liberty_ships | 70 | - | build |
| rosie_workforce | 여성 노동력 | war_production_board | 70 | - | manpower, factories |
| price_controls | 물가 통제 | war_production_board | 35 | free_market_war | stability, pp - |
| free_market_war | 시장 위주 전시경제 | war_production_board | 35 | price_controls | pp +, stability - |
| big_inch_pipeline | 빅 인치 송유관 | texas_oil | 70 | - | fuel, resource |
| aluminium_programme | 알루미늄 증산 | industrial_mobilisation | 70 | - | resource |

### 새 가지 USA-4. 해군·태평양 (navy/army, 9개) — 갈림길 1

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| island_hopping | 도서 건너뛰기 | pacific_first | 70 | central_pacific_drive | war_goal 섬, unlock_template 상륙 |
| central_pacific_drive | 중부 태평양 돌파 | pacific_first | 70 | island_hopping | navy_xp, equipment 항모 |
| seabees | 해군 건설대 | marine_corps | 35 | - | build 기지, fort |
| mac_arthur_return | 맥아더의 귀환 | philippine_defence | 70 | - | add_general 맥아더, war_goal PHI |
| nimitz_command | 니미츠 지휘 | fast_carriers | 70 | - | add_general 니미츠, navy_xp |
| silent_service | 잠수함 통상파괴전 | submarine_campaign | 70 | - | navy_xp, 적 convoys 효과 |
| essex_class | 에식스급 항모 | fast_carriers | 70 | - | equipment 항모 |
| b29_programme | B-29 슈퍼포트리스 | strategic_bombing | 105 | - | design_grant, equipment |
| kwajalein_hub | 마셜 제도 전진기지 | island_hopping 또는 central_pacific_drive | 70 | - | build 기지 |

### 새 가지 USA-5. 유럽 전역과 육군 (army, 8개) — 갈림길 1

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| torch_prep | 횃불 작전 준비 | europe_first | 70 | - | unlock_template 상륙, army_xp |
| sicily_italy | 시칠리아·이탈리아 | torch_prep | 70 | - | war_goal ITA 방면 |
| overlord_prep | 오버로드 계획 | torch_prep + combined_ops(GBR와 협력 flag) | 105 | - | war_goal 대륙, army_xp |
| sherman_mass | 셔먼 대량생산 | armored_force | 70 | pershing_heavy | equipment 수량 |
| pershing_heavy | 퍼싱 중전차 | armored_force | 70 | sherman_mass | equipment 질 |
| tank_destroyers | 전차 구축함 | armored_force | 35 | - | equipment |
| gi_replacement | 보충병 체계 | selective_service | 70 | - | manpower |
| airborne_2 | 공수 확대 | airborne | 70 | - | unlock_template |

### 새 가지 USA-6. 과학·특수 프로젝트 (research/air, 7개)

| id | 한국어 | prereq | 일수 | 배타 | 핵심 효과 |
|---|---|---|---|---|---|
| nrc_committee | 국방연구위원회(NDRC) | defense_research | 35 | - | research_bonus |
| proximity_fuse | 근접신관 | radiation_lab | 70 | - | research_bonus, equipment |
| manhattan_project | 맨해튼 계획 | radiation_lab + manhattan_diplomacy | 105 | - | ★project 시작 (핵) 또는 research_bonus 핵 + has_atomic 연동 |
| trinity_test | 트리니티 시험 | manhattan_project | 105 | - | unlock_decision 핵 사용, has_atomic |
| p51_escort | P-51 장거리 호위 | escort_fighters | 70 | - | equipment |
| radar_mit | MIT 방사선 연구소 | defense_research | 70 | - | research_bonus 레이더 |
| jet_bell | 벨 제트 프로젝트 | air_corps | 70 | - | design_grant 제트 |

### USA 갈림길 총 6~8개

기존(고립 vs 국제주의, 유럽 vs 태평양 우선) + 대법원 + 3선 vs 선례 + 월리스 vs 남부 + 중립법 유지 vs 폐기 + 대일 금수 vs 무역 + 도서 건너뛰기 vs 중부 돌파 + 셔먼 vs 퍼싱 + 물가통제 vs 시장.
정치 결과: 3선 거부 시 `set_leader` 윌키(공화 보수 노선), 월리스 노선은 진보, 롱 포퓰리즘은 사실상 대안 정체.

### USA AI 가중

- 역사: new deal → america_first(초기) → 전쟁 발발 후 internationalism 전환 → lend_lease → 오버로드. 역사적 AI는 `third_term` x2, `china_embargo` x1.5, `europe_first` x2.
- 대안: 일본이 인접 지역을 침공하거나 tension 높음이면 `pacific_first` x2, 유럽 동맹이 위기(`strength_ratio_ge` 낮음)면 `torch_prep`/`overlord_prep` x1.5. 산업 높음이면 `sherman_mass` x1.5, 질 중시 전황(전차 교전 중)이면 `pershing_heavy` x2.

---

## 8. 총괄

| 국가 | 현재 | 신규 | 목표 |
|---|---|---|---|
| DEU | 53 | 50 | 103 |
| GBR | 49 | 50 | 99 |
| FRA | 49 | 50 | 99 |
| ITA | 50 | 50 | 100 |
| JPN | 49 | 50 | 99 |
| SUN | 49 | 50 | 99 |
| USA | 48 | 50 | 98 |
| 합계 | 347 | 350 | 697 |

(각 가지 소계가 약간 부족하거나 초과하는 곳은 구현 시 조정; 목표는 국가당 +50 안팎.)

### 새 효과 종류(★) 목록 (최소화)

1. `start_project` — 특수 프로젝트(핵, 로켓, 제트) 시작/진척. 현재 조건 `project_done/project_progress`만 있고 시작 효과가 없다. 대체안: `research_bonus` + `set_flag`로 유사 효과를 내고 프로젝트는 기존 decision에 위임. 가장 중요한 ★ 1개.
2. 그 외는 모두 기존 효과(set_government, civil_war, make_subject, lend_lease, separate_peace 등)로 가능. 비시 정부는 `set_government` + `set_name` 로 충분.

### UI 요구 (WwFocusPanel.ts, 963줄, 이미 가지 칩 있음)

- 접기/펼치기: `FocusDef.group?: string`(★ UI 전용 선택 필드, 시뮬레이션 영향 없음, 다이제스트 제외 확인 필요) 로 가지별 그룹. 접힌 가지는 완료/진행 개수만 표시.
- 검색: 포커스 이름으로 필터하고 해당 위치로 스크롤(번역된 이름 기준).
- 추천 마커: 현재 시작 가능한 포커스 중 "역사 경로 다음 한 칸"과 "AI 가중 상위 3개"에 작은 별 표시. 힌트일 뿐 자동 선택은 하지 않는다. 계산은 `historyPath`/`aiWeight`를 읽기 전용으로 재사용(클라이언트가 접근 가능한 부분만, 불가하면 서버 안 거치는 단순 규칙으로 대체).
- 배타 포커스는 서로 연결선을 점선으로 표시하는 현행 방식 유지. 트리 가로폭이 x 0~19이므로 미니맵 추가를 권장.

### 작업량 (에이전트 레인 단위)

- 국가 1개 = 1 레인. 콘텐츠 50개(트리 코드) + en/ko 번역 100줄(이름+설명) + 테스트(경로/배타/prereq 유효성, 가지 칩) 각 약 1.5~2시간.
- 7개 레인 병렬 가능. 공유 파일 충돌 지점: `en.json`, `ko.json`(국가별로 파일 끝에 블록 분리 권장), `registry.ts`(PATH/BRANCHES 이미 import됨).
- 다이제스트 재고정 필요: `WW1936_DIGEST`, `WW1936_EASY_DIGEST`(`tests/ww1936/WorldWarSnapshot.test.ts` 등). 레인마다 따로 재고정하면 충돌하므로 모든 레인 병합 후 한 번만 재고정할 것.
- 통합 단계(+30~45분): 다이제스트 재고정, `npm run typecheck`, `npm test`, 전체 AI 시뮬로 역사 경로가 막히지 않는지(path 검사) 확인.
- ★ `start_project` 추가는 엔진 레인 약 1시간(코드+테스트, `packages/engine*` 변경은 테스트 필수).
- 합계 약 7 레인 x 2시간 + 통합 1시간 + UI 1.5시간.

### 소유자에게 열린 질문 (3개)

1. 핵/로켓/제트 "특수 프로젝트"를 새 효과 `start_project`(★)로 정식 지원할까, 아니면 `research_bonus`+`design_grant`로 대체할까? 권장: 새 효과 1개 추가(엔진 1시간). 프로젝트 조건이 이미 있는데 시작 수단이 없는 점이 비대칭이라 한 번 정리하는 편이 낫다.
2. 새 가지를 UI 묶음용으로 구분하는 `group` 필드를 FocusDef에 추가할까, 아니면 기존 7개 `branch`만 쓰고 x열 범위로 구분할까? 권장: 선택 필드 `group` 추가(시뮬레이션 영향 없음, 다이제스트에 포함하지 않도록 구현). 100개 트리는 7개 칩만으론 탐색이 어렵다.
3. 비역사 AI의 이탈 빈도(BranchPoint 롤 확률)를 새 갈림길에도 지금과 같이 적용할까? 권장: 지금 값을 유지하되 정치적 큰 갈림길(발키리, 비시, 살로 등)만 낮게 두어 "역사가 기본, 대안이 가끔" 구도를 만든다.
