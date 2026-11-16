// Great War 1914 (ww223): the treasury where the money gauge stood. The top
// band and the country tab show the sum itself, in the country's money, and
// where it is heading in a word; a heavy debt says so on its own, beside it.
import type { GwTreasuryView } from "@openfront/engine-api/ww1914/GwWorldView";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import type { GwCtx } from "./GwCtx";
import { fillColor, MUTED } from "./GwStyle";
import { gaugeLineText, textOrNull } from "./GwText";

const unit = (tag: string) =>
  textOrNull(`gw.budget.unit.${tag}`) ?? translateText("gw.budget.unit.other");

/** Whole millions as a Korean sum: 1559 is 15억 6천만, 66 is 6,600만. */
export function moneyText(tag: string, millions: number): string {
  const v = Math.abs(millions);
  if (v === 0) return `0 ${unit(tag)}`;
  const sign = millions < 0 ? "-" : "";
  const eok = Math.floor(v / 100);
  const rest = Math.round((v % 100) / 10);
  const head =
    eok === 0
      ? `${(v * 100).toLocaleString("en-US")}만`
      : rest === 0
        ? `${eok.toLocaleString("en-US")}억`
        : rest === 10
          ? `${(eok + 1).toLocaleString("en-US")}억`
          : `${eok.toLocaleString("en-US")}억 ${rest}천만`;
  return `${sign}${head} ${unit(tag)}`;
}

/** Where it is heading, as a word: text gw.ui.treasury.trend.<word>. */
export function treasuryTrend(
  t: GwTreasuryView,
): "rising" | "holding" | "falling" {
  return t.trend > 0 ? "rising" : t.trend < 0 ? "falling" : "holding";
}

/** The dot's colour: empty is red, else by where it is heading. */
export function treasuryFill(t: GwTreasuryView): number {
  if (t.amount <= 0) return 0;
  return t.trend > 0 ? 1 : t.trend < 0 ? 0.4 : 0.7;
}

/** "빚이 무겁다" / "빚에 짓눌린다", or nothing for a light debt. */
function debtWord(t: GwTreasuryView): string | null {
  return t.debt === 0 ? null : translateText(`gw.ui.treasury.debt.${t.debt}`);
}

/**
 * The band's hover: what the treasury is, where it is heading and why, the
 * debt, then why it moved in the last chapter, one "▲ reason" a line.
 */
export function treasuryTitle(c: GwCtx, t: GwTreasuryView): string {
  const pack = c.pack ?? null;
  const head = [
    translateText("gw.ui.gauge_hint.money"),
    translateText("gw.ui.trend_is", {
      word: translateText(`gw.ui.treasury.trend.${treasuryTrend(t)}`),
    }),
  ];
  if (t.trend !== 0 && t.why !== null) {
    head.push(
      translateText("gw.ui.trend_why", { why: gaugeLineText(pack, t.why) }),
    );
  }
  if (t.debt > 0) head.push(translateText("gw.ui.treasury.debt_hint"));
  const why = t.lines.map(
    (l) => `${l.delta > 0 ? "▲" : "▼"} ${gaugeLineText(pack, l.key)}`,
  );
  return why.length === 0
    ? head.join("\n")
    : [...head, translateText("gw.ui.gauge_why"), ...why].join("\n");
}

/** The top band's entry, beside the four gauges and in their look. */
export function treasuryBand(c: GwCtx): TemplateResult | typeof nothing {
  const t = c.seat.world.treasury;
  if (t === undefined) return nothing;
  const debt = debtWord(t);
  return html`<span
    class="flex items-center gap-1 text-xs"
    data-gw-band-gauge="money"
    title=${treasuryTitle(c, t)}
  >
    <span class="h-2 w-2 rounded-full ${fillColor(treasuryFill(t))}"></span>
    <span class="text-white/55"
      >${translateText("gw.ui.gauge_name.money")}</span
    >
    <span data-gw-treasury>${moneyText(c.seat.tag, t.amount)}</span>
    <span class="text-white/60" data-gw-treasury-trend=${treasuryTrend(t)}
      >· ${translateText(`gw.ui.treasury.trend.${treasuryTrend(t)}`)}</span
    >
    ${debt === null
      ? nothing
      : html`<span class="text-orange-300" data-gw-treasury-debt=${t.debt}
          >· ${debt}</span
        >`}
  </span>`;
}

/** The country tab's row, as the gauges' rows read, with no bar to fill. */
export function treasuryRow(c: GwCtx): TemplateResult | typeof nothing {
  const t = c.seat.world.treasury;
  if (t === undefined) return nothing;
  const debt = debtWord(t);
  const trend = treasuryTrend(t);
  return html`<div class="space-y-0.5" data-gw-gauge="money">
    <div class="flex justify-between gap-2 text-sm">
      <span class="shrink-0 text-white/70"
        >${translateText("gw.ui.gauge_name.money")}</span
      >
      <span class="text-right"
        ><span data-gw-treasury>${moneyText(c.seat.tag, t.amount)}</span
        ><span class="text-white/60" data-gw-trend=${trend}>
          · ${translateText(`gw.ui.treasury.trend.${trend}`)}</span
        ></span
      >
    </div>
    ${debt === null
      ? nothing
      : html`<p class="text-xs text-orange-300" data-gw-treasury-debt=${t.debt}>
          ${debt}
        </p>`}
    ${t.trend === 0 || t.why === null
      ? nothing
      : html`<p class=${MUTED} data-gw-trend-why=${t.why}>
          ${translateText("gw.ui.trend_why", {
            why: gaugeLineText(c.pack, t.why),
          })}
        </p>`}
    ${t.lines.map(
      (l) =>
        html`<p class=${MUTED} data-gw-line=${l.key}>
          ${l.delta > 0 ? "▲" : "▼"} ${gaugeLineText(c.pack, l.key)}
        </p>`,
    )}
  </div>`;
}
