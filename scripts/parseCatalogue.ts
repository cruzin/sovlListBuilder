import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  CatalogueFaction,
  CatalogueRule,
  CatalogueUnit,
  GeneratedCatalogue,
  RulesUnitAsset,
  UnitModel,
  UnitOptionGroup,
  UnitStats,
} from '../src/types/catalogue.ts'
import { unitAssetKey } from './text.ts'
import { childrenNamed, firstChild, parseXml, type XmlNode } from './xml.ts'

const POINTS_TYPE_ID = '268a-a403-0d9c-50ac'

type SharedIndex = Map<string, CatalogueRule>

const ARMY_SIZE_PRESETS = [
  { id: 'border-patrol', name: 'Border Patrol', pointLimit: 650 },
  { id: 'warband', name: 'Warband', pointLimit: 500 },
  { id: 'battalion', name: 'Battalion', pointLimit: 1000 },
  { id: 'legion', name: 'Legion', pointLimit: 1500 },
]

export async function parseCatalogueDirectory(
  catalogueDir: string,
  sourceRevision?: string,
  unitAssets?: Map<string, RulesUnitAsset>,
): Promise<GeneratedCatalogue> {
  const sharedRules = await parseSharedRules(path.join(catalogueDir, 'SOVL.gst'))
  const factionFiles = [
    'AbyssalDemons.cat',
    'AbyssalLegions.cat',
    'DarkbornElves.cat',
    'DeadNations.cat',
    'DeepwoodGuardians.cat',
    'DwarfHolds.cat',
    'ElvenConclaves.cat',
    'EmpiresOfMen.cat',
    'GoatmenRaiders.cat',
    'GreenskinTribes.cat',
    'KnightsOfAvalon.cat',
    'RatkinClans.cat',
    'ReptilianKingdoms.cat',
  ]
  const warnings: string[] = []
  const factions: CatalogueFaction[] = []

  for (const fileName of factionFiles) {
    try {
      factions.push(await parseFactionFile(path.join(catalogueDir, fileName), fileName, sharedRules, unitAssets))
    } catch (error) {
      warnings.push(`${fileName}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: {
      repository: 'https://github.com/Perwahl/SOVLDataCatalogue',
      revision: sourceRevision,
    },
    factions,
    warnings,
  }
}

async function parseSharedRules(filePath: string): Promise<SharedIndex> {
  const xml = parseXml(await readFile(filePath, 'utf8'))
  const sharedEntries = firstChild(xml, 'sharedSelectionEntries')
  const index: SharedIndex = new Map()

  for (const entry of childrenNamed(sharedEntries, 'selectionEntry')) {
    const id = entry.attributes.id
    const name = entry.attributes.name
    if (!id || !name) {
      continue
    }
    index.set(id, {
      id,
      name,
      text: extractRuleText(entry),
    })
  }

  return index
}

async function parseFactionFile(
  filePath: string,
  sourceFile: string,
  sharedRules: SharedIndex,
  unitAssets?: Map<string, RulesUnitAsset>,
): Promise<CatalogueFaction> {
  const xml = parseXml(await readFile(filePath, 'utf8'))
  const warnings: string[] = []
  const units: CatalogueUnit[] = []
  const selectionEntries = firstChild(xml, 'selectionEntries')
  const catalogueForces = parseForces(xml)

  for (const entry of childrenNamed(selectionEntries, 'selectionEntry')) {
    if (entry.attributes.type !== 'unit') {
      continue
    }
    units.push(
      parseUnit(
        entry,
        sharedRules,
        xml.attributes.id ?? sourceFile.replace(/\.cat$/i, ''),
        xml.attributes.name ?? sourceFile.replace(/\.cat$/i, ''),
        sourceFile,
        unitAssets,
      ),
    )
  }

  if (units.length === 0) {
    warnings.push('No top-level unit entries found')
  }

  return {
    id: xml.attributes.id ?? sourceFile.replace(/\.cat$/i, ''),
    name: xml.attributes.name ?? sourceFile.replace(/\.cat$/i, ''),
    sourceFile,
    forces: buildForceFormats(catalogueForces, xml.attributes.name ?? sourceFile.replace(/\.cat$/i, ''), units),
    units,
    warnings,
  }
}

function parseUnit(
  entry: XmlNode,
  sharedRules: SharedIndex,
  factionId: string,
  factionName: string,
  sourceFile: string,
  unitAssets?: Map<string, RulesUnitAsset>,
): CatalogueUnit {
  const warnings: string[] = []
  const modelEntry = childrenNamed(firstChild(entry, 'selectionEntries'), 'selectionEntry').find(
    (child) => child.attributes.type === 'model',
  )
  const stats = extractStats(entry)
  const model = modelEntry ? extractModel(modelEntry) : undefined
  const directRuleLinks = childrenNamed(firstChild(entry, 'entryLinks'), 'entryLink')
  const rules = directRuleLinks
    .map((link) => resolveRule(link, sharedRules))
    .filter((rule): rule is CatalogueRule => Boolean(rule))
  const optionGroups = childrenNamed(firstChild(entry, 'selectionEntryGroups'), 'selectionEntryGroup').map((group) =>
    parseOptionGroup(group, sharedRules),
  )
  const unitName = entry.attributes.name ?? entry.attributes.id ?? 'Unknown unit'
  const asset = unitAssets?.get(unitAssetKey(factionName, unitName))

  if (!entry.attributes.id) {
    warnings.push('Unit is missing id')
  }
  if (!entry.attributes.name) {
    warnings.push(`${entry.attributes.id ?? 'Unknown unit'} is missing name`)
  }
  if (!modelEntry) {
    warnings.push(`${unitName} has no nested model entry`)
  }
  if (modelEntry && model?.pointsPerModel === undefined) {
    warnings.push(`${unitName} has no model point cost`)
  }
  if (!stats.skill || !stats.power || !stats.defense) {
    warnings.push(`${unitName} has incomplete statline`)
  }
  if (!asset) {
    warnings.push(`${unitName} has no matching rules-site image`)
  }

  return {
    id: entry.attributes.id ?? entry.attributes.name ?? 'unknown-unit',
    factionId,
    name: unitName,
    categories: extractCategories(entry),
    categoryIds: extractCategoryIds(entry),
    maxSelections: extractTopLevelMaxSelections(entry) ?? asset?.maxCount,
    rulesUnitType: asset?.unitType,
    model,
    stats,
    rules: dedupeRules(rules),
    optionGroups,
    iconUrl: asset?.iconUrl,
    imageUrl: asset?.imageUrl,
    rawSource: {
      catalogueFile: sourceFile,
      catalogueId: entry.attributes.id,
      rulesPageUrl: asset?.rulesPageUrl,
      iconUrl: asset?.sourceIconUrl ?? asset?.iconUrl,
      imageUrl: asset?.sourceImageUrl ?? asset?.imageUrl,
    },
    warnings,
  }
}

function extractCategories(entry: XmlNode): string[] {
  return childrenNamed(firstChild(entry, 'categoryLinks'), 'categoryLink')
    .map((link) => link.attributes.name ?? link.attributes.targetId)
    .filter((category): category is string => Boolean(category))
}

function extractCategoryIds(entry: XmlNode): string[] {
  return childrenNamed(firstChild(entry, 'categoryLinks'), 'categoryLink')
    .map((link) => link.attributes.targetId ?? link.attributes.name)
    .filter((category): category is string => Boolean(category))
}

function extractTopLevelMaxSelections(entry: XmlNode): number | undefined {
  return childrenNamed(firstChild(entry, 'constraints'), 'constraint')
    .filter((constraint) => constraint.attributes.type === 'max')
    .map((constraint) => parseNumber(constraint.attributes.value))
    .find((value): value is number => value !== undefined)
}

function extractModel(modelEntry: XmlNode): UnitModel {
  const constraints = childrenNamed(firstChild(modelEntry, 'constraints'), 'constraint')
  const minConstraint = constraints.find((constraint) => constraint.attributes.type === 'min')
  const maxConstraint = constraints.find((constraint) => constraint.attributes.type === 'max')

  return {
    id: modelEntry.attributes.id ?? modelEntry.attributes.name ?? 'unknown-model',
    name: modelEntry.attributes.name ?? 'Unknown model',
    defaultCount: parseNumber(modelEntry.attributes.defaultAmount),
    minCount: parseNumber(minConstraint?.attributes.value),
    maxCount: parseNumber(maxConstraint?.attributes.value),
    pointsPerModel: extractPoints(modelEntry),
  }
}

function parseForces(xml: XmlNode): CatalogueFaction['forces'] {
  return childrenNamed(firstChild(xml, 'forceEntries'), 'forceEntry').map((force) => {
    const categoryLimits = childrenNamed(firstChild(force, 'categoryLinks'), 'categoryLink').map((categoryLink) => {
      const constraints = childrenNamed(firstChild(categoryLink, 'constraints'), 'constraint')
      return {
        id: categoryLink.attributes.targetId ?? categoryLink.attributes.name ?? categoryLink.attributes.id ?? 'unknown',
        name: categoryLink.attributes.name ?? categoryLink.attributes.targetId ?? 'Unknown section',
        min: constraints
          .filter((constraint) => constraint.attributes.type === 'min')
          .map((constraint) => parseNumber(constraint.attributes.value))
          .find((value): value is number => value !== undefined),
        max: constraints
          .filter((constraint) => constraint.attributes.type === 'max')
          .map((constraint) => parseNumber(constraint.attributes.value))
          .find((value): value is number => value !== undefined),
      }
    })

    const pointLimit = childrenNamed(firstChild(force, 'constraints'), 'constraint')
      .filter((constraint) => constraint.attributes.type === 'max')
      .filter((constraint) => constraint.attributes.field === `limit::${POINTS_TYPE_ID}`)
      .map((constraint) => parseNumber(constraint.attributes.value))
      .find((value): value is number => value !== undefined)

    return {
      id: force.attributes.id ?? force.attributes.name ?? 'unknown-force',
      name: force.attributes.name ?? 'Army Size',
      pointLimit,
      categoryLimits,
      source: 'catalogue',
    }
  })
}

function buildForceFormats(
  catalogueForces: CatalogueFaction['forces'],
  factionName: string,
  units: CatalogueUnit[],
): CatalogueFaction['forces'] {
  const fallbackLimits = catalogueForces[0]?.categoryLimits ?? []
  const byName = new Map(catalogueForces.map((force) => [force.name.toLowerCase(), force]))

  return ARMY_SIZE_PRESETS.map((preset) => {
    const catalogueForce = byName.get(preset.name.toLowerCase())
    const borderPatrolOverrides =
      preset.id === 'border-patrol' ? getBorderPatrolModelOverrides(factionName, units) : undefined
    return {
      id: preset.id,
      name: preset.name,
      pointLimit: preset.pointLimit,
      categoryLimits: applyForceCategoryOverrides(preset.id, catalogueForce?.categoryLimits ?? fallbackLimits),
      modelOverrides: borderPatrolOverrides && borderPatrolOverrides.length > 0 ? borderPatrolOverrides : undefined,
      source: catalogueForce ? 'catalogue' : 'derived',
      derivedFrom: catalogueForce ? undefined : catalogueForces[0]?.name,
    }
  })
}

function applyForceCategoryOverrides(
  forceId: string,
  categoryLimits: CatalogueFaction['forces'][number]['categoryLimits'],
): CatalogueFaction['forces'][number]['categoryLimits'] {
  if (forceId !== 'border-patrol') {
    return categoryLimits
  }

  return categoryLimits.map((limit) =>
    limit.id === 'Battle Line' || limit.name === 'Battle Line' ? { ...limit, min: 2 } : limit,
  )
}

function getBorderPatrolModelOverrides(
  factionName: string,
  units: CatalogueUnit[],
): NonNullable<CatalogueFaction['forces'][number]['modelOverrides']> {
  const overridesByFaction: Record<string, Record<string, number>> = {
    'Abyssal Demons': {
      'Demonic Hounds': 8,
    },
    'Abyssal Legions': {
      'Northmen Axe': 15,
      'Abyssal Hounds': 8,
    },
    'Darkborn Elves': {
      'Darkborn Spears': 12,
    },
    'Dwarf Holds': {
      'Dwarf Warriors': 15,
      'Dwarf Miners': 12,
    },
    'Elven Conclaves': {
      'Elf Spears': 12,
    },
    'Dead Nations': {
      'Dire Wolves': 8,
    },
    'Empires of Men': {
      'Imperial Sword': 15,
      'Imperial Spear': 15,
      'Imperial Halberd': 15,
    },
    'Goatmen Raiders': {
      'Goatmen Warriors': 12,
      'Mongrel Pack': 15,
      'Mongrel Spear': 15,
      'Feral Hounds': 8,
    },
    'Greenskin Tribes': {
      'Goblin Mob': 18,
      'Goblin Spear Mob': 18,
      'Goblin Wolf Riders': 8,
    },
    'Knights of Avalon': {
      'Sword Militia': 15,
      'Spear Militia': 15,
      'Halberd Militia': 15,
      'Peasant Mob': 18,
      'Hunting Dogs': 8,
    },
    'Ratkin Clans': {
      'Ratkin Conscripts': 15,
    },
  }
  const overrides = overridesByFaction[factionName] ?? {}

  return units
    .map((unit) => {
      const count = overrides[unit.name]
      return count ? { unitId: unit.id, minCount: count, defaultCount: count } : undefined
    })
    .filter((override): override is NonNullable<typeof override> => Boolean(override))
}

function extractStats(modelEntry: XmlNode): UnitStats {
  const stats: UnitStats = {}

  for (const profile of childrenNamed(firstChild(modelEntry, 'profiles'), 'profile')) {
    const profileType = profile.attributes.typeName
    const characteristics = Object.fromEntries(
      childrenNamed(firstChild(profile, 'characteristics'), 'characteristic').map((characteristic) => [
        characteristic.attributes.name,
        characteristic.text,
      ]),
    )

    if (profileType === 'Statline') {
      stats.skill = characteristics.Skill
      stats.power = characteristics.Power
      stats.defense = characteristics.Defense
      stats.attacks = characteristics.Attacks
      stats.wounds = characteristics.Wounds
      stats.discipline = characteristics.Discipline
    }

    if (profileType === 'Model Type') {
      stats.movement = characteristics.Movement
      stats.baseSize = characteristics['Base Size']
      stats.modelType = characteristics.Type
    }
  }

  return stats
}

function parseOptionGroup(group: XmlNode, sharedRules: SharedIndex): UnitOptionGroup {
  const constraints = childrenNamed(firstChild(group, 'constraints'), 'constraint')
  const minConstraint = constraints.find((constraint) => constraint.attributes.type === 'min')
  const maxConstraint = constraints.find((constraint) => constraint.attributes.type === 'max')

  return {
    id: group.attributes.id ?? group.attributes.name ?? 'unknown-option-group',
    name: group.attributes.name ?? 'Options',
    min: parseNumber(minConstraint?.attributes.value),
    max: parseNumber(maxConstraint?.attributes.value),
    defaultOptionId: group.attributes.defaultSelectionEntryId || undefined,
    options: childrenNamed(firstChild(group, 'entryLinks'), 'entryLink').map((link) => {
      const rule = resolveRule(link, sharedRules)
      return {
        id: link.attributes.id ?? link.attributes.targetId ?? link.attributes.name ?? 'unknown-option',
        name: link.attributes.name ?? rule?.name ?? 'Unknown option',
        targetId: link.attributes.targetId,
        points: extractModifierPoints(link),
        rule,
      }
    }),
  }
}

function resolveRule(link: XmlNode, sharedRules: SharedIndex): CatalogueRule | undefined {
  const targetId = link.attributes.targetId
  if (!targetId) {
    return undefined
  }
  return sharedRules.get(targetId) ?? { id: targetId, name: link.attributes.name ?? targetId }
}

function extractRuleText(entry: XmlNode): string | undefined {
  for (const profile of childrenNamed(firstChild(entry, 'profiles'), 'profile')) {
    const text = childrenNamed(firstChild(profile, 'characteristics'), 'characteristic').find(
      (characteristic) => characteristic.attributes.name === 'Text',
    )?.text
    if (text) {
      return text
    }
  }
  return undefined
}

function extractPoints(entry: XmlNode): number | undefined {
  const pointCost = childrenNamed(firstChild(entry, 'costs'), 'cost').find(
    (cost) => cost.attributes.name === 'Points' || cost.attributes.typeId === POINTS_TYPE_ID,
  )
  return parseNumber(pointCost?.attributes.value)
}

function extractModifierPoints(entry: XmlNode): number | undefined {
  const modifier = childrenNamed(firstChild(entry, 'modifiers'), 'modifier').find(
    (item) => item.attributes.field === POINTS_TYPE_ID,
  )
  return parseNumber(modifier?.attributes.value)
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === '') {
    return undefined
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function dedupeRules(rules: CatalogueRule[]): CatalogueRule[] {
  return Array.from(new Map(rules.map((rule) => [rule.id, rule])).values())
}
