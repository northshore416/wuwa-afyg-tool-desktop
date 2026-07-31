<script lang="ts">
    import { onMount } from 'svelte'
    import Icon from '@iconify/svelte'
    import type { WorkshopItemSummary, WorkshopSession, WorkshopStatus } from '$lib/workshop/types'
    import { formatWorkshopDate, responseMessage } from '../utils'

    let session = $state<WorkshopSession>({ authenticated: false })
    let items = $state<WorkshopItemSummary[]>([])
    let status = $state<WorkshopStatus>('pending')
    let loading = $state(true)
    let ticket = $state('')
    let loggingIn = $state(false)
    let reviewingId = $state('')
    let notes = $state<Record<string, string>>({})
    let message = $state('')
    let errorMessage = $state('')

    const loadSession = async () => {
        const response = await fetch('/api/ygkit/auth/me')
        session = (await response.json()) as WorkshopSession
    }

    const loadItems = async () => {
        if (!session.user?.isAdmin) {
            loading = false
            return
        }
        loading = true
        errorMessage = ''
        try {
            const response = await fetch(`/api/workshop/admin/items?status=${status}`)
            if (!response.ok) throw new Error(await responseMessage(response))
            const body = (await response.json()) as { items: WorkshopItemSummary[] }
            items = body.items
        } catch (cause) {
            errorMessage = cause instanceof Error ? cause.message : '审核列表加载失败'
        } finally {
            loading = false
        }
    }

    const login = async () => {
        if (!ticket.trim() || loggingIn) return
        loggingIn = true
        errorMessage = ''
        try {
            const response = await fetch('/api/ygkit/auth/ticket', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ ticket: ticket.trim(), rememberMe: true })
            })
            if (!response.ok) throw new Error(await responseMessage(response))
            ticket = ''
            await loadSession()
            await loadItems()
        } catch (cause) {
            errorMessage = cause instanceof Error ? cause.message : '登录失败'
        } finally {
            loggingIn = false
        }
    }

    const review = async (item: WorkshopItemSummary, decision: 'approve' | 'reject') => {
        if (reviewingId) return
        reviewingId = item.id
        errorMessage = ''
        message = ''
        try {
            const response = await fetch(`/api/workshop/admin/items/${item.id}/review`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ decision, note: notes[item.id] || '' })
            })
            if (!response.ok) throw new Error(await responseMessage(response))
            items = items.filter((entry) => entry.id !== item.id)
            message = decision === 'approve' ? `已通过「${item.title}」` : `已驳回「${item.title}」`
        } catch (cause) {
            errorMessage = cause instanceof Error ? cause.message : '审核失败'
        } finally {
            reviewingId = ''
        }
    }

    const selectStatus = async (next: WorkshopStatus) => {
        status = next
        await loadItems()
    }

    onMount(async () => {
        await loadSession()
        await loadItems()
    })
</script>

<svelte:head><title>工坊审核 · YGKIT</title></svelte:head>

