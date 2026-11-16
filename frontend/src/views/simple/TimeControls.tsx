import { Pause, Play } from 'lucide-react'
import { useId, useState } from 'react'
import { usePlayback } from '../../hooks/usePlayback'
import { formatUtc } from '../../lib/format'
import { missionSampleCount } from '../../lib/mission'
import { LUNAR_DAY_DAYS, lunarDayRange } from '../../lib/lunar'
import { useCurrentSample, useMission } from '../../state/MissionContext'
import { VisibilityBars } from './VisibilityBars'

const SPEEDS = [
  { hours: 1, label: '1 hour / sec' },
  { hours: 6, label: '6 hours / sec' },
  { hours: 24, label: '1 day / sec' },
]

/**
 * Landing date/time sets the start of a one-lunar-day window. The scrubber, the Sun/Earth bars and
 * every metric read from that same window and the same timeIndex, so they always move together.
 */
export function TimeControls() {
  const { range, setRange, timeIndex, setTimeIndex, setPlaying, ephemeris, missionType } = useMission()
  const sample = useCurrentSample()
  const [speed, setSpeed] = useState(1)
  const id = useId()
  const samples = ephemeris.data?.samples ?? []
  const { playing, toggle: togglePlay, count } = usePlayback(speed)

  const setLanding = (date: string, time: string) => {
    const iso = `${date}T${time}:00Z`
    const year = Number(date.slice(0, 4))
    if (!date || !time || Number.isNaN(Date.parse(iso)) || year < 1900 || year > 2200) return
    setPlaying(false)
    setRange(lunarDayRange(iso))
    setTimeIndex(0)
  }

  const landingDate = range.start.slice(0, 10)
  const landingTime = range.start.slice(11, 16)
  const dayNumber = sample ? (Date.parse(sample.time) - Date.parse(range.start)) / 86_400_000 : 0

  return (
    <section className="s-card time-card" aria-label="Date and time">
      <div className="time-row">
        <div className="field">
          <label htmlFor={`${id}-date`}>Landing date</label>
          <input id={`${id}-date`} type="date" value={landingDate} onChange={(e) => setLanding(e.target.value, landingTime)} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-time`}>Time (UTC)</label>
          <input id={`${id}-time`} type="time" value={landingTime} onChange={(e) => setLanding(landingDate, e.target.value)} />
        </div>
        <button type="button" className="btn btn-outline play-btn" disabled={!count} onClick={() => togglePlay()}>
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <div className="field">
          <label htmlFor={`${id}-speed`}>Speed</label>
          <select id={`${id}-speed`} value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => <option key={s.hours} value={s.hours}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <div className="scrub-label">
          <label htmlFor={`${id}-scrub`}>Scrub the lunar day (about {LUNAR_DAY_DAYS.toFixed(1)} Earth days)</label>
          <span className="scrub-now">
            {sample ? <>Day {dayNumber.toFixed(1)} · {formatUtc(sample.time)}</> : ephemeris.loading ? 'Computing…' : '—'}
          </span>
        </div>
        {/* Same label gutter as the bars below, so the thumb lines up with the black marker. */}
        <div className="vis-row">
          <span className="vis-label" aria-hidden />
          <input
            id={`${id}-scrub`}
            type="range"
            className="scrub"
            min={0}
            max={Math.max(count - 1, 0)}
            value={Math.min(timeIndex, Math.max(count - 1, 0))}
            disabled={!count}
            onChange={(e) => setTimeIndex(Number(e.target.value))}
            aria-valuetext={sample ? formatUtc(sample.time) : undefined}
          />
        </div>
      </div>

      <VisibilityBars samples={samples} timeIndex={timeIndex} rangeStart={range.start} missionEnd={ephemeris.data ? missionSampleCount(ephemeris.data, missionType) : undefined} />
    </section>
  )
}
