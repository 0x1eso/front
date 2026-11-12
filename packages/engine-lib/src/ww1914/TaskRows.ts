// Great War 1914 (ww193): the departments' rules, pure, so the engine runs them
// and the view tells them the same. Rows are content (content/depts/<seat>.ts,
// joined in Content.ts as `depts`); this file reads them and holds the numbers.
import type {
  GwCamp,
  GwField,
  GwOffice,
  GwPersonState,
  GwStamp,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_FIELDS } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwDeptContent,
  GwDeptLean,
  GwLean,
  GwStallReason,
  GwTaskPick,
  GwTaskRow,
  GwTaskType,
} from "@openfront/engine-api/ww1914/GwDepts";
import type { GwEffect, GwOption } from "@openfront/engine-api/ww1914/SceneDsl";

/** What each kind of business costs from the one time pool (남은 일정). */
export const GW_TIME_PRICES = {
  /** Seeing a head: everything he brings. */
  brief: 1,
  /** A task by written order; free after his briefing this chapter. */
  task: 1,
  act: 1,
  ceremony: 1,
  trip: 2,
  /** A petitioner, as a summons. */
  petition: 1,
} as const;

/** Time added to every chapter's pool on top of the summons and the slots. */
export const GW_TIME_EXTRA = 0;
/** Unspent time that carries to the next chapter, at most. */
export const GW_TIME_CARRY = 1;
/** Chapters a ready paper waits unheard before the department acts (대행). */
export const GW_TRAY_WAIT = 2;
/** Initiatives a head brings a chapter: idle, and busy on a task. */
export const GW_INITIATIVES_IDLE = 3;
export const GW_INITIATIVES_BUSY = 1;
/** Papers a tray holds at most; past this the desk keeps them. */
export const GW_TRAY_MAX = 3;
/** Petitioners in the room a chapter, at most. */
export const GW_PETITIONERS_MAX = 3;
/** Chapters before a task row is offered again; a row may set its own. */
export const GW_TASK_COOLDOWN = 2;
/** Trust at or below which a head's work is slow and his office may leak. */
export const GW_DEPT_DISLOYAL = -2;
/** Percent a disloyal head's office leaks a paper when it is ready. */
export const GW_LEAK_PCT = 30;
/** Percent a cunning or arrogant head keeps the rival's option out. */
export const GW_OMIT_PCT = 50;
/** Pride from which an overruled head loses trust. */
export const GW_PROUD = 3;

// ---- ww196: task types, stages, stalls, answers (design ww195 §2-3) ----

/**
 * Who takes a common task type, by seat: the first office in the list with a
 * head (GBR arms: Munitions, else the War Office). A seat row of the type
 * overrides it for its office. Absent: the seat has none of that type.
 */
export const GW_TASK_OFFICES: Readonly<
  Partial<Record<GwTag, Partial<Record<GwTaskType, readonly GwOffice[]>>>>
> = {
  DEU: {
    envoy: ["foreign"],
    front: ["chief_of_staff"],
    money: ["finance"],
    bread: ["interior"],
    unrest: ["interior"],
    fleet: ["navy"],
    arms: ["war"],
    men: ["war"],
    intel: ["intelligence"],
  },
  GBR: {
    envoy: ["foreign"],
    front: ["chief_of_staff", "war"],
    money: ["finance"],
    bread: ["interior"],
    unrest: ["interior"],
    fleet: ["navy"],
    arms: ["munitions", "war"],
    men: ["war"],
    intel: ["intelligence"],
  },
  FRA: {
    envoy: ["foreign"],
    front: ["supreme_commander", "chief_of_staff"],
    money: ["finance"],
    bread: ["agriculture", "interior"],
    unrest: ["interior"],
    fleet: ["navy"],
    arms: ["munitions", "war"],
    men: ["war"],
    intel: ["intelligence"],
  },
  RUS: {
    envoy: ["foreign"],
    front: ["supreme_commander", "chief_of_staff"],
    money: ["finance"],
    bread: ["agriculture", "interior"],
    unrest: ["interior"],
    fleet: ["navy"],
    arms: ["war"],
    men: ["war"],
    intel: ["intelligence"],
  },
  AUH: {
    envoy: ["foreign"],
    front: ["chief_of_staff"],
    money: ["finance"],
    bread: ["chancellor"],
    unrest: ["chancellor"],
    fleet: ["navy"],
    arms: ["war"],
    men: ["war"],
    intel: ["intelligence"],
  },
};

/** What the player picks when giving a type: a country, a front, or none. */
export const GW_TASK_PICK: Readonly<Partial<Record<GwTaskType, GwTaskPick>>> = {
  envoy: "country",
  intel: "country",
  front: "front",
};

