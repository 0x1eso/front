/**
 * Great War 1914 (ww170 S3, design ww168 B4): scenes come by state, not date.
 * Reads every drawable scene and act, finds the gates that wait for a date
 * (world `date`, `chapter`, a `stage` limited to 1914), and works out the state
 * each really needs: months of war, months of peace, the crisis link.
 *
 *   npx tsx scripts/ww1914-regate.ts            # plan only: counts and lists
 *   npx tsx scripts/ww1914-regate.ts --apply    # also edits the content files
 *   npx tsx scripts/ww1914-regate.ts --verify   # after --apply: the content
 *                                               # now reads as planned
 *
 * Writes `--out` (default /home/eser/dev/ww170-regate-hand.md): what the
 * script did not change, by seat and file, with a suggested condition.
 *
 * The rules (a date leaf is a world `date` or a `chapter`; each rule looks at
 * the leaves of the gate's top-level `all`, never inside `any` or `not`):
 * - **Anchors.** The seat's war: `war`, `at_war`, `at_war_with`, `in_war`, a
 *   side, `w_summer_war`. The world's war: `war_age`, `era`, `battle`,
 *   `front`, `open`, `entered`, `out`, `armistice`, the world's war flags.
 *   Peace: `not(war)`, `not(at_war)`, side neutral, a crisis closed without
 *   war. The crisis: `crisis`, `chain`.
 * - **Chapter.** Inside the July weeks (max ≤ 5) with a crisis anchor: the
 *   chain's link (`chain`, July's chain). Inside the July weeks without one:
 *   the game's own opening, kept. From August with the seat's war: months of
 *   the seat's war (`war_months own`), counted from a war begun on 2 August.
 *   From August in peace: `peace_months`. Anything else: by hand.
 * - **Date.** With a war anchor: months of war since 1 August 1914 (`own` with
 *   the seat's war). A bound before the war is dropped. With a peace anchor:
 *   `peace_months`. A window of six months or less is an event: by hand.
 *   Calendar scenes (Christmas, birthdays, budgets) are by hand: they may keep
 *   their month.
 * - **Stage.** `crisis` alone stays (the opening weeks) unless the gate reads
 *   the crisis; then the chain does. A stage of 1914 without `war`: with the
 *   seat's war, the war's first five months (`war_months own max 4`); in
 *   peace, `peace_months max 4`; anything else by hand.
 * - **Drop.** Listed in GW_DROPS below, by hand: scenes that only make sense
 *   on their day and duplicate a state-gated one.
 */
