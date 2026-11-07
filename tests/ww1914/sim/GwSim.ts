// Great War 1914 (design §2.1, §13, §14): the check on the replay claim. It
// plays series of games back to back, the way the owner will, with a seeded
// bot. A series carries each game's bodies to the next through the lobby field,
// as the browser does. Nothing here knows any scene: it reads whatever the
// content is. `report` says how often each scene came, what never came and why,
// what comes too often, and how much of run 2 on was already seen.
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type { GameStartInfo } from "@openfront/engine-api/Schemas";
import type {
  GwCalendarId,
  GwCard,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwTalkLinks } from "@openfront/engine-api/ww1914/SceneCheck";
import type { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { createGameRunner, GameRunner } from "@openfront/engine/GameRunner";
import { advanceChapter } from "@openfront/engine/ww1914/Chapters";
import { DeskTrace, watchDesk } from "@openfront/engine/ww1914/Desk";
import { proposalsFor } from "@openfront/engine/ww1914/Fronts";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { applyGwOrder, openTopics } from "@openfront/engine/ww1914/Orders";
import { ctxOf, optionOpen, sceneOf } from "@openfront/engine/ww1914/SceneRun";

/**
 * How a bot plays: percent of summons used, percent of talks walked out of,
 * percent of offers to end the game taken (a person plays a game out).
 */
export interface GwSimProfile {
  name: string;
  summons: number;
  leaves: number;
  ends: number;
}

/** Three habits, so the numbers aren't one way of playing. */
export const GW_SIM_PROFILES: readonly GwSimProfile[] = [
  { name: "talker", summons: 100, leaves: 10, ends: 10 },
  { name: "balanced", summons: 60, leaves: 30, ends: 15 },
  { name: "signer", summons: 20, leaves: 60, ends: 25 },
];

export interface GwSimOptions {
  /** Independent series of back-to-back games. */
  series: number;
  /** Games in a series; the owner's test is 3. */
  runsPerSeries: number;
  calendar: GwCalendarId;
  /** A scene in this share of games or more is called overused. */
  overusedAt: number;
  /** Also play the same series with no lobby list, to compare. */
  control: boolean;
  /** Names the game ids: another label is another set of worlds. */
  label: string;
  /** The country the bot sits in. */
  seat: GwTag;
}

export const GW_SIM_DEFAULTS: GwSimOptions = {
  series: 30,
  runsPerSeries: 3,
  calendar: "y1914",
  overusedAt: 0.8,
  control: true,
  label: "sim",
  seat: "DEU",
};

/** The design's bar: at most this share of run 2's bodies already seen. */
export const GW_SEEN_BEFORE_GOAL = 0.4;

const HUMAN = "SIMHUMAN";

export function startOf(
  gameID: string,
  calendar: GwCalendarId,
  recent: readonly string[],
  seat: GwTag = "DEU",
): GameStartInfo {
  return {
    gameID,
    lobbyCreatedAt: 0,
    config: {
      gameMap: GameMapType.World1936,
      gameMapSize: GameMapSize.Normal,
      gameMode: GameMode.FFA,
      gameType: GameType.Singleplayer,
      difficulty: Difficulty.Medium,
      nations: "default",
      bots: 0,
      donateGold: false,
      donateTroops: false,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
      greatWar1914: true,
      greatWar1914Calendar: calendar,
      ...(recent.length === 0 ? {} : { greatWar1914Recent: [...recent] }),
    },
    players: [
      {
        clientID: HUMAN,
        username: "sim",
        clanTag: null,
        isLobbyCreator: true,
        gwCountry: seat,
      },
    ],
  };
}

export async function newGame(
  map: MapFiles,
  start: GameStartInfo,
): Promise<GameRunner> {
  const runner = await createGameRunner(start, undefined, map, () => {});
  for (let i = 0; i < 2; i++) {
    runner.addTurn({ turnNumber: i, intents: [] });
    runner.executeNextTick();
  }
  return runner;
}

/** What one game left behind. */
export interface GwRunRecord {
  gameID: string;
  profile: string;
  opening: string;
  ending: string;
  chapters: number;
  bodies: string[];
  /** Scene id -> chapters it held and could have been drawn. */
  eligible: Record<string, number>;
  /** Scene id -> chapters it was on the desk by the draw or a schedule. */
  dealt: Record<string, number>;
  /** Per chapter, the scenes on the desk. */
  desks: string[][];
  /** Scene id -> times it was called from the people screen. */
  summoned: Record<string, number>;
  /** Topic -> chapters it was open to be called. */
  openTopics: Record<string, number>;
  /** "<scene>.<option>" taken. */
  picks: string[];
  /** "<scene>.<option>" that stood open when the card was decided. */
  openedOptions: string[];
  /** "<scene>|<role>=<person>,..." for each card. */
  casts: string[];
  deskSizes: number[];
  quietChapters: number;
  promisesBroken: number;
  promisesKept: number;
  papersSigned: number;
}

/** The bot's dice: stateless, as the game's are. */
function dice(gameID: string) {
  const seed = idHash(gameID);
  let n = 0;
  return (below: number): number => wwRoll(seed, 77, n++) % below;
}

const bump = (o: Record<string, number>, k: string) => {
  o[k] = (o[k] ?? 0) + 1;
};

function castKey(c: GwCard): string {
  const roles = Object.entries(c.cast).map(([r, p]) => `${r}=${p}`);
  return `${c.scene}|${roles.join(",")}`;
}

function summonAll(
  gw: GreatWar,
  seat: GwSeatState,
  profile: GwSimProfile,
  roll: (below: number) => number,
  rec: GwRunRecord,
): void {
  const mine = gwContent().people.filter((p) => p.tag === seat.tag);
  const open: { person: string; topic: string }[] = [];
  for (const p of mine) {
    if (gw.person(p.id)?.status !== "active") continue;
    for (const topic of openTopics(gw, seat, p.id)) {
      open.push({ person: p.id, topic });
      bump(rec.openTopics, topic);
    }
  }
  while (seat.audiences > 0 && open.length > 0) {
    if (roll(100) >= profile.summons) return;
    const [pick] = open.splice(roll(open.length), 1);
    const before = seat.desk.length;
    if (applyGwOrder(gw, seat, { kind: "summon", ...pick }) !== null) continue;
    bump(rec.summoned, pick.topic);
    const card = seat.desk[before];
    rec.casts.push(castKey(card));
    talkThrough(gw, seat, card, profile, roll, rec);
  }
}

/** One talk, reply by reply. */
function talkThrough(
  gw: GreatWar,
  seat: GwSeatState,
  card: GwCard,
  profile: GwSimProfile,
  roll: (below: number) => number,
  rec: GwRunRecord,
): void {
  const scene = sceneOf(card.scene)!;
  for (let guard = 0; guard < 100 && seat.desk.includes(card); guard++) {
    const ctx = ctxOf(gw, seat, card);
    const open = scene.nodes![card.node!].replies.filter((r) =>
      optionOpen(ctx, r),
    );
    const going = open.filter((r) => r.kind !== "leave");
    const leave = going.length === 0 || roll(100) < profile.leaves;
    const from = leave ? open : going;
    const reply = from[roll(from.length)];
    rec.picks.push(`${scene.id}.${reply.id}`);
    applyGwOrder(gw, seat, { kind: "reply", card: card.uid, reply: reply.id });
  }
}

/** Reads, decides and talks everything on the desk. */
export function clearDesk(
  gw: GreatWar,
  seat: GwSeatState,
  profile: GwSimProfile,
  roll: (below: number) => number,
  rec: GwRunRecord,
): void {
  for (let guard = 0; guard < 500 && seat.desk.length > 0; guard++) {
    // A decision can end the game; what is left on the desk stays unread.
    if (gw.s.ended !== null) return;
    const card = seat.desk[0];
    const scene = sceneOf(card.scene)!;
    const ctx = ctxOf(gw, seat, card);
    if (card.node !== null) {
      talkThrough(gw, seat, card, profile, roll, rec);
    } else if ((scene.options ?? []).length > 0) {
      const open = scene.options!.filter((o) => optionOpen(ctx, o));
      for (const o of open) rec.openedOptions.push(`${scene.id}.${o.id}`);
      const stays = open.filter((o) => !o.tell.includes("ends_game"));
      const from = stays.length > 0 && roll(100) >= profile.ends ? stays : open;
      const option = from[roll(from.length)];
      rec.picks.push(`${scene.id}.${option.id}`);
      const refused = applyGwOrder(gw, seat, {
        kind: "choose",
        card: card.uid,
        option: option.id,
      });
      if (refused !== null) {
        throw new Error(`${scene.id}.${option.id}: refused, ${refused}`);
      }
    } else {
      applyGwOrder(gw, seat, { kind: "read", card: card.uid });
    }
  }
}

/** The chapter's war paper: any of the open ones, as a client sends it. */
function signPaper(
  gw: GreatWar,
  seat: GwSeatState,
  roll: (below: number) => number,
  rec: GwRunRecord,
): void {
  const open = proposalsFor(gw, seat).filter((p) => p.open);
  if (open.length === 0) return;
  const { main, posture, scale, allyShare } = open[roll(open.length)];
  const refused = applyGwOrder(gw, seat, {
    kind: "allocate",
    main,
    posture,
    scale,
    allyShare,
    research: seat.alloc.research,
  });
  if (refused === null) rec.papersSigned++;
}

/**
 * One game, start to end, by the orders a client sends. Summons come first, so
 * what a talk opens is open when the decisions are taken. A desk that can't be
 * cleared would be a dead end, so it throws.
 */
export async function playRun(
  map: MapFiles,
  gameID: string,
  calendar: GwCalendarId,
  recent: readonly string[],
  profile: GwSimProfile,
  seatTag: GwTag = "DEU",
  /** Called as each chapter opens, for a test that reads the state. */
  onChapter?: (gw: GreatWar) => void,
): Promise<GwRunRecord> {
  const rec: GwRunRecord = {
    gameID,
    profile: profile.name,
    opening: "",
    ending: "",
    chapters: 0,
    bodies: [],
    eligible: {},
    dealt: {},
    desks: [],
    summoned: {},
    openTopics: {},
    picks: [],
    openedOptions: [],
    casts: [],
    deskSizes: [],
    quietChapters: 0,
    promisesBroken: 0,
    promisesKept: 0,
    papersSigned: 0,
  };
  const trace = (t: DeskTrace) => {
    for (const id of t.eligible) bump(rec.eligible, id);
    for (const id of t.dealt) bump(rec.dealt, id);
    rec.desks[t.chapter] = [...t.dealt];
    rec.deskSizes.push(t.dealt.length);
    if (t.quiet) rec.quietChapters++;
  };
  watchDesk(trace);
  try {
    const runner = await newGame(
      map,
      startOf(gameID, calendar, recent, seatTag),
    );
    const gw = runner.game.greatWar()!;
    const seat = gw.s.seats[0];
    const roll = dice(gameID);
    rec.opening = gw.s.opening;
    while (gw.s.ended === null) {
      rec.chapters++;
      onChapter?.(gw);
      for (const c of seat.desk) rec.casts.push(castKey(c));
      summonAll(gw, seat, profile, roll, rec);
      clearDesk(gw, seat, profile, roll, rec);
      if (gw.s.ended !== null) break;
      if (seat.desk.length > 0) {
        throw new Error(`${gameID}: desk stuck on ${seat.desk[0].scene}`);
      }
      signPaper(gw, seat, roll, rec);
      seat.ready = true;
      advanceChapter(gw, runner.game.ticks(), false);
    }
    rec.ending = gw.s.ended;
    rec.bodies = [...new Set(seat.shown)];
    for (const p of seat.promises) {
      if (p.kept) rec.promisesKept++;
      if (p.broken) rec.promisesBroken++;
    }
  } finally {
    watchDesk(null);
  }
  return rec;
}

/** Plays `series` series; each game's list is the last two games' bodies. */
export async function simulate(
  map: MapFiles,
  opts: GwSimOptions,
  carry: boolean,
): Promise<GwRunRecord[][]> {
  const out: GwRunRecord[][] = [];
  for (let s = 0; s < opts.series; s++) {
    const profile = GW_SIM_PROFILES[s % GW_SIM_PROFILES.length];
    const runs: GwRunRecord[] = [];
    for (let r = 0; r < opts.runsPerSeries; r++) {
      const recent = carry
        ? [...new Set(runs.slice(-2).flatMap((x) => x.bodies))]
        : [];
      const id = `${opts.label}-${s}-${r}`;
      runs.push(
        await playRun(map, id, opts.calendar, recent, profile, opts.seat),
      );
    }
    out.push(runs);
  }
  return out;
}

export interface GwSeenBefore {
  /** 2 for the second game of a series. */
  run: number;
  /** Share of this game's bodies seen in an earlier game of the series. */
  bodies: number;
  /** The same, by scene: a known scene with a new body counts here. */
  scenes: number;
}

const sceneOfBody = (b: string) => b.split(".")[0];

/** Run 2 on, averaged over the series. */
export function seenBefore(series: readonly GwRunRecord[][]): GwSeenBefore[] {
  const length = series.reduce((n, s) => Math.max(n, s.length), 0);
  const out: GwSeenBefore[] = [];
  for (let run = 1; run < length; run++) {
    let bodies = 0;
    let scenes = 0;
    let n = 0;
    for (const s of series) {
      if (s.length <= run || s[run].bodies.length === 0) continue;
      const earlier = s.slice(0, run).flatMap((x) => x.bodies);
      const known = new Set(earlier);
      const knownScenes = new Set(earlier.map(sceneOfBody));
      const now = s[run].bodies;
      const nowScenes = [...new Set(now.map(sceneOfBody))];
      bodies += now.filter((b) => known.has(b)).length / now.length;
      scenes +=
        nowScenes.filter((x) => knownScenes.has(x)).length / nowScenes.length;
      n++;
    }
    out.push({
      run: run + 1,
      bodies: n === 0 ? 0 : bodies / n,
      scenes: n === 0 ? 0 : scenes / n,
    });
  }
  return out;
}

export interface GwSceneRow {
  id: string;
  kind: string;
  /** Share of games it came in. */
  share: number;
  dealt: number;
  summoned: number;
  /** Bodies of it seen / written. */
  bodies: string;
  /** Different casts it came with. */
  casts: number;
}

export interface GwUnseenRow {
  id: string;
  kind: string;
  why: string;
}

export interface GwLinkRow {
  talk: string;
  key: string;
  scene: string;
  option: string;
  /** Share of games the talk took place in. */
  talked: number;
  /** Of games the card came in, the share where the option stood open. */
  opened: number;
  /** Of games the card came in, the share where it was taken. */
  taken: number;
}

export interface GwSimReport {
  games: number;
  series: number;
  runsPerSeries: number;
  calendar: GwCalendarId;
  seenBefore: GwSeenBefore[];
  /** The same series with no lobby list; null if not played. */
  control: GwSeenBefore[] | null;
  goal: number;
  /** Whether run 2 is under the design's bar. */
  meetsGoal: boolean;
  perGame: {
    cards: number;
    talks: number;
    quietChapters: number;
    deskMin: number;
    deskMax: number;
    promisesKept: number;
    promisesBroken: number;
  };
  scenes: GwSceneRow[];
  unseen: GwUnseenRow[];
  overused: GwSceneRow[];
  unseenBodies: string[];
  links: GwLinkRow[];
  openings: Record<string, number>;
  endings: Record<string, number>;
  /** Chapter -> scene -> games it was on that chapter's desk. */
  byChapter: Record<string, number>[];
}

const mean = (xs: readonly number[]) =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

function whyUnseen(id: string, games: readonly GwRunRecord[]): string {
  const s = sceneOf(id)!;
  const sum = (f: (g: GwRunRecord) => number) =>
    games.reduce((n, g) => n + f(g), 0);
  if (s.summon === true) {
    const open = sum((g) => g.openTopics[id] ?? 0);
    return open === 0
      ? "topic never open: its state never held"
      : `topic open ${open} chapters, never called`;
  }
  if (s.scheduledOnly === true) return "nothing scheduled it";
  if (s.quiet === true) return "no chapter was quiet at its length";
  const held = sum((g) => g.eligible[id] ?? 0);
  return held === 0
    ? "never eligible: its state never held"
    : `eligible ${held} chapters, always lost the draw`;
}

function linkRows(
  games: readonly GwRunRecord[],
  scenes: readonly GwScene[],
): GwLinkRow[] {
  const talked = (g: GwRunRecord, t: string) =>
    (g.summoned[t] ?? 0) + (g.dealt[t] ?? 0) > 0;
  return gwTalkLinks(scenes).map((l) => {
    const body = `${l.scene}.${l.option}`;
    const withCard = games.filter(
      (g) => (g.dealt[l.scene] ?? 0) + (g.summoned[l.scene] ?? 0) > 0,
    );
    const share = (f: (g: GwRunRecord) => boolean) =>
      withCard.length === 0 ? 0 : withCard.filter(f).length / withCard.length;
    return {
      ...l,
      talked: games.filter((g) => talked(g, l.talk)).length / games.length,
      opened: share((g) => g.openedOptions.includes(body)),
      taken: share((g) => g.picks.includes(body)),
    };
  });
}

/** The figures, from games already played. */
export function report(
  played: readonly GwRunRecord[][],
  control: readonly GwRunRecord[][] | null,
  opts: GwSimOptions,
): GwSimReport {
  const games = played.flat();
  const cameIn = (id: string) => (g: GwRunRecord) =>
    (g.dealt[id] ?? 0) + (g.summoned[id] ?? 0) > 0;
  const allBodies = new Set(games.flatMap((g) => g.bodies));
  const allCasts = new Set(games.flatMap((g) => g.casts));
  const own = gwContent().scenes.filter((s) => s.nation.includes(opts.seat));
  const scenes: GwSceneRow[] = own.map((s) => {
    const seen = s.variants.filter((v) => allBodies.has(`${s.id}.${v.id}`));
    return {
      id: s.id,
      kind: s.kind,
      share: games.filter(cameIn(s.id)).length / games.length,
      dealt: games.reduce((n, g) => n + (g.dealt[s.id] ?? 0), 0),
      summoned: games.reduce((n, g) => n + (g.summoned[s.id] ?? 0), 0),
      bodies: `${seen.length}/${s.variants.length}`,
      casts: [...allCasts].filter((c) => c.startsWith(`${s.id}|`)).length,
    };
  });
  scenes.sort((a, b) => b.share - a.share || (a.id < b.id ? -1 : 1));
  const seen = seenBefore(played);
  const tally = (f: (g: GwRunRecord) => string) => {
    const o: Record<string, number> = {};
    for (const g of games) bump(o, f(g));
    return o;
  };
  const sizes = games.flatMap((g) => g.deskSizes);
  return {
    games: games.length,
    series: played.length,
    runsPerSeries: opts.runsPerSeries,
    calendar: opts.calendar,
    seenBefore: seen,
    control: control === null ? null : seenBefore(control),
    goal: GW_SEEN_BEFORE_GOAL,
    meetsGoal: seen.length > 0 && seen[0].bodies < GW_SEEN_BEFORE_GOAL,
    perGame: {
      cards: mean(games.map((g) => g.bodies.length)),
      talks: mean(
        games.map((g) => Object.values(g.summoned).reduce((a, b) => a + b, 0)),
      ),
      quietChapters: mean(games.map((g) => g.quietChapters)),
      deskMin: sizes.length === 0 ? 0 : Math.min(...sizes),
      deskMax: sizes.length === 0 ? 0 : Math.max(...sizes),
      promisesKept: mean(games.map((g) => g.promisesKept)),
      promisesBroken: mean(games.map((g) => g.promisesBroken)),
    },
    scenes,
    unseen: scenes
      .filter((s) => s.share === 0)
      .map((s) => ({ id: s.id, kind: s.kind, why: whyUnseen(s.id, games) })),
    overused: scenes.filter((s) => s.share >= opts.overusedAt),
    unseenBodies: own
      .flatMap((s) => s.variants.map((v) => `${s.id}.${v.id}`))
      .filter((b) => !allBodies.has(b)),
    links: linkRows(games, own),
    openings: tally((g) => g.opening),
    endings: tally((g) => g.ending),
    byChapter: chapterRows(games),
  };
}

function chapterRows(games: readonly GwRunRecord[]) {
  const out: Record<string, number>[] = [];
  for (const g of games) {
    g.desks.forEach((desk, ch) => {
      out[ch] ??= {};
      for (const id of desk) bump(out[ch], id);
    });
  }
  return out;
}

/** Plays the series, and the control if asked, and reports. */
export async function runSim(
  map: MapFiles,
  opts: GwSimOptions,
): Promise<GwSimReport> {
  const played = await simulate(map, opts, true);
  const control = opts.control ? await simulate(map, opts, false) : null;
  return report(played, control, opts);
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** The report as the terminal prints it. */
export function formatReport(r: GwSimReport): string {
  const out: string[] = [];
  out.push(
    `Great War 1914 sim: ${r.series} series x ${r.runsPerSeries} games (${r.games}), calendar ${r.calendar}`,
  );
  out.push("", "Seen before (share of a game's bodies already read)");
  r.seenBefore.forEach((s, i) => {
    const c = r.control?.[i];
    const without = c === undefined ? "" : `, no list ${pct(c.bodies)}`;
    out.push(
      `  run ${s.run}: bodies ${pct(s.bodies)}, scenes ${pct(s.scenes)}${without}`,
    );
  });
  out.push(
    `  goal: run 2 bodies under ${pct(r.goal)}: ${r.meetsGoal ? "met" : "NOT met"}`,
  );
  const g = r.perGame;
  out.push("", "Per game");
  out.push(
    `  bodies ${g.cards.toFixed(1)}, summons used ${g.talks.toFixed(1)}, quiet chapters ${g.quietChapters.toFixed(1)}, desk ${g.deskMin}-${g.deskMax}`,
  );
  out.push(
    `  promises kept ${g.promisesKept.toFixed(1)}, broken ${g.promisesBroken.toFixed(1)}`,
  );
  out.push(`  openings ${JSON.stringify(r.openings)}`);
  out.push(`  endings ${JSON.stringify(r.endings)}`);
  out.push("", `Overused (${r.overused.length})`);
  for (const s of r.overused) {
    out.push(
      `  ${pct(s.share).padStart(4)} ${s.id} [${s.kind}] bodies ${s.bodies}`,
    );
  }
  out.push("", `Unseen scenes (${r.unseen.length})`);
  for (const s of r.unseen) out.push(`  ${s.id} [${s.kind}]: ${s.why}`);
  out.push("", `Unseen bodies (${r.unseenBodies.length})`);
  for (const b of r.unseenBodies) out.push(`  ${b}`);
  out.push("", `Talks that open options (${r.links.length})`);
  for (const l of r.links) {
    out.push(
      `  ${l.talk} -> ${l.scene}.${l.option} (${l.key}): talked ${pct(l.talked)}, open ${pct(l.opened)}, taken ${pct(l.taken)}`,
    );
  }
  out.push("", "Scene frequency");
  for (const s of r.scenes) {
    out.push(
      `  ${pct(s.share).padStart(4)} ${s.id} [${s.kind}] dealt ${s.dealt}, called ${s.summoned}, bodies ${s.bodies}, casts ${s.casts}`,
    );
  }
  return out.join("\n");
}
