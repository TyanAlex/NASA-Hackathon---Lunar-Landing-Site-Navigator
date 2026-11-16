import { Moon } from 'lucide-react'
import { pageHref, type Page } from '../../hooks/useHashRoute'
import type { ViewMode } from '../../lib/places'

const NAV: { page: Page; label: string }[] = [
  { page: 'explore', label: 'Explore' },
  { page: 'detail', label: 'Site detail' },
  { page: 'compare', label: 'Compare' },
]

interface Props {
  page: Page
  mode: ViewMode
  onMode: (m: ViewMode) => void
}

export function AppHeader({ page, mode, onMode }: Props) {
  return (
    <header className="app-header">
      <a className="brand" href={pageHref('explore')}>
        <Moon size={22} aria-hidden />
        <strong>Lunar Lens</strong>
      </a>

      <nav aria-label="Primary" className="app-nav">
        {NAV.map((n) => (
          <a key={n.page} href={pageHref(n.page)} aria-current={page === n.page ? 'page' : undefined}>
            {n.label}
          </a>
        ))}
      </nav>

      <div className="view-toggle" role="group" aria-label="View mode">
        <span>View</span>
        <div className="segmented">
          <button type="button" aria-pressed={mode === 'simple'} onClick={() => onMode('simple')}>Simple</button>
          <button type="button" aria-pressed={mode === 'detailed'} onClick={() => onMode('detailed')}>Detailed</button>
        </div>
      </div>
    </header>
  )
}