import type { GwAct } from "@openfront/engine-api/ww1914/GwActs";
import type { GwCond, GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { daysFromCivil } from "@openfront/engine-lib/ww1936/Calendar";
import fs from "fs";
import path from "path";
import ts from "typescript";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = path.join(ROOT, "packages/engine-lib/src/ww1914/content");
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const VERIFY = argv.includes("--verify");
const outArg = argv.indexOf("--out");
const OUT =
  outArg >= 0 ? argv[outArg + 1] : "/home/eser/dev/ww170-regate-hand.md";
const PLAN_FILE = path.join(ROOT, "scripts/ww1914-regate.plan.json");

// ---------------------------------------------------------------- the rules

type Item = (GwScene | GwAct) & { what: "scene" | "act" };
type Leaf = {
  c: GwCond;
  /** On the top-level `all`, not under `any` or `not`. */
  top: boolean;
  t: "date" | "chapter" | "stage";
};

/** What becomes of one date leaf: dropped, or another condition. */
type LeafOp = { drop: true } | { keep: true } | { to: GwCond };
export interface Plan {
  id: string;
  what: "scene" | "act";
  nation: string[];
  action: "auto" | "hand" | "drop" | "keep";
  /** One per date leaf, in the order they come in the gate. */
  ops: LeafOp[];
  add: GwCond[];
  stage: "keep" | "remove" | "crisis";
  /** The stage change can be skipped where a helper sets the stage. */
  soft?: boolean;
  why: string;
  suggest: string;
}

const W = (of: Record<string, unknown>): GwCond =>
  ({ kind: "world", of }) as GwCond;

/** Days since 1 August 1914 of a "YYYY-MM" month's first or last day. */
function dayOf(ym: string, end: boolean): number {
  const [y, m] = ym.split("-").map(Number);
  const first = daysFromCivil(y, m, 1);
  const next =
    m === 12 ? daysFromCivil(y + 1, 1, 1) : daysFromCivil(y, m + 1, 1);
  return (end ? next - 1 : first) - daysFromCivil(1914, 8, 1);
}
const monthsAt = (ym: string, end: boolean) => Math.floor(dayOf(ym, end) / 30);
/** Chapter -> months of a war begun at chapter 5 (2 August), the full table. */
function chapterMonths(c: number): number {
  const day = (i: number) =>
    i <= 5
      ? daysFromCivil(1914, 6, 28) + i * 7
      : i <= 10
        ? daysFromCivil(1914, 8, 9) + (i - 6) * 30
        : daysFromCivil(1915, 1, 1) + (i - 11) * 30;
  return Math.max(0, Math.floor((day(c) - day(5)) / 30));
}

function leavesOf(c: GwCond | undefined, top: boolean, out: Leaf[]): void {
  if (c === undefined) return;
  if (c.kind === "all") return c.of.forEach((x) => leavesOf(x, top, out));
  if (c.kind === "any") return c.of.forEach((x) => leavesOf(x, false, out));
  if (c.kind === "not") return leavesOf(c.of, false, out);
  if (c.kind === "chapter") out.push({ c, top, t: "chapter" });
  else if (c.kind === "stage") out.push({ c, top, t: "stage" });
  else if (c.kind === "world" && c.of.is === "date") {
    out.push({ c, top, t: "date" });
  }
}

/** The conditions of the top-level `all`, flattened. */
function conj(c: GwCond | undefined): GwCond[] {
  if (c === undefined) return [];
  if (c.kind === "all") return c.of.flatMap(conj);
  return [c];
}

const WAR_FLAGS = new Set([
  "w_tannenberg",
  "w_marne_stopped",
  "w_bad_luck_east",
  "w_serbia_fallen",
  "w_italy_in",
  "w_america_in",
  "w_russia_out",
  "w_unrestricted",
  "w_liner_sunk",
  "w_france_falling",
  "w_ottoman_in",
  "w_romania_in",
  "w_warsaw_lost",
  "w_german_offer",
]);
const CALENDAR =
  /christmas|xmas|new_?year|birthday|budget|easter|jubilee|name_?day|anniversary/;

function seatWar(c: GwCond): boolean {
  switch (c.kind) {
    case "at_war":
    case "at_war_with":
      return true;
    case "flag":
      return c.flag === "w_summer_war";
    case "any":
      return c.of.length > 0 && c.of.every(seatWar);
    case "world": {
      const w = c.of;
      if (w.is === "war" || w.is === "score" || w.is === "main") return true;
      if (w.is === "in_war") return w.tag === undefined;
      if (w.is === "side") return !w.of.includes("neutral");
      return false;
    }
    default:
      return false;
  }
}
function worldWar(c: GwCond): boolean {
  if (seatWar(c)) return true;
  if (c.kind === "flag") return WAR_FLAGS.has(c.flag);
  if (c.kind === "any") return c.of.length > 0 && c.of.every(worldWar);
  if (c.kind !== "world") return false;
  const w = c.of;
  return (
    [
      "war_age",
      "war_months",
      "era",
      "battle",
      "front",
      "open",
      "entered",
      "out",
      "in_war",
      "tech",
    ].includes(w.is) ||
    (w.is === "armistice" && true)
  );
}
function peace(c: GwCond): boolean {
  if (c.kind === "not") {
    const x = c.of;
    if (x.kind === "at_war") return true;
    if (x.kind === "any")
      return x.of.length > 0 && x.of.every((y) => y.kind === "at_war");
    if (x.kind === "world" && x.of.is === "war") return true;
    return false;
  }
  if (c.kind !== "world") return false;
  const w = c.of;
  if (w.is === "side") return w.of.length === 1 && w.of[0] === "neutral";
  if (w.is === "chain_end") return !w.of.includes("war");
  return false;
}
function crisisAnchor(c: GwCond): boolean {
  if (c.kind === "crisis") return true;
  if (c.kind === "world" && c.of.is === "chain") return true;
  if (c.kind === "flag") return c.flag === "w_ultimatum_out";
  return false;
}

const range = (min: number | undefined, max: number | undefined) => ({
  ...(min !== undefined && min > 0 ? { min } : {}),
  ...(max !== undefined ? { max } : {}),
});

export function planOf(x: Item): Plan {
  const leaves: Leaf[] = [];
  leavesOf(x.when, true, leaves);
  const st = x.stage ?? [];
  const stage1914 =
    st.length > 0 &&
    !st.includes("war") &&
    (st.includes("crisis") || st.includes("y1914"));
  const base: Plan = {
    id: x.id,
    what: x.what,
    nation: [...x.nation],
    action: "keep",
    ops: leaves.map(() => ({ keep: true })),
    add: [],
    stage: "keep",
    why: "",
    suggest: "",
  };
  if (leaves.length === 0 && !stage1914) return base;
  const top = conj(x.when);
  const sw = top.some(seatWar);
  const ww = sw || top.some(worldWar);
  const pc = !ww && top.some(peace);
  const cr = top.some(crisisAnchor);
  const warStage = st.length === 0 || st.includes("war");
  const own = sw ? { own: true } : {};
  const months = (min?: number, max?: number) =>
    W({ is: "war_months", ...own, ...range(min, max) });
  const peaceMonths = (min?: number, max?: number) =>
    W({ is: "peace_months", ...range(min, max) });
  // A suggestion for the hand list, even where the rule won't act.
  const guess = (l: Leaf): string => {
    if (l.c.kind === "world" && l.c.of.is === "date") {
      const d = l.c.of;
      const lo = d.from === undefined ? undefined : monthsAt(d.from, false);
      const hi = d.to === undefined ? undefined : monthsAt(d.to, true);
      const kind = pc ? "peace_months" : `war_months${sw ? " own" : ""}`;
      return `${kind} ${lo !== undefined && lo > 0 ? lo : ""}..${hi ?? ""}`;
    }
    if (l.c.kind === "chapter") {
      const lo = l.c.min ?? 0;
      const hi = l.c.max;
      if ((hi ?? 99) <= 5) return `chain ${lo}..${hi ?? ""} (July)`;
      const a = lo >= 7 ? chapterMonths(lo) : "";
      const b = hi === undefined ? "" : chapterMonths(hi);
      return `${pc ? "peace_months" : "war_months own"} ${a}..${b}`;
    }
    return "the event's state";
  };
  const hand = (why: string, extra = ""): Plan => ({
    ...base,
    action: "hand",
    why,
    suggest: [...leaves.map(guess), ...(extra ? [extra] : [])].join("; "),
  });
  if (CALENDAR.test(x.id)) {
    return hand(
      "calendar: may keep its month (`month`), the year by state",
      "month{of:[..]}",
    );
  }
  if (leaves.some((l) => !l.top)) return hand("a date inside `any` or `not`");
  if (leaves.some((l) => l.t === "stage")) return hand("a `stage` condition");
  const ops: LeafOp[] = [];
  const openingChapter = leaves.some(
    (l) => l.c.kind === "chapter" && l.c.max !== undefined && l.c.max <= 5,
  );
  const mark14 = leaves.some(
    (l) =>
      l.c.kind === "world" &&
      l.c.of.is === "date" &&
      (l.c.of.from ?? "") >= "1914-08" &&
      l.c.of.to === "1914-12",
  );
  let maxMonths: number | null = null;
  let chain = false;
  let opening = false;
  for (const l of leaves) {
    if (l.c.kind === "chapter") {
      const lo = l.c.min ?? 0;
      const hi = l.c.max;
      if (hi !== undefined && hi <= 5) {
        if (cr) {
          ops.push({ to: W({ is: "chain", short: false, ...range(lo, hi) }) });
          chain = true;
        } else {
          // The game's own opening weeks: no date of history.
          ops.push({ keep: true });
          opening = true;
        }
        continue;
      }
      if (
        hi === undefined &&
        mark14 &&
        (lo === 6 || lo === 7) &&
        (ww || pc || warStage)
      ) {
        ops.push(
          lo === 6 ? { drop: true } : { to: pc ? peaceMonths(1) : months(1) },
        );
        continue;
      }
      if (hi === undefined && lo <= 5) {
        // Not in the game's first weeks: the opening's clock, kept.
        ops.push({ keep: true });
        continue;
      }
      if (sw && lo >= 4) {
        const a = lo >= 7 ? chapterMonths(lo) : undefined;
        const b = hi === undefined ? undefined : chapterMonths(hi);
        if (b !== undefined) maxMonths = Math.min(maxMonths ?? 99, b);
        ops.push(
          a === undefined && b === undefined
            ? { drop: true }
            : { to: months(a, b) },
        );
        continue;
      }
      if (pc && lo >= 6) {
        const a = lo >= 7 ? chapterMonths(lo) : undefined;
        const b = hi === undefined ? undefined : chapterMonths(hi);
        ops.push(
          a === undefined && b === undefined
            ? { drop: true }
            : { to: peaceMonths(a, b) },
        );
        continue;
      }
      return hand("a chapter gate past July with no war or peace to read");
    }
    if (l.c.kind === "world" && l.c.of.is === "date") {
      const d = l.c.of;
      const lo = d.from === undefined ? undefined : monthsAt(d.from, false);
      const hi = d.to === undefined ? undefined : monthsAt(d.to, true);
      // The plans' marks: "c" is the July weeks, "14" the war's first months.
      if (
        d.to !== undefined &&
        d.to <= "1914-08" &&
        (d.from ?? "1914-06") >= "1914-06"
      ) {
        if (openingChapter) ops.push({ drop: true });
        else {
          ops.push({ to: { kind: "chapter", max: 5 } });
          opening = true;
        }
        continue;
      }
      if (d.from !== undefined && d.from >= "1914-08" && d.to === "1914-12") {
        if (ww) {
          maxMonths = Math.min(maxMonths ?? 99, 4);
          ops.push({ to: months(undefined, 4) });
          continue;
        }
        if (pc) {
          ops.push({ to: peaceMonths(undefined, 4) });
          continue;
        }
        if (warStage) {
          ops.push({ to: months(undefined, 4) });
          continue;
        }
      }
      if (d.from !== undefined && d.to !== undefined && hi! - lo! < 6) {
        return hand("a window under six months: the event's own state");
      }
      if (hi !== undefined && hi < 0) return hand("a window before the war");
      const a = lo !== undefined && lo > 0 ? lo : undefined;
      const b = hi !== undefined && hi < 52 ? hi : undefined;
      const op = (mk: (a?: number, b?: number) => GwCond): LeafOp =>
        a === undefined && b === undefined ? { drop: true } : { to: mk(a, b) };
      if (ww) {
        if (b !== undefined) maxMonths = Math.min(maxMonths ?? 99, b);
        ops.push(op(months));
        continue;
      }
      if (pc) {
        ops.push(op(peaceMonths));
        continue;
      }
      // No anchor: the window counts the war's months as history had them.
      if (lo !== undefined && lo >= 0 && warStage) {
        ops.push(op(months));
        continue;
      }
      return hand(
        "a date reaching before the war, with no war or peace to read",
      );
    }
  }
  const add: GwCond[] = [];
  let stage: Plan["stage"] = "keep";
  let soft = false;
  if (stage1914) {
    const only = (s: string) => st.length === 1 && st[0] === s;
    if (chain && st.every((s) => s === "crisis" || s === "y1914")) {
      stage = "remove";
      soft = true;
    } else if (opening) {
      // The chapter already keeps it to the opening weeks.
    } else if (only("crisis")) {
      if (cr) {
        stage = "remove";
        add.push(W({ is: "chain", short: false }));
      }
    } else if (st.includes("closing")) {
      return hand("a 1914 stage with the closing chapter");
    } else if (sw && !(cr && st.includes("crisis"))) {
      stage = "remove";
      if (maxMonths === null || maxMonths > 4) add.push(months(undefined, 4));
    } else if (pc && only("y1914")) {
      stage = "remove";
      add.push(peaceMonths(undefined, 4));
    } else {
      return hand(
        `stage ${st.join("+")} with no war or peace to read`,
        sw ? "war_months own ..4" : "the state of the months it covers",
      );
    }
  }
  const changed =
    stage !== "keep" || add.length > 0 || ops.some((o) => !("keep" in o));
  return {
    ...base,
    action: changed ? "auto" : "keep",
    ops,
    add,
    stage,
    soft,
    why: "rule",
  };
}

// ------------------------------------------------------------- the dropped

/**
 * Scenes that only make sense on their day and duplicate a state-gated one
 * (design B9 no. 5, the owner's 5A). Each goes with its pack text; scenes that
 * name it lose that reference.
 */
export const GW_DROPS: readonly string[] = [];

// -------------------------------------------------------------- formatting

export function fmt(c: GwCond | undefined): string {
  if (c === undefined) return "-";
  switch (c.kind) {
    case "all":
      return `all(${c.of.map(fmt).join(", ")})`;
    case "any":
      return `any(${c.of.map(fmt).join(", ")})`;
    case "not":
      return `not(${fmt(c.of)})`;
    case "world": {
      const { is, ...r } = c.of as { is: string } & Record<string, unknown>;
      const rest = Object.entries(r)
        .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
        .join(",");
      return `w:${is}${rest ? `{${rest}}` : ""}`;
    }
    default: {
      const { kind, ...r } = c as { kind: string } & Record<string, unknown>;
      const rest = Object.entries(r)
        .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
        .join(",");
      return `${kind}${rest ? `{${rest}}` : ""}`;
    }
  }
}

const lit = (v: unknown) => JSON.stringify(v).replace(/"(\w+)":/g, "$1: ");

/** Source for a condition, with the DSL helpers the file has in scope. */
function code(c: GwCond, has: ReadonlySet<string>): string {
  switch (c.kind) {
    case "all":
    case "any":
      return has.has(c.kind)
        ? `${c.kind}(${c.of.map((x) => code(x, has)).join(", ")})`
        : `{ kind: "${c.kind}", of: [${c.of.map((x) => code(x, has)).join(", ")}] }`;
    case "not":
      return has.has("not")
        ? `not(${code(c.of, has)})`
        : `{ kind: "not", of: ${code(c.of, has)} }`;
    case "flag":
      return has.has("flag") ? `flag(${JSON.stringify(c.flag)})` : lit(c);
    case "world":
      return has.has("world") ? `world(${lit(c.of)})` : lit(c);
    default:
      return lit(c);
  }
}

// -------------------------------------------------------------- the source

/** Where an item is written: an object literal, or a call `f("id", ...)`. */
interface Found {
  file: string;
  sf: ts.SourceFile;
  obj: ts.ObjectLiteralExpression | null;
  call: ts.CallExpression | null;
}

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, out);
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out.sort();
}

