import type { CatalogueFaction, CatalogueUnit } from '../../types/catalogue'
import type { ArmyListItem, SelectedOption } from './listBuilderTypes'

export function getUnitBaseCost(unit: CatalogueUnit, count = unit.model?.defaultCount ?? 1): number {
  return (unit.model?.pointsPerModel ?? 0) * count
}

export function getSelectedOptionCost(unit: CatalogueUnit, selectedOptions: SelectedOption[]): number {
  return selectedOptions.reduce((total, selected) => {
    const group = unit.optionGroups.find((item) => item.id === selected.groupId)
    const option = group?.options.find((item) => item.id === selected.optionId)
    return total + (option?.points ?? 0)
  }, 0)
}

export function getListItemCost(unit: CatalogueUnit, item: ArmyListItem): number {
  return getUnitBaseCost(unit, item.count) + getSelectedOptionCost(unit, item.selectedOptions)
}

export function getDefaultCount(unit: CatalogueUnit): number {
  return unit.model?.defaultCount ?? unit.model?.minCount ?? 1
}

export function clampModelCount(unit: CatalogueUnit, value: number): number {
  const min = unit.model?.minCount ?? 1
  const max = unit.model?.maxCount ?? 99
  return Math.min(max, Math.max(min, value))
}

export function makeListItem(unit: CatalogueUnit): ArmyListItem {
  return {
    id: `${unit.id}-${crypto.randomUUID()}`,
    unitId: unit.id,
    count: getDefaultCount(unit),
    selectedOptions: getDefaultSelectedOptions(unit),
  }
}

export function getDefaultSelectedOptions(unit: CatalogueUnit): SelectedOption[] {
  return unit.optionGroups
    .map((group) => {
      const defaultOption =
        group.options.find((option) => option.targetId === group.defaultOptionId) ??
        group.options.find((option) => option.id === group.defaultOptionId) ??
        (group.min && group.min > 0 ? group.options[0] : undefined)

      return defaultOption ? { groupId: group.id, optionId: defaultOption.id } : undefined
    })
    .filter((option): option is SelectedOption => Boolean(option))
}

export function getUnitById(faction: CatalogueFaction | undefined, unitId: string): CatalogueUnit | undefined {
  return faction?.units.find((unit) => unit.id === unitId)
}

export function formatPoints(points: number): string {
  return `${points} pts`
}

export function publicAssetUrl(url: string | undefined): string | undefined {
  if (!url || /^https?:\/\//i.test(url)) {
    return url
  }
  return `${import.meta.env.BASE_URL}${url}`
}

export function exportArmyList(faction: CatalogueFaction, items: ArmyListItem[]): string {
  const lines = [`${faction.name} Army List`, '']
  let total = 0

  for (const item of items) {
    const unit = getUnitById(faction, item.unitId)
    if (!unit) {
      continue
    }
    const itemCost = getListItemCost(unit, item)
    total += itemCost
    lines.push(`${unit.name} x${item.count} - ${formatPoints(itemCost)}`)

    for (const selected of item.selectedOptions) {
      const group = unit.optionGroups.find((optionGroup) => optionGroup.id === selected.groupId)
      const option = group?.options.find((candidate) => candidate.id === selected.optionId)
      if (group && option) {
        lines.push(`  ${group.name}: ${option.name}${option.points ? ` (+${option.points})` : ''}`)
      }
    }
  }

  lines.push('', `Total: ${formatPoints(total)}`)
  return lines.join('\n')
}

export function listTotal(faction: CatalogueFaction | undefined, items: ArmyListItem[]): number {
  if (!faction) {
    return 0
  }
  return items.reduce((total, item) => {
    const unit = getUnitById(faction, item.unitId)
    return total + (unit ? getListItemCost(unit, item) : 0)
  }, 0)
}
