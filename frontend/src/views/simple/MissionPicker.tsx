import { useId } from 'react'
import { MISSION_TYPES, type MissionType } from '../../lib/verdict'
import { useMission } from '../../state/MissionContext'

/** Compact mission-type select. Shared setting: changes every page's mission window. */
export function MissionPicker({ className }: { className?: string }) {
  const { missionType, setMissionType } = useMission()
  const id = useId()
  return (
    <div className={`mission-picker ${className ?? ''}`}>
      <label htmlFor={id}>Mission</label>
      <select id={id} value={missionType} onChange={(e) => setMissionType(e.target.value as MissionType)}>
        {MISSION_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>
    </div>
  )
}
