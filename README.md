# 鸣潮椰果工具箱桌面版 WUWA-AFYG-TOOL Desktop

<p align="center">
  <img src="https://img.shields.io/badge/Framework-SvelteKit-FF3E00?logo=svelte&logoColor=white" alt="SvelteKit">
  <img src="https://img.shields.io/badge/Build-Vite-646CFF?logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/Desktop-Electron-47848F?logo=electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white" alt="SQLite">
</p>

适合《鸣潮》玩家使用的配队、排轴、拉表、伤害计算工具。本仓库是在 WUWA-AFYG-TOOL 网页项目基础上整理出的桌面版源码，保留原有计算与排轴能力，并新增本地桌面端、数据库缓存、文字轴导入和一键打包等功能。

## 下载

- 最新版下载页：[GitHub Releases](https://github.com/northshore416/wuwa-afyg-tool-desktop/releases/latest)
- Windows 安装包直链：[WUWA.AFYG.Tool.Setup.0.0.4.exe](https://github.com/northshore416/wuwa-afyg-tool-desktop/releases/download/v0.0.4/WUWA.AFYG.Tool.Setup.0.0.4.exe)
- 便携版直链：[WUWA.AFYG.Tool.0.0.4.exe](https://github.com/northshore416/wuwa-afyg-tool-desktop/releases/download/v0.0.4/WUWA.AFYG.Tool.0.0.4.exe)

安装版支持选择安装目录，会创建桌面快捷方式和开始菜单快捷方式。便携版下载后可直接运行，不需要安装。

## 桌面版增强

- **Windows 桌面端**：使用 Electron 包装本地前端，双击 exe 即可使用。
- **本地数据缓存**：使用 SQLite 保存从接口拉取的游戏数据，启动后可自动刷新，也支持手动更新数据库。
- **中文界面**：页面按钮、提示、弹窗等已整理为中文显示，并使用 UTF-8 编码保存。
- **文字轴导入**：支持把固定格式或常见简写文本转换成排轴图标。
- **角色缩写识别**：会根据当前选择的三人配队解析角色名单字缩写，重复字会避免误判。
- **新增动作映射**：支持 `a/e/q/r/z`、左键、跳、闪避、变奏、延奏、处决、钩锁等动作。
- **本地保存**：排轴项目可保存到本地，下次打开继续查看；退出时如有未保存内容会提示保存。
- **开发版启动器**：提供批处理启动开发环境，方便本地调试。
- **一键打包**：提供批处理生成 Windows 安装版和便携版。

## 文字轴导入格式

支持换行写法：

```text
千咲ea
夏空eqr
卡提希娅跳aree
```

也支持一行简写和分隔符混用：

```text
爱eaae 千eaa 达aaaeqraa 千re 达aa 千aa 爱aae 千a 变爱aaa 达eer2 爱aaare处aaezr
```

```text
千ea-夏eqr-千a-卡e-夏跳aaa跳aaa跳闪z-延千qre-卡aa-千a-卡a-千a-延卡跳aree
```

动作规则：

| 输入 | 含义 |
| --- | --- |
| `a` / `A` | 左键 |
| `e` / `E` | E 技能 |
| `q` / `Q` | Q 技能 |
| `r` / `R` | R 技能 |
| `z` / `Z` | Z 动作 |
| `跳` / `空格` | Spacebar |
| `闪` / `闪避` / `右键` | 闪避 |
| `变` / `变奏` / `intro` | 变奏，绑定到后一个角色 |
| `延` / `延奏` / `outro` | 延奏，绑定到前一个动作角色 |
| `处` / `处决` | F |
| `钩` / `钩锁` | T |

分隔符会被尽量模糊处理，包括空格、换行、逗号、顿号、短横线等。角色名后面的冒号也会自动忽略。


## 声骸导入接口

桌面版会在页面加载后暴露一个前端桥接对象，供外部插件注入脚本调用：

```ts
await window.WuwaDesktopEchoImport.importEchoes({
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

也可以使用 `postMessage`：

```ts
window.postMessage({ type: 'wuwa-afyg:echo-import', payload }, '*')
```

接口会根据当前项目的三人配队匹配 `character`，同时更新队伍里的声骸名称/Cost，以及词条配置里的主词条、副词条。词条配置已锁定时会拒绝导入，需要先解锁。
## 原有功能

- **队伍配置**：选择角色、武器、声骸、套装等配置。
- **排轴**：编排角色动作块和时间参考线。
- **拉表**：支持 Buff 全局和 Buff 差异模式，为不同伤害段配置 Buff。
- **词条/环境配置**：配置声骸词条、敌人环境等计算参数。
- **结果分析**：输出伤害、DPS、伤害占比和分段计算过程。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | SvelteKit / Svelte 5 / TypeScript |
| 构建 | Vite |
| 样式 | Tailwind CSS |
| 图标 | Iconify / Material Design Icons |
| 桌面端 | Electron |
| 本地数据库 | SQLite / better-sqlite3 |
| 打包 | electron-builder |

## 本地开发

需要先安装 Node.js、Git 和 pnpm。

```bash
pnpm install
pnpm run dev
```

桌面开发版推荐直接双击：

```text
启动开发版.bat
```

也可以手动运行：

```bash
pnpm run desktop:dev
```

## 打包 Windows 客户端

推荐直接双击：

```text
一键打包用户端.bat
```

打包完成后文件会输出到 `release` 目录，常用文件包括：

- `WUWA AFYG Tool Setup 0.0.4.exe`：安装版，可选择安装目录。
- `WUWA AFYG Tool 0.0.4.exe`：便携版，双击即用。

## API

接口基于 Nanoka 数据整理，桌面端会把需要的数据缓存到本地 SQLite，供前端和后续启动复用。

```text
GET /api/v1/list/character
GET /api/v1/list/weapon
GET /api/v1/list/echo
GET /api/v1/list/echo-set
GET /api/v1/icons/character
GET /api/v1/icons/weapon
GET /api/v1/icons/echo
GET /api/v1/icons/element
GET /api/v1/icons/weapon-type
GET /api/v1/icons/echo-set
GET /api/v1/icons/ui-btn
GET /api/v1/info/character/:name
GET /api/v1/info/weapon/:name
GET /api/v1/info/echo/:name
GET /api/v1/info/echo-set/:name
GET /api/v1/recommend/:character
GET /api/v1/recommend-weapon/:character
```

## 仓库说明

本仓库以当前桌面版源码为根目录进行维护，后续开发会直接在本仓库提交、分支和发布。项目仍然依赖原工具的核心计算与前端结构，但新增功能会尽量集中在桌面扩展层和本地服务层，便于后续维护。

## 许可

开源许可和原项目声明请参考 [LICENSE](LICENSE)。
