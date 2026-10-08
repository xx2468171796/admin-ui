---
name: admin-ui
description: 使用 @adminui/react 创建或扩展 React 管理后台页面（含 Go/Rust + SQLite 单服务、REST 接入、手机适配）：先从已审定的 17 个页面模板（T01–T17）选一个，只用已批准的组件套件和色卡；界面改动先出静态演示给产品负责人审。适用于后台 UI 接入与通用组件回流，不用于玩家前台或服务端业务实现。
---

# adminUI

本技能随 SDK 分发，相对包根是 `../../`。只放入口，规则都在包根文档里。

1. **先选模板**：每个后台页面先说清用 [PAGE-TEMPLATES.md](../../PAGE-TEMPLATES.md) 里 T01–T17 哪一个，布局定死只换内容，照 starter 菜单「页面模板」对应的一页改。套不上、要改布局或新组件，先做演示（静态页或 starter 页）给产品负责人看，通过后再写代码，交付时和演示截图逐张对照。
2. **再读 [AI-RULES.md](../../AI-RULES.md)**：§0 基本规则——页面只用套件组件和当前色卡颜色，偏离只在产品负责人特殊要求时并在代码注释写原因；后面是视觉 / 交互硬规则和任务提示词（附录 A）。
3. 接入、Provider 与色卡、adapter、子路径：[INTEGRATION.md](../../INTEGRATION.md)；可用符号查 [catalog.ts](../../src/catalog.ts)。按项目规模起步（小 `examples/small` / 中 `examples/starter` / 大 `examples/large`，只是默认起点，任何子路径都能加，重的懒加载）；`styles.css` 放入口第一行，其它样式跟组件自动进来，不导入 `src/` / `dist/` 深路径。项目钉着 7.x 要升 8.0：先跑 `npx admin-ui-audit <src目录>`，照 [MIGRATION-8.md](../../MIGRATION-8.md) 改。
4. 颜色、尺寸、页面层级、客户门户、动效：[DESIGN.md](../../DESIGN.md)。
5. 列表：先按 [TABLES.md](../../TABLES.md) §1 选形式（主列表 `DataTable`），点开一行走记录详情三档（§3）。格内录数据的页面才用 [GRID.md](../../GRID.md) 的 `BitableGrid`。
6. 批量、视图、任务、草稿、导入、命令面板：[WORKFLOWS.md](../../WORKFLOWS.md)。权限、审计、字典参数、治理：[ACCESS.md](../../ACCESS.md)。
7. 数据看板 / 运营面板 / 报表页：[DASHBOARDS.md](../../DASHBOARDS.md)，先写分类卡再套模板卡，实时指标 3 秒刷新，交付前亲眼看截图。
8. 起步代码：小项目 [small](../../examples/small/src)，中型 [starter](../../examples/starter/src/main.tsx)（页面模板在 [PageTemplates.tsx](../../examples/starter/src/PageTemplates.tsx)），大项目 [large](../../examples/large/src)；Go / Rust + SQLite 从 [single-service](../../examples/single-service/README.md) 起步。

完成时在项目里跑 `npx admin-ui-audit <src目录>`（有基线就加 `--baseline`），新错误清零；规则和忽略注释见 `npx admin-ui-audit --help`，部署后拿桌面 / 手机 / 深色截图和模板截图（`design/templates/tNN-*.png`）对照。验证 360 / 390 / 1440px、深色、一套备用色卡、加载 / 空 / 错误、表单失败与未保存退出。不自动替换生产后台；只在用户指定的项目范围接入，技能不自带部署授权。
