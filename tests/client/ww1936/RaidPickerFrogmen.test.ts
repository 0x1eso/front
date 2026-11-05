// ww91 N3: the raid picker names the frogmen bonus on ports and docks only.
import { render } from "lit";
import { renderRaidPicker } from "../../../src/client/hud/ww1936/WwRaidPicker";

function labels(kind: "raid_commando" | "raid_para", pm: number): string[] {
  const host = document.createElement("div");
  render(
    renderRaidPicker(
      kind,
      [
        { building: "naval_base", facility: false },
        { building: "radar", facility: false },
      ],
      () => {},
      () => {},
      () => {},
      pm,
    ),
    host,
  );
  return [...host.querySelectorAll("[data-ww-raid-target]")].map(
    (e) => e.textContent ?? "",
  );
}

test("only a commando raid on a port shows the bonus", () => {
  const [port, radar] = labels("raid_commando", 150);
  expect(port).toContain("frogmen");
  expect(radar).not.toContain("frogmen");
  expect(labels("raid_commando", 0)[0]).not.toContain("frogmen");
  expect(labels("raid_para", 150)[0]).not.toContain("frogmen");
});