/** Base chapters of a common type's work, before the head's own pace. */
export const GW_TASK_BASE = 2;
/** Chapters an answer waits on the desk before the department acts (대행). */
export const GW_ANSWER_WAIT = 2;
/** Chapters before the first `then` paper of a course taken. */
export const GW_THEN_AFTER = 2;
/** Percent a task stalls a chapter, by reason, when the reason holds. */
export const GW_STALL_PCT: Readonly<Record<GwStallReason, number>> = {
  disloyal: 40,
  rival: 15,
  money: 50,
  moot: 100,
};
/** Percent a stall left waiting (기다린다) clears by itself a chapter. */
export const GW_STALL_CLEAR_PCT = 40;
/** Money a hurry or 돈을 더 쓴다 costs (the money gauge). */
export const GW_HURRY_MONEY = 1;
/** Overruled this many times, a proud head presses to be seen. */
export const GW_PRESS_OVERRULED = 2;

/** The field a department's head is judged in. */
export const GW_DEPT_FIELD: Readonly<Record<GwOffice, GwField>> = {
  chancellor: "politics",
  foreign: "politics",
  chief_of_staff: "war",
  war: "war",
  navy: "war",
  interior: "admin",
  finance: "admin",
  court: "politics",
  ambassador_london: "politics",
  ambassador_paris: "politics",
  ambassador_petersburg: "politics",
  ambassador_vienna: "politics",
  hun_pm: "politics",
  munitions: "admin",
  sea_lord: "war",
  ireland: "admin",
  ambassador_washington: "politics",
  supreme_commander: "war",
  agriculture: "admin",
  intelligence: "war",
};

/** Offices that are no department: envoys abroad bring reports from abroad. */
export const GW_NOT_DEPTS: readonly GwOffice[] = [
  "ambassador_london",
  "ambassador_paris",
  "ambassador_petersburg",
  "ambassador_vienna",
  "ambassador_washington",
];

/** Offices that brief the ruler for free while he is on a trip. */
export const GW_TRIP_BRIEFERS: readonly GwOffice[] = [
  "chief_of_staff",
  "supreme_commander",
];

/** How a department leans when no row names it. */
export const GW_DEPT_LEAN_DEFAULT: Readonly<Record<GwOffice, GwLean>> = {
  chancellor: "calm",
  foreign: "gentle",
  chief_of_staff: "firm",
  war: "firm",
  navy: "bold",
  interior: "calm",
  finance: "cheap",
  court: "wait",
  ambassador_london: "gentle",
  ambassador_paris: "gentle",
  ambassador_petersburg: "gentle",
  ambassador_vienna: "gentle",
  hun_pm: "wait",
  munitions: "bold",
  sea_lord: "bold",
  ireland: "calm",
  ambassador_washington: "gentle",
  supreme_commander: "firm",
  agriculture: "cheap",
  intelligence: "firm",
};

/** Camps that pull against each other: two heads in them are opposed. */
export const GW_CAMP_OPPOSED: readonly (readonly [GwCamp, GwCamp])[] = [
  ["military", "civil"],
  ["east", "west"],
  ["hard", "moderate"],
  ["liberal", "unionist"],
  ["unionist", "irish"],
  ["unionist", "labour"],
  ["magyar", "nations"],
  ["magyar", "dynasty"],
  ["court", "duma"],
  ["radical", "right"],
  ["socialist", "right"],
];

export function campsOpposed(
  a: readonly GwCamp[],
  b: readonly GwCamp[],
): boolean {
  return GW_CAMP_OPPOSED.some(
    ([x, y]) =>
      (a.includes(x) && b.includes(y)) || (a.includes(y) && b.includes(x)),
  );
}

/** The head's band, 1..3, in the department's field. */
export function deptBand(p: GwPersonState, office: GwOffice): number {
  const v = p.competence[GW_FIELDS.indexOf(GW_DEPT_FIELD[office])] ?? 2;
  return Math.max(1, Math.min(3, v));
}

/** A report's stamp as the head's band makes it. */
export function bandStamp(band: number): GwStamp {
  return band >= 3 ? "confirmed" : band === 2 ? "estimate" : "unconfirmed";
}

/** Chapters the work takes: the base, his temper, his skill, his loyalty. */
export function taskChapters(
  base: number,
  p: GwPersonState,
  office: GwOffice,
): number {
  let n = base;
  if (p.temperament === "weary" || p.temperament === "anxious") n++;
  if (deptBand(p, office) >= 3) n--;
  if (p.trust <= GW_DEPT_DISLOYAL) n++;
  return Math.max(1, n);
}

/** The rows of the joined content, by id. */
export function taskRow(c: GwDeptContent | undefined, id: string) {
  return (c?.tasks ?? []).find((t) => t.id === id) ?? null;
}

/**
 * ww193 merge: a picked topic (a country, a front) narrows a row's products.
 * A paper whose id names another of the row's topics, as a whole `_` part
 * ("deu_dept_kin_grc" for GRC), is not this topic's; papers that name none
 * stay. So one row can list every country's papers.
 */
export function productFitsTopic(
  id: string,
  topic: string | null,
  topics: readonly string[],
): boolean {
  if (topic === null || topics.length < 2) return true;
  const parts = id.toLowerCase().split("_");
  if (parts.includes(topic.toLowerCase())) return true;
  return !topics.some((t) => parts.includes(t.toLowerCase()));
}

