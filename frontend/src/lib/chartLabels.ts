/** Nudge end-of-line labels apart so they never overlap (min 14 px), keeping their order. */
export function labelPositions(ys: number[]): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  for (let k = 1; k < order.length; k++) order[k].y = Math.max(order[k].y, order[k - 1].y + 14)
  const out = new Array<number>(ys.length)
  order.forEach((o) => (out[o.i] = o.y))
  return out
}
