// World War 1936 P6 lane U3 (plan Task 12, spec §20.6): the intelligence
// drawer — four tabs: the agency (12 upgrade cards), the operatives (cards,
// then target, mission chips and the operation list), the intelligence
// (a country table with band dots; a row shows the level's sources) and the
// codes. Every order goes out as one ww_order; an operation and a code
// exploitation take two taps. Reads views only.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import {
  type IntelMission,
  type IntelOperation,
  INTEL_DOMAINS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { html, nothing, TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { SendWwOrderIntentEvent } from "../../Transport";
import { translateText } from "../../Utils";
import { WwDepthOpenEvent } from "./DepthEvents";
import { AgencyCard, IntelModel, OperativeCard, TargetRow } from "./IntelModel";
import { TwoTap } from "./WorldWarModel";
import { WwDrawerBase } from "./WwDrawer";

export type WwIntelTab = "agency" | "operatives" | "intel" | "crypto";
export const WW_INTEL_TABS: readonly WwIntelTab[] = [
  "agency",
  "operatives",
  "intel",
  "crypto",
];
const TAB_KEYS: Readonly<Record<WwIntelTab, string>> = {
  agency: "ww1936.intel.tab_agency",
  operatives: "ww1936.intel.tab_operatives",
  intel: "ww1936.intel.tab_intel",
  crypto: "ww1936.intel.tab_crypto",
};

const BUTTON =
  "h-9 shrink-0 rounded-md border border-white/15 bg-white/5 px-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40";
const HEADING =
  "mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-white/70";
/** Band dots: unknown gray, rough orange, close yellow, exact green. */
const BAND_COLOR = [
  "bg-gray-500",
  "bg-orange-400",
  "bg-yellow-300",
  "bg-green-400",
];

const flagOf = (tag: string) => assetUrl(`flags/${tag}.svg`);

/** The operative flow: card → target → mission chips and the operation list. */
interface Flow {
  operative: number;
  target: number;
}

@customElement("ww-intel-panel")
export class WwIntelPanel extends WwDrawerBase {
  protected readonly drawerId = "intel" as const;
  @state() private tab: WwIntelTab = "agency";
  @state() private flow: Flow | null = null;
  @state() private openRow = 0;
  @state() private armed = "";
  private model: IntelModel | null = null;
  private readonly twoTap = new TwoTap();
  private redrawKey: readonly unknown[] = [];

  init() {
    super.init();
    this.eventBus.on(WwDepthOpenEvent, (e) => {
      if (e.kind !== "intel") return;
      if (this.open && (e.arg?.tab === undefined || e.arg.tab === this.tab)) {
        this.setOpen(false);
        return;
      }
      const t = e.arg?.tab as WwIntelTab | undefined;
      if (t !== undefined && WW_INTEL_TABS.includes(t)) this.tab = t;
      this.setOpen(true);
    });
  }

  shownTab(): WwIntelTab {
    return this.tab;
  }

  private m(): IntelModel {
    this.model ??= new IntelModel(this.game);
    return this.model;
  }

  tick() {
    this.refitIfOpen();
    if (!this.open) return;
    const key = [
      this.game?.wwDepth?.()?.version,
      this.game?.wwPolitics?.()?.version,
      this.tab,
      this.flow?.operative,
      this.flow?.target,
      this.openRow,
      this.armed,
    ];
    if (key.some((v, i) => v !== this.redrawKey[i])) {
      this.redrawKey = key;
      this.requestUpdate();
    }
  }

  private send(order: WwOrder | null) {
    if (order !== null) this.eventBus.emit(new SendWwOrderIntentEvent(order));
  }

  /** A two-tap action: the first tap arms it (the label changes), the second sends. */
  private confirm(key: string, order: WwOrder | null) {
    if (order === null) return;
    if (this.twoTap.tap(key, performance.now())) {
      this.armed = "";
      this.send(order);
    } else {
      this.armed = key;
    }
  }

  render() {
    if (!this.open) return null;
    return this.renderFrame(
      translateText("ww1936.intel.title"),
      html`<span aria-hidden="true">🕵</span>
        <h3 class="m-0 min-w-0 flex-1 truncate text-sm font-bold">
          ${translateText("ww1936.intel.title")}
        </h3>`,
      this.renderTabs(
        WW_INTEL_TABS,
        this.tab,
        (t) => translateText(TAB_KEYS[t]),
        (t) => {
          this.tab = t;
          this.flow = null;
          this.armed = "";
        },
      ),
      this.renderTab(),
    );
  }

  private renderTab(): TemplateResult {
    switch (this.tab) {
      case "agency":
        return this.renderAgency();
      case "operatives":
        return this.renderOperatives();
      case "intel":
        return this.renderIntel();
      case "crypto":
        return this.renderCrypto();
    }
  }

  // ---- agency -----------------------------------------------------------

  private renderAgency(): TemplateResult {
    const m = this.m();
    if (!m.agency()) {
      return html`<button
        type="button"
        data-ww-found
        class="${BUTTON} mt-2 w-full"
        @click=${() => this.send(m.foundOrder())}
      >
        ${translateText("ww1936.intel.found", { pp: m.foundCost() })}
      </button>`;
    }
    return html`<div data-ww-agency-grid class="mt-2 grid grid-cols-3 gap-1">
      ${m.agencyCards().map((c) => this.renderUpgrade(c))}
    </div>`;
  }

  private renderUpgrade(c: AgencyCard): TemplateResult {
    const m = this.m();
    const pct = Math.floor(c.progressPm / 10);
    const ring =
      c.state === "building"
        ? html`<span
            class="absolute right-1 top-1 size-4 rounded-full"
            style="background: conic-gradient(#facc15 ${pct}%, rgba(255,255,255,.15) 0)"
          ></span>`
        : c.state === "owned"
          ? html`<span class="absolute right-1 top-0.5 text-green-400">✓</span>`
          : nothing;
    return html`<button
      type="button"
      data-ww-upgrade=${c.id}
      data-state=${c.state}
      ?disabled=${c.state === "locked"}
      class="relative flex min-h-16 flex-col items-start gap-0.5 rounded-md border p-1.5 text-left text-[11px] leading-tight ${c.state ===
      "locked"
        ? "border-white/5 bg-white/5 opacity-40"
        : c.state === "building"
          ? "border-yellow-300/60 bg-yellow-300/10"
          : c.state === "owned"
            ? "border-green-400/40 bg-green-400/10"
            : "border-white/15 bg-white/5 hover:bg-white/10"}"
      @click=${() => {
        if (m.canStartUpgrade(c)) this.send(m.upgradeOrder(c.id));
      }}
    >
      ${ring}
      <span class="pr-4 font-semibold"
        >${translateText(`ww1936.agency_up.${c.id}`)}</span
      >
      <span class="text-white/70"
        >${c.state === "locked" && c.needs !== null
          ? translateText("ww1936.intel.upgrade_locked", {
              upgrade: translateText(`ww1936.agency_up.${c.needs}`),
            })
          : translateText(`ww1936.agency_up_desc.${c.id}`)}</span
      >
    </button>`;
  }

  // ---- operatives -------------------------------------------------------

  private renderOperatives(): TemplateResult {
    const m = this.m();
    if (!m.agency()) {
      return html`<p class="m-0 mt-2 text-xs text-white/60">
        ${translateText("ww1936.intel.no_agency")}
      </p>`;
    }
    const cards = m.operativeCards();
    return html`<ul
        data-ww-operatives
        class="m-0 mt-2 grid list-none grid-cols-2 gap-1 p-0"
      >
        ${cards.map((c) => html`<li>${this.renderOperative(c)}</li>`)}
      </ul>
      ${this.flow === null ? nothing : this.renderFlow(this.flow)}`;
  }

  private renderOperative(c: OperativeCard): TemplateResult {
    const m = this.m();
    if (c.uid === 0) {
      return html`<button
        type="button"
        data-ww-recruit
        class="${BUTTON} h-full min-h-16 w-full"
        @click=${() => this.send(m.recruitOrder())}
      >
        ${translateText("ww1936.intel.recruit", { days: c.daysLeft })}
      </button>`;
    }
    const targetTag = this.tagOf(c.target);
    const chosen = this.flow?.operative === c.uid;
    return html`<button
      type="button"
      data-ww-operative=${c.uid}
      data-state=${c.state}
      class="flex min-h-16 w-full flex-col gap-0.5 rounded-md border p-1.5 text-left text-xs ${chosen
        ? "border-yellow-300/70 bg-yellow-300/10"
        : "border-white/15 bg-white/5 hover:bg-white/10"}"
      @click=${() => {
        this.flow = chosen ? null : { operative: c.uid, target: 0 };
        this.armed = "";
      }}
    >
      <span class="flex items-center gap-1">
        <span class="min-w-0 flex-1 truncate font-semibold">${c.codename}</span>
        <span data-ww-skill class="text-yellow-300"
          >${"★".repeat(Math.max(1, c.skill))}</span
        >
      </span>
      <span class="flex items-center gap-1 text-white/80">
        ${targetTag === null
          ? nothing
          : html`<img
              src=${flagOf(COUNTRIES[targetTag].flag)}
              alt=""
              class="h-3 w-4 rounded-sm object-cover"
            />`}
        <span class="truncate"
          >${translateText(
            `ww1936.intel.status.${c.state === "travel" || c.state === "empty" ? (c.state === "empty" ? "idle" : "mission") : c.state}`,
          )}${c.mission === null
            ? ""
            : ` · ${translateText(`ww1936.intel_mission.${c.mission}`)}`}</span
        >
      </span>
      <span class="h-1.5 rounded bg-white/10">
        <span
          class="block h-1.5 rounded bg-cyan-400"
          style="width: ${Math.floor(c.progressPm / 10)}%"
        ></span>
      </span>
      <span data-ww-risk class="text-[10px] text-white/60"
        >${translateText("ww1936.intel.arrest_risk", { pct: c.risk })}</span
      >
    </button>`;
  }

  private tagOf(smallID: number) {
    if (smallID === 0) return null;
    return this.game.worldWarScenario?.()?.tagOfSmallId(smallID) ?? null;
  }

  private renderFlow(f: Flow): TemplateResult {
    const m = this.m();
    if (f.target === 0) {
      return html`<h4 class="${HEADING}">
          ${translateText("ww1936.intel.pick_target")}
        </h4>
        <ul data-ww-targets class="m-0 flex list-none flex-col gap-1 p-0">
          ${m.targetRows().map(
            (r) =>
              html`<li>
                <button
                  type="button"
                  data-ww-target=${r.id}
                  class="flex w-full items-center gap-1 rounded-md border border-white/10 bg-white/5 p-1.5 text-left text-xs hover:bg-white/10"
                  @click=${() => {
                    this.flow = { operative: f.operative, target: r.id };
                  }}
                >
                  ${this.renderRowHead(r)}
                </button>
              </li>`,
          )}
        </ul>`;
    }
    const chips = m.missionChips(f.operative, f.target);
    const ops = m.operationRows(f.target, f.operative);
    return html`<h4 class="${HEADING}">
        ${translateText("ww1936.intel.missions")}
      </h4>
      <div data-ww-missions class="flex flex-wrap gap-1">
        ${chips.map(
          (c) =>
            html`<button
              type="button"
              data-ww-mission=${c.mission}
              ?disabled=${!c.enabled}
              class=${BUTTON}
              @click=${() => {
                this.send(
                  m.assignOrder(
                    f.operative,
                    f.target,
                    c.mission as IntelMission,
                  ),
                );
                this.flow = null;
              }}
            >
              ${translateText(`ww1936.intel_mission.${c.mission}`)}
            </button>`,
        )}
      </div>
      <h4 class="${HEADING}">${translateText("ww1936.intel.operations")}</h4>
      <ul data-ww-operations class="m-0 flex list-none flex-col gap-1 p-0">
        ${ops.map((o) => {
          const key = `op:${o.op}`;
          return html`<li
            data-ww-operation=${o.op}
            class="rounded-md border border-white/10 bg-white/5 p-1.5 text-xs"
          >
            <div class="flex items-center gap-1">
              <span class="min-w-0 flex-1 font-semibold"
                >${translateText(`ww1936.op.${o.op}`)}</span
              >
              <span
                >${translateText("ww1936.intel.op_days", {
                  days: o.days,
                })}</span
              >
              ${o.successPm === null
                ? nothing
                : html`<span data-ww-success
                    >${translateText("ww1936.intel.op_success", {
                      pct: Math.floor(o.successPm / 10),
                    })}</span
                  >`}
            </div>
            <div class="text-white/70">
              ${translateText(`ww1936.op_desc.${o.op}`)}
            </div>
            <div data-ww-conditions class="flex flex-wrap gap-x-2">
              ${o.conditions.map(
                (c) =>
                  html`<span
                    data-ww-cond=${c.key}
                    data-ok=${String(c.ok)}
                    class=${c.ok ? "text-green-300" : "text-red-300"}
                    >${translateText(`ww1936.intel.op_cond_${c.key}`, {
                      have: c.have,
                      need: c.need,
                    })}
                    ${c.ok ? "✓" : "✗"}</span
                  >`,
              )}
            </div>
            <button
              type="button"
              data-ww-op-start=${o.op}
              ?disabled=${!o.ok}
              class="${BUTTON} mt-1 w-full"
              @click=${() =>
                this.confirm(
                  key,
                  m.opStartOrder(o.op as IntelOperation, f.target, f.operative),
                )}
            >
              ${this.armed === key
                ? translateText("ww1936.intel.op_confirm")
                : translateText("ww1936.intel.op_start")}
            </button>
          </li>`;
        })}
      </ul>`;
  }

  private renderRowHead(r: TargetRow): TemplateResult {
    const tag = this.tagOf(r.id);
    return html`${tag === null
        ? nothing
        : html`<img
            src=${flagOf(COUNTRIES[tag].flag)}
            alt=""
            class="h-3 w-4 shrink-0 rounded-sm object-cover"
          />`}
      <span class="min-w-0 flex-1 truncate">${r.name}</span>
      <span class="w-9 shrink-0 text-right tabular-nums text-white/70"
        >${Math.floor(r.networkPm / 10)}%</span
      >
      <span data-ww-bands class="flex shrink-0 gap-0.5">
        ${r.bands.map(
          (b, d) =>
            html`<span
              data-ww-band=${b}
              aria-label=${translateText(
                `ww1936.intel.band.${INTEL_DOMAINS[d]}`,
              )}
              class="size-2.5 rounded-full ${BAND_COLOR[b]}"
            ></span>`,
        )}
      </span>
      ${r.infiltrated
        ? html`<span
            data-ww-infiltrated
            aria-label=${translateText("ww1936.intel.infiltrated")}
            >🕵</span
          >`
        : nothing}`;
  }

  // ---- the intelligence table -------------------------------------------

  private renderIntel(): TemplateResult {
    const m = this.m();
    const rows = m.targetRows();
    return html`<ul
      data-ww-intel-table
      class="m-0 mt-2 flex list-none flex-col gap-1 p-0"
    >
      ${rows.map(
        (r) =>
          html`<li>
            <button
              type="button"
              data-ww-intel-row=${r.id}
              class="flex w-full items-center gap-1 rounded-md border border-white/10 bg-white/5 p-1.5 text-left text-xs hover:bg-white/10"
              @click=${() => {
                this.openRow = this.openRow === r.id ? 0 : r.id;
              }}
            >
              ${this.renderRowHead(r)}
            </button>
            ${this.openRow === r.id ? this.renderSources(r) : nothing}
          </li>`,
      )}
    </ul>`;
  }

  private renderSources(r: TargetRow): TemplateResult {
    const m = this.m();
    return html`<div
      data-ww-sources
      class="mt-1 rounded-md bg-black/30 p-1.5 text-[11px]"
    >
      ${[1, 2, 3, 0].map((d) => {
        const lines = m.levelSources(r.id, d);
        const total = lines.reduce((s, l) => s + l.value, 0);
        return html`<div data-ww-source-domain=${d} class="mb-1">
          <div class="font-semibold">
            ${translateText(`ww1936.intel.band.${INTEL_DOMAINS[d]}`)}
            <span data-ww-level>${total}%</span>
          </div>
          ${lines.map(
            (l) =>
              html`<div
                data-ww-source=${l.key}
                class="flex justify-between text-white/80"
              >
                <span>${translateText(`ww1936.intel.src.${l.key}`)}</span
                ><span class="tabular-nums"
                  >${l.value > 0 ? "+" : ""}${l.value}</span
                >
              </div>`,
          )}
        </div>`;
      })}
    </div>`;
  }

  // ---- the codes --------------------------------------------------------

  private renderCrypto(): TemplateResult {
    const m = this.m();
    const c = m.cryptoCard();
    if (!c.agency) {
      return html`<p class="m-0 mt-2 text-xs text-white/60">
        ${translateText("ww1936.intel.no_agency")}
      </p>`;
    }
    const rows = m.targetRows();
    const nameOf = (id: number) => rows.find((r) => r.id === id)?.name ?? "";
    return html`<div data-ww-crypto class="mt-2 flex flex-col gap-1 text-xs">
      <div class="flex justify-between">
        <span>${translateText("ww1936.crypto.strength")}</span
        ><span data-ww-cipher class="tabular-nums">${c.cipher}</span>
      </div>
      <div class="flex justify-between">
        <span>${translateText("ww1936.crypto.power")}</span
        ><span data-ww-decrypt class="tabular-nums">${c.decrypt}</span>
      </div>
      <h4 class="${HEADING}">
        ${translateText("ww1936.crypto.target", { country: nameOf(c.target) })}
      </h4>
      ${c.target === 0
        ? html`<p class="m-0 text-white/60">
            ${translateText("ww1936.crypto.none_target")}
          </p>`
        : html`<div data-ww-crypto-progress class="flex items-center gap-2">
            <span
              class="size-6 rounded-full"
              style="background: conic-gradient(#22d3ee ${Math.floor(
                c.progressPm / 10,
              )}%, rgba(255,255,255,.15) 0)"
            ></span>
            <span class="flex-1">${nameOf(c.target)}</span>
            <span
              >${c.daysLeft === null
                ? "—"
                : translateText("ww1936.crypto.days_left", {
                    days: c.daysLeft,
                  })}</span
            >
          </div>`}
      <div data-ww-crypto-targets class="flex flex-wrap gap-1">
        ${rows
          .filter((r) => r.atWar || r.neighbour)
          .slice(0, 8)
          .map(
            (r) =>
              html`<button
                type="button"
                data-ww-crypto-pick=${r.id}
                class=${BUTTON}
                @click=${() => this.send(m.cryptoTargetOrder(r.id))}
              >
                ${translateText("ww1936.crypto.change_target")} ${r.name}
              </button>`,
          )}
      </div>
      <h4 class="${HEADING}">${translateText("ww1936.crypto.broken_list")}</h4>
      ${rows
        .filter((r) => c.decrypted.some((d) => d.target === r.id))
        .map((r) => {
          const d = c.decrypted.find((x) => x.target === r.id)!;
          const key = `crypto:${r.id}`;
          return html`<button
            type="button"
            data-ww-crypto-activate=${r.id}
            class="${BUTTON} w-full"
            @click=${() => this.confirm(key, m.cryptoActivateOrder(r.id))}
          >
            ${this.armed === key
              ? translateText("ww1936.crypto.exploit_confirm")
              : translateText("ww1936.crypto.exploit")}
            ${d.daysLeft > 0
              ? html`<span class="text-white/60"
                  >${translateText("ww1936.crypto.exploiting", {
                    days: d.daysLeft,
                  })}</span
                >`
              : nothing}
          </button>`;
        })}
      <p class="m-0 text-white/50">
        ${translateText("ww1936.crypto.broken_none")}
      </p>
    </div>`;
  }
}
