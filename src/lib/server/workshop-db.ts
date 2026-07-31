import { randomUUID } from 'node:crypto'
import { getQQAvatarUrl, getYGKitDatabase } from '$lib/server/ygkit-db'
import type { ValidatedPracticeChart } from '$lib/server/wwcombo-package'
import type { Project } from '$lib/data/types'
import type { YGKitUser } from '$lib/ygkit/types'
import {
    AFYG_WORKSHOP_BUNDLE_TYPE,
    AFYG_WORKSHOP_BUNDLE_VERSION,
    WWCOMBO_CHART_TYPE,
    type AfygWorkshopBundle,
    type WorkshopItem,
    type WorkshopItemSummary,
    type WorkshopLinkPreview,
    type WorkshopListResponse,
    type WorkshopPracticeChart,
    type WorkshopPracticeChartSummary,
    type WorkshopPublishRequest,
    type WorkshopStatus,
    type WwcomboChartPackage
} from '$lib/workshop/types'

interface WorkshopRow {
    id: string
    author_id: number
    title: string
    description: string
    game_version: string
    payload_json: string
    created_at: number
    updated_at: number
    download_count: number
    status: WorkshopStatus
    review_note: string | null
    author_label: string | null
    author_avatar_url: string | null
    tutorial_url: string | null
    tutorial_title: string | null
    tutorial_cover_url: string | null
}

interface WorkshopAttachmentRow {
    id: string
    workshop_item_id: string
    type: typeof WWCOMBO_CHART_TYPE
    schema_version: number
    title: string
    team_json: string
    action_count: number
    duration_ms: number
    checksum: string
    payload_json: string
    created_at: number
    updated_at: number
    download_count: number
}

interface CountRow {
    total: number
}

interface AuthorRow {
    subject: string
    display_name: string | null
    avatar_url: string | null
}

const nowSeconds = () => Math.floor(Date.now() / 1000)

