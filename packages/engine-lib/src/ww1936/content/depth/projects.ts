// World War 1936 P6 (spec §9.2, §19.6): the majors' scientists and the
// historical atomic targets.
//
// Scientists are titles with a number ("Nuclear Physicist 2", key
// ww1936.scientist.<spec>), never real people (spec §24-2). Each major has
// one per field at skill 2-4; the spec table fixes the notable ones (USA
// nuclear 4 / electronics 3, Germany rocket 4 / aviation 3, Britain
// electronics 4 / nuclear 3, Soviet Union nuclear 2 / rocket 3, Italy
// aviation 2, Japan nuclear 2 / aviation 3, France nuclear 3) and the rest
// is this lane's choice. Minors' scientists come from the engine (dev).
// In June 1940 French nuclear physicists reached Britain with the heavy
// water (P5 has no fra_heavy_water_flight event): Britain gains one nuclear
// scientist from 1940-06-21 and France keeps its own.
import type {
  NukeTargetDef,
  ScientistDef,
} from "@openfront/engine-api/ww1936/DepthTypes";

export const SCIENTISTS: readonly ScientistDef[] = [
  { tag: "USA", spec: "nuclear", skill: 4 },
  { tag: "USA", spec: "rocket", skill: 2 },
  { tag: "USA", spec: "electronics", skill: 3 },
  { tag: "USA", spec: "aviation", skill: 3 },

  { tag: "DEU", spec: "nuclear", skill: 2 },
  { tag: "DEU", spec: "rocket", skill: 4 },
  { tag: "DEU", spec: "electronics", skill: 2 },
  { tag: "DEU", spec: "aviation", skill: 3 },

  { tag: "GBR", spec: "nuclear", skill: 3 },
  { tag: "GBR", spec: "rocket", skill: 2 },
  { tag: "GBR", spec: "electronics", skill: 4 },
  { tag: "GBR", spec: "aviation", skill: 3 },
  { tag: "GBR", spec: "nuclear", skill: 2, from: "1940-06-21" },

  { tag: "SUN", spec: "nuclear", skill: 2 },
  { tag: "SUN", spec: "rocket", skill: 3 },
  { tag: "SUN", spec: "electronics", skill: 2 },
  { tag: "SUN", spec: "aviation", skill: 3 },

  { tag: "ITA", spec: "nuclear", skill: 2 },
  { tag: "ITA", spec: "rocket", skill: 2 },
  { tag: "ITA", spec: "electronics", skill: 2 },
  { tag: "ITA", spec: "aviation", skill: 2 },

  { tag: "JPN", spec: "nuclear", skill: 2 },
  { tag: "JPN", spec: "rocket", skill: 2 },
  { tag: "JPN", spec: "electronics", skill: 2 },
  { tag: "JPN", spec: "aviation", skill: 3 },

  { tag: "FRA", spec: "nuclear", skill: 3 },
  { tag: "FRA", spec: "rocket", skill: 2 },
  { tag: "FRA", spec: "electronics", skill: 2 },
  { tag: "FRA", spec: "aviation", skill: 2 },
];

// Spec §19.6: with the historical AI on, the United States picks these
// regions first, from 1945-08-01. Hiroshima is region 757 (히로시마현);
// Nagasaki is region 1369, carved out of Kumamoto (800) by map v5 (Task 15;
// ledger ruling: [757, 1369]). Home islands only — never a Korean or
// Taiwanese region (spec §24-3).
export const NUKE_TARGETS: readonly NukeTargetDef[] = [
  {
    attacker: "USA",
    target: "JPN",
    regions: [757, 1369],
    notBefore: "1945-08-01",
  },
];
