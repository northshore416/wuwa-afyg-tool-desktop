import type { Project } from '$lib/data/types'
import type { YGKitUser } from '$lib/ygkit/types'

export const AFYG_WORKSHOP_BUNDLE_TYPE = 'afyg-workshop-bundle' as const
export const AFYG_WORKSHOP_BUNDLE_VERSION = 1 as const
export const WWCOMBO_CHART_TYPE = 'wwcombo-chart' as const

export type WorkshopStatus = 'pending' | 'published' | 'rejected'

export interface WorkshopAuthor {
    id: number
    label: string
    avatarUrl: string
}

export interface WorkshopTutorial {
    url: string
    title: string
    coverUrl: string
}

export interface WwcomboChartStep {
    id: string
    moveId: string
    label: string
    characterSlot?: 1 | 2 | 3
    lane: 'main' | 'independent'
    independent: boolean
    startMin: number
    startMax: number
    durationMin: number
    durationMax: number
    preheatMs?: number
    recoveryMs?: number
    manualFree?: boolean
    free?: boolean
    note?: string
    color: string
    advancesStep: boolean
    samples: Array<{ recordingId: string; startTime: number; duration: number }>
}

export interface WwcomboChart {
    id: string
    title: string
    character?: string
    author?: string
    tags: string[]
    community?: {
        id?: string
        name?: string
        tags?: string[]
        description?: string
        characters?: string[]
        rounds?: number
        link?: string
        wheelchairEligible?: boolean
        exportedAt?: number
    }
    contentLabels?: Record<string, string>
    timelineDurationMs?: number
    version: number
    createdAt: number
    updatedAt: number
    startTriggerMoveId: string
    stopTriggerMoveId?: string
    steps: WwcomboChartStep[]
    periods?: Array<{
        id: string
        kind: string
        label: string
        characterSlot?: 1 | 2 | 3
        lane?: 'main' | 'independent'
        startMs: number
        endMs: number
        loopIndex?: number
    }>
}

export interface WwcomboChartPackage {
    type: typeof WWCOMBO_CHART_TYPE
    version: number
    chart: WwcomboChart
    contentLabels?: Record<string, string>
    moves?: unknown[]
    bindings?: unknown[]
}

export interface WorkshopPracticeChartSummary {
    id: string
    type: typeof WWCOMBO_CHART_TYPE
    schemaVersion: number
    title: string
    team: string[]
    actionCount: number
    durationMs: number
    checksum: string
    createdAt: number
    updatedAt: number
    downloads: number
}

export interface WorkshopPracticeChart extends WorkshopPracticeChartSummary {
    package: WwcomboChartPackage
}

export interface WorkshopItemSummary {
    id: string
    title: string
    description: string
    gameVersion: string
    author: WorkshopAuthor
    createdAt: number
    updatedAt: number
    downloads: number
    team: string[]
    status: WorkshopStatus
    reviewNote?: string
    tutorial?: WorkshopTutorial
    practiceCharts: WorkshopPracticeChartSummary[]
}

export interface WorkshopItem extends WorkshopItemSummary {
    project: Project
}

export interface WorkshopListResponse {
    items: WorkshopItemSummary[]
    page: number
    pageSize: number
    total: number
}

export interface WorkshopPublishRequest {
    title: string
    description: string
    gameVersion?: string
    tutorialUrl?: string
    project: Project
    practiceChart?: WwcomboChartPackage
}

export interface AfygWorkshopBundle {
    type: typeof AFYG_WORKSHOP_BUNDLE_TYPE
    version: typeof AFYG_WORKSHOP_BUNDLE_VERSION
    exportedAt: number
    workshop: Omit<WorkshopItemSummary, 'practiceCharts'>
    project: Project
    practiceCharts: WorkshopPracticeChart[]
}

export interface WorkshopLinkPreview {
    url: string
    title: string
    coverUrl: string
}

export interface WorkshopSession {
    authenticated: boolean
    user?: YGKitUser
}
