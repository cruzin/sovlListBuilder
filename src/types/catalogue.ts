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
  name: string
  categories: string[]
  model?: UnitModel
  stats: UnitStats
  rules: CatalogueRule[]
  optionGroups: UnitOptionGroup[]
  warnings: string[]
}

export type CatalogueFaction = {
  id: string
  name: string
  sourceFile: string
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
