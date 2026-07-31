# YGKIT 与创意工坊部署

## 网络结构

```text
浏览器
  └─ HTTPS https://ygkit.usotsuki-kaze.com
       └─ Cloudflare Tunnel
            └─ http://127.0.0.1:39818  椰果 Node 服务
                 └─ http://127.0.0.1:8765  gsuid-core + YGKIT + XWUID
```

仅向 Tunnel 暴露 `39818`。Node 和 gsuid-core 都建议监听 `127.0.0.1`，不要公开 `8765`。

## Cloudflare Tunnel

```yaml
ingress:
    - hostname: ygkit.usotsuki-kaze.com
      service: http://127.0.0.1:39818
    - service: http_status:404
```

工具箱位于 `/`，创意工坊位于 `/workshop`，不需要第二个进程或端口。若以后希望使用
`workshop.ygkit.usotsuki-kaze.com`，可以让反向代理将该域名的根路径重写到 `/workshop`，
但 cookie 与同源策略会随域名变化，第一版建议保持同一域名。

Cloudflare 缓存规则应绕过 `/api/ygkit/*` 和 `/api/workshop/*`。

## 生成 token

在 PowerShell 中分别运行两次：

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

得到的值分别作为 `YGKIT_ISSUER_TOKEN` 和 `YGKIT_READER_TOKEN`。两者不能相同，不能写入 Git、
前端代码或聊天消息。

## Node 服务环境

```env
YGKIT_PUBLIC_ORIGIN=https://ygkit.usotsuki-kaze.com
YGKIT_PLUGIN_BASE_URL=http://127.0.0.1:8765
YGKIT_ISSUER_TOKEN=<签发 token>
YGKIT_READER_TOKEN=<读取 token>
YGKIT_DATA_DIR=D:\YGKIT\data
YGKIT_ADMIN_QQ_IDS=123456789,987654321
```

服务会按顺序读取工作目录中的 `.env`、`.env.server`、`.env.production`。系统环境变量优先级最高，
也可用 `YGKIT_ENV_FILE` 指定配置文件。

## YGKIT 插件环境

```env
YGKIT_SERVER_URL=https://ygkit.usotsuki-kaze.com
YGKIT_ISSUER_TOKEN=<与 Node 服务一致>
YGKIT_READER_TOKEN=<与 Node 服务一致>
```

插件放入 gsuid-core 的插件目录，重启或通过对应插件管理命令重载。运行进程必须实际读取到这些环境变量；
仅在另一个 PowerShell 窗口中设置不会影响已启动的 gsuid-core。

## 构建与启动

使用 Node.js 22：

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run server:build
corepack pnpm run server:start
```

健康检查：

```powershell
curl.exe http://127.0.0.1:39818/api/ygkit/health
curl.exe http://127.0.0.1:39818/api/workshop/items
```

## 用户流程

1. 用户在 XWUID 绑定鸣潮 UID，并至少查询一次角色面板。
2. 用户私聊机器人发送 `yg登录`。
3. YGKIT 根据 QQ/XWUID 绑定向 Node 服务签发五分钟一次性 ticket。
4. 用户在 `/workshop` 或工具箱 YGKIT 面板粘贴 ticket。
5. YGKIT 同时把事件中的 QQ 昵称、头像和 UID 绑定写入用户资料，浏览器获得 `HttpOnly` session cookie。
6. 用户可投稿或应用工坊方案；投稿审核通过后公开。
7. 应用后进入工具箱，同一会话会按当前三人队自动匹配账户声骸，也可以在词条页切换回自定义配置。

## 管理员与审核

Node 服务通过 `YGKIT_ADMIN_QQ_IDS` 配置管理员 QQ 号，多个号码使用英文逗号分隔。管理员与普通用户
使用完全相同的 `yg登录` ticket，不设置第二套密码。

```text
https://ygkit.usotsuki-kaze.com/workshop/admin
```

新投稿状态为 `pending`；管理员可以通过并发布，或填写理由驳回。旧版本已经存在的工坊记录在数据库
迁移时保持公开，避免升级后全部消失。修改管理员列表后重启 Node 服务并刷新页面。

## 创意工坊数据

工坊表与 YGKIT 会话共用 `YGKIT_DATA_DIR/ygkit.db`。首次访问工坊 API 时会自动建表。
发布接口会在服务器端清除个人声骸，而非信任前端上传内容。

建议定期备份数据库。运行中备份应使用 SQLite 在线备份方式；简单文件复制时应先停止 Node 服务，
并同时处理 WAL/SHM 文件。
