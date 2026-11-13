import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwSocietyContent } from "../../SocietyRows";
import { warAge } from "../house/kit";

// ww207 (S1): the generic parties any seat can see born (a peasants' party, a
// nationalist party of a community, a veterans' league, a peace party). Text:
// resources/ww1914/ko/common.house.json `factions.<generic id>` (C). Ideals on
// axes a seat lacks are dropped (GenericParties.ts); the nationalist party
// takes its community's ideal. A generic is born only from a hot community
// whose ideal it holds, or when the axes have moved on all three
// (Society.ts births).
export const COMMON_SOCIETY: GwSocietyContent = {
  generic: [
    // The land for those who till it, a voice for the villages.
    {
      kind: "peasants",
      bloc: "parliament",
      ideals: { class: 1, rule: 1 },
      template: "labour",
    },
    // A people's own party: its community's ideal, and a parliament.
    {
      kind: "nationalist",
      bloc: "parliament",
      ideals: { rule: 1 },
      template: "nation",
    },
    // The men back from the front: order, force, the nation one.
    {
      kind: "veterans",
      bloc: "army",
      ideals: { rule: -1, force: -1, union: -1, nations: -1 },
      template: "crown_army",
      when: warAge(12),
    },
    // An end to the war, whatever it takes.
    {
      kind: "peace",
      bloc: "workers",
      ideals: { force: 1, rule: 1, class: 1 },
      template: "peace",
      when: world({ is: "war" }),
    },
  ],
};
