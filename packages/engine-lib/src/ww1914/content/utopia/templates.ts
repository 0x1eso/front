import type { GwGauge } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import {
  GW_TREE_TEMPLATES,
  type GwAxisPush,
  type GwNodeKind,
  type GwNodeTier,
  type GwTreeTemplate,
} from "@openfront/engine-api/ww1914/GwSociety";
import type { GwEffect } from "@openfront/engine-api/ww1914/SceneDsl";
import type {
  GwNodeRow,
  GwTreeTemplateRow,
  GwUtopiaContent,
} from "../../UtopiaRows";

// ww207 (C): the seven tree templates, nine nodes each (m1-m3, b1-b3, x1-x3):
// 의회, 노동, 왕권과 군, 민족, 교회, 시장과 제국, 평화. Text gw.utopia.template.*
// and gw.utopia.node.<template>.<node> (C); institutions gw.utopia.institution.*.
//
// The templates are common to every seat, so they name no seat's law, power
// or faction. A seat's tree (content/utopia/<tag>.ts, W lanes) bends them:
// `law` on the law nodes (its exclusive law rows), `power` on the ability
// node (b2, the faction's ability), its own words in the pack, and `axes`
// where its faction pulls the other way (Russian nationalists on `nation`,
// Tisza's Magyars on `dual`). An axis a seat lacks is no push there.
//
// Pushes are notches (GW_AXIS_NOTCHES a step): a moderate node 2, a bold one
// 3, an extreme one 5; a bill moves one. Perks are once, on opening.

const M = 2;
const B = 3;
const X = 5;

const gauge = (g: GwGauge, delta: number): GwEffect => ({
  kind: "gauge",
  gauge: g,
  delta,
});
const opinion = (bloc: GwBloc, delta: number): GwEffect => ({
  kind: "opinion",
  bloc,
  delta,
});

interface NodeMore {
  readonly institution?: string;
  readonly effects?: readonly GwEffect[];
  readonly axes?: GwAxisPush;
}

const node = (
  id: string,
  tier: GwNodeTier,
  kind: GwNodeKind,
  more: NodeMore = {},
): GwNodeRow => ({ id, tier, kind, ...more });

/** The ability node every template has: the faction's own ability grows (W: `power`). */
const ability = (): GwNodeRow => node("b2", "bold", "ability");

/** 의회: the house holds the purse, then the ministers, then the state. */
const PARLIAMENT: GwTreeTemplateRow = {
  id: "parliament",
  nodes: [
    node("m1", "moderate", "law", { axes: { rule: M } }),
    node("m2", "moderate", "institution", {
      institution: "inquiry",
      effects: [opinion("parliament", 1)],
    }),
    node("m3", "moderate", "perk", { effects: [opinion("press", 1)] }),
    node("b1", "bold", "law", { axes: { rule: B } }),
    ability(),
    node("b3", "bold", "institution", {
      institution: "party_press",
      effects: [opinion("press", 1), opinion("parliament", 1)],
    }),
    node("x1", "extreme", "law", {
      axes: { rule: X },
      effects: [opinion("court", -2), opinion("army", -1)],
    }),
    node("x2", "extreme", "institution", {
      institution: "constituent",
      axes: { rule: B },
      effects: [opinion("court", -1)],
    }),
    node("x3", "extreme", "perk", {
      effects: [opinion("workers", 1), opinion("business", -1)],
    }),
  ],
};

/** 노동: the working day, the unions, then the works themselves. */
const LABOUR: GwTreeTemplateRow = {
  id: "labour",
  nodes: [
    node("m1", "moderate", "law", {
      axes: { class: M },
      effects: [opinion("workers", 1), opinion("business", -1)],
    }),
    node("m2", "moderate", "institution", {
      institution: "labour_office",
      effects: [opinion("workers", 1)],
    }),
    node("m3", "moderate", "perk", { effects: [gauge("order", 1)] }),
    node("b1", "bold", "law", {
      axes: { class: B },
      effects: [gauge("money", -1), opinion("workers", 1)],
    }),
    ability(),
    node("b3", "bold", "institution", {
      institution: "factory_councils",
      effects: [opinion("workers", 1), opinion("business", -1)],
    }),
    node("x1", "extreme", "law", {
      axes: { class: X },
      effects: [opinion("business", -2), gauge("money", -1)],
    }),
    node("x2", "extreme", "institution", {
      institution: "workers_councils",
      axes: { class: B },
      effects: [opinion("army", -1), opinion("court", -1)],
    }),
    node("x3", "extreme", "perk", {
      effects: [gauge("shells", 1), opinion("business", -1)],
    }),
  ],
};

/** 왕권과 군: the army's money, its courts, then its rule. */
const CROWN_ARMY: GwTreeTemplateRow = {
  id: "crown_army",
  nodes: [
    node("m1", "moderate", "law", {
      axes: { rule: -M, force: -M },
      effects: [opinion("army", 1)],
    }),
    node("m2", "moderate", "institution", {
      institution: "military_cabinet",
      effects: [opinion("army", 1), opinion("parliament", -1)],
    }),
    node("m3", "moderate", "perk", {
      effects: [{ kind: "inst", inst: "army", delta: 1 }],
    }),
    node("b1", "bold", "law", {
      axes: { rule: -B },
      effects: [gauge("order", 1), opinion("press", -1)],
    }),
    ability(),
    node("b3", "bold", "institution", {
      institution: "censor_office",
      effects: [{ kind: "censor", delta: 1 }, opinion("press", -1)],
    }),
    node("x1", "extreme", "law", {
      axes: { rule: -X },
      effects: [opinion("parliament", -2), opinion("workers", -1)],
    }),
    node("x2", "extreme", "institution", {
      institution: "staff_rule",
      axes: { force: -B },
      effects: [opinion("army", 1), opinion("parliament", -1)],
    }),
    node("x3", "extreme", "perk", {
      effects: [gauge("order", 2), gauge("morale", -1)],
    }),
  ],
};

