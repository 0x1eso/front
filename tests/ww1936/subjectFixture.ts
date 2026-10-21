// World War 1936 P5 lane S: test content for the subject tests — the
// endgame fixture plus the generic call to arms, the upgrade request and the
// subject decisions with the conditions that are lane E's removed.
import { ENDGAME_DECISIONS } from "@openfront/engine-lib/ww1936/content/decisions/endgame";
import { ENDGAME_EVENTS } from "@openfront/engine-lib/ww1936/content/events/endgame";
import { GENERIC_EVENTS } from "@openfront/engine-lib/ww1936/content/events/generic";
import type { ContentRegistry } from "@openfront/engine-lib/ww1936/content/registry";
import { endgameFixture } from "./endgameFixture";
import { politicsFixture } from "./politicsFixture";

const IDS = [
  "gen_request_autonomy",
  "gen_demand_autonomy",
  "gen_tighten_control",
  "gen_annex_subject",
];

export function subjectFixture(): ContentRegistry {
  const base = politicsFixture();
  const have = new Set(base.events.map((e) => e.id));
  const events = [...GENERIC_EVENTS, ...ENDGAME_EVENTS].filter(
    (e) =>
      (e.id === "gen_call_to_arms" || e.id === "gen_subject_upgrade") &&
      !have.has(e.id),
  );
  const decisions = ENDGAME_DECISIONS.filter((d) => IDS.includes(d.id)).map(
    (d) => {
      const { visible, available, ...rest } = d;
      void visible;
      void available;
      return d.target === undefined
        ? rest
        : { ...rest, target: { among: { all: [] } } };
    },
  );
  const ref = endgameFixture();
  return endgameFixture({
    events: [...ref.events, ...events],
    decisions: [...ref.decisions, ...decisions],
  });
}
