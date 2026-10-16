import { html, TemplateResult } from "lit";

// The round dials of the domestic HUD (spec §14d): a progress ring that
// fills clockwise from twelve o'clock, or a clock face whose wedge shrinks
// as a countdown runs. Drawn in a 100-unit box and sized by CSS.

/** Ring and wedge colours (CSS colours, with an rgb triple for the glow). */
export const DIAL_COLORS = {
  science: { stroke: "#38bdf8", glow: "56 189 248" },
  political: { stroke: "#a78bfa", glow: "167 139 250" },
  victory: { stroke: "#fbbf24", glow: "251 191 36" },
  cooldown: { stroke: "#f59e0b", glow: "245 158 11" },
  grey: { stroke: "#cbd5e1", glow: "203 213 225" },
} as const;

export type DialColor = keyof typeof DIAL_COLORS;

const TRACK = "rgba(255,255,255,0.14)";
const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;
const PIE_R = 24;
const PIE_C = 2 * Math.PI * PIE_R;

function clamp01(p: number): number {
  return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
}

/**
 * A ring filled `progress` (0..1) of the way round, clockwise from the top.
 * `data-progress` carries the fill, rounded, for tests and debugging.
 */
export function ringSvg(progress: number, color: DialColor): TemplateResult {
  const p = clamp01(progress);
  return html`<svg
    class="absolute inset-0 w-full h-full pointer-events-none"
    viewBox="0 0 100 100"
    aria-hidden="true"
  >
    <circle
      cx="50"
      cy="50"
      r=${RING_R}
      fill="rgba(17,24,39,0.92)"
      stroke=${TRACK}
      stroke-width="8"
    ></circle>
    <circle
      data-ring
      data-progress=${p.toFixed(2)}
      cx="50"
      cy="50"
      r=${RING_R}
      fill="none"
      stroke=${DIAL_COLORS[color].stroke}
      stroke-width="8"
      stroke-linecap=${p > 0 && p < 1 ? "round" : "butt"}
      stroke-dasharray="${p * RING_C} ${RING_C}"
      transform="rotate(-90 50 50)"
    ></circle>
  </svg>`;
}

/**
 * A clock face: a wedge of `remaining` (0..1) of the circle, from twelve
 * o'clock clockwise, that shrinks toward the top as the countdown runs.
 */
export function clockSvg(remaining: number, color: DialColor): TemplateResult {
  const p = clamp01(remaining);
  return html`<svg
    class="absolute inset-0 w-full h-full pointer-events-none"
    viewBox="0 0 100 100"
    aria-hidden="true"
  >
    <circle
      cx="50"
      cy="50"
      r=${RING_R}
      fill="rgba(17,24,39,0.92)"
      stroke=${TRACK}
      stroke-width="8"
    ></circle>
    <circle
      data-clock
      data-progress=${p.toFixed(2)}
      cx="50"
      cy="50"
      r=${PIE_R}
      fill="none"
      stroke=${DIAL_COLORS[color].stroke}
      stroke-opacity="0.55"
      stroke-width=${PIE_R * 2}
      stroke-dasharray="${p * PIE_C} ${PIE_C}"
      transform="rotate(-90 50 50)"
    ></circle>
  </svg>`;
}

/** The glow and slow pulse of a dial that has something to do (CSS below). */
export const DIAL_GLOW_CLASS = "domestic-dial-glow";

/**
 * Keyframes for DIAL_GLOW_CLASS (spelled out: no bindings in <style>). The
 * components render without a shadow root, so this sheet applies wherever
 * a dial is drawn.
 */
export const DIAL_STYLES = html`<style>
  @keyframes domestic-dial-pulse {
    0%,
    100% {
      box-shadow: 0 0 3px 1px rgb(var(--dial-glow) / 0.45);
      transform: scale(1);
    }
    50% {
      box-shadow: 0 0 12px 4px rgb(var(--dial-glow) / 0.9);
      transform: scale(1.06);
    }
  }
  .domestic-dial-glow {
    animation: domestic-dial-pulse 2.4s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .domestic-dial-glow {
      animation: none;
      box-shadow: 0 0 10px 3px rgb(var(--dial-glow) / 0.8);
    }
  }
</style>`;
