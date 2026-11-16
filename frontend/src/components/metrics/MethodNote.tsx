/** How the visibility numbers are calculated (shown behind the ⓘ in Detailed views). */
export function MethodNote({ id, stepMinutes }: { id: string; stepMinutes: number }) {
  return (
    <div id={id} className="method-note">
      <p><strong>Up</strong> means the center of the Sun’s or Earth’s disc is above the local horizon in that direction, terrain included. Roughly half the Sun is showing at that moment.</p>
      <p><strong>Disc visible</strong> is the share of the disc above the horizon (the horizon is treated as a straight line across the disc). From the Moon the Sun is about 0.53° wide and Earth about 1.9°. <strong>Full Sun</strong> counts only times the whole disc is clear, the best case for solar power.</p>
      <p><strong>Positions:</strong> NASA/NAIF SPICE with the DE440 ephemeris in the Moon’s mean-Earth frame; agrees with JPL Horizons to under 0.001°. No atmosphere, so no refraction.</p>
      <p><strong>Terrain:</strong> LRO LOLA elevation (about 240 m per pixel near the south pole, 1.9 km elsewhere), scanned out to 200 km every 0.5° of azimuth, for an observer 2 m above the ground.</p>
      <p><strong>Sampling:</strong> every {stepMinutes} min, so durations are accurate to about one step. Dark periods and gaps that touch the start or end of the window are cut off there.</p>
    </div>
  )
}