const propOf = (o: ts.ObjectLiteralExpression, name: string) =>
  o.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) &&
      (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) &&
      p.name.text === name,
  );
const hasProp = (o: ts.ObjectLiteralExpression, name: string) =>
  o.properties.some(
    (p) =>
      (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
      ts.isIdentifier(p.name) &&
      p.name.text === name,
  );
const strOf = (n: ts.Node | undefined): string | null =>
  n !== undefined &&
  (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
    ? n.text
    : null;

/** Every object literal with a literal `id`, and every `f("id", ...)`, by id. */
function indexSources(ids: ReadonlySet<string>): Map<string, Found[]> {
  const out = new Map<string, Found[]>();
  const put = (key: string, f: Found) => {
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push(f);
  };
  for (const file of walkFiles(CONTENT)) {
    const text = fs.readFileSync(file, "utf-8");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);
    const visit = (n: ts.Node) => {
      if (ts.isObjectLiteralExpression(n)) {
        const key = strOf(propOf(n, "id")?.initializer);
        if (key !== null && ids.has(key)) {
          put(key, { file, sf, obj: n, call: null });
        }
      } else if (ts.isCallExpression(n)) {
        const key = strOf(n.arguments[0]);
        if (key !== null && ids.has(key)) {
          put(key, { file, sf, obj: null, call: n });
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return out;
}

/** Top-level declarations of a file: name -> initializer or function. */
function declsOf(sf: ts.SourceFile): Map<string, ts.Node> {
  const out = new Map<string, ts.Node>();
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer !== undefined) {
          out.set(d.name.text, d.initializer);
        }
      }
    } else if (ts.isFunctionDeclaration(st) && st.name && st.body) {
      out.set(st.name.text, st);
    }
  }
  return out;
}

/** Names a file imports: local name -> [module, exported name]. */
function importsOf(sf: ts.SourceFile): Map<string, [string, string]> {
  const out = new Map<string, [string, string]>();
  for (const st of sf.statements) {
    if (
      !ts.isImportDeclaration(st) ||
      !ts.isStringLiteral(st.moduleSpecifier)
    ) {
      continue;
    }
    const named = st.importClause?.namedBindings;
    if (named === undefined || !ts.isNamedImports(named)) continue;
    for (const el of named.elements) {
      out.set(el.name.text, [
        st.moduleSpecifier.text,
        (el.propertyName ?? el.name).text,
      ]);
    }
  }
  return out;
}

const unwrap = (n: ts.Node): ts.Node => {
  while (
    ts.isParenthesizedExpression(n) ||
    ts.isAsExpression(n) ||
    ts.isSatisfiesExpression(n)
  ) {
    n = n.expression;
  }
  return n;
};

const DSL = /ww1914\/(WorldDsl|SceneDsl)$/;
const HELPERS = ["all", "any", "not", "flag", "world"];

/** The DSL's helpers a file has in scope under their own names. */
function helpersOf(sf: ts.SourceFile): Set<string> {
  const imports = importsOf(sf);
  const decls = declsOf(sf);
  const out = new Set<string>();
  for (const h of HELPERS) {
    const imp = imports.get(h);
    if (
      imp !== undefined &&
      DSL.test(imp[0]) &&
      imp[1] === h &&
      !decls.has(h)
    ) {
      out.add(h);
    }
  }
  return out;
}

const callName = (n: ts.Node): string | null =>
  ts.isCallExpression(n) && ts.isIdentifier(n.expression)
    ? n.expression.text
    : null;

/** An `all`/`any` node: its children, or null. */
function listOf(
  n: ts.Node,
  kind: "all" | "any",
  has: ReadonlySet<string>,
): readonly ts.Expression[] | null {
  if (callName(n) === kind && has.has(kind)) {
    return (n as ts.CallExpression).arguments;
  }
  if (ts.isObjectLiteralExpression(n)) {
    const k = strOf(propOf(n, "kind")?.initializer);
    const of = propOf(n, "of");
    if (k === kind && of && ts.isArrayLiteralExpression(of.initializer)) {
      if (of.initializer.elements.some(ts.isSpreadElement)) return null;
      return of.initializer.elements;
    }
  }
  return null;
}

/**
 * Pairs the source of a gate with its value, as far as both are `all`, `any`
 * and `not`: below that each node is a unit whose value is known.
 */
function align(
  n: ts.Node,
  v: GwCond,
  has: ReadonlySet<string>,
  units: Map<ts.Node, GwCond>,
): boolean {
  const u = unwrap(n);
  for (const kind of ["all", "any"] as const) {
    const list = listOf(u, kind, has);
    if (list !== null) {
      if (list.some(ts.isSpreadElement)) return false;
      if (v.kind !== kind || v.of.length !== list.length) return false;
      return list.every((a, i) => align(a, v.of[i], has, units));
    }
  }
  if (callName(u) === "not" && has.has("not")) {
    const a = (u as ts.CallExpression).arguments;
    if (v.kind !== "not" || a.length !== 1) return false;
    return align(a[0], v.of, has, units);
  }
  units.set(u, v);
  return true;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

const isDateLeaf = (c: GwCond) =>
  c.kind === "chapter" ||
  c.kind === "stage" ||
  (c.kind === "world" && c.of.is === "date");

/** Every date leaf of a value, in order (object identity). */
function dateLeaves(c: GwCond | undefined, out: GwCond[] = []): GwCond[] {
  if (c === undefined) return out;
  if (c.kind === "all" || c.kind === "any")
    c.of.forEach((x) => dateLeaves(x, out));
  else if (c.kind === "not") dateLeaves(c.of, out);
  else if (isDateLeaf(c)) out.push(c);
  return out;
}

/** A value with its date leaves carried out: null when nothing is left. */
function carry(c: GwCond, ops: Map<GwCond, LeafOp>): GwCond | null {
  if (c.kind === "all") {
    const of = c.of
      .map((x) => carry(x, ops))
      .filter((x): x is GwCond => x !== null);
    if (of.length === 0) return null;
    return of.length === 1 ? of[0] : { kind: "all", of };
  }
  if (c.kind === "any" || c.kind === "not") return c;
  const op = ops.get(c);
  if (op === undefined || "keep" in op) return c;
  return "to" in op ? op.to : null;
}

/** Rebuilds a gate's source: units carried out, the rest as written. */
function rebuild(
  sf: ts.SourceFile,
  n: ts.Node,
  has: ReadonlySet<string>,
  units: ReadonlyMap<ts.Node, GwCond>,
  ops: Map<GwCond, LeafOp>,
  extra: readonly string[] = [],
): string | null {
  const u = unwrap(n);
  const v = units.get(u);
  if (v !== undefined) {
    const leaves = dateLeaves(v);
    const touched = leaves.some((l) => {
      const op = ops.get(l);
      return op !== undefined && !("keep" in op);
    });
    const own = touched ? carry(v, ops) : v;
    const text = own === null ? null : touched ? code(own, has) : n.getText(sf);
    if (extra.length === 0) return text;
    const parts = [...(text === null ? [] : [text]), ...extra];
    return parts.length === 1 ? parts[0] : wrapAll(parts, has);
  }
  const list = listOf(u, "all", has);
  if (list !== null) {
    const parts = list
      .map((a) => rebuild(sf, a, has, units, ops))
      .filter((x): x is string => x !== null);
    parts.push(...extra);
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];
    const same =
      parts.length === list.length &&
      extra.length === 0 &&
      list.every((a, i) => a.getText(sf) === parts[i]);
    return same ? n.getText(sf) : wrapAll(parts, has);
  }
  const text = n.getText(sf);
  return extra.length === 0 ? text : wrapAll([text, ...extra], has);
}

const wrapAll = (parts: readonly string[], has: ReadonlySet<string>) =>
  has.has("all")
    ? `all(${parts.join(", ")})`
    : `{ kind: "all", of: [${parts.join(", ")}] }`;

const parsed = new Map<string, ts.SourceFile>();
function sourceOf(file: string): ts.SourceFile | null {
  if (!fs.existsSync(file)) return null;
  let sf = parsed.get(file);
  if (sf === undefined) {
    sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf-8"),
      ts.ScriptTarget.ES2022,
      true,
    );
    parsed.set(file, sf);
  }
  return sf;
}

