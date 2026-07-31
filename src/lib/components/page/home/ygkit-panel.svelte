<script lang="ts">
    import { onMount } from 'svelte'
    import Icon from '@iconify/svelte'
    import Modal from '$lib/components/layout/modal.svelte'
    import type { EchoImportBridgeResult, EchoImportPayload } from '$lib/ygkit/echo-import'
    import type { CharSlot } from '$lib/data/types'
    import type { ComponentsProps } from '$lib/types'
    import type {
        YGKitAuthResponse,
        YGKitCharacter,
        YGKitCharactersResponse,
        YGKitUidCharacters
    } from '$lib/ygkit/types'

    interface Props extends ComponentsProps {
        open: boolean
        onclose?: () => void
        onimport: (payload: EchoImportPayload) => Promise<EchoImportBridgeResult>
        team?: [CharSlot, CharSlot, CharSlot] | null
    }

    let { open, onclose, onimport, team = null, class: className, style: styleProp }: Props = $props()

    let loading = $state(false)
    let submitting = $state(false)
    let ticket = $state('')
    let rememberMe = $state(true)
    let authenticated = $state(false)
    let subject = $state('')
    let displayName = $state('')
    let avatarUrl = $state('')
    let accounts = $state<YGKitUidCharacters[]>([])
    let errorMessage = $state('')
    let successMessage = $state('')
    let autoImportedKey = $state('')

    async function requestJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const response = await fetch(endpoint, options)
        const body = (await response.json()) as T & { message?: string }
        if (!response.ok) throw new Error(body.message || `HTTP ${response.status}`)
        return body
    }

    const loadCharacters = async () => {
        loading = true
        errorMessage = ''
        try {
            const result = await requestJson<YGKitCharactersResponse & { errors?: string[] }>(
                '/api/ygkit/player/characters'
            )
            accounts = result.accounts
            if (result.errors?.length) errorMessage = result.errors.join('\n')
            await autoImportMatchingTeam(result.accounts)
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : '角色数据加载失败'
        } finally {
            loading = false
        }
    }

    const loadSession = async () => {
        loading = true
        errorMessage = ''
        try {
            const result = await requestJson<YGKitAuthResponse>('/api/ygkit/auth/me')
            authenticated = result.authenticated
            subject = result.user?.subject || ''
            displayName = result.user?.displayName || ''
            avatarUrl = result.user?.avatarUrl || ''
            if (authenticated) await loadCharacters()
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : '登录状态读取失败'
        } finally {
            loading = false
        }
    }

    const handleLogin = async () => {
        if (!ticket.trim()) return
        submitting = true
        errorMessage = ''
        successMessage = ''
        try {
            await requestJson('/api/ygkit/auth/ticket', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ ticket: ticket.trim(), rememberMe })
            })
            ticket = ''
            authenticated = true
            successMessage = '登录成功，正在读取 XWUID 数据'
            await loadSession()
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : '登录失败'
        } finally {
            submitting = false
        }
    }

    const handleLogout = async () => {
        submitting = true
        errorMessage = ''
        try {
            await requestJson('/api/ygkit/auth/logout', { method: 'POST' })
            authenticated = false
            subject = ''
            displayName = ''
            avatarUrl = ''
            accounts = []
            successMessage = '已退出登录'
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : '退出失败'
        } finally {
            submitting = false
        }
    }

    const handleImport = async (account: YGKitUidCharacters, character: YGKitCharacter) => {
        errorMessage = ''
        successMessage = ''
        const result = await onimport({
            version: 1,
            source: `YGKIT/XutheringWavesUID/${account.uid}`,
            characters: [
                {
                    character: character.character,
                    echoes: character.echoes
                }
            ]
        })
        if (result.ok) {
            successMessage = `${character.character}：${result.message}`
            onclose?.()
        } else {
            errorMessage = [result.message, ...result.warnings].filter(Boolean).join('\n')
        }
    }

    const matchedCharacters = (account: YGKitUidCharacters) => {
        const names = new Set((team || []).map((slot) => slot.character).filter(Boolean))
        return account.characters.filter((character) => names.has(character.character) && character.echoes?.length)
    }

    const importAccountTeam = async (account: YGKitUidCharacters, closeAfter = false) => {
        const characters = matchedCharacters(account)
        if (characters.length === 0) return
        const result = await onimport({
            version: 1,
            source: `YGKIT/XutheringWavesUID/${account.uid}`,
            characters
        })
        if (result.ok) {
            successMessage = `已从 UID ${account.uid} 同步当前队伍的 ${characters.length} 名角色。`
            if (closeAfter) onclose?.()
        } else {
            errorMessage = [result.message, ...result.warnings].filter(Boolean).join('\n')
        }
    }

    const autoImportMatchingTeam = async (availableAccounts: YGKitUidCharacters[]) => {
        if (!team) return
        const account = [...availableAccounts].sort(
            (left, right) => matchedCharacters(right).length - matchedCharacters(left).length
        )[0]
        if (!account || matchedCharacters(account).length === 0) return
        const key = `${account.uid}:${team.map((slot) => slot.character || '').join(',')}`
        if (autoImportedKey === key) return
        autoImportedKey = key
        await importAccountTeam(account)
    }

    $effect(() => {
        const currentTeam = team
        const currentAccounts = accounts
        if (currentTeam && currentAccounts.length > 0) void autoImportMatchingTeam(currentAccounts)
    })

    onMount(() => {
        void loadSession()
    })
