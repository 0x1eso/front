// Great War 1914 (ww173 phase B): RUS's scenes of its great offensives:
// the plan laid out (`rus_w_off_prep`), each round's result
// (`rus_w_off_result`), an enemy offensive met (`rus_w_off_defended`), the
// army's refusal (`rus_w_off_mutiny`). Owned by the RUS writer lane; shapes
// and conditions in /home/eser/dev/ww173-formatb.md. Text in
// resources/ww1914/ko/RUS.offensive.json.
//
// The anchors are flavour the state calls, never a date: a broad front in the
// east reads as Brusilov's (June 1916), a long bombardment as Lake Naroch's
// (March 1916), a surprise in the east as the Christmas battles at Mitau
// (January 1917), the Caucasus as Yudenich's winter road to Erzurum; met, a
// long one reads as Gorlice (May 1915), a surprise as Riga (September 1917),
// the Caucasus held as Sarikamish (December 1914).
import type {
  GwOffMethod,
  GwOffResult,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { all } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

// ---- Conditions: one leaf per thing, so a closer fit outranks a looser ----

type Side = "ours" | "foe";
const at = (side: Side, ...theatre: GwTheatre[]): GwCond =>
  world({ is: "offensive", side, theatre });
const by = (side: Side, ...method: GwOffMethod[]): GwCond =>
  world({ is: "offensive", side, method });
const came = (side: Side, ...result: GwOffResult[]): GwCond =>
  world({ is: "offensive", side, result });
/** The offensive's round is at least `min` (pressing on). */
const later = (side: Side, min: number): GwCond =>
  world({ is: "offensive", side, min });
const winter = world({ is: "month", of: [12, 1, 2] });
const thaw = world({ is: "month", of: [3, 4] });

// ---- Effects: small, never the line ----

type Ear = "court" | "stavka" | "duma" | "ministers";
const ear = (inst: Ear, delta: number): GwEffect => ({
  kind: "inst",
  inst,
  delta,
});
const gauge = (g: "morale" | "order", delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const remember = (key: string): GwEffect => ({ kind: "remember", key });

// ---- Shapes ----

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const opt = (id: string, effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects,
});

const scene = (
  id: string,
  kind: "report" | "proposal",
  variants: GwVariant[],
  more: Partial<GwScene> = {},
): GwScene => ({
  id,
  nation: ["RUS"],
  kind,
  scheduledOnly: true,
  cast: {},
  salience: 8,
  tags: ["war"],
  variants,
  ...more,
});

export const RUS_OFFENSIVE_SCENES: readonly GwScene[] = [
  // The chapter after the Tsar signs "대공세를 준비한다": the plan on the table.
  scene(
    "rus_w_off_prep",
    "proposal",
    [
      v("east_broad", all(at("ours", "east"), by("ours", "broad"))),
      v("east_winter", all(at("ours", "east"), by("ours", "surprise"), winter)),
      v("east_surprise", all(at("ours", "east"), by("ours", "surprise"))),
      v("east_long", all(at("ours", "east"), by("ours", "long"))),
      v("caucasus_winter", all(at("ours", "caucasus"), winter)),
      v("caucasus", at("ours", "caucasus")),
      v("base"),
    ],
    {
      // Whoever holds the staff lays it out; the favourite if nobody does.
      cast: {
        cos: { any_of: [{ office: "chief_of_staff" }, { favourite: true }] },
      },
      fallback: "stavka_only",
      options: [
        opt("stavka_only", [
          ear("stavka", 1),
          ear("ministers", -1),
          remember("k_off_kept_close"),
        ]),
        opt("icon", [ear("court", 1), remember("k_off_blessed")]),
        opt("tell_allies", [
          { kind: "trust", tag: "FRA", delta: 1 },
          { kind: "trust", tag: "GBR", delta: 1 },
          remember("k_off_told_allies"),
        ]),
      ],
    },
  ),
  // After each round of our own offensive.
  scene("rus_w_off_result", "report", [
    v(
      "lutsk",
      all(at("ours", "east"), by("ours", "broad"), came("ours", "break")),
    ),
    v("erzurum", all(at("ours", "caucasus"), came("ours", "break"))),
    v("break", came("ours", "break")),
    v("marsh", all(later("ours", 2), came("ours", "bite", "attrition"))),
    v("bite", came("ours", "bite")),
    v("attrition", came("ours", "attrition")),
    v("thaw", all(by("ours", "long"), came("ours", "repulsed"), thaw)),
    v("wire", all(by("ours", "long"), came("ours", "repulsed"))),
    v("unheard", all(by("ours", "surprise"), came("ours", "repulsed"))),
    v("repulsed", came("ours", "repulsed")),
    v("base"),
  ]),
  // After each round of an enemy offensive on our front.
  scene("rus_w_off_defended", "report", [
    v("gorlice", all(by("foe", "long"), came("foe", "break", "bite"))),
    v("riga", all(by("foe", "surprise"), came("foe", "break", "bite"))),
    v(
      "sarikamish",
      all(at("foe", "caucasus"), came("foe", "repulsed", "attrition"), winter),
    ),
    v("gave", came("foe", "break", "bite")),
    v("held_again", all(later("foe", 2), came("foe", "repulsed", "attrition"))),
    v("held", came("foe", "repulsed", "attrition")),
    v("base"),
  ]),
  // Our repulsed army will not go again.
  scene(
    "rus_w_off_mutiny",
    "proposal",
    [
      v("siberians", all(by("ours", "surprise"), winter)),
      v("surprise", by("ours", "surprise")),
      v("long", by("ours", "long")),
      v("base"),
    ],
    {
      fallback: "courts",
      options: [
        opt("courts", [
          gauge("order", 1),
          gauge("morale", -1),
          ear("stavka", 1),
          remember("k_off_mutiny_courts"),
        ]),
        opt("rest", [
          gauge("morale", 1),
          ear("stavka", -1),
          remember("k_off_mutiny_rest"),
        ]),
        opt("visit", [
          ear("court", 1),
          ear("duma", -1),
          remember("k_off_mutiny_visit"),
        ]),
      ],
    },
  ),
];