/** The declaration a name stands for in a file, through relative imports. */
function resolveDecl(
  file: string,
  name: string,
  depth = 0,
): { file: string; node: ts.Node } | null {
  const sf = sourceOf(file);
  if (sf === null || depth > 5) return null;
  const d = declsOf(sf).get(name);
  if (d !== undefined) {
    if (ts.isIdentifier(d)) return resolveDecl(file, d.text, depth + 1);
    return { file, node: d };
  }
  const imp = importsOf(sf).get(name);
  if (imp === undefined || !imp[0].startsWith(".")) return null;
  return resolveDecl(
    path.resolve(path.dirname(file), imp[0] + ".ts"),
    imp[1],
    depth + 1,
  );
}

/** The parameter names of the function a call calls, if it is ours. */
function paramsOf(file: string, call: ts.CallExpression): string[] | null {
  if (!ts.isIdentifier(call.expression)) return null;
  const r = resolveDecl(file, call.expression.text);
  if (r === null) return null;
  const fn = r.node;
  if (
    !ts.isArrowFunction(fn) &&
    !ts.isFunctionDeclaration(fn) &&
    !ts.isFunctionExpression(fn)
  ) {
    return null;
  }
  // A parameter the body puts under `when:` is the gate, under `stage:` the stage.
  const body = fn.getText(sourceOf(r.file)!);
  return fn.parameters.map((p) => {
    if (!ts.isIdentifier(p.name)) return "?";
    const n = p.name.text;
    if (n === "when" || new RegExp(`\\bwhen:\\s*${n}\\b`).test(body))
      return "when";
    if (n === "stage" || new RegExp(`\\bstage:\\s*${n}\\b`).test(body))
      return "stage";
    return n;
  });
}

