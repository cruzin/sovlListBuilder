import type { CatalogueFaction, CatalogueUnit, GeneratedCatalogue } from '../src/types/catalogue.ts'

export const TEMP_BALANCE_HOTFIX_SOURCE_REVISION = '3ebcc16f28c37150a631fddda797c3779b5a925f'

export function applyTemporaryBalanceHotfixes(catalogue: GeneratedCatalogue): boolean {
  if (catalogue.source.revision !== TEMP_BALANCE_HOTFIX_SOURCE_REVISION) {
    return false
  }

  const factions = new Map(catalogue.factions.map((faction) => [faction.id, faction]))

  setPoints(factions, 'DarkbornElves', 'darkbornHarpies', 12)
  setPoints(factions, 'GoatmenRaiders', 'harpies', 12)
  setPoints(factions, 'GreenskinTribes', 'orcWarriors', 6)
  setPoints(factions, 'GoatmenRaiders', 'goatmenWarriors', 6)
  setPoints(factions, 'DwarfHolds', 'dwarfWarriors', 6)
  setPoints(factions, 'ElvenConclaves', 'elfSpears', 7)
  setPoints(factions, 'DarkbornElves', 'darkbornSpears', 7)
  setPoints(factions, 'DeepwoodGuardians', 'deepwoodGuard', 7)
  setPoints(factions, 'ElvenConclaves', 'elfReavers', 16)
  setPoints(factions, 'DarkbornElves', 'darkbornRiders', 17)
  setPoints(factions, 'DeepwoodGuardians', 'deepwoodRiders', 17)
  setPoints(factions, 'ElvenConclaves', 'elfBoltThrower', 50)
  setPoints(factions, 'DarkbornElves', 'darkbornBoltthrower', 50)
  setPoints(factions, 'ElvenConclaves', 'weaponMasters', 10)
  setPoints(factions, 'EmpiresOfMen', 'imperialCannon', 55)
  setPoints(factions, 'EmpiresOfMen', 'imperialMortar', 50)
  setPoints(factions, 'EmpiresOfMen', 'imperialLightCavalry', 18)
  setPoints(factions, 'KnightsOfAvalon', 'unicorn', 45)
  setPoints(factions, 'KnightsOfAvalon', 'kingsGuard', 28)

  for (const [factionId, unitId] of [
    ['AbyssalLegions', 'abyssalDragon'],
    ['DarkbornElves', 'blackDragon'],
    ['DeadNations', 'boneDragon'],
    ['DeepwoodGuardians', 'forestDragon'],
    ['ElvenConclaves', 'ancientDragon'],
    ['EmpiresOfMen', 'imperialDragon'],
  ] as const) {
    setPoints(factions, factionId, unitId, 125)
  }

  setAttacks(factions, 'ReptilianKingdoms', 'firelizard', '3')
  setModelMinimum(factions, 'ReptilianKingdoms', 'newtBraves', 18)

  setOptionPoints(factions, 'EmpiresOfMen', 'footKnights', 'greatweapon', 0)
  setOptionPoints(factions, 'EmpiresOfMen', 'imperialKnights', 'greatweapon', 0)
  setOptionPoints(factions, 'EmpiresOfMen', 'imperialKnights', 'lanceShield', 1)
  setOptionPoints(factions, 'GoatmenRaiders', 'minotaurLord', '2CCW', 0)
  setOptionPoints(factions, 'GoatmenRaiders', 'minotaurLord', 'greatweapon', 0)
  removeOptionsByTarget(factions, 'KnightsOfAvalon', 'paladin', 'divineFavour')

  addCategory(factions, 'EmpiresOfMen', 'imperialCannon', 'Imperial Armory')
  addCategory(factions, 'EmpiresOfMen', 'imperialMortar', 'Imperial Armory')
  addCategory(factions, 'DwarfHolds', 'dwarfCannon', 'Machines of War')
  addCategory(factions, 'DwarfHolds', 'dwarfStonethrower', 'Machines of War')
  addCategory(factions, 'DwarfHolds', 'dwarfBoltThrower', 'Machines of War')

  setCategoryLimit(factions, 'EmpiresOfMen', 'border-patrol', 'Fast Attack', { max: 2 })
  setCategoryLimit(factions, 'GreenskinTribes', 'border-patrol', 'Raiders', { max: 2 })
  setForceUnitLimit(factions, 'KnightsOfAvalon', 'border-patrol', 'huntingDogs', 1)
  setForceUnitLimit(factions, 'KnightsOfAvalon', 'border-patrol', 'peasants', 1)
  setForceUnitLimit(factions, 'KnightsOfAvalon', 'warband', 'huntingDogs', 1)
  setForceUnitLimit(factions, 'KnightsOfAvalon', 'warband', 'peasants', 1)

  addOrUpdateRule(
    factions,
    'DwarfHolds',
    'rangerCaptain',
    'temporary-ranger-captain-marksman-rifle',
    'Marksman Rifle',
    '1x shots. Re-rolls missed ranged Attack rolls.',
  )
  updateRulesById(
    catalogue,
    'giftOfTrickery',
    'Favoured by Trickery. Unit has Ambush Deployment, +1 Move Speed, and may flee from charges even if Fearless.',
  )

  catalogue.warnings.push(
    `Temporary balance hotfixes applied for SOVLDataCatalogue revision ${TEMP_BALANCE_HOTFIX_SOURCE_REVISION}`,
  )
  return true
}

