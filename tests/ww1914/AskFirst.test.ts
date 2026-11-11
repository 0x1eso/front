import { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwScene } from "@openfront/engine-api/ww1914/SceneDsl";
import {
  GW_CONTENT,
  useGwContent,
} from "@openfront/engine-lib/ww1914/content/Content";
import { askOffers, spentTalk } from "@openfront/engine/ww1914/AskFirst";
import {
  deskCandidates,
  makeCard,
  placeCard,
} from "@openfront/engine/ww1914/Desk";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { applyGwOrder, summonable } from "@openfront/engine/ww1914/Orders";
import { ctxOf, optionOpen, sceneOf } from "@openfront/engine/ww1914/SceneRun";
import { describe, expect, test } from "vitest";
import { gwRunner } from "./util";

// ww172: a decision's option that only a talk's memory opens can be asked for
// from the decision; a talk with nothing left to open no longer comes.

async function seatOf(tag: GwSeatState["tag"]) {
  const { runner } = await gwRunner({ greatWar1914Calendar: "full" });
  const gw = runner.game.greatWar()!;
  const st = gw.s.seats[0];
  st.tag = tag;
  st.desk = [];
  st.audiences = 2;
  return { gw, st };
}

function lay(gw: GreatWar, st: GwSeatState, id: string) {
  const card = makeCard(gw, st, sceneOf(id)!, "desk")!;
  placeCard(gw, st, card);
  return card;
}

/** Asks `topic` from `card`, takes `first` (or the first open reply), then plays it out. */
function askAndTalk(
  gw: GreatWar,
  st: GwSeatState,
  uid: number,
  topic: string,
  first: string,
): void {
  expect(applyGwOrder(gw, st, { kind: "ask", card: uid, topic })).toBeNull();
  const talk = st.desk.find((c) => c.scene === topic)!;
  expect(talk.ask?.from).toBe(uid);
  const scene = sceneOf(topic)! as GwScene;
  let pick: string | undefined = first;
  for (let guard = 0; guard < 20 && st.desk.includes(talk); guard++) {
    const node = scene.nodes![talk.node!];
    const open = node.replies.filter((r) => optionOpen(ctxOf(gw, st, talk), r));
    const r =
      open.find((x) => x.id === pick) ??
      open.find((x) => x.kind !== "leave") ??
      open[0];
    pick = undefined;
    expect(
      applyGwOrder(gw, st, { kind: "reply", card: talk.uid, reply: r.id }),
    ).toBeNull();
  }
  expect(st.desk.includes(talk)).toBe(false);
}

describe("ask first", () => {
  test("prussia_first opens by asking Nikolasha from rus_c_both_fronts", async () => {
    const { gw, st } = await seatOf("RUS");
    const card = lay(gw, st, "rus_c_both_fronts");
    const offers = askOffers(gw, st, card);
    const nik = offers.find((x) => x.topic === "rus_t_nik_prussia")!;
    expect(nik.who).toBe("rus_nikolasha");
    expect(nik.options).toEqual(["prussia_first"]);
    // One button per talk.
    expect(new Set(offers.map((x) => x.topic)).size).toBe(offers.length);
    askAndTalk(gw, st, card.uid, "rus_t_nik_prussia", "deal");
    expect(st.audiences).toBe(1);
    expect(st.desk.some((c) => c.uid === card.uid)).toBe(true);
    // Held once: not offered again.
    expect(
      askOffers(gw, st, card).some((x) => x.topic === "rus_t_nik_prussia"),
    ).toBe(false);
    expect(
      applyGwOrder(gw, st, {
        kind: "choose",
        card: card.uid,
        option: "prussia_first",
      }),
    ).toBeNull();
    expect(st.flags).toContain("f_prussia_first");
  });

  test("liege_first opens by asking Ludendorff from deu_c_mobilise", async () => {
    const { gw, st } = await seatOf("DEU");
    const card = lay(gw, st, "deu_c_mobilise");
    const lud = askOffers(gw, st, card).find(
      (x) => x.topic === "deu_t_lud_liege",
    );
    expect(lud?.options).toContain("liege_first");
    const scene = sceneOf("deu_c_mobilise")!;
    const opt = scene.options!.find((o) => o.id === "liege_first")!;
    expect(optionOpen(ctxOf(gw, st, card), opt)).toBe(false);
    // The first reply that remembers k_lud_liege by its price.
    const open = sceneOf("deu_t_lud_liege")!.nodes!.open.replies;
    const pays = open.find((r) =>
      r.effects.some((e) => e.kind === "remember" && e.key === "k_lud_liege"),
    );
    askAndTalk(gw, st, card.uid, "deu_t_lud_liege", pays?.id ?? "");
    expect(optionOpen(ctxOf(gw, st, card), opt)).toBe(true);
  });

  test("a dead person gives no button", async () => {
    const { gw, st } = await seatOf("RUS");
    gw.person("rus_nikolasha")!.status = "dead";
    const card = lay(gw, st, "rus_c_both_fronts");
    expect(
      askOffers(gw, st, card).some((x) => x.topic === "rus_t_nik_prussia"),
    ).toBe(false);
    expect(
      applyGwOrder(gw, st, {
        kind: "ask",
        card: card.uid,
        topic: "rus_t_nik_prussia",
      }),
    ).toBe("no_topic");
  });

  test("a spent talk isn't offered or picked", async () => {
    // A summoned and a dealt talk whose one key only a once paper reads.
    const talk = (id: string, summon: boolean): GwScene => ({
      id,
      nation: ["RUS"],
      kind: "talk",
      cast: { p: { person: "rus_sazonov" } },
      salience: 9,
      tags: ["people"],
      ...(summon ? { summon: true } : {}),
      who: "p",
      variants: [{ id: "base" }],
      start: "open",
      nodes: {
        open: {
          says: [{ id: "base" }],
          replies: [
            {
              id: "ask",
              stance: "frank",
              kind: "ask",
              tell: [],
              effects: [{ kind: "remember", key: "k_ww172_spent" }],
              next: null,
            },
          ],
        },
      },
    });
    const paper: GwScene = {
      id: "ww172_paper",
      nation: ["RUS"],
      kind: "crisis",
      cast: {},
      salience: 1,
      tags: ["home"],
      once: true,
      variants: [{ id: "base" }],
      options: [
        { id: "plain", tell: [], effects: [] },
        {
          id: "gated",
          when: { kind: "memory", key: "k_ww172_spent" },
          tell: [],
          effects: [],
        },
      ],
    };
    useGwContent({
      ...GW_CONTENT,
      scenes: [
        ...GW_CONTENT.scenes,
        talk("ww172_called", true),
        talk("ww172_dealt", false),
        paper,
      ],
    });
    try {
      const { gw, st } = await seatOf("RUS");
      const dealt = () =>
        deskCandidates(gw, st).some((c) => c.scene.id === "ww172_dealt");
      expect(summonable(gw, st, "rus_sazonov", "ww172_called")).toBe(true);
      expect(dealt()).toBe(true);
      // The paper on the desk still reads it.
      const card = lay(gw, st, "ww172_paper");
      expect(summonable(gw, st, "rus_sazonov", "ww172_called")).toBe(true);
      st.desk = st.desk.filter((c) => c.uid !== card.uid);
      expect(spentTalk(gw, st, sceneOf("ww172_called")!)).toBe(true);
      expect(summonable(gw, st, "rus_sazonov", "ww172_called")).toBe(false);
      expect(dealt()).toBe(false);
    } finally {
      useGwContent(null);
    }
  });
});
