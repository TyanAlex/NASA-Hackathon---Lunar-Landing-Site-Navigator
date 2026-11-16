import { Check, X } from 'lucide-react'
import { useId, useMemo } from 'react'
import { MISSION_TYPES, missionVerdict, VERDICT_RULES, type MissionType } from '../../lib/verdict'
import { useMission } from '../../state/MissionContext'

/**
 * Mission-type picker + verdict for the selected site and landing date, with the checks behind it.
 * `showRules` (Detailed) also prints the exact rules.
 */
export function MissionVerdict({ showRules = false }: { showRules?: boolean }) {
  const { ephemeris, missionType, setMissionType } = useMission()
  const id = useId()
  const data = ephemeris.data
  const verdict = useMemo(() => (data ? missionVerdict(data, missionType) : null), [data, missionType])
  const type = MISSION_TYPES.find((t) => t.key === missionType)!

  return (
    <div className="verdict">
      <div className="field verdict-field">
        <label htmlFor={`${id}-type`}>Mission type</label>
        <select id={`${id}-type`} value={missionType} onChange={(e) => setMissionType(e.target.value as MissionType)}>
          {MISSION_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <span className="metric-sub">{type.hint}</span>
      </div>
      {verdict ? (
        <>
          <div className={`take take-${verdict.tone}`} role="status">{verdict.headline}</div>
          <ul className="checks" aria-label="Checks behind the verdict">
            {verdict.checks.map((c) => (
              <li key={c.text} className={c.ok ? 'check-ok' : 'check-fail'}>
                {c.ok ? <Check size={14} aria-label="Pass" /> : <X size={14} aria-label="Fail" />}
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
          {showRules && <p className="muted small">{VERDICT_RULES[missionType]}</p>}
        </>
      ) : (
        <p className="muted small">…</p>
      )}
    </div>
  )
}
