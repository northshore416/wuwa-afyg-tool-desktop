# YGKIT

YGKIT 是 gsuid-core 插件，前缀为 `yg`，负责把 QQ/XutheringWavesUID 的 UID
绑定安全地桥接给椰果工具箱。

兼容基线：XutheringWavesUID `main` commit
`a118a1b7230b223be3d3368efdf340e3f7863b65`。

## 安装

把整个 `YGKIT` 目录放到 gsuid-core 的插件目录，并在 gsuid-core 进程中配置：

`YGKIT` 应与 XWUID 仓库目录同级。插件兼容 XWUID 常见的单层包、仓库双层目录及
`gsuid_core.plugins` 命名空间加载方式。

```env
YGKIT_SERVER_URL=https://ygkit.usotsuki-kaze.com
YGKIT_ISSUER_TOKEN=<与椰果服务相同的签发密钥>
YGKIT_READER_TOKEN=<与椰果服务相同的读取密钥>
```

重启 gsuid-core。用户私聊机器人发送 `yg登录`，插件会读取该 QQ 在 XWUID 中
绑定的 UID，并签发一个只能使用一次、5 分钟内有效的 ticket。

配置既可以由启动进程直接注入，也可以写入 gsuid-core 工作目录的 `.env`，或写入
`plugins/YGKIT/.env`。YGKIT 只会从这些文件读取以 `YGKIT_` 开头的变量；修改后
必须完整重启 gsuid-core。

插件附加的接口：

- `GET /api/ygkit/v1/health`
- `GET /api/ygkit/v1/uids/{uid}/characters`

两者都要求 `Authorization: Bearer <YGKIT_READER_TOKEN>`。gsuid-core 的 8765
端口不应直接暴露到公网。
