import * as React from "react"

const KEY = "gymtech.recent_routes"
const MAX = 5

export interface RecentRoute {
  href: string
  label: string
  visitedAt: number
}

/**
 * Persist the last N visited routes in localStorage so the sidebar can show
 * a "Recent" section (Linear/Notion style). Returns the current list and a
 * `push` method. Components call `push({ href, label })` on mount.
 */
export function useRecentRoutes() {
  const [recent, setRecent] = React.useState<RecentRoute[]>([])

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setRecent(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }, [])

  const push = React.useCallback((entry: Omit<RecentRoute, "visitedAt">) => {
    setRecent((prev) => {
      const next: RecentRoute[] = [
        { ...entry, visitedAt: Date.now() },
        ...prev.filter((r) => r.href !== entry.href),
      ].slice(0, MAX)
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const clear = React.useCallback(() => {
    setRecent([])
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  }, [])

  return { recent, push, clear }
}
