import type { Sample } from '../api/types'
import { bothUp } from './stats'

/** One row of a visibility-bars chart: when `pred` holds, the bar is filled. */
export interface BarRow {
  key: string
  label: string
  /** Segment color class: seg-sun | seg-earth | seg-ops */
  cls: 'seg-sun' | 'seg-earth' | 'seg-ops'
  pred: (s: Sample) => boolean
}

export const SUN_EARTH_ROWS: BarRow[] = [
  { key: 'sun', label: 'Sun', cls: 'seg-sun', pred: (s) => s.sun.visible },
  { key: 'earth', label: 'Earth', cls: 'seg-earth', pred: (s) => s.earth.visible },
]

export const OPS_ROW: BarRow = { key: 'both', label: 'Both up', cls: 'seg-ops', pred: bothUp }
