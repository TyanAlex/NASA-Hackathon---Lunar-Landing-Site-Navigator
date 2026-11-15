import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { pageHref } from '../../hooks/useHashRoute'
import { shortLatLon } from '../../lib/lunar'
import type { Place } from '../../lib/places'
import { useMission } from '../../state/MissionContext'

function Placeholder({ title, intro, children }: { title: string; intro: string; children?: ReactNode }) {
  return (
    <div className="placeholder-page">
      <a className="back-link" href={pageHref('explore')}><ArrowLeft size={16} aria-hidden /> Back to Explore</a>
      <h1>{title}</h1>
      <p className="placeholder-intro">{intro}</p>
      {children}
      <p className="placeholder-soon">This screen is coming soon.</p>
    </div>
  )
}

export function SiteDetailPage() {
  const { location } = useMission()
  return (
    <Placeholder title="Site detail" intro="Horizon panorama and the full lunar-day timeline for the selected site.">
      <div className="placeholder-card">
        {location ? (
          <>
            <div className="eyebrow">Selected site</div>
            <strong>{location.name}</strong>
            <span className="muted">{shortLatLon(location.lat, location.lon)}</span>
          </>
        ) : (
          <span className="muted">No site selected. Pick one on the Explore screen.</span>
        )}
      </div>
    </Placeholder>
  )
}

export function ComparePage({ tray }: { tray: Place[] }) {
  return (
    <Placeholder title="Compare sites" intro="Side-by-side metrics for up to three sites, with a launch-slip slider.">
      {tray.length ? (
        <ul className="placeholder-list">
          {tray.map((p) => (
            <li key={p.id} className="placeholder-card">
              <strong>{p.name}</strong>
              <span className="muted">{shortLatLon(p.lat, p.lon)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="placeholder-card"><span className="muted">The compare tray is empty. Tick up to three sites on the Explore screen.</span></div>
      )}
    </Placeholder>
  )
}
