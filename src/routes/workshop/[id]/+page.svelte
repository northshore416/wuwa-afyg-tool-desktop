<script lang="ts">
    import { onMount } from 'svelte'
    import { goto } from '$app/navigation'
    import Icon from '@iconify/svelte'
    import { importProjects } from '$lib/data/project.svelte'
    import { getCachedYGKitUser, loadCachedYGKitUser, rememberYGKitUser } from '$lib/data/ygkit-profile.svelte'
    import { prepareWorkshopImport } from '$lib/workshop/project-template'
    import { formatWwcomboDuration } from '$lib/workshop/wwcombo-package'
    import type { WorkshopItem, WorkshopSession } from '$lib/workshop/types'
    import { formatWorkshopDate, responseMessage } from '../utils'

    let item = $state<WorkshopItem | null>(null)
    let session = $state<WorkshopSession>({ authenticated: false })
    let loading = $state(true)
    let applying = $state(false)
    let loggingIn = $state(false)
    let ticket = $state('')
    let rememberMe = $state(true)
    let message = $state('')

    let cachedUser = $derived(getCachedYGKitUser())
    let displayUser = $derived(session.user || cachedUser)

    const itemId = () => decodeURIComponent(globalThis.location.pathname.split('/').filter(Boolean).at(-1) || '')

    const loadSession = async () => {
        const response = await fetch('/api/ygkit/auth/me')
        session = (await response.json()) as WorkshopSession
        if (session.user) rememberYGKitUser(session.user)
    }

    const loadItem = async () => {
        const response = await fetch(`/api/workshop/items/${encodeURIComponent(itemId())}`)
        if (!response.ok) throw new Error(await responseMessage(response))
        item = (await response.json()) as WorkshopItem
    }

    const login = async () => {
        if (!ticket.trim() || loggingIn) return
        loggingIn = true
        message = ''
        try {
            const response = await fetch('/api/ygkit/auth/ticket', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ ticket: ticket.trim(), rememberMe })
            })
            if (!response.ok) throw new Error(await responseMessage(response))
            await loadSession()
            ticket = ''
            message = '登录成功，现在可以导入稿件。'
        } catch (cause) {
            message = cause instanceof Error ? cause.message : '登录失败'
        } finally {
            loggingIn = false
        }
    }

    const applyItem = async () => {
        if (!item || applying) return
        if (!session.authenticated) {
            message = '请先重新登录 YGKIT，再导入稿件。'
            return
        }
        applying = true
        message = ''
        try {
            const response = await fetch(`/api/workshop/items/${item.id}/apply`, { method: 'POST' })
            if (!response.ok) throw new Error(await responseMessage(response))
            const appliedItem = (await response.json()) as WorkshopItem
            await importProjects([prepareWorkshopImport(appliedItem.project, appliedItem.title)])
            await goto('/?workshop=imported&ygkit=login')
        } catch (cause) {
            message = cause instanceof Error ? cause.message : '导入失败'
            applying = false
        }
    }

    onMount(async () => {
        loadCachedYGKitUser()
        try {
            await Promise.all([loadSession(), loadItem()])
        } catch (cause) {
            message = cause instanceof Error ? cause.message : '稿件加载失败'
        } finally {
            loading = false
        }
    })
</script>

<svelte:head>
    <title>{item ? `${item.title} · 创意工坊` : '稿件详情 · 创意工坊'}</title>
</svelte:head>

