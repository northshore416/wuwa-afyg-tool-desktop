<script lang="ts">
    import { onMount } from 'svelte'
    import Icon from '@iconify/svelte'
    import type { ComponentsProps } from '$lib/types'
    import type { CharSlot } from '$lib/data/types'
    import type { ConfigState } from './config.types'
    import { applyEchoImportPayload } from '$lib/ygkit/echo-import'
    import type { YGKitAuthResponse, YGKitCharactersResponse, YGKitUidCharacters } from '$lib/ygkit/types'

    interface Props extends ComponentsProps {
        team: [CharSlot, CharSlot, CharSlot]
        config: ConfigState
        locked?: boolean
        onapply: (team: [CharSlot, CharSlot, CharSlot], config: ConfigState) => void
    }

    let { team, config, locked = false, onapply, class: className, style: styleProp }: Props = $props()

    let accounts = $state<YGKitUidCharacters[]>([])
    let selected = $state('custom')
    let loading = $state(true)
    let applying = $state(false)
    let displayName = $state('')
    let avatarUrl = $state('')
    let message = $state('')

    const teamNames = () => team.map((slot) => slot.character).filter((name): name is string => Boolean(name))

    const matchedCharacters = (account: YGKitUidCharacters) => {
        const names = new Set(teamNames())
        return account.characters.filter((character) => names.has(character.character) && character.echoes?.length)
    }

    const bestAccount = () =>
        [...accounts].sort((left, right) => matchedCharacters(right).length - matchedCharacters(left).length)[0]

    const applyAccount = async (account: YGKitUidCharacters) => {
        const characters = matchedCharacters(account)
        if (characters.length === 0 || applying || locked) return
        applying = true
        try {
            const result = applyEchoImportPayload(
                {
                    version: 1,
                    source: `YGKIT/XutheringWavesUID/${account.uid}`,
                    characters
                },
                team,
                config
            )
            onapply(result.team, result.config)
            selected = `account:${account.uid}`
            message = `已从 UID ${account.uid} 同步 ${characters.length} 名角色；仍可继续手动修改。`
        } finally {
            applying = false
        }
    }

    const handleSelection = async () => {
        if (!selected.startsWith('account:')) {
            message = '当前为项目自定义配置，所有词条都可以手动修改。'
            return
        }
        const uid = selected.slice('account:'.length)
        const account = accounts.find((item) => item.uid === uid)
        if (account) await applyAccount(account)
    }

    const loadAccounts = async () => {
        loading = true
        try {
            const authResponse = await fetch('/api/ygkit/auth/me')
            const auth = (await authResponse.json()) as YGKitAuthResponse
            if (!auth.authenticated || !auth.user) {
                message = '登录 YGKIT 后可直接选择账户声骸配组。'
                return
            }
            displayName = auth.user.displayName
            avatarUrl = auth.user.avatarUrl
            const response = await fetch('/api/ygkit/player/characters')
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const data = (await response.json()) as YGKitCharactersResponse
            accounts = data.accounts
            const account = bestAccount()
            if (account && matchedCharacters(account).length > 0) {
                message = `已识别 ${matchedCharacters(account).length} 名当前队伍角色，可选择账户配组。`
            } else {
                message = '账户数据中没有找到与当前队伍匹配的角色。'
            }
        } catch {
            message = '账户声骸读取失败，可继续使用自定义配置。'
        } finally {
            loading = false
        }
    }

    onMount(loadAccounts)
</script>

<div
    class={[
        'flex flex-col gap-3 rounded-2xl border border-(--theme-card-border) bg-(--theme-card-bg) p-4 lg:flex-row lg:items-center',
        className
    ]}
    style={styleProp}
>
    <div class="flex min-w-0 flex-1 items-center gap-3">
        {#if avatarUrl}
            <img src={avatarUrl} alt="" class="size-10 rounded-full object-cover ring-2 ring-indigo-400/20" />
        {:else}
            <span
                class="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400"
            >
                <Icon icon="mdi:account-sync-outline" class="size-5" />
            </span>
        {/if}
        <div class="min-w-0">
            <div class="flex items-center gap-2">
                <span class="truncate text-sm font-semibold text-(--theme-card-text)">
                    {displayName || '声骸配组'}
                </span>
                {#if accounts.length > 0}
                    <span class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-500"
                        >YGKIT 在线</span
                    >
                {/if}
            </div>
            <p class="mt-0.5 truncate text-xs text-(--theme-card-text)/45">{message}</p>
        </div>
    </div>

    <div class="flex items-center gap-2">
        <select
            bind:value={selected}
            onchange={handleSelection}
            disabled={loading || applying || locked}
            class="h-10 min-w-52 rounded-xl border border-(--theme-card-border) bg-(--theme-page-bg) px-3 text-sm text-(--theme-card-text) outline-none transition focus:border-indigo-400 disabled:opacity-50"
        >
            <option value="custom">自定义配置（当前项目）</option>
            {#each accounts as account}
                <option value={`account:${account.uid}`}>
                    账户导入 · UID {account.uid}（匹配 {matchedCharacters(account).length} 人）
                </option>
            {/each}
        </select>
        <button
            onclick={async () => {
                if (selected.startsWith('account:')) {
                    const account = accounts.find((item) => item.uid === selected.slice('account:'.length))
                    if (account) await applyAccount(account)
                } else {
                    await loadAccounts()
                }
            }}
            disabled={loading || applying || locked}
            class="flex size-10 items-center justify-center rounded-xl border border-(--theme-card-border) text-(--theme-card-text)/60 transition hover:bg-(--theme-card-bg-focused) disabled:opacity-40"
            aria-label="刷新声骸配组"
            title="刷新声骸配组"
        >
            <Icon icon="mdi:refresh" class={['size-4', (loading || applying) && 'animate-spin']} />
        </button>
    </div>
</div>
