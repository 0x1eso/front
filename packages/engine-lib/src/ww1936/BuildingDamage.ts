// World War 1936 P4 (plan decision 13): the working buildings after bomb
// damage, shared by the engine (economy/Buildings) and the screens
// (WwEconomyView), so both count the same.

/** count − floor(damage / 1000), never below 0 (damage milli: 1,000 = one building stopped). */
export function effectiveCount(count: number, damageMilli: number): number {
  return damageMilli <= 0
    ? count
    : Math.max(0, count - Math.floor(damageMilli / 1000));
}
