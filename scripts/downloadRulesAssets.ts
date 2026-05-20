import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { RulesUnitAsset } from '../src/types/catalogue.ts'

const PUBLIC_ASSET_ROOT = path.join('public', 'generated', 'unit-assets')
const PUBLIC_URL_ROOT = 'generated/unit-assets'

export async function downloadRulesAssets(units: RulesUnitAsset[]): Promise<RulesUnitAsset[]> {
  const output: RulesUnitAsset[] = []

  for (const unit of units) {
    const icon = unit.iconUrl ? await downloadAsset(unit.iconUrl, 'icons', unit.factionSlug) : undefined
    const image = unit.imageUrl ? await downloadAsset(unit.imageUrl, 'images', unit.factionSlug) : undefined

    output.push({
      ...unit,
      iconUrl: icon?.publicUrl ?? unit.iconUrl,
      imageUrl: image?.publicUrl ?? unit.imageUrl,
      sourceIconUrl: unit.iconUrl,
      sourceImageUrl: unit.imageUrl,
    })
  }

  return output
}

async function downloadAsset(
  sourceUrl: string,
  assetType: 'icons' | 'images',
  factionSlug: string,
): Promise<{ publicUrl: string }> {
  const url = new URL(sourceUrl)
  const fileName = path.basename(url.pathname)
  const outputDir = path.join(PUBLIC_ASSET_ROOT, assetType, factionSlug)
  const outputPath = path.join(outputDir, fileName)
  const publicUrl = `${PUBLIC_URL_ROOT}/${assetType}/${factionSlug}/${fileName}`

  const response = await fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`Failed to download ${sourceUrl}: ${response.status} ${response.statusText}`)
  }

  await mkdir(outputDir, { recursive: true })
  await writeFile(outputPath, new Uint8Array(await response.arrayBuffer()))

  return { publicUrl }
}
