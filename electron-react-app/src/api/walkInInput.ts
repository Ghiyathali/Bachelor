// The walk-in field is typed text, so "", "1.5", "-2" or "abc" must never reach the server.
// 10 000 is far above any real event, so a typo like 40000 is caught (the server checks the same).
export const MAX_WALK_INS = 10_000

export function parseWalkIns(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const number = Number(value.trim())
  return number <= MAX_WALK_INS ? number : null
}
