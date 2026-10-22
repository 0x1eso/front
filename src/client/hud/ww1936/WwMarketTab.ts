// World War 1936 P6 lane U4 (spec §20.8): the industry drawer's market tab —
// the open listings (filter, tap a row: a count slider and "4 civilian
// factories x 30 days", then [Buy] on two taps), my listings and [List],
// the deals under way, the licences (held and granted, [End]) and the
// embargo list.
import { renderNumber } from "@openfront/engine-lib/Format";
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { DepthIndustryModel, ListingRow } from "./DepthIndustryModel";
import { blockText } from "./EconomyModel";
import { TAB_BTN, TAB_HEAD, TabUi } from "./WwTabUi";

export function renderMarketTab(
  m: DepthIndustryModel,
  ui: TabUi,
): TemplateResult {
  const mine = (ui.pick.mine ?? 0) === 1;
  const rows = m.listings({ mine });
  const chosen = rows.find((r) => r.id === ui.pick.listing) ?? null;
  return html`<div data-ww-market>
    <div class="mt-2 flex gap-1">
      ${[false, true].map(
        (v) =>
          html`<button
            type="button"
            data-ww-market-filter=${v ? "mine" : "open"}
            aria-pressed=${String(v === mine)}
            class="${TAB_BTN} ${v === mine ? "bg-white/20" : ""}"
            @click=${() => {
              ui.pick.mine = v ? 1 : 0;
              ui.pick.listing = 0;
              ui.redraw();
            }}
          >
            ${translateText(
              v ? "ww1936.market.my_listings" : "ww1936.market.filter_all",
            )}
          </button>`,
      )}
    </div>
    <ul class="m-0 mt-1 flex list-none flex-col gap-1 p-0">
      ${rows.length === 0
        ? html`<li class="text-xs text-white/60">
            ${translateText("ww1936.market.empty")}
          </li>`
        : rows.map((r) => renderRow(m, ui, r, r === chosen))}
    </ul>
    ${mine ? renderOffer(m, ui) : nothing} ${renderDeals(m, ui)}
    ${renderLicences(m, ui)} ${renderEmbargoes(m, ui)}
  </div>`;
}

/**
 * Final review D (D2): the schema's cap on a market order's count
 * (`market_list` and `market_buy`, Schemas.ts); a count past it would get
 * the sender kicked.
 */
export const MARKET_MAX_COUNT = 1_000_000;

function renderRow(
  m: DepthIndustryModel,
  ui: TabUi,
  r: ListingRow,
  open: boolean,
): TemplateResult {
  const most = Math.min(r.count, MARKET_MAX_COUNT);
  const count = Math.max(
    1,
    Math.min(most, ui.pick.count > 0 ? ui.pick.count : most),
  );
  const prev = m.buyPreview(r, count);
  const key = `market_buy:${r.id}:${count}`;
  return html`<li
    data-ww-listing=${r.id}
    class="rounded-md border border-white/15 bg-white/5 p-2"
  >
    <button
      type="button"
      class="flex min-h-11 w-full items-baseline gap-2 text-left text-xs"
      @click=${() => {
        ui.pick.listing = open ? 0 : r.id;
        ui.pick.count = r.count;
        ui.redraw();
      }}
    >
      <span class="min-w-0 flex-1 truncate font-semibold"
        >${m.keyName(r.key, r.design)}</span
      >
      <span class="tabular-nums">×${renderNumber(r.count)}</span>
      <span class="tabular-nums text-white/70">${ui.name(r.seller)}</span>
    </button>
    ${open && r.own
      ? html`<button
          type="button"
          data-ww-unlist
          class=${TAB_BTN}
          @click=${() => ui.send({ kind: "market_unlist", listing: r.id })}
        >
          ${translateText("ww1936.market.withdraw")}
        </button>`
      : nothing}
    ${open && !r.own
      ? html`<div class="mt-1 flex flex-col gap-1 text-xs">
          <input
            type="range"
            data-ww-buy-count
            min="1"
            max=${most}
            .value=${String(count)}
            @input=${(e: Event) => {
              ui.pick.count = Number((e.target as HTMLInputElement).value);
              ui.redraw();
            }}
          />
          <span data-ww-buy-preview class="tabular-nums"
            >${translateText("ww1936.market.preview", {
              n: prev.factories,
            })}</span
          >
          ${r.blocked === null
            ? nothing
            : html`<span data-ww-block=${r.blocked} class="text-red-300"
                >🔒 ${blockText("no_partner")}</span
              >`}
          <button
            type="button"
            data-ww-buy
            class=${TAB_BTN}
            ?disabled=${r.blocked !== null}
            @click=${() =>
              ui.confirm(key, () =>
                ui.send({ kind: "market_buy", listing: r.id, count }),
              )}
          >
            ${ui.armed(key)
              ? translateText("ww1936.econ.cancel_tap")
              : translateText("ww1936.market.buy")}
          </button>
        </div>`
      : nothing}
  </li>`;
}

