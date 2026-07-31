import type { Project } from '$lib/data/types'
import type { YGKitUser } from '$lib/ygkit/types'

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
