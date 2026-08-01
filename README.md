# 鸣潮椰果工具箱 WUWA-AFYG-TOOL Desktop

<p align="center">
  <img src="https://img.shields.io/badge/Framework-SvelteKit-FF3E00?logo=svelte&logoColor=white" alt="SvelteKit">
  <img src="https://img.shields.io/badge/Trainer-React-61DAFB?logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/Desktop-Tauri-24C8DB?logo=tauri&logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/Native-Rust-000000?logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white" alt="SQLite">
</p>

适合《鸣潮》玩家使用的配队、排轴、拉表、伤害计算、连段录制与练习工具。项目保留椰果工具箱原有计算和排轴能力，并整合 Windows 桌面端、本地数据保存、文字轴导入、创意工坊、YGKIT 账户声骸导入与 WWCombo 练轴功能。

本仓库是基于开源项目继续开发的非官方衍生版本。

## 下载

- 最新版本：[GitHub Releases](https://github.com/northshore416/wuwa-afyg-tool-desktop/releases/latest)
- Windows 安装版：[YGKit-Desktop-Setup-0.0.5.exe](https://github.com/northshore416/wuwa-afyg-tool-desktop/releases/download/v0.0.5/YGKit-Desktop-Setup-0.0.5.exe)
- Windows 便携版：[YGKit-Desktop-Portable-0.0.5.zip](https://github.com/northshore416/wuwa-afyg-tool-desktop/releases/download/v0.0.5/YGKit-Desktop-Portable-0.0.5.zip)
- Windows MSI：[YGKit-Desktop-0.0.5-x64.msi](https://github.com/northshore416/wuwa-afyg-tool-desktop/releases/download/v0.0.5/YGKit-Desktop-0.0.5-x64.msi)
- v0.0.5 源码：[Source code (zip)](https://github.com/northshore416/wuwa-afyg-tool-desktop/archive/refs/tags/v0.0.5.zip)

安装版适合普通用户，按照安装向导完成后可从桌面或开始菜单启动。便携版无需安装，解压后运行“椰果工具箱.exe”，不要把同目录的 `ffmpeg.exe` 单独移走。为了在游戏运行时使用全局键鼠捕获和覆盖层，Windows 可能显示管理员权限确认。

## v0.0.5 新增功能

- **统一 Windows 客户端**：以 WWCombo/Tauri 作为本地桌面外壳，同时提供连段录制、练习、覆盖层、键位显示和视频工具。
- **椰果拉表入口**：侧栏按钮通过独立、受限的 WebView 打开远程椰果工具箱，并显示服务器连接状态。
- **Windows 窗口修复**：修复同步创建远程 WebView 导致点击“椰果拉表”无响应的问题。
- **本地 SQLite 快照**：训练器状态同时保存到本地存储和 SQLite，支持 schema migration、完整性摘要与重新打开恢复。
- **离线同步队列**：预留本地工程同步队列；服务器未声明写入能力时不会擅自上传数据。
- **共享桌面协议**：新增桌面协议包、API 客户端和 `/api/client/v1/capabilities` 能力协商接口。
- **创意工坊练轴附件**：工坊方案可以绑定本地录制的练轴预设，其他用户导入组合预设后可在自己的电脑上练习。
- **账户声骸联动**：通过 YGKIT ticket 会话读取绑定账号的声骸数据，并导入当前三人队伍的词条配置。
- **版本更新入口**：客户端只检查本仓库的 GitHub Releases，不再跟随其他素材服务的版本号。

## 桌面版增强

- **中文界面**：主要按钮、提示和弹窗使用中文显示，源码统一使用 UTF-8。
- **文字轴导入**：把固定格式、连续动作或常见简写文本转换成排轴图标。
- **角色缩写识别**：根据当前选择的三人配队解析角色名单字缩写；存在重复字时优先避免误判。
- **动作模糊匹配**：支持大小写动作字母、中文动作名以及空格、换行、逗号、顿号、短横线等分隔方式。
- **本地工程保存**：排轴项目可保存并在下次打开时继续使用；未完成的训练器状态会自动写入本地数据库。
- **本地游戏数据缓存**：服务端可把接口数据缓存到 SQLite，远端暂时不可用时优先复用已有数据。
- **安全隔离**：远程椰果网页没有本地 Tauri IPC 权限，不能直接调用全局输入、文件和覆盖层命令。

## 文字轴导入格式

支持按角色换行：

```text
千咲ea
夏空eqr
卡提希娅跳aree
```

支持一行连续输入、角色名单字缩写和混合分隔符：

```text
爱eaae 千eaa 达aaaeqraa 千re 达aa 千aa 爱aae 千a 变爱aaa 达eer2 爱aaare处aaezr
```

```text
千ea-夏eqr-千a-卡e-夏跳aaa跳aaa跳闪z-延千qre-卡aa-千a-卡a-千a-延卡跳aree
```

角色缩写从当前三人配队判断。例如队伍为爱弥斯、达妮娅、千咲时，可以使用“爱、达、千”；队伍为卡提希娅、夏空、千咲时，可以使用“卡、夏、千”。角色名后的中英文冒号会被自动忽略。

## 键位与动作映射

| 文字轴输入 | 映射动作/按键 | 说明 |
| --- | --- | --- |
| `a` / `A` / `左键` | 鼠标左键 | 普通攻击 |
| `e` / `E` | `E` | 共鸣技能 |
| `q` / `Q` | `Q` | 声骸技能 |
| `r` / `R` | `R` | 共鸣解放 |
| `z` / `Z` | `Z` | Z 动作图标 |
| `跳` / `空格` | `Spacebar` | 跳跃 |
| `闪` / `闪避` / `右键` | 鼠标右键 | 闪避 |
| `变` / `变奏` / `intro` | 变奏图标 | 绑定到后一个角色 |
| `延` / `延奏` / `outro` | 延奏图标 | 绑定到前一个发出动作的角色 |
| `处` / `处决` | `F` | 处决/交互动作 |
| `钩` / `钩锁` | `T` | 钩锁 |

动作字母不区分大小写。空格、换行、逗号、中文逗号、顿号、分号和短横线等分隔符会被尽量模糊处理。

## 声骸导入接口

网页加载后会暴露 `window.YGKitEchoImport`，供受信任的插件或本地联动代码导入当前项目的声骸和词条：

```ts
await window.YGKitEchoImport?.importEchoes({
  version: 1,
  source: 'plugin-name',
  characters: [
    {
      character: '千咲',
      echoes: [
        {
          name: '声骸名称',
          cost: 4,
          mainStat: { type: '暴击率', value: 22, unit: '%' },
          substats: [
            { type: '暴击伤害', value: 21, unit: '%' },
            { type: '攻击%', value: 11.6, unit: '%' },
            { type: '共鸣效率', value: 12.4, unit: '%' }
          ]
        }
      ]
    }
  ]
})
```

也可以使用消息接口：

```ts
window.postMessage({ type: 'wuwa-afyg:echo-import', payload }, '*')
```

接口会根据当前三人配队匹配角色，同时更新声骸名称、Cost、主词条和副词条。词条配置已经锁定时会拒绝导入，需要先解锁。正式服务器联动优先使用 YGKIT ticket 会话，不要把发行者或读取者 token 写入前端。

## 创意工坊与练轴联动

- `/workshop` 提供方案浏览、发布、审核和应用。
- 工坊方案可以附带 WWCombo 练轴预设，组合包同时包含 AFYG 工程和练轴数据。
- 其他用户导入组合预设后，可以在本地训练器中打开对应连段。
- 工坊公开数据会剔除投稿者的个人声骸名称、Cost、主副词条和个人结果分析。
- 全局按键监听、视频文件和本地训练器数据库不会上传到服务器。

## 原有功能

- **队伍配置**：选择角色、武器、声骸和套装。
- **排轴**：编排角色动作块、Buff 和时间参考线。
- **拉表**：支持 Buff 全局和 Buff 差异模式，为不同伤害段配置效果。
- **词条/环境配置**：配置声骸词条、敌人等级、抗性和其他计算环境。
- **结果分析**：输出伤害、DPS、伤害占比和分段计算过程。
- **项目管理**：新建、保存、导入、导出和继续编辑本地项目。

## 数据保存位置

| 数据 | 保存位置 |
| --- | --- |
| 椰果网页项目 | 当前浏览器/WebView 的 IndexedDB |
| 训练器状态快照 | `%APPDATA%/com.northshore416.afyg.combotrainer/unified-client.db` |
| 服务器用户、会话、工坊和练轴附件 | `YGKIT_DATA_DIR/ygkit.db` |
| 服务器游戏数据缓存 | 服务器配置的数据目录 |

SQLite 使用 WAL 模式。备份服务器数据库时应同时备份 `ygkit.db`、`ygkit.db-wal` 和 `ygkit.db-shm`，或者先停止服务器再复制数据库。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 椰果工具箱前端 | SvelteKit / Svelte 5 / TypeScript |
| 连段训练器前端 | React / TypeScript / Vite |
| Windows 桌面端 | Tauri 2 / Rust / WebView2 |
| 服务端 | SvelteKit adapter-node |
| 数据库 | SQLite / better-sqlite3 / rusqlite |
| 图形和覆盖层 | PixiJS / Tauri WebView |
| Windows 打包 | Tauri Bundler / NSIS / WiX |

## 本地开发

需要 Node.js、Corepack/pnpm、Rust stable、Visual Studio C++ Build Tools、Windows SDK 和 WebView2 Runtime。

```powershell
corepack pnpm install
corepack pnpm run desktop:check
```

椰果工具箱网页开发版：

```powershell
corepack pnpm run dev
```

WWCombo 训练器网页开发版：

```powershell
corepack pnpm run trainer:dev
```

统一 Windows 客户端开发版：

```powershell
corepack pnpm run trainer:desktop:dev
```

## 打包 Windows 客户端

```powershell
corepack pnpm run trainer:desktop:build
```

默认输出目录：

```text
apps/wwcombo/src-tauri/target/release/
apps/wwcombo/src-tauri/target/release/bundle/nsis/
apps/wwcombo/src-tauri/target/release/bundle/msi/
```

便携版需要把 `wwcombo.exe` 和 `ffmpeg.exe` 放在同一目录后压缩分发；NSIS `setup.exe` 和 MSI 适合安装。全局输入捕获需要管理员权限，开发时出现 UAC 提示属于正常现象。

## 服务器开发与部署

```powershell
corepack pnpm run server:build
corepack pnpm run server:start
```

生产服务默认监听 `127.0.0.1:39818`，适合通过 Cloudflare Tunnel 或反向代理暴露。服务器变量模板见 [.env.server.example](.env.server.example)，详细说明见 [docs/ygkit-server.md](docs/ygkit-server.md)。

发行者 token、读取者 token 和管理员 QQ 配置只能放在服务器或朋友的 YGKIT 插件环境中，不能提交到仓库，也不能打进用户端。

## 主要 API

原有游戏数据接口包括：

```text
GET /api/v1/list/character
GET /api/v1/list/weapon
GET /api/v1/list/echo
GET /api/v1/list/echo-set
GET /api/v1/icons/character
GET /api/v1/icons/weapon
GET /api/v1/icons/echo
GET /api/v1/icons/ui-btn
GET /api/v1/info/character/:name
GET /api/v1/info/weapon/:name
GET /api/v1/info/echo/:name
GET /api/v1/info/echo-set/:name
GET /api/v1/recommend/:character
GET /api/v1/recommend-weapon/:character
```

桌面端与 YGKIT 联动接口包括：

```text
GET /api/client/v1/capabilities
GET /api/ygkit/health
GET /api/ygkit/auth/me
GET /api/workshop/items
GET /api/workshop/items/:id
GET /api/workshop/items/:id/bundle
```

## 架构文档

- [统一桌面客户端](docs/unified-desktop-client.md)
- [WWCombo 与创意工坊联动](docs/wwcombo-integration.md)
- [YGKIT 服务器部署](docs/ygkit-server.md)

## 许可与开源项目

本项目使用并修改了以下开源项目，感谢原作者及贡献者：

- [d4rkOfficial/wuwa-afyg-tool](https://github.com/d4rkOfficial/wuwa-afyg-tool)：椰果工具箱前端、计算与排轴内核基础，采用 MIT License；相关许可和补充声明保留在根目录 [LICENSE](LICENSE)。
- [NovaWallace/wwcombo](https://github.com/NovaWallace/wwcombo)：连段录制、编辑、练习和 Tauri 桌面能力基础，采用 MIT License；许可声明保留在 [apps/wwcombo/LICENSE](apps/wwcombo/LICENSE)。

本仓库不是上述两个项目的官方版本。复制、修改或再分发时，请保留适用的版权声明和许可文本。
