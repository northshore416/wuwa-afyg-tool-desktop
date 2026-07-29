import { NANOKA_BASE } from '$lib/api/consts'

type JsonValue = unknown

type StoreRow = {
    json: string
    version?: string
}

type Manifest = {
    ww?: {
        latest?: string
        available?: string[]
    }
}

type StoreDb = {
    exec(sql: string): void
    pragma(sql: string): void
    prepare(sql: string): {
        get(...params: unknown[]): StoreRow | undefined
        run(...params: unknown[]): void
    }
}

let db: StoreDb | null = null
let warmPromise: Promise<void> | null = null
const memory = new Map<string, JsonValue>()

export function isDesktopDataEnabled(): boolean {
    return typeof process !== 'undefined' && process.env.WUWA_DESKTOP === '1'
}

async function getDb(): Promise<StoreDb> {
    if (db) return db

    const [{ default: DatabaseModule }, fs, path] = await Promise.all([
        import('better-sqlite3'),
        import('node:fs'),
        import('node:path')
    ])
    const Database =
        (DatabaseModule as unknown as { default?: new (file: string) => StoreDb })?.default ?? DatabaseModule
    const dataDir = process.env.WUWA_DATA_DIR || path.join(process.cwd(), '.desktop-data')
    fs.mkdirSync(dataDir, { recursive: true })

    db = new (Database as new (file: string) => StoreDb)(path.join(dataDir, 'wuwa-afyg.db'))
    db.pragma('journal_mode = WAL')
    db.exec(`
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            json TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS nanoka_json (
            namespace TEXT NOT NULL,
            version TEXT NOT NULL,
            path TEXT NOT NULL,
            json TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (namespace, version, path)
        );

        CREATE INDEX IF NOT EXISTS idx_nanoka_json_path
            ON nanoka_json (namespace, path, updated_at DESC);
    `)

    return db
}

async function fetchRemoteJson<T>(url: string): Promise<T> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
    return res.json() as Promise<T>
}

async function readMeta<T>(key: string): Promise<T | null> {
    const database = await getDb()
    const row = database.prepare('SELECT json FROM meta WHERE key = ?').get(key)
    return row ? (JSON.parse(row.json) as T) : null
}

async function writeMeta(key: string, value: JsonValue): Promise<void> {
    const database = await getDb()
    database
        .prepare('INSERT OR REPLACE INTO meta (key, json, updated_at) VALUES (?, ?, ?)')
        .run(key, JSON.stringify(value), Date.now())
}

function cacheKey(namespace: string, version: string, path: string): string {
    return `${namespace}:${version}:${path}`
}

async function readJson<T>(namespace: string, version: string, path: string): Promise<T | null> {
    const key = cacheKey(namespace, version, path)
    if (memory.has(key)) return memory.get(key) as T

    const database = await getDb()
    const row = database
        .prepare('SELECT json FROM nanoka_json WHERE namespace = ? AND version = ? AND path = ?')
        .get(namespace, version, path)
    if (!row) return null

    const data = JSON.parse(row.json) as T
    memory.set(key, data)
    return data
}

async function readNewestJson<T>(namespace: string, path: string): Promise<T | null> {
    const database = await getDb()
    const row = database
        .prepare(
            'SELECT json, version FROM nanoka_json WHERE namespace = ? AND path = ? ORDER BY updated_at DESC LIMIT 1'
        )
        .get(namespace, path)
    if (!row) return null

    const key = cacheKey(namespace, row.version ?? 'unknown', path)
    const data = JSON.parse(row.json) as T
    memory.set(key, data)
    return data
}