function getUnit(
  factions: Map<string, CatalogueFaction>,
  factionId: string,
  unitId: string,
): CatalogueUnit | undefined {
  return factions.get(factionId)?.units.find((unit) => unit.id === unitId)
}

function setPoints(factions: Map<string, CatalogueFaction>, factionId: string, unitId: string, points: number) {
  const unit = getUnit(factions, factionId, unitId)
  if (unit?.model) {
    unit.model.pointsPerModel = points
  }
}

function setAttacks(factions: Map<string, CatalogueFaction>, factionId: string, unitId: string, attacks: string) {
  const unit = getUnit(factions, factionId, unitId)
  if (unit) {
    unit.stats.attacks = attacks
  }
}

function setModelMinimum(factions: Map<string, CatalogueFaction>, factionId: string, unitId: string, minCount: number) {
  const unit = getUnit(factions, factionId, unitId)
  if (unit?.model) {
    unit.model.minCount = minCount
    unit.model.defaultCount = Math.max(unit.model.defaultCount ?? minCount, minCount)
  }
}

function setOptionPoints(
  factions: Map<string, CatalogueFaction>,
  factionId: string,
  unitId: string,
  targetId: string,
  points: number,
) {
  const unit = getUnit(factions, factionId, unitId)
  for (const group of unit?.optionGroups ?? []) {
    for (const option of group.options) {
      if (option.targetId === targetId) {
        option.points = points
      }
    }
  }
}

function removeOptionsByTarget(
  factions: Map<string, CatalogueFaction>,
  factionId: string,
  unitId: string,
  targetId: string,
) {
  const unit = getUnit(factions, factionId, unitId)
  if (!unit) {
    return
  }

  unit.optionGroups = unit.optionGroups
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => option.targetId !== targetId),
    }))
    .filter((group) => group.options.length > 0)
}

function addCategory(factions: Map<string, CatalogueFaction>, factionId: string, unitId: string, category: string) {
  const unit = getUnit(factions, factionId, unitId)
  if (!unit) {
    return
  }
  if (!unit.categories.includes(category)) {
    unit.categories.push(category)
  }
  if (!unit.categoryIds.includes(category)) {
    unit.categoryIds.push(category)
  }
}

function setCategoryLimit(
  factions: Map<string, CatalogueFaction>,
  factionId: string,
  forceId: string,
  categoryId: string,
  values: { min?: number; max?: number },
) {
  const force = factions.get(factionId)?.forces.find((item) => item.id === forceId)
  if (!force) {
    return
  }
  force.categoryLimits = force.categoryLimits.map((limit) => {
    if (limit.id !== categoryId && limit.name !== categoryId) {
      return limit
    }
    return { ...limit, ...values }
  })
}

function setForceUnitLimit(
  factions: Map<string, CatalogueFaction>,
  factionId: string,
  forceId: string,
  unitId: string,
  max: number,
) {
  const force = factions.get(factionId)?.forces.find((item) => item.id === forceId)
  if (!force) {
    return
  }
  force.unitLimits = [...(force.unitLimits?.filter((limit) => limit.unitId !== unitId) ?? []), { unitId, max }]
}

function addOrUpdateRule(
  factions: Map<string, CatalogueFaction>,
  factionId: string,
  unitId: string,
  ruleId: string,
  name: string,
  text: string,
) {
  const unit = getUnit(factions, factionId, unitId)
  if (!unit) {
    return
  }
  const existing = unit.rules.find((rule) => rule.id === ruleId || rule.name === name)
  if (existing) {
    existing.text = text
    return
  }
  unit.rules.push({ id: ruleId, name, text })
}

function updateRulesById(catalogue: GeneratedCatalogue, ruleId: string, text: string) {
  for (const faction of catalogue.factions) {
    for (const unit of faction.units) {
      for (const rule of unit.rules) {
        if (rule.id === ruleId) {
          rule.text = text
        }
      }
    }
  }
}
