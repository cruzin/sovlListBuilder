import { useCallback, useEffect, useState } from 'react'
import type { ArmyListItem, SavedArmyList } from './listBuilderTypes'

const STORAGE_KEY = 'sovl-list-builder:army-list'

export function useLocalArmyList(defaultFactionId: string) {
  const [factionId, setFactionId] = useState(defaultFactionId)
  const [items, setItems] = useState<ArmyListItem[]>([])
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return
    }

    try {
      const saved = JSON.parse(raw) as SavedArmyList
      if (saved.factionId) {
        setFactionId(saved.factionId)
      }
      if (Array.isArray(saved.items)) {
        setItems(saved.items)
      }
      setLastSavedAt(saved.savedAt ?? null)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const save = useCallback(() => {
    const savedAt = new Date().toISOString()
    const payload: SavedArmyList = { factionId, items, savedAt }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    setLastSavedAt(savedAt)
  }, [factionId, items])

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setItems([])
    setLastSavedAt(null)
  }, [])

  return {
    factionId,
    setFactionId,
    items,
    setItems,
    save,
    clear,
    lastSavedAt,
  }
}