<main class="min-h-screen bg-[#080b12] text-slate-100">
    <div class="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:px-10">
        <header class="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
            <a
                href="/workshop"
                class="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
            >
                <Icon icon="mdi:arrow-left" class="size-4" />
                返回创意工坊
            </a>
            <a href="/" class="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
                <Icon icon="mdi:toolbox-outline" class="size-4" />
                工具箱
            </a>
        </header>

        {#if loading}
            <div class="flex min-h-[60vh] items-center justify-center text-slate-500">
                <Icon icon="mdi:loading" class="mr-2 size-5 animate-spin" />
                正在加载稿件
            </div>
        {:else if !item}
            <div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
                <Icon icon="mdi:file-alert-outline" class="mb-3 size-10 text-slate-600" />
                <p class="text-slate-300">{message || '稿件不存在'}</p>
            </div>
        {:else}
            <div class="mt-8 grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
                <article class="min-w-0">
                    {#if item.tutorial?.coverUrl}
                        <a
                            href={item.tutorial.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="group relative mb-7 block overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]"
                        >
                            <img
                                src={item.tutorial.coverUrl}
                                alt={item.tutorial.title}
                                class="aspect-video w-full object-cover opacity-80 transition duration-300 group-hover:scale-[1.01] group-hover:opacity-100"
                                referrerpolicy="no-referrer"
                            />
                            <span
                                class="absolute inset-0 flex items-center justify-center bg-black/15 transition group-hover:bg-black/5"
                            >
                                <span
                                    class="flex size-16 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur"
                                >
                                    <Icon icon="mdi:play" class="size-8" />
                                </span>
                            </span>
                        </a>
                    {/if}

                    <div class="flex flex-wrap items-center gap-2">
                        {#if item.gameVersion}
                            <span class="rounded-full bg-violet-400/10 px-3 py-1 text-xs text-violet-300">
                                {item.gameVersion}
                            </span>
                        {/if}
                        <span class="text-xs text-slate-500">更新于 {formatWorkshopDate(item.updatedAt)}</span>
                    </div>
                    <h1 class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{item.title}</h1>

                    <div class="mt-6 flex items-center gap-3">
                        {#if item.author.avatarUrl}
                            <img
                                src={item.author.avatarUrl}
                                alt=""
                                class="size-12 rounded-full object-cover ring-2 ring-violet-300/20"
                            />
                        {:else}
                            <span
                                class="flex size-12 items-center justify-center rounded-full bg-violet-400/10 text-violet-300"
                            >
                                <Icon icon="mdi:account" class="size-6" />
                            </span>
                        {/if}
                        <div>
                            <p class="text-xs text-slate-500">发布人</p>
                            <p class="mt-0.5 font-medium">{item.author.label}</p>
                        </div>
                    </div>

                    <div class="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                        <h2 class="text-sm font-semibold text-slate-300">稿件简介</h2>
                        <p class="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-400">
                            {item.description || '作者没有填写额外说明。'}
                        </p>
                    </div>

                    <div class="mt-5 rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                        <h2 class="text-sm font-semibold text-slate-300">队伍配置</h2>
                        <div class="mt-4 flex flex-wrap gap-2">
                            {#each item.team as character}
                                <span
                                    class="rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm text-slate-300"
                                >
                                    {character}
                                </span>
                            {/each}
                        </div>
                    </div>

                    {#if item.practiceCharts.length > 0}
                        <section class="mt-5 border-y border-emerald-300/15 bg-emerald-300/[0.035] px-1 py-6">
                            <div class="flex items-center gap-2">
                                <Icon icon="mdi:gamepad-variant-outline" class="size-5 text-emerald-300" />
                                <h2 class="text-sm font-semibold text-slate-200">已绑定练轴预设</h2>
                            </div>
                            <div class="mt-4 grid gap-3">
                                {#each item.practiceCharts as practice}
                                    <div class="rounded-lg border border-white/10 bg-black/20 p-4">
                                        <div class="flex flex-wrap items-start justify-between gap-3">
                                            <div class="min-w-0">
                                                <p class="truncate font-medium text-emerald-100">{practice.title}</p>
                                                <p class="mt-1 text-xs text-slate-500">
                                                    {practice.actionCount} 个动作 · {formatWwcomboDuration(
                                                        practice.durationMs
                                                    )}
                                                </p>
                                            </div>
                                            <span
                                                class="rounded-md bg-emerald-300/10 px-2 py-1 text-xs text-emerald-300"
                                            >
                                                wwcombo v{practice.schemaVersion}
                                            </span>
                                        </div>
                                        {#if practice.team.length > 0}
                                            <div class="mt-3 flex flex-wrap gap-2">
                                                {#each practice.team as character}
                                                    <span
                                                        class="rounded-md border border-white/8 px-2 py-1 text-xs text-slate-400"
                                                    >
                                                        {character}
                                                    </span>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        </section>
                    {/if}

                    {#if item.tutorial}
                        <a
                            href={item.tutorial.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="mt-5 flex items-center justify-between gap-4 rounded-3xl border border-violet-400/20 bg-violet-400/5 p-5 transition hover:bg-violet-400/10"
                        >
                            <div class="min-w-0">
                                <p class="text-xs text-violet-300">作者教学</p>
                                <p class="mt-1 truncate text-sm text-slate-200">{item.tutorial.title}</p>
                            </div>
                            <Icon icon="mdi:open-in-new" class="size-5 shrink-0 text-violet-300" />
                        </a>
                    {/if}
                </article>

                <aside class="h-fit rounded-3xl border border-white/10 bg-white/[0.035] p-5 lg:sticky lg:top-8">
                    <div class="flex items-center justify-between text-xs text-slate-500">
                        <span>已导入 {item.downloads} 次</span>
                        <span>{formatWorkshopDate(item.createdAt)}</span>
                    </div>
                    <button
                        onclick={applyItem}
                        disabled={applying}
                        class="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white font-semibold text-slate-950 transition hover:bg-violet-100 disabled:cursor-wait disabled:opacity-50"
                    >
                        <Icon
                            icon={applying ? 'mdi:loading' : 'mdi:download-outline'}
                            class={['size-5', applying && 'animate-spin']}
                        />
                        {applying ? '正在导入' : '一键导入到工具箱'}
                    </button>
                    <p class="mt-3 text-xs leading-5 text-slate-500">
                        导入后仍可选择账户声骸配组，也可以继续手动修改所有配置。
                    </p>

                    {#if item.practiceCharts.length > 0}
                        <a
                            href={'/api/workshop/items/' + item.id + '/bundle'}
                            download
                            class="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 font-semibold text-emerald-950 transition hover:bg-emerald-300"
                        >
                            <Icon icon="mdi:gamepad-variant-outline" class="size-5" />
                            下载排轴与练轴组合预设
                        </a>
                        <p class="mt-3 text-xs leading-5 text-slate-500">
                            下载后在仓库内集成的椰果连段训练器中点击“导入”，即可读取练轴谱并开始练习。
                        </p>
                    {/if}

                    {#if displayUser}
                        <div class="mt-5 flex items-center gap-3 border-t border-white/8 pt-5">
                            {#if displayUser.avatarUrl}
                                <img src={displayUser.avatarUrl} alt="" class="size-10 rounded-full object-cover" />
                            {:else}
                                <span
                                    class="flex size-10 items-center justify-center rounded-full bg-sky-400/10 text-sky-300"
                                >
                                    <Icon icon="mdi:account" class="size-5" />
                                </span>
                            {/if}
                            <div class="min-w-0">
                                <p class="truncate text-sm">{displayUser.displayName}</p>
                                <p class="truncate text-xs text-slate-500">
                                    {session.authenticated ? '当前登录用户' : '最近登录资料'}
                                </p>
                            </div>
                        </div>
                    {/if}

                    {#if !session.authenticated}
                        <div class="mt-5 border-t border-white/8 pt-5">
                            <p class="text-xs leading-5 text-amber-200">
                                登录状态已失效时，保存的 QQ 资料仍会保留；重新获取 ticket 后即可导入。
                            </p>
                            <input
                                bind:value={ticket}
                                placeholder="一次性 ticket"
                                autocomplete="one-time-code"
                                class="mt-3 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none placeholder:text-slate-600 focus:border-sky-400/40"
                            />
                            <label class="mt-3 flex items-center gap-2 text-xs text-slate-400">
                                <input bind:checked={rememberMe} type="checkbox" class="accent-violet-500" />
                                在这台设备保持登录
                            </label>
                            <button
                                onclick={login}
                                disabled={!ticket.trim() || loggingIn}
                                class="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-sm font-medium transition hover:bg-sky-400 disabled:opacity-40"
                            >
                                <Icon
                                    icon={loggingIn ? 'mdi:loading' : 'mdi:login-variant'}
                                    class={['size-4', loggingIn && 'animate-spin']}
                                />
                                {loggingIn ? '正在登录' : '登录 YGKIT'}
                            </button>
                        </div>
                    {/if}

                    {#if message}
                        <p class="mt-4 rounded-xl bg-white/5 px-3 py-2 text-xs leading-5 text-slate-300">{message}</p>
                    {/if}
                </aside>
            </div>
        {/if}
    </div>
</main>
