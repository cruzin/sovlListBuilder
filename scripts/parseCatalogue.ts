import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  CatalogueFaction,
  CatalogueRule,
  CatalogueUnit,
  GeneratedCatalogue,
  UnitModel,
  UnitOptionGroup,
  UnitStats,
} from '../src/types/catalogue.ts'
import { childrenNamed, firstChild, parseXml, type XmlNode } from './xml.ts'

const POINTS_TYPE_ID = '268a-a403-0d9c-50ac'

type SharedIndex = Map<string, CatalogueRule>

export async function parseCatalogueDirectory(
  catalogueDir: string,
  sourceRevision?: string,
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
      factions.push(await parseFactionFile(path.join(catalogueDir, fileName), fileName, sharedRules))
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
): Promise<CatalogueFaction> {
  const xml = parseXml(await readFile(filePath, 'utf8'))
  const warnings: string[] = []
  const units: CatalogueUnit[] = []
  const selectionEntries = firstChild(xml, 'selectionEntries')

  for (const entry of childrenNamed(selectionEntries, 'selectionEntry')) {
    if (entry.attributes.type !== 'unit') {
      continue
    }
    units.push(parseUnit(entry, sharedRules))
  }

  if (units.length === 0) {
    warnings.push('No top-level unit entries found')
  }

  return {
    id: xml.attributes.id ?? sourceFile.replace(/\.cat$/i, ''),
    name: xml.attributes.name ?? sourceFile.replace(/\.cat$/i, ''),
    sourceFile,
    units,
    warnings,
  }
}

function parseUnit(entry: XmlNode, sharedRules: SharedIndex): CatalogueUnit {
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

  if (!entry.attributes.id) {
    warnings.push('Unit is missing id')
  }
  if (!entry.attributes.name) {
    warnings.push(`${entry.attributes.id ?? 'Unknown unit'} is missing name`)
  }
  if (!modelEntry) {
    warnings.push(`${entry.attributes.name ?? entry.attributes.id} has no nested model entry`)
  }
  if (modelEntry && model?.pointsPerModel === undefined) {
    warnings.push(`${entry.attributes.name ?? entry.attributes.id} has no model point cost`)
  }
  if (!stats.skill || !stats.power || !stats.defense) {
    warnings.push(`${entry.attributes.name ?? entry.attributes.id} has incomplete statline`)
  }

  return {
    id: entry.attributes.id ?? entry.attributes.name ?? 'unknown-unit',
    name: entry.attributes.name ?? entry.attributes.id ?? 'Unknown unit',
    categories: extractCategories(entry),
    model,
    stats,
    rules: dedupeRules(rules),
    optionGroups,
    warnings,
  }
}

function extractCategories(entry: XmlNode): string[] {
  return childrenNamed(firstChild(entry, 'categoryLinks'), 'categoryLink')
    .map((link) => link.attributes.name ?? link.attributes.targetId)
    .filter((category): category is string => Boolean(category))
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
