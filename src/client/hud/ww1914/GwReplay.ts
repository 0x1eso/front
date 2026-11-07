import type { GwTheatre } from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_PLACES } from "@openfront/engine-api/ww1914/GwPlaces";
import { GW_CAPITALS } from "@openfront/engine-lib/ww1914/PlaceRules";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwMap } from "./GwMap";
import {
  GwReplayBeat,
  GwReplayClock,
  monthOf,
  replayClock,
} from "./GwPlaceModel";
import { BTN, CHIP, GLASS, HEAD, MUTED } from "./GwStyle";
import { frontLine } from "./GwText";

/** How long a place takes to change colour, ms. */
const SWEEP_MS = 650;

interface Sweep {
  tiles: number[];
  drawn: number;
  at: number;
}

/** A place on the caption, as it fell. */
export interface GwFallen {
  place: keyof typeof GW_PLACES;
  to: string;
  back: boolean;
}

/**
 * A month's front movement, played on the real map: the tiles that changed
 * were held back, and go on front by front while the camera follows.
 */
export class GwReplay {
  active = false;
  beat: GwReplayBeat | null = null;
  fallen: GwFallen[] = [];
  private beats: readonly GwReplayBeat[] = [];
  private clock: GwReplayClock = { beats: [], end: 0 };
  private started = 0;
  private beatAt = -1;
  private moveAt = 0;
  private sweeps: Sweep[] = [];
  private month = { year: 0, month: 0 };

  constructor(
    private readonly map: GwMap,
    private readonly redraw: () => void,
  ) {}

  /** Plays `beats`, for the month that began on `date`. */
  start(beats: readonly GwReplayBeat[], date: string): void {
    this.beats = beats;
    this.clock = replayClock(beats);
    this.month = monthOf(date);
    this.started = performance.now();
    this.beatAt = -1;
    this.moveAt = 0;
    this.fallen = [];
    this.sweeps = [];
    this.active = true;
    this.map.ring(null);
    this.redraw();
    requestAnimationFrame(() => this.frame());
  }

  /** Ends it now: what was left goes on the map at once. */
  skip(): void {
    if (!this.active) return;
    this.active = false;
    this.beat = null;
    for (const s of this.sweeps) this.map.draw(s.tiles.slice(s.drawn));
    this.sweeps = [];
    this.map.drawHeld();
    this.redraw();
  }

  title(): string {
    return translateText("gw.map.replay_title", this.month);
  }

  private frame(): void {
    if (!this.active) return;
    const t = performance.now() - this.started;
    if (t >= this.clock.end) {
      this.skip();
      return;
    }
    const next = this.clock.beats[this.beatAt + 1];
    if (next !== undefined && t >= next.at) this.nextBeat();
    const row = this.clock.beats[this.beatAt];
    while (row !== undefined && t >= (row.moves[this.moveAt] ?? Infinity)) {
      this.fall(this.moveAt++);
    }
    for (const s of this.sweeps) {
      const f = Math.min(1, (t - s.at) / SWEEP_MS);
      const to = Math.floor(s.tiles.length * f);
      this.map.draw(s.tiles.slice(s.drawn, to));
      s.drawn = to;
    }
    this.sweeps = this.sweeps.filter((s) => s.drawn < s.tiles.length);
    requestAnimationFrame(() => this.frame());
  }

  private nextBeat(): void {
    this.beatAt++;
    this.moveAt = 0;
    this.beat = this.beats[this.beatAt];
    this.fallen = [];
    this.map.lookWhole(this.beat.x, this.beat.y, this.beat.zoom);
    this.redraw();
  }

  private fall(i: number): void {
    const b = this.beat;
    const m = b?.moves[i];
    if (b === null || m === undefined) return;
    const home = GW_CAPITALS[m.to];
    const [x, y] = home === undefined ? [b.x, b.y] : GW_PLACES[home].center;
    const tiles = this.map.takeHeld(GW_PLACES[m.place].id, x, y);
    this.sweeps.push({
      tiles,
      drawn: 0,
      at: performance.now() - this.started,
    });
    this.map.flash(GW_PLACES[m.place].id);
    const back = GW_PLACES[m.place].owner === m.to;
    this.fallen.push({ place: m.place, to: m.to, back });
    this.redraw();
  }
}

function fallenLabel(f: GwFallen): string {
  return translateText(f.back ? "gw.map.retaken" : "gw.map.fell", {
    place: GW_PLACES[f.place].nameKo,
  });
}

function lineText(t: GwTheatre, b: GwReplayBeat): string {
  if (b.line === null) return "";
  return translateText("gw.map.replay_line", {
    from: frontLine(t, b.line.from),
    to: frontLine(t, b.line.to),
  });
}

/** Labels on the fallen places and the caption; the whole map stays in view. */
export function replayOverlay(r: GwReplay): TemplateResult {
  const b = r.beat;
  return html`${r.fallen.map((f) => {
      const [x, y] = GW_PLACES[f.place].center;
      return html`<div
        class="pointer-events-none fixed left-0 top-0 z-[885] whitespace-nowrap rounded bg-slate-900/85 px-2 py-0.5 text-xs font-bold text-amber-100"
        data-gw-at=${`${x} ${y}`}
        data-gw-fell=${f.place}
      >
        ${GW_PLACES[f.place].nameKo}
      </div>`;
    })}
    <div
      class="${GLASS} pointer-events-auto fixed inset-x-3 bottom-4 z-[1001] mx-auto max-w-[560px] space-y-1.5 rounded-md p-3 text-white"
      data-gw-replay
    >
      <div class="flex items-center gap-2">
        <h3 class=${HEAD}>${r.title()}</h3>
        <button
          class="${BTN} ml-auto !px-2 !py-1"
          data-gw-replay-skip
          @click=${() => r.skip()}
        >
          ${translateText("gw.map.replay_skip")}
        </button>
      </div>
      ${b === null || b.theatre === null
        ? nothing
        : html`<p class="text-sm text-white/85" data-gw-replay-front>
            ${translateText(`gw.ui.theatre.${b.theatre}`)}
            <span class=${MUTED}>${lineText(b.theatre, b)}</span>
          </p>`}
      <div class="flex flex-wrap gap-1" data-gw-replay-fallen>
        ${r.fallen.map(
          (f) =>
            html`<span class=${CHIP}
              >${fallenLabel(f)} · ${translateText(`gw.country.${f.to}`)}</span
            >`,
        )}
      </div>
    </div>`;
}
