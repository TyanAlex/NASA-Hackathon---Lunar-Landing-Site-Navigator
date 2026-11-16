import { useState } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import { ComparePage } from './components/layout/PlaceholderPages'
import { useHashRoute } from './hooks/useHashRoute'
import { useLocalStorage } from './hooks/useLocalStorage'
import { isLunarDayRange, lunarDayRange } from './lib/lunar'
import { MAX_COMPARE, type Place, type ViewMode } from './lib/places'
import { MissionProvider, useMission } from './state/MissionContext'
import { DetailedExplorer } from './views/detailed/DetailedExplorer'
import { SiteDetailDetailed } from './views/detailed/SiteDetailDetailed'
import { SimpleExplorer } from './views/simple/SimpleExplorer'
import { SiteDetail } from './views/simple/SiteDetail'
import './App.css'
import './shell.css'

function Shell() {
  const page = useHashRoute()
  const [mode, setMode] = useLocalStorage<ViewMode>('lln.viewMode', 'simple')
  const [customSites, setCustomSites] = useLocalStorage<Place[]>('lln.customSites', [])
  const [tray, setTray] = useState<Place[]>([])
  const { range, setRange, setTimeIndex } = useMission()

  const changeMode = (m: ViewMode) => {
    // Simple's "this lunar day" metrics assume a one-lunar-day window; Detailed may have set any range.
    if (m === 'simple' && !isLunarDayRange(range)) {
      setRange(lunarDayRange(range.start))
      setTimeIndex(0)
    }
    setMode(m)
  }

  const toggleTray = (p: Place) =>
    setTray((t) => (t.some((x) => x.id === p.id) ? t.filter((x) => x.id !== p.id) : t.length < MAX_COMPARE ? [...t, p] : t))

  const deleteCustom = (id: string) => {
    setCustomSites((s) => s.filter((p) => p.id !== id))
    setTray((t) => t.filter((p) => p.id !== id))
  }

  const fullBleed = page === 'explore' && mode === 'detailed'

  return (
    <div className={`shell${mode === 'simple' ? ' light' : ''}`}>
      <AppHeader page={page} mode={mode} onMode={changeMode} />
      <div className={`shell-main${fullBleed ? '' : ' scroll'}`}>
        {page === 'explore' &&
          (mode === 'simple' ? (
            <SimpleExplorer
              tray={tray}
              onToggleTray={toggleTray}
              customSites={customSites}
              onSaveCustom={(p) => setCustomSites((s) => [...s, p])}
              onDeleteCustom={deleteCustom}
            />
          ) : (
            <DetailedExplorer
              tray={tray}
              onToggleTray={toggleTray}
              customSites={customSites}
              onSaveCustom={(p) => setCustomSites((s) => [...s, p])}
            />
          ))}
        {page === 'detail' && (mode === 'simple' ? <SiteDetail tray={tray} onToggleTray={toggleTray} /> : <SiteDetailDetailed tray={tray} onToggleTray={toggleTray} />)}
        {page === 'compare' && <ComparePage tray={tray} />}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <MissionProvider>
      <Shell />
    </MissionProvider>
  )
}
