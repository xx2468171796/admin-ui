# 参与 admin-ui

谢谢你的帮助！问题报告、文档修正、新示例、新组件都欢迎。[English](CONTRIBUTING.md)

## 动手前

- 比小修复大的改动，先开 issue 把 API 和样子对齐。组件是很多后台共用的契约，新加的属性或类名很难收回。
- 先读 `packages/react/AI-RULES.md` 和 `packages/react/DESIGN.md`：颜色只来自色卡，控件高 36px（小号 28px），样式只作用在 `.adminui` 内，重依赖只走可选子路径。

## 环境

需要 Node.js 26+、npm 11+。

```sh
npm ci            # 或 npm install
npm run build     # dist/ 不提交，先编译一次
npm run check     # 类型 + 单测 + 审计 + 样式块 + dist 核对 + 体积预算
npm run docs:dev  # 文档站（带在线演示）
```

浏览器测试（Playwright）本地可选：`npx playwright install chromium` 后跑 `npm run test:browser`，或只跑相关的一组，例如 `npm run test:grid -w @adminui/react`。哪组测试覆盖哪些文件见 `packages/react/AGENTS.md`。

## 提交改动

1. 从 `main` 拉分支。
2. 公开能力同步改：`src/index.ts`（或子路径入口）导出、`src/catalog.ts` 条目、文档页、medium 示例、`CHANGELOG.md` 的「未发布」一节。
3. 跑 `npm run check` 和改动范围对应的浏览器测试；动了体积敏感的代码看一下 `npm run size`。
4. 跑 `npm run guard`——CI 会拒绝不该出现在本仓的名称和引用。
5. 按模板提 PR。视觉改动必须附截图（浅色、深色、390px 手机）。

## 提交信息

一句话主题（如 `grid: 调列宽时保持冻结列`），正文写清「为什么」。一个 PR 一件事。

## 发版

维护者在 `main` 上打 `vX.Y.Z` 标签，发布流程自动编译、检查并带出处证明（provenance）发到 npm。版本号遵循 semver，破坏性变更在 `CHANGELOG.md` 写迁移说明。

## 许可

提交贡献即表示你同意按 [MIT 许可](LICENSE) 授权你的贡献。
