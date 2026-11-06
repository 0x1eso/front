import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { all, any, GwCond, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

/** A task of a game: judged at the end by plain conditions, shown from start. */
export interface GwMandate {
  readonly id: string;
  /** One is drawn from each group, so three never pull the same way. */
  readonly group: "war" | "home" | "name";
  readonly met: GwCond;
}

const atWar: GwCond = world({ is: "war" });

/** Design §2.6: twelve a country, three a game. */
export const GW_MANDATES: Readonly<Partial<Record<GwTag, readonly GwMandate[]>>> =
  {
    DEU: [
      {
        id: "deu_paris_by_winter",
        group: "war",
        met: world({ is: "front", theatre: "west", from: "aisne" }),
      },
      {
        id: "deu_east_prussia_holds",
        group: "war",
        met: world({ is: "front", theatre: "east", from: "east_prussia" }),
      },
      {
        id: "deu_keep_britain_out",
        group: "war",
        met: not(world({ is: "entered", tag: "GBR", side: "entente" })),
      },
      {
        id: "deu_no_great_war",
        group: "war",
        met: not(atWar),
      },
      {
        id: "deu_bread_for_the_winter",
        group: "home",
        met: { kind: "gauge", gauge: "bread", min: 1 },
      },
      {
        id: "deu_shells_in_store",
        group: "home",
        met: { kind: "gauge", gauge: "shells", min: 1 },
      },
      {
        id: "deu_quiet_streets",
        group: "home",
        met: world({ is: "unrest", max: 0 }),
      },
      {
        id: "deu_reichstag_with_you",
        group: "home",
        met: { kind: "inst", inst: "reichstag", min: 0 },
      },
      {
        id: "deu_master_of_the_army",
        group: "name",
        met: { kind: "inst", inst: "army", max: 1 },
      },
      {
        id: "deu_vienna_stands",
        group: "name",
        met: any(
          not(world({ is: "out", tag: "AUH" })),
          { kind: "trust", tag: "AUH", min: 1 },
        ),
      },
      {
        id: "deu_small_butcher_bill",
        group: "name",
        met: world({ is: "casualties", max: 500 }),
      },
      {
        id: "deu_chancellor_stays",
        group: "name",
        met: all({ kind: "inst", inst: "countersign", min: 0 }),
      },
    ],
  };
