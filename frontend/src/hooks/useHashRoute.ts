import { useEffect, useState } from 'react'

export type Page = 'explore' | 'detail' | 'compare'

const PAGES: Page[] = ['explore', 'detail', 'compare']

function read(): Page {
  const p = window.location.hash.replace(/^#\/?/, '') as Page
  return PAGES.includes(p) ? p : 'explore'
}

/** Current page from the URL hash (#/explore, #/detail, #/compare). Links use href="#/detail". */
export function useHashRoute(): Page {
  const [page, setPage] = useState(read)
  useEffect(() => {
    const onChange = () => setPage(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return page
}

export const pageHref = (p: Page) => `#/${p}`

/** Go to a page from an event handler. */
export function navigate(p: Page) {
  window.location.hash = pageHref(p)
}
