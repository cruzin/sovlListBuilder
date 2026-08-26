import type { CatalogueFaction, CatalogueUnit, ForceFormat, UnitModel } from '../../types/catalogue'
import type { ArmyListItem, SelectedOption } from './listBuilderTypes'

export function getUnitBaseCost(unit: CatalogueUnit, count = unit.model?.defaultCount ?? 1): number {
  return (unit.model?.pointsPerModel ?? 0) * count
}

export function getSelectedOptionCost(unit: CatalogueUnit, selectedOptions: SelectedOption[], count = 1): number {
  return selectedOptions.reduce((total, selected) => {
    const group = unit.optionGroups.find((item) => item.id === selected.groupId)
    const option = group?.options.find((item) => item.id === selected.optionId)
    return total + (option?.points ?? 0) + (option?.pointsPerModel ?? 0) * count
  }, 0)
}

export function getListItemCost(unit: CatalogueUnit, item: ArmyListItem): number {
  return getUnitBaseCost(unit, item.count) + getSelectedOptionCost(unit, item.selectedOptions, item.count)
}

export function getEffectiveModel(unit: CatalogueUnit, force?: ForceFormat): UnitModel | undefined {
  if (!unit.model) {
    return undefined
  }

  const override = force?.modelOverrides?.find((item) => item.unitId === unit.id)
  return {
    ...unit.model,
    minCount: override?.minCount ?? unit.model.minCount,
    defaultCount: override?.defaultCount ?? unit.model.defaultCount,
  }
}

export function getDefaultCount(unit: CatalogueUnit, force?: ForceFormat): number {
  const model = getEffectiveModel(unit, force)
  return model?.defaultCount ?? model?.minCount ?? 1
}

export function clampModelCount(
  unit: CatalogueUnit,
  value: number,
  force?: ForceFormat,
  minCountOverride?: number,
): number {
  const model = getEffectiveModel(unit, force)
  const min = minCountOverride ?? model?.minCount ?? 1
  const max = model?.maxCount ?? 99
  return Math.min(max, Math.max(min, value))
}

export function makeListItem(unit: CatalogueUnit, force?: ForceFormat): ArmyListItem {
  return {
    id: `${unit.id}-${crypto.randomUUID()}`,
    unitId: unit.id,
    count: getDefaultCount(unit, force),
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

export function getUnitByOptionTarget(
  faction: CatalogueFaction | undefined,
  targetId: string | undefined,
  optionName?: string,
): CatalogueUnit | undefined {
  if (!faction || !targetId) {
    return undefined
  }
  return faction.units.find((unit) => unit.id === targetId) ?? faction.units.find((unit) => unit.name === optionName)
}

export function getForceById(faction: CatalogueFaction | undefined, forceId: string): ForceFormat | undefined {
  return faction?.forces.find((force) => force.id === forceId) ?? faction?.forces[0]
}

export function formatPoints(points: number): string {
  return `${points} pts`
}

export function formatOptionCost(option: { points?: number; pointsPerModel?: number }): string {
  if (option.pointsPerModel !== undefined && option.pointsPerModel !== 0) {
    return ` (+${option.pointsPerModel}/model)`
  }
  if (option.points !== undefined && option.points !== 0) {
    return ` (+${option.points})`
  }
  return ''
}

export function formatCount(count: number): string {
  return Number.isInteger(count) ? String(count) : count.toFixed(1)
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
        lines.push(`  ${group.name}: ${option.name}${formatOptionCost(option)}`)
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

export function getUnitSelectionLimit(unit: CatalogueUnit, force?: ForceFormat): number | undefined {
  return force?.unitLimits?.find((limit) => limit.unitId === unit.id)?.max ?? unit.maxSelections
}

export function getOverallUnitCount(items: ArmyListItem[]): number {
  return items.filter((item) => !item.retinueForItemId).length
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
        usage.set(limit.id, (usage.get(limit.id) ?? 0) + getCategoryLimitWeight(unit, limit.name))
      }
    }
  }

  return usage
}

export function getCategoryLimitWeight(unit: CatalogueUnit, categoryName: string): number {
  if (!isFastLimitCategory(categoryName)) {
    return 1
  }
  return isHalfFastLimitUnit(unit) ? 0.5 : 1
}

function isFastLimitCategory(categoryName: string): boolean {
  return /fast attack|raiders/i.test(categoryName)
}