/** 민족: its schools, its councils, then its own government. */
const NATION: GwTreeTemplateRow = {
  id: "nation",
  nodes: [
    node("m1", "moderate", "law", { axes: { nations: M, dual: M, union: M } }),
    node("m2", "moderate", "institution", {
      institution: "national_council",
      effects: [opinion("press", 1)],
    }),
    node("m3", "moderate", "perk", { effects: [gauge("order", 1)] }),
    node("b1", "bold", "law", { axes: { nations: B, dual: B, union: B } }),
    ability(),
    node("b3", "bold", "institution", {
      institution: "national_guard",
      effects: [opinion("army", -1)],
    }),
    node("x1", "extreme", "law", {
      axes: { nations: X, dual: X, union: X },
      effects: [opinion("court", -1), opinion("army", -1)],
    }),
    node("x2", "extreme", "institution", {
      institution: "national_government",
      axes: { nations: B, dual: B, union: B },
      effects: [opinion("court", -1)],
    }),
    node("x3", "extreme", "perk", { effects: [gauge("morale", 1)] }),
  ],
};

/** 교회: its schools, its orders, then a church of the state. */
const CHURCH: GwTreeTemplateRow = {
  id: "church",
  nodes: [
    node("m1", "moderate", "law", {
      axes: { church: -M },
      effects: [opinion("court", 1)],
    }),
    node("m2", "moderate", "institution", {
      institution: "faithful_union",
      effects: [gauge("order", 1)],
    }),
    node("m3", "moderate", "perk", { effects: [gauge("bread", 1)] }),
    node("b1", "bold", "law", {
      axes: { church: -B },
      effects: [opinion("press", -1)],
    }),
    ability(),
    node("b3", "bold", "institution", {
      institution: "church_press",
      effects: [gauge("morale", 1)],
    }),
    node("x1", "extreme", "law", {
      axes: { church: -X },
      effects: [opinion("workers", -1), opinion("press", -1)],
    }),
    node("x2", "extreme", "institution", {
      institution: "moral_watch",
      axes: { church: -B },
      effects: [gauge("order", 1), opinion("press", -1)],
    }),
    node("x3", "extreme", "perk", {
      effects: [gauge("morale", 1), gauge("order", 1)],
    }),
  ],
};

/** 시장과 제국: trade, the Empire's tariff, then capital's free hand. */
const MARKET_EMPIRE: GwTreeTemplateRow = {
  id: "market_empire",
  nodes: [
    node("m1", "moderate", "law", {
      axes: { class: -M },
      effects: [gauge("money", 1)],
    }),
    node("m2", "moderate", "institution", {
      institution: "chamber_commerce",
      effects: [opinion("business", 1)],
    }),
    node("m3", "moderate", "perk", { effects: [gauge("money", 1)] }),
    node("b1", "bold", "law", {
      axes: { union: -B, class: -M },
      effects: [opinion("business", 1), opinion("workers", -1)],
    }),
    ability(),
    node("b3", "bold", "institution", {
      institution: "overseas_bank",
      effects: [gauge("money", 1)],
    }),
    node("x1", "extreme", "law", {
      axes: { class: -X },
      effects: [opinion("workers", -2), gauge("order", -1)],
    }),
    node("x2", "extreme", "institution", {
      institution: "imperial_council",
      axes: { union: -B, force: -M },
      effects: [opinion("business", 1)],
    }),
    node("x3", "extreme", "perk", { effects: [gauge("money", 2)] }),
  ],
};

/** 평화: arbitration, open diplomacy, then a peace with no annexations. */
const PEACE: GwTreeTemplateRow = {
  id: "peace",
  nodes: [
    node("m1", "moderate", "law", {
      axes: { force: M },
      effects: [opinion("army", -1)],
    }),
    node("m2", "moderate", "institution", {
      institution: "peace_society",
      effects: [gauge("order", 1)],
    }),
    node("m3", "moderate", "perk", { effects: [gauge("morale", 1)] }),
    node("b1", "bold", "law", {
      axes: { force: B },
      effects: [opinion("press", 1), opinion("court", -1)],
    }),
    ability(),
    node("b3", "bold", "institution", {
      institution: "mediation_office",
      effects: [opinion("parliament", 1)],
    }),
    node("x1", "extreme", "law", {
      axes: { force: X },
      effects: [opinion("army", -2)],
    }),
    node("x2", "extreme", "institution", {
      institution: "peace_congress",
      axes: { force: B },
      effects: [opinion("court", -1)],
    }),
    node("x3", "extreme", "perk", {
      effects: [gauge("morale", 2), { kind: "inst", inst: "army", delta: -2 }],
    }),
  ],
};

const ROWS: Readonly<Record<GwTreeTemplate, GwTreeTemplateRow>> = {
  parliament: PARLIAMENT,
  labour: LABOUR,
  crown_army: CROWN_ARMY,
  nation: NATION,
  church: CHURCH,
  market_empire: MARKET_EMPIRE,
  peace: PEACE,
};

export const UTOPIA_TEMPLATES: GwUtopiaContent = {
  templates: GW_TREE_TEMPLATES.map((t) => ROWS[t]),
};
