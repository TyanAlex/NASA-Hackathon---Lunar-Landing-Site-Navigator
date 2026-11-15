import { Pause, Play } from 'lucide-react'
import { useEffect } from 'react'
import { formatUtc } from '../../lib/format'
import { useCurrentSample, useMission } from '../../state/MissionContext'

const PLAY_INTERVAL_MS = 50

export function Timeline() {
  const { ephemeris, timeIndex, setTimeIndex, playing, setPlaying } = useMission()
  const sample = useCurrentSample()
  const count = ephemeris.data?.samples.length ?? 0

  useEffect(() => {
    if (!playing || count === 0) return
    const id = setInterval(() => setTimeIndex((timeIndex + 1) % count), PLAY_INTERVAL_MS)
    return () => clearInterval(id)
  }, [playing, timeIndex, count, setTimeIndex])

  return (
    <div className="timeline">
      <button type="button" disabled={!count} onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(count - 1, 0)}
        value={timeIndex}
        disabled={!count}
        onChange={(e) => setTimeIndex(Number(e.target.value))}
      />
      <span>{sample ? formatUtc(sample.time) : '—'}</span>
    </div>
  )
}