const ensureColumn = (table: string, column: string, declaration: string) => {
    const db = getYGKitDatabase()
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    if (columns.some((item) => item.name === column)) return false
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${declaration}`)
    return true
}

const ensureSchema = () => {
    const db = getYGKitDatabase()
    db.exec(`
        CREATE TABLE IF NOT EXISTS workshop_items (
            id TEXT PRIMARY KEY,
            author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            game_version TEXT NOT NULL DEFAULT '',
            payload_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            published_at INTEGER NOT NULL,
            download_count INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'published',
            reviewer_id INTEGER REFERENCES users(id),
            reviewed_at INTEGER,
            review_note TEXT,
            deleted_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_workshop_items_published
        ON workshop_items(deleted_at, published_at DESC);

        CREATE TABLE IF NOT EXISTS workshop_attachments (
            id TEXT PRIMARY KEY,
            workshop_item_id TEXT NOT NULL REFERENCES workshop_items(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            schema_version INTEGER NOT NULL,
            title TEXT NOT NULL,
            team_json TEXT NOT NULL DEFAULT '[]',
            action_count INTEGER NOT NULL DEFAULT 0,
            duration_ms INTEGER NOT NULL DEFAULT 0,
            checksum TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            download_count INTEGER NOT NULL DEFAULT 0,
            UNIQUE(workshop_item_id, type, checksum)
        );

        CREATE INDEX IF NOT EXISTS idx_workshop_attachments_item
        ON workshop_attachments(workshop_item_id, type, created_at);
    `)
    ensureColumn('workshop_items', 'status', "status TEXT NOT NULL DEFAULT 'published'")
    ensureColumn('workshop_items', 'reviewer_id', 'reviewer_id INTEGER REFERENCES users(id)')
    ensureColumn('workshop_items', 'reviewed_at', 'reviewed_at INTEGER')
    ensureColumn('workshop_items', 'review_note', 'review_note TEXT')
    const addedAuthorLabel = ensureColumn('workshop_items', 'author_label', 'author_label TEXT')
    const addedAuthorAvatar = ensureColumn('workshop_items', 'author_avatar_url', 'author_avatar_url TEXT')
    ensureColumn('workshop_items', 'tutorial_url', 'tutorial_url TEXT')
    ensureColumn('workshop_items', 'tutorial_title', 'tutorial_title TEXT')
    ensureColumn('workshop_items', 'tutorial_cover_url', 'tutorial_cover_url TEXT')
    if (addedAuthorLabel || addedAuthorAvatar)
        db.exec(`
            UPDATE workshop_items
            SET author_label = COALESCE(
                    NULLIF(author_label, ''),
                    (SELECT NULLIF(display_name, '') FROM users WHERE users.id = workshop_items.author_id),
                    'YGKIT 用户 #' || author_id
                ),
                author_avatar_url = COALESCE(
                    author_avatar_url,
                    (SELECT avatar_url FROM users WHERE users.id = workshop_items.author_id),
                    ''
                )
            WHERE author_label IS NULL OR author_label = '' OR author_avatar_url IS NULL
        `)
    return db
}

const parseProject = (payload: string): Project => JSON.parse(payload) as Project
const parsePracticePackage = (payload: string): WwcomboChartPackage => JSON.parse(payload) as WwcomboChartPackage

const parseTeam = (payload: string): string[] => {
    try {
        const value = JSON.parse(payload) as unknown
        return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    } catch {
        return []
    }
}

const toPracticeSummary = (row: WorkshopAttachmentRow): WorkshopPracticeChartSummary => ({
    id: row.id,
    type: WWCOMBO_CHART_TYPE,
    schemaVersion: row.schema_version,
    title: row.title,
    team: parseTeam(row.team_json),
    actionCount: row.action_count,
    durationMs: row.duration_ms,
    checksum: row.checksum,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    downloads: row.download_count
})

const listPracticeCharts = (
    db: ReturnType<typeof getYGKitDatabase>,
    workshopItemId: string,
    includePayload = false
): Array<WorkshopPracticeChartSummary | WorkshopPracticeChart> => {
    const rows = db
        .prepare(
            `SELECT id, workshop_item_id, type, schema_version, title, team_json, action_count,
                    duration_ms, checksum, payload_json, created_at, updated_at, download_count
             FROM workshop_attachments
             WHERE workshop_item_id = ? AND type = ?
             ORDER BY created_at ASC`
        )
        .all(workshopItemId, WWCOMBO_CHART_TYPE) as WorkshopAttachmentRow[]
    return rows.map((row) => {
        const summary = toPracticeSummary(row)
        return includePayload ? { ...summary, package: parsePracticePackage(row.payload_json) } : summary
    })
}

const toSummary = (db: ReturnType<typeof getYGKitDatabase>, row: WorkshopRow): WorkshopItemSummary => {
    const project = parseProject(row.payload_json)
    const author = db.prepare('SELECT subject, display_name, avatar_url FROM users WHERE id = ?').get(row.author_id) as
        AuthorRow | undefined
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        gameVersion: row.game_version,
        author: {
            id: row.author_id,
            label: row.author_label || author?.display_name || `YGKIT 用户 #${row.author_id}`,
            avatarUrl: author?.avatar_url || row.author_avatar_url || getQQAvatarUrl(author?.subject || '')
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        downloads: row.download_count,
        status: row.status,
        reviewNote: row.review_note || undefined,
        tutorial: row.tutorial_url
            ? {
                  url: row.tutorial_url,
                  title: row.tutorial_title || row.tutorial_url,
                  coverUrl: row.tutorial_cover_url || ''
              }
            : undefined,
        team: project.team
            .map((slot) => slot.character)
            .filter((name): name is string => typeof name === 'string' && name.length > 0),
        practiceCharts: listPracticeCharts(db, row.id) as WorkshopPracticeChartSummary[]
    }
}

const selectWorkshopRow = (db: ReturnType<typeof getYGKitDatabase>, id: string, publishedOnly: boolean) =>
    db
        .prepare(
            `SELECT id, author_id, title, description, game_version, payload_json,
                    created_at, updated_at, download_count, status, review_note,
                    author_label, author_avatar_url, tutorial_url, tutorial_title, tutorial_cover_url
             FROM workshop_items
             WHERE id = ? AND deleted_at IS NULL${publishedOnly ? " AND status = 'published'" : ''}`
        )
        .get(id) as WorkshopRow | undefined

export const listWorkshopItems = (page: number, pageSize: number, query: string): WorkshopListResponse => {
    const db = ensureSchema()
    const offset = (page - 1) * pageSize
    const search = `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
    const where = query
        ? "deleted_at IS NULL AND status = 'published' AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')"
        : "deleted_at IS NULL AND status = 'published'"
    const params = query ? [search, search] : []
    const total = (db.prepare(`SELECT COUNT(*) AS total FROM workshop_items WHERE ${where}`).get(...params) as CountRow)
        .total
    const rows = db
        .prepare(
            `SELECT id, author_id, title, description, game_version, payload_json,
                    created_at, updated_at, download_count, status, review_note,
                    author_label, author_avatar_url, tutorial_url, tutorial_title, tutorial_cover_url
             FROM workshop_items
             WHERE ${where}
             ORDER BY published_at DESC
             LIMIT ? OFFSET ?`
        )
        .all(...params, pageSize, offset) as WorkshopRow[]

    return { items: rows.map((row) => toSummary(db, row)), page, pageSize, total }
}

export const getWorkshopItem = (id: string): WorkshopItem | null => {
    const db = ensureSchema()
    const row = selectWorkshopRow(db, id, true)
    return row ? { ...toSummary(db, row), project: parseProject(row.payload_json) } : null
}

export const createWorkshopItem = (
    author: YGKitUser,
    request: Omit<WorkshopPublishRequest, 'project' | 'practiceChart'> & {
        project: Project
        practiceChart?: ValidatedPracticeChart
        tutorial?: WorkshopLinkPreview
    }
): WorkshopItem => {
    const db = ensureSchema()
    const id = randomUUID()
    const now = nowSeconds()
    db.transaction(() => {
        db.prepare(
            `INSERT INTO workshop_items
             (id, author_id, author_label, author_avatar_url, title, description, game_version, payload_json,
              tutorial_url, tutorial_title, tutorial_cover_url, created_at, updated_at, published_at, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
        ).run(
            id,
            author.id,
            author.displayName || `YGKIT 用户 #${author.id}`,
            author.avatarUrl || '',
            request.title,
            request.description,
            request.gameVersion || '',
            JSON.stringify(request.project),
            request.tutorial?.url || null,
            request.tutorial?.title || null,
            request.tutorial?.coverUrl || null,
            now,
            now,
            now
        )
        if (request.practiceChart) {
            const practice = request.practiceChart
            db.prepare(
                `INSERT INTO workshop_attachments
                 (id, workshop_item_id, type, schema_version, title, team_json, action_count, duration_ms,
                  checksum, payload_json, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
                randomUUID(),
                id,
                WWCOMBO_CHART_TYPE,
                practice.package.version,
                practice.title,
                JSON.stringify(practice.team),
                practice.actionCount,
                practice.durationMs,
                practice.checksum,
                practice.serialized,
                now,
                now
            )
        }
    })()
    return getWorkshopItemForAdmin(id)!
}

export const recordWorkshopDownload = (id: string): WorkshopItem | null => {
    const db = ensureSchema()
    const updated = db
        .prepare(
            `UPDATE workshop_items SET download_count = download_count + 1
             WHERE id = ? AND deleted_at IS NULL AND status = 'published'`
        )
        .run(id)
    return updated.changes === 1 ? getWorkshopItem(id) : null
}

export const getWorkshopBundle = (id: string): AfygWorkshopBundle | null => {
    const item = getWorkshopItem(id)
    if (!item || item.practiceCharts.length === 0) return null
    const db = ensureSchema()
    const { project, practiceCharts: _practiceCharts, ...workshop } = item
    return {
        type: AFYG_WORKSHOP_BUNDLE_TYPE,
        version: AFYG_WORKSHOP_BUNDLE_VERSION,
        exportedAt: Date.now(),
        workshop,
        project,
        practiceCharts: listPracticeCharts(db, id, true) as WorkshopPracticeChart[]
    }
}

export const recordWorkshopBundleDownload = (id: string): AfygWorkshopBundle | null => {
    const db = ensureSchema()
    const updated = db.transaction(() => {
        const result = db
            .prepare(
                `UPDATE workshop_items SET download_count = download_count + 1
                 WHERE id = ? AND deleted_at IS NULL AND status = 'published'
                   AND EXISTS (
                       SELECT 1 FROM workshop_attachments
                       WHERE workshop_item_id = workshop_items.id AND type = ?
                   )`
            )
            .run(id, WWCOMBO_CHART_TYPE)
        if (result.changes !== 1) return false
        db.prepare(
            'UPDATE workshop_attachments SET download_count = download_count + 1 WHERE workshop_item_id = ? AND type = ?'
        ).run(id, WWCOMBO_CHART_TYPE)
        return true
    })()
    return updated ? getWorkshopBundle(id) : null
}

export const deleteWorkshopItem = (id: string, authorId: number): boolean =>
    ensureSchema()
        .prepare('UPDATE workshop_items SET deleted_at = ? WHERE id = ? AND author_id = ? AND deleted_at IS NULL')
        .run(nowSeconds(), id, authorId).changes === 1

export const getWorkshopItemForAdmin = (id: string): WorkshopItem | null => {
    const db = ensureSchema()
    const row = selectWorkshopRow(db, id, false)
    return row ? { ...toSummary(db, row), project: parseProject(row.payload_json) } : null
}

export const listWorkshopReviewItems = (status: WorkshopStatus): WorkshopItemSummary[] => {
    const db = ensureSchema()
    const rows = db
        .prepare(
            `SELECT id, author_id, title, description, game_version, payload_json,
                    created_at, updated_at, download_count, status, review_note,
                    author_label, author_avatar_url, tutorial_url, tutorial_title, tutorial_cover_url
             FROM workshop_items
             WHERE status = ? AND deleted_at IS NULL
             ORDER BY created_at ASC`
        )
        .all(status) as WorkshopRow[]
    return rows.map((row) => toSummary(db, row))
}

export const reviewWorkshopItem = (
    id: string,
    reviewerId: number,
    status: Extract<WorkshopStatus, 'published' | 'rejected'>,
    note: string
): WorkshopItem | null => {
    const now = nowSeconds()
    const updated = ensureSchema()
        .prepare(
            `UPDATE workshop_items
             SET status = ?, reviewer_id = ?, reviewed_at = ?, review_note = ?,
                 published_at = CASE WHEN ? = 'published' THEN ? ELSE published_at END,
                 updated_at = ?
             WHERE id = ? AND deleted_at IS NULL AND status = 'pending'`
        )
        .run(status, reviewerId, now, note, status, now, now, id)
    return updated.changes === 1 ? getWorkshopItemForAdmin(id) : null
}
