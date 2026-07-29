import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const REPO_URL = 'https://github.com/d4rkOfficial/wuwa-afyg-tool.git'
const KEEP_BACKUPS = 5

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const PROTECTED = new Set([
    '.gitignore',
    'electron',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'svelte.config.js',
    'scripts/dev-launcher.ps1',
    'scripts/kernel-update.mjs',
    'scripts/run-pnpm.mjs',
    'scripts/desktop-dev.mjs',
    '一键打包用户端.bat',
    'scripts/refresh-win-unpacked-asar.mjs',
    'scripts/package-client.ps1',
    '启动开发版.bat',
    'src/hooks.server.ts',
    'src/lib/api/fetch.ts',
    'src/lib/data/api.ts',
    'src/lib/desktop-extension',
    'src/lib/server/local-data.ts',
    'src/routes/+page.svelte',
    'src/routes/api/v1/cache/refresh/+server.ts',
    'src/routes/api/v1/icons/[entity]/+server.ts',
    'src/routes/api/v1/kernel',
    'src/lib/components/page/home/timeline/timeline.consts.ts',
    'src/lib/components/page/home/timeline/timeline.store.svelte.ts',
    'src/lib/components/page/home/timeline/timeline.svelte'
])

const GENERATED = new Set(['node_modules', '.svelte-kit', 'build', 'release', '.kernel', '.desktop-data'])

function rel(p) {
    return p.replace(/\\/g, '/')
}

function isProtected(relativePath) {
    const r = rel(relativePath)
    return [...PROTECTED].some((p) => r === p || r.startsWith(p + '/'))
}

async function exists(p) {
    try {
        await fs.access(p)
        return true
    } catch {
        return false
    }
}

async function runGit(args, cwd) {
    const { stdout, stderr } = await execFileAsync('git', args, { cwd, windowsHide: true, timeout: 120000 })
    return (stdout || stderr).trim()
}

async function filesEqual(a, b) {
    try {
        const [aStat, bStat] = await Promise.all([fs.stat(a), fs.stat(b)])
        if (aStat.size !== bStat.size) return false
        const [aBuf, bBuf] = await Promise.all([fs.readFile(a), fs.readFile(b)])
        return aBuf.equals(bBuf)
    } catch {
        return false
    }
}

async function copyFileWithBackup(src, dest, backupRoot, relativePath) {
    if (await exists(dest)) {
        if (await filesEqual(src, dest)) return false
        const backup = path.join(backupRoot, relativePath)
        await fs.mkdir(path.dirname(backup), { recursive: true })
        await fs.copyFile(dest, backup)
    }
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.copyFile(src, dest)
    return true
}

async function syncKernelFiles(srcRoot, destRoot, backupRoot) {
    let copied = 0
    const walk = async (dir) => {
        for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name)
            const relativePath = rel(path.relative(srcRoot, full))
            if (!relativePath || GENERATED.has(relativePath.split('/')[0]) || isProtected(relativePath)) continue
            if (entry.isDirectory()) {
                await walk(full)
            } else if (entry.isFile()) {
                if (await copyFileWithBackup(full, path.join(destRoot, relativePath), backupRoot, relativePath))
                    copied++
            }
        }
    }
    await walk(srcRoot)
    return copied
}

async function cleanupOldBackups(kernelDir) {
    const backupsDir = path.join(kernelDir, 'backups')
    try {
        const entries = await fs.readdir(backupsDir, { withFileTypes: true })
        const backups = entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort()
            .reverse()
        const removed = backups.slice(KEEP_BACKUPS)
        await Promise.all(removed.map((name) => fs.rm(path.join(backupsDir, name), { recursive: true, force: true })))
        return { kept: Math.min(backups.length, KEEP_BACKUPS), removed: removed.length }
    } catch {
        return { kept: 0, removed: 0 }
    }
}

async function writeJson(p, value) {
    await fs.mkdir(path.dirname(p), { recursive: true })
    await fs.writeFile(p, JSON.stringify(value, null, 2), 'utf8')
}

async function main() {
    const kernelDir = path.join(ROOT, '.kernel')
    const upstreamDir = path.join(kernelDir, 'upstream')
    await fs.mkdir(kernelDir, { recursive: true })

    console.log('正在拉取上游内核...')
    if (await exists(path.join(upstreamDir, '.git'))) {
        await runGit(['fetch', '--depth', '1', 'origin', 'main'], upstreamDir)
        await runGit(['checkout', 'FETCH_HEAD'], upstreamDir)
    } else {
        await runGit(['clone', '--depth', '1', REPO_URL, upstreamDir], ROOT)
    }

    const latestCommit = await runGit(['rev-parse', 'HEAD'], upstreamDir)
    const backupRoot = path.join(kernelDir, 'backups', new Date().toISOString().replace(/[:.]/g, '-'))
    const copied = await syncKernelFiles(upstreamDir, ROOT, backupRoot)
    const backupCleanup = await cleanupOldBackups(kernelDir)

    await writeJson(path.join(kernelDir, 'state.json'), {
        repo: REPO_URL,
        appliedCommit: latestCommit,
        updatedAt: new Date().toISOString(),
        backupRoot,
        copied,
        backupRetention: KEEP_BACKUPS,
        removedBackups: backupCleanup.removed
    })

    console.log(`内核更新完成：${latestCommit.slice(0, 7)}`)
    console.log(`变更文件：${copied}，备份保留：最近 ${KEEP_BACKUPS} 次，本次清理：${backupCleanup.removed} 个旧备份`)
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
})
