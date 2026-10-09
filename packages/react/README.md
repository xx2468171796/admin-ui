# adminUI · 通用管理后台 UI SDK

`@adminui/react`：把各项目的管理后台统一成同一套组件、色卡和交互。React 19 / TypeScript 7，shadcn / Radix 组件；图表、Markdown、Excel、多维表格、权限页、组织选人走可选子路径。后端语言不限，接口 / 权限 / 业务规则由项目 adapter 注入。

安装：

```
npm install @adminui/react
```


npm 包发布之前，可以安装 GitHub Release 里的 tarball：`npm install https://github.com/xx2468171796/admin-ui/releases/download/v8.2.0/adminui-react-8.2.0.tgz`，详见接入手册。新项目用最新版；已有项目可以继续钉着原来的版本，要升 8.0 先看 [MIGRATION-8.md](MIGRATION-8.md)。

应用入口第一行 `import '@adminui/react/styles.css'`（只有 token、基础和核心组件），其它样式跟着组件自动进来；只从公开入口导入，重的子路径（grid / views / charts / dashboard-builder / form-builder / access / markdown / excel）懒加载。小 / 中 / 大项目分别从 `examples/small` / `examples/starter` / `examples/large` 起步（INTEGRATION.md §1.0，三档只是默认起点，任何子路径都能加）。

整个后台要繁体中文（台湾用语）：`vite.config.ts` 加 `adminUiLocale({ locale: "zh-Hant" })`（`@adminui/react/vite`，组件库自带文字在构建时转换，见 INTEGRATION.md §1.3）。

装了包就有界面漂移检查命令，放进项目的 verify 门禁：`npx admin-ui-audit apps/web/src --baseline apps/web/ui-audit-baseline.json`（规则和忽略注释见 `npx admin-ui-audit --help`，接入见 [INTEGRATION.md](INTEGRATION.md) §10）。

## 文档

| 文档 | 什么时候读 |
|---|---|
| [AI-RULES.md](AI-RULES.md) | **写任何后台页面前**：先选模板、界面改动先出演示；组件套件清单（只用套件组件和色卡颜色）、视觉与交互硬规则、任务提示词、宿主 AGENTS.md 片段 |
| [PAGE-TEMPLATES.md](PAGE-TEMPLATES.md) | **每个页面从哪个模板起步**：已审定的 T01–T17（布局定死、内容换），每个的用途、骨架、组件、示例代码、演示文件 |
| [INTEGRATION.md](INTEGRATION.md) | 安装、样式规则、按项目规模起步、入口与子路径、Provider 与色卡、外壳、列表 / 表单 / 上传 / 报表 / 图表 adapter、Go / Rust 单服务、发版 |
| [DESIGN.md](DESIGN.md) | 色卡（6 套，森林绿默认）、尺寸与字体、页面层级、资源面板、客户门户、动效 |
| [TABLES.md](TABLES.md) | 选哪种列表、`DataTable`、记录详情三档 |
| [GRID.md](GRID.md) | 多维表格 `BitableGrid`（可选子路径，只给格内录数据的页面） |
| [WORKFLOWS.md](WORKFLOWS.md) | 批量、视图、偏好、任务、刷新、草稿、冲突、导入、命令面板、工作区 |
| [ACCESS.md](ACCESS.md) | 角色权限、审计、字典 / 参数、多租户治理 |
| [DASHBOARDS.md](DASHBOARDS.md) | 数据看板 / 运营面板 / 报表页：先写分类卡，再套业务模板卡 |
| [CHANGELOG.md](CHANGELOG.md) | 版本记录 |
| [MIGRATION-8.md](MIGRATION-8.md) | 升到 8.0：旧 → 新对照表、`admin-ui-audit` 规则 |
| [AGENTS.md](AGENTS.md) | 给改这个包的人 / AI：改哪里跑哪个门禁 |
| [THIRD-PARTY.md](THIRD-PARTY.md) | 第三方许可 |

其他入口：[src/catalog.ts](src/catalog.ts)（`@adminui/react/catalog`，可查询的能力清单和 `PAGE_TEMPLATES`）、[examples/small](examples/small) / [examples/large](examples/large)（小 / 大项目起步样板）、[examples/starter](examples/starter)（中型起步样板、完整演示后台，菜单「页面模板」是 T01–T17 的 React 版）、[examples/single-service](examples/single-service/README.md)（Go / Rust + SQLite 真实接线案例）、[examples/governance](examples/governance/README.md)（审计与授权的 SQLite 服务参考）、[skills/admin-ui/SKILL.md](skills/admin-ui/SKILL.md)（随包技能入口）。

## 边界

业务可以自由扩展字段、列、菜单和 API；共享外观与交互从 SDK 引用，不复制 SDK 源码或样式。SDK 不含生产账号、资金规则、真实上传存储或服务端权限系统；starter 里是可替换的演示 adapter。
