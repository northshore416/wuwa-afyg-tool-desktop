# YGKIT 服务部署

## 网络布局

```text
浏览器
  └─ HTTPS https://ygkit.usotsuki-kaze.com
       └─ Cloudflare Tunnel
            └─ http://127.0.0.1:39818  椰果 Node 服务
                  └─ http://127.0.0.1:8765  gsuid-core + YGKIT + XWUID
```

只开放椰果服务的 `39818`。建议 Node 与 gsuid-core 都监听 `127.0.0.1`；
不要在路由器、防火墙或 Cloudflare Tunnel 中公开 8765。

## 生成密钥

在 PowerShell 中分别运行两次：

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

得到的两个值分别作为 `YGKIT_ISSUER_TOKEN` 和 `YGKIT_READER_TOKEN`。它们必须：

- 只保存在椰果服务与 YGKIT 插件的服务器环境变量中；
- 不能写进前端、聊天消息、Git 仓库或 Cloudflare 公共变量；
- 不能使用同一个值。

## 主力机编译

使用 Node.js 22：

```powershell
corepack pnpm install
corepack pnpm run server:build
```

上传这些内容到服务器：

- `build-server/`
- `node_modules/`（必须与服务器系统、CPU 架构一致；通常建议在服务器重新安装）
- `package.json`
- `pnpm-lock.yaml`
- `YGKIT/`（复制到 gsuid-core 插件目录）

更稳妥的做法是在服务器上传源码后使用 Node.js 22 重新执行
`corepack pnpm install --frozen-lockfile` 和 `corepack pnpm run server:build`，以便正确构建
`better-sqlite3`。

## 环境变量

以 [`.env.server.example`](../.env.server.example) 为模板配置服务。YGKIT 插件需要：

```env
YGKIT_SERVER_URL=https://ygkit.usotsuki-kaze.com
YGKIT_ISSUER_TOKEN=<与椰果服务一致>
YGKIT_READER_TOKEN=<与椰果服务一致>
```

椰果服务需要：

```env
YGKIT_PUBLIC_ORIGIN=https://ygkit.usotsuki-kaze.com
YGKIT_PLUGIN_BASE_URL=http://127.0.0.1:8765
YGKIT_ISSUER_TOKEN=<签发密钥>
YGKIT_READER_TOKEN=<读取密钥>
YGKIT_DATA_DIR=/var/lib/ygkit
```

Node 服务会在启动工作目录自动读取 `.env`、`.env.server` 和
`.env.production`。也可以通过系统环境变量 `YGKIT_ENV_FILE` 指定其他配置文件；
系统环境变量中的同名值优先级最高。

## 启动

在已注入上述环境变量的 shell 中：

```bash
pnpm run server:start
```

服务只监听 `127.0.0.1:39818`。本机验证：

```bash
curl http://127.0.0.1:39818/api/ygkit/health
```

## Cloudflare Tunnel

现有 tunnel 的 ingress 增加：

```yaml
ingress:
    - hostname: ygkit.usotsuki-kaze.com
      service: http://127.0.0.1:39818
    - service: http_status:404
```

Cloudflare 的缓存规则应绕过 `/api/ygkit/*`。接口本身也返回
`Cache-Control: no-store`。

## 用户流程

1. 用户先在 XWUID 中绑定鸣潮 UID，并查询一次角色面板，使 `rawData.json` 有数据。
2. 用户私聊机器人发送 `yg登录`。
3. YGKIT 读取 QQ/XWUID 绑定并向椰果服务签发一次性 ticket。
4. 用户在椰果工具箱的 YGKIT 面板粘贴 ticket。
5. ticket 被原子消费，浏览器只获得 Secure、HttpOnly、SameSite=Lax 的 session cookie。
6. 椰果服务根据该 session 允许的 UID，通过内网读取 XWUID 数据。

ticket 有效期 5 分钟且只能使用一次。勾选保持登录时，session 空闲有效期为 30 天、
绝对有效期为 90 天；不勾选时使用浏览器会话 cookie，服务端空闲有效期为 1 天。
