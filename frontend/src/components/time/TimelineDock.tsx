import { ChartLine, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { ElevationChart } from '../charts/ElevationChart'
import { Timeline } from './Timeline'

export function TimelineDock() {
  const [chartOpen, setChartOpen] = useState(true)

  return (
    <section className="dock card" aria-label="Timeline">
      <div className="dock-bar">
        <Timeline />
        <button type="button" className="icon-btn" aria-expanded={chartOpen} onClick={() => setChartOpen(!chartOpen)} title="Elevation chart">
          {chartOpen ? <ChevronDown size={18} /> : <ChartLine size={18} />}
        </button>
      </div>
      {chartOpen && (
        <div className="dock-chart">
          <ElevationChart />
        </div>
      )}
    </section>
  )
}