/** The strings a value carries, but its kinds. */
function valueStrings(v: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof v === "string") out.add(v);
  else if (Array.isArray(v)) v.forEach((x) => valueStrings(x, out));
  else if (v !== null && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      if (k !== "kind" && k !== "is") valueStrings(x, out);
    }
  }
  return out;
}

/**
 * Whether a source unit can be this value: a unit made only of literals and
 * the DSL's helpers must carry the same strings. One with other names in it
 * (a constant, a helper of the file) can't be checked here; verify does.
 */
function unitFits(sf: ts.SourceFile, n: ts.Node, v: GwCond): boolean {
  const strs = new Set<string>();
  let names = false;
  const visit = (x: ts.Node) => {
    if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) {
      strs.add(x.text);
    } else if (ts.isIdentifier(x)) {
      const p = x.parent;
      const isKey =
        (ts.isPropertyAssignment(p) && p.name === x) ||
        (ts.isPropertyAccessExpression(p) && p.name === x);
      if (!isKey && !HELPERS.includes(x.text)) names = true;
    }
    ts.forEachChild(x, visit);
  };
  visit(n);
  if (names) return true;
  const want = valueStrings(v);
  const kinds = new Set(["all", "any", "not", "world"]);
  for (const s of want) if (!strs.has(s)) return false;
  for (const s of strs)
    if (!want.has(s) && !kinds.has(s) && !/^[a-z_]+$/.test(s)) return false;
  return true;
}

