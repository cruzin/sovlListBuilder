import type { CatalogueUnit } from '../../types/catalogue'

export type SelectedOption = {
  groupId: string
  optionId: string
}

export type ArmyListItem = {
  id: string
  unitId: string
  count: number
  selectedOptions: SelectedOption[]
}

export type SavedArmyList = {
  factionId: string
  items: ArmyListItem[]
  savedAt: string
}

export type UnitWithFaction = CatalogueUnit & {
  factionName: string
}
