import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const REPOSITORY_URL = 'https://github.com/Perwahl/SOVLDataCatalogue.git'

export async function ensureDataCatalogue(cacheDir = path.join('.cache', 'SOVLDataCatalogue')): Promise<string> {
  if (existsSync(path.join(cacheDir, '.git'))) {
    await execFileAsync('git', ['-C', cacheDir, 'pull', '--ff-only'])
    return cacheDir
  }

  await mkdir(path.dirname(cacheDir), { recursive: true })
  await execFileAsync('git', ['clone', '--depth', '1', REPOSITORY_URL, cacheDir])
  return cacheDir
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = await ensureDataCatalogue()
  console.log(`SOVL data catalogue available at ${dir}`)
}
