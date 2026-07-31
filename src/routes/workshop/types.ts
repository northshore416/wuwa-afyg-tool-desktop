export type WorkshopNoticeTone = 'info' | 'success' | 'error'

export interface WorkshopNotice {
    tone: WorkshopNoticeTone
    message: string
}
