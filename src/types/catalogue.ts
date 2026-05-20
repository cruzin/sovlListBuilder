export type UnitStats = {
  skill?: string
  power?: string
  defense?: string
  attacks?: string
  wounds?: string
  discipline?: string
  movement?: string
  baseSize?: string
  modelType?: string
}

export type CatalogueRule = {
  id: string
  name: string
  text?: string
}

export type UnitOption = {
  id: string
  name: string
  targetId?: string
  points?: number
  rule?: CatalogueRule
}

export type UnitOptionGroup = {
  id: string
  name: string
  min?: number
  max?: number
  defaultOptionId?: string
  options: UnitOption[]
}

export type UnitModel = {
  id: string
  name: string
  defaultCount?: number
  minCount?: number
  maxCount?: number
  pointsPerModel?: number
}

export type CatalogueUnit = {
  id: string
  factionId: string
  name: string
  categories: string[]
  categoryIds: string[]
  maxSelections?: number
  rulesUnitType?: string
  model?: UnitModel
  stats: UnitStats
  rules: CatalogueRule[]
  optionGroups: UnitOptionGroup[]
  iconUrl?: string
  imageUrl?: string
  rawSource?: {
    catalogueFile?: string
    catalogueId?: string
    rulesPageUrl?: string
    iconUrl?: string
    imageUrl?: string
  }
  warnings: string[]
}

export type ForceCategoryLimit = {
  id: string
  name: string
  min?: number
  max?: number
}

export type ForceFormat = {
  id: string
  name: string
  pointLimit?: number
  categoryLimits: ForceCategoryLimit[]
  source?: 'catalogue' | 'derived'
  derivedFrom?: string
}

export type CatalogueFaction = {
  id: string
  name: string
  sourceFile: string
  forces: ForceFormat[]
  units: CatalogueUnit[]
  warnings: string[]
}

export type GeneratedCatalogue = {
  generatedAt: string
  source: {
    repository: string
    revision?: string
  }
  factions: CatalogueFaction[]
  warnings: string[]
}

export type RulesUnitAsset = {
  factionName: string
  factionSlug: string
  unitName: string
  unitType?: string
  rulesPageUrl: string
  iconUrl?: string
  imageUrl?: string
  sourceIconUrl?: string
  sourceImageUrl?: string
  maxCount?: number
}