/** The gate's source node and the stage's, for a literal or a call. */
function gateOf(f: Found): {
  holder: ts.ObjectLiteralExpression | null;
  when: ts.Node | null;
  stage: ts.PropertyAssignment | null;
  err: string | null;
} {
  if (f.obj !== null) {
    if (hasProp(f.obj, "when") && propOf(f.obj, "when") === undefined) {
      return {
        holder: null,
        when: null,
        stage: null,
        err: "the gate is a shorthand name",
      };
    }
    if (f.obj.properties.some(ts.isSpreadAssignment)) {
      // `...more` can carry a gate of its own.
      if (propOf(f.obj, "when") === undefined) {
        return {
          holder: null,
          when: null,
          stage: null,
          err: "the literal spreads another object",
        };
      }
    }
    return {
      holder: f.obj,
      when: propOf(f.obj, "when")?.initializer ?? null,
      stage: propOf(f.obj, "stage") ?? null,
      err: null,
    };
  }
  const call = f.call!;
  const params = paramsOf(f.file, call);
  if (params !== null) {
    const wi = params.indexOf("when");
    const si = params.indexOf("stage");
    const when = wi >= 0 ? (call.arguments[wi] ?? null) : null;
    if (wi >= 0) {
      if (when !== null && ts.isSpreadElement(when)) {
        return {
          holder: null,
          when: null,
          stage: null,
          err: "a spread argument",
        };
      }
      return {
        holder: null,
        when,
        stage: null,
        stageArg: si >= 0 ? (call.arguments[si] ?? null) : null,
        err: null,
      } as never;
    }
  }
  const args = call.arguments.slice(1);
  const objs = args.filter(ts.isObjectLiteralExpression);
  const withWhen = objs.filter((o) => propOf(o, "when") !== undefined);
  if (withWhen.length === 1) {
    return {
      holder: withWhen[0],
      when: propOf(withWhen[0], "when")!.initializer,
      stage: propOf(withWhen[0], "stage") ?? null,
      err: null,
    };
  }
  return {
    holder: null,
    when: null,
    stage: null,
    err: "the gate is a helper's argument",
  };
}

/** The edits that carry out `p` on `f`, or why they can't be made. */
function editsFor(
  p: Plan,
  item: Item,
  f: Found,
): { edits: Edit[]; err: string | null; imports: string[] } {
  const fail = (err: string) => ({ edits: [], err, imports: [] });
  const g = gateOf(f);
  if (g.err !== null) return fail(g.err);
  const has = helpersOf(f.sf);
  const want = new Set<string>();
  // New code uses only the helpers the file already has: no new imports.
  const leaves = dateLeaves(item.when);
  const ops = new Map<GwCond, LeafOp>();
  leaves.forEach((l, i) => ops.set(l, p.ops[i]));
  if (new Set(leaves).size !== leaves.length)
    return fail("a date leaf is shared");
  const units = new Map<ts.Node, GwCond>();
  if (g.when !== null && ts.isArrayLiteralExpression(unwrap(g.when))) {
    return fail("the gate is a list a helper spreads");
  }
  if (g.when !== null) {
    // A wrapper may add to the gate around what the source wrote.
    const cands: GwCond[] = [];
    if (item.when !== undefined) cands.push(item.when);
    if (item.when?.kind === "all") {
      cands.push(item.when.of[0], item.when.of[item.when.of.length - 1]);
    }
    let ok = false;
    let skip = TRIES.get(p.id) ?? 0;
    for (const c of cands) {
      units.clear();
      if (!align(g.when, c, has, units)) continue;
      if (![...units].every(([n, v]) => unitFits(f.sf, n, v))) continue;
      // A wrapper can line up by chance: an earlier pass that read back wrong
      // moves on to the next way it lines up.
      if (skip-- > 0) continue;
      const inside = new Set([...units.values()].flatMap((v) => dateLeaves(v)));
      if (leaves.every((l) => inside.has(l))) {
        ok = true;
        break;
      }
    }
    if (!ok) return fail("the source and the scene's gate don't line up");
  } else if (leaves.length > 0) {
    return fail("the gate comes from elsewhere");
  }
  const adds = p.add.map((c) => code(c, has));
  const edits: Edit[] = [];
  if (g.when !== null) {
    const text = rebuild(f.sf, g.when, has, units, ops, adds);
    if (text === null && g.holder === null) {
      return fail("the whole gate would go, and a helper takes it");
    }
    if (text === null) {
      const prop = g.holder!.properties.find(
        (x) => ts.isPropertyAssignment(x) && x.initializer === g.when,
      ) as ts.PropertyAssignment;
      edits.push(removeProp(f.sf, prop));
    } else if (text !== g.when.getText(f.sf)) {
      edits.push({ start: g.when.getStart(f.sf), end: g.when.getEnd(), text });
    }
  } else if (adds.length > 0) {
    if (g.holder === null) return fail("nowhere to put the gate");
    const anchor = propOf(g.holder, "kind") ?? propOf(g.holder, "id");
    if (anchor === undefined) return fail("nowhere to put the gate");
    const text = adds.length === 1 ? adds[0] : wrapAll(adds, has);
    edits.push({
      start: anchor.getEnd(),
      end: anchor.getEnd(),
      text: `,\nwhen: ${text}`,
    });
  }
  if (p.stage !== "keep" && g.stage === null && p.soft === true) {
    p.stage = "keep";
  }
  if (p.stage !== "keep") {
    if (g.stage === null) return fail("the stage is set by a helper");
    if (p.stage === "remove") edits.push(removeProp(f.sf, g.stage));
    else {
      edits.push({
        start: g.stage.initializer.getStart(f.sf),
        end: g.stage.initializer.getEnd(),
        text: `["crisis"]`,
      });
    }
  }
  const used = new Set<string>();
  for (const e of edits) {
    for (const h of want)
      if (new RegExp(`\\b${h}\\(`).test(e.text)) used.add(h);
  }
  return { edits, err: null, imports: [...used] };
}

