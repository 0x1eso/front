import {
  CountryTag,
  isCountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import { hasImjinTerrain } from "@openfront/engine-lib/imjin/Terrain";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { RoutWatch } from "./ImjinLandModel";
import { regionName } from "./LandModel";
import { flagUrl, newsTag, newsText } from "./PoliticsModel";
import { countryName, WW_BAND_PX, WW_STRIP_EXTRA } from "./WorldWarModel";
import { OpenWwDiplomacyEvent } from "./WwDrawer";

/** Spec §21.7: a news line stays this long, ms. */
export const NEWS_SHOW_MS = 6000;
/** At most this many lines wait (the one shown included); more fold the oldest at once. */
export const NEWS_QUEUE = 3;

interface Line {
  tag: CountryTag | null;
  text: string;
}

/**
 * World War 1936 P3 (spec §21.7): world news, one line at a time, centred
 * under the top band — a flag and a sentence ("Germany has annexed
 * Austria"). Each shows for six seconds; at most three wait, and a fourth
 * folds the oldest at once. A tap opens the diplomacy drawer's world tab,
 * which keeps the last 30. Over the leaderboard (z-900), under the drawers
 * and the hover card, whose tabs and text it must never cover.
 */
@customElement("ww-news-ticker")
export class WwNewsTicker extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  @state() private queue: Line[] = [];
  /** When the first line of the queue went up (Date.now); 0: nothing shown. */
  private shownAt = 0;
  private routWatch: RoutWatch | null = null;
  private routVersion = -1;

  createRenderRoot() {
    return this;
  }

  init() {}

  getTickIntervalMs() {
    return 250;
  }

  tick() {
    const view = this.game?.wwPolitics?.() ?? null;
    if (view === null) return;
    const now = Date.now();
    let queue = this.queue;
    // The shown line's time is up: the next one goes up.
    if (queue.length > 0 && now - this.shownAt >= NEWS_SHOW_MS) {
      queue = queue.slice(1);
      this.shownAt = queue.length > 0 ? now : 0;
    }
    const fresh: Line[] = view.takeFreshNews().map((n) => ({
      tag: newsTag(n.params),
      text: newsText(this.game, n.id, n.params),
    }));
    fresh.push(...this.routLines());
    if (fresh.length > 0) {
      queue = [...queue, ...fresh];
      if (queue.length > NEWS_QUEUE) {
        // Too many waiting: the oldest fold at once.
        queue = queue.slice(queue.length - NEWS_QUEUE);
        this.shownAt = now;
      }
      if (this.shownAt === 0) this.shownAt = now;
    }
    if (queue !== this.queue) this.queue = queue;
  }

  /**
   * ww177 I3b (Imjin design §5): a news line when one of my armies breaks,
   * or one I fought. The first look only learns the armies.
   */
  private routLines(): Line[] {
    const land = this.game.wwLand?.() ?? null;
    const s = this.game.worldWarScenario();
    if (land === null || s === null || !hasImjinTerrain(s)) return [];
    if (land.version === this.routVersion) return [];
    this.routVersion = land.version;
    this.routWatch ??= new RoutWatch();
    const me = this.game.myPlayer()?.smallID() ?? 0;
    const out: Line[] = [];
    for (const r of this.routWatch.update(
      land.armies.values(),
      land.battles.values(),
    )) {
      if (me === 0 || (r.owner !== me && r.foe !== me)) continue;
      const tag = s.tagOfSmallId(r.owner) ?? null;
      out.push({
        tag: tag !== null && isCountryTag(tag) ? tag : null,
        text: translateText(
          r.owner === me ? "imjin.rout.news_mine" : "imjin.rout.news_foe",
          {
            place: regionName(s, r.region),
            country: tag !== null && isCountryTag(tag) ? countryName(tag) : "",
          },
        ),
      });
    }
    return out;
  }

  render() {
    const line = this.queue[0];
    if (line === undefined || !this.game?.worldWarScenario()) return nothing;
    return html`<button
      type="button"
      data-ww-news
      aria-label=${`${translateText("ww1936.eventui.news")}: ${line.text}`}
      class="fixed left-1/2 z-[960] flex max-w-[min(90vw,560px)] -translate-x-1/2 items-center gap-2 rounded-md border border-white/15 bg-gray-900/90 px-3 py-1 text-xs text-white shadow-lg min-h-9"
      style="top: calc(${WW_BAND_PX + 4}px + ${WW_STRIP_EXTRA})"
      @click=${() => this.eventBus.emit(new OpenWwDiplomacyEvent("world"))}
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      ${line.tag === null
        ? html`<span aria-hidden="true">📰</span>`
        : html`<img
            src=${flagUrl(line.tag)}
            alt=""
            class="h-3.5 w-5 shrink-0 rounded-sm object-cover"
          />`}
      <span data-ww-news-text class="min-w-0 truncate">${line.text}</span>
      ${this.queue.length > 1
        ? html`<span class="shrink-0 text-white/50"
            >${translateText("ww1936.eventui.more", {
              n: this.queue.length - 1,
            })}</span
          >`
        : nothing}
    </button>`;
  }
}
