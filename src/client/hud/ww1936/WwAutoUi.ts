// World War 1936: the automation switches on the screens (owner brief
// 2026-10-30). The economy drawer shows the five in one "자동 운영" row;
// each domain's own drawer shows its switch in the head; the dock's 🏭
// carries a small "자동" badge while any is on. A tap sends one auto_set
// for the viewer's own country (the engine knows the sender).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  WorldWarData,
  WW_AUTO_DOMAINS,
  wwAutoBit,
  WwAutoDomain,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { html, TemplateResult } from "lit";
import { translateText } from "../../Utils";

/** What the switches read of the game (GameView). */
interface AutoGame {
  worldWarData(): WorldWarData | null;
}

/** My country's switches (WW_AUTO_DOMAINS bits); 0 when none is on. */
export function autoMaskOf(
  game: AutoGame | null | undefined,
  me: number,
): number {
  const list = game?.worldWarData()?.auto ?? [];
  return list.find((a) => a.smallID === me)?.mask ?? 0;
}

export function autoOnIn(mask: number, domain: WwAutoDomain): boolean {
  return (mask & wwAutoBit(domain)) !== 0;
}

/** The order a tap on `domain`'s switch sends. */
export function autoToggleOrder(mask: number, domain: WwAutoDomain): WwOrder {
  return { kind: "auto_set", domain, on: !autoOnIn(mask, domain) };
}

/** One switch: its label and an on/off pill; `compact` drops the label (a drawer's head). */
export function renderAutoSwitch(
  domain: WwAutoDomain,
  mask: number,
  send: (o: WwOrder) => void,
  compact = false,
): TemplateResult {
  const on = autoOnIn(mask, domain);
  const name = translateText(`ww1936.auto.${domain}`);
  const stateText = translateText(on ? "ww1936.auto.on" : "ww1936.auto.off");
  return html`<button
    type="button"
    role="switch"
    data-ww-auto=${domain}
    aria-checked=${String(on)}
    aria-label=${translateText("ww1936.auto.switch_label", {
      domain: name,
      state: stateText,
    })}
    class="flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold ${on
      ? "border-emerald-400/70 bg-emerald-900/50 text-emerald-100"
      : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"}"
    @click=${() => send(autoToggleOrder(mask, domain))}
  >
    <span>${compact ? translateText("ww1936.auto.badge") : name}</span>
    <span
      aria-hidden="true"
      class="relative inline-block h-4 w-7 rounded-full ${on
        ? "bg-emerald-400"
        : "bg-white/25"}"
      ><span
        class="absolute top-0.5 size-3 rounded-full bg-white transition-all ${on
          ? "left-3.5"
          : "left-0.5"}"
      ></span
    ></span>
    ${compact ? "" : html`<span class="tabular-nums">${stateText}</span>`}
  </button>`;
}

/** The economy drawer's "자동 운영" row: every switch (WW_AUTO_DOMAINS) and a one-line hint. */
export function renderAutoRow(
  mask: number,
  send: (o: WwOrder) => void,
): TemplateResult {
  return html`<section
    data-ww-auto-row
    class="mt-2 rounded-md border border-white/10 bg-white/5 p-1.5"
  >
    <div class="flex flex-wrap items-center gap-1">
      <span class="mr-1 text-xs font-bold text-white/80"
        >🤖 ${translateText("ww1936.auto.title")}</span
      >
      ${WW_AUTO_DOMAINS.map((d) => renderAutoSwitch(d, mask, send))}
    </div>
    <p class="m-0 mt-1 text-xs leading-snug text-white/60">
      ${translateText("ww1936.auto.hint")}
    </p>
  </section>`;
}
