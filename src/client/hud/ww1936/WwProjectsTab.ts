// World War 1936 P6 lane U4 (spec §20.9): the research drawer's "Special
// projects" tab — the facilities, one card per project (progress ring, days
// left, the scientist chip, the input bar "Uranium 1.4/2", the atomic bomb's
// three milestones), [Start] (pick a facility) and [Change scientist].
// Scientists appear by title and skill only.
import { html, nothing, TemplateResult } from "lit";
import { translateText } from "../../Utils";
import { ringSvg } from "../domestic/Dial";
import {
  DepthIndustryModel,
  ProjectCard,
  projectKey,
  scientistKey,
} from "./DepthIndustryModel";
import { blockText, buildingName } from "./EconomyModel";
import { TAB_BTN, TAB_HEAD, TabUi } from "./WwTabUi";

const stars = (n: number) => "★".repeat(Math.max(0, n));

export function renderProjectsTab(
  m: DepthIndustryModel,
  ui: TabUi,
): TemplateResult {
  const facilities = m.facilities();
  return html`<div data-ww-projects>
    <h4 class=${TAB_HEAD}>${translateText("ww1936.project_ui.facilities")}</h4>
    <ul class="m-0 flex list-none flex-wrap gap-1 p-0 text-xs">
      ${facilities.length === 0
        ? html`<li class="text-white/60">
            ${translateText("ww1936.project_ui.none")}
          </li>`
        : facilities.map(
            (f) =>
              html`<li
                data-ww-facility=${f.region}
                class="rounded border border-white/15 px-2 py-1 ${f.busy
                  ? "text-cyan-200"
                  : ""}"
              >
                ${buildingName(f.kind)}
              </li>`,
          )}
    </ul>
    <ul class="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
      ${m.projectCards().map((c) => renderCard(m, ui, c))}
    </ul>
  </div>`;
}

function renderCard(
  m: DepthIndustryModel,
  ui: TabUi,
  c: ProjectCard,
): TemplateResult {
  const pickKey = `proj_fac:${c.project}`;
  const picking = ui.pick[pickKey] === 1;
  const sci = m.scientists();
  const changeKey = `proj_sci:${c.project}`;
  return html`<li
    data-ww-project=${c.project}
    data-state=${c.state}
    class="rounded-md border border-white/15 bg-white/5 p-2 ${c.state ===
    "locked"
      ? "opacity-50"
      : ""}"
  >
    <div class="flex items-center gap-2">
      <span class="relative size-10 shrink-0">
        ${ringSvg(c.progressPm / 1000, c.state === "done" ? "science" : "grey")}
        <span
          class="relative flex size-full items-center justify-center text-[10px] font-bold tabular-nums"
          >${Math.floor(c.progressPm / 10)}%</span
        >
      </span>
      <span class="min-w-0 flex-1 text-xs">
        <span class="block truncate text-sm font-bold"
          >${translateText(projectKey(c.project))}</span
        >
        <span class="block text-white/70"
          >${c.state === "running"
            ? translateText("ww1936.project_ui.days_left", { days: c.daysLeft })
            : c.state === "locked"
              ? blockText("project_locked")
              : c.state === "done"
                ? translateText("ww1936.project_ui.progress", { pct: 100 })
                : translateText("ww1936.project_ui.idle")}</span
        >
      </span>
      ${c.milestones === null
        ? nothing
        : html`<span data-ww-milestones class="flex gap-0.5">
            ${c.milestones.map(
              (on) =>
                html`<span
                  class="size-3 rounded-sm border border-white/40 ${on
                    ? "bg-amber-300"
                    : ""}"
                ></span>`,
            )}
          </span>`}
    </div>
    ${c.uranium === null
      ? nothing
      : html`<div data-ww-input class="mt-1 text-xs tabular-nums text-white/80">
          ${translateText("ww1936.project_ui.input", {
            item: translateText("ww1936.res.uranium"),
            have: c.uranium.got,
            need: c.uranium.need,
          })}
        </div>`}
    ${c.scientist === null
      ? c.state === "running"
        ? html`<div class="mt-1 text-xs text-amber-200">
            ${translateText("ww1936.project_ui.scientist", { name: "—" })}
          </div>`
        : nothing
      : html`<div data-ww-scientist class="mt-1 text-xs">
          ${translateText(scientistKey(c.scientist.spec), {
            n: c.scientist.id + 1,
          })}
          ${stars(c.scientist.skill)} ${c.scientist.matches ? "✓" : ""}
        </div>`}
    <div class="mt-1 flex flex-wrap gap-1">
      ${c.state === "available"
        ? html`<button
            type="button"
            data-ww-start
            class=${TAB_BTN}
            ?disabled=${c.facilities.length === 0}
            @click=${() => {
              if (c.facilities.length === 1) {
                ui.send({
                  kind: "project_start",
                  project: c.project,
                  facility: c.facilities[0],
                });
              } else {
                ui.pick[pickKey] = picking ? 0 : 1;
                ui.redraw();
              }
            }}
          >
            ${translateText("ww1936.project_ui.start")}
          </button>`
        : nothing}
      ${picking
        ? c.facilities.map(
            (region) =>
              html`<button
                type="button"
                data-ww-pick-facility=${region}
                class=${TAB_BTN}
                @click=${() => {
                  ui.pick[pickKey] = 0;
                  ui.send({
                    kind: "project_start",
                    project: c.project,
                    facility: region,
                  });
                }}
              >
                ${translateText("ww1936.project_ui.facility_row", {
                  facility: buildingName(c.facility),
                  region: ui.regionName(region),
                })}
              </button>`,
          )
        : nothing}
      ${c.state === "running"
        ? html`<button
              type="button"
              data-ww-change-scientist
              class=${TAB_BTN}
              @click=${() => {
                ui.pick[changeKey] = ui.pick[changeKey] === 1 ? 0 : 1;
                ui.redraw();
              }}
            >
              ${translateText("ww1936.project_ui.change_scientist")}
            </button>
            ${ui.pick[changeKey] === 1
              ? sci.map(
                  (s) =>
                    html`<button
                      type="button"
                      data-ww-scientist-pick=${s.id}
                      class=${TAB_BTN}
                      @click=${() => {
                        ui.pick[changeKey] = 0;
                        ui.send({
                          kind: "project_scientist",
                          project: c.project,
                          scientist: s.id,
                        });
                      }}
                    >
                      ${translateText(scientistKey(s.spec), { n: s.id + 1 })}
                      ${stars(s.skill)}
                    </button>`,
                )
              : nothing}
            <button
              type="button"
              data-ww-cancel-project
              class=${TAB_BTN}
              @click=${() =>
                ui.confirm(`proj_cancel:${c.project}`, () =>
                  ui.send({ kind: "project_cancel", project: c.project }),
                )}
            >
              ${ui.armed(`proj_cancel:${c.project}`)
                ? translateText("ww1936.econ.cancel_tap")
                : translateText("ww1936.econ.cancel_project")}
            </button>`
        : nothing}
    </div>
  </li>`;
}
