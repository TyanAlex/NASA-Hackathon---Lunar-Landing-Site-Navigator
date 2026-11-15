import { useEffect, useState } from 'react'

export interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface Result<T> {
  key: string
  data: T | null
  error: string | null
}

/** Runs `fetcher` whenever `key` changes; aborts the previous request. Pass key=null to skip. */
export function useFetch<T>(key: string | null, fetcher: (signal: AbortSignal) => Promise<T>): FetchState<T> {
  const [result, setResult] = useState<Result<T> | null>(null)

  useEffect(() => {
    if (key === null) return
    const ctrl = new AbortController()
    fetcher(ctrl.signal)
      .then((data) => setResult({ key, data, error: null }))
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setResult({ key, data: null, error: e.message })
      })
    return () => ctrl.abort()
    // fetcher is intentionally excluded: `key` captures its inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Loading = we have a key but the stored result belongs to a different one.
  const fresh = result?.key === key
  return {
    data: fresh ? result.data : null,
    loading: key !== null && !fresh,
    error: fresh ? result.error : null,
  }
}