/** Rows for this seat and office, in content order. */
export function taskRowsFor(
  c: GwDeptContent | undefined,
  tag: GwTag,
  office: GwOffice,
): GwTaskRow[] {
  return (c?.tasks ?? []).filter(
    (t) => t.office === office && t.nation.includes(tag),
  );
}

/** The lean row for this seat, office and head: a camp row first. */
export function leanRow(
  c: GwDeptContent | undefined,
  tag: GwTag,
  office: GwOffice,
  camps: readonly GwCamp[],
): GwDeptLean | null {
  const rows = (c?.leans ?? []).filter(
    (l) => l.office === office && l.nation.includes(tag),
  );
  return (
    rows.find((l) => l.camp !== undefined && camps.includes(l.camp)) ??
    rows.find((l) => l.camp === undefined) ??
    null
  );
}

/** Every effect, `maybe` and `roll` opened up. */
function flat(list: readonly GwEffect[]): GwEffect[] {
  return list.flatMap((e) =>
    e.kind === "maybe"
      ? flat(e.then)
      : e.kind === "roll"
        ? flat([...e.then, ...(e.otherwise ?? [])])
        : [e],
  );
}

const WAIT =
  /^(wait|hold|later|not_now|let_be|delay|as_is|leave_it|watch|rest|say_nothing|silence|nothing|none|defer|shelve)/;
const FIRM =
  /^(refuse|decree|arrest|strike|reprisal|deny|push|firm|stand|rebuke|army|force|reject|no$|crush|hard|ban|close|dismiss)/;
const GENTLE =
  /^(give_way|amnesty|listen|hear|accept|yes|relief|embrace|concede|yield|grant|let_go|exchange|soft|pardon|talk|receive)/;

interface Sums {
  money: number;
  heat: number;
  order: number;
  trust: number;
  gain: number;
  cost: number;
}

function sums(o: GwOption): Sums {
  const s: Sums = { money: 0, heat: 0, order: 0, trust: 0, gain: 0, cost: 0 };
  for (const e of flat(o.effects)) {
    if (!("delta" in e) || typeof e.delta !== "number") continue;
    const d = e.delta;
    switch (e.kind) {
      case "gauge":
        if (e.gauge === "money") s.money += d;
        else if (e.gauge === "order" || e.gauge === "morale") s.order += d;
        break;
      case "temp":
      case "pressure":
        s.heat += d;
        break;
      case "inst":
      case "opinion":
        s.order += d;
        break;
      case "trust":
      case "person_trust":
        s.trust += d;
        break;
    }
    const counted = ["gauge", "inst", "trust", "person_trust", "opinion"];
    if (counted.includes(e.kind)) {
      if (d > 0) s.gain += d;
      else s.cost -= d;
    }
    if ((e.kind === "temp" || e.kind === "pressure") && d > 0) s.cost += d;
  }
  return s;
}

function leanScore(o: GwOption, lean: GwLean): number {
  const s = sums(o);
  const wait = WAIT.test(o.id) ? 1 : 0;
  const firm = FIRM.test(o.id) ? 1 : 0;
  const gentle = GENTLE.test(o.id) ? 1 : 0;
  switch (lean) {
    case "firm":
      return 4 * firm - 4 * gentle - 2 * wait + s.heat;
    case "gentle":
      return 4 * gentle - 4 * firm - s.heat + s.trust;
    case "cheap":
      return 3 * s.money - s.cost;
    case "calm":
      return 3 * s.order - 2 * s.heat;
    case "wait":
      return 6 * wait - s.gain - s.cost;
    case "bold":
      return 2 * s.gain - wait;
  }
}

/**
 * The option a department marks among `open`: the writer's pick for this
 * scene if open, else the best by its lean (the first on a tie); null: none.
 */
export function leanPick(
  open: readonly GwOption[],
  lean: GwLean,
  pick?: string,
): string | null {
  if (open.length === 0) return null;
  if (pick !== undefined && open.some((o) => o.id === pick)) return pick;
  let best = open[0];
  let top = leanScore(best, lean);
  for (const o of open.slice(1)) {
    const v = leanScore(o, lean);
    if (v > top) {
      best = o;
      top = v;
    }
  }
  return best.id;
}

/** Whether an option spends money: a finance head's counter-paper. */
export function spendsMoney(o: GwOption): boolean {
  return sums(o).money < 0;
}

/** Joins the content files' rows, in order. */
export function joinDepts(parts: readonly GwDeptContent[]): GwDeptContent {
  return {
    tasks: parts.flatMap((p) => p.tasks ?? []),
    leans: parts.flatMap((p) => p.leans ?? []),
    rivals: parts.flatMap((p) => p.rivals ?? []),
    wants: parts.flatMap((p) => p.wants ?? []),
    levers: parts.flatMap((p) => p.levers ?? []),
    answers: parts.flatMap((p) => p.answers ?? []),
    honours: parts.flatMap((p) => p.honours ?? []),
    orders: parts.flatMap((p) => p.orders ?? []),
  };
}
