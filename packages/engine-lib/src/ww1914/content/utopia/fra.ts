import type { GwNodeRow, GwTreeRow, GwUtopiaContent } from "../../UtopiaRows";

// ww207 (W-FRA): FRA's faction trees: a template each, with one node of their
// own, the faction's exclusive law (content/laws/fraPeace.ts, `exclusive`
// on node `law`), in place of the template's first bold node. Text:
// resources/ww1914/ko/FRA.house.json `utopia.<id>` (name, note, the own
// node's words). See /home/eser/dev/ww207-format.md.
//
// Only Action française's restoration removes the President (design §5):
// the regime `fra_crown` (S2 makes it) and the head `orleans`, Philippe
// d'Orléans, the Orléanist pretender in 1914 (lane P's ruler row; he lived in
// exile under the 1886 law, F: Brussels in the war years). The Tiger's
// government is the existing `fra_tiger`. The born and small factions take a
// template only (content/house/fra.ts `template`): Caillaux's men and the
// minority peace, the Republican-Socialists parliament, the Federation
// nation, the GQG crown_army.
const lawNode = (law: string): GwNodeRow & { readonly replaces: string } => ({
  id: "law",
  replaces: "b1",
  tier: "bold",
  kind: "law",
  law,
});

const TREES: readonly GwTreeRow[] = [
  {
    faction: "fra_radicals",
    template: "parliament",
    utopia: "fra_radical_republic",
    own: [lawNode("fra_law_free_school")],
  },
  {
    faction: "fra_sfio",
    template: "labour",
    utopia: "fra_social_republic",
    own: [lawNode("fra_law_nationalise")],
  },
  {
    faction: "fra_left_rep",
    template: "market_empire",
    utopia: "fra_greater_france",
    own: [lawNode("fra_law_colonies")],
  },
  {
    faction: "fra_catholics",
    template: "church",
    utopia: "fra_catholic_france",
    own: [lawNode("fra_law_congregations")],
  },
  {
    faction: "fra_af",
    template: "crown_army",
    utopia: "fra_restoration",
    own: [lawNode("fra_law_exile")],
    regime: "fra_crown",
    head: "orleans",
  },
  {
    faction: "fra_tiger",
    template: "nation",
    utopia: "fra_salvation",
    own: [lawNode("fra_law_full_powers")],
    regime: "fra_tiger",
  },
];

export const FRA_UTOPIA: GwUtopiaContent = { trees: TREES };
