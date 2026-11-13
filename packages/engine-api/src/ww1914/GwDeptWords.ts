// Great War 1914 (ww196): the departments' and honours' word lists, with no
// imports, so GreatWarTypes (the state) and GwDepts (the rows) both read them.
// Every list is APPEND ONLY: state, orders and content name these ids.

/**
 * What a task is about (design ww195 §3). The first nine are common: every
 * seat has them, offered to the offices of `GW_TASK_OFFICES` (TaskRows). The
 * rest are a seat's own and need a `GwTaskRow`. APPEND ONLY.
 * Text: `depts.types.<type>` = { name ("{topic}에 대한 방침"), note? }.
 */
export const GW_TASK_TYPES = [
  "envoy", // {나라}에 대한 방침: stance, ruler, envoy's read, bidders, asks
  "front", // {전선} 작전안 (peace: 전쟁 계획 점검)
  "money", // 전쟁 비용 (peace: 예산)
  "bread", // 빵과 물가
  "unrest", // 불온 동향
  "fleet", // 함대 운용 (peace: 건함)
  "arms", // 포탄과 무기
  "men", // 병력 보충
  "intel", // {나라}의 속사정
  // A seat's own (§3 second table).
  "aims", // DEU 전쟁 목표
  "poland", // DEU 폴란드
  "franchise", // DEU 프로이센 선거법
  "ireland", // GBR 아일랜드
  "recruits", // GBR 징병 논쟁
  "chambers", // FRA 의회 대책
  "duma", // RUS 두마 대책
  "refugees", // RUS 피난민
  "ausgleich", // AUH 헝가리와의 조정
  "nations", // AUH 민족 문제
  // ww199: common to every seat, but given by the engine, not offered: the
  // foreign office drafts a beaten country's fate the moment a table opens
  // for it (free, past the one-per-department rule). Topic: the beaten tag.
  "settle", // {나라}의 처분
  // ww203: common to every seat, given from the agenda (order `bill_count`),
  // not offered: the counting office counts one bill. Topic: the law id.
  "count", // {법안} 표 계산
  // ww207: common to every seat, offered to the interior office (S1 wires
  // it): it reads the communities, their sizes and moods, and who would win
  // an election. It can be wrong. Topic: null.
  "poll", // 민심 동향
] as const;
export type GwTaskType = (typeof GW_TASK_TYPES)[number];
export const GW_COMMON_TASK_TYPES: readonly GwTaskType[] = GW_TASK_TYPES.slice(
  0,
  9,
);

/** The work's stages, 착수 → 조사 → 초안 → 보고. Text gw.ui.dept_stage_<id>. */
export const GW_DEPT_STAGES = ["start", "inquiry", "draft", "report"] as const;
export type GwDeptStage = (typeof GW_DEPT_STAGES)[number];

/** A finding's confidence word: 확인함 / 대체로 / 들은 말. APPEND ONLY. */
export const GW_CONFIDENCE = ["sure", "mostly", "heard"] as const;
export type GwConfidence = (typeof GW_CONFIDENCE)[number];

/**
 * The question a department sends back at 조사 (≤1 a task): 돈을 얼마나,
 * 누구를 보낼지, 어디까지. Picks: money `ample`/`thrift`; reach
 * `sound`/`terms`/`sign`; person: a person id of the seat. Unanswered by the
 * chapter's end, the head picks by his lean. Text `depts.questions.<q>`.
 */
export const GW_QUESTIONS = ["money", "person", "reach"] as const;
export type GwQuestion = (typeof GW_QUESTIONS)[number];
export const GW_QUESTION_PICKS = {
  money: ["ample", "thrift"],
  reach: ["sound", "terms", "sign"],
} as const;

/** Why a task stalls (멈춤), in words: `depts.stalls.<id>`. APPEND ONLY. */
export const GW_STALL_REASONS = [
  "disloyal", // the head drags his feet
  "rival", // the rival department blocks it
  "money", // the treasury is at the floor
  "moot", // the question is moot now: closed, can be given again
] as const;
export type GwStallReason = (typeof GW_STALL_REASONS)[number];

/**
 * What the ruler can do with work under way (order `task_push`): from the row
 * 서두르게 한다 / 사람을 붙인다 / 거둔다; from a stall paper also 기다린다.
 * `money` (돈을 더 쓴다) is the stall paper's word for `hurry`.
 */
