# 椰果工具箱 · YGKIT Server

面向《鸣潮》的队伍配置、排轴、拉表、伤害计算、方案分享与连段练习工具。根目录运行 SvelteKit Node
服务器；Windows 连段录制与练习能力作为独立 Tauri 子应用放在 `apps/wwcombo`。两个应用共用一个源码仓库，
服务器不会获得全局按键监听等桌面权限。

本仓库是基于开源项目继续开发的非官方衍生版本，由
[northshore](https://github.com/northshore416) 维护与发布。项目源码位于
[northshore416/wuwa-afyg-tool-desktop](https://github.com/northshore416/wuwa-afyg-tool-desktop)，
当前服务器与联动功能在 `ygkit-server` 分支维护。

## 页面

- `/`：椰果工具箱，项目保存在当前浏览器的 IndexedDB 中。
- `/workshop`：独立挂载的创意工坊。
- `/api/ygkit/*`：YGKIT ticket 登录、会话和 XWUID 数据读取接口。
- `/api/workshop/*`：创意工坊公开列表及登录后的发布、应用与组合预设下载接口。
- `apps/wwcombo`：本地连段录制、编辑、练习和视频工具，支持导入工坊组合预设。

创意工坊与工具箱使用同一 Node 服务，但路由、页面和 API 均单独组织。工坊发布时，服务器会强制清空：

- 五个声骸名称与 Cost；
- 主词条、第二主词条和副词条；
- 基于个人声骸生成的结果分析。

队伍、武器、套装选择、轴表、计算配置和敌人环境会保留。用户一键应用方案后会跳转到工具箱并打开
YGKIT 面板，通过绑定 QQ 的 ticket 登录会话读取自己的声骸数据。

## 环境要求

- Node.js 22 LTS
- pnpm（推荐通过 Corepack 管理）
- Windows 部署 `better-sqlite3` 时，如无可用预编译包，需要 Visual Studio Build Tools 的
  “使用 C++ 的桌面开发”工作负载。

## 本地开发

```powershell
corepack pnpm install
corepack pnpm run dev
```

开发服务默认由 Vite 提供。打开：

```text
http://localhost:5173/
http://localhost:5173/workshop
```

训练器网页开发版：

```powershell
corepack pnpm run trainer:dev
```

训练器 Windows 桌面开发版需要 Rust 工具链和 WebView2：

```powershell
corepack pnpm run trainer:desktop:dev
```

## 服务器构建

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run server:build
corepack pnpm run server:start
```

生产输出固定在 `build-server/`，默认只监听 `127.0.0.1:39818`，适合由 Cloudflare Tunnel
或其他反向代理暴露：

```text
https://ygkit.usotsuki-kaze.com/          -> http://127.0.0.1:39818/
https://ygkit.usotsuki-kaze.com/workshop -> http://127.0.0.1:39818/workshop
```

## 必需环境变量

复制 `.env.server.example` 并填写：

```env
YGKIT_PUBLIC_ORIGIN=https://ygkit.usotsuki-kaze.com
YGKIT_PLUGIN_BASE_URL=http://127.0.0.1:8765
YGKIT_ISSUER_TOKEN=<高强度随机值>
YGKIT_READER_TOKEN=<另一份高强度随机值>
YGKIT_DATA_DIR=D:\YGKIT\data
YGKIT_ADMIN_QQ_IDS=<管理员 QQ 号，多个用英文逗号分隔>
```

两个 token 必须不同，只能保存在服务端环境和 YGKIT 插件环境中。详细部署和 Cloudflare Tunnel
配置见 [docs/ygkit-server.md](docs/ygkit-server.md)。

## 数据存储

- 用户项目：浏览器 IndexedDB。
- YGKIT 用户、ticket、session、UID 绑定、创意工坊方案与练轴附件：`YGKIT_DATA_DIR/ygkit.db`。
- 训练器本地连段库与外观设置：Windows WebView 的本地存储。
- SQLite 启用 WAL 和外键。

备份服务器时需要一并备份 `ygkit.db`、`ygkit.db-wal` 和 `ygkit.db-shm`，或先停止服务再复制数据库。

## 安全边界

- ticket 五分钟过期且只能消费一次；
- 登录态使用 `HttpOnly`、`SameSite=Lax` cookie，HTTPS 下使用 `Secure` 和 `__Host-` 前缀；
- 修改类 API 校验同源 `Origin`；
- 工坊应用与发布要求 YGKIT 登录；
- 新投稿默认进入待审核队列，只有管理员通过后才会公开；
- 工坊仅接受有限大小的 JSON 项目数据，不运行用户代码；
- Cloudflare 不应缓存 `/api/ygkit/*` 与 `/api/workshop/*`。

管理员使用普通的 `yg登录` ticket 登录 `/workshop/admin`，服务器根据
`YGKIT_ADMIN_QQ_IDS` 判断权限，不存在独立管理员密码。QQ 昵称与头像由 YGKIT 插件从
gsuid-core 事件资料中随 ticket 同步。

工具箱识别到当前三人队并且已有 YGKIT 会话时，会自动选择匹配角色最多的 UID，同步一次账户声骸。
词条/环境配置页顶部可以在“自定义配置”和“账户导入 · UID”之间切换；账户数据导入后仍可继续手动修改。

## 检查

```powershell
corepack pnpm run format
corepack pnpm run check
corepack pnpm run build
corepack pnpm run trainer:check
corepack pnpm run trainer:build
```

## 开源来源与许可

本项目使用并修改了以下开源项目，感谢原作者及贡献者：

| 上游项目                                                                      | 本仓库中的用途                                               | 许可证与声明                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [d4rkOfficial/wuwa-afyg-tool](https://github.com/d4rkOfficial/wuwa-afyg-tool) | 椰果工具箱的前端、计算与排轴内核基础                         | MIT License；原始许可及 D4RK 的补充声明保留在根目录 [LICENSE](LICENSE)             |
| [NovaWallace/wwcombo](https://github.com/NovaWallace/wwcombo)                 | `apps/wwcombo` 中的连段录制、编辑、练习及 Tauri 桌面能力基础 | MIT License；原始版权与许可声明保留在 [apps/wwcombo/LICENSE](apps/wwcombo/LICENSE) |

本仓库不是上述两个项目的官方版本，也不代表原作者对本项目的背书。相对于上游，本项目增加或调整了
Windows 桌面适配、中文界面、文字轴导入、YGKIT 数据联动、创意工坊以及 AFYG 排轴与本地练轴预设的绑定。
详细整合边界和组合预设协议见 [docs/wwcombo-integration.md](docs/wwcombo-integration.md)。

除文件或子目录另有说明外，本仓库代码按根目录 [LICENSE](LICENSE) 发布。复制、修改或再分发时，请保留
适用的版权声明、许可文本和上游来源说明，并同时阅读原开发者补充声明中关于非商业化的约定。

《鸣潮》及其相关名称、图像和游戏素材的权利归其各自权利人所有。本项目是玩家维护的非官方工具，
与游戏开发商及发行商无隶属或授权关系。
