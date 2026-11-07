import { Cell } from "@openfront/engine-api/game/GameTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { EventBus } from "@openfront/shared/EventBus";
import { html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { Controller } from "../../Controller";
import type { TransformHandler } from "../../TransformHandler";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import { gwMapState } from "./GwLensModel";
import {
  pathOf,
  planSeen,
  railClock,
  running,
  share,
  weightOf,
  type Path,
} from "./GwRailModel";

/** Days past the last train after which the roads are taken off the map. */
const LINGER_DAYS = 14;
/** The timetable's days an eased clock gains in a second when the date jumps. */
const DAYS_PER_SECOND = 1.6;
/** Screen pixels between trains, and how fast they run. */
const SPACING = 30;
const SPEED = 36;

const CENTRAL: readonly GwTag[] = ["DEU", "AUH", "OTT", "BGR"];
const AMBER = "240,176,64";
const BLUE = "104,172,255";

/**
 * Great War 1914 (ww155): mobilisation by rail. Draws, over the map, each
 * mobilising power's roads from depot to frontier and the trains on them,
 * with the days counted. The days are the chapter's own dates (the view's
 * clock); nothing here is a rule or a hidden value.
 */
@customElement("gw-rail")
export class GwRail extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  public transformHandler: TransformHandler;
  private readonly eased = new Map<GwTag, number>();
  private canvas: HTMLCanvasElement | null = null;
  private frame = 0;
  private last = 0;

  createRenderRoot() {
    return this;
  }

  init() {
    this.loop();
  }

  getTickIntervalMs() {
    return 250;
  }

  tick() {
    const data = this.game?.greatWarData?.() ?? null;
    const seat = this.seat();
    if (data !== null && seat !== null) railClock.observe(data, seat);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    cancelAnimationFrame(this.frame);
  }

  private seat() {
    const data = this.game?.greatWarData?.() ?? null;
    const me = this.game?.myPlayer()?.smallID();
    return data?.seats.find((s) => s.smallID === me) ?? null;
  }

  render() {
    return html`<canvas
      data-gw-rail
      class="pointer-events-none fixed inset-0 z-[890] h-full w-full"
    ></canvas>`;
  }

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop);
    this.draw(performance.now());
  };

  private screen(p: readonly [number, number]): [number, number] {
    const s = this.transformHandler.worldToScreenCoordinates(
      new Cell(p[0], p[1]),
    );
    return [s.x, s.y];
  }

  private draw(now: number): void {
    const canvas =
      this.canvas ?? this.querySelector<HTMLCanvasElement>("canvas");
    if (canvas === null) return;
    this.canvas = canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const data = this.game?.greatWarData?.() ?? null;
    const seat = this.seat();
    const scenario = this.game?.greatWarScenario?.() ?? null;
    if (
      data === null ||
      seat === null ||
      scenario === null ||
      !gwMapState.rail ||
      seat.prologue?.done === false
    ) {
      return;
    }
    const dt = Math.min(0.25, (now - (this.last || now)) / 1000);
    this.last = now;
    ctx.scale(dpr, dpr);
    const plan = planSeen(data, seat);
    const t = now / 1000;
    const labels: Label[] = [];
    for (const { row } of running(seat)) {
      const target = railClock.elapsed(row.tag, data.date);
      let shown = this.eased.get(row.tag) ?? target;
      const gap = target - shown;
      shown += Math.sign(gap) * Math.min(Math.abs(gap), DAYS_PER_SECOND * dt);
      this.eased.set(row.tag, shown);
      if (shown > row.days + LINGER_DAYS) continue;
      const done = share(shown, row);
      const rgb = CENTRAL.includes(row.tag) ? AMBER : BLUE;
      let labelAt: [number, number] | null = null;
      for (const route of row.routes) {
        const weight = weightOf(route, plan);
        if (weight === 0) continue;
        const path = pathOf(scenario, route);
        if (path.pts.length < 2) continue;
        const end = this.paint(ctx, path, done, weight, rgb, t, plan === null);
        if (route.id === row.routes[0].id) labelAt = end;
      }
      if (labelAt !== null) {
        labels.push(this.labelOf(ctx, row.tag, shown, row.days, labelAt, rgb));
      }
    }
    this.drawLabels(ctx, labels);
  }

  /** One road: faint whole, bright to the head, trains between. Returns the far end. */
  private paint(
    ctx: CanvasRenderingContext2D,
    path: Path,
    done: number,
    weight: number,
    rgb: string,
    t: number,
    question: boolean,
  ): [number, number] {
    const pts = path.pts.map((p) => this.screen(p));
    const lens: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      lens.push(
        lens[i - 1] +
          Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
      );
    }
    const total = lens[lens.length - 1];
    const head = total * done;
    const thin = weight === 1;
    const trace = (upto: number) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        if (lens[i] <= upto) ctx.lineTo(pts[i][0], pts[i][1]);
        else {
          const f = (upto - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
          ctx.lineTo(
            pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
            pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f,
          );
          break;
        }
      }
    };
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // The whole road, faint: where the army is going.
    ctx.setLineDash(thin && question ? [3, 6] : []);
    ctx.strokeStyle = `rgba(${rgb},${thin ? 0.5 : 0.4})`;
    ctx.lineWidth = thin ? 1.5 : 2.5;
    trace(total);
    ctx.stroke();
    if (thin) {
      // A road not taken yet (no plan signed): its end is a question. Once
      // the plan is signed a thin road is only a garrison: no mark.
      const [ex, ey] = pts[pts.length - 1];
      if (question) {
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "bold 13px sans-serif";
        ctx.fillText("?", ex + 5, ey - 5);
      }
      return [ex, ey];
    }
    // The part the trains have covered, bright.
    if (head > 0) {
      ctx.strokeStyle = `rgba(${rgb},0.95)`;
      ctx.lineWidth = 4;
      trace(head);
      ctx.stroke();
      // Trains: dots that run from the depot towards the head.
      const flow = (t * SPEED) % SPACING;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      for (let d = flow; d < head; d += SPACING) {
        const p = this.at(pts, lens, d);
        ctx.beginPath();
        ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.setLineDash([]);
    const [ex, ey] = pts[pts.length - 1];
    // The frontier: a square, filled once the last train has come.
    ctx.strokeStyle = `rgba(${rgb},1)`;
    ctx.fillStyle = done >= 1 ? `rgba(${rgb},1)` : "rgba(15,23,42,0.9)";
    ctx.lineWidth = 2;
    ctx.fillRect(ex - 4, ey - 4, 8, 8);
    ctx.strokeRect(ex - 4, ey - 4, 8, 8);
    // Which is where the head is, as a bright ring.
    const hp = this.at(pts, lens, head);
    ctx.beginPath();
    ctx.arc(hp[0], hp[1], 5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.stroke();
    return [ex, ey];
  }

  private at(
    pts: readonly [number, number][],
    lens: readonly number[],
    d: number,
  ): [number, number] {
    for (let i = 1; i < pts.length; i++) {
      if (d <= lens[i]) {
        const f = (d - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
        return [
          pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
          pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f,
        ];
      }
    }
    return pts[pts.length - 1];
  }

  /** "독일 제국 7/17일" by the frontier: text and where it wants to stand. */
  private labelOf(
    ctx: CanvasRenderingContext2D,
    tag: GwTag,
    shown: number,
    days: number,
    at: [number, number],
    rgb: string,
  ): Label {
    const country = translateText(`gw.country.${tag}`);
    const text =
      shown >= days
        ? translateText("gw.rail.ready", { country })
        : translateText("gw.rail.day", {
            country,
            day: Math.min(days, Math.floor(shown) + 1),
            total: days,
          });
    ctx.font = "600 12px sans-serif";
    return {
      text,
      rgb,
      w: ctx.measureText(text).width + 12,
      x: at[0] + 8,
      y: at[1] - 22,
    };
  }

  /** Draws the labels, pushing one down when it would sit on another. */
  private drawLabels(ctx: CanvasRenderingContext2D, labels: Label[]): void {
    labels.sort((a, b) => a.y - b.y);
    const placed: Label[] = [];
    for (const l of labels) {
      for (const p of placed) {
        const overlapX = l.x < p.x + p.w && p.x < l.x + l.w;
        if (overlapX && Math.abs(l.y - p.y) < 22) l.y = p.y + 22;
      }
      placed.push(l);
      ctx.font = "600 12px sans-serif";
      ctx.fillStyle = "rgba(15,23,42,0.9)";
      ctx.fillRect(l.x, l.y, l.w, 20);
      ctx.fillStyle = `rgba(${l.rgb},1)`;
      ctx.fillRect(l.x, l.y, 3, 20);
      ctx.fillStyle = "#fff";
      ctx.fillText(l.text, l.x + 8, l.y + 14);
    }
  }
}

interface Label {
  text: string;
  rgb: string;
  w: number;
  x: number;
  y: number;
}
