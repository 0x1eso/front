// World War 1936 P2: templates and the training queue (P2 spec §4.4, §5.1).
// STUB: Task 5 writes the bodies; the signatures are final.
import type { LandOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { CountryLand, WwLand } from "./WwLand";

export function saveTemplate(
  land: WwLand,
  cl: CountryLand,
  o: Extract<LandOrder, { kind: "template_save" }>,
): WwOrderBlock | null {
  return null;
}

export function deleteTemplate(
  land: WwLand,
  cl: CountryLand,
  template: number,
): WwOrderBlock | null {
  return null;
}

export function queueTraining(
  land: WwLand,
  cl: CountryLand,
  o: Extract<LandOrder, { kind: "train" }>,
): WwOrderBlock | null {
  return null;
}

export function cancelTraining(
  land: WwLand,
  cl: CountryLand,
  entry: number,
): WwOrderBlock | null {
  return null;
}

export function deployNow(
  land: WwLand,
  cl: CountryLand,
  entry: number,
): WwOrderBlock | null {
  return null;
}
