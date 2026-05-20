import type { CatalogueFaction, CatalogueUnit, ForceFormat } from '../../types/catalogue'
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

export function getForceById(faction: CatalogueFaction | undefined, forceId: string): ForceFormat | undefined {
  return faction?.forces.find((force) => force.id === forceId) ?? faction?.forces[0]
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

export function exportArmyList(faction: CatalogueFaction, items: ArmyListItem[], force?: ForceFormat): string {
  const lines = [`${faction.name} ${force?.name ?? 'Army'} List`]
  if (force?.pointLimit !== undefined) {
    lines.push(`Limit: ${formatPoints(force.pointLimit)}`)
  }
  lines.push('')
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

export function getUnitSelectionCount(items: ArmyListItem[], unitId: string): number {
  return items.filter((item) => item.unitId === unitId).length
}

export function getCategoryUsage(
  faction: CatalogueFaction | undefined,
  items: ArmyListItem[],
  force: ForceFormat | undefined,
): Map<string, number> {
  const usage = new Map<string, number>()
  if (!faction || !force) {
    return usage
  }

  for (const item of items) {
    const unit = getUnitById(faction, item.unitId)
    if (!unit) {
      continue
    }
    for (const limit of force.categoryLimits) {
      if (unit.categoryIds.includes(limit.id) || unit.categories.includes(limit.name)) {
        usage.set(limit.id, (usage.get(limit.id) ?? 0) + 1)
      }
    }
  }

  return usage
}

export function getArmyLimitWarnings(
  faction: CatalogueFaction | undefined,
  items: ArmyListItem[],
  force: ForceFormat | undefined,
): string[] {
  if (!faction || !force) {
    return []
  }

  const warnings: string[] = []
  const total = listTotal(faction, items)
  if (force.pointLimit !== undefined && total > force.pointLimit) {
    warnings.push(`List is ${formatPoints(total - force.pointLimit)} over the ${force.name} limit.`)
  }

  const categoryUsage = getCategoryUsage(faction, items, force)
  for (const limit of force.categoryLimits) {
    const current = categoryUsage.get(limit.id) ?? 0
    if (limit.min !== undefined && current < limit.min) {
      warnings.push(`${limit.name} needs ${limit.min - current} more selection${limit.min - current === 1 ? '' : 's'}.`)
    }
    if (limit.max !== undefined && current > limit.max) {
      warnings.push(`${limit.name} has ${current}; maximum is ${limit.max}.`)
    }
  }

  for (const unit of faction.units) {
    const current = getUnitSelectionCount(items, unit.id)
    if (unit.maxSelections !== undefined && current > unit.maxSelections) {
      warnings.push(`${unit.name} has ${current}; maximum is ${unit.maxSelections}.`)
    }
  }

  return warnings
}

export function getAddUnitBlockReason(
  faction: CatalogueFaction | undefined,
  items: ArmyListItem[],
  force: ForceFormat | undefined,
  unit: CatalogueUnit,
): string | undefined {
  if (!faction || !force) {
    return undefined
  }

  if (unit.maxSelections !== undefined && getUnitSelectionCount(items, unit.id) >= unit.maxSelections) {
    return `${unit.name} is limited to ${unit.maxSelections}.`
  }

  const nextUnitCost =
    getUnitBaseCost(unit, getDefaultCount(unit)) + getSelectedOptionCost(unit, getDefaultSelectedOptions(unit))
  const nextTotal = listTotal(faction, items) + nextUnitCost
  if (force.pointLimit !== undefined && nextTotal > force.pointLimit) {
    return `Adding this would exceed ${force.name}'s ${formatPoints(force.pointLimit)} cap.`
  }

  const categoryUsage = getCategoryUsage(faction, items, force)
  const blockedCategory = force.categoryLimits.find((limit) => {
    const matches = unit.categoryIds.includes(limit.id) || unit.categories.includes(limit.name)
    return matches && limit.max !== undefined && (categoryUsage.get(limit.id) ?? 0) >= limit.max
  })

  if (blockedCategory) {
    return `${blockedCategory.name} is limited to ${blockedCategory.max}.`
  }

  return undefined
}