function isHalfFastLimitUnit(unit: CatalogueUnit): boolean {
  const searchable = `${unit.name} ${unit.stats.modelType ?? ''}`
  return /bat|dog|hound|wolf|wolves|chariot/i.test(searchable)
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
  const unitCount = getOverallUnitCount(items)
  if (force.unitLimit !== undefined && unitCount > force.unitLimit) {
    warnings.push(`List has ${unitCount} units; maximum is ${force.unitLimit}.`)
  }

  const categoryUsage = getCategoryUsage(faction, items, force)
  for (const limit of force.categoryLimits) {
    const current = categoryUsage.get(limit.id) ?? 0
    if (limit.min !== undefined && current < limit.min) {
      const needed = limit.min - current
      warnings.push(`${limit.name} needs ${formatCount(needed)} more selection${needed === 1 ? '' : 's'}.`)
    }
    if (limit.max !== undefined && current > limit.max) {
      warnings.push(`${limit.name} has ${formatCount(current)}; maximum is ${formatCount(limit.max)}.`)
    }
  }

  for (const unit of faction.units) {
    const current = getUnitSelectionCount(items, unit.id)
    const maxSelections = getUnitSelectionLimit(unit, force)
    if (maxSelections !== undefined && current > maxSelections) {
      warnings.push(`${unit.name} has ${current}; maximum is ${maxSelections}.`)
    }
  }

  return warnings
}

export function getRetinueSelection(
  unit: CatalogueUnit,
  item: ArmyListItem,
): CatalogueUnit['optionGroups'][number] | undefined {
  return unit.optionGroups.find(
    (group) => /retinue/i.test(group.name) && item.selectedOptions.some((selected) => selected.groupId === group.id),
  )
}

export function getSelectedRetinueUnit(
  faction: CatalogueFaction | undefined,
  commander: CatalogueUnit,
  item: ArmyListItem,
): CatalogueUnit | undefined {
  const retinueGroup = getRetinueSelection(commander, item)
  const selectedOption = item.selectedOptions.find((selected) => selected.groupId === retinueGroup?.id)
  const option = retinueGroup?.options.find((candidate) => candidate.id === selectedOption?.optionId)
  return getUnitByOptionTarget(faction, option?.targetId, option?.name)
}

export function getRetinueCount(unit: CatalogueUnit, force?: ForceFormat): number {
  const defaultCount = getDefaultCount(unit, force)
  const isSingleModelUnit = defaultCount <= 1 || (unit.model?.maxCount !== undefined && unit.model.maxCount <= 1)
  return isSingleModelUnit ? defaultCount : Math.max(1, defaultCount - 1)
}

export function makeRetinueListItem(
  unit: CatalogueUnit,
  commanderItem: ArmyListItem,
  retinueGroupId: string,
  force?: ForceFormat,
): ArmyListItem {
  return {
    ...makeListItem(unit, force),
    id: `${commanderItem.id}-retinue`,
    count: getRetinueCount(unit, force),
    retinueForItemId: commanderItem.id,
    retinueGroupId,
  }
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

  const maxSelections = getUnitSelectionLimit(unit, force)
  if (maxSelections !== undefined && getUnitSelectionCount(items, unit.id) >= maxSelections) {
    return `${unit.name} is limited to ${maxSelections}.`
  }

  const previewItem: ArmyListItem = {
    id: 'preview',
    unitId: unit.id,
    count: getDefaultCount(unit, force),
    selectedOptions: getDefaultSelectedOptions(unit),
  }
  const retinueGroup = getRetinueSelection(unit, previewItem)
  const retinueUnit = getSelectedRetinueUnit(faction, unit, previewItem)
  const retinueItem =
    retinueGroup && retinueUnit ? makeRetinueListItem(retinueUnit, previewItem, retinueGroup.id, force) : undefined
  const nextTotal =
    listTotal(faction, items) +
    getListItemCost(unit, previewItem) +
    (retinueUnit && retinueItem ? getListItemCost(retinueUnit, retinueItem) : 0)
  if (force.pointLimit !== undefined && nextTotal > force.pointLimit) {
    return `Adding this would exceed ${force.name}'s ${formatPoints(force.pointLimit)} cap.`
  }
  if (force.unitLimit !== undefined && getOverallUnitCount(items) + 1 > force.unitLimit) {
    return `${force.name} is limited to ${force.unitLimit} units.`
  }

  const categoryUsage = getCategoryUsage(faction, items, force)
  const addedUnits = [unit, ...(retinueUnit ? [retinueUnit] : [])]
  const blockedCategory = force.categoryLimits.find((limit) => {
    const addedCount = addedUnits.reduce((total, addedUnit) => {
      const matches = addedUnit.categoryIds.includes(limit.id) || addedUnit.categories.includes(limit.name)
      return total + (matches ? getCategoryLimitWeight(addedUnit, limit.name) : 0)
    }, 0)
    return limit.max !== undefined && addedCount > 0 && (categoryUsage.get(limit.id) ?? 0) + addedCount > limit.max
  })

  if (blockedCategory) {
    return `${blockedCategory.name} is limited to ${blockedCategory.max}.`
  }

  const retinueMaxSelections = retinueUnit ? getUnitSelectionLimit(retinueUnit, force) : undefined
  if (
    retinueUnit &&
    retinueMaxSelections !== undefined &&
    getUnitSelectionCount(items, retinueUnit.id) >= retinueMaxSelections
  ) {
    return `${retinueUnit.name} is limited to ${retinueMaxSelections}.`
  }

  return undefined
}
