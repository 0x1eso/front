import type { WwExileView } from "@openfront/engine-api/ww1936/EndgameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { countryText } from "./EndgameNames";
import { regionName } from "./LandModel";
import { WW_BAND_PX, type WwGame } from "./WorldWarModel";
import { OpenWwPoliticsEvent } from "./WwDrawer";

/**
 * The band's top, in CSS px: under the top band and the world news line
 * (WwNewsTicker, WW_BAND_PX + 4, 36 px tall), which it never hides.
 */
export const EXILE_BAND_TOP = WW_BAND_PX + 44;

/** A seat with no region: shown as a dash. */
const NONE = "—";

export interface ExileBandView {
  /** "Government in exile — London · legitimacy 54% (+0.12/day) · …". */
  text: string;
}

/**
 * The seat of a government in exile (spec §20.6, "망명 정부 — 런던"): its
 * host's capital region, else the host country.
 */
function seatName(game: WwGame, host: number): string {
  const s = game.worldWarScenario();
  const tag = s?.tagOfSmallId(host);
  const tile = s && tag ? s.capitalTileOrNull(tag) : null;
  const region = s && tile !== null ? regionName(s, s.regionAt(tile)) : "";
  return region || countryText(game, host) || NONE;
}

/**
 * Spec §20.6: the band of a human whose country is a government in exile —
 * the seat, the legitimacy and its daily change, the virtual factories and
 * the capital to retake; null otherwise.
 */
export function exileBandModel(game: WwGame): ExileBandView | null {
  const me = game.myPlayer();
  const eg = game.wwEndgame?.() ?? null;
  const s = game.worldWarScenario();
  if (me === null || eg === null || s === null) return null;
  const e: WwExileView | undefined = eg.exiles.find(
    (x) => x.smallID === me.smallID(),
  );
  if (e === undefined) return null;
  const capital = e.capital > 0 ? regionName(s, e.capital) : "";
  // No capital to retake: the band's last segment ("… · retake the capital:
  // {capital}") is left out, in every language.
  const mark = "\u0000";
  const text = translateText("ww1936.exile.band", {
    host: seatName(game, e.host),
    pct: Math.floor(e.legitBp / 100),
    trend: e.deltaBp / 100,
    n: e.virtualMil,
    capital: capital || mark,
  });
  const at = text.indexOf(mark);
  if (at < 0) return { text };
  const cut = text.lastIndexOf(" · ", at);
  return { text: (cut < 0 ? text.slice(0, at) : text.slice(0, cut)).trimEnd() };
}

/**
 * World War 1936 P5 (spec §10, §20.6): under the top band, for a human
 * playing a government in exile — "🏳 Government in exile — London ·
 * legitimacy 54% (+0.12/day) · virtual factories 5 · retake the capital:
 * Warsaw". A tap opens the politics drawer's government tab (its exile
 * line). Over the leaderboard (z-900) like the news line, under the
 * drawers and the hover card.
 */
@customElement("ww-exile-band")
export class WwExileBand extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private model: ExileBandView | null = null;
  /** What the model was made from: it is made again only when one changes. */
  private madeFrom: readonly unknown[] = [];
  /** When the "exile ended" line goes away (ms), 0 when not showing. */
  private endedUntil = 0;

  createRenderRoot() {
    return this;
  }

  init() {}

  getTickIntervalMs() {
    return 500;
  }

  tick() {
    if (!this.game?.worldWarScenario()) return;
    const from = [this.game.wwEndgame()?.exiles, this.game.myPlayer()];
    if (from.every((v, i) => v === this.madeFrom[i])) return;
    this.madeFrom = from;
    let m = exileBandModel(this.game);
    // The exile ended (home again, or gone): say so for a few seconds.
    if (m === null && this.model !== null && this.endedUntil === 0) {
      this.endedUntil = Date.now() + 5000;
    }
    if (m === null && this.endedUntil > Date.now()) {
      m = {
        text: translateText(
          this.game.myPlayer()?.isAlive()
            ? "ww1936.exile.return"
            : "ww1936.exile.ended",
        ),
      };
      this.madeFrom = [];
    } else if (m === null) {
      this.endedUntil = 0;
    }
    if (m?.text !== this.model?.text) this.model = m;
  }

  render() {
    const m = this.model;
    if (m === null) return nothing;
    return html`<button
      type="button"
      data-ww-exile-band
      aria-label=${`${m.text} — ${translateText("ww1936.exile.open_government")}`}
      class="fixed left-1/2 z-[1004] flex min-h-9 max-w-[min(90vw,560px)] -translate-x-1/2 items-center gap-2 rounded-md border border-sky-300/40 bg-gray-900/90 px-3 py-1 text-xs text-white shadow-lg"
      style="top: ${EXILE_BAND_TOP}px"
      @click=${() => this.eventBus.emit(new OpenWwPoliticsEvent("government"))}
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      <span aria-hidden="true">🏳</span>
      <span data-ww-exile-text class="min-w-0 text-left leading-tight"
        >${m.text}</span
      >
    </button>`;
  }
}
