import type { RulesUnitAsset } from '../src/types/catalogue.ts'
import { stripTags, unitAssetKey } from './text.ts'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const RULES_BASE_URL = 'https://perwahl.github.io/SOVLRules/docs/FactionSource/'
export const RULES_INDEX_URL = new URL('FactionSource.html', RULES_BASE_URL).href

type FactionPageLink = {
  name: string
  slug: string
  url: string
}

export type RulesAssetIndex = {
  byFactionAndUnit: Map<string, RulesUnitAsset>
  units: RulesUnitAsset[]
  warnings: string[]
}

export async function scrapeRulesSite(): Promise<RulesAssetIndex> {
  const warnings: string[] = []
  const indexHtml = await fetchText(RULES_INDEX_URL)
  const factionLinks = extractFactionLinks(indexHtml)
  const units: RulesUnitAsset[] = []

  for (const faction of factionLinks) {
    try {
      const html = await fetchText(faction.url)
      units.push(...extractUnitsFromFactionPage(html, faction))
    } catch (error) {
      warnings.push(`${faction.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const byFactionAndUnit = new Map<string, RulesUnitAsset>()
  for (const unit of units) {
    byFactionAndUnit.set(assetKey(unit.factionName, unit.unitName), unit)
  }

  return { byFactionAndUnit, units, warnings }
}

export function assetKey(factionName: string, unitName: string): string {
  return unitAssetKey(factionName, unitName)
}

function extractFactionLinks(html: string): FactionPageLink[] {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      href: match[1],
      label: stripTags(match[2]),
    }))
    .filter((link) => /\/FactionSource\/[^/]+\.html$/i.test(link.href))
    .filter((link) => !/FactionSource\.html$/i.test(link.href))

  const unique = new Map<string, FactionPageLink>()
  for (const link of links) {
    const url = new URL(link.href, RULES_INDEX_URL).href
    const slug = url.match(/\/([^/]+)\.html$/i)?.[1]
    if (!slug || unique.has(slug)) {
      continue
    }
    unique.set(slug, {
      name: link.label,
      slug,
      url,
    })
  }

  return [...unique.values()]
}

function extractUnitsFromFactionPage(html: string, faction: FactionPageLink): RulesUnitAsset[] {
  const iconPattern = /<img\b[^>]*src=["']([^"']*icons\/([^/"']+)\/([^/"']+)\.png)["'][^>]*>/gi
  const units: RulesUnitAsset[] = []
  let match: RegExpExecArray | null

  while ((match = iconPattern.exec(html)) !== null) {
    const iconSrc = match[1]
    const factionSlug = match[2]
    const fileStem = match[3]
    const start = match.index
    const nextIcon = html.slice(iconPattern.lastIndex).search(/<img\b[^>]*src=["'][^"']*icons\//i)
    const end = nextIcon === -1 ? html.length : iconPattern.lastIndex + nextIcon
    const cardHtml = html.slice(start, end)
    const unitName = stripTags(cardHtml.match(/<div\s+class=["']unit-name["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? fileStem)
    const unitType = stripTags(cardHtml.match(/<span\s+class=["']tooltiptext["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '')
    const imageSrc = cardHtml.match(/<img\b[^>]*src=["']([^"']*images\/[^"']+\.png)["'][^>]*>/i)?.[1]
    const maxCount = parseNumber(stripTags(cardHtml).match(/Max Count:\s*:?\s*(\d+)/i)?.[1])

    units.push({
      factionName: faction.name,
      factionSlug,
      unitName,
      unitType: unitType || undefined,
      rulesPageUrl: faction.url,
      iconUrl: new URL(iconSrc, faction.url).href,
      imageUrl: imageSrc ? new URL(imageSrc, faction.url).href : fallbackImageUrl(faction.url, factionSlug, fileStem),
      maxCount,
    })
  }

  return units
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function fallbackImageUrl(pageUrl: string, factionSlug: string, unitFileStem: string): string {
  return new URL(`images/${factionSlug}/${unitFileStem}.png`, pageUrl).href
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status} ${response.statusText}`)
  }
  return response.text()
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const index = await scrapeRulesSite()
  console.log(`Scraped ${index.units.length} unit image records`)
  if (index.warnings.length > 0) {
    console.warn(index.warnings.join('\n'))
  }
}
