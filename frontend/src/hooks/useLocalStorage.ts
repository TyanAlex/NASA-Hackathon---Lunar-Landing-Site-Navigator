import { useState } from 'react'

/** useState mirrored to localStorage. Falls back to `initial` when storage is unavailable or holds bad JSON. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })

  const set = (next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        // Private mode or quota: keep the in-memory value.
      }
      return v
    })
  }

  return [value, set] as const
}