function removeProp(sf: ts.SourceFile, prop: ts.PropertyAssignment): Edit {
  let end = prop.getEnd();
  if (sf.text[end] === ",") end++;
  return { start: prop.getFullStart(), end, text: "" };
}

/** Adds `world`/`all` to a file's imports from the DSL modules. */
function addImports(text: string, names: Set<string>): string {
  const mods: [string, string][] = [
    ["world", "@openfront/engine-api/ww1914/WorldDsl"],
    ["all", "@openfront/engine-api/ww1914/SceneDsl"],
  ];
  for (const [name, mod] of mods) {
    if (!names.has(name)) continue;
    const re = new RegExp(
      `import \\{([^}]*)\\} from "${mod.replace(/\//g, "\\/")}";`,
    );
    const m = re.exec(text);
    if (m !== null && !/^\s*type\b/.test(m[1])) {
      text = text.replace(
        re,
        `import {${m[1].replace(/\s*$/, "")}, ${name} } from "${mod}";`,
      );
    } else {
      const at = text.search(/^import /m);
      const line = `import { ${name} } from "${mod}";\n`;
      text = at < 0 ? line + text : text.slice(0, at) + line + text.slice(at);
    }
  }
  return text;
}

// -------------------------------------------------------------------- main

const EXCLUDE_FILE = path.join(ROOT, "scripts/ww1914-regate.exclude");
const TRIES_FILE = path.join(ROOT, "scripts/ww1914-regate.tries");
/** id -> how many line-ups to pass over (`--verify` failures, counted). */
const TRIES = new Map<string, number>();
if (fs.existsSync(TRIES_FILE)) {
  for (const id of fs.readFileSync(TRIES_FILE, "utf-8").split(/\s+/)) {
    if (id) TRIES.set(id, (TRIES.get(id) ?? 0) + 1);
  }
}