<main class="min-h-screen bg-[#080b12] text-slate-100">
    <div class="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <header class="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-7">
            <div class="flex items-center gap-4">
                <span
                    class="flex size-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300 ring-1 ring-amber-300/20"
                >
                    <Icon icon="mdi:shield-check-outline" class="size-6" />
                </span>
                <div>
                    <p class="text-xs tracking-[0.24em] text-amber-300">YGKIT ADMIN</p>
                    <h1 class="mt-1 text-2xl font-semibold">创意工坊审核</h1>
                </div>
            </div>
            <a
                href="/workshop"
                class="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
            >
                <Icon icon="mdi:arrow-left" class="size-4" />
                返回工坊
            </a>
        </header>

        {#if errorMessage || message}
            <div
                class={[
                    'mt-6 rounded-2xl border px-4 py-3 text-sm',
                    errorMessage
                        ? 'border-red-400/20 bg-red-400/10 text-red-200'
                        : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                ]}
            >
                {errorMessage || message}
            </div>
        {/if}

        {#if !session.authenticated}
            <section class="mx-auto mt-20 max-w-md rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                <Icon icon="mdi:qqchat" class="size-7 text-sky-300" />
                <h2 class="mt-4 text-xl font-semibold">使用管理员 QQ 登录</h2>
                <p class="mt-2 text-sm leading-6 text-slate-500">
                    私聊机器人发送 <code class="rounded bg-white/7 px-1.5 py-0.5">yg登录</code>，使用得到的一次性
                    ticket。登录后由服务器核对管理员 QQ 白名单。
                </p>
                <input
                    bind:value={ticket}
                    placeholder="一次性 ticket"
                    class="mt-5 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 outline-none focus:border-sky-400/40"
                />
                <button
                    onclick={login}
                    disabled={!ticket.trim() || loggingIn}
                    class="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 font-medium transition hover:bg-sky-400 disabled:opacity-40"
                >
                    <Icon
                        icon={loggingIn ? 'mdi:loading' : 'mdi:login-variant'}
                        class={['size-4', loggingIn && 'animate-spin']}
                    />
                    登录并验证权限
                </button>
            </section>
        {:else if !session.user?.isAdmin}
            <section class="mx-auto mt-20 max-w-lg rounded-3xl border border-red-400/15 bg-red-400/5 p-8 text-center">
                <Icon icon="mdi:shield-lock-outline" class="mx-auto size-10 text-red-300" />
                <h2 class="mt-4 text-xl font-semibold">当前 QQ 没有管理员权限</h2>
                <p class="mt-2 text-sm text-slate-500">
                    当前身份：{session.user?.displayName || session.user?.subject}。请在服务端配置 YGKIT_ADMIN_QQ_IDS
                    后重新登录。
                </p>
            </section>
        {:else}
            <div class="mt-7 flex flex-wrap items-center justify-between gap-4">
                <div class="flex rounded-xl border border-white/10 bg-white/[0.035] p-1">
                    {#each [['pending', '待审核'], ['published', '已通过'], ['rejected', '已驳回']] as option}
                        <button
                            onclick={() => selectStatus(option[0] as WorkshopStatus)}
                            class={[
                                'rounded-lg px-4 py-2 text-sm transition',
                                status === option[0] ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
                            ]}
                        >
                            {option[1]}
                        </button>
                    {/each}
                </div>
                <div class="flex items-center gap-3 text-sm text-slate-400">
                    {#if session.user.avatarUrl}
                        <img src={session.user.avatarUrl} alt="" class="size-8 rounded-full object-cover" />
                    {/if}
                    <span>{session.user.displayName}</span>
                    <span class="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs text-amber-300">管理员</span>
                </div>
            </div>

            {#if loading}
                <div class="flex min-h-72 items-center justify-center text-slate-500">
                    <Icon icon="mdi:loading" class="mr-2 size-5 animate-spin" />加载审核队列
                </div>
            {:else if items.length === 0}
                <div
                    class="mt-8 flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-white/10"
                >
                    <Icon icon="mdi:check-all" class="size-10 text-emerald-300/60" />
                    <p class="mt-3 text-slate-400">这个队列已经处理完了</p>
                </div>
            {:else}
                <div class="mt-8 grid gap-5">
                    {#each items as item (item.id)}
                        <article class="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                            <div class="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                        <span class="inline-flex items-center gap-1.5">
                                            {#if item.author.avatarUrl}
                                                <img
                                                    src={item.author.avatarUrl}
                                                    alt=""
                                                    class="size-5 rounded-full object-cover"
                                                />
                                            {/if}
                                            {item.author.label}
                                        </span>
                                        <span>·</span>
                                        <span>{formatWorkshopDate(item.createdAt)}</span>
                                        {#if item.gameVersion}
                                            <span class="rounded-full bg-violet-400/10 px-2 py-0.5 text-violet-300"
                                                >{item.gameVersion}</span
                                            >
                                        {/if}
                                    </div>
                                    <h2 class="mt-2 text-xl font-semibold">{item.title}</h2>
                                    <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                                        {item.description || '作者没有填写说明。'}
                                    </p>
                                    {#if item.tutorial}
                                        <a
                                            href={item.tutorial.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="mt-4 flex max-w-xl items-center gap-3 rounded-2xl border border-violet-400/15 bg-violet-400/5 p-3 transition hover:bg-violet-400/10"
                                        >
                                            {#if item.tutorial.coverUrl}
                                                <img
                                                    src={item.tutorial.coverUrl}
                                                    alt=""
                                                    class="h-14 w-24 shrink-0 rounded-lg object-cover"
                                                    referrerpolicy="no-referrer"
                                                />
                                            {/if}
                                            <div class="min-w-0">
                                                <p class="text-xs text-violet-300">投稿教学</p>
                                                <p class="mt-1 truncate text-sm text-slate-300">
                                                    {item.tutorial.title}
                                                </p>
                                            </div>
                                            <Icon
                                                icon="mdi:open-in-new"
                                                class="ml-auto size-4 shrink-0 text-violet-300"
                                            />
                                        </a>
                                    {/if}
                                </div>
                                <div class="flex flex-wrap gap-2">
                                    {#each item.team as character}
                                        <span
                                            class="rounded-lg border border-white/8 bg-black/20 px-2.5 py-1 text-xs text-slate-300"
                                        >
                                            {character}
                                        </span>
                                    {/each}
                                </div>
                            </div>

                            {#if status === 'pending'}
                                <div class="mt-5 flex flex-col gap-3 border-t border-white/8 pt-5 sm:flex-row">
                                    <input
                                        value={notes[item.id] || ''}
                                        oninput={(event) => (notes[item.id] = event.currentTarget.value)}
                                        maxlength="500"
                                        placeholder="审核备注；驳回时必填"
                                        class="h-11 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-amber-300/40"
                                    />
                                    <button
                                        onclick={() => review(item, 'reject')}
                                        disabled={Boolean(reviewingId)}
                                        class="h-11 rounded-xl border border-red-400/20 px-5 text-sm text-red-300 transition hover:bg-red-400/10 disabled:opacity-40"
                                    >
                                        驳回
                                    </button>
                                    <button
                                        onclick={() => review(item, 'approve')}
                                        disabled={Boolean(reviewingId)}
                                        class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-medium transition hover:bg-emerald-400 disabled:opacity-40"
                                    >
                                        <Icon
                                            icon={reviewingId === item.id ? 'mdi:loading' : 'mdi:check'}
                                            class={['size-4', reviewingId === item.id && 'animate-spin']}
                                        />
                                        通过并发布
                                    </button>
                                </div>
                            {:else if item.reviewNote}
                                <p class="mt-5 border-t border-white/8 pt-4 text-sm text-slate-500">
                                    审核备注：{item.reviewNote}
                                </p>
                            {/if}
                        </article>
                    {/each}
                </div>
            {/if}
        {/if}
    </div>
</main>