export const GW_TASK_PUSHES = [
  "hurry",
  "staff",
  "withdraw",
  "wait",
  "money",
] as const;
export type GwTaskPush = (typeof GW_TASK_PUSHES)[number];

/**
 * A verdict on an answer besides a course (order `answer`): 더 알아봐라,
 * 다른 안을 가져와라. 다른 부서에 맡긴다 and 묵혀 둔다 are `pass_on`, `shelve`.
 */
export const GW_ANSWER_REDOS = ["more", "other"] as const;
export type GwAnswerRedo = (typeof GW_ANSWER_REDOS)[number];

/** What a course needs (필요한 것). Text gw.ui.dept_need_<kind>. APPEND ONLY. */
export const GW_NEED_KINDS = [
  "money", // in words: `word` (a little / much / a loan)
  "person", // someone of `office` (or the head's pick)
  "divisions", // in words: `word`
  "consent", // an ally's: `tag`
  "bill", // a law through lawDraftCard: `law`
] as const;
export type GwNeedKind = (typeof GW_NEED_KINDS)[number];

/**
 * Slots AnswerSlots fills from state; text uses them as `{slot}`. A slot's
 * value is a tag, a person, a theatre, a place or a word (`depts.words.<id>`).
 * APPEND ONLY.
 */
export const GW_ANSWER_SLOTS = [
  // A country (envoy, intel).
  "country",
  "ruler",
  "envoy",
  "stance",
  "readiness",
  "asks",
  "bidders",
  // A front.
  "front",
  "commander",
  "line",
  "enemy",
  "shells",
  // Home.
  "treasury",
  "prices",
  "bread",
  "order",
  "strikes",
  "agitators",
  // The sea.
  "fleet",
  "blockade",
  // The question back, answered (or the head's pick): a word.
  "spend", // ample / thrift
  "reach", // sound / terms / sign
  "sent", // the person sent: a person id
  // ww201: where the production step takes each gauge (GW_TREND_WORDS).
  "shells_trend",
  "bread_trend",
  "money_trend",
  // ww203: a count answer. bill: the law id (word); tally: the paper's
  // overall word (GwLaw GW_LAW_OUTLOOKS); swing: the wavering factions' ids,
  // joined by "," (word; absent with none).
  "bill",
  "tally",
  "swing",
  // ww207: a poll answer. winner: the faction that would win the next
  // election (word); rising, falling: faction ids, joined by ","; hot: the
  // communities at temper 2+, joined by ","; due: the next election's chamber
  // (word; absent with none due).
  "winner",
  "rising",
  "falling",
  "hot",
  "due",
] as const;
export type GwAnswerSlot = (typeof GW_ANSWER_SLOTS)[number];

export const GW_SLOT_KINDS = [
  "tag",
  "person",
  "theatre",
  "place",
  "word",
] as const;

/** When a list comes. APPEND ONLY. */
export const GW_HONOUR_OCCASIONS = [
  "date",
  "victory",
  "deed",
  "petition",
] as const;
export type GwHonourOccasion = (typeof GW_HONOUR_OCCASIONS)[number];

/** Who a list draws its candidates from. APPEND ONLY. */
export const GW_HONOUR_POOLS = [
  "generals", // commanders of a winning front
  "heads", // heads whose answers were taken
  "soldier", // a soldier for a deed (no person: "한 병사")
  "industry", // people of the money and munitions offices and camps
  "officials", // other office holders
] as const;
export type GwHonourPool = (typeof GW_HONOUR_POOLS)[number];

/**
 * The forms of a department's or an honours paper on the desk (`card.paper`):
 * each has a stub scene `gw_paper_<form>` so the desk carries it. APPEND ONLY.
 */
export const GW_PAPER_FORMS = [
  "answer", // 답신: findings, courses, needs
  "question", // the question back at 조사
  "stall", // 일이 멈춤
  "news", // 부서 소식: the stage lines, read-only
  "honours", // 서훈 명단, held at the 서훈식
  "petition", // 서훈 상신
] as const;
export type GwPaperForm = (typeof GW_PAPER_FORMS)[number];

/** Answers to a 서훈 상신. */
export const GW_PETITION_ANSWERS = ["accept", "next", "refuse"] as const;
export type GwPetitionAnswer = (typeof GW_PETITION_ANSWERS)[number];