</script>

<Modal {open} {onclose} class={className} style={styleProp}>
    {#snippet title()}
        <div class="flex items-center gap-2">
            <Icon icon="mdi:link-variant" class="size-5 text-indigo-300" />
            YGKIT · XWUID
        </div>
    {/snippet}

    <div class="flex min-h-64 w-[min(760px,calc(100vw-88px))] flex-col gap-4">
        {#if loading}
            <div class="flex flex-1 items-center justify-center gap-2 text-sm text-white/60">
                <Icon icon="mdi:loading" class="size-5 animate-spin" />
                正在读取账号与角色数据
            </div>
        {:else if !authenticated}
            <div class="rounded-xl border border-white/10 bg-black/15 p-4 text-sm leading-6 text-white/70">
                私聊已绑定 XWUID 的机器人，发送 <code class="rounded bg-white/10 px-1.5 py-0.5 text-indigo-200"
                    >yg登录</code
                >，然后把收到的一次性 ticket 粘贴到下方。ticket 只在 5 分钟内有效，使用后立即失效。
            </div>
            <label class="flex flex-col gap-1.5 text-sm">
                <span class="text-white/70">一次性 ticket</span>
                <input
                    bind:value={ticket}
                    onkeydown={(event) => {
                        if (event.key === 'Enter') void handleLogin()
                    }}
                    autocomplete="one-time-code"
                    spellcheck="false"
                    class="rounded-lg border border-white/15 bg-black/20 px-3 py-2.5 font-mono text-sm outline-none transition-colors focus:border-indigo-400"
                    placeholder="粘贴机器人发送的 ticket"
                />
            </label>
            <label class="flex cursor-pointer items-center gap-2 text-sm text-white/70">
                <input bind:checked={rememberMe} type="checkbox" class="size-4 accent-indigo-500" />
                在这台设备上保持登录（最长 30 天无操作）
            </label>
            <button
                onclick={handleLogin}
                disabled={submitting || !ticket.trim()}
                class="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400 disabled:pointer-events-none disabled:opacity-40"
            >
                <Icon
                    icon={submitting ? 'mdi:loading' : 'mdi:login-variant'}
                    class={submitting ? 'size-4 animate-spin' : 'size-4'}
                />
                登录并绑定
            </button>
        {:else}
            <div class="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 p-3">
                <div class="flex min-w-0 items-center gap-3">
                    {#if avatarUrl}
                        <img
                            src={avatarUrl}
                            alt=""
                            class="size-10 rounded-full object-cover ring-2 ring-indigo-400/20"
                        />
                    {:else}
                        <span
                            class="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-300"
                        >
                            <Icon icon="mdi:account-check-outline" class="size-5" />
                        </span>
                    {/if}
                    <div class="min-w-0">
                        <div class="truncate text-sm font-medium">{displayName || '已通过 QQ/XWUID 登录'}</div>
                        <div class="truncate text-xs text-white/45">{subject}</div>
                    </div>
                </div>
                <div class="flex shrink-0 gap-2">
                    <button
                        onclick={loadCharacters}
                        class="rounded-lg border border-white/15 p-2 text-white/70 transition-colors hover:bg-white/10"
                        aria-label="刷新角色数据"
                    >
                        <Icon icon="mdi:refresh" class="size-4" />
                    </button>
                    <button
                        onclick={handleLogout}
                        disabled={submitting}
                        class="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 disabled:opacity-40"
                    >
                        <Icon icon="mdi:logout-variant" class="size-4" />
                        退出
                    </button>
                </div>
            </div>

            {#if accounts.length === 0}
                <div class="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-white/50">
                    <Icon icon="mdi:account-search-outline" class="size-9" />
                    <p>没有可用的角色面板数据。</p>
                    <p class="text-xs">请先在 QQ 中用 XWUID 查询一次角色面板，再回来刷新。</p>
                </div>
            {:else}
                <div class="flex max-h-[50vh] flex-col gap-4 overflow-y-auto pr-1">
                    {#each accounts as account}
                        <section class="flex flex-col gap-2">
                            <div class="flex items-center justify-between text-xs text-white/50">
                                <span>UID {account.uid}</span>
                                <div class="flex items-center gap-2">
                                    <span>{account.characters.length} 个角色</span>
                                    {#if matchedCharacters(account).length > 0}
                                        <button
                                            onclick={() => importAccountTeam(account, true)}
                                            class="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 px-2 py-1 text-indigo-200 transition hover:bg-indigo-500/25"
                                        >
                                            <Icon icon="mdi:account-sync-outline" class="size-3.5" />
                                            导入当前队伍
                                        </button>
                                    {/if}
                                </div>
                            </div>
                            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {#each account.characters as character}
                                    <div
                                        class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                                    >
                                        <div class="min-w-0 flex-1">
                                            <div class="truncate text-sm font-medium">{character.character}</div>
                                            <div class="text-xs text-white/45">
                                                {character.echoes?.length || 0} 个已装备声骸
                                            </div>
                                            {#if character.echoes?.length}
                                                <div class="mt-1 flex flex-wrap gap-1">
                                                    {#each character.echoes as echo}
                                                        <span
                                                            class="max-w-28 truncate rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40"
                                                            title={echo.name || echo.echoName || '未知声骸'}
                                                        >
                                                            {echo.name || echo.echoName || '未知声骸'} · {echo.cost ||
                                                                '?'}C
                                                        </span>
                                                    {/each}
                                                </div>
                                            {/if}
                                        </div>
                                        <button
                                            onclick={() => handleImport(account, character)}
                                            disabled={!character.echoes?.length}
                                            class="inline-flex shrink-0 items-center gap-1 rounded-md bg-indigo-500/90 px-2.5 py-1.5 text-xs text-white transition-colors hover:bg-indigo-400 disabled:pointer-events-none disabled:opacity-35"
                                        >
                                            <Icon icon="mdi:database-import-outline" class="size-3.5" />
                                            导入
                                        </button>
                                    </div>
                                {/each}
                            </div>
                        </section>
                    {/each}
                </div>
            {/if}
        {/if}

        {#if errorMessage}
            <div
                class="whitespace-pre-line rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
            >
                {errorMessage}
            </div>
        {/if}
        {#if successMessage}
            <div class="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                {successMessage}
            </div>
        {/if}
    </div>
</Modal>
