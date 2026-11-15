import type { Sample } from '../api/types'

export type Body = 'sun' | 'earth'

/**
 * Next time after samples[from] that `body` rises above / sets below the local horizon,
 * linearly interpolated between samples. null if it doesn't happen inside the window.
 */
export function nextCrossing(samples: Sample[], from: number, body: Body, kind: 'rise' | 'set'): string | null {
  for (let i = from + 1; i < samples.length; i++) {
    const a = samples[i - 1][body]
    const b = samples[i][body]
    const ma = a.el - a.horizon_el
    const mb = b.el - b.horizon_el
    const crossed = kind === 'set' ? ma > 0 && mb <= 0 : ma <= 0 && mb > 0
    if (crossed) {
      const ta = Date.parse(samples[i - 1].time)
      const tb = Date.parse(samples[i].time)
      return new Date(ta + ((tb - ta) * ma) / (ma - mb)).toISOString()
    }
  }
  return null
}
