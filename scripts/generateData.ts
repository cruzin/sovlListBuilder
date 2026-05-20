import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ensureDataCatalogue } from './fetchDataCatalogue.ts'
import { parseCatalogueDirectory } from './parseCatalogue.ts'
import { scrapeRulesSite } from './scrapeRulesSite.ts'

const execFileAsync = promisify(execFile)

const catalogueDir = process.env.SOVL_CATALOGUE_DIR ?? (await ensureDataCatalogue())
const revision = await readRevision(catalogueDir)
const rulesAssets = await scrapeRulesSite()
const catalogue = await parseCatalogueDirectory(catalogueDir, revision, rulesAssets.byFactionAndUnit)
const outputDir = path.join('src', 'data', 'generated')

await mkdir(outputDir, { recursive: true })
await writeFile(path.join(outputDir, 'catalogue.json'), `${JSON.stringify(catalogue, null, 2)}\n`)

for (const faction of catalogue.factions) {
  await writeFile(
    path.join(outputDir, `${faction.id}.json`),
    `${JSON.stringify(faction, null, 2)}\n`,
  )
}

const unitCount = catalogue.factions.reduce((total, faction) => total + faction.units.length, 0)
const factionWarnings = catalogue.factions.flatMap((faction) =>
  faction.warnings.concat(faction.units.flatMap((unit) => unit.warnings.map((warning) => `${faction.name}: ${warning}`))),
)
const warnings = catalogue.warnings.concat(rulesAssets.warnings, factionWarnings)

console.log(
  `Generated ${catalogue.factions.length} factions, ${unitCount} units, and ${rulesAssets.units.length} rules-site image records into ${outputDir}`,
)
if (warnings.length > 0) {
  console.warn(`Generated with ${warnings.length} warnings`)
  for (const warning of warnings.slice(0, 25)) {
    console.warn(`- ${warning}`)
  }
  if (warnings.length > 25) {
    console.warn(`- ...and ${warnings.length - 25} more`)
  }
}

async function readRevision(catalogueDir: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', catalogueDir, 'rev-parse', 'HEAD'])
    return stdout.trim()
  } catch {
    return undefined
  }
}