function renderOffer(m: DepthIndustryModel, ui: TabUi): TemplateResult {
  const stock = m.view
    .wwEconomy?.()
    ?.detail(m.view.myPlayer()?.smallID() ?? 0)?.stock;
  const keys = (stock ?? [])
    .map((n, key) => ({ n, key }))
    .filter((x) => x.n > 0);
  const key = ui.pick.sellKey ?? keys[0]?.key ?? -1;
  const have = Math.min(
    keys.find((x) => x.key === key)?.n ?? 0,
    MARKET_MAX_COUNT,
  );
  const count = Math.max(1, Math.min(have, ui.pick.sellCount || have));
  return html`<div data-ww-offer class="mt-2 flex flex-wrap items-center gap-1">
    <select
      class="h-9 rounded border border-white/15 bg-gray-900 text-xs"
      @change=${(e: Event) => {
        ui.pick.sellKey = Number((e.target as HTMLSelectElement).value);
        ui.pick.sellCount = 0;
        ui.redraw();
      }}
    >
      ${keys.map(
        (x) =>
          html`<option value=${x.key} ?selected=${x.key === key}>
            ${m.keyName(x.key)} (${renderNumber(x.n)})
          </option>`,
      )}
    </select>
    <input
      type="range"
      min="1"
      max=${Math.max(1, have)}
      .value=${String(count)}
      @input=${(e: Event) => {
        ui.pick.sellCount = Number((e.target as HTMLInputElement).value);
        ui.redraw();
      }}
    />
    <span class="text-xs tabular-nums">×${count}</span>
    <button
      type="button"
      data-ww-list
      class=${TAB_BTN}
      ?disabled=${have <= 0}
      @click=${() => ui.send({ kind: "market_list", key, count })}
    >
      ${translateText("ww1936.market.list_item")}
    </button>
  </div>`;
}

function renderDeals(m: DepthIndustryModel, ui: TabUi): TemplateResult {
  const deals = m.dealRows();
  if (deals.length === 0) return html`${nothing}`;
  return html`<h4 class=${TAB_HEAD}>${translateText("ww1936.market.deals")}</h4>
    <ul class="m-0 flex list-none flex-col gap-1 p-0 text-xs">
      ${deals.map(
        (d) =>
          html`<li data-ww-deal=${d.id} class="flex gap-2 tabular-nums">
            <span class="min-w-0 flex-1 truncate"
              >${m.keyName(d.key)} ×${d.count} · ${ui.name(d.partner)}</span
            >
            <span
              >${translateText("ww1936.market.deal_pay", {
                pct: Math.floor(d.paidPm / 10),
              })}
              ·
              ${translateText("ww1936.market.deal_delivery", {
                pct: Math.floor(d.deliveredPm / 10),
              })}</span
            >
            <span
              >${translateText("ww1936.project_ui.days_left", {
                days: d.daysLeft,
              })}</span
            >
          </li>`,
      )}
    </ul>`;
}

function renderLicences(m: DepthIndustryModel, ui: TabUi): TemplateResult {
  const rows = m.licenceRows();
  const pending = m.pendingLicences();
  if (rows.length === 0 && pending.length === 0) return html`${nothing}`;
  return html`<h4 class=${TAB_HEAD}>
      ${translateText("ww1936.licence.title")}
    </h4>
    <ul class="m-0 flex list-none flex-col gap-1 p-0 text-xs">
      ${pending.map(
        (p) =>
          html`<li
            data-ww-licence-request=${p.id}
            class="flex items-center gap-1"
          >
            <span class="min-w-0 flex-1 truncate"
              >${translateText("ww1936.licence.card_title", {
                country: ui.name(p.from),
              })}
              ·
              ${translateText("ww1936.licence.card_design", {
                design: m.keyName(p.key),
              })}</span
            >
            ${[true, false].map(
              (accept) =>
                html`<button
                  type="button"
                  class=${TAB_BTN}
                  @click=${() =>
                    ui.send({ kind: "licence_answer", request: p.id, accept })}
                >
                  ${translateText(
                    accept ? "ww1936.licence.accept" : "ww1936.licence.refuse",
                  )}
                </button>`,
            )}
          </li>`,
      )}
      ${rows.map((l) => {
        const key = `licence_cancel:${l.id}`;
        return html`<li data-ww-licence=${l.id} class="flex items-center gap-1">
          <span class="min-w-0 flex-1 truncate"
            >${translateText(
              l.dir === "in"
                ? "ww1936.licence.received"
                : "ww1936.licence.granted",
            )}
            · ${m.keyName(l.key)} · ${ui.name(l.partner)}</span
          >
          <button
            type="button"
            class=${TAB_BTN}
            @click=${() =>
              ui.confirm(key, () =>
                ui.send({ kind: "licence_cancel", licence: l.id }),
              )}
          >
            ${ui.armed(key)
              ? translateText("ww1936.econ.cancel_tap")
              : translateText("ww1936.licence.end")}
          </button>
        </li>`;
      })}
    </ul>`;
}

function renderEmbargoes(m: DepthIndustryModel, ui: TabUi): TemplateResult {
  const rows = m.embargoRows();
  if (rows.length === 0) return html`${nothing}`;
  return html`<h4 class=${TAB_HEAD}>
      ${translateText("ww1936.market.embargoes")}
    </h4>
    <ul class="m-0 flex list-none flex-col gap-1 p-0 text-xs">
      ${rows.map(
        (e) =>
          html`<li data-ww-embargo class="flex items-center gap-1">
            <span class="min-w-0 flex-1 truncate"
              >${ui.name(e.by)} → ${ui.name(e.on)}</span
            >
            ${e.byMe
              ? html`<button
                  type="button"
                  class=${TAB_BTN}
                  @click=${() =>
                    ui.send({ kind: "embargo_lift", target: e.on })}
                >
                  ${translateText("ww1936.market.lift_embargo")}
                </button>`
              : nothing}
          </li>`,
      )}
    </ul>`;
}
