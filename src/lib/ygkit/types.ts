import type { EchoImportPayload } from '$lib/desktop-extension/echo-import'

export interface YGKitUser {
    id: number
    subject: string
    uids: string[]
}

export interface YGKitAuthResponse {
    authenticated: boolean
    user?: YGKitUser
}

export interface YGKitTicketResponse {
    ok: true
    user: YGKitUser
}

export interface YGKitCharacter {
    roleId: string
    character: string
    echoes: NonNullable<EchoImportPayload['characters']>[number]['echoes']
}

export interface YGKitUidCharacters {
    uid: string
    source: string
    xwuidCommit: string
    characters: YGKitCharacter[]
}

export interface YGKitCharactersResponse {
    accounts: YGKitUidCharacters[]
}
