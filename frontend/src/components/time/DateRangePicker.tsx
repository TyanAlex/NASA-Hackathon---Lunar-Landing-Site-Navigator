import { useId } from 'react'
import { useMission } from '../../state/MissionContext'

// <input type="datetime-local"> has no timezone; we treat its value as UTC.
const toInput = (iso: string) => iso.slice(0, 16)
const fromInput = (v: string) => `${v}:00Z`

/** The backend refuses requests over this many samples (see /api/ephemeris). */
const MAX_SAMPLES = 2000
const STEPS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 360, label: '6 h' },
]

/** Sample step; options that would exceed the backend's sample limit for the current range are disabled. */
export function StepSelect({ className }: { className?: string }) {
  const { range, stepMinutes, setStepMinutes } = useMission()
  const id = useId()
  const spanMin = (Date.parse(range.end) - Date.parse(range.start)) / 60_000
  return (
    <label htmlFor={id} className={className}>
      Step
      <select id={id} value={stepMinutes} onChange={(e) => setStepMinutes(Number(e.target.value))}>
        {STEPS.map((s) => (
          <option key={s.minutes} value={s.minutes} disabled={spanMin / s.minutes > MAX_SAMPLES}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function DateRangePicker() {
  const { range, setRange } = useMission()

  return (
    <section>
      <h3>Date range (UTC)</h3>
      <label>
        Start
        <input type="datetime-local" value={toInput(range.start)} onChange={(e) => setRange({ ...range, start: fromInput(e.target.value) })} />
      </label>
      <label>
        End
        <input type="datetime-local" value={toInput(range.end)} onChange={(e) => setRange({ ...range, end: fromInput(e.target.value) })} />
      </label>
      <StepSelect />
    </section>
  )
}
