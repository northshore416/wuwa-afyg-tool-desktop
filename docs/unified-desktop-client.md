# 统一桌面客户端架构

## 已落地的第一阶段

统一客户端以 `apps/wwcombo` 的 Tauri 进程作为桌面外壳。本地连段录制、全局输入、覆盖层、视频工具继续运行在本机；椰果拉表和创意工坊通过单独的受限 WebView 连接 `https://ygkit.usotsuki-kaze.com`。两个功能共用一个应用进程和入口，但不把远程网页授予本机录制权限。

共享边界位于：

- `packages/desktop-protocol`：客户端、服务端和 SQLite 数据结构的版本化类型。
- `packages/desktop-api-client`：带超时、Cookie 会话和统一错误的远程 API 客户端。
- `/api/client/v1/capabilities`：服务器向桌面端声明协议版本和已开放功能。
- `apps/wwcombo/src-tauri/src/desktop_store.rs`：本地 SQLite、离线队列、服务器健康检查和远程窗口。

## 数据流

1. 桌面端启动时创建 `unified-client.db`，开启 WAL、外键和 schema migration。
2. 训练器原有 localStorage 继续承担同步首屏读取，状态变化会延迟 250 ms 镜像到 SQLite。
3. 如果 WebView 本地存储被清空，启动时会从 SQLite 恢复最近一次训练器快照。
4. 可同步文档进入 `sync_queue`；同一文档的连续修改会合并，避免离线操作无限堆积。
5. 当前服务器能力响应明确返回 `projectSync: false`，因此本阶段不会向不存在的写入接口上传数据。朋友的服务端补齐同步接口后，只需实现队列消费者。

数据库实际路径由 `desktop_bootstrap` 返回，并显示在侧栏“椰果拉表”按钮的悬浮提示中。Windows 下一般位于当前用户的应用数据目录，不会写进安装目录。

## 安全边界

- 远程窗口只允许 HTTPS，并限制到 `usotsuki-kaze.com` 及其子域；调试构建额外允许本机回环地址。
- `afyg-portal` 不在本地 Tauri capability 的窗口列表中，远程网页不能调用全局输入、文件导出或 SQLite 命令。
- 本地页面启用 CSP；asset protocol 不再使用 `**`，用户选择的视频会在运行时单独加入读取范围。
- Rust HTTP 客户端不跟随重定向，避免健康检查跳转到未信任主机。
- 客户端版本检查固定读取
  northshore416/wuwa-afyg-tool-desktop 的 GitHub Releases；素材清单仍由 WWCombo 素材服务独立提供。

## 开发与验证

```powershell
corepack pnpm install
corepack pnpm run desktop:check
corepack pnpm run trainer:build
corepack pnpm run trainer:desktop:build
```

原生构建需要 Rust stable-msvc、Visual Studio 2022 C++ Build Tools、Windows SDK 和 WebView2 Runtime。视频叠加导出还需要 FFmpeg；它不是启动和普通录制的前置条件。

## 下一阶段接口

服务端准备好项目同步接口后，建议新增 `/api/client/v1/sync/push` 和 `/api/client/v1/sync/pull`，使用文档 `namespace + id + revision + checksum` 做幂等与冲突检测。排轴和练轴预设仍使用已经落地的组合预设协议，不把原始全局按键流上传到服务器。
