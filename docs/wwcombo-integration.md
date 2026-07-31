# wwcombo 单仓库整合

## 目录边界

- 根目录 src：AFYG 服务端、创意工坊和排轴前端。
- apps/wwcombo/src：本地连段训练器 React 前端。
- apps/wwcombo/combo-core：录制、练习和时间轴核心逻辑。
- apps/wwcombo/src-tauri：Windows 全局输入、置顶窗口、文件和视频能力。

外部 wwcombo 克隆仅用于对照，不参与开发或构建。服务端网页不会加载 Tauri API，也不会获得全局输入权限。

## 绑定与导入流程

1. 作者在 AFYG 创意工坊发布排轴时，选择一份 wwcombo 导出的 .wwcombo.json。
2. 服务端校验文件类型、版本、动作数量、时间范围和 1 MB 大小限制。
3. AFYG 工程保存在 workshop_items，练轴谱独立保存在 workshop_attachments。
4. 稿件审核公开后，详情页可下载 .afyg-workshop.json 组合预设。
5. 用户在 apps/wwcombo 训练器中点击“导入”，选择组合预设，即可把其中的练轴谱加入连段列表。

旧工坊数据没有练轴附件时仍按原逻辑工作，不需要迁移 Project 格式。

## 组合预设协议

```json
{
    "type": "afyg-workshop-bundle",
    "version": 1,
    "exportedAt": 0,
    "workshop": {},
    "project": {},
    "practiceCharts": [
        {
            "id": "attachment-id",
            "type": "wwcombo-chart",
            "schemaVersion": 3,
            "title": "连段名称",
            "package": {
                "type": "wwcombo-chart",
                "version": 3,
                "chart": {}
            }
        }
    ]
}
```

练轴附件不写入 AFYG Project，避免内核项目格式升级时相互影响。训练器仍兼容原生 wwcombo-chart 文件。

## 开发命令

```powershell
corepack pnpm install
corepack pnpm run dev
corepack pnpm run trainer:dev
corepack pnpm run trainer:desktop:dev
```

桌面开发和打包需要 Rust stable、Microsoft C++ Build Tools 与 WebView2。视频导出会优先寻找打包资源中的 ffmpeg.exe，随后检查应用目录和系统 PATH。仓库忽略 apps/wwcombo/src-tauri/resources/ffmpeg.exe，避免把 138 MB 第三方二进制当作源码提交。普通桌面构建运行 corepack pnpm run trainer:desktop:build；需要捆绑视频导出能力时，将可分发的 ffmpeg.exe 放入该目录，再运行 corepack pnpm run trainer:desktop:build:full。

## 安全与兼容

- 服务端只接收 JSON，不执行练轴文件中的代码。
- 单份练轴谱最多 2000 个动作、10 分钟时间范围、1 MB。
- 下载接口只返回已公开稿件的附件。
- 每份附件保存 SHA-256 校验值，便于未来做版本更新和缓存。
- 当前第一版只实现“排轴绑定练轴谱并导入练习”，不做 wwcombo 到 AFYG 时间轴转换。