async function writeJson(namespace: string, version: string, path: string, value: JsonValue): Promise<void> {
    const database = await getDb()
    database
        .prepare(
            'INSERT OR REPLACE INTO nanoka_json (namespace, version, path, json, updated_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(namespace, version, path, JSON.stringify(value), Date.now())
    memory.set(cacheKey(namespace, version, path), value)
}

async function refreshNanokaJson<T>(namespace: 'base' | 'zh', version: string, path: string, url: string): Promise<T> {
    const remote = await fetchRemoteJson<T>(url)
    await writeJson(namespace, version, path, remote)
    return remote
}

export async function fetchManifestWithCache(fallback: Manifest): Promise<Manifest> {
    if (!isDesktopDataEnabled()) return fetchRemoteJson<Manifest>(`${NANOKA_BASE}/manifest.json`)

    try {
        const manifest = await fetchRemoteJson<Manifest>(`${NANOKA_BASE}/manifest.json`)
        await writeMeta('manifest', manifest)
        return manifest
    } catch (error) {
        const cached = await readMeta<Manifest>('manifest')
        if (cached) return cached
        return fallback
    }
}

export async function getPreferredVersion(fallback: string): Promise<string> {
    if (!isDesktopDataEnabled()) return fallback

    try {
        const cached = await readMeta<Manifest>('manifest')
        return cached?.ww?.latest ?? fallback
    } catch {
        return fallback
    }
}

export async function fetchCachedNanokaJson<T>(
    namespace: 'base' | 'zh',
    version: string,
    path: string,
    url: string
): Promise<T> {
    if (!isDesktopDataEnabled()) return fetchRemoteJson<T>(url)

    const cached = await readJson<T>(namespace, version, path)
    if (cached) return cached

    try {
        const remote = await fetchRemoteJson<T>(url)
        await writeJson(namespace, version, path, remote)
        return remote
    } catch (error) {
        const newest = await readNewestJson<T>(namespace, path)
        if (newest) return newest
        throw error
    }
}

export function warmDesktopData(): Promise<void> {
    if (!isDesktopDataEnabled()) return Promise.resolve()
    if (warmPromise) return warmPromise

    warmPromise = (async () => {
        const manifest = await fetchManifestWithCache({ ww: { latest: '3.5', available: ['3.5'] } })
        const version = manifest.ww?.latest ?? '3.5'
        const baseFiles = ['/character.json', '/weapon.json', '/echo.json', '/sonata.json']

        await Promise.allSettled(
            baseFiles.map((file) => fetchCachedNanokaJson('base', version, file, `${NANOKA_BASE}/ww/${version}${file}`))
        )
        await fetchCachedNanokaJson('zh', version, '/sonata.json', `${NANOKA_BASE}/ww/${version}/zh/sonata.json`).catch(
            () => undefined
        )
    })()

    return warmPromise
}

export async function refreshDesktopData(): Promise<{ version: string; updated: string[]; failed: string[] }> {
    if (!isDesktopDataEnabled()) {
        const manifest = await fetchRemoteJson<Manifest>(`${NANOKA_BASE}/manifest.json`)
        return { version: manifest.ww?.latest ?? '3.5', updated: [], failed: [] }
    }

    const manifest = await fetchManifestWithCache({ ww: { latest: '3.5', available: ['3.5'] } })
    const version = manifest.ww?.latest ?? '3.5'
    const targets = [
        { namespace: 'base' as const, path: '/character.json', url: `${NANOKA_BASE}/ww/${version}/character.json` },
        { namespace: 'base' as const, path: '/weapon.json', url: `${NANOKA_BASE}/ww/${version}/weapon.json` },
        { namespace: 'base' as const, path: '/echo.json', url: `${NANOKA_BASE}/ww/${version}/echo.json` },
        { namespace: 'base' as const, path: '/sonata.json', url: `${NANOKA_BASE}/ww/${version}/sonata.json` },
        { namespace: 'zh' as const, path: '/sonata.json', url: `${NANOKA_BASE}/ww/${version}/zh/sonata.json` }
    ]

    const results = await Promise.allSettled(
        targets.map((target) => refreshNanokaJson(target.namespace, version, target.path, target.url))
    )

    const updated: string[] = []
    const failed: string[] = []
    for (let i = 0; i < results.length; i++) {
        const label = `${targets[i].namespace}:${targets[i].path}`
        if (results[i].status === 'fulfilled') updated.push(label)
        else failed.push(label)
    }

    return { version, updated, failed }
}
