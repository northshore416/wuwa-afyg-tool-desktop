import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const REPO_URL = 'https://github.com/d4rkOfficial/wuwa-afyg-tool.git'
const REPO_API = 'https://api.github.com/repos/d4rkOfficial/wuwa-afyg-tool/commits/main'
const KEEP_BACKUPS = 5

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

const GENERATED = new Set(['node_modules', '.svelte-kit', 'build', 'release', '.kernel'])

function rootDir() {
    return process.env.WUWA_SOURCE_DIR || process.cwd()
}

function rel(p: string) {
    return p.replace(/\\/g, '/')
}

function isProtected(relativePath: string) {
    const r = rel(relativePath)
    return [...PROTECTED].some((p) => r === p || r.startsWith(p + '/'))
}

async function exists(p: string) {
    try {
        await fs.access(p)
        return true
    } catch {
        return false
    }
}

async function readJson<T>(p: string): Promise<T | null> {
    try {
        return JSON.parse(await fs.readFile(p, 'utf8')) as T
    } catch {
        return null
    }
}

async function writeJson(p: string, value: unknown) {
    await fs.mkdir(path.dirname(p), { recursive: true })
    await fs.writeFile(p, JSON.stringify(value, null, 2), 'utf8')
}

async function latestRemoteCommit(): Promise<string> {
    const res = await fetch(REPO_API, { headers: { 'User-Agent': 'WUWA-AFYG-Desktop' } })
    if (!res.ok) throw new Error(`GitHub API ${res.status}`)
    const data = (await res.json()) as { sha?: string }
    if (!data.sha) throw new Error('GitHub response missing sha')
    return data.sha
}

async function runGit(args: string[], cwd: string) {
    const { stdout, stderr } = await execFileAsync('git', args, { cwd, windowsHide: true, timeout: 120000 })
    return (stdout || stderr).trim()
}

async function filesEqual(a: string, b: string) {
    try {
        const [aStat, bStat] = await Promise.all([fs.stat(a), fs.stat(b)])
        if (aStat.size !== bStat.size) return false
        const [aBuf, bBuf] = await Promise.all([fs.readFile(a), fs.readFile(b)])
        return aBuf.equals(bBuf)
    } catch {
        return false
    }
}

async function copyFileWithBackup(src: string, dest: string, backupRoot: string, relativePath: string) {
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

async function syncKernelFiles(srcRoot: string, destRoot: string, backupRoot: string) {
    let copied = 0
    const walk = async (dir: string) => {
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

async function cleanupOldBackups(kernelDir: string) {
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

export async function getKernelStatus() {
    const root = rootDir()
    const statePath = path.join(root, '.kernel', 'state.json')
    const state = await readJson<{ appliedCommit?: string; updatedAt?: string }>(statePath)
    const latestCommit = await latestRemoteCommit()
    return {
        ok: true,
        repo: REPO_URL,
        sourceRoot: root,
        latestCommit,
        appliedCommit: state?.appliedCommit ?? null,
        updateAvailable: state?.appliedCommit !== latestCommit
    }
}

export async function updateKernel() {
    const root = rootDir()
    if (process.env.WUWA_APP_PACKAGED === '1' || root.includes('app.asar'))
        throw new Error(
            '当前是已安装应用，不能直接改写内核源码。请在源码目录运行开发版执行内核更新，然后重新打包安装版。'
        )
    const kernelDir = path.join(root, '.kernel')
    const upstreamDir = path.join(kernelDir, 'upstream')
    await fs.mkdir(kernelDir, { recursive: true })

    if (await exists(path.join(upstreamDir, '.git'))) {
        await runGit(['fetch', '--depth', '1', 'origin', 'main'], upstreamDir)
        await runGit(['checkout', 'FETCH_HEAD'], upstreamDir)
    } else {
        await runGit(['clone', '--depth', '1', REPO_URL, upstreamDir], root)
    }

    const latestCommit = await runGit(['rev-parse', 'HEAD'], upstreamDir)
    const backupRoot = path.join(kernelDir, 'backups', new Date().toISOString().replace(/[:.]/g, '-'))
    const copied = await syncKernelFiles(upstreamDir, root, backupRoot)
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
    return { ok: true, latestCommit, copied, backupRoot, backupCleanup, protected: [...PROTECTED] }
}
