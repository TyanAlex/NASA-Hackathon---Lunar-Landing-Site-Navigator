import { useMission } from '../../state/MissionContext'

// <input type="datetime-local"> has no timezone; we treat its value as UTC.
const toInput = (iso: string) => iso.slice(0, 16)
const fromInput = (v: string) => `${v}:00Z`

export function DateRangePicker() {
  const { range, setRange, stepMinutes, setStepMinutes } = useMission()

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
      <label>
        Step
        <select value={stepMinutes} onChange={(e) => setStepMinutes(Number(e.target.value))}>
          <option value={15}>15 min</option>
          <option value={60}>1 h</option>
          <option value={360}>6 h</option>
        </select>
      </label>
    </section>
  )
}