async function main(): Promise<void> {
  const { gwContent } =
    await import("@openfront/engine-lib/ww1914/content/Content");
  const C = gwContent();
  const items: Item[] = [
    ...C.scenes
      .filter((s) => s.scheduledOnly !== true)
      .map((s) => ({ ...s, what: "scene" as const })),
    ...(C.acts ?? []).map((a) => ({ ...a, what: "act" as const })),
  ];
  if (VERIFY) return verify(items);
  const excluded = new Set(
    fs.existsSync(EXCLUDE_FILE)
      ? fs.readFileSync(EXCLUDE_FILE, "utf-8").split(/\s+/).filter(Boolean)
      : [],
  );
  const plans = items.map(planOf);
  for (const p of plans) {
    if (GW_DROPS.includes(p.id)) p.action = "drop";
  }
  const index = indexSources(new Set(items.map((x) => x.id)));
  const byFile = new Map<string, Edit[]>();
  const importsBy = new Map<string, Set<string>>();
  const where = new Map<string, string>();
  const key = (x: { what: string; id: string }) => `${x.what}:${x.id}`;
  const itemOf = new Map(items.map((x) => [key(x), x]));
  for (const p of plans) {
    const all = index.get(p.id) ?? [];
    const objs = all.filter((f) => {
      if (f.obj === null) return false;
      return p.what === "act"
        ? hasProp(f.obj, "slot") ||
            hasProp(f.obj, "fields") ||
            hasProp(f.obj, "group")
        : hasProp(f.obj, "nation") ||
            hasProp(f.obj, "kind") ||
            hasProp(f.obj, "variants");
    });
    const calls = all.filter(
      (f) =>
        f.call !== null &&
        ((paramsOf(f.file, f.call)?.includes("when") ?? false) ||
          f.call.arguments
            .slice(1)
            .some(
              (a) =>
                ts.isObjectLiteralExpression(a) &&
                (propOf(a, "when") !== undefined ||
                  propOf(a, "stage") !== undefined),
            )),
    );
    const list = objs.length > 0 ? objs : calls;
    if (list.length >= 1) where.set(p.id, path.relative(CONTENT, list[0].file));
    if (p.action !== "auto") continue;
    const toHand = (why: string) => {
      p.action = "hand";
      p.why = why;
      p.suggest = describe(p);
    };
    if (excluded.has(p.id)) {
      toHand("the edit didn't read back as planned");
      continue;
    }
    if (list.length !== 1) {
      toHand(
        list.length === 0
          ? "made by a helper: no literal in the source"
          : "written in two places",
      );
      continue;
    }
    const f = list[0];
    const r = editsFor(p, itemOf.get(key(p))!, f);
    if (r.err !== null) {
      toHand(r.err);
      continue;
    }
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file)!.push(...r.edits);
    if (!importsBy.has(f.file)) importsBy.set(f.file, new Set());
    for (const i of r.imports) importsBy.get(f.file)!.add(i);
  }
  for (const p of plans) {
    if (p.action === "hand" && p.suggest === "") p.suggest = describe(p);
  }
  const count = (a: Plan["action"]) =>
    plans.filter((p) => p.action === a).length;
  console.log(
    `items ${plans.length}: auto ${count("auto")}, hand ${count("hand")}, drop ${count("drop")}, keep ${count("keep")}`,
  );
  const whyCount: Record<string, number> = {};
  for (const p of plans) {
    if (p.action === "hand") whyCount[p.why] = (whyCount[p.why] ?? 0) + 1;
  }
  for (const [k, v] of Object.entries(whyCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  hand: ${v} ${k}`);
  }
  if (APPLY) {
    for (const [file, edits] of byFile) {
      let text = fs.readFileSync(file, "utf-8");
      edits.sort((a, b) => b.start - a.start || b.end - a.end);
      for (let i = 1; i < edits.length; i++) {
        if (edits[i].end > edits[i - 1].start) {
          throw new Error(`overlapping edits in ${file}`);
        }
      }
      for (const e of edits) {
        text = text.slice(0, e.start) + e.text + text.slice(e.end);
      }
      text = addImports(text, importsBy.get(file) ?? new Set());
      fs.writeFileSync(file, text);
    }
    fs.writeFileSync(
      PLAN_FILE,
      JSON.stringify(
        plans
          .filter((p) => p.action === "auto")
          .map((p) => ({
            id: p.id,
            what: p.what,
            expect: expected(itemOf.get(key(p))!, p),
          })),
        null,
        1,
      ) + "\n",
    );
    console.log(
      `edited ${byFile.size} files; plan in ${path.relative(ROOT, PLAN_FILE)}`,
    );
    console.log(
      [...byFile.keys()].map((f) => path.relative(ROOT, f)).join("\n"),
    );
  }
  writeHand(plans, items, where);
  fs.writeFileSync(
    path.join(ROOT, "scripts/ww1914-regate.hand.json"),
    JSON.stringify(
      plans
        .filter((p) => p.action === "hand")
        .map((p) => p.id)
        .sort(),
      null,
      1,
    ) + "\n",
  );
}

function describe(p: Plan): string {
  const parts = [
    ...p.ops
      .filter((o): o is { to: GwCond } => "to" in o)
      .map((o) => fmt(o.to)),
    ...p.add.map(fmt),
  ];
  return parts.join(", ");
}

/** The gate an auto plan leaves: the item's `when` and `stage` after it. */
function expected(item: Item, p: Plan): { when: string; stage: string } {
  const ops = new Map<GwCond, LeafOp>();
  dateLeaves(item.when).forEach((l, i) => ops.set(l, p.ops[i]));
  const core = item.when === undefined ? null : carry(item.when, ops);
  const parts = [...(core === null ? [] : [core]), ...p.add];
  const when =
    parts.length === 0
      ? undefined
      : parts.length === 1
        ? parts[0]
        : ({ kind: "all", of: parts } as GwCond);
  const stage =
    p.stage === "remove"
      ? ""
      : p.stage === "crisis"
        ? "crisis"
        : (item.stage ?? []).join("+");
  return { when: canon(when), stage };
}

/** JSON with keys sorted at every level. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v !== null && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/** A gate's leaves as a sorted multiset: nesting of `all` doesn't count. */
function canon(c: GwCond | undefined): string {
  return conj(c).map(stable).sort().join("&");
}

function verify(items: Item[]): void {
  const plan = JSON.parse(fs.readFileSync(PLAN_FILE, "utf-8")) as {
    id: string;
    what: string;
    expect: { when: string; stage: string };
  }[];
  const byId = new Map(items.map((x) => [`${x.what}:${x.id}`, x]));
  const bad: string[] = [];
  for (const row of plan) {
    const x = byId.get(`${row.what}:${row.id}`);
    if (x === undefined) {
      console.log(`missing ${row.id}`);
      bad.push(row.id);
      continue;
    }
    const now = { when: canon(x.when), stage: (x.stage ?? []).join("+") };
    if (now.when !== row.expect.when || now.stage !== row.expect.stage) {
      bad.push(row.id);
      console.log(
        `differs ${row.id}\n  want ${row.expect.when} [${row.expect.stage}]\n  have ${now.when} [${now.stage}]`,
      );
    }
  }
  console.log(`verified ${plan.length - bad.length}/${plan.length}`);
  if (bad.length > 0) {
    fs.writeFileSync(
      path.join(ROOT, "scripts/ww1914-regate.bad"),
      bad.join("\n") + "\n",
    );
    process.exitCode = 1;
  }
}

function writeHand(
  plans: Plan[],
  items: Item[],
  where: Map<string, string>,
): void {
  const itemOf = new Map(items.map((x) => [`${x.what}:${x.id}`, x]));
  const hand = plans.filter((p) => p.action === "hand");
  const seatOf = (p: Plan) => (p.nation.length === 1 ? p.nation[0] : "common");
  const seats = ["AUH", "DEU", "FRA", "GBR", "RUS", "common"];
  const lines: string[] = [];
  const count = (a: Plan["action"]) =>
    plans.filter((p) => p.action === a).length;
  lines.push(
    "# ww170: scenes to re-gate by hand (from `scripts/ww1914-regate.ts`)",
  );
  lines.push("");
  lines.push(
    `The script re-gated ${count("auto")} scenes and acts by rule, dropped ${count("drop")}, and left these ${hand.length} for the five hand lanes. Each row: the id, its gate now, why the script left it, and a suggested state. Write the state the scene really needs (a front, a battle, an entry, a regime, a law, a person in office, \`war_months\`, \`peace_months\`, the July \`chain\`); a calendar scene may keep a \`month\`. When a row is done, take its id out of \`GW_REGATE_PENDING\` in \`packages/engine-lib/src/ww1914/content/Regate.ts\`: the content check (\`tests/ww1914/DateGates.test.ts\`) fails on a pending id that no longer waits for a date, and on any date gate not pending or calendar.`,
  );
  lines.push("");
  lines.push(
    "New conditions (world): `war_months {min,max,own}` (months since the war began, or with `own` since the seat's country came in), `peace_months {min,max}` (months since the last crisis closed, the country never at war), `month {of:[1..12]}` (calendar), `ladder {role,tag,of}` (the crisis ladder).",
  );
  for (const seat of seats) {
    const rows = hand.filter((p) => seatOf(p) === seat);
    if (rows.length === 0) continue;
    lines.push("");
    lines.push(`## ${seat} (${rows.length})`);
    const files = new Map<string, Plan[]>();
    for (const p of rows) {
      const f = where.get(p.id) ?? "(made by a helper)";
      if (!files.has(f)) files.set(f, []);
      files.get(f)!.push(p);
    }
    for (const [f, ps] of [...files].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push("");
      lines.push(`### ${f} (${ps.length})`);
      for (const p of ps.sort((a, b) => a.id.localeCompare(b.id))) {
        const x = itemOf.get(`${p.what}:${p.id}`)!;
        const st = x.stage === undefined ? "" : ` [${x.stage.join("+")}]`;
        lines.push(
          `- \`${p.id}\`${p.what === "act" ? " (act)" : ""}${st} \`${fmt(x.when)}\` — ${p.why}. Suggest: ${p.suggest || "the event's state"}`,
        );
      }
    }
  }
  fs.writeFileSync(OUT, lines.join("\n") + "\n");
  console.log(`hand list: ${OUT}`);
}

void main();
