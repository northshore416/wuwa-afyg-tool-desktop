export const DESKTOP_PROTOCOL_VERSION = 1 as const
export const DEFAULT_SERVER_ORIGIN = 'https://ygkit.usotsuki-kaze.com' as const

export const SERVER_FEATURES = ['ticket-auth', 'workshop', 'practice-bundles', 'echo-import'] as const

export type ServerFeature = (typeof SERVER_FEATURES)[number]
export type LocalSyncStatus = 'local' | 'pending' | 'synced' | 'failed'

export interface ServerCapabilities {
    ok: boolean
    service: 'YGKIT'
    protocolVersion: number
    minimumClientVersion: string
    serverTime: number
    features: readonly ServerFeature[]
    projectSync: false
}

export interface ServerHealth {
    ok: boolean
    service: string
}

export interface DesktopBootstrap {
    protocolVersion: number
    appVersion: string
    databasePath: string
    serverOrigin: string
    pendingSyncCount: number
}

export interface RemoteHealth {
    online: boolean
    origin: string
    service: string | null
    protocolVersion: number | null
    latencyMs: number
    checkedAt: number
    detail: string | null
}

export interface LocalDocument<T = unknown> {
    namespace: string
    id: string
    revision: number
    payload: T
    checksum: string
    updatedAt: number
    syncStatus: LocalSyncStatus
}

export interface SyncQueueEntry<T = unknown> {
    id: number
    namespace: string
    documentId: string
    operation: 'upsert' | 'delete'
    payload: T | null
    revision: number
    createdAt: number
    attemptCount: number
    lastError: string | null
}

export interface DesktopStorePutOptions<T = unknown> {
    namespace: string
    id: string
    payload: T
    revision?: number
    syncable?: boolean
}
