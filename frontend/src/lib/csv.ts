/** Quote a CSV field when needed (commas, quotes, newlines). */
function field(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Save rows as a .csv file in the browser. */
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const blob = new Blob([rows.map((r) => r.map(field).join(',')).join('\n') + '\n'], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** File-name-safe slug, e.g. "IM-2 Athena – Mons Mouton" → "im-2-athena-mons-mouton". */
export const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site'
