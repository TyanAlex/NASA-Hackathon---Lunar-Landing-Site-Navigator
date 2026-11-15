import { formatDuration } from '../../lib/format'

interface Props {
  label: string
  from: string
  to: string | null
}

export function Countdown({ label, from, to }: Props) {
  const ms = to ? new Date(to).getTime() - new Date(from).getTime() : -1
  return (
    <div className="countdown">
      <span>{label}</span>
      <strong>{to ? formatDuration(ms) : 'beyond window'}</strong>
    </div>
  )
}
