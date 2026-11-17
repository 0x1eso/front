// ww241: a country's diplomatic ties on the map's country card (owner:
// "그 나라 누르면 누가 독보 걸었는지 누가 동맹인지 이런거 보여주게"). Its
// faction (leader and members), wars, overlord or subjects, guarantees
// given and received, pacts, military access and exile host. Every tie is
// in the views every client already has (politics' global lists, the
// war pairs, the endgame's subjects and exiles), all public as in HOI:
// nothing here reads a country's hidden detail. Display only.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { translateText } from "../../Utils";
import { subjectLevelName } from "./EndgameModel";
import {
  countryName,
  enemiesOf,
  factionName,
  liveFactions,
  type WwGame,
} from "./WorldWarModel";
import { imjinCalendarOn } from "./WwClientCalendar";

/** Names a row shows before "and N more". */
export const TIES_MAX_NAMES = 4;

export type TieRowId =
  | "faction"
  | "allies"
  | "war"
  | "overlord"
  | "subjects"
  | "guaranteed_by"
  | "guarantees"
  | "nap"
  | "access_has"
  | "access_gives"
  | "exile";

export interface TieCountry {
  tag: CountryTag;
  name: string;
}

export interface TieRow {
  id: TieRowId;
  /** "Guaranteed by", "At war with"… */
  label: string;
  /** Text before the countries (the faction's name and leader); "" none. */
  lead: string;
  /** The first TIES_MAX_NAMES countries. */
  countries: TieCountry[];
  /** "+3 more"; "" when all fit. */
  more: string;
  /** Text after the countries (a subject's level); "" none. */
  note: string;
}

const KEY = "ww1936.ties.";

/**
 * The rows of country `id`'s ties, in the card's order; empty rows are
 * left out, so a country with no ties has none.
 */
export function countryTies(game: WwGame, id: number): TieRow[] {
  const sc = game.worldWarScenario();
  if (sc === null || id <= 0) return [];
  const eg = game.wwEndgame?.() ?? null;
  const global = game.wwPolitics?.()?.global ?? null;
  const tagOf = (x: number): CountryTag | null => {
    if (x <= 0 || x === id) return null;
    // A slot not (or no longer) in play has no ties to show.
    const st = eg?.countryState(x) ?? null;
    if (st === "dormant" || st === "gone") return null;
    return sc.tagOfSmallId(x) ?? null;
  };
  const rows: TieRow[] = [];
  const push = (
    rowId: TieRowId,
    ids: readonly number[],
    lead = "",
    note = "",
  ) => {
    const seen = new Set<number>();
    const all: TieCountry[] = [];
    for (const x of ids) {
      if (seen.has(x)) continue;
      seen.add(x);
      const tag = tagOf(x);
      if (tag !== null) all.push({ tag, name: countryName(tag) });
    }
    if (all.length === 0 && lead === "") return;
    const extra = all.length - TIES_MAX_NAMES;
    rows.push({
      id: rowId,
      label: translateText(`${KEY}${rowId}`),
      lead,
      countries: all.slice(0, TIES_MAX_NAMES),
      more: extra > 0 ? translateText(`${KEY}more`, { n: extra }) : "",
      note,
    });
  };

  // The faction: its name and leader, then its other members. The Imjin
  // War has no 1936 factions (ImjinOrderModel): its members read as allies.
  const f = liveFactions(game).find((x) => x.members.includes(id));
  if (f !== undefined) {
    if (imjinCalendarOn()) {
      push("allies", f.members);
    } else {
      const name = factionName(f.id, game);
      const leader = tagOf(f.leader);
      const lead =
        f.leader === id
          ? translateText(`${KEY}faction_leader`, { faction: name })
          : leader !== null
            ? translateText(`${KEY}faction_led`, {
                faction: name,
                leader: countryName(leader),
              })
            : name;
      push(
        "faction",
        f.members.filter((m) => m !== f.leader),
        lead,
      );
    }
  }

  push("war", enemiesOf(game, id));

  const sub = eg?.subjectOf(id) ?? null;
  if (sub !== null) {
    push("overlord", [sub.overlord], "", subjectLevelName(sub.level));
  }
  push(
    "subjects",
    (eg?.subjects ?? []).filter((s) => s.overlord === id).map((s) => s.subject),
  );

  const guarantees = global?.guarantees ?? [];
  push(
    "guaranteed_by",
    guarantees.filter(([, to]) => to === id).map(([by]) => by),
  );
  push(
    "guarantees",
    guarantees.filter(([by]) => by === id).map(([, to]) => to),
  );
  push(
    "nap",
    (global?.naps ?? []).flatMap(([a, b]) =>
      a === id ? [b] : b === id ? [a] : [],
    ),
  );
  // [by, from]: `by` may move through `from`'s land.
  const access = global?.access ?? [];
  push(
    "access_has",
    access.filter(([by]) => by === id).map(([, from]) => from),
  );
  push(
    "access_gives",
    access.filter(([, from]) => from === id).map(([by]) => by),
  );

  const exile = eg?.exiles.find((e) => e.smallID === id) ?? null;
  if (exile !== null) push("exile", [exile.host]);
  return rows;
}
