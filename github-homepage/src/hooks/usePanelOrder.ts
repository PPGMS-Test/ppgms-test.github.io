import { useCallback, useMemo, useState } from 'react'

const STORAGE_KEY = 'navPanelOrder'

function loadStoredOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    if (!parsed.every((x): x is string => typeof x === 'string')) return null
    return parsed
  } catch {
    return null
  }
}

function mergeOrder(allIds: string[], storedOrder: string[] | null): string[] {
  if (!storedOrder) return allIds
  const known = new Set(allIds)
  const used = new Set<string>()
  const ordered: string[] = []
  for (const id of storedOrder) {
    if (known.has(id) && !used.has(id)) {
      ordered.push(id)
      used.add(id)
    }
  }
  // Append ids not present in stored order (newly added).
  for (const id of allIds) {
    if (!used.has(id)) ordered.push(id)
  }
  return ordered
}

export interface UsePanelOrderResult {
  orderedIds: string[]
  setOrder: (ids: string[]) => void
  reset: () => void
  isCustom: boolean
}

/**
 * Persist a user-defined ordering of panel ids in localStorage. Works on opaque
 * string ids so callers can mix heterogeneous panels (NavPanel, TodoPanel, …).
 *
 * Merge rules: stored ids that still exist keep their position; missing ids
 * are dropped; newly-introduced ids are appended to the end.
 */
export function usePanelOrder(allIds: string[]): UsePanelOrderResult {
  const [storedOrder, setStoredOrder] = useState<string[] | null>(() => loadStoredOrder())

  const orderedIds = useMemo(() => mergeOrder(allIds, storedOrder), [allIds, storedOrder])

  const setOrder = useCallback((ids: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    } catch {
      // localStorage may be disabled or full — degrade silently to in-memory order
    }
    setStoredOrder(ids)
  }, [])

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    setStoredOrder(null)
  }, [])

  return {
    orderedIds,
    setOrder,
    reset,
    isCustom: storedOrder !== null,
  }
}
