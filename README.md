# 椰果工具箱服务器版

面向《鸣潮》的队伍配置、排轴、拉表、伤害计算与方案分享服务。项目现以 SvelteKit Node
服务器为唯一部署目标，不再包含 Electron 主进程、桌面打包、客户端自更新或内核更新结构。

## 页面

- `/`：椰果工具箱，项目保存在当前浏览器的 IndexedDB 中。
- `/workshop`：独立挂载的创意工坊。
- `/api/ygkit/*`：YGKIT ticket 登录、会话和 XWUID 数据读取接口。
- `/api/workshop/*`：创意工坊公开列表及登录后的发布、应用接口。

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
- YGKIT 用户、ticket、session、UID 绑定、创意工坊方案：`YGKIT_DATA_DIR/ygkit.db`。
- SQLite 启用 WAL 和外键。

备份服务器时需要一并备份 `ygkit.db`、`ygkit.db-wal` 和 `ygkit.db-shm`，或先停止服务再复制数据库。

## 安全边界

- ticket 五分钟过期且只能消费一次；
  -登录态使用 `HttpOnly`、`SameSite=Lax` cookie，HTTPS 下使用 `Secure` 和 `__Host-` 前缀；
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
```

## 许可

开源许可和上游声明见 [LICENSE](LICENSE)。
