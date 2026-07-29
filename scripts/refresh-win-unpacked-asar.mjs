import { createRequire } from 'node:module'
import { promises as fs } from 'node:fs'
import fsSync from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const stageRoot = path.join(process.env.TEMP || 'C:/tmp', 'wuwa-afyg-client-asar-stage')
const resourcesDir = path.join(root, 'release', 'win-unpacked', 'resources')
const oldAsar = path.join(resourcesDir, 'app.asar')
const newAsar = path.join(resourcesDir, 'app.asar.new')

function findAsarPackage() {
    try {
        return require('@electron/asar')
    } catch {
        const pnpmDir = path.join(root, 'node_modules', '.pnpm')
        const candidates = fsSync
            .readdirSync(pnpmDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && entry.name.startsWith('@electron+asar@'))
            .map((entry) => path.join(pnpmDir, entry.name, 'node_modules', '@electron', 'asar'))
        for (const candidate of candidates) {
            try {
                return require(candidate)
            } catch {
                // try next candidate
            }
        }
        throw new Error('未找到 @electron/asar，无法刷新 app.asar。')
    }
}

async function removeStage() {
    const resolved = path.resolve(stageRoot)
    const tempRoot = path.resolve(process.env.TEMP || 'C:/tmp')
    if (!resolved.startsWith(tempRoot)) throw new Error(`拒绝删除临时目录之外的路径：${resolved}`)
    await fs.rm(resolved, { recursive: true, force: true })
}

async function copyFromProject(rel) {
    await fs.rm(path.join(stageRoot, rel), { recursive: true, force: true })
    await fs.cp(path.join(root, rel), path.join(stageRoot, rel), { recursive: true })
}

async function main() {
    const asar = findAsarPackage()
    await removeStage()
    await fs.mkdir(stageRoot, { recursive: true })
    asar.extractAll(oldAsar, stageRoot)
    await copyFromProject('build')
    await copyFromProject('electron')
    await fs.copyFile(path.join(root, 'package.json'), path.join(stageRoot, 'package.json'))
    await fs.rm(newAsar, { force: true })
    await asar.createPackageWithOptions(stageRoot, newAsar, {
        unpack: 'node_modules/better-sqlite3/**/*'
    })
    const backupAsar = path.join(resourcesDir, `app.asar.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`)
    await fs.copyFile(oldAsar, backupAsar)
    await fs.copyFile(newAsar, oldAsar)
    await fs.rm(newAsar, { force: true })

    const backups = (await fs.readdir(resourcesDir))
        .filter((name) => name.startsWith('app.asar.backup-'))
        .sort()
        .reverse()
    await Promise.all(backups.slice(2).map((name) => fs.rm(path.join(resourcesDir, name), { force: true })))
    console.log('已刷新 release/win-unpacked/resources/app.asar')
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
})
