import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import type { YGKitUser } from '$lib/ygkit/types'

interface TicketRow {
    id: number
    subject: string
    uids_json: string
    expires_at: number
}

interface SessionRow {
    id: number
    user_id: number
    subject: string
    auth_version: number
    session_auth_version: number
    idle_expires_at: number
    absolute_expires_at: number
}

interface BindingRow {
    uid: string
}

export interface CreatedSession {
    secret: string
    user: YGKitUser
    persistent: boolean
    maxAge: number
}

let database: Database.Database | null = null

const nowSeconds = () => Math.floor(Date.now() / 1000)
const hashSecret = (secret: string) => createHash('sha256').update(secret).digest('hex')
const newSecret = (bytes: number) => randomBytes(bytes).toString('base64url')

const normalizeUids = (uids: unknown): string[] => {
    if (!Array.isArray(uids)) return []
    return [...new Set(uids.map(String).filter((uid) => /^\d{5,20}$/.test(uid)))].slice(0, 10)
}

const getDatabase = (): Database.Database => {
    if (database) return database

    const dataDir = process.env.YGKIT_DATA_DIR || join(process.cwd(), '.ygkit-data')
    mkdirSync(dataDir, { recursive: true })
    database = new Database(join(dataDir, 'ygkit.db'))
    database.pragma('journal_mode = WAL')
    database.pragma('foreign_keys = ON')
    database.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT NOT NULL UNIQUE,
            auth_version INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            disabled_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS game_bindings (
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            uid TEXT NOT NULL,
            verified_at INTEGER NOT NULL,
            revoked_at INTEGER,
            PRIMARY KEY (user_id, uid)
        );

        CREATE TABLE IF NOT EXISTS login_tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_hash TEXT NOT NULL UNIQUE,
            subject TEXT NOT NULL,
            uids_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            consumed_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_hash TEXT NOT NULL UNIQUE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            auth_version INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            last_seen_at INTEGER NOT NULL,
            idle_expires_at INTEGER NOT NULL,
            absolute_expires_at INTEGER NOT NULL,
            revoked_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_hash ON sessions(session_hash);
        CREATE INDEX IF NOT EXISTS idx_tickets_hash ON login_tickets(ticket_hash);
    `)
    return database
}

const getUser = (db: Database.Database, userId: number, subject: string): YGKitUser => {
    const bindings = db
        .prepare('SELECT uid FROM game_bindings WHERE user_id = ? AND revoked_at IS NULL ORDER BY uid')
        .all(userId) as BindingRow[]
    return { id: userId, subject, uids: bindings.map((row) => row.uid) }
}

export const createLoginTicket = (subject: string, rawUids: unknown) => {
    const uids = normalizeUids(rawUids)
    if (!/^qq:[^:]{1,64}:[^:]{1,64}$/.test(subject)) throw new Error('invalid subject')
    if (uids.length === 0) throw new Error('no valid uid')

    const ticket = newSecret(20)
    const createdAt = nowSeconds()
    const expiresAt = createdAt + 300
    getDatabase()
        .prepare(
            'INSERT INTO login_tickets (ticket_hash, subject, uids_json, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(hashSecret(ticket), subject, JSON.stringify(uids), createdAt, expiresAt)
    return { ticket, expiresIn: 300 }
}

export const consumeLoginTicket = (ticket: string, persistent: boolean): CreatedSession => {
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(ticket)) throw new Error('invalid ticket')
    const db = getDatabase()

    return db.transaction(() => {
        const now = nowSeconds()
        const row = db
            .prepare(
                'SELECT id, subject, uids_json, expires_at FROM login_tickets WHERE ticket_hash = ? AND consumed_at IS NULL'
            )
            .get(hashSecret(ticket)) as TicketRow | undefined
        if (!row || row.expires_at <= now) throw new Error('ticket expired or already used')

        const consumed = db
            .prepare('UPDATE login_tickets SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL')
            .run(now, row.id)
        if (consumed.changes !== 1) throw new Error('ticket already used')

        db.prepare('INSERT OR IGNORE INTO users (subject, created_at) VALUES (?, ?)').run(row.subject, now)
        const user = db
            .prepare('SELECT id, auth_version FROM users WHERE subject = ? AND disabled_at IS NULL')
            .get(row.subject) as { id: number; auth_version: number } | undefined
        if (!user) throw new Error('user disabled')

        const uids = normalizeUids(JSON.parse(row.uids_json))
        db.prepare('UPDATE game_bindings SET revoked_at = ? WHERE user_id = ?').run(now, user.id)
        const bind = db.prepare(
            `INSERT INTO game_bindings (user_id, uid, verified_at, revoked_at)
             VALUES (?, ?, ?, NULL)
             ON CONFLICT(user_id, uid) DO UPDATE SET verified_at = excluded.verified_at, revoked_at = NULL`
        )
        for (const uid of uids) bind.run(user.id, uid, now)

        const secret = newSecret(32)
        const maxAge = persistent ? 30 * 24 * 60 * 60 : 24 * 60 * 60
        const absoluteAge = persistent ? 90 * 24 * 60 * 60 : 7 * 24 * 60 * 60
        db.prepare(
            `INSERT INTO sessions
             (session_hash, user_id, auth_version, created_at, last_seen_at, idle_expires_at, absolute_expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(hashSecret(secret), user.id, user.auth_version, now, now, now + maxAge, now + absoluteAge)

        return {
            secret,
            user: getUser(db, user.id, row.subject),
            persistent,
            maxAge
        }
    })()
}

export const authenticateSession = (secret: string | undefined): YGKitUser | null => {
    if (!secret) return null
    const db = getDatabase()
    const now = nowSeconds()
    const row = db
        .prepare(
            `SELECT s.id, s.user_id, u.subject, u.auth_version, s.auth_version AS session_auth_version,
                    s.idle_expires_at, s.absolute_expires_at
             FROM sessions s
             JOIN users u ON u.id = s.user_id
             WHERE s.session_hash = ? AND s.revoked_at IS NULL AND u.disabled_at IS NULL`
        )
        .get(hashSecret(secret)) as SessionRow | undefined
    if (
        !row ||
        row.auth_version !== row.session_auth_version ||
        row.idle_expires_at <= now ||
        row.absolute_expires_at <= now
    ) {
        return null
    }

    const nextIdle = Math.min(row.absolute_expires_at, now + 30 * 24 * 60 * 60)
    db.prepare('UPDATE sessions SET last_seen_at = ?, idle_expires_at = ? WHERE id = ?').run(now, nextIdle, row.id)
    return getUser(db, row.user_id, row.subject)
}

export const revokeSession = (secret: string | undefined): void => {
    if (!secret) return
    getDatabase()
        .prepare('UPDATE sessions SET revoked_at = ? WHERE session_hash = ? AND revoked_at IS NULL')
        .run(nowSeconds(), hashSecret(secret))
}
